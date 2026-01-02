#!/bin/bash
# SyncVeil Backend - Local Development Server
# For production deployment, use Procfile (Railway automatically uses it)

set -e

echo "🚀 Starting SyncVeil Backend (Development Mode)"
echo ""

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python -m venv .venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
source .venv/bin/activate

# Install/update dependencies
echo "📦 Checking dependencies..."
pip install -q -r requirements.txt
echo "✓ Dependencies ready"
echo ""

# Get port from environment or default to 8000
PORT=${PORT:-8000}

echo "Configuration:"
echo "  Host: 0.0.0.0"
echo "  Port: $PORT"
echo "  Reload: Enabled"
echo ""
echo "API Documentation: http://localhost:$PORT/docs"
echo "Health Check: http://localhost:$PORT/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo "─────────────────────────────────────────"

# Run the server with auto-reload for development
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $PORT
