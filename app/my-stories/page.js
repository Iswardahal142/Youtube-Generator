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

// ── Collapsible Panel Header ───────────────────────
function PanelHeader({ icon, title, open, onToggle, rightEl }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:open?8:0}}>
      <div style={{fontSize:11,color:'#888',fontWeight:700}}>{icon} {title}</div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        {rightEl}
        <button onClick={onToggle}
          style={{background:'#1a0010',border:'1px solid #330022',color:'#cc4466',
            width:26,height:26,borderRadius:6,fontSize:18,lineHeight:1,cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontWeight:700}}>
          {open?'−':'+'}
        </button>
      </div>
    </div>
  );
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

  const [ytVideos,  setYtVideos]  = useState([]);
  const [ytRankMap, setYtRankMap] = useState({});
  const ytLoaded = useRef(false);

  const [activeEp,      setActiveEp]      = useState(null);
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
  const [narration,        setNarration]        = useState('');
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [showNarration,    setShowNarration]    = useState(false);

  // Collapsible panels
  const [showCharsPanel,  setShowCharsPanel]  = useState(true);
  const [showMusicPanel,  setShowMusicPanel]  = useState(true);
  const [showScenesPanel, setShowScenesPanel] = useState(true);

  // Scene accordion
  const [expandedScene, setExpandedScene] = useState(null);

  // ── YouTube Music states (replaces bgMusic) ──────
  const [ytMusicVideos,   setYtMusicVideos]   = useState([]);
  const [ytMusicLoading,  setYtMusicLoading]  = useState(false);
  const [ytMusicQuery,    setYtMusicQuery]     = useState('horror ambient background music no copyright');
  const [currentMusicIdx, setCurrentMusicIdx] = useState(0);
  const [previewModalVideo, setPreviewModalVideo] = useState(null);

  // Delete story modal
  const [deleteConfirmStory, setDeleteConfirmStory] = useState(null);
  const [deleteInput,        setDeleteInput]        = useState('');

  // Episode end type: 'episode' = story continues, 'story' = story over
  const [epEndType,           setEpEndType]           = useState(null); // null|'episode'|'story'
  // Next Episode modal
  const [showNextEpModal,     setShowNextEpModal]     = useState(false);
  const [nextEpLoading,       setNextEpLoading]       = useState(false);
  // Season finale loading
  const [seasonFinaleLoading, setSeasonFinaleLoading] = useState(false);

  const storyAreaRef = useRef(null);
  const isGenRef     = useRef(false);
  const stateRef     = useRef({});

  const displayName = user?.displayName || user?.email || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

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
    // Agar player open hai toh activeEp ko bhi fresh data se update karo
    setActiveEp(prev => {
      if (!prev) return prev;
      const fresh = eps?.find(e => e.id === prev.id);
      if (!fresh) return prev;
      // ended/storyFullyEnded update karo — baki UI state mat chhuao
      return { ...prev, ended: fresh.ended, storyFullyEnded: fresh.storyFullyEnded, title: fresh.title || prev.title };
    });
    // seasonEps bhi update karo
    setSeasonEps(prev => {
      if (!prev.length) return prev;
      return prev.map(ep => {
        const fresh = eps?.find(e => e.id === ep.id);
        return fresh ? { ...ep, ended: fresh.ended, storyFullyEnded: fresh.storyFullyEnded } : ep;
      });
    });
    return eps;
  }

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

  async function confirmDeleteStory(baseTitle) {
    if (deleteInput.trim() !== 'DELETE') { toast('❌ "DELETE" likho confirm karne ke liye'); return; }
    const epList = groups[baseTitle] || [];
    const { db_deleteEpisode } = await import('../../lib/firebase');
    for (const ep of epList) await db_deleteEpisode(user.uid, ep.id);
    toast(`🗑 "${baseTitle}" aur saare episodes delete ho gaye`);
    setDeleteConfirmStory(null); setDeleteInput('');
    await loadEpisodes(); setScreen('stories');
  }

  async function openEpisode(epInput) {
    // Firestore se fresh episode data fetch karo — stale local state avoid karne ke liye
    let ep = epInput;
    try {
      const { db_getEpisodes } = await import('../../lib/firebase');
      const freshEps = await db_getEpisodes(user.uid);
      const fresh = freshEps?.find(e => e.id === epInput.id);
      if (fresh) ep = fresh;
    } catch {}

    const seasonEnded = seasonEps.every(e => e.ended&&e.seasonEnded);
    setActiveEp({ ...ep, seasonEnded });
    setPlayerChunks(ep.storyChunks || []);
    setPlayerEnded(ep.ended || false);
    setShowEndBanner(ep.ended || false);
    // epEndType — Firestore ke ended/storyFullyEnded se restore karo
    if(ep.ended) setEpEndType(ep.storyFullyEnded ? 'story' : 'episode');
    else setEpEndType(null);
    setWordCount((ep.storyChunks||[]).reduce((a,c)=>a+c.text.split(/\s+/).length,0));
    setScenes(ep.savedScenes || null);
    setChars(ep.savedChars || null);
    setShowAnalysis(false);
    setExpandedScene(null);
    setNarration(ep.savedNarration || '');
    setShowNarration(false);
    setYtMusicVideos([]); setCurrentMusicIdx(0); setPreviewModalVideo(null);
    stateRef.current = {
      title: ep.title, season: ep.season||'SEASON 1', epNum: ep.epNum||'EP 01',
      currentEpId: ep.id, prompt: ep.prompt||'', seasonBible: ep.seasonBible||null,
      characterBible: ep.characterBible||null, savedChars: ep.savedChars||null,
      savedScenes: ep.savedScenes||null,
    };
    setScreen('player');
  }

  async function saveEpisode(chunks, ended, storyFullyEnded) {
    if (!chunks.length || !activeEp) return;
    // ended ko NEVER false se overwrite karo agar already true hai
    const finalEnded = ended || activeEp.ended || false;
    // storyFullyEnded — parameter > activeEp > false
    const finalStoryFullyEnded = (storyFullyEnded !== undefined) ? storyFullyEnded : (activeEp.storyFullyEnded || false);
    const ep = {
      ...activeEp, storyChunks: chunks,
      wordCount: chunks.reduce((a,c)=>a+c.text.split(/\s+/).length,0),
      ended: finalEnded,
      storyFullyEnded: finalStoryFullyEnded,
      savedAt: Date.now(),
      savedScenes: stateRef.current.savedScenes||null,
      savedChars: stateRef.current.savedChars||null,
    };
    const { db_saveEpisode } = await import('../../lib/firebase');
    await db_saveEpisode(user.uid, ep);
  }

  async function sendContinue() {
    if (isGenRef.current || playerEnded) return;
    isGenRef.current = true; setIsGenerating(true);
    const chunks = playerChunks, hint = promptHint;
    const bible  = stateRef.current.seasonBible||'', prompt = stateRef.current.prompt||'';
    const charBible = stateRef.current.characterBible;
    const charStatus = Array.isArray(charBible)&&charBible.length
      ? `\n\nCHARACTER STATUS (inhe follow karo strictly):\n${charBible.map(c=>`- ${c.name} (${c.status||'Alive'})${c.status==='Dead'?' — DEAD, wapas normal nahi aa sakta':c.status==='Ghost'?' — Ghost hai':''}`).join('\n')}`
      : '';
    const sys = `You are a Hindi horror story writer. Write ONLY in Hindi Devanagari.\nRULES: 100-120 words per part. End on cliffhanger. Emotion tags: [scared][whisper][laugh][cry][angry][shocked][calm]\n${bible?`\nSEASON BIBLE (story continuity):\n${bible}`:''}${charStatus}`;
    const msgs = chunks.length===0
      ? [{role:'user',content:`केवल हिंदी देवनागरी में लिखो।\n\n${prompt?'कहानी: '+prompt+'\n\n':''}पहला भाग — दृश्य, पात्र, रहस्य। 100-120 शब्द।`}]
      : [{role:'user',content:`पिछली कहानी:\n\n${chunks.map((c,i)=>`[Part ${i+1}]:\n${c.text}`).join('\n\n')}`},{role:'assistant',content:'[कहानी जारी है...]'},{role:'user',content:hint?`direction: "${hint}"। हिंदी। 100-120 words। Cliffhanger।`:`अगला भाग। हिंदी। 100-120 words। Cliffhanger।`}];
    const partNum = chunks.length+1;
    setPlayerChunks([...chunks,{text:'',partNum,streaming:true}]); setPromptHint('');
    try {
      const res = await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-4o-mini',messages:[{role:'system',content:sys},...msgs],max_tokens:400,temperature:0.88,stream:true})});
      const reader=res.body.getReader(),dec=new TextDecoder(); let full='';
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue;
          const d=line.slice(6).trim(); if(d==='[DONE]') break;
          try{const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';if(delta){full+=delta;setPlayerChunks(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],text:full};return u;});scrollBottom();}}catch{}
        }
      }
      if(full.trim()){const final=[...chunks,{text:full.trim(),partNum}];setPlayerChunks(final);setWordCount(final.reduce((a,c)=>a+c.text.split(/\s+/).length,0));if(!activeEp?.ended)saveEpisode(final,false);}
    } catch(e){setPlayerChunks(chunks);toast('❌ '+e.message);}
    isGenRef.current=false; setIsGenerating(false); scrollBottom();
  }

  // ── Episode End (story continues in next ep) ──
  async function endEpisodeNow() {
    if(isGenRef.current||playerEnded) return;
    isGenRef.current=true; setIsGenerating(true);
    const chunks=playerChunks;
    const storyCtx=chunks.map((c,i)=>`[Part ${i+1}]:\n${c.text}`).join('\n\n');
    setPlayerChunks([...chunks,{text:'',partNum:chunks.length+1,isEnd:true,streaming:true}]);
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        model:'openai/gpt-4o-mini',
        messages:[
          {role:'system',content:'Write ONLY in Hindi Devanagari. Emotion tags: [scared][whisper][shocked][calm]'},
          {role:'user',content:`${storyCtx}\n\nIs episode ka ending likho — lekin CLIFFHANGER pe khatam karo. Agle episode mein story continue hogi. Agar hero ya koi character kisi bure situation mein tha toh ek surprising twist do — shayad woh bacha, ya kuch unexpected hua. 100-120 words. "जारी रहेगा..." ya "क्रमशः" se khatam karo.`}
        ],max_tokens:500,temperature:0.88,stream:true})});
      const reader=res.body.getReader(),dec=new TextDecoder(); let full='';
      while(true){
        const{done,value}=await reader.read(); if(done) break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue;
          const d=line.slice(6).trim(); if(d==='[DONE]') break;
          try{const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';if(delta){full+=delta;setPlayerChunks(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],text:full};return u;});}}catch{}
        }
      }
      const final=[...chunks,{text:full.trim(),partNum:chunks.length+1,isEnd:true}];
      setPlayerChunks(final); setPlayerEnded(true); setShowEndBanner(true); setEpEndType('episode');
      // Save with storyFullyEnded=false (story continues)
      const epToSave={...activeEp,storyChunks:final,ended:true,storyFullyEnded:false,savedAt:Date.now(),savedScenes:stateRef.current.savedScenes||null,savedChars:stateRef.current.savedChars||null};
      const{db_saveEpisode}=await import('../../lib/firebase');
      await db_saveEpisode(user.uid,epToSave);
      setActiveEp(prev=>prev?{...prev,ended:true,storyFullyEnded:false}:prev);
      toast('✅ Episode end! Next episode mein story continue hogi.');
      setTimeout(async()=>{
        const newTitle=await generateSubtitle(activeEp,final);
        if(newTitle){
          await db_saveEpisode(user.uid,{...epToSave,title:newTitle});
          stateRef.current.title=newTitle;
          setActiveEp(prev=>prev?{...prev,title:newTitle}:prev);
          await loadEpisodes();
        }
        generateScenesAuto(final); generateCharsAuto(final); fetchMusicAuto();
      },500);
    }catch(e){toast('❌ '+e.message);}
    isGenRef.current=false; setIsGenerating(false); scrollBottom();
  }

  // ── Story End (story completely over — no next episode, only next season) ──
  async function endStoryNow() {
    if(isGenRef.current||playerEnded) return;
    isGenRef.current=true; setIsGenerating(true);
    const chunks=playerChunks;
    const storyCtx=chunks.map((c,i)=>`[Part ${i+1}]:\n${c.text}`).join('\n\n');
    setPlayerChunks([...chunks,{text:'',partNum:chunks.length+1,isEnd:true,streaming:true}]);
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        model:'openai/gpt-4o-mini',
        messages:[
          {role:'system',content:'Write ONLY in Hindi Devanagari. Emotion tags: [scared][whisper][shocked][calm]'},
          {role:'user',content:`${storyCtx}\n\nYeh story ka FINAL ending hai — koi agle episode nahi. Powerful, chilling, poori tarah se resolved ending likho. Saari mysteries khatam ho. "समाप्त" se khatam karo। 100-120 words.`}
        ],max_tokens:500,temperature:0.85,stream:true})});
      const reader=res.body.getReader(),dec=new TextDecoder(); let full='';
      while(true){
        const{done,value}=await reader.read(); if(done) break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue;
          const d=line.slice(6).trim(); if(d==='[DONE]') break;
          try{const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';if(delta){full+=delta;setPlayerChunks(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],text:full};return u;});}}catch{}
        }
      }
      const final=[...chunks,{text:full.trim(),partNum:chunks.length+1,isEnd:true}];
      setPlayerChunks(final); setPlayerEnded(true); setShowEndBanner(true); setEpEndType('story');
      // Save with storyFullyEnded=true (no more episodes)
      const epToSave={...activeEp,storyChunks:final,ended:true,storyFullyEnded:true,savedAt:Date.now(),savedScenes:stateRef.current.savedScenes||null,savedChars:stateRef.current.savedChars||null};
      const{db_saveEpisode}=await import('../../lib/firebase');
      await db_saveEpisode(user.uid,epToSave);
      setActiveEp(prev=>prev?{...prev,ended:true,storyFullyEnded:true}:prev);
      toast('✅ Story complete! Ab sirf Next Season ka option milega.');
      setTimeout(async()=>{
        const newTitle=await generateSubtitle(activeEp,final);
        if(newTitle){
          await db_saveEpisode(user.uid,{...epToSave,title:newTitle});
          stateRef.current.title=newTitle;
          setActiveEp(prev=>prev?{...prev,title:newTitle}:prev);
          await loadEpisodes();
        }
        generateScenesAuto(final); generateCharsAuto(final); fetchMusicAuto();
      },500);
    }catch(e){toast('❌ '+e.message);}
    isGenRef.current=false; setIsGenerating(false); scrollBottom();
  }

  async function generateScenesAuto(chunks) {
    setScenesLoading(true);
    const storyText=(chunks||playerChunks).map(c=>c.text).join('\n\n');
    const curChars=stateRef.current.savedChars||chars||[];
    const charList=curChars.length?curChars.map(c=>`${c.name} (${c.role})`).join(', '):'';
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-4o-mini',max_tokens:3000,temperature:0.35,messages:[{role:'user',content:`Story: "${stateRef.current.title||''}":\n\n${storyText}\n\n${charList?`Story ke characters: ${charList}\n\n`:''}MINIMUM 15 SCENES. Har scene ke liye:\n\nSCENE_START\nnum: [number]\ntitle: [Hindi title]\nlocation: [location]\nmood: [Daravna/Suspenseful/Intense/Creepy/Shocking]\nwhat: [kya hua — 1 line Hindi]\nchars_in_scene: [comma separated character names jo is scene mein hain]\nimgprompt: [English — cinematic webtoon 2D flat illustration, clean lineart. Dark horror atmosphere. 50-70 words.]\nSCENE_END\n\nSirf format.`}]})});
      const data=await res.json();
      const parsed=parseScenes(data.choices?.[0]?.message?.content||'');
      if(parsed.length){setScenes(parsed);stateRef.current.savedScenes=parsed;saveEpisode(playerChunks,true);toast(`✅ ${parsed.length} scenes ready!`);}
    }catch(e){toast('❌ Scenes: '+e.message);}
    setScenesLoading(false);
  }

  function parseScenes(raw) {
    return raw.split('SCENE_START').slice(1).map(b=>{
      const blk=b.slice(0,b.indexOf('SCENE_END')>-1?b.indexOf('SCENE_END'):undefined);
      const g=(k)=>{const m=blk.match(new RegExp(k+':\\s*(.+)'));return m?m[1].trim():'';};
      return {num:g('num'),title:g('title'),location:g('location'),mood:g('mood'),what:g('what'),chars_in_scene:g('chars_in_scene'),imgprompt:g('imgprompt')};
    }).filter(s=>s.title);
  }

  async function generateCharsAuto(chunks) {
    setCharsLoading(true);
    const storyText=(chunks||playerChunks).map(c=>c.text).join('\n\n');
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-4o-mini',max_tokens:1500,temperature:0.3,messages:[{role:'user',content:`Story: "${stateRef.current.title||''}"\n\n${storyText}\n\nIs story ke SAARE characters identify karo.\n\n[{"name":"naam","role":"Hero/Villain/Supporting/Minor","desc":"2-3 lines Hindi mein","visual":"English: age, height, build, face, hair, eye color, skin, clothing. 30-40 words.","appear":"Kis part mein aaya"}]\n\nSirf JSON array.`}]})});
      const data=await res.json();
      const parsed=JSON.parse((data.choices?.[0]?.message?.content?.trim()||'[]').replace(/```json|```/g,'').trim());
      if(Array.isArray(parsed)&&parsed.length){setChars(parsed);stateRef.current.savedChars=parsed;stateRef.current.characterBible=parsed;saveEpisode(playerChunks,true);toast(`✅ ${parsed.length} characters ready!`);}
    }catch(e){toast('❌ Characters: '+e.message);}
    setCharsLoading(false);
  }

  async function fetchMusicAuto() {
    setYtMusicLoading(true); setYtMusicVideos([]); setCurrentMusicIdx(0); setPreviewModalVideo(null);
    try {
      const q = encodeURIComponent(ytMusicQuery || 'horror ambient background music no copyright');
      const res = await fetch(`/api/youtube-music?q=${q}`);
      const data = await res.json();
      if (data.videos?.length) {
        setYtMusicVideos(data.videos);
      } else {
        toast('⚠️ Music videos nahi mile — query change karo');
      }
    } catch(e) { toast('❌ Music: ' + e.message); }
    setYtMusicLoading(false);
  }

  // ── Next Episode ───────────────────────────────────
  async function startNextEpisode() {
    setNextEpLoading(true);
    if(playerChunks.length&&activeEp){
      const{db_saveEpisode}=await import('../../lib/firebase');
      await db_saveEpisode(user.uid,{...activeEp,storyChunks:playerChunks,ended:true,storyFullyEnded:activeEp.storyFullyEnded||false,savedAt:Date.now(),savedScenes:stateRef.current.savedScenes||null,savedChars:stateRef.current.savedChars||null});
    }
    const epMatch=(activeEp?.epNum||'EP 01').match(/(\d+)/);
    const nextNum='EP '+String((epMatch?parseInt(epMatch[1]):1)+1).padStart(2,'0');

    // ── AI se Season Bible generate karo ──
    toast('📖 Bible generate ho rahi hai...');
    const freshEps = await (async()=>{const{db_getEpisodes}=await import('../../lib/firebase');return await db_getEpisodes(user.uid)||[];})();
    
    // Char status summary for bible
    const charBible = stateRef.current.characterBible;
    const charStatus = Array.isArray(charBible)&&charBible.length
      ? charBible.map(c=>`${c.name}(${c.status||'Alive'})`).join(', ')
      : '';
    const allStory = [...freshEps.filter(e=>e.ended&&e.storyChunks?.length),
      ...(playerChunks.length?[{...activeEp,storyChunks:playerChunks}]:[])
    ].map(e=>`[${e.season} ${e.epNum}]: ${e.storyChunks.map(c=>c.text).join(' ').slice(0,500)}...`).join('\n\n');

    let bible = stateRef.current.seasonBible||'';
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        model:'openai/gpt-4o-mini',max_tokens:600,temperature:0.3,
        messages:[{role:'user',content:`Hindi horror season bible banao:\n\n${allStory}\n\n${charStatus?`Character statuses: ${charStatus}\n\n`:''}Yeh bible next episode ke AI writer ke liye hai. Include karo:\n1. Abhi tak kya hua (main events)\n2. Character status (kaun zinda/mara/ghost)\n3. Unresolved mysteries\n4. Last episode ka cliffhanger (agle episode mein resolve hona chahiye)\n\nHindi mein, 250-300 words.`}]})});
      const d=await res.json();
      bible=d.choices?.[0]?.message?.content?.trim()||bible;
    }catch{}

    const newEpId=Date.now().toString();
    const baseTitle=(activeEp?.title||'').split(' | ')[0].trim()||'Untitled';
    const season=activeEp?.season||'SEASON 1';
    const seasonFmt=season.replace('SEASON ','').padStart(2,'0');
    const epFmt=nextNum.replace('EP ','').padStart(2,'0');
    const placeholderTitle=`${baseTitle} | ... | SEASON ${seasonFmt} EP ${epFmt}`;
    const newEp={...activeEp,epNum:nextNum,id:newEpId,title:placeholderTitle,storyChunks:[],ended:false,storyFullyEnded:false,savedScenes:null,savedChars:null,seasonEnded:false,seasonBible:bible};
    stateRef.current={...stateRef.current,epNum:nextNum,currentEpId:newEpId,title:placeholderTitle,storyChunks:[],storyEnded:false,savedScenes:null,savedChars:null,seasonBible:bible,characterBible:charBible};
    const{db_saveEpisode}=await import('../../lib/firebase');
    await db_saveEpisode(user.uid,{...newEp,savedAt:Date.now()});
    setActiveEp(newEp);setPlayerChunks([]);setPlayerEnded(false);setShowEndBanner(false);setEpEndType(null);
    setWordCount(0);setScenes(null);setChars(null);setNarration('');setShowNarration(false);
    setExpandedScene(null);setYtMusicVideos([]);setCurrentMusicIdx(0);setPreviewModalVideo(null);
    setShowNextEpModal(false); setNextEpLoading(false);
    await loadEpisodes(); setScreen('player');
    toast('▶ '+nextNum+' shuru ho raha hai...');
  }
  async function endSeason() {
    setSeasonFinaleLoading(true);
    toast('🔮 Season finale likh raha hai...');
    const allStoryText=playerChunks.map((c,i)=>`[Part ${i+1}]: ${c.text}`).join('\n\n');
    const charBible=stateRef.current.characterBible;
    const charStatus=Array.isArray(charBible)&&charBible.length?charBible.map(c=>`${c.name}(${c.status||'Alive'})`).join(', '):'';
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        model:'openai/gpt-4o-mini',max_tokens:700,temperature:0.88,stream:true,
        messages:[
          {role:'system',content:'Write ONLY in Hindi Devanagari. Emotion tags: [scared][whisper][shocked][calm]'},
          {role:'user',content:`${allStoryText.slice(0,1500)}\n\n${charStatus?`Characters: ${charStatus}\n\n`:''}SEASON FINALE: Saari mysteries resolve karo, sabka anjaam batao, chilling yaadgaar ending. 120-150 words. "समाप्त" se khatam karo.`}
        ]})});
      const reader=res.body.getReader(),dec=new TextDecoder(); let full='';
      const idx2=playerChunks.length;
      setPlayerChunks(prev=>[...prev,{text:'',partNum:idx2+1,isEnd:true,isFinale:true,streaming:true}]);
      while(true){
        const{done,value}=await reader.read(); if(done) break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue;
          const d=line.slice(6).trim(); if(d==='[DONE]') break;
          try{const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';if(delta){full+=delta;setPlayerChunks(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],text:full};return u;});}}catch{}
        }
      }
      if(full.trim()){
        const finalChunks=[...playerChunks,{text:full.trim(),partNum:playerChunks.length+1,isEnd:true,isFinale:true}];
        setPlayerChunks(finalChunks); setPlayerEnded(true); setShowEndBanner(true); setEpEndType('story');
        const{db_saveEpisode}=await import('../../lib/firebase');
        for(const ep of seasonEps) await db_saveEpisode(user.uid,{...ep,ended:true,seasonEnded:true,storyFullyEnded:true,savedAt:Date.now()});
        await db_saveEpisode(user.uid,{...activeEp,storyChunks:finalChunks,ended:true,seasonEnded:true,storyFullyEnded:true,savedAt:Date.now(),savedScenes:stateRef.current.savedScenes||null,savedChars:stateRef.current.savedChars||null});
        setActiveEp(prev=>prev?{...prev,seasonEnded:true,storyFullyEnded:true}:prev);
        toast('🏁 Season complete! Saare rahasya khul gaye!');
        await loadEpisodes();
      }
    }catch(e){toast('❌ '+e.message);}
    setSeasonFinaleLoading(false);
  }
  async function startNextSeason() {
    const sMatch     = (activeEp?.season||'SEASON 1').match(/(\d+)/);
    const nextSznNum = (sMatch ? parseInt(sMatch[1]) : 1) + 1;
    const nextSzn    = 'SEASON ' + nextSznNum;
    const newEpId    = Date.now().toString();
    const baseTitle  = (activeEp?.title||'').split(' | ')[0].trim() || 'Untitled';
    const seasonFmt  = String(nextSznNum).padStart(2,'0');
    const placeholderTitle = `${baseTitle} | ... | SEASON ${seasonFmt} EP 01`;

    const newEp = {
      ...activeEp,
      season: nextSzn, epNum: 'EP 01', id: newEpId,
      title: placeholderTitle, storyChunks: [], ended: false,
      savedScenes: null, savedChars: null, seasonEnded: false,
    };

    stateRef.current = {
      ...stateRef.current,
      season: nextSzn, epNum: 'EP 01', currentEpId: newEpId,
      title: placeholderTitle, storyChunks: [], storyEnded: false,
      savedScenes: null, savedChars: null, seasonBible: null,
    };

    const { db_saveEpisode } = await import('../../lib/firebase');
    await db_saveEpisode(user.uid, { ...newEp, savedAt: Date.now() });

    setActiveEp(newEp);
    setPlayerChunks([]); setPlayerEnded(false); setShowEndBanner(false);
    setWordCount(0); setScenes(null); setChars(null);
    setNarration(''); setShowNarration(false); setShowAnalysis(false);
    setExpandedScene(null); setYtMusicVideos([]); setCurrentMusicIdx(0); setPreviewModalVideo(null);

    await loadEpisodes();
    setScreen('player');
    toast('🏁 ' + nextSzn + ' shuru ho raha hai!');
  }

  async function generateFullNarration(forceRegen=false) {
    if(!playerChunks.length){toast('⚠️ Story nahi hai!');return;}
    if(narration&&!forceRegen){setShowNarration(true);return;}
    setNarrationLoading(true);setShowNarration(true);
    const fullStory=playerChunks.map(c=>c.text).join('\n\n');
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-4o-mini',max_tokens:2500,temperature:0.7,messages:[{role:'system',content:`Tu ek professional Hindi horror narrator hai jo ElevenLabs ke liye script likhta hai.\nSirf Hindi Devanagari. ElevenLabs break tags:\n<break time="0.5s" /> <break time="1.0s" /> <break time="1.5s" /> <break time="2.0s" />\nEmotion tags: [scared] [whisper] [laugh] [cry] [angry] [shocked] [calm]`},{role:'user',content:`Yeh horror story hai:\n\n${fullStory}\n\nPoori story ka ElevenLabs-ready HINDI NARRATION script likho.\n- Sirf Hindi Devanagari\n- Break tags sahi jagah lagao\n- Emotion tags use karo\n- Koi heading mat lagao`}]})});
      const data=await res.json();
      const nar=data.choices?.[0]?.message?.content?.trim()||'';
      if(nar){setNarration(nar);stateRef.current.savedNarration=nar;}
    }catch(err){toast('❌ '+err.message);}
    setNarrationLoading(false);
  }

  // ── FIXED: subtitle sirf "Main Title | Hook" — no SEASON/EP ──
  async function generateSubtitle(ep, chunks) {
    try {
      const storySnippet = (chunks||[]).map(c=>c.text).join(' ').slice(0,400);
      const baseTitle = (ep.title||'').split(' | ')[0].trim();
      const res = await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        model:'openai/gpt-4o-mini', max_tokens:60, temperature:0.9,
        messages:[{role:'user',content:`Story title: "${baseTitle}"\nStory snippet: "${storySnippet}"\n\nEk viral Hindi YouTube horror hook banao.\nFormat: "क्या [kuch]?" ya "[kuch dramatic]!" — sirf 6-10 Hindi words.\nKoi quotes ya extra text mat lagao. Sirf hook text do.`}]
      })});
      const data = await res.json();
      const subtitle = data.choices?.[0]?.message?.content?.trim()?.replace(/["""'']/g,'') || '';
      if(!subtitle) return null;
      // ✅ Sirf: "Main Title | Hook" — clean, ek hi line
      return `${baseTitle} | ${subtitle}`;
    } catch { return null; }
  }

  function scrollBottom(){setTimeout(()=>{if(storyAreaRef.current)storyAreaRef.current.scrollTop=storyAreaRef.current.scrollHeight;},50);}
  function copyText(t){navigator.clipboard.writeText(t).then(()=>toast('✅ Copied!'));}

  const storyList  = Object.entries(groups);
  const seasonMap  = screen!=='stories'?getSeasonsForStory(curStory):{};
  const seasonList = Object.entries(seasonMap);
  const breadcrumb = [
    {label:'My Stories',sc:'stories'},
    ...(screen!=='stories'?[{label:curStory.length>14?curStory.slice(0,12)+'…':curStory,sc:'seasons'}]:[]),
    ...(screen==='episodes'||screen==='player'?[{label:curSeason,sc:'episodes'}]:[]),
    ...(screen==='player'?[{label:(activeEp?.epNum||'EP'),sc:'player'}]:[]),
  ];
  const TARGET=1500;
  const wcPct=Math.min(100,(wordCount/TARGET)*100);
  const seasonEnded=activeEp?.seasonEnded||seasonEps.every(e=>e.ended&&e.seasonEnded)||false;

  // ── Next Season exist check ────────────────────────
  const nextSeasonExists = (() => {
    if (!activeEp) return false;
    const baseTitle = (activeEp.title||'').split(' | ')[0].trim();
    const curSznNum = parseInt((activeEp.season||'SEASON 1').match(/(\d+)/)?.[1]||'1');
    const nextSznKey = `SEASON ${curSznNum + 1}`;
    return !!(groups[baseTitle] && Object.keys(getSeasonsForStory(baseTitle)).includes(nextSznKey));
  })();
  const nextSeasonLabel = (() => {
    if (!activeEp) return 'Next Season';
    const curSznNum = parseInt((activeEp.season||'SEASON 1').match(/(\d+)/)?.[1]||'1');
    return `SEASON ${curSznNum + 1}`;
  })();

  return (
    <>
      <SideDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} user={user}/>
      <div className="page-content" style={{background:'var(--void)'}}>

        {/* Topbar */}
        <div style={{display:'flex',alignItems:'center',height:52,padding:'0 12px',gap:6,background:'rgba(10,0,10,0.97)',borderBottom:'1px solid #1a0015',position:'sticky',top:0,zIndex:100}}>
          {screen==='stories'
            ?<button className="hamburger-btn" onClick={()=>setDrawerOpen(true)} style={{flexShrink:0}}>☰</button>
            :<button onClick={()=>{if(screen==='player')setScreen('episodes');else if(screen==='episodes')setScreen('seasons');else setScreen('stories');}} style={{background:'none',border:'none',color:'#888',fontSize:20,cursor:'pointer',padding:'4px 8px',flexShrink:0}}>←</button>
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
          {screen==='player'&&<button onClick={()=>setShowAnalysis(a=>!a)} style={{background:'none',border:'none',color:showAnalysis?'#cc2233':'#555',fontSize:18,cursor:'pointer',padding:4}}>🎬</button>}
          <div style={{width:screen==='player'?0:36,flexShrink:0}}/>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:screen==='player'?0:12}}>

          {/* Level 1: Stories */}
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
                  const totalViews=epList.reduce((sum,ep)=>{const info=getEpYtInfo(ep);return sum+(info?.video.viewCount||0);},0);
                  return(
                    <div key={baseTitle} style={{background:'#0d000d',border:'1px solid #2a0022',borderRadius:12,padding:14,cursor:'pointer',position:'relative'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='#550033'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='#2a0022'}>
                      <div style={{display:'flex',alignItems:'center',gap:10}} onClick={()=>{setCurStory(baseTitle);setScreen('seasons');}}>
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
                      <button onClick={e=>{e.stopPropagation();setDeleteConfirmStory(baseTitle);setDeleteInput('');}}
                        style={{position:'absolute',top:10,right:10,background:'rgba(80,0,0,0.18)',border:'1px solid #330000',color:'#553333',fontSize:13,padding:'4px 8px',borderRadius:7,cursor:'pointer'}}>🗑</button>
                    </div>
                  );
                })}
              </div>
              {deleteConfirmStory&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                  <div style={{background:'#0d000d',border:'1px solid #550000',borderRadius:14,padding:20,width:'100%',maxWidth:340}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#cc2222',marginBottom:6}}>🗑 STORY DELETE KARO</div>
                    <div style={{fontSize:12,color:'#888',marginBottom:4,lineHeight:1.6}}><span style={{color:'#ddd',fontWeight:600}}>"{deleteConfirmStory}"</span> permanently delete ho jayega.</div>
                    <div style={{fontSize:11,color:'#555',marginBottom:12}}>Confirm ke liye <span style={{color:'#cc4444',fontWeight:700}}>DELETE</span> likho:</div>
                    <input value={deleteInput} onChange={e=>setDeleteInput(e.target.value)} placeholder="DELETE"
                      style={{width:'100%',background:'#0a0000',border:`1px solid ${deleteInput==='DELETE'?'#cc0000':'#330000'}`,color:'#fff',padding:'10px 12px',borderRadius:8,fontSize:13,outline:'none',marginBottom:12,boxSizing:'border-box',fontFamily:'monospace',letterSpacing:2}}/>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>{setDeleteConfirmStory(null);setDeleteInput('');}} style={{flex:1,background:'transparent',border:'1px solid #333',color:'#666',padding:'10px',borderRadius:8,fontSize:12,cursor:'pointer'}}>Cancel</button>
                      <button onClick={()=>confirmDeleteStory(deleteConfirmStory)} disabled={deleteInput!=='DELETE'}
                        style={{flex:1,background:deleteInput==='DELETE'?'linear-gradient(135deg,#880000,#550000)':'#1a0000',border:`1px solid ${deleteInput==='DELETE'?'#cc0000':'#330000'}`,color:deleteInput==='DELETE'?'#fff':'#444',padding:'10px',borderRadius:8,fontSize:12,cursor:deleteInput==='DELETE'?'pointer':'not-allowed',fontWeight:700}}>🗑 Delete Karo</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Level 2: Seasons */}
          {screen==='seasons'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {seasonList.map(([season,sEps])=>{
                const allDone=sEps.every(e=>e.ended);
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

          {/* Level 3: Episodes */}
          {screen==='episodes'&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {/* Newest first — EP 03, EP 02, EP 01 */}
              {[...seasonEps].sort((a,b)=>(b.epNum||'').localeCompare(a.epNum||'')).map(ep=>{
                const savedDate=ep.savedAt?new Date(ep.savedAt).toLocaleDateString('hi-IN'):'';
                const ytInfo=getEpYtInfo(ep);
                const isTrending=ytInfo&&ytInfo.rank===1;
                const seasonDone=seasonEps.every(e=>e.ended&&e.seasonEnded);
                // Use fresh ep.ended from Firestore (not stale state)
                const epIsDone=ep.ended||false;
                // Find the next episode if it already exists
                const epNum=parseInt((ep.epNum||'EP 01').match(/\d+/)?.[0]||1);
                const nextEpStr='EP '+String(epNum+1).padStart(2,'0');
                const nextEpExists=seasonEps.find(e=>e.epNum===nextEpStr);
                // Is this the latest (highest) episode?
                const maxEpNum=Math.max(...seasonEps.map(e=>parseInt((e.epNum||'EP 01').match(/\d+/)?.[0]||1)));
                const isLatestEp=(epNum===maxEpNum);
                // Show "Start Next Ep" only on latest ended episode where story is not fully over
                const showStartNextBtn=isLatestEp&&ep.ended&&!ep.storyFullyEnded&&!ep.seasonEnded&&!nextEpExists;
                const showNextEpLink=isLatestEp&&ep.ended&&!ep.storyFullyEnded&&!ep.seasonEnded&&nextEpExists;
                return(
                  <div key={ep.id}
                    style={{background:isTrending?'rgba(255,60,0,0.05)':'#080008',border:`1px solid ${isTrending?'#661100':'#1a0015'}`,borderRadius:12,padding:14,display:'flex',alignItems:'center',gap:12,position:'relative'}}>
                    {isTrending&&<div style={{position:'absolute',top:-6,right:10,background:'linear-gradient(135deg,#cc3300,#880000)',borderRadius:20,padding:'2px 8px',fontSize:9,fontWeight:800,color:'#fff',letterSpacing:1}}>🔥 #1 TRENDING</div>}
                    <div onClick={()=>openEpisode(ep)} style={{width:40,height:40,borderRadius:10,background:epIsDone?'linear-gradient(135deg,#003300,#001a00)':isTrending?'linear-gradient(135deg,#331100,#1a0800)':'linear-gradient(135deg,#1a0000,#0d0000)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,border:`1px solid ${epIsDone?'#004400':isTrending?'#551100':'#330000'}`,cursor:'pointer'}}>
                      {isTrending?'🔥':epIsDone?'✅':'📝'}
                    </div>
                    <div onClick={()=>openEpisode(ep)} style={{flex:1,minWidth:0,cursor:'pointer'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        <span style={{fontSize:9,color:'#880000',fontWeight:800,letterSpacing:1.5,textTransform:'uppercase'}}>{ep.epNum||'EP 01'}</span>
                        <span style={{fontSize:9,color:epIsDone?'#44bb66':'#cc8822',background:epIsDone?'rgba(0,80,0,0.12)':'rgba(80,40,0,0.12)',border:`1px solid ${epIsDone?'#1a4a22':'#3a2200'}`,borderRadius:3,padding:'1px 5px'}}>
                          {seasonDone?'🔒 Locked':epIsDone?(ep.storyFullyEnded?'Story End':'Done'):'Ongoing'}
                        </span>
                      </div>
                      {(()=>{
                        const parts=(ep.title||'').split(' | ');
                        const mainT=parts[0]||'Untitled';
                        const subT=parts[1]&&parts[1]!=='...'?parts[1]:null;
                        return(
                          <>
                            <div style={{fontSize:13,fontWeight:600,color:'#ddd',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{mainT}</div>
                            {subT&&<div style={{fontSize:11,color:'#cc4444',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:2,fontStyle:'italic'}}>"{subT}"</div>}
                          </>
                        );
                      })()}
                      <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap'}}>
                        <span style={{fontSize:10,color:'#444'}}>{ep.wordCount||0} words</span>
                        {savedDate&&<span style={{fontSize:10,color:'#333'}}>· {savedDate}</span>}
                        {ytInfo?(
                          <a href={`https://youtube.com/watch?v=${ytInfo.video.videoId}`} target="_blank" onClick={e=>e.stopPropagation()}
                            style={{fontSize:10,color:'#ff4444',fontWeight:700,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}>
                            ▶ {fmtViews(ytInfo.video.viewCount)} views
                            <span style={{color:ytInfo.rank===1?'#ffcc00':ytInfo.rank<=3?'#ff8844':'#666',fontWeight:800}}>{ytInfo.rank===1?'🥇':ytInfo.rank===2?'🥈':ytInfo.rank===3?'🥉':`#${ytInfo.rank}`}</span>
                          </a>
                        ):<span style={{fontSize:10,color:'#333'}}>❌ Not uploaded</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0,alignItems:'flex-end'}}>
                      {/* Smart next ep button — only on latest ep */}
                      {showStartNextBtn&&(
                        <button onClick={e=>{e.stopPropagation();openEpisode(ep);setTimeout(()=>setShowNextEpModal(true),300);}}
                          style={{background:'linear-gradient(135deg,#880000,#550000)',border:'1px solid #cc0000',color:'#fff',fontSize:11,padding:'6px 10px',borderRadius:8,cursor:'pointer',fontWeight:700,whiteSpace:'nowrap'}}>
                          ▶ {nextEpStr} Shuru
                        </button>
                      )}
                      {showNextEpLink&&(
                        <button onClick={e=>{e.stopPropagation();const nep=nextEpExists;if(nep)openEpisode(nep);}}
                          style={{background:'linear-gradient(135deg,#004400,#002200)',border:'1px solid #44bb66',color:'#44bb66',fontSize:11,padding:'6px 10px',borderRadius:8,cursor:'pointer',fontWeight:700,whiteSpace:'nowrap'}}>
                          ▶ {nextEpStr} Dekho
                        </button>
                      )}
                      {!ytInfo&&<button onClick={e=>{e.stopPropagation();deleteEpisode(ep.id);}} style={{background:'rgba(80,0,0,0.2)',border:'1px solid #330000',color:'#553333',fontSize:13,padding:'7px 9px',borderRadius:8,cursor:'pointer'}}>🗑</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Level 4: Player */}
          {screen==='player'&&activeEp&&(
            <div style={{display:'flex',flexDirection:'column',minHeight:'calc(100dvh - 52px)'}}>

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
                        {seasonEnded&&<div style={{fontSize:11,color:'#cc6600',background:'rgba(80,30,0,0.15)',border:'1px solid #441100',borderRadius:8,padding:'8px 12px',marginBottom:10}}>🔒 Season complete — editing band hai</div>}
                        <div className="btn-row" style={{flexWrap:'wrap',gap:8}}>
                          {/* storyFullyEnded=false → Episode End → Next Episode + Season End (sirf last ep pe) */}
                          {!seasonEnded&&!(activeEp?.storyFullyEnded)&&(
                            <>
                              <button className="btn btn-primary" onClick={()=>setShowNextEpModal(true)}>▶ Next Episode</button>
                              {/* Season End sirf tab dikhao jab last episode ho */}
                              {(()=>{
                                const maxEp=Math.max(...seasonEps.map(e=>parseInt((e.epNum||'EP 01').match(/\d+/)?.[0]||1)));
                                const curEp=parseInt((activeEp?.epNum||'EP 01').match(/\d+/)?.[0]||1);
                                return curEp===maxEp;
                              })()&&(
                                seasonFinaleLoading
                                  ?<button className="btn btn-ghost" disabled style={{borderColor:'#cc6600',color:'#cc6600',opacity:0.7}}>
                                    <div className="spinner" style={{display:'inline-block',width:10,height:10,marginRight:6}}/>Finale likh raha hai...
                                  </button>
                                  :<button className="btn btn-ghost" onClick={endSeason} style={{borderColor:'#cc6600',color:'#cc6600'}}>🏁 Season End Karo</button>
                              )}
                            </>
                          )}
                          {/* storyFullyEnded=true → Story End → Only season options */}
                          {(activeEp?.storyFullyEnded||seasonEnded)&&(
                            nextSeasonExists
                              ? <button className="btn btn-primary" onClick={()=>{
                                  const baseTitle=(activeEp.title||'').split(' | ')[0].trim();
                                  setCurStory(baseTitle); setScreen('seasons');
                                }} style={{background:'linear-gradient(135deg,#004400,#002200)',borderColor:'#44bb66',color:'#44bb66'}}>
                                  🎬 {nextSeasonLabel} Dekho
                                </button>
                              : <button className="btn btn-ghost" onClick={startNextSeason} style={{borderColor:'#44bb66',color:'#44bb66'}}>
                                  🏁 Next Season Shuru Karo
                                </button>
                          )}
                          <button className="btn btn-primary" onClick={()=>generateFullNarration(false)} style={{background:'linear-gradient(135deg,#005500,#003300)'}}>🎙 ElevenLabs Narration</button>
                          <button className="btn btn-ghost" onClick={()=>setShowAnalysis(true)}>🎬 Scenes & Characters</button>
                        </div>
                        {showNarration&&(
                          <div style={{background:'#000a00',border:'1px solid #004400',borderRadius:8,padding:14,marginTop:8}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                              <div style={{fontSize:10,color:'#44bb66',letterSpacing:2,textTransform:'uppercase'}}>🎙 ElevenLabs Narration</div>
                              <button onClick={()=>generateFullNarration(true)} style={{background:'transparent',border:'1px solid #555',color:'#888',fontSize:10,padding:'4px 10px',borderRadius:6,cursor:'pointer'}}>🔄 Dobara</button>
                            </div>
                            {narrationLoading?<div style={{display:'flex',alignItems:'center',gap:8,color:'#44bb66',fontSize:12}}><div className="spinner"/>Narration ban rahi hai...</div>:<div style={{fontSize:14,color:'#c8e8c8',lineHeight:1.9,whiteSpace:'pre-wrap'}}>{narration}</div>}
                            {narration&&!narrationLoading&&<button onClick={()=>copyText(narration)} style={{marginTop:12,background:'transparent',border:'1px solid #44bb66',color:'#44bb66',padding:'6px 14px',borderRadius:6,fontSize:12,cursor:'pointer'}}>📋 ElevenLabs ke liye Copy</button>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{padding:'0 16px 4px',background:'var(--panel)',borderTop:'1px solid var(--border)'}}>
                    <div className="wordcount-bar">
                      <span className="wc-label">{wordCount} words</span>
                      <div className="wc-track"><div className="wc-fill" style={{width:wcPct+'%'}}/></div>
                      <span className="wc-label">/ ~{TARGET}</span>
                    </div>
                  </div>

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
                          <div className="action-chip" style={{borderColor:'#550000',color:'#cc8844',fontSize:10}} onClick={endEpisodeNow}>📌 Episode End</div>
                          <div className="action-chip" style={{borderColor:'#880000',color:'#cc4444',fontSize:10}} onClick={endStoryNow}>🔚 Story End</div>
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

              {/* ── Analysis panel ── */}
              {showAnalysis&&(
                <div className="analysis-content" style={{flex:1,paddingBottom:80}}>

                  {/* Characters */}
                  <div className="analysis-panel">
                    <PanelHeader icon="👤" title="CHARACTERS" open={showCharsPanel} onToggle={()=>setShowCharsPanel(o=>!o)}/>
                    {showCharsPanel&&(
                      <>
                        <div className="analysis-hint" style={{marginBottom:8}}>
                          {chars?.length>0
                            ?<span style={{color:'#44bb66'}}>{chars.length} characters ready.</span>
                            :<span style={{color:'#555'}}>Story end karo — auto generate ho jayega.</span>
                          }
                        </div>
                        {chars?.map((c,i)=>(
                          <div key={i} className="char-card">
                            <div className="char-name"><span style={{fontSize:12,color:'#666',marginRight:4}}>#{i+1}</span>{c.name}<span className="char-role-badge">{c.role}</span></div>
                            <div className="char-desc">{c.desc}</div>
                            {c.appear&&<div className="char-appear">📍 {c.appear}</div>}
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* ── Background Music — YouTube based ── */}
                  <div className="analysis-panel" style={{marginTop:12}}>
                    <PanelHeader
                      icon="🎵" title="BACKGROUND MUSIC"
                      open={showMusicPanel} onToggle={()=>setShowMusicPanel(o=>!o)}
                      rightEl={showMusicPanel&&(
                        <button onClick={fetchMusicAuto} disabled={ytMusicLoading}
                          style={{background:'transparent',border:'1px solid #440022',color:'#cc4466',fontSize:10,padding:'3px 8px',borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                          {ytMusicLoading?<div className="spinner" style={{width:10,height:10}}/>:'🔄'} Dobara
                        </button>
                      )}
                    />
                    {showMusicPanel&&(
                      <>
                        {/* Search bar */}
                        <div style={{display:'flex',gap:6,marginBottom:10}}>
                          <input
                            value={ytMusicQuery}
                            onChange={e=>setYtMusicQuery(e.target.value)}
                            onKeyDown={e=>e.key==='Enter'&&fetchMusicAuto()}
                            placeholder="horror ambient, dark suspense..."
                            style={{flex:1,background:'#0a0005',border:'1px solid #330022',color:'#ddd',
                              padding:'7px 10px',borderRadius:8,fontSize:12,outline:'none'}}
                          />
                          <button onClick={fetchMusicAuto} disabled={ytMusicLoading}
                            style={{background:'linear-gradient(135deg,#550022,#330011)',border:'1px solid #880033',
                              color:'#ff6699',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer',flexShrink:0}}>
                            🔍
                          </button>
                        </div>

                        <div className="analysis-hint" style={{marginBottom:8}}>
                          {ytMusicVideos.length===0&&!ytMusicLoading
                            ?<span style={{color:'#555'}}>Story end hone pe auto fetch hoga. Ya query likhke search karo. 👆</span>
                            :<span style={{color:'#555'}}>▶ Preview dabao — video expand hoga. 📋 Copy karo aur downloader mein paste karo.</span>
                          }
                        </div>

                        {ytMusicLoading&&(
                          <div style={{display:'flex',alignItems:'center',gap:8,color:'#cc4466',fontSize:12,padding:'8px 0'}}>
                            <div className="spinner"/>YouTube pe dhoondh raha hai...
                          </div>
                        )}

                        {/* Single video card with prev/next */}
                        {ytMusicVideos.length>0&&(()=>{
                          const vid = ytMusicVideos[currentMusicIdx];
                          const total = ytMusicVideos.length;
                          return (
                            <div style={{background:'#0a0005',border:'1px solid #440022',borderRadius:12,overflow:'hidden'}}>
                              {/* Track info row */}
                              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 12px 10px'}}>
                                <div style={{width:36,height:36,borderRadius:8,flexShrink:0,
                                  background:'#1a0010',border:'1px solid #330022',
                                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
                                  🎵
                                </div>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:600,color:'#ddd',whiteSpace:'nowrap',
                                    overflow:'hidden',textOverflow:'ellipsis'}}>{vid.title}</div>
                                  <div style={{fontSize:10,color:'#555',marginTop:2}}>
                                    {vid.channelTitle}{vid.viewCount?` · ${fmtViews(vid.viewCount)} views`:''}
                                  </div>
                                </div>
                                {/* Counter */}
                                <div style={{fontSize:10,color:'#550033',fontWeight:700,flexShrink:0,
                                  background:'rgba(136,0,34,0.12)',border:'1px solid #330011',
                                  borderRadius:6,padding:'3px 7px'}}>
                                  {currentMusicIdx+1}/{total}
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div style={{display:'flex',gap:8,padding:'0 12px 12px'}}>
                                {/* Prev */}
                                <button
                                  onClick={()=>setCurrentMusicIdx(i=>Math.max(0,i-1))}
                                  disabled={currentMusicIdx===0}
                                  style={{background:'#0a000a',border:'1px solid #330033',
                                    color:currentMusicIdx===0?'#333':'#cc66cc',borderRadius:8,
                                    fontSize:16,padding:'9px 12px',cursor:currentMusicIdx===0?'not-allowed':'pointer',
                                    flexShrink:0}}>
                                  ◀
                                </button>

                                {/* Preview */}
                                <button
                                  onClick={()=>setPreviewModalVideo(previewModalVideo?.videoId===vid.videoId ? null : vid)}
                                  style={{flex:1,background:'linear-gradient(135deg,#550022,#330011)',
                                    border:'1px solid #880033',color:'#ff6699',borderRadius:8,
                                    fontSize:12,padding:'9px 8px',cursor:'pointer',fontWeight:600}}>
                                  {previewModalVideo?.videoId===vid.videoId ? '✕ Close' : '▶ Preview'}
                                </button>

                                {/* Copy Link */}
                                <button
                                  onClick={()=>{navigator.clipboard.writeText(`https://youtube.com/watch?v=${vid.videoId}`);toast('✅ Link copy ho gaya!');}}
                                  style={{flex:1,background:'linear-gradient(135deg,#001a33,#000d1a)',
                                    border:'1px solid #004499',color:'#4499ff',borderRadius:8,
                                    fontSize:12,padding:'9px 8px',cursor:'pointer',fontWeight:600}}>
                                  📋 Copy
                                </button>

                                {/* Download */}
                                <button
                                  onClick={()=>window.open(`https://www.google.com/search?q=youtube+music+downloader`,'_blank')}
                                  style={{flex:1,background:'linear-gradient(135deg,#003300,#001a00)',
                                    border:'1px solid #004400',color:'#44bb66',borderRadius:8,
                                    fontSize:12,padding:'9px 8px',cursor:'pointer',fontWeight:600}}>
                                  ⬇ Download
                                </button>

                                {/* Next */}
                                <button
                                  onClick={()=>setCurrentMusicIdx(i=>Math.min(total-1,i+1))}
                                  disabled={currentMusicIdx===total-1}
                                  style={{background:'#0a000a',border:'1px solid #330033',
                                    color:currentMusicIdx===total-1?'#333':'#cc66cc',borderRadius:8,
                                    fontSize:16,padding:'9px 12px',cursor:currentMusicIdx===total-1?'not-allowed':'pointer',
                                    flexShrink:0}}>
                                  ▶
                                </button>
                              </div>

                              {/* Inline YouTube embed */}
                              {previewModalVideo?.videoId===vid.videoId&&(
                                <iframe
                                  src={`https://www.youtube.com/embed/${vid.videoId}?autoplay=1`}
                                  width="100%" height="180"
                                  frameBorder="0"
                                  allow="autoplay; encrypted-media"
                                  allowFullScreen
                                  style={{display:'block',borderTop:'1px solid #220011'}}
                                />
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {/* Scenes */}
                  <div className="analysis-panel" style={{marginTop:12}}>
                    <PanelHeader icon="🎬" title="SCENES" open={showScenesPanel} onToggle={()=>setShowScenesPanel(o=>!o)}/>
                    {showScenesPanel&&(
                      <>
                        <div className="analysis-hint" style={{marginBottom:8}}>
                          Scene tap karo — prompts dekhne ke liye.
                          {chars?.length>0&&<span style={{color:'#44bb66'}}> Character references included.</span>}
                        </div>
                        <button className="btn btn-primary" onClick={()=>generateScenesAuto()} disabled={scenesLoading||!playerChunks.length}>
                          {scenesLoading?<><div className="spinner"/>Scenes ban rahe hain...</>:'🎬 Scene Breakdown Generate Karo'}
                        </button>
                        {scenes?.length>0&&(
                          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:10}}>
                            {scenes.map((s,i)=>{
                              const isOpen=expandedScene===i;
                              const sceneChars=s.chars_in_scene?s.chars_in_scene.split(',').map(n=>n.trim()).filter(Boolean):[];
                              const charPrompts=sceneChars.map(name=>{
                                const found=(chars||[]).find(c=>c.name?.toLowerCase()===name.toLowerCase());
                                const visual=found?.visual||found?.desc||'';
                                return `full body character sheet, front and back view, ${name}${visual?', '+visual:''}, webtoon 2D flat illustration, clean lineart, white background, character reference sheet, multiple expressions, multiple poses, consistent design across all poses, same face same outfit same colors in every pose, turnaround sheet`;
                              });
                              const imagePrompt=s.imgprompt||'';
                              const videoPrompt=`Convert this illustration to a short animated video clip (3-5 seconds). Subtle motion only — eyes blinking, cloth movement, hair sway, atmospheric fog. Maintain the exact webtoon 2D flat illustration style. No camera movement. Dark horror atmosphere. Keep all character appearances identical to the reference image.${sceneChars.length?` Characters present: ${sceneChars.join(', ')}.`:''}`;
                              return(
                                <div key={i} style={{background:isOpen?'rgba(80,0,20,0.12)':'#080008',border:`1px solid ${isOpen?'#660022':'#1a0015'}`,borderRadius:12,overflow:'hidden'}}>
                                  <div onClick={()=>setExpandedScene(isOpen?null:i)} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer'}}>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                                        <span style={{fontSize:9,color:'#880000',fontWeight:800,letterSpacing:1.5}}>🎬 SCENE {s.num}</span>
                                        <span style={{fontSize:9,color:'#444',letterSpacing:1}}>{(s.mood||'').toUpperCase()}</span>
                                      </div>
                                      <div style={{fontSize:13,fontWeight:600,color:'#ddd',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title}</div>
                                      <div style={{fontSize:10,color:'#555',marginTop:2}}>📍 {s.location}</div>
                                    </div>
                                    {sceneChars.length>0&&(
                                      <div style={{display:'flex',gap:3,flexShrink:0}}>
                                        {sceneChars.slice(0,2).map((name,ci)=>(
                                          <span key={ci} style={{fontSize:9,padding:'2px 6px',background:'#1a0000',border:'1px solid #440000',borderRadius:20,color:'#cc4444'}}>👤{name.split(' ')[0]}</span>
                                        ))}
                                        {sceneChars.length>2&&<span style={{fontSize:9,color:'#444',alignSelf:'center'}}>+{sceneChars.length-2}</span>}
                                      </div>
                                    )}
                                    <span style={{fontSize:16,color:'#440022',flexShrink:0,marginLeft:4}}>{isOpen?'▲':'▼'}</span>
                                  </div>
                                  {isOpen&&(
                                    <div style={{padding:'0 14px 14px',borderTop:'1px solid #220011'}}>
                                      <div style={{fontSize:12,color:'#888',lineHeight:1.7,margin:'10px 0 8px'}}>{s.what}</div>
                                      {sceneChars.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>{sceneChars.map((name,ci)=><span key={ci} style={{fontSize:10,padding:'3px 8px',background:'#1a0000',border:'1px solid #440000',borderRadius:20,color:'#cc4444'}}>👤 {name}</span>)}</div>}
                                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                        {sceneChars.length>0&&charPrompts.map((cp,ci)=>(
                                          <button key={ci} onClick={()=>navigator.clipboard.writeText(cp).then(()=>toast(`✅ ${sceneChars[ci]} character prompt copy!`))}
                                            style={{background:'#0a000a',border:'1px solid #440044',color:'#cc66cc',borderRadius:8,fontSize:12,padding:'8px 10px',cursor:'pointer',width:'100%',textAlign:'left'}}>
                                            👤 Copy: {sceneChars[ci]} Character Prompt
                                          </button>
                                        ))}
                                        {imagePrompt&&<button onClick={()=>navigator.clipboard.writeText(imagePrompt).then(()=>toast('✅ Image prompt copy!'))} style={{background:'#0a0000',border:'1px solid #440000',color:'#cc4444',borderRadius:8,fontSize:12,padding:'8px 10px',cursor:'pointer',width:'100%',textAlign:'left'}}>🖼 Copy: Scene Image Prompt</button>}
                                        <button onClick={()=>navigator.clipboard.writeText(videoPrompt).then(()=>toast('✅ Video prompt copy!'))} style={{background:'#000a0a',border:'1px solid #004444',color:'#44aaaa',borderRadius:8,fontSize:12,padding:'8px 10px',cursor:'pointer',width:'100%',textAlign:'left'}}>🎬 Copy: Image → Video Prompt</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Preview Modal removed - inline embed used instead ── */}

      {/* ── Next Episode Modal ── */}
      {showNextEpModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#0d000d',border:'1px solid #550022',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>
            <div style={{fontSize:16,fontWeight:800,color:'#cc2233',marginBottom:8,textAlign:'center'}}>📖 Next Episode Shuru Karein?</div>
            <div style={{fontSize:13,color:'#888',lineHeight:1.7,marginBottom:16,textAlign:'center'}}>
              AI saare episodes ka <span style={{color:'#ddd',fontWeight:600}}>Season Bible</span> banayega — characters ka status, mysteries, cliffhanger sab track hoga.
              <br/><span style={{fontSize:11,color:'#cc4444',marginTop:4,display:'block'}}>⚠️ Jo character mara woh wapas normal nahi aayega</span>
            </div>
            {nextEpLoading?(
              <div style={{textAlign:'center',padding:'16px 0',color:'#cc4466',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <div className="spinner"/>Bible ban rahi hai...
              </div>
            ):(
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setShowNextEpModal(false)}
                  style={{flex:1,background:'transparent',border:'1px solid #333',color:'#666',padding:'12px',borderRadius:10,fontSize:13,cursor:'pointer',fontWeight:600}}>
                  Baad mein
                </button>
                <button onClick={startNextEpisode}
                  style={{flex:1,background:'linear-gradient(135deg,#880000,#550000)',border:'1px solid #cc0000',color:'#fff',padding:'12px',borderRadius:10,fontSize:13,cursor:'pointer',fontWeight:700}}>
                  ▶ Haan, Shuru!
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
