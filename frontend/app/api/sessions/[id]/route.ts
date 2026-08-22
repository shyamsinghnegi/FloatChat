export const dynamic = 'force-dynamic';

// Falls back to 127.0.0.1 (not localhost) to avoid the Node IPv6 localhost bug
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = new URL(request.url).searchParams.get('client_id') ?? '';
    const response = await fetch(`${BACKEND_URL}/sessions/${id}?client_id=${encodeURIComponent(clientId)}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return Response.json({ error: 'Session not found' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching session:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = new URL(request.url).searchParams.get('client_id') ?? '';
    const response = await fetch(`${BACKEND_URL}/sessions/${id}?client_id=${encodeURIComponent(clientId)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      return Response.json({ error: 'Failed to delete session' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error deleting session:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
