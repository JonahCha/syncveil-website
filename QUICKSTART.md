# 🚀 SyncVeil - Quick Start Guide

## ✅ Servers Running

Both frontend and backend servers are now running!

## 🎯 One-Command Start

```bash
./start.sh
```

This will start both servers and show logs.

### 📍 Access Points

1. **Homepage**: http://localhost:5500/
2. **Authentication Page**: http://localhost:5500/auth.html
3. **Application Demo**: http://localhost:5500/app.html
4. **Dashboard**: http://localhost:5500/dashboard.html
5. **API Test Page**: http://localhost:5500/test-api.html *(for debugging)*

### 🔧 API Endpoints

- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### 🔐 Test the Application

1. Open http://localhost:5500/auth.html in your browser
2. Click "Create New Account"
3. Enter an email and password (min 8 characters)
4. Submit the form - you'll be automatically logged in and redirected to the dashboard

**Note**: If you get "Request failed" errors, the backend server needs to be restarted. Run `./start.sh` again.

### 🛑 Stop Servers

```bash
# Stop both
pkill -f uvicorn && pkill -f "http.server 5500"

# Or individually
pkill -f uvicorn              # Stop backend
pkill -f "http.server 5500"   # Stop frontend
```

### 🔄 Restart Servers

```bash
# Restart both
./start.sh

# Or individually
./start_backend.sh   # Backend only
./start_frontend.sh  # Frontend only
```

## 🐛 Troubleshooting

### Problem: "Request failed" or "Could not create account"

**Cause**: Backend server crashed or stopped

**Solution**:
```bash
./start.sh
```

This will restart both servers cleanly.
1. Make sure you're accessing http://localhost:5500 (not file://)
2. Check that both servers are running:
   ```bash
   pgrep -f uvicorn     # Should show a process ID
   pgrep -f http.server # Should show a process ID
   ```
3. Check the ports:
   ```bash
   netstat -tuln | grep -E ':(8000|5500)'
   ```

**Problem**: CORS errors in browser console

**Solution**: Already configured! The backend accepts requests from any origin (configured for `*`).

### Problem: Backend not responding

**Check backend logs**:
```bash
tail -f /tmp/backend.log
```

**Common issues**:
- Database connection (check DATABASE_URL in .env)
- Port already in use (restart with `./start.sh`)

### Problem: Frontend shows blank pages

**Solution**: Make sure you're accessing via http://localhost:5500 (not file://)

## 📝 Development Notes

- **Auto email verification** is enabled by default (no SMTP needed for dev)
- **SQLite database** is used by default at `./syncveil.db`
- **Frontend automatically detects** backend at http://localhost:8000
- **All passwords** are hashed with PBKDF2-SHA256
- **JWT tokens** are issued for authentication

## ✅ What Was Fixed

The original "Request failed" error was caused by:
1. The old backend server process had stopped/crashed
2. Requests were timing out or returning 500 errors

**Solution**: Restarted the backend with `./start.sh` which:
- Kills any existing server processes
- Starts fresh backend on port 8000
- Starts frontend on port 5500  
- Shows real-time logs for debugging

Now both login and signup work correctly!
