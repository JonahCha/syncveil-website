import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle, Eye, Lock, LogOut, Mail,
  Menu, RefreshCw, Settings, Shield, Upload, User, X,
  Wifi, Globe, Clock, Activity, Link, Smartphone,
} from 'lucide-react';
import { dashboardAPI } from '../../api';

const fmt = (bytes) => {
  if (!bytes) return '0 B';
  const s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), s.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${s[i]}`;
};

const timeAgo = (iso) => {
  if (!iso) return 'never';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const riskColor = {
  low: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  high: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  critical: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
};

const severityBadge = {
  critical: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium',
  'Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt',
  'Ethiopia','Finland','France','Germany','Ghana','Greece','Hungary','India','Indonesia',
  'Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico',
  'Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines',
  'Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa','South Korea',
  'Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Vietnam','Other',
];

// ─── Security Score Ring ──────────────────────────────────────────────────────
function ScoreRing({ score = 0 }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : pct >= 40 ? '#f97316' : '#ef4444';
  const label = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Fair' : 'At Risk';

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="70" y="65" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#1e293b">{pct}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="11" fill="#64748b">/100</text>
      </svg>
      <p className="text-sm font-semibold mt-1" style={{ color }}>{label}</p>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon: Icon, color = 'indigo' }) {
  const colors = {
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-900 text-indigo-600',
    teal:   'from-teal-50 to-teal-100 border-teal-200 text-teal-900 text-teal-600',
    rose:   'from-rose-50 to-rose-100 border-rose-200 text-rose-900 text-rose-600',
    amber:  'from-amber-50 to-amber-100 border-amber-200 text-amber-900 text-amber-600',
  };
  const [grad, bord, txt, icon] = colors[color].split(' ');

  return (
    <div className={`p-6 bg-gradient-to-br ${grad} ${colors[color].split(' ').slice(1, 2)[0]} rounded-2xl border ${bord}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-sm font-semibold ${txt}`}>{title}</p>
        <Icon size={20} className={icon} />
      </div>
      <p className={`text-3xl font-bold ${txt}`}>{value}</p>
      <p className={`text-xs mt-1 opacity-70 ${txt}`}>{subtitle}</p>
    </div>
  );
}

// ─── Provider Logo ────────────────────────────────────────────────────────────
function ProviderLogo({ provider }) {
  if (provider === 'google') return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
  if (provider === 'apple') return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.42.07 2.38.74 3.2.8 1.21-.24 2.38-.93 3.65-.84 1.55.12 2.72.72 3.47 1.84-3.19 1.88-2.44 6.02.77 7.17-.57 1.46-1.32 2.9-3.09 3.91zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
  if (provider === 'microsoft') return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#f25022"/>
      <path d="M24 11.4H12.6V0H24v11.4z" fill="#7fba00"/>
      <path d="M11.4 24H0V12.6h11.4V24z" fill="#00a4ef"/>
      <path d="M24 24H12.6V12.6H24V24z" fill="#ffb900"/>
    </svg>
  );
  return <Globe size={20} />;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ onLogout, onSwitchView, user: propUser }) {
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [security, setSecurity] = useState(null);
  const [events, setEvents] = useState([]);
  const [breaches, setBreaches] = useState(null);
  const [vaultFiles, setVaultFiles] = useState([]);
  const [emailSecurity, setEmailSecurity] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState(null);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', country: '', date_of_birth: '' });
  const fileInputRef = useRef(null);

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [dashRes, secRes, evtRes, breachRes, vaultRes, emailRes, profileRes] = await Promise.allSettled([
        dashboardAPI.getDashboardData(),
        dashboardAPI.getSecurityOverview(),
        dashboardAPI.getSecurityEvents(25),
        dashboardAPI.getBreachData(),
        dashboardAPI.getVaultFiles(),
        dashboardAPI.getEmailSecurity(),
        dashboardAPI.getProfile(),
      ]);

      if (dashRes.status === 'fulfilled') setDashData(dashRes.value?.data || dashRes.value);
      if (secRes.status === 'fulfilled') setSecurity(secRes.value?.data || secRes.value);
      if (evtRes.status === 'fulfilled') setEvents(evtRes.value?.data?.events || []);
      if (breachRes.status === 'fulfilled') setBreaches(breachRes.value?.breaches || breachRes.value);
      if (vaultRes.status === 'fulfilled') {
        setVaultFiles((vaultRes.value?.files || []).map(f => ({ ...f, progress: 100, status: 'secured' })));
      }
      if (emailRes.status === 'fulfilled') setEmailSecurity(emailRes.value);
      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value;
        setProfile(p);
        setProfileForm({
          full_name: p.full_name || '',
          phone: p.phone || '',
          country: p.country || '',
          date_of_birth: p.date_of_birth || '',
        });
        setConnectedAccounts(p.connected_accounts || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // File upload
  const processFiles = async (files) => {
    setUploadError(null);
    for (const file of files) {
      const tmpId = Math.random().toString(36).slice(2);
      setVaultFiles(prev => [{ id: tmpId, name: file.name, progress: 0, status: 'uploading', size: file.size }, ...prev]);
      try {
        const res = await dashboardAPI.uploadFile(file, (pct) => {
          setVaultFiles(prev => prev.map(f => f.id === tmpId ? { ...f, progress: pct, status: 'encrypting' } : f));
        });
        const uploaded = res.file;
        setVaultFiles(prev => prev.map(f =>
          f.id === tmpId ? { ...f, id: uploaded.id || tmpId, name: uploaded.name || f.name, size: uploaded.size ?? f.size, uploadedAt: uploaded.uploaded_at, progress: 100, status: 'secured' } : f
        ));
      } catch (err) {
        setVaultFiles(prev => prev.map(f => f.id === tmpId ? { ...f, status: 'failed', error: err.message } : f));
        setUploadError(err.message || 'Upload failed');
      }
    }
  };

  const handleDrop = (e) => { e.preventDefault(); processFiles(Array.from(e.dataTransfer.files || [])); };
  const handleFileChange = (e) => { processFiles(Array.from(e.target.files || [])); e.target.value = ''; };

  // Profile save
  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      await dashboardAPI.updateProfile(profileForm);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      // silent
    } finally {
      setProfileSaving(false);
    }
  };

  // Disconnect account
  const disconnectAccount = async (provider) => {
    try {
      await dashboardAPI.disconnectAccount(provider);
      setConnectedAccounts(prev => prev.filter(a => a.provider !== provider));
    } catch { /* silent */ }
  };

  // Connect Google
  const connectGoogle = async () => {
    setConnectingProvider('google');
    try {
      const res = await dashboardAPI.getGoogleOAuthUrl();
      window.location.href = res.url;
    } catch {
      alert('Google OAuth is not configured yet. Set GOOGLE_CLIENT_ID on the backend.');
    } finally {
      setConnectingProvider(null);
    }
  };

  const stats = dashData || {};
  const secScore = security?.security_score ?? 0;
  const riskLevel = security?.risk_level || 'low';
  const rc = riskColor[riskLevel] || riskColor.low;

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'email', label: 'Email Security', icon: Mail },
    { id: 'vault', label: 'Encrypted Vault', icon: Lock },
    { id: 'monitor', label: 'Security Monitor', icon: Eye },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  const isConnected = (p) => connectedAccounts.some(a => a.provider === p);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4" />
        <p className="text-slate-600 text-sm font-medium">Loading your security workspace…</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 overflow-hidden`}>
        <div className="p-5 border-b border-slate-100">
          <button onClick={() => onSwitchView('home')} className="flex items-center gap-2 group">
            <Shield size={22} className="text-indigo-600" />
            <span className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">SyncVeil</span>
          </button>
          {profile && (
            <div className="mt-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <User size={16} className="text-indigo-600" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{profile.full_name || 'Your Account'}</p>
                <p className="text-xs text-slate-500 truncate">{profile.email}</p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                tab === id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
              }`}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-rose-600 hover:bg-rose-50 transition-colors">
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-slate-100">
              <Menu size={20} className="text-slate-600" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">
              {navItems.find(n => n.id === tab)?.label}
            </h1>
          </div>
          <button onClick={() => loadAll(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <div className="space-y-6 max-w-5xl">
              {/* Score + Stats */}
              <div className="grid md:grid-cols-4 gap-4">
                <div className="md:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center justify-center">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Security Score</p>
                  <ScoreRing score={secScore} />
                  <span className={`mt-3 px-2.5 py-1 text-xs font-bold rounded-full border ${rc.bg} ${rc.border} ${rc.text}`}>
                    {riskLevel.toUpperCase()} RISK
                  </span>
                </div>
                <div className="md:col-span-3 grid grid-cols-2 gap-4">
                  <StatCard title="Protected Records" value={stats.protectedRecords ?? 0} subtitle="Actively secured" icon={Shield} color="indigo" />
                  <StatCard title="Vault Files" value={stats.vaultFiles ?? 0} subtitle={fmt(stats.vaultSize)} icon={Lock} color="teal" />
                  <StatCard title="Threats (7d)" value={stats.threatsDetected ?? 0} subtitle="Failed logins blocked" icon={AlertTriangle} color="rose" />
                  <StatCard title="Active Sessions" value={stats.activeSessions ?? 0} subtitle="Devices logged in" icon={Wifi} color="amber" />
                </div>
              </div>

              {/* Email Verification Banner */}
              {profile && !profile.email_verified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Email not verified</p>
                    <p className="text-xs text-amber-700 mt-0.5">Verify your email to unlock full security features and protect your account.</p>
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Activity size={16} /> Recent Activity</h3>
                {stats.recentActivity?.length ? (
                  <div className="space-y-3">
                    {stats.recentActivity.map((a, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {a.success ? 'Successful sign-in' : 'Failed login attempt'}
                          </p>
                          <p className="text-xs text-slate-500">{a.ip} · {timeAgo(a.timestamp)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {a.success ? 'OK' : 'Blocked'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No recent activity yet.</p>
                )}
              </div>

              {/* Connected Accounts */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Link size={16} /> Connected Accounts</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {['google', 'apple', 'microsoft'].map(provider => {
                    const acc = connectedAccounts.find(a => a.provider === provider);
                    return (
                      <div key={provider} className={`p-4 rounded-xl border ${acc ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ProviderLogo provider={provider} />
                            <span className="text-sm font-semibold text-slate-800 capitalize">{provider}</span>
                          </div>
                          {acc ? <CheckCircle size={14} className="text-emerald-600" /> : null}
                        </div>
                        {acc ? (
                          <>
                            <p className="text-xs text-slate-600 truncate">{acc.email}</p>
                            <button onClick={() => disconnectAccount(provider)}
                              className="mt-2 text-xs text-rose-600 hover:underline">Disconnect</button>
                          </>
                        ) : (
                          <button
                            onClick={provider === 'google' ? connectGoogle : () => alert(`${provider} OAuth coming soon`)}
                            disabled={connectingProvider === provider}
                            className="mt-1 text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50">
                            {connectingProvider === provider ? 'Connecting…' : 'Connect'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Account Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Clock size={16} /> Account Summary</h3>
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-slate-500 text-xs">Member Since</p>
                    <p className="font-semibold text-slate-900 mt-1">
                      {stats.memberSince ? new Date(stats.memberSince).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-slate-500 text-xs">Last Login</p>
                    <p className="font-semibold text-slate-900 mt-1">{timeAgo(stats.lastLogin)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-slate-500 text-xs">Email Verified</p>
                    <p className={`font-semibold mt-1 ${stats.emailVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {stats.emailVerified ? '✓ Verified' : '✗ Unverified'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── EMAIL SECURITY TAB ── */}
          {tab === 'email' && (
            <div className="space-y-6 max-w-3xl">
              {/* Main email card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Mail size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{profile?.email || propUser?.email}</p>
                    <p className="text-xs text-slate-500">Primary monitored email</p>
                  </div>
                  {emailSecurity?.email_verified ? (
                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <CheckCircle size={12} /> Verified
                    </span>
                  ) : (
                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      <AlertTriangle size={12} /> Unverified
                    </span>
                  )}
                </div>

                {/* Breach check */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-800">Breach Check: Clear</p>
                  </div>
                  <p className="text-xs text-emerald-700">Your email was not found in any known public data breaches.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Last checked: {emailSecurity ? new Date(emailSecurity.last_checked).toLocaleString() : '—'}
                  </p>
                </div>

                {/* Spam risk */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-700">Spam Risk Score</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${severityBadge[emailSecurity?.spam_risk_level || 'low']}`}>
                      {(emailSecurity?.spam_risk_level || 'low').toUpperCase()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ${
                        (emailSecurity?.spam_risk_score || 0) < 30 ? 'bg-emerald-500'
                        : (emailSecurity?.spam_risk_score || 0) < 60 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${emailSecurity?.spam_risk_score || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>0 — Safe</span>
                    <span>{emailSecurity?.spam_risk_score ?? 0}/100</span>
                    <span>100 — High Risk</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500">Failed logins (7d)</p>
                    <p className="text-xl font-bold text-slate-900">{emailSecurity?.failed_attempts_7d ?? 0}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500">Unique IPs (7d)</p>
                    <p className="text-xl font-bold text-slate-900">{emailSecurity?.unique_ips_7d ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* Connect email accounts */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-1">Connect Email Accounts</h3>
                <p className="text-xs text-slate-500 mb-5">Link your email accounts to get deeper spam analysis, phishing detection, and inbox security insights.</p>
                <div className="space-y-3">
                  {[
                    { id: 'google', name: 'Google Gmail', desc: 'Analyze Gmail for spam & phishing' },
                    { id: 'microsoft', name: 'Microsoft Outlook', desc: 'Monitor Outlook for threats' },
                    { id: 'apple', name: 'Apple Mail', desc: 'Protect your iCloud inbox' },
                  ].map(({ id, name, desc }) => {
                    const acc = connectedAccounts.find(a => a.provider === id);
                    return (
                      <div key={id} className={`flex items-center gap-4 p-4 rounded-xl border ${acc ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                        <ProviderLogo provider={id} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{name}</p>
                          {acc ? (
                            <p className="text-xs text-emerald-700 truncate">Connected · {acc.email}</p>
                          ) : (
                            <p className="text-xs text-slate-500">{desc}</p>
                          )}
                        </div>
                        {acc ? (
                          <button onClick={() => disconnectAccount(id)}
                            className="text-xs text-rose-600 hover:underline flex-shrink-0">Disconnect</button>
                        ) : (
                          <button
                            onClick={id === 'google' ? connectGoogle : () => alert(`${id} OAuth coming soon`)}
                            className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg flex-shrink-0">
                            Connect
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── VAULT TAB ── */}
          {tab === 'vault' && (
            <div className="space-y-5 max-w-3xl">
              <div
                className="rounded-2xl p-10 text-center cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50 transition-colors"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileChange} />
                <Upload size={40} className="mx-auto mb-3 text-slate-400" />
                <p className="font-bold text-slate-900 mb-1">Drop files to encrypt & upload</p>
                <p className="text-sm text-slate-500">or click to browse · All files are AES-256 encrypted at rest</p>
              </div>

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {uploadError}
                  <button onClick={() => setUploadError(null)} className="ml-auto"><X size={14} /></button>
                </div>
              )}

              {vaultFiles.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Vault Files ({vaultFiles.length})</p>
                    <p className="text-xs text-slate-500">{fmt(vaultFiles.reduce((s, f) => s + (f.size || 0), 0))} total</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {vaultFiles.map(file => (
                      <div key={file.id} className="px-5 py-3">
                        <div className="flex items-center gap-3 mb-1.5">
                          <Lock size={14} className="text-indigo-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-slate-900 flex-1 truncate">{file.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            file.status === 'secured' ? 'bg-emerald-100 text-emerald-700'
                            : file.status === 'failed' ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}>{file.status}</span>
                        </div>
                        {file.status !== 'secured' && (
                          <div className="ml-5 w-full bg-slate-200 rounded-full h-1.5">
                            <div className="bg-indigo-600 h-1.5 rounded-full transition-all" style={{ width: `${file.progress}%` }} />
                          </div>
                        )}
                        <div className="ml-5 flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>{fmt(file.size || 0)}</span>
                          {file.uploadedAt && <span>{new Date(file.uploadedAt).toLocaleString()}</span>}
                          {file.error && <span className="text-rose-500">{file.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-slate-400 py-4">Your encrypted vault is empty. Upload your first file above.</p>
              )}
            </div>
          )}

          {/* ── MONITOR TAB ── */}
          {tab === 'monitor' && (
            <div className="space-y-5 max-w-3xl">
              {/* Breach feed */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><AlertTriangle size={16} /> Threat Detection Feed</h3>
                {breaches?.breaches?.length ? (
                  <div className="space-y-3">
                    {breaches.breaches.map(b => (
                      <div key={b.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${riskColor[b.severity]?.dot || 'bg-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{b.message}</p>
                            <p className="text-xs text-slate-500 mt-0.5">IP: {b.ip} · {timeAgo(b.timestamp)}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${severityBadge[b.severity]}`}>
                            {b.severity?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <CheckCircle size={18} className="text-emerald-600" />
                    <p className="text-sm text-emerald-700 font-medium">No active threats detected. Your account is secure.</p>
                  </div>
                )}
              </div>

              {/* Login events */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Smartphone size={16} /> Authentication Events</h3>
                {events.length ? (
                  <div className="space-y-2">
                    {events.map(e => (
                      <div key={e.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${e.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {e.success ? 'Successful sign-in' : `Failed: ${e.reason || 'unknown'}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {e.ip_address} · {e.device_info ? e.device_info.slice(0, 40) + (e.device_info.length > 40 ? '…' : '') : 'Unknown device'}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(e.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No authentication events yet.</p>
                )}
              </div>

              {/* Security metrics */}
              {security && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Activity size={16} /> 7-Day Security Metrics</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Risk Score', value: security.risk_score },
                      { label: 'Active Sessions', value: security.active_sessions },
                      { label: 'Successful Logins', value: security.successes_7d },
                      { label: 'Failed Attempts', value: security.failures_7d },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 bg-slate-50 rounded-xl text-center">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{value ?? 0}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {tab === 'settings' && (
            <div className="space-y-5 max-w-2xl">
              {/* Profile */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-5 flex items-center gap-2"><User size={16} /> Profile Information</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                    <input type="text" value={profileForm.full_name}
                      onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="Your full name"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
                    <input type="email" value={profile?.email || ''} disabled
                      className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
                    <input type="tel" value={profileForm.phone}
                      onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 234 567 8900"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Birth</label>
                    <input type="date" value={profileForm.date_of_birth}
                      onChange={e => setProfileForm(p => ({ ...p, date_of_birth: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Country</label>
                    <select value={profileForm.country}
                      onChange={e => setProfileForm(p => ({ ...p, country: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="">Select your country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <button onClick={saveProfile} disabled={profileSaving}
                    className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {profileSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                  {profileSuccess && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                      <CheckCircle size={14} /> Saved successfully
                    </span>
                  )}
                </div>
              </div>

              {/* Security Status */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Shield size={16} /> Security Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Mail size={15} className="text-slate-500" />
                      <span className="text-sm text-slate-700">Email Verification</span>
                    </div>
                    <span className={`text-xs font-semibold ${profile?.email_verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {profile?.email_verified ? '✓ Verified' : '✗ Not verified'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Activity size={15} className="text-slate-500" />
                      <span className="text-sm text-slate-700">Risk Level</span>
                    </div>
                    <span className={`text-xs font-semibold uppercase ${rc.text}`}>{riskLevel}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Wifi size={15} className="text-slate-500" />
                      <span className="text-sm text-slate-700">Active Sessions</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{security?.active_sessions ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Link size={15} className="text-slate-500" />
                      <span className="text-sm text-slate-700">Connected Accounts</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{connectedAccounts.length} / 3</span>
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="bg-white rounded-2xl border border-rose-200 p-6">
                <h3 className="font-semibold text-rose-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} /> Danger Zone</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Log out of all devices</p>
                    <p className="text-xs text-slate-500">Revokes all active sessions immediately</p>
                  </div>
                  <button onClick={() => onLogout && onLogout(true)}
                    className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-xl hover:bg-rose-100 transition-colors">
                    Log Out All
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
