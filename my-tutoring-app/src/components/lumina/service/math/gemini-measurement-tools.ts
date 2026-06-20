import { Type, Schema } from "@google/genai";
import {
  MeasurementToolsData,
  MeasurementToolsChallenge,
} from "../../primitives/visual-primitives/math/MeasurementTools";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

type ChallengeType = 'measure' | 'compare' | 'estimate' | 'convert';
type ShapeType = 'rectangle' | 'square';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  measure: {
    promptDoc:
      `"measure": Direct measurement — student drags each shape onto the ruler `
      + `and reads its width in whole units. Grades 1-3.`,
    schemaDescription: "'measure' (direct measurement with ruler)",
  },
  compare: {
    promptDoc:
      `"compare": Student measures every shape, then orders them shortest to `
      + `longest. Shapes share a similar but distinct width range so the ordering `
      + `task is meaningful. Grades 2-3.`,
    schemaDescription: "'compare' (measure and compare objects)",
  },
  estimate: {
    promptDoc:
      `"estimate": Half-inch precision — widths land on 0.5 increments and the `
      + `student must read between tick marks on the ruler. Grades 2-3.`,
    schemaDescription: "'estimate' (half-inch precision measurement)",
  },
  convert: {
    promptDoc:
      `"convert": Student measures each shape in one unit, then converts the `
      + `value to the other unit. Widths are chosen so the conversion lands on `
      + `clean numbers. Grades 3-4.`,
    schemaDescription: "'convert' (measure and convert between units)",
  },
};

// ---------------------------------------------------------------------------
// Support tiers — within-mode scaffolding withdrawal (FIXED harness)
// ---------------------------------------------------------------------------
// Second field of the two-field contract: targetEvalMode = WHICH skill (the
// task identity), difficulty = HOW MUCH on-screen / instructional support
// within it. A tier NEVER changes the shape widths or the unit — those are
// owned by the per-mode width pools below. easy = the workspace helps the
// student read the ruler; hard = the student measures unaided and counts.

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * Per-primitive support scaffold. Every field is display-/instruction-only —
 * the checker reads the typed answer against widthInches, so withdrawing any
 * of these leaves the answer and the task identity intact.
 */
interface SupportScaffold {
  /** Ruler tick-label density (perception aid #1). 'all' labels half ticks too
   *  (read-between support for estimate); 'sparse' labels only even wholes so
   *  the student must count marks. */
  rulerLabels: 'all' | 'whole' | 'sparse';
  /** How much the instruction names the align-at-0 / read-the-edge method (#2). */
  instructionDetail: 'full' | 'standard' | 'minimal';
  /** Attempts before the "Need a Hint?" button is offered (#2). */
  hintThreshold: number;
  /** convert mode: hand over the "1 inch = 2.54 cm" factor, or withdraw it (#2). */
  showConversionFactor: boolean;
  promptLines: string[];
}

function resolveSupportStructure(mode: ChallengeType, tier: SupportTier): SupportScaffold {
  const rulerLabels: SupportScaffold['rulerLabels'] =
    tier === 'easy' ? 'all' : tier === 'hard' ? 'sparse' : 'whole';
  const instructionDetail: SupportScaffold['instructionDetail'] =
    tier === 'easy' ? 'full' : tier === 'hard' ? 'minimal' : 'standard';
  const hintThreshold = tier === 'easy' ? 1 : tier === 'hard' ? 3 : 2;
  // The conversion factor is convert mode's keystone scaffold; only it withdraws.
  const showConversionFactor = mode === 'convert' ? tier !== 'hard' : true;

  const lines: string[] = [
    'This tier changes only on-screen / instructional SUPPORT — never the shape widths or the unit. Every measurement stays exactly in scope.',
  ];
  if (tier === 'easy') {
    lines.push('Easy support: warm, explicit title/description that names the measuring method (line the left edge up with 0, read where the right edge lands).');
    if (mode === 'estimate') lines.push('Reassure that the small marks between numbers are halves.');
    if (mode === 'convert') lines.push('State the conversion relationship plainly (1 inch = 2.54 cm).');
  } else if (tier === 'hard') {
    lines.push('Hard support: terse, neutral title/description. Do NOT spell out the align-at-0 / read-the-edge method or (for convert) the conversion factor — the student recalls those.');
  } else {
    lines.push('Medium support: standard title/description naming the task without a step-by-step method.');
  }
  return { rulerLabels, instructionDetail, hintThreshold, showConversionFactor, promptLines: lines };
}

// ---------------------------------------------------------------------------
// Pool service — deterministic per-mode challenge selection
// ---------------------------------------------------------------------------

const COLOR_POOL: readonly string[] = [
  'rgba(99,102,241,0.35)',   // indigo
  'rgba(239,68,68,0.35)',    // red
  'rgba(16,185,129,0.35)',   // emerald
  'rgba(168,85,247,0.35)',   // purple
  'rgba(245,158,11,0.35)',   // amber
  'rgba(14,165,233,0.35)',   // sky
];

const LABEL_PREFIX: Record<string, string> = {
  'rgba(99,102,241,0.35)': 'Blue',
  'rgba(239,68,68,0.35)': 'Red',
  'rgba(16,185,129,0.35)': 'Green',
  'rgba(168,85,247,0.35)': 'Purple',
  'rgba(245,158,11,0.35)': 'Amber',
  'rgba(14,165,233,0.35)': 'Sky',
};

const HINT_POOL: readonly string[] = [
  'Look where the right edge of the shape lines up on the ruler.',
  'Count the big tick marks from 0 to the edge of the shape.',
  'Find the number on the ruler where the shape ends.',
  'Line the left edge up with 0, then read where the right edge lands.',
  'The small marks between the numbers are halves. Count carefully.',
  'Measure from 0, not from 1. Where does the shape end?',
];

interface PoolConfig {
  /** Allowed widths in inches, before shuffling/dedup. */
  widthCandidates: number[];
  /** Step size for precision alignment (0.5 for estimate, 1 elsewhere). */
  precisionStep: 0.5 | 1;
  /** Grade band for the mode. */
  gradeBand: 'K-2' | '3-5';
}

const widthRange = (min: number, max: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) {
    out.push(Math.round(v / step) * step);
  }
  return out;
};

const poolConfigFor = (mode: ChallengeType, gradeBandHint?: 'K-2' | '3-5'): PoolConfig => {
  switch (mode) {
    case 'measure': {
      const gradeBand = gradeBandHint ?? 'K-2';
      const widths = gradeBand === 'K-2'
        ? widthRange(1, 8, 1)
        : widthRange(2, 10, 1);
      return { widthCandidates: widths, precisionStep: 1, gradeBand };
    }
    case 'compare': {
      const gradeBand = gradeBandHint ?? '3-5';
      // Widths close together so ordering is meaningful but distinct.
      const widths = gradeBand === 'K-2'
        ? widthRange(2, 8, 1)
        : widthRange(3, 9, 1);
      return { widthCandidates: widths, precisionStep: 1, gradeBand };
    }
    case 'estimate': {
      // Half-inch precision — widths between tick marks.
      const widths = widthRange(2, 10, 0.5).filter((w) => w % 1 !== 0);
      return { widthCandidates: widths, precisionStep: 0.5, gradeBand: '3-5' };
    }
    case 'convert': {
      // Widths chosen so inches↔cm conversion is clean.
      const widths = [2, 3, 4, 5, 6, 8, 10];
      return { widthCandidates: widths, precisionStep: 1, gradeBand: '3-5' };
    }
  }
};

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const pickDistinctWidths = (pool: number[], count: number): number[] => {
  const unique = Array.from(new Set(pool));
  const shuffled = shuffle(unique);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

const pickShapeType = (idx: number): ShapeType => {
  // ~30% squares, 70% rectangles. Deterministic by index for stable mix.
  return idx % 3 === 1 ? 'square' : 'rectangle';
};

/**
 * Deterministically select N measurement challenges for the given mode.
 *
 * Guarantees:
 * - All widths are distinct (no duplicate sizes per session).
 * - Widths fall within the mode's pedagogical range.
 * - Shapes are ordered smallest → largest for ruler workflow consistency.
 * - Colors cycle through the pool, no repeats within a session up to its size.
 */
const selectMeasurementChallenges = (
  mode: ChallengeType,
  count: number,
  gradeBandHint?: 'K-2' | '3-5',
): MeasurementToolsChallenge[] => {
  const target = Math.min(Math.max(count, 3), MAX_INSTANCE_COUNT);
  const config = poolConfigFor(mode, gradeBandHint);

  let widths = pickDistinctWidths(config.widthCandidates, target);
  // Fallback: if pool was too small, repeat the smallest with offset (rare).
  if (widths.length < target) {
    const extra = widths.length === 0 ? config.precisionStep : widths[widths.length - 1];
    while (widths.length < target) {
      widths.push(extra + config.precisionStep * widths.length);
    }
  }
  widths.sort((a, b) => a - b);

  const colors = shuffle(COLOR_POOL).slice(0, target);
  const hints = shuffle(HINT_POOL);

  return widths.map((w, idx) => {
    const shapeType = pickShapeType(idx);
    const widthInches = Math.round(w / config.precisionStep) * config.precisionStep;
    const color = colors[idx] ?? COLOR_POOL[idx % COLOR_POOL.length];
    const colorName = LABEL_PREFIX[color] ?? 'Blue';
    const heightInches = shapeType === 'square'
      ? widthInches
      : 1 + (idx % 2) * 0.5; // 1.0 or 1.5 for rectangles, deterministic per index

    return {
      id: `mt-${idx + 1}`,
      shapeType,
      widthInches,
      heightInches,
      color,
      label: `${colorName} ${shapeType === 'square' ? 'Square' : 'Rectangle'}`,
      hint: hints[idx % hints.length],
    };
  });
};

// ---------------------------------------------------------------------------
// Gemini wrapper schema — title + description + session-level mode flags only.
// Per-challenge data is built locally from the pool service.
// ---------------------------------------------------------------------------

const measurementToolsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      description: "Challenge type: 'measure', 'compare', 'estimate', or 'convert'.",
      enum: ["measure", "compare", "estimate", "convert"],
    },
    title: {
      type: Type.STRING,
      description: "Short activity title, e.g. 'Measure the Shapes'.",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence student-facing description of the session.",
    },
    unit: {
      type: Type.STRING,
      description: "One of: 'inches', 'centimeters'.",
    },
    gradeBand: {
      type: Type.STRING,
      description: "One of: 'K-2', '3-5'.",
    },
  },
  required: ["challengeType", "title", "description", "unit", "gradeBand"],
};

// ---------------------------------------------------------------------------
// Public generator
// ---------------------------------------------------------------------------

/**
 * Generate measurement tools data for an interactive ruler-based measurement
 * SESSION (3-6 distinct shapes, walked sequentially).
 *
 * Pool-service multi-instance pattern per PRD_WITHIN_MODE_INSTANCE_DENSITY §6a #1:
 * - Gemini emits only the wrapper (title, description, mode flags).
 * - `selectMeasurementChallenges` deterministically picks N distinct shapes.
 * - Per-mode width pools enforce pedagogical range + precision invariants.
 */
export const generateMeasurementTools = async (
  topic: string,
  gradeLevel: string,
  config?: {
    unit?: 'inches' | 'centimeters';
    precision?: 'whole' | 'half';
    gradeBand?: 'K-2' | '3-5';
    instanceCount?: number;
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
     */
    difficulty?: string;
  },
): Promise<MeasurementToolsData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'measurement-tools',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('MeasurementTools', config?.targetEvalMode, evalConstraint);

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        measurementToolsSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { fieldName: 'challengeType', rootLevel: true },
      )
    : measurementToolsSchema;

  // ── Resolve support tier (scaffolding level WITHIN the mode) ──
  // Single-mode primitive (one challengeType per session), so the scaffold is
  // resolved once. pinnedType = the resolved mode, used only for prompt tone.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: ChallengeType | undefined =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Tier prompt tone (the LLM only authors the title/description here, so this
  // just steers their warmth/terseness — the scaffold fields are applied in code).
  const tierToneScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierSection = tierToneScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierToneScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const prompt = `
Create a measurement SESSION for teaching "${topic}" to ${gradeLevel} students.

THE STUDENT EXPERIENCE:
- The student walks through ${DEFAULT_INSTANCE_COUNT} distinct shapes one at a time.
- For each shape they drag it onto a ruler, align the left edge to 0, and read
  where the right edge falls.
- They type their answer and advance to the next shape.

${challengeTypeSection}
${tierSection}
YOUR JOB:
- Pick the session's mode flags ONLY (challengeType, unit, gradeBand) and write
  a short title + one-sentence description.
- The component supplies the individual shapes, widths, colors, labels, and
  hints from a deterministic pool service. DO NOT invent shape data here.

GRADE GUIDELINES:
${config?.gradeBand === '3-5' || (!config?.gradeBand && !gradeLevel.toLowerCase().includes('kinder') && !gradeLevel.includes('1') && !gradeLevel.includes('2')) ? `
- Grades 3-5 (gradeBand "3-5"): half-precision allowed; widths run 2-10.
` : `
- Grades K-2 (gradeBand "K-2"): whole-number widths only; range 1-8.
`}

UNIT:
- Use ${config?.unit ?? 'inches'} unless the topic clearly calls for centimeters.

Return only the session wrapper.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid measurement tools wrapper returned from Gemini API');
  }

  // ── Sanitize wrapper ──────────────────────────────────────────────

  const validChallengeTypes: ChallengeType[] = ['measure', 'compare', 'estimate', 'convert'];
  let challengeType: ChallengeType =
    validChallengeTypes.includes(wrapper.challengeType)
      ? wrapper.challengeType
      : ((evalConstraint?.allowedTypes[0] as ChallengeType | undefined) ?? 'measure');

  // estimate implies half precision
  const derivedPrecision: 'whole' | 'half' =
    challengeType === 'estimate'
      ? 'half'
      : (config?.precision ?? 'whole');

  let gradeBand: 'K-2' | '3-5' = wrapper.gradeBand === '3-5' || wrapper.gradeBand === 'K-2'
    ? wrapper.gradeBand
    : (gradeLevel.toLowerCase().includes('kinder') || gradeLevel.includes('1') || gradeLevel.includes('2')
        ? 'K-2'
        : '3-5');
  if (config?.gradeBand) gradeBand = config.gradeBand;
  if (challengeType === 'estimate' || challengeType === 'convert') {
    gradeBand = '3-5';
  }

  let unit: 'inches' | 'centimeters' = wrapper.unit === 'centimeters' ? 'centimeters' : 'inches';
  if (config?.unit) unit = config.unit;

  const convertToUnit: 'inches' | 'centimeters' =
    unit === 'inches' ? 'centimeters' : 'inches';

  const title = typeof wrapper.title === 'string' && wrapper.title.trim().length > 0
    ? wrapper.title
    : 'Measure the Shapes';
  const description = typeof wrapper.description === 'string' && wrapper.description.trim().length > 0
    ? wrapper.description
    : `Walk through ${DEFAULT_INSTANCE_COUNT} shapes — measure each one with the ruler.`;

  // ── Build challenges from the pool service ────────────────────────

  const instanceCount = Math.min(
    Math.max(config?.instanceCount ?? DEFAULT_INSTANCE_COUNT, 3),
    MAX_INSTANCE_COUNT,
  );
  const challenges = selectMeasurementChallenges(challengeType, instanceCount, gradeBand);

  // Ruler length: large enough for the widest shape plus headroom.
  const maxWidth = Math.max(...challenges.map((c) => c.widthInches));
  const rulerLengthInches = Math.max(12, Math.ceil(maxWidth + 2));

  const labels = challenges.map((c) => `${c.label} (${c.widthInches} in)`).join(', ');
  console.log(
    `[MeasurementTools] ${challengeType} session: ${challenges.length} challenges → [${labels}]`,
  );

  // ── Apply the support tier deterministically (scaffolding only) ──────
  // Resolve from the session's challengeType (single-mode primitive). Fields
  // are display-/instruction-only; left undefined when no tier so the no-tier
  // path is byte-identical to before.
  const scaffold = supportTier ? resolveSupportStructure(challengeType, supportTier) : null;
  if (supportTier) {
    console.log(
      `[MeasurementTools] Support tier "${supportTier}" applied (mode ${challengeType}): `
      + `labels=${scaffold!.rulerLabels}, instruction=${scaffold!.instructionDetail}, `
      + `hintAfter=${scaffold!.hintThreshold}, conversionFactor=${scaffold!.showConversionFactor}`,
    );
  }

  return {
    title,
    description,
    challengeType,
    challenges,
    rulerLengthInches,
    unit,
    precision: derivedPrecision,
    gradeBand,
    convertToUnit,
    supportTier: supportTier ?? undefined,
    rulerLabels: scaffold?.rulerLabels,
    instructionDetail: scaffold?.instructionDetail,
    hintThreshold: scaffold?.hintThreshold,
    showConversionFactor: scaffold?.showConversionFactor,
  };
};
