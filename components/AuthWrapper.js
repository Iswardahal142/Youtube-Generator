'use client';

import { useState, useEffect } from 'react';
import {
  auth, provider, ALLOWED_EMAILS,
  signInWithPopup, signOut, onAuthStateChanged,
} from '../lib/firebase';
import { AppStateProvider } from '../lib/state';

export default function AuthWrapper({ children }) {
  const [status, setStatus]   = useState('loading'); // loading | auth | app
  const [user,   setUser]     = useState(null);
  const [error,  setError]    = useState('');
  const [btnBusy, setBtnBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(u.email)) {
          await signOut(auth);
          setStatus('auth');
          setError('❌ Is email ko access nahi hai.');
          return;
        }
        setUser(u);
        setStatus('app');
      } else {
        setUser(null);
        setStatus('auth');
      }
    });
    return unsub;
  }, []);

  async function googleLogin() {
    setBtnBusy(true);
    setError('');
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      let msg = 'Login fail. Dobara try karo.';
      if (e.code === 'auth/popup-closed-by-user')  msg = 'Popup band kar diya.';
      if (e.code === 'auth/network-request-failed') msg = 'Internet check karo.';
      if (e.code === 'auth/popup-blocked')          msg = 'Popup block hai — browser mein allow karo.';
      setError('⚠️ ' + msg);
    } finally {
      setBtnBusy(false);
    }
  }

  // ── Loading Screen ────────────────────────────
  if (status === 'loading') {
    return (
      <div style={styles.centerScreen}>
        <span style={styles.skull}>💀</span>
        <span style={styles.brandName}>KAALI RAAT</span>
        <span style={styles.brandTag}>Horror Story Studio</span>
        <div style={styles.dots}>
          <span style={{ ...styles.dot, animationDelay: '0s' }} />
          <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
          <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
        </div>
        <style>{dotAnim}</style>
      </div>
    );
  }

  // ── Auth Screen ───────────────────────────────
  if (status === 'auth') {
    return (
      <div style={styles.centerScreen}>
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 340 }}>
          <span style={styles.skull}>💀</span>
          <span style={styles.brandName}>KAALI RAAT</span>
          <span style={styles.brandTag}>Horror Story Studio</span>

          <div style={styles.authCard}>
            <p style={styles.authSubtitle}>
              Apne Google account se directly login karo — koi registration nahi, koi password nahi. 🎃
            </p>
            <button
              onClick={googleLogin}
              disabled={btnBusy}
              style={styles.googleBtn}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.3 30.2 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.8 6c1.8-5.4 6.8-9.8 13.5-9.8z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.3-4 6.8-9.9 7.2-16.6z"/>
                <path fill="#FBBC05" d="M10.5 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6.1z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.6 0-12.2-4.5-14.2-10.4l-7.8 6.1C6.7 42.6 14.7 48 24 48z"/>
              </svg>
              {btnBusy ? '⏳ Login ho raha hai...' : '🔐 Google se Login Karo'}
            </button>
            {error && <div style={styles.authError}>{error}</div>}
          </div>

          <p style={styles.authFooter}>
            Sirf authorized users hi access kar sakte hain.<br />
            Pehli baar bhi Google se seedha login hoga — registration nahi.
          </p>
        </div>
      </div>
    );
  }

  // ── App ───────────────────────────────────────
  return (
    <AppStateProvider uid={user?.uid}>
      {children({ user })}
    </AppStateProvider>
  );
}

// ── Inline styles (auth screens only — rest is globals.css) ──
const styles = {
  centerScreen: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      '100dvh',
    background:     '#0a000a',
    padding:        24,
    gap:            8,
  },
  skull:     { fontSize: 52, display: 'block', marginBottom: 8 },
  brandName: {
    fontFamily:  "'Cinzel Decorative', serif",
    fontSize:    22,
    fontWeight:  900,
    color:       '#cc2222',
    letterSpacing: 3,
    display:     'block',
    marginBottom: 4,
  },
  brandTag: {
    fontSize:      10,
    color:         '#444',
    letterSpacing: 3,
    textTransform: 'uppercase',
    display:       'block',
    marginBottom:  36,
  },
  dots: { display: 'inline-flex', gap: 6, marginTop: 8 },
  dot:  {
    width:        6,
    height:       6,
    background:   '#550022',
    borderRadius: '50%',
    animation:    'dotPulse 1.2s ease-in-out infinite',
  },
  authCard: {
    background:   '#110011',
    border:       '1px solid #330033',
    borderRadius: 18,
    padding:      '30px 24px',
    textAlign:    'center',
  },
  authSubtitle: {
    fontSize:     13,
    color:        '#777',
    lineHeight:   1.7,
    marginBottom: 24,
  },
  googleBtn: {
    width:          '100%',
    padding:        14,
    background:     '#fff',
    color:          '#111',
    border:         'none',
    borderRadius:   10,
    fontSize:       14,
    fontWeight:     700,
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    fontFamily:     "'Noto Sans Devanagari', sans-serif",
  },
  authError: {
    marginTop:    14,
    padding:      '10px 12px',
    background:   'rgba(204,0,0,0.1)',
    border:       '1px solid #440000',
    borderRadius: 8,
    color:        '#ff6666',
    fontSize:     12,
    lineHeight:   1.5,
  },
  authFooter: {
    marginTop:  20,
    fontSize:   11,
    color:      '#333',
    lineHeight: 1.7,
  },
};

const dotAnim = `
@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1); }
}
`;
