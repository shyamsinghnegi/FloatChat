# FloatChat — Complete Project Documentation
### AI-Powered Conversational Interface for ARGO Ocean Data Discovery and Visualization
**SIH Problem Statement 25040 | Ministry of Earth Sciences (MoES) / INCOIS**

---

## 1. Problem Statement Summary

The Argo program deploys autonomous profiling floats across the world's oceans, generating massive NetCDF datasets containing temperature, salinity, pressure, and bio-geochemical measurements. Accessing and interpreting this data requires domain expertise and technical skills, making it inaccessible to non-technical stakeholders.

**FloatChat** solves this by providing a natural language interface where users can ask questions like:
- "Show me salinity profiles near the equator in March 2023"
- "Which profile has the highest average salinity?"
- "Compare temperature readings below 1000 decibars for profile 2903954_3"

The system translates these questions into SQL queries, executes them against a structured database, and returns results alongside interactive visualizations.

---

## 2. High-Level Architecture

```
ARGO NetCDF File (.nc)
        │
        ▼
[argo_extract.py] ──── Downloads from ftp.ifremer.fr/incois
        │
        ▼
[db_ingest.py] ──────── Parses via xarray → PostgreSQL
        │                  Tables: argo_profiles, argo_readings
        ▼
[vector_ingest.py] ──── Generates embeddings → ChromaDB
                          Model: all-MiniLM-L6-v2 (SentenceTransformers)
        │
        ▼
┌───────────────────────────────────────────────────┐
│  Backend Layer                                    │
│                                                   │
│  [main.py] FastAPI (Port 8000)                    │
│    - POST /query        → SSE streaming response  │
│    - GET  /sessions     → Chat session list       │
│    - GET  /sessions/:id → Session messages        │
│    - DELETE /sessions/:id                         │
│    - GET  /profiles     → All profile metadata    │
│    - GET  /profile/:id  → Single profile + data   │
│    - GET  /stats        → Summary statistics      │
│    - POST /eval         → Run test suite          │
│                                                   │
│  [app.py] Streamlit (Port 8501) — legacy UI       │
│                                                   │
│  [chat_with_data.py] — Core RAG engine            │
│    hybrid_query() function                        │
└───────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│  Frontend Layer (Next.js 16 / React 19)           │
│                                                   │
│  Pages:                                           │
│    /          → Chat interface (main)             │
│    /explore   → Map + stats dashboard             │
│    /eval      → RAG evaluation runner             │
│    /profile/:id → Depth profile visualization     │
└───────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Web framework | FastAPI 0.x + Uvicorn |
| Legacy UI | Streamlit |
| Database | PostgreSQL |
| ORM/query | SQLAlchemy (raw `text()` queries, no ORM models) |
| Vector store | ChromaDB (persistent, local) |
| Embeddings | SentenceTransformers `all-MiniLM-L6-v2` |
| LLM | Ollama — `llama3.2` (local, default configurable) |
| LLM bridge | LangChain (`langchain-community`, `langchain-ollama`) |
| Data parsing | xarray, netCDF4, pandas, numpy |
| Config | python-dotenv |
| Visualization (legacy) | Plotly, Folium, streamlit-folium |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16.2.3 |
| Runtime | React 19.2.4 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| HTTP | Native `fetch` API + SSE streaming |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| LLM runtime | Ollama (must run locally) |
| Database | PostgreSQL (local or remote) |
| Vector DB | ChromaDB (file-based, stored at `./chroma_db`) |

---

## 4. Data Model

### PostgreSQL Tables

```sql
-- Profile metadata (one row per dive)
CREATE TABLE argo_profiles (
    profile_id   VARCHAR(100) PRIMARY KEY,  -- Format: '{float_id}_{cycle_number}' e.g. '2903954_10'
    float_id     VARCHAR(50),               -- WMO float identifier e.g. '2903954'
    cycle_number INTEGER,                   -- Dive sequence number (from NetCDF CYCLE_NUMBER)
    latitude     FLOAT,
    longitude    FLOAT,
    record_time  TIMESTAMP
);

-- Sensor readings (many rows per profile, one per depth level)
CREATE TABLE argo_readings (
    id           SERIAL PRIMARY KEY,
    pressure     FLOAT,        -- Depth in decibars (dbar); "surface" = pressure < 10
    temperature  FLOAT,        -- Degrees Celsius; fill values (>= 99990.0) filtered out
    salinity     FLOAT,        -- PSU (Practical Salinity Units)
    profile_id   VARCHAR(100) REFERENCES argo_profiles(profile_id)
);

-- Chat persistence
CREATE TABLE chat_sessions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title      TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    id         SERIAL PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,    -- 'user' or 'assistant'
    content    TEXT NOT NULL,
    sql        TEXT,             -- Generated SQL (if any)
    table_json JSONB,            -- Tabular results serialized as JSON
    profile_id TEXT,             -- Detected profile ID for auto-visualization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Performance Indexes
```sql
CREATE INDEX idx_readings_profile_id ON argo_readings (profile_id);
CREATE INDEX idx_readings_profile_pressure ON argo_readings (profile_id, pressure);
CREATE INDEX idx_profiles_record_time ON argo_profiles (record_time);
```

### ChromaDB Collection
- **Name**: `argo_summaries`
- **Embedding model**: `all-MiniLM-L6-v2`
- **Document format**: Rich natural language summaries per profile containing location, season, sensor statistics (avg surface temp, avg column temp, avg salinity, depth range)
- **Metadata fields**: `profile_id`, `float_id`, `cycle_number`, `date`, `latitude`, `longitude`

---

## 5. Data Pipeline

### Step 1: Data Extraction (`argo_extract.py`)
- Downloads ARGO NetCDF file from `https://data-argo.ifremer.fr/dac/incois/2903954/2903954_prof.nc`
- Uses `xarray` to open the NetCDF file
- Extracts: `LATITUDE`, `LONGITUDE`, `JULD` (timestamp), `PRES`, `TEMP`, `PSAL`
- Saves locally as `sample_argo.nc`

### Step 2: Database Ingestion (`db_ingest.py`)
- Opens NetCDF with xarray
- Iterates over all `N_PROF` profiles in the file
- Uses `CYCLE_NUMBER` from the NetCDF (not array index) to build `profile_id`
- Filters out fill values: readings where pressure, temperature, OR salinity >= 99990.0 are discarded
- Inserts profile metadata into `argo_profiles` with `ON CONFLICT DO NOTHING` (idempotent re-runs)
- Bulk-inserts sensor readings into `argo_readings` via pandas `to_sql`
- **Run**: `python db_ingest.py [--file path.nc] [--reset]`

### Step 3: Vector Indexing (`vector_ingest.py`)
- Reads all profiles from PostgreSQL
- Computes per-profile statistics in a single SQL query (bulk, not per-profile loop)
- Builds rich natural language summaries including season name (meteorological)
- Clears and recreates the ChromaDB collection to avoid stale embeddings
- Embeds each summary with `all-MiniLM-L6-v2` and stores in ChromaDB
- **Run**: `python vector_ingest.py`

### Step 4: Database Migration (`migrate_db.py`)
- Idempotent migration script that adds columns, indexes, and new tables without data loss
- 8 migrations: adds `float_id`/`cycle_number` columns, performance indexes, data quality CHECK constraints, `chat_sessions` table, `chat_messages` table
- **Run**: `python migrate_db.py [--dry-run]`

---

## 6. Core RAG Engine (`chat_with_data.py`)

### `hybrid_query()` Function
This is the heart of the system. It takes a natural language question and returns results from the database.

**Flow:**
1. **Global query detection**: checks if the question contains keywords like "total", "all profiles", "highest", "minimum", etc. — if yes, skips vector search (no profile-specific context needed)
2. **Vector search** (if not global): queries ChromaDB for up to 5–10 semantically similar profiles; returns their `profile_id`s as hints for the LLM
3. **Conversation history**: includes the last 4 turns of chat history in the prompt for follow-up question support
4. **LLM prompt construction**: sends a structured prompt to Ollama containing:
   - Full database schema with data type notes
   - Few-shot SQL examples
   - Strict rules (e.g., never use BETWEEN on `profile_id`, use `cycle_number` for ranges)
   - Conversation history
   - Retrieved profile ID hints
   - The user's question
5. **Response parsing**: extracts SQL from ````sql ... ``` ` markdown blocks (with SELECT fallback)
6. **Self-correction loop**: if SQL execution fails, sends the error back to the LLM for one retry
7. **Null/Decimal handling**: cleans `Decimal('35.2')` strings from PostgreSQL output and handles empty results gracefully

**Return modes:**
- `return_meta=True`: returns `(result, sql)`
- `return_meta=True, return_text=True`: returns `(result, sql, explanation)`
- Default: returns result only

### Key Design Decisions
- **Lazy initialization**: ChromaDB client, SQLDatabase, and Ollama LLM are all initialized on first use, not at module import time
- **Schema-aware few-shot examples**: examples demonstrate the `profile_id` vs `cycle_number` distinction which is a common LLM failure mode
- **SQL injection prevention**: all database queries use SQLAlchemy `text()` with bound parameters

---

## 7. Backend API (`main.py`)

FastAPI application running on port 8000.

### Streaming Chat Endpoint
```
POST /query
Body: { question: string, history: [{role, content}], session_id?: string }
Response: text/event-stream (SSE)
```

**SSE Event types:**
| Event | Payload | Description |
|-------|---------|-------------|
| `token` | `{text: string}` | Streamed LLM text tokens |
| `sql` | `{sql: string}` | Generated SQL query |
| `table` | `{columns: string[], rows: any[][]}` | Tabular query result |
| `done` | `{profile_id?: string, session_id: string}` | Stream complete |
| `error` | `{message: string}` | Error occurred |

**Session handling**: If no `session_id` is provided, a new session is created in `chat_sessions` and returned in the `done` event.

### Data Explorer Endpoints
```
GET /profiles           → All profile metadata (sorted by date)
GET /profile/:id        → Single profile meta + all readings
GET /stats              → Aggregate stats (count, min/max/avg temp, date range)
```

### Session Management
```
GET    /sessions        → List all chat sessions (sorted newest first)
GET    /sessions/:id    → All messages for a session
DELETE /sessions/:id    → Delete session and cascade-delete its messages
```

### Evaluation
```
POST /eval              → Run test_cases.json against the live RAG pipeline
Body: { file_path: string }
Returns: { results: [...], total: number }
```

---

## 8. Legacy Streamlit Frontend (`app.py`)

A self-contained Streamlit application (alternative to the Next.js frontend).

**Layout:**
- Sidebar: mission stats, quick-query suggestion buttons
- Header: 4 metric cards (dive count, min/max/avg temperature)
- Left column: Folium interactive map showing float trajectory with polyline + clickable markers
- Right column: Chat interface with scrollable history

**Features:**
- Auto-detects profile IDs in questions/results using regex `\b\d{7}_\d+\b` and auto-renders depth profiles
- Shows generated SQL in a collapsible expander for transparency
- Side-by-side temperature + salinity vertical profile charts (Plotly)
- Session state management via `st.session_state`
- Cached DB queries with 5-minute TTL (`@st.cache_data(ttl=300)`)

---

## 9. Next.js Frontend

### Directory Structure
```
frontend/
  app/
    page.tsx                    ← / (chat page)
    explore/page.tsx            ← /explore (map + stats)
    eval/page.tsx               ← /eval (evaluation runner)
    layout.tsx                  ← Root layout with Navbar + Sidebar
    globals.css
    components/
      chat/
        ChatWindow.tsx          ← Main chat UI with SSE streaming
        ChatInput.tsx
        Message.tsx
        SqlBadge.tsx
      layout/
        Navbar.tsx
        Sidebar.tsx             ← Session history panel
      viz/
        TrajectoryMap.tsx       ← Recharts ScatterChart for float path
        DepthProfile.tsx        ← Temperature/salinity depth charts
        StatCard.tsx            ← Metric display card
    context/
      ChatContext.tsx           ← Session state management (React Context)
    lib/
      api.ts                    ← API fetch functions
      types.ts                  ← TypeScript interfaces
```

### Key Frontend Behaviors

**Chat streaming**: `ChatWindow.tsx` consumes the SSE stream from `POST /query`. It builds the assistant message incrementally — tokens appended in real-time, SQL revealed when the `sql` event fires, table shown when `table` event fires.

**Session management**: `ChatContext.tsx` tracks the current session ID. On first message, the session ID is received from the `done` SSE event and stored. Loading a past session replays its messages from the backend.

**Trajectory visualization**: `TrajectoryMap.tsx` uses Recharts `ScatterChart` with `line` prop to connect points in order — simulating a map trajectory using lat/lon as axes. Clicking a point navigates to `/profile/:id`.

**Proxy pattern**: Profile-related API calls go through Next.js API routes (`/api/profiles`, `/api/profile/:id`). Stats and eval go directly to `http://localhost:8000`.

### TypeScript Types
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  table?: { columns: string[]; rows: any[][] };
  profileId?: string;
}

interface StatData {
  total_profiles: number;
  min_temp: number; max_temp: number; avg_temp: number;
  first_dive: string; latest_dive: string;
}

interface ProfileMeta {
  profile_id: string; float_id: string; cycle_number: number;
  latitude: number; longitude: number; date: string;
}
```

---

## 10. Evaluation System (`evaluator.py` + `test_cases.json`)

An automated testing framework for the RAG pipeline.

### Grading Modes
| Mode | How it works |
|------|-------------|
| `numeric` | Extracts first number from result, checks `abs(actual - expected) <= tolerance` |
| `text` | Case-insensitive substring check in the response |
| `sql_check` | Validates that generated SQL contains required keywords (e.g. `["GROUP BY", "AVG"]`) |

### Test Categories
- **aggregate**: Full-table queries (COUNT, AVG, MIN, MAX across all data)
- **specific**: Queries targeting a single named profile
- **ranking**: ORDER BY + LIMIT patterns (e.g., highest salinity profile)
- **spatial**: Latitude/longitude filtering
- **temporal**: Date-based filtering on `record_time`
- **depth**: Pressure-level filtering
- **text**: Conversational questions requiring no SQL

### Metrics Reported
- Overall accuracy (%)
- Accuracy by category
- Latency: average, min, max, slowest query
- Retrieval accuracy: whether ChromaDB returned the expected profile_id as top result

### Usage
```bash
python evaluator.py                          # runs test_cases.json
python evaluator.py --file my_tests.json    # custom test file
python evaluator.py --verbose               # print SQL per test
python evaluator.py --output results.json  # save output
```

Results also accessible via `POST /eval` on the FastAPI backend (used by the /eval frontend page).

---

## 11. Configuration (`config.py` + `.env`)

All configuration is centralized in `config.py`. It reads from environment variables and raises a clear error if required keys are missing.

### Required Environment Variables (`.env`)
```env
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=floatchat

# Optional (with defaults)
DB_HOST=localhost
DB_PORT=5432
DB_POOL_SIZE=2
DB_MAX_OVERFLOW=3
DB_POOL_RECYCLE=1800
CHROMA_PATH=./chroma_db
OLLAMA_MODEL=llama3.2
```

### Key Config Values
```python
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
CHROMA_COLLECTION = "argo_summaries"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
ARGO_FILL_VALUE = 99990.0  # NetCDF fill value threshold; readings at or above this are discarded
```

---

## 12. Setup and Running

### Prerequisites
- Python 3.12+
- Node.js 20+ / npm
- PostgreSQL running locally
- Ollama installed and running (`ollama serve`)
- Ollama model pulled: `ollama pull llama3.2`

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate   # or venv/bin/activate.fish on fish shell
pip install -r requirements.txt

# Configure environment
cp .env.example .env       # fill in DB_USER, DB_PASSWORD, DB_NAME

# Run the data pipeline (one-time)
python argo_extract.py     # Download sample_argo.nc
python db_ingest.py        # Ingest to PostgreSQL
python migrate_db.py       # Apply all migrations
python vector_ingest.py    # Build ChromaDB embeddings

# Start API server
uvicorn main:app --reload --port 8000

# OR start legacy Streamlit UI
streamlit run app.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev                # Development on http://localhost:3000
```

---

## 13. Demo Dataset

- **Float**: WMO 2903954 (Indian Argo Project / INCOIS)
- **Region**: Indian Ocean
- **Data source**: `https://data-argo.ifremer.fr/dac/incois/2903954/2903954_prof.nc`
- **Profiles**: ~42 dive cycles
- **Variables**: Pressure (dbar), Temperature (°C), Salinity (PSU)
- **Profile ID format**: `2903954_{cycle_number}` e.g. `2903954_5`, `2903954_10`

---

## 14. Key Design Decisions and Trade-offs

| Decision | Rationale |
|----------|-----------|
| Local LLM via Ollama | No API costs, data stays on-premises, required for sensitive oceanographic data |
| ChromaDB + PostgreSQL hybrid | Vector search handles semantic lookup; SQL handles precise aggregation — neither alone is sufficient |
| `cycle_number` not array index for profile ID | NetCDF profiles are not always stored in order; array position is meaningless |
| `ARGO_FILL_VALUE = 99990.0` threshold | ARGO standard fill value is 99999; threshold at 99990 catches all variants |
| SSE streaming (not WebSocket) | Simpler for one-directional token streaming; no persistent connection overhead |
| `ON CONFLICT DO NOTHING` in ingestion | Makes re-running `db_ingest.py` safe without `--reset` |
| Self-correction SQL loop | Single retry on execution failure; LLM gets the actual DB error message to self-fix |
| Few-shot examples in prompt | The `profile_id` vs `cycle_number` distinction is non-obvious; examples prevent the most common SQL error |

---

## 15. Potential Extensions (Per Problem Statement)

- **BGC float data**: Add new columns (chlorophyll, oxygen, nitrate) to `argo_readings`; update `vector_ingest.py` summaries
- **Multiple floats**: `db_ingest.py` already handles any WMO float ID; just point `--file` at a different NetCDF
- **Satellite datasets**: Add a new table and ingestion pipeline; the RAG schema prompt would need updating
- **Glider / buoy data**: Similar extension pattern — new table, new ingestion script, updated LLM schema
- **Export to NetCDF/ASCII**: Add `/export/:profile_id` endpoint that queries PostgreSQL and writes to netCDF4 or CSV
- **Authentication**: Add JWT middleware to FastAPI; session table already has UUID PKs
- **Geospatial queries**: Add PostGIS extension; update schema with `GEOMETRY` column for spatial indexing
