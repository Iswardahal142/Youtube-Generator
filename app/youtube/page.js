'use client';

import { useState, useEffect } from 'react';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider, useToast } from '../../components/Toast';

function YoutubePage({ user }) {
  const toast       = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // State
  const [ytStatus,    setYtStatus]    = useState('loading'); // loading | ok | error
  const [lastVideo,   setLastVideo]   = useState(null);
  const [channelName, setChannelName] = useState('');
  const [checklist,   setChecklist]   = useState([false, false, false]);

  const [titlesLoading, setTitlesLoading] = useState(false);
  const [titles,        setTitles]        = useState([]);
  const [descLoading,   setDescLoading]   = useState(false);
  const [desc,          setDesc]          = useState('');
  const [thumbLoading,  setThumbLoading]  = useState(false);
  const [thumbResult,   setThumbResult]   = useState('');
  const [thumbInput,    setThumbInput]    = useState('');

  // Story state from Firestore
  const [storyTitle,  setStoryTitle]  = useState('');
  const [storyChunks, setStoryChunks] = useState([]);

  const displayName = user?.displayName || user?.email || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  const CHECKLIST_ITEMS = [
    { icon:'🎙', label:'Narration record / generate ho gayi' },
    { icon:'🎬', label:'Video edit aur render ho gaya' },
    { icon:'📤', label:'YouTube pe upload ho gaya' },
  ];

  // ── Load story state ───────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    import('../../lib/firebase').then(async ({ db_loadState }) => {
      const d = await db_loadState(user.uid);
      if (d) {
        setStoryTitle(d.title || '');
        setStoryChunks(d.storyChunks || []);
      }
    });
    fetchYtStatus();
  }, [user?.uid]);

  async function fetchYtStatus() {
    setYtStatus('loading');
    try {
      const res  = await fetch('/api/youtube');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setLastVideo(data.lastVideo || null);
      setChannelName(data.channelName || '');
      setYtStatus('ok');
    } catch {
      setYtStatus('error');
    }
  }

  const storyText = storyChunks.map(c => c.text).join('\n\n');

  // ── Generate YT Titles ─────────────────────────────
  async function generateYtTitles() {
    if (!storyText) { toast('⚠️ Pehle koi story generate karo!'); return; }
    setTitlesLoading(true);
    setTitles([]);
    try {
      const res  = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          max_tokens: 600,
          temperature: 0.9,
          messages: [{
            role: 'user',
            content: `Yeh Hindi horror story hai: "${storyTitle}"\n\nStory summary: ${storyText.slice(0, 500)}\n\nIs story ke liye 7 YouTube titles banao. High CTR, clickbait style, Hindi mein.\n\nRules:\n- Title Hindi/Hinglish mein ho\n- Shocking, mysterious, curiosity-gap\n- 8-12 words per title\n- Emojis zaroor use karo\n\nSirf JSON array: ["title1","title2","title3","title4","title5","title6","title7"]`,
          }],
        }),
      });
      const data   = await res.json();
      const raw    = data.choices?.[0]?.message?.content?.trim() || '[]';
      const clean  = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setTitles(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      toast('❌ Error: ' + err.message);
    }
    setTitlesLoading(false);
  }

  // ── Generate Description ───────────────────────────
  async function generateYtDesc() {
    if (!storyText) { toast('⚠️ Pehle koi story generate karo!'); return; }
    setDescLoading(true);
    setDesc('');
    try {
      const res  = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          max_tokens: 800,
          temperature: 0.7,
          messages: [{
            role: 'user',
            content: `Story: "${storyTitle}"\n\n${storyText.slice(0, 600)}\n\nIs YouTube video ke liye Hindi description + hashtags banao.\n\nFormat:\n- 3-4 para Hindi description (mystery/horror hook)\n- Subscribe CTA\n- 15-20 relevant hashtags\n\nSEO optimized. Ready-to-paste format.`,
          }],
        }),
      });
      const data = await res.json();
      setDesc(data.choices?.[0]?.message?.content?.trim() || '');
    } catch (err) {
      toast('❌ Error: ' + err.message);
    }
    setDescLoading(false);
  }

  // ── Enhance Thumbnail Prompt ───────────────────────
  async function enhanceThumbPrompt() {
    setThumbLoading(true);
    setThumbResult('');
    const inputPrompt = thumbInput || storyText.slice(0, 300);
    try {
      const res  = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          max_tokens: 300,
          temperature: 0.8,
          messages: [{
            role: 'user',
            content: `Basic prompt: "${inputPrompt}"\n\nIs basic prompt ko ek viral YouTube horror thumbnail image prompt mein enhance karo.\n\nRequirements:\n- Cinematic, dramatic, high-detail\n- Dark horror atmosphere\n- Face expressions of fear/shock\n- Red/dark color palette\n- Text overlay space\n- 16:9 YouTube thumbnail format\n- 80-100 words, English mein\n\nSirf enhanced prompt text do, koi explanation nahi.`,
          }],
        }),
      });
      const data = await res.json();
      setThumbResult(data.choices?.[0]?.message?.content?.trim() || '');
    } catch (err) {
      toast('❌ Error: ' + err.message);
    }
    setThumbLoading(false);
  }

  function copyText(text, label) {
    navigator.clipboard.writeText(text).then(() => toast(`✅ ${label} copy ho gaya!`));
  }

  // ── RENDER ─────────────────────────────────────────
  return (
    <>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />

      <div className="page-content" style={{ background: 'var(--void)' }}>
        <div className="mini-topbar">
          <button className="hamburger-btn" onClick={() => setDrawerOpen(true)}>☰</button>
          <span className="mini-topbar-title" style={{ color:'#ff4444' }}>▶ YouTube Export</span>
          <div style={{ width:36 }} />
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:12 }}>

          {/* YT Status Card */}
          <div className="analysis-generate-bar" style={{ background:'#080000', borderColor:'#440000' }}>
            {ytStatus === 'loading' && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:4, color:'#555', fontSize:12 }}>
                <div className="spinner" /> YouTube se check ho raha hai...
              </div>
            )}
            {ytStatus === 'error' && (
              <div style={{ fontSize:12, color:'#cc4444' }}>
                ❌ YouTube API connect nahi hua. .env.local mein keys check karo.
              </div>
            )}
            {ytStatus === 'ok' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {channelName && (
                  <div style={{ fontSize:10, color:'#ff4444', letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>
                    ▶ {channelName}
                  </div>
                )}
                {lastVideo ? (
                  <div>
                    <div style={{ fontSize:11, color:'#666', marginBottom:4 }}>Last upload:</div>
                    <div style={{ fontSize:13, color:'#ddd', fontWeight:600 }}>{lastVideo.title}</div>
                    <div style={{ fontSize:11, color:'#44bb66', marginTop:3 }}>
                      👁 {(lastVideo.viewCount||0).toLocaleString()} views
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:'#555' }}>Koi video nahi mila channel pe.</div>
                )}
              </div>
            )}
          </div>

          {/* Upload Checklist */}
          <CollapseCard title="✅ Upload Checklist" titleColor="#ff4444" defaultOpen>
            <div style={{ fontSize:11, color:'#444', marginBottom:10 }}>Upload ke pehle yeh check karo</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {CHECKLIST_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className={`yt-check-item${checklist[i] ? ' checked' : ''}`}
                  onClick={() => {
                    const updated = [...checklist];
                    updated[i] = !updated[i];
                    setChecklist(updated);
                  }}
                >
                  <span className="yt-check-icon">{checklist[i] ? '✅' : item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
            <div style={{ marginTop:12 }}>
              <div className="wc-track" style={{ height:5 }}>
                <div className="wc-fill" style={{ width: (checklist.filter(Boolean).length / 3 * 100) + '%', background:'linear-gradient(90deg,#440000,#ff4444)' }} />
              </div>
              <div style={{ marginTop:6, fontSize:11, color:'#666', textAlign:'center' }}>
                {checklist.filter(Boolean).length} / 3 complete
              </div>
            </div>
          </CollapseCard>

          {/* Title Generator */}
          <CollapseCard title="🎯 YouTube Title Generator" titleColor="#44bb66" bg="#000a00" borderColor="#003300" defaultOpen>
            <div style={{ fontSize:12, color:'#666', lineHeight:1.6, marginBottom:8 }}>7 clickbait Hindi titles AI se — high CTR ke liye</div>
            <button
              className="btn btn-primary"
              onClick={generateYtTitles}
              disabled={titlesLoading}
              style={{ background:'linear-gradient(135deg,#005500,#002200)', boxShadow:'0 4px 16px rgba(0,150,0,0.3)' }}
            >
              {titlesLoading ? <><div className="spinner" /> Generating...</> : '🎯 Titles Generate Karo'}
            </button>
            {titles.length > 0 && (
              <div className="yt-output-card">
                {titles.map((t, i) => (
                  <div key={i} className="yt-title-option">
                    <div className="yt-title-text">{t}</div>
                    <button className="yt-copy-btn" onClick={() => copyText(t, 'Title')}>📋 Copy</button>
                  </div>
                ))}
              </div>
            )}
          </CollapseCard>

          {/* Description Generator */}
          <CollapseCard title="📝 Description + Tags" titleColor="#4488ff" bg="#00000a" borderColor="#000033" defaultOpen>
            <div style={{ fontSize:12, color:'#666', lineHeight:1.6, marginBottom:8 }}>SEO-optimized Hindi description + hashtags ready-to-paste</div>
            <button
              className="btn btn-primary"
              onClick={generateYtDesc}
              disabled={descLoading}
              style={{ background:'linear-gradient(135deg,#000055,#000033)', boxShadow:'0 4px 16px rgba(0,0,150,0.3)' }}
            >
              {descLoading ? <><div className="spinner" /> Generating...</> : '📝 Description Generate Karo'}
            </button>
            {desc && (
              <div className="yt-output-card">
                <div className="yt-desc-box">{desc}</div>
                <button className="yt-copy-btn" onClick={() => copyText(desc, 'Description')}>📋 Copy Karo</button>
              </div>
            )}
          </CollapseCard>

          {/* Thumbnail Enhancer */}
          <CollapseCard title="🖼 Thumbnail Prompt Enhancer" titleColor="#cc88ff" bg="#0a000a" borderColor="#330033" defaultOpen>
            <div style={{ fontSize:12, color:'#666', lineHeight:1.6, marginBottom:8 }}>Basic image prompt → YouTube viral thumbnail prompt</div>
            <textarea
              value={thumbInput}
              onChange={e => setThumbInput(e.target.value)}
              placeholder="Koi bhi image prompt yahan paste karo (ya khali chhodo — story se auto banao)..."
              rows={3}
              style={{ background:'#0f0f0f', border:'1px solid #330033', color:'var(--bone)', padding:'10px 12px', borderRadius:8, fontSize:13, outline:'none', width:'100%', resize:'none', fontFamily:"'Noto Sans Devanagari', sans-serif", lineHeight:1.5, marginBottom:8 }}
            />
            <button
              className="btn btn-primary"
              onClick={enhanceThumbPrompt}
              disabled={thumbLoading}
              style={{ background:'linear-gradient(135deg,#550055,#330033)', boxShadow:'0 4px 16px rgba(150,0,150,0.3)' }}
            >
              {thumbLoading ? <><div className="spinner" /> Enhancing...</> : '🖼 Thumbnail Prompt Enhance Karo'}
            </button>
            {thumbResult && (
              <div className="yt-output-card">
                <div className="yt-enhanced-box">{thumbResult}</div>
                <button className="yt-copy-btn" onClick={() => copyText(thumbResult, 'Thumbnail prompt')}>📋 Copy Karo</button>
              </div>
            )}
          </CollapseCard>

        </div>
      </div>

      <BottomNav userInitial={initial} />
    </>
  );
}

// ── Collapsible card component ─────────────────────
function CollapseCard({ title, titleColor, bg, borderColor, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: bg || 'var(--panel)', border: `1px solid ${borderColor || 'var(--border)'}`, borderRadius: 12, overflow:'hidden' }}>
      <div
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 14px 12px', cursor:'pointer', userSelect:'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ fontSize:10, color: titleColor || 'var(--blood)', letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>{title}</div>
        <span style={{ fontSize:14, color:'#444' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

export default function YoutubePageWrapper() {
  return (
    <ToastProvider>
      <AuthWrapper>
        {({ user }) => <YoutubePage user={user} />}
      </AuthWrapper>
    </ToastProvider>
  );
}
