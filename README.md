# 🛡️ SyncVeil

**Privacy-First Security Platform** — Modern authentication, encrypted data storage, and user-centric privacy tools.

---

## 🚀 Quick Start

### Production Deployment (Render)

1. **Fork this repository**
2. **Deploy to Render**
   - Connect your GitHub repository
   - Render uses `render.yaml` for configuration
3. **Set Environment Variables** (see [Configuration](#configuration))
4. **Deploy!**

View your app at: `https://syncveil-backend.onrender.com`

### Local Development

```bash
# Clone repository
git clone https://github.com/SyncVeil/syncveil-website.git
cd syncveil-website

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env with your settings

# Start development server
chmod +x start_backend.sh
./start_backend.sh
```

Server runs at: `http://localhost:8000`

---

## 📋 Configuration

### Required Environment Variables

```bash
# Environment
ENVIRONMENT=production

# Database (PostgreSQL for production)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT Authentication
JWT_SECRET=<generate-strong-random-key>
JWT_ALGORITHM=HS256

# Email Service (Brevo Transactional Email API)
BREVO_API_KEY=<your-brevo-api-key>
SMTP_FROM=<verified-sender@example.com>
EMAIL_FROM=noreply@yourdomain.com

# CORS
CORS_ORIGINS=https://yourdomain.com

# Frontend URL
FRONTEND_URL=https://yourdomain.com
```

### Optional Environment Variables

```bash
# MongoDB Atlas (NoSQL features)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=syncveil

# Redis (Session/Rate limiting)
REDIS_URL=redis://default:password@host:6379
```

See [.env.example](.env.example) for complete configuration options.

---

## 🏗️ Architecture

```
SyncVeil
├── FastAPI Backend (Python)
│   ├── JWT Authentication
│   ├── MongoDB Atlas (NoSQL data storage)
│   └── Brevo (Email)
├── React Frontend (Vite)
│   └── Static site on Render
└── Render Deployment
    ├── Automatic HTTPS
    ├── Environment variables
    └── render.yaml configuration
```

### Tech Stack

- **Backend**: FastAPI, Motor (MongoDB)
- **Database**: MongoDB Atlas
- **Auth**: JWT, Argon2 password hashing
- **Email**: Brevo (Transactional API)
- **Deployment**: Render

---

## 📚 API Documentation

Once deployed, visit:
- **Interactive Docs**: `https://syncveil-backend.onrender.com/docs`
- **Alternative Docs**: `https://syncveil-backend.onrender.com/redoc`
- **Health Check**: `https://syncveil-backend.onrender.com/health`

### Key Endpoints

- `POST /auth/signup` - Create new account
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `GET /health` - Health check
- `GET /api/mongodb/*` - MongoDB operations (if enabled)

---

## 🗂️ Project Structure

```
syncveil-website/
├── app/
│   ├── auth/           # Authentication logic
│   ├── core/           # Configuration, security, JWT
│   ├── db/             # Database connections
│   └── mongodb/        # MongoDB routes & models
├── migrations/         # Database migrations
├── *.html              # Frontend pages
├── Procfile           # Railway deployment config
├── requirements.txt   # Python dependencies
├── .env.example       # Environment template
└── start_backend.sh   # Local development script
```

---

## 🔒 Security Features

- ✅ Argon2 password hashing
- ✅ JWT-based authentication
- ✅ Rate limiting on auth endpoints
- ✅ CORS configuration
- ✅ Environment-based secrets
- ✅ No hardcoded credentials
- ✅ SSL/TLS for all connections

---

## 🧪 Testing

```bash
# Run backend tests
python test_backend.py

# Test health endpoint
curl https://syncveil-backend.onrender.com/health
```

---

## 📖 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [MongoDB Atlas Setup](MONGODB_ATLAS_SETUP.md)
- [MongoDB API Documentation](MONGODB_API.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/SyncVeil/syncveil-website/issues)
- **Documentation**: See documentation files
- **Email**: support@syncveil.com

---

## 🎯 Roadmap

- [ ] Two-factor authentication (2FA)
- [ ] OAuth integrations (Google, GitHub)
- [ ] Account recovery flow
- [ ] Admin dashboard
- [ ] API rate limiting dashboard
- [ ] WebSocket support for real-time features

---

**Built with ❤️ by the SyncVeil Team**

*Privacy Reinvented. Security Simplified.*
