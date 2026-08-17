export const dynamic = 'force-dynamic';

// Falls back to 127.0.0.1 (not localhost) to avoid the Node IPv6 localhost bug
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/stats`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch stats from backend' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
