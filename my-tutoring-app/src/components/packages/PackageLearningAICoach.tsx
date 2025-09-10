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
  Eye,
  Lightbulb,
  Target,
  PlayCircle,
  CheckCircle,
  Circle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface PackageLearningContext {
  packageId: string;
  packageTitle: string;
  subject?: string;
  skill?: string;
  subskill?: string;
  learningObjectives?: string[];
  currentSection?: string;
  totalSections?: number;
}

interface PackageLearningAICoachState {
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
    packageContext: PackageLearningContext | null;
    showAdvancedMode: boolean;
    completedObjectives: number[];
  };
}

type PackageLearningAICoachAction = 
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_RESPONDING'; isResponding: boolean }
  | { type: 'SET_LISTENING'; isListening: boolean }
  | { type: 'SET_MUTED'; isMuted: boolean }
  | { type: 'SET_PACKAGE_CONTEXT'; context: PackageLearningContext }
  | { type: 'START_CONVERSATION' }
  | { type: 'TOGGLE_ADVANCED_MODE' }
  | { type: 'COMPLETE_OBJECTIVE'; index: number }
  | { type: 'RESET' };

const initialState: PackageLearningAICoachState = {
  conversation: { messages: [], isActive: false, isResponding: false },
  audio: { isListening: false, isPlaying: false, isMuted: false },
  ui: { packageContext: null, showAdvancedMode: false, completedObjectives: [] }
};

function packageLearningAICoachReducer(state: PackageLearningAICoachState, action: PackageLearningAICoachAction): PackageLearningAICoachState {
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
    case 'SET_PACKAGE_CONTEXT':
      return {
        ...state,
        ui: { ...state.ui, packageContext: action.context }
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
    case 'COMPLETE_OBJECTIVE':
      return {
        ...state,
        ui: { 
          ...state.ui, 
          completedObjectives: [...state.ui.completedObjectives, action.index] 
        }
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface PackageLearningAICoachProps {
  packageId: string;
  studentId?: number;
  packageContext: PackageLearningContext;
  onClose?: () => void;
  className?: string;
  onObjectiveComplete?: (objectiveIndex: number) => void;
}

const PackageLearningAICoach = React.forwardRef<any, PackageLearningAICoachProps>(({
  packageId,
  studentId,
  packageContext,
  onClose,
  className = '',
  onObjectiveComplete
}, ref) => {
  const [state, dispatch] = useReducer(packageLearningAICoachReducer, initialState);
  const { getAuthToken, userProfile } = useAuth();
  const { connection, connectToAI, sendMessage, isAIConnected, switchEndpoint } = useAICoach();
  
  const effectiveStudentId = studentId || userProfile?.student_id;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Audio processing refs - same system as PracticeAICoach
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

  // Set package context when provided
  useEffect(() => {
    if (packageContext) {
      dispatch({ type: 'SET_PACKAGE_CONTEXT', context: packageContext });
      
      // Send context to AI if connected
      if (isAIConnected && connection.socket) {
        sendPackageContextToAI(packageContext);
      }
    }
  }, [packageContext, isAIConnected]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.conversation.messages]);

  // Handle WebSocket messages from the education endpoint
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
                content: `✅ Connected to AI Tutor for "${packageContext.packageTitle}"`, 
                timestamp: new Date() 
              }
            });
            break;

          case 'text':
            dispatch({ 
              type: 'ADD_MESSAGE', 
              message: { role: 'assistant', content: data.content, timestamp: new Date() }
            });
            dispatch({ type: 'SET_RESPONDING', isResponding: false });
            
            // Check for objective completion
            checkForObjectiveCompletion(data.content);
            break;

          case 'audio':
            processAndPlayRawAudio(
              data.data, 
              data.sampleRate || PLAYBACK_SAMPLE_RATE
            );
            dispatch({ type: 'SET_RESPONDING', isResponding: false });
            break;

          case 'input_transcription':
            if (data.content) {
              dispatch({ 
                type: 'ADD_MESSAGE', 
                message: { role: 'user', content: data.content, timestamp: new Date() }
              });
            }
            break;

          case 'output_transcription':
            // Optional: Handle AI speech transcription for accessibility
            break;

          case 'error':
            console.error('Error from Package Learning AI:', data.message);
            dispatch({ type: 'SET_RESPONDING', isResponding: false });
            break;

          default:
            break;
        }
      } catch (error) {
        console.error('Error parsing Package Learning AI WebSocket message:', error);
        dispatch({ type: 'SET_RESPONDING', isResponding: false });
      }
    };

    connection.socket.addEventListener('message', handleMessage);
    
    return () => {
      if (connection.socket) {
        connection.socket.removeEventListener('message', handleMessage);
      }
    };
  }, [connection.socket, packageContext]);

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

  // Audio processing methods (same as PracticeAICoach)
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

  // Package-specific methods
  const sendPackageContextToAI = (context: PackageLearningContext) => {
    if (!isAIConnected || !effectiveStudentId) return;

    const contextPayload = {
      type: 'context',
      context_type: 'package_learning',
      data: {
        ...context,
        student_id: effectiveStudentId
      }
    };
    
    sendMessage(contextPayload);
  };

  const sendPackageAction = (action: string, additionalData?: any) => {
    if (!isAIConnected) return;

    let messageType = '';
    let userMessage = '';
    
    switch (action) {
      case 'explain-concept':
        messageType = 'text';
        userMessage = 'Can you explain the main concepts in this learning package?';
        break;
      case 'clarify-objective':
        messageType = 'text';
        userMessage = 'Can you help me understand the learning objectives better?';
        break;
      case 'ask-about-visual':
        messageType = 'text';
        userMessage = 'Can you explain how the visualization works?';
        break;
      case 'help-with-practice':
        messageType = 'text';
        userMessage = 'Can you help me with the practice problems?';
        break;
      case 'summarize-content':
        messageType = 'text';
        userMessage = 'Can you summarize the key takeaways from this content?';
        break;
      case 'real-world-application':
        messageType = 'text';
        userMessage = 'How does this apply to real-world situations?';
        break;
      case 'contextual-help':
        messageType = 'text';
        userMessage = additionalData?.content || '';
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

  const checkForObjectiveCompletion = (content: string) => {
    if (!state.ui.packageContext?.learningObjectives) return;
    
    // Simple completion detection - you can enhance this logic
    const completionKeywords = ['completed', 'mastered', 'understood', 'learned', 'achieved', 'great job'];
    if (completionKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
      const uncompletedObjectives = state.ui.packageContext.learningObjectives
        .map((_, index) => index)
        .filter(index => !state.ui.completedObjectives.includes(index));
      
      if (uncompletedObjectives.length > 0) {
        const randomIndex = uncompletedObjectives[Math.floor(Math.random() * uncompletedObjectives.length)];
        dispatch({ type: 'COMPLETE_OBJECTIVE', index: randomIndex });
        
        // Notify parent component
        if (onObjectiveComplete) {
          onObjectiveComplete(randomIndex);
        }
      }
    }
  };

  const startConversation = async () => {
    dispatch({ type: 'START_CONVERSATION' });
    
    if (!isAIConnected && effectiveStudentId && packageContext) {
      // Connect to education endpoint with package context
      const educationContext = {
        type: 'package_learning',
        packageId: packageContext.packageId,
        packageTitle: packageContext.packageTitle,
        subject: packageContext.subject,
        learningObjectives: packageContext.learningObjectives
      };
      
      await connectToAI(effectiveStudentId, getAuthToken, 'education', educationContext);
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

  const getSuggestedQuestions = () => {
    const context = state.ui.packageContext;
    if (!context) return [];

    return [
      `What will I learn about ${context.subject || 'this topic'}?`,
      'Explain the key concepts',
      'How does the visualization work?',
      'Give me practice examples',
      'How does this apply to real life?'
    ];
  };

  // Update context when parent component requests it
  const updateContext = (newContext: PackageLearningContext) => {
    dispatch({ type: 'SET_PACKAGE_CONTEXT', context: newContext });
    
    // Send updated context to AI if connected
    if (isAIConnected && connection.socket) {
      sendPackageContextToAI(newContext);
    }
  };

  // Send contextual help from reading content interactions
  const sendContextualHelp = (message: string) => {
    if (!message.trim()) return;
    sendPackageAction('contextual-help', { content: message });
  };

  // Expose methods for parent components
  React.useImperativeHandle(ref, () => ({
    updateContext,
    sendContextualHelp
  }));

  return (
    <div className={`flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
        <div>
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span className="font-semibold">Learning Tutor</span>
            {isAIConnected && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            )}
          </div>
          <div className="text-xs text-white/80 mt-1">
            {state.ui.packageContext?.packageTitle || 'AI-powered learning guidance'}
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

      {/* Package Context Info */}
      {state.ui.packageContext && (
        <div className="p-3 bg-indigo-50 border-b">
          <div className="text-xs text-indigo-600 mb-1">
            {state.ui.packageContext.subject && (
              <Badge variant="secondary" className="text-xs mr-2">
                {state.ui.packageContext.subject}
              </Badge>
            )}
            {state.ui.packageContext.currentSection && (
              <span>Currently: {state.ui.packageContext.currentSection}</span>
            )}
          </div>
          <div className="text-sm text-indigo-800">
            Interactive learning session for "{state.ui.packageContext.packageTitle}"
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!state.conversation.isActive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-indigo-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">
              {isAIConnected ? 'Learning Tutor Ready!' : 'Ready to Learn!'}
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              I'm here to help you understand concepts, clarify objectives, and guide you through this learning package.
            </p>
            <Button 
              onClick={startConversation} 
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!effectiveStudentId}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {isAIConnected ? 'Start Learning Session' : 'Connect & Start'}
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            {/* Status indicator */}
            <div className="text-center">
              <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                state.audio.isListening ? 'bg-red-100 text-red-800 border border-red-200' :
                state.conversation.isResponding ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                !isAIConnected ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                'bg-green-100 text-green-800 border border-green-200'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  state.audio.isListening ? 'bg-red-500 animate-pulse' :
                  state.conversation.isResponding ? 'bg-indigo-500 animate-bounce' :
                  !isAIConnected ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}></div>
                {state.audio.isListening ? 'Listening...' :
                 state.conversation.isResponding ? 'Tutor responding...' :
                 !isAIConnected ? 'Connecting...' :
                 'Ready to help'}
              </div>
            </div>

            {/* Package Learning Action Buttons */}
            {isAIConnected && (
              <div className="mb-4">
                <div className="text-xs text-gray-600 mb-3 text-center font-medium">Quick Learning Help:</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => sendPackageAction('explain-concept')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    disabled={state.conversation.isResponding}
                  >
                    <Lightbulb className="h-3 w-3" />
                    <span>Explain Concepts</span>
                  </Button>
                  <Button
                    onClick={() => sendPackageAction('clarify-objective')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                    disabled={state.conversation.isResponding}
                  >
                    <Target className="h-3 w-3" />
                    <span>Learning Goals</span>
                  </Button>
                  <Button
                    onClick={() => sendPackageAction('ask-about-visual')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                    disabled={state.conversation.isResponding}
                  >
                    <Eye className="h-3 w-3" />
                    <span>About Visuals</span>
                  </Button>
                  <Button
                    onClick={() => sendPackageAction('help-with-practice')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-green-600 border-green-200 hover:bg-green-50"
                    disabled={state.conversation.isResponding}
                  >
                    <BookOpen className="h-3 w-3" />
                    <span>Practice Help</span>
                  </Button>
                  <Button
                    onClick={() => sendPackageAction('summarize-content')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                    disabled={state.conversation.isResponding}
                  >
                    <MessageCircle className="h-3 w-3" />
                    <span>Summarize</span>
                  </Button>
                  <Button
                    onClick={() => sendPackageAction('real-world-application')}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 text-teal-600 border-teal-200 hover:bg-teal-50"
                    disabled={state.conversation.isResponding}
                  >
                    <HelpCircle className="h-3 w-3" />
                    <span>Real World</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1">
              {state.conversation.messages.length === 0 && !state.conversation.isResponding && (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-4">Ask me anything about this learning package!</p>
                  <div className="space-y-2">
                    {getSuggestedQuestions().slice(0, 3).map((question) => (
                      <Button
                        key={question}
                        variant="outline"
                        size="sm"
                        onClick={() => sendPackageAction('text', { content: question })}
                        disabled={!isAIConnected}
                        className="w-full text-xs"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {state.conversation.messages.slice(-4).map((msg, index) => (
                  <Card key={index} className={`${
                    msg.role === 'user' 
                      ? 'bg-indigo-50 border-indigo-200' 
                      : msg.role === 'system'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-purple-50 border-purple-200'
                  }`}>
                    <CardContent className="p-3">
                      <div className="flex items-start space-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user' 
                            ? 'bg-indigo-500' 
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
                            {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Learning Tutor'}
                          </div>
                          <div className="text-sm text-gray-900 whitespace-pre-wrap">{msg.content}</div>
                          {msg.action && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {msg.action.replace('-', ' ')}
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
                          <span className="text-xs text-gray-600">Learning tutor is responding...</span>
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
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl hover:scale-105'
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
                   state.conversation.isResponding ? 'Learning tutor is responding...' :
                   !isAIConnected ? 'Connecting...' :
                   'Tap to speak or use quick help buttons above'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Learning Objectives Panel */}
      {state.ui.packageContext?.learningObjectives && state.conversation.isActive && (
        <div className="p-4 border-t bg-indigo-50">
          <h4 className="font-medium text-sm mb-3 text-indigo-900">Learning Objectives</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {state.ui.packageContext.learningObjectives.map((objective, index) => (
              <div key={index} className="flex items-start space-x-2">
                {state.ui.completedObjectives.includes(index) ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                )}
                <p className={`text-xs ${
                  state.ui.completedObjectives.includes(index) 
                    ? 'text-green-700 font-medium' 
                    : 'text-gray-600'
                }`}>
                  {objective}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

PackageLearningAICoach.displayName = 'PackageLearningAICoach';

export default PackageLearningAICoach;