@echo off
start "Astro" cmd /k "cd /d %~dp0astro && npm run dev"
start "FastAPI" cmd /k "cd /d %~dp0fastapi && call venv\Scripts\activate && uvicorn app.main:app --reload"
