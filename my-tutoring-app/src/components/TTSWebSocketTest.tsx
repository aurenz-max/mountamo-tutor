'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Play, Square, Volume2, VolumeX } from 'lucide-react';

const TTSWebSocketTest = () => {
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  
  // Add a logging function
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().substr(11, 8)}: ${message}`]);
  };
  
  // Initialize AudioContext
  useEffect(() => {
    try {
      // Create a new AudioContext
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      addLog(`AudioContext initialized with sample rate: ${audioContextRef.current.sampleRate}`);
      
      // Resume the AudioContext (to avoid auto-suspension)
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
          addLog('AudioContext resumed during initialization');
        });
      }
    } catch (err) {
      addLog(`Error initializing AudioContext: ${err}`);
      setError('Failed to initialize audio playback');
    }
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        addLog('AudioContext closed');
      }
      if (websocketRef.current) {
        websocketRef.current.close();
        addLog('WebSocket connection closed');
      }
    };
  }, []);
  
  // Play next in queue function
  const playNextInQueue = async () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    
    try {
      // Make sure audio context is running
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        addLog('AudioContext resumed before playback');
      }
      
      const audioBuffer = audioQueueRef.current.shift();
      if (!audioBuffer) return;
      
      // Update queue size in UI
      setQueueSize(audioQueueRef.current.length);
      
      addLog(`Playing buffer: ${audioBuffer.duration.toFixed(2)}s, remaining: ${audioQueueRef.current.length}`);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      if (!muted) {
        source.connect(audioContextRef.current.destination);
      }
      
      // When this audio chunk ends
      source.onended = () => {
        addLog('Audio segment ended');
        audioSourceRef.current = null;
        
        // Play next chunk
        setTimeout(playNextInQueue, 0);
      };
      
      source.start(0);
      audioSourceRef.current = source;
      isPlayingRef.current = true;
      setIsPlaying(true);
    } catch (err) {
      addLog(`Error during audio playback: ${err}`);
      isPlayingRef.current = false;
      
      // Try the next one in case of error
      setTimeout(playNextInQueue, 0);
    }
  };
  
  // Process PCM audio from base64 and add to queue
  const processPCMFromBase64 = async (
    base64Data: string,
    sampleRate: number = 24000, 
    channels: number = 1
  ) => {
    if (!audioContextRef.current) {
      addLog('Cannot process audio: AudioContext not initialized');
      return;
    }

    try {
      // Decode base64
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      addLog(`Decoded base64 audio: ${bytes.length} bytes`);

      // Convert bytes to float32 samples
      // Assuming 16-bit PCM little-endian
      const samples = new Float32Array(bytes.length / 2);
      const view = new DataView(bytes.buffer);

      for (let i = 0; i < samples.length; i++) {
        // Read 16-bit value and convert to float
        const int16Value = view.getInt16(i * 2, true); // true = little-endian
        // Convert to float32 (-1.0 to 1.0)
        samples[i] = int16Value / 32768.0;
      }

      // Create an AudioBuffer with the correct sample rate
      const audioBuffer = audioContextRef.current.createBuffer(
        channels, 
        samples.length, 
        sampleRate
      );

      // Fill the buffer with our samples
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(samples);

      addLog(`Created audio buffer: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels`);
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      setQueueSize(audioQueueRef.current.length);
      addLog(`Added to queue, queue size: ${audioQueueRef.current.length}`);
      
      // Start playback if not already playing
      if (!isPlayingRef.current) {
        isPlayingRef.current = true; // Prevent multiple simultaneous calls
        playNextInQueue();
      }
    } catch (err) {
      addLog(`Error processing audio: ${err}`);
      console.error('Error processing audio:', err);
    }
  };
  
  // Connect to WebSocket
  const connectWebSocket = () => {
    if (websocketRef.current) {
      addLog('Closing existing WebSocket connection');
      websocketRef.current.close();
    }
    
    try {
      addLog('Attempting to connect to WebSocket...');
      const ws = new WebSocket('ws://localhost:8000/api/tts/stream');
      websocketRef.current = ws;
      
      ws.onopen = () => {
        addLog('WebSocket connection established');
        setIsConnected(true);
        setStatus('connected');
        setError('');
      };
      
      ws.onclose = (event) => {
        addLog(`WebSocket connection closed with code: ${event.code}, reason: ${event.reason}`);
        setIsConnected(false);
        setStatus('disconnected');
      };
      
      ws.onerror = (event) => {
        addLog('WebSocket error occurred');
        setError('WebSocket error occurred');
        setStatus('error');
      };
      
      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // Handle binary audio data (we're not using this anymore)
          const arrayBuffer = await event.data.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          addLog(`Received binary data: ${uint8Array.length} bytes`);
        } else {
          // Handle JSON status messages
          try {
            const data = JSON.parse(event.data);
            addLog(`Received message: ${JSON.stringify(data)}`);
            
            if (data.status === 'starting') {
              setStatus('synthesizing');
              setIsPlaying(true);
              addLog('Started audio synthesis');
              
              // Clear the queue when starting new synthesis
              audioQueueRef.current = [];
              setQueueSize(0);
              if (audioSourceRef.current) {
                audioSourceRef.current.stop();
                audioSourceRef.current = null;
              }
              isPlayingRef.current = false;
            } else if (data.status === 'complete') {
              setStatus('complete');
              addLog('Audio synthesis complete');
            } else if (data.type === 'audio') {
              // Handle base64 encoded audio data
              addLog(`Received base64 audio data of length: ${data.data.length}`);
              await processPCMFromBase64(
                data.data,
                data.sampleRate || 24000,
                data.channels || 1
              );
            } else if (data.error) {
              setError(data.error);
              setStatus('error');
              addLog(`Error from server: ${data.error}`);
            }
          } catch (e) {
            addLog(`Failed to parse message: ${e}`);
            console.error('Failed to parse message:', e, event.data);
          }
        }
      };
    } catch (err) {
      addLog(`Failed to connect to WebSocket: ${err}`);
      setError('Failed to connect to WebSocket');
      setStatus('error');
    }
  };
  
  // User interaction to ensure AudioContext starts
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        addLog('AudioContext resumed after user interaction');
      }
      document.removeEventListener('click', handleUserInteraction);
    };
    
    document.addEventListener('click', handleUserInteraction);
    return () => {
      document.removeEventListener('click', handleUserInteraction);
    };
  }, []);
  
  // Send text to the WebSocket
  const sendText = () => {
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      addLog('WebSocket not connected, reconnecting before sending...');
      connectWebSocket();
      setTimeout(() => {
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          addLog(`Sending text (${text.length} chars) to WebSocket`);
          websocketRef.current.send(JSON.stringify({ text }));
        } else {
          addLog('Failed to reconnect WebSocket, cannot send text');
          setError('Could not establish WebSocket connection');
        }
      }, 500);
    } else {
      addLog(`Sending text (${text.length} chars) to WebSocket`);
      websocketRef.current.send(JSON.stringify({ text }));
    }
  };
  
  // Stop audio playback
  const stopPlayback = () => {
    addLog('Stopping audio playback');
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    
    // Clear the queue
    audioQueueRef.current = [];
    setQueueSize(0);
    addLog('Cleared audio queue');
    setIsPlaying(false);
    isPlayingRef.current = false;
    setStatus('idle');
  };
  
  // Toggle audio mute
  const toggleMute = () => {
    setMuted(!muted);
    addLog(`Audio ${!muted ? 'muted' : 'unmuted'}`);
    if (audioSourceRef.current && audioContextRef.current) {
      if (!muted) {
        audioSourceRef.current.disconnect();
        addLog('Disconnected active audio source');
      } else {
        audioSourceRef.current.connect(audioContextRef.current.destination);
        addLog('Reconnected active audio source');
      }
    } else {
      addLog('No active audio source to toggle mute');
    }
  };
  
  // Force audio context resume on button click
  const forceAudioResume = async () => {
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.resume();
        addLog(`AudioContext resumed manually, state: ${audioContextRef.current.state}`);
        if (!isPlayingRef.current && audioQueueRef.current.length > 0) {
          playNextInQueue();
        }
      } catch (err) {
        addLog(`Error resuming AudioContext: ${err}`);
      }
    }
  };
  
  // Status indicator component
  const StatusIndicator = () => {
    switch (status) {
      case 'idle':
        return <span className="text-gray-500">Ready</span>;
      case 'connected':
        return <span className="text-blue-500">Connected</span>;
      case 'synthesizing':
        return (
          <span className="text-yellow-500 flex items-center">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Synthesizing...
          </span>
        );
      case 'complete':
        return <span className="text-green-500">Complete</span>;
      case 'error':
        return <span className="text-red-500">Error</span>;
      case 'disconnected':
        return <span className="text-gray-500">Disconnected</span>;
      default:
        return null;
    }
  };
  
  // Audio context state indicator
  const AudioContextStatus = () => {
    const [contextState, setContextState] = useState('unknown');
    
    // Update context state periodically
    useEffect(() => {
      const interval = setInterval(() => {
        if (audioContextRef.current) {
          setContextState(audioContextRef.current.state);
        }
      }, 500);
      
      return () => clearInterval(interval);
    }, []);
    
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>AudioContext:</span>
        <span className={
          contextState === 'running' ? 'text-green-500' : 
          contextState === 'suspended' ? 'text-yellow-500' : 'text-red-500'
        }>
          {contextState}
        </span>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={forceAudioResume}
          disabled={contextState === 'running'}
        >
          Resume
        </Button>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Gemini Text-to-Speech Test</CardTitle>
        <CardDescription>
          Enter text to be synthesized into speech using the Gemini API
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Connection status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <StatusIndicator />
          </div>
          
          {/* AudioContext status */}
          <AudioContextStatus />
          
          {/* Error display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {/* Text input */}
          <div className="space-y-2">
            <Label htmlFor="text-input">Text to synthesize</Label>
            <Textarea
              id="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to convert to speech..."
              className="min-h-32"
            />
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={sendText}
                disabled={!text.trim() || status === 'synthesizing'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" /> 
                Synthesize
              </Button>
              
              <Button
                onClick={stopPlayback}
                disabled={!isPlaying}
                variant="outline"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleMute}
                className={muted ? "text-gray-400" : "text-gray-900"}
              >
                {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </Button>
            </div>
          </div>
          
          {/* Queue status */}
          <div className="text-sm text-gray-500 flex items-center space-x-2">
            <span>Queue size: {queueSize} chunks</span>
            <span>|</span>
            <span>Playback: {isPlayingRef.current ? 'Active' : 'Inactive'}</span>
            {queueSize > 0 && !isPlayingRef.current && (
              <Button size="sm" variant="outline" onClick={() => playNextInQueue()}>
                Force Play
              </Button>
            )}
          </div>
          
          {/* Connection button */}
          <div className="flex items-center space-x-2 pt-4">
            <Button 
              onClick={connectWebSocket} 
              variant={isConnected ? "outline" : "default"}
              className={isConnected ? "" : "bg-green-600 hover:bg-green-700"}
            >
              {isConnected ? "Reconnect" : "Connect WebSocket"}
            </Button>
          </div>
          
          {/* Debug Logs */}
          <div className="mt-6">
            <details>
              <summary className="cursor-pointer font-medium mb-2">Debug Logs</summary>
              <div className="bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto text-xs font-mono">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No logs yet</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
              <div className="mt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setLogs([])}
                >
                  Clear Logs
                </Button>
              </div>
            </details>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TTSWebSocketTest;