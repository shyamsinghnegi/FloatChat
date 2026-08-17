<div align="center">

# 🌊 FloatChat

**Ask questions about the ocean in plain English. Get real answers from real data.**

An AI-powered conversational interface over ARGO ocean float data — built for **Smart India Hackathon Problem Statement 25040** (Ministry of Earth Sciences / INCOIS).

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Gemini](https://img.shields.io/badge/Gemini-LLM-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev)
[![Free Deploy](https://img.shields.io/badge/Deploy-100%25%20free%20tier-brightgreen)](#deployment)

</div>

---

## The problem

The Argo program has thousands of autonomous floats drifting through the world's oceans, constantly measuring temperature, salinity, and pressure. That data is publicly available — but it's locked inside raw NetCDF files that only a domain expert with the right tooling can actually query. Scientists, policymakers, and students who want a straight answer have no easy way to get one.

## What FloatChat does

Ask a question. Get an answer — with the SQL that produced it, and a chart if it's spatial.

> "Show me salinity profiles near the equator in March 2023"
> "Which profile has the highest average salinity?"
> "Compare temperature readings below 1000 decibars for profile 2903954_3"

Under the hood, a hybrid RAG pipeline turns that question into a real SQL query, runs it against structured ocean data, and streams back a plain-English answer alongside the results.

## How it works

```
   ARGO NetCDF data (INCOIS DAC)
              │
              ▼
   ┌─────────────────────────┐       ┌──────────────────────────┐
   │   PostgreSQL             │       │   ChromaDB                │
   │   structured profiles    │◄─────►│   semantic profile search │
   │   + sensor readings      │       │   (vector embeddings)     │
   └─────────────────────────┘       └──────────────────────────┘
              │                                    │
              └──────────────────┬─────────────────┘
                                  ▼
                    ┌──────────────────────────┐
                    │   FastAPI + Gemini        │
                    │   hybrid_query() pipeline │
                    │                           │
                    │   1. vector search finds  │
                    │      relevant profiles    │
                    │   2. Gemini writes SQL     │
                    │   3. self-corrects on      │
                    │      execution failure     │
                    │   4. streams the answer    │
                    └──────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │   Next.js frontend         │
                    │   chat · map · depth charts│
                    └──────────────────────────┘
```

A **daily GitHub Actions job** checks ~35 tracked floats and only re-ingests the ones that actually changed — new data shows up automatically, without a blind daily re-scrape.

## Why it's interesting, technically

- **Hybrid retrieval, not just vector search.** Vector search alone can't answer "which profile has the highest average salinity" — that needs real aggregation. ChromaDB narrows down *which* profiles are relevant; PostgreSQL does the actual math.
- **Self-correcting SQL generation.** When generated SQL fails to execute, the error goes back to the LLM for one automatic retry — most failures are a wrong column name or a type mismatch, and the model fixes it without the user noticing.
- **Change-aware data sync.** Instead of re-downloading every tracked float daily, an HTTP `HEAD` check compares `Last-Modified`/`Content-Length` against the last run — only floats with new data get pulled.
- **Runs entirely on free infrastructure.** Vercel + Render + Neon + Gemini's free tier — a real, live, publicly reachable deployment with zero hosting cost.

## Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 · React 19 · TypeScript · Tailwind CSS · Recharts |
| **Backend** | FastAPI · SQLAlchemy · LangChain |
| **Database** | PostgreSQL |
| **Vector store** | ChromaDB · SentenceTransformers (`all-MiniLM-L6-v2`) |
| **LLM** | Google Gemini |
| **Data refresh** | GitHub Actions (daily cron) |
| **Hosting** | Vercel · Render · Neon — all free tier |

📖 Full architecture, data model, and design rationale: **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)**

## Running it locally

**Prerequisites**: Python 3.12+, Node.js 20+, PostgreSQL, a free [Gemini API key](https://aistudio.google.com/apikey).

```bash
# Backend
cd backend
python -m venv venv && source venv/Scripts/activate   # Windows: venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env          # fill in DB_PASSWORD, GEMINI_API_KEY

python argo_extract.py        # download sample ARGO data
python db_ingest.py           # load into PostgreSQL
python migrate_db.py          # apply schema migrations
python vector_ingest.py       # build ChromaDB embeddings

uvicorn main:app --reload --port 8000
```

```bash
# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env          # BACKEND_URL defaults to http://127.0.0.1:8000
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

## Deployment

Deploys entirely on free tiers — Vercel (frontend) + Render (backend) + Neon (Postgres) + Gemini (LLM). Full step-by-step walkthrough: **[PROJECT_DOCUMENTATION.md §13a](PROJECT_DOCUMENTATION.md#13a-deployment-free-tier)**.

---

<div align="center">
<sub>Built for SIH Problem Statement 25040 — Ministry of Earth Sciences (MoES) / INCOIS</sub>
</div>
