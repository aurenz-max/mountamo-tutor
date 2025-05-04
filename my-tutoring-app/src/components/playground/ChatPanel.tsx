import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area"; 
import { RefreshCw, Send } from 'lucide-react';
import { ChatState } from './P5jsPlayground';

interface ChatPanelProps {
  messages: Array<{
    role: string;
    text: string;
    thinking?: string;
  }>;
  chatState: ChatState;
  sendMessage: (message: string, role?: string) => Promise<void>;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  chatState,
  sendMessage,
}) => {
  const [inputMessage, setInputMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Function to scroll to the end of messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Scroll down when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Handle input key press (Enter to send)
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (chatState !== ChatState.IDLE || !inputMessage.trim()) return;
    
    const message = inputMessage.trim();
    setInputMessage(''); // Clear input field
    
    // Send message
    await sendMessage(message);
    
    // Focus back on input after sending
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  // Handle "Improve code" when there's an error
  const handleImproveCode = async (errorMessage: string) => {
    await sendMessage(errorMessage, 'SYSTEM');
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Message container with ScrollArea */}
      <ScrollArea className="flex-1 px-4 py-2">
        <div className="space-y-4">
          {/* Render messages */}
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground ml-8' 
                  : msg.role === 'assistant' 
                    ? 'bg-muted border mr-8'
                    : 'bg-muted/50 text-center mx-8 text-sm'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">
                {msg.text}
              </div>
              
              {msg.thinking && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium">Thinking Info</summary>
                  <div className="p-2 mt-1 bg-background/80 rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                    {msg.thinking}
                  </div>
                </details>
              )}
              
              {msg.role === 'system-ask' && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="mt-2"
                  onClick={() => handleImproveCode(msg.text)}
                >
                  Improve
                </Button>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Separator className="my-2" />
      
      {/* Input area */}
      <div className="p-3 flex-shrink-0">
        {chatState !== ChatState.IDLE && (
          <div className="flex items-center text-sm text-muted-foreground mb-2">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            {chatState === ChatState.GENERATING ? 'Generating...' : 
             chatState === ChatState.THINKING ? 'Thinking...' : 
             'Coding...'}
          </div>
        )}
        <div className="flex space-x-2">
          <Input
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask Gemini to create p5.js code for you..."
            disabled={chatState !== ChatState.IDLE}
            className="flex-1"
          />
          <Button
            size="icon"
            disabled={chatState !== ChatState.IDLE || inputMessage.trim() === ''}
            onClick={handleSendMessage}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;