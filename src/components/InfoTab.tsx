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
    { name: 'Scraper Standard', method: 'POST', path: '/api/scrape', desc: 'Extração rápida e simplificada.' },
    { name: 'Scraper Advanced (v2)', method: 'POST', path: '/api/scrape-v2', desc: 'Métricas detalhadas e notícias.' },
    { name: 'Stats Engine', method: 'GET', path: '/api/stats', desc: 'Métricas de performance em tempo real.' },
    { name: 'Clear Cache', method: 'POST', path: '/api/clear-cache', desc: 'Limpeza manual do cache global.' },
    { name: 'Health Check', method: 'GET', path: '/api/health', desc: 'Status operacional do sistema.' }
  ];

  const codeExample = `import { NexusEngineUltra, runNexusBatch } from './nexus-core';

// 1. Busca um único ativo (Fundamentos)
const data = await NexusEngineUltra.fetchAtivo('PETR4', 'ACAO');
console.log(data);

// 2. Busca em Lote (Batching Paralelo)
const batch = await runNexusBatch(['VALE3', 'ITUB4', 'ABEV3'], 'ACAO');
console.log(batch);`;

  const jsonSchema = `{
  "tickers": ["PETR4", "VALE3"],
  "type": "ACAO", // "ACAO", "FII", "BDR"
  "includeNews": true // Opcional (apenas v2)
}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-12 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter font-display text-white">Documentação Técnica</h2>
          <p className="text-slate-400 mt-3 max-w-2xl text-lg font-light">Guia completo para integração e consumo da API Nexus Engine 9.0-Ultra.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={handleDownload} className="flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-900/20 active:scale-95 group">
            <Download className="w-5 h-5 group-hover:animate-bounce" />
            Download Engine
          </button>
          <div className="flex items-center gap-3 px-6 py-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl shadow-xl backdrop-blur-md">
            <Code2 className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">API v2.0-Stable</span>
          </div>
        </div>
      </div>

      {/* Endpoints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {endpoints.map((ep, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-dark border border-white/5 p-6 rounded-4xl card-hover technical-border group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase",
                ep.method === 'POST' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              )}>
                {ep.method}
              </span>
              <button 
                onClick={() => copyToClipboard(getFullUrl(ep.path), ep.path)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-500 hover:text-white"
                title="Copiar URL completa"
              >
                {copied === ep.path ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <h3 className="text-lg font-bold text-white font-display mb-1 tracking-tight">{ep.name}</h3>
            <p className="text-xs text-slate-500 mb-4 font-medium uppercase tracking-wider">{ep.path}</p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">{ep.desc}</p>
            
            <div className="p-3 bg-black/40 rounded-2xl border border-white/5 font-mono text-[10px] text-slate-500 break-all select-all">
              {getFullUrl(ep.path)}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Code Example */}
        <div className="glass-dark border border-white/5 rounded-4xl p-8 card-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => copyToClipboard(codeExample, 'code')}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all backdrop-blur-md"
            >
              {copied === 'code' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-white" />}
            </button>
          </div>
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
              <Terminal className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-white font-display tracking-tight">Exemplo de Integração</h3>
          </div>
          <pre className="p-6 bg-black/60 rounded-3xl border border-white/5 font-mono text-sm text-blue-300 overflow-x-auto leading-relaxed">
            <code>{codeExample}</code>
          </pre>
        </div>

        {/* JSON Schema */}
        <div className="glass-dark border border-white/5 rounded-4xl p-8 card-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => copyToClipboard(jsonSchema, 'json')}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all backdrop-blur-md"
            >
              {copied === 'json' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-white" />}
            </button>
          </div>
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <Code2 className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-white font-display tracking-tight">JSON Request Schema</h3>
          </div>
          <pre className="p-6 bg-black/60 rounded-3xl border border-white/5 font-mono text-sm text-indigo-300 overflow-x-auto leading-relaxed">
            <code>{jsonSchema}</code>
          </pre>
        </div>
      </div>
    </motion.div>
  );
}
