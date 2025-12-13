import React from 'react';
import { X, Shuffle, BookOpen } from 'lucide-react';
import { Flashcard } from '../types';

interface LibraryModalProps {
  deck: Flashcard[];
  isOpen: boolean;
  onClose: () => void;
  onShuffle: () => void;
  topic: string;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({ deck, isOpen, onClose, onShuffle, topic }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Deck Library</h2>
              <p className="text-sm text-slate-400">"{topic}"</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onShuffle}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
            >
              <Shuffle size={16} />
              Shuffle & Restart
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deck.map((card, index) => (
              <div 
                key={card.id} 
                className="group p-5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-300 transition-colors">
                        #{index + 1}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        {card.category}
                    </span>
                </div>
                <h3 className="font-bold text-white text-lg mb-2 leading-tight">
                    {card.term}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-3 mt-3">
                    {card.definition}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 text-center text-xs text-slate-500">
            Reviewing {deck.length} cards for {topic}
        </div>
      </div>
    </div>
  );
};