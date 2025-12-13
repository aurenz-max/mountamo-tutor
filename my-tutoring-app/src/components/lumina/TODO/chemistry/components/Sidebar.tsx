import React, { useState, useRef, useEffect } from 'react';
import { Send, FlaskConical, Atom, Sparkles, BookOpen, RotateCcw, Menu, X } from 'lucide-react';
import { MoleculeData, Atom as AtomType } from '../types';
import { SAMPLE_PROMPTS } from '../constants';

interface SidebarProps {
  onPromptSubmit: (prompt: string) => void;
  isLoading: boolean;
  currentData: MoleculeData | null;
  selectedAtom: AtomType | null;
  error: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  onPromptSubmit, 
  isLoading, 
  currentData, 
  selectedAtom,
  error 
}) => {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false); // Mobile toggle
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onPromptSubmit(input);
      setInput('');
      if (window.innerWidth < 768) setIsOpen(false);
    }
  };

  const handlePresetClick = (prompt: string) => {
    onPromptSubmit(prompt);
    if (window.innerWidth < 768) setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-md text-white md:hidden border border-slate-700 shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-80 bg-slate-900/95 backdrop-blur-md border-r border-slate-700
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center space-x-3 bg-slate-950/50">
          <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/20">
            <Atom className="text-white h-6 w-6 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
              MoleculAI
            </h1>
            <p className="text-xs text-slate-400">Gemini-Powered Chemistry</p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          
          {/* Active Molecule Info */}
          {currentData ? (
            <div className="animate-fade-in space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 shadow-inner">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <FlaskConical size={18} className="text-purple-400" />
                  {currentData.name}
                </h2>
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300 border border-slate-600">
                        {currentData.category.toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300 border border-slate-600">
                        {currentData.atoms.length} Atoms
                    </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed opacity-90">
                  {currentData.description}
                </p>
              </div>

              {selectedAtom && (
                <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900/50 p-4 rounded-xl border border-indigo-500/30 animate-slide-up">
                  <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Sparkles size={14} /> Selected Atom
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold bg-slate-800 border-2 border-indigo-400 shadow-lg shadow-indigo-500/20">
                        {selectedAtom.element}
                    </div>
                    <div>
                        <p className="font-bold text-white">{selectedAtom.name}</p>
                        <p className="text-xs text-slate-400">Position: ({selectedAtom.position.x.toFixed(1)}, {selectedAtom.position.y.toFixed(1)}, {selectedAtom.position.z.toFixed(1)})</p>
                    </div>
                  </div>
                  {selectedAtom.description && (
                      <p className="mt-3 text-xs text-slate-300 italic border-l-2 border-indigo-500/50 pl-2">
                          "{selectedAtom.description}"
                      </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 opacity-50">
                <Atom size={48} className="mx-auto mb-4 text-slate-600" />
                <p>Welcome to the lab.</p>
                <p className="text-sm">Start by selecting a preset or asking for a molecule.</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={14} /> Discovery Lab
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePresetClick(prompt)}
                  disabled={isLoading}
                  className="text-left px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 transition-all text-sm text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-50 group flex items-center justify-between"
                >
                  <span className="truncate">{prompt.replace("Show me ", "").replace("Generate ", "").replace("What does ", "").replace(" look like?", "")}</span>
                  <RotateCcw size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-700">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="E.g. Show me Caffeine..."
              className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-700 transition-all shadow-lg"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-2 p-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 transition-colors"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
          <p className="text-[10px] text-center text-slate-500 mt-2">
            Powered by Google Gemini 2.5. AI can make mistakes.
          </p>
        </div>
      </div>
    </>
  );
};