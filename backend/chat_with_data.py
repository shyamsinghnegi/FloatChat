import re
import ast
import asyncio
import logging
import random
from collections import OrderedDict

import chromadb
from chromadb.utils import embedding_functions
from langchain_community.utilities import SQLDatabase
from langchain_google_genai import ChatGoogleGenerativeAI
import sqlalchemy as sa
from sqlalchemy import text as sa_text

from config import (
    DATABASE_URL,
    CHROMA_PATH,
    CHROMA_COLLECTION,
    EMBEDDING_MODEL,
    GEMINI_API_KEY,
    GEMINI_MODEL,
)
from geo import region_for

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
        # max_output_tokens caps response length → faster, cheaper generations
        _llm = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            temperature=0,
            max_output_tokens=400,
            google_api_key=GEMINI_API_KEY,
        )
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

Q: Which floats are in the Bay of Bengal?
A: Bay of Bengal floats have latitude >= 5 and longitude >= 78.
```sql
SELECT DISTINCT float_id FROM argo_profiles WHERE latitude >= 5 AND longitude >= 78
```

Q: Hello, what can you help me with today?
A: Hey there! I'm here to help you explore ARGO ocean float data. What would you like to know?
"""

# Same region boundaries as geo.region_for(), expressed as SQL predicates the
# LLM can use directly instead of guessing at region names.
REGION_BOUNDARIES = """REGIONS (derived from latitude/longitude, not stored as a column):
  Bay of Bengal: latitude >= 5 AND longitude >= 78
  Arabian Sea: latitude >= 5 AND longitude < 78
  Southern Indian Ocean: latitude <= -5
  Equatorial Indian Ocean: latitude > -5 AND latitude < 5"""

GLOBAL_KEYWORDS = [
    "total", "all profiles", "average of all", "across all",
    "highest", "lowest", "maximum", "minimum", "most", "least",
    "overall", "entire", "every profile", "how many",
]

def _is_global_query(question: str) -> bool:
    q = question.lower()
    return any(kw in q for kw in GLOBAL_KEYWORDS)


GREETING_PATTERNS = [
    "hi", "hi there", "hello", "hello there", "hey", "hey there",
    "yo", "sup", "howdy", "good morning", "good afternoon", "good evening",
]

GREETING_REPLIES = [
    "Hey! I'm here to help you explore ARGO ocean float data. What would you like to know?",
    "Hello! Ask me about float temperatures, salinity, dive profiles, or ocean regions.",
    "Hi there! I can look up anything in the ARGO float database. What are you curious about?",
    "Hey, glad you're here! Try asking about a specific float, region, or measurement.",
    "Hello! I'm ready when you are. Ask about temperature, salinity, depth, or a specific float.",
]

def _is_greeting(question: str) -> bool:
    q = question.lower().strip().rstrip("!.?")
    return q in GREETING_PATTERNS


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

{REGION_BOUNDARIES}

RULES:
- Give a brief natural-language explanation, then SQL in a ```sql ... ``` block.
- NEVER use BETWEEN/>/< on profile_id. Use cycle_number (INTEGER) for numeric ranges.
- When a question names a region (Bay of Bengal, Arabian Sea, etc.), translate it to the matching lat/lon predicate above.
- For greetings/small talk, respond warmly in your own words — vary your phrasing each time, don't reuse a fixed script.
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


def _build_answer_prompt(user_question: str, sql: str, columns: list[str], rows: list[list]) -> str:
    preview_rows = rows[:20]
    truncated = len(rows) > 20
    table_text = f"Columns: {columns}\nRows: {preview_rows}"
    if truncated:
        table_text += f"\n(showing first 20 of {len(rows)} rows)"

    return f"""You are FloatChat, an oceanography tutor helping someone learn to read ARGO float data. \
They asked a question, SQL ran against the database, and here are the real results. \
Explain what the results actually mean in plain English — don't just restate the numbers.

{REGION_BOUNDARIES}

RULES:
- Speak directly to the numbers: state the actual values from the results.
- Add brief context a beginner would find useful (e.g. what a typical range is, what the region name means, why a value might look the way it does) — one or two sentences, not a lecture.
- If the result is a single number, lead with it plainly ("The average surface temperature was 28.4°C...").
- If it's a list/table, summarize the pattern (range, notable high/low, count) rather than listing every row.
- Never mention SQL, columns, or "the query" — the person only sees your words, not the technical layer.
- Keep it to 2-4 sentences unless the data genuinely needs more.

QUESTION: {user_question}

SQL THAT RAN: {sql}

RESULTS:
{table_text}"""


# ── SQL / LLM helpers ─────────────────────────────────────────────────────────

def _extract_text(content) -> str:
    """Normalize a chat model's .content — plain str, or a list of content blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(block.get("text", ""))
        return "".join(parts)
    return str(content) if content else ""


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
    Two LLM passes: one writes the SQL silently, one explains the real
    results in plain English (streamed to the user as "token" events).
    Async generator yielding (event_type, data) tuples:
      "status" → str  (progress label shown in the UI)
      "token"  → str  (streamed answer text chunk)
      "sql"    → str  (generated SQL, shown for transparency)
      "table"  → {"columns": [...], "rows": [[...]]}
    """
    chat_history = chat_history or []
    loop = asyncio.get_event_loop()
    key = _cache_key(user_question)

    # ── Greeting short-circuit: skip the LLM entirely, pick a varied reply ────
    if _is_greeting(user_question):
        yield "token", random.choice(GREETING_REPLIES)
        return

    # ── Cache hit: replay stored result without touching the LLM ──────────────
    cached = _cache_get(key)
    if cached:
        if cached.get("explanation"):
            yield "token", cached["explanation"]
        if cached.get("sql"):
            yield "sql", cached["sql"]
        if cached.get("table"):
            yield "table", cached["table"]
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

    # ── LLM: write the SQL (not shown to the user — it's a means, not the answer) ──
    yield "status", "Writing a query…"

    prompt = _build_prompt(user_question, chat_history, ids_found)

    try:
        raw_msg = await loop.run_in_executor(None, lambda: _get_llm().invoke(prompt))
        full_text = _extract_text(raw_msg.content)
    except Exception as e:
        yield "token", f"The AI model is not responding right now. ({e})"
        return

    clean_sql, explanation = _parse_llm_response(full_text)

    # ── Pure text response (no SQL needed, e.g. a greeting) ───────────────────
    if not clean_sql:
        yield "token", explanation
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
            corrected_msg = await loop.run_in_executor(None, lambda: _get_llm().invoke(correction_prompt))
            corrected_sql, _ = _parse_llm_response(_extract_text(corrected_msg.content))
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
        msg = "That search came back empty. No rows in the database matched what you asked for. Try rephrasing, or check the float ID / date range."
        yield "token", msg
        _cache_set(key, {"sql": clean_sql, "explanation": msg})
        return

    table = {"columns": columns, "rows": rows}

    # ── Second pass: explain the actual results in plain English ──────────────
    yield "status", "Thinking about what this means…"
    answer_prompt = _build_answer_prompt(user_question, clean_sql, columns, rows)
    answer_text = ""
    try:
        async for chunk in _get_llm().astream(answer_prompt):
            piece = _extract_text(chunk.content) if hasattr(chunk, "content") else chunk
            answer_text += piece
            yield "token", piece
    except Exception as e:
        fallback = "Here's what the query returned:"
        yield "token", fallback
        answer_text = fallback
        logger.warning(f"Answer generation failed, falling back to raw table: {e}")

    yield "table", table
    _cache_set(key, {"sql": clean_sql, "explanation": answer_text, "table": table})


# ── Synchronous wrapper (used by evaluator.py only — returns the raw scalar
#    result for grading, not a conversational answer) ──────────────────────────

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
        raw_response = _extract_text(_get_llm().invoke(prompt).content)
    except Exception as e:
        err = "The AI model is not responding right now."
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
                    corr_raw = _extract_text(_get_llm().invoke(_build_correction_prompt(clean_sql, str(e))).content)
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
