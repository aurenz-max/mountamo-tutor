export type Point = {
  x: number;
  y: number;
};

export type Stroke = {
  points: Point[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
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
  latex?: string;
  nextSteps?: string[];
}

export type ToolType = 'pen' | 'eraser';

export interface AppState {
  currentColor: string;
  currentWidth: number;
  currentTool: ToolType;
  background: BackgroundType;
  strokes: Stroke[];
  redoStack: Stroke[];
}