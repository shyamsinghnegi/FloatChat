

import os
from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    """
    Get an environment variable, raise a clear error if it's missing.
    This gives you 'DB_PASSWORD is not set' instead of a cryptic
    NoneType error three layers deep in SQLAlchemy.
    """
    value = os.environ.get(key)
    if not value:
        raise EnvironmentError(
            f"\n[FloatChat Config Error] Required environment variable '{key}' is not set.\n"
            f"Make sure your .env file exists and contains: {key}=your_value\n"
            f"See .env.example for the full template.\n"
        )
    return value


# ── Database ──────────────────────────────────────────────────────────────────
DB_USER     = _require("DB_USER")
DB_PASSWORD = _require("DB_PASSWORD")
DB_HOST     = os.environ.get("DB_HOST", "localhost")
DB_PORT     = os.environ.get("DB_PORT", "5432")
DB_NAME     = _require("DB_NAME")

# The full PostgreSQL connection URI, assembled once here.
# All files use this — never build it themselves.
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

DB_POOL_SIZE     = int(os.environ.get("DB_POOL_SIZE",    "2"))
DB_MAX_OVERFLOW  = int(os.environ.get("DB_MAX_OVERFLOW", "3"))
DB_POOL_RECYCLE  = int(os.environ.get("DB_POOL_RECYCLE", "1800"))  # 30 minutes


# ── Vector Store ──────────────────────────────────────────────────────────────
CHROMA_PATH       = os.environ.get("CHROMA_PATH", "./chroma_db")
CHROMA_COLLECTION = "argo_summaries"
EMBEDDING_MODEL   = "all-MiniLM-L6-v2"


# ── LLM ───────────────────────────────────────────────────────────────────────
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")


# ── ARGO Data ─────────────────────────────────────────────────────────────────
# The fill value used in ARGO NetCDF files for missing/bad measurements.
# Any reading at or above this threshold must be filtered out before
# storing to DB or plotting — otherwise you get 99999°C on your charts.
ARGO_FILL_VALUE = 99990.0