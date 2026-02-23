import { Type, Schema } from "@google/genai";
import { ShapeTracerData, ShapeTracerChallenge } from "../../primitives/visual-primitives/math/ShapeTracer";
import { ai } from "../geminiClient";

// ============================================================================
// Shared Setup Schema (lightweight first call)
// ============================================================================

interface SetupResult {
  title: string;
  description: string;
  gridSize: number;
  showPropertyReminder: boolean;
  gradeBand: 'K' | '1';
  challengePlan: Array<{ type: string; targetShape: string }>;
}

const setupSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (e.g., 'Trace the Triangle!', 'Draw Shapes!')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    gridSize: {
      type: Type.NUMBER,
      description: "Grid cell size for snapping: 25 for K, 20 for Grade 1"
    },
    showPropertyReminder: {
      type: Type.BOOLEAN,
      description: "Show shape property reminders? true for Grade 1, false for K"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' or '1'"
    },
    challengePlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "Challenge type: 'trace', 'complete', 'draw-from-description', or 'connect-dots'"
          },
          targetShape: {
            type: Type.STRING,
            description: "Shape name: 'triangle', 'square', 'rectangle', 'circle', 'hexagon', 'pentagon', 'rhombus'"
          }
        },
        required: ["type", "targetShape"]
      },
      description: "4-6 challenges, progressive difficulty, at least 2 different types"
    }
  },
  required: ["title", "description", "gridSize", "showPropertyReminder", "gradeBand", "challengePlan"]
};

// ============================================================================
// Per-Challenge-Type Schemas (small, focused)
// ============================================================================

const traceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Warm instruction like 'Trace the triangle by following the dots!'"
    },
    vertices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "X coordinate (40-460)" },
          y: { type: Type.NUMBER, description: "Y coordinate (40-360)" }
        },
        required: ["x", "y"]
      },
      description: "Ordered vertices of the shape to trace, within 500x400 canvas"
    },
    tolerance: {
      type: Type.NUMBER,
      description: "Pixel tolerance: 30-40 for K, 20-25 for Grade 1"
    }
  },
  required: ["instruction", "vertices", "tolerance"]
};

const completeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Finish the square by connecting the missing sides!'"
    },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x1: { type: Type.NUMBER, description: "Start X (40-460)" },
          y1: { type: Type.NUMBER, description: "Start Y (40-360)" },
          x2: { type: Type.NUMBER, description: "End X (40-460)" },
          y2: { type: Type.NUMBER, description: "End Y (40-360)" }
        },
        required: ["x1", "y1", "x2", "y2"]
      },
      description: "Pre-drawn line segments (the sides already visible)"
    },
    remainingVertices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "X coordinate (40-460)" },
          y: { type: Type.NUMBER, description: "Y coordinate (40-360)" }
        },
        required: ["x", "y"]
      },
      description: "Vertices the student must connect to finish the shape"
    }
  },
  required: ["instruction", "segments", "remainingVertices"]
};

const drawFromDescriptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Read the description and draw the shape!'"
    },
    description: {
      type: Type.STRING,
      description: "Text description of the shape (e.g., 'A shape with 3 sides and 3 corners')"
    },
    sides: {
      type: Type.NUMBER,
      description: "Number of sides the shape must have"
    },
    corners: {
      type: Type.NUMBER,
      description: "Number of corners/vertices"
    },
    allSidesEqual: {
      type: Type.BOOLEAN,
      description: "Whether all sides must be equal length"
    },
    hasCurvedSides: {
      type: Type.BOOLEAN,
      description: "Whether the shape has curved sides (e.g., circle)"
    }
  },
  required: ["instruction", "description", "sides", "corners", "allSidesEqual", "hasCurvedSides"]
};

const connectDotsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Connect the dots in order to reveal the shape!'"
    },
    dots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "X coordinate (40-460)" },
          y: { type: Type.NUMBER, description: "Y coordinate (40-360)" },
          label: { type: Type.STRING, description: "Dot label (e.g., '1', '2', 'A')" }
        },
        required: ["x", "y", "label"]
      },
      description: "Positioned dots on the canvas"
    },
    correctOrder: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Zero-based indices into dots array defining correct connection order"
    },
    revealShape: {
      type: Type.STRING,
      description: "Name of shape revealed when dots are connected"
    }
  },
  required: ["instruction", "dots", "correctOrder", "revealShape"]
};

// ============================================================================
// Setup Generator
// ============================================================================

async function generateSetup(
  topic: string,
  gradeLevel: string,
  config?: Partial<ShapeTracerData>,
): Promise<SetupResult> {
  const prompt = `
Create a plan for a shape tracing activity teaching "${topic}" to ${gradeLevel} students.

GUIDELINES:
- Kindergarten (gradeBand "K"): shapes = circle, square, triangle, rectangle. Types: mostly trace and connect-dots. gridSize: 25. showPropertyReminder: false.
- Grade 1 (gradeBand "1"): shapes = triangle, square, rectangle, hexagon, pentagon, rhombus. All 4 types allowed. gridSize: 20. showPropertyReminder: true.

Challenge types: "trace", "complete", "draw-from-description", "connect-dots"

${config?.gridSize ? `- Grid size: ${config.gridSize}` : ''}
${config?.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}

Create 4-6 challenges progressing in difficulty. Use at least 2 different types. Start with easier shapes (triangle, square) and progress to harder ones.
Title should be fun and engaging for young children.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: setupSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No setup data returned from Gemini API');

  // --- Validate ---
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }
  if (!data.gridSize || data.gridSize < 10 || data.gridSize > 50) {
    data.gridSize = data.gradeBand === 'K' ? 25 : 20;
  }
  if (typeof data.showPropertyReminder !== 'boolean') {
    data.showPropertyReminder = data.gradeBand === '1';
  }

  const validTypes = ['trace', 'complete', 'draw-from-description', 'connect-dots'];
  if (!Array.isArray(data.challengePlan) || data.challengePlan.length === 0) {
    data.challengePlan = [
      { type: 'trace', targetShape: 'triangle' },
      { type: 'trace', targetShape: 'square' },
      { type: 'connect-dots', targetShape: 'rectangle' },
      { type: 'complete', targetShape: 'triangle' },
    ];
  }
  data.challengePlan = data.challengePlan
    .filter((c: { type: string }) => validTypes.includes(c.type))
    .slice(0, 6);
  if (data.challengePlan.length < 2) {
    data.challengePlan = [
      { type: 'trace', targetShape: 'triangle' },
      { type: 'connect-dots', targetShape: 'square' },
    ];
  }

  return data as SetupResult;
}

// ============================================================================
// Per-Type Challenge Generators
// ============================================================================

function coordinateExamples(shape: string): string {
  const examples: Record<string, string> = {
    triangle: 'Triangle: [{x:250,y:80},{x:150,y:280},{x:350,y:280}]',
    square: 'Square: [{x:150,y:100},{x:350,y:100},{x:350,y:300},{x:150,y:300}]',
    rectangle: 'Rectangle: [{x:100,y:120},{x:400,y:120},{x:400,y:280},{x:100,y:280}]',
    pentagon: 'Pentagon: [{x:250,y:60},{x:390,y:160},{x:340,y:330},{x:160,y:330},{x:110,y:160}]',
    hexagon: 'Hexagon: [{x:250,y:60},{x:370,y:110},{x:370,y:250},{x:250,y:310},{x:130,y:250},{x:130,y:110}]',
    circle: 'Circle: use 8+ points along radius 120 centered at (250,200)',
    rhombus: 'Rhombus: [{x:250,y:60},{x:400,y:200},{x:250,y:340},{x:100,y:200}]',
  };
  return examples[shape] || examples.triangle!;
}

const clampPoint = (pt: { x: number; y: number }) => ({
  x: Math.max(40, Math.min(460, pt.x ?? 250)),
  y: Math.max(40, Math.min(360, pt.y ?? 200)),
});

async function generateTrace(shape: string, setup: SetupResult): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a TRACE challenge for a "${shape}" shape tracing activity for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

Canvas is 500x400. All coordinates must be x: 40-460, y: 40-360.
Coordinate reference: ${coordinateExamples(shape)}

The student follows a dotted outline by tapping vertices in order.
- instruction: warm, encouraging (e.g., "Trace the ${shape} by following the dots!")
- vertices: ordered points that form the ${shape}. Must be within canvas bounds.
- tolerance: ${setup.gradeBand === 'K' ? '30-40' : '20-25'} pixels
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: traceSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data || !Array.isArray(data.vertices) || data.vertices.length < 3) {
    return fallbackTrace(shape, setup);
  }

  return {
    id: '',
    type: 'trace',
    instruction: data.instruction || `Trace the ${shape} by following the dots!`,
    targetShape: shape,
    tracePath: data.vertices.map(clampPoint),
    tolerance: (data.tolerance && data.tolerance > 0) ? data.tolerance : (setup.gradeBand === 'K' ? 35 : 22),
  };
}

async function generateComplete(shape: string, setup: SetupResult): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a COMPLETE challenge for a "${shape}" shape for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

Canvas is 500x400. All coordinates: x: 40-460, y: 40-360.
Coordinate reference: ${coordinateExamples(shape)}

Some sides are pre-drawn. The student draws the remaining sides to finish the shape.
- instruction: encouraging (e.g., "Finish the ${shape}!")
- segments: pre-drawn line segments as [{x1, y1, x2, y2}]. Draw about half the sides.
- remainingVertices: vertices the student connects to complete the shape.

The segments + remaining vertices should form a complete ${shape} when connected.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: completeSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data || !Array.isArray(data.segments) || data.segments.length === 0 ||
      !Array.isArray(data.remainingVertices) || data.remainingVertices.length === 0) {
    return fallbackComplete(shape, setup);
  }

  // Convert flat segments to drawnSides format
  const drawnSides = data.segments.map((s: { x1: number; y1: number; x2: number; y2: number }) => ({
    from: clampPoint({ x: s.x1, y: s.y1 }),
    to: clampPoint({ x: s.x2, y: s.y2 }),
  }));

  return {
    id: '',
    type: 'complete',
    instruction: data.instruction || `Finish the ${shape}!`,
    targetShape: shape,
    drawnSides,
    remainingVertices: data.remainingVertices.map(clampPoint),
  };
}

async function generateDrawFromDescription(shape: string, setup: SetupResult): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a DRAW-FROM-DESCRIPTION challenge for a "${shape}" for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

The student reads a text description and draws the shape freehand on a grid.
- instruction: encouraging (e.g., "Read the clue and draw the shape!")
- description: child-friendly text clue about the shape (e.g., "A shape with 3 straight sides and 3 pointy corners")
- sides: number of sides the shape must have
- corners: number of corners/vertices
- allSidesEqual: true if all sides should be equal (e.g., square, equilateral triangle)
- hasCurvedSides: true only for circles
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: drawFromDescriptionSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackDrawFromDescription(shape, setup);

  return {
    id: '',
    type: 'draw-from-description',
    instruction: data.instruction || `Read the clue and draw a ${shape}!`,
    targetShape: shape,
    description: data.description || `Draw a shape with ${data.sides || 3} sides`,
    requiredProperties: {
      sides: data.sides || 3,
      corners: data.corners || 3,
      allSidesEqual: data.allSidesEqual ?? false,
      hasCurvedSides: data.hasCurvedSides ?? false,
    },
  };
}

async function generateConnectDots(shape: string, setup: SetupResult): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a CONNECT-THE-DOTS challenge for a "${shape}" for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

Canvas is 500x400. All coordinates: x: 40-460, y: 40-360.
Coordinate reference: ${coordinateExamples(shape)}

Numbered dots on canvas. Student connects them in order to reveal the shape.
- instruction: fun (e.g., "Connect the dots to discover the hidden shape!")
- dots: positioned dots with labels "1", "2", "3", etc. Place them to form a ${shape}.
- correctOrder: zero-based indices [0, 1, 2, ...] matching the label order
- revealShape: "${shape}"
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: connectDotsSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data || !Array.isArray(data.dots) || data.dots.length < 3) {
    return fallbackConnectDots(shape, setup);
  }

  const clampedDots = data.dots.map((d: { x: number; y: number; label?: string }, i: number) => ({
    ...clampPoint(d),
    label: d.label || String(i + 1),
  }));

  // Validate correctOrder indices
  let correctOrder = Array.isArray(data.correctOrder) ? data.correctOrder : [];
  correctOrder = correctOrder.filter(
    (i: number) => typeof i === 'number' && i >= 0 && i < clampedDots.length
  );
  if (correctOrder.length === 0) {
    correctOrder = clampedDots.map((_: unknown, i: number) => i);
  }

  return {
    id: '',
    type: 'connect-dots',
    instruction: data.instruction || `Connect the dots to reveal the ${shape}!`,
    targetShape: shape,
    dots: clampedDots,
    correctOrder,
    revealShape: data.revealShape || shape,
  };
}

// ============================================================================
// Fallback Defaults (per-type)
// ============================================================================

const SHAPE_VERTICES: Record<string, Array<{ x: number; y: number }>> = {
  triangle: [{ x: 250, y: 80 }, { x: 150, y: 280 }, { x: 350, y: 280 }],
  square: [{ x: 150, y: 100 }, { x: 350, y: 100 }, { x: 350, y: 300 }, { x: 150, y: 300 }],
  rectangle: [{ x: 100, y: 120 }, { x: 400, y: 120 }, { x: 400, y: 280 }, { x: 100, y: 280 }],
  pentagon: [{ x: 250, y: 60 }, { x: 390, y: 160 }, { x: 340, y: 330 }, { x: 160, y: 330 }, { x: 110, y: 160 }],
  hexagon: [{ x: 250, y: 60 }, { x: 370, y: 110 }, { x: 370, y: 250 }, { x: 250, y: 310 }, { x: 130, y: 250 }, { x: 130, y: 110 }],
  rhombus: [{ x: 250, y: 60 }, { x: 400, y: 200 }, { x: 250, y: 340 }, { x: 100, y: 200 }],
};

function getVertices(shape: string): Array<{ x: number; y: number }> {
  return SHAPE_VERTICES[shape] || SHAPE_VERTICES.triangle!;
}

function fallbackTrace(shape: string, setup: SetupResult): ShapeTracerChallenge {
  return {
    id: '',
    type: 'trace',
    instruction: `Trace the ${shape} by following the dots!`,
    targetShape: shape,
    tracePath: getVertices(shape),
    tolerance: setup.gradeBand === 'K' ? 35 : 22,
  };
}

function fallbackComplete(shape: string, setup: SetupResult): ShapeTracerChallenge {
  const verts = getVertices(shape);
  const half = Math.ceil(verts.length / 2);

  // Pre-draw first half as segments
  const drawnSides = [];
  for (let i = 0; i < half; i++) {
    drawnSides.push({
      from: verts[i],
      to: verts[(i + 1) % verts.length],
    });
  }

  // Remaining vertices are the rest
  const remaining = verts.slice(half);

  return {
    id: '',
    type: 'complete',
    instruction: `Finish the ${shape} by connecting the missing sides!`,
    targetShape: shape,
    drawnSides,
    remainingVertices: remaining.length > 0 ? remaining : [verts[verts.length - 1]],
  };
}

function fallbackDrawFromDescription(shape: string, _setup: SetupResult): ShapeTracerChallenge {
  const shapeProps: Record<string, { sides: number; corners: number; equal: boolean; curved: boolean; desc: string }> = {
    triangle: { sides: 3, corners: 3, equal: false, curved: false, desc: 'A shape with 3 straight sides and 3 pointy corners' },
    square: { sides: 4, corners: 4, equal: true, curved: false, desc: 'A shape with 4 equal sides and 4 square corners' },
    rectangle: { sides: 4, corners: 4, equal: false, curved: false, desc: 'A shape with 4 sides - 2 long and 2 short - and 4 corners' },
    circle: { sides: 0, corners: 0, equal: false, curved: true, desc: 'A perfectly round shape with no corners' },
    hexagon: { sides: 6, corners: 6, equal: true, curved: false, desc: 'A shape with 6 equal sides and 6 corners' },
    pentagon: { sides: 5, corners: 5, equal: true, curved: false, desc: 'A shape with 5 sides and 5 corners' },
    rhombus: { sides: 4, corners: 4, equal: true, curved: false, desc: 'A shape like a tilted square - 4 equal sides but not square corners' },
  };
  const props = shapeProps[shape] || shapeProps.triangle!;

  return {
    id: '',
    type: 'draw-from-description',
    instruction: `Read the clue and draw the shape!`,
    targetShape: shape,
    description: props.desc,
    requiredProperties: {
      sides: props.sides,
      corners: props.corners,
      allSidesEqual: props.equal,
      hasCurvedSides: props.curved,
    },
  };
}

function fallbackConnectDots(shape: string, _setup: SetupResult): ShapeTracerChallenge {
  const verts = getVertices(shape);
  return {
    id: '',
    type: 'connect-dots',
    instruction: `Connect the dots in order to reveal the hidden shape!`,
    targetShape: shape,
    dots: verts.map((v, i) => ({ ...v, label: String(i + 1) })),
    correctOrder: verts.map((_, i) => i),
    revealShape: shape,
  };
}

// ============================================================================
// Challenge Dispatcher (routes plan entry → type-specific generator)
// ============================================================================

async function generateChallengeByType(
  plan: { type: string; targetShape: string },
  setup: SetupResult,
): Promise<ShapeTracerChallenge> {
  switch (plan.type) {
    case 'trace':
      return generateTrace(plan.targetShape, setup);
    case 'complete':
      return generateComplete(plan.targetShape, setup);
    case 'draw-from-description':
      return generateDrawFromDescription(plan.targetShape, setup);
    case 'connect-dots':
      return generateConnectDots(plan.targetShape, setup);
    default:
      return fallbackTrace(plan.targetShape, setup);
  }
}

// ============================================================================
// Main Generator (public API — signature unchanged)
// ============================================================================

/**
 * Generate shape tracer data using parallel LLM calls.
 *
 * Architecture:
 *   1. Lightweight "setup" call → title, gridSize, gradeBand, challenge plan
 *   2. Parallel calls (one per planned challenge) with focused per-type schemas
 *   3. Recombine into ShapeTracerData
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns ShapeTracerData with complete configuration
 */
export const generateShapeTracer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ShapeTracerData>
): Promise<ShapeTracerData> => {
  // Step 1: Setup call (lightweight)
  const setup = await generateSetup(topic, gradeLevel, config);

  // Step 2: Parallel challenge calls (one per plan entry, focused schemas)
  const challengePromises = setup.challengePlan.map(plan =>
    generateChallengeByType(plan, setup)
  );
  const challenges = await Promise.all(challengePromises);

  // Step 3: Assign IDs
  challenges.forEach((c, i) => { c.id = `c${i + 1}`; });

  // Step 4: Recombine
  const data: ShapeTracerData = {
    title: setup.title,
    description: setup.description,
    challenges,
    gridSize: setup.gridSize,
    showPropertyReminder: setup.showPropertyReminder,
    gradeBand: setup.gradeBand,
  };

  // Step 5: Apply explicit config overrides
  if (config) {
    if (config.gridSize !== undefined) data.gridSize = config.gridSize;
    if (config.showPropertyReminder !== undefined) data.showPropertyReminder = config.showPropertyReminder;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.title !== undefined) data.title = config.title;
    if (config.description !== undefined) data.description = config.description;
  }

  return data;
};
