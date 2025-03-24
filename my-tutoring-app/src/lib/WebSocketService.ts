// lib/WebSocketService.js
import { EventEmitter } from 'events';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.status = 'disconnected';
    this.events = new EventEmitter();
    this.messageHandlers = {};
    this.connected = false;
  }

  // Register a message handler for a specific message type
  registerHandler(messageType, handler) {
    this.messageHandlers[messageType] = handler;
    return () => {
      delete this.messageHandlers[messageType];
    };
  }

  // Initialize the WebSocket connection with session data
  async connect(sessionData) {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws && this.connected) {
          console.log('WebSocket already connected');
          resolve(this.sessionId);
          return;
        }

        this.status = 'connecting';
        this.events.emit('statusChange', 'connecting');

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/tutoring/session';
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'blob';

        this.ws.onopen = () => {
          console.log('WebSocket connection established');
          
          // Send initialization data
          this.ws.send(JSON.stringify({
            text: "InitSession",
            data: sessionData
          }));
        };

        this.ws.onmessage = this.handleMessage.bind(this);

        this.ws.onclose = () => {
          this.connected = false;
          this.sessionId = null;
          this.status = 'disconnected';
          this.events.emit('statusChange', 'disconnected');
          this.events.emit('close');
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
    if (event.data instanceof Blob) {
      // Handle binary data
      this.events.emit('binaryData', event.data);
      return;
    }

    try {
      const response = JSON.parse(event.data);
      
      // Handle session initialization
      if (response.type === 'session_started') {
        this.sessionId = response.session_id;
        this.status = 'connected';
        this.connected = true;
        this.events.emit('statusChange', 'connected');
        this.events.emit('sessionStarted', this.sessionId);
      }
      
      // Emit the message for all registered handlers
      this.events.emit('message', response);
      
      // Call specific handler if registered
      const handler = this.messageHandlers[response.type];
      if (handler) {
        handler(response);
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  }

  // Send a message through the WebSocket
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }
    
    this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
    return true;
  }

  // Send a read-along request
  sendReadAlongRequest(options = {}) {
    return this.send({
      type: 'read_along_request',
      complexity_level: options.complexity_level || 1,
      theme: options.theme || null,
      with_image: options.with_image !== false
    });
  }
  
  // Helper method to handle read-along responses
  _handleReadAlongResponse(response) {
    // Route read-along responses to handlers
    if (response.type === 'read_along') {
      const handler = this.messageHandlers['read_along'];
      if (handler) {
        handler(response);
      }
      return true;
    }
    return false;
  }

  // Close the WebSocket connection
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.sessionId = null;
      this.status = 'disconnected';
    }
  }

  // Get the current status
  getStatus() {
    return this.status;
  }

  // Get the current session ID
  getSessionId() {
    return this.sessionId;
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
}

// Create a singleton instance
const webSocketService = new WebSocketService();
export default webSocketService;