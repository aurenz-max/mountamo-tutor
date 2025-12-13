import { ChemicalElement } from './types';

// Helper to determine category color classes using inline styles
export const getCategoryColor = (category: string): string => {
  // We return empty string and use inline styles instead via getCategoryStyle
  return '';
};

// Helper to get inline styles for element categories
export const getCategoryStyle = (category: string) => {
  const hex = getHexColor(category);
  return {
    color: hex,
    borderColor: hex,
    backgroundColor: `${hex}20`, // 20 is ~12% opacity in hex
    boxShadow: `0 0 10px ${hex}33` // 33 is ~20% opacity in hex
  };
};

export const getHexColor = (category: string): string => {
   if (category.includes('alkali') && !category.includes('earth')) return '#ef4444';
   if (category.includes('alkaline earth')) return '#f97316';
   if (category.includes('transition')) return '#eab308';
   if (category.includes('post-transition')) return '#84cc16';
   if (category.includes('metalloid')) return '#10b981';
   if (category.includes('nonmetal')) return '#06b6d4';
   if (category.includes('halogen')) return '#3b82f6';
   if (category.includes('noble')) return '#a855f7';
   if (category.includes('lanthanide')) return '#ec4899';
   if (category.includes('actinide')) return '#f43f5e';
   return '#64748b';
}

// A compressed dataset for the first 118 elements.
// Structure: [AtomicNumber, Symbol, Name, Mass, Category, xpos, ypos, [Shells], Config]
const rawData: any[] = [
  [1, "H", "Hydrogen", 1.008, "diatomic nonmetal", 1, 1, [1], "1s1"],
  [2, "He", "Helium", 4.0026, "noble gas", 18, 1, [2], "1s2"],
  [3, "Li", "Lithium", 6.94, "alkali metal", 1, 2, [2, 1], "[He] 2s1"],
  [4, "Be", "Beryllium", 9.0122, "alkaline earth metal", 2, 2, [2, 2], "[He] 2s2"],
  [5, "B", "Boron", 10.81, "metalloid", 13, 2, [2, 3], "[He] 2s2 2p1"],
  [6, "C", "Carbon", 12.011, "polyatomic nonmetal", 14, 2, [2, 4], "[He] 2s2 2p2"],
  [7, "N", "Nitrogen", 14.007, "diatomic nonmetal", 15, 2, [2, 5], "[He] 2s2 2p3"],
  [8, "O", "Oxygen", 15.999, "diatomic nonmetal", 16, 2, [2, 6], "[He] 2s2 2p4"],
  [9, "F", "Fluorine", 18.998, "diatomic nonmetal", 17, 2, [2, 7], "[He] 2s2 2p5"],
  [10, "Ne", "Neon", 20.180, "noble gas", 18, 2, [2, 8], "[He] 2s2 2p6"],
  [11, "Na", "Sodium", 22.990, "alkali metal", 1, 3, [2, 8, 1], "[Ne] 3s1"],
  [12, "Mg", "Magnesium", 24.305, "alkaline earth metal", 2, 3, [2, 8, 2], "[Ne] 3s2"],
  [13, "Al", "Aluminium", 26.982, "post-transition metal", 13, 3, [2, 8, 3], "[Ne] 3s2 3p1"],
  [14, "Si", "Silicon", 28.085, "metalloid", 14, 3, [2, 8, 4], "[Ne] 3s2 3p2"],
  [15, "P", "Phosphorus", 30.974, "polyatomic nonmetal", 15, 3, [2, 8, 5], "[Ne] 3s2 3p3"],
  [16, "S", "Sulfur", 32.06, "polyatomic nonmetal", 16, 3, [2, 8, 6], "[Ne] 3s2 3p4"],
  [17, "Cl", "Chlorine", 35.45, "diatomic nonmetal", 17, 3, [2, 8, 7], "[Ne] 3s2 3p5"],
  [18, "Ar", "Argon", 39.948, "noble gas", 18, 3, [2, 8, 8], "[Ne] 3s2 3p6"],
  [19, "K", "Potassium", 39.098, "alkali metal", 1, 4, [2, 8, 8, 1], "[Ar] 4s1"],
  [20, "Ca", "Calcium", 40.078, "alkaline earth metal", 2, 4, [2, 8, 8, 2], "[Ar] 4s2"],
  [21, "Sc", "Scandium", 44.956, "transition metal", 3, 4, [2, 8, 9, 2], "[Ar] 3d1 4s2"],
  [22, "Ti", "Titanium", 47.867, "transition metal", 4, 4, [2, 8, 10, 2], "[Ar] 3d2 4s2"],
  [23, "V", "Vanadium", 50.942, "transition metal", 5, 4, [2, 8, 11, 2], "[Ar] 3d3 4s2"],
  [24, "Cr", "Chromium", 51.996, "transition metal", 6, 4, [2, 8, 13, 1], "[Ar] 3d5 4s1"],
  [25, "Mn", "Manganese", 54.938, "transition metal", 7, 4, [2, 8, 13, 2], "[Ar] 3d5 4s2"],
  [26, "Fe", "Iron", 55.845, "transition metal", 8, 4, [2, 8, 14, 2], "[Ar] 3d6 4s2"],
  [27, "Co", "Cobalt", 58.933, "transition metal", 9, 4, [2, 8, 15, 2], "[Ar] 3d7 4s2"],
  [28, "Ni", "Nickel", 58.693, "transition metal", 10, 4, [2, 8, 16, 2], "[Ar] 3d8 4s2"],
  [29, "Cu", "Copper", 63.546, "transition metal", 11, 4, [2, 8, 18, 1], "[Ar] 3d10 4s1"],
  [30, "Zn", "Zinc", 65.38, "transition metal", 12, 4, [2, 8, 18, 2], "[Ar] 3d10 4s2"],
  [31, "Ga", "Gallium", 69.723, "post-transition metal", 13, 4, [2, 8, 18, 3], "[Ar] 3d10 4s2 4p1"],
  [32, "Ge", "Germanium", 72.63, "metalloid", 14, 4, [2, 8, 18, 4], "[Ar] 3d10 4s2 4p2"],
  [33, "As", "Arsenic", 74.922, "metalloid", 15, 4, [2, 8, 18, 5], "[Ar] 3d10 4s2 4p3"],
  [34, "Se", "Selenium", 78.96, "polyatomic nonmetal", 16, 4, [2, 8, 18, 6], "[Ar] 3d10 4s2 4p4"],
  [35, "Br", "Bromine", 79.904, "diatomic nonmetal", 17, 4, [2, 8, 18, 7], "[Ar] 3d10 4s2 4p5"],
  [36, "Kr", "Krypton", 83.798, "noble gas", 18, 4, [2, 8, 18, 8], "[Ar] 3d10 4s2 4p6"],
  [37, "Rb", "Rubidium", 85.468, "alkali metal", 1, 5, [2, 8, 18, 8, 1], "[Kr] 5s1"],
  [38, "Sr", "Strontium", 87.62, "alkaline earth metal", 2, 5, [2, 8, 18, 8, 2], "[Kr] 5s2"],
  [39, "Y", "Yttrium", 88.906, "transition metal", 3, 5, [2, 8, 18, 9, 2], "[Kr] 4d1 5s2"],
  [40, "Zr", "Zirconium", 91.224, "transition metal", 4, 5, [2, 8, 18, 10, 2], "[Kr] 4d2 5s2"],
  [41, "Nb", "Niobium", 92.906, "transition metal", 5, 5, [2, 8, 18, 12, 1], "[Kr] 4d4 5s1"],
  [42, "Mo", "Molybdenum", 95.95, "transition metal", 6, 5, [2, 8, 18, 13, 1], "[Kr] 4d5 5s1"],
  [43, "Tc", "Technetium", 98, "transition metal", 7, 5, [2, 8, 18, 13, 2], "[Kr] 4d5 5s2"],
  [44, "Ru", "Ruthenium", 101.07, "transition metal", 8, 5, [2, 8, 18, 15, 1], "[Kr] 4d7 5s1"],
  [45, "Rh", "Rhodium", 102.91, "transition metal", 9, 5, [2, 8, 18, 16, 1], "[Kr] 4d8 5s1"],
  [46, "Pd", "Palladium", 106.42, "transition metal", 10, 5, [2, 8, 18, 18], "[Kr] 4d10"],
  [47, "Ag", "Silver", 107.87, "transition metal", 11, 5, [2, 8, 18, 18, 1], "[Kr] 4d10 5s1"],
  [48, "Cd", "Cadmium", 112.41, "transition metal", 12, 5, [2, 8, 18, 18, 2], "[Kr] 4d10 5s2"],
  [49, "In", "Indium", 114.82, "post-transition metal", 13, 5, [2, 8, 18, 18, 3], "[Kr] 4d10 5s2 5p1"],
  [50, "Sn", "Tin", 118.71, "post-transition metal", 14, 5, [2, 8, 18, 18, 4], "[Kr] 4d10 5s2 5p2"],
  [51, "Sb", "Antimony", 121.76, "metalloid", 15, 5, [2, 8, 18, 18, 5], "[Kr] 4d10 5s2 5p3"],
  [52, "Te", "Tellurium", 127.60, "metalloid", 16, 5, [2, 8, 18, 18, 6], "[Kr] 4d10 5s2 5p4"],
  [53, "I", "Iodine", 126.90, "diatomic nonmetal", 17, 5, [2, 8, 18, 18, 7], "[Kr] 4d10 5s2 5p5"],
  [54, "Xe", "Xenon", 131.29, "noble gas", 18, 5, [2, 8, 18, 18, 8], "[Kr] 4d10 5s2 5p6"],
  [55, "Cs", "Cesium", 132.91, "alkali metal", 1, 6, [2, 8, 18, 18, 8, 1], "[Xe] 6s1"],
  [56, "Ba", "Barium", 137.33, "alkaline earth metal", 2, 6, [2, 8, 18, 18, 8, 2], "[Xe] 6s2"],
  // Lanthanides (57-71) - mapped to row 9 (visual trick)
  [57, "La", "Lanthanum", 138.91, "lanthanide", 4, 9, [2, 8, 18, 18, 9, 2], "[Xe] 5d1 6s2"],
  [58, "Ce", "Cerium", 140.12, "lanthanide", 5, 9, [2, 8, 18, 19, 9, 2], "[Xe] 4f1 5d1 6s2"],
  [59, "Pr", "Praseodymium", 140.91, "lanthanide", 6, 9, [2, 8, 18, 21, 8, 2], "[Xe] 4f3 6s2"],
  [60, "Nd", "Neodymium", 144.24, "lanthanide", 7, 9, [2, 8, 18, 22, 8, 2], "[Xe] 4f4 6s2"],
  [61, "Pm", "Promethium", 145, "lanthanide", 8, 9, [2, 8, 18, 23, 8, 2], "[Xe] 4f5 6s2"],
  [62, "Sm", "Samarium", 150.36, "lanthanide", 9, 9, [2, 8, 18, 24, 8, 2], "[Xe] 4f6 6s2"],
  [63, "Eu", "Europium", 151.96, "lanthanide", 10, 9, [2, 8, 18, 25, 8, 2], "[Xe] 4f7 6s2"],
  [64, "Gd", "Gadolinium", 157.25, "lanthanide", 11, 9, [2, 8, 18, 25, 9, 2], "[Xe] 4f7 5d1 6s2"],
  [65, "Tb", "Terbium", 158.93, "lanthanide", 12, 9, [2, 8, 18, 27, 8, 2], "[Xe] 4f9 6s2"],
  [66, "Dy", "Dysprosium", 162.50, "lanthanide", 13, 9, [2, 8, 18, 28, 8, 2], "[Xe] 4f10 6s2"],
  [67, "Ho", "Holmium", 164.93, "lanthanide", 14, 9, [2, 8, 18, 29, 8, 2], "[Xe] 4f11 6s2"],
  [68, "Er", "Erbium", 167.26, "lanthanide", 15, 9, [2, 8, 18, 30, 8, 2], "[Xe] 4f12 6s2"],
  [69, "Tm", "Thulium", 168.93, "lanthanide", 16, 9, [2, 8, 18, 31, 8, 2], "[Xe] 4f13 6s2"],
  [70, "Yb", "Ytterbium", 173.05, "lanthanide", 17, 9, [2, 8, 18, 32, 8, 2], "[Xe] 4f14 6s2"],
  [71, "Lu", "Lutetium", 174.97, "lanthanide", 18, 9, [2, 8, 18, 32, 9, 2], "[Xe] 4f14 5d1 6s2"],
  // Back to main block
  [72, "Hf", "Hafnium", 178.49, "transition metal", 4, 6, [2, 8, 18, 32, 10, 2], "[Xe] 4f14 5d2 6s2"],
  [73, "Ta", "Tantalum", 180.95, "transition metal", 5, 6, [2, 8, 18, 32, 11, 2], "[Xe] 4f14 5d3 6s2"],
  [74, "W", "Tungsten", 183.84, "transition metal", 6, 6, [2, 8, 18, 32, 12, 2], "[Xe] 4f14 5d4 6s2"],
  [75, "Re", "Rhenium", 186.21, "transition metal", 7, 6, [2, 8, 18, 32, 13, 2], "[Xe] 4f14 5d5 6s2"],
  [76, "Os", "Osmium", 190.23, "transition metal", 8, 6, [2, 8, 18, 32, 14, 2], "[Xe] 4f14 5d6 6s2"],
  [77, "Ir", "Iridium", 192.22, "transition metal", 9, 6, [2, 8, 18, 32, 15, 2], "[Xe] 4f14 5d7 6s2"],
  [78, "Pt", "Platinum", 195.08, "transition metal", 10, 6, [2, 8, 18, 32, 17, 1], "[Xe] 4f14 5d9 6s1"],
  [79, "Au", "Gold", 196.97, "transition metal", 11, 6, [2, 8, 18, 32, 18, 1], "[Xe] 4f14 5d10 6s1"],
  [80, "Hg", "Mercury", 200.59, "transition metal", 12, 6, [2, 8, 18, 32, 18, 2], "[Xe] 4f14 5d10 6s2"],
  [81, "Tl", "Thallium", 204.38, "post-transition metal", 13, 6, [2, 8, 18, 32, 18, 3], "[Xe] 4f14 5d10 6s2 6p1"],
  [82, "Pb", "Lead", 207.2, "post-transition metal", 14, 6, [2, 8, 18, 32, 18, 4], "[Xe] 4f14 5d10 6s2 6p2"],
  [83, "Bi", "Bismuth", 208.98, "post-transition metal", 15, 6, [2, 8, 18, 32, 18, 5], "[Xe] 4f14 5d10 6s2 6p3"],
  [84, "Po", "Polonium", 209, "metalloid", 16, 6, [2, 8, 18, 32, 18, 6], "[Xe] 4f14 5d10 6s2 6p4"],
  [85, "At", "Astatine", 210, "metalloid", 17, 6, [2, 8, 18, 32, 18, 7], "[Xe] 4f14 5d10 6s2 6p5"],
  [86, "Rn", "Radon", 222, "noble gas", 18, 6, [2, 8, 18, 32, 18, 8], "[Xe] 4f14 5d10 6s2 6p6"],
  [87, "Fr", "Francium", 223, "alkali metal", 1, 7, [2, 8, 18, 32, 18, 8, 1], "[Rn] 7s1"],
  [88, "Ra", "Radium", 226, "alkaline earth metal", 2, 7, [2, 8, 18, 32, 18, 8, 2], "[Rn] 7s2"],
  // Actinides (89-103) - mapped to row 10
  [89, "Ac", "Actinium", 227, "actinide", 4, 10, [2, 8, 18, 32, 18, 9, 2], "[Rn] 6d1 7s2"],
  [90, "Th", "Thorium", 232.04, "actinide", 5, 10, [2, 8, 18, 32, 18, 10, 2], "[Rn] 6d2 7s2"],
  [91, "Pa", "Protactinium", 231.04, "actinide", 6, 10, [2, 8, 18, 32, 20, 9, 2], "[Rn] 5f2 6d1 7s2"],
  [92, "U", "Uranium", 238.03, "actinide", 7, 10, [2, 8, 18, 32, 21, 9, 2], "[Rn] 5f3 6d1 7s2"],
  [93, "Np", "Neptunium", 237, "actinide", 8, 10, [2, 8, 18, 32, 22, 9, 2], "[Rn] 5f4 6d1 7s2"],
  [94, "Pu", "Plutonium", 244, "actinide", 9, 10, [2, 8, 18, 32, 24, 8, 2], "[Rn] 5f6 7s2"],
  [95, "Am", "Americium", 243, "actinide", 10, 10, [2, 8, 18, 32, 25, 8, 2], "[Rn] 5f7 7s2"],
  [96, "Cm", "Curium", 247, "actinide", 11, 10, [2, 8, 18, 32, 25, 9, 2], "[Rn] 5f7 6d1 7s2"],
  [97, "Bk", "Berkelium", 247, "actinide", 12, 10, [2, 8, 18, 32, 27, 8, 2], "[Rn] 5f9 7s2"],
  [98, "Cf", "Californium", 251, "actinide", 13, 10, [2, 8, 18, 32, 28, 8, 2], "[Rn] 5f10 7s2"],
  [99, "Es", "Einsteinium", 252, "actinide", 14, 10, [2, 8, 18, 32, 29, 8, 2], "[Rn] 5f11 7s2"],
  [100, "Fm", "Fermium", 257, "actinide", 15, 10, [2, 8, 18, 32, 30, 8, 2], "[Rn] 5f12 7s2"],
  [101, "Md", "Mendelevium", 258, "actinide", 16, 10, [2, 8, 18, 32, 31, 8, 2], "[Rn] 5f13 7s2"],
  [102, "No", "Nobelium", 259, "actinide", 17, 10, [2, 8, 18, 32, 32, 8, 2], "[Rn] 5f14 7s2"],
  [103, "Lr", "Lawrencium", 262, "actinide", 18, 10, [2, 8, 18, 32, 32, 9, 2], "[Rn] 5f14 7s2 7p1"],
  // Superheavies
  [104, "Rf", "Rutherfordium", 267, "transition metal", 4, 7, [2, 8, 18, 32, 32, 10, 2], "[Rn] 5f14 6d2 7s2"],
  [105, "Db", "Dubnium", 268, "transition metal", 5, 7, [2, 8, 18, 32, 32, 11, 2], "[Rn] 5f14 6d3 7s2"],
  [106, "Sg", "Seaborgium", 269, "transition metal", 6, 7, [2, 8, 18, 32, 32, 12, 2], "[Rn] 5f14 6d4 7s2"],
  [107, "Bh", "Bohrium", 270, "transition metal", 7, 7, [2, 8, 18, 32, 32, 13, 2], "[Rn] 5f14 6d5 7s2"],
  [108, "Hs", "Hassium", 277, "transition metal", 8, 7, [2, 8, 18, 32, 32, 14, 2], "[Rn] 5f14 6d6 7s2"],
  [109, "Mt", "Meitnerium", 278, "unknown, probably transition metal", 9, 7, [2, 8, 18, 32, 32, 15, 2], "[Rn] 5f14 6d7 7s2"],
  [110, "Ds", "Darmstadtium", 281, "unknown, probably transition metal", 10, 7, [2, 8, 18, 32, 32, 16, 2], "[Rn] 5f14 6d8 7s2"],
  [111, "Rg", "Roentgenium", 282, "unknown, probably transition metal", 11, 7, [2, 8, 18, 32, 32, 17, 2], "[Rn] 5f14 6d9 7s2"],
  [112, "Cn", "Copernicium", 285, "transition metal", 12, 7, [2, 8, 18, 32, 32, 18, 2], "[Rn] 5f14 6d10 7s2"],
  [113, "Nh", "Nihonium", 286, "unknown, probably post-transition metal", 13, 7, [2, 8, 18, 32, 32, 18, 3], "[Rn] 5f14 6d10 7s2 7p1"],
  [114, "Fl", "Flerovium", 289, "unknown, probably post-transition metal", 14, 7, [2, 8, 18, 32, 32, 18, 4], "[Rn] 5f14 6d10 7s2 7p2"],
  [115, "Mc", "Moscovium", 290, "unknown, probably post-transition metal", 15, 7, [2, 8, 18, 32, 32, 18, 5], "[Rn] 5f14 6d10 7s2 7p3"],
  [116, "Lv", "Livermorium", 293, "unknown, probably post-transition metal", 16, 7, [2, 8, 18, 32, 32, 18, 6], "[Rn] 5f14 6d10 7s2 7p4"],
  [117, "Ts", "Tennessine", 294, "unknown, probably metalloid", 17, 7, [2, 8, 18, 32, 32, 18, 7], "[Rn] 5f14 6d10 7s2 7p5"],
  [118, "Og", "Oganesson", 294, "unknown, predicted to be noble gas", 18, 7, [2, 8, 18, 32, 32, 18, 8], "[Rn] 5f14 6d10 7s2 7p6"]
];

export const ELEMENTS: ChemicalElement[] = rawData.map(d => ({
  number: d[0],
  symbol: d[1],
  name: d[2],
  atomic_mass: d[3],
  category: d[4],
  xpos: d[5],
  ypos: d[6],
  electron_shells: d[7],
  electron_configuration: d[8],
  period: d[6] > 7 ? (d[6] === 9 ? 6 : 7) : d[6], // Simplified logic for lanthanides/actinides
  group: d[5],
  phase: d[5] === 18 ? 'Gas' : 'Solid', // Rough approx for demo
  summary: `Element ${d[2]} (${d[1]}) is a chemical element with atomic number ${d[0]}.`
}));
