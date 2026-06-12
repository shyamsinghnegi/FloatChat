// frontend/app/api/profile/[id]/route.ts

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  // 1. Update the type to indicate params is a Promise
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    // 2. Await the params to unwrap them
    const resolvedParams = await params;
    const profileId = resolvedParams.id;

    // 3. Use the unwrapped ID (and ensure we use 127.0.0.1)
    const response = await fetch(`http://127.0.0.1:8000/profile/${profileId}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return Response.json({ error: 'Profile not found' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error(`Error fetching profile:`, error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}