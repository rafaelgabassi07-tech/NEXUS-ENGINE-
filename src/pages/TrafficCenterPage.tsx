import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw, Server, Search, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TrafficCenterPage() {
  const [logs, setLogs] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, historyRes] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/history')
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || '');
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch traffic data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const parsedLogs = logs.trim().split('\n').filter(Boolean).reverse();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 sm:px-6 pt-32 pb-12">
      <div className="w-full max-w-[1920px] mx-auto">
        <Link to="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">&larr; Voltar para Home</Link>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-emerald-400" />
            Central de Tráfego API
          </h1>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center gap-2 border border-slate-700 transition"
          >
            <RefreshCw className={"w-4 h-4 " + (loading ? 'animate-spin' : '')} />
            Atualizar Agora
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna 1: Logs Brutos */}
          <div className="glass rounded-2xl border border-slate-800 p-6 flex flex-col h-[600px]">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              Logs do Servidor (Express)
            </h2>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-y-auto flex-1 font-mono text-xs text-slate-400">
              {parsedLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-10">Nenhum log registrado ainda.</div>
              ) : (
                parsedLogs.map((log, idx) => {
                  const isError = log.includes(' 500 ') || log.includes(' 404 ') || log.includes(' 400 ');
                  return (
                    <div key={idx} className={"mb-1 pb-1 border-b border-slate-800/50 " + (isError ? 'text-red-400' : 'text-slate-300')}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna 2: Histórico de Requisições de Scrape */}
          <div className="glass rounded-2xl border border-slate-800 p-6 flex flex-col h-[600px]">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-400" />
              Scrapes Processados (Valores Retornados)
            </h2>
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-y-auto flex-1 p-2">
              {history.length === 0 ? (
                <div className="text-slate-600 text-center py-10 text-xs">Nenhum scrape processado e salvo ainda.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {history.slice().reverse().map((entry, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col gap-1">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span className="font-bold text-emerald-400">{entry.ticker}</span>
                          <span className="text-[10px] bg-slate-800 px-2 rounded-full text-slate-300">{entry.type}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="flex flex-col bg-slate-950 p-2 rounded">
                          <span className="text-slate-500 text-[10px]">Preço</span>
                          <span className="font-mono text-slate-300">{entry.preco}</span>
                        </div>
                        <div className="flex flex-col bg-slate-950 p-2 rounded">
                          <span className="text-slate-500 text-[10px]">DY</span>
                          <span className="font-mono text-slate-300">{entry.dy}%</span>
                        </div>
                        <div className="flex flex-col bg-slate-950 p-2 rounded">
                          <span className="text-slate-500 text-[10px]">P/L</span>
                          <span className="font-mono text-slate-300">{entry.pl}</span>
                        </div>
                        <div className="flex flex-col bg-slate-950 p-2 rounded">
                          <span className="text-slate-500 text-[10px]">P/VP</span>
                          <span className="font-mono text-slate-300">{entry.pvp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
