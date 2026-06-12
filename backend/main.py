import re
import json
import asyncio
import logging
import uuid
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import sqlalchemy as sa
from sqlalchemy import text

from config import DATABASE_URL, DB_POOL_SIZE, DB_MAX_OVERFLOW, DB_POOL_RECYCLE
from chat_with_data import hybrid_query, hybrid_query_stream

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FloatChat API", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = sa.create_engine(
    DATABASE_URL,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_recycle=DB_POOL_RECYCLE,
    pool_pre_ping=True,
)

class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []
    session_id: Optional[str] = None

class EvalRequest(BaseModel):
    file_path: str = "test_cases.json"

def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def stream_query(question: str, history: list[dict], session_id: str) -> AsyncGenerator[str, None]:
    try:
        full_content = ""
        sql = None
        table_data = None

        async for event_type, data in hybrid_query_stream(question, history):
            if event_type == "status":
                yield sse_event({"type": "status", "text": data})

            elif event_type == "token":
                full_content += data
                yield sse_event({"type": "token", "text": data})

            elif event_type == "sql":
                sql = data
                yield sse_event({"type": "sql", "sql": sql})

            elif event_type == "table":
                table_data = data  # {"columns": [...], "rows": [[...]]}
                yield sse_event({"type": "table", "columns": data["columns"], "rows": data["rows"]})

            elif event_type == "result_text":
                txt = f"\n\n**Result:** {data}"
                full_content += txt
                yield sse_event({"type": "token", "text": txt})

        # Extract a profile_id from table results if present
        profile_id = None
        if table_data:
            for row in table_data.get("rows", []):
                for cell in row:
                    m = re.search(r'\b\d{7}_\d+\b', str(cell))
                    if m:
                        profile_id = m.group()
                        break
                if profile_id:
                    break

        # Persist to PostgreSQL
        try:
            with engine.connect() as conn:
                conn.execute(
                    text("INSERT INTO chat_messages (session_id, role, content) VALUES (:sid, 'user', :c)"),
                    {"sid": session_id, "c": question},
                )
                conn.execute(
                    text("""
                        INSERT INTO chat_messages (session_id, role, content, sql, table_json, profile_id)
                        VALUES (:sid, 'assistant', :c, :s, :t, :p)
                    """),
                    {
                        "sid": session_id,
                        "c": full_content,
                        "s": sql,
                        "t": json.dumps(table_data) if table_data else None,
                        "p": profile_id,
                    },
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Save error: {e}")

        yield sse_event({"type": "done", "profile_id": profile_id, "session_id": session_id})

    except Exception as e:
        yield sse_event({"type": "error", "message": str(e)})


@app.post("/query")
async def query(req: ChatRequest):
    session_id = req.session_id
    if not session_id:
        with engine.connect() as conn:
            title = req.question[:40] + "…"
            res = conn.execute(text("INSERT INTO chat_sessions (title) VALUES (:t) RETURNING id"), {"t": title})
            session_id = str(res.fetchone()[0])
            conn.commit()
    return StreamingResponse(
        stream_query(req.question, req.history, session_id),
        media_type="text/event-stream",
    )


# ── Session history ───────────────────────────────────────────────────────────

@app.get("/sessions")
def list_sessions():
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, title, created_at FROM chat_sessions ORDER BY created_at DESC"
        )).fetchall()
        return [{"id": str(r[0]), "title": r[1], "date": r[2].isoformat()} for r in rows]

@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT role, content, sql, table_json, profile_id FROM chat_messages WHERE session_id = :sid ORDER BY created_at ASC"
        ), {"sid": session_id}).fetchall()
        return [{"role": r[0], "content": r[1], "sql": r[2], "table": r[3], "profileId": r[4]} for r in rows]

@app.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM chat_sessions WHERE id = :sid"), {"sid": session_id})
        conn.commit()
    return {"status": "ok"}


# ── Evaluation suite ──────────────────────────────────────────────────────────

@app.post("/eval")
async def run_eval(req: EvalRequest):
    import time
    from pathlib import Path
    path = Path(req.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File {req.file_path} not found.")

    with open(path) as f:
        tests = json.load(f)

    results = []
    loop = asyncio.get_event_loop()
    for test in tests:
        start = time.perf_counter()
        try:
            actual, sql, _ = await loop.run_in_executor(
                None,
                lambda t=test: hybrid_query(t["question"], return_meta=True, return_text=True),
            )
        except Exception as e:
            actual, sql = str(e), ""
        results.append({
            "question":   test["question"],
            "category":   test.get("category", "—"),
            "sql":        sql,
            "result":     str(actual)[:500],
            "latency_s":  round(time.perf_counter() - start, 2),
        })

    return {"results": results, "total": len(results)}


# ── Data explorer ─────────────────────────────────────────────────────────────

@app.get("/profiles")
def get_profiles():
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT profile_id, float_id, cycle_number, latitude, longitude, TO_CHAR(record_time, 'YYYY-MM-DD') FROM argo_profiles ORDER BY record_time ASC"
        )).fetchall()
        return {"profiles": [
            {"profile_id": r[0], "float_id": r[1], "cycle_number": r[2], "latitude": r[3], "longitude": r[4], "date": r[5]}
            for r in rows
        ]}

@app.get("/profile/{profile_id}")
def get_profile(profile_id: str):
    with engine.connect() as conn:
        meta = conn.execute(text(
            "SELECT profile_id, float_id, cycle_number, latitude, longitude, TO_CHAR(record_time, 'YYYY-MM-DD HH24:MI') FROM argo_profiles WHERE profile_id = :pid"
        ), {"pid": profile_id}).fetchone()
        if not meta:
            raise HTTPException(status_code=404)
        readings = conn.execute(text(
            "SELECT pressure, temperature, salinity FROM argo_readings WHERE profile_id = :pid ORDER BY pressure ASC"
        ), {"pid": profile_id}).fetchall()
        return {
            "meta": {
                "profile_id": meta[0], "float_id": meta[1], "cycle_number": meta[2],
                "latitude": meta[3], "longitude": meta[4], "date": meta[5],
            },
            "readings": [{"pressure": r[0], "temperature": r[1], "salinity": r[2]} for r in readings],
        }

@app.get("/stats")
def get_stats():
    with engine.connect() as conn:
        s = conn.execute(text(
            "SELECT (SELECT COUNT(*) FROM argo_profiles), MIN(r.temperature), MAX(r.temperature), ROUND(AVG(r.temperature)::numeric, 2), MIN(p.record_time)::date, MAX(p.record_time)::date FROM argo_readings r JOIN argo_profiles p ON r.profile_id = p.profile_id"
        )).fetchone()
        return {
            "total_profiles": s[0], "min_temp": s[1], "max_temp": s[2],
            "avg_temp": s[3], "first_dive": str(s[4]), "latest_dive": str(s[5]),
        }
