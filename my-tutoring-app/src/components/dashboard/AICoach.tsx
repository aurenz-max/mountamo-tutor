'use client';

import React, { useReducer, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  X, 
  Bot, 
  User, 
  Volume2, 
  VolumeX,
  MessageCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useAuth } from '@/contexts/AuthContext';
import { useAICoach } from '@/contexts/AICoachContext';

// Same types as before...
type AICoachMode = 'sidebar';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface LearningContext {
  type: 'subskill' | 'daily_planning' | 'activity' | 'practice';
  title?: string;
  focus_area?: string;
  metadata?: any;
}

interface AICoachState {
  conversation: {
    messages: Message[];
    isActive: boolean;
    isResponding: boolean;
  };
  audio: {
    isListening: boolean;
    isPlaying: boolean;
    isMuted: boolean;
  };
  ui: {
    context: LearningContext | null;
    showAdvancedMode: boolean;
  };
}

type AICoachAction = 
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_RESPONDING'; isResponding: boolean }
  | { type: 'SET_LISTENING'; isListening: boolean }
  | { type: 'SET_MUTED'; isMuted: boolean }
  | { type: 'SET_CONTEXT'; context: LearningContext }
  | { type: 'START_CONVERSATION' }
  | { type: 'TOGGLE_ADVANCED_MODE' }
  | { type: 'RESET' };

const initialState: AICoachState = {
  conversation: { messages: [], isActive: false, isResponding: false },
  audio: { isListening: false, isPlaying: false, isMuted: false },
  ui: { context: null, showAdvancedMode: false }
};

function aiCoachReducer(state: AICoachState, action: AICoachAction): AICoachState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.message]
        }
      };
    case 'SET_RESPONDING':
      return {
        ...state,
        conversation: { ...state.conversation, isResponding: action.isResponding }
      };
    case 'SET_LISTENING':
      return {
        ...state,
        audio: { ...state.audio, isListening: action.isListening }
      };
    case 'SET_MUTED':
      return {
        ...state,
        audio: { ...state.audio, isMuted: action.isMuted }
      };
    case 'SET_CONTEXT':
      return {
        ...state,
        ui: { ...state.ui, context: action.context }
      };
    case 'START_CONVERSATION':
      return {
        ...state,
        conversation: { ...state.conversation, isActive: true }
      };
    case 'TOGGLE_ADVANCED_MODE':
      return {
        ...state,
        ui: { ...state.ui, showAdvancedMode: !state.ui.showAdvancedMode }
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface AICoachProps {
  studentId?: number;
  mode?: AICoachMode;
  context?: LearningContext;
  onClose?: () => void;
  className?: string;
  persistConnection?: boolean;
}

const AICoach: React.FC<AICoachProps> = ({
  studentId,
  mode = 'sidebar',
  context,
  onClose,
  className = '',
  persistConnection = false
}) => {
  const [state, dispatch] = useReducer(aiCoachReducer, initialState);
  const { getAuthToken, userProfile } = useAuth();
  const { connection, connectToAI, sendMessage, isAIConnected } = useAICoach();
  
  const effectiveStudentId = studentId || userProfile?.student_id;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Audio processing refs
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScheduledTimeRef = useRef<number>(0);

  // Audio constants
  const PLAYBACK_SAMPLE_RATE = 24000;
  const BUFFER_GAP = 0.02;
  const MAX_BUFFER_QUEUE = 10;

  // Set context when provided
  useEffect(() => {
    if (context) {
      dispatch({ type: 'SET_CONTEXT', context });
      
      // Send context to AI if connected
      if (isAIConnected && connection.socket) {
        sendContextToAI(context);
      }
    }
  }, [context, isAIConnected]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.conversation.messages]);

  // Handle WebSocket messages from the global connection
  useEffect(() => {
    if (!connection.socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Always reset the response timeout to prevent it from firing
        if (responseTimeoutRef.current) {
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
        }
        
        switch (data.type) {
          case 'auth_success':
            dispatch({ 
              type: 'ADD_MESSAGE', 
              message: { 
                role: 'system', 
                content: `[Connected to AI Learning Coach for Student ${data.student_id}]`, 
                timestamp: new Date() 
              }
            });
            break;

          case 'status':
            dispatch({ 
              type: 'ADD_MESSAGE', 
              message: { 
                role: 'system', 
                content: `[${data.message}]`, 
                timestamp: new Date() 
              }
            });
            break;

          case 'context_received':
            dispatch({ 
              type: 'ADD_MESSAGE', 
              message: { 
                role: 'system', 
                content: `[AI Coach is now focused on: ${data.focus_area || 'your learning'}]`, 
                timestamp: new Date() 
              }
            });
            break;

          case 'ai_text':
            dispatch({ 
              type: 'ADD_MESSAGE', 
              message: { role: 'assistant', content: data.content, timestamp: new Date() }
            });
            dispatch({ type: 'SET_RESPONDING', isResponding: false });
            break;

          case 'ai_audio':
            processAndPlayRawAudio(
              data.data, 
              data.sampleRate || PLAYBACK_SAMPLE_RATE
            );
            dispatch({ type: 'SET_RESPONDING', isResponding: false });
            break;

          case 'user_transcription':
            // Handle user speech transcription if provided
            if (data.content) {
              dispatch({ 
                type: 'ADD_MESSAGE', 
                message: { role: 'user', content: data.content, timestamp: new Date() }
              });
            }
            break;

          case 'error':
            console.error('Error from AI Coach server:', data.error || data.message);
            dispatch({ type: 'SET_RESPONDING', isResponding: false });
            break;

          default:
            // Unknown message type - silently ignore
            break;
        }
      } catch (error) {
        console.error('Error parsing AI Coach WebSocket message:', error);
        dispatch({ type: 'SET_RESPONDING', isResponding: false });
      }
    };

    connection.socket.addEventListener('message', handleMessage);
    
    return () => {
      if (connection.socket) {
        connection.socket.removeEventListener('message', handleMessage);
      }
    };
  }, [connection.socket]);

  // Cleanup effect - FIXED: Now properly separated
  useEffect(() => {
    return () => {
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
      }
      
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close().catch(err => {
          console.error('Error closing playback audio context:', err);
        });
      }
    };
  }, []);

  // Audio processing methods - copied exactly from DailyBriefingGemini
  const processAndPlayRawAudio = (base64Data: string, sampleRate: number = PLAYBACK_SAMPLE_RATE): void => {
    if (state.audio.isMuted) return; // Don't play audio if muted
    
    try {
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }
      
      // Create playback audio context if it doesn't exist
      if (!playbackAudioContextRef.current) {
        try {
          playbackAudioContextRef.current = new AudioContext({
            sampleRate: sampleRate,
          });
        } catch (error) {
          console.error('Error creating audio context:', error);
          return;
        }
      }
      
      // Convert to Int16 PCM
      const int16View = new Int16Array(arrayBuffer);
      
      // Convert to Float32 for Web Audio API
      const numFrames = int16View.length;
      const floatData = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        floatData[i] = int16View[i] / 32768.0;
      }
      
      // Create an audio buffer
      const audioBuffer = playbackAudioContextRef.current.createBuffer(
        1, // mono
        numFrames,
        sampleRate
      );
      
      // Copy the float data to the buffer
      audioBuffer.copyToChannel(floatData, 0);
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      
      // Check if buffer queue has grown too large
      if (audioQueueRef.current.length > MAX_BUFFER_QUEUE) {
        consolidateBuffers();
      }
      
      // If not currently playing, start playback
      if (!isPlayingRef.current) {
        // Ensure the audio context is in a running state
        if (playbackAudioContextRef.current.state === 'suspended') {
          playbackAudioContextRef.current.resume().catch(error => {
            console.error('Error resuming audio context:', error);
          });
        }
        playNextAudioInQueue();
      }
    } catch (error) {
      console.error('Error processing raw audio data:', error);
    }
  };

  const consolidateBuffers = () => {
    if (!playbackAudioContextRef.current || audioQueueRef.current.length <= 1) {
      return;
    }
    
    let totalLength = 0;
    audioQueueRef.current.forEach(buffer => {
      totalLength += buffer.length;
    });
    
    const consolidatedBuffer = playbackAudioContextRef.current.createBuffer(
      1, // mono
      totalLength,
      playbackAudioContextRef.current.sampleRate
    );
    
    const outputData = consolidatedBuffer.getChannelData(0);
    let offset = 0;
    
    audioQueueRef.current.forEach(buffer => {
      const bufferData = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        outputData[offset + i] = bufferData[i];
      }
      offset += buffer.length;
    });
    
    audioQueueRef.current = [consolidatedBuffer];
  };

  const playNextAudioInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    
    if (!playbackAudioContextRef.current) {
      isPlayingRef.current = false;
      return;
    }
    
    const audioBuffer = audioQueueRef.current.shift();
    if (!audioBuffer) {
      isPlayingRef.current = false;
      return;
    }
    
    const source = playbackAudioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackAudioContextRef.current.destination);
    
    const currentTime = playbackAudioContextRef.current.currentTime;
    const bufferDuration = audioBuffer.duration;
    
    let startTime;
    if (bufferDuration < 0.05) {
      startTime = Math.max(currentTime, lastScheduledTimeRef.current);
    } else {
      startTime = Math.max(currentTime, lastScheduledTimeRef.current + BUFFER_GAP);
    }
    
    lastScheduledTimeRef.current = startTime + bufferDuration;
    audioSourceNodeRef.current = source;
    source.start(startTime);
    
    source.onended = () => {
      audioSourceNodeRef.current = null;
      
      if (audioQueueRef.current.length > 0) {
        setTimeout(() => {
          playNextAudioInQueue();
        }, 10);
      } else {
        isPlayingRef.current = false;
      }
    };
  };

  const sendContextToAI = (contextToSend: LearningContext) => {
    if (!isAIConnected || !effectiveStudentId) return;

    const contextPayload = {
      type: 'context',
      context_type: contextToSend.type,
      data: {
        ...contextToSend,
        student_id: effectiveStudentId
      }
    };
    
    sendMessage(contextPayload);
  };

  const startConversation = async () => {
    dispatch({ type: 'START_CONVERSATION' });
    
    if (!isAIConnected && effectiveStudentId) {
      await connectToAI(effectiveStudentId, getAuthToken);
    }
  };

  const toggleMicrophone = async () => {
    if (state.audio.isListening) {
      // Stop recording logic
      if (connection.audioService) {
        connection.audioService.stopCapture();
      }
            
      dispatch({ type: 'SET_LISTENING', isListening: false });
    } else {
      // Start recording logic
      if (connection.audioService) {
        await connection.audioService.startCapture();
        dispatch({ type: 'SET_LISTENING', isListening: true });
        dispatch({ type: 'SET_RESPONDING', isResponding: true });
      }
    }
  };

  const getContextDisplayName = (): string => {
    if (!state.ui.context) return 'General Learning Support';
    
    switch (state.ui.context.type) {
      case 'subskill':
        return state.ui.context.title || 'Skill-Focused Learning';
      case 'daily_planning':
        return 'Daily Learning Plan';
      case 'activity':
        return 'Activity Guidance';
      case 'practice':
        return 'Practice Session';
      default:
        return 'Learning Support';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div>
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span className="font-semibold">AI Coach</span>
            {isAIConnected && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            )}
          </div>
          {state.ui.context && (
            <div className="text-xs text-white/80 mt-1">
              {getContextDisplayName()}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={() => dispatch({ type: 'SET_MUTED', isMuted: !state.audio.isMuted })}
          >
            {state.audio.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!state.conversation.isActive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">
              {isAIConnected ? 'Connected and ready!' : 'Ready to help!'}
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              {state.ui.context ? 
                `I'm ready to discuss ${getContextDisplayName().toLowerCase()}` :
                'I can help with your learning questions'
              }
            </p>
            <Button 
              onClick={startConversation} 
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!effectiveStudentId}
            >
              <Mic className="h-4 w-4 mr-2" />
              {isAIConnected ? 'Start Conversation' : 'Connect & Start Chat'}
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            {/* Status indicator */}
            <div className="text-center">
              <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                state.audio.isListening ? 'bg-red-100 text-red-800 border border-red-200' :
                state.conversation.isResponding ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                !isAIConnected ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                'bg-green-100 text-green-800 border border-green-200'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  state.audio.isListening ? 'bg-red-500 animate-pulse' :
                  state.conversation.isResponding ? 'bg-blue-500 animate-bounce' :
                  !isAIConnected ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}></div>
                {state.audio.isListening ? 'Listening...' :
                 state.conversation.isResponding ? 'AI speaking...' :
                 !isAIConnected ? 'Connecting...' :
                 'Ready to listen'}
              </div>
            </div>

            {/* Recent messages */}
            <ScrollArea className="flex-1">
              {state.conversation.messages.length === 0 && !state.conversation.isResponding && (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Start speaking to begin!</p>
                </div>
              )}

              <div className="space-y-3">
                {state.conversation.messages.slice(-3).map((msg, index) => (
                  <Card key={index} className={`${
                    msg.role === 'user' 
                      ? 'bg-purple-50 border-purple-200' 
                      : msg.role === 'system'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-blue-50 border-blue-200'
                  }`}>
                    <CardContent className="p-3">
                      <div className="flex items-start space-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user' 
                            ? 'bg-purple-500' 
                            : msg.role === 'system'
                              ? 'bg-gray-400'
                              : 'bg-blue-500'
                        }`}>
                          {msg.role === 'user' ? (
                            <User className="h-3 w-3 text-white" />
                          ) : msg.role === 'system' ? (
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          ) : (
                            <Bot className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-700 mb-1">
                            {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'AI Coach'}
                          </div>
                          <div className="text-sm text-gray-900">{msg.content}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {state.conversation.isResponding && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-xs text-gray-600">AI Coach is responding...</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Microphone control */}
            <div className="flex flex-col items-center space-y-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleMicrophone}
                      disabled={!isAIConnected}
                      className={`w-16 h-16 rounded-full transition-all duration-300 ${
                        state.audio.isListening 
                          ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 scale-110 animate-pulse' 
                          : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl hover:scale-105'
                      }`}
                    >
                      {state.audio.isListening ? (
                        <MicOff className="h-6 w-6 text-white" />
                      ) : (
                        <Mic className="h-6 w-6 text-white" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {state.audio.isListening ? 'Stop speaking' : 'Start speaking'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="text-center">
                <p className="text-xs text-gray-600">
                  {state.audio.isListening ? 'Release when finished speaking' :
                   state.conversation.isResponding ? 'AI Coach is responding...' :
                   !isAIConnected ? 'Connecting...' :
                   'Tap to speak with your AI coach'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AICoach;