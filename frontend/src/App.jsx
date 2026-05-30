import React, { useEffect, useState } from 'react';
import Navigation from './components/Navigation';
import Home from './components/views/Home';
import Dashboard from './components/views/Dashboard';
import AuthChoice from './components/views/AuthChoice';
import InfoPage from './components/views/InfoPage';
import Footer from './components/Footer';
import { authAPI, isAuthenticated, getCurrentUser, publicAPI } from './api';
import './styles.css';

// ── OAuth Callback Screen ──────────────────────────────────────────────────
function OAuthCallbackScreen({ status, onRetry }) {
  const providerLabel = status?.provider
    ? status.provider.charAt(0).toUpperCase() + status.provider.slice(1)
    : 'Provider';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-sm text-center">
        {status?.status === 'loading' && (
          <>
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Connecting {providerLabel}…</h2>
            <p className="text-sm text-slate-500">Please wait while we link your account.</p>
          </>
        )}
        {status?.status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{providerLabel} Connected!</h2>
            <p className="text-sm text-slate-500">{status.message}</p>
            <p className="text-xs text-slate-400 mt-3">Returning to dashboard…</p>
          </>
        )}
        {status?.status === 'error' && (
          <>
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Failed</h2>
            <p className="text-sm text-rose-600 mb-5">{status.message}</p>
            <button
              onClick={onRetry}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyToken, setVerifyToken] = useState(null);
  // OAuth callback state: null | { provider, status: 'loading'|'success'|'error', message }
  const [oauthStatus, setOAuthStatus] = useState(null);

  // Check existing session on mount
  useEffect(() => {
    const authenticated = isAuthenticated();
    if (authenticated) {
      setIsAuth(true);
      setUser(getCurrentUser());
    }
    setLoading(false);
  }, []);

  // Handle /verify-email?token=... deep links from email
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const token = new URLSearchParams(window.location.search).get('token');
    if (path !== '/verify-email' || !token) return;

    setVerifyToken(token);
    setCurrentView('auth-choice');
    if (window.history?.replaceState) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Handle /oauth/google/callback and /oauth/microsoft/callback redirects
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    const match = path.match(/^\/oauth\/(google|microsoft)\/callback$/);
    if (!match) return;

    const provider = match[1];
    const params   = new URLSearchParams(window.location.search);
    const code     = params.get('code');
    const state    = params.get('state');

    // Clean URL immediately so a refresh doesn't re-trigger
    if (window.history?.replaceState) window.history.replaceState({}, '', '/');

    if (!code || !state) {
      // Bad redirect — just go back to wherever makes sense
      setCurrentView(isAuthenticated() ? 'dashboard' : 'home');
      return;
    }

    setOAuthStatus({ provider, status: 'loading' });
    setCurrentView('oauth-callback');

    publicAPI.completeOAuth(provider, code, state)
      .then(() => {
        setOAuthStatus({ provider, status: 'success',
          message: `Your ${provider.charAt(0).toUpperCase() + provider.slice(1)} account was connected successfully.` });
        // After 2s auto-navigate to dashboard (user is already authenticated)
        setTimeout(() => {
          setOAuthStatus(null);
          setCurrentView(isAuthenticated() ? 'dashboard' : 'home');
        }, 2000);
      })
      .catch(err => {
        setOAuthStatus({ provider, status: 'error',
          message: err.message || `Failed to connect ${provider} account.` });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Nav height CSS var
  useEffect(() => {
    const update = () => {
      const nav = document.querySelector('nav#public-nav');
      if (!nav || nav.style.display === 'none') return;
      document.documentElement.style.setProperty('--nav-height', `${nav.offsetHeight || 72}px`);
    };
    window.addEventListener('load', update);
    window.addEventListener('resize', update);
    update();
    return () => { window.removeEventListener('load', update); window.removeEventListener('resize', update); };
  }, []);

  const switchView = (viewId) => {
    setCurrentView(viewId);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Called by AuthChoice when auth completes successfully
  const handleAuth = (authUser) => {
    setIsAuth(true);
    setUser(authUser);
    switchView('dashboard');
  };

  const handleLogout = async (allDevices = false) => {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
      await authAPI.logout(allDevices);
    } catch { /* ignore */ } finally {
      setIsAuth(false);
      setUser(null);
      switchView('home');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {(currentView === 'home' || currentView === 'auth-choice' || currentView === 'info') && (
        <Navigation onSwitchView={switchView} isAuthenticated={isAuth} />
      )}

      <main id="main-content">
        {currentView === 'home' && (
          <Home
            onSwitchView={switchView}
            onScrollToSection={(id) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 0)}
          />
        )}

        {currentView === 'auth-choice' && (
          <AuthChoice
            onSwitchView={switchView}
            onAuth={handleAuth}
            initialMode={verifyToken ? 'verify' : undefined}
            initialToken={verifyToken || undefined}
          />
        )}

        {currentView === 'dashboard' && isAuth && (
          <Dashboard
            onLogout={handleLogout}
            onSwitchView={switchView}
            user={user}
          />
        )}

        {currentView === 'info' && <InfoPage onSwitchView={switchView} />}

        {currentView === 'oauth-callback' && (
          <OAuthCallbackScreen
            status={oauthStatus}
            onRetry={() => { setOAuthStatus(null); setCurrentView(isAuthenticated() ? 'dashboard' : 'home'); }}
          />
        )}
      </main>

      {!isAuth && <Footer />}
    </div>
  );
}

export default App;
