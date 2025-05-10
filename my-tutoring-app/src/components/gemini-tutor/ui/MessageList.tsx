// components/gemini-tutor/MessageList.tsx
import React, { useEffect, useRef } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import MessageItem from './MessageItem';
import { Message } from '@/hooks/useWebSocketConnection';

interface MessageListProps {
  messages: Message[];
  isResponding: boolean;
  curriculum: {
    subject: string;
  };
}

const MessageList: React.FC<MessageListProps> = ({ messages, isResponding, curriculum }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ScrollArea className="h-[500px] bg-gray-50">
      <div className="p-6">
        {messages.length === 0 && !isResponding && (
          <div className="flex flex-col items-center justify-center h-96 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-30">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <h3 className="text-xl font-medium mb-2">Ready to Start Learning!</h3>
            <p className="text-sm max-w-md mb-4">
              Your AI tutor is ready to help you with {curriculum.subject}. 
              You can ask questions, share your screen, or use voice to communicate.
            </p>
            <div className="flex flex-wrap gap-2 justify-center text-xs text-gray-400">
              <span className="bg-gray-100 px-3 py-1 rounded-full">Type your questions</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">Use voice chat</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">Share your work</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, index) => (
            <MessageItem key={index} message={msg} />
          ))}

          {isResponding && (
            <div className="flex justify-start">
              <Card className="bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    <span className="ml-2 text-sm text-gray-500">AI tutor is thinking...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </ScrollArea>
  );
};

export default MessageList;