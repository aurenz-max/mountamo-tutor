export type ElementCategory =
  | 'diatomic nonmetal'
  | 'noble gas'
  | 'alkali metal'
  | 'alkaline earth metal'
  | 'metalloid'
  | 'polyatomic nonmetal'
  | 'post-transition metal'
  | 'transition metal'
  | 'lanthanide'
  | 'actinide'
  | 'unknown, probably transition metal'
  | 'unknown, probably post-transition metal'
  | 'unknown, probably metalloid'
  | 'unknown, predicted to be noble gas'
  | 'unknown';

export interface ChemicalElement {
  number: number;
  name: string;
  symbol: string;
  atomic_mass: number;
  category: string;
  period: number;
  group: number | null;
  phase: 'Gas' | 'Liquid' | 'Solid';
  electron_configuration: string;
  electron_shells: number[];
  melt?: number | null;
  boil?: number | null;
  density?: number | null;
  summary: string;
  discovered_by?: string;
  xpos: number; // grid column 1-18
  ypos: number; // grid row 1-10
}

export interface StabilityPoint {
  protons: number;
  neutrons: number;
  stable: boolean;
  element?: string;
}
