import { CaptureOptions, MessageData, TranscriptionResponse } from '@/types/capture';

export class CaptureClient {
  private stream: MediaStream | null = null;
  private websocket: WebSocket | null = null;
  private readonly websocketUrl: string;
  private isCapturing: boolean = false;
  private frameRate: number;
  private mediaRecorder: MediaRecorder | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private readonly videoQuality: number;
  private readonly audioBitsPerSecond: number;

  constructor(
    websocketUrl: string, 
    options: CaptureOptions = {}
  ) {
    this.websocketUrl = websocketUrl;
    this.frameRate = options.frameRate || 1;
    this.videoQuality = options.videoQuality || 0.7;
    this.audioBitsPerSecond = options.audioBitsPerSecond || 16000;
  }

  // Add this new method to allow using an existing WebSocket
  public setWebSocket(socket: WebSocket): void {
    this.websocket = socket;
  }

  public async startCapture(): Promise<void> {
    try {
      // Request screen capture with audio
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: { ideal: this.frameRate }
        },
        audio: true
      });

      await Promise.all([
        this.setupVideoProcessing(),
        this.setupAudioProcessing()
      ]);

      // Modified to avoid creating new WebSocket if one is provided
      if (!this.websocket) {
        this.connectWebSocket();
      }
      
      this.isCapturing = true;
      this.captureFrame();

    } catch (err) {
      console.error("Error starting capture:", err);
      throw err;
    }
  }

  private setupVideoProcessing(): void {
    this.canvas = document.createElement('canvas');
    const track = this.stream?.getVideoTracks()[0];
    
    if (!track) {
      throw new Error('No video track available');
    }

    const settings = track.getSettings();
    if (!settings.width || !settings.height) {
      throw new Error('Could not get video track settings');
    }

    this.canvas.width = settings.width;
    this.canvas.height = settings.height;
    this.ctx = this.canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Could not get canvas context');
    }

    this.video = document.createElement('video');
    this.video.srcObject = this.stream;
    this.video.play().catch(err => {
      console.error('Error playing video:', err);
    });
  }

  private async setupAudioProcessing(): Promise<void> {
    if (!this.stream) {
      throw new Error('No media stream available');
    }

    const audioTrack = this.stream.getAudioTracks()[0];
    if (!audioTrack) {
      console.warn("No audio track available");
      return;
    }

    const audioStream = new MediaStream([audioTrack]);
    this.mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: this.audioBitsPerSecond
    });

    this.mediaRecorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size > 0) {
        await this.sendAudioData(event.data);
      }
    };

    this.mediaRecorder.start(1000); // Capture in 1-second chunks
  }

  private async sendAudioData(blob: Blob): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const base64Data = await this.blobToBase64(blob);
    const audioData = {
      realtime_input: {
        media_chunks: [{
          type: 'audio',
          mime_type: 'audio/webm;codecs=opus',
          data: base64Data
        }]
      }
    };

    this.websocket.send(JSON.stringify(audioData));
  }

  // Modified connectWebSocket method
  private connectWebSocket(): void {
    if (!this.websocket) {
      this.websocket = new WebSocket(this.websocketUrl);
      
      this.websocket.onopen = () => {
        console.log("WebSocket connected");
        // Send initial config if needed
        const config = {
          setup: {
            response_modalities: ["AUDIO", "TEXT"]
          }
        };
        this.websocket?.send(JSON.stringify(config));
      };

      this.websocket.onclose = () => {
        console.log("WebSocket disconnected");
        if (this.isCapturing) {
          setTimeout(() => this.connectWebSocket(), 1000);
        }
      };

      this.websocket.onerror = (error: Event) => {
        console.error("WebSocket error:", error);
      };
    }
  }

  private async captureFrame(): Promise<void> {
    if (!this.isCapturing || !this.ctx || !this.video || !this.canvas) {
      return;
    }

    try {
      this.ctx.drawImage(this.video, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        this.canvas?.toBlob(
          (b) => resolve(b as Blob), 
          'image/jpeg', 
          this.videoQuality
        );
      });

      if (this.websocket?.readyState === WebSocket.OPEN) {
        const base64Data = await this.blobToBase64(blob);
        const frameData = {
          realtime_input: {
            media_chunks: [{
              type: 'image',
              mime_type: 'image/jpeg',
              data: base64Data
            }]
          }
        };
        this.websocket.send(JSON.stringify(frameData));
      }

      setTimeout(() => this.captureFrame(), 1000 / this.frameRate);
    } catch (err) {
      console.error("Error capturing frame:", err);
      this.stopCapture();
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public stopCapture(): void {
    this.isCapturing = false;
    
    this.stream?.getTracks().forEach(track => track.stop());
    this.mediaRecorder?.stop();
    // Don't close the WebSocket since it's shared
    // this.websocket?.close();
    
    this.stream = null;
    // Don't null out the websocket since it's shared
    // this.websocket = null;
    this.mediaRecorder = null;
    this.video = null;
    this.canvas = null;
    this.ctx = null;
  }

  public getStatus(): { isCapturing: boolean } {
    return {
      isCapturing: this.isCapturing
    };
  }
}

export function createCaptureClient(websocketUrl: string, options?: CaptureOptions): CaptureClient {
  return new CaptureClient(websocketUrl, options);
}