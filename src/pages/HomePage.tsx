import { useState, useEffect, type MouseEvent } from 'react';
import { Activity, Play, Zap, Code2, Globe, BarChart3, ChevronDown, ChevronUp, Copy, ArrowUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import nexusCode from '../lib/nexus-core.ts?raw';
import { ArchitectureTab } from '../components/ArchitectureTab';
import { InfoTab } from '../components/InfoTab';
import { BenchmarkTab } from '../components/BenchmarkTab';
import { UseCasesSection } from '../components/UseCasesSection';
import { TestTab } from '../components/TestTab';

export default function HomePage() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    const observerOptions = {
      root: null,
      rootMargin: '-80px 0px -50% 0px',
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(`#${entry.target.id}`);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => observer.observe(section));

    window.addEventListener('scroll', handleScroll);

    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      sections.forEach(section => observer.unobserve(section));
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    
    if (href === '#') {
      scrollToTop();
      return;
    }

    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      try { window.history.pushState(null, '', href); } catch (err) {}
    }
  };

  return (
    <main className="pt-24 pb-20 relative">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1920px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
      </div>

      {/* Hero Section */}
      <section className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 pt-20 pb-32 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
        >
          <Zap className="w-4 h-4" />
          <span>Nexus Ultra v2.5 Lançado</span>
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-6xl md:text-8xl font-extrabold tracking-tight font-display text-transparent bg-clip-text bg-gradient-to-b from-white via-blue-50 to-slate-400 mb-8 drop-shadow-sm"
        >
          A Engine de Extração<br />Definitiva.
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed font-light"
        >
          Construído para performance extrema. O Nexus Engine combina a API do Yahoo Finance com um scraper HTML Zero-AST para entregar dados financeiros em milissegundos.
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a 
            href="#playground" 
            onClick={(e) => handleNavClick(e, '#playground')}
            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] hover:-translate-y-1 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Testar no Playground
          </a>
          <a 
            href="#api" 
            onClick={(e) => handleNavClick(e, '#api')}
            className="w-full sm:w-auto px-8 py-4 glass hover:bg-slate-800/80 text-white rounded-xl font-bold text-lg transition-all border border-slate-700 hover:border-slate-600 hover:-translate-y-1 flex items-center justify-center gap-2"
          >
            <Code2 className="w-5 h-5" />
            Ver Documentação
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-6 py-4 bg-slate-900/50 hover:bg-slate-800 text-slate-300 rounded-xl font-bold text-lg transition-all border border-slate-800 hover:-translate-y-1 flex items-center justify-center gap-2 group">
            <svg className="w-5 h-5 fill-current group-hover:text-white transition-colors" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.412-4.041-1.412-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </motion.div>
      </section>

      {/* Benchmark Section */}
      <section id="benchmark" className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-24 border-t border-slate-800/50 scroll-mt-32">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold font-display text-white mb-4">Performance Incomparável</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">Métricas reais extraídas do núcleo da engine comparando a arquitetura legada com o novo Nexus Core.</p>
        </div>
        <BenchmarkTab />
      </section>

      {/* Statistics Section */}
      <section id="stats" className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-24 border-t border-slate-800/50 relative scroll-mt-32">
        <div className="absolute inset-0 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
          {[
            { label: 'Concorrência Máxima', value: '5 reqs/lote', icon: <Globe className="w-5 h-5" />, color: 'blue' },
            { label: 'Parser HTML', value: 'Zero-AST', icon: <Zap className="w-5 h-5" />, color: 'emerald' },
            { label: 'Tentativas (Retries)', value: 'Até 2x', icon: <Activity className="w-5 h-5" />, color: 'blue' },
            { label: 'Alocação de Memória', value: 'O(1)', icon: <BarChart3 className="w-5 h-5" />, color: 'indigo' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
              className="glass border border-slate-800/50 p-6 rounded-3xl text-center group hover:bg-slate-800/60 transition-all card-hover"
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center border transition-transform group-hover:scale-110",
                stat.color === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                stat.color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
              )}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-white font-display mb-1">{stat.value}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-24 border-t border-slate-800/50 scroll-mt-32">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold font-display text-white mb-4">Casos de Uso</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">Onde a performance extrema do Nexus Engine faz a diferença no mundo real.</p>
        </div>
        <UseCasesSection />
      </section>

      {/* Architecture Section */}
      <section id="features" className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-24 border-t border-slate-800/50 bg-slate-900/20 scroll-mt-32">
        <ArchitectureTab />
      </section>

      {/* Source Code Section */}
      <section id="source" className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-24 border-t border-slate-800/50 scroll-mt-32">
        <div className="mb-12">
          <h2 className="text-3xl font-bold font-display text-white mb-4">Código Fonte do Núcleo</h2>
          <p className="text-slate-400 max-w-2xl">O Nexus Engine é open-source. Abaixo está a implementação principal do motor de extração híbrido.</p>
        </div>
        <div className="glass rounded-3xl border border-slate-800/50 overflow-hidden shadow-2xl card-shadow">
          <div className="bg-slate-900/50 px-6 py-3 border-b border-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                <span className="text-xs font-mono text-slate-400 ml-4">nexus-engine.ts</span>
              </div>
            </div>
            <button 
              onClick={() => {
                const code = nexusCode;
                navigator.clipboard.writeText(code);
              }}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar Código
            </button>
          </div>
          <div className={cn("p-6 overflow-x-auto bg-slate-950/80 relative transition-all duration-500", isCodeExpanded ? "max-h-none" : "max-h-[400px] overflow-hidden")}>
            <pre className="text-sm font-mono leading-relaxed text-slate-300">
              {nexusCode}
            </pre>
            {!isCodeExpanded && (
              <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-end justify-center pb-6">
                <button 
                  onClick={() => setIsCodeExpanded(true)} 
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all hover:-translate-y-0.5"
                >
                  <ChevronDown className="w-4 h-4" />
                  Expandir Código Completo
                </button>
              </div>
            )}
            {isCodeExpanded && (
              <div className="mt-8 flex justify-center border-t border-slate-800/50 pt-6">
                <button 
                  onClick={() => setIsCodeExpanded(false)} 
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all hover:-translate-y-0.5 border border-slate-700"
                >
                  <ChevronUp className="w-4 h-4" />
                  Recolher Código
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Playground Section */}
      <section id="playground" className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-24 border-t border-slate-800/50 scroll-mt-32">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold font-display text-white mb-4">Playground Interativo</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">Teste a velocidade e resiliência do Nexus Engine em tempo real.</p>
        </div>
        <TestTab />
      </section>

      {/* API & Docs Section */}
      <section id="api" className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-24 border-t border-slate-800/50 bg-slate-900/20 scroll-mt-32">
        <InfoTab nexusCode={nexusCode} />
      </section>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  );
}
