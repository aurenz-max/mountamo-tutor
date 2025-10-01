// src/lib/audio-api.ts

export type AudioMessageType = 
  | 'start_transcription'
  | 'start_conversation'
  | 'audio_data'
  | 'text_input'
  | 'generate_speech'
  | 'close';

export type AudioMessage = {
  type: AudioMessageType;
  session_id?: string;
  content?: string;
  voice?: string;
  text?: string;
};

export type AudioCallback = {
  onTranscription?: (text: string) => void;
  onAudioResponse?: (audio: Blob) => void;
  onError?: (error: string) => void;
};

export class AudioAPI {
  private ws: WebSocket | null = null;
  private feature: string;

  constructor(feature: string = 'default') {
    this.feature = feature;
  }

  private setupWebSocket(callbacks: AudioCallback): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      const ws = new WebSocket(`${wsBaseUrl}/api/audio/ws/audio/${this.feature}`);

      ws.onopen = () => {
        console.log('WebSocket connection established');
        this.ws = ws;
        resolve(ws);
      };

      ws.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob) {
            // Handle audio data
            if (callbacks.onAudioResponse) {
              callbacks.onAudioResponse(event.data);
            }
          } else {
            // Handle text/JSON messages
            const data = JSON.parse(event.data);
            if (data.type === 'transcription' && callbacks.onTranscription) {
              callbacks.onTranscription(data.text);
            } else if (data.type === 'error' && callbacks.onError) {
              callbacks.onError(data.message);
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          callbacks.onError?.('Error processing message');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        callbacks.onError?.('WebSocket error occurred');
        reject(error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.ws = null;
      };
    });
  }

  async startTranscription(callbacks: AudioCallback): Promise<void> {
    const ws = await this.setupWebSocket(callbacks);
    await this.sendMessage(ws, { type: 'start_transcription' });
  }

  async startConversation(callbacks: AudioCallback): Promise<void> {
    const ws = await this.setupWebSocket(callbacks);
    await this.sendMessage(ws, { type: 'start_conversation' });
  }

  async sendAudio(audioData: Blob): Promise<void> {
    if (!this.ws) throw new Error('WebSocket not connected');
    
    // Convert Blob to ArrayBuffer for sending
    const arrayBuffer = await audioData.arrayBuffer();
    this.ws.send(arrayBuffer);
  }

  async sendText(text: string): Promise<void> {
    if (!this.ws) throw new Error('WebSocket not connected');
    
    await this.sendMessage(this.ws, {
      type: 'text_input',
      content: text
    });
  }

  async generateSpeech(text: string, voice?: string): Promise<Blob> {
    if (!this.ws) throw new Error('WebSocket not connected');
    
    return new Promise((resolve, reject) => {
      const onMessage = async (event: MessageEvent) => {
        if (event.data instanceof Blob) {
          this.ws?.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      
      this.ws.addEventListener('message', onMessage);
      
      this.sendMessage(this.ws, {
        type: 'generate_speech',
        text,
        voice
      }).catch(reject);
    });
  }

  private async sendMessage(ws: WebSocket, message: AudioMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        ws.send(JSON.stringify(message));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async close(): Promise<void> {
    if (!this.ws) return;

    await this.sendMessage(this.ws, { type: 'close' });
    this.ws.close();
    this.ws = null;
  }
}

// Usage example:
/*
const audioApi = new AudioAPI('tutoring');

// For transcription:
await audioApi.startTranscription({
  onTranscription: (text) => console.log('Transcribed:', text),
  onError: (error) => console.error('Error:', error)
});

// For conversation:
await audioApi.startConversation({
  onTranscription: (text) => console.log('Response:', text),
  onAudioResponse: async (audioBlob) => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    await audio.play();
  },
  onError: (error) => console.error('Error:', error)
});

// Send audio data:
const audioBlob = await getAudioFromMicrophone();
await audioApi.sendAudio(audioBlob);

// Send text:
await audioApi.sendText("Hello, how are you?");

// Generate speech:
const audioBlob = await audioApi.generateSpeech("Hello world", "en-US-Standard-C");
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
await audio.play();

// Close connection:
await audioApi.close();
*/