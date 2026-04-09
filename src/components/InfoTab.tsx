import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Download, Copy, Globe, Code2, BarChart3, Settings } from 'lucide-react';
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

  const codeExample = `import { NexusEngineUltra, runNexusBatch } from './nexus-core';

// 1. Busca um único ativo (Fundamentos)
const data = await NexusEngineUltra.fetchAtivo('PETR4', 'ACAO');
console.log(data);

// 2. Busca em lote com controle de concorrência e notícias
const tickers = ['PETR4', 'VALE3', 'MXRF11', 'ITUB4', 'BBDC4'];
const batch = await runNexusBatch(tickers, 'ACAO', 100, true); // true = inclui notícias
console.log("Processados " + batch.length + " ativos");`;

  const serverlessExample = `import { runNexusBatch, NexusEngineUltra } from '../src/lib/nexus-core';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { tickers, type, includeNews } = req.body;
    
    if (!tickers || !Array.isArray(tickers)) {
      return res.status(400).json({ error: 'Tickers inválidos' });
    }

    // Executa o Nexus Engine (Stateless) com métricas avançadas
    const start = performance.now();
    const results = await runNexusBatch(tickers, type || 'ACAO', 50, !!includeNews);
    const duration = performance.now() - start;
    
    res.json({ 
      success: true, 
      results,
      analysis: {
        durationMs: duration,
        engineVersion: '9.0-Ultra',
        report: NexusEngineUltra.getDetailedReport()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-6"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display text-white text-gradient">Instalação & API</h2>
          <p className="text-slate-400 mt-2 max-w-xl leading-relaxed">Documentação técnica para integração do Nexus Engine em sistemas de alta performance.</p>
        </div>
        <button onClick={handleDownload} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all text-sm shadow-xl shadow-blue-900/20 active:scale-95 group">
          <Download className="w-5 h-5 group-hover:animate-bounce" />
          Baixar Nexus Engine
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
          <h3 className="text-xl font-bold font-display text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs">1</div>
            Pré-requisitos e Instalação
          </h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            O Nexus Engine foi construído para rodar em ambientes Node.js modernos (v18+). Ele utiliza bibliotecas nativas de alta performance para maximizar o throughput.
          </p>
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 flex items-center justify-between group">
            <code className="text-blue-400 font-mono text-sm">npm install htmlparser2</code>
            <button 
              onClick={() => copyToClipboard('npm install htmlparser2', 'npm')}
              className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
            >
              {copied === 'npm' ? 'COPIADO' : 'COPIAR'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <p className="text-xs text-blue-400 font-bold mb-1">fetch nativo</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">Cliente HTTP integrado ao Node.js e Vercel, ideal para Serverless.</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <p className="text-xs text-emerald-400 font-bold mb-1">htmlparser2</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">Parser HTML/XML baseado em streams (SAX), essencial para o Zero-AST e Early Abort.</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <p className="text-xs text-indigo-400 font-bold mb-1">yahoo-finance2</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">Fallback inteligente para garantir 100% de disponibilidade dos dados.</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <p className="text-xs text-orange-400 font-bold mb-1">Warm Start Cache</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">Cache em memória para respostas instantâneas em requisições repetidas.</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold font-display text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs">2</div>
              Uso Básico (Script Local)
            </h3>
            <button 
              onClick={() => copyToClipboard(codeExample, 'node')}
              className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-4 py-2 rounded-xl hover:bg-blue-500/20 transition-colors flex items-center gap-2 border border-blue-500/20"
            >
              <Copy className="w-3 h-3" />
              {copied === 'node' ? 'Copiado!' : 'Copiar Código'}
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Após baixar o arquivo <code>nexus-engine.js</code> usando o botão acima, você pode importá-lo diretamente no seu projeto. A classe lida automaticamente com cache, coalescing e retries.
          </p>
          <div className="relative group">
            <pre className="p-6 bg-slate-950 text-blue-200 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 inner-shadow">
              {codeExample}
            </pre>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold font-display text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs">3</div>
              Integração Serverless (Vercel)
            </h3>
            <button 
              onClick={() => copyToClipboard(serverlessExample, 'serverless')}
              className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-4 py-2 rounded-xl hover:bg-blue-500/20 transition-colors flex items-center gap-2 border border-blue-500/20"
            >
              <Copy className="w-3 h-3" />
              {copied === 'serverless' ? 'Copiado!' : 'Copiar Código'}
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Para expor o Nexus Engine como uma API Serverless no Vercel, crie um arquivo <code>api/scrape.ts</code>. O controle de concorrência garantirá que a função não estoure o limite de memória.
          </p>
          <pre className="p-6 bg-slate-950/80 text-blue-200 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 inner-shadow">
            {serverlessExample}
          </pre>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
            <h3 className="text-lg font-bold font-display mb-6 text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              Endpoints de Manutenção
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Stats', method: 'GET', path: '/api/stats' },
                { label: 'Clear Cache', method: 'POST', path: '/api/clear-cache' },
                { label: 'Health', method: 'GET', path: '/api/health' }
              ].map((ep) => (
                <div key={ep.path} className="flex flex-col gap-2 py-3 border-b border-slate-800/50 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{ep.label}</span>
                    <code className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-lg border",
                      ep.method === 'GET' ? "text-blue-400 bg-blue-500/10 border-blue-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"
                    )}>{ep.method}</code>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-xl border border-slate-800 group/url">
                    <code className="text-[10px] font-mono text-slate-400 truncate flex-1">{getFullUrl(ep.path)}</code>
                    <button 
                      onClick={() => copyToClipboard(getFullUrl(ep.path), ep.path)}
                      className="text-[10px] font-bold text-slate-500 hover:text-blue-400 transition-colors"
                    >
                      {copied === ep.path ? 'COPIADO' : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
            <h3 className="text-lg font-bold font-display mb-6 text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Endpoint Público (Demo)
            </h3>
            <div className="space-y-6">
              {[
                { label: 'URL (Standard)', path: '/api/scrape', color: 'blue' },
                { label: 'URL (Advanced)', path: '/api/scrape-v2', color: 'emerald' }
              ].map((ep) => (
                <div key={ep.path} className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{ep.label}</span>
                  <div className="flex items-center gap-2 bg-slate-950/50 p-3 rounded-xl border border-slate-800 group/url">
                    <code className={cn(
                      "text-xs font-bold truncate flex-1",
                      ep.color === 'blue' ? "text-blue-400" : "text-emerald-400"
                    )}>{getFullUrl(ep.path)}</code>
                    <button 
                      onClick={() => copyToClipboard(getFullUrl(ep.path), ep.path)}
                      className="text-xs font-bold text-slate-500 hover:text-white transition-colors p-1"
                    >
                      {copied === ep.path ? 'COPIADO' : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-between items-center py-3 border-t border-slate-800/50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Método</span>
                <code className="text-xs font-bold text-slate-200 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">POST</code>
              </div>
              <div className="flex justify-between items-center py-3 border-t border-slate-800/50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Content-Type</span>
                <code className="text-xs font-bold text-slate-200 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">application/json</code>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
            <h3 className="text-lg font-bold font-display mb-6 text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-indigo-400" />
              Schema de Request
            </h3>
            <pre className="p-4 bg-slate-950/80 text-blue-200 rounded-2xl overflow-x-auto text-[10px] font-mono leading-relaxed border border-slate-800 inner-shadow">
              {`{
  "tickers": ["PETR4", "VALE3"],
  "type": "ACAO",
  "includeNews": true
}`}
            </pre>
            <div className="mt-6 space-y-2">
              <div className="text-[10px] text-slate-500 leading-relaxed flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <strong className="text-slate-400">tickers</strong> (obrigatório): Array de strings.
              </div>
              <div className="text-[10px] text-slate-500 leading-relaxed flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <strong className="text-slate-400">type</strong> (obrigatório): <code>ACAO</code> ou <code>FII</code>.
              </div>
              <div className="text-[10px] text-slate-500 leading-relaxed flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <strong className="text-slate-400">includeNews</strong> (opcional): Booleano para buscar notícias.
              </div>
              <div className="text-[10px] text-blue-400/60 leading-relaxed mt-4 italic">
                * O endpoint v2 retorna um objeto <code>analysis</code> com métricas de performance e relatórios do motor.
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
          <h3 className="text-xl font-bold font-display mb-6 text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Metodologia de Benchmark
          </h3>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed max-w-3xl">Os dados comparativos apresentados foram obtidos através de testes sintéticos simulando 100 requisições simultâneas em um ambiente Node.js 20.x.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Latência', desc: 'Medida desde o início da requisição até o fechamento do stream (Early Abort).', color: 'blue' },
              { title: 'Memória', desc: 'Monitorada via process.memoryUsage durante o parsing de documentos pesados.', color: 'indigo' },
              { title: 'Banda', desc: 'Calculada comparando o Content-Length total vs bytesProcessed reportado.', color: 'emerald' }
            ].map((item, i) => (
              <div key={i} className="p-5 bg-slate-800/30 rounded-2xl border border-slate-700/50 group hover:border-slate-600 transition-colors">
                <h4 className={cn(
                  "text-xs font-bold uppercase tracking-widest mb-3",
                  item.color === 'blue' ? "text-blue-400" : item.color === 'indigo' ? "text-indigo-400" : "text-emerald-400"
                )}>{item.title}</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
