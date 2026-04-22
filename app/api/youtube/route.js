export const revalidate = 300;

export async function GET() {
  const apiKey    = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey)    return Response.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 });
  if (!channelId) return Response.json({ error: 'YOUTUBE_CHANNEL_ID not set' }, { status: 500 });

  try {
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet,statistics&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelRes.json();

    if (!channelData.items?.length) {
      return Response.json({ error: 'Channel not found.' }, { status: 404 });
    }

    const channel = channelData.items[0];

    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
    const channelName       = channel.snippet?.title || '';
    const channelThumb      = channel.snippet?.thumbnails?.default?.url || '';
    const subscriberCount   = channel.statistics?.subscriberCount || '0';
    const videoCount        = channel.statistics?.videoCount || '0';

    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=20&key=${apiKey}`
    );
    const playlistData = await playlistRes.json();

    const videoIds = playlistData.items?.map(item => item.contentDetails.videoId).join(',') || '';

    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`
    );
    const statsData = await statsRes.json();

    const videos = statsData.items?.map(v => ({
      videoId: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
      thumbnail: v.snippet.thumbnails?.medium?.url || '',
      publishedAt: v.snippet.publishedAt,
      viewCount: parseInt(v.statistics.viewCount || '0'),
      likeCount: parseInt(v.statistics.likeCount || '0'),
    })) || [];

    return Response.json({
      channelName,
      channelThumb,
      subscriberCount,
      videoCount,
      videos,
      lastVideo: videos[0] || null
    });

  } catch (err) {
    return Response.json({ error: err.message || 'YouTube API call failed' }, { status: 500 });
  }
}
