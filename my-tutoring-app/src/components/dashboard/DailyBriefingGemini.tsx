'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Mic, MicOff, RefreshCw, X, Calendar, Target, Zap, Sparkles, Bot, User, Volume2, VolumeX } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// Import your existing AudioCaptureService and AuthContext
import AudioCaptureService from '@/lib/AudioCaptureService';
import { useAuth } from '@/contexts/AuthContext';

// Types based on your backend models
interface Activity {
  title: string;
  description: string;
  estimated_time: string;
  points: number;
  priority: string;
  activity_type: string;
  metadata: {
    subject?: string;
    from_recommendations?: boolean;
    skill_level?: string;
  };
}

interface DailyProgress {
  current_streak: number;
  daily_goal: number;
  points_earned_today: number;
}

interface DailyPlan {
  date: string;
  activities: Activity[];
  total_points: number;
  personalization_source: string;
  progress: DailyProgress;
}

interface DailyBriefingGeminiProps {
  studentId?: number; // Made optional since we can get it from userProfile
  apiBaseUrl?: string;
  wsBaseUrl?: string;
  expanded?: boolean;
  onClose?: () => void;
  className?: string;
}

type MessageRole = 'user' | 'gemini' | 'system';

interface Message {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

const DailyBriefingGemini: React.FC<DailyBriefingGeminiProps> = ({
  studentId,
  apiBaseUrl = 'http://localhost:8000/api',
  wsBaseUrl = 'ws://localhost:8000/api',
  expanded = true,
  onClose,
  className = '',
}) => {
  // Get auth context
  const { getAuthToken, userProfile } = useAuth();
  
  // Use studentId from props or fall back to userProfile
  const effectiveStudentId = studentId || userProfile?.student_id;
  // State management
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  // Daily plan state
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  
  // New state for conversation mode
  const [conversationStarted, setConversationStarted] = useState(false);
  const [showAdvancedMode, setShowAdvancedMode] = useState(false);

  // Refs - using same methodology as your existing component
  const socketRef = useRef<WebSocket | null>(null);
  const audioCaptureServiceRef = useRef<AudioCaptureService | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio constants - same as your existing component
  const PLAYBACK_SAMPLE_RATE = 24000;
  const MIN_BUFFER_LENGTH = 1000;
  const MAX_BUFFER_QUEUE = 10;
  const BUFFER_GAP = 0.02;

  // Add these refs from your existing component
  const bufferConsolidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScheduledTimeRef = useRef<number>(0);

  // Fetch daily plan data first
  const fetchDailyPlan = async () => {
    if (!effectiveStudentId) {
      setPlanError('No student ID available');
      setIsLoadingPlan(false);
      return;
    }

    setIsLoadingPlan(true);
    setPlanError(null);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`${apiBaseUrl}/daily-activities/daily-plan/${effectiveStudentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch daily plan: ${response.statusText}`);
      }
      
      const planData: DailyPlan = await response.json();
      setDailyPlan(planData);
      console.log('Daily plan loaded:', planData);
    } catch (error) {
      console.error('Error fetching daily plan:', error);
      setPlanError(error instanceof Error ? error.message : 'Failed to load daily plan');
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // Connect to WebSocket - modified to use daily briefing endpoint
  const connectWebSocket = async () => {
    if (!effectiveStudentId) {
      setConnectionError('No student ID available for connection');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Use daily briefing endpoint instead of bidirectional
      const wsUrl = `${wsBaseUrl}/daily-briefing?student_id=${effectiveStudentId}`;
      console.log(`Attempting to connect to Daily Briefing WebSocket at ${wsUrl}`);
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = async () => {
        console.log('Daily Briefing WebSocket connection established');
        setIsConnected(true);
        setIsConnecting(false);
        
        // Initialize the audio capture service when websocket is connected
        if (!audioCaptureServiceRef.current) {
          audioCaptureServiceRef.current = new AudioCaptureService();
          audioCaptureServiceRef.current.setCallbacks({
            onStateChange: (state) => {
              setIsListening(state.isCapturing);
            },
            onError: (error) => {
              console.error('Audio capture error:', error);
            }
          });
        }
        
        // Set the WebSocket for the audio capture service
        if (audioCaptureServiceRef.current && socketRef.current) {
          audioCaptureServiceRef.current.setWebSocket(socketRef.current);
        }
        
        // Send authentication first
        try {
          const token = await getAuthToken();
          if (!token) {
            throw new Error('No authentication token available');
          }
          
          socketRef.current.send(JSON.stringify({
            type: 'authenticate',
            token: token
          }));
        } catch (error) {
          console.error('Error getting auth token for WebSocket:', error);
          setConnectionError('Authentication failed');
        }
      };

      socketRef.current.onclose = (event) => {
        console.log(`Daily Briefing WebSocket connection closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        setIsResponding(false);
      };

      socketRef.current.onerror = (error) => {
        console.error('Daily Briefing WebSocket error:', error);
        setConnectionError('Failed to connect to Daily Briefing service. Please try again.');
        setIsConnecting(false);
      };

      socketRef.current.onmessage = handleWebSocketMessage;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  // Handle messages from the daily briefing WebSocket
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received message from Daily Briefing server:', data.type);
      
      // Always reset the response timeout to prevent it from firing
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
      
      // Handle different message types from daily briefing endpoint
      switch (data.type) {
        case 'auth_success':
          console.log('Authentication successful, student ID:', data.student_id);
          setMessages(prev => [...prev, { 
            role: 'system', 
            content: `[Connected to Daily Briefing AI Coach for Student ${data.student_id}]`, 
            timestamp: new Date() 
          }]);
          break;

        case 'status':
          console.log('Status update:', data.message);
          setMessages(prev => [...prev, { 
            role: 'system', 
            content: `[${data.message}]`, 
            timestamp: new Date() 
          }]);
          break;

        case 'plan_ready':
          console.log('Daily plan ready:', data);
          // Update the daily plan with fresh data from the briefing service
          if (data.activities && data.total_points) {
            setDailyPlan(prev => prev ? {
              ...prev,
              activities: data.activities,
              total_points: data.total_points,
              personalization_source: data.personalization_source
            } : null);
          }
          setMessages(prev => [...prev, { 
            role: 'system', 
            content: `[Daily plan ready: ${data.total_activities} activities, ${data.total_points} points, ${data.personalization_source}]`, 
            timestamp: new Date() 
          }]);
          break;

        case 'ai_text':
          console.log('Received AI text:', data.content.substring(0, 50));
          setMessages(prev => [...prev, { role: 'gemini', content: data.content, timestamp: new Date() }]);
          setIsResponding(false);
          break;

        case 'ai_audio':
          console.log('Received AI audio data of length:', data.data.length);
          processAndPlayRawAudio(
            data.data, 
            data.sampleRate || PLAYBACK_SAMPLE_RATE
          );
          setIsResponding(false);
          break;

        case 'user_transcription':
          // Handle user speech transcription if provided
          if (data.content) {
            setMessages(prev => [...prev, { role: 'user', content: data.content, timestamp: new Date() }]);
          }
          break;

        case 'error':
          console.error('Error from Daily Briefing server:', data.error || data.message);
          setIsResponding(false);
          setConnectionError(data.error || data.message);
          break;

        default:
          console.log('Unknown message type from Daily Briefing:', data.type);
      }
    } catch (error) {
      console.error('Error parsing Daily Briefing WebSocket message:', error);
      setIsResponding(false);
    }
  };

  // Use the exact same audio processing methods from your existing component
  const processAndPlayRawAudio = (base64Data: string, sampleRate: number = PLAYBACK_SAMPLE_RATE): void => {
    if (isMuted) return; // Don't play audio if muted
    
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
    console.log('Consolidated audio buffers for smoother playback');
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

  // Send text message to Daily Briefing AI
  const sendTextMessage = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !inputText.trim()) {
      console.log('Cannot send message - websocket state:', socketRef.current?.readyState);
      return;
    }

    const message = {
      type: 'text',
      content: inputText.trim()
    };

    try {
      console.log('Sending text message to Daily Briefing:', message.content);
      socketRef.current.send(JSON.stringify(message));
      setMessages(prev => [...prev, { role: 'user', content: inputText.trim(), timestamp: new Date() }]);
      setInputText('');
      setIsResponding(true);
      
      responseTimeoutRef.current = setTimeout(() => {
        console.log('No response received within timeout period');
        setIsResponding(false);
      }, 10000);
    } catch (error) {
      console.error('Error sending text message:', error);
      setIsResponding(false);
    }
  };

  // Use the exact same audio methods from your existing component
  const toggleMicrophone = async () => {
    if (isListening) {
      stopAudioRecording();
    } else {
      await startAudioRecording();
    }
  };

  const startAudioRecording = async () => {
    console.log('Starting audio recording...');
    
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot start audio recording: WebSocket is not connected');
      return;
    }
    
    try {
      if (audioCaptureServiceRef.current) {
        await audioCaptureServiceRef.current.startCapture();
        setIsResponding(true);
      }
    } catch (error) {
      console.error('Error starting audio recording:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access to use this feature.');
      } else {
        alert(`Failed to start audio recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const stopAudioRecording = () => {
    console.log('Stopping audio recording...');
    
    if (audioCaptureServiceRef.current) {
      audioCaptureServiceRef.current.stopCapture();
    }
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending end of turn signal');
      try {
        socketRef.current.send(JSON.stringify({ 
          type: 'text', 
          content: '', 
          end_of_turn: true 
        }));
        
        responseTimeoutRef.current = setTimeout(() => {
          console.log('No response received after audio recording');
          setIsResponding(false);
        }, 10000);
      } catch (error) {
        console.error('Error sending end of turn signal:', error);
        setIsResponding(false);
      }
    }
    
    console.log('Audio recording stopped');
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!dailyPlan) return 0;
    return Math.min(100, (dailyPlan.progress.points_earned_today / dailyPlan.progress.daily_goal) * 100);
  };

  // Handle key presses for sending messages
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  // Toggle expanded/collapsed state
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    if (newState && !isConnected && !isConnecting) {
      connectWebSocket();
    }
  };

  // Format timestamp for message
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Start conversation function
  const startConversation = () => {
    setConversationStarted(true);
    // Auto-connect if not connected
    if (!isConnected && !isConnecting) {
      connectWebSocket();
    }
  };

  // Get current conversation state
  const getConversationState = () => {
    if (isListening) return 'listening';
    if (isResponding) return 'speaking';
    if (!isConnected) return 'disconnected';
    return 'waiting';
  };

  // Scroll to bottom of messages
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Initialize on mount
  useEffect(() => {
    if (isExpanded && effectiveStudentId) {
      console.log('Daily Briefing component mounted and expanded for student:', effectiveStudentId);
      fetchDailyPlan();
      if (conversationStarted) {
        connectWebSocket();
      }
    } else if (isExpanded && !effectiveStudentId) {
      console.warn('Component expanded but no student ID available');
      setPlanError('No student ID available. Please ensure you are logged in.');
    }
    
    return () => {
      console.log('Daily Briefing component unmounting, cleaning up resources...');
      
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (audioCaptureServiceRef.current) {
        audioCaptureServiceRef.current.destroy();
      }
      
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close().catch(err => {
          console.error('Error closing playback audio context:', err);
        });
      }
    };
  }, [isExpanded, effectiveStudentId, conversationStarted]);

  // If minimized, show only a button to expand
  if (!isExpanded) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button 
          onClick={toggleExpanded}
          className="rounded-full h-16 w-16 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
        >
          <div className="relative">
            <Calendar className="h-7 w-7" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          <span className="sr-only">Open Daily Briefing</span>
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col rounded-2xl border-0 shadow-2xl bg-white overflow-hidden ${className}`}>
      {/* Enhanced Header with Gradient */}
      <div className="flex flex-col bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
        
        <div className="flex items-center justify-between p-4 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Bot className="h-6 w-6" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                isConnected ? 'bg-green-400' : isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
              }`}></div>
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">AI Learning Coach</h3>
              <p className="text-white/80 text-sm">
                {!conversationStarted ? 'Ready to start your briefing' :
                 isListening ? 'Listening to you...' :
                 isResponding ? 'AI Coach is speaking...' :
                 !isConnected ? 'Connecting...' :
                 'Your turn to speak'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {conversationStarted && (
              <>
                {/* Status indicator */}
                {(isListening || isResponding) && (
                  <Badge className={`${
                    isListening ? 'bg-red-500/20 text-red-100 border-red-300/30' : 'bg-blue-500/20 text-blue-100 border-blue-300/30'
                  } animate-pulse`}>
                    <div className={`w-2 h-2 ${
                      isListening ? 'bg-red-300' : 'bg-blue-300'
                    } rounded-full mr-2 animate-ping`}></div>
                    {isListening ? 'Listening' : 'Speaking'}
                  </Badge>
                )}
                
                {/* Mute button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-white hover:bg-white/20 rounded-xl transition-colors"
                        onClick={() => setIsMuted(!isMuted)}
                      >
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Advanced mode toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-white hover:bg-white/20 rounded-xl transition-colors"
                        onClick={() => setShowAdvancedMode(!showAdvancedMode)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 3h6l6 18h6"></path>
                          <path d="M14 9h8"></path>
                          <path d="M8 15h8"></path>
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Advanced Chat Mode</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-white hover:bg-white/20 rounded-xl transition-colors"
                    onClick={toggleExpanded}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"></path>
                      <path d="M3 9h18"></path>
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Minimize</TooltipContent>
              </Tooltip>

              {onClose && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-white hover:bg-white/20 rounded-xl transition-colors"
                      onClick={onClose}
                    >
                      <X size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>

        {/* Enhanced Daily Plan Summary */}
        {dailyPlan && effectiveStudentId && (
          <div className="px-4 pb-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{dailyPlan.total_points}</div>
                  <div className="text-xs text-white/70 font-medium">Points Available</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-300">{dailyPlan.progress.points_earned_today}</div>
                  <div className="text-xs text-white/70 font-medium">Points Earned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-300">{dailyPlan.progress.current_streak}</div>
                  <div className="text-xs text-white/70 font-medium">Day Streak</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-white/90">
                  <span className="font-medium">Daily Progress</span>
                  <span>{dailyPlan.progress.points_earned_today}/{dailyPlan.progress.daily_goal}</span>
                </div>
                <div className="bg-white/20 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${getProgressPercentage()}%` }}
                  ></div>
                </div>
              </div>
              
              {dailyPlan.personalization_source === 'bigquery_recommendations' && (
                <div className="mt-3 flex items-center justify-center space-x-2 text-yellow-200">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-medium">AI-Personalized Learning Plan</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Show loading or error state when no effective student ID */}
        {!effectiveStudentId && (
          <div className="px-4 pb-4 relative z-10">
            <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-3 border border-yellow-300/30">
              <div className="text-center text-yellow-100">
                <span className="font-medium text-sm">Waiting for user profile...</span>
                <br />
                <span className="text-xs">{userProfile ? 'User profile loaded but no student ID found' : 'Loading user authentication...'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {(connectionError || planError) && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">
          <div className="flex">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p>{connectionError || planError}</p>
          </div>
        </div>
      )}

      {/* Main Interface */}
      <div className="flex-1 bg-gradient-to-b from-gray-50 to-white">
        {!conversationStarted ? (
          /* Welcome Screen - Voice First */
          <div className="flex flex-col items-center justify-center h-80 text-center space-y-6 p-6">
            <div className="w-24 h-24 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
              <Bot className="h-12 w-12 text-purple-600" />
            </div>
            <div>
              <h4 className="text-2xl font-bold text-gray-900 mb-3">Ready for your daily briefing?</h4>
              <p className="text-gray-600 max-w-md leading-relaxed mb-6">
                I'll speak with you about your personalized learning plan, answer your questions, and help you get the most out of today's activities.
              </p>
            </div>
            
            <Button 
              onClick={startConversation}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              disabled={!effectiveStudentId}
            >
              <Mic className="h-6 w-6 mr-3" />
              Start Voice Briefing
            </Button>
            
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                <Volume2 className="h-3 w-3 mr-1" />
                Voice conversation
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Sparkles className="h-3 w-3 mr-1" />
                AI-personalized
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <Target className="h-3 w-3 mr-1" />
                Learning focused
              </Badge>
            </div>
          </div>
        ) : showAdvancedMode ? (
          /* Advanced Chat Mode */
          <>
            {/* Message Area */}
            <ScrollArea className="h-64 p-4">
              {messages.length === 0 && !isResponding && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1">Talk to your AI Learning Coach</p>
                  <p className="text-sm max-w-md">
                    Get personalized guidance about your daily learning plan, ask about specific activities, or discuss your learning goals.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start space-x-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                          : msg.role === 'system'
                            ? 'bg-gray-400'
                            : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      }`}>
                        {msg.role === 'user' ? (
                          <User className="h-4 w-4 text-white" />
                        ) : msg.role === 'system' ? (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        ) : (
                          <Bot className="h-4 w-4 text-white" />
                        )}
                      </div>
                      
                      {/* Message Bubble */}
                      <Card className={`${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0' 
                          : msg.role === 'system'
                            ? 'bg-gray-100 text-gray-600 border'
                            : 'bg-white text-gray-900 border shadow-md'
                      } ${msg.role !== 'system' ? 'shadow-lg' : ''}`}>
                        <CardContent className="p-3">
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                          <div className={`text-xs mt-2 ${
                            msg.role === 'user' ? 'text-white/70' : 'text-gray-500'
                          }`}>
                            {formatTime(msg.timestamp)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}

                {isResponding && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-3 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <Card className="bg-white border shadow-md">
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="text-sm text-gray-600 font-medium">AI Coach is thinking...</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-scroll"
                    checked={autoScroll}
                    onCheckedChange={setAutoScroll}
                    className="data-[state=checked]:bg-purple-600"
                  />
                  <Label htmlFor="auto-scroll" className="text-xs cursor-pointer font-medium">Auto-scroll</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  {!isConnected && !isConnecting && (
                    <Button 
                      onClick={connectWebSocket} 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                      disabled={isConnecting}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reconnect
                    </Button>
                  )}
                  
                  {isLoadingPlan && (
                    <Button 
                      onClick={fetchDailyPlan} 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                      disabled={isLoadingPlan}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh Plan
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex items-end space-x-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={toggleMicrophone}
                        disabled={!isConnected}
                        variant={isListening ? "destructive" : "outline"}
                        size="icon"
                        className={`h-12 w-12 rounded-xl transition-all duration-300 ${
                          isListening 
                            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 scale-110' 
                            : 'border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300'
                        }`}
                      >
                        {isListening ? (
                          <MicOff className="h-5 w-5 animate-pulse" />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{isListening ? 'Stop recording' : 'Start voice chat'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <div className="flex-1 relative">
                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={isConnected ? "Ask me about your learning plan, goals, or any questions..." : "Connect to start chatting..."}
                    className="min-h-[60px] resize-none pr-12 border-purple-200 focus:border-purple-400 focus:ring-purple-400 rounded-xl"
                    disabled={!isConnected || isResponding}
                  />
                  <Button
                    onClick={sendTextMessage}
                    disabled={!isConnected || !inputText.trim() || isResponding}
                    size="icon"
                    className="absolute right-2 bottom-2 h-8 w-8 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg shadow-md transition-all duration-200"
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Voice-First Conversation Interface */
          <div className="flex flex-col h-80 p-6 space-y-6">
            {/* Conversation Status */}
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-3 rounded-full text-sm font-medium transition-all duration-300 ${
                isListening ? 'bg-red-100 text-red-800 border border-red-200' :
                isResponding ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                !isConnected ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                'bg-green-100 text-green-800 border border-green-200'
              }`}>
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  isListening ? 'bg-red-500 animate-pulse' :
                  isResponding ? 'bg-blue-500 animate-bounce' :
                  !isConnected ? 'bg-yellow-500 animate-spin' :
                  'bg-green-500'
                }`}></div>
                {isListening ? 'Listening to you...' :
                 isResponding ? 'AI Coach is speaking...' :
                 !isConnected ? 'Connecting to your coach...' :
                 'Ready for your voice'}
              </div>
            </div>

            {/* Last few messages in conversation view */}
            <div className="flex-1 space-y-4 overflow-hidden">
              {messages.slice(-2).map((msg, index) => (
                <Card key={index} className={`${
                  msg.role === 'user' 
                    ? 'bg-purple-50 border-purple-200 ml-8' 
                    : msg.role === 'system'
                      ? 'bg-gray-50 border-gray-200 text-sm'
                      : 'bg-blue-50 border-blue-200 mr-8'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                          : msg.role === 'system'
                            ? 'bg-gray-400'
                            : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      }`}>
                        {msg.role === 'user' ? (
                          <User className="h-4 w-4 text-white" />
                        ) : msg.role === 'system' ? (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        ) : (
                          <Bot className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-700">
                            {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'AI Coach'}
                          </span>
                          {msg.role === 'gemini' && isResponding && (
                            <div className="flex items-center space-x-1">
                              <Volume2 className="h-4 w-4 text-blue-600" />
                              <div className="flex space-x-1">
                                <div className="w-1 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-gray-900 leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {isResponding && messages.length === 0 && (
                <Card className="bg-blue-50 border-blue-200 mr-8">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-gray-600 font-medium">AI Coach is preparing your briefing...</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Large Microphone Control */}
            <div className="flex flex-col items-center space-y-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleMicrophone}
                      disabled={!isConnected || isResponding}
                      className={`w-20 h-20 rounded-full transition-all duration-300 ${
                        isListening 
                          ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 scale-110 animate-pulse' 
                          : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-xl hover:shadow-2xl hover:scale-105'
                      }`}
                    >
                      {isListening ? (
                        <MicOff className="h-8 w-8 text-white" />
                      ) : (
                        <Mic className="h-8 w-8 text-white" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isListening ? 'Tap to stop speaking' :
                       isResponding ? 'AI is responding...' :
                       !isConnected ? 'Connecting...' :
                       'Tap to start speaking'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  {isListening ? 'Tap when you\'re finished speaking' :
                   isResponding ? 'AI Coach is responding to you...' :
                   !isConnected ? 'Connecting to your AI coach...' :
                   'Tap to ask a question or continue'}
                </p>
                {!isConnected && !isConnecting && (
                  <Button
                    onClick={connectWebSocket}
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reconnect
                  </Button>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowAdvancedMode(true)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800"
                >
                  Switch to Chat Mode
                </Button>
                <Button
                  onClick={() => setConversationStarted(false)}
                  variant="outline"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800 border-gray-300 hover:border-gray-400"
                >
                  End Briefing
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyBriefingGemini;