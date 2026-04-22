export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'horror background music no copyright';

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&maxResults=8&key=${process.env.YOUTUBE_API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error('[music] YouTube API error:', res.status);
      return Response.json({ hits: [] }, { status: 200 });
    }

    const data = await res.json();

    if (!data.items?.length) {
      return Response.json({ hits: [] }, { status: 200 });
    }

    const hits = data.items.map(item => ({
      id: item.id.videoId,
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.default?.url || '',
      youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    return Response.json({ hits });

  } catch (e) {
    console.error('[music] Error:', e.message);
    return Response.json({ hits: [] }, { status: 200 });
  }
}
