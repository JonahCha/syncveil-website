#!/bin/bash
# Start the SyncVeil frontend server

# Kill any existing http.server on port 5500
pkill -f "http.server 5500"
sleep 1

echo "Starting SyncVeil Frontend..."
echo "Application will be available at: http://localhost:5500"
echo ""
echo "Pages:"
echo "  - Homepage: http://localhost:5500/"
echo "  - Auth: http://localhost:5500/auth.html"
echo "  - App: http://localhost:5500/app.html"
echo "  - Dashboard: http://localhost:5500/dashboard.html"
echo "  - API Test: http://localhost:5500/test-api.html"
echo ""

# Run the server
python -m http.server 5500
