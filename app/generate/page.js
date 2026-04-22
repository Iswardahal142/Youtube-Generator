'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider, useToast } from '../../components/Toast';

// ─────────────────────────────────────────────────────────────────
function GeneratePage({ user }) {
  const router = useRouter();
  const toast  = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Setup screen ──
  const [selectedGenre, setSelectedGenre] = useState('any');
  const [genState,      setGenState]      = useState('idle'); // idle|generating|done
  const [titlePreview,  setTitlePreview]  = useState('');
  const [showStart,     setShowStart]     = useState(false);
  const [channelInfo,   setChannelInfo]   = useState(null);

  // ── Screen nav ──
  const [screen, setScreen] = useState('setup'); // setup|story|analysis|thumb

  // ── Story state ──
  const [storyChunks,   setStoryChunks]   = useState([]);
  const [storyEnded,    setStoryEnded]    = useState(false);
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [wordCount,     setWordCount]     = useState(0);
  const [promptHint,    setPromptHint]    = useState('');
  const [showEndBanner, setShowEndBanner] = useState(false);
  const [season,        setSeason]        = useState('SEASON 1');
  const [epNum,         setEpNum]         = useState('EP 01');
  const [title,         setTitle]         = useState('');
  const [currentEpId,   setCurrentEpId]   = useState(null);

  // ── Analysis state ──
  const [scenes,        setScenes]        = useState(null);
  const [chars,         setChars]         = useState(null);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [charsLoading,  setCharsLoading]  = useState(false);

  // ── Narration state ──
  const [narration,        setNarration]        = useState('');
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [showNarration,    setShowNarration]    = useState(false);

  // Refs
  const storyAreaRef    = useRef(null);
  const generatedRef    = useRef({ title: '', prompt: '' });
  const stateRef        = useRef({});
  const isGenRef        = useRef(false);

  const displayName = user?.displayName || user?.email || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  const GENRES = [
    { key:'any',           label:'Kuch Bhi' },
    { key:'haveli',        label:'🏚 Haveli' },
    { key:'jungle',        label:'🌲 Jungle' },
    { key:'highway',       label:'🌙 Highway' },
    { key:'gaon',          label:'🏘 Gaon' },
    { key:'school',        label:'🏫 School' },
    { key:'supernatural',  label:'👻 Super' },
    { key:'psychological', label:'🧠 Psycho' },
  ];

  // ── Load Firebase state on mount ──────────────────
  useEffect(() => {
    if (!user?.uid) return;
    import('../../lib/firebase').then(async ({ db_loadState }) => {
      const d = await db_loadState(user.uid);
      if (d) {
        if (d.season)       setSeason(d.season);
        if (d.epNum)        setEpNum(d.epNum);
        if (d.title)        setTitle(d.title);
        if (d.currentEpId)  setCurrentEpId(d.currentEpId);
        if (d.storyChunks?.length) {
          setStoryChunks(d.storyChunks);
          setWordCount(d.storyChunks.reduce((a,c)=>a+c.text.split(/\s+/).length,0));
        }
        if (d.storyEnded) { setStoryEnded(true); setShowEndBanner(true); }
        if (d.savedScenes) setScenes(d.savedScenes);
        if (d.savedChars)  setChars(d.savedChars);
        if (d.savedNarration) setNarration(d.savedNarration);
        stateRef.current = d;
      }
    });
    // YouTube channel info
    fetch('/api/youtube').then(r=>r.json()).then(data=>{
      if (data.channelName) setChannelInfo({
        name: data.channelName, thumb: data.channelThumb||'',
        subscribers: data.subscriberCount||0, videoCount: data.videoCount||0,
      });
    }).catch(()=>{});
  }, [user?.uid]);

  function saveState(updates) {
    const next = { ...stateRef.current, ...updates };
    stateRef.current = next;
    if (user?.uid)
      import('../../lib/firebase').then(({db_saveState})=>db_saveState(user.uid,next));
  }

  async function saveEpisode(chunks, ended) {
    if (!chunks.length) return;
    const ep = {
      id:       stateRef.current.currentEpId || Date.now().toString(),
      epNum:    stateRef.current.epNum || epNum,
      season:   stateRef.current.season || season,
      title:    stateRef.current.title || title,
      wordCount:chunks.reduce((a,c)=>a+c.text.split(/\s+/).length,0),
      ended:    ended||false,
      savedAt:  Date.now(),
      storyChunks: chunks,
      prompt:   stateRef.current.prompt||'',
      savedScenes:   stateRef.current.savedScenes||null,
      savedChars:    stateRef.current.savedChars||null,
      savedNarration:stateRef.current.savedNarration||null,
    };
    const { db_saveEpisode } = await import('../../lib/firebase');
    await db_saveEpisode(user.uid, ep);
  }

  // ── Generate Story Idea ───────────────────────────
  async function generateAiStoryIdea() {
    setGenState('generating');
    const genreHint = selectedGenre!=='any'
      ? `Setting/genre: ${selectedGenre}`
      : 'Koi bhi horror setting (haveli, jungle, highway, gaon, school, supernatural, psychological)';
    try {
      const res = await fetch('/api/ai',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'openai/gpt-4o-mini', max_tokens:400, temperature:0.95,
          messages:[{ role:'user',
            content:`You are a Hindi horror story title generator.\n\nGenre/Setting: ${genreHint}\n\nSTRICT RULES:\n- Title MUST be in Hindi Devanagari script only.\n- Title must be 3-6 Hindi words. NO English words.\n- Plot: 3-4 sentences in Hindi Devanagari.\n\nRespond ONLY in JSON:\n{"title":"हिंदी शीर्षक","plot":"हिंदी में कहानी का विचार"}`
          }],
        }),
      });
      const data   = await res.json();
      const raw    = data.choices?.[0]?.message?.content||'';
      const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
      generatedRef.current = { title:parsed.title||'', prompt:parsed.plot||'' };
      if (parsed.title && parsed.plot) {
        setTitlePreview(parsed.title); setShowStart(true); setGenState('done');
      } else { toast('⚠️ Dobara try karo'); setGenState('idle'); }
    } catch(err) { toast('❌ '+err.message); setGenState('idle'); }
  }

  // ── Start Studio ──────────────────────────────────
  async function startStudio() {
    const { title:genTitle, prompt:genPrompt } = generatedRef.current;
    if (!genTitle) { toast('⚠️ Pehle story idea generate karo!'); return; }
    const newEpId = Date.now().toString();
    const newState = {
      title:genTitle, season:'SEASON 1', epNum:'EP 01', currentEpId:newEpId,
      storyChunks:[], storyEnded:false, prompt:genPrompt,
      seasonBible:null, savedScenes:null, savedChars:null,
      characterBible:null, savedNarration:null, ytTitle:null, ytDesc:null,
    };
    stateRef.current = newState;
    setSeason('SEASON 1'); setEpNum('EP 01'); setTitle(genTitle);
    setCurrentEpId(newEpId); setStoryChunks([]); setStoryEnded(false);
    setShowEndBanner(false); setWordCount(0);
    setScenes(null); setChars(null); setNarration('');
    saveState(newState);
    setScreen('story');
    setTimeout(()=>sendContinue(true,[],genTitle,genPrompt,'SEASON 1','EP 01',newEpId),100);
  }

  // ── Next Episode ──────────────────────────────────
  async function startNextEpisode() {
    const epMatch   = (stateRef.current.epNum||epNum).match(/(\d+)/);
    const nextEpNum = 'EP '+ String((epMatch?parseInt(epMatch[1]):1)+1).padStart(2,'0');
    const prevStory = storyChunks.map(c=>c.text).join('\n\n');
    const bible     = (stateRef.current.seasonBible||'') + `\n\n[${season} ${epNum}]:\n${prevStory.slice(0,800)}...`;
    const newEpId   = Date.now().toString();
    const newState  = {
      ...stateRef.current, epNum:nextEpNum, storyChunks:[], storyEnded:false,
      currentEpId:newEpId, savedScenes:null, savedChars:null,
      savedNarration:null, ytTitle:null, ytDesc:null, seasonBible:bible,
    };
    stateRef.current = newState;
    setEpNum(nextEpNum); setStoryChunks([]); setStoryEnded(false);
    setShowEndBanner(false); setWordCount(0);
    setScenes(null); setChars(null); setNarration('');
    saveState(newState);
    toast(`▶ ${nextEpNum} shuru ho raha hai...`);
    setTimeout(()=>sendContinue(true,[],stateRef.current.title,stateRef.current.prompt,season,nextEpNum,newEpId),100);
  }

  // ── End Season ───────────────────────────────────
  async function endCurrentSeason() {
    const sMatch      = (stateRef.current.season||season).match(/(\d+)/);
    const nextSeason  = 'SEASON '+((sMatch?parseInt(sMatch[1]):1)+1);
    const prevStory   = storyChunks.map(c=>c.text).join('\n\n');
    const bible       = (stateRef.current.seasonBible||'') + `\n\n[${season} Summary]:\n${prevStory.slice(0,1200)}...`;
    const newEpId     = Date.now().toString();
    const newState    = {
      ...stateRef.current, season:nextSeason, epNum:'EP 01', storyChunks:[], storyEnded:false,
      currentEpId:newEpId, savedScenes:null, savedChars:null,
      savedNarration:null, ytTitle:null, ytDesc:null, seasonBible:bible,
    };
    stateRef.current = newState;
    setSeason(nextSeason); setEpNum('EP 01'); setStoryChunks([]); setStoryEnded(false);
    setShowEndBanner(false); setWordCount(0);
    setScenes(null); setChars(null); setNarration('');
    saveState(newState);
    toast(`🏁 ${nextSeason} shuru ho raha hai!`);
    setTimeout(()=>sendContinue(true,[],stateRef.current.title,stateRef.current.prompt,nextSeason,'EP 01',newEpId),100);
  }

  // ── Core story generation ─────────────────────────
  async function sendContinue(isFirst=false, _chunks, _title, _prompt, _season, _epNum, _epId) {
    if (isGenRef.current) return;
    if (!isFirst && storyEnded) return;
    isGenRef.current = true;
    setIsGenerating(true);

    const curChunks = _chunks!==undefined ? _chunks : storyChunks;
    const curPrompt = _prompt || stateRef.current.prompt || '';
    const hint      = isFirst ? '' : promptHint;
    const bible     = stateRef.current.seasonBible||'';

    const systemPrompt = `You are a Hindi horror story writer. Write ONLY in Hindi Devanagari script.
RULES:
1. ONLY Hindi Devanagari — zero English sentences.
2. Each part: exactly 100-120 Hindi words.
3. End every part on a cliffhanger.
4. Sensory details — smells, sounds, touch, fear.
5. Emotion tags for ElevenLabs: [scared] [whisper] [laugh] [cry] [angry] [shocked] [calm]
${bible?`\nPREVIOUS SEASON CONTINUITY:\n${bible}`:''}`;

    const messages = curChunks.length===0
      ? [{ role:'user', content:`केवल हिंदी देवनागरी में लिखो।\n\n${curPrompt?'कहानी: '+curPrompt+'\n\n':''}पहला भाग — दृश्य, 1-2 पात्र, रहस्य। 100-120 शब्द।` }]
      : [
          { role:'user',      content:`पिछली कहानी:\n\n${curChunks.map((c,i)=>`[Part ${i+1}]:\n${c.text}`).join('\n\n')}` },
          { role:'assistant', content:'[कहानी जारी है...]' },
          { role:'user',      content: hint
              ? `direction: "${hint}"। हिंदी देवनागरी। 100-120 words। Cliffhanger।`
              : `अगला भाग। हिंदी देवनागरी। 100-120 words। Cliffhanger।` },
        ];

    const partNum  = curChunks.length+1;
    const newChunk = { text:'', hint:hint||'', partNum, streaming:true };
    const optimistic = [...curChunks, newChunk];
    setStoryChunks(optimistic);
    setPromptHint('');

    try {
      const res = await fetch('/api/ai',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ model:'openai/gpt-4o-mini',
          messages:[{role:'system',content:systemPrompt},...messages],
          max_tokens:400, temperature:0.88, stream:true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader=res.body.getReader(), dec=new TextDecoder();
      let full='';
      while(true){
        const {done,value}=await reader.read();
        if(done) break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue;
          const d=line.slice(6).trim();
          if(d==='[DONE]') break;
          try{
            const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';
            if(delta){ full+=delta; setStoryChunks(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],text:full};return u;}); scrollBottom(); }
          }catch{}
        }
      }
      if(full.trim()){
        const final=[...curChunks,{text:full.trim(),hint:hint||'',partNum}];
        setStoryChunks(final);
        const wc=final.reduce((a,c)=>a+c.text.split(/\s+/).length,0);
        setWordCount(wc);
        saveState({storyChunks:final});
        saveEpisode(final,false);
      }
    } catch(err){
      setStoryChunks(curChunks);
      toast('❌ '+(err.message||'API fail'));
    }
    isGenRef.current=false;
    setIsGenerating(false);
    scrollBottom();
  }

  // ── End Story Now ─────────────────────────────────
  async function endStoryNow() {
    if (isGenRef.current || storyEnded) return;
    isGenRef.current=true; setIsGenerating(true);

    const curChunks = storyChunks;
    const storyCtx  = curChunks.map((c,i)=>`[Part ${i+1}]:\n${c.text}`).join('\n\n');
    const partNum   = curChunks.length+1;
    setStoryChunks([...curChunks,{text:'',hint:'END',partNum,isEnd:true,streaming:true}]);

    try {
      const res=await fetch('/api/ai',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ model:'openai/gpt-4o-mini',
          messages:[
            {role:'system',content:'Write ONLY in Hindi Devanagari script.'},
            {role:'user',content:`${storyCtx}\n\nPowerful scary ending हिंदी में। 100-120 words। "समाप्त" se khatam karo।`},
          ], max_tokens:500, temperature:0.85, stream:true }),
      });
      const reader=res.body.getReader(), dec=new TextDecoder();
      let full='';
      while(true){
        const {done,value}=await reader.read();
        if(done) break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue;
          const d=line.slice(6).trim();
          if(d==='[DONE]') break;
          try{
            const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';
            if(delta){ full+=delta; setStoryChunks(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],text:full};return u;}); }
          }catch{}
        }
      }
      const final=[...curChunks,{text:full.trim(),hint:'END',partNum,isEnd:true}];
      setStoryChunks(final);
      setStoryEnded(true);
      setShowEndBanner(true);
      saveState({storyChunks:final,storyEnded:true});
      await saveEpisode(final,true);
      toast('✅ Episode save ho gaya!');
      // Auto generate scenes + chars
      setTimeout(()=>{ generateScenesAuto(final); generateCharsAuto(final); }, 1200);
    } catch(err){ toast('❌ '+err.message); }

    isGenRef.current=false; setIsGenerating(false); scrollBottom();
  }

  // ── Scenes ───────────────────────────────────────
  async function generateScenesAuto(chunks) {
    const curChunks = chunks || storyChunks;
    setScenesLoading(true);
    const storyText = curChunks.map(c=>c.text).join('\n\n');
    try {
      const res=await fetch('/api/ai',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ model:'openai/gpt-4o-mini', max_tokens:3000, temperature:0.35,
          messages:[{role:'user', content:`Yeh Hindi horror story hai (Title: "${stateRef.current.title||title}"):\n\n${storyText}\n\nIs story ko MINIMUM 15 SCENES mein todo. Har scene ke liye:\n\nSCENE_START\nnum: [number]\ntitle: [Hindi scene title]\nlocation: [location]\nmood: [Daravna/Suspenseful/Intense/Creepy/Shocking]\nwhat: [kya hua — 1 line Hindi]\nimgprompt: [English — cinematic dark horror. 40-60 words.]\nSCENE_END\n\nSirf format, koi extra text nahi.`}],
        }),
      });
      const data=await res.json();
      const raw=data.choices?.[0]?.message?.content||'';
      const parsed=parseScenes(raw);
      if(parsed.length){ setScenes(parsed); saveState({savedScenes:parsed}); toast(`✅ ${parsed.length} scenes ready!`); }
    } catch{}
    setScenesLoading(false);
  }

  function parseScenes(raw) {
    const blocks=raw.split('SCENE_START').slice(1);
    return blocks.map(b=>{
      const end=b.indexOf('SCENE_END'); const block=end>-1?b.slice(0,end):b;
      const get=(key)=>{ const m=block.match(new RegExp(key+':\\s*(.+)')); return m?m[1].trim():''; };
      return { num:get('num'), title:get('title'), location:get('location'), mood:get('mood'), what:get('what'), imgprompt:get('imgprompt') };
    }).filter(s=>s.title);
  }

  // ── Characters ────────────────────────────────────
  async function generateCharsAuto(chunks) {
    const curChunks = chunks || storyChunks;
    setCharsLoading(true);
    const storyText = curChunks.map(c=>c.text).join('\n\n');
    try {
      const res=await fetch('/api/ai',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ model:'openai/gpt-4o-mini', max_tokens:1500, temperature:0.3,
          messages:[{role:'user', content:`Story: "${stateRef.current.title||title}"\n\n${storyText}\n\nIs story ke saare characters list karo. Har character ke liye JSON:\n\n[{"name":"naam","role":"Hero/Villain/Supporting","desc":"Hindi mein character description 2-3 lines","appear":"Kis part mein aaya"}]\n\nSirf JSON array, koi extra text nahi.`}],
        }),
      });
      const data=await res.json();
      const raw=data.choices?.[0]?.message?.content?.trim()||'[]';
      const parsed=JSON.parse(raw.replace(/```json|```/g,'').trim());
      if(Array.isArray(parsed)&&parsed.length){ setChars(parsed); saveState({savedChars:parsed}); toast(`✅ ${parsed.length} characters ready!`); }
    } catch{}
    setCharsLoading(false);
  }

  // ── Full Narration ────────────────────────────────
  async function generateFullNarration(forceRegen=false) {
    if (!storyChunks.length){ toast('⚠️ Story nahi hai!'); return; }
    if (narration && !forceRegen){ setShowNarration(true); return; }
    setNarrationLoading(true); setShowNarration(true);
    const fullStory=storyChunks.map(c=>c.text).join('\n\n');
    try {
      const res=await fetch('/api/ai',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ model:'openai/gpt-4o-mini', max_tokens:2500, temperature:0.7,
          messages:[
            { role:'system', content:`Tu ek professional Hindi horror narrator hai jo ElevenLabs ke liye script likhta hai.\nSirf Hindi Devanagari. ElevenLabs break tags use karo:\n<break time="0.5s" /> <break time="1.0s" /> <break time="1.5s" /> <break time="2.0s" />\nEmotion tags: [scared] [whisper] [laugh] [cry] [angry] [shocked] [calm]` },
            { role:'user', content:`Yeh horror story hai:\n\n${fullStory}\n\nPoori story ka ElevenLabs-ready HINDI NARRATION script likho.\n- Sirf Hindi Devanagari\n- Break tags sahi jagah lagao\n- Emotion tags use karo\n- Koi heading mat lagao, seedha narration shuru karo` },
          ],
        }),
      });
      const data=await res.json();
      const nar=data.choices?.[0]?.message?.content?.trim()||'';
      if(nar){ setNarration(nar); saveState({savedNarration:nar}); saveEpisode(storyChunks,storyEnded); }
    } catch(err){ toast('❌ '+err.message); }
    setNarrationLoading(false);
  }

  function scrollBottom(){ setTimeout(()=>{ if(storyAreaRef.current) storyAreaRef.current.scrollTop=storyAreaRef.current.scrollHeight; },50); }

  function copyText(text){ navigator.clipboard.writeText(text).then(()=>toast('✅ Copied!')); }

  const TARGET=1500;
  const wcPct=Math.min(100,(wordCount/TARGET)*100);

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <>
      <SideDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} user={user} />

      {/* ══ SETUP SCREEN ══ */}
      {screen==='setup' && (
        <div className="page-content" style={{background:'radial-gradient(ellipse 70% 50% at 50% 0%,rgba(120,0,0,0.25) 0%,transparent 60%),var(--void)',overflowY:'auto'}}>
          <div className="mini-topbar">
            <button className="hamburger-btn" onClick={()=>setDrawerOpen(true)}>☰</button>
            <span className="mini-topbar-title">💀 KAALI RAAT</span>
            <div style={{width:36}}/>
          </div>
          <div className="setup-scroll-body">
            <div className="setup-card">

              {/* Channel Card */}
              {channelInfo ? (
                <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                  {channelInfo.thumb
                    ? <img src={channelInfo.thumb} alt="" style={{width:44,height:44,borderRadius:'50%',objectFit:'cover',border:'2px solid #550022',flexShrink:0}}/>
                    : <div style={{width:44,height:44,borderRadius:'50%',background:'#330000',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>📺</div>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#ddd',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{channelInfo.name}</div>
                    <div style={{display:'flex',gap:12,marginTop:5}}>
                      <div style={{display:'flex',flexDirection:'column'}}>
                        <span style={{fontSize:13,fontWeight:800,color:'#ff4444'}}>
                          {channelInfo.subscribers>=1000000?(channelInfo.subscribers/1000000).toFixed(1)+'M':channelInfo.subscribers>=1000?(channelInfo.subscribers/1000).toFixed(1)+'K':channelInfo.subscribers}
                        </span>
                        <span style={{fontSize:8,color:'#555',letterSpacing:1.5,textTransform:'uppercase'}}>Subscribers</span>
                      </div>
                      <div style={{width:1,background:'#2a2a2a'}}/>
                      <div style={{display:'flex',flexDirection:'column'}}>
                        <span style={{fontSize:13,fontWeight:800,color:'#aaa'}}>{channelInfo.videoCount}</span>
                        <span style={{fontSize:8,color:'#555',letterSpacing:1.5,textTransform:'uppercase'}}>Videos</span>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <span className="sg-live-dot"/>
                    <span style={{fontSize:7,color:'#440000',letterSpacing:1}}>LIVE</span>
                  </div>
                </div>
              ) : (
                <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:10,padding:'12px 14px',height:72,display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:'#111'}}/>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{height:12,width:'60%',background:'#111',borderRadius:4}}/>
                    <div style={{height:10,width:'40%',background:'#0a0a0a',borderRadius:4}}/>
                  </div>
                </div>
              )}

              {/* Studio Card */}
              <div className="sg-studio-card">
                <div className="sg-label">GENRE / SETTING</div>
                <div className="sg-genre-grid">
                  {GENRES.map(g=>(
                    <div key={g.key} className={`sg-chip${selectedGenre===g.key?' active':''}`} onClick={()=>setSelectedGenre(g.key)}>{g.label}</div>
                  ))}
                </div>
                <div className="sg-divider-line"/>
                {titlePreview && (
                  <div className="sg-title-box">
                    <div className="sg-title-tag">STORY TITLE</div>
                    <div className="sg-title-main">{titlePreview}</div>
                  </div>
                )}
                <button className="sg-gen-btn" onClick={generateAiStoryIdea} disabled={genState==='generating'}>
                  {genState==='generating'
                    ? <><div className="spinner"/> Soch raha hai...</>
                    : <><span className="sg-gen-icon">✦</span>{genState==='done'?'🔄 Dobara Generate Karo':'Generate Story Idea'}</>}
                </button>
                {showStart && (
                  <button className="sg-start-btn" onClick={startStudio}>▶ &nbsp;Episode Shuru Karo</button>
                )}
              </div>

              {/* Resume banner */}
              {storyChunks.length>0 && (
                <div style={{background:'#0a0000',border:'1px solid #330000',borderRadius:10,padding:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:11,color:'#880000',fontWeight:700}}>{season} · {epNum}</div>
                    <div style={{fontSize:13,color:'#ddd',marginTop:3}}>{title||'Untitled'}</div>
                    <div style={{fontSize:11,color:'#444',marginTop:2}}>{wordCount} words</div>
                  </div>
                  <button onClick={()=>setScreen('story')} className="btn btn-ghost" style={{fontSize:12,padding:'8px 14px'}}>▶ Continue</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ STORY SCREEN ══ */}
      {screen==='story' && (
        <div className="page-content" style={{background:'var(--void)'}}>
          {/* Topbar */}
          <div className="topbar">
            <button className="btn btn-icon" onClick={()=>setDrawerOpen(true)}>☰</button>
            <span className="topbar-logo" style={{fontFamily:"'Cinzel Decorative',serif",fontSize:13,fontWeight:900,color:'var(--blood-b)',letterSpacing:2}}>☠ KAALI RAAT</span>
            <span className="topbar-ep">{season} · {epNum}</span>
            <div className="topbar-actions">
              <button className="btn btn-icon" title="Scenes & Characters" onClick={()=>setScreen('analysis')}>🎬</button>
              <button className="btn btn-icon" title="Save" onClick={()=>{saveEpisode(storyChunks,storyEnded);toast('💾 Saved!');}}>💾</button>
            </div>
          </div>

          {/* Story area */}
          <div className="story-area" ref={storyAreaRef}>
            {storyChunks.length===0 && (
              <div style={{textAlign:'center',padding:'40px 20px',color:'#333',fontSize:13}}>
                Neeche "Continue Karo" dabao — AI story likhna shuru karega...
              </div>
            )}
            {storyChunks.map((chunk,idx)=>(
              <div key={idx} className="story-chunk">
                <div className="chunk-meta">
                  <span>{chunk.isEnd?'🩸':'📖'}</span>
                  <span style={{fontSize:10,color:'var(--blood)',fontWeight:700,letterSpacing:1}}>
                    {chunk.isEnd?'THE END':`EP ${String((stateRef.current.epNum||epNum).match(/\d+/)?.[0]||1).padStart(2,'0')} · PART ${chunk.partNum||idx+1}`}
                  </span>
                </div>
                <div className="chunk-text">{chunk.text}{chunk.streaming&&!chunk.text&&<span className="cursor-blink"/>}</div>
              </div>
            ))}

            {/* End Banner */}
            {showEndBanner && (
              <div className="end-banner show" style={{margin:'0 16px 16px'}}>
                <div className="end-banner-title">🩸 The End 🩸</div>
                <div className="end-banner-sub">{season} · {epNum} complete!</div>
                <div className="btn-row" style={{flexWrap:'wrap',gap:8}}>
                  <button className="btn btn-primary" onClick={startNextEpisode}>▶ Next Episode</button>
                  <button className="btn btn-ghost" onClick={endCurrentSeason} style={{borderColor:'#cc6600',color:'#cc6600'}}>🏁 End Season &amp; Start Next</button>
                  <button className="btn btn-primary" onClick={()=>generateFullNarration(false)} style={{background:'linear-gradient(135deg,#005500,#003300)'}}>🎙 Full Narration Generate Karo</button>
                  <button className="btn btn-ghost" onClick={()=>setScreen('analysis')}>🎬 Scene &amp; Characters</button>
                  <button className="btn btn-primary" onClick={()=>router.push('/youtube')} style={{background:'linear-gradient(135deg,#cc0000,#880000)',border:'none',width:'100%'}}>▶ YouTube Export</button>
                </div>

                {/* Narration output */}
                {showNarration && (
                  <div style={{background:'#000a00',border:'1px solid #004400',borderRadius:8,padding:14,marginTop:4}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{fontSize:10,color:'#44bb66',letterSpacing:2,textTransform:'uppercase'}}>🎙 Full Episode Narration — ElevenLabs Ready</div>
                      <button onClick={()=>generateFullNarration(true)} style={{background:'transparent',border:'1px solid #555',color:'#888',fontSize:10,padding:'4px 10px',borderRadius:6,cursor:'pointer'}}>🔄 Dobara Banao</button>
                    </div>
                    {narrationLoading
                      ? <div style={{display:'flex',alignItems:'center',gap:8,color:'#44bb66',fontSize:12}}><div className="spinner"/>ElevenLabs narration ban rahi hai...</div>
                      : <div style={{fontSize:14,color:'#c8e8c8',lineHeight:1.9,whiteSpace:'pre-wrap'}}>{narration}</div>
                    }
                    {narration && !narrationLoading && (
                      <button onClick={()=>copyText(narration)} style={{marginTop:12,background:'transparent',border:'1px solid #44bb66',color:'#44bb66',padding:'6px 14px',borderRadius:6,fontSize:12,cursor:'pointer'}}>📋 ElevenLabs ke liye Copy Karo</button>
                    )}
                  </div>
                )}
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

          {/* Bottom bar */}
          <div className="bottom-bar">
            <div className="action-chips">
              {[
                ['😱 Tension Badhao','Aur tension badhao, kuch bura hone wala hai'],
                ['👻 Creepy Turn','Ek creepy turn aao story mein'],
                ['👤 Character','Character ko aur describe karo'],
                ['🌑 Dark Karo','Scene ka atmosphere aur dark karo'],
                ['💬 Dialog','Dialog likhao characters ke beech'],
                ['⚡ Twist!','Ek shocking revelation aao'],
              ].map(([label,hint])=>(
                <div key={label} className="action-chip" onClick={()=>!storyEnded&&setPromptHint(hint)}
                  style={storyEnded?{opacity:0.4,cursor:'not-allowed'}:{}}>{label}</div>
              ))}
              {!storyEnded && (
                <div className="action-chip" style={{borderColor:'#550000',color:'#cc4444',flexShrink:0}} onClick={endStoryNow}>🔚 Story End Karo</div>
              )}
            </div>

            <div className="prompt-row">
              <textarea
                className="prompt-input"
                placeholder={storyEnded?'Story khatam ho gayi...':'Kuch direction do (optional)... ya khali chhodo'}
                rows={1} value={promptHint}
                disabled={storyEnded}
                onChange={e=>setPromptHint(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendContinue();}}}
              />
              <button className="send-btn" onClick={()=>sendContinue()} disabled={isGenerating||storyEnded}>▶</button>
            </div>

            <button
              className={`continue-btn${isGenerating?' loading':''}`}
              onClick={()=>sendContinue()}
              disabled={isGenerating||storyEnded}
            >
              {isGenerating ? <><div className="spinner"/><span>Likh raha hai...</span></>
                : storyEnded ? '✅ Story Khatam'
                : <span>📖 Continue Karo</span>}
            </button>
          </div>
        </div>
      )}

      {/* ══ ANALYSIS SCREEN ══ */}
      {screen==='analysis' && (
        <div className="page-content" style={{background:'var(--void)'}}>
          <div className="topbar">
            <button className="btn btn-icon" onClick={()=>setScreen('story')}>←</button>
            <span className="topbar-logo" style={{fontFamily:"'Cinzel Decorative',serif",fontSize:13,color:'var(--blood-b)'}}>🔍 ANALYSIS</span>
          </div>
          <div className="analysis-content">

            {/* Scenes */}
            <div className="analysis-panel">
              <div className="analysis-generate-bar">
                <div className="analysis-hint">Story ke saare scenes — location, mood, kya hua.</div>
                <button className="btn btn-primary" onClick={()=>generateScenesAuto()} disabled={scenesLoading||!storyChunks.length}>
                  {scenesLoading?<><div className="spinner"/>Scenes ban rahe hain...</>:'🎬 Scene Breakdown Generate Karo'}
                </button>
              </div>
              {scenes?.map((s,i)=>(
                <div key={i} className="scene-card">
                  <div className="scene-num">🎬 Scene {s.num} <span style={{color:'#444',fontSize:9,letterSpacing:1}}>{(s.mood||'').toUpperCase()}</span></div>
                  <div className="scene-title">{s.title}</div>
                  <div className="scene-meta"><span className="scene-tag">📍 {s.location}</span></div>
                  <div className="scene-desc">{s.what}</div>
                  {s.imgprompt && (
                    <button onClick={()=>copyText(s.imgprompt)} style={{marginTop:8,background:'#0a0000',border:'1px solid #440000',color:'#cc4444',borderRadius:8,fontSize:12,padding:'8px',cursor:'pointer',width:'100%'}}>
                      📋 Image Prompt Copy
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Characters */}
            <div className="analysis-panel">
              <div className="analysis-generate-bar">
                <div className="analysis-hint">Story ke saare characters — naam, role, description.</div>
                <button className="btn btn-primary" onClick={()=>generateCharsAuto()} disabled={charsLoading||!storyChunks.length}>
                  {charsLoading?<><div className="spinner"/>Characters ban rahe hain...</>:'👤 Character List Generate Karo'}
                </button>
              </div>
              {chars?.map((c,i)=>(
                <div key={i} className="char-card">
                  <div className="char-name">{c.name}<span className="char-role-badge">{c.role}</span></div>
                  <div className="char-desc">{c.desc}</div>
                  {c.appear && <div className="char-appear">📍 {c.appear}</div>}
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      <BottomNav userInitial={initial}/>
    </>
  );
}

export default function GeneratePageWrapper() {
  return (
    <ToastProvider>
      <AuthWrapper>
        {({user})=><GeneratePage user={user}/>}
      </AuthWrapper>
    </ToastProvider>
  );
}
