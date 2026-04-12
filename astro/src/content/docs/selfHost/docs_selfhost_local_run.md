Run Whitepapper locally from the monorepo.

## Prerequisites

- Node.js and npm
- Python 3.11+
- Valid `.env` files in `astro/` and `fastapi/`

## Steps

Frontend:

```bash
cd astro
npm install
npm run dev
```

Backend:

```bash
cd fastapi
python -m venv .venv
. .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Expected outcome

- Frontend: `http://localhost:4321`
- Backend health: `http://127.0.0.1:8000/health` returns `{"status":"ok"}`

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Frontend cannot reach API | Wrong `PUBLIC_API_BASE_URL` | Set to local backend URL |
| Auth errors | Clerk dev keys mismatch | Update Clerk env values |
| Redis/cache warnings | Valkey config missing | Configure Valkey env or run without cache dependency |

## Related pages

- [Environment Files](/docs/self-host/environment-files)
- [Production Checklist](/docs/self-host/production-checklist)
\nLast updated: 12th April, 2026\n
