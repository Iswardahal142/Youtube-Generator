// app/youtube/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider, useToast } from '../../components/Toast';

// ── Match helpers ──────────────────────────────────
function ytNormalize(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g,' ').replace(/[^\u0900-\u097F\w\s]/g,'').trim();
}
function ytMatchScore(storyTitle, videoTitle, videoDesc) {
  const sNorm  = ytNormalize(storyTitle);
  const vTitle = ytNormalize(videoTitle);
  const vDesc  = ytNormalize(videoDesc);
  if (!sNorm) return 0;
  if (vTitle === sNorm)                              return 100;
  if (vTitle.includes(sNorm))                        return 90;
  if (sNorm.includes(vTitle) && vTitle.length > 4)  return 80;
  const words      = sNorm.split(' ').filter(w=>w.length>2);
  if (!words.length) return 0;
  const titleHits  = words.filter(w=>vTitle.includes(w)).length;
  const descHits   = words.filter(w=>vDesc.includes(w)).length;
  return (titleHits/words.length)*70 + (descHits/words.length)*30;
}
function formatViews(n) {
  if (!n && n!==0) return '—';
  if (n>=1000000) return (n/1000000).toFixed(1)+'M';
  if (n>=100000)  return (n/100000).toFixed(1)+'L';
  if (n>=1000)    return (n/1000).toFixed(1)+'K';
  return n.toString();
}

// ── Season/EP format helper ────────────────────────
function formatSeasonEp(season, epNum) {
  const s = (season||'SEASON 1').replace(/\D/g,'').padStart(2,'0');
  const e = (epNum||'EP 01').replace(/EP\s*/i,'').trim().padStart(2,'0');
  return `S ${s} EP ${e}`;
}

// ─────────────────────────────────────────────────
function YoutubePage({ user }) {
  const toast      = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // YouTube data
  const [ytData,      setYtData]      = useState(null);
  const [ytLoading,   setYtLoading]   = useState(true);
  const [ytError,     setYtError]     = useState('');

  // Last episode from Firestore
  const [lastEp,      setLastEp]      = useState(null);

  // Comparison
  const [comparison,  setComparison]  = useState(null);

  // Checklist — auto-updated from comparison
  const [checks, setChecks] = useState({ title: false, desc: false, uploaded: false });

  // Titles — now single title at a time
  const [titlesLoading,   setTitlesLoading]   = useState(false);
  const [generatedTitles, setGeneratedTitles] = useState([]); // all 7 stored internally
  const [currentTitleIdx, setCurrentTitleIdx] = useState(0);  // which one is showing
  const [selectedTitle,   setSelectedTitle]   = useState(''); // locked selected title
  const [isSavingTitle,   setIsSavingTitle]   = useState(false);

  // Description
  const [descLoading,   setDescLoading]   = useState(false);
  const [desc,          setDesc]          = useState('');

  // Thumbnail
  const [thumbInput,    setThumbInput]    = useState('');
  const [thumbLoading,  setThumbLoading]  = useState(false);
  const [thumbResult,   setThumbResult]   = useState('');

  // Story state
  const storyRef = useRef({ title:'', chunks:[], epNum:'EP 01', season:'SEASON 1' });

  const displayName = user?.displayName || user?.email || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  // ── Load everything on mount ───────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    import('../../lib/firebase').then(async ({ db_loadState, db_getEpisodes }) => {
      const d = await db_loadState(user.uid);
      if (d) {
        storyRef.current = {
          title:  d.title || '',
          chunks: d.storyChunks || [],
          epNum:  d.epNum || 'EP 01',
          season: d.season || 'SEASON 1',
          ytTitle: d.ytTitle || '',
          ytDesc:  d.ytDesc  || '',
        };
      }
      const eps = await db_getEpisodes(user.uid);
      if (eps?.length) {
        const sorted = [...eps].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
        setLastEp(sorted[0]);
      }
    });

    fetchYT();
  }, [user?.uid]);

  // Run comparison once both lastEp and ytData are loaded
  useEffect(() => {
    if (lastEp && ytData?.lastVideo) runComparison(lastEp, ytData.lastVideo);
  }, [lastEp, ytData]);

  async function fetchYT() {
    setYtLoading(true); setYtError('');
    try {
      const res  = await fetch('/api/youtube');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setYtData(data);
    } catch(e) {
      setYtError(e.message);
    }
    setYtLoading(false);
  }

  function runComparison(ep, video) {
    const storyTitle = ep.ytTitle || (ep.title||'').split(' | ')[1] || ep.title || '';
    const score      = ytMatchScore(storyTitle, video.title, video.description);
    const titleScore = ytMatchScore(storyTitle, video.title, '');
    const titleMatch = titleScore >= 50;
    const descMatch  = ytMatchScore((ep.ytDesc||'').slice(0,100), '', video.description) >= 30;
    const uploaded   = score >= 60;
    setComparison({ score: Math.round(score), titleMatch, descMatch, uploaded });
    setChecks({ title: titleMatch, desc: descMatch, uploaded });
  }

  // ── Titles — single generate flow ─────────────────
  async function generateYtTitles() {
  const ep = lastEp;
  if (!ep || !ep.storyChunks?.length) { toast('⚠️ Pehle story complete karo!'); return; }
  setTitlesLoading(true);
  setGeneratedTitles([]);
  setCurrentTitleIdx(0);
  const title = (ep.title||'').split(' | ')[0] || ep.title || '';
  const storyText = ep.storyChunks.map(c=>c.text).join('\n\n').slice(0,1200);
  try {
    const res = await fetch('/api/ai',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'openai/gpt-4o-mini', max_tokens:600, temperature:0.9,
        messages:[{ role:'user', content:`Tu ek viral Hindi YouTube horror channel ka title expert hai.\n\nStory Title: "${title}"\nStory Summary: ${storyText.slice(0,600)}\n\nIske liye 7 VIRAL YouTube episode titles banao. Rules:\n- PURE HINDI DEVANAGARI script mein\n- High CTR — suspense, curiosity, fear\n- Mix: question format, shocking statement, cliffhanger\n- 50-70 characters each\n- Sirf episode ka catchy title banao — story ka main title aur season/episode number MAT likhna, woh alag se add hoga\n\nSirf JSON array return karo:\n["title 1","title 2","title 3","title 4","title 5","title 6","title 7"]` }],
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim()||'[]';
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    if (Array.isArray(parsed) && parsed.length) {
      setGeneratedTitles(parsed);
      setCurrentTitleIdx(0);
    }
  } catch(e) { toast('❌ '+e.message); }
  setTitlesLoading(false);
}

async function generateYtDesc() {
  const ep = lastEp;
  if (!ep || !ep.storyChunks?.length) { toast('⚠️ Pehle story complete karo!'); return; }
  setDescLoading(true); setDesc('');
  const title = (ep.title||'').split(' | ')[0] || ep.title || '';
  const epNum = ep.epNum || 'EP 01';
  const season = ep.season || 'SEASON 1';
  const storyText = ep.storyChunks.map(c=>c.text).join('\n\n').slice(0,800);
  try {
    const res = await fetch('/api/ai',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'openai/gpt-4o-mini', max_tokens:800, temperature:0.7,
        messages:[{ role:'user', content:`Story: "${title}" — ${season} ${epNum}\n\n${storyText}\n\nIs YouTube video ke liye Hindi description + hashtags banao.\n\nFormat:\n- 3-4 para Hindi description (mystery/horror hook)\n- Subscribe CTA\n- 15-20 relevant hashtags\n\nSEO optimized. Ready-to-paste.` }],
      }),
    });
    const data = await res.json();
    setDesc(data.choices?.[0]?.message?.content?.trim()||'');
  } catch(e) { toast('❌ '+e.message); }
  setDescLoading(false);
}

  // Show next title
  function nextTitle() {
    setCurrentTitleIdx(i => (i + 1) % generatedTitles.length);
  }

  async function selectAndSaveTitle() {
  const titleToSave = generatedTitles[currentTitleIdx];
  if (!titleToSave || !lastEp) return;
  setIsSavingTitle(true);
  try {
    const { db_saveEpisode } = await import('../../lib/firebase');
    const mainTitle = (lastEp.title||'').split(' | ')[0].trim() || lastEp.title || '';
    const seasonEp  = formatSeasonEp(lastEp.season, lastEp.epNum);
    const newFullTitle = `${mainTitle} | ${titleToSave} | ${seasonEp}`;
    await db_saveEpisode(user.uid, {
      ...lastEp,
      title: newFullTitle,
      ytTitle: titleToSave,
      savedAt: Date.now(),
    });
    setLastEp(prev => prev ? { ...prev, title: newFullTitle, ytTitle: titleToSave } : prev);
    setSelectedTitle(titleToSave);
    toast('✅ Title select aur save ho gaya!');
  } catch(e) {
    toast('❌ Save nahi hua: ' + e.message);
  }
  setIsSavingTitle(false);
}

        // Update local lastEp so comparison card also updates
        setLastEp(prev => prev ? { ...prev, title: newFullTitle, ytTitle: titleToSave } : prev);
        setSelectedTitle(titleToSave);
        toast('✅ Title select aur save ho gaya!');
      }
    } catch(e) {
      toast('❌ Save nahi hua: ' + e.message);
    }
    setIsSavingTitle(false);
  }

  // ── Description ───────────────────────────────────
  async function generateYtDesc() {
    const ep = lastEp;
    if (!ep || !ep.storyChunks?.length) { toast('⚠️ Pehle story complete karo!'); return; }
    setDescLoading(true); setDesc('');
    const title = (ep.title||'').split(' | ')[0] || ep.title || '';
    const epNum = ep.epNum || 'EP 01';
    const season = ep.season || 'SEASON 1';
    const storyText = ep.storyChunks.map(c=>c.text).join('\n\n').slice(0,800);
    try {
      const res  = await fetch('/api/ai',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:'openai/gpt-4o-mini', max_tokens:800, temperature:0.7,
          messages:[{ role:'user', content:`Story: "${title}" — ${season} ${epNum}\n\n${storyText}\n\nIs YouTube video ke liye Hindi description + hashtags banao.\n\nFormat:\n- 3-4 para Hindi description (mystery/horror hook)\n- Subscribe CTA\n- 15-20 relevant hashtags\n\nSEO optimized. Ready-to-paste.` }],
        }),
      });
      const data = await res.json();
      setDesc(data.choices?.[0]?.message?.content?.trim()||'');
    } catch(e) { toast('❌ '+e.message); }
    setDescLoading(false);
  }

  // ── Thumbnail ─────────────────────────────────────
  async function enhanceThumbPrompt() {
    const { chunks } = storyRef.current;
    const base = thumbInput || chunks.map(c=>c.text).join(' ').slice(0,300);
    setThumbLoading(true); setThumbResult('');
    try {
      const res  = await fetch('/api/ai',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:'openai/gpt-4o-mini', max_tokens:300, temperature:0.8,
          messages:[{ role:'user', content:`Basic prompt: "${base}"\n\nIs basic prompt ko ek viral YouTube horror thumbnail image prompt mein enhance karo.\n\nRequirements:\n- Cinematic, dramatic, high-detail\n- Dark horror atmosphere, red/dark color palette\n- Face expressions of fear/shock\n- 16:9 YouTube thumbnail format\n- 80-100 words, English mein\n\nSirf enhanced prompt text do.` }],
        }),
      });
      const data = await res.json();
      setThumbResult(data.choices?.[0]?.message?.content?.trim()||'');
    } catch(e) { toast('❌ '+e.message); }
    setThumbLoading(false);
  }

  function copyText(text, label) {
    navigator.clipboard.writeText(text).then(()=>toast(`✅ ${label||'Copied'}!`));
  }

  const scoreColor = !comparison ? '#555'
    : comparison.score>=60 ? '#00cc55'
    : comparison.score>=30 ? '#ffaa00' : '#cc3333';

  // Current showing title (only generated part)
  const currentTitle = generatedTitles[currentTitleIdx] || '';
  const isCurrentSelected = selectedTitle === currentTitle;
  
  // Full title for display: mainTitle | generatedTitle | S 01 EP 01
  const mainTitlePart = lastEp ? (lastEp.title||'').split(' | ')[0] || lastEp.title || '' : '';
  const seasonEpPart  = lastEp ? formatSeasonEp(lastEp.season, lastEp.epNum) : '';
  const fullDisplayTitle = currentTitle
    ? `${mainTitlePart} | ${currentTitle} | ${seasonEpPart}`
    : '';
  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <>
      <SideDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} user={user}/>

      <div className="page-content" style={{background:'var(--void)'}}>
        <div className="mini-topbar">
          <button className="hamburger-btn" onClick={()=>setDrawerOpen(true)}>☰</button>
          <span className="mini-topbar-title" style={{color:'#ff4444', fontSize:13}}>
            ▶ YouTube Export
          </span>
          <div style={{width:36}}/>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:12}}>

          {/* ── Comparison Card ── */}
          <div style={{background:'#080000',border:'1px solid #440000',borderRadius:12,overflow:'hidden'}}>
            {ytLoading && (
              <div style={{display:'flex',alignItems:'center',gap:8,padding:14,color:'#555',fontSize:12}}>
                <div className="spinner"/> YouTube se check ho raha hai...
              </div>
            )}
            {ytError && (
              <div style={{padding:14}}>
                <div style={{fontSize:10,color:'#ff4444',letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>⚠️ YouTube Error</div>
                <div style={{fontSize:12,color:'#cc4444'}}>{ytError}</div>
                <div style={{fontSize:11,color:'#444',marginTop:6}}>YOUTUBE_API_KEY aur YOUTUBE_CHANNEL_ID check karo.</div>
              </div>
            )}
            {!ytLoading && !ytError && ytData && (
              <div style={{padding:14}}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:3,height:14,background:'#ff4444',borderRadius:2}}/>
                    <span style={{fontSize:10,color:'#ff4444',letterSpacing:2,textTransform:'uppercase',fontWeight:700}}>Last Video vs Last Story</span>
                  </div>
                </div>

                {/* Last Story row — ek line mein full title */}
                {lastEp && (
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:10,borderRadius:10,background:'rgba(80,0,80,0.12)',border:'1px solid #2a0028',marginBottom:8}}>
                    <div style={{width:36,height:36,borderRadius:8,background:'rgba(120,0,120,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📚</div>
                    <div style={{flex:1,overflow:'hidden'}}>
                      <div style={{fontSize:9,color:'#666',letterSpacing:1.5,textTransform:'uppercase',marginBottom:4}}>Last Story</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#eee',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontFamily:"'Noto Sans Devanagari',sans-serif"}}>
                        {lastEp.title || lastEp.ytTitle || '—'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Last YouTube Video row */}
                {ytData.lastVideo && (
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:10,borderRadius:10,background:'rgba(80,0,0,0.15)',border:'1px solid #2a0000',marginBottom:14}}>
                    {ytData.lastVideo.thumbnail
                      ? <div style={{position:'relative',flexShrink:0}}>
                          <img src={ytData.lastVideo.thumbnail} alt="" style={{width:72,height:42,objectFit:'cover',borderRadius:6,display:'block'}}/>
                          <div style={{position:'absolute',bottom:3,right:3,background:'rgba(0,0,0,0.8)',borderRadius:3,padding:'1px 4px',fontSize:9,color:'#fff',fontWeight:700}}>YT</div>
                        </div>
                      : <div style={{width:72,height:42,borderRadius:6,background:'#1a0000',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>▶</div>
                    }
                    <div style={{flex:1,overflow:'hidden'}}>
                      <div style={{fontSize:9,color:'#666',letterSpacing:1.5,textTransform:'uppercase',marginBottom:2}}>Last YouTube Video</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#ffaaaa',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ytData.lastVideo.title}</div>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                        <span style={{fontSize:10,color:'#ff4444',fontWeight:700}}>▶ {formatViews(ytData.lastVideo.viewCount)} views</span>
                        {ytData.lastVideo.publishedAt && (
                          <><span style={{fontSize:10,color:'#333'}}>·</span>
                          <span style={{fontSize:10,color:'#444'}}>{new Date(ytData.lastVideo.publishedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Match Checks */}
                {comparison && (
                  <>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                      {[
                        { ok: checks.title,    label: checks.title    ? 'Title match hua ✓'    : 'Title match nahi hua' },
                        { ok: checks.desc,     label: checks.desc     ? 'Description match hui ✓' : 'Description match nahi hui' },
                        { ok: checks.uploaded, label: checks.uploaded ? 'Video Uploaded ✓'     : 'Video Not Uploaded' },
                      ].map((item,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,background:item.ok?'rgba(0,180,80,0.07)':'rgba(255,60,60,0.07)',border:`1px solid ${item.ok?'rgba(0,180,80,0.18)':'rgba(255,60,60,0.15)'}`}}>
                          <div style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,background:item.ok?'rgba(0,200,80,0.15)':'rgba(255,60,60,0.15)'}}>{item.ok?'✓':'✕'}</div>
                          <span style={{fontSize:12,color:item.ok?'#66dd99':'#ff7777',fontWeight:600,flex:1}}>{item.label}</span>
                          <span style={{fontSize:9,padding:'2px 7px',borderRadius:20,fontWeight:700,background:item.ok?'rgba(0,180,80,0.12)':'rgba(200,0,0,0.12)',color:item.ok?'#00cc55':'#cc3333'}}>{item.ok?'YES':'NO'}</span>
                        </div>
                      ))}
                    </div>
                    {/* Score bar */}
                    <div style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 10px',border:'1px solid #1a1a1a'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                        <span style={{fontSize:10,color:'#555',letterSpacing:1}}>MATCH SCORE</span>
                        <span style={{fontSize:13,fontWeight:700,color:scoreColor}}>{comparison.score}%</span>
                      </div>
                      <div style={{height:4,background:'#1a1a1a',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:comparison.score+'%',background:`linear-gradient(90deg,${scoreColor}88,${scoreColor})`,borderRadius:4}}/>
                      </div>
                    </div>
                  </>
                )}

                {!lastEp && !ytLoading && (
                  <div style={{fontSize:12,color:'#555',padding:4}}>📭 Koi story save nahi hui abhi.</div>
                )}
                {!ytData.lastVideo && (
                  <div style={{fontSize:12,color:'#555',padding:4}}>📺 Channel pe koi video nahi mila.</div>
                )}
              </div>
            )}
          </div>

          {/* ── Title Generator — Single Title Flow ── */}
          <CollapseCard title="🎯 YouTube Title Generator" titleColor="#44bb66" bg="#000a00" borderColor="#003300" defaultOpen>
            <div style={{fontSize:12,color:'#666',lineHeight:1.6,marginBottom:8}}>
              Story se ek viral Hindi title — next dabao aur swap karo
            </div>

            {/* Generate button */}
            <button className="btn btn-primary" onClick={generateYtTitles} disabled={titlesLoading}
              style={{background:'linear-gradient(135deg,#005500,#002200)',boxShadow:'0 4px 16px rgba(0,150,0,0.3)',marginBottom: generatedTitles.length ? 12 : 0}}>
              {titlesLoading
                ? <><div className="spinner"/>Title ban raha hai...</>
                : generatedTitles.length ? '🔄 Naye Titles Generate Karo' : '🎯 Title Generate Karo'}
            </button>

            {/* Single title display card */}
            {generatedTitles.length > 0 && !titlesLoading && (
              <div style={{background:'#020d02',border:'1px solid #003300',borderRadius:12,padding:14,display:'flex',flexDirection:'column',gap:12}}>

                {/* Title counter */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:9,color:'#446644',letterSpacing:1.5,textTransform:'uppercase'}}>
                    Title {currentTitleIdx + 1} / {generatedTitles.length}
                  </span>
                  {isCurrentSelected && (
                    <span style={{fontSize:9,color:'#44bb66',background:'rgba(0,180,80,0.12)',border:'1px solid rgba(0,180,80,0.3)',padding:'2px 8px',borderRadius:20,fontWeight:700}}>
                      ✅ Selected
                    </span>
                  )}
                </div>

                {/* Full title preview: mainTitle | generatedTitle | S 01 EP 01 */}
                <div style={{
                  fontSize:13,
                  fontWeight:700,
                  color: isCurrentSelected ? '#66dd99' : '#ddffdd',
                  lineHeight:1.6,
                  fontFamily:"'Noto Sans Devanagari',sans-serif",
                  padding:'10px 12px',
                  background: isCurrentSelected ? 'rgba(0,180,80,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isCurrentSelected ? 'rgba(0,180,80,0.3)' : '#1a3a1a'}`,
                  borderRadius:8,
                  minHeight:60,
                  display:'flex',
                  alignItems:'center',
                }}>
                  {fullDisplayTitle}
                </div>

                {/* Action buttons */}
                <div style={{display:'flex',gap:8}}>
                  {/* Next Title */}
                  <button
                    onClick={nextTitle}
                    style={{
                      flex:1,
                      background:'#0a1a0a',
                      border:'1px solid #224422',
                      color:'#44aa44',
                      borderRadius:8,
                      fontSize:12,
                      padding:'10px 8px',
                      cursor:'pointer',
                      fontWeight:600,
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      gap:4,
                    }}>
                    ▶ Next Title
                  </button>

                  {/* Select This Title */}
                  <button
                    onClick={selectAndSaveTitle}
                    disabled={isSavingTitle || isCurrentSelected}
                    style={{
                      flex:2,
                      background: isCurrentSelected
                        ? 'rgba(0,180,80,0.1)'
                        : 'linear-gradient(135deg,#004400,#002200)',
                      border: `1px solid ${isCurrentSelected ? 'rgba(0,180,80,0.4)' : '#006600'}`,
                      color: isCurrentSelected ? '#44bb66' : '#88ff88',
                      borderRadius:8,
                      fontSize:12,
                      padding:'10px 8px',
                      cursor: isCurrentSelected ? 'default' : 'pointer',
                      fontWeight:700,
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      gap:4,
                      opacity: isSavingTitle ? 0.6 : 1,
                    }}>
                    {isSavingTitle
                      ? <><div className="spinner"/>Saving...</>
                      : isCurrentSelected
                        ? '✅ Selected'
                        : '✔ Select This Title'}
                  </button>

                  {/* Copy full title */}
                  <button
                    onClick={()=>copyText(fullDisplayTitle,'Title')}
                    style={{
                      background:'#0a0a1a',
                      border:'1px solid #222244',
                      color:'#6688cc',
                      borderRadius:8,
                      fontSize:12,
                      padding:'10px 10px',
                      cursor:'pointer',
                      fontWeight:600,
                    }}>
                    📋
                  </button>
                </div>

                {/* Selected title info */}
                {selectedTitle && !isCurrentSelected && (
                  <div style={{fontSize:10,color:'#446644',padding:'6px 10px',background:'rgba(0,100,0,0.08)',borderRadius:6,border:'1px solid #1a3a1a'}}>
                    ✅ Selected: <span style={{color:'#66dd99',fontFamily:"'Noto Sans Devanagari',sans-serif"}}>{selectedTitle}</span>
                  </div>
                )}
              </div>
            )}
          </CollapseCard>

          {/* ── Description ── */}
          <CollapseCard title="📝 Description + Tags" titleColor="#4488ff" bg="#00000a" borderColor="#000033" defaultOpen>
            <div style={{fontSize:12,color:'#666',lineHeight:1.6,marginBottom:8}}>SEO-optimized Hindi description + hashtags ready-to-paste</div>
            <button className="btn btn-primary" onClick={generateYtDesc} disabled={descLoading}
              style={{background:'linear-gradient(135deg,#000055,#000033)',boxShadow:'0 4px 16px rgba(0,0,150,0.3)'}}>
              {descLoading?<><div className="spinner"/>Generating...</>:'📝 Description Generate Karo'}
            </button>
            {desc && (
              <div className="yt-output-card">
                <div className="yt-desc-box">{desc}</div>
                <button className="yt-copy-btn" onClick={()=>copyText(desc,'Description')}>📋 Copy Karo</button>
              </div>
            )}
          </CollapseCard>

          {/* ── Thumbnail Enhancer ── */}
          <CollapseCard title="🖼 Thumbnail Prompt Enhancer" titleColor="#cc88ff" bg="#0a000a" borderColor="#330033" defaultOpen>
            <div style={{fontSize:12,color:'#666',lineHeight:1.6,marginBottom:8}}>Basic prompt → viral YouTube thumbnail prompt</div>
            <textarea value={thumbInput} onChange={e=>setThumbInput(e.target.value)}
              placeholder="Koi bhi image prompt yahan paste karo (ya khali chhodo — story se auto banao)..."
              rows={3} style={{background:'#0f0f0f',border:'1px solid #330033',color:'var(--bone)',padding:'10px 12px',borderRadius:8,fontSize:13,outline:'none',width:'100%',resize:'none',fontFamily:"'Noto Sans Devanagari',sans-serif",lineHeight:1.5,marginBottom:8}}/>
            <button className="btn btn-primary" onClick={enhanceThumbPrompt} disabled={thumbLoading}
              style={{background:'linear-gradient(135deg,#550055,#330033)',boxShadow:'0 4px 16px rgba(150,0,150,0.3)'}}>
              {thumbLoading?<><div className="spinner"/>Enhancing...</>:'🖼 Thumbnail Prompt Enhance Karo'}
            </button>
            {thumbResult && (
              <div className="yt-output-card">
                <div className="yt-enhanced-box">{thumbResult}</div>
                <button className="yt-copy-btn" onClick={()=>copyText(thumbResult,'Thumbnail prompt')}>📋 Copy Karo</button>
              </div>
            )}
          </CollapseCard>

        </div>
      </div>
      <BottomNav userInitial={initial}/>
    </>
  );
}

function CollapseCard({ title, titleColor, bg, borderColor, children, defaultOpen=false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{background:bg||'var(--panel)',border:`1px solid ${borderColor||'var(--border)'}`,borderRadius:12,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 14px 12px',cursor:'pointer',userSelect:'none'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{fontSize:10,color:titleColor||'var(--blood)',letterSpacing:2,textTransform:'uppercase',fontWeight:700}}>{title}</div>
        <span style={{fontSize:14,color:'#444'}}>{open?'▲':'▼'}</span>
      </div>
      {open && <div style={{padding:'0 14px 14px'}}>{children}</div>}
    </div>
  );
}

export default function YoutubePageWrapper() {
  return (
    <ToastProvider>
      <AuthWrapper>
        {({user})=><YoutubePage user={user}/>}
      </AuthWrapper>
    </ToastProvider>
  );
}
