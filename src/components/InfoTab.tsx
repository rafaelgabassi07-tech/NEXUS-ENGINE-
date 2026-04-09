import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Download, Copy, Globe, Code2, BarChart3, Settings, CheckCircle2, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

interface InfoTabProps {
  nexusCode: string;
}

export function InfoTab({ nexusCode }: InfoTabProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getFullUrl = (path: string) => {
    return `${window.location.origin}${path}`;
  };

  const handleDownload = () => {
    const blob = new Blob([nexusCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-engine.js';
    a.click();
  };

  const endpoints = [
    { name: 'Nexus Scraper', method: 'POST', path: '/api/scrape', desc: 'Extração rápida e simplificada via Nexus Engine.' },
    { name: 'Nexus Scraper V2', method: 'POST', path: '/api/scrape-v2', desc: 'Métricas detalhadas, notícias e indicadores.' },
    { name: 'Stats Engine', method: 'GET', path: '/api/stats', desc: 'Métricas de performance e latência em tempo real.' },
    { name: 'Clear Cache', method: 'POST', path: '/api/clear-cache', desc: 'Limpeza manual do cache global (Edge/Serverless).' },
    { name: 'Health Check', method: 'GET', path: '/api/health', desc: 'Status operacional e integridade do sistema.' }
  ];

  const codeExample = `import { NexusEngineUltra, runNexusBatch } from './nexus-core';

// 1. Busca um único ativo
const data = await NexusEngineUltra.fetchAtivo('PETR4', 'ACAO');

// 2. Busca em Lote
const batch = await runNexusBatch(['VALE3', 'ITUB4'], 'ACAO');`;

  const jsonSchema = `{
  "tickers": ["PETR4", "VALE3"],
  "type": "ACAO",
  "includeNews": true
}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 pb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display text-white">Documentação</h2>
          <p className="text-slate-400 mt-1 text-sm font-light">Guia de integração Nexus Engine 9.0-Ultra.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 group">
            <Download className="w-4 h-4 group-hover:animate-bounce" />
            Engine JS
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">v2.0-Stable</span>
          </div>
        </div>
      </div>

      {/* Endpoints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {endpoints.map((ep, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="glass-dark border border-white/5 p-3 rounded-xl card-hover flex flex-col justify-between gap-3 group relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border",
                    ep.method === 'POST' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  )}>
                    {ep.method}
                  </span>
                  <h3 className="text-xs font-bold text-white font-display truncate max-w-[120px]">{ep.name}</h3>
                </div>
                <p className="text-[9px] text-slate-500 font-mono truncate">{ep.path}</p>
              </div>
              <button 
                onClick={() => copyToClipboard(getFullUrl(ep.path), ep.path)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
              >
                {copied === ep.path ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            
            <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">{ep.desc}</p>
            
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Active</span>
              </div>
              <span className="text-[8px] font-mono text-slate-600 truncate max-w-[100px]">{getFullUrl(ep.path).replace(/^https?:\/\//, '')}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Example */}
        <div className="glass-dark border border-white/5 rounded-3xl p-6 relative group">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white font-display uppercase tracking-widest">Integração</h3>
            </div>
            <button 
              onClick={() => copyToClipboard(codeExample, 'code')}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
            >
              {copied === 'code' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
          <pre className="p-4 bg-black/60 rounded-2xl border border-white/5 font-mono text-[11px] text-blue-300 overflow-x-auto leading-relaxed">
            <code>{codeExample}</code>
          </pre>
        </div>

        {/* JSON Schema */}
        <div className="glass-dark border border-white/5 rounded-3xl p-6 relative group">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white font-display uppercase tracking-widest">Request Schema</h3>
            </div>
            <button 
              onClick={() => copyToClipboard(jsonSchema, 'json')}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
            >
              {copied === 'json' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
          <pre className="p-4 bg-black/60 rounded-2xl border border-white/5 font-mono text-[11px] text-indigo-300 overflow-x-auto leading-relaxed">
            <code>{jsonSchema}</code>
          </pre>
        </div>
      </div>
    </motion.div>
  );
}
