'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, signOut } from '../lib/firebase';

// ── Global helpers ──
async function loadProviderFromFirestore(uid) {
  try {
    const { db } = await import('../lib/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'app'));
    return snap.exists() ? (snap.data().apiProvider || 'openrouter') : 'openrouter';
  } catch { return 'openrouter'; }
}

async function saveProviderToFirestore(uid, provider) {
  try {
    const { db } = await import('../lib/firebase');
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid, 'settings', 'app'), { apiProvider: provider }, { merge: true });
  } catch {}
}

// ── Global provider getter — route.js ke liye ──
// Yeh function globally available hai — fetch calls isme se provider lete hain
export function getActiveProvider() {
  if (typeof window !== 'undefined') {
    return window.__aiProvider || 'openrouter';
  }
  return 'openrouter';
}

export default function SideDrawer({ open, onClose, user }) {
  const router = useRouter();
  const [apiProvider, setApiProvider] = useState(() => {
    // Initial value — window se lo agar already set hai
    if (typeof window !== 'undefined' && window.__aiProvider) {
      return window.__aiProvider;
    }
    return 'openrouter';
  });
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);

  // ── App load pe Firestore se provider fetch karo ──
  useEffect(() => {
    if (!user?.uid) return;
    loadProviderFromFirestore(user.uid).then(p => {
      setApiProvider(p);
      // Window pe set karo — saari fetch calls yahan se padhengi
      if (typeof window !== 'undefined') window.__aiProvider = p;
    });
  }, [user?.uid]);

  async function toggleProvider(val) {
    if (val === apiProvider || providerLoading) return;
    setProviderLoading(true);
    setProviderSaved(false);
    // Turant update karo — window aur state dono
    setApiProvider(val);
    if (typeof window !== 'undefined') window.__aiProvider = val;
    // Firestore mein save karo
    await saveProviderToFirestore(user?.uid, val);
    setProviderLoading(false);
    setProviderSaved(true);
    setTimeout(() => setProviderSaved(false), 2000);
  }

  // Close on ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Swipe-to-open
  useEffect(() => {
    let startX = 0, startY = 0;
    const onStart = (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; };
    const onEnd = (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (startX < 24 && dx > 60 && dy < 80) onClose();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend',   onEnd);
    };
  }, [onClose]);

  function go(path) { onClose(); router.push(path); }

  async function logout() {
    if (!confirm('Logout karna chahte ho?')) return;
    await signOut(auth);
  }

  const displayName = user?.displayName || user?.email || 'User';
  const email       = user?.email || '';
  const initial     = displayName.charAt(0).toUpperCase();
  const colors      = ['#8800aa','#c0392b','#1a6b8a','#27ae60','#d35400','#8e44ad'];
  const avatarColor = colors[initial.charCodeAt(0) % colors.length];

  const isGemini = apiProvider === 'gemini';

  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(2px)' }} />
      )}

      <div style={{
        position:'fixed', top:0, left:0, bottom:0, width:270, zIndex:1200,
        background:'#0d000d', borderRight:'1px solid #2a0022',
        display:'flex', flexDirection:'column',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 12px', borderBottom:'1px solid #1a0015' }}>
          <span style={{ fontFamily:"'Cinzel Decorative', serif", fontSize:13, fontWeight:900, color:'#cc2233', letterSpacing:2 }}>💀 KAALI RAAT</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#444', fontSize:16, cursor:'pointer', padding:'4px 6px', borderRadius:6 }}>✕</button>
        </div>

        {/* Profile */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:16 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background: user?.photoURL ? 'transparent' : avatarColor, border:'2px solid #550044', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            {user?.photoURL
              ? <img src={user.photoURL} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ color:'#fff', fontWeight:700, fontSize:16 }}>{initial}</span>
            }
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#ddd', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{displayName}</div>
            <div style={{ fontSize:11, color:'#555', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:2 }}>{email}</div>
          </div>
        </div>

        <div style={{ height:1, background:'#1a0015' }} />

        {/* Nav */}
        <nav style={{ display:'flex', flexDirection:'column', padding:8, gap:2, flex:1, overflowY:'auto' }}>
          {[
            { icon:'✍️', label:'Generate Story', path:'/generate' },
            { icon:'📚', label:'My Stories',     path:'/my-stories' },
            { icon:'▶',  label:'YouTube Export', path:'/youtube', iconStyle:{ color:'#ff4444' } },
          ].map(item => (
            <button key={item.path} onClick={() => go(item.path)}
              style={{ display:'flex', alignItems:'center', gap:12, background:'none', border:'none', color:'#888', fontSize:14, fontFamily:"'Noto Sans Devanagari', sans-serif", padding:'12px 14px', borderRadius:10, cursor:'pointer', textAlign:'left' }}>
              <span style={item.iconStyle}>{item.icon}</span> {item.label}
            </button>
          ))}

          {/* ── AI Provider Toggle ── */}
          <div style={{ margin:'10px 6px 0', background:'#080008', border:`1px solid ${isGemini?'#004433':'#2a0018'}`, borderRadius:12, padding:'12px 12px', transition:'border-color 0.3s' }}>

            {/* Header row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:10, color:'#550033', letterSpacing:1.5, textTransform:'uppercase', fontWeight:700 }}>⚡ AI Provider</div>
              {providerLoading && <div style={{ fontSize:9, color:'#444' }}>saving...</div>}
              {providerSaved && <div style={{ fontSize:9, color:'#00aa66' }}>✓ saved!</div>}
            </div>

            {/* Toggle pill */}
            <div style={{ display:'flex', background:'#0d000d', borderRadius:8, padding:3, border:'1px solid #1a0012', marginBottom:10 }}>
              <div onClick={() => toggleProvider('openrouter')} style={{
                flex:1, textAlign:'center', padding:'8px 4px', borderRadius:6, cursor:'pointer',
                background: !isGemini ? 'linear-gradient(135deg,#440011,#220008)' : 'transparent',
                border: !isGemini ? '1px solid #880022' : '1px solid transparent',
                transition:'all 0.2s',
              }}>
                <div style={{ fontSize:11, fontWeight:700, color: !isGemini ? '#ee3355' : '#444' }}>OpenRouter</div>
                <div style={{ fontSize:9, color: !isGemini ? '#882233' : '#333', marginTop:2 }}>Paid</div>
              </div>
              <div onClick={() => toggleProvider('gemini')} style={{
                flex:1, textAlign:'center', padding:'8px 4px', borderRadius:6, cursor:'pointer',
                background: isGemini ? 'linear-gradient(135deg,#003322,#001a11)' : 'transparent',
                border: isGemini ? '1px solid #006644' : '1px solid transparent',
                transition:'all 0.2s',
              }}>
                <div style={{ fontSize:11, fontWeight:700, color: isGemini ? '#00cc88' : '#444' }}>Gemini</div>
                <div style={{ fontSize:9, color: isGemini ? '#005533' : '#333', marginTop:2 }}>Free ✨</div>
              </div>
            </div>

            {/* Status line */}
            <div style={{
              fontSize:10, textAlign:'center', padding:'6px 8px', borderRadius:6,
              background: isGemini ? 'rgba(0,100,60,0.15)' : 'rgba(100,0,20,0.15)',
              color: isGemini ? '#00aa66' : '#aa2233',
              border: `1px solid ${isGemini ? '#003322' : '#330011'}`,
            }}>
              {isGemini ? '✅ Google Gemini active — free hai!' : '⚠️ OpenRouter active — credits chahiye'}
            </div>
          </div>
        </nav>

        <div style={{ height:1, background:'#1a0015' }} />

        {/* Footer */}
        <div style={{ padding:'12px 16px 24px', display:'flex', flexDirection:'column', gap:8 }}>
          <button onClick={logout}
            style={{ background:'#1a0008', border:'1px solid #440022', color:'#cc4455', padding:'10px 16px', borderRadius:10, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans Devanagari', sans-serif", textAlign:'left' }}>
            🚪 Logout
          </button>
          <div style={{ fontSize:10, color:'#2a2a2a', textAlign:'center' }}>Kaali Raat v1.0</div>
        </div>
      </div>
    </>
  );
}
