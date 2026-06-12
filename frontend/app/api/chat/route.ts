export async function POST(req: Request) {
  const body = await req.json();

  // Proxy the request to the FastAPI backend
  const response = await fetch('http://localhost:8000/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Return the streamed response directly to the client
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}