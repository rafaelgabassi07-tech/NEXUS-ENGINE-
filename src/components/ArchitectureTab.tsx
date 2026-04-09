import React from 'react';
import { motion } from 'motion/react';
import { Cpu, Globe, Activity, CheckCircle2, Play, Info, Settings, Zap, ArrowRight, XCircle, Layers, Database, Network, Search, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function ArchitectureTab() {
  const layers = [
    {
      title: "Camada de Transporte",
      icon: <Globe className="w-6 h-6" />,
      color: "blue",
      items: [
        { name: "HTTP/2 & Pipeline", desc: "Multiplexação de requisições para reduzir latência de handshake." },
        { name: "Radar Heurístico", desc: "Identificação dinâmica de padrões de bloqueio e rotação de UA." },
        { name: "Early Abort", desc: "Corte imediato da conexão TCP após a captura do dado alvo." }
      ]
    },
    {
      title: "Motor de Parsing (Nexus Core)",
      icon: <Cpu className="w-6 h-6" />,
      color: "emerald",
      items: [
        { name: "SAX Stream Reader", desc: "Processamento de bytes em tempo real sem carregar o HTML todo." },
        { name: "Zero-AST Extraction", desc: "Algoritmo proprietário que ignora a construção da árvore DOM." },
        { name: "Sanitização Atômica", desc: "Limpeza de caracteres e normalização de tipos em nível de buffer." }
      ]
    },
    {
      title: "Otimização & Cache",
      icon: <Zap className="w-6 h-6" />,
      color: "indigo",
      items: [
        { name: "Cache SWR", desc: "Stale-While-Revalidate para entrega instantânea de dados quentes." },
        { name: "Warm Start", desc: "Pré-aquecimento de conexões para ativos de alta volatilidade." },
        { name: "Backoff Exponencial", desc: "Gerenciamento inteligente de retentativas em caso de falha." }
      ]
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-12 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter font-display text-white">Arquitetura Nexus Ultra</h2>
          <p className="text-slate-400 mt-3 max-w-2xl text-lg font-light">Uma análise profunda da infraestrutura de alto desempenho que alimenta nossa engine de extração.</p>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 bg-blue-600/10 border border-blue-500/20 rounded-2xl shadow-xl backdrop-blur-md">
          <Cpu className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Engine v9.0-Ultra</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {layers.map((layer, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-dark border border-white/5 rounded-4xl p-8 card-hover technical-border flex flex-col"
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl mb-8 flex items-center justify-center border shadow-lg transition-transform group-hover:scale-110",
              layer.color === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
              layer.color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
              "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
            )}>
              {layer.icon}
            </div>
            
            <h3 className="text-2xl font-bold text-white font-display mb-8 tracking-tight">{layer.title}</h3>
            
            <div className="space-y-6 flex-1">
              {layer.items.map((item, j) => (
                <div key={j} className="group/item">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      layer.color === 'blue' ? "bg-blue-500" :
                      layer.color === 'emerald' ? "bg-emerald-500" :
                      "bg-indigo-500"
                    )} />
                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-widest group-hover/item:text-white transition-colors">{item.name}</h4>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed pl-4 border-l border-slate-800 group-hover/item:border-slate-600 transition-colors">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Comparison Table Section */}
      <div className="glass-dark border border-white/5 rounded-4xl p-10 card-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h3 className="text-3xl font-bold text-white font-display tracking-tight mb-2">Nexus v9.0-Ultra vs Legado</h3>
            <p className="text-slate-400">Análise técnica da evolução do motor de extração.</p>
          </div>
          <div className="px-5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest shadow-lg">
            Performance +850%
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5">
                <th className="pb-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Característica</th>
                <th className="pb-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Arquitetura Legada</th>
                <th className="pb-6 text-xs font-bold text-blue-400 uppercase tracking-widest">Nexus v9.0-Ultra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { feature: "Modelo de Parsing", old: "DOM Tree (Cheerio)", new: "SAX Stream (htmlparser2)", highlight: true },
                { feature: "Consumo de Memória", old: "Linear O(n)", new: "Constante O(1)", highlight: false },
                { feature: "Tempo de Resposta", old: "2.5s - 4.0s", new: "150ms - 400ms", highlight: true },
                { feature: "Concorrência", old: "Sequencial", new: "Paralela (Batching)", highlight: false },
                { feature: "Early Abort", old: "Não Suportado", new: "Nativo (TCP Cutoff)", highlight: true },
                { feature: "Cache", old: "Nenhum", new: "SWR High-Speed", highlight: false }
              ].map((row, i) => (
                <tr key={i} className="group hover:bg-white/5 transition-colors">
                  <td className="py-6 text-sm font-medium text-slate-300">{row.feature}</td>
                  <td className="py-6 text-sm text-slate-500 font-mono italic">{row.old}</td>
                  <td className={cn(
                    "py-6 text-sm font-bold font-mono",
                    row.highlight ? "text-blue-400" : "text-slate-200"
                  )}>
                    {row.new}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Pipeline */}
      <div className="glass-dark border border-white/5 rounded-4xl p-10 card-shadow">
        <h3 className="text-3xl font-bold font-display mb-10 text-white tracking-tight">Pipeline de Execução Nexus</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { step: 1, title: 'Invocação & Deduplicação', desc: 'A requisição é recebida e verificada contra o cache SWR. Se houver uma busca idêntica em andamento, ela é deduplicada.' },
            { step: 2, title: 'Orquestração Multicanal', desc: 'O motor tenta a fonte primária; se faltar um único dado, ele consulta fontes secundárias em paralelo para preencher lacunas.' },
            { step: 3, title: 'WAF Bypass & Headers', desc: 'Rotação inteligente de headers, Accept-Language e flag DNT para mascarar a origem e evitar bloqueios de WAF.' },
            { step: 4, title: 'Radar Heurístico (SAX)', desc: 'Processa o stream de HTML buscando âncoras semânticas. Identifica valores por proximidade, ignorando a estrutura CSS.' },
            { step: 5, title: 'Normalização Matemática', desc: 'Converte automaticamente grandezas (K, M, B) e limpa caracteres especiais para garantir dados numéricos puros.' },
            { step: 6, title: 'Early Abort & Cache', desc: 'Interrompe a conexão TCP ao obter os dados e popula o cache global com TTL dinâmico.' },
          ].map((item) => (
            <div key={item.step} className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 group hover:border-blue-500/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
                {item.step}
              </div>
              <h4 className="font-bold text-slate-100 text-lg font-display mb-2 group-hover:text-blue-400 transition-colors">{item.title}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
