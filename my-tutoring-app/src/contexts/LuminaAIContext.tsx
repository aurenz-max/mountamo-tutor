'use client';

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import AudioCaptureService from '@/lib/AudioCaptureService';
import { useAudioPlayback } from '@/lib/hooks/useAudioPlayback';
import { useExhibitContext } from '@/components/lumina/contexts/ExhibitContext';
import { useEvaluationContext } from '@/components/lumina/evaluation';
import type { ManifestItem, ObjectiveData } from '@/components/lumina/types';
import { getComponentById } from '@/components/lumina/service/manifest/catalog';

// Message type from AI
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isAudio?: boolean;
}

// Primitive context for connection
interface PrimitiveContext {
  primitive_type: string;
  instance_id: string;
  primitive_data: any;
  student_id?: number;
  exhibit_id?: string;
  topic?: string;
  grade_level?: string;
}

// Lesson context built from exhibit data
interface LessonContext {
  exhibit_id: string;
  topic: string;
  grade_level: string;
  objectives: Array<{
    id: string;
    text: string;
    verb: string;
  }>;
  ordered_components: Array<{
    component_id: string;
    instance_id: string;
    title: string;
    objective_ids?: string[];
  }>;
  current_index: number;
  previous_results: Array<{
    instance_id: string;
    component_id: string;
    completed: boolean;
    score?: number;
  }>;
}

// AI metrics for evaluation
interface AIMetrics {
  totalHints: number;
  totalInteractions: number;
  conversationTurns: number;
  voiceInteractions: number;
  timeWithAI: number;
  hintsGiven: {
    level1: number;
    level2: number;
    level3: number;
  };
}

interface LuminaAIContextType {
  // Connection
  connect: (primitiveContext: PrimitiveContext) => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;

  // AI interaction
  requestHint: (level: 1 | 2 | 3, currentState?: any) => void;
  sendVoice: (audioData: string) => void;
  sendText: (text: string) => void;
  updateContext: (newState: any, progress?: any) => void;

  // State
  conversation: Message[];
  isAIResponding: boolean;
  aiMetrics: AIMetrics;

  // Audio
  startListening: () => void;
  stopListening: () => void;
  isListening: boolean;
}

const LuminaAIContext = createContext<LuminaAIContextType | null>(null);

export const LuminaAIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<WebSocket | null>(null);
  const audioServiceRef = useRef<AudioCaptureService | null>(null);
  const currentPrimitiveRef = useRef<PrimitiveContext | null>(null);
  const sessionStartTimeRef = useRef<number>(0);

  // Use the proven queued audio playback hook
  const { processAndPlayRawAudio, stopAudioPlayback } = useAudioPlayback({ sampleRate: 24000 });

  // Call hooks at top level (Rules of Hooks) and store in refs for use in callbacks
  const exhibitContext = useExhibitContext();
  const evaluationContext = useEvaluationContext();
  const exhibitContextRef = useRef(exhibitContext);
  const evaluationContextRef = useRef(evaluationContext);
  exhibitContextRef.current = exhibitContext;
  evaluationContextRef.current = evaluationContext;

  const [isConnected, setIsConnected] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);

  // Metrics tracking
  const [aiMetrics, setAIMetrics] = useState<AIMetrics>({
    totalHints: 0,
    totalInteractions: 0,
    conversationTurns: 0,
    voiceInteractions: 0,
    timeWithAI: 0,
    hintsGiven: {
      level1: 0,
      level2: 0,
      level3: 0,
    },
  });

  // Helper to build lesson context from exhibit data
  const buildLessonContext = useCallback((
    primitiveContext: PrimitiveContext,
    manifestItems: ManifestItem[],
    objectives: ObjectiveData[],
    evaluationResults?: any[]
  ): LessonContext => {
    // Find current primitive's position
    const currentIndex = manifestItems.findIndex(
      m => m.instanceId === primitiveContext.instance_id
    );

    // Build ordered components list
    const orderedComponents = manifestItems.map(item => ({
      component_id: item.componentId,
      instance_id: item.instanceId,
      title: item.title,
      objective_ids: item.objectiveIds,
    }));

    // Gather previous results if available
    const previousResults = evaluationResults
      ? evaluationResults
          .filter((_, idx) => idx < currentIndex)
          .map(r => ({
            instance_id: r.instanceId || '',
            component_id: r.componentId || '',
            completed: r.success || false,
            score: r.score,
          }))
      : [];

    return {
      exhibit_id: primitiveContext.exhibit_id || '',
      topic: primitiveContext.topic || 'Learning Activity',
      grade_level: primitiveContext.grade_level || 'K-6',
      objectives: objectives.map(obj => ({
        id: obj.id,
        text: obj.text,
        verb: obj.verb || 'learn',
      })),
      ordered_components: orderedComponents,
      current_index: currentIndex >= 0 ? currentIndex : 0,
      previous_results: previousResults,
    };
  }, []);

  const connect = useCallback(async (primitiveContext: PrimitiveContext) => {
    // DEBUG: trace who is calling connect()
    console.trace(`[LuminaAI] connect() called for ${primitiveContext.primitive_type}`);

    // Prevent duplicate connections — close any existing socket first
    if (socketRef.current) {
      const state = socketRef.current.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        console.log('Lumina AI: closing existing socket before reconnecting');
        socketRef.current.close(1000, 'Reconnecting');
      }
      socketRef.current = null;
    }

    // Read current context values from refs (hooks called at top level)
    const { objectives, manifestItems } = exhibitContextRef.current;
    const evalCtx = evaluationContextRef.current;

    // Store primitive context
    currentPrimitiveRef.current = primitiveContext;

    // Initialize audio service
    if (!audioServiceRef.current) {
      audioServiceRef.current = new AudioCaptureService();
      audioServiceRef.current.setCallbacks({
        onStateChange: (state) => {
          setIsListening(state === 'recording');
        },
        onError: (error) => console.error('Audio capture error:', error)
      });
    }

    // Build lesson context
    const lessonContext = buildLessonContext(
      primitiveContext,
      manifestItems,
      objectives,
      evalCtx?.submittedResults
    );

    try {
      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      const wsUrl = `${wsBaseUrl}/api/lumina-tutor`;

      console.log(`Connecting to Lumina AI: ${wsUrl}`);

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = async () => {
        console.log('Lumina AI WebSocket connected');
        sessionStartTimeRef.current = Date.now();

        // Send authentication FIRST, before setting up audio service
        // to avoid audio service sending binary data before auth
        try {
          // Get Firebase token
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          const token = await auth.currentUser?.getIdToken();

          if (!token) {
            throw new Error('No authentication token available');
          }

          // Verify socket is still the current one (not replaced during await)
          if (socketRef.current !== socket) {
            console.log('Lumina AI: socket replaced during auth, aborting');
            socket.close();
            return;
          }

          // Look up catalog-driven tutoring scaffold
          const componentDef = getComponentById(primitiveContext.primitive_type);

          socket.send(JSON.stringify({
            type: 'authenticate',
            token,
            primitive_context: {
              primitive_type: primitiveContext.primitive_type,
              instance_id: primitiveContext.instance_id,
              primitive_data: primitiveContext.primitive_data,
              tutoring: componentDef?.tutoring ?? null,
            },
            lesson_context: lessonContext,
            student_progress: {
              attempts: 0,
              hints_used: 0,
              success_rate: 0,
            },
          }));

          // Set up audio service AFTER auth message is sent
          if (audioServiceRef.current) {
            audioServiceRef.current.setWebSocket(socket);
          }

          setIsConnected(true);
          console.log('Lumina AI authenticated with lesson context');
        } catch (error) {
          console.error('Error authenticating Lumina AI:', error);
          socket.close();
          setIsConnected(false);
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const messageType = message.type;

          if (messageType === 'ai_response') {
            // Text response from AI
            setConversation(prev => [
              ...prev,
              {
                role: 'assistant',
                content: message.content,
                timestamp: Date.now(),
                isAudio: false,
              },
            ]);
            setIsAIResponding(false);
          } else if (messageType === 'ai_audio') {
            // Audio response from AI - queued playback
            processAndPlayRawAudio(message.data, message.sampleRate || 24000);
          } else if (messageType === 'ai_transcription') {
            // AI's speech transcribed
            setConversation(prev => [
              ...prev,
              {
                role: 'assistant',
                content: message.content,
                timestamp: Date.now(),
                isAudio: true,
              },
            ]);
          } else if (messageType === 'user_transcription') {
            // User's speech transcribed
            setConversation(prev => [
              ...prev,
              {
                role: 'user',
                content: message.content,
                timestamp: Date.now(),
                isAudio: true,
              },
            ]);
          } else if (messageType === 'metrics_update') {
            // Update metrics from server
            setAIMetrics(prev => ({
              ...prev,
              hintsGiven: message.hintsGiven || prev.hintsGiven,
              totalInteractions: message.totalInteractions || prev.totalInteractions,
            }));
          } else if (messageType === 'ai_turn_end') {
            setIsAIResponding(false);
          } else if (messageType === 'auth_success' || messageType === 'session_ready') {
            console.log('Lumina AI session ready:', message.message);
          }
        } catch (error) {
          console.error('Error handling Lumina AI message:', error);
        }
      };

      socket.onclose = (event) => {
        console.log('Lumina AI WebSocket closed:', event.code, event.reason);
        setIsConnected(false);

        // Calculate total time
        if (sessionStartTimeRef.current > 0) {
          const totalTime = Date.now() - sessionStartTimeRef.current;
          setAIMetrics(prev => ({ ...prev, timeWithAI: totalTime }));
        }
      };

      socket.onerror = (error) => {
        console.error('Lumina AI WebSocket error:', error);
        // Don't set isConnected here — onclose always fires after onerror
        // and will handle the state update. Setting it in both causes double re-renders.
      };

    } catch (error) {
      console.error('Error connecting to Lumina AI:', error);
      setIsConnected(false);
    }
  }, [buildLessonContext, processAndPlayRawAudio]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close(1000, 'Manual disconnect');
      socketRef.current = null;
    }

    if (audioServiceRef.current) {
      audioServiceRef.current.destroy();
      audioServiceRef.current = null;
    }

    // Stop any queued audio playback
    stopAudioPlayback();

    setIsConnected(false);
    setConversation([]);

    // Calculate final time
    if (sessionStartTimeRef.current > 0) {
      const totalTime = Date.now() - sessionStartTimeRef.current;
      setAIMetrics(prev => ({ ...prev, timeWithAI: totalTime }));
    }
  }, [stopAudioPlayback]);

  const requestHint = useCallback((level: 1 | 2 | 3, currentState?: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot request hint: not connected');
      return;
    }

    setIsAIResponding(true);

    // Track hint request locally
    setAIMetrics(prev => ({
      ...prev,
      totalHints: prev.totalHints + 1,
      totalInteractions: prev.totalInteractions + 1,
      hintsGiven: {
        ...prev.hintsGiven,
        [`level${level}`]: prev.hintsGiven[`level${level}` as keyof typeof prev.hintsGiven] + 1,
      },
    }));

    // Add to conversation
    setConversation(prev => [
      ...prev,
      {
        role: 'user',
        content: `Requested Level ${level} hint`,
        timestamp: Date.now(),
        isAudio: false,
      },
    ]);

    // Send to server
    socketRef.current.send(JSON.stringify({
      type: 'request_hint',
      hint_level: level,
      current_state: currentState || currentPrimitiveRef.current?.primitive_data,
    }));
  }, []);

  const sendVoice = useCallback((audioData: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send voice: not connected');
      return;
    }

    setAIMetrics(prev => ({
      ...prev,
      voiceInteractions: prev.voiceInteractions + 1,
      conversationTurns: prev.conversationTurns + 1,
      totalInteractions: prev.totalInteractions + 1,
    }));

    setIsAIResponding(true);

    socketRef.current.send(JSON.stringify({
      type: 'audio',
      data: audioData,
    }));
  }, []);

  const sendText = useCallback((text: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send text: not connected');
      return;
    }

    setAIMetrics(prev => ({
      ...prev,
      conversationTurns: prev.conversationTurns + 1,
      totalInteractions: prev.totalInteractions + 1,
    }));

    setConversation(prev => [
      ...prev,
      {
        role: 'user',
        content: text,
        timestamp: Date.now(),
        isAudio: false,
      },
    ]);

    setIsAIResponding(true);

    socketRef.current.send(JSON.stringify({
      type: 'text',
      content: text,
    }));
  }, []);

  const updateContext = useCallback((newState: any, progress?: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    // Update local primitive context
    if (currentPrimitiveRef.current) {
      currentPrimitiveRef.current.primitive_data = {
        ...currentPrimitiveRef.current.primitive_data,
        ...newState,
      };
    }

    // Send update to server
    socketRef.current.send(JSON.stringify({
      type: 'update_context',
      primitive_data: newState,
      student_progress: progress,
    }));
  }, []);

  const startListening = useCallback(() => {
    if (audioServiceRef.current && socketRef.current) {
      audioServiceRef.current.startRecording();
    }
  }, []);

  const stopListening = useCallback(() => {
    if (audioServiceRef.current) {
      audioServiceRef.current.stopRecording();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (audioServiceRef.current) {
        audioServiceRef.current.destroy();
      }
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  const value: LuminaAIContextType = {
    connect,
    disconnect,
    isConnected,
    requestHint,
    sendVoice,
    sendText,
    updateContext,
    conversation,
    isAIResponding,
    aiMetrics,
    startListening,
    stopListening,
    isListening,
  };

  return (
    <LuminaAIContext.Provider value={value}>
      {children}
    </LuminaAIContext.Provider>
  );
};

export const useLuminaAIContext = () => {
  const context = useContext(LuminaAIContext);
  if (!context) {
    throw new Error('useLuminaAIContext must be used within a LuminaAIProvider');
  }
  return context;
};
