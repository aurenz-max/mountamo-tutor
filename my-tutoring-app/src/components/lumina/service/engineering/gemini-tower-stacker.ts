import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  TowerStackerData,
  AvailablePiece,
} from '../../primitives/visual-primitives/engineering/TowerStacker';

// Re-export for convenience if needed elsewhere
export type { TowerStackerData, AvailablePiece };

/**
 * Schema for Available Piece
 */
const availablePieceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["block", "beam", "triangle", "arch"],
      description: "Type of building piece. Block is standard, beam is wide/thin, triangle is triangular, arch is curved."
    },
    count: {
      type: Type.NUMBER,
      description: "Number of pieces available. Use 5-10 for simple builds, 10-20 for complex."
    },
    width: {
      type: Type.NUMBER,
      description: "Width in grid units (1-4). Blocks: 1-2, Beams: 2-4, Triangles: 2-3, Arches: 2-3."
    },
    height: {
      type: Type.NUMBER,
      description: "Height in grid units (1-2). Blocks: 1-2, Beams: 1, Triangles: 2, Arches: 1-2."
    },
    weight: {
      type: Type.NUMBER,
      description: "Relative weight (1-10). Affects stability - heavier pieces at base are better."
    },
    color: {
      type: Type.STRING,
      description: "Hex color code for the piece (e.g., '#EF4444' for red, '#3B82F6' for blue)."
    },
    icon: {
      type: Type.STRING,
      description: "Emoji icon for this piece type. Blocks: '🧱', Beams: '📏', Triangles: '🔺', Arches: '🌉'",
      nullable: true
    }
  },
  required: ["type", "count", "width", "height", "weight", "color"]
};

/**
 * Schema for Tower Stacker Data
 */
const towerStackerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the tower building activity (e.g., 'Build the Tallest Tower!', 'Skyscraper Challenge')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the challenge and what students will learn. Use age-appropriate language."
    },
    availablePieces: {
      type: Type.ARRAY,
      items: availablePieceSchema,
      description: "Array of available building pieces. Include 3-5 different types with varying sizes and weights."
    },
    targetHeight: {
      type: Type.NUMBER,
      description: "Goal height to reach in grid units. K-1: 4-6, grades 1-2: 6-8, grades 2-3: 8-10, grades 3-4: 10-12, grades 4-5: 12-15."
    },
    gridMode: {
      type: Type.BOOLEAN,
      description: "Snap pieces to grid (true) or allow freeform placement (false). True for K-3, false for 4-5."
    },
    enableWind: {
      type: Type.BOOLEAN,
      description: "Include wind test feature. False for K-1, true for grades 2+."
    },
    windStrength: {
      type: Type.NUMBER,
      description: "Force of wind test (0-100). K-1: 0 (disabled), grades 2-3: 30-50, grades 3-4: 50-70, grades 4-5: 70-100."
    },
    showCenterOfGravity: {
      type: Type.BOOLEAN,
      description: "Display center of gravity indicator. False for K-1, true for grades 2+."
    },
    showHeight: {
      type: Type.BOOLEAN,
      description: "Display height measurement. Always true."
    },
    groundWidth: {
      type: Type.NUMBER,
      description: "Available foundation space in grid units (6-12). Wider = easier. K-1: 10-12, grades 2-3: 8-10, grades 4-5: 6-8."
    },
    maxHeight: {
      type: Type.NUMBER,
      description: "Maximum build height in grid units (10-20). Should be higher than targetHeight."
    },
    theme: {
      type: Type.STRING,
      enum: ["construction", "blocks", "city", "generic"],
      description: "Visual theme. 'blocks' for K-1 (colorful), 'construction' for 2-3 (realistic), 'city' for 4-5 (urban)."
    }
  },
  required: ["title", "description", "availablePieces", "targetHeight", "gridMode", "enableWind", "windStrength", "showCenterOfGravity", "showHeight", "groundWidth", "maxHeight", "theme"]
};

/**
 * Generate Tower Stacker data for visualization
 *
 * Creates tower stacking simulations appropriate for K-5 engineering education:
 * - K: Stacking and balance
 * - K-1: Wider base = more stable
 * - 2-3: Center of gravity exploration
 * - 3-4: Material efficiency (height per piece)
 * - 4-5: Wind resistance design
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns TowerStackerData with complete configuration
 */
export const generateTowerStacker = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<TowerStackerData>
): Promise<TowerStackerData> => {
  const prompt = `
Create an educational Tower Stacker visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - TOWER STACKING ENGINEERING:
Tower Stacker teaches structural stability through hands-on building:
1. BLOCKS - Standard rectangular building pieces (various sizes)
2. BEAMS - Wide, thin pieces for spanning gaps or creating platforms
3. TRIANGLES - Triangular pieces (strong for support structures)
4. ARCHES - Curved pieces for decorative or load-spreading purposes
5. CENTER OF GRAVITY - The balance point of the structure
6. STABILITY - How well the tower resists tipping or falling

KEY ENGINEERING PRINCIPLES:
- Wider bases provide more stability (lower center of gravity)
- Heavier pieces at the bottom create better balance
- The center of gravity must stay over the base for stability
- Wind and lateral forces can topple unstable structures
- Taller towers are harder to stabilize than shorter ones

GRADE-LEVEL GUIDELINES:

KINDERGARTEN (ages 5-6):
- Concept: Stacking blocks, things fall if not balanced
- Challenge: Build a simple tower to reach a low target
- Pieces: Large blocks (2x1, 2x2), lots of them (15-20)
- Target height: 4-5 units (easy to achieve)
- gridMode: true (helpful snapping)
- enableWind: false (no wind test)
- showCenterOfGravity: false (too abstract)
- groundWidth: 12 (very wide - easy)
- Theme: 'blocks' (colorful, playful)
- Colors: Bright primary colors (#EF4444 red, #3B82F6 blue, #22C55E green, #F59E0B amber)
- Language: "Stack the colorful blocks to build a tall tower! Can you reach the green line?"

KINDERGARTEN - GRADE 1 (ages 5-7):
- Concept: Wider base = tower doesn't fall over as easily
- Challenge: Build a tower that doesn't tip
- Pieces: Blocks (2x1, 2x2, 1x1), 12-15 pieces
- Target height: 5-6 units
- gridMode: true
- enableWind: false
- showCenterOfGravity: false
- groundWidth: 10-12
- Theme: 'blocks'
- Language: "Build a tower with a wide bottom! A big base helps towers stay standing."

GRADES 1-2 (ages 6-8):
- Concept: Base width matters, introduce center of gravity concept
- Challenge: Build a tower that's stable
- Pieces: Mix of blocks (2x2, 2x1, 1x1), beams (3x1), 10-15 pieces
- Target height: 6-8 units
- gridMode: true
- enableWind: true (light wind, 30-40)
- showCenterOfGravity: true (introduce concept)
- groundWidth: 10
- Theme: 'blocks' or 'construction'
- Language: "The orange dot shows your tower's balance point. Keep it over your base!"

GRADES 2-3 (ages 7-9):
- Concept: CENTER OF GRAVITY exploration - key discovery!
- Challenge: Build tall AND stable
- Pieces: Blocks (various), beams (3x1, 4x1), triangles (2x2), 10-12 pieces
- Target height: 8-10 units
- gridMode: true
- enableWind: true (medium wind, 40-60)
- showCenterOfGravity: true
- groundWidth: 8-10
- Theme: 'construction'
- Language: "Watch the center of gravity! If it moves outside your base, your tower will fall."

GRADES 3-4 (ages 8-10):
- Concept: Material efficiency - height per piece
- Challenge: Reach target with limited pieces
- Pieces: Limited variety, 8-10 pieces total (efficiency challenge)
- Target height: 10-12 units
- gridMode: true
- enableWind: true (stronger wind, 50-70)
- showCenterOfGravity: true
- groundWidth: 8
- Theme: 'construction' or 'city'
- Language: "Build as tall as you can with only these pieces! Think carefully about where each block goes."

GRADES 4-5 (ages 9-11):
- Concept: Wind resistance design, optimization
- Challenge: Build tall tower that survives strong wind
- Pieces: Strategic mix, 8-10 pieces (must optimize)
- Target height: 12-15 units
- gridMode: true or false (freeform for advanced)
- enableWind: true (strong wind, 70-100)
- showCenterOfGravity: true
- groundWidth: 6-8 (narrower = harder)
- Theme: 'city'
- Language: "Design a skyscraper that can withstand strong winds! Use your pieces wisely."

PIECE CONFIGURATION GUIDELINES:

For BLOCKS:
- Small block: width: 1, height: 1, weight: 2
- Medium block: width: 2, height: 1, weight: 4
- Large block: width: 2, height: 2, weight: 6
- Colors: Solid colors like #EF4444 (red), #3B82F6 (blue), #22C55E (green)

For BEAMS:
- Short beam: width: 2, height: 1, weight: 3
- Long beam: width: 3, height: 1, weight: 4
- Extra-long beam: width: 4, height: 1, weight: 5
- Colors: Wood-like #D97706 (amber) or steel #6B7280 (gray)

For TRIANGLES:
- Small triangle: width: 2, height: 1, weight: 2
- Large triangle: width: 2, height: 2, weight: 3
- Colors: Bright accent colors like #8B5CF6 (purple), #EC4899 (pink)

For ARCHES:
- Standard arch: width: 2, height: 1, weight: 3
- Tall arch: width: 2, height: 2, weight: 4
- Colors: Stone-like #78716C (stone) or #9CA3AF (silver)

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.targetHeight ? `- Target height: ${config.targetHeight}` : ''}
${config.gridMode !== undefined ? `- Grid mode: ${config.gridMode}` : ''}
${config.enableWind !== undefined ? `- Enable wind: ${config.enableWind}` : ''}
${config.windStrength ? `- Wind strength: ${config.windStrength}` : ''}
${config.showCenterOfGravity !== undefined ? `- Show CoG: ${config.showCenterOfGravity}` : ''}
${config.groundWidth ? `- Ground width: ${config.groundWidth}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. availablePieces must have 3-5 different piece types
2. Total pieces should be 8-20 depending on grade level
3. targetHeight must be less than maxHeight
4. maxHeight should be at least targetHeight + 5
5. windStrength should be 0 if enableWind is false
6. Include a variety of piece sizes for design flexibility
7. Colors should be visually distinct and appropriate for theme

Return a complete Tower Stacker configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: towerStackerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Tower Stacker data returned from Gemini API');
  }

  // Validation: ensure targetHeight is reasonable
  if (!data.targetHeight || data.targetHeight < 3 || data.targetHeight > 20) {
    console.warn('Invalid targetHeight. Setting default.');
    data.targetHeight = 8;
  }

  // Validation: ensure maxHeight is greater than targetHeight
  if (!data.maxHeight || data.maxHeight <= data.targetHeight) {
    console.warn('Invalid maxHeight. Setting default.');
    data.maxHeight = data.targetHeight + 5;
  }

  // Validation: ensure groundWidth is reasonable
  if (!data.groundWidth || data.groundWidth < 4 || data.groundWidth > 16) {
    console.warn('Invalid groundWidth. Setting default.');
    data.groundWidth = 10;
  }

  // Validation: ensure availablePieces exists and has items
  if (!data.availablePieces || data.availablePieces.length === 0) {
    console.warn('No availablePieces provided. Setting defaults.');
    data.availablePieces = [
      { type: 'block', count: 10, width: 2, height: 1, weight: 4, color: '#EF4444' },
      { type: 'block', count: 6, width: 1, height: 1, weight: 2, color: '#3B82F6' },
      { type: 'beam', count: 4, width: 3, height: 1, weight: 4, color: '#D97706' },
      { type: 'triangle', count: 4, width: 2, height: 2, weight: 3, color: '#8B5CF6' },
    ];
  }

  // Validation: ensure pieces have valid properties
  data.availablePieces = data.availablePieces.map((p: AvailablePiece) => ({
    type: p.type || 'block',
    count: Math.max(1, Math.min(20, p.count || 5)),
    width: Math.max(1, Math.min(4, p.width || 2)),
    height: Math.max(1, Math.min(2, p.height || 1)),
    weight: Math.max(1, Math.min(10, p.weight || 3)),
    color: p.color || '#6366F1',
    icon: p.icon,
  }));

  // Validation: ensure windStrength is consistent with enableWind
  if (!data.enableWind) {
    data.windStrength = 0;
  } else if (!data.windStrength || data.windStrength < 0 || data.windStrength > 100) {
    data.windStrength = 50;
  }

  // Validation: ensure theme is valid
  if (!['construction', 'blocks', 'city', 'generic'].includes(data.theme)) {
    data.theme = 'generic';
  }

  // Apply config overrides
  if (config) {
    if (config.availablePieces) data.availablePieces = config.availablePieces;
    if (config.targetHeight !== undefined) data.targetHeight = config.targetHeight;
    if (config.gridMode !== undefined) data.gridMode = config.gridMode;
    if (config.enableWind !== undefined) data.enableWind = config.enableWind;
    if (config.windStrength !== undefined) data.windStrength = config.windStrength;
    if (config.showCenterOfGravity !== undefined) data.showCenterOfGravity = config.showCenterOfGravity;
    if (config.showHeight !== undefined) data.showHeight = config.showHeight;
    if (config.groundWidth !== undefined) data.groundWidth = config.groundWidth;
    if (config.maxHeight !== undefined) data.maxHeight = config.maxHeight;
    if (config.theme) data.theme = config.theme;
  }

  // Set sensible defaults for optional fields
  if (data.showHeight === undefined) data.showHeight = true;
  if (data.gridMode === undefined) data.gridMode = true;

  return data;
};
