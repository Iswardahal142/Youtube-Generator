'use client';

import { useState, useEffect } from 'react';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider } from '../../components/Toast';
import { auth, signOut } from '../../lib/firebase';

/* ── tiny helpers ── */
const fmt = n => n >= 1_000_000 ? (n/1_000_000).toFixed(1)+'M' : n >= 1_000 ? (n/1_000).toFixed(1)+'K' : String(n);
const ago = s => { const d=Math.floor((Date.now()-new Date(s))/86400000); return d===0?'Today':d===1?'Yesterday':`${d}d ago`; };

/* ── YouTube section ── */
function YoutubeSection() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [open,    setOpen]    = useState(false);

  async function load() {
    if (data) { setOpen(o => !o); return; }
    setLoading(true); setError(null); setOpen(true);
    try {
      const res = await fetch('/api/youtube');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const topVideo = data?.videos?.reduce((a,b) => b.viewCount > a.viewCount ? b : a, data.videos[0]);
  const totalViews = data?.videos?.reduce((s,v) => s + v.viewCount, 0) || 0;
  const totalLikes = data?.videos?.reduce((s,v) => s + v.likeCount, 0) || 0;

  return (
    <div style={{ width:'100%', maxWidth:340, marginTop:16 }}>
      {/* toggle button */}
      <button
        onClick={load}
        style={{
          width:'100%', padding:'12px 16px',
          background: open ? '#0d001a' : '#110022',
          border:'1px solid #440066', borderRadius:12,
          color:'#cc88ff', fontSize:14, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'space-between'
        }}
      >
        <span>📺 YouTube Channel Stats</span>
        <span style={{ fontSize:10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ background:'#0a0015', border:'1px solid #330044', borderTop:'none', borderRadius:'0 0 12px 12px', padding:14 }}>

          {loading && (
            <div style={{ textAlign:'center', color:'#770099', fontSize:13, padding:'12px 0' }}>
              ⏳ Loading...
            </div>
          )}

          {error && (
            <div style={{ color:'#cc2233', fontSize:12, textAlign:'center', padding:'8px 0' }}>
              ❌ {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* channel name */}
              <div style={{ fontSize:13, fontWeight:700, color:'#ee88ff', marginBottom:10, textAlign:'center' }}>
                📡 {data.channelName}
              </div>

              {/* summary stats */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {[
                  { label:'Total Views', val: fmt(totalViews), icon:'👁️' },
                  { label:'Total Likes', val: fmt(totalLikes), icon:'👍' },
                  { label:'Videos',      val: data.videos.length, icon:'🎬' },
                  { label:'Top Video',   val: fmt(topVideo?.viewCount||0), icon:'🔥' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#150025', border:'1px solid #330044', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                    <div style={{ fontSize:16 }}>{s.icon}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#dd99ff' }}>{s.val}</div>
                    <div style={{ fontSize:10, color:'#554466' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* latest upload */}
              {data.lastVideo && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'#553366', marginBottom:6 }}>🆕 LATEST UPLOAD</div>
                  <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'#110022', border:'1px solid #2a0033', borderRadius:8, padding:8 }}>
                    {data.lastVideo.thumbnail && (
                      <img src={data.lastVideo.thumbnail} alt="" style={{ width:72, height:48, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:'#ddc', fontWeight:600, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                        {data.lastVideo.title}
                      </div>
                      <div style={{ fontSize:10, color:'#554466', marginTop:4 }}>
                        👁️ {fmt(data.lastVideo.viewCount)} · 👍 {fmt(data.lastVideo.likeCount)} · {ago(data.lastVideo.publishedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* top 5 videos */}
              <div>
                <div style={{ fontSize:11, color:'#553366', marginBottom:6 }}>🔥 TOP 5 VIDEOS</div>
                {[...data.videos]
                  .sort((a,b) => b.viewCount - a.viewCount)
                  .slice(0,5)
                  .map((v,i) => (
                    <a
                      key={v.videoId}
                      href={`https://www.youtube.com/watch?v=${v.videoId}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid #1a0022', textDecoration:'none' }}
                    >
                      <span style={{ fontSize:11, color:'#660077', width:14, flexShrink:0 }}>#{i+1}</span>
                      <span style={{ flex:1, fontSize:11, color:'#ccaadd', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{v.title}</span>
                      <span style={{ fontSize:10, color:'#664477', flexShrink:0 }}>👁️{fmt(v.viewCount)}</span>
                    </a>
                  ))
                }
              </div>

              <button
                onClick={() => { setData(null); setOpen(false); }}
                style={{ marginTop:12, width:'100%', padding:'8px', background:'transparent', border:'1px solid #330033', borderRadius:8, color:'#553344', fontSize:11, cursor:'pointer' }}
              >
                ↺ Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── main profile ── */
function ProfilePage({ user }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const displayName = user?.displayName || user?.email || 'User';
  const email       = user?.email || '';
  const initial     = displayName.charAt(0).toUpperCase();
  const colors      = ['#8800aa','#c0392b','#1a6b8a','#27ae60','#d35400','#8e44ad'];
  const avatarColor = colors[initial.charCodeAt(0) % colors.length];

  async function logout() {
    if (!confirm('Logout karna chahte ho?')) return;
    await signOut(auth);
  }

  return (
    <>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />

      <div className="page-content" style={{ background: 'var(--void)' }}>
        <div className="mini-topbar">
          <button className="hamburger-btn" onClick={() => setDrawerOpen(true)}>☰</button>
          <span className="mini-topbar-title">👤 Profile</span>
          <div style={{ width: 36 }} />
        </div>

        <div className="profile-content">
          {/* Avatar */}
          <div style={{ marginTop:12 }}>
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', border:'3px solid #550044', display:'block' }}
              />
            ) : (
              <div style={{ width:80, height:80, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:700, color:'#fff', background:avatarColor, border:'3px solid #aa00dd' }}>
                {initial}
              </div>
            )}
          </div>

          <div style={{ fontSize:18, fontWeight:700, color:'#ddd', textAlign:'center' }}>{displayName}</div>
          <div style={{ fontSize:12, color:'#555', textAlign:'center', marginTop:-10 }}>{email}</div>

          {/* Info card */}
          <div className="profile-card">
            <div className="profile-card-row">
              <span className="profile-card-label">📧 Email</span>
              <span className="profile-card-value">{email}</span>
            </div>
            <div className="profile-card-row">
              <span className="profile-card-label">🔐 Login</span>
              <span className="profile-card-value">Google Account</span>
            </div>
          </div>

          {/* ── YouTube Channel Analyser ── */}
          <YoutubeSection />

          {/* Logout */}
          <button
            onClick={logout}
            style={{ width:'100%', maxWidth:340, padding:14, background:'#1a0008', border:'1px solid #550022', color:'#cc4455', borderRadius:12, fontSize:14, fontFamily:"'Noto Sans Devanagari', sans-serif", cursor:'pointer', marginTop:8 }}
          >
            🚪 Logout
          </button>

          {/* App info */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, marginTop:12, paddingBottom:16 }}>
            <span style={{ fontFamily:"'Cinzel Decorative', serif", fontSize:14, color:'#cc2233', fontWeight:900 }}>💀 KAALI RAAT</span>
            <span style={{ fontSize:10, color:'#2a2a2a' }}>Horror Story Studio · v1.0 (Next.js)</span>
          </div>
        </div>
      </div>

      <BottomNav userInitial={initial} />
    </>
  );
}

export default function ProfilePageWrapper() {
  return (
    <ToastProvider>
      <AuthWrapper>
        {({ user }) => <ProfilePage user={user} />}
      </AuthWrapper>
    </ToastProvider>
  );
}
