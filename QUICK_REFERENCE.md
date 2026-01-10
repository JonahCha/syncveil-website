# SyncVeil React Frontend - Quick Reference

## 🚀 Commands Cheat Sheet

### Development
```bash
npm install                    # Install dependencies (first time only)
npm run dev                   # Start dev server → localhost:5173
npm run build                 # Create production build
npm run preview              # Test build locally → localhost:4173
```

### Project Navigation
```bash
cd src/                       # Source code directory
cd src/components/            # Reusable components
cd src/components/views/      # Page view components
cd dist/                      # Production build output
```

## 📁 Component Files

| File | Purpose | Type |
|------|---------|------|
| src/App.jsx | Main app, state management | View root |
| src/components/Navigation.jsx | Top navbar | Component |
| src/components/Footer.jsx | Footer | Component |
| src/components/BreachMap.jsx | World map visualization | Component |
| src/components/NewsSection.jsx | News display | Component |
| src/components/views/Home.jsx | Landing page | View |
| src/components/views/AuthChoice.jsx | Login/Signup forms | View |
| src/components/views/Dashboard.jsx | User dashboard | View |
| src/components/views/InfoPage.jsx | Info page | View |

## 🎯 Main Features

| Feature | Location | Status |
|---------|----------|--------|
| Navigation | Navigation.jsx | ✅ Mobile responsive |
| Hero Section | Home.jsx | ✅ Animated |
| Features Grid | Home.jsx | ✅ Icon based |
| World Map | BreachMap.jsx | ✅ Interactive |
| News Section | NewsSection.jsx | ✅ Severity badges |
| File Upload | Dashboard.jsx | ✅ Drag-and-drop |
| Dashboard Tabs | Dashboard.jsx | ✅ Multiple tabs |
| Authentication | AuthChoice.jsx | ✅ Tab switching |

## 🔑 State Variables (App.jsx)

```javascript
const [currentView, setCurrentView] = useState('home');
const [isAuthenticated, setIsAuthenticated] = useState(false);
```

## 📱 Views/Pages

| View | Path | Description |
|------|------|-------------|
| Home | currentView='home' | Landing page |
| AuthChoice | currentView='auth' | Login/Signup |
| Dashboard | currentView='dashboard' + isAuthenticated=true | User area |
| InfoPage | currentView='info' | Info display |

## 🎨 Styling

- **Tailwind CSS**: Utility classes in JSX
- **Embedded CSS**: Animations in index.html `<style>` tag
- **No SCSS/LESS**: Keep it simple

## 📦 Dependencies

```json
{
  "react": "^19.2.3",
  "react-dom": "^19.2.3",
  "vite": "^7.3.0",
  "@vitejs/plugin-react": "^5.1.2",
  "lucide-react": "^0.562.0",
  "jsvectormap": "^1.7.0"
}
```

## 🚢 Deployment (Render)

```bash
# Build command
npm install && npm run build

# Deployment configured in render.yaml
# Backend: https://syncveil-backend.onrender.com
# Frontend: https://syncveil-frontend.onrender.com

# Environment variables
# VITE_API_URL configured in render.yaml
```

## 🐛 Troubleshooting

### "Cannot find module"
```bash
npm install
npm run dev
```

### "Port 5173 already in use"
```bash
npm run dev -- --port 5174
```

### "Build fails"
```bash
rm -rf node_modules dist
npm install
npm run build
```

### "Map not showing"
- Check jsVectorMap CDN is loaded
- Verify window.jsVectorMap exists
- Check browser console for errors

### "Icons not showing"
- Reload page
- Check Lucide icons CDN
- Run window.lucide.createIcons() in console

## 📊 Build Output

```
dist/
├── index.html              # 8.4 KB (2.5 KB gzipped)
└── assets/
    ├── index-*.css        # 2.9 KB (1.1 KB gzipped)
    └── index-*.js         # 228.9 KB (69.4 KB gzipped)
```

## 🔍 Important Files

| File | Purpose |
|------|---------|
| index.html | React entry point + SEO metadata |
| vite.config.js | Build configuration |
| package.json | Dependencies and scripts |
| .gitignore | Git ignore patterns |
| src/App.jsx | Main app component |

## 📚 Documentation

- **[REACT_FRONTEND.md](REACT_FRONTEND.md)** - Full guide
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Production deployment
- **[MIGRATION_VERIFICATION.md](MIGRATION_VERIFICATION.md)** - Completion report
- **[REACT_MIGRATION_COMPLETE.md](REACT_MIGRATION_COMPLETE.md)** - Overview

## 🎓 React Patterns Used

### Component Structure
```jsx
function MyComponent({ prop }) {
  const [state, setState] = useState(initial);
  
  useEffect(() => {
    // Setup
    return () => { // Cleanup
    };
  }, [dependencies]);
  
  return (
    <div className="tailwind-classes">
      JSX content
    </div>
  );
}

export default MyComponent;
```

### Conditional Rendering
```jsx
{isAuthenticated ? <Dashboard /> : <AuthChoice />}
```

### Event Handling
```jsx
const handleClick = () => {
  setState(newValue);
};

return <button onClick={handleClick}>Click</button>;
```

## 🌐 URLs

| Resource | URL |
|----------|-----|
| Vite Docs | https://vitejs.dev |
| React Docs | https://react.dev |
| Tailwind | https://tailwindcss.com |
| Render | https://render.com/docs |
| Lucide Icons | https://lucide.dev |

## ✅ Pre-Deployment Checklist

- [ ] `npm run build` succeeds
- [ ] dist/ folder created
- [ ] `npm run preview` works locally
- [ ] All views accessible
- [ ] No console errors
- [ ] Mobile layout works
- [ ] Animations smooth
- [ ] SEO tags present

## 📝 Git Commands

```bash
git status                  # Check changes
git add .                  # Stage all changes
git commit -m "message"    # Commit changes
git push                   # Push to GitHub
```

## 🔐 Security Checklist

- [ ] No API keys in code
- [ ] No secrets in environment
- [ ] No console.log() in production
- [ ] Input validation present
- [ ] HTTPS enforced (automatic on Render)
- [ ] CORS configured (backend)

---

**SyncVeil React Frontend - Quick Reference Card**  
*Keep this handy for common commands and workflows*
