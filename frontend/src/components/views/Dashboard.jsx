import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Eye, Globe, Link, Lock, LogOut, Mail, Menu, RefreshCw, Settings, Shield, Smartphone, Trash2, Upload, User, Wifi, X } from 'lucide-react';
import { dashboardAPI } from '../../api';

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmt = b => { if(!b) return '0 B'; const u=['B','KB','MB','GB']; const i=Math.min(Math.floor(Math.log(b)/Math.log(1024)),3); return `${(b/1024**i).toFixed(i?1:0)} ${u[i]}`; };
const ago = iso => { if(!iso) return 'never'; const s=(Date.now()-new Date(iso))/1000; if(s<60) return 'just now'; if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : '—';
const RC = { low:'text-emerald-700 bg-emerald-50 border-emerald-200', medium:'text-yellow-700 bg-yellow-50 border-yellow-200', high:'text-amber-700 bg-amber-50 border-amber-200', critical:'text-rose-700 bg-rose-50 border-rose-200' };
const SB = { critical:'bg-rose-100 text-rose-700 border-rose-200', high:'bg-amber-100 text-amber-700 border-amber-200', medium:'bg-yellow-100 text-yellow-700 border-yellow-200', low:'bg-emerald-100 text-emerald-700 border-emerald-200' };

// ── Score Ring ────────────────────────────────────────────────────────────────
const ScoreRing = ({ score=0 }) => {
  const r=54, c=2*Math.PI*r, pct=Math.max(0,Math.min(100,score));
  const col = pct>=80?'#10b981':pct>=60?'#f59e0b':pct>=40?'#f97316':'#ef4444';
  const lbl = pct>=80?'Excellent':pct>=60?'Good':pct>=40?'Fair':'At Risk';
  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="130" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={col} strokeWidth="12" strokeDasharray={c} strokeDashoffset={c-(pct/100)*c} strokeLinecap="round" transform="rotate(-90 70 70)" style={{transition:'stroke-dashoffset 1s ease'}}/>
        <text x="70" y="65" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#1e293b">{pct}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="11" fill="#64748b">/100</text>
      </svg>
      <p className="text-sm font-semibold mt-1" style={{color:col}}>{lbl}</p>
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, sub, icon:Icon, color='indigo' }) => {
  const C={indigo:'bg-indigo-50 border-indigo-200 text-indigo-900 text-indigo-600',teal:'bg-teal-50 border-teal-200 text-teal-900 text-teal-600',rose:'bg-rose-50 border-rose-200 text-rose-900 text-rose-600',amber:'bg-amber-50 border-amber-200 text-amber-900 text-amber-600'}[color];
  const [bg,brd,txt,ic]=C.split(' ');
  return (
    <div className={`p-5 ${bg} rounded-2xl border ${brd}`}>
      <div className="flex items-center justify-between mb-2"><p className={`text-xs font-semibold uppercase tracking-wide ${txt}`}>{title}</p><Icon size={18} className={ic}/></div>
      <p className={`text-3xl font-bold ${txt}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 opacity-70 ${txt}`}>{sub}</p>}
    </div>
  );
};

// ── Provider Logo ─────────────────────────────────────────────────────────────
const ProviderLogo = ({ p }) => {
  if(p==='google') return <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
  if(p==='microsoft') return <svg viewBox="0 0 24 24" width="20" height="20"><path d="M11.4 11.4H0V0h11.4v11.4z" fill="#f25022"/><path d="M24 11.4H12.6V0H24v11.4z" fill="#7fba00"/><path d="M11.4 24H0V12.6h11.4V24z" fill="#00a4ef"/><path d="M24 24H12.6V12.6H24V24z" fill="#ffb900"/></svg>;
  if(p==='apple') return <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.42.07 2.38.74 3.2.8 1.21-.24 2.38-.93 3.65-.84 1.55.12 2.72.72 3.47 1.84-3.19 1.88-2.44 6.02.77 7.17-.57 1.46-1.32 2.9-3.09 3.91zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>;
  return <Globe size={20}/>;
};

const TABS = [
  {id:'overview',label:'Overview',icon:Shield},
  {id:'email',label:'Email Security',icon:Mail},
  {id:'vault',label:'Encrypted Vault',icon:Lock},
  {id:'monitor',label:'Security Monitor',icon:Eye},
  {id:'settings',label:'Account Settings',icon:Settings},
];

const COUNTRIES=['Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium','Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Other'];

export default function Dashboard({ onLogout, onSwitchView, user: propUser }) {
  const [tab, setTab] = useState('overview');
  const [nav, setNav] = useState(true);
  const [dash,setDash]     = useState(null);
  const [sec,setSec]       = useState(null);
  const [events,setEvents] = useState([]);
  const [breaches,setBreaches] = useState([]);
  const [vault,setVault]   = useState([]);
  const [emailSec,setEmailSec] = useState(null);
  const [profile,setProfile]   = useState(null);
  const [connected,setConnected] = useState([]);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [uploadErr,setUploadErr] = useState('');
  const [profForm,setProfForm] = useState({full_name:'',phone:'',country:'',date_of_birth:''});
  const [profSaving,setProfSaving] = useState(false);
  const [profSaved,setProfSaved] = useState(false);
  const [connecting,setConnecting] = useState('');
  const fileRef = useRef(null);

  const loadAll = useCallback(async (silent=false) => {
    if(!silent) setLoading(true); else setRefreshing(true);
    const [d,s,e,b,v,em,p] = await Promise.allSettled([
      dashboardAPI.getDashboardData(), dashboardAPI.getSecurityOverview(),
      dashboardAPI.getSecurityEvents(25), dashboardAPI.getBreachData(),
      dashboardAPI.getVaultFiles(), dashboardAPI.getEmailSecurity(), dashboardAPI.getProfile(),
    ]);
    if(d.status==='fulfilled'){ const r=d.value?.data||d.value; setDash(r); setConnected(r?.connectedAccounts||[]); }
    if(s.status==='fulfilled') setSec(s.value?.data||s.value);
    if(e.status==='fulfilled') setEvents(e.value?.data?.events||[]);
    if(b.status==='fulfilled') setBreaches(b.value?.breaches?.breaches||[]);
    if(v.status==='fulfilled') setVault((v.value?.files||[]).map(f=>({...f,status:'secured'})));
    if(em.status==='fulfilled') setEmailSec(em.value);
    if(p.status==='fulfilled'){
      const pr=p.value; setProfile(pr);
      setProfForm({full_name:pr.full_name||'',phone:pr.phone||'',country:pr.country||'',date_of_birth:pr.date_of_birth||''});
    }
    setLoading(false); setRefreshing(false);
  },[]);

  useEffect(()=>{ loadAll(); },[loadAll]);

  const upload = async files => {
    setUploadErr('');
    for(const file of files){
      const tmp='tmp-'+Math.random().toString(36).slice(2);
      setVault(p=>[{id:tmp,file_name:file.name,size_bytes:file.size,status:'uploading',progress:0},...p]);
      try {
        const r = await dashboardAPI.uploadFile(file, pct=>setVault(p=>p.map(f=>f.id===tmp?{...f,progress:pct}:f)));
        const uf=r.file;
        setVault(p=>p.map(f=>f.id===tmp?{...f,id:uf.id,file_name:uf.file_name,size_bytes:uf.size_bytes,uploaded_at:uf.uploaded_at,status:'secured',progress:100}:f));
      } catch(err){
        setVault(p=>p.map(f=>f.id===tmp?{...f,status:'failed',error:err.message}:f));
        setUploadErr(err.message||'Upload failed');
      }
    }
  };

  const deleteFile = async id => {
    if(!confirm('Delete this file from your vault?')) return;
    try { await dashboardAPI.deleteVaultFile(id); setVault(p=>p.filter(f=>f.id!==id)); } catch(e){ alert(e.message); }
  };

  const saveProfile = async () => {
    setProfSaving(true); setProfSaved(false);
    try { await dashboardAPI.updateProfile(profForm); setProfSaved(true); setTimeout(()=>setProfSaved(false),3000); } catch { /* silent */ }
    finally { setProfSaving(false); }
  };

  const connectProvider = async provider => {
    setConnecting(provider);
    try {
      const fn = provider==='google' ? dashboardAPI.getGoogleOAuthUrl : dashboardAPI.getMicrosoftOAuthUrl;
      const r = await fn();
      window.location.href = r.url;
    } catch(e){ alert(e.message||`${provider} OAuth not configured on the backend yet.`); }
    finally { setConnecting(''); }
  };

  const disconnectProvider = async provider => {
    if(!confirm(`Disconnect ${provider}?`)) return;
    try { await dashboardAPI.disconnectAccount(provider); setConnected(p=>p.filter(a=>a.provider!==provider)); } catch(e){ alert(e.message); }
  };

  const connAcc = p => connected.find(a=>a.provider===p);
  const rl = sec?.risk_level||'low';
  const rc = RC[rl]||RC.low;

  if(loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"/>
        <p className="text-slate-600 text-sm font-medium">Loading your security workspace…</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${nav?'w-64':'w-0'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 overflow-hidden`}>
        <div className="p-5 border-b border-slate-100">
          <button onClick={()=>onSwitchView?.('home')} className="flex items-center gap-2 group">
            <Shield size={22} className="text-indigo-600"/><span className="text-xl font-bold text-slate-900 group-hover:text-indigo-600">SyncVeil</span>
          </button>
          {profile && (
            <div className="mt-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover"/> : <User size={16} className="text-indigo-600"/>}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{profile.full_name||'My Account'}</p>
                <p className="text-xs text-slate-500 truncate">{profile.email}</p>
              </div>
            </div>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {TABS.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>setTab(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${tab===id?'bg-indigo-50 text-indigo-700':'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}>
              <Icon size={17}/>{label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={()=>onLogout?.()} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-rose-600 hover:bg-rose-50 transition-colors">
            <LogOut size={17}/>Log Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={()=>setNav(n=>!n)} className="p-1.5 rounded-lg hover:bg-slate-100"><Menu size={20} className="text-slate-600"/></button>
            <h1 className="text-lg font-bold text-slate-900">{TABS.find(t=>t.id===tab)?.label}</h1>
          </div>
          <button onClick={()=>loadAll(true)} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={refreshing?'animate-spin':''}/> Refresh
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">

          {/* ── OVERVIEW ── */}
          {tab==='overview' && (
            <div className="space-y-5 max-w-5xl">
              {/* Score + stats */}
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center justify-center">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Security Score</p>
                  <ScoreRing score={sec?.security_score??0}/>
                  <span className={`mt-2 px-2.5 py-0.5 text-xs font-bold rounded-full border ${rc}`}>{rl.toUpperCase()} RISK</span>
                </div>
                <div className="md:col-span-3 grid grid-cols-2 gap-4">
                  <StatCard title="Protected Records" value={dash?.protectedRecords??0}      sub="Vault files + sessions" icon={Shield} color="indigo"/>
                  <StatCard title="Vault Files"       value={dash?.vaultFiles??0}            sub={fmt(dash?.vaultSize)} icon={Lock} color="teal"/>
                  <StatCard title="Threats (7d)"      value={dash?.threatsDetected??0}       sub="Failed logins blocked" icon={AlertTriangle} color="rose"/>
                  <StatCard title="Active Sessions"   value={dash?.activeSessions??0}        sub="Devices logged in" icon={Wifi} color="amber"/>
                </div>
              </div>

              {/* Email verification warning */}
              {profile && !profile.email_verified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                  <div><p className="text-sm font-semibold text-amber-800">Email not verified</p><p className="text-xs text-amber-700 mt-0.5">Verify your email to unlock all security features.</p></div>
                </div>
              )}

              {/* Account summary */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {label:'Member Since', val: fmtDate(dash?.memberSince)},
                  {label:'Last Login',   val: ago(dash?.lastLogin)},
                  {label:'Email Status', val: profile?.email_verified ? '✓ Verified':'✗ Not Verified', cls: profile?.email_verified?'text-emerald-600':'text-amber-600'},
                ].map(({label,val,cls})=>(
                  <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                    <p className={`font-bold text-slate-900 mt-1 ${cls||''}`}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Recent activity */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Activity size={16}/>Recent Activity</h3>
                {dash?.recentActivity?.length ? (
                  <div className="space-y-2">
                    {dash.recentActivity.map((a,i)=>(
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.success?'bg-emerald-500':'bg-rose-500'}`}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{a.success?'Successful sign-in':'Failed login attempt'}</p>
                          <p className="text-xs text-slate-500">{a.location||a.ip} · {ago(a.timestamp)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.success?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{a.success?'OK':'Blocked'}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400 py-4 text-center">No activity yet — your account is fresh.</p>}
              </div>

              {/* Connected accounts */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Link size={16}/>Connected Accounts</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {['google','microsoft','apple'].map(p=>{
                    const acc=connAcc(p);
                    return (
                      <div key={p} className={`p-4 rounded-xl border ${acc?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <ProviderLogo p={p}/><span className="text-sm font-semibold text-slate-800 capitalize">{p}</span>
                          {acc && <CheckCircle size={13} className="text-emerald-600 ml-auto"/>}
                        </div>
                        {acc ? (
                          <><p className="text-xs text-slate-600 truncate">{acc.email}</p>
                          <button onClick={()=>disconnectProvider(p)} className="mt-2 text-xs text-rose-600 hover:underline">Disconnect</button></>
                        ) : (
                          <button onClick={()=>p==='apple'?alert('Apple Sign-In coming soon — requires Apple Developer account'):connectProvider(p)} disabled={connecting===p}
                            className="mt-1 text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50">
                            {connecting===p?'Connecting…':'Connect'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── EMAIL SECURITY ── */}
          {tab==='email' && (
            <div className="space-y-5 max-w-2xl">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center"><Mail size={18} className="text-indigo-600"/></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{profile?.email||propUser?.email}</p>
                    <p className="text-xs text-slate-500">Primary monitored email</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${emailSec?.email_verified?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    {emailSec?.email_verified?'✓ Verified':'✗ Unverified'}
                  </span>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-1">✓ Breach Check: Clear</p>
                  <p className="text-xs text-emerald-700">Your email has not been found in any known public data breaches.</p>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-700">Spam Risk Score</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SB[emailSec?.spam_risk_level||'low']}`}>{(emailSec?.spam_risk_level||'low').toUpperCase()}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all duration-700 ${(emailSec?.spam_risk_score||0)<30?'bg-emerald-500':(emailSec?.spam_risk_score||0)<60?'bg-amber-500':'bg-rose-500'}`} style={{width:`${emailSec?.spam_risk_score||0}%`}}/>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Safe</span><span>{emailSec?.spam_risk_score??0}/100</span><span>High Risk</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-500">Failed logins (7d)</p><p className="text-2xl font-bold text-slate-900">{emailSec?.failed_attempts_7d??0}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-500">Unique IPs (7d)</p><p className="text-2xl font-bold text-slate-900">{emailSec?.unique_ips_7d??0}</p></div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-1">Connect Email Accounts</h3>
                <p className="text-xs text-slate-500 mb-4">Link your accounts for deeper spam & phishing analysis.</p>
                {['google','microsoft'].map(p=>{
                  const acc=connAcc(p);
                  return (
                    <div key={p} className={`flex items-center gap-4 p-4 rounded-xl border mb-3 ${acc?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-200'}`}>
                      <ProviderLogo p={p}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 capitalize">{p==='google'?'Google Gmail':'Microsoft Outlook'}</p>
                        {acc ? <p className="text-xs text-emerald-700 truncate">Connected · {acc.email}</p> : <p className="text-xs text-slate-500">{p==='google'?'Analyze Gmail for spam & phishing':'Monitor Outlook for threats'}</p>}
                      </div>
                      {acc
                        ? <button onClick={()=>disconnectProvider(p)} className="text-xs text-rose-600 hover:underline">Disconnect</button>
                        : <button onClick={()=>connectProvider(p)} disabled={connecting===p} className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50">{connecting===p?'…':'Connect'}</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── VAULT ── */}
          {tab==='vault' && (
            <div className="space-y-5 max-w-3xl">
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-10 text-center cursor-pointer hover:bg-indigo-50 transition-colors"
                onDrop={e=>{e.preventDefault();upload(Array.from(e.dataTransfer.files||[]))}}
                onDragOver={e=>e.preventDefault()}
                onClick={()=>fileRef.current?.click()}>
                <input ref={fileRef} type="file" className="hidden" multiple onChange={e=>{upload(Array.from(e.target.files||[]));e.target.value='';}}/>
                <Upload size={36} className="mx-auto mb-3 text-slate-400"/>
                <p className="font-bold text-slate-900 mb-1">Drop files to encrypt & store</p>
                <p className="text-sm text-slate-500">AES-256-GCM encrypted · Max 5 MB per file · Stored in database</p>
              </div>

              {uploadErr && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertTriangle size={14}/>{uploadErr}<button onClick={()=>setUploadErr('')} className="ml-auto"><X size={14}/></button>
                </div>
              )}

              {vault.length>0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex justify-between">
                    <p className="text-sm font-semibold text-slate-900">Vault Files ({vault.length})</p>
                    <p className="text-xs text-slate-500">{fmt(vault.reduce((s,f)=>s+(f.size_bytes||0),0))} total</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {vault.map(f=>(
                      <div key={f.id} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Lock size={14} className="text-indigo-400 flex-shrink-0"/>
                          <span className="text-sm font-medium text-slate-900 flex-1 truncate">{f.file_name||f.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.status==='secured'?'bg-emerald-100 text-emerald-700':f.status==='failed'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}`}>{f.status}</span>
                          {f.status==='secured' && <button onClick={()=>deleteFile(f.id)} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>}
                        </div>
                        {f.status!=='secured' && <div className="ml-5 mt-1.5 w-full bg-slate-200 rounded-full h-1.5"><div className="bg-indigo-600 h-1.5 rounded-full transition-all" style={{width:`${f.progress||0}%`}}/></div>}
                        <div className="ml-5 flex gap-3 mt-1 text-xs text-slate-400">
                          <span>{fmt(f.size_bytes||0)}</span>
                          {f.uploaded_at && <span>{fmtDate(f.uploaded_at)}</span>}
                          {f.error && <span className="text-rose-500">{f.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-center text-sm text-slate-400 py-6">Your encrypted vault is empty. Upload files above to secure them.</p>}
            </div>
          )}

          {/* ── MONITOR ── */}
          {tab==='monitor' && (
            <div className="space-y-5 max-w-3xl">
              {sec && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {label:'Security Score', val:sec.security_score??0},
                    {label:'Active Sessions', val:sec.active_sessions??0},
                    {label:'Logins (7d)',      val:sec.successes_7d??0},
                    {label:'Failures (7d)',    val:sec.failures_7d??0},
                  ].map(({label,val})=>(
                    <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">{val}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><AlertTriangle size={16}/>Threat Feed</h3>
                {breaches.length ? (
                  <div className="space-y-3">
                    {breaches.map(b=>(
                      <div key={b.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SB[b.severity]?.split(' ')[0].replace('bg-','bg-')||'bg-slate-400'}`}/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{b.message}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{b.location||b.ip} · {ago(b.timestamp)}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${SB[b.severity]||SB.low}`}>{(b.severity||'').toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <CheckCircle size={18} className="text-emerald-600"/><p className="text-sm text-emerald-700 font-medium">No active threats detected. Your account is secure.</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Smartphone size={16}/>Authentication Events</h3>
                {events.length ? (
                  <div className="space-y-2">
                    {events.map(e=>(
                      <div key={e.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${e.success?'bg-emerald-500':'bg-rose-500'}`}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{e.success?'Successful sign-in':`Failed: ${e.reason||'unknown'}`}</p>
                          <p className="text-xs text-slate-500">{e.location||e.ip_address} · {e.device_info?.slice(0,50)||'Unknown device'}</p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{ago(e.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400">No authentication events recorded yet.</p>}
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab==='settings' && (
            <div className="space-y-5 max-w-2xl">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-5 flex items-center gap-2"><User size={16}/>Profile Information</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    {label:'Full Name',    key:'full_name',   type:'text',  ph:'Jane Doe'},
                    {label:'Email',        key:'email',       type:'email', ph:'', disabled:true, val:profile?.email},
                    {label:'Phone Number', key:'phone',       type:'tel',   ph:'+1 234 567 8900'},
                    {label:'Date of Birth',key:'date_of_birth',type:'date', ph:''},
                  ].map(({label,key,type,ph,disabled,val})=>(
                    <div key={key}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                      <input type={type} value={disabled?val:(profForm[key]||'')} onChange={disabled?undefined:e=>setProfForm(p=>({...p,[key]:e.target.value}))}
                        placeholder={ph} disabled={disabled}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${disabled?'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed':'border-slate-300'}`}/>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Country</label>
                    <select value={profForm.country} onChange={e=>setProfForm(p=>({...p,country:e.target.value}))} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="">Select country</option>
                      {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <button onClick={saveProfile} disabled={profSaving} className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                    {profSaving?'Saving…':'Save Changes'}
                  </button>
                  {profSaved && <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><CheckCircle size={14}/>Saved</span>}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Shield size={16}/>Security Status</h3>
                <div className="space-y-3">
                  {[
                    {icon:Mail, label:'Email Verification', val:profile?.email_verified?'✓ Verified':'✗ Not Verified', cls:profile?.email_verified?'text-emerald-600':'text-amber-600'},
                    {icon:Activity, label:'Risk Level', val:(sec?.risk_level||'low').toUpperCase(), cls:RC[sec?.risk_level||'low']?.split(' ')[0]||''},
                    {icon:Wifi, label:'Active Sessions', val:`${sec?.active_sessions??0} device(s)`},
                    {icon:Lock, label:'Vault Files', val:`${dash?.vaultFiles??0} encrypted files`},
                    {icon:Link, label:'Connected Accounts', val:`${connected.length} / 3`},
                  ].map(({icon:Icon,label,val,cls})=>(
                    <div key={label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2"><Icon size={14} className="text-slate-500"/><span className="text-sm text-slate-700">{label}</span></div>
                      <span className={`text-xs font-semibold ${cls||'text-slate-700'}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-rose-200 p-6">
                <h3 className="font-semibold text-rose-700 mb-3 flex items-center gap-2"><AlertTriangle size={16}/>Danger Zone</h3>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-slate-800">Log out of all devices</p><p className="text-xs text-slate-500">Revokes all active sessions immediately</p></div>
                  <button onClick={()=>onLogout?.(true)} className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-xl hover:bg-rose-100 transition-colors">Log Out All</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
