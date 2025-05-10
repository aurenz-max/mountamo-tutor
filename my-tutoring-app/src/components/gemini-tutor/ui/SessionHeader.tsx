// components/gemini-tutor/SessionHeader.tsx
import React from 'react';
import { Button } from "@/components/ui/button";

interface SessionHeaderProps {
  subject: string;
  isConnected: boolean;
  isConnecting: boolean;
  isListening: boolean;
  isScreenSharing: boolean;
  onEndSession: () => void;
}

const SessionHeader: React.FC<SessionHeaderProps> = ({
  subject,
  isConnected,
  isConnecting,
  isListening,
  isScreenSharing,
  onEndSession,
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-400' : 
            isConnecting ? 'bg-yellow-400 animate-pulse' : 
            'bg-red-400'
          }`}></div>
          <h2 className="text-xl font-semibold">
            {subject} Tutoring Session
          </h2>
        </div>
        <div className="flex items-center space-x-4">
          {/* Status indicators */}
          {isListening && (
            <span className="bg-red-500/20 text-red-100 px-3 py-1 rounded-full text-sm flex items-center">
              <span className="w-2 h-2 bg-red-300 rounded-full mr-2 animate-pulse"></span>
              Recording
            </span>
          )}
          {isScreenSharing && (
            <span className="bg-blue-400/20 text-blue-100 px-3 py-1 rounded-full text-sm flex items-center">
              <span className="w-2 h-2 bg-blue-300 rounded-full mr-2 animate-pulse"></span>
              Sharing Screen
            </span>
          )}
          
          {/* End Session Button */}
          <Button 
            variant="secondary" 
            size="sm"
            onClick={onEndSession}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            End Session
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionHeader;