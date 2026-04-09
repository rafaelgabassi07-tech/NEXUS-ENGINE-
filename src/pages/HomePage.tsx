import { useState, useEffect, type MouseEvent } from 'react';
import { Activity, Play, Zap, Code2, Globe, BarChart3, ChevronDown, ChevronUp, Copy, ArrowUp, Download } from 'lucide-react';
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
          element.scrollIntoView({ behavior: 'auto' });
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

  const handleDownload = () => {
    try {
      const blob = new Blob([nexusCode], { type: 'application/typescript;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'nexus-engine.ts');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const a = document.createElement('a');
      a.href = 'data:application/typescript;charset=utf-8,' + encodeURIComponent(nexusCode);
      a.download = 'nexus-engine.ts';
      a.click();
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
      <section className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 pt-12 pb-20 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-8 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
        >
          <Zap className="w-3 h-3 animate-pulse" />
          <span>Nexus Engine 10.1-Ultra</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
          className="text-5xl md:text-7xl font-extrabold tracking-tighter font-display text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-slate-500 mb-8 leading-[0.95] drop-shadow-xl"
        >
          A Engine de Extração<br />Definitiva.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light tracking-tight"
        >
          Performance extrema com <span className="text-white font-medium">Nexus Engine 10.1-Ultra</span>. Orquestração Híbrida e Cache SWR para dados financeiros em milissegundos.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a 
            href="#playground" 
            onClick={(e) => handleNavClick(e, '#playground')}
            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-900/20 hover:-translate-y-1 flex items-center justify-center gap-2 group"
          >
            <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
            Playground
          </a>
          <a 
            href="#api" 
            onClick={(e) => handleNavClick(e, '#api')}
            className="w-full sm:w-auto px-8 py-4 glass-dark hover:bg-slate-800/80 text-white rounded-xl font-bold text-lg transition-all border border-white/10 hover:-translate-y-1 flex items-center justify-center gap-2"
          >
            <Code2 className="w-5 h-5 text-blue-400" />
            Documentação
          </a>
        </motion.div>

        {/* Floating Elements for visual depth */}
        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full animate-float pointer-events-none"></div>
        <div className="absolute top-1/3 right-0 translate-x-1/2 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full animate-float pointer-events-none" style={{ animationDelay: '-3s' }}></div>
      </section>

      {/* Benchmark Section */}
      <section id="benchmark" className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-16 border-t border-white/5 scroll-mt-24">
        <div className="mb-12 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold font-display text-white mb-4 tracking-tighter"
          >
            Performance
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 max-w-xl mx-auto text-sm"
          >
            Métricas reais comparando o Nexus Core com a arquitetura legada.
          </motion.p>
        </div>
        <BenchmarkTab />
      </section>

      {/* Statistics Section */}
      <section id="stats" className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-16 border-t border-white/5 relative scroll-mt-24">
        <div className="grid grid-cols-2 gap-4 relative z-10 max-w-2xl mx-auto">
          {[
            { label: 'Concorrência', value: '5 reqs/lote', icon: <Globe className="w-5 h-5" />, color: 'blue' },
            { label: 'Parser HTML', value: 'Zero-AST', icon: <Zap className="w-5 h-5" />, color: 'emerald' },
            { label: 'Resiliência', value: 'Até 2x', icon: <Activity className="w-5 h-5" />, color: 'blue' },
            { label: 'Memória', value: 'O(1)', icon: <BarChart3 className="w-5 h-5" />, color: 'indigo' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass-dark border border-white/5 p-6 rounded-3xl group hover:bg-slate-900/40 transition-all card-hover flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto sm:min-h-[160px]"
            >
              <div className={cn(
                "w-10 h-10 rounded-xl mb-4 flex items-center justify-center border transition-all group-hover:scale-110",
                stat.color === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                stat.color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
              )}>
                {stat.icon}
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white font-display mb-1 tracking-tight">{stat.value}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-16 border-t border-slate-800/50 scroll-mt-24">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold font-display text-white mb-2">Casos de Uso</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">Aplicações práticas da performance extrema do Nexus.</p>
        </div>
        <UseCasesSection />
      </section>

      {/* Architecture Section */}
      <section id="features" className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-16 border-t border-slate-800/50 bg-slate-900/20 scroll-mt-24">
        <ArchitectureTab />
      </section>

      {/* Source Code Section */}
      <section id="source" className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-16 border-t border-slate-800/50 scroll-mt-24">
        <div className="mb-10">
          <h2 className="text-2xl font-bold font-display text-white mb-2">Código Fonte</h2>
          <p className="text-slate-400 max-w-xl text-sm">Implementação principal do motor de extração híbrido.</p>
        </div>
        <div className="glass rounded-2xl border border-slate-800/50 overflow-hidden shadow-xl">
          <div className="bg-slate-900/50 px-5 py-2.5 border-b border-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                <span className="text-[10px] font-mono text-slate-400 ml-3">nexus-engine.ts</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleDownload}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-blue-900/20 active:scale-95 group"
                title="Baixar arquivo .ts completo"
              >
                <Download className="w-3.5 h-3.5 group-hover:animate-bounce" />
                Baixar Engine (.ts)
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(nexusCode);
                  // Optional: add a toast or feedback here
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-all border border-slate-700 active:scale-95"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar
              </button>
            </div>
          </div>
          <div className={cn("p-5 overflow-x-auto bg-slate-950/80 relative transition-all duration-500", isCodeExpanded ? "max-h-none" : "max-h-[300px] overflow-hidden")}>
            <pre className="text-xs font-mono leading-relaxed text-slate-300">
              {nexusCode}
            </pre>
            {!isCodeExpanded && (
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-end justify-center pb-4">
                <button 
                  onClick={() => setIsCodeExpanded(true)} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/20 transition-all"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Expandir Código
                </button>
              </div>
            )}
            {isCodeExpanded && (
              <div className="mt-6 flex justify-center border-t border-slate-800/50 pt-4">
                <button 
                  onClick={() => setIsCodeExpanded(false)} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all border border-slate-700"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  Recolher
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Playground Section */}
      <section id="playground" className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-16 border-t border-slate-800/50 scroll-mt-24">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold font-display text-white mb-2">Playground</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">Teste a velocidade do Nexus Engine em tempo real.</p>
        </div>
        <TestTab />
      </section>

      {/* API & Docs Section */}
      <section id="api" className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-16 border-t border-slate-800/50 bg-slate-900/20 scroll-mt-24">
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
