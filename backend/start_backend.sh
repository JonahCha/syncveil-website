#!/bin/bash
# SyncVeil Backend - Local Development Server (API-only)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting SyncVeil Backend (Development Mode)"
echo "Working directory: $SCRIPT_DIR"
echo ""

if [ ! -d ".venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python -m venv .venv
    echo "✓ Virtual environment created"
fi

source .venv/bin/activate

echo "📦 Checking dependencies..."
pip install -q -r requirements.txt
echo "✓ Dependencies ready"
echo ""

PORT=${PORT:-8000}

echo "Configuration:"
echo "  Host: 0.0.0.0"
echo "  Port: $PORT"
echo "  Reload: Enabled"
echo "  CORS: $(python - <<'PY'
from app.core.config import get_settings
print(', '.join(get_settings().cors_origins_list))
PY
)"
echo ""
echo "API Documentation: http://0.0.0.0:$PORT/docs"
echo "Health Check: http://0.0.0.0:$PORT/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo "─────────────────────────────────────────"

exec python main.py
