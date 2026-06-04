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
alembic upgrade heads
echo "✓ Migrations complete"
echo ""

exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
