# SyncVeil Production Deployment Guide

## Prerequisites

- Render account (https://render.com)
- MongoDB Atlas account (for NoSQL features)
- Brevo (Sendinblue) account (for email)

---

## 🚀 Render Deployment

### 1. Initial Setup

The SyncVeil application is configured for Render deployment using `render.yaml`. This file defines both the backend web service and frontend static site.

1. Fork this repository to your GitHub account
2. Sign in to Render (https://render.com)
3. Click **"New"** → **"Blueprint"**
4. Connect your GitHub repository
5. Render will automatically:
   - Detect `render.yaml` configuration
   - Create backend web service
   - Create frontend static site
   - Assign public URLs

### 2. Configure Environment Variables

In Render dashboard, add environment variables to the backend service:

#### Required Variables

```bash
ENV=production
JWT_SECRET=<generate-strong-32-char-random-key>
BREVO_API_KEY=<your-brevo-api-key>
SMTP_FROM=<verified-sender@example.com>
CORS_ORIGINS=https://syncveil-frontend.onrender.com
FRONTEND_URL=https://syncveil-frontend.onrender.com
```

#### Required for MongoDB

```bash
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=syncveil
```

### 3. Deploy

- Render automatically deploys on every push to `main` branch
- Monitor deployment in Render dashboard
- Check logs for any errors

### 4. Verify Deployment

```bash
# Health check
curl https://syncveil-backend.onrender.com/health

# Should return: {"status": "ok"}
```

Visit: `https://syncveil-backend.onrender.com/docs` for API documentation

---

## 🗄️ Database Setup

### MongoDB Atlas (Required)

1. Create account at https://cloud.mongodb.com/
2. Create a free M0 cluster
3. Create database user
4. Whitelist IP: `0.0.0.0/0` (allow all)
5. Get connection string (mongodb+srv://...)
6. Add to Render environment variables as `MONGO_URI`

See [MONGODB_ATLAS_SETUP.md](MONGODB_ATLAS_SETUP.md) for detailed instructions.

---

## 🔐 Security Checklist

Before going to production:

- [ ] Strong `JWT_SECRET` (32+ characters, random)
- [ ] Valid Brevo API key configured
- [ ] CORS_ORIGINS set to your frontend domain
- [ ] HTTPS enabled (automatic on Render)
- [ ] MongoDB uses Atlas connection string
- [ ] No `.env` file committed to repository
- [ ] No hardcoded secrets in code

---

## 🔄 Continuous Deployment

Render automatically deploys on every push to `main`:

1. Push code to GitHub
2. Render detects changes
3. Builds new version
4. Deploys to production

To disable auto-deploy:
- Go to Render service → Settings → disable Auto-Deploy

---

## 📊 Monitoring

### Render Dashboard

- View real-time logs
- Monitor resource usage
- Check deployment history
- View metrics

### Health Check Endpoint

Monitor: `https://syncveil-backend.onrender.com/health`

Set up external monitoring (UptimeRobot, Pingdom, etc.) to ping this endpoint.

---

## 🐛 Troubleshooting

### App Not Starting

1. Check Render logs for errors
2. Verify all required environment variables are set
3. Check `render.yaml` configuration is correct

### MongoDB Connection Errors

1. Verify `MONGO_URI` starts with `mongodb+srv://`
2. Check network access allows `0.0.0.0/0` in MongoDB Atlas
3. Verify username/password are correct
4. Check cluster is active (not paused)

### CORS Issues

1. Update `CORS_ORIGINS` in Render to include your frontend domain
2. Multiple origins: `https://domain1.com,https://domain2.com`

---

## 🔄 Updates & Rollbacks

### Deploy New Version

```bash
git add .
git commit -m "Update: description"
git push origin main
```

Render automatically deploys.

### Rollback

In Render dashboard:
1. Go to service deployment history
2. Find previous successful deployment
3. Click "Redeploy"

---

## 🎯 Performance Optimization

### Database Connection Management

Already configured in `app/db/mongodb.py`:
- Automatic connection management
- Connection pooling
- Retry logic

---

## 📈 Scaling

Render offers:
- **Free Plan**: For testing and small projects
- **Starter Plan**: $7/month per service
- **Standard Plan**: $25/month per service
- **Pro Plan**: Custom pricing

To scale:
1. Go to Render service → Settings
2. Upgrade plan
3. Adjust instance type as needed

---

## 🆘 Support

- **Render**: https://render.com/docs
- **MongoDB Atlas**: https://www.mongodb.com/docs/atlas/
- **Brevo**: https://developers.brevo.com/

---

## 📝 Additional Notes

- Render provides automatic SSL/TLS certificates
- Environment variables are encrypted at rest
- Logs available in Render dashboard
- Automatic subdomain: `your-app.onrender.com`
- Custom domains supported (configure in service settings)

---

**Last Updated**: January 2026
