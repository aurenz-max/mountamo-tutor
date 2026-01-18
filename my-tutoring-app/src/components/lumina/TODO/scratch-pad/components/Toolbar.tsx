import React from 'react';
import { Pen, Eraser, Grid3X3, RotateCcw, RotateCw, Trash2, Download, CheckCircle2, Zap } from 'lucide-react';
import { BackgroundType, ToolType } from '../types';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  currentColor: string;
  setColor: (color: string) => void;
  currentWidth: number;
  setWidth: (width: number) => void;
  background: BackgroundType;
  setBackground: (bg: BackgroundType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isLiveMode: boolean;
  onToggleLiveMode: () => void;
}

const COLORS = ['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
const WIDTHS = [2, 4, 8, 12];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  currentColor,
  setColor,
  currentWidth,
  setWidth,
  background,
  setBackground,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onAnalyze,
  isAnalyzing,
  canUndo,
  canRedo,
  isLiveMode,
  onToggleLiveMode
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm shadow-xl rounded-xl p-2 flex items-center gap-4 border border-slate-200 z-10 overflow-x-auto max-w-[95vw]">
      {/* Tools */}
      <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
        <button
          onClick={() => setTool('pen')}
          className={`p-2 rounded-lg transition-colors ${currentTool === 'pen' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Pen"
        >
          <Pen size={20} />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`p-2 rounded-lg transition-colors ${currentTool === 'eraser' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Eraser"
        >
          <Eraser size={20} />
        </button>
      </div>

      {/* Styles */}
      <div className="flex items-center gap-2 border-r border-slate-200 pr-2">
        <div className="flex gap-1">
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => {
                setColor(color);
                setTool('pen');
              }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${currentColor === color && currentTool === 'pen' ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex gap-1 ml-2">
          {WIDTHS.map(width => (
            <button
              key={width}
              onClick={() => setWidth(width)}
              className={`w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100 ${currentWidth === width ? 'bg-slate-200' : ''}`}
            >
              <div 
                className="bg-slate-800 rounded-full" 
                style={{ width: Math.min(16, width), height: Math.min(16, width) }} 
              />
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
        <button
            onClick={() => {
              const types = Object.values(BackgroundType);
              const nextIndex = (types.indexOf(background) + 1) % types.length;
              setBackground(types[nextIndex]);
            }}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            title="Toggle Background"
        >
          <Grid3X3 size={20} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg ${!canUndo ? 'text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Undo"
        >
          <RotateCcw size={20} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg ${!canRedo ? 'text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Redo"
        >
          <RotateCw size={20} />
        </button>
        <button
          onClick={onClear}
          className="p-2 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600"
          title="Clear Board"
        >
          <Trash2 size={20} />
        </button>
        <button
          onClick={onExport}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          title="Export Image"
        >
          <Download size={20} />
        </button>
      </div>

       {/* AI Triggers */}
       <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
          <button
            onClick={onToggleLiveMode}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all
              ${isLiveMode 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'hover:bg-slate-100 text-slate-600 border border-transparent'}`}
            title="Toggle Real-time Feedback"
          >
            <Zap size={18} className={isLiveMode ? "fill-current" : ""} />
            <span className="hidden sm:inline">Live</span>
          </button>

          {!isLiveMode && (
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all
                ${isAnalyzing 
                  ? 'bg-purple-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'}`}
            >
              {isAnalyzing ? (
                <span className="animate-pulse">Checking...</span>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Check</span>
                </>
              )}
            </button>
          )}
          {isLiveMode && isAnalyzing && (
             <div className="text-xs text-purple-600 font-medium animate-pulse px-2">
               Updating...
             </div>
          )}
       </div>
    </div>
  );
};