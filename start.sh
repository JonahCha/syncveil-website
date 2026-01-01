#!/bin/bash
# Start both SyncVeil frontend and backend servers

echo "🚀 Starting SyncVeil Application..."
echo ""

# Kill any existing processes
echo "Stopping existing servers..."
pkill -f uvicorn 2>/dev/null
pkill -f "http.server 5500" 2>/dev/null
sleep 2

# Start backend in background
echo "Starting backend (FastAPI)..."
cd "$(dirname "$0")"
source .venv/bin/activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Failed to start backend!"
    echo "Check logs: tail -f /tmp/backend.log"
    exit 1
fi

# Start frontend in background
echo "Starting frontend (HTTP Server)..."
python -m http.server 5500 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 2

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Failed to start frontend!"
    echo "Check logs: tail -f /tmp/frontend.log"
    exit 1
fi

echo ""
echo "✅ SyncVeil Application Started Successfully!"
echo ""
echo "📍 Access Points:"
echo "  - Homepage: http://localhost:5500/"
echo "  - Auth: http://localhost:5500/auth.html"
echo "  - Dashboard: http://localhost:5500/dashboard.html"
echo "  - API Test: http://localhost:5500/test-api.html"
echo ""
echo "🔧 Backend:"
echo "  - API: http://localhost:8000"
echo "  - Docs: http://localhost:8000/docs"
echo "  - Health: http://localhost:8000/health"
echo ""
echo "📝 Logs:"
echo "  - Backend: tail -f /tmp/backend.log"
echo "  - Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop servers:"
echo "  - pkill -f uvicorn"
echo "  - pkill -f 'http.server 5500'"
echo ""
echo "Press Ctrl+C to view logs (servers will continue running)..."
echo ""

# Show logs
tail -f /tmp/backend.log /tmp/frontend.log
