// lib/WebSocketService.ts
import { EventEmitter } from 'events';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.status = 'disconnected';
    this.events = new EventEmitter();
    this.messageHandlers = {};
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // ms
    this.audioContext = null;
  }

  // Register a message handler for a specific message type
  registerHandler(messageType, handler) {
    this.messageHandlers[messageType] = handler;
    return () => {
      delete this.messageHandlers[messageType];
    };
  }

  // Initialize the WebSocket connection with session data
  async connect(sessionData = {}) {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws && this.connected) {
          console.log('WebSocket already connected');
          resolve(this.sessionId);
          return;
        }

        this.status = 'connecting';
        this.events.emit('statusChange', 'connecting');

        // Build URL with query params for Gemini WebSocket
        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/gemini/bidirectional';
        const queryParams = new URLSearchParams();
        
        // Add curriculum parameters if provided
        if (sessionData.subject) queryParams.append('subject', sessionData.subject);
        if (sessionData.skill) queryParams.append('skill', sessionData.skill);
        if (sessionData.subskill) queryParams.append('subskill', sessionData.subskill);
        
        // Enable transcription by default
        if (sessionData.enableTranscription !== false) {
          queryParams.append('enable_transcription', 'true');
        }
        
        const wsUrl = `${baseUrl}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        
        console.log(`Connecting to WebSocket at: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer'; // Changed to arraybuffer for audio data

        this.ws.onopen = () => {
          console.log('WebSocket connection established');
          this.connected = true;
          this.status = 'connected';
          this.events.emit('statusChange', 'connected');
          this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          
          // No need to send separate initialization for Gemini - the query params handle this
          resolve(true);
        };

        this.ws.onmessage = this.handleMessage.bind(this);

        this.ws.onclose = (event) => {
          this.connected = false;
          this.status = 'disconnected';
          this.events.emit('statusChange', 'disconnected');
          this.events.emit('close', event);
          
          // Attempt to reconnect if closure wasn't intentional
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            // Exponential backoff
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            setTimeout(() => {
              this.connect(sessionData).catch(console.error);
            }, delay);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.status = 'error';
          this.events.emit('statusChange', 'error');
          this.events.emit('error', error);
          reject(error);
        };
      } catch (error) {
        console.error('Failed to initialize WebSocket session:', error);
        this.status = 'error';
        this.events.emit('statusChange', 'error');
        reject(error);
      }
    });
  }

  // Handle incoming WebSocket messages
  async handleMessage(event) {
    try {
      if (event.data instanceof ArrayBuffer) {
        // Handle binary audio data from Gemini
        this.events.emit('binaryData', event.data);
        this.playAudio(event.data);
        return;
      }

      const response = JSON.parse(event.data);
      console.log('Received message:', response.type);
      
      // Emit the message for all listeners
      this.events.emit('message', response);
      
      // Handle specific message types
      switch (response.type) {
        case 'audio':
          this.handleAudioMessage(response);
          break;
        case 'text':
          this.events.emit('text', response.content);
          break;
        case 'input_transcription':
          this.events.emit('inputTranscription', response.content);
          break;
        case 'output_transcription':
          this.events.emit('outputTranscription', response.content);
          break;
        case 'error':
          this.events.emit('apiError', response.content);
          break;
      }
      
      // Call specific handler if registered
      const handler = this.messageHandlers[response.type];
      if (handler) {
        handler(response);
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  }

  // Handle audio messages with base64 encoded data
  handleAudioMessage(message) {
    try {
      if (!message.data) {
        console.error('Audio message missing data');
        return;
      }
      
      // Decode base64 audio data
      const binaryString = atob(message.data);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Emit the decoded audio data
      this.events.emit('audio', bytes.buffer);
      
      // Play the audio
      this.playAudio(bytes.buffer, message.sampleRate || 24000);
    } catch (error) {
      console.error('Error handling audio message:', error);
    }
  }

  // Play audio data
  async playAudio(audioData, sampleRate = 24000) {
    try {
      if (!this.audioContext) {
        // Create AudioContext on first audio playback (to avoid autoplay policy issues)
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // For raw PCM data (like what Gemini sends)
      const audioBuffer = this.audioContext.createBuffer(1, audioData.byteLength / 2, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(audioData);
      
      // Convert Int16 audio samples to Float32 for Web Audio API
      for (let i = 0; i < audioData.byteLength / 2; i++) {
        const int16Sample = dataView.getInt16(i * 2, true); // true for little-endian
        channelData[i] = int16Sample / 32768.0; // Convert to float in [-1, 1] range
      }
      
      // Create and play the audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      
      this.events.emit('audioPlaying');
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  // Send a text message through the WebSocket
  sendTextMessage(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }
    
    const message = {
      type: 'text',
      content: text
    };
    
    this.ws.send(JSON.stringify(message));
    this.events.emit('messageSent', message);
    return true;
  }

  // Send binary audio data through the WebSocket
  sendAudioData(audioData) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }
    
    // For binary mode
    if (audioData instanceof ArrayBuffer) {
      this.ws.send(audioData);
      return true;
    }
    
    // For JSON mode with base64
    if (typeof audioData === 'string') {
      const message = {
        type: 'audio',
        data: audioData,
        mime_type: 'audio/pcm;rate=16000'
      };
      this.ws.send(JSON.stringify(message));
      return true;
    }
    
    console.error('Invalid audio data format');
    return false;
  }

  // Send a screen capture image
  sendScreenCapture(imageData) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }
    
    // If imageData is a data URL, extract the base64 part
    let base64Data = imageData;
    if (imageData.startsWith('data:image')) {
      base64Data = imageData.split(',')[1];
    }
    
    const message = {
      type: 'screen',
      data: base64Data
    };
    
    this.ws.send(JSON.stringify(message));
    this.events.emit('screenCaptureSent');
    return true;
  }

  // End the conversation with Gemini
  endConversation() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }
    
    const message = {
      type: 'end_conversation'
    };
    
    this.ws.send(JSON.stringify(message));
    return true;
  }

  // Close the WebSocket connection
  disconnect() {
    if (this.ws) {
      // Send end_conversation before closing if connected
      if (this.ws.readyState === WebSocket.OPEN) {
        this.endConversation();
      }
      
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
      this.sessionId = null;
      this.status = 'disconnected';
      this.connected = false;
      
      // Clean up audio context if it exists
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(console.error);
        this.audioContext = null;
      }
      
      this.events.emit('statusChange', 'disconnected');
    }
  }

  // Get the current status
  getStatus() {
    return this.status;
  }

  // Check if connected
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Add event listener
  on(event, callback) {
    this.events.on(event, callback);
    return () => this.events.off(event, callback);
  }

  // Remove event listener
  off(event, callback) {
    this.events.off(event, callback);
  }

  // Remove all listeners for an event
  removeAllListeners(event) {
    this.events.removeAllListeners(event);
  }
}

// Create a singleton instance
const webSocketService = new WebSocketService();
export default webSocketService;