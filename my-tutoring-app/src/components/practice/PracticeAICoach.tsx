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
  HelpCircle,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  PlayCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useAuth } from '@/contexts/AuthContext';
import { useAICoach } from '@/contexts/AICoachContext';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  action?: string;
}

interface ProblemContext {
  currentProblem?: any;
  currentIndex?: number;
  totalProblems?: number;
  isSubmitted?: boolean;
}

interface SubmissionResult {
  is_correct: boolean;
  score: number;
  feedback: any;
}

interface PracticeAICoachState {
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
    showAdvancedMode: boolean;
    currentProblemContext: ProblemContext | null;
  };
}

type PracticeAICoachAction = 
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_RESPONDING'; isResponding: boolean }
  | { type: 'SET_LISTENING'; isListening: boolean }
  | { type: 'SET_MUTED'; isMuted: boolean }
  | { type: 'START_CONVERSATION' }
  | { type: 'TOGGLE_ADVANCED_MODE' }
  | { type: 'SET_PROBLEM_CONTEXT'; context: ProblemContext }
  | { type: 'RESET' };

const initialState: PracticeAICoachState = {
  conversation: { messages: [], isActive: false, isResponding: false },
  audio: { isListening: false, isPlaying: false, isMuted: false },
  ui: { showAdvancedMode: false, currentProblemContext: null }
};

function practiceAICoachReducer(state: PracticeAICoachState, action: PracticeAICoachAction): PracticeAICoachState {
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
    case 'SET_PROBLEM_CONTEXT':
      return {
        ...state,
        ui: { ...state.ui, currentProblemContext: action.context }
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface PracticeAICoachProps {
  studentId?: number;
  practiceContext?: {
    subject?: string;
    skill_description?: string;
    subskill_description?: string;
    skill_id?: string;
    subskill_id?: string;
  };
  problemContext?: ProblemContext;
  onClose?: () => void;
  className?: string;
}

const PracticeAICoach = React.forwardRef<{ sendSubmissionResult: (result: any) => void }, PracticeAICoachProps>(({
  studentId,
  practiceContext,
  problemContext,
  onClose,
  className = ''
}, ref) => {
  const [state, dispatch] = useReducer(practiceAICoachReducer, initialState);
  const { getAuthToken, userProfile } = useAuth();
  const { connection, connectToAI, sendMessage, isAIConnected, switchEndpoint } = useAICoach();
  
  const effectiveStudentId = studentId || userProfile?.student_id;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Audio processing refs - reusing the same system as the main AICoach
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

  // Update problem context when it changes
  useEffect(() => {
    if (problemContext) {
      dispatch({ type: 'SET_PROBLEM_CONTEXT', context: problemContext });
      
      // If we have a new problem and we're connected, notify the AI
      if (isAIConnected && problemContext.currentProblem) {
        notifyAIOfNewProblem(problemContext.currentProblem);
      }
    }
  }, [problemContext, isAIConnected]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.conversation.messages]);

  // Handle WebSocket messages from the practice tutor endpoint
  useEffect(() => {
    if (!connection.socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Clear response timeout
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
                content: '🎯 Practice Tutor connected and ready to help!', 
                timestamp: new Date() 
              }
            });
            break;

          case 'session_ready':
            dispatch({ 
              type: 'ADD_MESSAGE', 
              message: { 
                role: 'system', 
                content: '✅ AI Tutor session is ready for practice!', 
                timestamp: new Date() 
              }
            });
            // Now that the session is ready, expect the AI's greeting
            dispatch({ type: 'SET_RESPONDING', isResponding: true });
            break;

          case 'ai_audio':
            processAndPlayRawAudio(
              data.data, 
              data.sampleRate || PLAYBACK_SAMPLE_RATE
            );
            dispatch({ type: 'SET_RESPONDING', isResponding: false });
            break;

          case 'user_transcription':
            if (data.content) {
              dispatch({ 
                type: 'ADD_MESSAGE', 
                message: { role: 'user', content: data.content, timestamp: new Date() }
              });
            }
            break;

          case 'error':
            console.error('Error from Practice Tutor:', data.error || data.message);
            dispatch({ type: 'SET_RESPONDING', isResponding: false });
            break;

          default:
            break;
        }
      } catch (error) {
        console.error('Error parsing Practice Tutor WebSocket message:', error);
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

  // Cleanup effect
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

  // Audio processing methods (copied from main AICoach)
  const processAndPlayRawAudio = (base64Data: string, sampleRate: number = PLAYBACK_SAMPLE_RATE): void => {
    if (state.audio.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }
      
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
      
      const int16View = new Int16Array(arrayBuffer);
      const numFrames = int16View.length;
      const floatData = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        floatData[i] = int16View[i] / 32768.0;
      }
      
      const audioBuffer = playbackAudioContextRef.current.createBuffer(1, numFrames, sampleRate);
      audioBuffer.copyToChannel(floatData, 0);
      
      audioQueueRef.current.push(audioBuffer);
      
      if (audioQueueRef.current.length > MAX_BUFFER_QUEUE) {
        consolidateBuffers();
      }
      
      if (!isPlayingRef.current) {
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
    if (!playbackAudioContextRef.current || audioQueueRef.current.length <= 1) return;
    
    let totalLength = 0;
    audioQueueRef.current.forEach(buffer => totalLength += buffer.length);
    
    const consolidatedBuffer = playbackAudioContextRef.current.createBuffer(
      1, totalLength, playbackAudioContextRef.current.sampleRate
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
        setTimeout(() => playNextAudioInQueue(), 10);
      } else {
        isPlayingRef.current = false;
      }
    };
  };

  // Practice-specific methods
  const notifyAIOfNewProblem = (problem: any) => {
    if (!isAIConnected || !problem) return;

    sendMessage({
      type: 'new_problem',
      problem_context: {
        problem_data: problem
      }
    });
  };

  const sendPracticeAction = (action: string, additionalData?: any) => {
    if (!isAIConnected) return;

    let messageType = '';
    let userMessage = '';
    
    switch (action) {
      case 'hint':
        messageType = 'hint_request';
        userMessage = 'Asked for a hint';
        break;
      case 'explain':
        messageType = 'concept_explanation';
        userMessage = 'Asked for concept explanation';
        break;
      case 'check-work':
        messageType = 'check_work';
        userMessage = 'Asked AI to check work';
        break;
      case 'walk-through':
        messageType = 'text';
        userMessage = 'Asked for step-by-step walkthrough';
        break;
      default:
        return;
    }

    sendMessage({
      type: messageType,
      content: userMessage,
      ...additionalData
    });

    // Add user action to chat
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        action: action
      }
    });

    dispatch({ type: 'SET_RESPONDING', isResponding: true });
  };

  const sendSubmissionResult = (result: SubmissionResult) => {
    if (!isAIConnected) return;

    sendMessage({
      type: 'result_feedback',
      is_correct: result.is_correct,
      score: result.score,
      content: result.feedback
    });

    dispatch({ type: 'SET_RESPONDING', isResponding: true });
  };

  const startConversation = async () => {
    dispatch({ type: 'START_CONVERSATION' });
    
    if (!isAIConnected && effectiveStudentId && practiceContext) {
      await connectToAI(effectiveStudentId, getAuthToken, 'practice-tutor', practiceContext);
    }
  };

  const toggleMicrophone = async () => {
    if (state.audio.isListening) {
      if (connection.audioService) {
        connection.audioService.stopCapture();
      }
      dispatch({ type: 'SET_LISTENING', isListening: false });
    } else {
      if (connection.audioService) {
        await connection.audioService.startCapture();
        dispatch({ type: 'SET_LISTENING', isListening: true });
        dispatch({ type: 'SET_RESPONDING', isResponding: true });
      }
    }
  };

  const getCurrentProblemInfo = () => {
    const context = state.ui.currentProblemContext;
    if (!context || !context.currentProblem) return null;

    const problem = context.currentProblem;
    const problemText = problem.question || problem.problem || problem.prompt || problem.statement || problem.text_with_blanks;
    
    return {
      text: problemText,
      number: (context.currentIndex || 0) + 1,
      total: context.totalProblems || 1,
      isSubmitted: context.isSubmitted || false
    };
  };

  // Expose method for parent components to send submission results
  React.useImperativeHandle(ref, () => ({
    sendSubmissionResult
  }));

  const problemInfo = getCurrentProblemInfo();

  return (
    <div className={`flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <div>
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span className="font-semibold">Practice Tutor</span>
            {isAIConnected && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            )}
          </div>
          <div className="text-xs text-white/80 mt-1">
            AI-powered practice guidance
          </div>
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

      {/* Problem Context Info */}
      {problemInfo && (
        <div className="p-3 bg-gray-50 border-b">
          <div className="text-xs text-gray-600 mb-1">
            Problem {problemInfo.number} of {problemInfo.total}
            {problemInfo.isSubmitted && (
              <Badge variant="secondary" className="ml-2 text-xs">Completed</Badge>
            )}
          </div>
          <div className="text-sm text-gray-800 line-clamp-2">
            {problemInfo.text?.substring(0, 100)}
            {problemInfo.text && problemInfo.text.length > 100 && '...'}
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!state.conversation.isActive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">
              {isAIConnected ? 'Practice Tutor Ready!' : 'Ready to Help!'}
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              I'm here to help you with hints, explanations, and guidance during your practice session.
            </p>
            <Button 
              onClick={startConversation} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!effectiveStudentId}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {isAIConnected ? 'Start Practice Session' : 'Connect & Start'}
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
                 state.conversation.isResponding ? 'Tutor responding...' :
                 !isAIConnected ? 'Connecting...' :
                 'Ready to help'}
              </div>
            </div>

            {/* Practice Action Buttons */}
            {isAIConnected && (
              <div className="mb-4">
                <div className="text-xs text-gray-600 mb-3 text-center font-medium">Quick Help:</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => sendPracticeAction('hint')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                    disabled={state.conversation.isResponding}
                  >
                    <Lightbulb className="h-3 w-3" />
                    <span>Give Hint</span>
                  </Button>
                  <Button
                    onClick={() => sendPracticeAction('explain')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                    disabled={state.conversation.isResponding}
                  >
                    <BookOpen className="h-3 w-3" />
                    <span>Explain</span>
                  </Button>
                  <Button
                    onClick={() => sendPracticeAction('walk-through')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                    disabled={state.conversation.isResponding}
                  >
                    <ArrowRight className="h-3 w-3" />
                    <span>Walk Through</span>
                  </Button>
                  <Button
                    onClick={() => sendPracticeAction('check-work')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-green-600 border-green-200 hover:bg-green-50"
                    disabled={state.conversation.isResponding}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Check Work</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1">
              {state.conversation.messages.length === 0 && !state.conversation.isResponding && (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Use the buttons above or speak to get help!</p>
                </div>
              )}

              <div className="space-y-3">
                {state.conversation.messages.slice(-4).map((msg, index) => (
                  <Card key={index} className={`${
                    msg.role === 'user' 
                      ? 'bg-blue-50 border-blue-200' 
                      : msg.role === 'system'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-purple-50 border-purple-200'
                  }`}>
                    <CardContent className="p-3">
                      <div className="flex items-start space-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user' 
                            ? 'bg-blue-500' 
                            : msg.role === 'system'
                              ? 'bg-gray-400'
                              : 'bg-purple-500'
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
                            {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Practice Tutor'}
                          </div>
                          <div className="text-sm text-gray-900">{msg.content}</div>
                          {msg.action && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {msg.action}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {state.conversation.isResponding && (
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-xs text-gray-600">Practice tutor is responding...</span>
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
                      className={`w-14 h-14 rounded-full transition-all duration-300 ${
                        state.audio.isListening 
                          ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 scale-110 animate-pulse' 
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl hover:scale-105'
                      }`}
                    >
                      {state.audio.isListening ? (
                        <MicOff className="h-5 w-5 text-white" />
                      ) : (
                        <Mic className="h-5 w-5 text-white" />
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
                   state.conversation.isResponding ? 'Practice tutor is responding...' :
                   !isAIConnected ? 'Connecting...' :
                   'Tap to speak or use quick help buttons above'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

PracticeAICoach.displayName = 'PracticeAICoach';

export default PracticeAICoach;