import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Play, Activity, Clock, Database, Server, Zap, RefreshCw, BarChart3, Swords, Code2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export function BenchmarkTab() {
  const [activeTab, setActiveTab] = useState<'load' | 'race' | 'analyzer'>('load');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [raceResults, setRaceResults] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [testSize, setTestSize] = useState(5);
  const [pastedCode, setPastedCode] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const runBenchmark = async () => {
    setIsRunning(true);
    setResults(null);
    setError(null);
    const startTime = performance.now();
    
    try {
      await fetch('/api/clear-cache', { method: 'POST' });
      
      const allTickers = [
        'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 
        'WEGE3', 'BBAS3', 'JBSS3', 'SUZB3', 'RENT3',
        'B3SA3', 'ELET3', 'RADL3', 'EQTL3', 'LREN3',
        'PRIO3', 'HAPV3', 'RAIL3', 'SBSP3', 'VIVT3'
      ];
      const tickers = allTickers.slice(0, testSize);
      
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, type: 'ACAO', includeNews: false })
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro do Servidor (${res.status}): ${text.slice(0, 100)}`);
      }
      
      const data = await res.json();
      const endTime = performance.now();
      
      if (data.results) {
        const successful = data.results.filter((r: any) => !r.error);
        const totalBytes = successful.reduce((acc: number, r: any) => acc + (r.metrics?.bytesProcessed || 0), 0);
        const avgTime = successful.reduce((acc: number, r: any) => acc + (r.metrics?.totalTimeMs || 0), 0) / (successful.length || 1);
        
        setResults({
          totalTime: endTime - startTime,
          successRate: (successful.length / tickers.length) * 100,
          avgTimePerTicker: avgTime,
          totalBytes,
          items: data.results,
          totalTickers: tickers.length
        });
      }
      fetchStats();
    } catch (error: any) {
      console.error(error);
      setError(error.message || "Ocorreu um erro desconhecido.");
    } finally {
      setIsRunning(false);
    }
  };

  const runRace = async () => {
    setIsRunning(true);
    setRaceResults(null);
    setError(null);
    try {
      const allTickers = [
        'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 
        'WEGE3', 'BBAS3', 'JBSS3', 'SUZB3', 'RENT3',
        'B3SA3', 'ELET3', 'RADL3', 'EQTL3', 'LREN3',
        'PRIO3', 'HAPV3', 'RAIL3', 'SBSP3', 'VIVT3'
      ];
      const tickers = allTickers.slice(0, testSize);
      
      const res = await fetch('/api/benchmark-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro do Servidor (${res.status}): ${text.slice(0, 100)}`);
      }
      
      const data = await res.json();
      
      // Calculate metrics
      const legacySuccess = data.legacy.results.filter((r: any) => !r.error);
      const nexusSuccess = data.nexus.results.filter((r: any) => !r.error);
      
      const legacyBytes = legacySuccess.reduce((acc: number, r: any) => acc + (r.metrics?.bytesProcessed || 0), 0);
      const nexusBytes = nexusSuccess.reduce((acc: number, r: any) => acc + (r.metrics?.bytesProcessed || 0), 0);

      setRaceResults({
        legacy: {
          time: data.legacy.time,
          successRate: (legacySuccess.length / tickers.length) * 100,
          bytes: legacyBytes,
          errors: data.legacy.results.filter((r: any) => r.error).length
        },
        nexus: {
          time: data.nexus.time,
          successRate: (nexusSuccess.length / tickers.length) * 100,
          bytes: nexusBytes,
          errors: data.nexus.results.filter((r: any) => r.error).length
        },
        tickers
      });
    } catch (error: any) {
      console.error(error);
      setError(error.message || "Ocorreu um erro desconhecido.");
    } finally {
      setIsRunning(false);
    }
  };

  const analyzeCode = () => {
    setIsRunning(true);
    setAnalysis(null);
    
    // Simulate AI Analysis based on heuristics
    setTimeout(() => {
      const code = pastedCode.toLowerCase();
      const hasCheerio = code.includes('cheerio') || code.includes('jsdom');
      const hasPuppeteer = code.includes('puppeteer') || code.includes('playwright');
      const hasAwaitFetch = code.includes('await fetch');
      const hasPromiseAll = code.includes('promise.all');
      
      const weaknesses = [];
      const strengths = [];
      
      if (hasCheerio) {
        weaknesses.push('Usa parsing de DOM completo (Cheerio/JSDOM). Isso aloca muita memória e exige o download total do HTML antes de iniciar a extração.');
      }
      if (hasPuppeteer) {
        weaknesses.push('Usa Headless Browser. Isso consome CPU e RAM excessivos, tornando a extração lenta e cara para escalar.');
      }
      if (hasAwaitFetch && !hasPromiseAll) {
        weaknesses.push('Faz requisições sequenciais (await dentro de loop). O tempo total será a soma de todas as requisições, gerando gargalos.');
      }
      if (!code.includes('abortcontroller')) {
        weaknesses.push('Não possui Early Abort. O scraper fará o download de 100% da página mesmo se os dados já tiverem sido encontrados no topo.');
      }
      if (!code.includes('circuitbreaker') && !code.includes('retry')) {
        weaknesses.push('Não possui Circuit Breaker ou lógica avançada de Retry. Se o site alvo cair ou bloquear o IP (WAF), o scraper falhará em cascata.');
      }

      if (hasPromiseAll) strengths.push('Utiliza concorrência (Promise.all) para acelerar requisições.');
      if (!hasCheerio && !hasPuppeteer) strengths.push('Parece usar extração leve (Regex ou String matching) em vez de DOM pesado.');

      setAnalysis({
        score: Math.max(10, 100 - (weaknesses.length * 20) + (strengths.length * 10)),
        weaknesses: weaknesses.length > 0 ? weaknesses : ['Nenhuma fraqueza crítica detectada (Heurística básica).'],
        strengths: strengths.length > 0 ? strengths : ['Código padrão sem otimizações específicas detectadas.'],
        nexusComparison: 'O Nexus Engine resolve esses problemas usando SAX Streaming (Zero-AST), Early Abort (corta a conexão cedo), Orquestração Paralela e Circuit Breakers por fonte.'
      });
      setIsRunning(false);
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-display text-white">Benchmark & Análise</h2>
        <p className="text-slate-400 mt-2">Teste a performance do Nexus, compare com scrapers tradicionais ou analise seu próprio código.</p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-900/50 border border-slate-800 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('load')}
          className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === 'load' ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}
        >
          <Activity className="w-4 h-4" /> Teste de Carga
        </button>
        <button 
          onClick={() => setActiveTab('race')}
          className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === 'race' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white")}
        >
          <Swords className="w-4 h-4" /> Corrida (Nexus vs Padrão)
        </button>
        <button 
          onClick={() => setActiveTab('analyzer')}
          className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === 'analyzer' ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white")}
        >
          <Code2 className="w-4 h-4" /> Analisador de Código
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow min-h-[400px]">
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm mb-6 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* TAB: TESTE DE CARGA */}
          {activeTab === 'load' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-bold font-display text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Teste de Carga (Nexus Engine)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Executa requisições paralelas com deduplicação e fallback.</p>
                </div>
                <div className="flex items-center gap-3">
                  <select value={testSize} onChange={(e) => setTestSize(Number(e.target.value))} disabled={isRunning} className="bg-slate-900 border border-slate-700 text-white text-sm rounded-xl px-3 py-2">
                    <option value={5}>5 Ativos</option>
                    <option value={10}>10 Ativos</option>
                  </select>
                  <button onClick={runBenchmark} disabled={isRunning} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-2">
                    {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {isRunning ? 'Executando...' : 'Iniciar'}
                  </button>
                </div>
              </div>

              {results ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tempo Total</p>
                      <p className="text-2xl font-bold font-mono text-white">{(results.totalTime / 1000).toFixed(2)}s</p>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Taxa de Sucesso</p>
                      <p className={cn("text-2xl font-bold font-mono", results.successRate === 100 ? "text-emerald-400" : "text-yellow-400")}>{results.successRate.toFixed(0)}%</p>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Média por Ativo</p>
                      <p className="text-2xl font-bold font-mono text-blue-400">{results.avgTimePerTicker.toFixed(0)}ms</p>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Banda Usada</p>
                      <p className="text-2xl font-bold font-mono text-indigo-400">{Math.round(results.totalBytes / 1024)}KB</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                  <Activity className="w-12 h-12 mb-4 opacity-20" />
                  <p>Inicie o teste de carga para ver os resultados.</p>
                </div>
              )}
            </>
          )}

          {/* TAB: CORRIDA */}
          {activeTab === 'race' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-bold font-display text-white flex items-center gap-2">
                    <Swords className="w-5 h-5 text-indigo-400" />
                    Nexus vs Scraper Padrão
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Compara o Nexus (SAX/Paralelo) contra um scraper legado (Cheerio/Sequencial).</p>
                </div>
                <div className="flex items-center gap-3">
                  <select value={testSize} onChange={(e) => setTestSize(Number(e.target.value))} disabled={isRunning} className="bg-slate-900 border border-slate-700 text-white text-sm rounded-xl px-3 py-2">
                    <option value={3}>3 Ativos</option>
                    <option value={5}>5 Ativos</option>
                  </select>
                  <button onClick={runRace} disabled={isRunning} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-2">
                    {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {isRunning ? 'Correndo...' : 'Iniciar Corrida'}
                  </button>
                </div>
              </div>

              {raceResults ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Legacy Card */}
                    <div className="p-6 bg-slate-900/50 rounded-3xl border border-slate-800 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-slate-700" />
                      <h4 className="text-lg font-bold text-slate-300 mb-4">Scraper Padrão (Cheerio)</h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Tempo Total</p>
                          <p className="text-3xl font-mono font-bold text-slate-300">{(raceResults.legacy.time / 1000).toFixed(2)}s</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-slate-800 rounded-lg">
                            <p className="text-[9px] text-slate-500 uppercase">Banda Usada</p>
                            <p className="font-mono text-sm text-slate-300">{Math.round(raceResults.legacy.bytes / 1024)}KB</p>
                          </div>
                          <div className="p-2 bg-slate-800 rounded-lg">
                            <p className="text-[9px] text-slate-500 uppercase">Erros/WAF</p>
                            <p className="font-mono text-sm text-red-400">{raceResults.legacy.errors}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nexus Card */}
                    <div className="p-6 bg-blue-900/10 rounded-3xl border border-blue-500/30 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
                      <div className="absolute top-4 right-4">
                        {raceResults.nexus.time < raceResults.legacy.time && (
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Vencedor
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-bold text-blue-400 mb-4">Nexus Engine v9</h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] text-blue-500/70 uppercase tracking-widest font-bold">Tempo Total</p>
                          <p className="text-3xl font-mono font-bold text-blue-400">{(raceResults.nexus.time / 1000).toFixed(2)}s</p>
                          <p className="text-xs text-emerald-400 mt-1 font-bold">
                            {((raceResults.legacy.time / raceResults.nexus.time)).toFixed(1)}x mais rápido
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-blue-950/50 rounded-lg border border-blue-900/50">
                            <p className="text-[9px] text-blue-500/70 uppercase">Banda Usada</p>
                            <p className="font-mono text-sm text-blue-300">{Math.round(raceResults.nexus.bytes / 1024)}KB</p>
                          </div>
                          <div className="p-2 bg-blue-950/50 rounded-lg border border-blue-900/50">
                            <p className="text-[9px] text-blue-500/70 uppercase">Erros/WAF</p>
                            <p className="font-mono text-sm text-emerald-400">{raceResults.nexus.errors}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                  <Swords className="w-12 h-12 mb-4 opacity-20" />
                  <p>Inicie a corrida para comparar as arquiteturas.</p>
                </div>
              )}
            </>
          )}

          {/* TAB: ANALISADOR DE CÓDIGO */}
          {activeTab === 'analyzer' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold font-display text-white flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-emerald-400" />
                    Analisador de Scrapers
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Cole o código do seu scraper (Node.js/Python) para descobrir gargalos arquiteturais.</p>
                </div>
                <button onClick={analyzeCode} disabled={isRunning || !pastedCode} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-2">
                  {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  {isRunning ? 'Analisando...' : 'Analisar Código'}
                </button>
              </div>

              <div className="space-y-6">
                <textarea
                  value={pastedCode}
                  onChange={(e) => setPastedCode(e.target.value)}
                  placeholder="Cole aqui o código do seu scraper (ex: usando cheerio, puppeteer, requests, beautifulsoup)..."
                  className="w-full h-48 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-mono text-slate-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 resize-none"
                />

                {analysis && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-2xl border border-slate-800">
                      <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center text-xl font-bold text-white">
                        {analysis.score}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white">Score Arquitetural</h4>
                        <p className="text-xs text-slate-400">Baseado em heurísticas de performance e resiliência.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 bg-red-950/20 border border-red-900/30 rounded-2xl">
                        <h5 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4" /> Pontos Fracos Detectados
                        </h5>
                        <ul className="space-y-2">
                          {analysis.weaknesses.map((w: string, i: number) => (
                            <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span> {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-5 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl">
                        <h5 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-4 h-4" /> Pontos Fortes
                        </h5>
                        <ul className="space-y-2">
                          {analysis.strengths.map((s: string, i: number) => (
                            <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                              <span className="text-emerald-500 mt-0.5">•</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-2xl">
                      <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">A Solução Nexus</h5>
                      <p className="text-sm text-slate-300">{analysis.nexusComparison}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </>
          )}

        </div>

        {/* SIDEBAR METRICS */}
        <div className="space-y-6">
          <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow">
            <h3 className="text-sm font-bold font-display text-white flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-indigo-400" />
              Métricas do Motor (Ao Vivo)
            </h3>
            
            {stats ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Uso do Cache Principal</span>
                    <span className="text-white font-mono">{stats.cache.tamanho} / {stats.cache.tamanhoMax}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div 
                      className="bg-indigo-500 h-1.5 rounded-full transition-all" 
                      style={{ width: `${(stats.cache.tamanho / stats.cache.tamanhoMax) * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Req. em Voo</p>
                    <p className="text-lg font-bold font-mono text-white">{stats.inFlightRequests}</p>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">URL Deduplicadas</p>
                    <p className="text-lg font-bold font-mono text-white">{stats.urlInFlightRequests}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Circuit Breakers</p>
                  {Object.entries(stats.circuitBreakers).map(([key, state]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 capitalize">{key}</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded",
                        state === 'FECHADO' ? "bg-emerald-500/10 text-emerald-400" :
                        state === 'SEMI_ABERTO' ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-red-500/10 text-red-400"
                      )}>
                        {String(state)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

