export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Atom {
  id: string;
  element: string; // Symbol, e.g., 'C', 'H'
  name: string; // Full name, e.g., 'Carbon'
  position: Position;
  color?: string; // Hex code override, optional
  radius?: number; // Relative size, optional
  atomicNumber?: number;
  description?: string; // Short fun fact
}

export interface Bond {
  sourceId: string;
  targetId: string;
  order: number; // 1 = single, 2 = double, 3 = triple, 1.5 = resonant/aromatic
  type: 'covalent' | 'ionic' | 'hydrogen' | 'metallic' | 'unknown';
}

export interface MoleculeData {
  name: string;
  description: string;
  atoms: Atom[];
  bonds: Bond[];
  category: 'organic' | 'inorganic' | 'protein' | 'crystal' | 'other';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  moleculeData?: MoleculeData;
}