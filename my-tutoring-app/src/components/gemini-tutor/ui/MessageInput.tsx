// components/gemini-tutor/MessageInput.tsx
import React, { useState } from 'react';
import { SendHorizontal, Mic, MicOff, Monitor, MonitorOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageInputProps {
  isConnected: boolean;
  isConnecting: boolean;
  isResponding: boolean;
  isListening: boolean;
  isScreenSharing: boolean;
  onSendMessage: (message: string) => void;
  onToggleMicrophone: () => void;
  onToggleScreenSharing: () => void;
  onReconnect: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  isConnected,
  isConnecting,
  isResponding,
  isListening,
  isScreenSharing,
  onSendMessage,
  onToggleMicrophone,
  onToggleScreenSharing,
  onReconnect,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white border-t p-4">
      <div className="flex items-center space-x-3">
        {/* Voice Recording Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onToggleMicrophone}
                disabled={!isConnected}
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                className="h-10 w-10"
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span className="sr-only">{isListening ? 'Stop recording' : 'Start recording'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isListening ? 'Stop recording' : 'Start recording'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Screen Sharing Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onToggleScreenSharing}
                disabled={!isConnected}
                variant={isScreenSharing ? "destructive" : "outline"}
                size="icon"
                className="h-10 w-10"
              >
                {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                <span className="sr-only">{isScreenSharing ? 'Stop sharing' : 'Share screen'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Text Input */}
        <div className="flex-1 relative">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isConnected ? "Type your question or message..." : "Connecting to AI tutor..."}
            className="min-h-[44px] max-h-32 resize-none pr-12"
            disabled={!isConnected || isResponding}
          />
          <Button
            onClick={handleSend}
            disabled={!isConnected || !inputText.trim() || isResponding}
            size="icon"
            variant="ghost"
            className="absolute right-2 bottom-2 h-8 w-8"
          >
            <SendHorizontal className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>

      {/* Connection status and tips */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          <span>{isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}</span>
          {!isConnected && !isConnecting && (
            <button 
              onClick={onReconnect}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Retry Connection
            </button>
          )}
        </div>
        <div className="hidden sm:block">
          Press <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-xs">Enter</kbd> to send, 
          <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-xs ml-1">Shift+Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
};

export default MessageInput;