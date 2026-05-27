import React, { useState } from 'react';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { authAPI } from '../../api';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium',
  'Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt',
  'Ethiopia','Finland','France','Germany','Ghana','Greece','Hungary','India','Indonesia',
  'Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico',
  'Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines',
  'Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa',
  'South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Other',
];

const StrengthBar = ({ password }) => {
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const colors = ['', 'bg-rose-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= score ? colors[score] : 'bg-slate-200'}`} />)}
      </div>
      <p className={`text-xs font-medium ${score<=1?'text-rose-500':score===2?'text-amber-500':score===3?'text-yellow-600':'text-emerald-600'}`}>{labels[score]}</p>
    </div>
  );
};

export default function AuthChoice({ onAuth, onSwitchView }) {
  const [mode, setMode] = useState('login');   // login | signup | verify | challenge
  const [step, setStep] = useState(1);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Stored for post-verify auto-login
  const [savedEmail, setSavedEmail] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [challengeEmail, setChallengeEmail] = useState('');

  const [form, setForm] = useState({ email:'', password:'', full_name:'', phone:'', country:'', date_of_birth:'', otp_code:'' });
  const set = k => e => { setForm(p => ({...p, [k]: e.target.value})); setError(''); };

  const switchMode = m => { setMode(m); setStep(1); setError(''); setSuccessMsg(''); };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = async e => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.login(form.email, form.password);
      if (res.challengeRequired) {
        setChallengeEmail(res.email || form.email);
        setMode('challenge');
      } else if (res.success) {
        onAuth?.(res.user);
      }
    } catch (err) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  // ── LOGIN CHALLENGE ────────────────────────────────────────────────────────
  const handleChallenge = async e => {
    e.preventDefault();
    if (!form.otp_code) { setError('Enter the code sent to your email.'); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.verifyLoginChallenge(challengeEmail, form.otp_code);
      if (res.success) onAuth?.(res.user);
    } catch (err) { setError(err.message || 'Invalid code'); }
    finally { setLoading(false); }
  };

  // ── SIGNUP STEP 1 ──────────────────────────────────────────────────────────
  const handleStep1 = e => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Email and password are required.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(''); setStep(2);
  };

  // ── SIGNUP STEP 2 → SUBMIT ─────────────────────────────────────────────────
  const handleSignup = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await authAPI.signup(
        form.email, form.password,
        form.full_name || null, form.phone || null,
        form.country || null, form.date_of_birth || null,
      );

      if (res.requires_verification || res.requiresVerification) {
        // Email sent — show verify screen
        setSavedEmail(form.email);
        setSavedPassword(form.password);
        setMode('verify');
        setSuccessMsg(`Verification code sent to ${form.email}`);
      } else if (res.success || res.access_token) {
        // Auto-verified (email failed to send) — go straight to dashboard
        onAuth?.(res.user);
      } else {
        setError('Unexpected response from server. Please try signing in.');
      }
    } catch (err) {
      setError(err.message || 'Sign up failed');
      setStep(1);
    }
    finally { setLoading(false); }
  };

  // ── EMAIL VERIFY ───────────────────────────────────────────────────────────
  const handleVerify = async e => {
    e.preventDefault();
    if (!form.otp_code.trim()) { setError('Enter the verification code.'); return; }
    setLoading(true); setError('');
    try {
      // Step 1: verify the OTP
      await authAPI.verifyEmail(form.otp_code.trim());

      // Step 2: auto-login with saved credentials
      try {
        const loginRes = await authAPI.login(savedEmail, savedPassword);
        if (loginRes.challengeRequired) {
          // Rare: security challenge after verification
          setChallengeEmail(loginRes.email || savedEmail);
          setMode('challenge');
        } else if (loginRes.success) {
          onAuth?.(loginRes.user);
        }
      } catch (loginErr) {
        // Verification succeeded but auto-login failed — show success + ask to sign in
        setSuccessMsg('Email verified! Please sign in below.');
        switchMode('login');
        setForm(p => ({...p, email: savedEmail, password: '', otp_code: ''}));
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    const email = savedEmail || form.email;
    if (!email) return;
    try {
      await authAPI.resendVerification(email);
      setSuccessMsg('New code sent to your email.');
      setError('');
    } catch (err) { setError(err.message || 'Failed to resend'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <button onClick={() => onSwitchView?.('home')} className="flex items-center justify-center gap-2 mb-8 group w-full">
          <Shield size={28} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
          <span className="text-2xl font-bold text-white group-hover:text-slate-200">SyncVeil</span>
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Tabs — only for login/signup */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="flex border-b border-slate-100">
              {['login','signup'].map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`flex-1 py-4 text-sm font-semibold transition-colors capitalize ${mode===m?'text-indigo-600 border-b-2 border-indigo-600':'text-slate-500 hover:text-slate-700'}`}>
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>
          )}

          <div className="p-7">
            {/* Global success message */}
            {successMsg && (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm mb-4">
                <CheckCircle size={14} className="flex-shrink-0 mt-0.5 text-emerald-600" />{successMsg}
              </div>
            )}

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome back</h2>
                <p className="text-sm text-slate-500 mb-6">Sign in to your secure workspace</p>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
                    <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPass?'text':'password'} value={form.password} onChange={set('password')} autoComplete="current-password" placeholder="Your password" required
                        className="w-full px-4 py-3 pr-11 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <button type="button" onClick={() => setShowPass(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>
                  {error && <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm"><AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>{error}</div>}
                  <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>
              </>
            )}

            {/* ── CHALLENGE ── */}
            {mode === 'challenge' && (
              <>
                <div className="flex items-center gap-2 mb-1"><Shield size={18} className="text-indigo-600"/><h2 className="text-xl font-bold text-slate-900">Security Check</h2></div>
                <p className="text-sm text-slate-500 mb-6">A code was sent to <strong>{challengeEmail}</strong></p>
                <form onSubmit={handleChallenge} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Verification Code</label>
                    <input type="text" inputMode="numeric" value={form.otp_code} onChange={set('otp_code')} placeholder="000000" maxLength={6}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  {error && <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm"><AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>{error}</div>}
                  <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                    {loading ? 'Verifying…' : 'Verify & Sign In'}
                  </button>
                  <button type="button" onClick={() => switchMode('login')} className="w-full text-sm text-slate-500 hover:text-slate-700">← Back to login</button>
                </form>
              </>
            )}

            {/* ── SIGNUP STEP 1 ── */}
            {mode === 'signup' && step === 1 && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Create your account</h2>
                <p className="text-sm text-slate-500 mb-6">Step 1 of 2 — Credentials</p>
                <form onSubmit={handleStep1} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
                    <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPass?'text':'password'} value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="Min 8 characters" required minLength={8}
                        className="w-full px-4 py-3 pr-11 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <button type="button" onClick={() => setShowPass(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                    <StrengthBar password={form.password} />
                  </div>
                  {error && <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm"><AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>{error}</div>}
                  <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    Continue →
                  </button>
                </form>
              </>
            )}

            {/* ── SIGNUP STEP 2 ── */}
            {mode === 'signup' && step === 2 && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Tell us about yourself</h2>
                <p className="text-sm text-slate-500 mb-6">Step 2 of 2 — Profile <span className="text-slate-400">(all optional)</span></p>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                    <input type="text" value={form.full_name} onChange={set('full_name')} placeholder="Jane Doe"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
                    <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 234 567 8900"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Birth</label>
                    <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Country</label>
                    <div className="relative">
                      <select value={form.country} onChange={set('country')}
                        className="w-full px-4 py-3 pr-9 border border-slate-300 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">Select your country</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  {error && <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm"><AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>{error}</div>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">← Back</button>
                    <button type="submit" disabled={loading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                      {loading ? 'Creating…' : 'Create Account'}
                    </button>
                  </div>
                  <p className="text-xs text-center text-slate-400">You can update these later in Account Settings</p>
                </form>
              </>
            )}

            {/* ── EMAIL VERIFICATION ── */}
            {mode === 'verify' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={28} className="text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-1">Check your email</h2>
                  <p className="text-sm text-slate-500">
                    We sent a 6-digit code to<br />
                    <strong className="text-slate-700">{savedEmail}</strong>
                  </p>
                </div>
                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Verification Code</label>
                    <input type="text" inputMode="numeric" value={form.otp_code} onChange={set('otp_code')}
                      placeholder="000000" maxLength={6}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm text-center tracking-widest font-mono text-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  {error && <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm"><AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>{error}</div>}
                  <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                    {loading ? 'Verifying…' : 'Verify & Sign In'}
                  </button>
                  <button type="button" onClick={handleResend} className="w-full text-sm text-indigo-600 hover:underline">
                    Didn't get it? Resend code
                  </button>
                  <button type="button" onClick={() => switchMode('login')} className="w-full text-sm text-slate-400 hover:text-slate-600">
                    ← Back to sign in
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Protected by AES-256 encryption · {new Date().getFullYear()} SyncVeil
        </p>
      </div>
    </div>
  );
}
