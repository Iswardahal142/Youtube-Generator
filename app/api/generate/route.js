export async function POST(request) {
  const { prompt } = await request.json();
  if (!prompt) return Response.json({ error: 'Prompt required' }, { status: 400 });

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;

    const response = await fetch(url);
    if (!response.ok) {
      return Response.json({ error: 'Image generation failed' }, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type':  'image/jpeg',
        'Cache-Control': 'no-store',
      }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
