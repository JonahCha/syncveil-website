# SyncVeil

Privacy-first security platform with React frontend + FastAPI backend, real authentication, SQL sessions, and optional MongoDB-backed feature data.

## What This Repo Contains

- Frontend: React + Vite (`frontend/`)
- Backend: FastAPI + SQLAlchemy + Alembic (`backend/`)
- Deployment config: Render blueprint (`render.yaml`)
- CI checks: GitHub Actions + local script (`.github/workflows/ci.yml`, `scripts/ci-check.sh`)

## Current Architecture

- PostgreSQL (`DATABASE_URL`): users, sessions, auth tables, SQL-backed core auth data
- MongoDB Atlas (`MONGO_URI`, `MONGO_DB_NAME`): OTP/email-verification documents and feature collections
- Brevo (`BREVO_API_KEY`, `SMTP_FROM`): transactional email (verification/alerts)
- JWT: short-lived access token + long-lived refresh token

## Repository Structure

```text
syncveil-website/
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── core/
│   │   ├── db/
│   │   ├── mongodb/
│   │   ├── dashboard_routes.py
│   │   └── main.py
│   ├── migrations/
│   ├── requirements.txt
│   └── alembic.ini
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   └── App.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── .github/workflows/ci.yml
├── scripts/ci-check.sh
├── render.yaml
└── README.md
```

## Local Development

### 1. Backend setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edit `backend/.env` with at least:

```bash
ENV=development
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=change-me-to-a-32-char-secret
CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

If using email verification with OTP, also configure MongoDB:

```bash
MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=syncveil
```

Start backend:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend setup

```bash
cp frontend/.env.example frontend/.env.local
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Build, Test, and CI Checks

Run the same checks CI uses:

```bash
bash scripts/ci-check.sh
```

This runs:

1. Backend Python compile check
2. Backend module import smoke check
3. Frontend production build

## API Surface (Core)

Auth:

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/verify?token=...`

Dashboard:

- `GET /api/dashboard`
- `POST /api/vault/upload`
- `GET /api/vault/files`
- `GET /api/monitor/breaches`

Mongo feature routes:

- `GET /api/mongodb/health`
- `GET /api/mongodb/stats`
- CRUD under `/api/mongodb/documents` and `/api/mongodb/items`

Health:

- `GET /health`

## Authentication and Verification Behavior

- Real email/password auth against database records
- Passwords hashed with Argon2
- Access + refresh tokens returned on successful auth
- If `EMAIL_VERIFICATION_REQUIRED=true`:
  - MongoDB must be configured (`MONGO_URI`)
  - In production, email delivery must be configured (`EMAIL_ENABLED=true`, Brevo vars)
- If `EMAIL_VERIFICATION_REQUIRED=false`:
  - Users are marked verified at signup and tokens are issued immediately

## Database and Migration Notes

SyncVeil uses both SQL and MongoDB.

SQL migration commands:

```bash
cd backend
alembic upgrade head
```

Create new migration:

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

On Render, SQL migrations run automatically via `preDeployCommand` in `render.yaml`.

## Render Deployment (Consolidated Guide)

### Prerequisites

- Render account
- MongoDB Atlas account
- Brevo account (if email is enabled)
- GitHub repository

### Option A: Blueprint (recommended)

1. Render Dashboard -> New -> Blueprint
2. Connect repository
3. Render applies `render.yaml`

Services created:

- `syncveil-postgres` (PostgreSQL)
- `syncveil-backend` (FastAPI web service)
- `syncveil-website` (static frontend)

### Option B: Manual services

Backend service:

- Root dir: `backend`
- Build: `pip install -r requirements.txt`
- Pre-deploy: `alembic upgrade head`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Frontend static site:

- Root dir: `frontend`
- Build: `npm install && npm run build`
- Publish: `dist`

### Environment Variables

Backend required (manual):

```bash
MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=syncveil
BREVO_API_KEY=xkeysib-...
SMTP_FROM=verified-sender@example.com
```

Backend generally auto-set from `render.yaml`:

```bash
ENV=production
DATABASE_URL=[from linked postgres]
JWT_SECRET=[generated]
CORS_ORIGINS=https://syncveil.software,...
FRONTEND_URL=https://syncveil.software
EMAIL_ENABLED=true
```

Frontend:

```bash
VITE_API_URL=https://syncveil-backend.onrender.com
NODE_VERSION=20.19.0
```

### Post-Deploy Verification

1. Backend health: `https://syncveil-backend.onrender.com/health`
2. API docs: `https://syncveil-backend.onrender.com/docs`
3. Frontend loads successfully
4. Signup/login flow works end-to-end

### Security Checklist

- Strong `JWT_SECRET` (32+ chars)
- `DATABASE_URL` points to PostgreSQL
- `MONGO_URI` points to Atlas (not localhost)
- Brevo sender verified if email is enabled
- `CORS_ORIGINS` restricted to actual frontend domains
- No secret files committed
- HTTPS enabled (Render-managed)

### Troubleshooting

### Backend won’t start

- Check Render logs
- Verify required env vars
- Verify migration step (`alembic upgrade head`) passes

### MongoDB errors

- Ensure URI starts with `mongodb+srv://` or `mongodb://`
- Confirm Atlas network access and credentials

### Email verification errors

- Ensure `BREVO_API_KEY` and `SMTP_FROM` are set
- Ensure sender is verified in Brevo

### CORS errors

- Align `CORS_ORIGINS` and `FRONTEND_URL` with deployed frontend URL

### Frontend “Failed to fetch”

- Verify `VITE_API_URL` points to current backend URL

### Cold starts on free tier

- First request may be slower after inactivity (expected)

## Production Readiness Summary

Consolidated from prior audit docs:

- Legacy demo/test flows removed from app behavior
- Real backend authentication integrated
- Email verification flow enforced/configurable
- Dashboard uses API-based data flows
- Security posture improved (token/session handling, validation, configuration checks)

## Contributing

1. Create feature branch
2. Make changes
3. Run `bash scripts/ci-check.sh`
4. Open PR

## License

MIT. See `LICENSE`.

## Support

- GitHub Issues: `https://github.com/SyncVeil/syncveil-website/issues`
- Render docs: `https://render.com/docs`
- MongoDB Atlas docs: `https://www.mongodb.com/docs/atlas/`
- Brevo docs: `https://developers.brevo.com/`
