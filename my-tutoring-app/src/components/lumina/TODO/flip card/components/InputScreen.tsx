import React, { useState } from 'react';
import { Sparkles, BrainCircuit } from 'lucide-react';

interface InputScreenProps {
  onStart: (topic: string) => void;
  isLoading: boolean;
}

export const InputScreen: React.FC<InputScreenProps> = ({ onStart, isLoading }) => {
  const [topic, setTopic] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !isLoading) {
      onStart(topic);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center text-center animate-slide-in">
      <div className="mb-8 p-4 bg-indigo-500/10 rounded-full text-indigo-400 border border-indigo-500/30">
        <BrainCircuit size={48} />
      </div>
      
      <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-6 pb-2">
        FlashBurst
      </h1>
      
      <p className="text-slate-400 text-lg mb-10 max-w-md">
        Master any subject with AI-generated rapid-fire flashcards. Just type a topic and start learning.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-md relative">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Human Anatomy, React Hooks, Spanish Verbs..."
          className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl px-6 py-4 text-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all"
          disabled={isLoading}
          autoFocus
        />
        <button
            type="submit"
            disabled={!topic.trim() || isLoading}
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg px-6 font-bold transition-all flex items-center gap-2"
        >
            {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
                <>
                  Generate <Sparkles size={16} />
                </>
            )}
        </button>
      </form>

      <div className="mt-12 flex gap-4 text-sm text-slate-500">
        <span className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700">Biology</span>
        <span className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700">History</span>
        <span className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700">Coding</span>
      </div>
    </div>
  );
};
