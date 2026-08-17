const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const response = await fetch(`${BACKEND_URL}/eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      return Response.json({ error: 'Failed to run evaluation' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error running evaluation:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
