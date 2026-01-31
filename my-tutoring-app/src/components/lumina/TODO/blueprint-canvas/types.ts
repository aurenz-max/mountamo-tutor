export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface FurnitureItem {
  id: string;
  name: string;
  type: 'bed' | 'sofa' | 'table' | 'chair' | 'cabinet' | 'toilet' | 'sink' | 'shower' | 'other';
  x: number; // Percentage 0-100 relative to room
  y: number; // Percentage 0-100 relative to room
  width: number; // Percentage 0-100 relative to room
  height: number; // Percentage 0-100 relative to room
  rotation: number; // degrees
}

export interface Room {
  id: string;
  name: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage 0-100
  height: number; // Percentage 0-100
  interior?: FurnitureItem[];
}

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'outer' | 'inner';
}

export interface ElevationFeature {
  type: 'window' | 'door' | 'garage' | 'chimney';
  x: number; // Percentage 0-100 relative to facade width
  y: number; // Percentage 0-100 relative to facade height (from bottom)
  width: number;
  height: number;
}

export interface Roof {
  type: 'gable' | 'flat' | 'shed';
  height: number; // Percentage of total height
}

export interface BuildingData {
  name: string;
  totalWidthMeters: number;
  totalDepthMeters: number;
  totalHeightMeters: number;
  rooms: Room[];
  walls: Wall[];
  elevation: {
    features: ElevationFeature[];
    roof: Roof;
  };
  summary: string;
}