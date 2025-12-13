export interface LessonSegment {
  title: string;
  script: string;
  imagePrompt: string;
}

export interface GeneratedAsset {
  audioBuffer: AudioBuffer | null;
  imageUrl: string | null;
}

export interface FullLessonSegment extends LessonSegment, GeneratedAsset {}

export enum AppState {
  IDLE = 'IDLE',
  GENERATING_PLAN = 'GENERATING_PLAN',
  GENERATING_ASSETS = 'GENERATING_ASSETS',
  READY = 'READY',
  ERROR = 'ERROR'
}

export type ImageResolution = '1K' | '2K' | '4K';

export interface GlobalState {
  appState: AppState;
  topic: string;
  segments: FullLessonSegment[];
  currentSegmentIndex: number;
  imageResolution: ImageResolution;
  error?: string;
}

// Extend Window interface for the AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    webkitAudioContext: typeof AudioContext;
  }
}