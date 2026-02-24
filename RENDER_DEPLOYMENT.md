# 🚀 SyncVeil Render Deployment Guide

**Complete guide to deploy SyncVeil website on Render with zero errors**

---

## ✅ Pre-Deployment Checklist

Before deploying to Render, ensure you have:

1. **MongoDB Atlas Account** (Free tier available)
   - MongoDB URI ready (starts with `mongodb+srv://`)
   - Database name: `syncveil`

2. **Brevo (Sendinblue) Account** (For email verification)
   - API Key ready
   - Verified sender email

3. **GitHub Repository**
   - Fork or push this repository to your GitHub account

---

## 🔧 Step 1: Deploy to Render

### Option A: Deploy via Blueprint (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repository
4. Select the repository: `syncveil-website`
5. Render will automatically detect `render.yaml`
6. Click **"Apply"**

This will create:
- ✅ PostgreSQL database (`syncveil-postgres`)
- ✅ Backend API service (`syncveil-backend`)
- ✅ Frontend static site (`syncveil-website`)

### Option B: Manual Deployment

If blueprint fails, deploy services individually:

#### 1. Create PostgreSQL Database
- Click **"New"** → **"PostgreSQL"**
- Name: `syncveil-postgres`
- Plan: **Free**
- Create database

#### 2. Deploy Backend
- Click **"New"** → **"Web Service"**
- Connect repository
- Configure:
  - **Name**: `syncveil-backend`
  - **Root Directory**: `backend`
  - **Environment**: `Python 3`
  - **Build Command**: `pip install -r requirements.txt`
  - **Pre-Deploy Command**: `alembic upgrade head`
  - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

#### 3. Deploy Frontend
- Click **"New"** → **"Static Site"**
- Connect repository
- Configure:
  - **Name**: `syncveil-website`
  - **Root Directory**: `frontend`
  - **Build Command**: `npm install && npm run build`
  - **Publish Directory**: `dist`

---

## 🔐 Step 2: Configure Environment Variables

### Backend Service (`syncveil-backend`)

Go to **syncveil-backend** → **Environment** and add these variables:

#### ✅ Required (Must Configure)

```bash
# MongoDB (REQUIRED)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=syncveil

# Email Service (REQUIRED)
BREVO_API_KEY=xkeysib-your-brevo-api-key
SMTP_FROM=verified-sender@yourdomain.com

# CORS (Update with your frontend URL)
CORS_ORIGINS=https://syncveil-website.onrender.com
FRONTEND_URL=https://syncveil-website.onrender.com
```

#### ✅ Auto-Generated (Render handles these)

```bash
# Database - Auto-linked from syncveil-postgres
DATABASE_URL=[auto-generated]

# JWT Secret - Auto-generated secure random string
JWT_SECRET=[auto-generated]
```

#### ✅ Optional (Already configured in render.yaml)

These are set automatically from `render.yaml`:
- `ENV=production`
- `EMAIL_ENABLED=true`
- `OTP_LENGTH=6`
- `OTP_EXPIRE_MINUTES=10`
- All other security and logging settings

### Frontend Static Site (`syncveil-website`)

Go to **syncveil-website** → **Environment** and verify:

```bash
# Backend API URL (Update if backend URL is different)
VITE_API_URL=https://syncveil-backend.onrender.com

# Node version (already set)
NODE_VERSION=20.19.0
```

---

## 📧 Step 3: Configure MongoDB Atlas

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a **Free M0 Cluster** if you don't have one
3. **Database Access**:
   - Create a database user with password
   - Note the username and password
4. **Network Access**:
   - Add IP: `0.0.0.0/0` (Allow from anywhere)
   - This allows Render to connect
5. **Get Connection String**:
   - Click **"Connect"** → **"Connect your application"**
   - Copy the connection string
   - Replace `<password>` with your database password
   - Add to Render as `MONGO_URI`

---

## 📧 Step 4: Configure Brevo Email Service

1. Go to [Brevo](https://www.brevo.com/)
2. Create a free account (300 emails/day free)
3. **Verify sender email**:
   - Go to **Senders** → **Add a Sender**
   - Add your email and verify it
4. **Get API Key**:
   - Go to **SMTP & API** → **API Keys**
   - Create a new API key
   - Copy the key (starts with `xkeysib-`)
   - Add to Render as `BREVO_API_KEY`
5. **Set SMTP_FROM**:
   - Use the verified sender email
   - Add to Render as `SMTP_FROM`

---

## ✅ Step 5: Verify Deployment

### 1. Check Backend Health

Visit: `https://syncveil-backend.onrender.com/health`

Should return:
```json
{"status": "ok"}
```

### 2. Check API Documentation

Visit: `https://syncveil-backend.onrender.com/docs`

You should see the FastAPI interactive documentation.

### 3. Check Frontend

Visit: `https://syncveil-website.onrender.com`

Website should load without errors.

### 4. Test User Registration

1. Click **"Get Started"** on homepage
2. Click **"Sign Up"**
3. Enter email and password (min 8 characters)
4. Submit form
5. Check email for verification code
6. Enter code to verify account
7. Login with credentials

---

## 🐛 Troubleshooting

### Issue: Backend Not Starting

**Check Render Logs:**
1. Go to **syncveil-backend** → **Logs**
2. Look for error messages

**Common fixes:**
- Verify `MONGO_URI` is correct and starts with `mongodb+srv://`
- Verify `DATABASE_URL` is set (should be auto-linked)
- Verify `JWT_SECRET` is generated
- Check MongoDB Atlas network access allows `0.0.0.0/0`

### Issue: Database Connection Failed

**Error:** `MONGO_URI is required`

**Fix:** Add `MONGO_URI` environment variable in Render backend service

**Error:** `MongoServerError: Authentication failed`

**Fix:** 
- Check MongoDB username/password in connection string
- Ensure database user has read/write permissions

### Issue: Email Verification Not Working

**Error:** `Email configuration missing`

**Fix:** 
- Add `BREVO_API_KEY` environment variable
- Add `SMTP_FROM` environment variable
- Verify sender email in Brevo

### Issue: CORS Errors in Browser

**Error:** `Access to fetch blocked by CORS policy`

**Fix:**
1. Go to backend environment variables
2. Update `CORS_ORIGINS` to match your frontend URL
3. Update `FRONTEND_URL` to match your frontend URL
4. Redeploy backend service

### Issue: Frontend Shows "Failed to fetch"

**Fix:**
1. Check `VITE_API_URL` in frontend environment variables
2. Ensure it points to your backend URL
3. Rebuild frontend static site

### Issue: Cold Start Timeout

**Symptom:** First request after inactivity takes 30+ seconds

**This is normal on Render free tier:**
- Services sleep after 15 minutes of inactivity
- First request wakes the service (~30 seconds)
- Subsequent requests are fast
- Upgrade to paid plan for always-on services

---

## 🔄 Continuous Deployment

Render automatically deploys on every push to `main` branch:

1. Make code changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   ```
3. Render detects changes and deploys automatically
4. Monitor deployment in Render dashboard

To disable auto-deploy:
- Go to service → **Settings** → **Build & Deploy** → Disable **Auto-Deploy**

---

## 📊 Monitoring

### Health Check

Set up external monitoring (UptimeRobot, Pingdom, etc.):
- **URL**: `https://syncveil-backend.onrender.com/health`
- **Interval**: 5 minutes
- **Method**: GET
- **Expected**: 200 OK with `{"status":"ok"}`

### Render Dashboard

Monitor in real-time:
- **Logs**: View application logs
- **Metrics**: CPU, memory, request count
- **Events**: Deployment history
- **Errors**: Error tracking

---

## 🔐 Security Checklist

Before going live:

- [ ] `JWT_SECRET` is auto-generated (32+ characters)
- [ ] `MONGO_URI` uses MongoDB Atlas (not local)
- [ ] `DATABASE_URL` is PostgreSQL (not SQLite)
- [ ] `BREVO_API_KEY` is set and valid
- [ ] `SMTP_FROM` is verified in Brevo
- [ ] `CORS_ORIGINS` set to frontend domain only
- [ ] `EMAIL_ENABLED=true` for email verification
- [ ] No `.env` files in repository
- [ ] No hardcoded secrets in code
- [ ] HTTPS enabled (automatic on Render)
- [ ] MongoDB network access restricted (or monitored)

---

## 📝 Environment Variables Summary

| Variable | Required | Auto-Set | Description |
|----------|----------|----------|-------------|
| `DATABASE_URL` | ✅ | ✅ | PostgreSQL connection (auto-linked) |
| `JWT_SECRET` | ✅ | ✅ | JWT signing key (auto-generated) |
| `MONGO_URI` | ✅ | ❌ | MongoDB Atlas connection string |
| `MONGO_DB_NAME` | ✅ | ✅ | Database name (default: syncveil) |
| `BREVO_API_KEY` | ✅ | ❌ | Brevo email API key |
| `SMTP_FROM` | ✅ | ❌ | Verified sender email |
| `CORS_ORIGINS` | ✅ | ✅ | Frontend URL (update if needed) |
| `FRONTEND_URL` | ✅ | ✅ | Frontend URL (update if needed) |
| `EMAIL_ENABLED` | ✅ | ✅ | Enable email verification (true) |
| `ENV` | ✅ | ✅ | Environment (production) |
| All others | ❌ | ✅ | Set in render.yaml |

**✅ = Already configured | ❌ = Must add manually**

---

## 🎉 Success!

Your SyncVeil website is now live on Render!

- **Frontend**: `https://syncveil-website.onrender.com`
- **Backend**: `https://syncveil-backend.onrender.com`
- **API Docs**: `https://syncveil-backend.onrender.com/docs`

Share the frontend URL with users and start testing!

---

## 📞 Support

If you encounter issues:

1. Check Render logs for errors
2. Verify all environment variables are set
3. Review this guide's troubleshooting section
4. Check MongoDB Atlas connection
5. Verify Brevo email configuration

For Render-specific issues:
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com/)

For MongoDB issues:
- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)

For Brevo issues:
- [Brevo Documentation](https://developers.brevo.com/)
