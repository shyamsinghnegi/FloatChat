FROM python:3.11-slim

WORKDIR /app

# netCDF4 needs these system libs to build/run on Debian slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libhdf5-dev \
    libnetcdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV HF_HOME=/app/.hf_cache
COPY download_model.py .
RUN python download_model.py

# No network calls for model files at runtime - the model is already baked in above,
# and an HF_HUB_OFFLINE-less run was making per-request HEAD calls to check for
# updates, adding real latency (and a failure point) to every cold start.
ENV HF_HUB_OFFLINE=1

COPY . .

# Cloud Run sets $PORT at runtime; default 8080 lets `docker run` work without it
ENV PORT=8080
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
