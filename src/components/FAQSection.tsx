import React from 'react';
import { motion } from 'motion/react';
import { MessageCircleQuestion } from 'lucide-react';

export function FAQSection() {
  const faqs = [
    {
      q: "Por que o Nexus é mais rápido que o Puppeteer ou Selenium?",
      a: "Puppeteer e Selenium abrem um navegador real (Headless Chrome), renderizam CSS, executam JavaScript e montam a árvore DOM completa. O Nexus Engine ignora tudo isso: ele baixa apenas o texto HTML bruto e lê como um fluxo de bytes (SAX), extraindo o dado antes mesmo do download terminar."
    },
    {
      q: "O que é o 'Early Abort'?",
      a: "É uma técnica agressiva de otimização. Se estamos buscando o P/L de uma ação que está na linha 50 do HTML, assim que o Nexus lê a linha 50, ele corta a conexão TCP com o servidor alvo. Isso economiza o download das outras 1000 linhas do site, poupando banda e CPU."
    },
    {
      q: "Posso usar em produção?",
      a: "Sim. O Nexus foi desenhado para alta concorrência. Ele possui um pool de conexões nativo (Undici) e sistema de deduplicação de requisições (Request Coalescing), o que impede que seu servidor seja sobrecarregado mesmo com milhares de requisições simultâneas."
    },
    {
      q: "Como ele lida com bloqueios (Rate Limits)?",
      a: "O motor possui rotação automática de User-Agents, headers humanizados e um sistema de Backoff Exponencial. Se o servidor alvo bloquear a requisição, o Nexus aguarda um tempo progressivo e tenta novamente de forma transparente."
    }
  ];

  return (
    <section id="faq" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50 bg-slate-900/20">
      <div className="mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4"
        >
          <MessageCircleQuestion className="w-4 h-4" />
          <span>Dúvidas Frequentes</span>
        </motion.div>
        <h2 className="text-3xl md:text-4xl font-bold font-display text-white mb-4">Perguntas e Respostas</h2>
        <p className="text-slate-400 max-w-2xl mx-auto">Entenda a fundo as decisões de engenharia por trás do Nexus.</p>
      </div>
      <div className="max-w-3xl mx-auto space-y-4">
        {faqs.map((faq, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-2xl border border-slate-800/50 p-6"
          >
            <h3 className="text-lg font-bold text-white font-display mb-3">{faq.q}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
