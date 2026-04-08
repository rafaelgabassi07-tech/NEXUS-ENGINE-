import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Cpu, Trash2, Activity, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

export function SettingsTab() {
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [concurrency, setConcurrency] = useState(100);
  const [cacheTtl, setCacheTtl] = useState(5);
  const [rotateUa, setRotateUa] = useState(true);
  const [retries, setRetries] = useState(3);

  const handleClearCache = async () => {
    setClearing(true);
    setMessage(null);
    try {
      await fetch('/api/clear-cache', { method: 'POST' });
      setMessage({ text: 'Cache limpo com sucesso!', type: 'success' });
    } catch (e) {
      setMessage({ text: 'Falha ao limpar o cache.', type: 'error' });
    } finally {
      setClearing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display text-white text-gradient">Configurações</h2>
          <p className="text-slate-400 mt-2 leading-relaxed">Ajuste os parâmetros internos e gerencie o estado da engine Nexus em tempo real.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
          <div className="flex flex-col items-end px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engine Load</span>
            <span className="text-xs font-mono font-bold text-blue-400">12.4%</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="flex flex-col items-end px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Threads</span>
            <span className="text-xs font-mono font-bold text-emerald-400">1024</span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Seção Performance */}
        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow">
          <h3 className="text-lg font-bold font-display text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            Performance & Cache
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5 group hover:border-blue-500/30 transition-colors">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Limite de Concorrência</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Define o número máximo de requisições paralelas (Pipelining). Valores altos aumentam a velocidade mas elevam o uso de memória.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit shadow-inner">
                  {[10, 50, 100, 200].map((val) => (
                    <button
                      key={val}
                      onClick={() => setConcurrency(val)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300",
                        concurrency === val 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" 
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5 group hover:border-blue-500/30 transition-colors">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Cache TTL (Minutos)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Tempo de vida dos dados no cache LRU em memória. Reduza para dados mais frescos, aumente para economizar banda.</p>
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="60" 
                    value={cacheTtl} 
                    onChange={(e) => setCacheTtl(Number(e.target.value))}
                    className="flex-1 accent-blue-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-bold font-mono text-blue-400 bg-blue-500/10 px-4 py-1.5 rounded-xl border border-blue-500/20 shadow-sm min-w-[60px] text-center">{cacheTtl}m</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-6 md:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-xl">
                  <h4 className="text-base font-bold font-display mb-1 text-white">Limpeza de Cache Manual</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Limpe o cache LRU imediatamente para forçar uma nova busca de dados na próxima execução. Útil para debugar mudanças em tempo real nos sites fonte.</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <button
                    onClick={handleClearCache}
                    disabled={clearing}
                    className="px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold rounded-2xl transition-all text-sm disabled:opacity-50 active:scale-95 flex items-center gap-3 shadow-lg shadow-red-900/10"
                  >
                    <Trash2 className={cn("w-4 h-4", clearing && "animate-spin")} />
                    {clearing ? 'Limpando...' : 'Limpar Cache LRU'}
                  </button>
                  {message && (
                    <motion.span 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border",
                        message.type === 'success' ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-red-400 bg-red-400/10 border-red-400/20"
                      )}
                    >
                      {message.text}
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seção Rede & Segurança */}
        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow">
          <h3 className="text-lg font-bold font-display text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            Rede & Resiliência
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5 group hover:border-emerald-500/30 transition-colors">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Rotação de User-Agent</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Alterna automaticamente entre diferentes User-Agents a cada requisição para mitigar bloqueios por fingerprinting.</p>
                </div>
                <div className="flex items-center">
                  <button 
                    onClick={() => setRotateUa(!rotateUa)}
                    className={cn(
                      "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner",
                      rotateUa ? "bg-emerald-600" : "bg-slate-800"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md",
                      rotateUa ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                  <span className="ml-4 text-xs font-bold text-slate-300 uppercase tracking-widest">{rotateUa ? 'Ativado' : 'Desativado'}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5 group hover:border-emerald-500/30 transition-colors">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Tentativas (Retries)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Número de tentativas automáticas com Backoff Exponencial em caso de falha de rede ou timeout.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit shadow-inner">
                  {[0, 1, 3, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => setRetries(val)}
                      className={cn(
                        "px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300",
                        retries === val 
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40" 
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informações do Sistema */}
        <div className="glass rounded-3xl p-8 shadow-2xl border border-slate-800/50 mt-12 relative overflow-hidden">
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
          <h3 className="text-white font-bold font-display mb-8 flex items-center gap-3">
            <Settings className="w-5 h-5 text-slate-500" />
            Informações do Sistema
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Versão Engine', value: 'v2.5.0-ultra', color: 'blue' },
              { label: 'Runtime', value: 'Node.js 20.11.0', color: 'blue' },
              { label: 'Uptime', value: '99.99%', color: 'emerald' },
              { label: 'Datacenter', value: 'us-east-1 (AWS)', color: 'blue' }
            ].map((info, i) => (
              <div key={i} className="space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{info.label}</p>
                <p className={cn(
                  "font-mono text-sm font-bold",
                  info.color === 'blue' ? "text-blue-400" : "text-emerald-400"
                )}>{info.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
