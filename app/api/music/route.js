export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'horror dark suspense';

  try {
    const res = await fetch(
      `https://pixabay.com/api/music/?key=${process.env.PIXABAY_KEY}&q=${encodeURIComponent(q)}&per_page=8`
    );

    if (!res.ok) {
      return Response.json({ hits: [] }, { status: 200 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (e) {
    return Response.json({ hits: [] }, { status: 200 });
  }
}
