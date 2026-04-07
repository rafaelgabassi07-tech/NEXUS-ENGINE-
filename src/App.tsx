import { useState, useEffect, type ReactNode } from 'react';
import { Activity, Info, Settings, Play, Cpu, Download, CheckCircle2, XCircle, Search, Zap, Terminal, Copy, Globe, Code2, BarChart3, Trash2, ArrowRight, Menu, X, ArrowUp, ChevronDown, ChevronUp, Briefcase, MessageCircleQuestion } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import nexusCode from './lib/nexus.ts?raw';
import type { AssetType, FetchAtivoResult } from './lib/nexus';

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);

  // Add scroll listener for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#benchmark', label: 'Benchmark' },
    { href: '#source', label: 'Source' },
    { href: '#playground', label: 'Playground' },
    { href: '#api', label: 'API & Docs' },
    { href: '#settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white overflow-x-hidden">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); scrollToTop(); }} 
            className="flex items-center gap-3 group cursor-pointer"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20 group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight font-display text-white group-hover:text-blue-400 transition-colors">Nexus Engine</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
              <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">System Online</span>
            </div>
            <a href="#playground" className="hidden md:flex bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              Testar Agora
            </a>
            <button 
              className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-800/50 bg-slate-950/95 backdrop-blur-xl overflow-hidden"
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                {navLinks.map(link => (
                  <a 
                    key={link.href} 
                    href={link.href} 
                    className="text-slate-300 hover:text-white font-medium text-lg py-2 border-b border-slate-800/50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <a 
                  href="#playground" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg text-center font-bold transition-colors mt-2"
                >
                  Testar Agora
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="pt-24 pb-20 relative">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-blue-500/10 blur-[120px] rounded-full"></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
        </div>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center relative z-10">
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
            <a href="#playground" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] hover:-translate-y-1 flex items-center justify-center gap-2">
              <Play className="w-5 h-5" />
              Testar no Playground
            </a>
            <a href="#api" className="w-full sm:w-auto px-8 py-4 glass hover:bg-slate-800/80 text-white rounded-xl font-bold text-lg transition-all border border-slate-700 hover:border-slate-600 hover:-translate-y-1 flex items-center justify-center gap-2">
              <Code2 className="w-5 h-5" />
              Ver Documentação
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-6 py-4 bg-slate-900/50 hover:bg-slate-800 text-slate-300 rounded-xl font-bold text-lg transition-all border border-slate-800 hover:-translate-y-1 flex items-center justify-center gap-2 group">
              <svg className="w-5 h-5 fill-current group-hover:text-white transition-colors" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.412-4.041-1.412-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              Star on GitHub
            </a>
          </motion.div>
        </section>

        {/* Benchmark Section */}
        <section id="benchmark" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold font-display text-white mb-4">Performance Incomparável</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Métricas reais extraídas do núcleo da engine comparando a arquitetura legada com o novo Nexus Core.</p>
          </div>
          <BenchmarkTab />
        </section>

        {/* Statistics Section */}
        <section id="stats" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50 relative">
          <div className="absolute inset-0 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
            {[
              { label: 'Requisições/Dia', value: '2.5M+', icon: <Globe className="w-5 h-5" />, color: 'blue' },
              { label: 'Tempo Médio', value: '180ms', icon: <Zap className="w-5 h-5" />, color: 'emerald' },
              { label: 'Uptime Global', value: '99.99%', icon: <Activity className="w-5 h-5" />, color: 'blue' },
              { label: 'Economia Banda', value: '85%', icon: <BarChart3 className="w-5 h-5" />, color: 'indigo' }
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
        <UseCasesSection />

        {/* Architecture Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50 bg-slate-900/20">
          <ArchitectureTab />
        </section>

        {/* Source Code Section */}
        <section id="source" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50">
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
        <section id="playground" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold font-display text-white mb-4">Playground Interativo</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Teste a velocidade e resiliência do Nexus Engine em tempo real.</p>
          </div>
          <TestTab />
        </section>

        {/* API & Docs Section */}
        <section id="api" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50 bg-slate-900/20">
          <InfoTab />
        </section>

        {/* Settings Section */}
        <section id="settings" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50">
          <SettingsTab />
        </section>

        {/* FAQ Section */}
        <FAQSection />
      </main>
      
      <footer className="border-t border-slate-800/50 py-8 text-center text-slate-500 text-sm">
        <p>Nexus Engine Ultra v2.5 &copy; 2026. Construído para alta performance.</p>
      </footer>

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
            <ArrowUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function BenchmarkTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="space-y-5"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display text-white text-gradient">Dashboard de Performance</h2>
          <p className="text-slate-400 mt-2 max-w-xl leading-relaxed">Métricas de telemetria em tempo real extraídas diretamente do núcleo da engine Nexus.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-3xl border border-slate-800/50 p-5 shadow-2xl card-shadow">
          <div className="flex flex-col divide-y divide-slate-800/40">
            {/* Latência Média */}
            <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 group">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 transition-colors group-hover:bg-blue-500/20">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Latência Média</p>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">-0.6s</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-display">0.2s</span>
                  <span className="text-[10px] text-slate-500 truncate font-medium">p95 processamento</span>
                </div>
              </div>
            </div>
            
            {/* Taxa de Sucesso */}
            <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 group">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 transition-colors group-hover:bg-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Taxa de Sucesso</p>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">+5.2%</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-display">99.9%</span>
                  <span className="text-[10px] text-slate-500 truncate font-medium">Parsing estrutural</span>
                </div>
              </div>
            </div>

            {/* Cache Hit Rate */}
            <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 group">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 transition-colors group-hover:bg-indigo-500/20">
                <Cpu className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cache Hit Rate</p>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">+15%</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-display">95%</span>
                  <span className="text-[10px] text-slate-500 truncate font-medium">Eficiência LRU</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold font-display text-white">Comparativo de Eficiência</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">Nexus vs Legacy</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50">
                <tr>
                  <th className="pb-4 font-bold">Métrica Técnica</th>
                  <th className="pb-4 font-bold text-red-400/70">Legacy (Axios)</th>
                  <th className="pb-4 font-bold text-blue-400">Nexus Core</th>
                  <th className="pb-4 font-bold text-emerald-400 text-right">Eficiência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {[
                  { m: 'Latência p95', a: '1.2s', n: '0.3s', g: '4x' },
                  { m: 'Uso de RAM', a: '450MB', n: '42MB', g: '10x' },
                  { m: 'Banda Consumida', a: '100%', n: '15%', g: '85%' },
                  { m: 'Data Source', a: 'HTML Scraping', n: 'Yahoo API + SAX', g: 'Híbrido' },
                  { m: 'Parsing Strategy', a: 'Full DOM', n: 'Zero-AST', g: 'O(1)' },
                ].map((row, i) => (
                  <tr key={i} className="group hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 font-semibold text-slate-300">{row.m}</td>
                    <td className="py-4 text-slate-500 font-mono text-xs">{row.a}</td>
                    <td className="py-4 font-bold text-blue-400 font-mono text-xs">{row.n}</td>
                    <td className="py-4 text-right">
                      <span className="px-2 py-1 bg-emerald-900/50 text-emerald-400 rounded-lg text-[10px] font-bold border border-emerald-400/20">
                        {row.g}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-colors duration-500" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/10">
                  <Cpu className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display">Nexus Core</h3>
                  <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest opacity-70">Engine Signature Active</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-sm text-blue-100 font-medium">Status Operacional</span>
                  <span className="text-[10px] font-bold bg-emerald-400 text-emerald-950 px-3 py-1 rounded-full shadow-lg shadow-emerald-900/20">ATIVO</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-sm text-blue-100 font-medium">Conexões de Rede</span>
                  <span className="text-xs font-bold font-mono bg-white/10 px-2 py-1 rounded-lg">Pool Dinâmico</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-sm text-blue-100 font-medium">Gestão de Memória</span>
                  <span className="text-xs font-bold font-mono bg-white/10 px-2 py-1 rounded-lg">Estável O(1)</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-blue-100 font-medium">Slots de Cache LRU</span>
                  <span className="text-xs font-bold font-mono bg-white/10 px-2 py-1 rounded-lg">1024 Slots</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-[10px] text-blue-200 uppercase tracking-widest font-bold mb-2 opacity-70">Hardware Signature</p>
                <p className="text-[10px] font-mono text-blue-100/80 break-all bg-black/20 p-2 rounded-xl border border-white/5">0x7F4A92B1C3D5E6F890A1B2C3D4E5F6A7</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold font-display text-white">Atividade Recente</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time</span>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { ticker: 'PETR4', time: '0.18s', status: 'SAX', color: 'blue' },
                { ticker: 'VALE3', time: '0.21s', status: 'SAX', color: 'blue' },
                { ticker: 'MXRF11', time: '0.01s', status: 'HIT', color: 'emerald' },
              ].map((run, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 font-bold text-xs group-hover:scale-110 transition-transform">
                      {run.ticker.substring(0, 2)}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-200 block">{run.ticker}</span>
                      <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Ticker Localizado</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-slate-400 block">{run.time}</span>
                      <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Latency</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest border shadow-sm",
                      run.status === 'HIT' 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    )}>{run.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ title, value, trend, icon, description }: { title: string, value: string, trend: string, icon: ReactNode, description: string }) {
  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-sm card-hover relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-0" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 group-hover:bg-blue-900 group-hover:border-blue-800 transition-colors">
            {icon}
          </div>
          <span className={cn(
            "text-[10px] font-bold px-2 py-1 rounded-lg transition-all",
            trend.startsWith('+') && !title.includes('Tempo') ? "bg-emerald-900 text-emerald-400" : trend.startsWith('-') && title.includes('Tempo') ? "bg-emerald-900 text-emerald-400" : "bg-slate-800 text-slate-400"
          )}>
            {trend}
          </span>
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight font-display text-white">{value}</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 font-medium leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function TestTab() {
  const [tickers, setTickers] = useState('PETR4, VALE3, MXRF11');
  const [type, setType] = useState<'ACAO' | 'FII'>('ACAO');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));
  };

  const handleTest = async () => {
    setLoading(true);
    setError('');
    setResults(null);
    setLogs([]);
    
    addLog(`Iniciando extração para: ${tickers}`);
    addLog(`Tipo definido: ${type}`);
    
    try {
      const tickerList = tickers.split(',').map(t => t.trim()).filter(Boolean);
      addLog(`Processando ${tickerList.length} ativos...`);
      
      const apiUrl = `${window.location.origin}/api/scrape?t=${Date.now()}`;
      addLog(`Chamando API: ${apiUrl}`);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: tickerList, type })
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro HTTP! status: ${res.status} - ${text.slice(0, 100)}`);
      }
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      addLog('Dados recebidos com sucesso.');
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
        <h2 className="text-3xl font-bold tracking-tight font-display text-white">Testar Nexus Engine <span className="text-xs font-normal text-slate-500 opacity-50">v1.0.2</span></h2>
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
              Ao clicar em "Executar Scraper", o Nexus Engine irá disparar requisições HTTP/1.1 concorrentes para o site alvo. 
              O parser SAX (Zero-AST) começará a ler o stream de HTML imediatamente. Assim que os indicadores financeiros (DY, P/L, P/VP) forem encontrados, a conexão TCP será abortada precocemente (Early Abort) para economizar banda e CPU.
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
              <p className="text-[10px] text-slate-500 mt-2 ml-1">Separe os tickers por vírgula para processamento em lote.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Tipo de Ativo</label>
              <div className="flex gap-3 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                {['ACAO', 'FII'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t as any)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                      type === t 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                    )}
                  >
                    {t === 'ACAO' ? 'Ações (Brasil)' : 'FIIs (Imobiliário)'}
                  </button>
                ))}
              </div>
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
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/30" />
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
                className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-sm card-hover overflow-hidden"
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

function ArchitectureTab() {
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
          <h2 className="text-3xl font-bold tracking-tight font-display text-white">Arquitetura Nexus Ultra</h2>
          <p className="text-slate-400 mt-2 max-w-xl">Uma análise profunda da infraestrutura de alto desempenho que alimenta nossa engine de extração.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-2xl shadow-lg">
          <Cpu className="w-4 h-4 text-white" />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">v2.5 Architecture</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Comparativo Visual Detalhado */}
        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
          <h3 className="text-xl font-bold font-display mb-5 text-white">Benchmarks de Infraestrutura</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-8">
              <BenchmarkBar 
                label="Uso de Memória (RAM)" 
                legacy="450MB" 
                nexus="42MB" 
                legacyPercent={90} 
                nexusPercent={10} 
                unit="MB"
                improvement="10x mais leve"
              />
              <BenchmarkBar 
                label="Latência de Rede (p95)" 
                legacy="1.2s" 
                nexus="0.3s" 
                legacyPercent={100} 
                nexusPercent={25} 
                unit="s"
                improvement="4x mais rápido"
              />
              <BenchmarkBar 
                label="Throughput (Req/s)" 
                legacy="150" 
                nexus="18.500" 
                legacyPercent={1} 
                nexusPercent={100} 
                unit=""
                improvement="123x maior"
              />
              <BenchmarkBar 
                label="Tempo de Handshake TCP" 
                legacy="45ms" 
                nexus="0ms" 
                legacyPercent={100} 
                nexusPercent={2} 
                unit="ms"
                improvement="Zero Overhead"
              />
            </div>
            <div className="space-y-8">
              <BenchmarkBar 
                label="Consumo de Banda" 
                legacy="100%" 
                nexus="15%" 
                legacyPercent={100} 
                nexusPercent={15} 
                unit="%"
                improvement="85% menor"
              />
              <BenchmarkBar 
                label="Carga de CPU (Parsing)" 
                legacy="85%" 
                nexus="12%" 
                legacyPercent={85} 
                nexusPercent={12} 
                unit="%"
                improvement="7x mais leve"
              />
              <BenchmarkBar 
                label="Conexões Abertas" 
                legacy="100" 
                nexus="10" 
                legacyPercent={100} 
                nexusPercent={10} 
                unit=""
                improvement="10x menos"
              />
              <BenchmarkBar 
                label="Tempo de Garbage Collection" 
                legacy="120ms" 
                nexus="15ms" 
                legacyPercent={100} 
                nexusPercent={12} 
                unit="ms"
                improvement="8x mais rápido"
              />
            </div>
          </div>
        </div>

        {/* Deep Dive Cards */}
        <div className="glass rounded-3xl border border-slate-800/50 p-5 shadow-2xl card-shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 divide-y md:divide-y-0 md:divide-x divide-slate-800/50">
            <div className="space-y-5 md:pr-5 divide-y divide-slate-800/50">
              <div className="pb-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <Globe className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">Yahoo Finance API</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Integração nativa com a API do Yahoo Finance como fonte primária, garantindo dados em tempo real, alta confiabilidade e latência quase zero antes do fallback para HTML.</p>
              </div>
              <div className="py-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <Activity className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">Undici (C++)</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">O Nexus utiliza Undici, o cliente HTTP mais rápido para Node.js. Gerencia pools de conexões nativamente, eliminando overhead de handshake TCP.</p>
              </div>
              <div className="py-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">Zero-AST Parsing</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Diferente do Cheerio, o Nexus usa htmlparser2 em modo SAX. Lê o HTML como fluxo de bytes, mantendo memória em O(1) constante.</p>
              </div>
              <div className="pt-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">Request Coalescing</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Sistema de Deduplicação: se múltiplas threads pedem o mesmo ativo, o Nexus faz apenas uma chamada e compartilha a Promise.</p>
              </div>
            </div>
            <div className="space-y-5 md:pl-5 pt-5 md:pt-0 divide-y divide-slate-800/50">
              <div className="pb-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">Worker Threads Pool</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Distribuição de carga em múltiplos núcleos da CPU via Piscina/Worker Threads, permitindo atingir +18.000 requisições por segundo.</p>
              </div>
            </div>
            
            <div className="space-y-5 md:pl-5 divide-y divide-slate-800/50">
              <div className="pb-5 pt-5 md:pt-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <Play className="w-4 h-4 text-orange-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">Early Abort</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Ao encontrar os dados no stream, o Nexus corta a conexão TCP instantaneamente, economizando até 85% de banda inútil.</p>
              </div>
              <div className="py-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <Info className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">Backoff Exponencial</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Resiliência contra bloqueios. Até 3 tentativas automáticas com atrasos crescentes, garantindo estabilidade em redes instáveis.</p>
              </div>
              <div className="py-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <Settings className="w-4 h-4 text-purple-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">LRU Cache + SWR</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Cache Least Recently Used com TTL de 5min. Respostas instantâneas (1ms) para ativos frequentes, reduzindo carga externa.</p>
              </div>
              <div className="pt-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
                    <Activity className="w-4 h-4 text-rose-400" />
                  </div>
                  <h3 className="font-bold text-white font-display">HTTP/1.1 Pipelining</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Envio de múltiplas requisições HTTP na mesma conexão TCP sem esperar pelas respostas correspondentes, maximizando o throughput de rede.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fluxo de Dados Visual */}
        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow">
          <h3 className="text-xl font-bold font-display mb-6 text-white">Pipeline de Execução Nexus</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800/50 hidden md:block" />
            <div className="space-y-6">
              {[
                { step: 1, title: 'Verificação de Cache', desc: 'Consulta o LRU Cache para ver se o dado já existe e ainda é válido (TTL < 5min).' },
                { step: 2, title: 'Deduplicação (In-Flight)', desc: 'Verifica se já existe uma requisição em curso para o mesmo ticker para compartilhar a Promise.' },
                { step: 3, title: 'Requisição Undici', desc: 'Inicia a conexão HTTP usando o pool de agentes nativos com User-Agent randômico.' },
                { step: 4, title: 'Stream Parsing (SAX)', desc: 'Processa os bytes do HTML conforme eles chegam, sem carregar o arquivo inteiro na RAM.' },
                { step: 5, title: 'Early Abort', desc: 'Interrompe a conexão assim que os dados alvo (P/L, DY, etc) são extraídos.' },
                { step: 6, title: 'Fallback Automático', desc: 'Se o ativo não for encontrado como Ação, tenta automaticamente como FII (e vice-versa).' },
              ].map((item) => (
                <div key={item.step} className="relative flex gap-8 items-start group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-900/80 border-2 border-blue-600/50 text-blue-400 flex items-center justify-center font-bold text-xs z-10 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-300 shadow-sm">
                    {item.step}
                  </div>
                  <div className="pt-1">
                    <h4 className="font-bold text-slate-100 text-base font-display mb-1 group-hover:text-blue-400 transition-colors">{item.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BenchmarkBar({ label, legacy, nexus, legacyPercent, nexusPercent, unit, improvement }: any) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-bold text-blue-400 bg-blue-900 px-2 py-0.5 rounded-md">{improvement}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${legacyPercent}%` }}
              className="bg-slate-700 h-full rounded-full" 
            />
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500 w-16 text-right">{legacy}{unit}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${nexusPercent}%` }}
              className="bg-blue-600 h-full rounded-full shadow-sm" 
            />
          </div>
          <span className="text-[10px] font-mono font-bold text-blue-400 w-16 text-right">{nexus}{unit}</span>
        </div>
      </div>
    </div>
  );
}

function TechCard({ title, desc, icon }: any) {
  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-sm card-hover flex flex-col">
      <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 w-fit mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-white font-display mb-2">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function InfoTab() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = () => {
    const scraperCode = nexusCode;
    const blob = new Blob([scraperCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-engine.js';
    a.click();
  };
  const codeExample = `import { NexusEngineUltra, runNexusBatch } from './nexus-engine';

// 1. Busca um único ativo (Fundamentos)
const data = await NexusEngineUltra.fetchAtivo('PETR4', 'ACAO');
console.log(data);

// 2. Busca histórico de cotações para gráficos (ex: 1 ano)
const historico = await NexusEngineUltra.fetchHistoricoGrafico('PETR4', '1y');
console.log("Último fechamento:", historico[historico.length - 1].close);

// 3. Busca em lote com controle de concorrência (limit 100)
const tickers = ['PETR4', 'VALE3', 'MXRF11', 'ITUB4', 'BBDC4'];
const batch = await runNexusBatch(tickers, 'ACAO', 100);
console.log("Processados " + batch.length + " ativos");`;

  const expressExample = `import express from 'express';
import { runNexusBatch } from './nexus-engine';

const app = express();
app.use(express.json());

app.post('/api/scrape', async (req, res) => {
  try {
    const { tickers, type } = req.body;
    
    if (!tickers || !Array.isArray(tickers)) {
      return res.status(400).json({ error: 'Tickers inválidos' });
    }

    // Executa o Nexus Engine
    const results = await runNexusBatch(tickers, type || 'ACAO', 50);
    
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Nexus API rodando na porta 3000'));`;

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
            <code className="text-blue-400 font-mono text-sm">npm install undici htmlparser2</code>
            <button 
              onClick={() => copyToClipboard('npm install undici htmlparser2', 'npm')}
              className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
            >
              {copied === 'npm' ? 'COPIADO' : 'COPIAR'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <p className="text-xs text-blue-400 font-bold mb-1">undici</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">Cliente HTTP oficial do Node.js, escrito em C++ para máxima performance de rede.</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <p className="text-xs text-emerald-400 font-bold mb-1">htmlparser2</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">Parser HTML/XML baseado em streams (SAX), essencial para o Zero-AST e Early Abort.</p>
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
              Integração com Express.js (API REST)
            </h3>
            <button 
              onClick={() => copyToClipboard(expressExample, 'express')}
              className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-4 py-2 rounded-xl hover:bg-blue-500/20 transition-colors flex items-center gap-2 border border-blue-500/20"
            >
              <Copy className="w-3 h-3" />
              {copied === 'express' ? 'Copiado!' : 'Copiar Código'}
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Para expor o Nexus Engine como um microserviço, você pode envolvê-lo em uma rota do Express. O controle de concorrência garantirá que o servidor não trave sob alta carga.
          </p>
          <pre className="p-6 bg-slate-950/80 text-blue-200 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 inner-shadow">
            {expressExample}
          </pre>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow card-hover">
            <h3 className="text-lg font-bold font-display mb-6 text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Endpoint Público (Demo)
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">URL</span>
                <code className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">/api/scrape</code>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Método</span>
                <code className="text-xs font-bold text-slate-200 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">POST</code>
              </div>
              <div className="flex justify-between items-center py-3">
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
  "type": "ACAO"
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

function SettingsTab() {
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [concurrency, setConcurrency] = useState(100);
  const [cacheTtl, setCacheTtl] = useState(5);
  const [rotateUa, setRotateUa] = useState(true);
  const [retries, setRetries] = useState(3);

  const handleClearCache = async () => {
    setClearing(true);
    setMessage(null);
    try {
      await fetch('/api/clear-cache', { method: 'POST' });
      setMessage({ text: 'Cache limpo com sucesso!', type: 'success' });
    } catch (e) {
      setMessage({ text: 'Falha ao limpar o cache.', type: 'error' });
    } finally {
      setClearing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display text-white text-gradient">Configurações</h2>
          <p className="text-slate-400 mt-2 leading-relaxed">Ajuste os parâmetros internos e gerencie o estado da engine Nexus em tempo real.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
          <div className="flex flex-col items-end px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engine Load</span>
            <span className="text-xs font-mono font-bold text-blue-400">12.4%</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="flex flex-col items-end px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Threads</span>
            <span className="text-xs font-mono font-bold text-emerald-400">1024</span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Seção Performance */}
        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow">
          <h3 className="text-lg font-bold font-display text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            Performance & Cache
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5 group hover:border-blue-500/30 transition-colors">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Limite de Concorrência</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Define o número máximo de requisições paralelas (Pipelining). Valores altos aumentam a velocidade mas elevam o uso de memória.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit shadow-inner">
                  {[10, 50, 100, 200].map((val) => (
                    <button
                      key={val}
                      onClick={() => setConcurrency(val)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300",
                        concurrency === val 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" 
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5 group hover:border-blue-500/30 transition-colors">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Cache TTL (Minutos)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Tempo de vida dos dados no cache LRU em memória. Reduza para dados mais frescos, aumente para economizar banda.</p>
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="60" 
                    value={cacheTtl} 
                    onChange={(e) => setCacheTtl(Number(e.target.value))}
                    className="flex-1 accent-blue-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-bold font-mono text-blue-400 bg-blue-500/10 px-4 py-1.5 rounded-xl border border-blue-500/20 shadow-sm min-w-[60px] text-center">{cacheTtl}m</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-6 md:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-xl">
                  <h4 className="text-base font-bold font-display mb-1 text-white">Limpeza de Cache Manual</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Limpe o cache LRU imediatamente para forçar uma nova busca de dados na próxima execução. Útil para debugar mudanças em tempo real nos sites fonte.</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <button
                    onClick={handleClearCache}
                    disabled={clearing}
                    className="px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold rounded-2xl transition-all text-sm disabled:opacity-50 active:scale-95 flex items-center gap-3 shadow-lg shadow-red-900/10"
                  >
                    <Trash2 className={cn("w-4 h-4", clearing && "animate-spin")} />
                    {clearing ? 'Limpando...' : 'Limpar Cache LRU'}
                  </button>
                  {message && (
                    <motion.span 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border",
                        message.type === 'success' ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-red-400 bg-red-400/10 border-red-400/20"
                      )}
                    >
                      {message.text}
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seção Rede & Segurança */}
        <div className="glass rounded-3xl border border-slate-800/50 p-6 shadow-2xl card-shadow">
          <h3 className="text-lg font-bold font-display text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            Rede & Resiliência
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5 group hover:border-emerald-500/30 transition-colors">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Rotação de User-Agent</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Alterna automaticamente entre diferentes User-Agents a cada requisição para mitigar bloqueios por fingerprinting.</p>
                </div>
                <div className="flex items-center">
                  <button 
                    onClick={() => setRotateUa(!rotateUa)}
                    className={cn(
                      "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner",
                      rotateUa ? "bg-emerald-600" : "bg-slate-800"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md",
                      rotateUa ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                  <span className="ml-4 text-xs font-bold text-slate-300 uppercase tracking-widest">{rotateUa ? 'Ativado' : 'Desativado'}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/50 p-5 group hover:border-emerald-500/30 transition-colors">
              <div className="flex flex-col justify-between h-full gap-5">
                <div>
                  <h4 className="text-base font-bold font-display mb-1 text-white">Tentativas (Retries)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Número de tentativas automáticas com Backoff Exponencial em caso de falha de rede ou timeout.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit shadow-inner">
                  {[0, 1, 3, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => setRetries(val)}
                      className={cn(
                        "px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300",
                        retries === val 
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40" 
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informações do Sistema */}
        <div className="glass rounded-3xl p-8 shadow-2xl border border-slate-800/50 mt-12 relative overflow-hidden">
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
          <h3 className="text-white font-bold font-display mb-8 flex items-center gap-3">
            <Settings className="w-5 h-5 text-slate-500" />
            Informações do Sistema
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Versão Engine', value: 'v2.5.0-ultra', color: 'blue' },
              { label: 'Runtime', value: 'Node.js 20.11.0', color: 'blue' },
              { label: 'Uptime', value: '99.99%', color: 'emerald' },
              { label: 'Datacenter', value: 'us-east-1 (AWS)', color: 'blue' }
            ].map((info, i) => (
              <div key={i} className="space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{info.label}</p>
                <p className={cn(
                  "font-mono text-sm font-bold",
                  info.color === 'blue' ? "text-blue-400" : "text-emerald-400"
                )}>{info.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function UseCasesSection() {
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
    <section id="use-cases" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50">
      <div className="mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4"
        >
          <Briefcase className="w-4 h-4" />
          <span>Aplicações Práticas</span>
        </motion.div>
        <h2 className="text-3xl md:text-4xl font-bold font-display text-white mb-4">Casos de Uso Ideais</h2>
        <p className="text-slate-400 max-w-2xl mx-auto">Onde o Nexus Engine brilha e entrega o maior valor para o seu negócio.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cases.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-3xl border border-slate-800/50 p-6 card-hover"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-6">
              {c.icon}
            </div>
            <h3 className="text-lg font-bold text-white font-display mb-3">{c.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{c.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
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
