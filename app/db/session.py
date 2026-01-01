"""
Database Session Management
CRITICAL: Use PostgreSQL in production, never SQLite
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# Configure engine based on environment
connect_args = {}

# SQLite specific configuration
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_kwargs = {
        "connect_args": connect_args,
        "echo": False,
    }
# Production: NullPool (no connection pooling for serverless/Railway)
elif settings.is_production:
    engine_kwargs = {
        "poolclass": NullPool,
        "echo": False,
    }
else:
    # Development: Use connection pool
    engine_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "echo": False,
        "pool_pre_ping": True,  # Test connections before using
    }

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

# PostgreSQL-specific event listeners
@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Configure PostgreSQL on connection"""
    if settings.DATABASE_URL.startswith("postgresql"):
        cursor = dbapi_conn.cursor()
        # Use UTC for all timestamps
        cursor.execute("SET timezone = 'UTC'")
        cursor.close()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()