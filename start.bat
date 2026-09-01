@echo off
echo ========================================================
echo   Lagos Flood Risk Prediction Platform - Fast Launcher
echo ========================================================
echo.

if not exist venv (
    echo [1/3] Creating Python virtual environment...
    python -m venv venv
)

echo [2/3] Installing Python dependencies...
call .\venv\Scripts\activate
pip install -q -r requirements.txt

if not exist frontend\dist (
    echo [3/3] Building frontend production bundle...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

echo.
echo Starting Lagos Flood Risk Platform at http://localhost:8000 ...
uvicorn app.main:app --host 0.0.0.0 --port 8000
