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
