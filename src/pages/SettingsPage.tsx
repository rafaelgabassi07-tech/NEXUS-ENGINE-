import React from 'react';
import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SettingsTab } from '../components/SettingsTab';

export function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 sm:px-6 pt-32 pb-12">
      <div className="max-w-7xl mx-auto">
        <Link to="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">&larr; Voltar para Home</Link>
        <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <Settings className="w-8 h-8" />
          Configurações do Motor
        </h1>
        <div className="glass rounded-2xl border border-slate-800 p-8">
          <SettingsTab />
        </div>
      </div>
    </div>
  );
}
