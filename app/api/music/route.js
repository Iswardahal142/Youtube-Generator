// app/api/youtube-music/route.js

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'horror ambient background music no copyright';

  try {
    // Step 1: Search videos
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&maxResults=8&key=${process.env.YOUTUBE_API_KEY}`;
    const searchRes = await fetch(searchUrl);

    if (!searchRes.ok) {
      console.error('[youtube-music] Search error:', searchRes.status);
      return Response.json({ videos: [] });
    }

    const searchData = await searchRes.json();

    if (!searchData.items?.length) {
      return Response.json({ videos: [] });
    }

    // Step 2: Get view counts
    const ids = searchData.items.map(i => i.id.videoId).join(',');
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${process.env.YOUTUBE_API_KEY}`
    );
    const statsData = await statsRes.json();
    const statsMap = {};
    (statsData.items || []).forEach(v => {
      statsMap[v.id] = parseInt(v.statistics?.viewCount || 0);
    });

    const videos = searchData.items.map(item => ({
      videoId:      item.id.videoId,
      title:        item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail:    item.snippet.thumbnails?.default?.url || '',
      viewCount:    statsMap[item.id.videoId] || 0,
    }));

    return Response.json({ videos });

  } catch (e) {
    console.error('[youtube-music] Error:', e.message);
    return Response.json({ videos: [] });
  }
}
