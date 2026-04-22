// app/api/youtube-music/route.js

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'horror ambient background music';

  try {
    const url = `https://pixabay.com/api/music/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&per_page=10`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error('[pixabay-music] Error:', res.status);
      return Response.json({ videos: [] });
    }

    const data = await res.json();

    if (!data.hits?.length) {
      return Response.json({ videos: [] });
    }

    const videos = data.hits.map(track => ({
      videoId:      String(track.id),
      title:        track.tags || 'Untitled',
      channelTitle: track.user || 'Unknown Artist',
      thumbnail:    track.userImageURL || '',
      viewCount:    track.downloads || 0,
      audioUrl:     track.audio,        // ← direct MP3 link!
      duration:     track.duration || 0,
    }));

    return Response.json({ videos });

  } catch (e) {
    console.error('[pixabay-music] Error:', e.message);
    return Response.json({ videos: [] });
  }
}
