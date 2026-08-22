export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetch(`${BACKEND_URL}/float/${id}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return Response.json({ error: 'Float not found' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching float:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
