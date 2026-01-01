# MongoDB Atlas Setup Guide

## Your MongoDB Atlas Credit Code
```
GITHUBSTUDENT50-NW6GKJ
```

## Step-by-Step Setup

### 1. Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with your GitHub account (recommended for student benefits)
3. Verify your email

### 2. Apply Your Atlas Credit Code

1. Log in to MongoDB Atlas: https://cloud.mongodb.com/
2. Click on your **organization name** (top-left)
3. Go to **Billing** → **Payment Method**
4. Click **Add Promotional Code**
5. Enter: `GITHUBSTUDENT50-NW6GKJ`
6. Click **Apply** - You'll receive **$50 in Atlas credits**! 🎉

### 3. Create a Free Cluster

1. Click **"Build a Database"** or **"Create"**
2. Choose **M0 FREE** tier (this won't use your credits)
3. Select a cloud provider and region (choose closest to you):
   - **AWS** - us-east-1 (N. Virginia)
   - **GCP** - us-east4 (N. Virginia)
   - **Azure** - eastus (Virginia)
4. Name your cluster: `SyncVeil` (or any name)
5. Click **"Create Cluster"** (takes 1-3 minutes)

### 4. Create Database User

1. Go to **Database Access** (left sidebar)
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Set username: `syncveil_user` (or your choice)
5. Set a strong password (save it!)
6. User Privileges: **Read and write to any database**
7. Click **"Add User"**

### 5. Configure Network Access

1. Go to **Network Access** (left sidebar)
2. Click **"Add IP Address"**
3. For development, click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ For production, use specific IP addresses
4. Click **"Confirm"**

### 6. Get Connection String

1. Go back to **Database** (left sidebar)
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Driver: **Python**, Version: **3.12 or later**
5. Copy the connection string - it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### 7. Update Your .env File

1. Open `.env` in your project
2. Replace the MongoDB URL with your connection string:
   ```env
   MONGODB_URL=mongodb+srv://syncveil_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=syncveil
   ```
3. Replace `<username>` with your database username
4. Replace `<password>` with your database password
5. Replace the cluster URL with your actual cluster URL

**Example:**
```env
MONGODB_URL=mongodb+srv://syncveil_user:MySecurePass123@cluster0.abc12.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=syncveil
```

### 8. Restart Your Server

```bash
# Stop current server
pkill -f uvicorn && pkill -f "http.server 5500"

# Restart with new MongoDB Atlas connection
bash start.sh
```

### 9. Test the Connection

```bash
# Check MongoDB health
curl http://localhost:8000/api/mongodb/health
```

You should see:
```json
{
  "status": "healthy",
  "database": "syncveil",
  "message": "MongoDB connection is active"
}
```

### 10. Test Your API

Open in browser: http://localhost:5500/test-mongodb.html

Or use the API docs: http://localhost:8000/docs

## MongoDB Atlas Benefits with Your Credit

✅ **$50 in credits** - Great for development and testing
✅ **Free M0 tier** - 512MB storage, shared RAM, perfect for learning
✅ **Cloud-hosted** - No local installation needed
✅ **Auto-backups** - Data is safe
✅ **Global deployment** - Choose regions worldwide
✅ **Real-time monitoring** - Performance metrics and alerts

## Cluster Tiers

| Tier | RAM | Storage | Cost | Best For |
|------|-----|---------|------|----------|
| M0 | Shared | 512MB | FREE | Learning, prototypes |
| M2 | Shared | 2GB | $9/month | Small apps |
| M5 | 2GB | 5GB | $25/month | Production apps |

💡 **Tip**: Start with M0 (FREE) and upgrade later using your $50 credit!

## Troubleshooting

### Connection Refused Error
- ✅ Check your username and password are correct
- ✅ Ensure IP whitelist includes your IP (or 0.0.0.0/0)
- ✅ Verify cluster is running (green status in Atlas)

### Authentication Failed
- ✅ Make sure password has no special characters that need URL encoding
- ✅ If password has special chars, URL encode them:
  - `@` → `%40`
  - `#` → `%23`
  - `$` → `%24`
  - `%` → `%25`

### Timeout Errors
- ✅ Check network access allows your IP
- ✅ Verify cluster is active (not paused)
- ✅ Try different regions if connection is slow

## Atlas Dashboard Features

Once connected, explore:

1. **Browse Collections** - View your data in real-time
2. **Performance Advisor** - Get optimization suggestions
3. **Real-time Charts** - Visualize your data
4. **Alerts** - Set up notifications
5. **Backup & Restore** - Manage your data backups

## Need Help?

- **Atlas Documentation**: https://docs.atlas.mongodb.com/
- **MongoDB University**: https://learn.mongodb.com/ (Free courses!)
- **Community Forums**: https://www.mongodb.com/community/forums/

## Quick Test After Setup

```bash
# 1. Test health
curl http://localhost:8000/api/mongodb/health

# 2. Create a test document
curl -X POST http://localhost:8000/api/mongodb/documents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Atlas Document",
    "description": "Testing MongoDB Atlas!",
    "tags": ["atlas", "cloud", "mongodb"]
  }'

# 3. List documents
curl http://localhost:8000/api/mongodb/documents
```

---

**Your Atlas Credit Code**: `GITHUBSTUDENT50-NW6GKJ`

Don't forget to apply it in your Atlas billing settings! 💰
