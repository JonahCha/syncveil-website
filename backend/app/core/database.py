"""SQLAlchemy base and database bootstrap helpers."""
from __future__ import annotations

from sqlalchemy.orm import declarative_base

Base = declarative_base()


def init_db() -> None:
    """Create all known tables when a database engine is configured."""
    from app.db.session import engine

    if engine is None:
        return

    # Import models so SQLAlchemy registers them on Base.metadata before create_all.
    from app.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
