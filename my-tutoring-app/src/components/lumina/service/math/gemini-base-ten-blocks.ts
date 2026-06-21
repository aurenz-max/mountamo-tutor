/**
 * Base-Ten Blocks Generator - Dedicated service for place value visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { BaseTenBlocksData, BaseTenBlocksChallenge } from '../../primitives/visual-primitives/math/BaseTenBlocks';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { createNumberPool } from './numberPoolService';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------
// Each entry provides:
//   promptDoc     — injected into the Gemini prompt (only for allowed types)
//   schemaDescription — concise label for the schema enum description
//
// When an eval mode is active, only the relevant entries are included.
// When no eval mode, all entries are included for mixed-difficulty generation.

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build_number: {
    promptDoc:
      `"build_number": Student builds a given number from scratch using blocks. `
      + `Set targetNumber to the value they must construct. `
      + `Use encouraging language ("Build the number 247 with blocks!"). `
      + `K-1: numbers 1-20, maxPlace 'tens'. Grades 2-3: numbers 1-999, maxPlace 'hundreds'. `
      + `Grades 4-5: numbers up to 9999, maxPlace 'thousands'. Full scaffolding — concrete manipulative.`,
    schemaDescription: "'build_number' (construct number from blocks)",
  },
  read_blocks: {
    promptDoc:
      `"read_blocks": Blocks are pre-placed, student identifies the number they represent. `
      + `Set targetNumber to the correct answer. `
      + `Instruction must be a GENERIC prompt to look at the blocks — for example: `
      + `"Look at the blocks shown above. What number do they represent?" or `
      + `"What number is shown by these blocks?". `
      + `CRITICAL: The instruction must NOT name how many blocks are in each place value. `
      + `Do NOT say "2 hundreds blocks, 4 tens rods, and 5 ones" — that lets the student `
      + `compute the answer (2·100+4·10+5=245) from the text alone without looking at the blocks. `
      + `Do NOT mention specific digit counts ("X hundreds", "Y tens", "Z ones"). `
      + `Do NOT mention block words ("hundreds blocks", "tens rods", "ones units", "flats", "rods", "units"). `
      + `K-1: numbers 1-20. Grades 2-3: numbers 1-999. Vary digit patterns (e.g., 305 has 0 tens).`,
    schemaDescription: "'read_blocks' (identify number from blocks)",
  },
  regroup: {
    promptDoc:
      `"regroup": Student regroups blocks by trading between place values. `
      + `E.g., trade 10 ones for 1 ten, or 10 tens for 1 hundred. `
      + `Set targetNumber to the number being regrouped. `
      + `IMPORTANT: The blocks always START in standard form (e.g., 125 = 1 hundred, 2 tens, 5 ones). `
      + `The instruction tells the student WHICH trade to make: "You have 1 hundred, 2 tens, and 5 ones. Trade 1 ten for 10 ones." `
      + `Do NOT describe non-standard starting arrangements like "23 ones blocks" — the component cannot render those. `
      + `Focus on the trading mechanic. Grades 2-3 primary. Include trades in both directions (up and down).`,
    schemaDescription: "'regroup' (trade between place values)",
  },
  add_with_blocks: {
    promptDoc:
      `"add_with_blocks": Student adds two numbers using blocks, regrouping as needed. `
      + `Set targetNumber to the SUM. Set secondNumber to the second addend. `
      + `Instruction names both addends: "Add 347 + 285 using blocks." `
      + `Do NOT reveal the sum. Grades 2-3: sums up to 999. Grades 4-5: sums up to 9999.`,
    schemaDescription: "'add_with_blocks' (addition with regrouping)",
  },
  subtract_with_blocks: {
    promptDoc:
      `"subtract_with_blocks": Student subtracts using blocks, borrowing as needed. `
      + `Set targetNumber to the DIFFERENCE. Set secondNumber to the subtrahend. `
      + `Instruction names the minuend and subtrahend: "Subtract 285 from 632 using blocks." `
      + `Do NOT reveal the difference. Grades 2-3: numbers up to 999. Grades 4-5: up to 9999.`,
    schemaDescription: "'subtract_with_blocks' (subtraction with borrowing)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tiers (config.difficulty → scaffolding level)
// ---------------------------------------------------------------------------
// Second axis of the two-field contract: targetEvalMode = WHICH skill,
// difficulty = HOW MUCH on-screen support within it. NEVER changes the numbers.
// BaseTenBlocks has no showOptions — its scaffolds are hardcoded renders, so the
// levers are new per-challenge component fields (showColumnCounts, showBlocksTotal):
//   - showColumnCounts: the digit readout above each place column (perception aid)
//   - showBlocksTotal:  the live "Blocks Total" panel (self-check aid)
// read_blocks keeps BOTH off at every tier (BT-2: showing them leaks the answer).

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  showColumnCounts: boolean; // per-column digit readout
  showBlocksTotal: boolean;  // running "Blocks Total" self-check panel
  promptLines: string[];
}

/**
 * Guardrail line shared by BOTH axes of config.difficulty. Replaces the old
 * "numbers never change" framing, which became a lie once the structural axis
 * (resolveProblemShape) started re-selecting targets/operands: the numbers DO
 * change, but only to change problem STRUCTURE (interior-zero-place count for
 * build/read; carry/borrow count for operate), never to inflate magnitude past
 * the eval-mode + grade-band scope.
 */
const TIER_GUARDRAIL =
  'Numbers stay within the eval-mode + grade-band scope. This tier changes the '
  + 'problem STRUCTURE (how many empty place-value columns the number has, or how '
  + 'many carries/borrows an operation needs) and how much on-screen help is shown '
  + '— NOT the magnitude. 305 and 235 are the SAME band. Never just make the numbers bigger.';

/**
 * Map (challenge type, tier) → on-screen scaffolds. Scaffolding-only: the target
 * numbers never change, only how much the workspace helps the student self-check.
 * easy = workspace reads + verifies for them; hard = they place blocks and verify
 * mentally before typing the answer.
 */
function resolveSupportStructure(type: string, tier: SupportTier): SupportScaffold {
  const numbersNeverChange = TIER_GUARDRAIL;

  // read_blocks: counts + total are contractually hidden (they leak the answer).
  // The tier cannot turn them on; it only sets the tutor/instruction tone.
  if (type === 'read_blocks') {
    return {
      showColumnCounts: false,
      showBlocksTotal: false,
      promptLines: [
        numbersNeverChange,
        'read_blocks always hides the column counts and total — keep the instruction a generic "what number do these blocks show?" prompt so the student reads the blocks unaided.',
      ],
    };
  }

  switch (tier) {
    case 'easy':
      return {
        showColumnCounts: true,
        showBlocksTotal: true,
        promptLines: [
          numbersNeverChange,
          'EASY support: the per-column digit counts and the running Blocks Total are both shown — the student can read each place and self-check their total. Keep the hint concrete and step-by-step (name the place values).',
        ],
      };
    case 'medium':
      return {
        showColumnCounts: false,
        showBlocksTotal: true,
        promptLines: [
          numbersNeverChange,
          'MEDIUM support: per-column digit counts are hidden (the student counts each place themselves) but the running Blocks Total stays on for self-checking. Hint should nudge, not narrate every step.',
        ],
      };
    case 'hard':
      return {
        showColumnCounts: false,
        showBlocksTotal: false,
        promptLines: [
          numbersNeverChange,
          'HARD support: both the per-column counts AND the running Blocks Total are hidden — the student places blocks and verifies the total mentally before answering. Keep the hint a minimal conceptual nudge that does not reveal the total.',
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Structural PROBLEM difficulty — the SECOND axis of config.difficulty.
//
// Distinct from the scaffolding above ("how much help?"), this makes the
// generated PROBLEM itself harder per tier — STRUCTURALLY, never by inflating
// magnitude and never by crossing into another eval mode. Two lever families:
//
//   build_number / read_blocks → INTERIOR-ZERO-PLACE COUNT. A number with empty
//     place-value columns (305, 1003) is structurally harder to build/read than
//     one with every column filled (235) — the classic "forgot the zero"
//     misconception — at the SAME magnitude band. Lever: 0 → 1 → 2 interior
//     zeros, clamped to places-2 so at least the top + ones digits stay non-zero
//     (floor: still a multi-digit number that requires reading the blocks).
//
//   add_with_blocks / subtract_with_blocks (operate) → REGROUP-EVENT COUNT,
//     identical to the regrouping-workbench pilot. carries/borrows 1 → 2 →
//     cascade (chained carry) / borrow-across-zero, magnitude held in band.
//     Floor 1 (operate under-tests at 0 regroups); cap places-1 so nothing
//     carries/borrows out of the top column (result stays in band, M>S strict).
//
//   regroup → NO structural lever (brief: "none"). The component renders only
//     standard-form starting states and the prompt forbids non-standard
//     arrangements, so a 2nd trade can't be shown. Its floor (exactly 1 trade)
//     is also its cap — scaffolding axis only, no branch here.
//
// The exact shape is CODE-enforced in post-process (re-selecting the target /
// operands); the prompt only describes the intent. The answer is a pure
// function of those numbers, so reconstruction stays self-consistent.
// See memory [[structural-difficulty-not-numeric]] / [[structural-difficulty-regrouping-pilot]].
// ---------------------------------------------------------------------------

const BT_OPERATE_TYPES = ['add_with_blocks', 'subtract_with_blocks'] as const;
const BT_ZEROGAP_TYPES = ['build_number', 'read_blocks'] as const;

interface ProblemShape {
  /** build/read: exact number of INTERIOR zero columns to force in the target. */
  zeroGapTarget: number;
  /** operate: exact number of carry/borrow events to force (≥1 for operate). */
  regroupTarget: number;
  /** operate subtract hard: force a borrow across a zero (e.g. 305 − 78). */
  crossZero: boolean;
  /** operate add hard: make the upper carry a CHAINED carry (own digits sum to 9). */
  chainedCarry: boolean;
  /** Prompt lines describing the structural intent (code still enforces). */
  promptLines: string[];
  /** True when this type has a structural lever; false → scaffolding-only (regroup). */
  hasLever: boolean;
}

/** ones→thousands → digit count. K-1 'tens' = 2, 2-3 'hundreds' = 3, 4-5 'thousands' = 4. */
const placeCount = (p?: string): number => (p === 'thousands' ? 4 : p === 'hundreds' ? 3 : p === 'ones' ? 1 : p === 'tens' ? 2 : 3);

/**
 * Resolve the in-mode structural lever for a tier. `places` (2/3/4 from the grade
 * band's maxPlace) bounds the achievable lever so we never push past the band:
 * a 2-digit number fits at most ONE interior zero (the tens column) and ONE
 * regroup, so its hard tier saturates there honestly (the scaffolding axis still
 * varies). The real ladder lives at 3- and 4-digit.
 */
function resolveProblemShape(type: string, tier: SupportTier, places: number): ProblemShape {
  // ── operate: regroup-event count (regrouping-workbench ladder) ──
  if ((BT_OPERATE_TYPES as readonly string[]).includes(type)) {
    const isSub = type === 'subtract_with_blocks';
    const ev = isSub ? 'borrow' : 'carry';
    // floor 1 (operate under-tests at 0); cap places-1 (no carry/borrow out of top → in band).
    const cap = Math.max(1, places - 1);
    const ideal = tier === 'easy' ? 1 : tier === 'medium' ? 2 : 3;
    const regroupTarget = Math.min(Math.max(ideal, 1), cap);
    const crossZero = isSub && tier === 'hard' && places >= 3 && regroupTarget >= 2;
    const chainedCarry = !isSub && tier === 'hard' && regroupTarget >= 2;

    let line: string;
    if (crossZero) {
      line = `PROBLEM SHAPE: a BORROW ACROSS A ZERO — the minuend has a 0 in the tens place, so the ones-place borrow cascades THROUGH the zero up to the hundreds (e.g. 305 − 78). The hardest elementary borrow.`;
    } else if (chainedCarry) {
      line = `PROBLEM SHAPE: a CASCADING carry — the ones column carries, and that carry pushes the tens column over 10 even though its own two digits sum to only 9 (a hidden, chained carry students often miss).`;
    } else if (regroupTarget >= 2) {
      line = `PROBLEM SHAPE: exactly TWO ${ev}s — both the ones and tens columns ${ev}.`;
    } else {
      line = `PROBLEM SHAPE: exactly ONE ${ev} (the ones column); keep every other column ${ev}-free.`;
    }
    return { zeroGapTarget: 0, regroupTarget, crossZero, chainedCarry, hasLever: true, promptLines: [line] };
  }

  // ── build_number / read_blocks: interior-zero-place count ──
  if ((BT_ZEROGAP_TYPES as readonly string[]).includes(type)) {
    // Interior places = the columns strictly between the top digit and the ones
    // digit (both held non-zero so the number stays multi-digit & in-band). For
    // `places` digits there are places-2 interior columns; cap the zero count there.
    const interior = Math.max(0, places - 2);
    const ideal = tier === 'easy' ? 0 : tier === 'medium' ? 1 : 2;
    const zeroGapTarget = Math.min(ideal, interior);

    let line: string;
    if (zeroGapTarget === 0) {
      line = `PROBLEM SHAPE: a number where EVERY place-value column has blocks (no empty columns), e.g. 235 / 4678. Each column is non-zero so there is no "missing place" to track.`;
    } else if (zeroGapTarget === 1) {
      line = `PROBLEM SHAPE: a number with exactly ONE interior zero — one empty place-value column the student must remember (e.g. 205, 4078). The "forgot the zero" trap.`;
    } else {
      line = `PROBLEM SHAPE: a number with TWO interior zeros — multiple empty place-value columns (e.g. 3008, 1005). Mostly-empty columns are the hardest to ${type === 'read_blocks' ? 'read' : 'build'} correctly.`;
    }
    return { zeroGapTarget, regroupTarget: 0, crossZero: false, chainedCarry: false, hasLever: true, promptLines: [line] };
  }

  // ── regroup (and any other type): NO structural lever (scaffolding axis only). ──
  return { zeroGapTarget: 0, regroupTarget: 0, crossZero: false, chainedCarry: false, hasLever: false, promptLines: [] };
}

// --- Constructive builders (code-enforced structural levers) ----------------
// The LLM picks numbers in the grade magnitude band; we re-select them in
// post-process to land the EXACT structural target (never trust the LLM to hit
// it), keeping every number `places`-digit (= in band). Digit arrays are
// ones-first to match the component's place-value reading.

const randInt = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (Math.max(lo, hi) - lo + 1));
const fromDigits = (digits: number[]): number => digits.reduce((n, d, i) => n + d * Math.pow(10, i), 0);
const toDigits = (num: number, places: number): number[] => {
  const out: number[] = [];
  let n = Math.abs(Math.floor(num));
  for (let i = 0; i < places; i++) { out.push(n % 10); n = Math.floor(n / 10); }
  return out;
};

/**
 * Build a `places`-digit number with EXACTLY `zeros` interior zero columns.
 * The top digit and the ones digit are always non-zero (so the number is a true
 * `places`-digit value that still requires reading every column / leaving real
 * gaps); the `zeros` interior columns nearest the ones place are forced to 0 and
 * the remaining interior columns are non-zero. `zeros` is assumed already clamped
 * to [0, places-2] by resolveProblemShape.
 */
function buildZeroGapNumber(places: number, zeros: number, bandMax = Infinity): number {
  const placeBase = Math.pow(10, places - 1);
  // top digit non-zero; cap it so even with the minimum non-zero ones digit (1) the
  // number never exceeds the band (covers K-1's 2-digit tens band whose max is 20:
  // top must be ≤1 because 2·10+1 = 21 > 20).
  const topMax = Math.min(9, Math.max(1, Math.floor((bandMax - 1) / placeBase)));
  const d = new Array(places).fill(0);
  d[places - 1] = randInt(1, topMax);     // top digit non-zero (in band, multi-digit)
  // interior columns are indices 1 .. places-2; force the lowest `zeros` of them to 0.
  for (let i = 1; i <= places - 2; i++) {
    d[i] = i <= zeros ? 0 : randInt(1, 9);
  }
  // ones digit non-zero (never a trivial single-column read) AND keep the total in
  // band: bound the ones so top·base + interior + ones ≤ bandMax.
  const headroom = bandMax - (fromDigits(d) - d[0]);
  const onesMax = Math.min(9, Math.max(1, headroom));
  d[0] = randInt(1, onesMax);
  return fromDigits(d);
}

/** Count interior zero columns (strictly between the highest non-zero digit and the ones place). */
function countInteriorZeros(num: number, places: number): number {
  const d = toDigits(num, places);
  // highest occupied column:
  let hi = places - 1;
  while (hi > 0 && d[hi] === 0) hi--;
  let zeros = 0;
  for (let i = 1; i < hi; i++) if (d[i] === 0) zeros++;
  return zeros;
}

/** Pick [da, db] with da∈[aMin,9], db∈[bMin,9], da+db within [sumLo,sumHi]. */
function pickPair(sumLo: number, sumHi: number, aMin: number, bMin: number): [number, number] {
  const lo = Math.max(sumLo, aMin + bMin);
  const hi = Math.min(Math.max(sumHi, lo), 18);
  const sum = randInt(lo, hi);
  const daLo = Math.max(aMin, sum - 9);
  const daHi = Math.min(9, sum - bMin);
  const da = randInt(daLo, daHi);
  const db = Math.min(9, Math.max(bMin, sum - da));
  return [da, db];
}

/**
 * Build two `places`-digit addends whose column addition produces EXACTLY
 * `carries` carry events, with NO carry out of the top column (sum stays
 * `places`-digit → in band). The lowest `carries` columns carry. When `chained`,
 * the highest carrying column carries only via the incoming carry (digits sum 9).
 */
function buildAdditionOperands(places: number, carries: number, chained: boolean): [number, number] {
  const a = new Array(places).fill(0);
  const b = new Array(places).fill(0);
  let carryIn = 0;
  for (let i = 0; i < places; i++) {
    const top = i === places - 1;
    const aMin = top ? 1 : 0;
    const bMin = top ? 1 : 0;
    let da: number, db: number;
    if (i < carries) {
      const isChainTop = chained && i === carries - 1 && carryIn === 1;
      const sumLo = isChainTop ? 9 : Math.max(10 - carryIn, aMin + bMin);
      const sumHi = isChainTop ? 9 : 16;
      [da, db] = pickPair(sumLo, sumHi, aMin, bMin);
      carryIn = 1;
    } else {
      [da, db] = pickPair(aMin + bMin, 9 - carryIn, aMin, bMin);
      carryIn = 0;
    }
    a[i] = da; b[i] = db;
  }
  return [fromDigits(a), fromDigits(b)];
}

/**
 * Build minuend & subtrahend (`places`-digit) whose subtraction needs EXACTLY
 * `borrows` borrow events, with NO borrow out of the top column (M > S, both in
 * band). When `crossZero`, the minuend's tens digit is forced to 0 so the
 * ones-place borrow cascades across the zero (e.g. 305 − 78).
 */
function buildSubtractionOperands(places: number, borrows: number, crossZero: boolean): [number, number] {
  const m = new Array(places).fill(0);
  const s = new Array(places).fill(0);
  let borrowIn = 0;
  for (let i = 0; i < places; i++) {
    const top = i === places - 1;
    const mMin = top ? 1 : 0;
    const sMin = top ? 1 : 0;
    let md: number, sd: number;
    if (i < borrows) {
      if (crossZero && i === 1) {
        md = 0; // force the across-zero column
        sd = randInt(Math.max(1, sMin), 9);
      } else {
        md = randInt(mMin, 8);
        const effM = md - borrowIn;
        sd = randInt(Math.max(sMin, effM + 1, 1), 9);
        if (sd <= effM) sd = Math.min(9, effM + 1);
      }
      borrowIn = 1;
    } else {
      // No borrow: effective M (md - borrowIn) >= sd. TOP column forces STRICT
      // inequality so the whole minuend exceeds the subtrahend (M > S) even when
      // every lower column is equal (else a 0-borrow problem could land M == S).
      sd = randInt(sMin, 7);
      const slack = top ? 1 : 0;
      md = randInt(Math.max(mMin, sd + borrowIn + slack), 9);
      borrowIn = 0;
    }
    m[i] = md; s[i] = sd;
  }
  return [fromDigits(m), fromDigits(s)];
}

/** Count carry events when adding a + b across `places` columns. */
function countCarries(a: number, b: number, places: number): number {
  const da = toDigits(a, places), db = toDigits(b, places);
  let carry = 0, n = 0;
  for (let i = 0; i < places; i++) {
    if (da[i] + db[i] + carry >= 10) { carry = 1; n++; } else carry = 0;
  }
  return n;
}

/** Count borrow events for m − s and flag whether any borrow crosses a zero. */
function analyzeBorrows(m: number, s: number, places: number): { borrows: number; crossesZero: boolean } {
  const dm = toDigits(m, places), ds = toDigits(s, places);
  let borrow = 0, n = 0, crossesZero = false;
  for (let i = 0; i < places; i++) {
    if (dm[i] - borrow < ds[i]) {
      if (i + 1 < places && dm[i + 1] === 0) crossesZero = true;
      borrow = 1; n++;
    } else borrow = 0;
  }
  return { borrows: n, crossesZero };
}

/**
 * Combined tier prompt block: scaffolding tone (resolveSupportStructure) PLUS
 * structural problem difficulty (resolveProblemShape). One section so the LLM
 * sees both axes of config.difficulty together — though the structural lever is
 * ultimately CODE-enforced on the numbers, not left to the LLM.
 */
function buildTierPromptSection(type: string, tier: SupportTier, places: number): string {
  const lines = [
    ...resolveSupportStructure(type, tier).promptLines,
    ...resolveProblemShape(type, tier, places).promptLines,
  ];
  return `\n## WITHIN-MODE SUPPORT TIER "${tier}" (scaffolding + problem STRUCTURE — NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["build_number", "read_blocks", "regroup", "add_with_blocks", "subtract_with_blocks"],
      description: "The type of challenge"
    },
    instruction: {
      type: Type.STRING,
      description: "Clear instruction telling the student what to do"
    },
    targetNumber: {
      type: Type.NUMBER,
      description: "The target number the student should build or identify"
    },
    secondNumber: {
      type: Type.NUMBER,
      description: "Second number for operations (add/subtract challenges). Optional.",
      nullable: true
    },
    hint: {
      type: Type.STRING,
      description: "A helpful hint shown after multiple failed attempts"
    }
  },
  required: ["type", "instruction", "targetNumber", "hint"]
};

const baseTenBlocksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the base-ten blocks visualization"
    },
    description: {
      type: Type.STRING,
      description: "Brief explanation of what the blocks demonstrate"
    },
    numberValue: {
      type: Type.NUMBER,
      description: "The primary number to represent using base-ten blocks"
    },
    interactionMode: {
      type: Type.STRING,
      enum: ["build", "decompose", "regroup", "operate"],
      description: "How the student interacts with the blocks. 'build' = construct a number, 'decompose' = break apart, 'regroup' = trade between places, 'operate' = add/subtract"
    },
    decimalMode: {
      type: Type.BOOLEAN,
      description: "Whether to include decimal places (tenths, hundredths). Default: false"
    },
    maxPlace: {
      type: Type.STRING,
      enum: ["ones", "tens", "hundreds", "thousands"],
      description: "The highest place value column to show. Default: 'hundreds'"
    },
    supplyTray: {
      type: Type.BOOLEAN,
      description: "Whether to show add/remove buttons for blocks. Default: true"
    },
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      description: "Array of sequential challenges for the student to complete"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-1", "2-3", "4-5"],
      description: "Target grade band for difficulty calibration"
    }
  },
  required: ["title", "description", "numberValue", "challenges", "gradeBand", "interactionMode"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate Base-Ten Blocks content
 *
 * Creates a base-ten blocks visualization for elementary math education,
 * helping students understand place value (ones, tens, hundreds, thousands).
 * Supports multiple interaction modes: build, decompose, regroup, operate.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Base-ten blocks data with number value and challenges
 */
export const generateBaseTenBlocks = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /** Structured number range from the manifest — controls grade-appropriate values. */
    numberRange?: { min: number; max: number };
    difficulty?: string;
  }
): Promise<BaseTenBlocksData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'base-ten-blocks',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseTenBlocksSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseTenBlocksSchema;

  // ── Resolve within-mode support tier (the STUDENT's tier — drives application) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is ONLY for the prompt tone (operate mode = 2 types → no single mode to describe).
  const pinnedType = evalConstraint && evalConstraint.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0]
    : undefined;
  // Best-effort place count for the PROMPT's structural shape (post-process uses
  // the resolved gradeBand/maxPlace, which is authoritative). Infer from the
  // manifest numberRange when present, else default to 3-digit (2-3 band).
  const promptPlaces = config?.numberRange
    ? (config.numberRange.max >= 1000 ? 4 : config.numberRange.max <= 20 ? 2 : 3)
    : 3;
  const tierSection = pinnedType && supportTier
    ? buildTierPromptSection(pinnedType, supportTier, promptPlaces)
    : '';

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Build number pool (Gemini structured output is near-deterministic — we own the randomness) ──
  // The minNonZeroDigits:2 floor bars a trivial single-digit target, but it also
  // bars the interior-zero-gap SHAPE that the structural axis needs at medium/hard
  // (e.g. 205 has only 2 non-zero digits, 1005 has only 2). Relax it to 1 when a
  // zero-gap tier is active so the LLM is free to author empty columns — the
  // post-process re-selects the exact zero count anyway and never drops below a
  // multi-digit target (buildZeroGapNumber pins the top + ones digits non-zero).
  const zeroGapActive = !!supportTier
    && supportTier !== 'easy'
    && !!pinnedType
    && (BT_ZEROGAP_TYPES as readonly string[]).includes(pinnedType);
  const pool = createNumberPool(config?.numberRange, { minNonZeroDigits: zeroGapActive ? 1 : 2 });
  console.log(`[BaseTenBlocks] pool:`, pool?.numbers ?? 'none', `difficulty:`, config?.difficulty ?? 'none');

  const rangeSection = pool?.toPromptSection({
    extraInstructions: '- Use the FIRST number as the primary numberValue for the activity.\n- Pick from the remaining numbers for individual challenge targetNumbers.',
  }) ?? '';

  const prompt = `You are generating a Base-Ten Blocks visualization for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || topic}

Generate base-ten blocks content that helps students understand place value (ones, tens, hundreds, thousands).

${challengeTypeSection}
${tierSection}
${rangeSection}

${!evalConstraint && !pool ? `
GRADE BAND GUIDELINES (use when no explicit range is provided):

K-1 (Kindergarten-Grade 1):
- Numbers 1-20 only
- maxPlace: 'tens'
- interactionMode: 'build' (build numbers from blocks)
- decimalMode: false
- Simple challenges: build_number, read_blocks
- 4-6 challenges

2-3 (Grades 2-3):
- Numbers 1-999
- maxPlace: 'hundreds'
- interactionMode: 'build' or 'regroup'
- decimalMode: false
- Challenges: build_number, read_blocks, regroup, add_with_blocks
- 4-6 challenges

4-5 (Grades 4-5):
- Numbers up to 9999, may include decimals
- maxPlace: 'thousands'
- interactionMode: 'operate' or 'decompose'
- decimalMode: true if topic involves decimals
- Challenges: all types including add_with_blocks, subtract_with_blocks
- 4-6 challenges
` : ''}
${!evalConstraint && pool ? `
INFER GRADE BAND FROM RANGE:
- Range max <= 20: gradeBand 'K-1', maxPlace 'tens', interactionMode 'build', 4-6 challenges
- Range max <= 999: gradeBand '2-3', maxPlace 'hundreds', interactionMode 'build' or 'regroup', 4-6 challenges
- Range max >= 1000: gradeBand '4-5', maxPlace 'thousands', interactionMode 'operate' or 'decompose', 4-6 challenges
` : ''}

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain the place value concept being practiced
3. Choose a numberValue appropriate for the grade level and topic
4. Set interactionMode based on the learning objective
5. Include 4-6 challenges that progress in difficulty
6. Each challenge must have a clear instruction, targetNumber, and helpful hint
7. For operation challenges, include secondNumber
8. Set gradeBand based on the target audience
9. Set maxPlace and decimalMode appropriately for the grade band

Return the complete base-ten blocks data structure.`;

  logEvalModeResolution('BaseTenBlocks', config?.targetEvalMode, evalConstraint);

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  // Apply defaults for optional fields
  data.interactionMode = data.interactionMode || 'build';
  data.decimalMode = data.decimalMode ?? false;
  data.maxPlace = data.maxPlace || 'hundreds';
  data.supplyTray = data.supplyTray ?? true;
  data.challenges = data.challenges || [];
  data.gradeBand = data.gradeBand || '2-3';

  // Validate numberValue is reasonable
  if (data.numberValue < 0) data.numberValue = Math.abs(data.numberValue);
  if (data.gradeBand === 'K-1' && data.numberValue > 20) data.numberValue = Math.min(data.numberValue, 20);
  if (data.gradeBand === '2-3' && data.numberValue > 999) data.numberValue = Math.min(data.numberValue, 999);
  if (data.gradeBand === '4-5' && data.numberValue > 9999) data.numberValue = Math.min(data.numberValue, 9999);

  // ── Fix interactionMode based on actual challenge types (BT-1/BT-3) ──
  // When all challenges are read_blocks or regroup, the top-level interactionMode
  // must match so the component initializes blocks correctly for the first challenge.
  if (data.challenges.length > 0) {
    const typeList = (data.challenges as BaseTenBlocksChallenge[]).map(c => c.type);
    const types = new Set(typeList);
    if (types.size === 1) {
      const onlyType = typeList[0];
      if (onlyType === 'read_blocks') data.interactionMode = 'decompose';
      else if (onlyType === 'regroup') data.interactionMode = 'regroup';
      else if (onlyType === 'add_with_blocks' || onlyType === 'subtract_with_blocks') data.interactionMode = 'operate';
      else if (onlyType === 'build_number') data.interactionMode = 'build';
    }
  }

  // Validate challenges
  data.challenges = data.challenges.map((c: BaseTenBlocksChallenge) => ({
    type: c.type || 'build_number',
    instruction: c.instruction || 'Build this number with blocks',
    targetNumber: c.targetNumber ?? data.numberValue,
    secondNumber: c.secondNumber,
    hint: c.hint || 'Think about the place values',
  }));

  // ── BT-3: Strip block-count leaks from read_blocks instructions ──
  // Gemini often names the decomposition ("2 hundreds, 4 tens, 5 ones") in the
  // instruction text, letting the student compute the answer without looking at
  // the blocks. Replace any leaky instruction with a generic prompt.
  const READ_BLOCKS_LEAK_PATTERNS = [
    /\d+\s+(hundreds?|tens?|ones?|thousands?)\b/i,           // "2 hundreds", "4 tens", "5 ones"
    /\b(hundreds?\s+blocks?|tens?\s+rods?|ones?\s+units?|unit\s+cubes?|flats?|rods?)\b/i,
  ];
  const GENERIC_READ_BLOCKS_INSTRUCTIONS = [
    'Look at the blocks shown above. What number do they represent?',
    'What number is shown by these blocks?',
    'Count the blocks above. What number do they make?',
  ];
  let readBlocksRewriteCount = 0;
  data.challenges = (data.challenges as BaseTenBlocksChallenge[]).map((c, idx) => {
    if (c.type !== 'read_blocks') return c;
    const instr = c.instruction ?? '';
    const leaks = READ_BLOCKS_LEAK_PATTERNS.some(re => re.test(instr));
    if (!leaks) return c;
    readBlocksRewriteCount++;
    return {
      ...c,
      instruction: GENERIC_READ_BLOCKS_INSTRUCTIONS[idx % GENERIC_READ_BLOCKS_INSTRUCTIONS.length],
    };
  });
  if (readBlocksRewriteCount > 0) {
    console.warn(`[BaseTenBlocks] BT-3 safety net: rewrote ${readBlocksRewriteCount} read_blocks instruction(s) that leaked block counts`);
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'build_number';
    const fallbacks: Record<string, BaseTenBlocksChallenge> = {
      build_number: { type: 'build_number', instruction: 'Build the number 45 with blocks!', targetNumber: 45, hint: '45 has 4 tens and 5 ones.' },
      read_blocks: { type: 'read_blocks', instruction: 'What number do these blocks show?', targetNumber: 123, hint: 'Count each column: hundreds, tens, ones.' },
      regroup: { type: 'regroup', instruction: 'Regroup 15 ones into tens and ones.', targetNumber: 15, hint: '10 ones = 1 ten. How many are left over?' },
      add_with_blocks: { type: 'add_with_blocks', instruction: 'Add 234 + 158 using blocks.', targetNumber: 392, secondNumber: 158, hint: 'Start with the ones column. Do you need to regroup?' },
      subtract_with_blocks: { type: 'subtract_with_blocks', instruction: 'Subtract 127 from 350 using blocks.', targetNumber: 223, secondNumber: 127, hint: 'Start with the ones. Can you borrow from the tens?' },
    };
    console.log(`[BaseTenBlocks] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [fallbacks[fallbackType] ?? fallbacks.build_number];
  }

  // ── Apply within-mode support tier per challenge (mode-correct, blends included) ──
  // Difficulty is a STUDENT property, so every challenge gets it — single-mode just
  // happens to give them all the same scaffold. Resolve from each challenge's OWN type
  // so a blended/operate session withdraws the right aids. read_blocks self-guards (both off).
  if (supportTier) {
    // --- AXIS 2: structural problem difficulty (code-enforced number re-selection) ---
    // Re-select each challenge's target/operands to land the EXACT structural shape
    // for the tier (honoring the LLM's numbers when they already hit it), keeping
    // every number inside the grade magnitude band (`places`-digit). The answer is a
    // pure function of these numbers (targetNumber IS the answer for build/read; the
    // component recomputes sum/difference for operate), so nothing is leaked and the
    // problem stays self-consistent. regroup has no lever (hasLever=false) → untouched.
    const places = placeCount(data.maxPlace);
    const bandMax = data.gradeBand === 'K-1' ? 20 : data.gradeBand === '4-5' ? 9999 : 999;
    let rewroteAny = false;

    for (const ch of data.challenges as BaseTenBlocksChallenge[]) {
      const shape = resolveProblemShape(ch.type, supportTier, places);
      if (!shape.hasLever) continue;

      if ((BT_ZEROGAP_TYPES as readonly string[]).includes(ch.type)) {
        // build_number / read_blocks: force the exact interior-zero count.
        const cur = ch.targetNumber;
        const needRebuild =
          !Number.isFinite(cur)
          || cur > bandMax
          || cur < Math.pow(10, Math.max(0, places - 1)) // must be a true `places`-digit number
          || countInteriorZeros(cur, places) !== shape.zeroGapTarget;
        if (needRebuild) {
          ch.targetNumber = buildZeroGapNumber(places, shape.zeroGapTarget, bandMax);
          rewroteAny = true;
        }
        ch.secondNumber = undefined;
      } else if ((BT_OPERATE_TYPES as readonly string[]).includes(ch.type)) {
        // add_with_blocks / subtract_with_blocks: force the exact regroup count.
        const isAdd = ch.type === 'add_with_blocks';
        // For operate the LLM sets targetNumber = sum/difference and secondNumber =
        // the 2nd addend / subtrahend. We need the two OPERANDS to validate the
        // shape. Recover operand1 from (target, second): add → o1 = sum - second;
        // sub → o1 = difference + second. Fall back to a rebuild if missing.
        const second = ch.secondNumber;
        let o1: number | undefined;
        if (Number.isFinite(ch.targetNumber) && Number.isFinite(second)) {
          o1 = isAdd ? (ch.targetNumber as number) - (second as number)
                     : (ch.targetNumber as number) + (second as number);
        }
        let a: number | undefined = o1;
        let b: number | undefined = second;
        let needRebuild = !(Number.isFinite(a) && Number.isFinite(b) && (a as number) > 0 && (b as number) > 0);
        if (!needRebuild) {
          if (isAdd) {
            const sum = (a as number) + (b as number);
            needRebuild =
              countCarries(a as number, b as number, places) !== shape.regroupTarget
              || shape.chainedCarry
              || sum > bandMax;
          } else {
            if ((a as number) < (b as number)) { const tmp = a; a = b; b = tmp; }
            const { borrows, crossesZero } = analyzeBorrows(a as number, b as number, places);
            needRebuild =
              (a as number) <= (b as number)
              || borrows !== shape.regroupTarget
              || (shape.crossZero && !crossesZero)
              || (a as number) > bandMax;
          }
        }
        if (needRebuild) {
          [a, b] = isAdd
            ? buildAdditionOperands(places, shape.regroupTarget, shape.chainedCarry)
            : buildSubtractionOperands(places, shape.regroupTarget, shape.crossZero);
          rewroteAny = true;
        }
        const op1 = a as number;
        const op2 = b as number;
        ch.secondNumber = op2;
        ch.targetNumber = isAdd ? op1 + op2 : op1 - op2;
        // Rewrite the instruction so the NAMED operands match the re-selected ones
        // (the old instruction text — "Add 234 + 158" — would otherwise desync).
        ch.instruction = isAdd
          ? `Add ${op1} + ${op2} using blocks.`
          : `Subtract ${op2} from ${op1} using blocks.`;
        // Drop any pre-baked hint that named the old operands; keep a generic one.
        ch.hint = isAdd
          ? 'Start with the ones column. Do you need to regroup?'
          : 'Start with the ones. Can you borrow from the next column?';
      }
    }
    if (rewroteAny) {
      console.log(
        `[BaseTenBlocks] Structural tier "${supportTier}" applied (places=${places}) → `
        + `${(data.challenges as BaseTenBlocksChallenge[]).map((c) => `${c.type}:${c.targetNumber}${c.secondNumber != null ? `/${c.secondNumber}` : ''}`).join(', ')}`,
      );
    }

    // --- AXIS 1: scaffolding withdrawal (display-only flags) ---
    data.challenges = (data.challenges as BaseTenBlocksChallenge[]).map((c) => {
      const sc = resolveSupportStructure(c.type, supportTier);
      return { ...c, showColumnCounts: sc.showColumnCounts, showBlocksTotal: sc.showBlocksTotal };
    });
    data.supportTier = supportTier; // mirror onto data so the tutor matches the screen
    console.log(`[BaseTenBlocks] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended/operate'})`);
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[BaseTenBlocks] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  console.log('🧱 Base-Ten Blocks Generated from dedicated service:', {
    topic,
    numberValue: data.numberValue,
    gradeBand: data.gradeBand,
    interactionMode: data.interactionMode,
    challengeCount: data.challenges.length,
  });

  return data as BaseTenBlocksData;
};
