# ============================================================
# AAS PPR Modelling — Backend (FastAPI + Python)
# Build from repo root:  docker build -f docker/backend.Dockerfile -t aas-backend .
# ============================================================
FROM python:3.12-slim

WORKDIR /app

# --- System dependencies (PyMuPDF requires libmupdf) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

# --- Python dependencies ---
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Application code ---
COPY api/ ./api/
COPY Generation/ ./Generation/
COPY Validation/ ./Validation/
COPY Transformation/ ./Transformation/
COPY Ontology/ ./Ontology/
COPY aas_configs/ ./aas_configs/
COPY Guidance/ ./Guidance/

# Note: Generation/config.yaml must exist before `docker build`.
# Copy it from config.example.yaml and fill in your API keys.

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
