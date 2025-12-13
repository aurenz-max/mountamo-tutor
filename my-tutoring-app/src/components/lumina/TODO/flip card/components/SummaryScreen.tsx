import React from 'react';
import { RotateCcw, Trophy, Target } from 'lucide-react';
import { GameStats } from '../types';

interface SummaryScreenProps {
  stats: GameStats;
  onRestart: () => void;
  onNewTopic: () => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({ stats, onRestart, onNewTopic }) => {
  const total = stats.correct + stats.incorrect;
  const percentage = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

  return (
    <div className="w-full max-w-lg mx-auto px-6 py-12 flex flex-col items-center text-center animate-slide-in">
      <h2 className="text-3xl font-bold text-white mb-8">Session Complete!</h2>
      
      <div className="grid grid-cols-2 gap-4 w-full mb-8">
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col items-center">
            <Trophy className="text-yellow-400 mb-2" size={32} />
            <span className="text-3xl font-bold text-white">{percentage}%</span>
            <span className="text-slate-400 text-sm">Accuracy</span>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col items-center">
            <Target className="text-emerald-400 mb-2" size={32} />
            <span className="text-3xl font-bold text-white">{stats.correct}/{total}</span>
            <span className="text-slate-400 text-sm">Correct Cards</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <button
            onClick={onRestart}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
        >
            <RotateCcw size={20} />
            Review Again
        </button>
        <button
            onClick={onNewTopic}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold text-lg transition-all border border-slate-700"
        >
            Choose New Topic
        </button>
      </div>
    </div>
  );
};
