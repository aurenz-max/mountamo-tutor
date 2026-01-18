'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { WhiteboardCanvas, WhiteboardRef } from './WhiteboardCanvas';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import {
  Stroke,
  BackgroundType,
  AIAnalysisResult,
  ToolType,
  ScratchPadProps,
  PrimitiveSuggestion,
  GeneratedPrimitive,
  PrimitiveViewMode
} from './types';
import { generateScratchPadProblem, AnalysisStage } from './scratchPadClient';
import {
  PrimitiveViewer,
  SplitPanelContainer,
  analyzeScratchPadWithPrimitives,
  generatePrimitiveFromSuggestion
} from './primitives';

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12,19 5,12 12,5" />
  </svg>
);

const DiceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    <circle cx="16" cy="8" r="1.5" fill="currentColor" />
    <circle cx="8" cy="16" r="1.5" fill="currentColor" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ScratchPad: React.FC<ScratchPadProps> = ({
  onBack,
  initialTopic = '',
  gradeLevel = 'elementary'
}) => {
  // --- State ---
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#ffffff');
  const [currentWidth, setCurrentWidth] = useState<number>(4);
  const [background, setBackground] = useState<BackgroundType>(BackgroundType.GRID);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);

  // Problem generation state
  const [currentProblem, setCurrentProblem] = useState<{ problem: string; hint?: string } | null>(null);
  const [isGeneratingProblem, setIsGeneratingProblem] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  // Primitive integration state
  const [suggestedPrimitives, setSuggestedPrimitives] = useState<PrimitiveSuggestion[]>([]);
  const [activePrimitive, setActivePrimitive] = useState<GeneratedPrimitive | null>(null);
  const [primitiveViewMode, setPrimitiveViewMode] = useState<PrimitiveViewMode>('hidden');
  const [loadingPrimitiveId, setLoadingPrimitiveId] = useState<string | null>(null);

  const whiteboardRef = useRef<WhiteboardRef>(null);

  // Ref to track analyzing state in effects/callbacks
  const isAnalyzingRef = useRef(false);
  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  // --- Actions ---

  const addToHistory = useCallback((stroke: Stroke) => {
    setStrokes(prev => [...prev, stroke]);
    setRedoStack([]); // Clear redo stack on new action
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
    if (confirm("Are you sure you want to clear the scratch pad?")) {
      setStrokes([]);
      setRedoStack([]);
      setAnalysisResult(null);
    }
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

  const handleAnalyze = useCallback(async (isAuto = false) => {
    if (!whiteboardRef.current) return;

    // Skip if already analyzing
    if (isAnalyzingRef.current) return;

    setIsAnalyzing(true);
    setAnalysisStage(null);
    setAnalysisMessage('');
    // Only open sidebar automatically on manual trigger
    if (!isAuto && !isSidebarOpen) setIsSidebarOpen(true);

    try {
      const imageBase64 = whiteboardRef.current.exportImage();
      const result = await analyzeScratchPadWithPrimitives(
        imageBase64,
        {
          topic: currentProblem?.problem || initialTopic,
          gradeLevel
        },
        {
          onProgress: (stage, message) => {
            setAnalysisStage(stage);
            setAnalysisMessage(message);
          }
        }
      );
      setAnalysisResult(result);

      // Update primitive suggestions if available
      if (result.shouldSuggestPrimitives && result.suggestedPrimitives?.length > 0) {
        setSuggestedPrimitives(result.suggestedPrimitives);
      } else {
        // Don't clear suggestions if we already have them and this analysis didn't find new ones
        // This prevents flickering during live mode
      }
    } catch (error) {
      console.error("Analysis failed", error);
      setAnalysisResult({
        summary: "Error connecting to AI.",
        feedback: "Please check your internet connection and try again.",
        latex: null,
        nextSteps: [],
        encouragement: "Don't give up!"
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage(null);
    }
  }, [isSidebarOpen, currentProblem, initialTopic, gradeLevel]);

  // Handle accepting a primitive suggestion
  const handleAcceptPrimitive = useCallback(async (suggestion: PrimitiveSuggestion) => {
    setLoadingPrimitiveId(suggestion.id);

    try {
      const generated = await generatePrimitiveFromSuggestion(suggestion);
      setActivePrimitive(generated);
      setPrimitiveViewMode('split');
      // Remove the accepted suggestion from the list
      setSuggestedPrimitives(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error("Failed to generate primitive:", error);
      // Could show an error toast here
    } finally {
      setLoadingPrimitiveId(null);
    }
  }, []);

  // Handle dismissing a single primitive suggestion
  const handleDismissPrimitive = useCallback((suggestionId: string) => {
    setSuggestedPrimitives(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  // Handle dismissing all primitive suggestions
  const handleDismissAllPrimitives = useCallback(() => {
    setSuggestedPrimitives([]);
  }, []);

  // Handle closing the active primitive viewer
  const handleClosePrimitive = useCallback(() => {
    setActivePrimitive(null);
    setPrimitiveViewMode('hidden');
  }, []);

  const handleGenerateProblem = useCallback(async () => {
    setIsGeneratingProblem(true);
    setShowHint(false);
    try {
      const problem = await generateScratchPadProblem(
        initialTopic || 'mathematics',
        gradeLevel,
        'medium'
      );
      setCurrentProblem(problem);
      // Clear the canvas for the new problem
      setStrokes([]);
      setRedoStack([]);
      setAnalysisResult(null);
    } catch (error) {
      console.error("Problem generation failed", error);
    } finally {
      setIsGeneratingProblem(false);
    }
  }, [initialTopic, gradeLevel]);

  // Debounced auto-analyze for Live Mode
  useEffect(() => {
    if (!isLiveMode || strokes.length === 0) return;

    const handler = setTimeout(() => {
      handleAnalyze(true);
    }, 1500); // Wait 1.5s after last stroke before analyzing

    return () => clearTimeout(handler);
  }, [strokes, isLiveMode, handleAnalyze]);

  // Canvas content component (extracted for reuse in split view)
  const CanvasContent = (
    <div className="relative h-full">
      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <ArrowLeftIcon />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}

        {/* Title */}
        <div className="flex-1 text-center">
          <h1 className="text-lg font-bold text-white">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              Scratch Pad
            </span>
          </h1>
        </div>

        {/* Generate Problem Button */}
        <button
          onClick={handleGenerateProblem}
          disabled={isGeneratingProblem}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            isGeneratingProblem
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/25'
          }`}
        >
          {isGeneratingProblem ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <DiceIcon />
              <span>New Problem</span>
            </>
          )}
        </button>
      </div>

      {/* Current Problem Display */}
      {currentProblem && (
        <div className="absolute top-20 left-4 right-4 z-10">
          <div className="bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-600/50 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Problem
                </div>
                <p className="text-white text-lg leading-relaxed">{currentProblem.problem}</p>
              </div>
              <div className="flex items-center gap-2">
                {currentProblem.hint && (
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className={`p-2 rounded-lg transition-colors ${
                      showHint
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'hover:bg-slate-700 text-slate-400 hover:text-amber-400'
                    }`}
                    title="Show Hint"
                  >
                    <LightbulbIcon />
                  </button>
                )}
                <button
                  onClick={() => setCurrentProblem(null)}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="Dismiss"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            {showHint && currentProblem.hint && (
              <div className="mt-3 pt-3 border-t border-slate-600/50">
                <p className="text-amber-300 text-sm flex items-start gap-2">
                  <LightbulbIcon />
                  <span>{currentProblem.hint}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div className={`absolute left-4 right-4 bottom-24 ${currentProblem ? 'top-44' : 'top-20'}`}>
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

      {/* Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
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
          onAnalyze={() => handleAnalyze(false)}
          isAnalyzing={isAnalyzing}
          canUndo={strokes.length > 0}
          canRedo={redoStack.length > 0}
          isLiveMode={isLiveMode}
          onToggleLiveMode={() => setIsLiveMode(!isLiveMode)}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full overflow-hidden bg-slate-950 rounded-2xl border border-slate-700/50">
      {/* Main Content Area - Split view when primitive is active */}
      <div className={`relative flex-1 h-full transition-all duration-300 ${isSidebarOpen ? 'mr-96' : 'mr-0'}`}>
        {primitiveViewMode === 'split' && activePrimitive ? (
          <SplitPanelContainer
            leftPanel={CanvasContent}
            rightPanel={
              <PrimitiveViewer
                primitive={activePrimitive}
                onClose={handleClosePrimitive}
              />
            }
            defaultSplit={55}
            minLeftWidth={400}
            minRightWidth={350}
          />
        ) : (
          CanvasContent
        )}
      </div>

      {/* Sidebar Panel */}
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        analysis={analysisResult}
        isLoading={isAnalyzing}
        isLiveMode={isLiveMode}
        progressMessage={analysisMessage}
        suggestedPrimitives={suggestedPrimitives}
        onAcceptPrimitive={handleAcceptPrimitive}
        onDismissPrimitive={handleDismissPrimitive}
        onDismissAllPrimitives={handleDismissAllPrimitives}
        loadingPrimitiveId={loadingPrimitiveId}
      />
    </div>
  );
};

export default ScratchPad;
