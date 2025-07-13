'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Brain, Target, TrendingUp, Clock, Star, Mic, MicOff, Send, X, RefreshCw, Volume2, VolumeX, Sun, BookOpen, Trophy, Zap } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '@/contexts/AuthContext';

interface AIRecommendation {
  package_id: string;
  learning_path: string;
  confidence: number;
  engagement_prediction: string;
  presentation_style: string;
  reasons: string[];
  llm_reasoning: string;
}

interface LearningInsights {
  focus_areas: string[];
  skill_opportunities: string[];
  challenge_level: string;
  engagement_time: string;
  momentum: any;
}

interface Message {
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
}

const DailyBriefingPage: React.FC = () => {
  const { user, userProfile, loading, getAuthToken } = useAuth();
  const router = useRouter();

  // State management
  const [pageState, setPageState] = useState<'welcome' | 'briefing' | 'complete'>('welcome');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Briefing state
  const [briefingStage, setBriefingStage] = useState<'connecting' | 'loading' | 'recommendations' | 'conversation' | 'complete'>('connecting');
  const [statusMessage, setStatusMessage] = useState('Preparing your daily briefing...');
  
  // AI Recommendations
  const [primaryRecommendation, setPrimaryRecommendation] = useState<AIRecommendation | null>(null);
  const [alternatives, setAlternatives] = useState<AIRecommendation[]>([]);
  const [learningInsights, setLearningInsights] = useState<LearningInsights | null>(null);
  
  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Refs
  const socketRef = React.useRef<WebSocket | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Get current time greeting
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Get user's first name
  const getFirstName = () => {
    if (userProfile?.displayName) {
      return userProfile.displayName.split(' ')[0];
    }
    if (user?.displayName) {
      return user.displayName.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Student';
  };

  // Start briefing
  const startBriefing = () => {
    setPageState('briefing');
    connectWebSocket();
  };

  // WebSocket connection
  const connectWebSocket = async () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    setBriefingStage('connecting');
    setStatusMessage('Connecting to AI briefing service...');

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Use your environment variable or fallback
      const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        const wsUrl = userProfile?.student_id 
        ? `${baseWsUrl}/api/enhanced-daily-briefing?student_id=${userProfile.student_id}`
        : `${baseWsUrl}/api/enhanced-daily-briefing`;
      
      console.log('Connecting to WebSocket URL:', wsUrl);
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = async () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setBriefingStage('loading');
        
        // Send authentication
        if (socketRef.current) {
          socketRef.current.send(JSON.stringify({
            type: 'authenticate',
            token: token
          }));
        }
      };

      socketRef.current.onmessage = handleWebSocketMessage;

      socketRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setIsConnecting(false);
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Failed to connect to briefing service');
        setIsConnecting(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError('Connection failed');
      setIsConnecting(false);
    }
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received message:', data.type);

      switch (data.type) {
        case 'auth_success':
          setStatusMessage(data.message);
          break;

        case 'status_update':
          setStatusMessage(data.message);
          break;

        case 'ai_recommendations_ready':
          setPrimaryRecommendation(data.primary_recommendation);
          setAlternatives(data.alternatives || []);
          setLearningInsights(data.learning_insights);
          setBriefingStage('recommendations');
          setStatusMessage('AI has analyzed your learning - here are your personalized recommendations!');
          break;

        case 'ai_enhanced_briefing_audio':
          if (!isMuted) {
            playAudioData(data.data, data.sampleRate);
          }
          setIsResponding(false);
          break;

        case 'ai_enhanced_briefing_text':
          setMessages(prev => [...prev, {
            type: 'ai',
            content: data.content,
            timestamp: new Date()
          }]);
          setIsResponding(false);
          setBriefingStage('conversation');
          break;

        case 'student_transcription':
          // Optional: show what the student said
          break;

        case 'ai_transcription':
          // Optional: show AI transcription
          break;

        case 'ai_briefing_timeout':
          setMessages(prev => [...prev, {
            type: 'system',
            content: data.content,
            timestamp: new Date()
          }]);
          setIsResponding(false);
          break;

        case 'ai_briefing_error':
          setConnectionError(data.content);
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  // Play audio data
  const playAudioData = async (base64Data: string, sampleRate: number = 24000) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate });
      }

      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }

      const int16View = new Int16Array(arrayBuffer);
      const floatData = new Float32Array(int16View.length);
      for (let i = 0; i < int16View.length; i++) {
        floatData[i] = int16View[i] / 32768.0;
      }

      const audioBuffer = audioContextRef.current.createBuffer(1, floatData.length, sampleRate);
      audioBuffer.copyToChannel(floatData, 0);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();

    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  // Send text message
  const sendTextMessage = () => {
    if (!socketRef.current || !inputText.trim()) return;

    const message = {
      type: 'text',
      content: inputText.trim()
    };

    socketRef.current.send(JSON.stringify(message));
    
    setMessages(prev => [...prev, {
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date()
    }]);
    
    setInputText('');
    setIsResponding(true);
  };

  // Audio recording
  const toggleMicrophone = async () => {
    if (isListening) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      mediaRecorderRef.current = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstart = () => {
        setIsListening(true);
        setIsResponding(true);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsListening(false);
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        if (socketRef.current) {
          socketRef.current.send(JSON.stringify({
            type: 'audio',
            data: base64Audio,
            mime_type: 'audio/webm'
          }));
        }
      };

      mediaRecorderRef.current.start(100);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // End briefing
  const endBriefing = () => {
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: 'end_briefing' }));
      socketRef.current.close();
    }
    setPageState('complete');
  };

  // Auto-scroll messages
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to access your daily briefing.</p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Welcome Stage */}
      {pageState === 'welcome' && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-sm border-b shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Learning Dashboard</h1>
                    <p className="text-sm text-gray-600">Daily AI-Powered Briefing</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{getFirstName()}</p>
                    <p className="text-xs text-gray-500">{userProfile?.grade_level || 'Student'}</p>
                  </div>
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {getFirstName().charAt(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
              <div className="text-center mb-12">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sun className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  {getTimeGreeting()}, {getFirstName()}!
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                  Ready to start your personalized learning journey for today?
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="bg-white/60 backdrop-blur-sm border-orange-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Zap className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{userProfile?.current_streak || 0}</p>
                        <p className="text-sm text-gray-600">Day Streak</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/60 backdrop-blur-sm border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{(userProfile?.total_points || 0).toLocaleString()}</p>
                        <p className="text-sm text-gray-600">Total Points</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/60 backdrop-blur-sm border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">Level {userProfile?.level || 1}</p>
                        <p className="text-sm text-gray-600">Current Level</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Start Briefing Button */}
              <div className="text-center">
                <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 inline-block">
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      <Brain className="h-12 w-12 mx-auto" />
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Get Your AI-Powered Daily Briefing</h3>
                        <p className="text-blue-100 mb-6">
                          Let our AI analyze your learning patterns and recommend the perfect activities for today.
                        </p>
                      </div>
                      <Button 
                        onClick={startBriefing}
                        variant="secondary"
                        size="lg"
                        className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg font-medium"
                      >
                        Start My Daily Briefing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Briefing Stage */}
      {pageState === 'briefing' && (
        <div className="h-screen flex flex-col">
          {/* Header */}
          <div className="bg-white border-b shadow-sm p-4">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Daily Learning Briefing</h1>
                  <p className="text-sm text-gray-600">AI-powered personalized recommendations</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className="h-8 w-8"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setPageState('welcome')} 
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Briefing Content */}
          <div className="flex-1 overflow-hidden">
            {/* Loading Stage */}
            {(briefingStage === 'connecting' || briefingStage === 'loading') && (
              <div className="flex items-center justify-center h-full">
                <Card className="w-full max-w-md mx-4">
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                        <Brain className="h-8 w-8 text-blue-600 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Preparing Your Day</h3>
                        <p className="text-gray-600 text-sm">{statusMessage}</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: briefingStage === 'connecting' ? '33%' : '66%' }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recommendations Stage */}
            {briefingStage === 'recommendations' && primaryRecommendation && (
              <div className="p-4 space-y-4 h-full overflow-y-auto max-w-4xl mx-auto">
                {/* Primary Recommendation */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Star className="h-5 w-5 text-yellow-500" />
                        <span>AI's Top Pick for You</span>
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getConfidenceColor(primaryRecommendation.confidence)}`}></div>
                        <span className="text-sm font-medium">{Math.round(primaryRecommendation.confidence * 100)}% match</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg">{primaryRecommendation.learning_path}</h3>
                      <Badge variant="secondary" className="mt-1">
                        {primaryRecommendation.engagement_prediction}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Why this is perfect for you:</h4>
                      <ul className="space-y-1">
                        {primaryRecommendation.reasons.map((reason, index) => (
                          <li key={index} className="text-sm flex items-start space-x-2">
                            <Target className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {primaryRecommendation.llm_reasoning && (
                      <div className="bg-white p-3 rounded-lg">
                        <h4 className="font-medium text-sm mb-1">AI Analysis:</h4>
                        <p className="text-sm text-gray-700">{primaryRecommendation.llm_reasoning}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Learning Insights */}
                {learningInsights && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <span>Your Learning Insights</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Focus Areas</h4>
                        <div className="flex flex-wrap gap-1">
                          {learningInsights.focus_areas.map((area, index) => (
                            <Badge key={index} variant="outline">{area}</Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm mb-2">Growth Opportunities</h4>
                        <div className="flex flex-wrap gap-1">
                          {learningInsights.skill_opportunities.map((skill, index) => (
                            <Badge key={index} variant="secondary">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{learningInsights.engagement_time}</span>
                        </div>
                        <Badge>{learningInsights.challenge_level}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alternatives */}
                {alternatives.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Alternative Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {alternatives.map((alt, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{alt.learning_path}</h4>
                            <span className="text-sm text-gray-500">{Math.round(alt.confidence * 100)}% match</span>
                          </div>
                          {alt.reasons.length > 0 && (
                            <p className="text-sm text-gray-600">{alt.reasons[0]}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Start Conversation Button */}
                <div className="flex justify-center pb-8">
                  <Button 
                    onClick={() => setBriefingStage('conversation')}
                    className="px-8 py-3 text-lg"
                    size="lg"
                  >
                    Start AI Conversation
                  </Button>
                </div>
              </div>
            )}

            {/* Conversation Stage */}
            {briefingStage === 'conversation' && (
              <div className="flex flex-col h-full max-w-4xl mx-auto">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg, index) => (
                      <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <Card className={`max-w-[80%] ${
                          msg.type === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : msg.type === 'system'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-white'
                        }`}>
                          <CardContent className="p-3">
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                            <div className={`text-xs mt-1 ${msg.type === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                              {formatTime(msg.timestamp)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}

                    {isResponding && (
                      <div className="flex justify-start">
                        <Card className="bg-white">
                          <CardContent className="p-3">
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <span className="ml-2 text-sm">AI is thinking...</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t bg-white p-4">
                  <div className="flex items-end space-x-2">
                    <Button
                      onClick={toggleMicrophone}
                      disabled={!isConnected}
                      variant={isListening ? "destructive" : "outline"}
                      size="icon"
                      className="h-10 w-10"
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>

                    <div className="flex-1">
                      <Textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder={isConnected ? "Ask about your recommendations..." : "Connecting..."}
                        className="min-h-[60px] resize-none"
                        disabled={!isConnected || isResponding}
                      />
                    </div>

                    <Button
                      onClick={sendTextMessage}
                      disabled={!isConnected || !inputText.trim() || isResponding}
                      size="icon"
                      className="h-10 w-10"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center space-x-2">
                      {isListening && (
                        <Badge variant="destructive" className="animate-pulse">
                          Recording
                        </Badge>
                      )}
                    </div>
                    
                    <Button
                      onClick={endBriefing}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500"
                    >
                      End Briefing
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Complete Stage */}
      {pageState === 'complete' && (
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ready to Start Learning!</h3>
              <p className="text-gray-600 text-sm mb-4">
                Your personalized daily briefing is complete. Time to dive into your recommended activities!
              </p>
              <Button onClick={() => router.push('/dashboard')} className="w-full mb-2">
                Start Learning
              </Button>
              <Button onClick={() => setPageState('welcome')} variant="outline" className="w-full">
                Back to Briefing
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Messages */}
      {connectionError && (
        <Alert className="fixed bottom-4 right-4 max-w-md">
          <AlertDescription className="flex items-center justify-between">
            <span>{connectionError}</span>
            <Button
              onClick={connectWebSocket}
              variant="outline"
              size="sm"
              disabled={isConnecting}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default DailyBriefingPage;