'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { WhiteboardCanvas, WhiteboardRef } from './WhiteboardCanvas';
import { Toolbar } from './Toolbar';
import { Stroke, BackgroundType, ToolType, AIAnalysisResult } from './types';
import { analyzeScratchPad } from './scratchPadClient';

// Icons
const PencilIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export interface ScratchPadDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Toggle drawer open/closed */
  onToggle: () => void;
  /** Called with analysis results from Gemini Flash Lite vision review */
  onAnalysisComplete?: (result: AIAnalysisResult) => void;
  /** Topic context for the analysis */
  topic?: string;
  /** Grade level for the analysis */
  gradeLevel?: string;
  /** Hide the built-in fixed toggle button (host provides its own trigger) */
  hideToggle?: boolean;
}

export const ScratchPadDrawer: React.FC<ScratchPadDrawerProps> = ({
  isOpen,
  onToggle,
  onAnalysisComplete,
  topic = '',
  gradeLevel = 'elementary',
  hideToggle = false,
}) => {
  // Canvas state
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#ffffff');
  const [currentWidth, setCurrentWidth] = useState<number>(4);
  const [background, setBackground] = useState<BackgroundType>(BackgroundType.GRID);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  const whiteboardRef = useRef<WhiteboardRef>(null);
  const isAnalyzingRef = useRef(false);

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  const addToHistory = useCallback((stroke: Stroke) => {
    setStrokes(prev => [...prev, stroke]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes(prev => {
      if (prev.length === 0) return prev;
      const lastStroke = prev[prev.length - 1];
      setRedoStack(r => [...r, lastStroke]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const strokeRestored = prev[prev.length - 1];
      setStrokes(s => [...s, strokeRestored]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    if (strokes.length === 0) return;
    setStrokes([]);
    setRedoStack([]);
    setLastAnalysis(null);
    setAnalysisStatus('');
  }, [strokes.length]);

  const handleExport = useCallback(() => {
    if (!whiteboardRef.current) return;
    const dataUrl = whiteboardRef.current.exportImage();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `scratchpad-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!whiteboardRef.current || isAnalyzingRef.current || strokes.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisStatus('Analyzing your work...');

    try {
      const imageBase64 = whiteboardRef.current.exportImage();
      const result = await analyzeScratchPad(
        imageBase64,
        { topic, gradeLevel },
        {
          onProgress: (_stage, message) => {
            setAnalysisStatus(message);
          }
        }
      );
      setLastAnalysis(result);
      setAnalysisStatus('');
      // Forward analysis to parent (KnowledgeCheck AI context)
      onAnalysisComplete?.(result);
    } catch (error) {
      console.error('ScratchPad analysis failed:', error);
      setAnalysisStatus('Analysis failed');
      setTimeout(() => setAnalysisStatus(''), 3000);
    } finally {
      setIsAnalyzing(false);
    }
  }, [strokes.length, topic, gradeLevel, onAnalysisComplete]);

  // Auto-analyze after 2s of inactivity when there are strokes
  useEffect(() => {
    if (strokes.length === 0 || !isOpen) return;

    const handler = setTimeout(() => {
      handleAnalyze();
    }, 2000);

    return () => clearTimeout(handler);
  }, [strokes, isOpen, handleAnalyze]);

  return (
    <>
      {/* Toggle Button - always visible (unless host provides its own trigger) */}
      {!hideToggle && (
        <button
          onClick={onToggle}
          className={`fixed right-4 bottom-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all shadow-lg ${
            isOpen
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-purple-500/25'
          }`}
          title={isOpen ? 'Close Scratch Pad' : 'Open Scratch Pad'}
        >
          {isOpen ? <CloseIcon /> : <PencilIcon />}
          <span>{isOpen ? 'Close' : 'Scratch Pad'}</span>
        </button>
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed right-0 top-0 h-full z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 'min(600px, 45vw)' }}
      >
        <div className="h-full bg-slate-950 border-l border-slate-700/50 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between bg-slate-900/80 border-b border-slate-700/50 shrink-0">
            <div className="flex items-center gap-2">
              <PencilIcon />
              <h2 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Scratch Pad
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Analysis status indicator */}
              {isAnalyzing && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  <span>{analysisStatus || 'Analyzing...'}</span>
                </div>
              )}
              {lastAnalysis && !isAnalyzing && (
                <div className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckIcon />
                  <span>Reviewed</span>
                </div>
              )}
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Analysis Summary (collapsed) */}
          {lastAnalysis && (
            <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-700/30 shrink-0">
              <div className="flex items-start gap-2">
                <SparklesIcon />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 line-clamp-2">{lastAnalysis.summary}</p>
                  {lastAnalysis.feedback && (
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{lastAnalysis.feedback}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 relative min-h-0">
            <div className="absolute inset-2">
              <WhiteboardCanvas
                ref={whiteboardRef}
                tool={currentTool}
                color={currentColor}
                width={currentWidth}
                background={background}
                strokes={strokes}
                setStrokes={setStrokes}
                addToHistory={addToHistory}
              />
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-700/50 shrink-0">
            <div className="flex justify-center">
              <Toolbar
                currentTool={currentTool}
                setTool={setCurrentTool}
                currentColor={currentColor}
                setColor={setCurrentColor}
                currentWidth={currentWidth}
                setWidth={setCurrentWidth}
                background={background}
                setBackground={setBackground}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onClear={handleClear}
                onExport={handleExport}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                canUndo={strokes.length > 0}
                canRedo={redoStack.length > 0}
                isLiveMode={false}
                onToggleLiveMode={() => {}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop overlay when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default ScratchPadDrawer;
