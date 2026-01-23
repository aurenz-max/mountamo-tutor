import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  BridgeBuilderData,
  BridgePiece,
  BridgeJoint,
  BridgeMember,
} from '../../primitives/visual-primitives/engineering/BridgeBuilder';

// Re-export for convenience if needed elsewhere
export type { BridgeBuilderData, BridgePiece, BridgeJoint, BridgeMember };

/**
 * Schema for Bridge Piece
 */
const bridgePieceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["beam", "cable", "support"],
      description: "Type of structural element. Beams are rigid, cables are flexible/tension, supports are anchored."
    },
    count: {
      type: Type.NUMBER,
      description: "Number of pieces available. Use 5-15 for simple bridges, 15-30 for complex."
    },
    strength: {
      type: Type.NUMBER,
      description: "Breaking threshold (0-100). Higher = stronger. Beams: 60-80, Cables: 40-60, Supports: 80-100."
    },
    icon: {
      type: Type.STRING,
      description: "Emoji icon for this piece type. Beams: '📏', Cables: '🔗', Supports: '🔩'",
      nullable: true
    }
  },
  required: ["type", "count", "strength"]
};

/**
 * Schema for Bridge Builder Data
 */
const bridgeBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the bridge building activity (e.g., 'Build a Bridge for the School Bus!', 'Medieval Castle Bridge Challenge')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the challenge and what students will learn. Use age-appropriate language."
    },
    spanWidth: {
      type: Type.NUMBER,
      description: "Width of the gap to bridge in visual units (60-90). Wider = more challenging."
    },
    availablePieces: {
      type: Type.ARRAY,
      items: bridgePieceSchema,
      description: "Array of available building materials. Include beams, cables, and supports."
    },
    anchorPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "X position (0-100 normalized). Left side: 0-10, Right side: 90-100" },
          y: { type: Type.NUMBER, description: "Y position (0-100 normalized). Ground level: 0, Higher: 20-50" }
        },
        required: ["x", "y"]
      },
      description: "Fixed support positions where bridge connects to ground. Usually 2-4 points on each side."
    },
    loadType: {
      type: Type.STRING,
      enum: ["car", "truck", "train", "point_load"],
      description: "Type of load crossing the bridge. Use 'car' for K-2, 'truck' for 2-4, 'train' for 4-5."
    },
    loadWeight: {
      type: Type.NUMBER,
      description: "Force to apply (1-100). Light: 20-40, Medium: 40-60, Heavy: 60-100."
    },
    loadPosition: {
      type: Type.NUMBER,
      description: "Where load starts crossing (0-100). Usually 0 or 50."
    },
    showStress: {
      type: Type.BOOLEAN,
      description: "Color members by stress level (green/yellow/red). True for grades 2+."
    },
    budget: {
      type: Type.NUMBER,
      description: "Optional piece limit for optimization challenges. Use 10-30.",
      nullable: true
    },
    materialStrength: {
      type: Type.OBJECT,
      properties: {
        beam: { type: Type.NUMBER, description: "Beam breaking threshold (60-80)" },
        cable: { type: Type.NUMBER, description: "Cable breaking threshold (40-60)" },
        support: { type: Type.NUMBER, description: "Support breaking threshold (80-100)" }
      },
      required: ["beam", "cable", "support"],
      description: "Breaking thresholds for each material type."
    },
    allowFreeBuilding: {
      type: Type.BOOLEAN,
      description: "Can students add joints anywhere? True for exploration, false for guided challenges."
    },
    theme: {
      type: Type.STRING,
      enum: ["construction", "medieval", "modern", "generic"],
      description: "Visual theme. 'construction' for real-world, 'medieval' for castle theme, 'modern' for futuristic."
    }
  },
  required: ["title", "description", "spanWidth", "availablePieces", "anchorPoints", "loadType", "loadWeight", "loadPosition", "showStress", "materialStrength", "allowFreeBuilding", "theme"]
};

/**
 * Generate Bridge Builder data for visualization
 *
 * Creates bridge construction simulations appropriate for K-5 engineering education:
 * - K-1: Simple connection (just span the gap)
 * - 1-2: Supports at edges vs middle
 * - 2-3: Triangles are strong
 * - 3-4: Load distribution concepts
 * - 4-5: Truss design optimization
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns BridgeBuilderData with complete configuration
 */
export const generateBridgeBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<BridgeBuilderData>
): Promise<BridgeBuilderData> => {
  const prompt = `
Create an educational Bridge Builder visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - BRIDGE ENGINEERING:
Bridges use structural elements to span gaps and support loads:
1. BEAMS - Rigid horizontal members (good for compression and bending)
2. CABLES - Flexible members (good for tension/pulling)
3. SUPPORTS - Fixed anchors connecting to ground
4. JOINTS - Connection points where members meet
5. TRUSSES - Triangle patterns that are very strong

KEY ENGINEERING PRINCIPLES:
- Triangles don't deform under load (strongest shape!)
- Beams resist compression (pushing together)
- Cables resist tension (pulling apart)
- More support points = better load distribution
- Shorter members are stronger than longer ones

GRADE-LEVEL GUIDELINES:

KINDERGARTEN - GRADE 1 (ages 5-7):
- Concept: Connect two sides to make a path
- Challenge: Simple span with lots of pieces
- Pieces: 15-20 beams, 10 cables, plenty to experiment
- Anchors: 2 simple ground points (x: 0 and 100, y: 0)
- Load: 'car' with light weight (20-30)
- showStress: false (focus on building, not failure)
- budget: null (no limit - let them explore)
- allowFreeBuilding: true
- Theme: 'construction' (familiar trucks and workers)
- Language: "Help the car cross the river! Build a bridge to connect both sides!"

GRADES 1-2 (ages 6-8):
- Concept: Supports help bridges not sag
- Challenge: Middle of bridge needs support
- Pieces: 12-15 beams, 8-10 cables, 4-6 supports
- Anchors: Ground points plus mid-height options (y: 0 and 30)
- Load: 'car' or 'truck' with medium weight (30-45)
- showStress: true (introduce concept gently)
- budget: null (focus on learning, not optimization)
- allowFreeBuilding: true
- Theme: 'construction' or 'generic'
- Language: "The bridge sags in the middle! Can you add supports to make it stronger?"

GRADES 2-3 (ages 7-9):
- Concept: TRIANGLES ARE STRONG (key discovery!)
- Challenge: Build with triangle patterns
- Pieces: 10-12 beams, 6-8 cables, 4 supports
- Anchors: Multiple heights for truss building
- Load: 'truck' with medium weight (40-55)
- showStress: true
- budget: 15-20 (start introducing efficiency)
- allowFreeBuilding: true
- Theme: 'construction' or 'modern'
- Language: "Triangles are the strongest shape! Can you build a bridge using triangle patterns?"

GRADES 3-4 (ages 8-10):
- Concept: Load distribution - spread the weight
- Challenge: Heavy loads, need smart design
- Pieces: 8-10 beams, 6-8 cables, 4 supports
- Anchors: Strategic positions for trusses
- Load: 'truck' or 'train' with heavy weight (55-70)
- showStress: true (analyze and optimize)
- budget: 12-18 (efficiency matters)
- allowFreeBuilding: true
- Theme: 'modern' or 'construction'
- Language: "A heavy truck needs to cross! Design a bridge that spreads the load across many members."

GRADES 4-5 (ages 9-11):
- Concept: Truss optimization - minimum materials, maximum strength
- Challenge: Heavy loads with piece budget
- Pieces: 8-10 beams, 5-6 cables, 3-4 supports (limited!)
- Anchors: Precise positions for optimal design
- Load: 'train' with heavy weight (65-85)
- showStress: true (must analyze to succeed)
- budget: 10-15 (strict efficiency requirement)
- allowFreeBuilding: true (but need good design)
- Theme: 'modern' or 'generic'
- Language: "Design the most efficient truss bridge! Use as few pieces as possible while supporting the train."

ANCHOR POINT GUIDELINES:
- Always include ground-level anchors at both ends (x: 0-5 and 95-100, y: 0)
- For grades 2+, add elevated anchor options for truss building (y: 30-50)
- Example for truss building:
  - Left side: [{x: 0, y: 0}, {x: 0, y: 40}]
  - Right side: [{x: 100, y: 0}, {x: 100, y: 40}]

MATERIAL STRENGTH SETTINGS:
- Easy (K-1): beam: 80, cable: 60, support: 95
- Medium (2-3): beam: 70, cable: 50, support: 90
- Hard (4-5): beam: 65, cable: 45, support: 85

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.spanWidth ? `- Span width: ${config.spanWidth}` : ''}
${config.loadType ? `- Load type: ${config.loadType}` : ''}
${config.loadWeight ? `- Load weight: ${config.loadWeight}` : ''}
${config.budget ? `- Budget: ${config.budget}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
${config.showStress !== undefined ? `- Show stress: ${config.showStress}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. Anchor points must be at x: 0-10 (left side) and x: 90-100 (right side)
2. At least 2 anchor points (one on each side)
3. availablePieces must include at least beams
4. loadWeight should be appropriate for grade (20-40 for K-2, 40-70 for 3-4, 60-85 for 5)
5. Theme should match context (construction for real-world, medieval for historical, modern for futuristic)

Return a complete Bridge Builder configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: bridgeBuilderSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Bridge Builder data returned from Gemini API');
  }

  // Validation: ensure spanWidth is reasonable
  if (!data.spanWidth || data.spanWidth < 40 || data.spanWidth > 100) {
    console.warn('Invalid spanWidth. Setting default.');
    data.spanWidth = 80;
  }

  // Validation: ensure anchor points exist and are valid
  if (!data.anchorPoints || data.anchorPoints.length < 2) {
    console.warn('Invalid anchorPoints. Setting defaults.');
    data.anchorPoints = [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 100, y: 0 },
      { x: 100, y: 40 }
    ];
  }

  // Validation: ensure anchor points are on valid sides
  data.anchorPoints = data.anchorPoints.map((p: { x: number; y: number }) => ({
    x: Math.max(0, Math.min(100, p.x)),
    y: Math.max(0, Math.min(100, p.y))
  }));

  // Validation: ensure availablePieces exists and has items
  if (!data.availablePieces || data.availablePieces.length === 0) {
    console.warn('No availablePieces provided. Setting defaults.');
    data.availablePieces = [
      { type: 'beam', count: 15, strength: 70, icon: '📏' },
      { type: 'cable', count: 10, strength: 50, icon: '🔗' },
      { type: 'support', count: 6, strength: 90, icon: '🔩' }
    ];
  }

  // Validation: ensure loadWeight is reasonable
  if (!data.loadWeight || data.loadWeight < 1 || data.loadWeight > 100) {
    console.warn('Invalid loadWeight. Setting default.');
    data.loadWeight = 50;
  }

  // Validation: ensure materialStrength exists
  if (!data.materialStrength) {
    data.materialStrength = { beam: 70, cable: 50, support: 90 };
  }

  // Validation: ensure theme is valid
  if (!['construction', 'medieval', 'modern', 'generic'].includes(data.theme)) {
    data.theme = 'generic';
  }

  // Apply config overrides
  if (config) {
    if (config.spanWidth) data.spanWidth = config.spanWidth;
    if (config.availablePieces) data.availablePieces = config.availablePieces;
    if (config.anchorPoints) data.anchorPoints = config.anchorPoints;
    if (config.loadType) data.loadType = config.loadType;
    if (config.loadWeight !== undefined) data.loadWeight = config.loadWeight;
    if (config.loadPosition !== undefined) data.loadPosition = config.loadPosition;
    if (config.showStress !== undefined) data.showStress = config.showStress;
    if (config.budget !== undefined) data.budget = config.budget;
    if (config.materialStrength) data.materialStrength = config.materialStrength;
    if (config.initialJoints) data.initialJoints = config.initialJoints;
    if (config.initialMembers) data.initialMembers = config.initialMembers;
    if (config.allowFreeBuilding !== undefined) data.allowFreeBuilding = config.allowFreeBuilding;
    if (config.theme) data.theme = config.theme;
  }

  // Set sensible defaults for optional fields
  if (data.loadPosition === undefined) data.loadPosition = 0;
  if (data.allowFreeBuilding === undefined) data.allowFreeBuilding = true;

  return data;
};
