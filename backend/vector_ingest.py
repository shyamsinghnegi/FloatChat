import pandas as pd
import chromadb
from chromadb.utils import embedding_functions
from sqlalchemy import create_engine

from config import DATABASE_URL, CHROMA_PATH, CHROMA_COLLECTION, EMBEDDING_MODEL


def get_season(month: int) -> str:
    """
    Returns the hemisphere-neutral meteorological season name for a given month.
    Used to make embeddings searchable by season without exact date matching.
    """
    if month in (12, 1, 2):
        return "winter (Dec-Feb)"
    elif month in (3, 4, 5):
        return "spring (Mar-May)"
    elif month in (6, 7, 8):
        return "summer (Jun-Aug)"
    else:
        return "autumn (Sep-Nov)"


def build_profile_summary(profile: pd.Series, stats: pd.Series) -> str:
    """
    Build a rich natural language summary for a single profile.

    This is what gets embedded and stored in ChromaDB. The richer this
    text is, the better semantic search works for science-based queries.

    Old summary (location + date only):
        "ARGO Profile 2903954_5 recorded at Latitude 12.34, Longitude 67.89
         on date 2023-03-15. This dive occurred in the Indian Ocean region."

    New summary (location + date + sensor stats + season):
        "ARGO float 2903954 dive cycle 5, recorded on 2023-03-15 (spring,
         Mar-May) at latitude 12.34°N, longitude 67.89°E in the Indian Ocean.
         Average surface temperature: 28.4°C. Average temperature over full
         water column: 22.1°C. Average salinity: 35.2 PSU. Depth range:
         2 to 980 decibars."
    """
    season = get_season(profile['record_time'].month)
    lat_dir = "N" if profile['latitude'] >= 0 else "S"
    lon_dir = "E" if profile['longitude'] >= 0 else "W"

    summary = (
        f"ARGO float {profile.get('float_id', 'unknown')} "
        f"dive cycle {profile.get('cycle_number', '?')}, "
        f"recorded on {profile['record_time'].strftime('%Y-%m-%d')} "
        f"({season}) at "
        f"latitude {abs(profile['latitude']):.2f}°{lat_dir}, "
        f"longitude {abs(profile['longitude']):.2f}°{lon_dir} "
        f"in the Indian Ocean. "
    )

    # Add sensor stats if available from argo_readings join
    if stats is not None and not stats.empty:
        avg_surface_temp = stats.get('avg_surface_temp')
        avg_temp         = stats.get('avg_temp')
        avg_sal          = stats.get('avg_sal')
        min_pres         = stats.get('min_pres')
        max_pres         = stats.get('max_pres')

        if avg_surface_temp and not pd.isna(avg_surface_temp):
            summary += f"Average surface temperature (0–10 dbar): {avg_surface_temp:.1f}°C. "
        if avg_temp and not pd.isna(avg_temp):
            summary += f"Average water column temperature: {avg_temp:.1f}°C. "
        if avg_sal and not pd.isna(avg_sal):
            summary += f"Average salinity: {avg_sal:.2f} PSU. "
        if min_pres is not None and max_pres is not None:
            summary += f"Depth range: {min_pres:.0f} to {max_pres:.0f} decibars."

    return summary


def main():
    engine = create_engine(DATABASE_URL)

    # ── Load profiles ─────────────────────────────────────────────────────────
    print("Loading profiles from PostgreSQL...")
    df_profiles = pd.read_sql(
        "SELECT profile_id, float_id, cycle_number, latitude, longitude, record_time "
        "FROM argo_profiles ORDER BY record_time",
        engine,
        parse_dates=['record_time']
    )
    print(f"   Found {len(df_profiles)} profiles.")

    # ── Load sensor statistics per profile ────────────────────────────────────
    # We pull these in bulk (one query, all profiles) rather than one query
    # per profile inside the loop — much faster.
    print("Computing sensor statistics per profile...")
    df_stats = pd.read_sql("""
        SELECT
            profile_id,
            AVG(CASE WHEN pressure < 10 THEN temperature END) AS avg_surface_temp,
            AVG(temperature)  AS avg_temp,
            AVG(salinity)     AS avg_sal,
            MIN(pressure)     AS min_pres,
            MAX(pressure)     AS max_pres
        FROM argo_readings
        GROUP BY profile_id
    """, engine)
    stats_by_id = df_stats.set_index('profile_id')

    # ── Setup ChromaDB ────────────────────────────────────────────────────────
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    client = chromadb.PersistentClient(path=CHROMA_PATH)

    # Delete and recreate the collection so stale embeddings from a
    # previous ingestion don't linger. This is safe because vector_ingest.py
    # is always run after db_ingest.py — the data is already in PostgreSQL.
    try:
        client.delete_collection(name=CHROMA_COLLECTION)
        print(f"   Cleared existing '{CHROMA_COLLECTION}' collection.")
    except Exception:
        pass  # Collection didn't exist yet — that's fine

    collection = client.create_collection(
        name=CHROMA_COLLECTION,
        embedding_function=emb_fn
    )

    # ── Generate and store embeddings ─────────────────────────────────────────
    print(f"\nVectorizing {len(df_profiles)} profiles...")

    for _, row in df_profiles.iterrows():
        stats = stats_by_id.loc[row['profile_id']] if row['profile_id'] in stats_by_id.index else None

        summary = build_profile_summary(row, stats)

        collection.add(
            documents=[summary],
            metadatas={
                "profile_id":   row['profile_id'],
                "float_id":     str(row.get('float_id', '')),
                "cycle_number": str(row.get('cycle_number', '')),
                "date":         str(row['record_time']),
                "latitude":     str(row['latitude']),
                "longitude":    str(row['longitude']),
            },
            ids=[row['profile_id']]
        )

    print(f"\n✅ Success: {len(df_profiles)} profiles indexed in ChromaDB.")
    print(f"   Vector store saved to: {CHROMA_PATH}")
    print("\nYou can now start the app: streamlit run app.py")


if __name__ == "__main__":
    main()