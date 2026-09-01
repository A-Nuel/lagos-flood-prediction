#!/bin/bash
set -e

echo "========================================================"
echo "  Lagos Flood Risk Prediction Platform - Fast Launcher"
echo "========================================================"
echo ""

if [ ! -d "venv" ]; then
    echo "[1/3] Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "[2/3] Installing Python dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt

if [ ! -d "frontend/dist" ]; then
    echo "[3/3] Building frontend production bundle..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

echo ""
echo "Starting Lagos Flood Risk Platform at http://localhost:8000 ..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
