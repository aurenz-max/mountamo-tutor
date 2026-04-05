import { Type, Schema } from "@google/genai";
import {
  ShapeComposerData,
  ShapeComposerChallenge,
  ShapeComposerPiece,
  ShapeComposerComponent,
} from "../../primitives/visual-primitives/math/ShapeComposer";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  "compose-match": {
    promptDoc:
      `"compose-match": Drag smaller shapes to fill a target silhouette. `
      + `Student sees an outline and must position pieces to complete it.`,
    schemaDescription: "'compose-match' (fill a silhouette with pieces)",
  },
  "compose-picture": {
    promptDoc:
      `"compose-picture": Build a recognizable picture from basic shapes. `
      + `Student drags shapes to fill slots forming a house, tree, rocket, etc.`,
    schemaDescription: "'compose-picture' (build a picture from shapes)",
  },
  decompose: {
    promptDoc:
      `"decompose": Break a composite shape into basic components. `
      + `Student taps/clicks to identify which basic shapes make up the composite.`,
    schemaDescription: "'decompose' (identify components of a composite shape)",
  },
  "free-create": {
    promptDoc:
      `"free-create": Open-ended creative mode. Student places 2+ shapes freely. `
      + `Always passes if they place at least 2 shapes.`,
    schemaDescription: "'free-create' (open creative mode)",
  },
  "how-many-ways": {
    promptDoc:
      `"how-many-ways": Ask the student how many of a given piece are needed `
      + `to build a target shape. Student enters a number.`,
    schemaDescription: "'how-many-ways' (count pieces needed)",
  },
};

// ---------------------------------------------------------------------------
// Canvas & shape constants
// ---------------------------------------------------------------------------

const CANVAS_W = 400;
const CANVAS_H = 350;
const CENTER_X = CANVAS_W / 2;
const CENTER_Y = CANVAS_H / 2;

type ShapeType =
  | "triangle"
  | "square"
  | "rectangle"
  | "circle"
  | "hexagon"
  | "trapezoid"
  | "rhombus";

const K_SHAPES: ShapeType[] = ["circle", "square", "triangle", "rectangle"];
const G1_SHAPES: ShapeType[] = [
  ...K_SHAPES,
  "hexagon",
  "trapezoid",
  "rhombus",
];

const SHAPE_COLORS: Record<string, string> = {
  triangle: "#8B5CF6",
  square: "#3B82F6",
  rectangle: "#10B981",
  circle: "#F59E0B",
  hexagon: "#EC4899",
  trapezoid: "#6366F1",
  rhombus: "#14B8A6",
};

function gradeShapes(gradeBand: string): ShapeType[] {
  return gradeBand === "1" ? G1_SHAPES : K_SHAPES;
}

function resolveGradeBand(gradeLevel: string): string {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes("kinder") || gl.includes("k")) return "K";
  return "1";
}

function gradeShapesPrompt(gradeBand: string): string {
  if (gradeBand === "K")
    return "ONLY use circle, square, triangle, rectangle.";
  return "Use circle, square, triangle, rectangle, hexagon, trapezoid, rhombus.";
}

// Randomize themes
const SCENARIO_THEMES = [
  "building a playground",
  "making a quilt pattern",
  "constructing a city",
  "creating a space scene",
  "building a garden",
  "designing a robot",
];

function randomTheme(): string {
  return SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)];
}

// ---------------------------------------------------------------------------
// Geometry helpers — deterministic SVG paths & positions
// ---------------------------------------------------------------------------

/** Get SVG path for a target shape silhouette centered at (cx, cy) */
function getTargetOutlinePath(
  shape: string,
  cx: number,
  cy: number,
  size: number,
): string {
  const half = size / 2;
  switch (shape) {
    case "large-square":
      return `M ${cx - half} ${cy - half} L ${cx + half} ${cy - half} L ${cx + half} ${cy + half} L ${cx - half} ${cy + half} Z`;
    case "rectangle":
      return `M ${cx - half * 1.5} ${cy - half * 0.75} L ${cx + half * 1.5} ${cy - half * 0.75} L ${cx + half * 1.5} ${cy + half * 0.75} L ${cx - half * 1.5} ${cy + half * 0.75} Z`;
    case "large-triangle":
      return `M ${cx} ${cy - half} L ${cx + half} ${cy + half} L ${cx - half} ${cy + half} Z`;
    case "hexagon": {
      const r = half;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
      });
      return `M ${pts.join(" L ")} Z`;
    }
    case "trapezoid": {
      const top = half * 0.6;
      const bot = half;
      const h = half * 0.8;
      return `M ${cx - top} ${cy - h} L ${cx + top} ${cy - h} L ${cx + bot} ${cy + h} L ${cx - bot} ${cy + h} Z`;
    }
    default:
      // fallback square
      return `M ${cx - half} ${cy - half} L ${cx + half} ${cy - half} L ${cx + half} ${cy + half} L ${cx - half} ${cy + half} Z`;
  }
}

// ---------------------------------------------------------------------------
// Compose-match: target shape decomposition library
// ---------------------------------------------------------------------------

interface ComposeMatchTemplate {
  targetOutlinePath: string;
  pieces: ShapeComposerPiece[];
}

function getComposeMatchTemplate(
  targetShape: string,
  idPrefix: string,
): ComposeMatchTemplate {
  const size = 120;
  const cx = CENTER_X;
  const cy = CENTER_Y;

  switch (targetShape) {
    case "large-square": {
      // 2 triangles (diagonal split)
      const half = size / 2;
      return {
        targetOutlinePath: getTargetOutlinePath("large-square", cx, cy, size),
        pieces: [
          {
            id: `${idPrefix}-p0`,
            shape: "triangle",
            color: SHAPE_COLORS.triangle,
            width: size,
            height: size,
            targetX: cx - half,
            targetY: cy - half,
            targetRotation: 0,
          },
          {
            id: `${idPrefix}-p1`,
            shape: "triangle",
            color: "#6366F1",
            width: size,
            height: size,
            targetX: cx - half,
            targetY: cy - half,
            targetRotation: 180,
          },
        ],
      };
    }
    case "rectangle": {
      // 2 squares side by side
      const sqSize = size * 0.75;
      return {
        targetOutlinePath: getTargetOutlinePath("rectangle", cx, cy, size),
        pieces: [
          {
            id: `${idPrefix}-p0`,
            shape: "square",
            color: SHAPE_COLORS.square,
            width: sqSize,
            height: sqSize,
            targetX: cx - sqSize,
            targetY: cy - sqSize / 2,
            targetRotation: 0,
          },
          {
            id: `${idPrefix}-p1`,
            shape: "square",
            color: "#6366F1",
            width: sqSize,
            height: sqSize,
            targetX: cx,
            targetY: cy - sqSize / 2,
            targetRotation: 0,
          },
        ],
      };
    }
    case "large-triangle": {
      // 4 smaller triangles (medial subdivision)
      const triW = size / 2;
      const triH = size / 2;
      const topX = cx - triW / 2;
      const topY = cy - size / 2;
      return {
        targetOutlinePath: getTargetOutlinePath("large-triangle", cx, cy, size),
        pieces: [
          {
            id: `${idPrefix}-p0`,
            shape: "triangle",
            color: "#8B5CF6",
            width: triW,
            height: triH,
            targetX: topX,
            targetY: topY,
            targetRotation: 0,
          },
          {
            id: `${idPrefix}-p1`,
            shape: "triangle",
            color: "#3B82F6",
            width: triW,
            height: triH,
            targetX: cx - size / 2,
            targetY: cy,
            targetRotation: 0,
          },
          {
            id: `${idPrefix}-p2`,
            shape: "triangle",
            color: "#10B981",
            width: triW,
            height: triH,
            targetX: cx,
            targetY: cy,
            targetRotation: 0,
          },
          {
            id: `${idPrefix}-p3`,
            shape: "triangle",
            color: "#F59E0B",
            width: triW,
            height: triH,
            targetX: cx - triW / 2,
            targetY: cy,
            targetRotation: 180,
          },
        ],
      };
    }
    case "hexagon": {
      // 6 triangles (radial)
      const r = size / 2;
      const pieces: ShapeComposerPiece[] = Array.from(
        { length: 6 },
        (_, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const colors = [
            "#8B5CF6",
            "#3B82F6",
            "#10B981",
            "#F59E0B",
            "#EC4899",
            "#6366F1",
          ];
          return {
            id: `${idPrefix}-p${i}`,
            shape: "triangle" as const,
            color: colors[i],
            width: r * 0.9,
            height: r * 0.8,
            targetX: cx + (r * 0.35) * Math.cos(angle) - (r * 0.9) / 2,
            targetY: cy + (r * 0.35) * Math.sin(angle) - (r * 0.8) / 2,
            targetRotation: Math.round((angle * 180) / Math.PI + 90),
          };
        },
      );
      return {
        targetOutlinePath: getTargetOutlinePath("hexagon", cx, cy, size),
        pieces,
      };
    }
    case "trapezoid": {
      // 3 triangles
      const triW = size * 0.5;
      const triH = size * 0.6;
      return {
        targetOutlinePath: getTargetOutlinePath("trapezoid", cx, cy, size),
        pieces: [
          {
            id: `${idPrefix}-p0`,
            shape: "triangle",
            color: "#8B5CF6",
            width: triW,
            height: triH,
            targetX: cx - triW * 1.2,
            targetY: cy - triH / 3,
            targetRotation: 0,
          },
          {
            id: `${idPrefix}-p1`,
            shape: "triangle",
            color: "#3B82F6",
            width: triW,
            height: triH,
            targetX: cx - triW / 2,
            targetY: cy - triH / 3,
            targetRotation: 0,
          },
          {
            id: `${idPrefix}-p2`,
            shape: "triangle",
            color: "#10B981",
            width: triW,
            height: triH,
            targetX: cx + triW * 0.2,
            targetY: cy - triH / 3,
            targetRotation: 0,
          },
        ],
      };
    }
    default:
      // Fallback: large-square
      return getComposeMatchTemplate("large-square", idPrefix);
  }
}

const COMPOSE_MATCH_TARGETS_K = [
  "large-square",
  "rectangle",
  "large-triangle",
];
const COMPOSE_MATCH_TARGETS_G1 = [
  ...COMPOSE_MATCH_TARGETS_K,
  "hexagon",
  "trapezoid",
];

// ---------------------------------------------------------------------------
// Compose-picture: picture layout library
// ---------------------------------------------------------------------------

interface PictureLayout {
  slots: Array<{
    id: string;
    shape: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>;
  availableShapes: Array<{ shape: string; color: string; count: number }>;
  targetDescription: string;
}

function getPictureLayout(picture: string, idPrefix: string): PictureLayout {
  switch (picture) {
    case "house":
      return {
        slots: [
          {
            id: `${idPrefix}-s0`,
            shape: "square",
            x: CENTER_X - 60,
            y: CENTER_Y - 20,
            width: 120,
            height: 100,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s1`,
            shape: "triangle",
            x: CENTER_X - 70,
            y: CENTER_Y - 80,
            width: 140,
            height: 60,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s2`,
            shape: "rectangle",
            x: CENTER_X - 15,
            y: CENTER_Y + 40,
            width: 30,
            height: 40,
            rotation: 0,
          },
        ],
        availableShapes: [
          { shape: "square", color: SHAPE_COLORS.square, count: 1 },
          { shape: "triangle", color: SHAPE_COLORS.triangle, count: 1 },
          { shape: "rectangle", color: SHAPE_COLORS.rectangle, count: 1 },
        ],
        targetDescription:
          "A house with a square body, triangle roof, and rectangle door",
      };
    case "tree":
      return {
        slots: [
          {
            id: `${idPrefix}-s0`,
            shape: "triangle",
            x: CENTER_X - 50,
            y: CENTER_Y - 90,
            width: 100,
            height: 80,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s1`,
            shape: "triangle",
            x: CENTER_X - 60,
            y: CENTER_Y - 40,
            width: 120,
            height: 80,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s2`,
            shape: "rectangle",
            x: CENTER_X - 15,
            y: CENTER_Y + 40,
            width: 30,
            height: 60,
            rotation: 0,
          },
        ],
        availableShapes: [
          { shape: "triangle", color: "#22C55E", count: 2 },
          { shape: "rectangle", color: "#92400E", count: 1 },
        ],
        targetDescription:
          "A tree with two triangle foliage layers and a rectangle trunk",
      };
    case "rocket":
      return {
        slots: [
          {
            id: `${idPrefix}-s0`,
            shape: "triangle",
            x: CENTER_X - 25,
            y: CENTER_Y - 110,
            width: 50,
            height: 40,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s1`,
            shape: "rectangle",
            x: CENTER_X - 30,
            y: CENTER_Y - 70,
            width: 60,
            height: 120,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s2`,
            shape: "triangle",
            x: CENTER_X - 55,
            y: CENTER_Y + 20,
            width: 30,
            height: 40,
            rotation: 30,
          },
          {
            id: `${idPrefix}-s3`,
            shape: "triangle",
            x: CENTER_X + 25,
            y: CENTER_Y + 20,
            width: 30,
            height: 40,
            rotation: -30,
          },
        ],
        availableShapes: [
          { shape: "triangle", color: "#EF4444", count: 3 },
          { shape: "rectangle", color: "#6B7280", count: 1 },
        ],
        targetDescription:
          "A rocket with a triangle nose, rectangle body, and two triangle fins",
      };
    case "boat":
      return {
        slots: [
          {
            id: `${idPrefix}-s0`,
            shape: "trapezoid",
            x: CENTER_X - 80,
            y: CENTER_Y + 10,
            width: 160,
            height: 60,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s1`,
            shape: "rectangle",
            x: CENTER_X - 20,
            y: CENTER_Y - 40,
            width: 40,
            height: 50,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s2`,
            shape: "triangle",
            x: CENTER_X + 25,
            y: CENTER_Y - 70,
            width: 50,
            height: 80,
            rotation: 0,
          },
        ],
        availableShapes: [
          { shape: "trapezoid", color: "#92400E", count: 1 },
          { shape: "rectangle", color: "#3B82F6", count: 1 },
          { shape: "triangle", color: "#F59E0B", count: 1 },
        ],
        targetDescription:
          "A boat with a trapezoid hull, rectangle cabin, and triangle sail",
      };
    case "cat":
      return {
        slots: [
          {
            id: `${idPrefix}-s0`,
            shape: "circle",
            x: CENTER_X - 35,
            y: CENTER_Y - 70,
            width: 70,
            height: 70,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s1`,
            shape: "triangle",
            x: CENTER_X - 35,
            y: CENTER_Y - 95,
            width: 25,
            height: 25,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s2`,
            shape: "triangle",
            x: CENTER_X + 10,
            y: CENTER_Y - 95,
            width: 25,
            height: 25,
            rotation: 0,
          },
          {
            id: `${idPrefix}-s3`,
            shape: "circle",
            x: CENTER_X - 45,
            y: CENTER_Y + 10,
            width: 90,
            height: 80,
            rotation: 0,
          },
        ],
        availableShapes: [
          { shape: "circle", color: "#F59E0B", count: 2 },
          { shape: "triangle", color: "#F59E0B", count: 2 },
        ],
        targetDescription:
          "A cat with a circle head, two triangle ears, and a circle body",
      };
    default:
      return getPictureLayout("house", idPrefix);
  }
}

const PICTURE_NAMES_K = ["house", "tree", "rocket"];
const PICTURE_NAMES_G1 = [...PICTURE_NAMES_K, "boat", "cat"];

// ---------------------------------------------------------------------------
// Decompose: composite shape library
// ---------------------------------------------------------------------------

interface DecomposeTemplate {
  compositeShapePath: string;
  compositeDescription: string;
  expectedComponents: ShapeComposerComponent[];
  divisionLineHints: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
}

function getDecomposeTemplate(
  description: string,
  _components?: { shape: string; count: number }[],
): DecomposeTemplate {
  const cx = CENTER_X;
  const cy = CENTER_Y;
  const size = 120;
  const half = size / 2;

  // Map description keywords to known templates
  const desc = description.toLowerCase();

  if (desc.includes("square") && desc.includes("triangle")) {
    // Square made of 2 triangles
    return {
      compositeShapePath: `M ${cx - half} ${cy - half} L ${cx + half} ${cy - half} L ${cx + half} ${cy + half} L ${cx - half} ${cy + half} Z`,
      compositeDescription: "A square that can be split into 2 triangles",
      expectedComponents: [{ shape: "triangle", count: 2 }],
      divisionLineHints: [
        {
          x1: cx - half,
          y1: cy - half,
          x2: cx + half,
          y2: cy + half,
        },
      ],
    };
  }

  if (desc.includes("rectangle") && desc.includes("square")) {
    // Rectangle made of 2 squares
    return {
      compositeShapePath: `M ${cx - half * 1.5} ${cy - half * 0.75} L ${cx + half * 1.5} ${cy - half * 0.75} L ${cx + half * 1.5} ${cy + half * 0.75} L ${cx - half * 1.5} ${cy + half * 0.75} Z`,
      compositeDescription: "A rectangle that can be split into 2 squares",
      expectedComponents: [{ shape: "square", count: 2 }],
      divisionLineHints: [
        {
          x1: cx,
          y1: cy - half * 0.75,
          x2: cx,
          y2: cy + half * 0.75,
        },
      ],
    };
  }

  if (desc.includes("house") || desc.includes("pentagon")) {
    // House shape = square + triangle
    return {
      compositeShapePath: `M ${cx - half} ${cy - half * 0.3} L ${cx} ${cy - half * 1.2} L ${cx + half} ${cy - half * 0.3} L ${cx + half} ${cy + half} L ${cx - half} ${cy + half} Z`,
      compositeDescription:
        "A house shape that can be split into a square and a triangle",
      expectedComponents: [
        { shape: "square", count: 1 },
        { shape: "triangle", count: 1 },
      ],
      divisionLineHints: [
        {
          x1: cx - half,
          y1: cy - half * 0.3,
          x2: cx + half,
          y2: cy - half * 0.3,
        },
      ],
    };
  }

  if (desc.includes("diamond") || desc.includes("rhombus")) {
    // Diamond = 2 triangles
    return {
      compositeShapePath: `M ${cx} ${cy - half} L ${cx + half} ${cy} L ${cx} ${cy + half} L ${cx - half} ${cy} Z`,
      compositeDescription: "A diamond that can be split into 2 triangles",
      expectedComponents: [{ shape: "triangle", count: 2 }],
      divisionLineHints: [
        { x1: cx - half, y1: cy, x2: cx + half, y2: cy },
      ],
    };
  }

  if (desc.includes("arrow")) {
    // Arrow = triangle + rectangle
    return {
      compositeShapePath: `M ${cx} ${cy - half * 1.2} L ${cx + half * 0.8} ${cy - half * 0.2} L ${cx + half * 0.35} ${cy - half * 0.2} L ${cx + half * 0.35} ${cy + half} L ${cx - half * 0.35} ${cy + half} L ${cx - half * 0.35} ${cy - half * 0.2} L ${cx - half * 0.8} ${cy - half * 0.2} Z`,
      compositeDescription:
        "An arrow that can be split into a triangle and a rectangle",
      expectedComponents: [
        { shape: "triangle", count: 1 },
        { shape: "rectangle", count: 1 },
      ],
      divisionLineHints: [
        {
          x1: cx - half * 0.8,
          y1: cy - half * 0.2,
          x2: cx + half * 0.8,
          y2: cy - half * 0.2,
        },
      ],
    };
  }

  // Default: square = 2 triangles
  return {
    compositeShapePath: `M ${cx - half} ${cy - half} L ${cx + half} ${cy - half} L ${cx + half} ${cy + half} L ${cx - half} ${cy + half} Z`,
    compositeDescription: "A square that can be split into 2 triangles",
    expectedComponents: [{ shape: "triangle", count: 2 }],
    divisionLineHints: [
      {
        x1: cx - half,
        y1: cy - half,
        x2: cx + half,
        y2: cy + half,
      },
    ],
  };
}

const DECOMPOSE_DESCRIPTIONS_K = [
  "square made of triangles",
  "rectangle made of squares",
  "house shape with square and triangle",
  "diamond made of triangles",
];
const DECOMPOSE_DESCRIPTIONS_G1 = [
  ...DECOMPOSE_DESCRIPTIONS_K,
  "arrow made of triangle and rectangle",
];

// ---------------------------------------------------------------------------
// Flat-field helpers
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

function collectFlatComponents(
  flat: FlatChallenge,
  maxSlots: number,
): ShapeComposerComponent[] {
  const comps: ShapeComposerComponent[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const s = flat[`component${i}Shape`];
    const c = flat[`component${i}Count`];
    if (typeof s === "string" && s.length > 0 && typeof c === "number" && c > 0) {
      comps.push({ shape: s, count: c });
    }
  }
  return comps;
}

function collectFlatStrings(
  flat: FlatChallenge,
  prefix: string,
  maxSlots: number,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const v = flat[`${prefix}${i}`];
    if (typeof v === "string" && v.length > 0) out.push(v);
  }
  return out;
}

// ===========================================================================
// Per-type schemas — Gemini generates CONCEPTS only, not geometry
// ===========================================================================

const composeMatchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the shape activity" },
    description: {
      type: Type.STRING,
      description: "Brief educational description",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: {
            type: Type.STRING,
            description:
              "Student-facing instruction e.g. 'Use the triangles to fill the square!'",
          },
          hint: {
            type: Type.STRING,
            description: "Hint shown after wrong attempts",
          },
          targetShape: {
            type: Type.STRING,
            description:
              "Target shape name: 'large-square', 'rectangle', 'large-triangle', 'hexagon', 'trapezoid'",
          },
        },
        required: ["id", "instruction", "hint", "targetShape"],
      },
      description: "5-6 compose-match challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const composePictureSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the shape activity" },
    description: {
      type: Type.STRING,
      description: "Brief educational description",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: {
            type: Type.STRING,
            description:
              "Student-facing instruction e.g. 'Build a house using shapes!'",
          },
          hint: {
            type: Type.STRING,
            description: "Hint shown after wrong attempts",
          },
          targetPicture: {
            type: Type.STRING,
            description:
              "Picture name: 'house', 'tree', 'rocket', 'boat', 'cat'",
          },
        },
        required: ["id", "instruction", "hint", "targetPicture"],
      },
      description: "5-6 compose-picture challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const decomposeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the shape activity" },
    description: {
      type: Type.STRING,
      description: "Brief educational description",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: {
            type: Type.STRING,
            description:
              "Student-facing instruction e.g. 'What shapes make up this figure?'",
          },
          hint: {
            type: Type.STRING,
            description: "Hint shown after wrong attempts",
          },
          compositeDescription: {
            type: Type.STRING,
            description:
              "Description of the composite shape, e.g. 'square made of triangles', 'house shape with square and triangle', 'diamond made of triangles', 'rectangle made of squares', 'arrow made of triangle and rectangle'",
          },
          component0Shape: {
            type: Type.STRING,
            description: "1st component shape name",
          },
          component0Count: {
            type: Type.NUMBER,
            description: "How many of component 0",
          },
          component1Shape: {
            type: Type.STRING,
            description: "2nd component shape name (optional)",
          },
          component1Count: {
            type: Type.NUMBER,
            description: "How many of component 1 (optional)",
          },
        },
        required: [
          "id",
          "instruction",
          "hint",
          "compositeDescription",
          "component0Shape",
          "component0Count",
        ],
      },
      description: "5-6 decompose challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const howManyWaysSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the shape activity" },
    description: {
      type: Type.STRING,
      description: "Brief educational description",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: {
            type: Type.STRING,
            description:
              "Student-facing instruction e.g. 'How many triangles do you need to make a square?'",
          },
          hint: {
            type: Type.STRING,
            description: "Hint shown after wrong attempts",
          },
          targetForComposition: {
            type: Type.STRING,
            description:
              "The target shape to build: 'square', 'rectangle', 'hexagon', 'large-triangle', 'trapezoid'",
          },
          allowedPiece0: {
            type: Type.STRING,
            description: "1st allowed piece shape name",
          },
          allowedPiece1: {
            type: Type.STRING,
            description: "2nd allowed piece shape name (optional)",
          },
          allowedPiece2: {
            type: Type.STRING,
            description: "3rd allowed piece shape name (optional)",
          },
          minimumPiecesNeeded: {
            type: Type.NUMBER,
            description:
              "Minimum number of pieces needed to build the target. This is the correct answer.",
          },
        },
        required: [
          "id",
          "instruction",
          "hint",
          "targetForComposition",
          "allowedPiece0",
          "minimumPiecesNeeded",
        ],
      },
      description: "5-6 how-many-ways challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const freeCreateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the shape activity" },
    description: {
      type: Type.STRING,
      description: "Brief educational description",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: {
            type: Type.STRING,
            description:
              "Creative prompt e.g. 'Use shapes to build your favorite animal!'",
          },
        },
        required: ["id", "instruction"],
      },
      description: "3-4 free-create challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

// ===========================================================================
// Per-type sub-generators
// ===========================================================================

async function generateComposeMatchChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
): Promise<ShapeComposerChallenge[]> {
  const targets =
    gradeBand === "1" ? COMPOSE_MATCH_TARGETS_G1 : COMPOSE_MATCH_TARGETS_K;
  const prompt = `
Create an educational SHAPE COMPOSITION activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students drag smaller shapes to fill a target silhouette.

${gradeShapesPrompt(gradeBand)}

For each challenge:
- Set targetShape to one of: ${targets.join(", ")}
- Write a warm, encouraging instruction that names the target shape
- Write a helpful hint about spatial reasoning
- Vary the target shapes across challenges

Generate 5-6 challenges progressing in difficulty.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: composeMatchSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat, idx): ShapeComposerChallenge | null => {
      const targetShape = flat.targetShape as string;
      if (!targetShape || !targets.includes(targetShape)) return null;

      const template = getComposeMatchTemplate(targetShape, `cm${idx}`);

      return {
        id: flat.id as string,
        type: "compose-match",
        instruction: flat.instruction as string,
        hint: (flat.hint as string) || "Try rotating and moving the pieces!",
        targetShape,
        targetOutlinePath: template.targetOutlinePath,
        pieces: template.pieces,
      };
    })
    .filter((c): c is ShapeComposerChallenge => c !== null);
}

async function generateComposePictureChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
): Promise<ShapeComposerChallenge[]> {
  const pictures =
    gradeBand === "1" ? PICTURE_NAMES_G1 : PICTURE_NAMES_K;
  const prompt = `
Create an educational SHAPE PICTURE-BUILDING activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students build a recognizable picture by placing basic shapes into slots.

${gradeShapesPrompt(gradeBand)}

For each challenge:
- Set targetPicture to one of: ${pictures.join(", ")}
- Write a warm instruction that describes what the student is building
- Write a helpful hint about which shapes go where
- Vary the pictures across challenges

Generate 5-6 challenges progressing in difficulty.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: composePictureSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat, idx): ShapeComposerChallenge | null => {
      const targetPicture = flat.targetPicture as string;
      if (!targetPicture || !pictures.includes(targetPicture)) return null;

      const layout = getPictureLayout(targetPicture, `cp${idx}`);

      return {
        id: flat.id as string,
        type: "compose-picture",
        instruction: flat.instruction as string,
        hint: (flat.hint as string) || "Match each shape to the right spot!",
        targetPicture,
        targetDescription: layout.targetDescription,
        availableShapes: layout.availableShapes,
        pictureSlots: layout.slots,
      };
    })
    .filter((c): c is ShapeComposerChallenge => c !== null);
}

async function generateDecomposeChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
): Promise<ShapeComposerChallenge[]> {
  const descriptions =
    gradeBand === "1"
      ? DECOMPOSE_DESCRIPTIONS_G1
      : DECOMPOSE_DESCRIPTIONS_K;
  const prompt = `
Create an educational SHAPE DECOMPOSITION activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students look at a composite shape and identify which basic shapes make it up.

${gradeShapesPrompt(gradeBand)}

For each challenge:
- Set compositeDescription to one of: ${descriptions.map((d) => `"${d}"`).join(", ")}
- Set component0Shape and component0Count (required), optionally component1Shape/Count
- The components MUST match the compositeDescription exactly
- Write a warm instruction asking what shapes they see
- Write a helpful hint about looking for hidden shapes

Generate 5-6 challenges progressing in difficulty.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: decomposeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): ShapeComposerChallenge | null => {
      const compositeDescription = flat.compositeDescription as string;
      if (!compositeDescription) return null;

      // Get deterministic geometry from the description
      const geminiComponents = collectFlatComponents(flat, 4);
      const template = getDecomposeTemplate(
        compositeDescription,
        geminiComponents.length > 0 ? geminiComponents : undefined,
      );

      return {
        id: flat.id as string,
        type: "decompose",
        instruction: flat.instruction as string,
        hint:
          (flat.hint as string) ||
          "Look for lines that split the shape into smaller shapes!",
        compositeShapePath: template.compositeShapePath,
        compositeDescription: template.compositeDescription,
        expectedComponents: template.expectedComponents,
        divisionLineHints: template.divisionLineHints,
      };
    })
    .filter((c): c is ShapeComposerChallenge => c !== null);
}

async function generateHowManyWaysChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
): Promise<ShapeComposerChallenge[]> {
  const shapes = gradeShapes(gradeBand);
  const prompt = `
Create an educational "HOW MANY PIECES" activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students answer how many of a given small shape are needed to build a larger shape.

${gradeShapesPrompt(gradeBand)}

Known correct answers:
- "square" from triangles: minimumPiecesNeeded = 2
- "rectangle" from squares: minimumPiecesNeeded = 2
- "large-triangle" from smaller triangles: minimumPiecesNeeded = 4
- "hexagon" from triangles: minimumPiecesNeeded = 6
- "trapezoid" from triangles: minimumPiecesNeeded = 3

For each challenge:
- Set targetForComposition to one of the target shapes above
- Set allowedPiece0 (required) to the piece shape. Optionally set allowedPiece1, allowedPiece2.
- Set minimumPiecesNeeded to the CORRECT number from the list above
- Write a warm instruction asking "How many [piece] do you need to build a [target]?"
- Write a helpful hint

Generate 5-6 challenges progressing in difficulty. Use ONLY the known targets and correct answers above.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: howManyWaysSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  // Known correct answers — override whatever Gemini says
  const KNOWN_ANSWERS: Record<string, number> = {
    "square:triangle": 2,
    "rectangle:square": 2,
    "large-triangle:triangle": 4,
    "hexagon:triangle": 6,
    "trapezoid:triangle": 3,
  };

  return (data.challenges as FlatChallenge[])
    .map((flat): ShapeComposerChallenge | null => {
      const target = flat.targetForComposition as string;
      if (!target) return null;

      const allowedPieces = collectFlatStrings(flat, "allowedPiece", 3);
      if (allowedPieces.length === 0) return null;

      // Derive correct answer deterministically
      const lookupKey = `${target}:${allowedPieces[0]}`;
      const correctMin = KNOWN_ANSWERS[lookupKey];
      if (!correctMin) return null; // unknown combination, skip

      return {
        id: flat.id as string,
        type: "how-many-ways",
        instruction: flat.instruction as string,
        hint:
          (flat.hint as string) ||
          "Think about how the small shapes fit together!",
        targetForComposition: target,
        allowedPieces,
        minimumPiecesNeeded: correctMin,
      };
    })
    .filter((c): c is ShapeComposerChallenge => c !== null);
}

async function generateFreeCreateChallenges(
  topic: string,
  gradeLevel: string,
  _gradeBand: string,
): Promise<ShapeComposerChallenge[]> {
  const prompt = `
Create an educational FREE-CREATE shape activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students freely place shapes to create anything they imagine.
Each challenge is an open-ended creative prompt. There is no wrong answer — just creative play.

For each challenge:
- Write a fun, imaginative instruction like "Use shapes to build your dream house!" or "Create a funny robot using shapes!"
- Keep it encouraging and open-ended

Generate 3-4 creative challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: freeCreateSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map(
      (flat): ShapeComposerChallenge => ({
        id: flat.id as string,
        type: "free-create",
        instruction:
          (flat.instruction as string) ||
          "Use shapes to create something amazing!",
      }),
    );
}

// ===========================================================================
// Fallbacks — one per type, correct by construction
// ===========================================================================

const CM_FALLBACK = getComposeMatchTemplate("large-square", "fb-cm");
const CP_FALLBACK = getPictureLayout("house", "fb-cp");
const DC_FALLBACK = getDecomposeTemplate("square made of triangles");

const FALLBACKS: Record<string, ShapeComposerChallenge> = {
  "compose-match": {
    id: "c1",
    type: "compose-match",
    instruction: "Use the triangles to fill the square!",
    hint: "Try rotating the triangles to fit.",
    targetShape: "large-square",
    targetOutlinePath: CM_FALLBACK.targetOutlinePath,
    pieces: CM_FALLBACK.pieces,
  },
  "compose-picture": {
    id: "c1",
    type: "compose-picture",
    instruction: "Build a house using shapes!",
    hint: "The square is the body, the triangle is the roof.",
    targetPicture: "house",
    targetDescription: CP_FALLBACK.targetDescription,
    availableShapes: CP_FALLBACK.availableShapes,
    pictureSlots: CP_FALLBACK.slots,
  },
  decompose: {
    id: "c1",
    type: "decompose",
    instruction: "What shapes make up this square?",
    hint: "Look for a line that splits it into triangles!",
    compositeShapePath: DC_FALLBACK.compositeShapePath,
    compositeDescription: DC_FALLBACK.compositeDescription,
    expectedComponents: DC_FALLBACK.expectedComponents,
    divisionLineHints: DC_FALLBACK.divisionLineHints,
  },
  "free-create": {
    id: "c1",
    type: "free-create",
    instruction: "Use shapes to create anything you like!",
  },
  "how-many-ways": {
    id: "c1",
    type: "how-many-ways",
    instruction: "How many triangles do you need to make a square?",
    hint: "Try fitting triangles into a square shape.",
    targetForComposition: "square",
    allowedPieces: ["triangle"],
    minimumPiecesNeeded: 2,
  },
};

// ===========================================================================
// Main generator — dispatches to per-type sub-generators
// ===========================================================================

export const generateShapeComposer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<ShapeComposerData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    "shape-composer",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution("ShapeComposer", config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(gradeLevel);
  const allowedTypes =
    evalConstraint?.allowedTypes ?? Object.keys(CHALLENGE_TYPE_DOCS);

  // ── Dispatch sub-generators in parallel ──
  const generators: Promise<ShapeComposerChallenge[]>[] = [];
  const typeOrder: string[] = [];

  for (const type of allowedTypes) {
    typeOrder.push(type);
    switch (type) {
      case "compose-match":
        generators.push(
          generateComposeMatchChallenges(topic, gradeLevel, gradeBand),
        );
        break;
      case "compose-picture":
        generators.push(
          generateComposePictureChallenges(topic, gradeLevel, gradeBand),
        );
        break;
      case "decompose":
        generators.push(
          generateDecomposeChallenges(topic, gradeLevel, gradeBand),
        );
        break;
      case "how-many-ways":
        generators.push(
          generateHowManyWaysChallenges(topic, gradeLevel, gradeBand),
        );
        break;
      case "free-create":
        generators.push(
          generateFreeCreateChallenges(topic, gradeLevel, gradeBand),
        );
        break;
    }
  }

  const results = await Promise.all(generators);

  // ── Combine results ──
  let challenges: ShapeComposerChallenge[] = results.flat();

  // Re-assign IDs sequentially
  challenges = challenges.map((c, i) => ({ ...c, id: `c${i + 1}` }));

  // ── Fallback if empty ──
  if (challenges.length === 0) {
    const fallbackType = allowedTypes[0] ?? "compose-match";
    console.log(
      `[ShapeComposer] No valid challenges — using ${fallbackType} fallback`,
    );
    challenges = [FALLBACKS[fallbackType] ?? FALLBACKS["compose-match"]];
  }

  // ── Build title ──
  const typeLabels: Record<string, string> = {
    "compose-match": "Shape Composition",
    "compose-picture": "Picture Building",
    decompose: "Shape Decomposition",
    "free-create": "Creative Shapes",
    "how-many-ways": "Shape Counting",
  };

  let title = "Shape Composer Fun!";
  let description =
    "Practice combining and breaking apart shapes to build spatial reasoning.";

  if (allowedTypes.length === 1) {
    title = `${typeLabels[allowedTypes[0]] ?? "Shape"} Fun!`;
    description = `Practice ${(typeLabels[allowedTypes[0]] ?? "shape skills").toLowerCase()} with shapes.`;
  }

  const typeBreakdown = challenges.map((c) => c.type).join(", ");
  console.log(
    `[ShapeComposer] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`,
  );

  return {
    title,
    description,
    challenges,
    gradeBand: gradeBand as "K" | "1",
  };
};
