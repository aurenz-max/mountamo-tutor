import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Mic, 
  MicOff, 
  Power,
  PowerOff,
  Volume2,
  Loader2,
  ScreenShare,
  ScreenShareOff
} from 'lucide-react';

const GeminiControlPanel = () => {
  const [geminiStatus, setGeminiStatus] = React.useState('disconnected'); 
  const [micStatus, setMicStatus] = React.useState('off');
  const [screenShare, setScreenShare] = React.useState('off');
  
  const toggleSession = () => {
    if (geminiStatus === 'disconnected') {
      setGeminiStatus('connecting');
      setTimeout(() => setGeminiStatus('connected'), 1500);
    } else {
      setGeminiStatus('disconnected');
      setMicStatus('off');
      setScreenShare('off');
    }
  };

  const toggleMic = () => {
    if (geminiStatus !== 'connected') return;
    setMicStatus(current => current === 'off' ? 'on' : 'off');
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
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
      {/* Left: Session Control */}
      <div className="flex items-center gap-2">
        <Button
          variant={geminiStatus === 'connected' ? 'default' : 'outline'}
          size="sm"
          onClick={toggleSession}
          disabled={geminiStatus === 'connecting'}
          className="relative min-w-[120px]"
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

      {/* Center: Controls Group */}
      <div className="flex items-center gap-4">
        {/* Mic Control */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMic}
            disabled={geminiStatus !== 'connected'}
            className={`relative ${micStatus === 'on' ? 'text-blue-600' : 'text-gray-600'}`}
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
        </div>

        {/* Screen Share Control */}
        <div className="flex items-center gap-2">
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
                <span>Starting Share...</span>
              </>
            ) : screenShare === 'active' ? (
              <>
                <ScreenShare className="h-4 w-4 mr-2" />
                <span>Stop Sharing</span>
              </>
            ) : (
              <>
                <ScreenShareOff className="h-4 w-4 mr-2" />
                <span>Share Off</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GeminiControlPanel;