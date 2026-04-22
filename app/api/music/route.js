export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'horror dark suspense';
  const res = await fetch(`https://pixabay.com/api/videos/music/?key=${process.env.PIXABAY_KEY}&q=${encodeURIComponent(q)}&per_page=8`);
  const data = await res.json();
  return Response.json(data);
}
