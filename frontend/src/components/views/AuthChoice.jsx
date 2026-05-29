import React, { useState } from 'react';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle, ChevronDown, ArrowLeft } from 'lucide-react';
import { authAPI } from '../../api';

const COUNTRIES = ['Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium','Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Other'];

const StrengthBar = ({ password }) => {
  const score = [password.length>=8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const colors = ['','bg-rose-500','bg-amber-500','bg-yellow-500','bg-emerald-500'];
  const labels = ['','Weak','Fair','Good','Strong'];
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">{[1,2,3,4].map(i=><div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i<=score?colors[score]:'bg-slate-200'}`}/>)}</div>
      <p className={`text-xs font-medium ${score<=1?'text-rose-500':score===2?'text-amber-500':score===3?'text-yellow-600':'text-emerald-600'}`}>{labels[score]}</p>
    </div>
  );
};

const Input = ({ label, children }) => (
  <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>{children}</div>
);
const inputCls = "w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const OtpInput = (props) => <input type="text" inputMode="numeric" maxLength={6} {...props} className={`w-full px-4 py-4 border border-slate-300 rounded-xl text-2xl text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className||''}`}/>;
const Err = ({ msg }) => msg ? <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm"><AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>{msg}</div> : null;
const Suc = ({ msg }) => msg ? <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm"><CheckCircle size={14} className="flex-shrink-0 mt-0.5 text-emerald-600"/>{msg}</div> : null;
const Btn = ({ children, loading, loadText, ...p }) => <button disabled={loading} {...p} className={`w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 ${p.className||''}`}>{loading ? loadText||'Please wait…' : children}</button>;

// MODES: login | otp | signup1 | signup2 | verify | forgot | reset
export default function AuthChoice({ onAuth, onSwitchView }) {
  const [mode, setMode]   = useState('login');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');
  const [suc, setSuc]     = useState('');
  const [savedEmail, setSavedEmail]     = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [form, setForm]   = useState({ email:'', password:'', full_name:'', phone:'', country:'', date_of_birth:'', otp:'' });

  const setF = k => e => { setForm(p=>({...p,[k]:e.target.value})); setErr(''); };
  const go   = m => { setMode(m); setErr(''); setSuc(''); setForm(p=>({...p,otp:''})); };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = async e => {
    e.preventDefault();
    if (!form.email||!form.password){setErr('Fill in all fields.');return;}
    setLoading(true); setErr('');
    try {
      const res = await authAPI.login(form.email, form.password);
      if (res.challengeRequired) {
        setSavedEmail(form.email);
        setSuc(res.challenge_token ? `Dev code: ${res.challenge_token}` : 'Sign-in code sent to your email.');
        go('otp');
      }
    } catch(e){ setErr(e.message||'Login failed'); }
    finally { setLoading(false); }
  };

  // ── OTP (always required after login) ─────────────────────────────────────
  const handleOtp = async e => {
    e.preventDefault();
    if (!form.otp.trim()){setErr('Enter the code from your email.');return;}
    setLoading(true); setErr('');
    try {
      const res = await authAPI.verifyLoginChallenge(savedEmail||form.email, form.otp);
      if (res.success) onAuth?.(res.user);
    } catch(e){ setErr(e.message||'Invalid code'); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    try {
      await authAPI.login(savedEmail||form.email, savedPassword);
      setSuc('New code sent.');
    } catch { setSuc('Code resent.'); }
  };

  // ── SIGNUP ─────────────────────────────────────────────────────────────────
  const handleSignup1 = e => {
    e.preventDefault();
    if (!form.email||!form.password){setErr('Email and password required.');return;}
    if (form.password.length<8){setErr('Password must be at least 8 characters.');return;}
    setErr(''); go('signup2');
  };

  const handleSignup2 = async e => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const res = await authAPI.signup(form.email,form.password,form.full_name||null,form.phone||null,form.country||null,form.date_of_birth||null);
      if (res.requires_verification) {
        setSavedEmail(form.email); setSavedPassword(form.password);
        setSuc(`Verification code sent to ${form.email}.`);
        go('verify');
      } else if (res.success || res.access_token) {
        onAuth?.(res.user);
      } else {
        setErr('Unexpected response. Please try signing in.');
      }
    } catch(e){ setErr(e.message||'Signup failed'); go('signup1'); }
    finally { setLoading(false); }
  };

  // ── EMAIL VERIFY ───────────────────────────────────────────────────────────
  const handleVerify = async e => {
    e.preventDefault();
    if (!form.otp.trim()){setErr('Enter your verification code.');return;}
    setLoading(true); setErr('');
    try {
      await authAPI.verifyEmail(form.otp.trim());
      // Auto-login after verify — backend will send OTP again
      const login = await authAPI.login(savedEmail, savedPassword).catch(()=>null);
      if (login?.challengeRequired) {
        setSavedEmail(savedEmail); setSuc('Email verified! Sign-in code sent.'); go('otp');
      } else {
        setSuc('Email verified! Please sign in.'); go('login');
      }
    } catch(e){ setErr(e.message||'Verification failed'); }
    finally { setLoading(false); }
  };

  const handleResendVerify = async () => {
    try { await authAPI.resendVerification(savedEmail||form.email); setSuc('New code sent.'); } catch(e){ setErr(e.message); }
  };

  // ── FORGOT PASSWORD ────────────────────────────────────────────────────────
  const handleForgot = async e => {
    e.preventDefault();
    if (!form.email){setErr('Enter your email.');return;}
    setLoading(true); setErr('');
    try {
      const res = await authAPI.forgotPassword(form.email);
      setSavedEmail(form.email);
      setSuc(res.dev_token ? `Dev code: ${res.dev_token}` : 'Reset code sent to your email.');
      go('reset');
    } catch(e){ setErr(e.message||'Failed to send reset code'); }
    finally { setLoading(false); }
  };

  // ── RESET PASSWORD ─────────────────────────────────────────────────────────
  const handleReset = async e => {
    e.preventDefault();
    if (!form.otp||!form.password){setErr('Enter the code and new password.');return;}
    if (form.password.length<8){setErr('Password must be at least 8 characters.');return;}
    setLoading(true); setErr('');
    try {
      await authAPI.resetPassword(savedEmail||form.email, form.otp, form.password);
      setSuc('Password reset! Please sign in.'); go('login');
    } catch(e){ setErr(e.message||'Reset failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <button onClick={()=>onSwitchView?.('home')} className="flex items-center justify-center gap-2 mb-8 group w-full">
          <Shield size={28} className="text-indigo-400 group-hover:text-indigo-300 transition-colors"/>
          <span className="text-2xl font-bold text-white">SyncVeil</span>
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          {(mode==='login'||mode==='signup1'||mode==='signup2') && (
            <div className="flex border-b border-slate-100">
              {[['login','Sign In'],['signup1','Create Account']].map(([m,label])=>(
                <button key={m} onClick={()=>go(m)} className={`flex-1 py-4 text-sm font-semibold transition-colors ${(mode===m||(m==='signup1'&&mode==='signup2'))?'text-indigo-600 border-b-2 border-indigo-600':'text-slate-500 hover:text-slate-700'}`}>{label}</button>
              ))}
            </div>
          )}

          <div className="p-7 space-y-4">
            <Suc msg={suc}/>

            {/* ── LOGIN ── */}
            {mode==='login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
                  <p className="text-sm text-slate-500 mt-1">Every login requires a one-time code for your security.</p>
                </div>
                <Input label="Email Address"><input type="email" value={form.email} onChange={setF('email')} autoComplete="email" placeholder="you@example.com" required className={inputCls}/></Input>
                <Input label="Password">
                  <div className="relative">
                    <input type={showPw?'text':'password'} value={form.password} onChange={setF('password')} autoComplete="current-password" placeholder="Your password" required className={`${inputCls} pr-11`}/>
                    <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                  </div>
                </Input>
                <Err msg={err}/>
                <Btn loading={loading} loadText="Sending code…">Send Sign-In Code →</Btn>
                <button type="button" onClick={()=>{setSavedEmail(form.email);go('forgot');}} className="w-full text-sm text-indigo-600 hover:underline text-center">Forgot password?</button>
              </form>
            )}

            {/* ── OTP ── */}
            {mode==='otp' && (
              <form onSubmit={handleOtp} className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3"><Shield size={24} className="text-indigo-600"/></div>
                  <h2 className="text-xl font-bold text-slate-900">Enter sign-in code</h2>
                  <p className="text-sm text-slate-500 mt-1">Sent to <strong>{savedEmail||form.email}</strong></p>
                </div>
                <OtpInput value={form.otp} onChange={setF('otp')} placeholder="000000" autoFocus/>
                <Err msg={err}/>
                <Btn loading={loading} loadText="Verifying…">Verify & Sign In</Btn>
                <div className="flex gap-3 text-sm text-center">
                  <button type="button" onClick={handleResendOtp} className="flex-1 text-indigo-600 hover:underline">Resend code</button>
                  <button type="button" onClick={()=>go('login')} className="flex-1 text-slate-400 hover:text-slate-600">← Back</button>
                </div>
              </form>
            )}

            {/* ── SIGNUP 1 ── */}
            {mode==='signup1' && (
              <form onSubmit={handleSignup1} className="space-y-4">
                <div><h2 className="text-xl font-bold text-slate-900">Create your account</h2><p className="text-sm text-slate-500 mt-1">Step 1 of 2 — Credentials</p></div>
                <Input label="Email Address"><input type="email" value={form.email} onChange={setF('email')} autoComplete="email" placeholder="you@example.com" required className={inputCls}/></Input>
                <Input label="Password">
                  <div className="relative">
                    <input type={showPw?'text':'password'} value={form.password} onChange={setF('password')} autoComplete="new-password" placeholder="Min 8 characters" required minLength={8} className={`${inputCls} pr-11`}/>
                    <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                  </div>
                  <StrengthBar password={form.password}/>
                </Input>
                <Err msg={err}/>
                <Btn>Continue →</Btn>
              </form>
            )}

            {/* ── SIGNUP 2 ── */}
            {mode==='signup2' && (
              <form onSubmit={handleSignup2} className="space-y-4">
                <div>
                  <button type="button" onClick={()=>go('signup1')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"><ArrowLeft size={14}/>Back</button>
                  <h2 className="text-xl font-bold text-slate-900">Tell us about yourself</h2>
                  <p className="text-sm text-slate-500 mt-1">Step 2 of 2 — Profile <span className="text-slate-400">(all optional)</span></p>
                </div>
                <Input label="Full Name"><input type="text" value={form.full_name} onChange={setF('full_name')} placeholder="Jane Doe" className={inputCls}/></Input>
                <Input label="Phone Number"><input type="tel" value={form.phone} onChange={setF('phone')} placeholder="+1 234 567 8900" className={inputCls}/></Input>
                <Input label="Date of Birth"><input type="date" value={form.date_of_birth} onChange={setF('date_of_birth')} className={inputCls}/></Input>
                <Input label="Country">
                  <div className="relative">
                    <select value={form.country} onChange={setF('country')} className={`${inputCls} pr-9 appearance-none`}>
                      <option value="">Select country</option>
                      {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                  </div>
                </Input>
                <Err msg={err}/>
                <Btn loading={loading} loadText="Creating…">Create Account</Btn>
                <p className="text-xs text-center text-slate-400">Profile details can be updated anytime in Settings</p>
              </form>
            )}

            {/* ── EMAIL VERIFY ── */}
            {mode==='verify' && (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle size={24} className="text-emerald-600"/></div>
                  <h2 className="text-xl font-bold text-slate-900">Verify your email</h2>
                  <p className="text-sm text-slate-500 mt-1">6-digit code sent to <strong>{savedEmail}</strong></p>
                </div>
                <OtpInput value={form.otp} onChange={setF('otp')} placeholder="000000" autoFocus/>
                <Err msg={err}/>
                <Btn loading={loading} loadText="Verifying…">Verify Email</Btn>
                <button type="button" onClick={handleResendVerify} className="w-full text-sm text-indigo-600 hover:underline">Resend code</button>
              </form>
            )}

            {/* ── FORGOT PASSWORD ── */}
            {mode==='forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <button type="button" onClick={()=>go('login')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"><ArrowLeft size={14}/>Back to sign in</button>
                  <h2 className="text-xl font-bold text-slate-900">Reset your password</h2>
                  <p className="text-sm text-slate-500 mt-1">We'll send a reset code to your email.</p>
                </div>
                <Input label="Email Address"><input type="email" value={form.email} onChange={setF('email')} placeholder="you@example.com" required className={inputCls}/></Input>
                <Err msg={err}/>
                <Btn loading={loading} loadText="Sending…">Send Reset Code</Btn>
              </form>
            )}

            {/* ── RESET PASSWORD ── */}
            {mode==='reset' && (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Enter reset code</h2>
                  <p className="text-sm text-slate-500 mt-1">Sent to <strong>{savedEmail||form.email}</strong></p>
                </div>
                <OtpInput value={form.otp} onChange={setF('otp')} placeholder="000000" autoFocus/>
                <Input label="New Password">
                  <div className="relative">
                    <input type={showPw?'text':'password'} value={form.password} onChange={setF('password')} placeholder="New password (min 8 chars)" required minLength={8} className={`${inputCls} pr-11`}/>
                    <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                  </div>
                  <StrengthBar password={form.password}/>
                </Input>
                <Err msg={err}/>
                <Btn loading={loading} loadText="Resetting…">Reset Password</Btn>
                <button type="button" onClick={()=>go('forgot')} className="w-full text-sm text-slate-400 hover:text-slate-600">← Resend reset code</button>
              </form>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">Protected by AES-256 encryption · {new Date().getFullYear()} SyncVeil</p>
      </div>
    </div>
  );
}
