import React from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FAQSection } from '../components/FAQSection';

export function FAQPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 pt-32">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">&larr; Voltar para Home</Link>
        <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <MessageCircleQuestion className="w-8 h-8" />
          Dúvidas Frequentes
        </h1>
        <div className="glass rounded-2xl border border-slate-800 p-8">
          <FAQSection />
        </div>
      </div>
    </div>
  );
}
