

import sys
import argparse
import numpy as np
import xarray as xr
import pandas as pd
from sqlalchemy import create_engine, text

# Import everything from the single config source.
# If .env is missing or a key is absent, this raises a clear error here
# rather than a confusing crash inside SQLAlchemy later.
from config import DATABASE_URL, ARGO_FILL_VALUE

# ── Argument Parsing ──────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Ingest ARGO NetCDF data into PostgreSQL.")
parser.add_argument(
    "--reset",
    action="store_true",
    help="Drop and recreate tables before ingesting. WARNING: destroys all existing data."
)
parser.add_argument(
    "--file",
    default="sample_argo.nc",
    help="Path to the ARGO NetCDF file (default: sample_argo.nc)"
)
args = parser.parse_args()

# ── Database Connection ───────────────────────────────────────────────────────
engine = create_engine(DATABASE_URL)

# ── Schema SQL ────────────────────────────────────────────────────────────────
CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS argo_profiles (
    profile_id  VARCHAR(100) PRIMARY KEY,
    float_id    VARCHAR(50),
    cycle_number INTEGER,
    latitude    FLOAT,
    longitude   FLOAT,
    record_time TIMESTAMP
);

CREATE TABLE IF NOT EXISTS argo_readings (
    id          SERIAL PRIMARY KEY,
    pressure    FLOAT,
    temperature FLOAT,
    salinity    FLOAT,
    profile_id  VARCHAR(100) REFERENCES argo_profiles(profile_id)
);
"""

# We create this index separately because IF NOT EXISTS on CREATE INDEX
# is only supported in PostgreSQL 9.5+. Keeping it separate makes it
# easy to see and avoids re-running inside IF NOT EXISTS table blocks.
CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_readings_profile_id
    ON argo_readings (profile_id);
"""

DROP_TABLES_SQL = """
DROP TABLE IF EXISTS argo_readings;
DROP TABLE IF EXISTS argo_profiles;
"""

# ── Table Setup ───────────────────────────────────────────────────────────────
with engine.begin() as conn:
    if args.reset:
        # Only destroy data when explicitly asked.
        # This prevents the "accidentally ran the script" disaster.
        print("--reset flag detected. Dropping all existing tables...")
        conn.execute(text(DROP_TABLES_SQL))
        print("Tables dropped.")

    conn.execute(text(CREATE_TABLES_SQL))
    conn.execute(text(CREATE_INDEX_SQL))

print("Schema ready.")

# ── Load NetCDF ───────────────────────────────────────────────────────────────
print(f"\nOpening {args.file}...")
try:
    ds = xr.open_dataset(args.file)
except FileNotFoundError:
    print(f"File not found: {args.file}")
    print("Run argo_extract.py first to download the data.")
    sys.exit(1)

num_profiles = ds.sizes['N_PROF']
print(f"Found {num_profiles} profiles in the file.")

# ── Ingestion Loop ────────────────────────────────────────────────────────────
print(f"\nStarting ingestion...")
skipped = 0
ingested = 0
errors = 0

for i in range(num_profiles):
    try:
        # ── Extract Float ID ─────────────────────────────────────────────────
        raw_id = ds['PLATFORM_NUMBER'].values[i]
        float_id = raw_id.decode('utf-8').strip() if isinstance(raw_id, bytes) else str(raw_id).strip()

        # ── Fix: Use actual CYCLE_NUMBER, not loop index i ───────────────────
        # Previously: p_id = f"{float_id}_{i}"
        # Problem: i is just the array position (0, 1, 2...). If cycle 5
       https://incois.gov.in/OON/index.jsp # happens to be at index 3 in the file, it was stored as float_2903954_3.
        # CYCLE_NUMBER is the real scientific dive number from the float itself.
        cycle_num = int(ds['CYCLE_NUMBER'].values[i])
        p_id = f"{float_id}_{cycle_num}"

        lat  = float(ds['LATITUDE'].values[i])
        lon  = float(ds['LONGITUDE'].values[i])
        time = pd.to_datetime(ds['JULD'].values[i])

        # ── Step A: Insert Profile Metadata ─────────────────────────────────
        # ON CONFLICT DO NOTHING means re-running without --reset is safe.
        # It simply skips profiles already in the DB.
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO argo_profiles
                    (profile_id, float_id, cycle_number, latitude, longitude, record_time)
                VALUES
                    (:id, :float_id, :cycle, :lat, :lon, :time)
                ON CONFLICT (profile_id) DO NOTHING;
            """), {
                "id":       p_id,
                "float_id": float_id,
                "cycle":    cycle_num,
                "lat":      lat,
                "lon":      lon,
                "time":     time
            })

        # ── Step B: Build Readings DataFrame ────────────────────────────────
        df = pd.DataFrame({
            'pressure':    ds['PRES'].values[i],
            'temperature': ds['TEMP'].values[i],
            'salinity':    ds['PSAL'].values[i],
            'profile_id':  p_id
        })

   
        df = df[
            (df['pressure']    < ARGO_FILL_VALUE) &
            (df['temperature'] < ARGO_FILL_VALUE) &
            (df['salinity']    < ARGO_FILL_VALUE)
        ].dropna()   # dropna still runs to catch any genuine NaN values

        if df.empty:
            skipped += 1
            continue

        # ── Step C: Insert Readings ──────────────────────────────────────────
        df.to_sql('argo_readings', engine, if_exists='append', index=False)
        ingested += 1

    except Exception as e:
        # Specific exception handling — we log what went wrong and keep going.
        # Previously: bare except: with float_id = "2903954" fallback
        # that silently hid all errors.
        print(f"   ⚠️  Error on profile index {i}: {e}")
        errors += 1
        continue

    if (i + 1) % 5 == 0:
        print(f"   Progress: {i + 1}/{num_profiles} profiles processed...")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'─'*50}")
print(f"Ingested : {ingested} profiles")
print(f"Skipped  : {skipped} profiles (empty after fill-value filter)")
print(f"Errors   : {errors} profiles")
print(f"{'─'*50}")
print("\nAll done. Run vector_ingest.py next to rebuild the vector store.")