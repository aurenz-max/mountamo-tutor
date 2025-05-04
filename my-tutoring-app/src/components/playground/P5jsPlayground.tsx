'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Pencil, BookOpen } from 'lucide-react';

// Import components
import ChatPanel from '@/components/playground/ChatPanel';
import CodeEditorPanel from '@/components/playground/CodeEditorPanel';
import PreviewPanel from '@/components/playground/PreviewPanel';
import SnippetManager from '@/components/playground/SnippetManager';
import SyllabusSelector from '@/components/tutoring/SyllabusSelector';

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

export default function P5jsPlayground() {
  // Get student ID from user session or context
  const studentId = 1001; // Replace with actual user ID from auth context
  
  // Shared state
  const [activeTab, setActiveTab] = useState<string>("syllabus");
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [showSyllabus, setShowSyllabus] = useState(true);
  
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
    if (activeTab === 'snippets') {
      loadSnippets();
    }
  }, [activeTab, loadSnippets]);
  
  // Effect to initialize with empty code
  useEffect(() => {
    updateCode(EMPTY_CODE);
    // Add welcome message
    addMessage('assistant', 'Welcome to P5.js Playground! First, select a skill from the curriculum, then ask me to create an interactive exhibit that demonstrates that skill.');
  }, [updateCode, addMessage]);
  
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
  setShowSyllabus(false);
  setActiveTab("gemini");
  
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

  // Toggle syllabus visibility
  const toggleSyllabus = () => {
    setShowSyllabus(!showSyllabus);
    if (!showSyllabus) {
      setActiveTab("syllabus");
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="grid grid-cols-12 gap-4 flex-grow overflow-hidden">
        {/* Editor/Chat Panel */}
        <div className="col-span-5 h-full flex flex-col">
          <Card className="h-full flex flex-col overflow-hidden">
            {/* Fixed: Using proper flex layout for full height */}
            <Tabs 
              defaultValue="syllabus" 
              value={activeTab} 
              onValueChange={setActiveTab} 
              className="flex flex-col h-full"
            >
              <div className="px-4 pt-4 flex-shrink-0">
                <TabsList className="w-full">
                  <TabsTrigger value="syllabus" className="flex-1" onClick={() => setShowSyllabus(true)}>
                    Curriculum
                  </TabsTrigger>
                  <TabsTrigger value="gemini" className="flex-1">
                    Gemini
                  </TabsTrigger>
                  <TabsTrigger value="code" className="flex-1">
                    Code {codeHasChanged && <Pencil className="h-4 w-4 ml-1 inline" />}
                  </TabsTrigger>
                  <TabsTrigger value="snippets" className="flex-1">
                    My Snippets
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Improved layout with explicit flex properties */}
              <div className="flex-grow flex flex-col overflow-hidden">
                {/* Syllabus Selector */}
                <TabsContent value="syllabus" className="flex-grow flex flex-col m-0 p-0 h-full">
                  <div className="w-full h-full p-4 overflow-auto">
                    <SyllabusSelector onSelect={handleCurriculumSelect} />
                  </div>
                </TabsContent>

                {/* Chat Panel */}
                <TabsContent value="gemini" className="flex-grow flex flex-col m-0 p-0 h-full">
                  {selectedCurriculum && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b border-blue-100 dark:border-blue-800 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                            Selected skill:
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {selectedCurriculum.subskill?.description || 
                             selectedCurriculum.skill?.description || 
                             selectedCurriculum.unit?.title}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex-grow h-full">
                    <ChatPanel 
                      messages={messages}
                      chatState={chatState}
                      sendMessage={sendMessage}
                    />
                  </div>
                </TabsContent>

                {/* Code Editor Panel */}
                <TabsContent value="code" className="flex-grow flex flex-col m-0 p-0 h-full">
                  <CodeEditorPanel 
                    code={code}
                    codeSyntaxHtml={codeSyntaxHtml}
                    onChange={editCode}
                    readOnly={chatState !== ChatState.IDLE}
                    onSave={openSaveDialog}
                  />
                </TabsContent>
                
                {/* Snippets Panel */}
                <TabsContent value="snippets" className="flex-grow flex flex-col m-0 p-0 h-full">
                  <SnippetManager 
                    snippets={snippets}
                    isLoading={isLoading}
                    onRefresh={loadSnippets}
                    onLoad={loadSnippet}
                    onEdit={editSnippet}
                    onDelete={deleteSnippet}
                    onCreateNew={openSaveDialog}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        </div>

        {/* Canvas Preview Panel */}
        <div className="col-span-7 h-full flex flex-col preview-panel">
          {selectedCurriculum && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 mb-2 rounded-md border border-blue-100 dark:border-blue-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Currently working with:
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    {selectedCurriculum.subskill?.description || 
                     selectedCurriculum.skill?.description || 
                     selectedCurriculum.unit?.title}
                  </p>
                </div>
              </div>
              <button 
                onClick={toggleSyllabus}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Change
              </button>
            </div>
          )}
          <div className="flex-grow h-full">
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
                }
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Render the SaveSnippetDialog here */}
      {renderSaveDialog()}
    </div>
  );
}