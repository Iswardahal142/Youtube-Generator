export const revalidate = 300; // 5 min cache

export async function GET() {
  const apiKey    = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey)    return Response.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 });
  if (!channelId) return Response.json({ error: 'YOUTUBE_CHANNEL_ID not set' }, { status: 500 });

  try {
    // Step 1: Channel uploads playlist + name
    const channelRes  = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelRes.json();

    if (!channelData.items?.length) {
      return Response.json({ error: 'Channel not found.' }, { status: 404 });
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
    const channelName       = channelData.items[0].snippet?.title || '';

    // Step 2: Last 20 videos
    const playlistRes  = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=20&key=${apiKey}`
    );
    const playlistData = await playlistRes.json();

    if (!playlistData.items?.length) {
      return Response.json({ channelName, videos: [], lastVideo: null });
    }

    // Step 3: Stats
    const videoIds = playlistData.items.map(item => item.contentDetails.videoId).join(',');
    const statsRes  = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`
    );
    const statsData = await statsRes.json();

    const videos = statsData.items.map(v => ({
      videoId:     v.id,
      title:       v.snippet.title,
      description: v.snippet.description,
      thumbnail:   v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
      publishedAt: v.snippet.publishedAt,
      viewCount:   parseInt(v.statistics.viewCount  || '0'),
      likeCount:   parseInt(v.statistics.likeCount  || '0'),
    }));

    return Response.json({ channelName, videos, lastVideo: videos[0] || null });

  } catch (err) {
    return Response.json({ error: err.message || 'YouTube API call failed' }, { status: 500 });
  }
}
