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