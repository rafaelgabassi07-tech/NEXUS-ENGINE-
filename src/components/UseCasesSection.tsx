import React from 'react';
import { Activity, BarChart3, Globe, Code2 } from 'lucide-react';

export function UseCasesSection() {
  const cases = [
    {
      title: "Trading Algorítmico",
      desc: "Alimente seus robôs de investimento com dados em tempo real. A latência de 180ms permite reações mais rápidas a movimentos do mercado.",
      icon: <Activity className="w-6 h-6 text-blue-400" />
    },
    {
      title: "Dashboards Financeiros",
      desc: "Construa painéis de controle que atualizam milhares de ativos simultaneamente sem travar o navegador ou o servidor.",
      icon: <BarChart3 className="w-6 h-6 text-emerald-400" />
    },
    {
      title: "APIs de Cotação",
      desc: "Crie sua própria API SaaS de dados financeiros revendendo os dados extraídos com custo de infraestrutura quase zero.",
      icon: <Globe className="w-6 h-6 text-indigo-400" />
    },
    {
      title: "Planilhas Automatizadas",
      desc: "Integre com Google Sheets ou Excel para atualizar carteiras de investimento massivas em segundos.",
      icon: <Code2 className="w-6 h-6 text-purple-400" />
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cases.map((item, i) => (
        <div key={i} className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover flex flex-col">
          <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/50 w-fit mb-5">
            {item.icon}
          </div>
          <h3 className="font-bold text-white font-display mb-3 text-lg">{item.title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed flex-1">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}
