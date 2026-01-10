# Legacy SQL Artifacts

This directory contains Alembic migration files from an earlier version of SyncVeil that used a SQL database (PostgreSQL/SQLite).

**Current Status:**
- SyncVeil now uses **MongoDB** for all data storage
- These Alembic files are **not used** in production
- They are kept for historical reference only

**Do NOT:**
- Run these migrations against the production database
- Reintroduce SQL dependencies
- Assume SQL database support exists

**Current Database:**
- MongoDB Atlas (see `backend/app/db/mongodb.py`)
- MongoDB models (see `backend/app/mongodb/models.py`)
- No SQL database required
