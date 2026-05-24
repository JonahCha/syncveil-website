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
  const [error, setError] = useState(null);
  const [verificationEmail, setVerificationEmail] = useState(null);
  const [verificationToken, setVerificationToken] = useState(null);

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
    // Handle email verification links such as /verify-email?token=123456
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const token = new URLSearchParams(window.location.search).get('token');

    if (path !== '/verify-email' || !token) return;

    setCurrentView('auth-choice');

    (async () => {
      setLoading(true);
      setError(null);
      try {
        await authAPI.verifyEmail(token);
        setError('Email verified successfully. You can sign in now.');
      } catch (err) {
        setError(err.message || 'Email verification failed. Please try again.');
      } finally {
        setVerificationEmail(null);
        setVerificationToken(null);
        setLoading(false);
        if (window.history?.replaceState) {
          window.history.replaceState({}, '', '/');
        }
      }
    })();
  }, []);

  useEffect(() => {
    const updateNavHeight = () => {
      const nav = document.querySelector('nav#public-nav');
      if (!nav || nav.style.display === 'none') return;
      const h = nav.offsetHeight || 72;
      document.documentElement.style.setProperty('--nav-height', `${h}px`);
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
      setVerificationEmail(null);
      setVerificationToken(null);
      setIsAuth(true);
      setUser(response.user);
      switchView('dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      btn.innerText = originalText;
      btn.disabled = false;
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.target;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    try {
      btn.innerText = 'Creating Vault...';
      btn.disabled = true;

      const response = await authAPI.signup(email, password);

      if (response.requiresVerification) {
        setVerificationEmail(email.toLowerCase().trim());
        setVerificationToken(response.verificationToken || null);
        setError('Account created. Enter the verification code sent to your email.');
        return;
      }

      setVerificationEmail(null);
      setVerificationToken(null);
      setIsAuth(true);
      setUser(response.user);
      switchView('dashboard');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      btn.innerText = originalText;
      btn.disabled = false;
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (code) => {
    setLoading(true);
    setError(null);

    try {
      await authAPI.verifyEmail(code);
      setVerificationEmail(null);
      setVerificationToken(null);
      setError('Email verified successfully. You can sign in now.');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationEmail) return;

    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.resendVerification(verificationEmail);
      if (response.already_verified) {
        setVerificationEmail(null);
        setVerificationToken(null);
        setError('This email is already verified. You can sign in now.');
        return;
      }

      if (response.verification_token) {
        setVerificationToken(response.verification_token);
      }

      setError('Verification code sent. Check your email.');
    } catch (err) {
      console.error('Resend verification error:', err);
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelVerification = () => {
    setVerificationEmail(null);
    setVerificationToken(null);
    setError(null);
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
          <div className="fixed top-4 right-4 bg-rose-50 border border-rose-200 text-rose-900 px-6 py-3 rounded-xl shadow-lg max-w-sm z-50">
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
            onVerifyEmail={handleVerifyEmail}
            onResendVerification={handleResendVerification}
            onCancelVerification={handleCancelVerification}
            verificationEmail={verificationEmail}
            verificationToken={verificationToken}
            loading={loading}
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

      {!isAuth && <Footer />}
    </div>
  );
}

export default App;
