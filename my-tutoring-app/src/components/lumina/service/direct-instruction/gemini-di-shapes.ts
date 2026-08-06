/**
 * gemini-di-shapes — menu-scoped generator for the di-shapes primitive
 * (DI pack #5). Fork A (menu service, the rhyme-studio K / di-letter-sounds
 * pattern): the item CONTENT is a code-owned shape menu — name, article,
 * sides/corners, judged alternates, ASR aliases, and drawable geometry all
 * live in code — and Gemini's only job is the session wrapper (kid title +
 * description) plus a targetShapes hint used ONLY when the objective text
 * names no shapes itself. Structured-output Gemini never emits a shape's
 * facts; it picks from an enum.
 *
 * SCOPE: the objective text is code-enforced over the model's pick. Shapes
 * NAMED in the text win outright ("triangles and circles" → those, even an
 * extended shape at K — the objective asked for it); then the model's hint,
 * filtered to the grade menu; then the grade default (the K.G.2 five).
 *
 * K CONVENTION (the pack's rule-#1 duty): at this band square and rectangle
 * are DIFFERENT answers, so the component draws rectangles clearly elongated
 * and ovals clearly non-circular — one drawing, one defensible name. The
 * "diamond" word belongs to rhombus as a judged alternate, never a menu entry.
 *
 * ANSWER-LEAK RULE: the wrapper (title/description) must never contain a
 * shape name — the child produces the names; they never read or hear them
 * from the chrome first. Guarded in code, defaults on violation.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type {
  DiShapesChallenge,
  DiShapeName,
} from "../../primitives/visual-primitives/direct-instruction/diShapesScript";
import type { DiShapesData } from "../../primitives/visual-primitives/direct-instruction/DiShapes";

// ── The code-owned shape menu ───────────────────────────────────────

interface ShapeSpec {
  word: string;
  article: 'a' | 'an';
  sides: number | null;
  corners: number | null;
  /** In the K.G.2 core five. Extended shapes serve G1+ or a naming objective. */
  core: boolean;
  /** Names the judge must also accept (stated per-item in the contract). */
  spokenAlternates?: string[];
  /** Passive ASR cross-check aliases (never the judge). */
  asrAliases: string[];
  /** Rotation cap (±deg). Square stays low — a 45° square reads as a diamond,
   *  which at K is a DIFFERENT percept than the skill being drilled. Curves
   *  don't rotate meaningfully. */
  maxRotationDeg: number;
}

export const SHAPE_MENU: Record<DiShapeName, ShapeSpec> = {
  circle: { word: 'circle', article: 'a', sides: null, corners: null, core: true, asrAliases: ['circle', 'circles', 'surkle'], maxRotationDeg: 0 },
  triangle: { word: 'triangle', article: 'a', sides: 3, corners: 3, core: true, asrAliases: ['triangle', 'triangles', 'twiangle'], maxRotationDeg: 25 },
  square: { word: 'square', article: 'a', sides: 4, corners: 4, core: true, asrAliases: ['square', 'squares', 'sware'], maxRotationDeg: 10 },
  rectangle: { word: 'rectangle', article: 'a', sides: 4, corners: 4, core: true, asrAliases: ['rectangle', 'rectangles', 'wectangle'], maxRotationDeg: 15 },
  hexagon: { word: 'hexagon', article: 'a', sides: 6, corners: 6, core: true, asrAliases: ['hexagon', 'hexagons'], maxRotationDeg: 25 },
  oval: { word: 'oval', article: 'an', sides: null, corners: null, core: false, asrAliases: ['oval', 'ovals'], maxRotationDeg: 0 },
  pentagon: { word: 'pentagon', article: 'a', sides: 5, corners: 5, core: false, asrAliases: ['pentagon', 'pentagons'], maxRotationDeg: 25 },
  rhombus: { word: 'rhombus', article: 'a', sides: 4, corners: 4, core: false, spokenAlternates: ['diamond'], asrAliases: ['rhombus', 'diamond', 'rhombuses'], maxRotationDeg: 15 },
  trapezoid: { word: 'trapezoid', article: 'a', sides: 4, corners: 4, core: false, asrAliases: ['trapezoid', 'trapezoids'], maxRotationDeg: 20 },
};

const ALL_SHAPES = Object.keys(SHAPE_MENU) as DiShapeName[];
const CORE_SHAPES = ALL_SHAPES.filter((s) => SHAPE_MENU[s].core);

/** Word → menu shape, including the K "diamond" word for rhombus. */
const SHAPE_WORD_LOOKUP: Record<string, DiShapeName> = {
  ...Object.fromEntries(ALL_SHAPES.map((s) => [SHAPE_MENU[s].word, s])),
  diamond: 'rhombus',
} as Record<string, DiShapeName>;

/** Shapes the objective text NAMES, in first-mention order, deduped. */
export const parseNamedShapes = (text: string): DiShapeName[] => {
  const named: DiShapeName[] = [];
  const re = new RegExp(
    `\\b(${Object.keys(SHAPE_WORD_LOOKUP).join('|')})s?\\b`,
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const shape = SHAPE_WORD_LOOKUP[m[1].toLowerCase()];
    if (shape && !named.includes(shape)) named.push(shape);
  }
  return named;
};

const isKindergarten = (gradeLevel: string): boolean =>
  /kinder|pre-?k|\bk\b/i.test(gradeLevel);

// ── Challenge builder (all fields derived — never from the LLM) ─────

/** Fisher-Yates. App code, not a workflow script — Math.random is fine. */
const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const rotationFor = (shape: DiShapeName): number => {
  const cap = SHAPE_MENU[shape].maxRotationDeg;
  if (cap === 0) return 0;
  return Math.round((Math.random() * 2 - 1) * cap);
};

const buildChallenge = (shape: DiShapeName, index: number): DiShapesChallenge => {
  const spec = SHAPE_MENU[shape];
  return {
    id: `dish-${index + 1}-${shape}`,
    challengeType: 'name_shape',
    shape,
    shapeWord: spec.word,
    article: spec.article,
    sides: spec.sides,
    corners: spec.corners,
    rotationDeg: rotationFor(shape),
    asrAliases: spec.asrAliases,
    ...(spec.spokenAlternates ? { spokenAlternates: spec.spokenAlternates } : {}),
  };
};

/**
 * The session's shape sequence: every selected shape appears before any
 * repeats (variance), repeats fill round-robin over a reshuffle, and the same
 * shape never runs back-to-back when more than one is in play.
 */
export const buildShapeSequence = (
  selected: DiShapeName[],
  count: number,
): DiShapeName[] => {
  const out: DiShapeName[] = [];
  let pool = shuffle(selected);
  while (out.length < count) {
    if (pool.length === 0) pool = shuffle(selected);
    const next = pool.find((s) => s !== out[out.length - 1]) ?? pool[0];
    pool = pool.filter((s, i) => i !== pool.indexOf(next));
    out.push(next);
  }
  return out;
};

const DEFAULT_INSTANCE_COUNT = 5;
const MAX_INSTANCE_COUNT = 6;

// ── Gemini wrapper (title/description/shape hint ONLY — Fork A) ─────

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, warm activity title for a young learner (e.g. 'Shape Detectives!'). " +
        "It MUST NOT contain any shape name — the shapes stay hidden until practice.",
    },
    description: {
      type: Type.STRING,
      description:
        "One friendly sentence telling the child they will look at shapes and say their names out loud. " +
        "Same rule: no shape names.",
    },
    targetShapes: {
      type: Type.ARRAY,
      minItems: '2',
      maxItems: '6',
      items: { type: Type.STRING, enum: ALL_SHAPES as string[] },
      description:
        "Your read of which shapes this objective drills. Used only when the objective text " +
        "does not name shapes itself.",
    },
  },
  required: ["title", "targetShapes"],
};

/** Answer-leak guard: any judged shape word (or "diamond") in the wrapper. */
const leaksShapeNames = (text: string): boolean =>
  new RegExp(`\\b(${Object.keys(SHAPE_WORD_LOOKUP).join('|')})s?\\b`, 'i').test(text);

const DEFAULT_TITLE = 'Shape Time';
const DEFAULT_DESCRIPTION = 'Look at each shape and say its name out loud!';

export const generateDiShapes = async (
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    /** L0 has one mode; accepted so the eval-test pin threads harmlessly. */
    targetEvalMode?: string;
    [key: string]: unknown;
  },
): Promise<DiShapesData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(3, config?.challengeCount ?? DEFAULT_INSTANCE_COUNT),
  );

  // Shapes the objective NAMES win outright — even an extended shape at K,
  // because the objective asked for it (trust-intent ruling).
  const scopeText = `${intent ?? ''} ${config?.objectiveText ?? ''} ${topic}`;
  const namedShapes = parseNamedShapes(scopeText);
  const gradeMenu = isKindergarten(gradeLevel) ? CORE_SHAPES : ALL_SHAPES;

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let modelShapes: DiShapeName[] = [];

  const prompt = `Scope a brisk Direct Instruction shape-naming practice (a drawn 2D shape on screen, spoken shape-name answers) for a young learner.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

RULES:
- Read the objective and pick which flat shapes it drills from the allowed list. A generic kindergarten shapes objective means the basic set: circle, triangle, square, rectangle, hexagon.
- Write a warm, short kid title and a one-sentence description. They MUST NOT contain any shape name — the child must produce the names, never read or hear them first.

Return the wrapper JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: wrapperSchema,
        systemInstruction:
          "You are an early-math specialist scoping a Direct Instruction shape-naming drill. " +
          "You classify which flat shapes the objective drills and write a warm kid-facing title " +
          "and description. You never reveal any shape name in the title or description.",
      },
    });
    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text) as {
        title?: string;
        description?: string;
        targetShapes?: unknown;
      };
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      if (Array.isArray(parsed.targetShapes)) {
        modelShapes = parsed.targetShapes
          .filter((s): s is DiShapeName => typeof s === 'string' && s in SHAPE_MENU);
      }
    }
  } catch (error) {
    console.error("Error generating di-shapes wrapper:", error);
  }

  // Answer-leak guard: the wrapper must never carry a shape name.
  if (leaksShapeNames(title) || leaksShapeNames(description)) {
    title = DEFAULT_TITLE;
    description = DEFAULT_DESCRIPTION;
  }

  // Scope ladder: named in text → model hint (grade-filtered) → grade default.
  const hinted = modelShapes.filter((s) => gradeMenu.includes(s));
  const selected: DiShapeName[] =
    namedShapes.length > 0 ? namedShapes
      : hinted.length >= 2 ? hinted
        : CORE_SHAPES;
  const scopeSource = namedShapes.length > 0 ? 'text' : hinted.length >= 2 ? 'model' : 'grade-default';

  const challenges = buildShapeSequence(selected, count)
    .map((shape, i) => buildChallenge(shape, i));

  const data: DiShapesData = {
    title,
    description,
    challengeType: 'name_shape',
    gradeLevel: gradeLevel || 'kindergarten',
    challenges,
  };

  console.log("DI Shapes Generated:", {
    title: data.title,
    scope: `${selected.join('+')} [${scopeSource}]`,
    items: challenges.map((c) => `${c.shape}@${c.rotationDeg}°`),
    count: challenges.length,
  });

  return data;
};
