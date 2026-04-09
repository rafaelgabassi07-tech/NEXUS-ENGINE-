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
      setMessage({ text: 'Sinal de limpeza enviado com sucesso!', type: 'success' });
    } catch (e) {
      setMessage({ text: 'Falha ao comunicar com a API.', type: 'error' });
    } finally {
      setClearing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-12 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter font-display text-white">Configurações do Motor</h2>
          <p className="text-slate-400 mt-3 max-w-2xl text-lg font-light">Visão geral dos parâmetros hardcoded e arquitetura Serverless do Nexus Engine 9.0-Ultra.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col items-end px-3 border-r border-white/10">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ambiente</span>
            <span className="text-sm font-mono font-bold text-blue-400">Serverless (Vercel)</span>
          </div>
          <div className="flex flex-col items-end px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado</span>
            <span className="text-sm font-mono font-bold text-emerald-400">Stateless</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Performance Section */}
        <div className="glass-dark border border-white/5 rounded-4xl p-8 card-shadow technical-border">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
              <Cpu className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-white font-display tracking-tight">Performance & Concorrência</h3>
          </div>

          <div className="space-y-8">
            <div className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 group hover:border-blue-500/30 transition-all">
              <h4 className="text-lg font-bold font-display mb-2 text-white group-hover:text-blue-400 transition-colors">Limite de Concorrência (Batch)</h4>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">O motor processa lotes com limite dinâmico de até 5 requisições simultâneas para otimização de memória.</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400 text-xs font-bold font-mono">
                5 reqs/lote
              </div>
            </div>

            <div className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 group hover:border-emerald-500/30 transition-all">
              <h4 className="text-lg font-bold font-display mb-2 text-white group-hover:text-emerald-400 transition-colors">Gerenciamento de Memória</h4>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">Utiliza cache LRU com Stale-While-Revalidate para respostas em micro-segundos.</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                Cache SWR Ativado
              </div>
            </div>
          </div>
        </div>

        {/* Network Section */}
        <div className="glass-dark border border-white/5 rounded-4xl p-8 card-shadow technical-border">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-white font-display tracking-tight">Rede & Resiliência</h3>
          </div>

          <div className="space-y-8">
            <div className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 group hover:border-indigo-500/30 transition-all">
              <h4 className="text-lg font-bold font-display mb-2 text-white group-hover:text-indigo-400 transition-colors">Rotação de User-Agent</h4>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">Alternância automática entre User-Agents modernos para mitigar bloqueios por fingerprinting.</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400 text-xs font-bold font-mono">
                Ativado (Hardcoded)
              </div>
            </div>

            <div className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 group hover:border-blue-500/30 transition-all">
              <h4 className="text-lg font-bold font-display mb-2 text-white group-hover:text-blue-400 transition-colors">Tentativas (Retries)</h4>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">Backoff Exponencial automático em caso de falhas temporárias de rede.</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400 text-xs font-bold font-mono">
                2 Tentativas (800ms)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Section */}
      <div className="glass-dark border border-white/5 rounded-4xl p-10 card-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <h3 className="text-3xl font-bold text-white font-display tracking-tight mb-4">Limpeza de Estado Edge</h3>
            <p className="text-slate-400 text-lg font-light leading-relaxed">
              Envia um sinal para a API limpar qualquer resquício de estado em memória. Útil caso algum cache em nível de CDN ou Edge esteja retendo respostas antigas.
            </p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="w-full sm:w-auto px-10 py-5 bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600/20 font-bold rounded-2xl transition-all text-lg disabled:opacity-50 active:scale-95 flex items-center justify-center gap-4 shadow-2xl shadow-red-900/20 group"
            >
              <Trash2 className={cn("w-6 h-6 group-hover:rotate-12 transition-transform", clearing && "animate-spin")} />
              {clearing ? 'Enviando Sinal...' : 'Forçar Limpeza Edge'}
            </button>
            {message && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "px-6 py-2 rounded-xl border text-sm font-bold uppercase tracking-widest shadow-lg",
                  message.type === 'success' ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-red-400 bg-red-400/10 border-red-400/20"
                )}
              >
                {message.text}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* System Info Grid */}
      <div className="glass-dark border border-white/5 rounded-4xl p-10 card-shadow">
        <div className="flex items-center gap-4 mb-12">
          <Globe className="w-8 h-8 text-slate-500" />
          <h3 className="text-3xl font-bold text-white font-display tracking-tight">Informações do Ambiente</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {[
            { label: 'Versão Engine', value: 'v9.0.0-ultra', color: 'blue' },
            { label: 'Runtime', value: 'Node.js 20.x', color: 'blue' },
            { label: 'Infraestrutura', value: 'Vercel Edge/Serverless', color: 'emerald' },
            { label: 'Cliente HTTP', value: 'Native Fetch API', color: 'blue' }
          ].map((info, i) => (
            <div key={i} className="space-y-3">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{info.label}</p>
              <p className={cn(
                "font-mono text-xl font-bold",
                info.color === 'blue' ? "text-blue-400" : "text-emerald-400"
              )}>{info.value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

