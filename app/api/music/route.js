export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'horror dark suspense';

  try {
    // Pixabay Music API
    const url = `https://pixabay.com/api/music/?key=${process.env.PIXABAY_KEY}&q=${encodeURIComponent(q)}&per_page=8`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error('[music] Pixabay response not ok:', res.status, res.statusText);
      return Response.json({ hits: [], error: `HTTP ${res.status}` }, { status: 200 });
    }

    const text = await res.text();
    console.log('[music] Raw response:', text.slice(0, 300));

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('[music] JSON parse failed:', text.slice(0, 300));
      return Response.json({ hits: [], error: 'parse_failed' }, { status: 200 });
    }

    // Pixabay music API returns { totalHits, hits: [...] }
    if (data.hits?.length) {
      return Response.json(data);
    }

    // If hits empty, try with broader query
    const fallbackUrl = `https://pixabay.com/api/music/?key=${process.env.PIXABAY_KEY}&q=dark+ambient&per_page=8`;
    const fallbackRes = await fetch(fallbackUrl);
    const fallbackData = await fallbackRes.json();

    if (fallbackData.hits?.length) {
      return Response.json(fallbackData);
    }

    console.warn('[music] No hits found for query:', q);
    return Response.json({ hits: [], error: 'no_results' }, { status: 200 });

  } catch (e) {
    console.error('[music] Error:', e.message);
    return Response.json({ hits: [], error: e.message }, { status: 200 });
  }
}
