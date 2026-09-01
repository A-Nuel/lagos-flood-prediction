# ── Stage 1: Build Frontend ──────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Backend & Production Image ──────────────────
FROM python:3.11-slim
WORKDIR /app

# Install system geospatial dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application, models, and data
COPY app/ ./app/
COPY models/ ./models/
COPY data/interim/grid_enriched.geojson ./data/interim/grid_enriched.geojson

# Copy compiled frontend from Stage 1 into static mount directory
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8000

ENV PORT=8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
