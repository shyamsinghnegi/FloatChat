import { StatData, ProfileMeta, ProfileData } from './types';

// Fast API direct base (used for endpoints we didn't proxy)
const FASTAPI_BASE = 'http://localhost:8000';

// Fetch via Next.js API Route Proxies
export async function fetchProfiles(): Promise<{ profiles: ProfileMeta[] }> {
  const res = await fetch('/api/profiles');
  if (!res.ok) throw new Error('Failed to fetch profiles');
  return res.json();
}

export async function fetchProfile(id: string): Promise<ProfileData> {
  const res = await fetch(`/api/profile/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch profile ${id}`);
  return res.json();
}

// Direct fetches to FastAPI for remaining endpoints
export async function fetchStats(): Promise<StatData> {
  const res = await fetch(`${FASTAPI_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function runEvaluation(): Promise<any> {
  const res = await fetch(`${FASTAPI_BASE}/eval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_path: "test_cases.json" })
  });
  if (!res.ok) throw new Error('Failed to run evaluation');
  return res.json();
}