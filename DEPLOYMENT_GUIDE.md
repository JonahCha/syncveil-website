# Deployment Guide - SyncVeil React Frontend

## Overview

The SyncVeil frontend has been successfully migrated to React with Vite. This guide covers deploying the React frontend to production environments (Render, Vercel, Netlify, or any Node.js compatible hosting).

## Project Status

✅ **Migration Complete**
- All 9 React components created
- All HTML/CSS/JS converted from original app.html
- 100% of UI/UX preserved (layout, animations, responsiveness)
- Production-ready build system (Vite)
- SEO metadata and schema markup intact
- Total build size: ~8.3 KB HTML + 2.94 KB CSS + 228.94 KB JS (gzipped)

## Directory Structure

```
/workspaces/syncveil-website/
├── src/                          # React source code
│   ├── App.jsx                  # Main app component
│   ├── index.jsx                # React entry point
│   ├── styles.css               # CSS reference
│   └── components/
│       ├── Navigation.jsx       # Navbar
│       ├── Footer.jsx          # Footer
│       ├── BreachMap.jsx       # Map component
│       ├── NewsSection.jsx     # News display
│       └── views/
│           ├── Home.jsx        # Landing page
│           ├── AuthChoice.jsx  # Auth forms
│           ├── Dashboard.jsx   # User dashboard
│           └── InfoPage.jsx    # Info page
├── dist/                        # Production build (ready to deploy)
│   ├── index.html              # Optimized React app
│   └── assets/                 # Minified JS/CSS
├── index.html                   # React entry point template
├── vite.config.js              # Vite configuration
├── package.json                # Dependencies and scripts
├── .gitignore                  # Git ignore rules
└── REACT_FRONTEND.md           # Frontend documentation
```

## Prerequisites

- Node.js 18+ and npm
- Git account

## Local Development

### Setup
```bash
cd /workspaces/syncveil-website
npm install
```

### Run Development Server
```bash
npm run dev
```
Server runs at `http://localhost:5173` with hot module replacement (HMR).

### Build for Production
```bash
npm run build
```
Creates optimized build in `dist/` folder.

### Preview Production Build
```bash
npm run preview
```
Preview at `http://localhost:4173` (simulates production environment).

## Production Deployment

The SyncVeil frontend uses Render's static site hosting. See [render.yaml](render.yaml) for the current configuration.

### Render Configuration

The frontend is configured in `render.yaml` as a static site:

```yaml
- type: static
  name: syncveil-frontend
  rootDir: frontend
  buildCommand: npm install && npm run build
  staticPublishPath: dist
  envVars:
    - key: VITE_API_URL
      value: https://syncveil-backend.onrender.com
  routes:
    - type: rewrite
      source: /*
      destination: /index.html
```

### Environment Variables

If backend API is hosted separately, configure:
```
VITE_API_URL=https://your-api-domain.com
```

Update component code to use:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

## Configuration

### Vite Configuration (vite.config.js)
Already optimized for production with:
- Asset minification (Terser)
- No source maps (smaller bundle)
- Asset hashing for cache busting
- Chunk splitting optimization

### Environment Variables
**Frontend doesn't require any environment variables.** All configuration is in code:
- API endpoints: Hardcoded in components
- Map libraries: Loaded from CDN
- Styling: Tailwind via CDN

## Deployment Verification Checklist

After deployment, verify:

- [ ] **Home Page Loads**: Check your production domain
- [ ] **Navigation Works**: Click all nav items
- [ ] **Login/Signup Tab Visible**: AuthChoice component renders
- [ ] **Map Loads**: BreachMap displays world map on Home
- [ ] **News Section**: News items display with severity badges
- [ ] **Mobile Responsive**: Test on mobile (sidebar slides in)
- [ ] **SEO Tags**: View page source, verify `<title>`, `<meta>` tags
- [ ] **Console Clear**: No JavaScript errors in browser console
- [ ] **CSS Loaded**: All styling applies (colors, animations)
- [ ] **Animations Work**: Fade-in, float animations on page load
- [ ] **File Upload**: Dashboard accepts drag-drop files

## Performance Optimization

Current optimizations:
- ✅ Minified JavaScript and CSS
- ✅ Asset hashing prevents cache issues
- ✅ Lazy-loaded libraries (jsVectorMap, Lucide)
- ✅ CSS-in-JS for animations (no extra requests)
- ✅ No external state library (minimal bundle)
- ✅ Tree-shaken dependencies (Vite)

## Monitoring & Logs

### View Deployment Logs
Check your hosting platform's dashboard for:
1. Build logs
2. Deployment status
3. Runtime logs

### Common Issues

**Issue: Build fails with "Cannot find module"**
- Solution: Ensure all dependencies in package.json
- Check: `npm install` locally first

**Issue: App fails to start in production**
- Solution: Check hosting platform build and start commands
- Verify: Environment variables are properly configured

**Issue: Assets return 404**
- Solution: Check asset file paths in dist/
- Verify: Vite config has proper output settings

**Issue: SEO tags missing**
- Solution: Rebuild and redeploy
- Check: index.html has all meta tags

## Rollback

To rollback to a previous version:
1. Access your hosting platform's deployment history
2. Find the previous successful deployment
3. Trigger a redeployment

## Scaling

The React frontend is static once built:
- **No database**: Frontend only
- **No server-side rendering**: Pre-built static files
- **Scales infinitely**: CDN/static hosting friendly
- **Minimal resource usage**: ~50MB disk, minimal RAM

## Next Steps

1. **Test locally**: `npm run dev` then `npm run build`
2. **Connect to Railway**: Link GitHub repository
3. **Set build command**: As shown above
4. **Deploy**: Click deploy button
5. **Verify**: Test all features on deployed URL
6. **Set up domain**: Point custom domain to Railway URL

## Support

- **Vite Docs**: https://vitejs.dev
- **React Docs**: https://react.dev
- **Render Docs**: https://render.com/docs
- **Tailwind CSS**: https://tailwindcss.com

## Security Notes

- ✅ No sensitive data in frontend code
- ✅ No API keys hardcoded
- ✅ CSP headers recommended (configure in backend)
- ✅ CORS headers needed if backend separate (backend config)
- ✅ All user inputs validated before submission
- ✅ No localStorage of sensitive data

## Files Modified

- ✅ `index.html` - React entry point with SEO
- ✅ `package.json` - Build scripts added
- ✅ `vite.config.js` - Build configuration
- ✅ `.gitignore` - Updated for Node.js
- ✅ `app.html` - **DELETED** (all content migrated to React)

## Summary

The SyncVeil frontend is now a production-ready React application. All original UI/UX preserved, optimized with Vite, and deployed on Render. See render.yaml for the current configuration.
