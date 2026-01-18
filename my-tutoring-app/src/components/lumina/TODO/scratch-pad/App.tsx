import React, { useState, useRef, useCallback, useEffect } from 'react';
import { WhiteboardCanvas, WhiteboardRef } from './components/WhiteboardCanvas';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { Stroke, BackgroundType, AIAnalysisResult, ToolType } from './types';
import { analyzeScratchpad } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#000000');
  const [currentWidth, setCurrentWidth] = useState<number>(2);
  const [background, setBackground] = useState<BackgroundType>(BackgroundType.GRID);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);

  const whiteboardRef = useRef<WhiteboardRef>(null);
  
  // Ref to track analyzing state in effects/callbacks without triggering re-renders
  const isAnalyzingRef = useRef(false);
  useEffect(() => { isAnalyzingRef.current = isAnalyzing; }, [isAnalyzing]);

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
    if (confirm("Are you sure you want to clear the whiteboard?")) {
      setStrokes([]);
      setRedoStack([]);
      setAnalysisResult(null);
    }
  }, []);

  const handleExport = useCallback(() => {
    if (!whiteboardRef.current) return;
    const dataUrl = whiteboardRef.current.exportImage();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `scratchpad-${new Date().toISOString()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleAnalyze = useCallback(async (isAuto = false) => {
    if (!whiteboardRef.current) return;
    
    // Skip if already analyzing
    if (isAnalyzingRef.current) return;

    setIsAnalyzing(true);
    // Only open sidebar automatically on manual trigger to avoid intrusive behavior in auto mode
    if (!isAuto && !isSidebarOpen) setIsSidebarOpen(true);
    
    try {
      const imageBase64 = whiteboardRef.current.exportImage();
      const resultJsonString = await analyzeScratchpad(imageBase64);
      
      try {
        const parsed: AIAnalysisResult = JSON.parse(resultJsonString);
        setAnalysisResult(parsed);
      } catch (e) {
        console.error("Failed to parse AI response JSON", e);
        // Fallback if the AI didn't return perfect JSON
        setAnalysisResult({
          summary: "Could not parse analysis.",
          feedback: resultJsonString,
          latex: null
        });
      }
    } catch (error) {
      console.error("Analysis failed", error);
      setAnalysisResult({
        summary: "Error connecting to AI.",
        feedback: "Please check your internet connection or API key and try again.",
        latex: null
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [isSidebarOpen]);

  // Debounced auto-analyze for Live Mode
  useEffect(() => {
    if (!isLiveMode || strokes.length === 0) return;

    const handler = setTimeout(() => {
      handleAnalyze(true);
    }, 1200); // Wait 1.2s after last stroke before analyzing

    return () => clearTimeout(handler);
  }, [strokes, isLiveMode, handleAnalyze]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Main Canvas Area */}
      <div className={`relative flex-1 h-full transition-all duration-300 ${isSidebarOpen ? 'mr-80' : 'mr-0'}`}>
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

      {/* Sidebar Panel */}
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        analysis={analysisResult}
        isLoading={isAnalyzing}
        isLiveMode={isLiveMode}
      />
    </div>
  );
};

export default App;