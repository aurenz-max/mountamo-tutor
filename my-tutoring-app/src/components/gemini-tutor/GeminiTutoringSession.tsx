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
import { Mic, MicOff, Monitor, MonitorOff, Volume2, VolumeX, Settings } from 'lucide-react';
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
}

const GeminiTutoringSession: React.FC<GeminiTutoringSessionProps> = ({
  initialCurriculum,
  ageGroup,
  apiUrl = 'ws://localhost:8000/api/gemini/bidirectional',
  onSessionEnd,
  studentId = 1,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [currentProblem, setCurrentProblem] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<any>(null);
  
  // WebSocket connection management
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

          {/* Screen Share */}
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

      {/* Problem Panel - Integrated as a slide-out panel */}
      <ProblemPanel
        initialCurriculum={initialCurriculum}
        ageGroup={ageGroup}
        onSubmit={handleProblemSubmit}
        studentId={studentId}
      />

      {/* Window Controls - Only Chat and Lesson windows now */}
      <div className="fixed bottom-4 left-4 flex gap-2 z-20">
        <ChatWindow 
          messages={messages}
          onSendMessage={sendTextMessage}
        />
        <LessonWindow 
          initialCurriculum={initialCurriculum}
          ageGroup={ageGroup}
        />
      </div>
    </div>
  );
};

export default GeminiTutoringSession;