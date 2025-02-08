export interface Subskill {
    id: string;
    description: string;
    difficultyRange: {
      start: number;
      end: number;
      target: number;
    };
  }
  
  export interface Skill {
    description: string;
    subskills: Subskill[];
  }
  
  export interface Unit {
    id: string;
    title: string;
    skills: Record<string, Skill>;
  }
  
  export interface Syllabus {
    [subject: string]: Record<string, Unit>;
  }
  
  export interface Message {
    role: 'user' | 'system' | 'assistant';
    content: string;
  }
  
  export interface SessionState {
    sessionId: string | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    competencyScore: number | null;
  }