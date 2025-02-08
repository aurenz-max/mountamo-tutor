// src/lib/TutoringWebSocket.ts

export class TutoringWebSocket {
    private ws: WebSocket | null = null;
    private sessionId: string | null = null;
    private audioCallback: (audioData: ArrayBuffer) => void;
    private statusCallback: (status: string) => void;
    private errorCallback: (error: string) => void;
  
    constructor(
      private baseUrl: string,
      onAudio: (audioData: ArrayBuffer) => void,
      onStatus: (status: string) => void,
      onError: (error: string) => void
    ) {
      this.audioCallback = onAudio;
      this.statusCallback = onStatus;
      this.errorCallback = onError;
    }
  
    public send(message: any) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.errorCallback('WebSocket not connected');
        return;
      }
  
      // Send the message directly without additional wrapping
      this.ws.send(JSON.stringify(message));
    }
  
    public async connect(config: any): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          this.ws = new WebSocket(this.baseUrl);
  
          this.ws.onopen = () => {
            console.log('WebSocket connected');
            resolve();
          };
  
          this.ws.onmessage = this.handleMessage.bind(this);
          this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.errorCallback('WebSocket connection error');
            reject(error);
          };
          this.ws.onclose = this.handleClose.bind(this);
  
        } catch (error) {
          reject(error);
        }
      });
    }
  
    private handleMessage(event: MessageEvent): void {
      if (event.data instanceof ArrayBuffer) {
        this.audioCallback(event.data);
        return;
      }
  
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'session_started':
            this.sessionId = message.session_id;
            this.statusCallback('Session started');
            break;
          case 'audio_status':
            this.statusCallback(message.status);
            break;
          case 'error':
            this.errorCallback(message.message);
            break;
          default:
            console.log('Received message:', message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    }
  
    private handleClose(event: CloseEvent): void {
      console.log('WebSocket closed:', event.code, event.reason);
      this.errorCallback('Connection closed');
    }
  
    public disconnect(): void {
      if (this.ws) {
        this.ws.close(1000, 'Client disconnecting');
        this.ws = null;
        this.sessionId = null;
      }
    }
  
    public sendAudio(audioData: ArrayBuffer): void {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.errorCallback('WebSocket not connected');
        return;
      }
  
      if (!this.sessionId) {
        this.errorCallback('No active session');
        return;
      }
  
      // Format audio message according to backend requirements
      const message = {
        type: "websocket.receive",
        text: JSON.stringify({
          realtime_input: {
            media_chunks: [{
              mime_type: 'audio/pcm',
              data: this.arrayBufferToBase64(audioData)
            }]
          }
        })
      };
  
      this.send(message);
    }
  
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }
  }