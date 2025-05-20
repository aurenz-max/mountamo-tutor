'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, RefreshCw, Sparkles, Layers, 
  Code, MessageSquare, Save, Layout, Info,
  BookOpen, X, Pencil
} from 'lucide-react';
import { Card } from "@/components/ui/card";

// Import components
import ChatPanel from '@/components/playground/ChatPanel';
import ImprovedCodeEditor from '@/components/playground/ImprovedCodeEditor';
import PreviewPanel from '@/components/playground/PreviewPanel';
import ImprovedSyllabusSelector from '@/components/tutoring/SyllabusSelector';

// Import hooks
import { useP5jsCode } from '@/components/playground/hooks/useP5jsCode';
import { useChatWithGemini } from '@/components/playground/hooks/useChatWithGemini';
import { useSnippets } from '@/components/playground/hooks/useSnippets';

// Default empty code
const EMPTY_CODE = `function setup() {
  // Setup code goes here.
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  // Frame drawing code goes here.
  background(220);
  
  // Add your drawing code here
  fill(41, 98, 255);
  noStroke();
  ellipse(mouseX, mouseY, 60, 60);
}`;

// Chat state enum
export enum ChatState {
  IDLE,
  GENERATING,
  THINKING,
  CODING,
}

export default function UpdatedP5jsPlayground() {
  // Get student ID from user session or context
  const studentId = 1001; // Replace with actual user ID from auth context
  
  // Shared state
  const [activeView, setActiveView] = useState('welcome'); // New navigation state
  const [showHelp, setShowHelp] = useState(true);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  
  // Use custom hooks
  const {
    code,
    codeSyntaxHtml,
    codeHasChanged,
    codeNeedsReload,
    isRunning,
    updateCode,
    editCode,
    playSketch,
    stopSketch,
    reloadCode,
    clearCode,
    registerIframeRef,
    handleRuntimeError
  } = useP5jsCode(EMPTY_CODE);
  
  const {
    messages,
    chatState,
    sendMessage,
    addMessage,
  } = useChatWithGemini(code, codeHasChanged, updateCode, selectedCurriculum);
  
  const {
    snippets,
    isLoading,
    saveDialogOpen,
    setSaveDialogOpen,
    currentSnippet,
    setCurrentSnippet,
    tagInput,
    setTagInput,
    snippetError,
    loadSnippets,
    saveSnippet,
    loadSnippet,
    deleteSnippet,
    editSnippet,
    addTag,
    removeTag,
    renderSaveDialog
  } = useSnippets(studentId, code, updateCode, addMessage);
  
  // Effect to load snippets when switching to snippets tab
  useEffect(() => {
    if (activeView === 'code') {
      // Make sure code editor is initialized
      reloadCode();
    } else if (activeView === 'explore') {
      // Load snippets for the examples section
      loadSnippets();
    }
  }, [activeView, loadSnippets, reloadCode]);
  
  // Effect to initialize with empty code
  useEffect(() => {
    updateCode(EMPTY_CODE);
    // Add welcome message
    addMessage('assistant', 'Welcome to P5.js Playground! First, select a skill from the curriculum, then ask me to create an interactive exhibit that demonstrates that skill.');
  }, [updateCode, addMessage]);
  
  // Toggle play/pause for sketch
  const togglePlayPause = () => {
    if (isRunning) {
      stopSketch();
    } else {
      playSketch();
    }
  };
  
  // Open save dialog
  const openSaveDialog = () => {
    // Initialize with current code and generate a title
    setCurrentSnippet({
      title: generateTitleFromCode(code),
      code: code,
      description: '',
      tags: []
    });
    
    // Open the dialog
    setSaveDialogOpen(true);
  };
  
  // Generate title from code helper
  const generateTitleFromCode = (code: string): string => {
    // Try to extract a title from the code comments
    const lines = code.split('\n').map(line => line.trim());
    
    // Look for comments at the top of the file
    for (const line of lines) {
      if (line.startsWith('//')) {
        const comment = line.substring(2).trim();
        if (comment.length > 3 && comment.length < 50) {
          return comment;
        }
      }
    }
    
    // Default title if no good comment is found
    return `P5js Sketch - ${new Date().toLocaleDateString()}`;
  };

  // Handle curriculum selection
  const handleCurriculumSelect = (selectedData) => {
    setSelectedCurriculum(selectedData);
    setActiveView("create");
    
    // Extract all relevant metadata for a richer prompt
    const unitTitle = selectedData.unit?.title || "";
    const skillDescription = selectedData.skill?.description || "";
    const subskillDescription = selectedData.subskill?.description || "";
    const difficultyRange = selectedData.subskill?.difficulty_range || 
                            selectedData.skill?.difficulty_range || "";
    
    // Determine the main selected item
    let selectedItemDescription = subskillDescription || skillDescription || unitTitle;
    let contextDescription = '';
    
    // Add context from the curriculum hierarchy
    if (selectedData.subskill && selectedData.skill) {
      contextDescription = `This is part of the skill: "${selectedData.skill.description}" in the unit: "${selectedData.unit.title}".`;
    } else if (selectedData.skill) {
      contextDescription = `This is part of the unit: "${selectedData.unit.title}".`;
    }
    
    // Craft an enhanced prompt for Gemini
    const message = `I've selected the learning topic: "${selectedItemDescription}". ${contextDescription}
    
  Please create an interactive P5.js exhibit that:
  1. Clearly demonstrates this concept with visual elements
  2. Includes student interaction to reinforce learning
  3. Builds from simple to more complex examples
  4. Has comments explaining key code concepts
  5. Encourages experimentation and creative exploration

  The exhibit should be educational but engaging, allowing students to manipulate parameters and see the results in real-time.`;

    sendMessage(message);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-pink-500 rounded-md flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold">P5.js AI Playground</h1>
        </div>
        
        <div className="flex items-center space-x-1">
          <button onClick={() => setShowHelp(!showHelp)} 
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <Info className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-64 border-r bg-white dark:bg-gray-800 flex flex-col">
          {/* Main Navigation */}
          <div className="p-3 space-y-1">
            <button 
              onClick={() => setActiveView('welcome')}
              className={`w-full p-2 rounded-md flex items-center space-x-3 ${
                activeView === 'welcome' 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Layout className="h-5 w-5" />
              <span>Welcome</span>
            </button>
            
            <button 
              onClick={() => setActiveView('explore')}
              className={`w-full p-2 rounded-md flex items-center space-x-3 ${
                activeView === 'explore' 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Layers className="h-5 w-5" />
              <span>Explore Topics</span>
            </button>
            
            <button 
              onClick={() => setActiveView('create')}
              className={`w-full p-2 rounded-md flex items-center space-x-3 ${
                activeView === 'create' 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="h-5 w-5" />
              <span>Create with AI</span>
            </button>
            
            <button 
              onClick={() => setActiveView('code')}
              className={`w-full p-2 rounded-md flex items-center space-x-3 ${
                activeView === 'code' 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Code className="h-5 w-5" />
              <span>Edit Code {codeHasChanged && <Pencil className="h-4 w-4 ml-1 inline" />}</span>
            </button>
          </div>
          
          {/* Contextual Panel */}
          <div className="flex-1 p-3 overflow-y-auto border-t">
            {activeView === 'welcome' && (
              <div className="space-y-3">
                <h3 className="font-medium">Welcome to P5.js AI Playground</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create interactive sketches with AI assistance
                </p>
                <div className="space-y-2">
                  <button 
                    onClick={() => setShowHelp(true)}
                    className="w-full p-2 text-sm rounded-md bg-blue-600 text-white"
                  >
                    Start Quick Tutorial
                  </button>
                  <button 
                    onClick={() => setActiveView('explore')}
                    className="w-full p-2 text-sm rounded-md border border-gray-300 dark:border-gray-600"
                  >
                    Explore Topics
                  </button>
                </div>
              </div>
            )}
            
            {activeView === 'explore' && (
              <div className="space-y-4">
                <h3 className="font-medium">Explore Topics</h3>
                
                <div className="p-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/30 mb-4">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-400">Select a learning topic:</span>
                  </div>
                </div>
                
                {/* Curriculum Selector directly in the left panel */}
                <ImprovedSyllabusSelector onSelect={handleCurriculumSelect} />
                
                {/* Show your snippets */}
                {snippets && snippets.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Your Saved Sketches</h4>
                    <div className="space-y-2">
                      {snippets.slice(0, 4).map((snippet, index) => (
                        <div 
                          key={index} 
                          className="p-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => loadSnippet(snippet)}
                        >
                          <span className="text-sm font-medium truncate block">{snippet.title}</span>
                          {snippet.description && (
                            <span className="text-xs text-gray-500 truncate block">{snippet.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {snippets.length > 4 && (
                      <button
                        onClick={() => setActiveView('code')}
                        className="w-full mt-2 p-1 text-xs text-center text-blue-600"
                      >
                        View all ({snippets.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {activeView === 'create' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">AI Assistant</h3>
                  
                  {selectedCurriculum && (
                    <div className="flex items-center text-xs text-blue-600">
                      <BookOpen className="h-3 w-3 mr-1" />
                      <span className="truncate max-w-32">
                        {selectedCurriculum.subskill?.description || 
                         selectedCurriculum.skill?.description || 
                         selectedCurriculum.unit?.title}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="mb-2 pb-2 border-b">
                  <span className="text-xs text-gray-500">Try asking:</span>
                  <div className="space-y-1 mt-1">
                    {[
                      "Create a bouncing ball animation",
                      "Make a color-changing shape",
                      "Show me how to use mouseX and mouseY"
                    ].map((suggestion, index) => (
                      <div 
                        key={index} 
                        className="p-1.5 text-xs rounded-md bg-gray-100 dark:bg-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                        onClick={() => {
                          if (!selectedCurriculum) {
                            setActiveView('explore');
                          } else {
                            sendMessage(suggestion);
                          }
                        }}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* ChatPanel Integration */}
                <div className="flex-1 overflow-hidden">
                  <ChatPanel 
                    messages={messages}
                    chatState={chatState}
                    sendMessage={sendMessage}
                  />
                </div>
              </div>
            )}
            
            {activeView === 'code' && (
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Code Editor</h3>
                  
                  <button 
                    onClick={openSaveDialog} 
                    className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400"
                  >
                    <Save className="h-3 w-3" />
                    <span>Save</span>
                  </button>
                </div>
                
                {/* Code Editor with proper styling for visibility */}
                <div className="flex-1 border rounded-md overflow-hidden">
                  <ImprovedCodeEditor 
                    code={code}
                    onChange={editCode}
                    readOnly={chatState !== ChatState.IDLE}
                    codeSyntaxHtml={codeSyntaxHtml}
                  />
                </div>
                
                {/* Snippets Management */}
                {snippets && snippets.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Your Saved Sketches</h4>
                    <div className="max-h-40 overflow-y-auto">
                      {snippets.map((snippet, index) => (
                        <div 
                          key={index} 
                          className="p-2 mb-2 rounded-md border flex justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => loadSnippet(snippet)}
                        >
                          <div className="truncate">
                            <div className="text-sm font-medium">{snippet.title}</div>
                            {snippet.description && (
                              <div className="text-xs text-gray-500 truncate">{snippet.description}</div>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                loadSnippet(snippet);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <Code className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSnippet(snippet.id);
                              }}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Curriculum Selection Button */}
          {activeView !== 'explore' && !selectedCurriculum && (
            <div className="p-3 border-t">
              <button 
                onClick={() => setActiveView('explore')}
                className="w-full p-2 text-sm text-center rounded-md bg-blue-600 text-white"
              >
                Choose a Learning Topic
              </button>
            </div>
          )}
          
          {/* Action if curriculum is selected */}
          {activeView !== 'create' && selectedCurriculum && (
            <div className="p-3 border-t">
              <button 
                onClick={() => setActiveView('create')}
                className="w-full p-2 text-sm text-center rounded-md bg-blue-600 text-white"
              >
                Continue with AI Tutor
              </button>
            </div>
          )}
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Canvas Preview */}
          <div className="flex-1 relative bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {/* PreviewPanel Integration */}
            <PreviewPanel 
              code={code}
              isRunning={isRunning}
              codeNeedsReload={codeNeedsReload}
              onReload={reloadCode}
              onPlay={playSketch}
              onStop={stopSketch}
              onClear={clearCode}
              registerIframeRef={registerIframeRef}
              onError={(errorMsg) => {
                if (errorMsg) {
                  addMessage('system-ask', errorMsg);
                  setActiveView('create');
                }
              }}
            />
            
            {/* Contextual Help Overlay */}
            {showHelp && activeView === 'welcome' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg space-y-4">
                  <h3 className="text-lg font-medium">Welcome to P5.js AI Playground</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This interactive tool helps you learn creative coding with P5.js. Here's how to get started:
                  </p>
                  <ol className="text-sm space-y-2 list-decimal pl-5">
                    <li><strong>Explore Topics:</strong> Browse through coding concepts and examples</li>
                    <li><strong>Create with AI:</strong> Ask the AI to generate code for your ideas</li>
                    <li><strong>Edit Code:</strong> Modify the code to see how changes affect the result</li>
                  </ol>
                  <button 
                    onClick={() => setShowHelp(false)}
                    className="w-full p-2 bg-blue-600 text-white rounded-md text-sm"
                  >
                    Got it! Let's start
                  </button>
                </div>
              </div>
            )}
            
            {/* Main preview area - no overlay for curriculum selection since it's now in the left panel */}
          </div>
          
          {/* Canvas Controls */}
          <div className="p-3 bg-white dark:bg-gray-800 border-t flex items-center justify-center space-x-2">
            <button
              onClick={togglePlayPause}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button 
              onClick={reloadCode}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button 
              onClick={clearCode}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Render the SaveSnippetDialog */}
      {renderSaveDialog()}
    </div>
  );
}