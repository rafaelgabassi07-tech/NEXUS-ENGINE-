import { useState, useEffect, type MouseEvent } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Focus, Settings, MessageCircleQuestion, Menu, X } from 'lucide-react';
import { cn } from './lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import HomePage from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { FAQPage } from './pages/FAQPage';

/**
 * Component that resets scroll to top on every route change.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, href: string, isExternal?: boolean) => {
    if (isExternal) return;
    e.preventDefault();
    setIsMobileMenuOpen(false);
    
    if (href.startsWith('#')) {
      const targetId = href.replace('#', '');
      if (location.pathname !== '/') {
        navigate('/');
        // Wait for navigation to complete before scrolling
        setTimeout(() => {
          const element = document.getElementById(targetId);
          if (element) {
            const headerOffset = 100;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            try { window.history.pushState(null, '', href); } catch (err) {}
          }
        }, 300);
      } else {
        const element = document.getElementById(targetId);
        if (element) {
          const headerOffset = 100;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.scrollY - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
          try { window.history.pushState(null, '', href); } catch (err) {}
        }
      }
    } else {
      navigate(href);
    }
  };

  const navLinks = [
    { href: 'https://benchmarck-script.vercel.app', label: 'Benchmarks', isExternal: true },
    { href: '#use-cases', label: 'Casos de Uso' },
    { href: '#features', label: 'Arquitetura' },
    { href: '#source', label: 'Código' },
    { href: '#playground', label: 'Playground' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 py-4">
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
            <Focus className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight font-display text-white group-hover:text-blue-400 transition-colors">Nexus Engine</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest -mt-1">Ultra v10.1</span>
          </div>
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          {navLinks.map(link => (
            <a 
              key={link.href} 
              href={link.href} 
              onClick={(e) => handleNavClick(e, link.href, link.isExternal)} 
              target={link.isExternal ? "_blank" : undefined}
              rel={link.isExternal ? "noopener noreferrer" : undefined}
              className="hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="h-4 w-px bg-slate-800" />
          <Link to="/settings" className="hover:text-white transition-colors" title="Configurações">
            <Settings className="w-5 h-5" />
          </Link>
          <Link to="/faq" className="hover:text-white transition-colors" title="Dúvidas Frequentes">
            <MessageCircleQuestion className="w-5 h-5" />
          </Link>
        </div>
        
        <button className="md:hidden p-2 text-slate-400 hover:text-white transition-colors" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-800/50 bg-slate-950/98 backdrop-blur-2xl overflow-hidden"
          >
            <div className="px-6 py-8 flex flex-col gap-4">
              {navLinks.map(link => (
                <a 
                  key={link.href} 
                  href={link.href} 
                  onClick={(e) => handleNavClick(e, link.href, link.isExternal)} 
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "noopener noreferrer" : undefined}
                  className="text-lg font-bold text-slate-300 hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <div className="border-t border-slate-800 pt-4 flex gap-4">
                <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <Settings className="w-5 h-5" /> Configurações
                </Link>
                <Link to="/faq" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <MessageCircleQuestion className="w-5 h-5" /> Dúvidas
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default function App() {
  useEffect(() => {
    // Force scroll to top on initial load
    window.scrollTo(0, 0);
    
    // Disable browser's automatic scroll restoration to prevent jumping
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white overflow-x-hidden">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/faq" element={<FAQPage />} />
        </Routes>
        <footer className="border-t border-slate-800/50 py-8 text-center text-slate-500 text-sm">
          <p>Nexus Engine Ultra v10.1 &copy; 2026. Construído para alta performance.</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

