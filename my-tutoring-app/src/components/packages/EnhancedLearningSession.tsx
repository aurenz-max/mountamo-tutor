import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  BookOpen, Eye, Headphones, FileText, CheckCircle, Circle, 
  Mic, MicOff, Volume2, VolumeX, Send, 
  ArrowLeft, PanelRightClose, PanelRightOpen
} from 'lucide-react';
import Link from 'next/link';

// Import your existing hooks and services
import { usePackageDetail } from '@/lib/packages/hooks';
import { authApi } from '@/lib/authApiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useAudioPlayback } from '@/lib/hooks/useAudioPlayback';
import AudioCaptureService from '@/lib/AudioCaptureService';

// Import the content components
import { ReadingContent } from './ReadingContent';
import { VisualContent } from './VisualContent';
import { VisualExplorerContent } from './VisualExplorerContent';
import { AudioContent } from './AudioContent';
import { PracticeContent } from './PracticeContent';
import { SessionGoalsModal } from './SessionGoalsModal';

interface Message {
  role: 'user' | 'gemini' | 'system';
  content: string;
  timestamp: Date;
}

interface EnhancedLearningSessionProps {
  packageId: string;
  studentId?: number;
}

export function EnhancedLearningSession({ packageId, studentId }: EnhancedLearningSessionProps) {
  // Auth context
  const { user, userProfile, loading: authLoading } = useAuth();
  
  // Package data from your API
  const { package: pkg, loading: packageLoading, error: packageError } = usePackageDetail(packageId);
  
  // UI State
  const [activeTab, setActiveTab] = useState('reading');
  const [resourcePanelOpen, setResourcePanelOpen] = useState(true);
  const [completedObjectives, setCompletedObjectives] = useState<number[]>([]);
  const [completedSections, setCompletedSections] = useState<Record<string, boolean>>({});
  
  // Chat/WebSocket State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  
  // Audio State
  const [isListening, setIsListening] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  // Session Goals Modal State
  const [isSessionStarted, setIsSessionStarted] = useState(
    () => sessionStorage.getItem(`session_started_${packageId}`) === 'true'
  );
  
  // Refs
  const socketRef = useRef<WebSocket | null>(null);
  const audioCaptureServiceRef = useRef<AudioCaptureService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio playback hook
  const { processAndPlayRawAudio, stopAudioPlayback } = useAudioPlayback({ sampleRate: 24000 });

  // WebSocket connection
  const connectWebSocket = async () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    
    // Wait for authentication to complete
    if (authLoading || !user) {
      console.log('⏳ Waiting for authentication before connecting WebSocket');
      return;
    }

    setIsConnecting(true);
    
    try {
      console.log('🔌 Creating authenticated WebSocket connection');
      socketRef.current = await authApi.createLearningSessionWebSocket(
        packageId, 
        studentId || userProfile?.student_id
      );

      socketRef.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        
        if (!audioCaptureServiceRef.current) {
          audioCaptureServiceRef.current = new AudioCaptureService();
          audioCaptureServiceRef.current.setCallbacks({
            onStateChange: (state) => setIsListening(state.isCapturing),
            onError: (error) => console.error('Audio capture error:', error)
          });
        }
        
        if (audioCaptureServiceRef.current && socketRef.current) {
          audioCaptureServiceRef.current.setWebSocket(socketRef.current);
        }
      };

      socketRef.current.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setIsResponding(false);
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
      };

      socketRef.current.onmessage = handleWebSocketMessage;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setIsConnecting(false);
    }
  };

  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
      
      if (data.type === 'text' && data.content) {
        setMessages(prev => [...prev, { 
          role: 'gemini', 
          content: data.content, 
          timestamp: new Date() 
        }]);
        setIsResponding(false);
        
        // Check for objective completion
        checkForObjectiveCompletion(data.content);
      }
      else if (data.type === 'audio' && data.data && audioEnabled) {
        processAndPlayRawAudio(data.data, data.sampleRate || 24000);
        setIsResponding(false);
      }
      else if (data.type === 'input_transcription' && data.content) {
        setMessages(prev => [...prev, { 
          role: 'user', 
          content: data.content, 
          timestamp: new Date() 
        }]);
      }
      else if (data.type === 'error') {
        console.error('Session error:', data.content);
        setIsResponding(false);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      setIsResponding(false);
    }
  };

  const checkForObjectiveCompletion = (content: string) => {
    if (!pkg) return;
    
    const completionKeywords = ['completed', 'mastered', 'understood', 'learned', 'achieved'];
    if (completionKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
      const uncompletedObjectives = pkg.master_context.learning_objectives
        .map((_, index) => index)
        .filter(index => !completedObjectives.includes(index));
      
      if (uncompletedObjectives.length > 0) {
        const randomIndex = uncompletedObjectives[Math.floor(Math.random() * uncompletedObjectives.length)];
        setCompletedObjectives(prev => [...prev, randomIndex]);
      }
    }
  };

  const sendTextMessage = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !inputText.trim()) {
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ type: 'text', content: inputText.trim() }));
      setMessages(prev => [...prev, { 
        role: 'user', 
        content: inputText.trim(), 
        timestamp: new Date() 
      }]);
      setInputText('');
      setIsResponding(true);
      
      responseTimeoutRef.current = setTimeout(() => setIsResponding(false), 10000);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsResponding(false);
    }
  };

  const sendInteractionMessage = (message: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setInputText(message);
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ type: 'text', content: message }));
      setMessages(prev => [...prev, { 
        role: 'user', 
        content: message, 
        timestamp: new Date() 
      }]);
      setIsResponding(true);
      
      responseTimeoutRef.current = setTimeout(() => setIsResponding(false), 10000);
    } catch (error) {
      console.error('Error sending interaction message:', error);
      setIsResponding(false);
    }
  };

  const toggleMicrophone = async () => {
    if (isListening) {
      if (audioCaptureServiceRef.current) {
        audioCaptureServiceRef.current.stopCapture();
      }
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify({ type: 'text', content: '', end_of_turn: true }));
          responseTimeoutRef.current = setTimeout(() => setIsResponding(false), 10000);
        } catch (error) {
          console.error('Error sending end of turn:', error);
          setIsResponding(false);
        }
      }
    } else {
      if (audioCaptureServiceRef.current) {
        await audioCaptureServiceRef.current.startCapture();
        setIsResponding(true);
      }
    }
  };

  const markComplete = (section: string) => {
    setCompletedSections(prev => ({
      ...prev,
      [section]: true
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleAudioToggle = () => {
    const newAudioEnabled = !audioEnabled;
    setAudioEnabled(newAudioEnabled);
    
    if (!newAudioEnabled) {
      stopAudioPlayback();
    }
  };

  const handleStartSession = () => {
    sessionStorage.setItem(`session_started_${packageId}`, 'true');
    setIsSessionStarted(true);
  };

  // Calculate total estimated time
  const totalEstimatedTime = React.useMemo(() => {
    if (!pkg) return 0;
    
    const readingTime = Math.ceil(pkg.content.reading.word_count / 200); // Assumes avg. 200 WPM
    const audioTime = Math.ceil((pkg.content.audio?.duration_seconds || 0) / 60);
    const practiceTime = pkg.content.practice?.estimated_time_minutes || 0;
    
    return readingTime + audioTime + practiceTime;
  }, [pkg]);

  // Connect when authentication is ready
  useEffect(() => {
    if (!authLoading && user) {
      console.log('✅ Auth ready, connecting WebSocket');
      connectWebSocket();
    }
    
    return () => {
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
      if (audioCaptureServiceRef.current) audioCaptureServiceRef.current.destroy();
      stopAudioPlayback();
    };
  }, [packageId, studentId, stopAudioPlayback, authLoading, user]);

  // Auto-scroll messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (packageLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading learning session...</p>
        </div>
      </div>
    );
  }

  if (packageError || !pkg) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">Unable to Start Session</h2>
            <p className="text-muted-foreground mb-4">
              {packageError || 'Package not found'}
            </p>
            <Link href={`/packages/${packageId}`}>
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Package
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show session goals modal if session hasn't started
  if (!isSessionStarted) {
    return (
      <SessionGoalsModal
        title={pkg.content.reading.title}
        learningObjectives={pkg.master_context.learning_objectives}
        estimatedTime={totalEstimatedTime}
        onStartSession={handleStartSession}
      />
    );
  }

  const progressPercentage = pkg.master_context.learning_objectives.length > 0 
    ? (completedObjectives.length / pkg.master_context.learning_objectives.length) * 100 
    : 0;

  // Define available tabs based on content
  const tabs = [
    { id: 'reading', label: 'Read', icon: BookOpen, color: 'blue' },
    ...(pkg.content.visuals && pkg.content.visuals.length > 0 
      ? [{ id: 'explore', label: 'Explore', icon: Eye, color: 'purple' }] 
      : []),
    ...(pkg.content.audio ? [{ id: 'audio', label: 'Listen', icon: Headphones, color: 'green' }] : []),
    ...(pkg.content.practice ? [{ id: 'practice', label: 'Practice', icon: FileText, color: 'orange' }] : [])
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'reading':
        return (
          <ReadingContent
            content={pkg.content.reading}
            isCompleted={completedSections.reading || false}
            onComplete={() => markComplete('reading')}
            onAskAI={sendInteractionMessage}
            subskillId={pkg.subskill_id} // 🆕 Pass subskill_id for auto-saving visualizations
          />
        );

      case 'explore':
        if (!pkg.content.visuals || pkg.content.visuals.length === 0) return null;
        return (
          <VisualExplorerContent
            visuals={pkg.content.visuals}
            onAskAI={sendInteractionMessage}
          />
        );

      case 'audio':
        if (!pkg.content.audio) return null;
        return (
          <AudioContent
            content={pkg.content.audio}
            isCompleted={completedSections.audio || false}
            onComplete={() => markComplete('audio')}
            onAskAI={sendInteractionMessage}
          />
        );

      case 'practice':
        if (!pkg.content.practice) return null;
        return (
          <PracticeContent
            content={pkg.content.practice}
            isCompleted={completedSections.practice || false}
            onComplete={() => markComplete('practice')}
            onAskAI={sendInteractionMessage}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{pkg.content.reading.title}</h1>
              <p className="text-sm text-muted-foreground">Enhanced Learning Session</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{isConnected ? 'AI Connected' : 'Disconnected'}</span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResourcePanelOpen(!resourcePanelOpen)}
              >
                {resourcePanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Learning Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedObjectives.length} of {pkg.master_context.learning_objectives.length} objectives
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content Area */}
        <div className={`flex flex-col ${resourcePanelOpen ? 'flex-1' : 'w-full'} min-w-0`}>
          {/* Content Tabs */}
          <div className="bg-white border-b px-6 py-2">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center space-x-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isCompleted = completedSections[tab.id];
                  
                  return (
                    <Button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <div className="relative">
                        <Icon className="w-4 h-4" />
                        {isCompleted && (
                          <CheckCircle className="w-3 h-3 text-green-500 absolute -top-1 -right-1" />
                        )}
                      </div>
                      {tab.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-6 py-8">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* AI Chat Sidebar */}
        {resourcePanelOpen && (
          <div className="w-96 bg-white border-l flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-2">AI Tutor</h3>
              <p className="text-sm text-muted-foreground">
                Ask questions about the learning content
              </p>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 && !isResponding && (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-4">
                    <p className="text-sm">Welcome! I'm your AI tutor.</p>
                    <p className="text-xs mt-2">Ask me anything about this learning package!</p>
                  </div>
                  <div className="space-y-2">
                    {['What will I learn?', 'Explain the key concepts', 'How does the visualization work?'].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => sendInteractionMessage(suggestion)}
                        disabled={!isConnected}
                        className="w-full text-xs"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-xs mt-1 opacity-70`}>
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}

                {isResponding && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg p-3">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="ml-2 text-xs text-gray-600">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <div className="p-4 border-t">
              <div className="flex items-end space-x-2 mb-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={toggleMicrophone}
                        disabled={!isConnected}
                        variant={isListening ? "destructive" : "outline"}
                        size="icon"
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isListening ? 'Stop recording' : 'Start recording'}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleAudioToggle}
                        variant={audioEnabled ? "outline" : "secondary"}
                        size="icon"
                      >
                        {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {audioEnabled ? 'Disable audio' : 'Enable audio'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="relative">
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isConnected ? "Ask about this content..." : "Connect to start chatting..."}
                  className="min-h-[60px] resize-none pr-10"
                  disabled={!isConnected || isResponding}
                />
                <Button
                  onClick={sendTextMessage}
                  disabled={!isConnected || !inputText.trim() || isResponding}
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 bottom-1 h-8 w-8"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Learning Objectives */}
            <div className="p-4 border-t bg-gray-50">
              <h4 className="font-medium text-sm mb-3">Learning Objectives</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pkg.master_context.learning_objectives.map((objective, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    {completedObjectives.includes(index) ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    )}
                    <p className={`text-xs ${
                      completedObjectives.includes(index) 
                        ? 'text-green-700 font-medium' 
                        : 'text-gray-600'
                    }`}>
                      {objective}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}