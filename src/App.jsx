import React, { useState, useEffect } from 'react';
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
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated();
      if (authenticated) {
        const currentUser = getCurrentUser();
        setIsAuth(true);
        setUser(currentUser);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    // Update nav height CSS variable on mount and resize
    const updateNavHeight = () => {
      const nav = document.querySelector('nav#public-nav');
      if (!nav || nav.style.display === 'none') return;
      const h = nav.offsetHeight || 72;
      document.documentElement.style.setProperty('--nav-height', h + 'px');
    };

    window.addEventListener('load', updateNavHeight);
    window.addEventListener('resize', updateNavHeight);
    updateNavHeight();

    return () => {
      window.removeEventListener('load', updateNavHeight);
      window.removeEventListener('resize', updateNavHeight);
    };
  }, []);

  const switchView = (viewId) => {
    setCurrentView(viewId);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    // Reinitialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const form = e.target;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    try {
      btn.innerText = 'Authenticating...';
      btn.disabled = true;

      const response = await authAPI.login(email, password);
      
      setIsAuth(true);
      setUser(response.user);
      switchView('dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
      btn.innerText = originalText;
      btn.disabled = false;
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const form = e.target;
    const fullName = form.querySelector('input[type="text"]').value;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    try {
      btn.innerText = 'Creating Vault...';
      btn.disabled = true;

      const response = await authAPI.signup(email, password, fullName);
      
      // If email verification is required, show message
      if (response.requiresVerification) {
        setError('Account created! Please check your email to verify your account before logging in.');
        form.reset();
        setTimeout(() => switchView('home'), 3000);
      } else {
        // Auto-login if no verification required
        setIsAuth(true);
        setUser(response.user);
        switchView('dashboard');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Signup failed. Please try again.');
      btn.innerText = originalText;
      btn.disabled = false;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to log out?')) return;

    try {
      setLoading(true);
      await authAPI.logout();
      setIsAuth(false);
      setUser(null);
      switchView('home');
    } catch (err) {
      console.error('Logout error:', err);
      // Still log out locally even if backend call fails
      setIsAuth(false);
      setUser(null);
      switchView('home');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {(currentView === 'home' || currentView === 'auth-choice' || currentView === 'info') && (
        <Navigation 
          onSwitchView={switchView}
          isAuthenticated={isAuth}
        />
      )}

      <main id="main-content">
        {error && currentView === 'auth-choice' && (
          <div className="fixed top-4 right-4 bg-rose-50 border border-rose-200 text-rose-900 px-6 py-3 rounded-xl shadow-lg max-w-sm">
            <p className="text-sm font-medium">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-rose-600 hover:text-rose-700 text-xs mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {currentView === 'home' && (
          <Home 
            onSwitchView={switchView}
            onScrollToSection={(sectionId) => {
              setTimeout(() => {
                const el = document.getElementById(sectionId);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 0);
            }}
          />
        )}
        {currentView === 'auth-choice' && (
          <AuthChoice 
            onSwitchView={switchView}
            onLogin={handleLogin}
            onSignup={handleSignup}
            error={error}
          />
        )}
        {currentView === 'dashboard' && isAuth && (
          <Dashboard 
            onLogout={handleLogout}
            onSwitchView={switchView}
            user={user}
          />
        )}
        {currentView === 'info' && (
          <InfoPage onSwitchView={switchView} />
        )}
      </main>

      {!isAuth && (
        <Footer />
      )}
    </div>
  );
}

export default App;
