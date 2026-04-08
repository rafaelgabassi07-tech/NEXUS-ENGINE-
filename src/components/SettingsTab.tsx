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
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display text-white text-gradient">Configurações do Motor</h2>
          <p className="text-slate-400 mt-2 leading-relaxed">Visão geral dos parâmetros hardcoded e arquitetura Serverless do Nexus Engine.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
          <div className="flex flex-col items-end px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ambiente</span>
            <span className="text-xs font-mono font-bold text-blue-400">Serverless (Vercel)</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="flex flex-col items-end px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado</span>
            <span className="text-xs font-mono font-bold text-emerald-400">Stateless</span>
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
            Performance & Concorrência
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Limite de Concorrência (Batch)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">O motor está configurado para processar lotes com limite de concorrência dinâmico. Atualmente, a API processa até 5 requisições simultâneas por lote para evitar estourar a memória da Serverless Function.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 w-fit">
                  <span className="text-xs font-bold text-blue-400">5 reqs/lote</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Gerenciamento de Memória</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Devido à natureza efêmera do Serverless, o cache LRU em memória foi desativado. Cada requisição à API garante dados 100% frescos (Stateless Execution).</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 w-fit">
                  <span className="text-xs font-bold text-emerald-400">Cache Desativado (Fresh Data)</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-6 md:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-xl">
                  <h4 className="text-base font-bold font-display mb-1 text-white">Limpeza de Estado Edge</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Envia um sinal para a API limpar qualquer resquício de estado em memória (útil caso algum cache em nível de CDN ou Edge esteja retendo respostas antigas).</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <button
                    onClick={handleClearCache}
                    disabled={clearing}
                    className="px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold rounded-2xl transition-all text-sm disabled:opacity-50 active:scale-95 flex items-center gap-3 shadow-lg shadow-red-900/10"
                  >
                    <Trash2 className={cn("w-4 h-4", clearing && "animate-spin")} />
                    {clearing ? 'Enviando...' : 'Forçar Limpeza Edge'}
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
              <ShieldCheck className="w-5 h-5" />
            </div>
            Rede & Resiliência
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Rotação de User-Agent</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">O motor alterna automaticamente entre uma lista de User-Agents modernos (Chrome, Firefox, Safari) a cada requisição para mitigar bloqueios por fingerprinting.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 w-fit">
                  <span className="text-xs font-bold text-emerald-400">Ativado (Hardcoded)</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Tentativas (Retries)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Em caso de falha de rede ou erro 404 temporário, o motor realiza tentativas automáticas com Backoff Exponencial antes de repassar o erro.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 w-fit">
                  <span className="text-xs font-bold text-blue-400">2 Tentativas (Backoff 800ms)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informações do Sistema */}
        <div className="glass rounded-3xl p-8 shadow-2xl border border-slate-800/50 mt-12 relative overflow-hidden">
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
          <h3 className="text-white font-bold font-display mb-8 flex items-center gap-3">
            <Globe className="w-5 h-5 text-slate-500" />
            Informações do Ambiente
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Versão Engine', value: 'v2.5.0-ultra', color: 'blue' },
              { label: 'Runtime', value: 'Node.js 20.x', color: 'blue' },
              { label: 'Infraestrutura', value: 'Vercel Edge/Serverless', color: 'emerald' },
              { label: 'Cliente HTTP', value: 'Native Fetch API', color: 'blue' }
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

