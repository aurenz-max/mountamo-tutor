/**
 * Place Value Chart Generator — multi-instance pool-service generator.
 *
 * Each session walks the student through 3 distinct numbers in the SAME eval
 * mode. Each challenge has its own 3-phase within-challenge flow
 * (identify-place → find-value → build-number). Total session = 3 × 3 = 9
 * phases (PRD §7 Open Q #1 pilot — full 4 instances would be 12 phases, too
 * long).
 *
 * Per-challenge data is value-only (targetNumber + derived MC choices), so we
 * follow the pool-service pattern (PRD §6a #1, factor-tree precedent):
 *  - Gemini emits ONLY wrapper metadata (title, description, mode flags).
 *  - Local code deterministically selects N targetNumbers from the pool,
 *    derives highlightedDigitPlace, minPlace/maxPlace, placeNameChoices and
 *    digitValueChoices per challenge.
 *  - Structured-output Gemini converges per-call (PRD §6a #2), so any per-
 *    challenge variance must come from local randomness, not the prompt.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  PlaceValueChartData,
  PlaceValueChartChallenge,
} from "../../primitives/visual-primitives/math/PlaceValueChart";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { createNumberPool } from './numberPoolService';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: {
    promptDoc:
      `"identify": Simple 2-digit numbers, focus on recognizing place names. `
      + `Grades K-2.`,
    schemaDescription: "'identify' (recognize place names, K-2)",
  },
  build: {
    promptDoc:
      `"build": 3-digit numbers, focus on constructing the number in the chart. `
      + `Phase 3 (build) is the primary challenge. Grades 2-3.`,
    schemaDescription: "'build' (construct number in chart, 2-3)",
  },
  compare: {
    promptDoc:
      `"compare": 3-4 digit numbers with multiple non-zero digits. `
      + `Pick an interior place for highlighting. Grades 3-4.`,
    schemaDescription: "'compare' (multi-digit place reasoning, 3-4)",
  },
  expanded_form: {
    promptDoc:
      `"expanded_form": 4+ digit numbers or decimals, with showExpandedForm=true. `
      + `Grades 5+.`,
    schemaDescription: "'expanded_form' (expanded form with larger numbers, 5+)",
  },
};

// ---------------------------------------------------------------------------
// Wrapper schema — Gemini emits session-level metadata only.
// Per-challenge data (targetNumber etc.) is selected locally below.
// ---------------------------------------------------------------------------

const placeValueWrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      enum: ["identify", "build", "compare", "expanded_form"],
      description: "Challenge type controlling difficulty: 'identify' (K-2), 'build' (2-3), 'compare' (3-4), 'expanded_form' (5+).",
    },
    title: {
      type: Type.STRING,
      description: "Short session title (e.g., 'Place Value Practice — Grade 3'). Do NOT include specific numbers; the session uses multiple numbers.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence warm introduction. Tell the student they'll explore multiple numbers across three phases (identify, value, build). Do NOT include specific numbers.",
    },
    showExpandedForm: {
      type: Type.BOOLEAN,
      description: "Whether to show expanded form during build phase. Recommended true.",
    },
    showMultipliers: {
      type: Type.BOOLEAN,
      description: "Whether to show multiplier labels (×1, ×10, etc.) above each column. Recommended true for K-4.",
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Grade level string (e.g., 'Grade 3').",
    },
  },
  required: ["challengeType", "title", "description"],
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 3;
const MAX_INSTANCE_COUNT = 6;

const PLACE_NAMES: Record<number, string> = {
  6: 'Millions',
  5: 'Hundred Thousands',
  4: 'Ten Thousands',
  3: 'Thousands',
  2: 'Hundreds',
  1: 'Tens',
  0: 'Ones',
  [-1]: 'Tenths',
  [-2]: 'Hundredths',
  [-3]: 'Thousandths',
};

// Spoken vocabulary for digit values. Phase 2 uses these word-forms instead of
// raw numerals so the student must retrieve place-value vocabulary, not just
// append zeros to the visible digit (PVC-1 fix).
const ONES_WORDS: Record<number, string> = {
  1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
  6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine',
};

const TENS_WORDS: Record<number, string> = {
  1: 'Ten', 2: 'Twenty', 3: 'Thirty', 4: 'Forty', 5: 'Fifty',
  6: 'Sixty', 7: 'Seventy', 8: 'Eighty', 9: 'Ninety',
};

const DECIMAL_PLACE_WORDS_SINGULAR: Record<number, string> = {
  [-1]: 'Tenth',
  [-2]: 'Hundredth',
  [-3]: 'Thousandth',
};

const DECIMAL_PLACE_WORDS_PLURAL: Record<number, string> = {
  [-1]: 'Tenths',
  [-2]: 'Hundredths',
  [-3]: 'Thousandths',
};

/**
 * Spoken word-form of a single digit's value at a given place.
 * Examples: (7, 1) → "Seventy"; (3, 2) → "Three Hundred"; (5, -1) → "Five Tenths"; (1, -1) → "One Tenth".
 */
function buildDigitValueWord(digit: number, place: number): string {
  if (digit === 0) return 'Zero';

  if (place < 0) {
    const words = digit === 1
      ? DECIMAL_PLACE_WORDS_SINGULAR
      : DECIMAL_PLACE_WORDS_PLURAL;
    const decWord = words[place] ?? `10^${place}`;
    return `${ONES_WORDS[digit]} ${decWord}`;
  }

  switch (place) {
    case 0: return ONES_WORDS[digit];
    case 1: return TENS_WORDS[digit];                      // "Seventy"
    case 2: return `${ONES_WORDS[digit]} Hundred`;
    case 3: return `${ONES_WORDS[digit]} Thousand`;
    case 4: return `${TENS_WORDS[digit]} Thousand`;        // "Seventy Thousand"
    case 5: return `${ONES_WORDS[digit]} Hundred Thousand`;
    case 6: return `${ONES_WORDS[digit]} Million`;
    default: return `${ONES_WORDS[digit]} × 10^${place}`;
  }
}

// ---------------------------------------------------------------------------
// Per-mode number range + place range (drives the pool service)
// ---------------------------------------------------------------------------

interface ModeProfile {
  numberRange: { min: number; max: number };
  minPlace: number;
  maxPlace: number;
  allowDecimals?: boolean;
}

const MODE_PROFILES: Record<string, ModeProfile> = {
  identify:      { numberRange: { min: 11, max: 99 },      minPlace: 0,  maxPlace: 1 },
  build:         { numberRange: { min: 111, max: 999 },    minPlace: 0,  maxPlace: 2 },
  compare:       { numberRange: { min: 1111, max: 9999 },  minPlace: 0,  maxPlace: 3 },
  expanded_form: { numberRange: { min: 1111, max: 99999 }, minPlace: 0,  maxPlace: 4 },
};

// ---------------------------------------------------------------------------
// Per-challenge helpers (deterministic — own the randomness)
// ---------------------------------------------------------------------------

function getDigitAtPlace(num: number, place: number): number {
  const absNum = Math.abs(num);
  if (place >= 0) {
    return Math.floor(absNum / Math.pow(10, place)) % 10;
  }
  const shifted = Math.round(absNum * Math.pow(10, -place));
  return shifted % 10;
}

function getPlaceName(place: number): string {
  return PLACE_NAMES[place] || `10^${place}`;
}

/**
 * Pick an interior place (preferred) or any place with a non-zero digit.
 * Returns a place index within [minPlace, maxPlace].
 */
function selectHighlightedPlace(
  targetNumber: number,
  minPlace: number,
  maxPlace: number,
): number {
  const candidates: number[] = [];
  for (let p = minPlace; p <= maxPlace; p++) {
    if (getDigitAtPlace(targetNumber, p) !== 0) candidates.push(p);
  }
  if (candidates.length === 0) return minPlace;

  // Prefer interior places (not the ones digit, not the leftmost). Otherwise any.
  const interior = candidates.filter(p => p > minPlace && p < maxPlace);
  const pool = interior.length > 0 ? interior : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Build 4 place-name MC choices, with the correct answer at a random position
 * and 3 plausible adjacent-place distractors.
 */
function buildPlaceNameChoices(
  correctPlace: number,
  minPlace: number,
  maxPlace: number,
): string[] {
  const correctName = getPlaceName(correctPlace);
  const allPlaces: Array<{ place: number; name: string }> = [];

  // Gather all places in range, sorted by distance to correctPlace.
  for (let p = minPlace; p <= maxPlace; p++) {
    if (p === correctPlace) continue;
    allPlaces.push({ place: p, name: getPlaceName(p) });
  }
  // Pull from outside the range if we don't have enough distractors.
  for (const p of [maxPlace + 1, minPlace - 1, maxPlace + 2, minPlace - 2]) {
    if (allPlaces.length >= 6) break;
    if (PLACE_NAMES[p] && !allPlaces.some(x => x.name === PLACE_NAMES[p])) {
      allPlaces.push({ place: p, name: PLACE_NAMES[p] });
    }
  }
  allPlaces.sort(
    (a, b) => Math.abs(a.place - correctPlace) - Math.abs(b.place - correctPlace),
  );

  const distractors = allPlaces.slice(0, 3).map(p => p.name);
  const choices = [...distractors];
  const insertIdx = Math.floor(Math.random() * 4);
  choices.splice(insertIdx, 0, correctName);
  return choices;
}

/**
 * Build 4 digit-value MC choices as { value, wordForm } pairs: the correct
 * value plus 3 plausible off-by-one-place errors. Phase 2 displays wordForm
 * (e.g., "Seventy"); correctness compares on numeric value.
 *
 * Distractors are derived from the SAME digit at adjacent places, so each
 * choice is also expressible as a real word-form via buildDigitValueWord.
 */
function buildDigitValueChoices(
  digit: number,
  correctPlace: number,
): { value: number; wordForm: string }[] {
  const correctValue = digit * Math.pow(10, correctPlace);
  const correctChoice = {
    value: correctValue,
    wordForm: buildDigitValueWord(digit, correctPlace),
  };

  const candidatePlaces: number[] = [];
  for (const offset of [-1, 1, -2, 2, -3, 3]) {
    const p = correctPlace + offset;
    const v = digit * Math.pow(10, p);
    // Filter: positive, not the correct value, place we have a word-form for.
    if (v <= 0 || v === correctValue) continue;
    if (p < -3 || p > 6) continue; // outside our word-form range
    if (candidatePlaces.includes(p)) continue;
    candidatePlaces.push(p);
    if (candidatePlaces.length >= 3) break;
  }

  const distractors = candidatePlaces.slice(0, 3).map((p) => ({
    value: digit * Math.pow(10, p),
    wordForm: buildDigitValueWord(digit, p),
  }));

  // If we still don't have 3 distractors, pad by walking outward from
  // correctPlace using whatever word-form-supported places remain.
  if (distractors.length < 3) {
    for (let p = -3; p <= 6 && distractors.length < 3; p++) {
      if (p === correctPlace) continue;
      if (candidatePlaces.includes(p)) continue;
      const v = digit * Math.pow(10, p);
      if (v <= 0 || v === correctValue) continue;
      distractors.push({ value: v, wordForm: buildDigitValueWord(digit, p) });
    }
  }

  const choices = [...distractors];
  const insertIdx = Math.floor(Math.random() * (choices.length + 1));
  choices.splice(insertIdx, 0, correctChoice);
  return choices;
}

/**
 * Compute minPlace/maxPlace that cover the given number's digits, expanding
 * the mode default if needed.
 */
function computePlaceRange(
  targetNumber: number,
  defaultMin: number,
  defaultMax: number,
): { minPlace: number; maxPlace: number } {
  const absTarget = Math.abs(targetNumber);
  let minPlace = defaultMin;
  let maxPlace = defaultMax;

  if (absTarget >= 1) {
    const integerDigits = Math.floor(Math.log10(absTarget));
    if (maxPlace < integerDigits) maxPlace = integerDigits;
  }

  const targetStr = String(targetNumber);
  if (targetStr.includes('.')) {
    const decimalLen = targetStr.split('.')[1]?.length ?? 0;
    if (minPlace > -decimalLen) minPlace = -decimalLen;
  }

  return { minPlace, maxPlace };
}

/**
 * Select N distinct targetNumbers from the pool and build one
 * PlaceValueChartChallenge per number.
 */
function buildChallenges(
  challengeType: string,
  count: number,
  manifestRange?: { min: number; max: number },
): PlaceValueChartChallenge[] {
  const profile = MODE_PROFILES[challengeType] ?? MODE_PROFILES.compare;
  const range = manifestRange ?? profile.numberRange;

  const pool = createNumberPool(range, {
    count,
    integers: true,
    unique: true,
    minNonZeroDigits: 2,
  });
  const numbers = pool?.numbers ?? [];

  // Pad if the pool came up short (e.g., very tight range).
  while (numbers.length < count) {
    const fill = Math.floor(range.min + Math.random() * (range.max - range.min + 1));
    if (!numbers.includes(fill)) numbers.push(fill);
    else if (numbers.length === 0) {
      numbers.push(range.min);
      break;
    } else {
      break;
    }
  }

  return numbers.slice(0, count).map((targetNumber, idx) => {
    const { minPlace, maxPlace } = computePlaceRange(
      targetNumber,
      profile.minPlace,
      profile.maxPlace,
    );
    const highlightedDigitPlace = selectHighlightedPlace(targetNumber, minPlace, maxPlace);
    const digit = getDigitAtPlace(targetNumber, highlightedDigitPlace);
    return {
      id: `pvc-${idx + 1}`,
      targetNumber,
      highlightedDigitPlace,
      minPlace,
      maxPlace,
      placeNameChoices: buildPlaceNameChoices(highlightedDigitPlace, minPlace, maxPlace),
      digitValueChoices: buildDigitValueChoices(digit, highlightedDigitPlace),
    };
  });
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export const generatePlaceValueChart = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
    numberRange?: { min: number; max: number };
    /** Number of challenges in this session. Default 3 (pilot per PRD Open Q #1). */
    instanceCount?: number;
    showExpandedForm?: boolean;
    showMultipliers?: boolean;
  },
): Promise<PlaceValueChartData> => {
  // ── Eval-mode constraint resolution ──────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'place-value-chart',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PlaceValueChart', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(placeValueWrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, { fieldName: 'challengeType', rootLevel: true })
    : placeValueWrapperSchema;
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const instanceCount = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, config?.instanceCount ?? DEFAULT_INSTANCE_COUNT),
  );

  // ── Gemini wrapper call (metadata only) ──────────────────────────
  const prompt = `
Create the wrapper metadata for a MULTI-CHALLENGE place value chart session for "${topic}" (${gradeLevel}).

This session walks the student through ${instanceCount} DIFFERENT numbers. Each number runs through a 3-phase flow:
  Phase 1: "Identify the Place" — pick the place name of a highlighted digit
  Phase 2: "Find the Value"     — pick the value of that digit
  Phase 3: "Build the Number"   — enter each digit in the chart

${challengeTypeSection}

DO NOT include specific numbers in the title or description — the system picks ${instanceCount} numbers locally and the same session covers all of them.

GUIDELINES:
- title: short and number-free, e.g., "Place Value Practice — Grade 3" or "Build & Explore Place Value"
- description: 1-2 sentences warmly introducing the multi-challenge session and the three phases. No specific numbers.
- showExpandedForm: true (recommended)
- showMultipliers: true for K-4, optional for 5+
- gradeLevel: echo back "${gradeLevel}"

Return ONLY the wrapper metadata in the response schema.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid place value chart wrapper returned from Gemini API');
  }

  // ── Local: build challenges array ─────────────────────────────────
  const challengeType: string = wrapper.challengeType || evalConstraint?.allowedTypes[0] || 'compare';
  const challenges = buildChallenges(challengeType, instanceCount, config?.numberRange);

  console.log('🔢 Place Value Chart generated:', {
    topic,
    challengeType,
    instanceCount: challenges.length,
    numbers: challenges.map(c => c.targetNumber),
  });

  return {
    title: wrapper.title || 'Place Value Practice',
    description: wrapper.description || `Explore place values across ${instanceCount} different numbers.`,
    challenges,
    challengeType: challengeType as PlaceValueChartData['challengeType'],
    showExpandedForm: config?.showExpandedForm ?? wrapper.showExpandedForm ?? true,
    showMultipliers: config?.showMultipliers ?? wrapper.showMultipliers ?? true,
    gradeLevel: wrapper.gradeLevel || gradeLevel,
  };
};
