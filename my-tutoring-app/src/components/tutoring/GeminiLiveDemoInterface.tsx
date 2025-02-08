'use client'

import React, { useEffect, useState } from 'react'
import { useWebSocket } from '@/lib/use-websocket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, StopCircle, Mic, Square } from 'lucide-react'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function GeminiDemo() {
  const [message, setMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const { 
    sendMessage, 
    lastMessage, 
    readyState, 
    messages,
    startCapture,
    stopCapture,
    isCapturing,
    startAudioCapture,
    stopAudioCapture,
    isAudioCapturing
  } = useWebSocket()

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.text && lastMessage.status === 'streaming') {
        setChatMessages(prev => [...prev, { text: lastMessage.text, sender: 'gemini' }]);
      } else if (lastMessage.audio && lastMessage.status === 'streaming') {
        // Audio is handled by GeminiAudioPlayer now
        console.log("Audio streaming, size:", lastMessage.size);
      } else if (lastMessage.error) {
        setChatMessages(prev => [...prev, { 
          error: lastMessage.error, 
          sender: 'gemini',
          status: 'error'
        }]);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      // Handle messages history if needed
    }
  }, [messages]);

  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      const config = {
        setup: {
          response_modalities: ["AUDIO"],
          voice_config: {
            voice_name: "Puck"  // You might want to make this configurable
          }
        }
      };
      sendMessage(JSON.stringify(config));
    }
  }, [readyState]);

  const connectionStatus = {
    [WebSocket.CONNECTING]: 'Connecting...',
    [WebSocket.OPEN]: 'Connected',
    [WebSocket.CLOSING]: 'Closing...',
    [WebSocket.CLOSED]: 'Disconnected',
  }[readyState]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && readyState === WebSocket.OPEN) {
      sendMessage(message.trim());  // WebSocket context handles formatting
      setChatMessages(prev => [...prev, { text: message, sender: 'user' }]);
      setMessage('');
    }
  }

  const handleScreenShare = async () => {
    try {
      if (isCapturing) {
        stopCapture();
        setChatMessages(prev => [...prev, { 
          text: "Screen sharing stopped", 
          sender: 'system' 
        }]);
      } else {
        await startCapture();
        setChatMessages(prev => [...prev, { 
          text: "Screen sharing started - Gemini can now see your screen", 
          sender: 'system' 
        }]);
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
      setChatMessages(prev => [...prev, { 
        error: "Failed to start screen sharing", 
        sender: 'system' 
      }]);
    }
  };

  const handleAudioCapture = async () => {
    try {
      if (isAudioCapturing) {
        stopAudioCapture();
        setChatMessages(prev => [...prev, { 
          text: "Voice recording stopped", 
          sender: 'system' 
        }]);
      } else {
        await startAudioCapture();
        setChatMessages(prev => [...prev, { 
          text: "Voice recording started - Gemini can now hear you", 
          sender: 'system' 
        }]);
      }
    } catch (error) {
      console.error('Audio capture error:', error);
      setChatMessages(prev => [...prev, { 
        error: "Failed to start voice recording", 
        sender: 'system' 
      }]);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Gemini Chat Interface</span>
          <div className="flex items-center gap-4">
            <Button
              variant={isAudioCapturing ? "destructive" : "secondary"}
              size="sm"
              onClick={handleAudioCapture}
              className="flex items-center gap-2"
              disabled={readyState !== WebSocket.OPEN}
            >
              {isAudioCapturing ? (
                <>
                  <Square className="h-4 w-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Record Voice
                </>
              )}
            </Button>
            <Button
              variant={isCapturing ? "destructive" : "secondary"}
              size="sm"
              onClick={handleScreenShare}
              className="flex items-center gap-2"
              disabled={readyState !== WebSocket.OPEN}
            >
              {isCapturing ? (
                <>
                  <StopCircle className="h-4 w-4" />
                  Stop Sharing
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Share Screen
                </>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              Status: {connectionStatus}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-96 overflow-y-auto space-y-4">
        {chatMessages.map((msg, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              msg.sender === 'user' 
                ? 'bg-primary text-primary-foreground ml-auto'
                : msg.sender === 'system'
                ? 'bg-secondary text-secondary-foreground mx-auto'
                : 'bg-muted text-muted-foreground mr-auto'
            }`}
            style={{ 
              maxWidth: '80%', 
              textAlign: msg.sender === 'user' ? 'right' : 'left'
            }}
          >
            {msg.text && <p>{msg.text}</p>}            
            {msg.error && <p className="text-destructive">{msg.error}</p>}
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={readyState !== WebSocket.OPEN}
          />
          <Button
            type="submit"
            disabled={!message.trim() || readyState !== WebSocket.OPEN}
          >
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}