'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWebSocketConnection, Message } from '@/lib/hooks/useWebSocketConnection';
import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import { useAudioPlayback } from '@/lib/hooks/useAudioPlayback';
import { useP5jsCode } from '@/components/playground/hooks/useP5jsCode';
import { useChatWithGemini } from '@/components/playground/hooks/useChatWithGemini';
import { useSnippets } from '@/components/playground/hooks/useSnippets';
import { BookOpen, Sparkles, Code, MessageSquare, Mic, MicOff, Save, Play, Pause, RefreshCw, Volume2, VolumeX, Activity } from 'lucide-react';
import PreviewPanel from '@/components/playground/PreviewPanel';
import ImprovedCodeEditor from '@/components/playground/ImprovedCodeEditor';
import ChatPanel from '@/components/playground/ChatPanel';
import { ChatWindow } from './windows/ChatWindow';
import apiClient from '@/lib/playground-api';

interface P5jsTutoringSessionProps {
  initialCurriculum: any;
  ageGroup: string;
  apiUrl?: string;
  onSessionEnd: () => void;
  initialCode?: string;
  studentId?: number;
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

const P5jsTutoringSession: React.FC<P5jsTutoringSessionProps> = ({
  initialCurriculum,
  ageGroup,
  apiUrl = 'ws://localhost:8000/api/gemini/bidirectional',
  onSessionEnd,
  initialCode,
  studentId = 1,
}) => {
  // Mode management
  const [mode, setMode] = useState<'guided' | 'explore'>('guided');
  const [isTutorPresenting, setIsTutorPresenting] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Separate message systems
  const [tutorLogs, setTutorLogs] = useState<Message[]>([]); // For live tutor system messages
  const tutorMessageIdCounter = useRef(0);
  
  // Refs for screen capture and code tracking
  const canvasRef = useRef<HTMLIFrameElement | null>(null);
  const codeEditorRef = useRef<HTMLDivElement | null>(null);
  const lastSentCodeRef = useRef<string>('');
  const lastScreenCaptureRef = useRef<string>('');
  
  // Determine initial code - use provided code or default
  const startingCode = initialCode || INITIAL_CODE;
  
  // Helper function to add tutor log messages
  const addTutorLog = (type: 'system' | 'assistant' | 'info', content: string) => {
    const newLog: Message = {
      id: tutorMessageIdCounter.current++,
      type,
      content,
    };
    setTutorLogs(prev => [...prev, newLog]);
  };
  
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
    initialCurriculum,
    ageGroup,
    onMessageReceived: (message) => {
      // Handle messages from the WebSocket
      if (message.type === 'text' && message.content) {
        // Add to playground chat for actual tutor responses
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
  } = useP5jsCode(startingCode);
  
  // Chat management (for playground chat, not live tutor)
  const {
    messages,
    chatState,
    sendMessage,
    addMessage,
  } = useChatWithGemini(code, false, updateCode, initialCurriculum);
  
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
    addMessage
  );
  
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
  
  // Function to capture and send screen context (only when needed)
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
            addTutorLog('info', '📸 Screen capture sent to live tutor');
            lastScreenCaptureRef.current = dataUrl;
          }
        }
      }
    } catch (error) {
      console.error('Error capturing screen context:', error);
      addTutorLog('system', `❌ Error capturing screen: ${error}`);
    }
  };
  
  // Send code update only when it actually changes
  const sendCodeUpdate = (newCode: string) => {
    if (newCode !== lastSentCodeRef.current) {
      // Show a truncated version in the tutor log for transparency
      const codeSnippet = newCode.split('\n').slice(0, 5).join('\n');
      const isLong = newCode.split('\n').length > 5;
      
      addTutorLog('info', `📝 Sending code update to live tutor:\n\`\`\`javascript\n${codeSnippet}${isLong ? '\n...' : ''}\n\`\`\``);
      sendTextMessage(`Code updated:\n\`\`\`javascript\n${newCode}\n\`\`\``);
      lastSentCodeRef.current = newCode;
    }
  };
  
  // Send screen context only on significant events
  useEffect(() => {
    if (!isConnected || !isRunning) return;
    
    // Capture screen after code runs (with a small delay for rendering)
    const captureTimeout = setTimeout(() => {
      sendScreenContext(true);
    }, 500);
    
    return () => clearTimeout(captureTimeout);
  }, [isRunning, code]); // Only when sketch starts/stops or code changes
  
  // Handle code changes and send to tutor
  const handleCodeChange = (newCode: string) => {
    editCode(newCode);
    
    // Debounce sending code changes to avoid overwhelming the WebSocket
    if (codeChangeTimeout.current) {
      clearTimeout(codeChangeTimeout.current);
    }
    
    codeChangeTimeout.current = setTimeout(() => {
      sendCodeUpdate(newCode);
    }, 1000);
  };
  
  const codeChangeTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Connect on component mount
  useEffect(() => {
    console.log('P5.js tutoring session component mounted, connecting to WebSocket...');
    addTutorLog('system', '🔌 Connecting to live tutor...');
    
    const connectTimer = setTimeout(() => {
      connect();
    }, 100);
    
    return () => {
      clearTimeout(connectTimer);
      console.log('Component unmounting, cleaning up...');
      if (isListening) {
        stopAudioRecording();
      }
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Update connection status in tutor log
  useEffect(() => {
    if (isConnected) {
      addTutorLog('system', '✅ Connected to live tutor');
    } else if (isConnecting) {
      addTutorLog('system', '⏳ Connecting to live tutor...');
    }
  }, [isConnected, isConnecting]);
  
  // Initialize with welcome message and generate P5.js code
  useEffect(() => {
    const initializeSession = async () => {
      if (initialCode) {
        const projectName = initialCurriculum.skill?.description || 
                           initialCurriculum.unit?.title || 
                           'your saved project';
        addMessage('assistant', `Welcome back! I see you've loaded "${projectName}". Let's continue working on it!`);
      } else {
        addMessage('assistant', `Welcome to creative coding! Today we'll learn about ${initialCurriculum.skill?.description || 'P5.js basics'}. Let's create something amazing together!`);
        
        // Generate P5.js code for the selected curriculum
        if (initialCurriculum?.skill || initialCurriculum?.subskill) {
          try {
            addMessage('system', 'Generating code example for your selected topic...');
            
            // Build context description from curriculum metadata
            let contextDescription = '';
            if (initialCurriculum.unit?.title) {
              contextDescription += `Unit: ${initialCurriculum.unit.title}. `;
            }
            if (initialCurriculum.subskill?.description) {
              contextDescription += `Subskill: ${initialCurriculum.subskill.description}. `;
            }
            
            const selectedItemDescription = initialCurriculum.skill?.description || 'P5.js basics';
            
            // Send curriculum context to WebSocket
            addTutorLog('info', `📚 Sending curriculum context to live tutor: "${selectedItemDescription}"`);
            sendTextMessage(`I've selected the learning topic: "${selectedItemDescription}". ${contextDescription}`);
            
            // Generate code via Gemini API
            const message = `I've selected the learning topic: "${selectedItemDescription}". ${contextDescription}
   
Please create an interactive P5.js exhibit that:
1. Clearly demonstrates this concept with visual elements
2. Includes student interaction to reinforce learning
3. Builds from simple to more complex examples
4. Has comments explaining key code concepts
5. Encourages experimentation and creative exploration
The exhibit should be educational but engaging, allowing students to manipulate parameters and see the results in real-time.`;
            
            const response = await apiClient.sendToGemini({
              message: message,
              role: 'user',
              codeHasChanged: false,
              conversationHistory: []
            });
            
            if (response.code) {
              await updateCode(response.code);
              addMessage('assistant', response.explanation || 'I\'ve created an interactive example for you! Try running it and see what happens. You can modify the code to experiment with different effects.');
              
              // Automatically start the sketch
              playSketch();
              
              // Send the generated code to WebSocket for context
              sendCodeUpdate(response.code);
              
              // Capture screen after the sketch starts
              setTimeout(() => {
                sendScreenContext(true);
              }, 1000);
            }
          } catch (error) {
            console.error('Error generating P5.js code:', error);
            addMessage('system', 'There was an error generating the code example. Please try again.');
          }
        }
      }
    };
    
    initializeSession();
  }, []); // Remove dependencies to prevent duplicate calls
  
  const togglePlayPause = () => {
    if (isRunning) {
      stopSketch();
      addTutorLog('info', '⏸️ Student paused the sketch');
      sendTextMessage("Student paused the sketch.");
    } else {
      playSketch();
      addTutorLog('info', '▶️ Student started the sketch');
      sendTextMessage("Student started the sketch.");
      // Capture screen after a brief delay for rendering
      setTimeout(() => {
        sendScreenContext(true);
      }, 500);
    }
  };
  
  const handleModeSwitch = (newMode: 'guided' | 'explore') => {
    setMode(newMode);
    setIsTutorPresenting(false);
    
    if (newMode === 'explore') {
      addMessage('assistant', "Great! Now you're in free exploration mode. Try changing the code and see what happens!");
      addTutorLog('info', '🔓 Student switched to exploration mode');
      sendTextMessage("Student is now in exploration mode.");
    } else {
      addMessage('assistant', "Let's continue with guided learning. I'll show you step by step!");
      addTutorLog('info', '🎓 Student switched to guided mode');
      sendTextMessage("Student is back in guided learning mode.");
    }
  };
  
  // Handle opening the save dialog
  const handleOpenSaveDialog = () => {
    setCurrentSnippet({
      title: initialCurriculum.skill?.description || 'My P5.js Sketch',
      code: code,
      description: `Created during ${initialCurriculum.subject} session`,
      tags: [initialCurriculum.subject, 'p5js'],
      unit_id: initialCurriculum.domain?.id || '',
      unit_title: initialCurriculum.domain?.title || '',
      skill_id: initialCurriculum.skill?.id || '',
      skill_description: initialCurriculum.skill?.description || '',
      subskill_id: initialCurriculum.subskill?.id || '',
      subskill_description: initialCurriculum.subskill?.description || ''
    });
    setSaveDialogOpen(true);
  };
  
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h1 className="text-xl font-bold text-gray-800">Creative Coding Adventure</h1>
            </div>
            
            {/* Mode Switcher */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handleModeSwitch('guided')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                  mode === 'guided' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Guided
              </button>
              <button
                onClick={() => handleModeSwitch('explore')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                  mode === 'explore' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Explore
              </button>
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
            
            <button
              onClick={onSessionEnd}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              End Session
            </button>
          </div>
        </div>
      </header>
      
      {/* Error Messages */}
      {connectionError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">
          <p>{connectionError}</p>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Playground Chat (existing) */}
        <div className="w-96 border-r bg-white flex flex-col">
          <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
            <h2 className="font-semibold text-gray-800">AI Coding Buddy</h2>
            <p className="text-sm text-gray-600">
              {mode === 'guided' ? "I'll guide you step by step!" : "Ask me anything about your code!"}
            </p>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ChatPanel 
              messages={messages}
              chatState={chatState}
              sendMessage={sendMessage} // This is the regular playground chat
            />
          </div>
        </div>
        
        {/* Center - Canvas */}
        <div className="flex-1 bg-white flex flex-col">
          <div className="flex-1 relative">
            <PreviewPanel
              code={code}
              isRunning={isRunning}
              codeNeedsReload={codeNeedsReload}
              onReload={() => {
                reloadCode();
                addTutorLog('info', '🔄 Sketch reloaded');
              }}
              onPlay={playSketch}
              onStop={stopSketch}
              onClear={() => {
                updateCode(INITIAL_CODE);
                addTutorLog('info', '🧹 Code cleared to default');
              }}
              registerIframeRef={(ref) => {
                registerIframeRef(ref);
                canvasRef.current = ref;
              }}
              onError={(error) => {
                if (error) {
                  addMessage('system', `Oops! There's an error: ${error}`);
                  addTutorLog('system', `❌ Error: ${error}`);
                  sendTextMessage(`Student encountered an error: ${error}`);
                }
              }}
            />
            
            {isTutorPresenting && (
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-full shadow-lg">
                🎓 Tutor is showing an example
              </div>
            )}
            
            {isResponding && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-purple-100 text-purple-700 text-sm rounded-full shadow-lg">
                AI is thinking...
              </div>
            )}
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
              onClick={() => {
                reloadCode();
                addTutorLog('info', '🔄 Sketch restarted');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Restart
            </button>
          </div>
        </div>
        
        {/* Right Panel - Code Editor */}
        <div className="w-96 border-l bg-white flex flex-col" ref={codeEditorRef}>
          <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">
              {mode === 'guided' && isTutorPresenting ? 'Example Code' : 'Your Code'}
            </h2>
            <button 
              onClick={handleOpenSaveDialog}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSnippetLoading}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ImprovedCodeEditor
              code={code}
              onChange={handleCodeChange}
              readOnly={mode === 'guided' && isTutorPresenting}
              codeSyntaxHtml={null}
            />
          </div>
          
          {mode === 'guided' && isTutorPresenting && (
            <div className="p-3 border-t text-center">
              <button
                onClick={() => {
                  setIsTutorPresenting(false);
                  handleModeSwitch('explore');
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Try it yourself! →
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Live Tutor Log Window - Separate from playground chat */}
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
      
      {/* Render the save dialog */}
      {renderSaveDialog()}
    </div>
  );
};

export default P5jsTutoringSession;