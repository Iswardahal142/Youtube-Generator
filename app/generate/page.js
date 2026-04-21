'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AuthWrapper from '../../components/AuthWrapper';
import BottomNav from '../../components/BottomNav';
import SideDrawer from '../../components/SideDrawer';
import { ToastProvider, useToast } from '../../components/Toast';

// ── Inner component (needs toast context) ──────────
function GeneratePage({ user }) {
  const router          = useRouter();
  const toast           = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [selectedGenre, setSelectedGenre] = useState('any');
  const [genState, setGenState] = useState('idle'); // idle | checking | generating | done
  const [titlePreview, setTitlePreview]   = useState('');
  const [showStart, setShowStart]         = useState(false);
  const [showWarning, setShowWarning]     = useState(false);
  const [channelName, setChannelName]     = useState('');
  const [channelThumbnail, setChannelThumbnail] = useState('');

  // Story writer state
  const [screen, setScreen]             = useState('setup'); // setup | story | analysis | thumb
  const [storyChunks, setStoryChunks]   = useState([]);
  const [storyEnded, setStoryEnded]     = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wordCount, setWordCount]       = useState(0);
  const [promptHint, setPromptHint]     = useState('');
  const [showEndBanner, setShowEndBanner] = useState(false);
  const [season, setSeason]             = useState('SEASON 1');
  const [epNum, setEpNum]               = useState('EP 01');
  const [title, setTitle]               = useState('');
  const [currentEpId, setCurrentEpId]   = useState(null);

  // Refs
  const storyAreaRef   = useRef(null);
  const generatedRef   = useRef({ title: '', prompt: '' });
  const stateRef       = useRef({});
  const isGeneratingRef = useRef(false);

  const displayName = user?.displayName || user?.email || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  const GENRES = [
    { key: 'any',           label: 'Kuch Bhi' },
    { key: 'haveli',        label: '🏚 Haveli' },
    { key: 'jungle',        label: '🌲 Jungle' },
    { key: 'highway',       label: '🌙 Highway' },
    { key: 'gaon',          label: '🏘 Gaon' },
    { key: 'school',        label: '🏫 School' },
    { key: 'supernatural',  label: '👻 Super' },
    { key: 'psychological', label: '🧠 Psycho' },
  ];

  // ── Load state from Firebase + fetch channel name ─
  useEffect(() => {
    if (!user?.uid) return;

    // Firebase state load
    import('../../lib/firebase').then(async ({ db_loadState }) => {
      const d = await db_loadState(user.uid);
      if (d) {
        if (d.season)       setSeason(d.season);
        if (d.epNum)        setEpNum(d.epNum);
        if (d.title)        setTitle(d.title);
        if (d.currentEpId)  setCurrentEpId(d.currentEpId);
        if (d.storyChunks?.length) {
          setStoryChunks(d.storyChunks);
          setWordCount(d.storyChunks.reduce((a,c) => a + c.text.split(/\s+/).length, 0));
        }
        if (d.storyEnded)   setStoryEnded(true);
        stateRef.current = d;
      }
    });

    // ── Channel name directly YouTube API se fetch ──
    fetch('/api/youtube')
  .then(r => r.json())
  .then(data => {
    if (data.channelName) {
      setChannelName(data.channelName);
      stateRef.current = { ...stateRef.current, channel: data.channelName };
    }
    if (data.channelThumbnail) {
      setChannelThumbnail(data.channelThumbnail);
    }
  })
  .catch(() => {});

  }, [user?.uid]);

  function saveState(updates) {
    const next = { ...stateRef.current, ...updates };
    stateRef.current = next;
    if (user?.uid) {
      import('../../lib/firebase').then(({ db_saveState }) => db_saveState(user.uid, next));
    }
  }

  // ── Generate Story Idea ───────────────────────────
  async function generateAiStoryIdea() {
    setGenState('checking');

    try {
      // Sirf tab check karo jab koi current story nahi chal rahi
      if (!stateRef.current.storyChunks?.length) {
        const { db_getEpisodes } = await import('../../lib/firebase');
        const eps = await db_getEpisodes(user.uid);

        // Koi episode hai jo ended hai but ytUploaded explicitly false hai
        const hasUnuploaded = eps?.some(ep => ep.ended && ep.ytUploaded === false);

        if (hasUnuploaded) {
          setShowWarning(true);
          setGenState('idle');
          return;
        }
      }
    } catch {}

    setGenState('generating');
    setShowWarning(false);

    const genreHint = selectedGenre !== 'any'
      ? `Setting/genre: ${selectedGenre}`
      : 'Koi bhi horror setting (haveli, jungle, highway, gaon, school, supernatural, psychological)';

    try {
      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       'openai/gpt-4o-mini',
          max_tokens:  400,
          temperature: 0.95,
          messages: [{
            role:    'user',
            content: `You are a Hindi horror story title generator. Generate a unique Hindi horror story.\n\nGenre/Setting: ${genreHint}\n\nSTRICT RULES:\n- Title MUST be in Hindi Devanagari script only. Example: \"अंधेरे का राज\"\n- Title must be 3-6 Hindi words. NO English words in title.\n- Plot: 3-4 sentences in Hindi Devanagari about the story setup.\n\nRespond ONLY in this JSON format:\n{\"title\": \"हिंदी शीर्षक यहाँ\", \"plot\": \"हिंदी में कहानी का विचार यहाँ\"}`,
          }],
        }),
      });
      const data   = await res.json();
      const raw    = data.choices?.[0]?.message?.content || '';
      const clean  = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      generatedRef.current = { title: parsed.title || '', prompt: parsed.plot || '' };

      if (parsed.title && parsed.plot) {
        setTitlePreview(parsed.title);
        setShowStart(true);
        setGenState('done');
      } else {
        toast('⚠️ Idea generate nahi hua, dobara try karo');
        setGenState('idle');
      }
    } catch (err) {
      toast('❌ Error: ' + err.message);
      setGenState('idle');
    }
  }

  // ── Start Studio ──────────────────────────────────
  async function startStudio() {
    const { title: genTitle, prompt: genPrompt } = generatedRef.current;
    if (!genTitle) { toast('⚠️ Pehle story idea generate karo!'); return; }

    const newTitle     = genTitle;
    const newEpId      = Date.now().toString();
    const newSeason    = 'SEASON 1';
    const newEpNum     = 'EP 01';

    setTitle(newTitle); setSeason(newSeason); setEpNum(newEpNum);
    setCurrentEpId(newEpId); setStoryChunks([]); setStoryEnded(false);
    setShowEndBanner(false); setWordCount(0);

    const newState = {
      title: newTitle, season: newSeason, epNum: newEpNum,
      currentEpId: newEpId, storyChunks: [], storyEnded: false,
      prompt: genPrompt, seasonBible: null, savedScenes: null,
      savedChars: null, characterBible: null, savedNarration: null,
      ytTitle: null, ytDesc: null,
    };
    stateRef.current = newState;
    saveState(newState);
    setScreen('story');

    // Auto start first chunk
    setTimeout(() => sendContinue(true, newTitle, genPrompt, newSeason, newEpNum, newEpId, []), 100);
  }

  // ── Story Generation ──────────────────────────────
  async function sendContinue(isFirst = false, _title, _prompt, _season, _epNum, _epId, _chunks) {
    if (isGeneratingRef.current || storyEnded) return;
    isGeneratingRef.current = true;
    setIsGenerating(true);

    const curTitle   = _title  || title;
    const curPrompt  = _prompt || stateRef.current.prompt || '';
    const curSeason  = _season || season;
    const curEpNum   = _epNum  || epNum;
    const chunks     = _chunks !== undefined ? _chunks : storyChunks;
    const hint       = promptHint;
    const seasonBible = stateRef.current.seasonBible || '';

    const systemPrompt = buildSystemPrompt(seasonBible);
    const messages     = buildMessages(chunks, curPrompt, hint, isFirst);

    // Optimistic chunk add
    const partNum  = chunks.length + 1;
    const newChunk = { text: '', hint: hint || '', partNum, streaming: true };
    const newChunks = [...chunks, newChunk];
    setStoryChunks(newChunks);
    setPromptHint('');

    try {
      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       'openai/gpt-4o-mini',
          messages:    [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens:  400,
          temperature: 0.88,
          stream:      true,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') break;
          try {
            const json  = JSON.parse(d);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              setStoryChunks(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], text: fullText };
                return updated;
              });
              scrollToBottom();
            }
          } catch {}
        }
      }

      // Finalize chunk
      if (fullText.trim()) {
        const finalChunk = { text: fullText.trim(), hint: hint || '', partNum };
        const finalChunks = [...chunks, finalChunk];
        setStoryChunks(finalChunks);
        const wc = finalChunks.reduce((a, c) => a + c.text.split(/\s+/).length, 0);
        setWordCount(wc);
        saveState({ storyChunks: finalChunks });
      }
    } catch (err) {
      // Remove failed chunk
      setStoryChunks(chunks);
      toast('❌ Error: ' + (err.message || 'API call fail hua'));
    }

    isGeneratingRef.current = false;
    setIsGenerating(false);
    scrollToBottom();
  }

  function buildSystemPrompt(seasonBible) {
    return `You are a Hindi horror story writer. You MUST write ONLY in Hindi (Devanagari script). This is non-negotiable.

ABSOLUTE RULES:
1. WRITE ONLY IN HINDI DEVANAGARI SCRIPT (हिंदी देवनागरी).
2. DO NOT write even a single sentence in English.
3. Each part must be EXACTLY 100-120 Hindi words.
4. End every part on a cliffhanger or suspense hook.
5. Include sensory details — smells, sounds, touch, fear.
6. Do NOT end the story yourself.

EMOTION TAGS (ElevenLabs ke liye):
[scared] [whisper] [laugh] [cry] [angry] [shocked] [calm]
${seasonBible ? `\n\nPREVIOUS SEASON CONTINUITY:\n${seasonBible}` : ''}`;
  }

  function buildMessages(chunks, curPrompt, hint, isFirst) {
    if (!chunks.length) {
      return [{
        role:    'user',
        content: `केवल हिंदी देवनागरी लिपि में लिखो।\n\n${curPrompt ? 'कहानी का विचार: ' + curPrompt + '\n\n' : ''}पहला भाग लिखो — दृश्य तैयार करो, 1-2 पात्र introduce करो, रहस्य शुरू करो। सिर्फ 100-120 शब्द।`,
      }];
    }
    const storyContext = chunks.map((c, i) => `[Part ${i+1}]:\n${c.text}`).join('\n\n');
    return [
      { role: 'user',      content: `पिछली कहानी:\n\n${storyContext}` },
      { role: 'assistant', content: '[कहानी जारी है...]' },
      { role: 'user',      content: hint
          ? `कहानी आगे बढ़ाओ। direction: "${hint}"। सिर्फ हिंदी देवनागरी में। 100-120 words। Cliffhanger पर खत्म करो।`
          : `कहानी आगे बढ़ाओ। अगला भाग लिखो। सिर्फ हिंदी देवनागरी में। 100-120 words। Cliffhanger पर खत्म करो।`,
      },
    ];
  }

  async function endStoryNow() {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsGenerating(true);

    const chunks      = storyChunks;
    const storyContext = chunks.map((c, i) => `[Part ${i+1}]:\n${c.text}`).join('\n\n');
    const endChunk    = { text: '', hint: 'END', partNum: chunks.length + 1, isEnd: true, streaming: true };

    setStoryChunks([...chunks, endChunk]);

    try {
      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       'openai/gpt-4o-mini',
          messages: [
            { role: 'system',  content: 'You are a Hindi horror story writer. Write ONLY in Hindi Devanagari script.' },
            { role: 'user',    content: `यह कहानी है:\n\n${storyContext}\n\nअब इस कहानी का एक powerful, scary ending हिंदी देवनागरी में लिखो। 100-120 words। \"समाप्त\" से खत्म करो।` },
          ],
          max_tokens:  500,
          temperature: 0.85,
          stream:      true,
        }),
      });

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') break;
          try {
            const json  = JSON.parse(d);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              setStoryChunks(prev => {
                const upd = [...prev];
                upd[upd.length-1] = { ...upd[upd.length-1], text: fullText };
                return upd;
              });
            }
          } catch {}
        }
      }

      const finalChunks = [...chunks, { text: fullText.trim(), hint: 'END', partNum: chunks.length + 1, isEnd: true }];
      setStoryChunks(finalChunks);
      setStoryEnded(true);
      setShowEndBanner(true);
      saveState({ storyChunks: finalChunks, storyEnded: true });

      // Save episode
      const ep = {
        id:          currentEpId || Date.now().toString(),
        title,
        season,
        epNum,
        storyChunks: finalChunks,
        wordCount:   finalChunks.reduce((a,c) => a + c.text.split(/\s+/).length, 0),
        ended:       true,
        savedAt:     Date.now(),
        prompt:      stateRef.current.prompt || '',
      };
      import('../../lib/firebase').then(({ db_saveEpisode }) => db_saveEpisode(user.uid, ep));
      toast('✅ Episode save ho gaya!');
    } catch {}

    isGeneratingRef.current = false;
    setIsGenerating(false);
    scrollToBottom();
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (storyAreaRef.current) {
        storyAreaRef.current.scrollTop = storyAreaRef.current.scrollHeight;
      }
    }, 50);
  }

  const TARGET_WORDS = 1500;
  const wcPct = Math.min(100, (wordCount / TARGET_WORDS) * 100);

  // ── RENDER ────────────────────────────────────────
  return (
    <>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />

      {/* ── SETUP SCREEN ── */}
      {screen === 'setup' && (
        <div className="page-content" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(120,0,0,0.25) 0%, transparent 60%), var(--void)', overflowY: 'auto' }}>
          <div className="mini-topbar">
            <button className="hamburger-btn" onClick={() => setDrawerOpen(true)}>☰</button>
            <span className="mini-topbar-title">💀 KAALI RAAT</span>
            <div style={{ width: 36 }} />
          </div>

          <div className="setup-scroll-body">
            <div className="setup-card">

              {/* Channel pill */}
              <div className="sg-channel-pill">
  <div className="sg-channel-pill-left" style={{ display:'flex', alignItems:'center', gap:8 }}>
    {channelThumbnail
      ? <img src={channelThumbnail} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }} />
      : <span style={{ width:28, height:28, borderRadius:'50%', background:'#220000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📺</span>
    }
    {/* YouTube logo */}
    <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
      <path d="M17.6 2.0C17.4 1.3 16.8 0.7 16.1 0.5C14.7 0 9 0 9 0C9 0 3.3 0 1.9 0.5C1.2 0.7 0.6 1.3 0.4 2.0C0 3.4 0 6.5 0 6.5C0 6.5 0 9.6 0.4 11.0C0.6 11.7 1.2 12.3 1.9 12.5C3.3 13 9 13 9 13C9 13 14.7 13 16.1 12.5C16.8 12.3 17.4 11.7 17.6 11.0C18 9.6 18 6.5 18 6.5C18 6.5 18 3.4 17.6 2.0Z" fill="#FF0000"/>
      <path d="M7 9.5L12 6.5L7 3.5V9.5Z" fill="white"/>
    </svg>
  </div>
  <span style={{ fontSize:12, color:'#ccc', fontWeight:600 }}>
    {channelName || 'Fetching...'}
  </span>
</div>

              {/* Studio card */}
              <div className="sg-studio-card">
                <div className="sg-label">GENRE / SETTING</div>
                <div className="sg-genre-grid">
                  {GENRES.map(g => (
                    <div
                      key={g.key}
                      className={`sg-chip${selectedGenre === g.key ? ' active' : ''}`}
                      onClick={() => setSelectedGenre(g.key)}
                    >
                      {g.label}
                    </div>
                  ))}
                </div>

                <div className="sg-divider-line" />

                {titlePreview && (
                  <div className="sg-title-box">
                    <div className="sg-title-tag">STORY TITLE</div>
                    <div className="sg-title-main">{titlePreview}</div>
                  </div>
                )}

                {showWarning && (
                  <div style={{ background:'rgba(180,0,0,0.12)', border:'1px solid #440000', borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>⚠️</div>
                    <div style={{ fontSize:13, color:'#ff6666', fontWeight:700, marginBottom:4 }}>Pehle Story Upload Karo</div>
                    <div style={{ fontSize:11, color:'#884444', marginBottom:10 }}>Last generated episode YouTube pe upload nahi hua.</div>
                    <button onClick={() => router.push('/my-stories')} style={{ background:'rgba(200,0,0,0.2)', border:'1px solid #660000', color:'#ff4444', fontSize:12, padding:'8px 16px', borderRadius:8, cursor:'pointer', width:'100%' }}>
                      📺 My Stories mein dekho →
                    </button>
                  </div>
                )}

                <button
                  className="sg-gen-btn"
                  onClick={generateAiStoryIdea}
                  disabled={genState === 'checking' || genState === 'generating'}
                >
                  {genState === 'checking'   && <><div className="spinner" /> Check ho raha hai...</>}
                  {genState === 'generating' && <><div className="spinner" /> Soch raha hai...</>}
                  {(genState === 'idle' || genState === 'done') && <><span className="sg-gen-icon">✦</span> {genState === 'done' ? '🔄 Dobara Generate Karo' : 'Generate Story Idea'}</>}
                </button>

                {showStart && (
                  <button className="sg-start-btn" onClick={startStudio}>
                    ▶ &nbsp;Episode Shuru Karo
                  </button>
                )}
              </div>

              {/* Resume banner if story exists */}
              {storyChunks.length > 0 && (
                <div style={{ background:'#0a0000', border:'1px solid #330000', borderRadius:10, padding:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:11, color:'#880000', fontWeight:700 }}>{season} · {epNum}</div>
                    <div style={{ fontSize:13, color:'#ddd', marginTop:3 }}>{title || 'Untitled'}</div>
                    <div style={{ fontSize:11, color:'#444', marginTop:2 }}>{wordCount} words</div>
                  </div>
                  <button onClick={() => setScreen('story')} className="btn btn-ghost" style={{ fontSize:12, padding:'8px 14px' }}>
                    ▶ Continue
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── STORY SCREEN ── */}
      {screen === 'story' && (
        <div className="page-content" style={{ background: 'var(--void)' }}>
          {/* Topbar */}
          <div className="topbar">
            <button className="btn btn-icon" onClick={() => setDrawerOpen(true)}>☰</button>
            <span className="topbar-logo">☠ KAALI RAAT</span>
            <span className="topbar-ep">{season} · {epNum}</span>
            <div className="topbar-actions">
              <button className="btn btn-icon" onClick={() => router.push('/youtube')}>🎬</button>
              <button className="btn btn-icon" onClick={() => setScreen('setup')}>🏠</button>
            </div>
          </div>

          {/* Story area */}
          <div className="story-area" ref={storyAreaRef}>
            {storyChunks.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'#333', fontSize:13 }}>
                Neeche "Continue Karo" dabao — AI story likhna shuru karega...
              </div>
            )}
            {storyChunks.map((chunk, idx) => (
              <div key={idx} className="story-chunk">
                <div className="chunk-meta">
                  <span>{chunk.isEnd ? '🩸' : '📖'}</span>
                  <span style={{ fontSize:10, color:'var(--blood)', fontWeight:700, letterSpacing:1 }}>
                    {chunk.isEnd ? 'THE END' : `EP ${String(epNum.match(/\d+/)?.[0]||1).padStart(2,'0')} · PART ${chunk.partNum || idx+1}`}
                  </span>
                </div>
                <div className="chunk-text">{chunk.text}{chunk.streaming && !chunk.text && <span className="cursor-blink"/>}</div>
              </div>
            ))}

            {/* End banner */}
            {showEndBanner && (
              <div className="end-banner show" style={{ margin:'0 0 16px' }}>
                <div className="end-banner-title">🩸 The End 🩸</div>
                <div className="end-banner-sub">{season} · {epNum} complete!</div>
                <div className="btn-row" style={{ flexWrap:'wrap', gap:8 }}>
                  <button className="btn btn-primary" onClick={() => router.push('/youtube')} style={{ background:'linear-gradient(135deg,#cc0000,#880000)', border:'none', width:'100%' }}>
                    ▶ YouTube Export
                  </button>
                  <button className="btn btn-ghost" onClick={() => router.push('/my-stories')}>📚 My Stories</button>
                </div>
              </div>
            )}
          </div>

          {/* Word count */}
          <div style={{ padding:'0 16px 4px', background:'var(--panel)', borderTop:'1px solid var(--border)' }}>
            <div className="wordcount-bar">
              <span className="wc-label">{wordCount} words</span>
              <div className="wc-track"><div className="wc-fill" style={{ width: wcPct + '%' }} /></div>
              <span className="wc-label">/ ~{TARGET_WORDS}</span>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="bottom-bar">
            {/* Action chips */}
            <div className="action-chips">
              {[
                ['😱 Tension Badhao',  'Aur tension badhao, kuch bura hone wala hai'],
                ['👻 Creepy Turn',     'Ek creepy turn aao story mein'],
                ['👤 Character',       'Character ko aur describe karo'],
                ['🌑 Dark Karo',       'Scene ka atmosphere aur dark karo'],
                ['💬 Dialog',          'Dialog likhao characters ke beech'],
                ['⚡ Twist!',          'Ek shocking revelation aao'],
              ].map(([label, hint]) => (
                <div key={label} className="action-chip" onClick={() => setPromptHint(hint)}>{label}</div>
              ))}
              <div className="action-chip" style={{ borderColor:'#550000', color:'#cc4444' }} onClick={endStoryNow}>🔚 Story End Karo</div>
            </div>

            {/* Prompt input */}
            <div className="prompt-row">
              <textarea
                className="prompt-input"
                placeholder="Kuch direction do (optional)... ya khali chhodo"
                rows={1}
                value={promptHint}
                onChange={e => setPromptHint(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendContinue(); }}}
              />
              <button className="send-btn" onClick={() => sendContinue()} disabled={isGenerating || storyEnded}>▶</button>
            </div>

            {/* Continue button */}
            <button
              className={`continue-btn${isGenerating ? ' loading' : ''}`}
              onClick={() => sendContinue()}
              disabled={isGenerating || storyEnded}
            >
              {isGenerating
                ? <><div className="spinner" /><span>Likh raha hai...</span></>
                : storyEnded
                  ? '✅ Story Khatam'
                  : <span>📖 Continue Karo</span>
              }
            </button>
          </div>
        </div>
      )}

      <BottomNav userInitial={initial} />
    </>
  );
}

// ── Page export with auth wrapper ──────────────────
export default function GeneratePageWrapper() {
  return (
    <ToastProvider>
      <AuthWrapper>
        {({ user }) => <GeneratePage user={user} />}
      </AuthWrapper>
    </ToastProvider>
  );
}
