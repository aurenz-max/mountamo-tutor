'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from '@/lib/api';
import { playBase64Audio } from './AudioPlayer';

interface Topic {
  subject: string;
  skill_description?: string;
  subskill_description?: string;
  difficulty_range?: {
    target: number;
  };
  selection?: {
    unit: string;
    skill: string;
    subskill: string;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  audioData?: string;
}

interface ChatInterfaceProps {
  studentId?: number;
  currentTopic: Topic;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  studentId = 1, 
  currentTopic 
}) => {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [userInput, setUserInput] = React.useState('');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const audioContextRef = React.useRef<AudioContext | null>(null);

  React.useEffect(() => {
    // Initialize AudioContext on first user interaction
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
    };

    window.addEventListener('click', initAudioContext, { once: true });

    return () => {
      window.removeEventListener('click', initAudioContext);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startNewSession = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const sessionData = {
        subject: currentTopic.subject,
        skill_description: currentTopic.skill_description || '',
        subskill_description: currentTopic.subskill_description || '',
        student_id: studentId,
        competency_score: currentTopic.difficulty_range?.target || 5.0
      };
      
      const session = await api.startSession(sessionData);
      setSessionId(session.session_id);
      
      const newMessage: Message = { 
        role: 'assistant', 
        content: session.initial_message,
        audioData: session.audio_data 
      };
      
      setMessages([newMessage]);
      
      if (session.audio_data) {
        await playBase64Audio(
          session.audio_data,
          audioContextRef,
          setIsPlaying,
          setError
        );
      }
    } catch (err) {
      setError('Failed to start session. Please try again.');
      console.error('Session start error:', err);
    }
    
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!userInput.trim() || !sessionId) return;

    const userMessage = userInput.trim();
    setUserInput('');
    setError(null);
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await api.sendResponse({
        session_id: sessionId,
        response: userMessage,
        context: {
          subject: currentTopic.subject,
          unit_id: currentTopic.selection?.unit || '',
          skill_id: currentTopic.selection?.skill || '',
          subskill_id: currentTopic.selection?.subskill || ''
        }
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response,
        audioData: response.audio_data
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (response.audio_data) {
        await playBase64Audio(
          response.audio_data,
          audioContextRef,
          setIsPlaying,
          setError
        );
      }
    } catch (err) {
      setError('Failed to send message. Please try again.');
      console.error('Message send error:', err);
    }
    
    setLoading(false);
  };

  const getTopicDescription = () => {
    const parts = [
      currentTopic.skill_description,
      currentTopic.subskill_description
    ].filter(Boolean);
    
    return parts.join(' → ');
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Chat Tutoring</CardTitle>
        {currentTopic && (
          <div className="text-sm text-gray-500">
            {currentTopic.subject}
            {getTopicDescription() && ` - ${getTopicDescription()}`}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!sessionId ? (
          <Button 
            onClick={startNewSession} 
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Starting Session...' : 'Start New Chat Session'}
          </Button>
        ) : (
          <>
            <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100'
                      }`}
                    >
                      {message.content}
                      {message.role === 'assistant' && (
                        <>
                          <div className="text-xs text-gray-400 mt-1">
                            AI-generated
                            {message.audioData && isPlaying && ' • Playing audio...'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-center">
                    <Progress value={33} className="w-1/3" />
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {error && (
              <div className="text-red-500 text-sm px-2">
                {error}
              </div>
            )}

            <div className="flex space-x-2">
              <Textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type your response here..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button onClick={sendMessage} disabled={loading}>
                Send
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ChatInterface;