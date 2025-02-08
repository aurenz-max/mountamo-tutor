export interface CaptureOptions {
    frameRate?: number;
    videoQuality?: number;
    audioBitsPerSecond?: number;
  }
  
  export type MessageData = {
    type: 'video' | 'audio';
    data: string;
  }
  
  export type TranscriptionResponse = {
    type: 'transcription';
    text: string;
  }