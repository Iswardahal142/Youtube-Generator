'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider, useToast } from '../../components/Toast';

function MyStoriesPage({ user }) {
  const router      = useRouter();
  const toast       = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screen, setScreen] = useState('stories'); // stories | seasons | episodes
  const [loading, setLoading] = useState(true);

  // Data
  const [episodes, setEpisodes]  = useState([]);
  const [groups,   setGroups]    = useState({});         // { baseTitle: [...eps] }
  const [curStory, setCurStory]  = useState('');         // selected story title
  const [curSeason, setCurSeason] = useState('');        // selected season
  const [seasonEps, setSeasonEps] = useState([]);        // episodes for chosen season

  const displayName = user?.displayName || user?.email || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  // ── Load episodes ──────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    loadEpisodes();
  }, [user?.uid]);

  async function loadEpisodes() {
    setLoading(true);
    const { db_getEpisodes } = await import('../../lib/firebase');
    const eps = await db_getEpisodes(user.uid);
    setEpisodes(eps || []);

    // Group by base title
    const g = {};
    (eps || []).forEach(ep => {
      const base = (ep.title || 'Untitled').split(' | ')[0].trim();
      if (!g[base]) g[base] = [];
      g[base].push(ep);
    });
    setGroups(g);
    setLoading(false);
  }

  // ── Level 1: Story list ────────────────────────────
  function openSeasonsScreen(baseTitle) {
    setCurStory(baseTitle);
    setScreen('seasons');
  }

  // ── Level 2: Season list ───────────────────────────
  function openEpisodesScreen(season) {
    setCurSeason(season);
    const eps = (groups[curStory] || []).filter(e => (e.season || 'SEASON 1') === season);
    setSeasonEps(eps.sort((a,b) => (a.epNum||'').localeCompare(b.epNum||'')));
    setScreen('episodes');
  }

  // ── Delete episode ─────────────────────────────────
  async function deleteEpisode(epId) {
    if (!confirm('Is episode ko delete karna chahte ho?')) return;
    const { db_deleteEpisode } = await import('../../lib/firebase');
    await db_deleteEpisode(user.uid, epId);
    toast('🗑 Episode delete ho gaya');
    await loadEpisodes();

    // Refresh current level
    const remaining = episodes.filter(e => e.id !== epId);
    const curSeasonEps = remaining.filter(e =>
      (e.title||'').split(' | ')[0].trim() === curStory &&
      (e.season||'SEASON 1') === curSeason
    );
    if (!curSeasonEps.length) setScreen('seasons');
    else setSeasonEps(curSeasonEps);
  }

  // ── Load episode in generate page ─────────────────
  async function openEpisode(ep) {
    const { db_saveState } = await import('../../lib/firebase');
    await db_saveState(user.uid, {
      title:       ep.title,
      season:      ep.season || 'SEASON 1',
      epNum:       ep.epNum || 'EP 01',
      storyChunks: ep.storyChunks || [],
      storyEnded:  ep.ended || false,
      currentEpId: ep.id,
      prompt:      ep.prompt || '',
    });
    router.push('/generate');
  }

  // ── Seasons for current story ──────────────────────
  function getSeasonsForStory(baseTitle) {
    const map = {};
    (groups[baseTitle] || []).forEach(ep => {
      const s = ep.season || 'SEASON 1';
      if (!map[s]) map[s] = [];
      map[s].push(ep);
    });
    return map;
  }

  // ── RENDER ─────────────────────────────────────────
  return (
    <>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />

      <div className="page-content" style={{ background: 'var(--void)' }}>

        {/* ── Level 1: Stories ── */}
        {screen === 'stories' && (
          <>
            <div className="mini-topbar">
              <button className="hamburger-btn" onClick={() => setDrawerOpen(true)}>☰</button>
              <span className="mini-topbar-title">📚 My Stories</span>
              <div style={{ width: 36 }} />
            </div>

            <div className="mystories-content">
              {loading && (
                <div className="mystories-empty">
                  <span className="empty-icon">⏳</span>Loading...
                </div>
              )}

              {!loading && Object.keys(groups).length === 0 && (
                <div className="mystories-empty">
                  <span className="empty-icon">📭</span>
                  Koi story save nahi hui abhi.<br />
                  <span style={{ fontSize:12, color:'#333' }}>Generate tab se pehli story likho!</span>
                </div>
              )}

              {!loading && (
                <div className="ep-list-body">
                  {Object.entries(groups).map(([baseTitle, epList]) => {
                    const totalEps     = epList.length;
                    const totalSeasons = new Set(epList.map(e => e.season || 'SEASON 1')).size;
                    const words        = epList.reduce((s, e) => s + (e.wordCount || 0), 0);
                    const latest       = epList[0];
                    const dateStr      = latest?.savedAt
                      ? new Date(latest.savedAt).toLocaleDateString('hi-IN')
                      : '';

                    return (
                      <div
                        key={baseTitle}
                        className="story-card"
                        onClick={() => openSeasonsScreen(baseTitle)}
                      >
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <div style={{ flex:1 }}>
                            <div className="story-card-title">{baseTitle}</div>
                            <div className="story-card-meta" style={{ marginTop:5 }}>
                              <span className="scene-tag">{totalSeasons} Season{totalSeasons > 1 ? 's' : ''}</span>
                              <span className="scene-tag">{totalEps} Ep{totalEps > 1 ? 's' : ''}</span>
                            </div>
                            <div className="story-card-words" style={{ marginTop:3 }}>
                              {words.toLocaleString()} words · {dateStr}
                            </div>
                          </div>
                          <span style={{ fontSize:22, color:'#444' }}>›</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Level 2: Seasons ── */}
        {screen === 'seasons' && (
          <>
            <div className="mini-topbar">
              <button className="btn btn-icon" onClick={() => setScreen('stories')}>←</button>
              <span className="mini-topbar-title" style={{ fontSize:12, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{curStory}</span>
              <div style={{ width:36 }} />
            </div>

            <div className="mystories-content">
              <div className="ep-list-body">
                {Object.entries(getSeasonsForStory(curStory)).map(([season, sEps]) => {
                  const allDone = sEps.every(e => e.ended);
                  return (
                    <div
                      key={season}
                      className="story-card"
                      onClick={() => openEpisodesScreen(season)}
                    >
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:9, letterSpacing:2, color:'#880000', textTransform:'uppercase', fontWeight:700, marginBottom:5 }}>
                            📂 {season}
                          </div>
                          <div className="story-card-meta">
                            <span className="scene-tag">{sEps.length} Episode{sEps.length > 1 ? 's' : ''}</span>
                            <span className="scene-tag" style={{ color: allDone ? '#44bb66' : '#cc8822', borderColor: allDone ? '#1a4a22' : '#3a2200' }}>
                              {allDone ? '✅ Complete' : '🔄 Ongoing'}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize:22, color:'#444' }}>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Level 3: Episodes ── */}
        {screen === 'episodes' && (
          <>
            <div className="mini-topbar">
              <button className="btn btn-icon" onClick={() => setScreen('seasons')}>←</button>
              <span className="mini-topbar-title" style={{ fontSize:12, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {curSeason}
              </span>
              <div style={{ width:36 }} />
            </div>

            <div className="mystories-content">
              <div style={{ paddingBottom:80 }}>
                {seasonEps.map(ep => {
                  const epYtTitle = (ep.title || '').split(' | ')[1] || ep.title || 'Untitled';
                  return (
                    <div
                      key={ep.id}
                      className="ms-ep-row"
                      onClick={() => openEpisode(ep)}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                          <span style={{ fontSize:10, color:'#880000', fontWeight:700 }}>{ep.epNum || 'EP 01'}</span>
                          <span style={{ fontSize:9, color: ep.ended ? '#44bb66' : '#cc8822' }}>
                            {ep.ended ? '✅ Done' : '🔄 Ongoing'}
                          </span>
                        </div>
                        <div style={{ fontSize:13, color:'#ddd', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {epYtTitle}
                        </div>
                        <div style={{ fontSize:11, color:'#444', marginTop:3 }}>
                          {ep.wordCount || 0} words
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteEpisode(ep.id); }}
                        style={{ flexShrink:0, background:'transparent', border:'1px solid #2a0000', color:'#553333', fontSize:12, padding:'6px 10px', borderRadius:6, cursor:'pointer' }}
                      >
                        🗑
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

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
