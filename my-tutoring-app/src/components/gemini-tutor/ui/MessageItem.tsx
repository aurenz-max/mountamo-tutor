// components/gemini-tutor/MessageItem.tsx
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Message } from '@/hooks/useWebSocketConnection';

interface MessageItemProps {
  message: Message;
}

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <Card className={`max-w-[85%] ${
        isUser 
          ? 'bg-blue-600 text-white' 
          : isSystem
            ? 'bg-yellow-50 text-yellow-800 border-yellow-200 text-sm'
            : 'bg-white shadow-sm'
      }`}>
        <CardContent className="p-4">
          <div className="flex flex-col">
            <div className="whitespace-pre-wrap">{message.content}</div>
            <div className={`text-xs mt-2 ${
              isUser ? 'text-blue-100' : 'text-gray-400'
            }`}>
              {formatTime(message.timestamp)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MessageItem;