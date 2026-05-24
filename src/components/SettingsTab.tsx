import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Cpu, Trash2, Activity, Settings, Globe, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export function SettingsTab() {
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleClearCache = async () => {
    setClearing(true);
    setMessage(null);
    try {
      await fetch('/api/clear-cache', { method: 'POST' });
      setMessage({ text: 'Sinal de limpeza enviado!', type: 'success' });
    } catch (e) {
      setMessage({ text: 'Falha na API.', type: 'error' });
    } finally {
      setClearing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-display text-white">Configurações</h2>
          <p className="text-slate-400 mt-1 text-xs font-light">Parâmetros do Nexus Engine 16.0.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-white/5 rounded-xl">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Stateless</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Performance Section */}
        <div className="glass-dark border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">Performance</h3>
          </div>
          
          <div className="space-y-3">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-blue-500/20 transition-all">
              <p className="text-xs font-bold text-slate-200">Limite de Concorrência</p>
              <p className="text-[10px] text-slate-500 mt-1">5 requisições simultâneas por lote.</p>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-emerald-500/20 transition-all">
              <p className="text-xs font-bold text-slate-200">Cache SWR</p>
              <p className="text-[10px] text-slate-500 mt-1">Stale-While-Revalidate ativado.</p>
            </div>
          </div>
        </div>

        {/* Network Section */}
        <div className="glass-dark border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">Rede</h3>
          </div>
          
          <div className="space-y-3">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-indigo-500/30 transition-all">
              <p className="text-xs font-bold text-slate-200">Rotação de UA</p>
              <p className="text-[10px] text-slate-500 mt-1">Alternância automática de fingerprint.</p>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all">
              <p className="text-xs font-bold text-slate-200">Tentativas (Retries)</p>
              <p className="text-[10px] text-slate-500 mt-1">2x com backoff de 800ms.</p>
            </div>
          </div>
        </div>

        {/* Maintenance Section */}
        <div className="glass-dark border border-white/5 rounded-2xl p-5 md:col-span-2 bg-red-500/5 border-red-500/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider mb-1">Limpeza Edge</h3>
              <p className="text-[10px] text-slate-400">Força a invalidação do cache em nível de CDN.</p>
            </div>
            <div className="flex items-center gap-3">
              {message && (
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest",
                  message.type === 'success' ? "text-emerald-400" : "text-red-400"
                )}>
                  {message.text}
                </span>
              )}
              <button
                onClick={handleClearCache}
                disabled={clearing}
                className="px-4 py-2 bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600/20 font-bold rounded-xl transition-all text-[10px] disabled:opacity-50 active:scale-95 flex items-center gap-2"
              >
                <Trash2 className={cn("w-3 h-3", clearing && "animate-spin")} />
                {clearing ? 'Limpando...' : 'Limpar Cache'}
              </button>
            </div>
          </div>
        </div>

        {/* System Info Grid */}
        <div className="glass-dark border border-white/5 rounded-2xl p-5 md:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Versão', value: 'v16.0' },
              { label: 'Runtime', value: 'Node 20.x' },
              { label: 'Infra', value: 'Vercel' },
              { label: 'Uptime', value: '99.98%' }
            ].map((info, i) => (
              <div key={i} className="space-y-1">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{info.label}</p>
                <p className="font-mono text-xs font-bold text-blue-400">{info.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

