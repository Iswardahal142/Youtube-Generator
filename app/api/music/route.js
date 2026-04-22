export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'horror ambient dark';

  try {
    const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&token=${process.env.FREESOUND_KEY}&format=json&fields=id,name,previews,duration,username,tags&page_size=8&filter=duration:[5+TO+300]`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error('[music] Freesound error:', res.status);
      return Response.json({ hits: [] }, { status: 200 });
    }

    const data = await res.json();

    if (!data.results?.length) {
      return Response.json({ hits: [] }, { status: 200 });
    }

    const hits = data.results.map(item => ({
      id: String(item.id),
      title: item.name,
      channel: item.username,
      duration: Math.round(item.duration),
      audio: item.previews?.['preview-hq-mp3'] || item.previews?.['preview-lq-mp3'] || '',
      tags: (item.tags || []).slice(0, 3).join(', '),
    }));

    return Response.json({ hits });

  } catch (e) {
    console.error('[music] Error:', e.message);
    return Response.json({ hits: [] }, { status: 200 });
  }
}
