export async function POST(request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'API key not configured on server' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const bodyWithoutStream = { ...body, stream: false };

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
      // Simulate SSE so frontend streaming code works unchanged
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
        headers: {
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache',
        }
      });
    }

    return Response.json(data);

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
