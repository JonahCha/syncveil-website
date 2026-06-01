import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Eye, Globe, Link, Lock, LogOut, Mail, Moon, RefreshCw, Settings, Shield, Smartphone, Sun, Trash2, Upload, User, Wifi, X } from 'lucide-react';
import { dashboardAPI } from '../../api';
import '../../adminator.css';

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmt    = b => { if(!b) return '0 B'; const u=['B','KB','MB','GB']; const i=Math.min(Math.floor(Math.log(b)/Math.log(1024)),3); return `${(b/1024**i).toFixed(i?1:0)} ${u[i]}`; };
const ago    = iso => { if(!iso) return 'never'; const s=(Date.now()-new Date(iso))/1000; if(s<60) return 'just now'; if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : '—';
const initials = name => name ? name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : '??';
const severityTag = s => { const m={critical:'danger',high:'warning',medium:'info',low:'success'}; return m[s]||'muted'; };
const eventDot = t => { if(!t) return ''; const l=t.toLowerCase(); if(l.includes('fail')||l.includes('block')) return 'danger'; if(l.includes('warn')) return 'warning'; if(l.includes('success')||l.includes('login')) return 'success'; return 'info'; };

// ── Radial Ring ───────────────────────────────────────────────────────────────
const Radial = ({ pct=0, color='primary', label, caption }) => {
  const r=32, c=2*Math.PI*r, offset=c-((Math.min(100,Math.max(0,pct))/100)*c);
  return (
    <div className="sv-radial">
      <div className="sv-radial-chart">
        <svg viewBox="0 0 80 80">
          <circle className="radial-track" cx="40" cy="40" r={r}/>
          <circle className={`radial-fill ${color}`} cx="40" cy="40" r={r}
            strokeDasharray={c} strokeDashoffset={offset} style={{transition:'stroke-dashoffset 1s ease'}}/>
        </svg>
        <span className="radial-pct">{Math.round(pct)}%</span>
      </div>
      <div className="sv-radial-text">
        <div className="sv-radial-name">{label}</div>
        <div className="sv-radial-caption">{caption}</div>
      </div>
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sup, pill, pillKind='neutral', iconKind='primary', compare, children }) => (
  <article className={`kpi-card c-${iconKind}`}>
    <div className="kpi-top">
      <div className="kpi-identity">
        <div className={`kpi-icon ${iconKind}`}>
          {children}
        </div>
        <div className="kpi-label">{label}</div>
      </div>
      {pill && <span className={`kpi-pill ${pillKind}`}>{pill}</span>}
    </div>
    <div className="kpi-value">{value}{sup && <sup>{sup}</sup>}</div>
    {compare && <div className="kpi-compare">{compare}</div>}
  </article>
);

// ── Provider Logo ─────────────────────────────────────────────────────────────
const ProviderLogo = ({ p }) => {
  if(p==='google') return <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
  if(p==='microsoft') return <svg viewBox="0 0 24 24" width="20" height="20"><path d="M11.4 11.4H0V0h11.4v11.4z" fill="#f25022"/><path d="M24 11.4H12.6V0H24v11.4z" fill="#7fba00"/><path d="M11.4 24H0V12.6h11.4V24z" fill="#00a4ef"/><path d="M24 24H12.6V12.6H24V24z" fill="#ffb900"/></svg>;
  return <Globe size={20}/>;
};

const TABS = [
  { id:'overview', label:'Overview', svg: <path d="M12 20V10M18 20V4M6 20v-4"/> },
  { id:'email',    label:'Email Security', svg: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></> },
  { id:'vault',    label:'Encrypted Vault', svg: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
  { id:'monitor',  label:'Security Monitor', svg: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/> },
  { id:'settings', label:'Settings', svg: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></> },
];

const COUNTRIES = ['Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium','Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Other'];

export default function Dashboard({ onLogout, onSwitchView, user: propUser }) {
  const [tab,    setTab]    = useState('overview');
  const [theme,  setTheme]  = useState(() => { try { return localStorage.getItem('sv-theme')||'light'; } catch { return 'light'; } });
  const [dash,   setDash]   = useState(null);
  const [sec,    setSec]    = useState(null);
  const [events, setEvents] = useState([]);
  const [breaches,setBreaches] = useState([]);
  const [vault,  setVault]  = useState([]);
  const [emailSec,setEmailSec] = useState(null);
  const [profile,setProfile] = useState(null);
  const [connected,setConnected] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [lastRefreshed,setLastRefreshed] = useState(null);
  const [uploadErr,setUploadErr]  = useState('');
  const [profForm,setProfForm]    = useState({full_name:'',phone:'',country:'',date_of_birth:''});
  const [profSaving,setProfSaving]= useState(false);
  const [profSaved,setProfSaved]  = useState(false);
  const [connecting,setConnecting]= useState('');
  const [toast,setToast]          = useState(null);
  const [drag,setDrag]            = useState(false);
  const fileRef = useRef(null);

  const toggleTheme = () => setTheme(t => { const n=t==='dark'?'light':'dark'; try{localStorage.setItem('sv-theme',n);}catch{} return n; });
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

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
    if(p.status==='fulfilled'){ const pr=p.value; setProfile(pr); setProfForm({full_name:pr.full_name||'',phone:pr.phone||'',country:pr.country||'',date_of_birth:pr.date_of_birth||''}); }
    setLoading(false); setRefreshing(false); setLastRefreshed(new Date());
  },[]);

  useEffect(()=>{ loadAll(); },[loadAll]);
  useEffect(()=>{ const f=sessionStorage.getItem('oauth_connecting'); if(f){ sessionStorage.removeItem('oauth_connecting'); const t=setTimeout(()=>loadAll(true),800); return()=>clearTimeout(t); } },[]);

  const upload = async files => {
    setUploadErr('');
    for(const file of files){
      const tmp='tmp-'+Math.random().toString(36).slice(2);
      setVault(p=>[{id:tmp,file_name:file.name,size_bytes:file.size,status:'uploading',progress:0},...p]);
      try {
        const r=await dashboardAPI.uploadFile(file,pct=>setVault(p=>p.map(f=>f.id===tmp?{...f,progress:pct}:f)));
        const uf=r.file;
        setVault(p=>p.map(f=>f.id===tmp?{...f,id:uf.id,file_name:uf.file_name,size_bytes:uf.size_bytes,uploaded_at:uf.uploaded_at,status:'secured',progress:100}:f));
      } catch(err){ setVault(p=>p.map(f=>f.id===tmp?{...f,status:'failed',error:err.message}:f)); setUploadErr(err.message||'Upload failed'); }
    }
  };
  const deleteFile = async id => { if(!confirm('Delete this file?')) return; try{ await dashboardAPI.deleteVaultFile(id); setVault(p=>p.filter(f=>f.id!==id)); showToast('File deleted.'); }catch(e){ showToast(e.message,'error'); } };
  const saveProfile = async () => { setProfSaving(true); try{ await dashboardAPI.updateProfile(profForm); setProfSaved(true); showToast('Profile saved.'); setTimeout(()=>setProfSaved(false),3000); }catch(e){ showToast(e.message||'Save failed.','error'); } finally{ setProfSaving(false); } };
  const connectProvider = async provider => {
    setConnecting(provider);
    try{ const fn=provider==='google'?dashboardAPI.getGoogleOAuthUrl:dashboardAPI.getMicrosoftOAuthUrl; const r=await fn(); sessionStorage.setItem('oauth_connecting',provider); window.location.href=r.url; }
    catch(e){ showToast(e.message||`${provider} OAuth not configured.`,'error'); }
    finally{ setConnecting(''); }
  };
  const disconnectProvider = async provider => { if(!confirm(`Disconnect ${provider}?`)) return; try{ await dashboardAPI.disconnectAccount(provider); setConnected(p=>p.filter(a=>a.provider!==provider)); showToast(`${provider} disconnected.`); }catch(e){ showToast(e.message,'error'); } };
  const connAcc = p => connected.find(a=>a.provider===p);
  const score = sec?.security_score??0;
  const rl    = sec?.risk_level||'low';

  if(loading) return (
    <div className="adm-root" data-theme={theme} style={{display:'grid',placeItems:'center',minHeight:'100vh'}}>
      <div style={{textAlign:'center'}}>
        <div className="adm-spinner lg" style={{margin:'0 auto 16px'}}/>
        <p style={{color:'var(--t-muted)',fontSize:14,fontWeight:500}}>Loading your security workspace…</p>
      </div>
    </div>
  );

  return (
    <div className="adm-root" data-theme={theme}>
      {/* Toast */}
      {toast && (
        <div className={`adm-toast ${toast.type}`}>
          {toast.type==='error'
            ? <X size={15}/>
            : <CheckCircle size={15}/>}
          {toast.msg}
          <button onClick={()=>setToast(null)}><X size={13}/></button>
        </div>
      )}

      <div className="adm-shell">
        {/* ── Sidebar ── */}
        <aside className="d-sidebar">
          <div className="brand">
            <button className="brand-logo" onClick={()=>onSwitchView?.('home')} style={{cursor:'pointer',border:'none'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </button>
            <div className="brand-text">
              <div className="brand-name">SyncVeil</div>
              <div className="brand-tag">SECURITY</div>
            </div>
          </div>

          <nav className="nav-section">
            <div className="nav-label">Workspace</div>
            {TABS.map(t=>(
              <button key={t.id} className={`nav-link${tab===t.id?' is-active':''}`} onClick={()=>setTab(t.id)}>
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">{t.svg}</svg>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="workspace">
              <div className="workspace-avatar">{initials(profile?.full_name||propUser?.email||'U')}</div>
              <div className="workspace-text">
                <div className="workspace-name">{profile?.full_name||propUser?.email||'User'}</div>
                <div className="workspace-role">Security Account</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="adm-main">
          {/* Topbar */}
          <header className="d-topbar">
            <div className="crumbs">
              <span>SyncVeil</span>
              <span className="sep">/</span>
              <span className="current">{TABS.find(t=>t.id===tab)?.label||'Dashboard'}</span>
            </div>
            <div className="topbar-actions">
              {lastRefreshed && <span style={{fontSize:11,color:'var(--t-light)',fontFamily:'JetBrains Mono,monospace',letterSpacing:'0.04em'}}>Updated {ago(lastRefreshed.toISOString())}</span>}
              <button className="icon-btn" onClick={()=>loadAll(true)} disabled={refreshing} title="Refresh">
                <RefreshCw size={16} style={refreshing?{animation:'adm-spin 700ms linear infinite'}:{}}/>
              </button>
              <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
                {theme==='dark' ? <Sun size={16}/> : <Moon size={16}/>}
              </button>
              <button className="icon-btn" onClick={()=>onLogout?.()} title="Sign out">
                <LogOut size={16}/>
              </button>
              <div className="adm-avatar">{initials(profile?.full_name||propUser?.email||'U')}</div>
            </div>
          </header>

          {/* Content */}
          <main className="content">

            {/* ── OVERVIEW ── */}
            {tab==='overview' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Security Dashboard</span>
                    <h1 className="hero-title">Welcome back, <span className="accent">{profile?.full_name?.split(' ')[0]||'User'}</span></h1>
                    <p className="hero-sub">Your security score is <strong style={{color:score>=80?'var(--success)':score>=60?'var(--warning)':'var(--danger)'}}>{score}/100</strong> — risk level is <strong>{rl}</strong>.</p>
                  </div>
                  <div className="hero-actions">
                    <button className="btn btn--ghost" onClick={()=>loadAll(true)}>
                      <RefreshCw size={14}/> Refresh data
                    </button>
                    <button className="btn btn--primary" onClick={()=>setTab('monitor')}>
                      <Eye size={14}/> View threats
                    </button>
                  </div>
                </section>

                <div className="kpi-grid">
                  <KpiCard label="Security Score" value={score} sup="/100" iconKind="success" pill={score>=80?'Excellent':score>=60?'Good':'At Risk'} pillKind={score>=80?'up':score>=60?'neutral':'down'}
                    compare={<>overall account health</>}>
                    <Shield size={15}/>
                  </KpiCard>
                  <KpiCard label="Risk Level" value={rl.charAt(0).toUpperCase()+rl.slice(1)} iconKind={rl==='low'?'success':rl==='medium'?'warning':'danger'}
                    pill={rl==='low'?'Safe':rl==='medium'?'Monitor':'Act now'} pillKind={rl==='low'?'up':rl==='medium'?'neutral':'down'}
                    compare={<>based on recent activity</>}>
                    <AlertTriangle size={15}/>
                  </KpiCard>
                  <KpiCard label="Active Sessions" value={sec?.active_sessions??0} iconKind="purple" pillKind="neutral"
                    compare={<>devices signed in now</>}>
                    <Smartphone size={15}/>
                  </KpiCard>
                  <KpiCard label="Security Events" value={events.length} iconKind="info" pill="7 days" pillKind="info"
                    compare={<><strong>{events.filter(e=>e.event_type?.toLowerCase().includes('fail')).length}</strong> failures detected</>}>
                    <Activity size={15}/>
                  </KpiCard>
                </div>

                <div className="grid">
                  {/* Radial rings: score breakdown */}
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Security</span>
                        <h2 className="card-title">Account health</h2>
                      </div>
                      <button className="card-action" onClick={()=>setTab('monitor')}>
                        Full report <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                    <div className="sv-radials" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>
                      <Radial pct={score} color="success" label="Security score" caption="overall health"/>
                      <Radial pct={Math.min(100,events.filter(e=>!e.event_type?.toLowerCase().includes('fail')).length*4)} color="primary" label="Auth success rate" caption="last 25 events"/>
                      <Radial pct={connected.length>0?100:20} color="info" label="Account linking" caption="providers connected"/>
                      <Radial pct={vault.length>0?80:0} color="warning" label="Vault usage" caption="encrypted files"/>
                    </div>
                  </section>

                  {/* Recent security events */}
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Activity</span>
                        <h2 className="card-title">Recent events</h2>
                      </div>
                      <button className="card-action" onClick={()=>setTab('monitor')}>
                        View all <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                    {events.length===0
                      ? <p style={{color:'var(--t-muted)',fontSize:13,textAlign:'center',padding:'24px 0'}}>No recent events</p>
                      : events.slice(0,8).map((ev,i)=>(
                        <div key={i} className="event-row">
                          <div className={`event-dot ${eventDot(ev.event_type)}`}/>
                          <div>
                            <div className="event-text">{ev.event_type||'Security event'}</div>
                            <div className="event-sub">{ev.ip_address||ev.user_agent?.slice(0,40)||'—'}</div>
                          </div>
                          <div className="event-time">{ago(ev.created_at||ev.timestamp)}</div>
                        </div>
                      ))
                    }
                  </section>

                  {/* Connected accounts */}
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Integrations</span>
                        <h2 className="card-title">Connected accounts</h2>
                      </div>
                    </div>
                    {['google','microsoft'].map(p=>{
                      const acc=connAcc(p); return (
                      <div key={p} className="provider-row">
                        <div className="provider-logo"><ProviderLogo p={p}/></div>
                        <div className="provider-info">
                          <div className="provider-name">{p.charAt(0).toUpperCase()+p.slice(1)}</div>
                          <div className="provider-sub">{acc?acc.provider_email||'Connected':connecting===p?'Connecting…':'Not connected'}</div>
                        </div>
                        {acc
                          ? <button className="btn btn--soft-danger btn--sm" onClick={()=>disconnectProvider(p)}>Disconnect</button>
                          : <button className="btn btn--soft-primary btn--sm" onClick={()=>connectProvider(p)} disabled={!!connecting}>
                              {connecting===p?'…':'Connect'}
                            </button>
                        }
                      </div>
                    );})}
                  </section>

                  {/* Breach summary */}
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Monitoring</span>
                        <h2 className="card-title">Breach exposure</h2>
                      </div>
                      <button className="card-action" onClick={()=>setTab('monitor')}>
                        Details <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                    {breaches.length===0
                      ? <div className="adm-alert success"><CheckCircle size={15}/><div><strong>All clear.</strong> No data breaches detected for your email.</div></div>
                      : breaches.slice(0,5).map((b,i)=>(
                        <div key={i} className="event-row">
                          <div className="event-dot danger"/>
                          <div>
                            <div className="event-text">{b.Name||b.title||'Unknown breach'}</div>
                            <div className="event-sub">{b.BreachDate||b.date||'Unknown date'} · {b.PwnCount?.toLocaleString?.()||'?'} records</div>
                          </div>
                          <span className="badge danger">Exposed</span>
                        </div>
                      ))
                    }
                  </section>
                </div>
              </>
            )}

            {/* ── EMAIL SECURITY ── */}
            {tab==='email' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Email Security</span>
                    <h1 className="hero-title">Email <span className="accent">Protection</span></h1>
                    <p className="hero-sub">Monitor your email's security posture, DNS records, and breach exposure.</p>
                  </div>
                </section>
                <div className="grid">
                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">DNS + Authentication</span>
                        <h2 className="card-title">Email security posture</h2>
                      </div>
                    </div>
                    {!emailSec
                      ? <div className="adm-alert info"><Mail size={15}/><div>Email security analysis will appear here once your backend returns data.</div></div>
                      : (
                        <div className="grid" style={{marginBottom:0}}>
                          {[
                            {label:'SPF Record',   val:emailSec.spf?.exists,   ok:emailSec.spf?.valid,   detail:emailSec.spf?.record||'—'},
                            {label:'DKIM Record',  val:emailSec.dkim?.exists,  ok:emailSec.dkim?.valid,  detail:emailSec.dkim?.record||'—'},
                            {label:'DMARC Record', val:emailSec.dmarc?.exists, ok:emailSec.dmarc?.valid, detail:emailSec.dmarc?.record||'—'},
                          ].map(r=>(
                            <div key={r.label} className="col-4 card" style={{boxShadow:'none',border:'1px solid var(--border-soft)'}}>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                                <div style={{fontSize:13,fontWeight:600,color:'var(--t-base)'}}>{r.label}</div>
                                <span className={`badge ${r.ok?'success':'danger'}`}>{r.ok?'Pass':'Fail'}</span>
                              </div>
                              <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'var(--t-muted)',wordBreak:'break-all',lineHeight:1.6}}>{r.detail}</div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  </section>
                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Breach Monitoring</span>
                        <h2 className="card-title">Known breaches</h2>
                      </div>
                    </div>
                    {breaches.length===0
                      ? <div className="adm-alert success"><CheckCircle size={15}/><div><strong>Great news.</strong> Your email hasn't appeared in any known data breaches.</div></div>
                      : (
                        <table className="table">
                          <thead><tr><th>Service</th><th>Date</th><th>Records exposed</th><th>Severity</th></tr></thead>
                          <tbody>
                            {breaches.map((b,i)=>(
                              <tr key={i}>
                                <td className="cell-name">{b.Name||b.title||'Unknown'}</td>
                                <td className="cell-muted">{b.BreachDate||b.date||'—'}</td>
                                <td className="cell-mono">{b.PwnCount?.toLocaleString?.()||'—'}</td>
                                <td><span className={`tag ${severityTag(b.severity)}`}>{b.severity||'Unknown'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    }
                  </section>
                </div>
              </>
            )}

            {/* ── VAULT ── */}
            {tab==='vault' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Encrypted Vault</span>
                    <h1 className="hero-title">Secure <span className="accent">File Vault</span></h1>
                    <p className="hero-sub">Store and manage your encrypted files. All data is encrypted at rest.</p>
                  </div>
                  <div className="hero-actions">
                    <button className="btn btn--primary" onClick={()=>fileRef.current?.click()}>
                      <Upload size={14}/> Upload file
                    </button>
                    <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={e=>upload(Array.from(e.target.files||[]))}/>
                  </div>
                </section>
                <div className="grid">
                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Vault</span>
                        <h2 className="card-title">Encrypted files — {vault.length} stored</h2>
                      </div>
                    </div>
                    {uploadErr && <div className="adm-alert danger" style={{marginBottom:16}}><AlertTriangle size={15}/>{uploadErr}</div>}
                    <div className={`dropzone${drag?' active':''}`}
                      onDragOver={e=>{e.preventDefault();setDrag(true);}}
                      onDragLeave={()=>setDrag(false)}
                      onDrop={e=>{e.preventDefault();setDrag(false);upload(Array.from(e.dataTransfer.files));}}
                      onClick={()=>fileRef.current?.click()}>
                      <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                      <p><strong>Click to upload</strong> or drag and drop files here.<br/><span style={{fontSize:12}}>All files are encrypted end-to-end.</span></p>
                    </div>
                    <div style={{marginTop:20}}>
                      {vault.length===0
                        ? <p style={{textAlign:'center',color:'var(--t-muted)',fontSize:13,padding:'24px 0'}}>No files in your vault yet.</p>
                        : vault.map(f=>(
                          <div key={f.id} className="file-row">
                            <div className="file-icon">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                            </div>
                            <div className="file-meta">
                              <div className="file-name">{f.file_name}</div>
                              <div className="file-size">{fmt(f.size_bytes)} · {f.uploaded_at?fmtDate(f.uploaded_at):'uploading…'}</div>
                              {f.status==='uploading' && f.progress!=null && (
                                <div className="progress" style={{marginTop:6}}>
                                  <div className="progress-fill gradient" style={{width:`${f.progress}%`}}/>
                                </div>
                              )}
                            </div>
                            <span className={`badge ${f.status==='secured'?'success':f.status==='failed'?'danger':'info'}`}>{f.status}</span>
                            {f.status!=='uploading' && (
                              <button className="icon-btn" onClick={()=>deleteFile(f.id)} title="Delete">
                                <Trash2 size={15}/>
                              </button>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  </section>
                </div>
              </>
            )}

            {/* ── MONITOR ── */}
            {tab==='monitor' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Security Monitor</span>
                    <h1 className="hero-title">Threat <span className="accent">Intelligence</span></h1>
                    <p className="hero-sub">Real-time security events, login activity, and breach monitoring for your account.</p>
                  </div>
                  <div className="hero-actions">
                    <button className="btn btn--ghost" onClick={()=>loadAll(true)}>
                      <RefreshCw size={14}/> Refresh
                    </button>
                  </div>
                </section>
                <div className="grid">
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Activity Log</span>
                        <h2 className="card-title">Security events</h2>
                      </div>
                    </div>
                    {events.length===0
                      ? <p style={{color:'var(--t-muted)',fontSize:13,textAlign:'center',padding:'24px 0'}}>No events recorded.</p>
                      : events.map((ev,i)=>(
                        <div key={i} className="event-row">
                          <div className={`event-dot ${eventDot(ev.event_type)}`}/>
                          <div>
                            <div className="event-text">{ev.event_type||'Security event'}</div>
                            <div className="event-sub">{[ev.ip_address,ev.user_agent?.slice(0,30)].filter(Boolean).join(' · ')||'—'}</div>
                          </div>
                          <div className="event-time">{ago(ev.created_at||ev.timestamp)}</div>
                        </div>
                      ))
                    }
                  </section>

                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Data Breaches</span>
                        <h2 className="card-title">Breach exposure</h2>
                      </div>
                    </div>
                    {breaches.length===0
                      ? <div className="adm-alert success"><CheckCircle size={15}/><div><strong>All clear.</strong> No breaches found for your email address.</div></div>
                      : breaches.map((b,i)=>(
                        <div key={i} className="event-row">
                          <div className="event-dot danger"/>
                          <div>
                            <div className="event-text">{b.Name||b.title||'Unknown breach'}</div>
                            <div className="event-sub">{b.BreachDate||b.date||'—'} · {b.Description?.slice?.(0,60)||'Data exposed'}</div>
                          </div>
                          <span className={`tag ${severityTag(b.severity)}`}>{b.severity||'—'}</span>
                        </div>
                      ))
                    }
                  </section>

                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Sessions</span>
                        <h2 className="card-title">Active sessions</h2>
                      </div>
                    </div>
                    {(dash?.sessions||[]).length===0
                      ? <p style={{color:'var(--t-muted)',fontSize:13,textAlign:'center',padding:'24px 0'}}>No session data available.</p>
                      : (dash.sessions||[]).map((s,i)=>(
                        <div key={i} className="session-row">
                          <div className="session-icon"><Smartphone size={16}/></div>
                          <div className="session-meta">
                            <div className="session-name">{s.device||s.user_agent?.slice(0,40)||'Unknown device'}</div>
                            <div className="session-sub">{s.ip_address||'—'} · {ago(s.created_at||s.last_seen)}</div>
                          </div>
                          <span className="badge success dot">Active</span>
                        </div>
                      ))
                    }
                  </section>
                </div>
              </>
            )}

            {/* ── SETTINGS ── */}
            {tab==='settings' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Account</span>
                    <h1 className="hero-title">Account <span className="accent">Settings</span></h1>
                    <p className="hero-sub">Manage your profile, appearance, and account security preferences.</p>
                  </div>
                </section>
                <div className="grid">
                  <section className="col-8 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Profile</span>
                        <h2 className="card-title">Personal information</h2>
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label className="field-label">Full name</label>
                        <input className="input" value={profForm.full_name} onChange={e=>setProfForm(p=>({...p,full_name:e.target.value}))} placeholder="Your name"/>
                      </div>
                      <div className="field">
                        <label className="field-label">Phone number</label>
                        <input className="input" value={profForm.phone} onChange={e=>setProfForm(p=>({...p,phone:e.target.value}))} placeholder="+1 555 0100"/>
                      </div>
                      <div className="field">
                        <label className="field-label">Country</label>
                        <select className="adm-select input" value={profForm.country} onChange={e=>setProfForm(p=>({...p,country:e.target.value}))}>
                          <option value="">Select country…</option>
                          {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Date of birth</label>
                        <input className="input" type="date" value={profForm.date_of_birth} onChange={e=>setProfForm(p=>({...p,date_of_birth:e.target.value}))}/>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn btn--primary" onClick={saveProfile} disabled={profSaving}>
                        {profSaving?'Saving…':profSaved?'Saved ✓':'Save changes'}
                      </button>
                    </div>
                  </section>

                  <section className="col-4 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Appearance</span>
                        <h2 className="card-title">Theme</h2>
                      </div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={theme==='dark'} onChange={toggleTheme}/>
                      <span className="track"/>
                      <span>{theme==='dark'?'Dark mode':'Light mode'}</span>
                    </label>
                    <div className="sv-divider"/>
                    <div className="card-head" style={{border:0,padding:'0 0 12px',margin:0}}>
                      <div className="card-title-wrap">
                        <span className="eyebrow">Danger Zone</span>
                        <h2 className="card-title" style={{fontSize:14}}>Account actions</h2>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <button className="btn btn--soft-danger" style={{justifyContent:'center'}} onClick={()=>onLogout?.()}>
                        <LogOut size={14}/> Sign out
                      </button>
                      <button className="btn btn--ghost btn--sm" style={{justifyContent:'center'}} onClick={()=>onLogout?.(true)}>
                        Sign out all devices
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )}

          </main>

          {/* Footer */}
          <footer className="d-footer">
            <span>© {new Date().getFullYear()} SyncVeil Inc. All rights reserved.</span>
            <div className="d-footer-meta">
              <span>SECURITY</span>
              <span>·</span>
              <span>ENCRYPTED</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
