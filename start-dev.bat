@echo off
start "Astro" cmd /c "cd /d %~dp0astro && npm run dev"
start "FastAPI" cmd /c "cd /d %~dp0fastapi && call venv\Scripts\activate && uvicorn app.main:app --reload"
