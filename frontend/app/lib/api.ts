import { StatData, ProfileMeta, ProfileData, FloatMeta, FloatData, RegionMeta } from './types';

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

export async function fetchFloats(): Promise<{ floats: FloatMeta[] }> {
  const res = await fetch('/api/floats');
  if (!res.ok) throw new Error('Failed to fetch floats');
  return res.json();
}

export async function fetchFloat(id: string): Promise<FloatData> {
  const res = await fetch(`/api/float/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch float ${id}`);
  return res.json();
}

export async function fetchRegions(): Promise<{ regions: RegionMeta[] }> {
  const res = await fetch('/api/regions');
  if (!res.ok) throw new Error('Failed to fetch regions');
  return res.json();
}