import re
import ast
import asyncio
import logging
from collections import OrderedDict

import chromadb
from chromadb.utils import embedding_functions
from langchain_community.utilities import SQLDatabase
from langchain_ollama import OllamaLLM
import sqlalchemy as sa
from sqlalchemy import text as sa_text

from config import (
    DATABASE_URL,
    CHROMA_PATH,
    CHROMA_COLLECTION,
    EMBEDDING_MODEL,
    OLLAMA_MODEL,
)

logger = logging.getLogger(__name__)

# ── Lazy singletons ───────────────────────────────────────────────────────────

_chroma_client = None
_collection    = None
_db            = None
_llm           = None
_sql_engine    = None

def _get_collection():
    global _chroma_client, _collection
    if _collection is None:
        emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL
        )
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = _chroma_client.get_collection(
            name=CHROMA_COLLECTION,
            embedding_function=emb_fn
        )
    return _collection

def _get_db():
    global _db
    if _db is None:
        _db = SQLDatabase.from_uri(DATABASE_URL)
    return _db

def _get_llm():
    global _llm
    if _llm is None:
        # num_predict caps output length → much faster on low-power hardware
        _llm = OllamaLLM(model=OLLAMA_MODEL, temperature=0, num_predict=400)
    return _llm

def _get_sql_engine():
    global _sql_engine
    if _sql_engine is None:
        _sql_engine = sa.create_engine(DATABASE_URL, pool_pre_ping=True)
    return _sql_engine


# ── LRU query cache (dataset is static — safe to cache indefinitely) ──────────

_query_cache: OrderedDict = OrderedDict()
_CACHE_MAX = 128

def _cache_key(question: str) -> str:
    return re.sub(r'\s+', ' ', question.lower().strip())

def _cache_get(key: str):
    entry = _query_cache.get(key)
    if entry is not None:
        _query_cache.move_to_end(key)
    return entry

def _cache_set(key: str, value: dict):
    _query_cache[key] = value
    _query_cache.move_to_end(key)
    if len(_query_cache) > _CACHE_MAX:
        _query_cache.popitem(last=False)


# ── Prompt pieces ─────────────────────────────────────────────────────────────

# Trimmed to the 4 most representative examples — fewer tokens = faster generation
FEW_SHOT_EXAMPLES = """EXAMPLES:
Q: How many profiles are in the database?
A: I'll count all ARGO profiles.
```sql
SELECT COUNT(*) FROM argo_profiles
```

Q: What is the average surface temperature for profile 2903954_5?
A: Surface means pressure < 10 dbar.
```sql
SELECT AVG(temperature) FROM argo_readings WHERE profile_id = '2903954_5' AND pressure < 10
```

Q: Show data for profiles 5 to 15
A: I'll use cycle_number for the range — profile_id is a string and can't be compared numerically.
```sql
SELECT r.profile_id, r.pressure, r.temperature, r.salinity
FROM argo_readings r
JOIN argo_profiles p ON r.profile_id = p.profile_id
WHERE p.cycle_number BETWEEN 5 AND 15
```

Q: Hello!
A: Hello! I'm FloatChat. Ask me anything about ARGO float data — temperatures, salinity, depth profiles, or trajectories.
"""

GLOBAL_KEYWORDS = [
    "total", "all profiles", "average of all", "across all",
    "highest", "lowest", "maximum", "minimum", "most", "least",
    "overall", "entire", "every profile", "how many",
]

def _is_global_query(question: str) -> bool:
    q = question.lower()
    return any(kw in q for kw in GLOBAL_KEYWORDS)


def _build_prompt(user_question: str, chat_history: list[dict], ids_found: list[str]) -> str:
    history_text = ""
    if chat_history:
        recent = chat_history[-4:]
        lines = [f"{t.get('role','').upper()}: {str(t.get('content',''))[:300]}" for t in recent]
        history_text = "\nCONVERSATION HISTORY:\n" + "\n".join(lines)

    hints = f"\nRELEVANT PROFILE IDs: {ids_found}" if ids_found else ""

    return f"""You are FloatChat, a conversational oceanographic AI and PostgreSQL expert.

DATABASE SCHEMA:
  argo_profiles: profile_id (VARCHAR e.g. '2903954_10'), float_id (VARCHAR), cycle_number (INTEGER), latitude (FLOAT), longitude (FLOAT), record_time (TIMESTAMP)
  argo_readings: id (SERIAL), profile_id (VARCHAR FK), pressure (FLOAT dbar), temperature (FLOAT), salinity (FLOAT)

RULES:
- Give a brief natural-language explanation, then SQL in a ```sql ... ``` block.
- NEVER use BETWEEN/>/< on profile_id. Use cycle_number (INTEGER) for numeric ranges.
- If no SQL is needed (greeting, general question), reply in plain text only.

{FEW_SHOT_EXAMPLES}{history_text}{hints}

QUESTION: {user_question}"""


def _build_correction_prompt(failed_sql: str, error: str) -> str:
    return f"""This SQL query failed:

```sql
{failed_sql}
```

PostgreSQL error: {error}

Fix it. Remember: profile_id is VARCHAR — use cycle_number (INTEGER) for ranges.
Reply with the corrected SQL in a ```sql ... ``` block."""


# ── SQL / LLM helpers ─────────────────────────────────────────────────────────

def _parse_llm_response(raw: str) -> tuple[str, str]:
    """Return (clean_sql, explanation_text)."""
    sql_match = re.search(r"```sql\s*(.*?)\s*```", raw, re.IGNORECASE | re.DOTALL)
    if sql_match:
        sql = sql_match.group(1).strip()
        text = re.sub(r"```sql\s*.*?\s*```", "", raw, flags=re.IGNORECASE | re.DOTALL).strip()
        return sql, text

    match = re.search(r"SELECT\b", raw, re.IGNORECASE)
    if match:
        sql_start = raw[match.start():]
        stop = re.search(r";|\n\n", sql_start)
        sql = sql_start[:stop.start()].strip() if stop else sql_start.strip()
        return sql, raw[:match.start()].strip()

    return "", raw.strip()


def _execute_with_columns(sql: str) -> tuple[list[str], list[list]]:
    """Run SQL once and return (column_names, rows_as_lists)."""
    with _get_sql_engine().connect() as conn:
        cursor = conn.execute(sa_text(sql))
        columns = list(cursor.keys())
        rows = [list(row) for row in cursor.fetchall()]
    return columns, rows


# ── Async streaming pipeline ──────────────────────────────────────────────────

async def hybrid_query_stream(
    user_question: str,
    chat_history: list[dict] | None = None,
):
    """
    Async generator yielding (event_type, data) tuples:
      "status"      → str  (progress label shown in the UI)
      "token"       → str  (explanation text chunk)
      "sql"         → str  (SQL query string)
      "table"       → {"columns": [...], "rows": [[...]]}
      "result_text" → str  (scalar or error message)
    """
    chat_history = chat_history or []
    loop = asyncio.get_event_loop()
    key = _cache_key(user_question)

    # ── Cache hit: replay stored result without touching the LLM ──────────────
    cached = _cache_get(key)
    if cached:
        if cached.get("explanation"):
            yield "token", cached["explanation"]
        if cached.get("sql"):
            yield "sql", cached["sql"]
        if cached.get("table"):
            yield "table", cached["table"]
        elif cached.get("result_text"):
            yield "result_text", cached["result_text"]
        return

    # ── Vector search ─────────────────────────────────────────────────────────
    yield "status", "Searching vector database…"

    ids_found = []
    if not _is_global_query(user_question):
        try:
            n = 10 if any(kw in user_question.lower() for kw in ["range", "between", "to", "from"]) else 5
            results = await loop.run_in_executor(
                None,
                lambda: _get_collection().query(query_texts=[user_question], n_results=n),
            )
            ids_found = results['ids'][0]
        except Exception as e:
            logger.warning(f"Vector search failed: {e}")

    # ── LLM streaming ─────────────────────────────────────────────────────────
    yield "status", "Generating response…"

    prompt = _build_prompt(user_question, chat_history, ids_found)
    llm = _get_llm()

    full_text = ""
    sent_up_to = 0  # how many chars have already been yielded as tokens

    try:
        async for chunk in llm.astream(prompt):
            full_text += chunk
            sql_pos = full_text.find("```sql")
            if sql_pos == -1:
                # Still in explanation — stream every new character
                new_part = full_text[sent_up_to:]
                if new_part:
                    yield "token", new_part
                sent_up_to = len(full_text)
            else:
                # Yield any explanation text before the SQL block, then stop
                if sent_up_to < sql_pos:
                    yield "token", full_text[sent_up_to:sql_pos]
                    sent_up_to = sql_pos
                # Don't yield SQL block as tokens — it'll come as a "sql" event
    except Exception as e:
        yield "token", f"The AI model is not responding. Is Ollama running? ({e})"
        return

    clean_sql, explanation = _parse_llm_response(full_text)

    # ── Pure text response (no SQL needed) ────────────────────────────────────
    if not clean_sql:
        _cache_set(key, {"explanation": explanation})
        return

    yield "sql", clean_sql
    yield "status", "Querying database…"

    # ── SQL execution (with one self-correction attempt) ──────────────────────
    columns: list[str] = []
    rows: list[list] = []

    try:
        columns, rows = await loop.run_in_executor(None, lambda: _execute_with_columns(clean_sql))
    except Exception as first_err:
        logger.warning(f"SQL failed ({first_err}), attempting self-correction…")
        yield "status", "Fixing query…"
        correction_prompt = _build_correction_prompt(clean_sql, str(first_err))
        try:
            corrected_raw = await loop.run_in_executor(None, lambda: _get_llm().invoke(correction_prompt))
            corrected_sql, _ = _parse_llm_response(corrected_raw)
            if not corrected_sql:
                raise ValueError("No corrected SQL found in response")
            columns, rows = await loop.run_in_executor(None, lambda: _execute_with_columns(corrected_sql))
            clean_sql = corrected_sql
            yield "sql", clean_sql  # update the displayed SQL
        except Exception as second_err:
            logger.error(f"Self-correction failed: {second_err}")
            yield "result_text", "I ran into a persistent database error. Please try rephrasing your question."
            return

    # ── Emit result ───────────────────────────────────────────────────────────
    if not rows:
        msg = "The query ran successfully but returned no matching data."
        yield "result_text", msg
        _cache_set(key, {"explanation": explanation, "sql": clean_sql, "result_text": msg})
        return

    table = {"columns": columns, "rows": rows}
    yield "table", table
    _cache_set(key, {"explanation": explanation, "sql": clean_sql, "table": table})


# ── Synchronous wrapper (used by /eval endpoint only) ─────────────────────────

def hybrid_query(
    user_question: str,
    chat_history: list[dict] | None = None,
    return_meta: bool = False,
    return_text: bool = False,
):
    chat_history = chat_history or []
    is_global = _is_global_query(user_question)

    ids_found = []
    if not is_global:
        try:
            n = 10 if any(kw in user_question.lower() for kw in ["range", "between", "to", "from"]) else 5
            results = _get_collection().query(query_texts=[user_question], n_results=n)
            ids_found = results['ids'][0]
        except Exception as e:
            logger.warning(f"Vector search failed: {e}")

    prompt = _build_prompt(user_question, chat_history, ids_found)

    try:
        raw_response = _get_llm().invoke(prompt)
    except Exception as e:
        err = "The AI model is not responding. Is Ollama running?"
        if return_text and return_meta: return err, "", err
        if return_meta: return err, ""
        return err

    clean_sql, explanation = _parse_llm_response(raw_response)

    if not clean_sql:
        if return_text and return_meta: return explanation, "", explanation
        if return_meta: return explanation, ""
        return explanation

    # Self-correction loop
    for attempt in range(2):
        try:
            raw_db_result = _get_db().run(clean_sql)
            break
        except Exception as e:
            if attempt == 0:
                logger.warning(f"SQL failed, self-correcting: {e}")
                try:
                    corr_raw = _get_llm().invoke(_build_correction_prompt(clean_sql, str(e)))
                    clean_sql, _ = _parse_llm_response(corr_raw)
                except Exception:
                    pass
            else:
                err = "I tried to run that query but hit a persistent database error. Please try rephrasing!"
                if return_text and return_meta: return err, clean_sql, explanation
                if return_meta: return err, clean_sql
                return err

    cleaned = re.sub(r"Decimal\('([^']+)'\)", r"\1", str(raw_db_result))
    if isinstance(cleaned, str) and cleaned.strip().startswith("["):
        try:
            result = ast.literal_eval(cleaned)
            if result in [[], [()], [(None,)]]:
                result = "Query returned no matching data."
        except (ValueError, SyntaxError):
            result = cleaned
    else:
        result = cleaned

    if return_text and return_meta: return result, clean_sql, explanation
    if return_meta: return result, clean_sql
    return result
