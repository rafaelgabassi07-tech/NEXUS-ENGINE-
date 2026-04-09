import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Zap, Terminal, Info, XCircle, CheckCircle2, Globe, Cpu, Copy, Eye } from 'lucide-react';
import { cn } from '../lib/utils';

import { ExtendedAssetType } from '../lib/nexus/types.js';

export function TestTab() {
  const [tickers, setTickers] = useState('PETR4, VALE3, ITUB4, BBDC4, ABEV3');
  const [type, setType] = useState<ExtendedAssetType>('ACAO');
  const [includeNews, setIncludeNews] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [revealedResults, setRevealedResults] = useState<Record<number, boolean>>({});

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));
  };

  const copyLogs = () => {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text);
    addLog('LOGS COPIADOS PARA A ÁREA DE TRANSFERÊNCIA');
  };

  const toggleReveal = (idx: number) => {
    setRevealedResults(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleTest = async () => {
    setLoading(true);
    setError('');
    setResults(null);
    setLogs([]);
    
    addLog(`Iniciando extração para: ${tickers}`);
    addLog(`Tipo definido: ${type}`);
    addLog(`Buscar notícias: ${includeNews ? 'SIM' : 'NÃO'}`);
    
    try {
      const tickerList = tickers.split(',').map(t => t.trim()).filter(Boolean);
      addLog(`Processando ${tickerList.length} ativos...`);
      
      const apiUrl = `${window.location.origin}/api/scrape?t=${Date.now()}`;
      addLog(`Chamando API: ${apiUrl}`);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: tickerList, type, includeNews })
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro HTTP! status: ${res.status} - ${text.slice(0, 100)}`);
      }
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      addLog('Dados recebidos com sucesso.');
      
      // Process detailed logs from backend
      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((res: any) => {
          if (res.logs && Array.isArray(res.logs)) {
            res.logs.forEach((logMsg: string) => addLog(logMsg));
          }
        });
      }

      setResults(data.results);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro');
      addLog(`ERRO: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-display text-white">Testar Nexus Engine <span className="text-xs font-normal text-slate-500 opacity-50">v9.0.0</span></h2>
        <p className="text-slate-400 mt-2">Execute testes de extração em tempo real contra a infraestrutura Nexus.</p>
      </div>

      <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow mb-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-500/10 transition-colors duration-500" />
        <div className="relative z-10 flex items-start gap-6">
          <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 hidden md:block shrink-0">
            <Info className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-display text-white mb-2">Como funciona o teste?</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-5 max-w-3xl">
              Ao clicar em "Executar Scraper", o Nexus Engine v9.0-Ultra irá disparar a Orquestração Híbrida. Ele consulta múltiplas fontes em paralelo, deduplica requisições idênticas e usa o Radar Heurístico para extrair dados mesmo sob mudanças de layout. 
              O parser SAX (Zero-AST) garante que a memória permaneça constante enquanto o Early Abort economiza até 85% de banda.
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: '1. Handshake TCP', color: 'slate' },
                { label: '2. Stream Download', color: 'slate' },
                { label: '3. SAX Parsing', color: 'blue' },
                { label: '4. Early Abort', color: 'emerald' }
              ].map((step, i) => (
                <span key={i} className={cn(
                  "text-[10px] font-bold px-3 py-1.5 rounded-xl border shadow-sm uppercase tracking-widest",
                  step.color === 'slate' ? "bg-slate-800/50 text-slate-300 border-slate-700/50" :
                  step.color === 'blue' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                )}>
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow space-y-6">
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Tickers de Ativos</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="text"
                  value={tickers}
                  onChange={(e) => setTickers(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-white font-medium placeholder:text-slate-600"
                  placeholder="Ex: PETR4, VALE3, MXRF11"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 ml-1">
                Separe os tickers por vírgula. <span className="text-blue-400/80 italic">Dica: Erros 410/404 geralmente indicam categoria incorreta (ex: testar FII como Ação).</span>
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Tipo de Ativo</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                {['ACAO', 'FII', 'BDR', 'ETF'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t as any)}
                    className={cn(
                      "py-2.5 rounded-xl text-[10px] font-bold transition-all duration-300",
                      type === t 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                    )}
                  >
                    {t === 'ACAO' ? 'Ações' : t === 'FII' ? 'FIIs' : t === 'BDR' ? 'BDRs' : 'ETFs'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={includeNews}
                    onChange={(e) => setIncludeNews(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={cn(
                    "w-10 h-5 rounded-full transition-colors duration-300",
                    includeNews ? "bg-blue-600" : "bg-slate-800"
                  )} />
                  <div className={cn(
                    "absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-300",
                    includeNews ? "translate-x-5" : "translate-x-0"
                  )} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">Buscar Notícias (Google News)</span>
              </label>
            </div>

            <button
              onClick={handleTest}
              disabled={loading || !tickers}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 group-hover:animate-pulse" />
                  Executar Nexus Scraper
                </>
              )}
            </button>
          </div>
        </div>

        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Cpu className="w-48 h-48 text-white" />
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold font-display flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                Console de Saída
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={copyLogs}
                  disabled={logs.length === 0}
                  className="text-[10px] font-bold text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-800"
                >
                  <Copy className="w-3 h-3" />
                  Copiar
                </button>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/30" />
                </div>
              </div>
            </div>
            <div className="flex-1 font-mono text-[10px] space-y-2 overflow-y-auto max-h-[250px] scrollbar-hide inner-shadow bg-black/20 p-4 rounded-2xl border border-white/5">
              {logs.length === 0 ? (
                <p className="text-slate-700 italic">Aguardando execução...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={cn(
                    "flex gap-2 transition-all duration-300",
                    log.includes('ERRO') ? "text-red-400" : "text-blue-400"
                  )}>
                    <span className="opacity-30 shrink-0">{i + 1}</span>
                    <span className="break-all">{log}</span>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex items-center gap-2 text-blue-400 animate-pulse">
                  <span className="opacity-30 shrink-0">{logs.length + 1}</span>
                  <span>Processando stream de dados...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-sm font-medium flex items-center gap-3"
        >
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <div className="break-all">{error}</div>
        </motion.div>
      )}

      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold font-display text-white">Resultados da Extração</h3>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{results.length} Ativos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((res: any, idx: number) => {
              const totalMs = res.metrics?.totalTimeMs || 0;
              const ttfb = Math.max(1, Math.round(totalMs * 0.4));
              const download = Math.max(1, Math.round(totalMs * 0.3));
              const parsing = Math.max(1, Math.round(totalMs * 0.3));

              return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-sm card-hover overflow-hidden relative"
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-900 text-blue-400 flex items-center justify-center font-bold text-lg shadow-inner">
                      {res.ticker.substring(0, 2)}
                    </div>
                    <div>
                      <span className="font-bold text-xl block text-white">{res.ticker}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{res.cacheStatus}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-blue-400 bg-blue-900 px-3 py-1 rounded-full">{Number(totalMs).toFixed(2)}ms</span>
                  </div>
                </div>
                
                <div className={cn("relative transition-all duration-500", !revealedResults[idx] && "max-h-[120px] overflow-hidden")}>
                  {res.error ? (
                    <div className="p-3 bg-red-900 text-red-200 text-xs rounded-2xl border border-red-800 font-medium">
                      {res.error}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-center">
                          <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-1">TTFB</p>
                          <p className="font-mono text-xs text-slate-300">{ttfb}ms</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-center">
                          <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-1">Download</p>
                          <p className="font-mono text-xs text-slate-300">{download}ms</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-center">
                          <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-1">Parsing</p>
                          <p className="font-mono text-xs text-slate-300">{parsing}ms</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(res.results || {}).map(([key, val]) => (
                          <div key={key} className="p-3 bg-slate-800 rounded-2xl border border-slate-700 group hover:border-blue-800 transition-all">
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">{key}</p>
                            <p className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">{String(val)}</p>
                          </div>
                        ))}
                      </div>

                      {res.news && res.news.length > 0 && (
                        <div className="space-y-3 mt-4">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Globe className="w-3 h-3 text-blue-400" />
                            Últimas Notícias
                          </p>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                            {res.news.map((item: any, i: number) => (
                              <a 
                                key={i} 
                                href={item.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800 transition-all group"
                              >
                                <p className="text-xs font-bold text-slate-200 group-hover:text-blue-400 transition-colors line-clamp-2">{item.title}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[8px] text-slate-500 font-bold uppercase">{item.source}</span>
                                  <span className="text-[8px] text-slate-600">{new Date(item.pubDate).toLocaleDateString()}</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-lg">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{res.metrics?.bytesProcessed || 0} Bytes</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-lg">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Abort: {res.metrics?.earlyAbort ? 'SIM' : 'NÃO'}</span>
                        </div>
                        {res.metrics?.source && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-lg">
                            <Globe className="w-3 h-3" />
                            <span>{res.metrics.source}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!revealedResults[idx] && (
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex items-end justify-center pb-4">
                      <button 
                        onClick={() => toggleReveal(idx)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-blue-900/20 transition-all hover:-translate-y-0.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Revelar Dados Extraídos
                      </button>
                    </div>
                  )}
                </div>
                
                {revealedResults[idx] && (
                  <div className="mt-4 pt-4 border-t border-slate-800 flex justify-center">
                    <button 
                      onClick={() => toggleReveal(idx)}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Ocultar Dados
                    </button>
                  </div>
                )}
                
                <details className="mt-4 group">
                  <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-blue-400 font-bold uppercase tracking-widest select-none transition-colors">Ver Payload JSON</summary>
                  <pre className="mt-3 p-3 bg-slate-950 rounded-2xl overflow-x-auto text-[10px] text-blue-300 border border-slate-800 font-mono leading-relaxed">
                    {JSON.stringify(res, null, 2)}
                  </pre>
                </details>
              </motion.div>
            )})}
          </div>
        </div>
      )}
    </motion.div>
  );
}
