export type Point = {
  x: number;
  y: number;
};

export type Stroke = {
  points: Point[];
  color: string;
  width: number;
  tool: ToolType;
};

export enum BackgroundType {
  NONE = 'none',
  GRID = 'grid',
  LINED = 'lined',
  DOTTED = 'dotted',
}

export interface AIAnalysisResult {
  summary: string;
  feedback: string;
  latex?: string | null;
  nextSteps?: string[];
  encouragement?: string;
}

export type ToolType = 'pen' | 'eraser' | 'highlighter';

export interface ScratchPadState {
  currentColor: string;
  currentWidth: number;
  currentTool: ToolType;
  background: BackgroundType;
  strokes: Stroke[];
  redoStack: Stroke[];
}

export interface ScratchPadProps {
  onBack?: () => void;
  initialTopic?: string;
  gradeLevel?: string;
}

// Primitive integration types
export type PrimitiveViewMode = 'hidden' | 'split';

export interface DetectedTopic {
  subject: 'mathematics' | 'language-arts' | 'science' | 'general';
  concept: string;
  gradeEstimate: string;
  confidence: number;
}

export interface PrimitiveSuggestion {
  id: string;
  componentId: string;
  icon: string;
  displayName: string;
  purpose: string;
  relevanceScore: number;
  generationConfig: {
    topic: string;
    gradeLevel: string;
    specificContext?: string;
  };
}

export interface GeneratedPrimitive {
  id: string;
  componentId: string;
  data: unknown;
  generatedAt: Date;
}

export interface EnhancedAIAnalysisResult extends AIAnalysisResult {
  detectedTopic?: DetectedTopic;
  suggestedPrimitives: PrimitiveSuggestion[];
  shouldSuggestPrimitives: boolean;
  suggestionReason?: string;
}
