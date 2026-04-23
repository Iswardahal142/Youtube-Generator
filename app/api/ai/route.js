export async function POST(request) {
  try {
    const body = await request.json();
    return handleOpenRouter(body);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function handleOpenRouter(body) {
  // Saari keys collect karo env se
  const keys = [
    process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_API_KEY_2,
    process.env.OPENROUTER_API_KEY_3,
    process.env.OPENROUTER_API_KEY_4,
    process.env.OPENROUTER_API_KEY_5,
  ].filter(Boolean); // undefined/empty hata do

  if (!keys.length) {
    return Response.json({ error: 'No API keys configured' }, { status: 500 });
  }

  const bodyToSend = { ...body, stream: false };
  delete bodyToSend.provider;

  // Har key try karo — 429/error pe next
  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    try {
      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer':  'https://kaali-raat.vercel.app',
          'X-Title':       'Kaali Raat Studio',
        },
        body: JSON.stringify(bodyToSend),
      });

      // 429 ya 5xx pe next key try karo
      if (upstream.status === 429 || upstream.status >= 500) {
        console.log(`Key ${i + 1} failed (${upstream.status}), trying next...`);
        continue;
      }

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

    } catch (err) {
      console.log(`Key ${i + 1} threw error: ${err.message}, trying next...`);
      continue;
    }
  }

  // Saari keys fail ho gayi
  return Response.json({ error: 'All API keys exhausted or rate limited' }, { status: 429 });
}
