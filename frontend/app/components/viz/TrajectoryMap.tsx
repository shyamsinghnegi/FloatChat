'use client';

import { useRouter } from 'next/navigation';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis, ResponsiveContainer } from 'recharts';
import type { ProfileMeta } from '@/app/lib/types';

export default function TrajectoryMap({ profiles }: { profiles: ProfileMeta[] }) {
  const router = useRouter();

  return (
    <div className="h-[500px] w-full bg-slate-50 rounded-xl border border-slate-100 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" dataKey="longitude" name="Longitude" domain={['auto', 'auto']} tickFormatter={val => `${val.toFixed(2)}°E`} />
          <YAxis type="number" dataKey="latitude" name="Latitude" domain={['auto', 'auto']} tickFormatter={val => `${val.toFixed(2)}°N`} />
          <ZAxis type="category" dataKey="profile_id" name="ID" />
          <Tooltip 
            cursor={{strokeDasharray: '3 3'}} 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-sm">
                    <p className="font-bold text-blue-400 mb-1">{data.profile_id}</p>
                    <p>Lat: {data.latitude.toFixed(4)}</p>
                    <p>Lon: {data.longitude.toFixed(4)}</p>
                    <p className="text-slate-400 mt-1">{data.date}</p>
                  </div>
                );
              }
              return null;
            }} 
          />
          <Scatter 
            name="Float Path" 
            data={profiles} 
            fill="#2563eb" 
            line={{ stroke: '#3b82f6', strokeWidth: 2 }} 
            onClick={(e: any) => {
              if(e?.profile_id) router.push(`/profile/${e.profile_id}`);
            }}
            className="cursor-pointer"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}