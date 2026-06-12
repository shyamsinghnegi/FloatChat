import argparse
from sqlalchemy import create_engine, text

from config import DATABASE_URL

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true", help="Print SQL without executing.")
args = parser.parse_args()

engine = create_engine(DATABASE_URL)


def run(conn, sql: str, description: str) -> None:
    """Execute a migration step, or print it in dry-run mode."""
    print(f"  {'[DRY RUN] ' if args.dry_run else ''}→ {description}")
    if not args.dry_run:
        try:
            conn.execute(text(sql))
            print(f"    ✅ Done")
        except Exception as e:
            print(f"    ⚠️  Skipped: {e}")


def column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.fetchone() is not None


def index_exists(conn, index_name: str) -> bool:
    result = conn.execute(text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :n"
    ), {"n": index_name})
    return result.fetchone() is not None


print("\n🔧 FloatChat Master Migration Tool")
print("=" * 50)

with engine.begin() as conn:

    # ── Migration 1: Profile Schema ──────────────────────────────────────────
    print("\n[1/8] float_id and cycle_number columns")
    if not column_exists(conn, "argo_profiles", "float_id"):
        run(conn, "ALTER TABLE argo_profiles ADD COLUMN float_id VARCHAR(50)", "Add float_id")
    if not column_exists(conn, "argo_profiles", "cycle_number"):
        run(conn, "ALTER TABLE argo_profiles ADD COLUMN cycle_number INTEGER", "Add cycle_number")

    # ── Migration 2-5: Performance Indexes ───────────────────────────────────
    print("\n[2-5/8] Performance Indexes")
    if not index_exists(conn, "idx_readings_profile_id"):
        run(conn, "CREATE INDEX idx_readings_profile_id ON argo_readings (profile_id)", "Index: profile_id")
    if not index_exists(conn, "idx_readings_profile_pressure"):
        run(conn, "CREATE INDEX idx_readings_profile_pressure ON argo_readings (profile_id, pressure)", "Index: profile+pressure")
    if not index_exists(conn, "idx_profiles_record_time"):
        run(conn, "CREATE INDEX idx_profiles_record_time ON argo_profiles (record_time)", "Index: record_time")

    # ── Migration 6: Quality Checks ──────────────────────────────────────────
    print("\n[6/8] Data quality CHECK constraints")
    run(conn, """
        DO $$ BEGIN
            ALTER TABLE argo_readings ADD CONSTRAINT chk_temperature_range CHECK (temperature BETWEEN -5 AND 40);
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """, "CHECK: temperature")

    # ── Migration 7: Chat Sessions ───────────────────────────────────────────
    print("\n[7/8] Chat Sessions Table")
    run(conn, "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"", "Enable UUID Extension")
    run(conn, """
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """, "Create chat_sessions table")

    # ── Migration 8: Chat Messages ───────────────────────────────────────────
    print("\n[8/8] Chat Messages Table")
    run(conn, """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            sql TEXT,
            table_json JSONB,
            profile_id TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """, "Create chat_messages table")

print("\n All migrations complete.")