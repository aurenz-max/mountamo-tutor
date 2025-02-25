import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Power, PowerOff, Volume2, VolumeX, Loader2, ScreenShare, ScreenShareOff } from 'lucide-react';

interface GeminiControlPanelProps {
  onSessionChange?: (status: string) => void;
  onMicToggle?: (isActive: boolean) => void;
  onListeningStateChange?: (isListening: boolean) => void;
  onTranscriptionToggle?: (isActive: boolean) => void;
  isSpeaking?: boolean;
  isProcessing?: boolean;
  transcriptionEnabled?: boolean;
}

const GeminiControlPanel: React.FC<GeminiControlPanelProps> = ({
  onSessionChange,
  onMicToggle,
  onListeningStateChange,
  onTranscriptionToggle,
  isSpeaking = false,
  isProcessing = false,
  transcriptionEnabled = true,
}) => {
  const [geminiStatus, setGeminiStatus] = useState('disconnected');
  const [micStatus, setMicStatus] = useState('off');
  const [listeningStatus, setListeningStatus] = useState(false);
  const [screenShare, setScreenShare] = useState('off');

  const toggleSession = () => {
    if (geminiStatus === 'disconnected') {
      setGeminiStatus('connecting');
      onSessionChange?.('connecting');
      setTimeout(() => {
        setGeminiStatus('connected');
        onSessionChange?.('connected');
      }, 1500);
    } else {
      setGeminiStatus('disconnected');
      setMicStatus('off');
      setScreenShare('off');
      setListeningStatus(false);
      onSessionChange?.('disconnected');
    }
  };

  const toggleMic = () => {
    if (geminiStatus !== 'connected') return;
    const newStatus = micStatus === 'off' ? 'on' : 'off';
    setMicStatus(newStatus);
    onMicToggle?.(newStatus === 'on');
  };

  const toggleListening = () => {
    if (geminiStatus !== 'connected' || micStatus !== 'on') return;
    const newStatus = !listeningStatus;
    setListeningStatus(newStatus);
    onListeningStateChange?.(newStatus);
  };

  const toggleTranscription = () => {
    if (geminiStatus !== 'connected') return;
    onTranscriptionToggle?.(!transcriptionEnabled);
  };

  const toggleScreenShare = () => {
    if (geminiStatus !== 'connected') return;
    if (screenShare === 'off') {
      setScreenShare('starting');
      setTimeout(() => setScreenShare('active'), 1000);
    } else {
      setScreenShare('off');
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm">
      <div className="flex items-center gap-2">
        <Button
          variant={geminiStatus === 'connected' ? 'default' : 'outline'}
          size="sm"
          onClick={toggleSession}
          disabled={geminiStatus === 'connecting'}
          className="relative min-w-[130px]"
        >
          {geminiStatus === 'connecting' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Connecting...</span>
            </>
          ) : geminiStatus === 'connected' ? (
            <>
              <Power className="h-4 w-4 mr-2" />
              <span>End Session</span>
            </>
          ) : (
            <>
              <PowerOff className="h-4 w-4 mr-2" />
              <span>Start Session</span>
            </>
          )}
        </Button>
      </div>
      <div className="flex items-center gap-3">
        {isProcessing && (
          <div className="flex items-center px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            <span>Processing...</span>
          </div>
        )}
        {isSpeaking && (
          <div className="flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
            <Volume2 className="h-3 w-3 mr-1" />
            <span>Speaking</span>
          </div>
        )}
        {listeningStatus && (
          <div className="flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
            <Mic className="h-3 w-3 mr-1" />
            <span>Listening</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant={micStatus === 'on' ? 'default' : 'outline'}
          size="sm"
          onClick={toggleMic}
          disabled={geminiStatus !== 'connected'}
          className={`relative ${micStatus === 'on' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
        >
          {micStatus === 'on' ? (
            <>
              <Mic className="h-4 w-4 mr-2" />
              <span>Mic On</span>
            </>
          ) : (
            <>
              <MicOff className="h-4 w-4 mr-2" />
              <span>Mic Off</span>
            </>
          )}
        </Button>
        <Button
          variant={listeningStatus ? 'default' : 'outline'}
          size="sm"
          onClick={toggleListening}
          disabled={geminiStatus !== 'connected' || micStatus !== 'on'}
          className={`relative ${listeningStatus ? 'bg-green-500 hover:bg-green-600' : ''}`}
        >
          {listeningStatus ? (
            <>
              <Volume2 className="h-4 w-4 mr-2" />
              <span>Listening</span>
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4 mr-2" />
              <span>Not Listening</span>
            </>
          )}
        </Button>
        <Button
          variant={transcriptionEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={toggleTranscription}
          disabled={geminiStatus !== 'connected'}
          className={`relative ${transcriptionEnabled ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
        >
          {transcriptionEnabled ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
              </svg>
              <span>Captions On</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <line x1="3" y1="3" x2="21" y2="21"></line>
              </svg>
              <span>Captions Off</span>
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleScreenShare}
          disabled={geminiStatus !== 'connected'}
          className={`relative ${screenShare !== 'off' ? 'text-blue-600' : 'text-gray-600'}`}
        >
          {screenShare === 'starting' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Starting...</span>
            </>
          ) : screenShare === 'active' ? (
            <>
              <ScreenShare className="h-4 w-4 mr-2" />
              <span>Sharing</span>
            </>
          ) : (
            <>
              <ScreenShareOff className="h-4 w-4 mr-2" />
              <span>Share</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default GeminiControlPanel;