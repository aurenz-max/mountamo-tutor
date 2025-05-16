'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useP5jsCode } from '@/components/playground/hooks/useP5jsCode';
import { useSnippets } from '@/components/playground/hooks/useSnippets';
import { Code, Save, Play, Pause, RefreshCw, Trash, Folder, Plus, ArrowLeftRight } from 'lucide-react';
import PreviewPanel from '@/components/playground/PreviewPanel';
import ImprovedCodeEditor from '@/components/playground/ImprovedCodeEditor';

interface P5jsCodeEditorScreenProps {
  initialCode?: string;
  studentId?: number;
  onExit?: () => void;
}

const INITIAL_CODE = `function setup() {
  createCanvas(windowWidth, windowHeight);
  background(220);
}

function draw() {
  // Your creative code goes here!
  fill(41, 98, 255);
  noStroke();
  ellipse(mouseX, mouseY, 50, 50);
}`;

const P5jsCodeEditorScreen: React.FC<P5jsCodeEditorScreenProps> = ({
  initialCode,
  studentId = 1,
  onExit,
}) => {
  // State management
  const [layout, setLayout] = useState<'side-by-side' | 'stacked'>('side-by-side');
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [isSnippetsPanelOpen, setIsSnippetsPanelOpen] = useState(false);
  
  // Refs
  const canvasRef = useRef<HTMLIFrameElement | null>(null);
  const codeEditorRef = useRef<HTMLDivElement | null>(null);
  
  // Determine initial code - use provided code or default
  const startingCode = initialCode || INITIAL_CODE;
  
  // P5.js code management
  const {
    code,
    updateCode,
    editCode,
    isRunning,
    playSketch,
    stopSketch,
    reloadCode,
    registerIframeRef,
    codeNeedsReload,
  } = useP5jsCode(startingCode);
  
  // Snippet management
  const {
    snippets,
    isLoading: isSnippetLoading,
    saveDialogOpen,
    setSaveDialogOpen,
    currentSnippet,
    setCurrentSnippet,
    tagInput,
    setTagInput,
    snippetError,
    setSnippetError,
    editingSnippetId,
    setEditingSnippetId,
    loadSnippets,
    saveSnippet,
    loadSnippet,
    deleteSnippet,
    editSnippet,
    addTag,
    removeTag,
    renderSaveDialog
  } = useSnippets(
    studentId,
    code,
    updateCode,
    () => {} // Empty callback since we're not using messages
  );
  
  // Toggle play/pause of the sketch
  const togglePlayPause = () => {
    if (isRunning) {
      stopSketch();
    } else {
      playSketch();
    }
  };
  
  // Toggle layout between side-by-side and stacked
  const toggleLayout = () => {
    setLayout(layout === 'side-by-side' ? 'stacked' : 'side-by-side');
  };
  
  // Load snippets when component mounts
  useEffect(() => {
    loadSnippets();
  }, []);
  
  // Handle code changes
  const handleCodeChange = (newCode: string) => {
    editCode(newCode);
  };
  
  // Handle opening the save dialog
  const handleOpenSaveDialog = () => {
    setCurrentSnippet({
      title: 'My P5.js Sketch',
      code: code,
      description: 'Created in code editor',
      tags: ['p5js'],
      unit_id: '',
      unit_title: '',
      skill_id: '',
      skill_description: '',
      subskill_id: '',
      subskill_description: ''
    });
    setSaveDialogOpen(true);
  };
  
  // Handle loading a snippet
  const handleLoadSnippet = async (snippetId: string) => {
    await loadSnippet(snippetId);
    setSelectedSnippetId(snippetId);
    setIsSnippetsPanelOpen(false);
  };
  
  // Handle creating a new sketch
  const handleNewSketch = () => {
    updateCode(INITIAL_CODE);
    setSelectedSnippetId(null);
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Code className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-800">P5.js Code Editor</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSnippetsPanelOpen(!isSnippetsPanelOpen)}
              className={`p-2 rounded-lg transition-all ${
                isSnippetsPanelOpen 
                  ? 'bg-indigo-100 text-indigo-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Browse snippets"
            >
              <Folder className="w-4 h-4" />
            </button>
            
            <button
              onClick={toggleLayout}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              title={layout === 'side-by-side' ? 'Switch to stacked layout' : 'Switch to side-by-side layout'}
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            
            {onExit && (
              <button
                onClick={onExit}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Exit Editor
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Snippets Panel - Conditionally shown */}
        {isSnippetsPanelOpen && (
          <div className="w-72 border-r bg-white flex flex-col">
            <div className="p-4 border-b bg-indigo-50">
              <h2 className="font-semibold text-gray-800">Code Snippets</h2>
              <p className="text-sm text-gray-600">Load or create saved sketches</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <button
                onClick={handleNewSketch}
                className="w-full flex items-center gap-2 p-3 mb-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Sketch
              </button>
              
              {isSnippetLoading ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : snippets.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No saved snippets yet</div>
              ) : (
                <ul className="space-y-2">
                  {snippets.map((snippet) => (
                    <li 
                      key={snippet.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSnippetId === snippet.id
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => handleLoadSnippet(snippet.id)}
                    >
                      <div className="font-medium text-gray-800">{snippet.title}</div>
                      <div className="text-sm text-gray-500 mt-1 line-clamp-2">{snippet.description}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {snippet.tags.map((tag, index) => (
                          <span 
                            key={index}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this snippet?')) {
                              deleteSnippet(snippet.id);
                            }
                          }}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Delete snippet"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        
        {/* Main Editor and Preview Layout */}
        <div className={`flex-1 ${layout === 'side-by-side' ? 'flex' : 'flex flex-col'}`}>
          {/* Code Editor */}
          <div className={`bg-white flex flex-col ${layout === 'side-by-side' ? 'w-1/2 border-r' : 'h-1/2 border-b'}`} ref={codeEditorRef}>
            <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Code Editor</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleOpenSaveDialog}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 px-3 py-1 rounded-lg bg-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSnippetLoading}
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <ImprovedCodeEditor
                code={code}
                onChange={handleCodeChange}
                readOnly={false}
                codeSyntaxHtml={null}
              />
            </div>
          </div>
          
          {/* Preview Panel */}
          <div className={`bg-white flex flex-col ${layout === 'side-by-side' ? 'w-1/2' : 'h-1/2'}`}>
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Preview</h2>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm text-gray-600">
                  {isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
            
            <div className="flex-1 relative">
              <PreviewPanel
                code={code}
                isRunning={isRunning}
                codeNeedsReload={codeNeedsReload}
                onReload={reloadCode}
                onPlay={playSketch}
                onStop={stopSketch}
                onClear={() => updateCode(INITIAL_CODE)}
                registerIframeRef={(ref) => {
                  registerIframeRef(ref);
                  canvasRef.current = ref;
                }}
                onError={(error) => {
                  if (error) {
                    console.error('Sketch error:', error);
                    // We could display an error message in a toast or alert here
                  }
                }}
              />
            </div>
            
            <div className="p-3 border-t bg-gray-50 flex items-center justify-center gap-2">
              <button
                onClick={togglePlayPause}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isRunning 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isRunning ? 'Pause' : 'Play'}
              </button>
              
              <button
                onClick={reloadCode}
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Restart
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Render the save dialog */}
      {renderSaveDialog()}
    </div>
  );
};

export default P5jsCodeEditorScreen;