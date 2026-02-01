import React from 'react';
import { SimulationState } from '../types';
import { Play, Pause, FastForward, Eye, Maximize, Calendar } from 'lucide-react';

interface ControlsProps {
  state: SimulationState;
  onUpdateState: (newState: Partial<SimulationState>) => void;
}

export const Controls: React.FC<ControlsProps> = ({ state, onUpdateState }) => {
  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl p-4 flex items-center gap-6 shadow-2xl text-slate-200 z-40">
      
      {/* Play/Pause */}
      <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
        <button 
          onClick={() => onUpdateState({ paused: !state.paused })}
          className="p-3 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-all shadow-lg hover:shadow-blue-500/30"
        >
          {state.paused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
        </button>
      </div>

      {/* Speed Slider */}
      <div className="flex flex-col gap-1 w-32">
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <span>Speed</span>
          <span>{(state.timeScale / 1000).toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="100"
          max="50000"
          step="1000"
          value={state.timeScale}
          onChange={(e) => onUpdateState({ timeScale: parseInt(e.target.value) })}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* View Toggles */}
      <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
        <button
          onClick={() => onUpdateState({ viewMode: state.viewMode === 'schematic' ? 'realistic' : 'schematic' })}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${state.viewMode === 'schematic' ? 'bg-slate-800 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          title="Toggle Scale Mode"
        >
           <Maximize className="w-5 h-5" />
           <span className="text-[10px] font-medium">{state.viewMode === 'schematic' ? 'Schematic' : 'Realistic'}</span>
        </button>

        <button
          onClick={() => onUpdateState({ showOrbits: !state.showOrbits })}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${state.showOrbits ? 'bg-slate-800 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          title="Toggle Orbits"
        >
           <Eye className="w-5 h-5" />
           <span className="text-[10px] font-medium">Orbits</span>
        </button>
      </div>

      {/* Date Display */}
      <div className="hidden md:flex items-center gap-2 border-l border-slate-700 pl-4 text-sm font-mono text-blue-200">
        <Calendar className="w-4 h-4 text-slate-400" />
        {state.date.toLocaleDateString()}
      </div>

    </div>
  );
};
