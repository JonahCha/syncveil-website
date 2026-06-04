#!/bin/bash
# SyncVeil Backend - Render Production Start Script

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting SyncVeil Backend"
echo "Working directory: $SCRIPT_DIR"
echo ""

PORT=${PORT:-10000}

echo "Configuration:"
echo "  Host: 0.0.0.0"
echo "  Port: $PORT"
echo "  CORS: $(python - <<'PY'
from app.core.config import get_settings
print(', '.join(get_settings().cors_origins_list))
PY
)"
echo ""
echo "API Documentation: http://0.0.0.0:$PORT/docs"
echo "Health Check: http://0.0.0.0:$PORT/health"
echo ""

echo "🔄 Running database migrations..."

# If alembic_version table has no rows, the DB already has tables from a
# previous run but was never stamped — stamp it now so Alembic knows the
# current state, then upgrade will only apply genuinely missing migrations.
STAMPED=$(python - <<'PY'
import os, psycopg2
url = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)
try:
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM alembic_version")
    count = cur.fetchone()[0]
    conn.close()
    print("ok" if count > 0 else "empty")
except Exception as e:
    # Table doesn't exist yet — fresh DB, let alembic handle it
    print("fresh")
PY
)

echo "  Alembic state: $STAMPED"

if [ "$STAMPED" = "empty" ]; then
    echo "  ⚠ alembic_version empty — stamping existing schema as heads"
    alembic stamp heads
    echo "  ✓ Stamped"
fi

alembic upgrade heads
echo "✓ Migrations complete"
echo ""

exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
