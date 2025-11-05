'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWebSocketConnection, Message } from '@/lib/hooks/useWebSocketConnection';
import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import { useAudioPlayback } from '@/lib/hooks/useAudioPlayback';
import { useScreenSharing } from '@/lib/hooks/useScreenSharing';
import { ChatWindow } from './windows/ChatWindow';
import { LessonWindow } from './windows/LessonWindow';
import { ProblemPanel } from './panels/ProblemPanel';
import DrawingCanvas from './ui/DrawingCanvas';
import { Mic, MicOff, Monitor, MonitorOff, Volume2, VolumeX, Settings, Camera, Package } from 'lucide-react';
import { api } from '@/lib/api';

interface GeminiTutoringSessionProps {
  initialCurriculum: {
    subject: string;
    domain?: { id: string; title: string; };
    skill?: { id: string; description: string; };
    subskill?: { 
      id: string; 
      description: string; 
      difficulty_range?: { start: number; end: number; target: number; };
    };
  };
  ageGroup: string;
  apiUrl?: string;
  onSessionEnd: () => void;
  studentId?: number;
  packageId?: string; // NEW: Optional content package ID
}

const GeminiTutoringSession: React.FC<GeminiTutoringSessionProps> = ({
  initialCurriculum,
  ageGroup,
  apiUrl = process.env.NEXT_PUBLIC_WS_URL ? `${process.env.NEXT_PUBLIC_WS_URL}/api/gemini/bidirectional` : 'ws://localhost:8000/api/gemini/bidirectional',
  onSessionEnd,
  studentId = 1,
  packageId, // NEW: Content package ID prop
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [currentProblem, setCurrentProblem] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWorkspaceStreaming, setIsWorkspaceStreaming] = useState(false);
  const [streamInterval, setStreamInterval] = useState(10000); // Default 10 seconds
  const [isProblemPanelOpen, setIsProblemPanelOpen] = useState(false);
  
  const canvasRef = useRef<any>(null);
  const problemPanelRef = useRef<any>(null);
  const workspaceStreamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // WebSocket connection management with package ID support
  const {
    isConnected,
    isConnecting,
    isResponding,
    connectionError: wsError,
    connect,
    disconnect,
    sendTextMessage,
    sendSystemMessage,
    sendScreenData,
    sendEndOfTurn,
    sendImageData,
    socket,
  } = useWebSocketConnection({
    apiUrl,
    initialCurriculum,
    ageGroup,
    packageId, // NEW: Pass package ID to WebSocket connection
    studentId, // NEW: Pass student ID to WebSocket connection
    onMessageReceived: (message) => {
      setMessages(prev => [...prev, message]);
    },
    onAudioReceived: (audioData, sampleRate) => {
      if (isAudioOn) {
        processAndPlayRawAudio(audioData, sampleRate);
      }
    },
    onError: (error) => {
      setConnectionError(error);
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
      alert(`Audio error: ${error.message}`);
    },
  });

  // Audio playback
  const { processAndPlayRawAudio } = useAudioPlayback();

  // Screen sharing
  const {
    isScreenSharing,
    toggleScreenSharing,
  } = useScreenSharing({
    sendScreenData,
  });

  // Function to capture the full workspace view
  const captureFullWorkspace = async () => {
    try {
      // Create an offscreen canvas to combine both canvases
      const offscreenCanvas = document.createElement('canvas');
      const ctx = offscreenCanvas.getContext('2d');
      
      if (!ctx) return null;

      // Calculate dimensions for the combined view
      const mainCanvasData = canvasRef.current?.getCanvasData ? 
        await canvasRef.current.getCanvasData() : null;
      
      // If ProblemPanel is open and has a canvas, capture it
      const problemCanvasData = (isProblemPanelOpen && problemPanelRef.current?.getCanvasData) ? 
        await problemPanelRef.current.getCanvasData() : null;

      if (!mainCanvasData && !problemCanvasData) {
        console.warn('No canvas data available');
        return null;
      }

      // Determine layout based on what's available
      if (problemCanvasData && !mainCanvasData) {
        // Only problem panel is visible
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = 'data:image/png;base64,' + problemCanvasData;
        });
        
        offscreenCanvas.width = img.width;
        offscreenCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      } else if (mainCanvasData && !problemCanvasData) {
        // Only main canvas is visible
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = 'data:image/png;base64,' + mainCanvasData;
        });
        
        offscreenCanvas.width = img.width;
        offscreenCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      } else if (mainCanvasData && problemCanvasData) {
        // Both are visible - create a side-by-side view
        const mainImg = new Image();
        const problemImg = new Image();
        
        await Promise.all([
          new Promise((resolve) => {
            mainImg.onload = resolve;
            mainImg.src = 'data:image/png;base64,' + mainCanvasData;
          }),
          new Promise((resolve) => {
            problemImg.onload = resolve;
            problemImg.src = 'data:image/png;base64,' + problemCanvasData;
          })
        ]);
        
        // Create a combined canvas with both views
        const gap = 20; // Gap between canvases
        offscreenCanvas.width = mainImg.width + problemImg.width + gap;
        offscreenCanvas.height = Math.max(mainImg.height, problemImg.height);
        
        // Fill background
        ctx.fillStyle = '#f3f4f6'; // Gray background
        ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        
        // Draw main canvas on the left
        ctx.drawImage(mainImg, 0, 0);
        
        // Draw problem canvas on the right
        ctx.drawImage(problemImg, mainImg.width + gap, 0);
        
        // Add labels
        ctx.fillStyle = '#374151';
        ctx.font = '16px Arial';
        ctx.fillText('Main Workspace', 10, 20);
        ctx.fillText('Problem Panel', mainImg.width + gap + 10, 20);
      }

      // Convert to base64
      return offscreenCanvas.toDataURL('image/png').split(',')[1];
    } catch (error) {
      console.error('Error capturing full workspace:', error);
      return null;
    }
  };

  // Function to capture and send workspace snapshot
  const captureAndSendWorkspaceSnapshot = async () => {
    if (!isWorkspaceStreaming || !isConnected) return;
    
    try {
      const workspaceData = await captureFullWorkspace();
      if (workspaceData) {
        // Send with metadata about what's included
        sendImageData(workspaceData, 'workspace_snapshot', {
          includesProblemPanel: isProblemPanelOpen,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error capturing workspace snapshot:', error);
    }
  };

  // Toggle workspace streaming
  const toggleWorkspaceStreaming = () => {
    if (isWorkspaceStreaming) {
      // Stop streaming
      if (workspaceStreamIntervalRef.current) {
        clearInterval(workspaceStreamIntervalRef.current);
        workspaceStreamIntervalRef.current = null;
      }
      setIsWorkspaceStreaming(false);
    } else {
      // Start streaming
      setIsWorkspaceStreaming(true);
      // Send initial snapshot immediately
      captureAndSendWorkspaceSnapshot();
      // Set up interval for periodic snapshots
      workspaceStreamIntervalRef.current = setInterval(captureAndSendWorkspaceSnapshot, streamInterval);
    }
  };

  // Clean up workspace streaming on unmount or when streaming stops
  useEffect(() => {
    return () => {
      if (workspaceStreamIntervalRef.current) {
        clearInterval(workspaceStreamIntervalRef.current);
      }
    };
  }, []);

  // Restart interval when stream interval changes
  useEffect(() => {
    if (isWorkspaceStreaming && workspaceStreamIntervalRef.current) {
      clearInterval(workspaceStreamIntervalRef.current);
      workspaceStreamIntervalRef.current = setInterval(captureAndSendWorkspaceSnapshot, streamInterval);
    }
  }, [streamInterval, isWorkspaceStreaming]);

  // Handle changes to problem panel state
  const handleProblemPanelToggle = (isOpen: boolean) => {
    setIsProblemPanelOpen(isOpen);
    
    // If streaming is active, send an immediate update when panel opens/closes
    if (isWorkspaceStreaming) {
      setTimeout(() => {
        captureAndSendWorkspaceSnapshot();
      }, 300); // Small delay to allow animation to complete
    }
  };

  // Handle when a new problem is displayed
  const handleProblemDisplay = (problemData: any) => {
    if (!problemData) return;
    
    setCurrentProblem(problemData);
    
    // Send system message to tutor about the current problem
    const systemMessage = `CURRENT PROBLEM = "${problemData.problem}" INSTRUCTIONS = "Please provide assistance, allowing the student to take the lead with you acting as a tutor."`;
    
    sendSystemMessage(systemMessage);
  };

  // Handle microphone toggle with WebSocket integration
  const handleToggleMicrophone = async () => {
    const success = await toggleMicrophone();
    
    // If we're stopping the recording, send end of turn signal
    if (isListening && success) {
      sendEndOfTurn();
    }
  };

  // Handle screen sharing toggle with error handling
  const handleToggleScreenSharing = async () => {
    try {
      await toggleScreenSharing();
    } catch (error) {
      alert(`Failed to start screen sharing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle problem submission through API
  const handleProblemSubmit = async (problemData: any, canvasData?: string) => {
    if (!canvasData || !problemData) {
      console.error('Missing canvas data or problem data for submission');
      return;
    }

    setIsSubmitting(true);
    setCurrentProblem(problemData);

    try {
      // Submit to the API endpoint
      const response = await api.submitProblem({
        student_id: studentId,
        subject: initialCurriculum.subject,
        problem: problemData,
        solution_image: canvasData,
        skill_id: initialCurriculum.skill?.id || problemData.metadata?.skill?.id,
        subskill_id: initialCurriculum.subskill?.id || problemData.metadata?.subskill?.id,
        student_answer: '',
        canvas_used: true
      });

      // After successful API submission, notify the tutor via WebSocket
      const score = typeof response.review.evaluation === 'number' 
        ? response.review.evaluation 
        : response.review.evaluation?.score || 0;
      
      sendTextMessage(
        `I've completed the problem and submitted my answer. ` +
        `The evaluation score was ${score}. ` +
        `Here's the feedback: ${
          typeof response.review.feedback === 'string' 
            ? response.review.feedback 
            : response.review.feedback?.praise || 'Good effort!'
        }`
      );
      sendEndOfTurn();

    } catch (error) {
      console.error('Error submitting problem:', error);
      alert('Failed to submit problem. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle direct canvas submission (for main canvas)
  const handleCanvasSubmit = async (canvasData: string) => {
    if (currentProblem) {
      await handleProblemSubmit(currentProblem, canvasData);
    } else {
      // If no problem is set, just send a message via WebSocket
      sendTextMessage("I've completed the work and would like to submit it.");
      sendEndOfTurn();
    }
  };

  // Connect on component mount
  useEffect(() => {
    console.log('Tutoring session component mounted, connecting to WebSocket...');
    
    const connectTimer = setTimeout(() => {
      connect();
    }, 100);
    
    return () => {
      clearTimeout(connectTimer);
      console.log('Component unmounting, cleaning up...');
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update connection error state
  useEffect(() => {
    setConnectionError(wsError);
  }, [wsError]);

  // End the session
  const handleEndSession = () => {
    console.log('Ending tutoring session...');
    
    if (isListening) {
      stopAudioRecording();
    }
    
    // Stop workspace streaming
    if (isWorkspaceStreaming) {
      toggleWorkspaceStreaming();
    }
    
    disconnect();
    onSessionEnd();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Drawing Canvas */}
        <DrawingCanvas 
          ref={canvasRef}
          onSubmit={handleCanvasSubmit}
          loading={isSubmitting || isResponding}
        />

        {/* Connection Status */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-lg">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </span>
          {/* NEW: Show enhanced content indicator */}
          {packageId && (
            <div className="flex items-center gap-1 ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              <Package className="w-3 h-3" />
              <span>Enhanced</span>
            </div>
          )}
        </div>

        {/* Error Messages */}
        {connectionError && (
          <div className="absolute top-16 left-4 bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700 max-w-md rounded-r-lg shadow-lg">
            <p>{connectionError}</p>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
        {/* Left Section - Session Info */}
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {initialCurriculum.subject} • {initialCurriculum.skill?.description || ''} • Age {ageGroup}
            {/* NEW: Show package indicator */}
            {packageId && (
              <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                Enhanced Content
              </span>
            )}
          </div>
        </div>

        {/* Center Section - Main Controls */}
        <div className="flex items-center gap-2">
          {/* Microphone */}
          <button
            onClick={handleToggleMicrophone}
            className={`p-3 rounded-lg transition-all ${
              isListening 
                ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Workspace Streaming */}
          <button
            onClick={toggleWorkspaceStreaming}
            className={`p-3 rounded-lg transition-all ${
              isWorkspaceStreaming 
                ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-400' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
            }`}
            title={isWorkspaceStreaming ? 'Stop sharing workspace' : 'Share workspace with tutor'}
          >
            <Camera className="w-5 h-5" />
          </button>

          {/* Screen Share (optional - keep if you still want it) */}
          <button
            onClick={handleToggleScreenSharing}
            className={`p-3 rounded-lg transition-all ${
              isScreenSharing 
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-400' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {isScreenSharing ? <Monitor className="w-5 h-5" /> : <MonitorOff className="w-5 h-5" />}
          </button>

          {/* Audio */}
          <button
            onClick={() => setIsAudioOn(!isAudioOn)}
            className={`p-3 rounded-lg transition-all ${
              isAudioOn 
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400' 
                : 'bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-400'
            }`}
          >
            {isAudioOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Stream Interval Selector */}
          <select
            value={streamInterval}
            onChange={(e) => setStreamInterval(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            disabled={!isWorkspaceStreaming}
          >
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
          </select>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleEndSession}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
          >
            End Session
          </button>
          
          <button className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 transition-all">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Problem Panel - Enhanced with ref and state tracking */}
      <ProblemPanel
        ref={problemPanelRef}
        initialCurriculum={initialCurriculum}
        ageGroup={ageGroup}
        onSubmit={handleProblemSubmit}
        onProblemDisplay={handleProblemDisplay}
        studentId={studentId}
        onToggle={handleProblemPanelToggle}
      />

      {/* Window Controls - Only Chat and Lesson windows now */}
      <div className="fixed bottom-4 left-4 flex gap-2 z-20">
        <ChatWindow 
          messages={messages}
          onSendMessage={sendTextMessage}
          isResponding={isResponding}
        />
        <LessonWindow 
          initialCurriculum={initialCurriculum}
          ageGroup={ageGroup}
          packageId={packageId} // NEW: Pass package ID to lesson window
        />
      </div>
    </div>
  );
};

export default GeminiTutoringSession;