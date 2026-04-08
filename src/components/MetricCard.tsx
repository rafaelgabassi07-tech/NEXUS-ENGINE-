import React, { ReactNode } from 'react';
import { cn } from '../lib/utils';

export function MetricCard({ title, value, trend, icon, description }: { title: string, value: string, trend: string, icon: ReactNode, description: string }) {
  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-sm card-hover relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-0" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 group-hover:bg-blue-900 group-hover:border-blue-800 transition-colors">
            {icon}
          </div>
          <span className={cn(
            "text-[10px] font-bold px-2 py-1 rounded-lg transition-all",
            trend.startsWith('+') && !title.includes('Tempo') ? "bg-emerald-900 text-emerald-400" : trend.startsWith('-') && title.includes('Tempo') ? "bg-emerald-900 text-emerald-400" : "bg-slate-800 text-slate-400"
          )}>
            {trend}
          </span>
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight font-display text-white">{value}</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 font-medium leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
