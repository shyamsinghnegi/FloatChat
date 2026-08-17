import { StatData, ProfileMeta, ProfileData } from './types';

// All requests go through Next.js API Route Proxies, forwarded server-side to BACKEND_URL.
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

export async function fetchStats(): Promise<StatData> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function runEvaluation(): Promise<any> {
  const res = await fetch('/api/eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_path: "test_cases.json" })
  });
  if (!res.ok) throw new Error('Failed to run evaluation');
  return res.json();
}