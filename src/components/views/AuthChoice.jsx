import React, { useState } from 'react';

export default function AuthChoice({ onSwitchView, onLogin, onSignup, error }) {
  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      alert('Please fill in all fields');
      return;
    }
    // Create a synthetic form event with the data
    const form = e.target;
    onLogin(e);
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    if (!signupName || !signupEmail || !signupPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (!agreeTerms) {
      alert('Please agree to the Terms of Service');
      return;
    }
    onSignup(e);
  };

  return (
    <div id="view-auth-choice" className="view-section active view-center">
      <div className="max-w-md w-full">
        <button 
          onClick={() => onSwitchView('home')}
          className="mb-8 text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-sm text-rose-900 font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Login Tab */}
          {showLogin && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 animate-fade-in-up">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Sign In</h2>
              
              <input
                type="email"
                placeholder="Email address"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              />
              
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              />

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign In
              </button>

              <p className="text-center text-slate-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(false);
                    setLoginEmail('');
                    setLoginPassword('');
                  }}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* Signup Tab */}
          {!showLogin && (
            <form onSubmit={handleSignupSubmit} className="space-y-4 animate-fade-in-up">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Create Account</h2>
              
              <input
                type="text"
                placeholder="Full name"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              />
              
              <input
                type="email"
                placeholder="Email address"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              />
              
              <input
                type="password"
                placeholder="Create password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              />

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input 
                  type="checkbox" 
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded" 
                  required
                />
                I agree to the Terms of Service
              </label>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Account
              </button>

              <p className="text-center text-slate-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(true);
                    setSignupName('');
                    setSignupEmail('');
                    setSignupPassword('');
                    setAgreeTerms(false);
                  }}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
