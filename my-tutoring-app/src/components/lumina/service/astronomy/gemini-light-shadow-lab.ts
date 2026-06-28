import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from "../generation/generationContext";

// Import data types from component (single source of truth)
import type {
  LightShadowLabData,
  ShadowChallenge,
  ShadowObject,
  SunPosition,
  ShadowDirection,
  RelativeLength,
  ChallengeType,
  LabTheme,
} from '../../primitives/visual-primitives/astronomy/LightShadowLab';

import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// CHALLENGE TYPE DOCUMENTATION REGISTRY
// ============================================================================
// Each entry provides:
//   promptDoc        — injected into the Gemini prompt (only for allowed types)
//   schemaDescription — concise label for the schema enum description

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      `"observe": Exploration + MC. Student drags the sun to different positions and answers `
      + `observation questions like "When is the shadow shortest?" or "Which direction does the shadow point at noon?" `
      + `Include 2-3 distractors. Easiest difficulty (β=1.5). Good for K-2.`,
    schemaDescription: "'observe' (exploration + multiple choice)",
  },
  predict: {
    promptDoc:
      `"predict": Interactive prediction. Given a sun position (altitude/azimuth), student predicts `
      + `the shadow direction and relative length BEFORE seeing the result. `
      + `Include distractor options for wrong predictions. Medium difficulty (β=3.0). Good for grades 1-3.`,
    schemaDescription: "'predict' (predict shadow from sun position)",
  },
  measure: {
    promptDoc:
      `"measure": Data recording. Student records shadow data (direction + length) at multiple time points `
      + `throughout the day. Emphasize the pattern: shadows are long in morning/evening, short at midday. `
      + `Higher difficulty (β=4.5). Good for grades 3-5.`,
    schemaDescription: "'measure' (record shadow data at multiple times)",
  },
  apply: {
    promptDoc:
      `"apply": Reverse reasoning. Given a shadow's direction and length, student determines the `
      + `approximate time of day or sun position. Requires understanding the full shadow model. `
      + `Highest difficulty (β=6.0). Good for grades 4-5.`,
    schemaDescription: "'apply' (determine time from shadow)",
  },
};

// ============================================================================
// WITHIN-MODE SUPPORT TIER (config.difficulty) — scaffolding level, NOT numbers
// ============================================================================
// Second axis of the two-field contract: targetEvalMode = WHICH skill (task
// identity), difficulty = HOW MUCH on-screen / instructional help within it.
// A tier NEVER changes the sun position, the shadow answer, or pushes the
// problem into a different eval mode — it only withdraws scaffolds.

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

// ============================================================================
// TIER GUARDRAIL (was NUMBERS_NEVER_CHANGE)
// ============================================================================
// config.difficulty drives TWO dials within one eval mode:
//   axis 1 (resolveSupportStructure) — how much on-screen/instructional help.
//   axis 2 (resolveProblemShape)     — the structural SHAPE of the problem.
// The structural axis changes how SUBTLE the shadow is to read — how close the
// sun's altitude/azimuth sits to a categorical bin boundary — NOT the size of
// any number and NOT the answer. The shadow's length CATEGORY (long/medium/
// short) and direction CATEGORY (E/W/N) are held FIXED at every tier; only the
// MARGIN from the bin boundary shrinks (deep-in-bin → near-boundary). Magnitude
// (degrees) stays inside the eval mode's grade band and inside the SAME bin, so
// the correct answer is byte-identical across tiers — what changes is the
// perceptual difficulty of reading it, never its value or its mode identity.
const TIER_GUARDRAIL =
  'STRUCTURE changes across tiers (how near the sun sits to a length/direction '
  + 'boundary — subtle vs. obvious), MAGNITUDE does not (the shadow length and '
  + 'direction categories, and the answer, are identical at every tier).';

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ----------------------------------------------------------------------------
// Bespoke support scaffold — one field per discovered lever (all DISPLAY-ONLY;
// none is read by the component's answer checker, so withdrawing any of them
// cannot change or leak the answer).
//
// This is a LIVING SIMULATION: the student drags the sun and reads the
// consequence. The manipulable object (the sun) is never withdrawn — only the
// perception overlays that let the workspace self-check, and the instruction
// language that names the strategy.
// ----------------------------------------------------------------------------

interface LightShadowSupportScaffold {
  /** #1 perception: live "Shadow: <length>, <direction>" readout shown WHILE the
   *  student explores/predicts (self-check). Withdrawn at hard so the student
   *  judges the shadow unaided. (Display-only — not the graded MC answer.) */
  showLiveShadowReadout: boolean;
  /** #1 perception: dashed sun-path arc guide showing where the sun travels. */
  showSunPath: boolean;
  /** #1 perception: E (East) / W (West) ground labels that offload recalling
   *  which side is which. */
  showDirectionLabels: boolean;
  /** #2 instruction-as-scaffold: does the instruction/hint NAME the governing
   *  shadow rule (low sun → long shadow; shadow points away from the sun)? */
  nameStrategy: boolean;
  promptLines: string[];
}

/**
 * Resolve the on-screen / instructional scaffold for a pinned mode + tier.
 * easy = the workspace helps the student self-check (live readout + every
 * overlay + the rule named); hard = the student works unaided and justifies
 * their thinking (overlays withdrawn, rule NOT named). The numbers (sun
 * altitude/azimuth, correct shadow) are identical at every tier.
 */
function resolveSupportStructure(
  pinnedType: ChallengeType,
  tier: SupportTier,
): LightShadowSupportScaffold {
  const lead =
    'This tier changes only how much on-screen and instructional help the student gets. '
    + 'It NEVER changes the sun position, the shadow length/direction, or the answer.';

  // The live shadow readout is a self-check crutch — strongest scaffold, first
  // to go. For 'observe' (free exploration) it stays one tier longer because the
  // whole task is "drag and notice"; for predict/measure/apply the student is
  // meant to commit BEFORE confirming, so it withdraws at medium already.
  const showLiveShadowReadout =
    pinnedType === 'observe' ? tier !== 'hard' : tier === 'easy';
  // The sun-path arc and direction labels are perception aids: keep both at easy,
  // drop the labels at medium (recall E/W yourself), drop the path at hard.
  const showDirectionLabels = tier === 'easy';
  const showSunPath = tier !== 'hard';
  // Strategy naming: easy spells out the rule; medium/hard withhold it so the
  // student recalls / reasons the relationship themselves.
  const nameStrategy = tier === 'easy';

  return {
    showLiveShadowReadout,
    showSunPath,
    showDirectionLabels,
    nameStrategy,
    promptLines: [
      lead,
      `The live shadow readout (its length + direction printed beside the shadow as the student works) is ${showLiveShadowReadout ? 'shown so the student can self-check while exploring' : 'withdrawn — the student commits to an answer before any confirmation'}.`,
      `The dashed sun-path arc is ${showSunPath ? 'shown to trace where the sun travels' : 'withdrawn — the student tracks the sun unaided'}.`,
      `The E/W ground direction labels are ${showDirectionLabels ? 'shown' : 'withdrawn — the student recalls which side is east vs. west'}.`,
      `The governing shadow rule (a low sun casts a LONG shadow / a high sun a SHORT one; the shadow points AWAY from the sun) is ${nameStrategy ? 'named in the instruction and hint' : 'NOT named — the student reasons the relationship from what they see'}.`,
      'Keep the title, description, and instructions neutral — never state the support level and never reveal the shadow answer.',
    ],
  };
}

// ============================================================================
// WITHIN-MODE STRUCTURAL DIFFICULTY (config.difficulty) — problem SHAPE, axis 2
// ============================================================================
// The structural lever for every mode is BOUNDARY MARGIN: how close the sun's
// altitude sits to a length-bin boundary (30° / 60°) and how close its azimuth
// sits to a direction-bin boundary (80° / 100°).
//
//   Altitude → length:  [5,30) = long · [30,60] = medium · (60,85] = short
//   Azimuth  → direction: [5,80) = W · [80,100] = N · (100,175] = E
//
// easy  = deep inside the bin (large margin → obvious shadow to read).
// hard  = just inside a boundary (small margin → subtle shadow to read).
// The BIN (and therefore the answer category) is held FIXED — only the margin
// shrinks. This is gap-subtlety, not magnitude: degrees move but the bin, and
// thus the correct answer, never change. The lever SATURATES honestly inside a
// narrow bin (the `long` bin near the horizon has little room; the margin just
// uses whatever the bin allows). Floor = a valid in-bin value always exists;
// cap = the legal degree range AND staying inside the same bin (never crossing
// a boundary, which would change the answer = the banned magnitude path).

/** Legal degree ranges (mirror the component's drag clamps). */
const ALT_MIN = 5, ALT_MAX = 85;
const AZ_MIN = 5, AZ_MAX = 175;

/** Length bins by altitude, matching validateShadowLength. */
type LengthBin = 'long' | 'medium' | 'short';
function altitudeBin(altitude: number): LengthBin {
  if (altitude < 30) return 'long';
  if (altitude <= 60) return 'medium';
  return 'short';
}
/** Direction bins by azimuth, matching validateShadowDirection. */
type DirBin = 'W' | 'N' | 'E';
function azimuthBin(azimuth: number): DirBin {
  if (azimuth < 80) return 'W';
  if (azimuth > 100) return 'E';
  return 'N';
}

/** Target boundary-margin in degrees per tier (smaller = subtler = harder). */
function tierMarginDegrees(tier: SupportTier): number {
  // The minimum distance the chosen value must hold from the NEAREST in-bin
  // boundary. Clamped to whatever the bin allows (saturates honestly).
  return tier === 'easy' ? 14 : tier === 'medium' ? 6 : 1;
}

/**
 * Re-place an in-bin value so its distance to the nearest *interior* boundary
 * of its bin equals the tier's target margin, clamped to the legal range and
 * the bin's own width (saturates honestly inside a narrow bin). The bin (hence
 * the answer category) is PRESERVED. Returns an integer degree.
 *
 * @param value   the LLM's value (whose bin we keep)
 * @param lo      inclusive low edge of the legal-in-bin interval
 * @param hi      inclusive high edge of the legal-in-bin interval
 * @param margin  target distance from the nearest interior boundary
 * @param preferHigh which boundary to hug when the bin has two interior edges
 */
function placeAtMargin(
  lo: number,
  hi: number,
  margin: number,
  preferHigh: boolean,
): number {
  const width = hi - lo;
  // A bin narrower than 2*margin can't honor the margin from BOTH edges; clamp
  // the margin to half the width so we always land strictly inside the bin.
  const m = Math.max(0, Math.min(margin, Math.floor(width / 2)));
  // Hug the chosen boundary by `m`. preferHigh hugs the high edge (so a small
  // margin sits near hi); else hugs the low edge.
  const placed = preferHigh ? hi - m : lo + m;
  return Math.round(Math.max(lo, Math.min(hi, placed)));
}

/** Legal in-bin altitude interval for a length bin (degrees, integer edges). */
function altBinRange(bin: LengthBin): { lo: number; hi: number } {
  if (bin === 'long') return { lo: ALT_MIN, hi: 29 };       // [5,29]  boundary at 30
  if (bin === 'medium') return { lo: 30, hi: 60 };          // [30,60] boundaries 30 & 60
  return { lo: 61, hi: ALT_MAX };                            // [61,85] boundary at 60
}
/** Legal in-bin azimuth interval for a direction bin (degrees, integer edges). */
function azBinRange(bin: DirBin): { lo: number; hi: number } {
  if (bin === 'W') return { lo: AZ_MIN, hi: 79 };           // [5,79]  boundary at 80
  if (bin === 'N') return { lo: 80, hi: 100 };              // [80,100] boundaries 80 & 100
  return { lo: 101, hi: AZ_MAX };                            // [101,175] boundary at 100
}

/**
 * Given the LLM's altitude/azimuth, RE-SELECT them to the tier's boundary
 * margin while preserving the length bin and direction bin (so the answer is
 * unchanged). For the medium length-bin (two interior boundaries) and the N
 * direction-bin, the tier hugs the boundary nearer the original value so the
 * scene still reads as roughly the same time of day.
 */
function reshapeSunPosition(
  altitude: number,
  azimuth: number,
  tier: SupportTier,
): { altitude: number; azimuth: number } {
  const margin = tierMarginDegrees(tier);

  const lBin = altitudeBin(altitude);
  const aRange = altBinRange(lBin);
  // Which boundary to hug: for an asymmetric bin (long/short) only one interior
  // boundary exists; for medium pick the nearer one to keep the time-of-day.
  let preferHighAlt: boolean;
  if (lBin === 'long') preferHighAlt = true;        // boundary is the high edge (→30)
  else if (lBin === 'short') preferHighAlt = false; // boundary is the low edge (→60)
  else preferHighAlt = altitude >= 45;              // medium: hug nearer boundary
  const newAlt = placeAtMargin(aRange.lo, aRange.hi, margin, preferHighAlt);

  const dBin = azimuthBin(azimuth);
  const azRange = azBinRange(dBin);
  let preferHighAz: boolean;
  if (dBin === 'W') preferHighAz = true;            // boundary is high edge (→80)
  else if (dBin === 'E') preferHighAz = false;      // boundary is low edge (→100)
  else preferHighAz = azimuth >= 90;                // N: hug nearer boundary
  const newAz = placeAtMargin(azRange.lo, azRange.hi, margin, preferHighAz);

  return { altitude: newAlt, azimuth: newAz };
}

interface LightShadowProblemShape {
  marginDegrees: number;
  promptLines: string[];
}

/**
 * Resolve the structural intent (axis 2) for a pinned mode + tier. Returns the
 * target boundary margin (the code-enforced lever) plus prompt lines describing
 * the harder SHAPE to the LLM. The post-process re-selects altitude/azimuth to
 * this margin; the prompt only primes the LLM to author a coherent scene.
 */
function resolveProblemShape(
  pinnedType: ChallengeType,
  tier: SupportTier,
): LightShadowProblemShape {
  const margin = tierMarginDegrees(tier);
  const subtlety =
    tier === 'easy'
      ? 'OBVIOUS — the sun sits deep inside a length zone (clearly low, clearly midday-high, etc.), so the shadow length is easy to read at a glance.'
      : tier === 'medium'
      ? 'MODERATELY SUBTLE — the sun sits closer to the edge between two length zones, so the student must judge the shadow length more carefully.'
      : 'SUBTLE — the sun sits JUST inside a length/direction zone, very near the boundary with the next zone, so the shadow length and side are genuinely hard to read and must be reasoned, not eyeballed.';

  const lines = [
    TIER_GUARDRAIL,
    `Structural difficulty for this tier = how NEAR the sun is to a shadow-length boundary (the 30° and 60° altitude lines) and a direction boundary (the 80°/100° azimuth lines). This tier is ${subtlety}`,
    `Author each challenge so the sun's altitude sits about ${margin}° from the nearest length boundary (and azimuth about ${margin}° from the nearest direction boundary). The correct shadow length and direction category stay the same — only how close-to-the-edge the sun sits changes.`,
  ];

  if (pinnedType === 'measure') {
    lines.push(
      tier === 'hard'
        ? 'For this MEASURE task, choose times whose sun altitudes land near the SAME boundary so the recorded lengths are similar and the daily pattern is subtle to spot.'
        : 'For this MEASURE task, spread the times so the recorded shadow lengths are clearly different across the day.',
    );
  }
  if (pinnedType === 'apply') {
    lines.push(
      tier === 'hard'
        ? 'For this APPLY (reverse) task, pick a shadow whose length sits near a boundary so mapping it back to a time of day requires real reasoning.'
        : 'For this APPLY (reverse) task, pick a shadow whose length clearly indicates one time of day.',
    );
  }
  if (pinnedType === 'observe' || pinnedType === 'predict') {
    lines.push(
      tier === 'hard'
        ? 'Make the distractor options NEAR the correct answer (one zone off / adjacent direction), so the student cannot pick by elimination.'
        : 'Distractors may be clearly different from the correct answer.',
    );
  }

  return { marginDegrees: margin, promptLines: lines };
}

// ============================================================================
// DEFAULT OBJECTS PER THEME
// ============================================================================

const DEFAULT_OBJECTS_BY_THEME: Record<LabTheme, ShadowObject[]> = {
  playground: [
    { type: 'stick_figure', height: 4, label: 'You' },
  ],
  sundial: [
    { type: 'flagpole', height: 6, label: 'Sundial gnomon' },
  ],
  science_lab: [
    { type: 'stick_figure', height: 5, label: 'Test object' },
  ],
};

// ============================================================================
// GEMINI SCHEMA — flattened nested objects in challenges
// ============================================================================

const lightShadowLabResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging, age-appropriate title for the shadow lab activity',
    },
    description: {
      type: Type.STRING,
      description: 'Clear description explaining what students will learn about shadows and sunlight',
    },
    theme: {
      type: Type.STRING,
      enum: ['playground', 'sundial', 'science_lab'],
      description: 'Visual theme for the lab environment',
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ['K', '1', '2', '3', '4', '5'],
      description: 'Target grade level for content complexity',
    },
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ['stick_figure', 'tree', 'flagpole', 'building'],
            description: 'Type of object casting the shadow',
          },
          height: {
            type: Type.NUMBER,
            description: 'Height of the object in arbitrary units (1-10)',
          },
          label: {
            type: Type.STRING,
            description: 'Display label for the object',
            nullable: true,
          },
        },
        required: ['type', 'height'],
      },
      description: 'Objects in the scene that cast shadows. 1-3 objects.',
    },
    sunPositions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: {
            type: Type.STRING,
            description: 'Time label (e.g., "8:00 AM", "12:00 PM", "4:00 PM")',
          },
          altitude: {
            type: Type.NUMBER,
            description: 'Sun altitude in degrees (0=horizon, 90=directly overhead). Morning/evening: 15-30, midday: 50-75.',
          },
          azimuth: {
            type: Type.NUMBER,
            description: 'Sun azimuth in degrees along the east-to-west arc (0=east, 90=south/overhead, 180=west). Morning: 10-50, midday: 80-100, afternoon: 130-170.',
          },
        },
        required: ['time', 'altitude', 'azimuth'],
      },
      description: 'Sun positions used across the activity. Include morning, midday, and afternoon.',
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Unique challenge identifier (e.g., "c1", "c2")',
          },
          type: {
            type: Type.STRING,
            enum: ['observe', 'predict', 'measure', 'apply'],
            description: 'Challenge type: observe (explore + MC), predict (predict shadow), measure (record data), apply (reverse reasoning)',
          },
          instruction: {
            type: Type.STRING,
            description: 'Clear instruction text for the student. Do NOT reveal the answer.',
          },
          // Flattened sunPosition fields
          sunPositionTime: {
            type: Type.STRING,
            description: 'Time label for this challenge\'s sun position (e.g., "10:00 AM")',
          },
          sunPositionAltitude: {
            type: Type.NUMBER,
            description: 'Sun altitude in degrees for this challenge (0-90)',
          },
          sunPositionAzimuth: {
            type: Type.NUMBER,
            description: 'Sun azimuth in degrees along east-to-west arc (0=east, 90=south/overhead, 180=west). Range 0-180.',
          },
          // Flattened correctShadow fields
          correctShadowDirection: {
            type: Type.STRING,
            enum: ['E', 'W', 'N'],
            description: 'Correct shadow direction. Azimuth < 80 (sun in east half) → shadow "W"; azimuth > 100 (sun in west half) → shadow "E"; 80-100 (overhead) → "N".',
          },
          correctShadowRelativeLength: {
            type: Type.STRING,
            enum: ['short', 'medium', 'long'],
            description: 'Correct relative shadow length. Altitude > 60 → short; 30-60 → medium; < 30 → long.',
          },
          distractor0: {
            type: Type.STRING,
            description: 'First wrong answer option for MC challenges',
            nullable: true,
          },
          distractor1: {
            type: Type.STRING,
            description: 'Second wrong answer option for MC challenges',
            nullable: true,
          },
          distractor2: {
            type: Type.STRING,
            description: 'Third wrong answer option for MC challenges',
            nullable: true,
          },
          hint: {
            type: Type.STRING,
            description: 'Pedagogical hint that guides without giving away the answer',
            nullable: true,
          },
        },
        required: [
          'id',
          'type',
          'instruction',
          'sunPositionTime',
          'sunPositionAltitude',
          'sunPositionAzimuth',
          'correctShadowDirection',
          'correctShadowRelativeLength',
        ],
      },
      description: 'Array of 3-5 challenges progressing in difficulty',
    },
  },
  required: [
    'title',
    'description',
    'theme',
    'gradeLevel',
    'objects',
    'sunPositions',
    'challenges',
  ],
};

// ============================================================================
// GRADE-APPROPRIATE CONFIGURATION
// ============================================================================

const GRADE_CONFIGURATIONS: Record<string, { theme: LabTheme; numChallenges: number; guidance: string }> = {
  K: {
    theme: 'playground',
    numChallenges: 3,
    guidance: 'Focus on observation only. "Look! Your shadow is long in the morning!" Use playground theme. Simple vocabulary.',
  },
  '1': {
    theme: 'playground',
    numChallenges: 3,
    guidance: 'Observation + simple predictions. "Where will your shadow point?" Morning vs afternoon comparison.',
  },
  '2': {
    theme: 'playground',
    numChallenges: 4,
    guidance: 'Observation + prediction. Compare shadow at different times. Introduce direction vocabulary (east/west).',
  },
  '3': {
    theme: 'sundial',
    numChallenges: 4,
    guidance: 'Prediction + measurement. Record shadow changes throughout the day. Introduce the idea that sun position controls shadow.',
  },
  '4': {
    theme: 'science_lab',
    numChallenges: 5,
    guidance: 'Measurement + application. Record data, identify patterns. Reverse reasoning: given shadow, estimate time.',
  },
  '5': {
    theme: 'science_lab',
    numChallenges: 5,
    guidance: 'Full range including application. Students should reason about altitude/azimuth relationship to shadow properties.',
  },
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and correct shadow direction based on sun azimuth.
 * Azimuth < 80° (sun in east) → shadow points W
 * Azimuth > 100° (sun in west) → shadow points E
 * Azimuth 80-100° (sun roughly south) → shadow points N
 */
function validateShadowDirection(azimuth: number): ShadowDirection {
  if (azimuth < 80) return 'W';
  if (azimuth > 100) return 'E';
  return 'N';
}

/**
 * Validate and correct shadow relative length based on sun altitude.
 * Altitude < 30° → long shadow
 * Altitude 30-60° → medium shadow
 * Altitude > 60° → short shadow
 */
function validateShadowLength(altitude: number): RelativeLength {
  if (altitude < 30) return 'long';
  if (altitude <= 60) return 'medium';
  return 'short';
}

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

type LightShadowLabConfig = {
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
   */
  difficulty?: string;
};

export const generateLightShadowLab = async (
  ctx: GenerationContext,
): Promise<LightShadowLabData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as LightShadowLabConfig;
  const resolvedGrade = (gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3') as
    'K' | '1' | '2' | '3' | '4' | '5';
  const gradeConfig = GRADE_CONFIGURATIONS[resolvedGrade] || GRADE_CONFIGURATIONS['3'];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'light-shadow-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        lightShadowLabResponseSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : lightShadowLabResponseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT numbers.
  //    pinnedType is ONLY for the prompt tone (a curated blend has no single mode
  //    to describe to the LLM). The withdrawal is applied deterministically per
  //    challenge at the END, gated on the tier alone. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: ChallengeType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier)
    : null;
  // One coherent "what this tier means here" block merging BOTH axes' prompt
  // lines: axis 1 = how much help (scaffolding), axis 2 = the problem shape
  // (boundary subtlety). The tier enum reaches both the prompt (here) and the
  // post-process (below) — never a baked string.
  const tierSection =
    tierScaffold || tierShape
      ? `\n## WITHIN-MODE DIFFICULTY TIER (scaffolding level + problem subtlety — NOT number size)\n`
        + [
          ...(tierShape ? tierShape.promptLines : []),
          ...(tierScaffold ? tierScaffold.promptLines : []),
        ]
          .map((l) => `- ${l}`)
          .join('\n')
        + '\n'
      : '';

  const prompt = `
Create an interactive Light & Shadow Lab activity for ${gradeLevel} students.

**Topic:** ${topic}

**Grade Level:** ${resolvedGrade}
**Theme:** ${gradeConfig.theme}
**Grade Guidance:** ${gradeConfig.guidance}

**Core Science Concepts:**
- Shadows form on the opposite side of an object from the light source
- When the sun is LOW in the sky (morning/evening), shadows are LONG
- When the sun is HIGH in the sky (midday), shadows are SHORT
- Shadow direction depends on where the sun is: sun in east → shadow points west, sun in west → shadow points east
- Shadows change throughout the day as the sun moves across the sky

**Sun Position Convention (CRITICAL — use this scale, NOT compass bearings):**
Azimuth is on a 0-180° east-to-west arc:
  0° = east (sunrise side, LEFT in the scene)
  90° = south / directly overhead
  180° = west (sunset side, RIGHT in the scene)

Reference positions:
- Early morning (~7-8 AM): altitude 15-25°, azimuth 15-35° → LONG shadow pointing WEST (right)
- Mid-morning (~10 AM): altitude 35-45°, azimuth 55-75° → MEDIUM shadow pointing WEST (right)
- Midday (~12 PM): altitude 55-75°, azimuth 85-95° → SHORT shadow pointing NORTH (below)
- Mid-afternoon (~2 PM): altitude 35-45°, azimuth 110-130° → MEDIUM shadow pointing EAST (left)
- Late afternoon (~4-5 PM): altitude 15-25°, azimuth 145-165° → LONG shadow pointing EAST (left)

**Shadow Validation Rules (MUST follow):**
- correctShadowDirection: if azimuth < 80 → "W", if azimuth 80-100 → "N", if azimuth > 100 → "E"
- correctShadowRelativeLength: if altitude < 30 → "long", 30-60 → "medium", > 60 → "short"

${challengeTypeSection}
${tierSection}
**Objects:** Include 1-2 objects appropriate for the theme.
- playground: stick_figure, tree
- sundial: flagpole
- science_lab: stick_figure, flagpole

**Sun Positions:** Include 3-5 sun positions spanning the day (morning, midday, afternoon at minimum).

**Challenges:** Generate ${gradeConfig.numChallenges} challenges that progress in difficulty.
- For observe/predict types: include 2-3 distractor answer options
- For all types: include a pedagogical hint
- Do NOT reveal answers in instruction text
- Use warm, encouraging language for younger grades

IMPORTANT — Flat challenge fields:
- Use sunPositionTime, sunPositionAltitude, sunPositionAzimuth (NOT nested sunPosition object)
- Use correctShadowDirection, correctShadowRelativeLength (NOT nested correctShadow object)

Generate a complete, educationally sound activity configuration.
`;

  logEvalModeResolution('LightShadowLab', config?.targetEvalMode, evalConstraint);

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
      },
    });

    const raw = JSON.parse(result.text || '{}');

    // ── Reconstruct nested objects from flat Gemini fields ──
    const challenges: ShadowChallenge[] = (raw.challenges || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any, i: number) => {
        const altitude: number = c.sunPositionAltitude ?? 45;
        const azimuth: number = c.sunPositionAzimuth ?? 180;

        const challenge: ShadowChallenge = {
          id: c.id || `c${i + 1}`,
          type: c.type as ChallengeType,
          instruction: c.instruction || 'Observe the shadow.',
          sunPosition: {
            time: c.sunPositionTime || '12:00 PM',
            altitude,
            azimuth,
          },
          correctShadow: {
            direction: validateShadowDirection(azimuth),
            relativeLength: validateShadowLength(altitude),
          },
        };

        if (c.distractor0) challenge.distractor0 = c.distractor0;
        if (c.distractor1) challenge.distractor1 = c.distractor1;
        if (c.distractor2) challenge.distractor2 = c.distractor2;
        if (c.hint) challenge.hint = c.hint;

        return challenge;
      },
    );

    // ── Collect sun positions from challenges + any top-level ones ──
    const sunPositionMap = new Map<string, SunPosition>();
    // Add top-level sun positions
    if (Array.isArray(raw.sunPositions)) {
      for (const sp of raw.sunPositions) {
        if (sp.time) {
          sunPositionMap.set(sp.time, {
            time: sp.time,
            altitude: sp.altitude ?? 45,
            azimuth: sp.azimuth ?? 180,
          });
        }
      }
    }
    // Ensure challenge sun positions are included
    for (const ch of challenges) {
      if (!sunPositionMap.has(ch.sunPosition.time)) {
        sunPositionMap.set(ch.sunPosition.time, ch.sunPosition);
      }
    }
    // sunPositions is materialized AFTER the structural tier block below so a
    // reshaped sun (which updates sunPositionMap by time) is reflected here.

    // ── Default objects based on theme ──
    const theme: LabTheme = raw.theme || gradeConfig.theme;
    const objects: ShadowObject[] =
      Array.isArray(raw.objects) && raw.objects.length > 0
        ? raw.objects.map((o: { type?: string; height?: number; label?: string }) => ({
            type: o.type || 'stick_figure',
            height: o.height || 5,
            ...(o.label ? { label: o.label } : {}),
          }))
        : DEFAULT_OBJECTS_BY_THEME[theme] || DEFAULT_OBJECTS_BY_THEME['playground'];

    // ── Within-mode support tier: withdraw on-screen scaffolding (never the
    //    numbers). Applied PER CHALLENGE from each challenge's OWN type, so a
    //    blended (auto-mode) session gets difficulty too — the tier is a student
    //    property, not a single-mode one. Gated ONLY on a tier being present.
    //    All four levers are display-only (the MC checker reads correctShadow,
    //    which is untouched here), so withdrawing them can never leak or
    //    invalidate the answer. Runs AFTER the shadow re-validation above. ──
    if (supportTier) {
      for (const ch of challenges) {
        // ── Axis 2 (structural): re-select the sun's altitude/azimuth to the
        //    tier's boundary margin, PRESERVING the length & direction bins (so
        //    the answer category is unchanged) — count the LLM's actual margin,
        //    honor it if it already matches, otherwise reconstruct. Answer-
        //    bearing: recompute correctShadow from the new degrees afterward. ──
        const origAlt = ch.sunPosition.altitude;
        const origAz = ch.sunPosition.azimuth;
        const lBin = altitudeBin(origAlt);
        const dBin = azimuthBin(origAz);

        // COUNT: the LLM's actual margin from the nearest interior boundary.
        const altR = altBinRange(lBin);
        const azR = azBinRange(dBin);
        const targetMargin = tierMarginDegrees(supportTier);
        const cappedAltMargin = Math.min(targetMargin, Math.floor((altR.hi - altR.lo) / 2));
        const cappedAzMargin = Math.min(targetMargin, Math.floor((azR.hi - azR.lo) / 2));
        const actualAltMargin = Math.min(origAlt - altR.lo, altR.hi - origAlt);
        const actualAzMargin = Math.min(origAz - azR.lo, azR.hi - origAz);

        // HONOR-IF-VALID: the LLM's value is in the legal range, in the same
        // bin, and already within 1° of the tier's (bin-capped) target margin.
        const altInRange = origAlt >= altR.lo && origAlt <= altR.hi;
        const azInRange = origAz >= azR.lo && origAz <= azR.hi;
        const altHits = altInRange && Math.abs(actualAltMargin - cappedAltMargin) <= 1;
        const azHits = azInRange && Math.abs(actualAzMargin - cappedAzMargin) <= 1;

        if (!altHits || !azHits) {
          // RECONSTRUCT deterministically to the exact tier margin, in-bin.
          const reshaped = reshapeSunPosition(origAlt, origAz, supportTier);
          ch.sunPosition = {
            ...ch.sunPosition,
            altitude: altHits ? origAlt : reshaped.altitude,
            azimuth: azHits ? origAz : reshaped.azimuth,
          };
          // ANSWER-BEARING: recompute the shadow from the (possibly) new degrees.
          // Bin is preserved, so the category is unchanged — but recompute so the
          // emitted answer can never drift from the rendered sun position.
          ch.correctShadow = {
            direction: validateShadowDirection(ch.sunPosition.azimuth),
            relativeLength: validateShadowLength(ch.sunPosition.altitude),
          };
          // Keep the top-level sunPositions list in sync (same `time` key) so a
          // reshaped sun isn't shadowed by a stale collection entry.
          sunPositionMap.set(ch.sunPosition.time, ch.sunPosition);
        }

        const sc = resolveSupportStructure(ch.type, supportTier);
        ch.showLiveShadowReadout = sc.showLiveShadowReadout;
        ch.showSunPath = sc.showSunPath;
        ch.showDirectionLabels = sc.showDirectionLabels;
        // #2 instruction-as-scaffold: at easy, name the governing rule in the
        // hint; at medium/hard, strip the rule from the hint so the student
        // recalls/reasons it. The instruction text itself is authored neutral by
        // the LLM (told not to reveal the answer); we only adjust the hint here so
        // a withdrawn rule isn't re-leaked through the fallback hint.
        if (!sc.nameStrategy && ch.hint) {
          ch.hint = ch.type === 'apply'
            ? 'Look at the shadow first — how long is it, and which way does it point? Let that tell you about the sun.'
            : 'Look at where the sun is — how high it sits and which side it is on. Let that tell you about the shadow.';
        }
      }
      console.log(`[light-shadow-lab] Support tier "${supportTier}" applied per-challenge (${pinnedType ? 'single-mode ' + pinnedType : 'blended'})`);
    }

    // Materialized after the tier block so any structural reshape (which updates
    // sunPositionMap by `time`) is reflected. No-tier path: identical to before.
    const sunPositions: SunPosition[] = Array.from(sunPositionMap.values());

    const finalData: LightShadowLabData = {
      title: raw.title || 'Light & Shadow Lab',
      description: raw.description || 'Explore how shadows change as the sun moves across the sky!',
      theme,
      gradeLevel: resolvedGrade,
      objects,
      sunPositions,
      challenges,
      // Tell the live tutor the support level whenever a tier is present.
      ...(supportTier ? { supportTier } : {}),
    };

    return finalData;
  } catch (error) {
    console.error('Error generating LightShadowLab content:', error);

    // ── Fallback default ──
    const theme = gradeConfig.theme;
    return {
      title: 'Light & Shadow Lab',
      description: 'Explore how shadows change as the sun moves across the sky!',
      theme,
      gradeLevel: resolvedGrade,
      objects: DEFAULT_OBJECTS_BY_THEME[theme],
      sunPositions: [
        { time: '8:00 AM', altitude: 20, azimuth: 25 },
        { time: '12:00 PM', altitude: 65, azimuth: 90 },
        { time: '4:00 PM', altitude: 20, azimuth: 155 },
      ],
      challenges: [
        {
          id: 'c1',
          type: 'observe',
          instruction: 'Drag the sun to each position. When is the shadow shortest?',
          sunPosition: { time: '12:00 PM', altitude: 65, azimuth: 90 },
          correctShadow: { direction: 'N', relativeLength: 'short' },
          distractor0: 'Morning',
          distractor1: 'Evening',
          hint: 'Think about when the sun is highest in the sky.',
        },
        {
          id: 'c2',
          type: 'predict',
          instruction: 'The sun is low in the east. Which direction will the shadow point?',
          sunPosition: { time: '8:00 AM', altitude: 20, azimuth: 25 },
          correctShadow: { direction: 'W', relativeLength: 'long' },
          distractor0: 'East',
          distractor1: 'Straight up',
          hint: 'Shadows always point away from the light source.',
        },
      ],
    };
  }
};
