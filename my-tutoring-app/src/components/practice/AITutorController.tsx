'use client';

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  HelpCircle, 
  BookOpen, 
  CheckCircle2,
  Loader2,
  Send,
  MessageCircle,
  Volume2,
  VolumeX
} from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import { useAudioPlayback } from '@/lib/hooks/useAudioPlayback';

export interface AITutorControllerRef {
  setCurrentProblem: (problem: any) => void;
  sendResultFeedback: (isCorrect: boolean, score: number, message: string, feedback?: any) => void;
}

interface AITutorControllerProps {
  topicContext: {
    subject?: string;
    skill_description?: string;
    subskill_description?: string;
    skill_id?: string;
    subskill_id?: string;
  };
}

interface ChatMessage {
  type: 'user' | 'tutor';
  content: string;
  timestamp: Date;
}

export const AITutorController = forwardRef<AITutorControllerRef, AITutorControllerProps>(
  ({ topicContext }, ref) => {
    // Simple state management without duplicating your existing WebSocket infrastructure
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(true);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [textInput, setTextInput] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    
    const socketRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // Use the proven audio playback hook
    const { processAndPlayRawAudio, stopAudioPlayback } = useAudioPlayback({ sampleRate: 24000 });

    // Auto-scroll to bottom of messages
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Use existing authApi WebSocket connection pattern
    useEffect(() => {
      const connect = async () => {
        try {
          setIsConnecting(true);
          setConnectionError(null);
          
          console.log('🎯 Creating Practice Tutor WebSocket connection via authApi');
          
          // Use the new authApi method for Practice Tutor WebSocket
          const ws = await authApi.createPracticeTutorWebSocket(topicContext);
          
          // At this point, the WebSocket is already authenticated and ready to use
          console.log('✅ Practice Tutor WebSocket authenticated and ready');
          setIsConnected(true);
          setIsConnecting(false);
          // No initial text message - the tutor will speak when the first problem is presented
          setMessages([]);
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log('🎯 Practice Tutor received message:', data);
              
              if (data.type === 'audio_response') {
                // Handle audio response - automatically play the audio
                console.log('🔊 Received audio response from tutor - playing automatically');
                if (data.audio_data && !isMuted) {
                  processAndPlayRawAudio(data.audio_data, 24000);
                }
                
              } else if (data.type === 'text_response') {
                // This shouldn't happen with AUDIO-only mode, but keep for safety
                addMessage('tutor', data.content);
              }
              
            } catch (error) {
              console.error('Error parsing WebSocket message:', error);
            }
          };
          
          ws.onerror = (error) => {
            console.error('🎯 Practice Tutor WebSocket error:', error);
            setConnectionError('Connection error occurred');
          };
          
          ws.onclose = (event) => {
            console.log('🎯 Practice Tutor WebSocket closed:', event.code, event.reason);
            setIsConnected(false);
            setIsConnecting(false);
            if (event.code !== 1000) {
              setConnectionError(`Connection closed: ${event.reason || 'Unknown error'}`);
            }
          };
          
          socketRef.current = ws;
          
        } catch (error) {
          console.error('Failed to connect to Practice Tutor:', error);
          setConnectionError(error instanceof Error ? error.message : 'Connection failed');
          setIsConnecting(false);
        }
      };

      connect();

      return () => {
        if (socketRef.current) {
          socketRef.current.close();
        }
        stopAudioPlayback();
      };
    }, [topicContext]);

    // Add message to chat
    const addMessage = (type: 'user' | 'tutor', content: string) => {
      setMessages(prev => [...prev, {
        type,
        content,
        timestamp: new Date()
      }]);
    };

    // Send text message
    const sendTextMessage = () => {
      if (!textInput.trim() || !isConnected) return;
      
      setIsSendingMessage(true);
      addMessage('user', textInput);
      
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'text',
          content: textInput
        }));
      }
      
      setTextInput('');
      setIsSendingMessage(false);
    };

    // Send predefined requests
    const sendPredefinedRequest = (requestType: string) => {
      if (!isConnected) return;
      
      let message = '';
      let displayMessage = '';
      
      switch (requestType) {
        case 'hint':
          message = 'Can you give me a hint to help me think through this problem?';
          displayMessage = 'Asked for a hint';
          break;
        case 'explain':
          message = 'Can you explain the main concept behind this problem?';
          displayMessage = 'Asked for concept explanation';
          break;
        case 'check_work':
          message = 'Can you help me check if I\'m on the right track?';
          displayMessage = 'Asked tutor to check work';
          break;
        default:
          return;
      }
      
      addMessage('user', displayMessage);
      
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: requestType === 'check_work' ? 'check_work' : requestType === 'hint' ? 'hint_request' : 'concept_explanation',
          content: message
        }));
      }
    };

    // Expose methods for parent to call
    useImperativeHandle(ref, () => ({
      setCurrentProblem(problem: any) {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'new_problem',
            problem_context: {
              problem_data: problem
            }
          }));
          
          addMessage('user', '📋 Moved to a new problem');
        }
      },
      
      sendResultFeedback(isCorrect: boolean, score: number, message: string, feedback?: any) {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          const feedbackMessage = isCorrect 
            ? `I got that problem right! My score was ${score}/10. Can you give me some encouraging words and maybe explain why my approach was correct?`
            : `I didn't get that problem right. My score was ${score}/10. Can you help me understand what went wrong and encourage me to keep trying?`;
            
          socketRef.current.send(JSON.stringify({
            type: 'result_feedback',
            is_correct: isCorrect,
            score: score,
            content: feedbackMessage,
            feedback_data: feedback
          }));
          
          // Don't add to chat - let the tutor respond with audio
        }
      }
    }));

    // Render connection status
    const renderConnectionStatus = () => {
      if (isConnecting) {
        return (
          <div className="flex items-center space-x-2 text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Connecting to AI Tutor...</span>
          </div>
        );
      }
      
      if (connectionError) {
        return (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-sm">{connectionError}</AlertDescription>
          </Alert>
        );
      }
      
      if (isConnected) {
        return (
          <div className="flex items-center space-x-2 text-green-600 mb-3">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">AI Tutor Ready</span>
          </div>
        );
      }
      
      return null;
    };

    return (
      <Card className="w-full h-96 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <span>AI Practice Tutor</span>
            </div>
            {isConnected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 ${isMuted ? 'text-red-500' : 'text-green-600'}`}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            )}
          </CardTitle>
          {renderConnectionStatus()}
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col space-y-4">
          {/* Chat Messages - Simplified */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-3 border rounded-lg bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border text-gray-800'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Buttons */}
          {isConnected && (
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => sendPredefinedRequest('hint')}
                variant="outline"
                size="sm"
                className="flex items-center space-x-1"
              >
                <HelpCircle className="h-4 w-4" />
                <span>Hint</span>
              </Button>
              
              <Button
                onClick={() => sendPredefinedRequest('explain')}
                variant="outline"
                size="sm"
                className="flex items-center space-x-1"
              >
                <BookOpen className="h-4 w-4" />
                <span>Explain</span>
              </Button>
              
              <Button
                onClick={() => sendPredefinedRequest('check_work')}
                variant="outline"
                size="sm"
                className="flex items-center space-x-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Check</span>
              </Button>
            </div>
          )}

          {/* Simple Text Input */}
          {isConnected && (
            <div className="flex space-x-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
                placeholder="Ask your question..."
                className="flex-1"
                disabled={isSendingMessage}
              />
              <Button
                onClick={sendTextMessage}
                size="sm"
                disabled={!textInput.trim() || isSendingMessage}
              >
                {isSendingMessage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

AITutorController.displayName = 'AITutorController';