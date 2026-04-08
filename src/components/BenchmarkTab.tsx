import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function BenchmarkTab() {
  const benchmarks = [
    { label: 'Alocação de Memória', legacy: 'DOM Completo', nexus: 'Buffer de Texto', improvement: 'Zero-AST', color: 'emerald' },
    { label: 'Parser HTML', legacy: 'Cheerio/JSDOM', nexus: 'SAX Stream', improvement: 'htmlparser2', color: 'blue' },
    { label: 'Processamento', legacy: 'Download Total', nexus: 'Early Abort', improvement: 'Interrompe ao achar', color: 'indigo' },
    { label: 'Concorrência', legacy: 'Sequencial', nexus: 'Promise.race', improvement: 'Lotes de 5', color: 'blue' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {benchmarks.map((item, i) => (
        <div key={i} className="glass border border-slate-800/50 p-6 rounded-3xl group hover:bg-slate-800/60 transition-all card-hover">
          <div className="flex justify-between items-start mb-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.label}</h4>
            <span className={cn(
              "text-[10px] font-bold px-2 py-1 rounded-lg border",
              item.color === 'blue' ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
              item.color === 'emerald' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
              "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
            )}>
              {item.improvement}
            </span>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Legado</span>
              <span className="text-xs font-mono font-bold text-slate-400">{item.legacy}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-blue-900/10 rounded-xl border border-blue-500/20">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Nexus</span>
              <span className="text-xs font-mono font-bold text-blue-400">{item.nexus}</span>
            </div>
          </div>
          
          <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Diferença Arquitetural</span>
          </div>
        </div>
      ))}
    </div>
  );
}
