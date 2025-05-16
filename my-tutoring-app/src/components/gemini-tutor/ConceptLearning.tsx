// components/concept-learning/ConceptLearningContainer.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWebSocketConnection, Message } from '@/lib/hooks/useWebSocketConnection';
import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import { useAudioPlayback } from '@/lib/hooks/useAudioPlayback';
import { useP5jsCode } from '@/components/playground/hooks/useP5jsCode';
import { useSnippets } from '@/components/playground/hooks/useSnippets';
import { BookOpen, Beaker, Code, MessageSquare, Mic, MicOff, Play, Pause, 
         RefreshCw, Volume2, VolumeX, EyeOff, Eye, ChevronLeft } from 'lucide-react';

import ConceptBrowser from './ConceptBrowser';
import ConceptVisualization from './ConceptVisualization';
import ConceptExplanationPanel from './ConceptExplanationPanel';
import { ChatWindow } from '../gemini-tutor/windows/ChatWindow';
import { type CodeSnippet } from '@/lib/playground-api';

interface ConceptLearningContainerProps {
  studentId?: number;
  apiUrl?: string;
  onBack: () => void;
  initialSnippet?: CodeSnippet;
}

const ConceptLearningContainer: React.FC<ConceptLearningContainerProps> = ({
  studentId = 1,
  apiUrl = 'ws://localhost:8000/api/gemini/bidirectional',
  onBack,
  initialSnippet
}) => {
  // View states
  const [view, setView] = useState<'browser' | 'visualization'>(initialSnippet ? 'visualization' : 'browser');
  const [selectedSnippet, setSelectedSnippet] = useState<CodeSnippet | null>(initialSnippet || null);
  const [codeVisible, setCodeVisible] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Refs for screen capture
  const canvasRef = useRef<HTMLIFrameElement | null>(null);
  const lastScreenCaptureRef = useRef<string>('');
  
  // System logs
  const [tutorLogs, setTutorLogs] = useState<Message[]>([]);
  const tutorMessageIdCounter = useRef(0);
  
  // Helper function to add tutor log messages
  const addTutorLog = (type: 'system' | 'assistant' | 'info', content: string) => {
    const newLog: Message = {
      id: tutorMessageIdCounter.current++,
      type,
      content,
    };
    setTutorLogs(prev => [...prev, newLog]);
  };
  
  // Snippets handling
  const snippetHooks = useSnippets(
    studentId,
    selectedSnippet?.code || '',
    async (newCode: string) => {
      // Only update code if we're in visualization view
      if (view === 'visualization' && updateCode) {
        await updateCode(newCode);
      }
    },
    (role: string, message: string) => {
      // Add system messages to tutor logs
      addTutorLog(role as any, message);
    }
  );
  
  // WebSocket for tutoring with audio support
  const {
    isConnected,
    isConnecting,
    isResponding,
    connectionError: wsError,
    connect,
    disconnect,
    sendTextMessage,
    sendScreenData,
    sendEndOfTurn,
    socket,
  } = useWebSocketConnection({
    apiUrl,
    initialCurriculum: selectedSnippet ? {
      subject: selectedSnippet.unit_title || 'Science',
      skill: selectedSnippet.skill_description || selectedSnippet.title,
      subskill: selectedSnippet.subskill_description || selectedSnippet.description
    } : {
      subject: "Science Concepts",
      skill: "Visualization",
      subskill: "Interactive Learning"
    },
    ageGroup: '8-10', // Default age range, could be made configurable
    onMessageReceived: (message) => {
      // Handle messages from WebSocket
      if (message.type === 'text' && message.content) {
        // Add to concept explanation
        addMessage('assistant', message.content);
      }
    },
    onAudioReceived: (audioData, sampleRate) => {
      if (isAudioOn) {
        processAndPlayRawAudio(audioData, sampleRate);
      }
    },
    onError: (error) => {
      setConnectionError(error);
      addTutorLog('system', `❌ Connection error: ${error}`);
    },
  });
  
  // Audio capture
  const {
    isListening,
    toggleMicrophone,
    stopAudioRecording,
  } = useAudioCapture({
    socket,
    onError: (error) => {
      addTutorLog('system', `❌ Audio error: ${error.message}`);
    },
  });

  // Audio playback
  const { processAndPlayRawAudio } = useAudioPlayback();
  
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
  } = useP5jsCode(selectedSnippet?.code || '');
  
  // Chat state for concept explanations
  const [messages, setMessages] = useState<Message[]>([]);
  const [isExplaining, setIsExplaining] = useState(false);
  
  // Add a message to the explanation panel
  const addMessage = (type: 'system' | 'assistant' | 'user', content: string) => {
    const newMessage: Message = {
      id: Date.now(),
      type,
      content,
    };
    setMessages(prev => [...prev, newMessage]);
  };
  
  // Handle message sending to the tutor
  const sendMessage = (message: string) => {
    if (message.trim()) {
      addMessage('user', message);
      sendTextMessage(message);
      sendEndOfTurn();
      setIsExplaining(true);
    }
  };
  
  // Handle microphone toggle with WebSocket integration
  const handleToggleMicrophone = async () => {
    if (!isListening) {
      addTutorLog('info', '🎤 Microphone activated - listening...');
    }
    
    const success = await toggleMicrophone();
    
    // If we're stopping the recording, send end of turn signal
    if (isListening && success) {
      addTutorLog('info', '🎤 Microphone stopped');
      sendEndOfTurn();
    }
  };
  
  // Function to capture and send screen context
  const sendScreenContext = async (forceCapture: boolean = false) => {
    try {
      // Create a canvas to capture the current P5.js sketch
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Get the iframe content if available
      const iframe = canvasRef.current;
      if (iframe && iframe.contentWindow) {
        // Get the p5 canvas from the iframe
        const p5Canvas = iframe.contentWindow.document.querySelector('canvas');
        if (p5Canvas && ctx) {
          canvas.width = p5Canvas.width;
          canvas.height = p5Canvas.height;
          ctx.drawImage(p5Canvas, 0, 0);
          
          // Convert to base64
          const dataUrl = canvas.toDataURL('image/png', 0.7);
          
          // Only send if the screen has changed significantly or forced
          if (forceCapture || dataUrl !== lastScreenCaptureRef.current) {
            const base64Data = dataUrl.split(',')[1];
            sendScreenData(base64Data);
            addTutorLog('info', '📸 Screen capture sent to tutor');
            lastScreenCaptureRef.current = dataUrl;
          }
        }
      }
    } catch (error) {
      console.error('Error capturing screen context:', error);
      addTutorLog('system', `❌ Error capturing screen: ${error}`);
    }
  };
  
  // Handle selecting a concept to visualize
  const handleSelectConcept = async (snippet: CodeSnippet) => {
    setSelectedSnippet(snippet);
    setView('visualization');
    
    // Reset messages
    setMessages([]);
    
    try {
      // Display welcome message
      const conceptName = snippet.skill_description || snippet.title;
      const subjectArea = snippet.unit_title || 'Science';
      
      addMessage('assistant', `Let's explore ${conceptName}! I'll help you understand this ${subjectArea} concept through visualization.`);
      
      // Load the code
      await updateCode(snippet.code);
      playSketch();
      
      // Connect to WebSocket with concept metadata
      if (isConnected) {
        disconnect();
      }
      
      // Connect with concept metadata
      connect();
      
      // After a brief delay, send context and screen capture
      setTimeout(() => {
        // Create a detailed prompt for the concept
        const contextPrompt = `
          I'm showing a visualization about ${conceptName} in ${subjectArea}.
          This visualization demonstrates: ${snippet.subskill_description || snippet.description || 'an important concept'}
          
          Please explain:
          1. What is being shown in this visualization
          2. How it relates to ${conceptName}
          3. Why this concept is important in ${subjectArea}
          
          Focus on explaining the concept in simple terms. Use grade-appropriate language.
          Don't explain the code itself - focus on the scientific concept being demonstrated.
        `;
        
        sendTextMessage(contextPrompt);
        sendScreenContext(true);
        setIsExplaining(true);
      }, 1500);
    } catch (error) {
      console.error('Error setting up concept visualization:', error);
      addTutorLog('system', `❌ Error: ${error}`);
    }
  };
  
  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup connections
      if (isListening) {
        stopAudioRecording();
      }
      disconnect();
    };
  }, []);
  
  // Load available snippets when component mounts
  useEffect(() => {
    snippetHooks.loadSnippets();
  }, []);
  
  // Update connection status in tutor log
  useEffect(() => {
    if (isConnected) {
      addTutorLog('system', '✅ Connected to live tutor');
    } else if (isConnecting) {
      addTutorLog('system', '⏳ Connecting to live tutor...');
    }
  }, [isConnected, isConnecting]);
  
  // If we've selected an initial snippet, set it up
  useEffect(() => {
    if (initialSnippet && view === 'visualization') {
      handleSelectConcept(initialSnippet);
    }
  }, [initialSnippet, view]);
  
  // Render the appropriate view
  if (view === 'browser') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-teal-50">
        <header className="bg-white border-b px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Beaker className="w-6 h-6 text-green-600" />
              <h1 className="text-xl font-bold text-gray-800">Science Concept Visualizations</h1>
            </div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Learning Modes
            </button>
          </div>
        </header>
        
        <main className="container mx-auto p-6">
          <ConceptBrowser
            snippets={snippetHooks.snippets}
            isLoading={snippetHooks.isLoading}
            onRefresh={snippetHooks.loadSnippets}
            onSelectConcept={handleSelectConcept}
          />
        </main>
      </div>
    );
  }
  
  // Visualization view
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('browser')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Concepts
            </button>
            
            <div className="flex items-center gap-2">
              <Beaker className="w-5 h-5 text-green-600" />
              <h1 className="text-lg font-semibold text-gray-800">
                {selectedSnippet?.skill_description || selectedSnippet?.title || 'Concept Visualization'}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              } animate-pulse`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
            
            {/* Audio Toggle */}
            <button
              onClick={() => setIsAudioOn(!isAudioOn)}
              className={`p-2 rounded-lg transition-all ${
                isAudioOn 
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                  : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
              }`}
              title={isAudioOn ? 'Mute tutor audio' : 'Enable tutor audio'}
            >
              {isAudioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            
            {/* Microphone Toggle */}
            <button
              onClick={handleToggleMicrophone}
              className={`p-2 rounded-lg transition-all ${
                isListening 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={isListening ? 'Stop speaking' : 'Start speaking to tutor'}
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            
            {/* Code Toggle */}
            <button
              onClick={() => setCodeVisible(!codeVisible)}
              className={`p-2 rounded-lg transition-all ${
                codeVisible 
                  ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={codeVisible ? 'Hide code' : 'Show code'}
            >
              {codeVisible ? <EyeOff className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {/* Subtitle when available */}
        {selectedSnippet?.subskill_description && (
          <p className="text-sm text-gray-600 ml-14 mt-1">
            {selectedSnippet.subskill_description}
          </p>
        )}
      </header>
      
      {/* Error Messages */}
      {connectionError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">
          <p>{connectionError}</p>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Explanation */}
        <div className={`${codeVisible ? 'w-1/3' : 'w-2/5'} border-r bg-white flex flex-col`}>
          <div className="p-4 border-b bg-gradient-to-r from-green-50 to-blue-50">
            <h2 className="font-semibold text-gray-800">Concept Explanation</h2>
            <p className="text-sm text-gray-600">
              {isExplaining 
                ? "I'm explaining this concept for you..."
                : "Ask me questions about what you're seeing!"}
            </p>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ConceptExplanationPanel
              messages={messages}
              isResponding={isExplaining}
              sendMessage={sendMessage}
              onResponseComplete={() => setIsExplaining(false)}
            />
          </div>
        </div>
        
        {/* Center - Visualization */}
        <div className={`${codeVisible ? 'flex-1' : 'flex-[3]'} bg-white flex flex-col`}>
          <div className="flex-1 relative">
            <ConceptVisualization
              code={code}
              isRunning={isRunning}
              codeNeedsReload={codeNeedsReload}
              onReload={() => {
                reloadCode();
                addTutorLog('info', '🔄 Visualization reloaded');
              }}
              onPlay={playSketch}
              onStop={stopSketch}
              registerIframeRef={(ref) => {
                registerIframeRef(ref);
                canvasRef.current = ref;
              }}
              onError={(error) => {
                if (error) {
                  addMessage('system', `There was an error with the visualization: ${error}`);
                  addTutorLog('system', `❌ Error: ${error}`);
                }
              }}
            />
            
            {isExplaining && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-full shadow-lg">
                Explaining concept...
              </div>
            )}
          </div>
          
          {/* Visualization Controls */}
          <div className="p-3 border-t bg-gray-50 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                if (isRunning) {
                  stopSketch();
                  addTutorLog('info', '⏸️ Visualization paused');
                } else {
                  playSketch();
                  addTutorLog('info', '▶️ Visualization started');
                  setTimeout(() => sendScreenContext(true), 500);
                }
              }}
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
              onClick={() => {
                reloadCode();
                addTutorLog('info', '🔄 Visualization restarted');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Restart
            </button>
          </div>
        </div>
        
        {/* Right Panel - Code (conditionally shown) */}
        {codeVisible && (
          <div className="w-1/3 border-l bg-white flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
              <h2 className="font-semibold text-gray-800">Visualization Code</h2>
              <p className="text-xs text-gray-500">
                This is the code behind the visualization (advanced)
              </p>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap overflow-auto p-4 bg-gray-50 rounded-lg border">
                {code}
              </pre>
            </div>
          </div>
        )}
      </div>
      
      {/* Live Tutor Log Window */}
      <div className="fixed bottom-4 right-4 z-20">
        <ChatWindow 
          messages={tutorLogs}
          onSendMessage={(message) => {
            // This is for the live tutor - just send directly
            sendTextMessage(message);
            sendEndOfTurn();
          }}
        />
      </div>
    </div>
  );
};

export default ConceptLearningContainer;