import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon?: LucideIcon;
  accent?: 'blue' | 'cyan' | 'green' | 'indigo';
}

const accentClass: Record<string, string> = {
  blue:   'stat-accent-blue',
  cyan:   'stat-accent-cyan',
  green:  'stat-accent-green',
  indigo: 'stat-accent-indigo',
};

const iconBg: Record<string, string> = {
  blue:   'bg-sky-50 text-sky-600',
  cyan:   'bg-cyan-50 text-cyan-600',
  green:  'bg-emerald-50 text-emerald-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};

export default function StatCard({ title, value, subtitle, icon: Icon, accent = 'blue' }: StatCardProps) {
  return (
    <div className={`card card-hover p-5 ${accentClass[accent]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
          <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
          <p className="text-xs text-slate-400 mt-1.5 leading-snug">{subtitle}</p>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${iconBg[accent]} shrink-0 ml-3`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
