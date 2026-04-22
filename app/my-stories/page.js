'use client';

import { useState, useEffect, useRef } from 'react';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider, useToast } from '../../components/Toast';

// ── YouTube match helpers ──────────────────────────
function ytNorm(s) { return (s||'').toLowerCase().replace(/\s+/g,' ').replace(/[^\u0900-\u097F\w\s]/g,'').trim(); }
function ytScore(storyTitle, vTitle, vDesc) {
  const s=ytNorm(storyTitle), t=ytNorm(vTitle), d=ytNorm(vDesc);
  if(!s) return 0;
  if(t===s) return 100; if(t.includes(s)) return 90; if(s.includes(t)&&t.length>4) return 80;
  const words=s.split(' ').filter(w=>w.length>2); if(!words.length) return 0;
  return (words.filter(w=>t.includes(w)).length/words.length)*70+(words.filter(w=>d.includes(w)).length/words.length)*30;
}
function fmtViews(n) {
  if(!n&&n!==0) return '—';
  if(n>=1000000) return (n/1000000).toFixed(1)+'M';
  if(n>=100000)  return (n/100000).toFixed(1)+'L';
  if(n>=1000)    return (n/1000).toFixed(1)+'K';
  return String(n);
}

// ─────────────────────────────────────────────────
function MyStoriesPage({ user }) {
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screen,     setScreen]     = useState('stories');
  const [loading,    setLoading]    = useState(true);

  const [groups,    setGroups]    = useState({});
  const [allEps,    setAllEps]    = useState([]);
  const [curStory,  setCurStory]  = useState('');
  const [curSeason, setCurSeason] = useState('');
  const [seasonEps, setSeasonEps] = useState([]);

  // YouTube data cache
  const [ytVideos,  setYtVideos]  = useState([]);   // all videos
  const [ytRankMap, setYtRankMap] = useState({});   // videoId -> rank
  const ytLoaded = useRef(false);

  // ── Inline player state ──
  const [activeEp,      setActiveEp]      = useState(null);  // episode being played/continued
  const [playerChunks,  setPlayerChunks]  = useState([]);
  const [playerEnded,   setPlayerEnded]   = useState(false);
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [promptHint,    setPromptHint]    = useState('');
  const [wordCount,     setWordCount]     = useState(0);
  const [showEndBanner, setShowEndBanner] = useState(false);
  const [scenes,        setScenes]        = useState(null);
  const [chars,         setChars]         = useState(null);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [charsLoading,  setCharsLoading]  = useState(false);
  const [showAnalysis,  setShowAnalysis]  = useState(false);
  const storyAreaRef  = useRef(null);
  const isGenRef      = useRef(false);
  const stateRef      = useRef({});

  const displayName = user?.displayName || user?.email || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  // ── Load episodes ──────────────────────────────────
  useEffect(() => { if (user?.uid) loadEpisodes(); }, [user?.uid]);

  async function loadEpisodes() {
    setLoading(true);
    const { db_getEpisodes } = await import('../../lib/firebase');
    const eps = await db_getEpisodes(user.uid);
    setAllEps(eps || []);
    const g = {};
    (eps || []).forEach(ep => {
      const base = (ep.title || 'Untitled').split(' | ')[0].trim();
      if (!g[base]) g[base] = [];
      g[base].push(ep);
    });
    setGroups(g);
    setLoading(false);
  }

  // ── Load YouTube data once ─────────────────────────
  useEffect(() => {
    if (ytLoaded.current) return;
    ytLoaded.current = true;
    fetch('/api/youtube').then(r => r.json()).then(data => {
      if (data.videos?.length) {
        setYtVideos(data.videos);
        const sorted = [...data.videos].sort((a,b) => (b.viewCount||0)-(a.viewCount||0));
        const rm = {};
        sorted.forEach((v,i) => { rm[v.videoId] = i+1; });
        setYtRankMap(rm);
      }
    }).catch(() => {});
  }, []);

  // Match episode to YT video
  function getEpYtInfo(ep) {
    if (!ytVideos.length) return null;
    const matchTitle = ep.ytTitle || (ep.title||'').split(' | ')[1] || ep.title || '';
    let best = 0, bestVid = null;
    ytVideos.forEach(v => {
      const s = ytScore(matchTitle, v.title, v.description);
      if (s > best) { best = s; bestVid = v; }
    });
    if (!bestVid || best < 40) return null;
    return { video: bestVid, rank: ytRankMap[bestVid.videoId] || 99, score: Math.round(best) };
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

  // ── Delete ─────────────────────────────────────────
  async function deleteEpisode(epId) {
    if (!confirm('Delete karna chahte ho?')) return;
    const ytInfo = getEpYtInfo(seasonEps.find(e=>e.id===epId)||{});
    if (ytInfo) { toast('❌ YouTube pe upload hai — delete nahi kar sakte!'); return; }
    const { db_deleteEpisode } = await import('../../lib/firebase');
    await db_deleteEpisode(user.uid, epId);
    toast('🗑 Episode delete ho gaya');
    await loadEpisodes();
    setSeasonEps(prev => prev.filter(e => e.id !== epId));
  }

  // ── Open episode inline ────────────────────────────
  function openEpisode(ep) {
    const seasonEnded = seasonEps.every(e => e.ended);
    setActiveEp({ ...ep, seasonEnded });
    setPlayerChunks(ep.storyChunks || []);
    setPlayerEnded(ep.ended || false);
    setShowEndBanner(ep.ended || false);
    setWordCount((ep.storyChunks||[]).reduce((a,c)=>a+c.text.split(/\s+/).length,0));
    setScenes(ep.savedScenes || null);
    setChars(ep.savedChars || null);
    setShowAnalysis(false);
    stateRef.current = {
      title: ep.title, season: ep.season||'SEASON 1', epNum: ep.epNum||'EP 01',
      currentEpId: ep.id, prompt: ep.prompt||'', seasonBible: ep.seasonBible||null,
      characterBible: ep.characterBible||null, savedChars: ep.savedChars||null,
    };
    setScreen('player');
  }

  // ── Save episode helper ────────────────────────────
  async function saveEpisode(chunks, ended) {
    if (!chunks.length || !activeEp) return;
    const ep = {
      ...activeEp,
      storyChunks: chunks,
      wordCount: chunks.reduce((a,c)=>a+c.text.split(/\s+/).length,0),
      ended, savedAt: Date.now(),
      savedScenes: stateRef.current.savedScenes||null,
      savedChars: stateRef.current.savedChars||null,
    };
    const { db_saveEpisode } = await import('../../lib/firebase');
    await db_saveEpisode(user.uid, ep);
  }

  // ── Story generation ───────────────────────────────
  async function sendContinue() {
    if (isGenRef.current || playerEnded) return;
    isGenRef.current = true; setIsGenerating(true);

    const chunks  = playerChunks;
    const hint    = promptHint;
    const bible   = stateRef.current.seasonBible||'';
    const prompt  = stateRef.current.prompt||'';

    const sys = `You are a Hindi horror story writer. Write ONLY in Hindi Devanagari.
RULES: 100-120 words per part. End on cliffhanger. Emotion tags: [scared][whisper][laugh][cry][angry][shocked][calm]
${bible?`\nPREVIOUS SEASON:\n${bible}`:''}`;

    const msgs = chunks.length===0
      ? [{role:'user',content:`केवल हिंदी देवनागरी में लिखो।\n\n${prompt?'कहानी: '+prompt+'\n\n':''}पहला भाग — दृश्य, पात्र, रहस्य। 100-120 शब्द।`}]
      : [
          {role:'user',content:`पिछली कहानी:\n\n${chunks.map((c,i)=>`[Part ${i+1}]:\n${c.text}`).join('\n\n')}`},
          {role:'assistant',content:'[कहानी जारी है...]'},
          {role:'user',content:hint?`direction: "${hint}"। हिंदी। 100-120 words। Cliffhanger।`:`अगला भाग। हिंदी। 100-120 words। Cliffhanger।`},
        ];

    const partNum = chunks.length+1;
    setPlayerChunks([...chunks,{text:'',partNum,streaming:true}]);
    setPromptHint('');

    try {
      const res = await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'openai/gpt-4o-mini',messages:[{role:'system',content:sys},...msgs],max_tokens:400,temperature:0.88,stream:true})});
      const reader=res.body.getReader(),dec=new TextDecoder();
      let full='';
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue;
          const d=line.slice(6).trim(); if(d==='[DONE]') break;
          try{ const delta=JSON.parse(d).choices?.[0]?.delta?.content||''; if(delta){full+=delta;setPlayerChunks(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],text:full};return u;});scrollBottom();} }catch{}
        }
      }
      if(full.trim()){
        const final=[...chunks,{text:full.trim(),partNum}];
        setPlayerChunks(final);
        setWordCount(final.reduce((a,c)=>a+c.text.split(/\s+/).length,0));
        saveEpisode(final,false);
      }
    } catch(e){ setPlayerChunks(chunks); toast('❌ '+e.message); }
    isGenRef.current=false; setIsGenerating(false); scrollBottom();
  }

  async function endStoryNow() {
    if (isGenRef.current||playerEnded) return;
    isGenRef.current=true; setIsGenerating(true);
    const chunks=playerChunks;
    const storyCtx=chunks.map((c,i)=>`[Part ${i+1}]:\n${c.text}`).join('\n\n');
    setPlayerChunks([...chunks,{text:'',partNum:chunks.length+1,isEnd:true,streaming:true}]);
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'openai/gpt-4o-mini',messages:[{role:'system',content:'Write ONLY in Hindi Devanagari.'},{role:'user',content:`${storyCtx}\n\nPowerful scary ending हिंदी में। 100-120 words। "समाप्त" se khatam karo।`}],max_tokens:500,temperature:0.85,stream:true})});
      const reader=res.body.getReader(),dec=new TextDecoder(); let full='';
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue;
          const d=line.slice(6).trim(); if(d==='[DONE]') break;
          try{const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';if(delta){full+=delta;setPlayerChunks(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],text:full};return u;});}}catch{}
        }
      }
      const final=[...chunks,{text:full.trim(),partNum:chunks.length+1,isEnd:true}];
      setPlayerChunks(final); setPlayerEnded(true); setShowEndBanner(true);
      await saveEpisode(final,true);
      toast('✅ Episode save ho gaya!');
      setTimeout(()=>{generateScenesAuto(final);generateCharsAuto(final);},1200);
    }catch(e){toast('❌ '+e.message);}
    isGenRef.current=false; setIsGenerating(false); scrollBottom();
  }

  // ── Scenes ─────────────────────────────────────────
  async function generateScenesAuto(chunks) {
    setScenesLoading(true);
    const storyText = (chunks || playerChunks).map(c => c.text).join('\n\n');
    const curChars  = stateRef.current.savedChars || chars || [];
    const charList  = curChars.length
      ? curChars.map(c => `${c.name} (${c.role})`).join(', ')
      : '';
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai/gpt-4o-mini', max_tokens: 3000, temperature: 0.35,
          messages: [{ role: 'user', content: `Story: "${stateRef.current.title || ''}":\n\n${storyText}\n\n${charList ? `Story ke characters: ${charList}\n\n` : ''}MINIMUM 15 SCENES. Har scene ke liye:\n\nSCENE_START\nnum: [number]\ntitle: [Hindi title]\nlocation: [location]\nmood: [Daravna/Suspenseful/Intense/Creepy/Shocking]\nwhat: [kya hua — 1 line Hindi]\nchars_in_scene: [comma separated character names jo is scene mein hain, story ke context se decide karo]\nimgprompt: [English — cinematic webtoon 2D flat illustration, clean lineart. Start with: "Use these reference images: [char names present in scene]". Dark horror atmosphere. 50-70 words.]\nSCENE_END\n\nSirf format.` }],
        })
      });
      const data   = await res.json();
      const raw    = data.choices?.[0]?.message?.content || '';
      const parsed = parseScenes(raw);
      if (parsed.length) {
        setScenes(parsed);
        stateRef.current.savedScenes = parsed;
        saveEpisode(playerChunks, playerEnded);
        toast(`✅ ${parsed.length} scenes ready!`);
      }
    } catch(e) { toast('❌ Scenes: ' + e.message); }
    setScenesLoading(false);
  }

  function parseScenes(raw) {
    return raw.split('SCENE_START').slice(1).map(b => {
      const blk = b.slice(0, b.indexOf('SCENE_END') > -1 ? b.indexOf('SCENE_END') : undefined);
      const g   = (k) => { const m = blk.match(new RegExp(k + ':\\s*(.+)')); return m ? m[1].trim() : ''; };
      return {
        num:            g('num'),
        title:          g('title'),
        location:       g('location'),
        mood:           g('mood'),
        what:           g('what'),
        chars_in_scene: g('chars_in_scene'),
        imgprompt:      g('imgprompt'),
      };
    }).filter(s => s.title);
  }

  // ── Characters with reference image system ─────────
  async function generateCharsAuto(chunks) {
    setCharsLoading(true);
    const storyText=(chunks||playerChunks).map(c=>c.text).join('\n\n');
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'openai/gpt-4o-mini',max_tokens:1500,temperature:0.3,
          messages:[{role:'user',content:`Story: "${stateRef.current.title||''}"\n\n${storyText}\n\nIs story ke SAARE characters identify karo aur list karo.\n\nHar character ke liye:\n[{"name":"naam","role":"Hero/Villain/Supporting/Minor","desc":"2-3 lines Hindi mein character ka description","visual":"English mein: age, height, build, face, hair color, eye color, skin tone, clothing style — jo image generation ke liye use hoga. 30-40 words.","appear":"Kis scene/part mein aaya"}]\n\nSirf JSON array. Koi extra text nahi.`}],
        })});
      const data=await res.json();
      const raw=data.choices?.[0]?.message?.content?.trim()||'[]';
      const parsed=JSON.parse(raw.replace(/```json|```/g,'').trim());
      if(Array.isArray(parsed)&&parsed.length){
        setChars(parsed);
        stateRef.current.savedChars=parsed;
        stateRef.current.characterBible=parsed;
        saveEpisode(playerChunks,playerEnded);
        toast(`✅ ${parsed.length} characters ready!`);
      }
    }catch(e){toast('❌ Characters: '+e.message);}
    setCharsLoading(false);
  }

  function scrollBottom(){setTimeout(()=>{if(storyAreaRef.current)storyAreaRef.current.scrollTop=storyAreaRef.current.scrollHeight;},50);}
  function copyText(t){navigator.clipboard.writeText(t).then(()=>toast('✅ Copied!'));}

  // Build character-aware scene prompt
  function buildScenePrompt(scene, charList) {
    if (!charList?.length) return scene.imgprompt || '';
    const mentioned = charList.filter(c =>
      scene.what?.includes(c.name) || scene.imgprompt?.toLowerCase().includes(c.name.toLowerCase())
    );
    const refs = mentioned.length ? mentioned : charList.slice(0,2);
    let refText = '';
    if (refs.length === 1) refText = `Use reference image #${charList.indexOf(refs[0])+1} for ${refs[0].name}.`;
    else refText = `Use these reference characters: ${refs.map((c,i)=>`reference image #${charList.indexOf(c)+1} for ${c.name}`).join(', ')}.`;
    return `${scene.imgprompt||''} ${refText}`;
  }

  const storyList  = Object.entries(groups);
  const seasonMap  = screen !== 'stories' ? getSeasonsForStory(curStory) : {};
  const seasonList = Object.entries(seasonMap);
  const breadcrumb = [
    {label:'My Stories',sc:'stories'},
    ...(screen!=='stories'?[{label:curStory.length>14?curStory.slice(0,12)+'…':curStory,sc:'seasons'}]:[]),
    ...(screen==='episodes'||screen==='player'?[{label:curSeason,sc:'episodes'}]:[]),
    ...(screen==='player'?[{label:(activeEp?.epNum||'EP'),sc:'player'}]:[]),
  ];
  const TARGET=1500;
  const wcPct=Math.min(100,(wordCount/TARGET)*100);
  const seasonEnded=activeEp?.seasonEnded||false;

  // ─── RENDER ────────────────────────────────────────
  return (
    <>
      <SideDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} user={user}/>

      <div className="page-content" style={{background:'var(--void)'}}>

        {/* ── Breadcrumb topbar ── */}
        <div style={{display:'flex',alignItems:'center',height:52,padding:'0 12px',gap:6,background:'rgba(10,0,10,0.97)',borderBottom:'1px solid #1a0015',position:'sticky',top:0,zIndex:100}}>
          {screen==='stories'
            ? <button className="hamburger-btn" onClick={()=>setDrawerOpen(true)} style={{flexShrink:0}}>☰</button>
            : <button onClick={()=>{
                if(screen==='player') setScreen('episodes');
                else if(screen==='episodes') setScreen('seasons');
                else setScreen('stories');
              }} style={{background:'none',border:'none',color:'#888',fontSize:20,cursor:'pointer',padding:'4px 8px',flexShrink:0}}>←</button>
          }
          <div style={{flex:1,display:'flex',alignItems:'center',overflow:'hidden'}}>
            {breadcrumb.map((crumb,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',minWidth:0}}>
                {i>0&&<span style={{color:'#330022',fontSize:14,margin:'0 3px',flexShrink:0}}>›</span>}
                <button onClick={()=>{if(crumb.sc!=='player')setScreen(crumb.sc);}}
                  style={{background:'none',border:'none',cursor:i<breadcrumb.length-1?'pointer':'default',padding:0,
                    fontFamily:"'Cinzel Decorative',serif",fontSize:i===breadcrumb.length-1?11:9,fontWeight:900,
                    color:i===breadcrumb.length-1?'#cc2233':'#552233',letterSpacing:1,
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:i===breadcrumb.length-1?160:70}}>
                  {['📚','📂','🎬','📝'][i]} {crumb.label}
                </button>
              </div>
            ))}
          </div>
          {/* Analysis toggle in player */}
          {screen==='player'&&<button onClick={()=>setShowAnalysis(a=>!a)} style={{background:'none',border:'none',color:showAnalysis?'#cc2233':'#555',fontSize:18,cursor:'pointer',padding:4}}>🎬</button>}
          <div style={{width:screen==='player'?0:36,flexShrink:0}}/>
        </div>

        {/* ── CONTENT ── */}
        <div style={{flex:1,overflowY:'auto',padding:screen==='player'?0:12}}>

          {/* ── Level 1: Stories ── */}
          {screen==='stories'&&(
            <>
              {loading&&<div style={{textAlign:'center',padding:'60px 20px',color:'#333'}}><div className="spinner" style={{margin:'0 auto 12px'}}/>Loading...</div>}
              {!loading&&storyList.length===0&&(
                <div style={{textAlign:'center',padding:'60px 20px',color:'#333',fontSize:14,lineHeight:2}}>
                  <span style={{fontSize:40,display:'block',marginBottom:12}}>📭</span>
                  Koi story save nahi hui abhi.<br/><span style={{fontSize:12,color:'#2a2a2a'}}>Generate tab se pehli story likho!</span>
                </div>
              )}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {storyList.map(([baseTitle,epList])=>{
                  const totalSeasons=new Set(epList.map(e=>e.season||'SEASON 1')).size;
                  const words=epList.reduce((s,e)=>s+(e.wordCount||0),0);
                  const latest=epList.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))[0];
                  // total views across all episodes of this story
                  const totalViews=epList.reduce((sum,ep)=>{
                    const info=getEpYtInfo(ep);
                    return sum+(info?.video.viewCount||0);
                  },0);
                  return(
                    <div key={baseTitle} onClick={()=>{setCurStory(baseTitle);setScreen('seasons');}}
                      style={{background:'#0d000d',border:'1px solid #2a0022',borderRadius:12,padding:14,cursor:'pointer'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='#550033'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='#2a0022'}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#3a0022,#1a000f)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,border:'1px solid #440022'}}>📂</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:'#ddd',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{baseTitle}</div>
                          <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                            <span style={{fontSize:10,color:'#880000',background:'rgba(136,0,0,0.12)',border:'1px solid #330000',borderRadius:4,padding:'2px 7px'}}>{totalSeasons} Season{totalSeasons>1?'s':''}</span>
                            <span style={{fontSize:10,color:'#555',background:'rgba(255,255,255,0.04)',border:'1px solid #222',borderRadius:4,padding:'2px 7px'}}>{epList.length} Episodes</span>
                            {totalViews>0&&<span style={{fontSize:10,color:'#ff4444',background:'rgba(255,0,0,0.08)',border:'1px solid #330000',borderRadius:4,padding:'2px 7px'}}>▶ {fmtViews(totalViews)} views</span>}
                          </div>
                        </div>
                        <span style={{fontSize:18,color:'#330022',flexShrink:0}}>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Level 2: Seasons ── */}
          {screen==='seasons'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {seasonList.map(([season,sEps])=>{
                const allDone=sEps.every(e=>e.ended);
                const words=sEps.reduce((s,e)=>s+(e.wordCount||0),0);
                const totalViews=sEps.reduce((sum,ep)=>{const info=getEpYtInfo(ep);return sum+(info?.video.viewCount||0);},0);
                return(
                  <div key={season} onClick={()=>{setCurSeason(season);setSeasonEps(sEps.sort((a,b)=>(a.epNum||'').localeCompare(b.epNum||'')));setScreen('episodes');}}
                    style={{background:'#0a000a',border:'1px solid #220018',borderRadius:12,padding:14,cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#440033'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#220018'}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#1a0033,#0d0018)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,border:'1px solid #330033'}}>🗂</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:9,color:'#550033',letterSpacing:2,textTransform:'uppercase',marginBottom:3}}>{season} {allDone?'🔒':''}</div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          <span style={{fontSize:10,color:'#555',background:'rgba(255,255,255,0.04)',border:'1px solid #222',borderRadius:4,padding:'2px 7px'}}>{sEps.length} Episodes</span>
                          <span style={{fontSize:10,borderRadius:4,padding:'2px 7px',border:`1px solid ${allDone?'#1a4a22':'#3a2200'}`,color:allDone?'#44bb66':'#cc8822',background:allDone?'rgba(0,80,0,0.1)':'rgba(80,40,0,0.1)'}}>
                            {allDone?'✅ Complete':'🔄 Ongoing'}
                          </span>
                          {totalViews>0&&<span style={{fontSize:10,color:'#ff4444',background:'rgba(255,0,0,0.08)',border:'1px solid #330000',borderRadius:4,padding:'2px 7px'}}>▶ {fmtViews(totalViews)}</span>}
                        </div>
                      </div>
                      <span style={{fontSize:18,color:'#330022',flexShrink:0}}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Level 3: Episodes ── */}
          {screen==='episodes'&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {seasonEps.map(ep=>{
                const epYtTitle=(ep.title||'').split(' | ')[1]||ep.title||'Untitled';
                const savedDate=ep.savedAt?new Date(ep.savedAt).toLocaleDateString('hi-IN'):'';
                const ytInfo=getEpYtInfo(ep);
                const isTrending=ytInfo&&ytInfo.rank===1;
                const seasonDone=seasonEps.every(e=>e.ended);
                return(
                  <div key={ep.id} onClick={()=>openEpisode(ep)}
                    style={{background: isTrending?'rgba(255,60,0,0.05)':'#080008',border:`1px solid ${isTrending?'#661100':'#1a0015'}`,borderRadius:12,padding:14,cursor:'pointer',display:'flex',alignItems:'center',gap:12,position:'relative'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=isTrending?'#aa2200':'#440033'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=isTrending?'#661100':'#1a0015'}>

                    {/* Trending badge */}
                    {isTrending&&<div style={{position:'absolute',top:-6,right:10,background:'linear-gradient(135deg,#cc3300,#880000)',borderRadius:20,padding:'2px 8px',fontSize:9,fontWeight:800,color:'#fff',letterSpacing:1}}>🔥 #1 TRENDING</div>}

                    <div style={{width:40,height:40,borderRadius:10,background:ep.ended?'linear-gradient(135deg,#003300,#001a00)':isTrending?'linear-gradient(135deg,#331100,#1a0800)':'linear-gradient(135deg,#1a0000,#0d0000)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,border:`1px solid ${ep.ended?'#004400':isTrending?'#551100':'#330000'}`}}>
                      {isTrending?'🔥':ep.ended?'✅':'📝'}
                    </div>

                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        <span style={{fontSize:9,color:'#880000',fontWeight:800,letterSpacing:1.5,textTransform:'uppercase'}}>{ep.epNum||'EP 01'}</span>
                        <span style={{fontSize:9,color:ep.ended?'#44bb66':'#cc8822',background:ep.ended?'rgba(0,80,0,0.12)':'rgba(80,40,0,0.12)',border:`1px solid ${ep.ended?'#1a4a22':'#3a2200'}`,borderRadius:3,padding:'1px 5px'}}>
                          {ep.ended?(seasonDone?'🔒 Locked':'Done'):'Ongoing'}
                        </span>
                      </div>
                      <div style={{fontSize:13,fontWeight:600,color:'#ddd',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{epYtTitle}</div>
                      <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap'}}>
                        <span style={{fontSize:10,color:'#444'}}>{ep.wordCount||0} words</span>
                        {savedDate&&<span style={{fontSize:10,color:'#333'}}>· {savedDate}</span>}
                        {/* YouTube badge */}
                        {ytInfo?(
                          <a href={`https://youtube.com/watch?v=${ytInfo.video.videoId}`} target="_blank"
                            onClick={e=>e.stopPropagation()}
                            style={{fontSize:10,color:'#ff4444',fontWeight:700,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}>
                            ▶ {fmtViews(ytInfo.video.viewCount)} views
                            <span style={{color:ytInfo.rank===1?'#ffcc00':ytInfo.rank<=3?'#ff8844':'#666',fontWeight:800}}>
                              {ytInfo.rank===1?'🥇':ytInfo.rank===2?'🥈':ytInfo.rank===3?'🥉':`#${ytInfo.rank}`}
                            </span>
                          </a>
                        ):(
                          <span style={{fontSize:10,color:'#333'}}>❌ Not uploaded</span>
                        )}
                      </div>
                    </div>

                    {/* Delete — only if not uploaded and not season-locked */}
                    {!ytInfo&&!seasonDone&&(
                      <button onClick={e=>{e.stopPropagation();deleteEpisode(ep.id);}}
                        style={{flexShrink:0,background:'rgba(80,0,0,0.2)',border:'1px solid #330000',color:'#553333',fontSize:14,padding:'8px 10px',borderRadius:8,cursor:'pointer'}}>🗑</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Level 4: Inline Player ── */}
          {screen==='player'&&activeEp&&(
            <div style={{display:'flex',flexDirection:'column',minHeight:'calc(100dvh - 52px)'}}>

              {/* Story area */}
              {!showAnalysis&&(
                <>
                  <div className="story-area" ref={storyAreaRef} style={{flex:1}}>
                    {playerChunks.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#333',fontSize:13}}>Neeche "Continue Karo" dabao...</div>}
                    {playerChunks.map((chunk,idx)=>(
                      <div key={idx} className="story-chunk">
                        <div className="chunk-meta">
                          <span>{chunk.isEnd?'🩸':'📖'}</span>
                          <span style={{fontSize:10,color:'var(--blood)',fontWeight:700,letterSpacing:1}}>
                            {chunk.isEnd?'THE END':`EP ${String((activeEp.epNum||'EP 01').match(/\d+/)?.[0]||1).padStart(2,'0')} · PART ${chunk.partNum||idx+1}`}
                          </span>
                        </div>
                        <div className="chunk-text">{chunk.text}{chunk.streaming&&!chunk.text&&<span className="cursor-blink"/>}</div>
                      </div>
                    ))}
                    {showEndBanner&&(
                      <div className="end-banner show" style={{margin:'0 16px 16px'}}>
                        <div className="end-banner-title">🩸 The End 🩸</div>
                        <div className="end-banner-sub">{activeEp.season} · {activeEp.epNum} complete!</div>
                        {seasonEnded&&<div style={{fontSize:11,color:'#cc6600',background:'rgba(80,30,0,0.15)',border:'1px solid #441100',borderRadius:8,padding:'8px 12px'}}>🔒 Season complete — edit nahi ho sakta</div>}
                      </div>
                    )}
                  </div>

                  {/* Word count */}
                  <div style={{padding:'0 16px 4px',background:'var(--panel)',borderTop:'1px solid var(--border)'}}>
                    <div className="wordcount-bar">
                      <span className="wc-label">{wordCount} words</span>
                      <div className="wc-track"><div className="wc-fill" style={{width:wcPct+'%'}}/></div>
                      <span className="wc-label">/ ~{TARGET}</span>
                    </div>
                  </div>

                  {/* Bottom bar — disabled if season ended */}
                  <div className="bottom-bar">
                    {seasonEnded||playerEnded?(
                      <div style={{textAlign:'center',padding:'8px',color:'#553333',fontSize:12}}>
                        {seasonEnded?'🔒 Season end ho gaya — edit nahi ho sakta':'✅ Episode khatam ho gaya'}
                      </div>
                    ):(
                      <>
                        <div className="action-chips">
                          {[['😱 Tension','Aur tension badhao'],['👻 Creepy','Ek creepy turn'],['👤 Character','Character describe karo'],['🌑 Dark','Atmosphere dark karo'],['💬 Dialog','Dialog likhao'],['⚡ Twist!','Shocking revelation']].map(([l,h])=>(
                            <div key={l} className="action-chip" onClick={()=>setPromptHint(h)}>{l}</div>
                          ))}
                          <div className="action-chip" style={{borderColor:'#550000',color:'#cc4444'}} onClick={endStoryNow}>🔚 End</div>
                        </div>
                        <div className="prompt-row">
                          <textarea className="prompt-input" placeholder="Direction do (optional)..." rows={1} value={promptHint}
                            onChange={e=>setPromptHint(e.target.value)}
                            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendContinue();}}}/>
                          <button className="send-btn" onClick={sendContinue} disabled={isGenerating}>▶</button>
                        </div>
                        <button className={`continue-btn${isGenerating?' loading':''}`} onClick={sendContinue} disabled={isGenerating}>
                          {isGenerating?<><div className="spinner"/><span>Likh raha hai...</span></>:<span>📖 Continue Karo</span>}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Analysis panel */}
              {showAnalysis&&(
                <div className="analysis-content" style={{flex:1,paddingBottom:80}}>

                  {/* Characters */}
                  <div className="analysis-panel">
                    <div className="analysis-generate-bar">
                      <div style={{fontSize:11,color:'#888',fontWeight:700,marginBottom:4}}>👤 CHARACTERS</div>
                      <div className="analysis-hint">
                        Har character ka reference image upload karo — AI usse scene prompts mein use karega.
                        {chars?.length>0&&<span style={{color:'#44bb66'}}> {chars.length} characters ready.</span>}
                      </div>
                      <button className="btn btn-primary" onClick={()=>generateCharsAuto()} disabled={charsLoading||!playerChunks.length}>
                        {charsLoading?<><div className="spinner"/>Generating...</>:'👤 Character List Generate Karo'}
                      </button>
                    </div>
                    {chars?.map((c,i)=>(
                      <div key={i} className="char-card">
                        <div className="char-name">
                          <span style={{fontSize:12,color:'#666',marginRight:4}}>#{i+1}</span>
                          {c.name}<span className="char-role-badge">{c.role}</span>
                        </div>
                        <div className="char-desc">{c.desc}</div>
                        {c.visual&&(
                          <div style={{background:'#0a000f',border:'1px solid #2a003a',borderRadius:8,padding:'8px 10px',marginTop:6}}>
                            <div style={{fontSize:9,color:'#bb66ff',letterSpacing:2,textTransform:'uppercase',marginBottom:4}}>🖼 Reference Image Prompt #{i+1}</div>
                            <div style={{fontSize:12,color:'#c8c8c8',lineHeight:1.7}}>{c.visual}</div>
                            <button onClick={()=>copyText(c.visual)} style={{marginTop:6,background:'transparent',border:'1px solid #440066',color:'#cc88ff',padding:'4px 10px',borderRadius:6,fontSize:11,cursor:'pointer'}}>📋 Copy Visual Prompt</button>
                          </div>
                        )}
                        {c.appear&&<div className="char-appear">📍 {c.appear}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Scenes */}
                  <div className="analysis-panel" style={{marginTop:12}}>
                    <div className="analysis-generate-bar">
                      <div style={{fontSize:11,color:'#888',fontWeight:700,marginBottom:4}}>🎬 SCENES</div>
                      <div className="analysis-hint">
                        Scene breakdown + image prompts.
                        {chars?.length>0&&<span style={{color:'#44bb66'}}> Character references automatically included.</span>}
                      </div>
                      <button className="btn btn-primary" onClick={()=>generateScenesAuto()} disabled={scenesLoading||!playerChunks.length}>
                        {scenesLoading?<><div className="spinner"/>Scenes ban rahe hain...</>:'🎬 Scene Breakdown Generate Karo'}
                      </button>
                    </div>
                    {scenes?.map((s, i) => {
                      const sceneChars = s.chars_in_scene
                        ? s.chars_in_scene.split(',').map(n => n.trim()).filter(Boolean)
                        : [];

                      const charPrompts = sceneChars.map(name => {
                        const found = (chars || []).find(c => c.name?.toLowerCase() === name.toLowerCase());
                        const desc  = found?.desc || '';
                        return `full body character sheet, front side view, ${name}${desc ? ', ' + desc : ''}, webtoon 2D style, flat illustration, clean lineart, white background, multiple expressions, multiple poses`;
                      });

                      const imagePrompt = s.imgprompt || '';

                      const videoPrompt = `Convert this illustration to a short animated video clip (3-5 seconds). Subtle motion only — eyes blinking, cloth movement, hair sway, atmospheric fog. Maintain the exact webtoon 2D flat illustration style. No camera movement. Dark horror atmosphere. Keep all character appearances identical to the reference image.${sceneChars.length ? ` Characters present: ${sceneChars.join(', ')}.` : ''}`;

                      return (
                        <div key={i} className="scene-card">
                          <div className="scene-num">🎬 Scene {s.num} <span style={{color:'#444',fontSize:9}}>{(s.mood||'').toUpperCase()}</span></div>
                          <div className="scene-title">{s.title}</div>
                          <div className="scene-meta"><span className="scene-tag">📍 {s.location}</span></div>
                          <div className="scene-desc">{s.what}</div>

                          {sceneChars.length > 0 && (
                            <div style={{display:'flex',flexWrap:'wrap',gap:6,margin:'8px 0 4px'}}>
                              {sceneChars.map((name, ci) => (
                                <span key={ci} style={{
                                  fontSize:10, padding:'3px 8px',
                                  background:'#1a0000', border:'1px solid #440000',
                                  borderRadius:20, color:'#cc4444', letterSpacing:0.5
                                }}>👤 {name}</span>
                              ))}
                            </div>
                          )}

                          <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:10}}>

                            {sceneChars.length > 0 && charPrompts.map((cp, ci) => (
                              <button key={ci}
                                onClick={() => copyText(cp) && toast(`✅ ${sceneChars[ci]} character prompt copy ho gaya!`)}
                                onClickCapture={() => navigator.clipboard.writeText(cp).then(() => toast(`✅ ${sceneChars[ci]} character prompt copy ho gaya!`))}
                                style={{
                                  background:'#0a000a', border:'1px solid #440044',
                                  color:'#cc66cc', borderRadius:8, fontSize:12,
                                  padding:'8px 10px', cursor:'pointer', width:'100%',
                                  textAlign:'left'
                                }}>
                                👤 Copy: {sceneChars[ci]} Character Prompt
                              </button>
                            ))}

                            {imagePrompt && (
                              <button
                                onClick={() => navigator.clipboard.writeText(imagePrompt).then(() => toast('✅ Image prompt copy ho gaya!'))}
                                style={{
                                  background:'#0a0000', border:'1px solid #440000',
                                  color:'#cc4444', borderRadius:8, fontSize:12,
                                  padding:'8px 10px', cursor:'pointer', width:'100%',
                                  textAlign:'left'
                                }}>
                                🖼 Copy: Scene Image Prompt
                              </button>
                            )}

                            <button
                              onClick={() => navigator.clipboard.writeText(videoPrompt).then(() => toast('✅ Video prompt copy ho gaya!'))}
                              style={{
                                background:'#000a0a', border:'1px solid #004444',
                                color:'#44aaaa', borderRadius:8, fontSize:12,
                                padding:'8px 10px', cursor:'pointer', width:'100%',
                                textAlign:'left'
                              }}>
                              🎬 Copy: Image → Video Prompt
                            </button>

                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}

            </div>
          )}

        </div>
      </div>

      <BottomNav userInitial={initial}/>
    </>
  );
}

export default function MyStoriesPageWrapper() {
  return (
    <ToastProvider>
      <AuthWrapper>
        {({user})=><MyStoriesPage user={user}/>}
      </AuthWrapper>
    </ToastProvider>
  );
}
