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
import ImprovedCodeEditor from '@/components/playground/ImprovedCodeEditor'; // Updated import
import PreviewPanel from '@/components/playground/PreviewPanel';
import SnippetManager from '@/components/playground/SnippetManager';
import ImprovedSyllabusSelector from '@/components/tutoring/SyllabusSelector';
import ExampleCard from '@/components/playground/ExampleCard';

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

// Example sketches for cards
const EXAMPLE_SKETCHES = [
  {
    title: 'Bouncing Ball',
    description: 'Physics simulation with a simple bouncing ball',
    thumbnail: 'ball',
    code: `// Bouncing Ball Animation
let x = 200;
let y = 100;
let xSpeed = 4;
let ySpeed = 3;
let radius = 30;

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(220);
  
  // Update position
  x = x + xSpeed;
  y = y + ySpeed;
  
  // Check for bouncing
  if (x > width - radius || x < radius) {
    xSpeed = -xSpeed;
  }
  if (y > height - radius || y < radius) {
    ySpeed = -ySpeed;
  }
  
  // Draw the ball
  fill(41, 98, 255);
  noStroke();
  ellipse(x, y, radius * 2, radius * 2);
}`
  },
  {
    title: 'Color Mixer',
    description: 'Interactive color mixing with mouse position',
    thumbnail: 'color',
    code: `// Color Mixer
function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  background(220);
  
  // Use mouse position to control colors
  let r = map(mouseX, 0, width, 0, 255);
  let g = map(mouseY, 0, height, 0, 255);
  let b = map(mouseX + mouseY, 0, width + height, 255, 0);
  
  // Draw a gradient background
  for (let i = 0; i < width; i += 20) {
    for (let j = 0; j < height; j += 20) {
      let rGrad = map(i, 0, width, 0, r);
      let gGrad = map(j, 0, height, 0, g);
      
      fill(rGrad, gGrad, b, 150);
      rect(i, j, 20, 20);
    }
  }
  
  // Draw center shape
  fill(r, g, b);
  ellipse(width/2, height/2, 200, 200);
  
  // Display RGB values
  fill(255);
  textSize(16);
  text(\`R: \${Math.floor(r)} G: \${Math.floor(g)} B: \${Math.floor(b)}\`, width/2 - 80, height - 50);
}`
  },
  {
    title: 'Interactive Shapes',
    description: 'Click to create random shapes on canvas',
    thumbnail: 'shapes',
    code: `// Interactive Shapes
let shapes = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(220);
  
  // Draw all shapes
  for (let shape of shapes) {
    fill(shape.color);
    noStroke();
    
    if (shape.type === 'circle') {
      ellipse(shape.x, shape.y, shape.size, shape.size);
    } else if (shape.type === 'square') {
      rectMode(CENTER);
      rect(shape.x, shape.y, shape.size, shape.size);
    } else if (shape.type === 'triangle') {
      triangle(
        shape.x, shape.y - shape.size/2,
        shape.x - shape.size/2, shape.y + shape.size/2,
        shape.x + shape.size/2, shape.y + shape.size/2
      );
    }
  }
  
  // Instructions
  fill(0);
  textSize(16);
  text('Click anywhere to add a random shape', 20, 30);
}

function mousePressed() {
  // Add a new shape when clicked
  let shapeTypes = ['circle', 'square', 'triangle'];
  let newShape = {
    x: mouseX,
    y: mouseY,
    size: random(20, 100),
    type: random(shapeTypes),
    color: color(random(255), random(255), random(255), 200)
  };
  
  shapes.push(newShape);
  
  // Limit the number of shapes to prevent slowdown
  if (shapes.length > 50) {
    shapes.shift();
  }
}`
  },
  {
    title: 'Particle System',
    description: 'Dynamic particle system with motion',
    thumbnail: 'particles',
    code: `// Particle System
let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  // Create initial particles
  for (let i = 0; i < 50; i++) {
    particles.push(createParticle());
  }
}

function draw() {
  background(0, 20); // Slight trail effect
  
  // Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    
    p.update();
    p.display();
    
    // Remove particles that are off screen
    if (p.isDead()) {
      particles.splice(i, 1);
    }
  }
  
  // Add new particles
  if (frameCount % 5 === 0) {
    particles.push(createParticle());
  }
}

function createParticle() {
  return {
    position: createVector(random(width), random(height)),
    velocity: createVector(random(-2, 2), random(-2, 2)),
    acceleration: createVector(0, 0.05),
    size: random(4, 12),
    color: color(random(100, 255), random(100, 255), random(200, 255)),
    lifespan: 255,
    
    update: function() {
      this.velocity.add(this.acceleration);
      this.position.add(this.velocity);
      this.lifespan -= 2;
    },
    
    display: function() {
      noStroke();
      fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], this.lifespan);
      ellipse(this.position.x, this.position.y, this.size, this.size);
    },
    
    isDead: function() {
      return this.lifespan < 0 || 
             this.position.x < -this.size || 
             this.position.x > width + this.size ||
             this.position.y > height + this.size;
    }
  };
}`
  }
];

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

  // Load example sketch
  const loadExampleSketch = (example) => {
    updateCode(example.code);
    setActiveView('code');
    reloadCode();
    playSketch();
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
                    Load Example Sketch
                  </button>
                </div>
              </div>
            )}
            
            {activeView === 'explore' && (
              <div className="space-y-4">
                <h3 className="font-medium">Explore Topics</h3>
                
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search topics..." 
                    className="w-full p-2 pr-8 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="p-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/30">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-400">Recommended for you:</span>
                    </div>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Animation Basics</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {EXAMPLE_SKETCHES.map((example, index) => (
                      <ExampleCard
                        key={index}
                        title={example.title}
                        description={example.description}
                        thumbnail={example.thumbnail}
                        onSelect={() => loadExampleSketch(example)}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Show your snippets */}
                {snippets && snippets.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Your Saved Sketches</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {snippets.slice(0, 4).map((snippet, index) => (
                        <div 
                          key={index} 
                          className="p-2 border rounded-md text-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => loadSnippet(snippet)}
                        >
                          <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded mb-1 flex items-center justify-center">
                            <Save className="h-6 w-6 text-gray-400" />
                          </div>
                          <span className="text-xs truncate block">{snippet.title}</span>
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
            
            {/* Show curriculum selector if needed */}
            {activeView === 'explore' && !selectedCurriculum && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Card className="w-full max-w-md p-4 shadow-lg">
                  <h3 className="text-lg font-medium mb-4">Select a learning topic</h3>
                  <ImprovedSyllabusSelector onSelect={handleCurriculumSelect} />
                </Card>
              </div>
            )}
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