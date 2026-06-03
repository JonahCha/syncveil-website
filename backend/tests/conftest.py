from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DB = Path("/tmp/syncveil-test.db")
TEST_STORAGE = Path("/tmp/syncveil-test-storage")
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _configure_env() -> None:
    os.environ["ENV"] = "test"
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{TEST_DB}"
    os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123"
    os.environ["VAULT_ENCRYPTION_KEY"] = "test-encryption-key-test-encryption-key-123"
    os.environ["VAULT_STORAGE_DIR"] = str(TEST_STORAGE)
    os.environ["CORS_ORIGINS"] = "http://testserver"
    os.environ["FRONTEND_URL"] = "http://testserver"
    os.environ["EMAIL_ENABLED"] = "false"


_configure_env()


@pytest.fixture(scope="session")
def app_client():
    if TEST_DB.exists():
        TEST_DB.unlink()
    if TEST_STORAGE.exists():
        shutil.rmtree(TEST_STORAGE)

    from app.core.config import get_settings
    from app.core.database import init_db

    get_settings.cache_clear()
    from app.main import app
    init_db()

    client = TestClient(app)
    return client


@pytest.fixture()
def client(app_client):
    return app_client
