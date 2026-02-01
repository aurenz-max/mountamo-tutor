export type PlanetType = 'star' | 'planet' | 'dwarf-planet';

export interface CelestialBody {
  id: string;
  name: string;
  type: PlanetType;
  color: string;
  radiusKm: number; // Real radius
  distanceAu: number; // Average distance from sun in AU
  orbitalPeriodDays: number;
  rotationPeriodHours: number;
  moons: number;
  description: string;
  textureGradient: string; // CSS gradient for visual
  temperatureC: number;
}

export interface SimulationState {
  timeScale: number; // Multiplier for speed
  selectedBodyId: string | null;
  viewMode: 'schematic' | 'realistic'; // Schematic = easier to see, Realistic = to scale
  showOrbits: boolean;
  paused: boolean;
  date: Date;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}