/**
 * CPK (Corey-Pauling-Koltun) color scheme for molecular visualization
 * Standard colors used in chemistry to represent different elements
 */
export const CPK_COLORS: Record<string, string> = {
  H: '#FFFFFF', // Hydrogen - White
  C: '#909090', // Carbon - Grey (standard is black/grey)
  N: '#3050F8', // Nitrogen - Blue
  O: '#FF0D0D', // Oxygen - Red
  F: '#90E050', // Fluorine - Green
  Cl: '#1FF01F', // Chlorine - Green
  Br: '#A62929', // Bromine - Dark Red
  I: '#940094', // Iodine - Violet
  He: '#FFFFC0', // Helium - Pale Yellow
  Ne: '#B3E3F5', // Neon - Light Blue
  Ar: '#80D1E3', // Argon - Cyan
  Kr: '#5CB8D1', // Krypton - Blue-Cyan
  Xe: '#429EB0', // Xenon - Dark Cyan
  P: '#FF8000', // Phosphorus - Orange
  S: '#FFFF30', // Sulfur - Yellow
  B: '#FFB5B5', // Boron - Pink
  Li: '#CC80FF', // Lithium - Purple
  Na: '#AB5CF2', // Sodium - Purple
  K: '#8F40D4', // Potassium - Purple
  Ca: '#3DFF00', // Calcium - Green
  Fe: '#E06633', // Iron - Orange/Rust
  Cu: '#C88033', // Copper - Bronze
  Zn: '#7D80B0', // Zinc - Blue-Grey
  Au: '#D4AF37', // Gold - Golden
  Ag: '#C0C0C0', // Silver - Silver
  Mg: '#8AFF00', // Magnesium - Bright Green
};

/**
 * Default atomic radii for different elements (in Angstroms)
 * Used for sphere sizing in 3D visualization
 */
export const DEFAULT_RADIUS: Record<string, number> = {
  H: 0.3,   // Hydrogen (smallest)
  C: 0.5,   // Carbon
  N: 0.5,   // Nitrogen
  O: 0.5,   // Oxygen
  S: 0.6,   // Sulfur
  P: 0.6,   // Phosphorus
  Cl: 0.6,  // Chlorine
  Na: 0.7,  // Sodium
  K: 0.8,   // Potassium
  Ca: 0.7,  // Calcium
  Mg: 0.65, // Magnesium
  Fe: 0.6,  // Iron
  Cu: 0.6,  // Copper
  default: 0.5, // Default for unknown elements
};
