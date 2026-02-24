# SQL Migration Notes

This directory contains Alembic migration files for SyncVeil's SQL database schema.

**Current Status:**
- SyncVeil uses **both PostgreSQL + MongoDB** for data storage
- PostgreSQL: User authentication, sessions, OTP, and audit logs
- MongoDB: OTP storage, feature data, breach monitoring
- Alembic migrations ARE used for the PostgreSQL schema

**Database Architecture:**
- **PostgreSQL** (via `DATABASE_URL`): Core auth tables (users, sessions, otp_attempts, email_verifications, login_logs)
- **MongoDB Atlas** (via `MONGO_URI`): OTP documents, feature data, breach data

**Running Migrations:**
```bash
cd backend
alembic upgrade head
```

> On Render, this runs automatically via the `preDeployCommand` in `render.yaml`.

**When to create new migrations:**
```bash
alembic revision --autogenerate -m "description of change"
alembic upgrade head
```
