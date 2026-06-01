import React, { useState } from 'react';
import '../adminator.css';

export default function Navigation({ onSwitchView, isAuthenticated }) {
  const [open, setOpen] = useState(false);

  return (
    <nav style={{
      background: 'white',
      borderBottom: '1px solid var(--border, #E4E8EF)',
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'saturate(140%) blur(8px)',
    }}>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'0 24px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between'}}>

        {/* Brand */}
        <button
          onClick={() => onSwitchView('home')}
          style={{display:'flex',alignItems:'center',gap:10,border:'none',background:'none',cursor:'pointer',padding:0}}
        >
          <div style={{width:32,height:32,background:'#2563EB',borderRadius:8,display:'grid',placeItems:'center',boxShadow:'0 4px 10px -2px rgba(37,99,235,0.35)'}}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span style={{fontFamily:"'Inter Tight',sans-serif",fontWeight:700,fontSize:16,letterSpacing:'-0.02em',color:'#1E293B'}}>SyncVeil</span>
        </button>

        {/* Desktop nav */}
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {[
            {label:'Product', action:()=>onSwitchView('home')},
            {label:'Security', action:()=>{ const el=document.getElementById('features'); el?.scrollIntoView({behavior:'smooth'}); }},
            {label:'Privacy Policy', action:()=>onSwitchView('info')},
          ].map(item=>(
            <button key={item.label} onClick={item.action} style={{padding:'7px 14px',borderRadius:8,border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:500,color:'#64748B',transition:'background 160ms,color 160ms'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#F1F5F9';e.currentTarget.style.color='#1E293B';}}
              onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='#64748B';}}>
              {item.label}
            </button>
          ))}
          {!isAuthenticated && (
            <button
              onClick={() => onSwitchView('auth-choice')}
              style={{marginLeft:8,padding:'8px 18px',background:'#2563EB',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,transition:'background 180ms'}}
              onMouseEnter={e=>e.currentTarget.style.background='#1D4ED8'}
              onMouseLeave={e=>e.currentTarget.style.background='#2563EB'}
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button onClick={()=>setOpen(o=>!o)} style={{display:'none',border:'none',background:'none',cursor:'pointer',padding:6,borderRadius:8,color:'#64748B',lineHeight:0}} className="nav-hamburger">
          {open
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          }
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{borderTop:'1px solid #E4E8EF',padding:'12px 24px 16px',display:'flex',flexDirection:'column',gap:4}}>
          {[
            {label:'Product',     action:()=>{setOpen(false);onSwitchView('home');}},
            {label:'Privacy Policy',action:()=>{setOpen(false);onSwitchView('info');}},
          ].map(item=>(
            <button key={item.label} onClick={item.action} style={{padding:'10px 12px',textAlign:'left',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:500,color:'#64748B',borderRadius:8}}>
              {item.label}
            </button>
          ))}
          {!isAuthenticated && (
            <button onClick={()=>{setOpen(false);onSwitchView('auth-choice');}} style={{marginTop:8,padding:'10px 12px',background:'#2563EB',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,textAlign:'center'}}>
              Sign In
            </button>
          )}
        </div>
      )}

      <style>{`.nav-hamburger { display: none !important; } @media(max-width:640px){ .nav-hamburger { display: block !important; } }`}</style>
    </nav>
  );
}
