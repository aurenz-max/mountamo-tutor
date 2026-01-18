'use client';

import React, { useState } from 'react';
import { BackgroundType, ToolType } from './types';

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

// Lumina color palette
const COLORS = [
  '#ffffff', // white
  '#f472b6', // pink-400
  '#a78bfa', // violet-400
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#f87171', // red-400
];

const WIDTHS = [2, 4, 8, 12];

// Icons as inline SVGs for better control
const PenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
  </svg>
);

const EraserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20H7L3 16a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l6.6 6.6a1 1 0 0 1 0 1.4L15 20" />
    <path d="M6 12l5 5" />
  </svg>
);

const HighlighterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 11-6 6v3h9l3-3" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </svg>
);

const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

const UndoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

const RedoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
  </svg>
);

const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7,10 12,15 17,10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z" />
    <path d="M19 11l.5 1.5L21 13l-1.5.5L19 15l-.5-1.5L17 13l1.5-.5L19 11z" />
  </svg>
);

const ZapIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
  </svg>
);

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
  const [showWidthPicker, setShowWidthPicker] = useState(false);

  return (
    <div className="bg-slate-800/90 backdrop-blur-md shadow-2xl rounded-2xl p-3 flex items-center gap-3 border border-slate-600/50 overflow-x-auto max-w-[95vw]">
      {/* Drawing Tools */}
      <div className="flex items-center gap-1 border-r border-slate-600/50 pr-3">
        <button
          onClick={() => setTool('pen')}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            currentTool === 'pen'
              ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
              : 'hover:bg-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Pen"
        >
          <PenIcon />
        </button>
        <button
          onClick={() => setTool('highlighter')}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            currentTool === 'highlighter'
              ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/25'
              : 'hover:bg-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Highlighter"
        >
          <HighlighterIcon />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            currentTool === 'eraser'
              ? 'bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-lg'
              : 'hover:bg-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Eraser"
        >
          <EraserIcon />
        </button>
      </div>

      {/* Colors */}
      <div className="flex items-center gap-1.5 border-r border-slate-600/50 pr-3">
        {COLORS.map(color => (
          <button
            key={color}
            onClick={() => {
              setColor(color);
              if (currentTool === 'eraser') setTool('pen');
            }}
            className={`w-7 h-7 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
              currentColor === color && currentTool !== 'eraser'
                ? 'border-white scale-110 shadow-lg'
                : 'border-transparent hover:border-slate-500'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Stroke Width */}
      <div className="relative border-r border-slate-600/50 pr-3">
        <button
          onClick={() => setShowWidthPicker(!showWidthPicker)}
          className="p-2 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white flex items-center gap-2"
          title="Stroke Width"
        >
          <div
            className="bg-white rounded-full"
            style={{ width: Math.min(16, currentWidth + 4), height: Math.min(16, currentWidth + 4) }}
          />
        </button>
        {showWidthPicker && (
          <div className="absolute top-full left-0 mt-2 bg-slate-800 rounded-xl p-2 border border-slate-600/50 shadow-xl flex gap-1">
            {WIDTHS.map(width => (
              <button
                key={width}
                onClick={() => {
                  setWidth(width);
                  setShowWidthPicker(false);
                }}
                className={`w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors ${
                  currentWidth === width ? 'bg-slate-700' : ''
                }`}
              >
                <div
                  className="bg-white rounded-full"
                  style={{ width: Math.min(20, width + 4), height: Math.min(20, width + 4) }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Background Toggle */}
      <div className="border-r border-slate-600/50 pr-3">
        <button
          onClick={() => {
            const types = Object.values(BackgroundType);
            const nextIndex = (types.indexOf(background) + 1) % types.length;
            setBackground(types[nextIndex]);
          }}
          className="p-2.5 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title={`Background: ${background}`}
        >
          <GridIcon />
        </button>
      </div>

      {/* History Actions */}
      <div className="flex items-center gap-1 border-r border-slate-600/50 pr-3">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2.5 rounded-xl transition-colors ${
            !canUndo
              ? 'text-slate-600 cursor-not-allowed'
              : 'hover:bg-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Undo"
        >
          <UndoIcon />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2.5 rounded-xl transition-colors ${
            !canRedo
              ? 'text-slate-600 cursor-not-allowed'
              : 'hover:bg-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Redo"
        >
          <RedoIcon />
        </button>
        <button
          onClick={onClear}
          className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
          title="Clear Board"
        >
          <TrashIcon />
        </button>
        <button
          onClick={onExport}
          className="p-2.5 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="Export Image"
        >
          <DownloadIcon />
        </button>
      </div>

      {/* AI Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleLiveMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all duration-200 ${
            isLiveMode
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25'
              : 'hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-600/50'
          }`}
          title="Toggle Real-time Feedback"
        >
          <ZapIcon filled={isLiveMode} />
          <span className="hidden sm:inline text-sm">Live</span>
        </button>

        {!isLiveMode && (
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white transition-all duration-200 ${
              isAnalyzing
                ? 'bg-purple-500/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30'
            }`}
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-sm">Analyzing...</span>
              </>
            ) : (
              <>
                <SparklesIcon />
                <span className="text-sm">Check Work</span>
              </>
            )}
          </button>
        )}

        {isLiveMode && isAnalyzing && (
          <div className="flex items-center gap-2 text-xs text-purple-400 font-medium animate-pulse px-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping" />
            Updating...
          </div>
        )}
      </div>
    </div>
  );
};
