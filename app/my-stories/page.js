'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider, useToast } from '../../components/Toast';

function MyStoriesPage({ user }) {
  const router  = useRouter();
  const toast   = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screen,     setScreen]     = useState('stories');
  const [loading,    setLoading]    = useState(true);

  const [groups,    setGroups]    = useState({});
  const [curStory,  setCurStory]  = useState('');
  const [curSeason, setCurSeason] = useState('');
  const [seasonEps, setSeasonEps] = useState([]);

  const displayName = user?.displayName || user?.email || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!user?.uid) return;
    loadEpisodes();
  }, [user?.uid]);

  async function loadEpisodes() {
    setLoading(true);
    const { db_getEpisodes } = await import('../../lib/firebase');
    const eps = await db_getEpisodes(user.uid);
    const g   = {};
    (eps || []).forEach(ep => {
      const base = (ep.title || 'Untitled').split(' | ')[0].trim();
      if (!g[base]) g[base] = [];
      g[base].push(ep);
    });
    setGroups(g);
    setLoading(false);
  }

  function getSeasonsForStory(baseTitle) {
    const map = {};
    (groups[baseTitle] || []).forEach(ep => {
      const s = ep.season || 'SEASON 1';
      if (!map[s]) map[s] = [];
      map[s].push(ep);
    });
    return map;
  }

  async function deleteEpisode(epId) {
    if (!confirm('Delete karna chahte ho?')) return;
    const { db_deleteEpisode } = await import('../../lib/firebase');
    await db_deleteEpisode(user.uid, epId);
    toast('🗑 Episode delete ho gaya');
    await loadEpisodes();
    const remainingSeasonEps = seasonEps.filter(e => e.id !== epId);
    if (!remainingSeasonEps.length) setScreen('seasons');
    else setSeasonEps(remainingSeasonEps);
  }

  async function openEpisode(ep) {
    const { db_saveState } = await import('../../lib/firebase');
    await db_saveState(user.uid, {
      title:       ep.title,
      season:      ep.season || 'SEASON 1',
      epNum:       ep.epNum  || 'EP 01',
      storyChunks: ep.storyChunks || [],
      storyEnded:  ep.ended || false,
      currentEpId: ep.id,
      prompt:      ep.prompt || '',
    });
    router.push('/generate');
  }

  // Breadcrumb levels
  const breadcrumb = [
    { label: 'My Stories', screen: 'stories' },
    ...(screen !== 'stories' ? [{ label: curStory.length > 16 ? curStory.slice(0,14)+'…' : curStory, screen: 'seasons' }] : []),
    ...(screen === 'episodes' ? [{ label: curSeason, screen: 'episodes' }] : []),
  ];

  const storyList   = Object.entries(groups);
  const seasonMap   = screen !== 'stories' ? getSeasonsForStory(curStory) : {};
  const seasonList  = Object.entries(seasonMap);

  // ── RENDER ───────────────────────────────────────
  return (
    <>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />

      <div className="page-content" style={{ background: 'var(--void)' }}>

        {/* ── Topbar with breadcrumb ── */}
        <div style={{
          display: 'flex', alignItems: 'center', height: 52,
          padding: '0 12px', gap: 6,
          background: 'rgba(10,0,10,0.97)',
          borderBottom: '1px solid #1a0015',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          {/* Hamburger or back */}
          {screen === 'stories'
            ? <button className="hamburger-btn" onClick={() => setDrawerOpen(true)} style={{ flexShrink: 0 }}>☰</button>
            : <button onClick={() => setScreen(screen === 'episodes' ? 'seasons' : 'stories')}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', padding: '4px 8px', flexShrink: 0 }}>←</button>
          }

          {/* Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, overflow: 'hidden' }}>
            {breadcrumb.map((crumb, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                {i > 0 && <span style={{ color: '#330022', fontSize: 14, margin: '0 4px', flexShrink: 0 }}>›</span>}
                <button
                  onClick={() => {
                    if (crumb.screen === 'stories') setScreen('stories');
                    else if (crumb.screen === 'seasons') setScreen('seasons');
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: i < breadcrumb.length - 1 ? 'pointer' : 'default',
                    padding: 0,
                    fontFamily: "'Cinzel Decorative', serif",
                    fontSize: i === breadcrumb.length - 1 ? 12 : 10,
                    fontWeight: 900,
                    color: i === breadcrumb.length - 1 ? '#cc2233' : '#552233',
                    letterSpacing: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: i === breadcrumb.length - 1 ? 180 : 80,
                  }}
                >
                  {i === 0 ? '📚 ' : i === 1 ? '📂 ' : '🎬 '}{crumb.label}
                </button>
              </div>
            ))}
          </div>

          {/* Right spacer */}
          <div style={{ width: 36, flexShrink: 0 }} />
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>

          {/* ── LEVEL 1: Stories ── */}
          {screen === 'stories' && (
            <>
              {loading && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#333' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  Loading...
                </div>
              )}
              {!loading && storyList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#333', fontSize: 14, lineHeight: 2 }}>
                  <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>📭</span>
                  Koi story save nahi hui abhi.<br />
                  <span style={{ fontSize: 12, color: '#2a2a2a' }}>Generate tab se pehli story likho!</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {storyList.map(([baseTitle, epList]) => {
                  const totalEps     = epList.length;
                  const totalSeasons = new Set(epList.map(e => e.season || 'SEASON 1')).size;
                  const words        = epList.reduce((s, e) => s + (e.wordCount || 0), 0);
                  const latest       = epList.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))[0];
                  const dateStr      = latest?.savedAt ? new Date(latest.savedAt).toLocaleDateString('hi-IN') : '';
                  return (
                    <div key={baseTitle} onClick={() => { setCurStory(baseTitle); setScreen('seasons'); }}
                      style={{ background: '#0d000d', border: '1px solid #2a0022', borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#550033'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#2a0022'}
                    >
                      {/* Folder icon + title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#3a0022,#1a000f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: '1px solid #440022' }}>
                          📂
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#ddd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{baseTitle}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: '#880000', background: 'rgba(136,0,0,0.12)', border: '1px solid #330000', borderRadius: 4, padding: '2px 7px' }}>
                              {totalSeasons} Season{totalSeasons > 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: 10, color: '#555', background: 'rgba(255,255,255,0.04)', border: '1px solid #222', borderRadius: 4, padding: '2px 7px' }}>
                              {totalEps} Episode{totalEps > 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: 10, color: '#444', background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a', borderRadius: 4, padding: '2px 7px' }}>
                              {words.toLocaleString()} words
                            </span>
                          </div>
                          {dateStr && <div style={{ fontSize: 10, color: '#333', marginTop: 3 }}>Last: {dateStr}</div>}
                        </div>
                        <span style={{ fontSize: 18, color: '#330022', flexShrink: 0 }}>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── LEVEL 2: Seasons ── */}
          {screen === 'seasons' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {seasonList.map(([season, sEps]) => {
                const allDone = sEps.every(e => e.ended);
                const words   = sEps.reduce((s, e) => s + (e.wordCount || 0), 0);
                return (
                  <div key={season} onClick={() => { setCurSeason(season); setSeasonEps(sEps.sort((a,b)=>(a.epNum||'').localeCompare(b.epNum||''))); setScreen('episodes'); }}
                    style={{ background: '#0a000a', border: '1px solid #220018', borderRadius: 12, padding: 14, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#440033'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#220018'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#1a0033,#0d0018)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: '1px solid #330033' }}>
                        🗂
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, color: '#550033', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>{season}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: '#555', background: 'rgba(255,255,255,0.04)', border: '1px solid #222', borderRadius: 4, padding: '2px 7px' }}>
                            {sEps.length} Episode{sEps.length > 1 ? 's' : ''}
                          </span>
                          <span style={{ fontSize: 10, borderRadius: 4, padding: '2px 7px', border: `1px solid ${allDone ? '#1a4a22' : '#3a2200'}`, color: allDone ? '#44bb66' : '#cc8822', background: allDone ? 'rgba(0,80,0,0.1)' : 'rgba(80,40,0,0.1)' }}>
                            {allDone ? '✅ Complete' : '🔄 Ongoing'}
                          </span>
                          <span style={{ fontSize: 10, color: '#444', background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a', borderRadius: 4, padding: '2px 7px' }}>
                            {words.toLocaleString()} words
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 18, color: '#330022', flexShrink: 0 }}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── LEVEL 3: Episodes ── */}
          {screen === 'episodes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seasonEps.map(ep => {
                const epYtTitle = (ep.title || '').split(' | ')[1] || ep.title || 'Untitled';
                const savedDate = ep.savedAt ? new Date(ep.savedAt).toLocaleDateString('hi-IN') : '';
                return (
                  <div key={ep.id} onClick={() => openEpisode(ep)}
                    style={{ background: '#080008', border: '1px solid #1a0015', borderRadius: 12, padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#440033'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#1a0015'}
                  >
                    {/* Episode icon */}
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: ep.ended ? 'linear-gradient(135deg,#003300,#001a00)' : 'linear-gradient(135deg,#1a0000,#0d0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, border: `1px solid ${ep.ended ? '#004400' : '#330000'}` }}>
                      {ep.ended ? '✅' : '📝'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* EP num + status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 9, color: '#880000', fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>{ep.epNum || 'EP 01'}</span>
                        <span style={{ fontSize: 9, color: ep.ended ? '#44bb66' : '#cc8822', background: ep.ended ? 'rgba(0,80,0,0.12)' : 'rgba(80,40,0,0.12)', border: `1px solid ${ep.ended ? '#1a4a22' : '#3a2200'}`, borderRadius: 3, padding: '1px 5px' }}>
                          {ep.ended ? 'Done' : 'Ongoing'}
                        </span>
                      </div>
                      {/* Title */}
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{epYtTitle}</div>
                      {/* Meta */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: '#444' }}>{ep.wordCount || 0} words</span>
                        {savedDate && <span style={{ fontSize: 10, color: '#333' }}>· {savedDate}</span>}
                      </div>
                    </div>

                    {/* Delete btn */}
                    <button onClick={e => { e.stopPropagation(); deleteEpisode(ep.id); }}
                      style={{ flexShrink: 0, background: 'rgba(80,0,0,0.2)', border: '1px solid #330000', color: '#553333', fontSize: 14, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>
                      🗑
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      <BottomNav userInitial={initial} />
    </>
  );
}

export default function MyStoriesPageWrapper() {
  return (
    <ToastProvider>
      <AuthWrapper>
        {({ user }) => <MyStoriesPage user={user} />}
      </AuthWrapper>
    </ToastProvider>
  );
}
