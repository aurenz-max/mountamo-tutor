// components/gemini-tutor/types.ts

export interface CurriculumSelection {
    subject: string;
    domain?: {
      id: string;
      title: string;
    };
    skill?: {
      id: string;
      description: string;
    };
    subskill?: {
      id: string;
      description: string;
      difficulty_range?: {
        start: number;
        end: number;
        target: number;
      };
    };
  }
  
  export interface SessionState {
    isConnected: boolean;
    isConnecting: boolean;
    isResponding: boolean;
    isListening: boolean;
    isScreenSharing: boolean;
    connectionError: string | null;
  }