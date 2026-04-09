import React from 'react';
import { motion } from 'motion/react';
import { Cpu, Globe, Activity, CheckCircle2, Play, Info, Settings, Zap, ArrowRight, XCircle, Layers, Database, Network, Search, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function ArchitectureTab() {
  const layers = [
    {
      title: "Transporte",
      icon: <Globe className="w-5 h-5" />,
      color: "blue",
      items: [
        { name: "HTTP/2 & Pipeline", desc: "Multiplexação de requisições." },
        { name: "Radar Heurístico", desc: "Rotação dinâmica de UA." },
        { name: "Early Abort", desc: "Corte imediato pós-captura." }
      ]
    },
    {
      title: "Parsing (Nexus)",
      icon: <Cpu className="w-5 h-5" />,
      color: "emerald",
      items: [
        { name: "SAX Stream", desc: "Processamento em tempo real." },
        { name: "Zero-AST", desc: "Extração sem árvore DOM." },
        { name: "Sanitização", desc: "Normalização em buffer." }
      ]
    },
    {
      title: "Cache & Opt",
      icon: <Zap className="w-5 h-5" />,
      color: "indigo",
      items: [
        { name: "Cache SWR", desc: "Entrega instantânea." },
        { name: "Warm Start", desc: "Pré-aquecimento de conexões." },
        { name: "Backoff", desc: "Retentativas inteligentes." }
      ]
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 pb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display text-white">Arquitetura Nexus</h2>
          <p className="text-slate-400 mt-1 text-sm font-light">Infraestrutura de alto desempenho v9.0-Ultra.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl backdrop-blur-md">
          <Cpu className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Engine v9.0</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {layers.map((layer, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-dark border border-white/5 rounded-3xl p-6 card-hover flex flex-col"
          >
            <div className={cn(
              "w-10 h-10 rounded-xl mb-4 flex items-center justify-center border shadow-sm",
              layer.color === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
              layer.color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
              "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
            )}>
              {layer.icon}
            </div>
            
            <h3 className="text-lg font-bold text-white font-display mb-4 tracking-tight">{layer.title}</h3>
            
            <div className="space-y-4 flex-1">
              {layer.items.map((item, j) => (
                <div key={j} className="group/item">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      "w-1 h-1 rounded-full",
                      layer.color === 'blue' ? "bg-blue-500" :
                      layer.color === 'emerald' ? "bg-emerald-500" :
                      "bg-indigo-500"
                    )} />
                    <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider group-hover/item:text-white transition-colors">{item.name}</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-tight pl-3 border-l border-slate-800 group-hover/item:border-slate-600 transition-colors">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-dark border border-white/5 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white font-display tracking-tight">Nexus Ultra vs Legado</h3>
            <p className="text-slate-500 text-xs">Evolução técnica do motor.</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
            +850% Performance
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5">
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Característica</th>
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Legado</th>
                <th className="pb-3 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Nexus Ultra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { feature: "Parsing", old: "DOM (Cheerio)", new: "SAX (htmlparser2)", highlight: true },
                { feature: "Memória", old: "O(n)", new: "O(1)", highlight: false },
                { feature: "Latência", old: "3.2s", new: "280ms", highlight: true },
                { feature: "Concorrência", old: "Sequencial", new: "Batching", highlight: false },
                { feature: "Early Abort", old: "Não", new: "Sim", highlight: true }
              ].map((row, i) => (
                <tr key={i} className="group hover:bg-white/5 transition-colors text-xs">
                  <td className="py-3 font-medium text-slate-400">{row.feature}</td>
                  <td className="py-3 text-slate-600 font-mono italic">{row.old}</td>
                  <td className={cn(
                    "py-3 font-bold font-mono",
                    row.highlight ? "text-blue-400" : "text-slate-300"
                  )}>
                    {row.new}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-dark border border-white/5 rounded-3xl p-6">
        <h3 className="text-xl font-bold font-display mb-6 text-white tracking-tight">Pipeline Nexus</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { step: 1, title: 'Invocação', desc: 'Verificação SWR e deduplicação.' },
            { step: 2, title: 'Orquestração', desc: 'Consulta multicanal paralela.' },
            { step: 3, title: 'Bypass', desc: 'Rotação de UA e headers.' },
            { step: 4, title: 'Radar', desc: 'Extração por âncoras semânticas.' },
            { step: 5, title: 'Normalização', desc: 'Limpeza e conversão de dados.' },
            { step: 6, title: 'Abort & Cache', desc: 'Corte TCP e TTL dinâmico.' },
          ].map((item) => (
            <div key={item.step} className="p-4 bg-slate-900/40 rounded-2xl border border-white/5 group hover:border-blue-500/20 transition-all flex items-center gap-4">
              <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                {item.step}
              </div>
              <div>
                <h4 className="font-bold text-slate-200 text-sm font-display group-hover:text-blue-400 transition-colors">{item.title}</h4>
                <p className="text-[10px] text-slate-500 leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
