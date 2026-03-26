# Whitepapper Monorepo

This workspace contains two apps:

- `astro/` - frontend (Astro + Clerk)
- `fastapi/` - backend API (FastAPI + Clerk token/webhook handling)

## Start both apps

1. Frontend

```bash
cd astro
npm install
npm run dev
```

2. Backend

```bash
cd fastapi
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## API base URLs

Backend endpoints are available from root paths:

- `/health`, `/users/me`, `/projects`, ...

## Project API keys

Project owners can generate read-only API keys from the project dashboard settings screen.

- Keys are scoped to a single project.
- Raw keys are shown only once at creation time.
- Usage is tracked monthly with per-key limits.
- Dev endpoints require the `x-api-key` header.

### Owner-managed key endpoints

- `GET /projects/{projectId}/api-key`
- `POST /projects/{projectId}/api-key`
- `PATCH /api-keys/{keyId}`
- `DELETE /api-keys/{keyId}`

### Dev content endpoint

- `GET /dev/projects?id={projectId}`
- `GET /dev/projects?slug={projectSlug}`

Example:

```bash
curl -H "x-api-key: YOUR_API_KEY" http://127.0.0.1:8000/dev/projects?id=PROJECT_ID
```
