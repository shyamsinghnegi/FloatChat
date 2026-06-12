'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { pressure: number; temperature: number; salinity: number }[];
}

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  fontSize: '12px',
  fontFamily: 'monospace',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
};

function Chart({ data, dataKey, color, xLabel }: { data: any[]; dataKey: string; color: string; xLabel: string }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{xLabel}</p>
      <div style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal stroke="#f0f0f0" vertical={false} />
            <XAxis
              type="number" dataKey={dataKey} domain={['auto', 'auto']}
              stroke="#d1d5db" tick={{ fontSize: 11, fill: '#9ca3af' }}
              label={{ value: xLabel, position: 'insideBottom', offset: -16, fontSize: 11, fill: '#9ca3af' }}
            />
            <YAxis
              type="number" dataKey="pressure" reversed domain={['auto', 'auto']}
              stroke="#d1d5db" tick={{ fontSize: 11, fill: '#9ca3af' }}
              label={{ value: 'Pressure (dbar)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 11, fill: '#9ca3af' }}
            />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `${v} dbar`} />
            <Line
              type="monotoneX" dataKey={dataKey}
              stroke={color} strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DepthProfile({ data }: Props) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ border: '1px solid var(--border)', background: '#fff' }}
    >
      <h2 className="text-sm font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Depth Profiles</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Chart data={data} dataKey="temperature" color="#0ea5e9" xLabel="Temperature (°C)" />
        <Chart data={data} dataKey="salinity"    color="#10b981" xLabel="Salinity (PSU)"   />
      </div>
    </div>
  );
}
