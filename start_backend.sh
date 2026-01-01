#!/bin/bash
# Start the SyncVeil backend server

# Kill any existing uvicorn processes
pkill -f uvicorn
sleep 1

# Activate virtual environment
source .venv/bin/activate

echo "Starting SyncVeil Backend..."
echo "API will be available at: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""

# Run the server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
