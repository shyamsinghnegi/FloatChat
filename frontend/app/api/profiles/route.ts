// frontend/app/api/profiles/route.ts

export const dynamic = 'force-dynamic';

// Notice this is "export async function GET", NOT "export default"
export async function GET() {
  try {
    // Make sure this points to 127.0.0.1 to avoid the Node IPv6 localhost bug
    const response = await fetch('http://127.0.0.1:8000/profiles', {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch profiles from backend' }, { status: response.status });
    }
    
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}