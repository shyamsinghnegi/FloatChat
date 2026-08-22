import re
import json
import logging
import uuid
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import sqlalchemy as sa
from sqlalchemy import text
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import DATABASE_URL, DB_POOL_SIZE, DB_MAX_OVERFLOW, DB_POOL_RECYCLE, ALLOWED_ORIGINS
from chat_with_data import hybrid_query_stream
from geo import region_for, region_slug, REGIONS, REGION_BY_SLUG

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="FloatChat API", version="2.2.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOWED_ORIGINS != ["*"],
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


def float_number_map(conn) -> dict[str, int]:
    """float_id -> stable sequential number, ordered by earliest record_time."""
    rows = conn.execute(text(
        "SELECT float_id FROM argo_profiles GROUP BY float_id ORDER BY MIN(record_time) ASC"
    )).fetchall()
    return {r[0]: i + 1 for i, r in enumerate(rows)}

class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []
    session_id: Optional[str] = None
    client_id: str

def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _save_assistant_message(session_id: str, full_content: str, sql: str | None, table_data: dict | None, profile_id: str | None) -> None:
    try:
        with engine.begin() as conn:
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
    except Exception as e:
        logger.error(f"Save error: {e}")


async def stream_query(question: str, history: list[dict], session_id: str) -> AsyncGenerator[str, None]:
    full_content = ""
    sql = None
    table_data = None
    profile_id = None

    try:
        try:
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
        finally:
            # Runs even if the client disconnects mid-stream (GeneratorExit) -
            # otherwise a dropped connection during streaming (e.g. a slow
            # cold-start timeout) silently loses the assistant's reply, with
            # no exception ever logged since GeneratorExit isn't an Exception.
            if table_data:
                for row in table_data.get("rows", []):
                    for cell in row:
                        m = re.search(r'\b\d{7}_\d+\b', str(cell))
                        if m:
                            profile_id = m.group()
                            break
                    if profile_id:
                        break
            _save_assistant_message(session_id, full_content, sql, table_data, profile_id)

        yield sse_event({"type": "done", "profile_id": profile_id, "session_id": session_id})

    except Exception as e:
        yield sse_event({"type": "error", "message": str(e)})


@app.post("/query")
@limiter.limit("50/minute")
async def query(request: Request, req: ChatRequest):
    session_id = req.session_id
    with engine.connect() as conn:
        if session_id:
            # Only resume a session that actually belongs to this client.
            owner = conn.execute(
                text("SELECT client_id FROM chat_sessions WHERE id = :sid"), {"sid": session_id}
            ).fetchone()
            if not owner or owner[0] != req.client_id:
                raise HTTPException(status_code=403, detail="Session does not belong to this client.")
        else:
            title = req.question[:40] + "…"
            res = conn.execute(
                text("INSERT INTO chat_sessions (title, client_id) VALUES (:t, :cid) RETURNING id"),
                {"t": title, "cid": req.client_id},
            )
            session_id = str(res.fetchone()[0])

        # Save the user's message now, before streaming starts - a client
        # disconnect mid-stream would otherwise raise GeneratorExit inside
        # stream_query and skip its end-of-stream save entirely, silently.
        conn.execute(
            text("INSERT INTO chat_messages (session_id, role, content) VALUES (:sid, 'user', :c)"),
            {"sid": session_id, "c": req.question},
        )
        conn.commit()

    return StreamingResponse(
        stream_query(req.question, req.history, session_id),
        media_type="text/event-stream",
    )


# ── Session history ───────────────────────────────────────────────────────────
# No login system — sessions are scoped to an anonymous client_id generated
# and stored in the browser, so different visitors don't see each other's chats.

@app.get("/sessions")
def list_sessions(client_id: str):
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, title, created_at FROM chat_sessions WHERE client_id = :cid ORDER BY created_at DESC"
        ), {"cid": client_id}).fetchall()
        return [{"id": str(r[0]), "title": r[1], "date": r[2].isoformat()} for r in rows]

@app.get("/sessions/{session_id}")
def get_session(session_id: str, client_id: str):
    with engine.connect() as conn:
        owner = conn.execute(
            text("SELECT client_id FROM chat_sessions WHERE id = :sid"), {"sid": session_id}
        ).fetchone()
        if not owner or owner[0] != client_id:
            raise HTTPException(status_code=404)
        rows = conn.execute(text(
            "SELECT role, content, sql, table_json, profile_id FROM chat_messages WHERE session_id = :sid ORDER BY created_at ASC"
        ), {"sid": session_id}).fetchall()
        return [{"role": r[0], "content": r[1], "sql": r[2], "table": r[3], "profileId": r[4]} for r in rows]

@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, client_id: str):
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM chat_sessions WHERE id = :sid AND client_id = :cid"),
            {"sid": session_id, "cid": client_id},
        )
        conn.commit()
    return {"status": "ok"}


# ── Data explorer ─────────────────────────────────────────────────────────────

@app.get("/profiles")
def get_profiles():
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT profile_id, float_id, cycle_number, latitude, longitude, TO_CHAR(record_time, 'YYYY-MM-DD') "
            "FROM argo_profiles "
            "WHERE latitude::text != 'NaN' AND longitude::text != 'NaN' "
            "ORDER BY record_time ASC"
        )).fetchall()
        return {"profiles": [
            {"profile_id": r[0], "float_id": r[1], "cycle_number": r[2], "latitude": r[3], "longitude": r[4], "date": r[5]}
            for r in rows
        ]}

@app.get("/floats")
def get_floats():
    with engine.connect() as conn:
        numbers = float_number_map(conn)
        rows = conn.execute(text("""
            SELECT DISTINCT ON (float_id)
                float_id, profile_id, latitude, longitude, TO_CHAR(record_time, 'YYYY-MM-DD') AS date
            FROM argo_profiles
            WHERE latitude::text != 'NaN' AND longitude::text != 'NaN'
            ORDER BY float_id, record_time DESC
        """)).fetchall()
        return {"floats": [
            {
                "float_id": r[0], "latest_profile_id": r[1], "latitude": r[2], "longitude": r[3], "latest_date": r[4],
                "number": numbers.get(r[0]), "region": region_for(r[2], r[3]),
            }
            for r in rows
        ]}

@app.get("/regions")
def get_regions():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT DISTINCT ON (float_id) float_id, latitude, longitude
            FROM argo_profiles
            WHERE latitude::text != 'NaN' AND longitude::text != 'NaN'
            ORDER BY float_id, record_time DESC
        """)).fetchall()

    buckets: dict[str, list[tuple[float, float]]] = {r: [] for r in REGIONS}
    for _, lat, lon in rows:
        buckets[region_for(lat, lon)].append((lat, lon))

    regions = []
    for name, points in buckets.items():
        if not points:
            continue
        avg_lat = sum(p[0] for p in points) / len(points)
        avg_lon = sum(p[1] for p in points) / len(points)
        regions.append({
            "slug": region_slug(name), "name": name,
            "float_count": len(points), "latitude": avg_lat, "longitude": avg_lon,
        })
    return {"regions": regions}

@app.get("/float/{float_id}")
def get_float(float_id: str):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                p.profile_id, p.cycle_number, p.latitude, p.longitude,
                TO_CHAR(p.record_time, 'YYYY-MM-DD') AS date,
                AVG(CASE WHEN r.pressure < 10 THEN r.temperature END) AS surface_temp,
                AVG(r.temperature) AS avg_temp,
                AVG(r.salinity) AS avg_salinity,
                MAX(r.pressure) AS max_depth
            FROM argo_profiles p
            JOIN argo_readings r ON p.profile_id = r.profile_id
            WHERE p.float_id = :fid
            GROUP BY p.profile_id, p.cycle_number, p.latitude, p.longitude, p.record_time
            ORDER BY p.record_time ASC
        """), {"fid": float_id}).fetchall()
        if not rows:
            raise HTTPException(status_code=404)
        numbers = float_number_map(conn)
        latest = rows[-1]
        return {
            "float_id": float_id,
            "number": numbers.get(float_id),
            "region": region_for(latest[2], latest[3]),
            "dives": [
                {
                    "profile_id": r[0], "cycle_number": r[1], "latitude": r[2], "longitude": r[3],
                    "date": r[4], "surface_temp": r[5], "avg_temp": r[6], "avg_salinity": r[7], "max_depth": r[8],
                }
                for r in rows
            ],
        }

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
