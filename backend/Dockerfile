# ── Build stage: install Python deps ─────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build tools for native packages (numpy etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --prefix=/install --no-cache-dir -r requirements.txt

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY main.py .
COPY pipeline.py .
COPY firebase_admin_setup.py .
COPY firebase-applet-config.json .

# Cloud Run injects $PORT (default 8080)
ENV PORT=8080

EXPOSE 8080

# Use exec form so signals are forwarded correctly (graceful shutdown)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
