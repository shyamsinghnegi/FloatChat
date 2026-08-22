export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  table?: { columns: string[]; rows: any[][] };
  profileId?: string;
} 

export interface StatData {
  total_profiles: number;
  min_temp: number;
  max_temp: number;
  avg_temp: number;
  first_dive: string;
  latest_dive: string;
}

export interface ProfileMeta {
  profile_id: string;
  float_id: string;
  cycle_number: number;
  latitude: number;
  longitude: number;
  date: string;
}

export interface ProfileData {
  meta: ProfileMeta;
  readings: { pressure: number; temperature: number; salinity: number }[];
}

export interface FloatMeta {
  float_id: string;
  latest_profile_id: string;
  latitude: number;
  longitude: number;
  latest_date: string;
  number: number;
  region: string;
}

export interface FloatDive {
  profile_id: string;
  cycle_number: number;
  latitude: number;
  longitude: number;
  date: string;
  surface_temp: number | null;
  avg_temp: number | null;
  avg_salinity: number | null;
  max_depth: number | null;
}

export interface FloatData {
  float_id: string;
  number: number;
  region: string;
  dives: FloatDive[];
}

export interface RegionMeta {
  slug: string;
  name: string;
  float_count: number;
  latitude: number;
  longitude: number;
}