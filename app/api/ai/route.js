export async function POST(request) {
  try {
    const body = await request.json();
    const provider = body.provider || 'openrouter'; // SideDrawer se aata hai, default openrouter

    if (provider === 'gemini') {
      return handleGemini(body);
    } else {
      return handleOpenRouter(body);
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ── OpenRouter — tera purana code as-is ──
async function handleOpenRouter(body) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'API key not configured on server' }, { status: 500 });
  }

  const bodyWithoutStream = { ...body, stream: false };
  delete bodyWithoutStream.provider; // Gemini/OpenRouter field OpenRouter ko nahi bhejna

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://kaali-raat.vercel.app',
      'X-Title':       'Kaali Raat Studio',
    },
    body: JSON.stringify(bodyWithoutStream),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    return Response.json(data, { status: upstream.status });
  }

  const content = data.choices?.[0]?.message?.content || '';

  if (body?.stream) {
    const sseChunk = JSON.stringify({
      choices: [{ delta: { content }, finish_reason: null }]
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${sseChunk}\n\n`));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
    });
  }

  return Response.json(data);
}

// ── Gemini — same structure, same response format ──
async function handleGemini(body) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY not configured on server' }, { status: 500 });
  }

  // OpenAI messages → Gemini format
  const systemMsg = (body.messages || []).find(m => m.role === 'system');
  const otherMsgs = (body.messages || []).filter(m => m.role !== 'system');

  const contents = otherMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const geminiBody = {
    contents,
    ...(systemMsg && { system_instruction: { parts: [{ text: systemMsg.content }] } }),
    generationConfig: {
      maxOutputTokens: body.max_tokens || 1000,
      temperature: body.temperature ?? 0.9,
    },
  };

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
  );

  const data = await upstream.json();

  if (!upstream.ok) {
    return Response.json(data, { status: upstream.status });
  }

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // OpenAI format mein wrap — frontend ka koi code nahi todega
  const openAiFormat = {
    choices: [{ message: { content }, finish_reason: 'stop' }]
  };

  if (body?.stream) {
    // Purane OpenRouter wala SSE simulate karo — same as before
    const sseChunk = JSON.stringify({
      choices: [{ delta: { content }, finish_reason: null }]
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${sseChunk}\n\n`));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
    });
  }

  return Response.json(openAiFormat);
}
