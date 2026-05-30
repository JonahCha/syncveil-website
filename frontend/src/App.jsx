import React, { useEffect, useState } from 'react';
import Navigation from './components/Navigation';
import Home from './components/views/Home';
import Dashboard from './components/views/Dashboard';
import AuthChoice from './components/views/AuthChoice';
import InfoPage from './components/views/InfoPage';
import Footer from './components/Footer';
import { authAPI, isAuthenticated, getCurrentUser } from './api';
import './styles.css';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyToken, setVerifyToken] = useState(null);

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
      </main>

      {!isAuth && <Footer />}
    </div>
  );
}

export default App;
