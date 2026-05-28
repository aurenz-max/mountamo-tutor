import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import type {
  PolygonAreaBuilderData,
  PolygonAreaChallenge,
  PolygonAreaChallengeType,
  CompositeRect,
  PolygonVertex,
} from "../../primitives/visual-primitives/math/PolygonAreaBuilder";

// ---------------------------------------------------------------------------
// Challenge type docs (one per eval mode)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  decompose: {
    promptDoc:
      `"decompose": Grade 6 entry. The student slides the cut triangle off a parallelogram to rebuild it as a rectangle, `
      + `then finds base × height. Teaches conservation of area. Whole-number base/height.`,
    schemaDescription: "'decompose' (rearrange a parallelogram into a rectangle)",
  },
  find_area_triangle_parallelogram: {
    promptDoc:
      `"find_area_triangle_parallelogram": Grade 6. Given a labeled triangle (½·b·h) or parallelogram (b·h), the student computes the area. `
      + `Whole-number dimensions; perpendicular height is shown.`,
    schemaDescription: "'find_area_triangle_parallelogram' (area of a triangle or parallelogram)",
  },
  find_area_trapezoid: {
    promptDoc:
      `"find_area_trapezoid": Grade 6-7. Trapezoid area via the average-of-bases method ½·(b1+b2)·h. `
      + `Whole-number bases and height with clean (integer) area.`,
    schemaDescription: "'find_area_trapezoid' (area of a trapezoid)",
  },
  composite_area: {
    promptDoc:
      `"composite_area": Grade 6-7. An L-shaped figure built from labeled rectangles. The student decomposes it `
      + `into the known rectangles and sums the areas.`,
    schemaDescription: "'composite_area' (decompose an irregular figure into rectangles)",
  },
  coordinate_polygon: {
    promptDoc:
      `"coordinate_polygon": Grade 7. A polygon plotted on a coordinate grid with labeled vertices. The student finds `
      + `its area by decomposition or bounding-box reasoning. Integer vertices in the first quadrant; clean area.`,
    schemaDescription: "'coordinate_polygon' (area of a polygon from vertex coordinates)",
  },
};

// ---------------------------------------------------------------------------
// Per-mode instance counts
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<PolygonAreaChallengeType, number> = {
  decompose: 4,
  find_area_triangle_parallelogram: 4,
  find_area_trapezoid: 4,
  composite_area: 4,
  coordinate_polygon: 4,
};

// ---------------------------------------------------------------------------
// Pool helpers (deterministic, per-challenge values built locally)
// ---------------------------------------------------------------------------

const UNIT_POOL = ['cm', 'm', 'ft', 'in', 'yd', 'units'];

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TRIANGLE_CTX = ['A sail on a sailboat', 'A slice of pizza', 'A triangular pennant flag', 'A yield road sign', 'A triangular garden bed'];
const PARA_CTX = ['A parking space painted at a slant', 'A floor tile', 'The side panel of a ramp', 'A leaning bookshelf panel'];
const TRAP_CTX = ['A table top', 'The cross-section of a bucket', 'A garden plot', 'A lampshade panel', 'A dam wall cross-section'];
const COMP_CTX = ['An L-shaped room floor', 'An L-shaped garden bed', 'A deck wrapping a corner', 'The side profile of a staircase'];
const COORD_CTX = ['A park drawn on a city map grid', 'A plot of land on a survey grid', 'A field marked on graph paper'];

function shoelace(vs: PolygonVertex[]): number {
  let sum = 0;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// ---- Per-figure builders (return a challenge without an id) ----

type RawChallenge = Omit<PolygonAreaChallenge, 'id'>;

function buildDecompose(): RawChallenge {
  const base = randInt(5, 12);
  const height = randInt(3, 9);
  const skew = randInt(1, Math.min(base - 1, 4));
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'decompose',
    figureType: 'parallelogram',
    base, height, skew,
    expectedArea: base * height,
    unitLabel,
    narration: `${pick(PARA_CTX)} is shaped like this parallelogram.`,
    instruction: 'Drag the cut triangle across to rebuild it as a rectangle, then enter base × height.',
    hint: 'A parallelogram rearranges into a rectangle with the SAME base and height. Area = base × height.',
  };
}

function buildTriangleFA(): RawChallenge {
  let base = randInt(4, 16);
  let height = randInt(3, 12);
  if ((base * height) % 2 !== 0) {
    // make the product even so ½·b·h is an integer
    if (height < 12) height += 1; else base += 1;
  }
  const apexX = randInt(1, base - 1);
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'find_area_triangle_parallelogram',
    figureType: 'triangle',
    base, height, apexX,
    expectedArea: (base * height) / 2,
    unitLabel,
    narration: `${pick(TRIANGLE_CTX)} is shaped like this triangle.`,
    instruction: 'Find the area of this triangle.',
    hint: 'A triangle is half of a rectangle. Area = ½ × base × height. Use the perpendicular (dashed) height, not a slanted side.',
  };
}

function buildParallelogramFA(): RawChallenge {
  const base = randInt(4, 14);
  const height = randInt(3, 10);
  const skew = randInt(1, 4);
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'find_area_triangle_parallelogram',
    figureType: 'parallelogram',
    base, height, skew,
    expectedArea: base * height,
    unitLabel,
    narration: `${pick(PARA_CTX)} is shaped like this parallelogram.`,
    instruction: 'Find the area of this parallelogram.',
    hint: 'Area of a parallelogram = base × height. Use the perpendicular (dashed) height.',
  };
}

function buildTrapezoid(): RawChallenge {
  const base2 = randInt(2, 8);                 // top base
  const extra = 2 * randInt(1, 4);             // keep (base - base2) even → integer topOffset
  const base = base2 + extra;                  // bottom base
  const height = randInt(3, 10);
  const topOffset = (base - base2) / 2;        // isosceles
  const unitLabel = pick(UNIT_POOL);
  // (base + base2) is even, so the area is always an integer.
  return {
    type: 'find_area_trapezoid',
    figureType: 'trapezoid',
    base, base2, height, topOffset,
    expectedArea: ((base + base2) * height) / 2,
    unitLabel,
    narration: `${pick(TRAP_CTX)} is shaped like this trapezoid.`,
    instruction: 'Find the area of this trapezoid.',
    hint: 'Average the two bases, then multiply by the height: ½ × (b₁ + b₂) × height.',
  };
}

function buildComposite(): RawChallenge {
  const W = randInt(5, 10);      // bottom rectangle width
  const h1 = randInt(2, 5);      // bottom rectangle height
  const w2 = randInt(2, W - 1);  // top rectangle width (narrower → makes an L)
  const h2 = randInt(2, 5);      // top rectangle height
  const onLeft = Math.random() < 0.5;
  const topX = onLeft ? 0 : W - w2;
  const parts: CompositeRect[] = [
    { x: 0, y: 0, w: W, h: h1 },
    { x: topX, y: h1, w: w2, h: h2 },
  ];
  const expectedArea = W * h1 + w2 * h2;
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'composite_area',
    figureType: 'composite',
    parts,
    expectedArea,
    unitLabel,
    narration: `${pick(COMP_CTX)} is shaped like this figure.`,
    instruction: 'Split the figure into rectangles, find each area, then add them up.',
    hint: 'Break the L-shape into two rectangles. Find length × width for each piece, then add the two areas.',
  };
}

function buildCoordinate(variant: 'rectangle' | 'right_triangle'): RawChallenge {
  const x0 = randInt(0, 3);
  const y0 = randInt(0, 3);
  let vertices: PolygonVertex[];
  let expectedArea: number;
  if (variant === 'rectangle') {
    const w = randInt(3, 8);
    const h = randInt(2, 6);
    vertices = [
      { x: x0, y: y0 },
      { x: x0 + w, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h },
    ];
    expectedArea = w * h;
  } else {
    let a = randInt(3, 8);   // horizontal leg
    let b = randInt(2, 7);   // vertical leg
    if ((a * b) % 2 !== 0) { if (b < 7) b += 1; else a += 1; } // even product → integer area
    vertices = [
      { x: x0, y: y0 },
      { x: x0 + a, y: y0 },
      { x: x0, y: y0 + b },
    ];
    expectedArea = (a * b) / 2;
  }
  return {
    type: 'coordinate_polygon',
    figureType: 'coordinate',
    vertices,
    expectedArea,
    unitLabel: 'units',
    narration: `${pick(COORD_CTX)} — find its area from the corner coordinates.`,
    instruction: 'Find the area of this polygon using its vertex coordinates.',
    hint: 'Count the width and height between corners. A rectangle is width × height; a right triangle is ½ × base × height.',
  };
}

// ---- Canonical key for de-duplication within a session ----

function canonicalKey(ch: RawChallenge): string {
  switch (ch.type) {
    case 'decompose':
    case 'find_area_triangle_parallelogram':
      return `${ch.figureType}|${ch.base}|${ch.height}|${ch.skew ?? ch.apexX ?? 0}`;
    case 'find_area_trapezoid':
      return `trap|${ch.base}|${ch.base2}|${ch.height}`;
    case 'composite_area':
      return `comp|${(ch.parts ?? []).map((p) => `${p.x},${p.y},${p.w},${p.h}`).join(';')}`;
    case 'coordinate_polygon':
      return `coord|${(ch.vertices ?? []).map((v) => `${v.x},${v.y}`).join(';')}`;
  }
}

// ---------------------------------------------------------------------------
// Build N distinct challenges for a single-mode session
// ---------------------------------------------------------------------------

export function selectPolygonAreaChallenges(
  challengeType: PolygonAreaChallengeType,
  count?: number,
): PolygonAreaChallenge[] {
  const target = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, count ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT),
  );

  const builderFor = (): RawChallenge => {
    switch (challengeType) {
      case 'decompose':
        return buildDecompose();
      case 'find_area_trapezoid':
        return buildTrapezoid();
      case 'composite_area':
        return buildComposite();
      default:
        // never reached for the two multi-variant modes below
        return buildTrapezoid();
    }
  };

  const raw: RawChallenge[] = [];
  const seen = new Set<string>();

  if (challengeType === 'find_area_triangle_parallelogram') {
    // Variance rule: guarantee at least one triangle AND one parallelogram.
    const queue: Array<() => RawChallenge> = [buildTriangleFA, buildParallelogramFA];
    let i = 0;
    for (let attempt = 0; attempt < target * 10 && raw.length < target; attempt++) {
      const ch = (i < queue.length ? queue[i] : (Math.random() < 0.5 ? buildTriangleFA : buildParallelogramFA))();
      i++;
      const key = canonicalKey(ch);
      if (seen.has(key)) continue;
      seen.add(key);
      raw.push(ch);
    }
  } else if (challengeType === 'coordinate_polygon') {
    // Variance rule: rotate rectangle / right-triangle, guarantee at least one of each.
    const variants: Array<'rectangle' | 'right_triangle'> = ['rectangle', 'right_triangle'];
    let i = 0;
    for (let attempt = 0; attempt < target * 10 && raw.length < target; attempt++) {
      const v = i < variants.length ? variants[i] : (Math.random() < 0.5 ? 'rectangle' : 'right_triangle');
      i++;
      const ch = buildCoordinate(v);
      const key = canonicalKey(ch);
      if (seen.has(key)) continue;
      seen.add(key);
      raw.push(ch);
    }
  } else {
    for (let attempt = 0; attempt < target * 10 && raw.length < target; attempt++) {
      const ch = builderFor();
      const key = canonicalKey(ch);
      if (seen.has(key)) continue;
      seen.add(key);
      raw.push(ch);
    }
  }

  // Fallback — accept duplicates if the candidate space was too narrow.
  while (raw.length < target) {
    if (challengeType === 'find_area_triangle_parallelogram') {
      raw.push(Math.random() < 0.5 ? buildTriangleFA() : buildParallelogramFA());
    } else if (challengeType === 'coordinate_polygon') {
      raw.push(buildCoordinate(Math.random() < 0.5 ? 'rectangle' : 'right_triangle'));
    } else {
      raw.push(builderFor());
    }
  }

  // Easier → harder by area magnitude.
  const sorted = raw.sort((a, b) => a.expectedArea - b.expectedArea);
  return sorted.map((ch, i) => ({ ...ch, id: `pab-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Post-validation: recompute every expectedArea from its geometry.
// Pool builds locally, so this is a self-check that guards against drift.
// ---------------------------------------------------------------------------

function recomputeArea(ch: PolygonAreaChallenge): number | null {
  switch (ch.type) {
    case 'decompose':
      return (ch.base ?? 0) * (ch.height ?? 0);
    case 'find_area_triangle_parallelogram':
      return ch.figureType === 'triangle'
        ? ((ch.base ?? 0) * (ch.height ?? 0)) / 2
        : (ch.base ?? 0) * (ch.height ?? 0);
    case 'find_area_trapezoid':
      return ((ch.base ?? 0) + (ch.base2 ?? 0)) * (ch.height ?? 0) / 2;
    case 'composite_area':
      return (ch.parts ?? []).reduce((s, p) => s + p.w * p.h, 0);
    case 'coordinate_polygon':
      return ch.vertices && ch.vertices.length >= 3 ? shoelace(ch.vertices) : null;
  }
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const polygonAreaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-figure polygon-area session (e.g., 'Finding the Area of Polygons'). Do NOT name specific dimensions — the session walks through several figures.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: [
        'decompose',
        'find_area_triangle_parallelogram',
        'find_area_trapezoid',
        'composite_area',
        'coordinate_polygon',
      ],
      description: "Difficulty tier of the session. The system uses this to build the figure pool.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['6', '7'],
      description: "Target grade band (6 or 7).",
    },
  },
  required: ['title', 'description', 'challengeType'],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generatePolygonAreaBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: {
    instanceCount?: number;
    targetEvalMode?: string;
  },
): Promise<PolygonAreaBuilderData> => {
  const validTypes: PolygonAreaChallengeType[] = [
    'decompose',
    'find_area_triangle_parallelogram',
    'find_area_trapezoid',
    'composite_area',
    'coordinate_polygon',
  ];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'polygon-area-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(polygonAreaSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : polygonAreaSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-figure polygon-area session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A polygon-area session contains 3-6 separate geometric figures, all of the same challenge type.
- The system has ALREADY pre-built each figure (dimensions, coordinates, rectangle pieces) — you do NOT pick numbers, lengths, or coordinates.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}

REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific dimension or area value.
2. Provide a 1-2 sentence educational description of what students will practice.
3. Set challengeType to the correct difficulty tier (matches the constraint above).
4. Set gradeBand to "6" or "7".

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('PolygonAreaBuilder', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid polygon-area wrapper returned from Gemini API');
  }

  // ── Resolve challengeType (Gemini → eval constraint → safe default) ──
  let challengeType: PolygonAreaChallengeType = validTypes.includes(wrapper.challengeType as PolygonAreaChallengeType)
    ? (wrapper.challengeType as PolygonAreaChallengeType)
    : (evalConstraint?.allowedTypes[0] as PolygonAreaChallengeType) ?? 'find_area_triangle_parallelogram';
  if (!validTypes.includes(challengeType)) challengeType = 'find_area_triangle_parallelogram';

  // ── Build the per-challenge pool locally ──
  const challenges = selectPolygonAreaChallenges(challengeType, config?.instanceCount);

  // ── Post-validation: every expectedArea must match its geometry ──
  for (const ch of challenges) {
    const recomputed = recomputeArea(ch);
    if (recomputed === null || Math.abs(recomputed - ch.expectedArea) > 1e-6) {
      console.warn(`[PolygonAreaBuilder] Area mismatch on ${ch.id} (${ch.figureType}): stored ${ch.expectedArea}, recomputed ${recomputed}. Correcting.`);
      if (recomputed !== null) ch.expectedArea = recomputed;
    }
  }

  const gradeBand: '6' | '7' = wrapper.gradeBand === '7' || wrapper.gradeBand === '6'
    ? wrapper.gradeBand
    : (challengeType === 'coordinate_polygon' ? '7' : '6');

  const data: PolygonAreaBuilderData = {
    title: wrapper.title,
    description: wrapper.description,
    challengeType,
    gradeBand,
    challenges,
  };

  const summary = challenges
    .map((c) => `${c.figureType}=${c.expectedArea}${c.unitLabel}²`)
    .join(', ');
  console.log(`[PolygonAreaBuilder] Final: challengeType=${challengeType}, instances=${challenges.length} [${summary}]`);

  return data;
};
