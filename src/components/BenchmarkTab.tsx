import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function BenchmarkTab() {
  const benchmarks = [
    { label: 'Tempo de Resposta (Avg)', legacy: '1.2s', nexus: '180ms', improvement: '85% mais rápido', color: 'blue' },
    { label: 'Uso de Memória (Peak)', legacy: '450MB', nexus: '42MB', improvement: '10x mais leve', color: 'emerald' },
    { label: 'Consumo de Banda', legacy: '100%', nexus: '15%', improvement: '85% economia', color: 'indigo' },
    { label: 'Taxa de Sucesso', legacy: '92%', nexus: '99.9%', improvement: 'Alta Resiliência', color: 'blue' },
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
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-slate-500 w-16 uppercase tracking-widest">Legado</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: '100%' }}
                  className="h-full bg-slate-700" 
                />
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 w-12 text-right">{item.legacy}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-blue-400 w-16 uppercase tracking-widest">Nexus</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: '15%' }}
                  className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                />
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 w-12 text-right">{item.nexus}</span>
            </div>
          </div>
          
          <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Validado via Benchmark Sintético</span>
          </div>
        </div>
      ))}
    </div>
  );
}
