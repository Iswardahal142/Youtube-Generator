'use client';

import { useState } from 'react';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider } from '../../components/Toast';
import { auth, signOut } from '../../lib/firebase';

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
