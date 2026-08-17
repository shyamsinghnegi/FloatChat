import argparse
import logging
import tempfile
from pathlib import Path

import requests
from sqlalchemy import create_engine, text

from config import DATABASE_URL
from floats_config import TRACKED_FLOAT_IDS
from db_ingest import ensure_schema, ingest_file
from vector_ingest import rebuild_vector_store

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

DAC_BASE_URL = "https://data-argo.ifremer.fr/dac/incois"
REQUEST_TIMEOUT = 30
USER_AGENT = "FloatChat-Sync/1.0 (+https://github.com/)"


def float_url(float_id: str) -> str:
    return f"{DAC_BASE_URL}/{float_id}/{float_id}_prof.nc"


def get_sync_state(conn, float_id: str) -> dict | None:
    row = conn.execute(
        text("SELECT last_modified, content_length FROM float_sync_state WHERE float_id = :fid"),
        {"fid": float_id},
    ).fetchone()
    if row is None:
        return None
    return {"last_modified": row[0], "content_length": row[1]}


def set_sync_state(conn, float_id: str, last_modified: str | None, content_length: int | None) -> None:
    conn.execute(text("""
        INSERT INTO float_sync_state (float_id, last_modified, content_length, last_checked_at)
        VALUES (:fid, :lm, :cl, CURRENT_TIMESTAMP)
        ON CONFLICT (float_id) DO UPDATE SET
            last_modified = EXCLUDED.last_modified,
            content_length = EXCLUDED.content_length,
            last_checked_at = CURRENT_TIMESTAMP
    """), {"fid": float_id, "lm": last_modified, "cl": content_length})


def check_float_changed(float_id: str, stored_state: dict | None) -> tuple[bool, dict]:
    url = float_url(float_id)
    try:
        resp = requests.head(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning(f"  [{float_id}] HEAD check failed, skipping: {e}")
        return False, stored_state or {}

    current = {
        "last_modified": resp.headers.get("Last-Modified"),
        "content_length": int(resp.headers["Content-Length"]) if "Content-Length" in resp.headers else None,
    }

    if stored_state is None:
        return True, current

    changed = (
        current["last_modified"] != stored_state.get("last_modified")
        or current["content_length"] != stored_state.get("content_length")
    )
    return changed, current


def download_float(float_id: str, dest_dir: Path) -> Path:
    url = float_url(float_id)
    dest_path = dest_dir / f"{float_id}_prof.nc"
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT * 4, stream=True)
    resp.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1 << 20):
            f.write(chunk)
    return dest_path


def sync(force: bool = False) -> dict:
    engine = create_engine(DATABASE_URL)
    ensure_schema(engine)

    checked = 0
    changed_floats = 0
    skipped_floats = 0
    total_ingested = 0
    total_errors = 0

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)

        for float_id in TRACKED_FLOAT_IDS:
            checked += 1
            with engine.begin() as conn:
                stored_state = get_sync_state(conn, float_id)

            changed, current_state = check_float_changed(float_id, stored_state)

            if not changed and not force:
                logger.info(f"  [{float_id}] unchanged, skipping")
                skipped_floats += 1
                continue

            logger.info(f"  [{float_id}] {'forced' if force and not changed else 'changed'} — downloading…")
            try:
                nc_path = download_float(float_id, tmp_dir)
                result = ingest_file(engine, str(nc_path))
                total_ingested += result["ingested"]
                total_errors += result["errors"]
                changed_floats += 1

                with engine.begin() as conn:
                    set_sync_state(conn, float_id, current_state.get("last_modified"), current_state.get("content_length"))
            except Exception as e:
                logger.error(f"  [{float_id}] sync failed: {e}")
                total_errors += 1

    if changed_floats > 0:
        logger.info(f"\n{changed_floats} float(s) changed — rebuilding vector store…")
        rebuild_vector_store(engine)
    else:
        logger.info("\nNo floats changed — vector store rebuild skipped.")

    summary = {
        "checked": checked,
        "changed": changed_floats,
        "skipped": skipped_floats,
        "profiles_ingested": total_ingested,
        "errors": total_errors,
    }

    logger.info(f"\n{'─'*50}")
    logger.info(f"Floats checked  : {summary['checked']}")
    logger.info(f"Floats changed  : {summary['changed']}")
    logger.info(f"Floats skipped  : {summary['skipped']}")
    logger.info(f"Profiles added  : {summary['profiles_ingested']}")
    logger.info(f"Errors          : {summary['errors']}")
    logger.info(f"{'─'*50}")

    return summary


def main():
    parser = argparse.ArgumentParser(description="Daily ARGO float data sync.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download and re-ingest all tracked floats, even if unchanged.",
    )
    args = parser.parse_args()
    sync(force=args.force)


if __name__ == "__main__":
    main()
