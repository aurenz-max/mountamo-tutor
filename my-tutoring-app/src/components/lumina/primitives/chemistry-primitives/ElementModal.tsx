import React from 'react';
import { ChemicalElement } from './types';
import { getCategoryStyle, getHexColor } from './constants';
import { X, Activity, Sparkles } from 'lucide-react';
import { AtomVisualizer } from './AtomVisualizer';
import { StabilityChart } from './StabilityChart';

interface ElementModalProps {
  element: ChemicalElement;
  allElements: ChemicalElement[];
  onClose: () => void;
}

export const ElementModal: React.FC<ElementModalProps> = ({ element, allElements, onClose }) => {
  const categoryStyle = getCategoryStyle(element.category);
  const hexColor = getHexColor(element.category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl relative">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Left Column: Visuals */}
        <div className="w-full md:w-1/3 bg-slate-900/30 p-6 flex flex-col gap-6 overflow-y-auto border-r border-white/5">
          {/* Header Card */}
          <div
            className="aspect-[4/5] rounded-2xl flex flex-col items-center justify-center p-8 border-2 relative overflow-hidden group"
            style={categoryStyle}
          >
             <div className="absolute top-2 left-4 text-4xl font-mono opacity-50 font-bold">{element.number}</div>
             <div className="absolute top-4 right-4 text-xs font-bold uppercase tracking-wider opacity-70 text-right">{element.category}</div>

             <h1 className="text-8xl font-bold mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                {element.symbol}
             </h1>
             <h2 className="text-2xl font-medium text-white mb-1">{element.name}</h2>
             <p className="font-mono text-white/60">{element.atomic_mass.toFixed(4)} u</p>

             <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50"></div>
          </div>

          <AtomVisualizer
            symbol={element.symbol}
            atomicNumber={element.number}
            shells={element.electron_shells}
            category={element.category}
          />
        </div>

        {/* Right Column: Data & Insights */}
        <div className="w-full md:w-2/3 p-6 overflow-y-auto bg-gradient-to-br from-slate-900/50 to-slate-950/50">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Stats */}
            <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={14} /> Properties
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                 <div>
                    <span className="text-slate-500 block text-xs">Phase</span>
                    <span className="text-slate-200 font-medium">{element.phase}</span>
                 </div>
                 <div>
                    <span className="text-slate-500 block text-xs">Period / Group</span>
                    <span className="text-slate-200 font-medium">{element.period} / {element.group}</span>
                 </div>
                 <div>
                    <span className="text-slate-500 block text-xs">Electron Config</span>
                    <span className="text-slate-200 font-mono text-xs">{element.electron_configuration}</span>
                 </div>
                 <div>
                    <span className="text-slate-500 block text-xs">Valence Electrons</span>
                    <span className="text-slate-200 font-medium">{element.electron_shells[element.electron_shells.length - 1]}</span>
                 </div>
              </div>
            </div>

            {/* Stability */}
            <StabilityChart currentElement={element} allElements={allElements} />
          </div>

          {/* Octet Rule */}
          <div className="mb-6 bg-slate-800/40 rounded-xl p-4 border border-white/5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles size={14} /> Octet Rule Status
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                 <div className="h-4 bg-slate-700 rounded-full overflow-hidden relative">
                    <div
                      className="h-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${(element.electron_shells[element.electron_shells.length - 1] / 8) * 100}%`,
                        backgroundColor: hexColor
                      }}
                    ></div>
                 </div>
                 <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
                    <span>0</span>
                    <span>Valence: {element.electron_shells[element.electron_shells.length - 1]}</span>
                    <span>8 (Stable)</span>
                 </div>
              </div>
              <div className="text-sm text-slate-300 max-w-[200px]">
                 {element.electron_shells[element.electron_shells.length - 1] === 8
                   ? "Full valence shell. Highly stable."
                   : "Incomplete valence shell. Reactive."}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                About {element.name}
             </h3>
             <p className="text-slate-300 text-sm leading-relaxed">
                {element.summary}
             </p>
          </div>
        </div>

      </div>
    </div>
  );
};
