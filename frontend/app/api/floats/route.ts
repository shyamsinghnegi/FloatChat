export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/floats`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch floats from backend' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching floats:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
