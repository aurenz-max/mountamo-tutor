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
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract: config.targetEvalMode says WHICH skill (task identity,
// matched to the objective by the manifest); config.difficulty says how much
// on-chart SUPPORT the student gets while doing it ('easy' = max scaffolding,
// 'hard' = min). It NEVER changes the number or its magnitude: the per-mode
// numberRange + pool service own those. A harder tier means LESS on-chart help
// (multiplier labels, the expanded-form panel) and terser hints — never a bigger
// number. See memory: structural-difficulty-not-numeric.
//
// SCAFFOLD-WITHDRAWAL ONLY. The structural prefilled-column lever was deferred.
//
// Levers (both already plumbed generator↔component, no new component field):
//   showMultipliers   — ×1 / ×10 / ×100 column headers (place-value crutch)
//   showExpandedForm  — the worked expanded-form panel during Build / the
//                       primary scaffold of expanded_form mode
// Plus hintDepth — drives hint terseness + the tutor reveal level (the tutor is
//   the second scaffold channel; the generator emits no instruction text).
//
// HARD GUARDS (UI contracts that are the task — never withdrawn by tier):
//   • Place-name column headers (Ones/Tens/Hundreds) ARE the identify + build
//     task — they have no toggle and stay rendered at every tier.
//   • The highlighted-digit echo ("Highlighted digit: N") tells the student
//     WHICH digit to reason about in Phases 1–2 — never withdrawn.
//   • showExpandedForm is the PRIMARY scaffold of expanded_form mode — withdrawn
//     only at HARD, never easy/medium.

// ---------------------------------------------------------------------------
// Within-mode difficulty = TWO axes (config.difficulty)
// ---------------------------------------------------------------------------
// Axis 1 (SCAFFOLDING, above): higher tier withdraws on-chart help.
// Axis 2 (STRUCTURE, below): higher tier hands a structurally HARDER problem of
//   the SAME mode and SAME magnitude band. The lever here is the count of
//   non-zero digits the student must coordinate (more real columns to
//   fill/decompose, fewer free zeros) via the pool service's minNonZeroDigits,
//   plus which place is highlighted (edge ones/leftmost → place-confusable
//   interior). The per-mode numberRange (magnitude band) NEVER changes.
const TIER_GUARDRAIL =
  'Numbers stay within the per-mode magnitude band (the same digit count). This '
  + 'tier changes the problem STRUCTURE — how many columns carry a real (non-zero) '
  + 'value and how place-confusable the highlighted column is — and how much '
  + 'on-chart help is shown, NOT the size of the number. Never just make the '
  + 'number bigger.';

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

type ChallengeType = 'identify' | 'build' | 'compare' | 'expanded_form';

interface SupportScaffold {
  /** ×1/×10/×100 multiplier-label column headers — a place-value crutch. */
  showMultipliers: boolean;
  /** The worked expanded-form panel. Primary scaffold of expanded_form mode —
   *  withdraw it there only at HARD. */
  showExpandedForm: boolean;
  /** Hint terseness + tutor reveal level: easy = name the strategy / show
   *  decomposition; hard = ask what each column is worth, never gift it. */
  hintDepth: 'full' | 'nudge' | 'terse';
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-chart support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * task with less scaffolding — never a different task, never a bigger number.
 *
 * Per-mode table (approved design):
 *   | mode          | easy            | medium          | hard               |
 *   | identify      | mult ON, exp ON | mult OFF, exp ON | mult OFF, exp OFF   |
 *   | build         | mult ON, exp ON | mult OFF, exp ON | mult OFF, exp OFF   |
 *   | compare       | mult ON, exp ON | mult OFF, exp ON | both OFF           |
 *   | expanded_form | mult ON, panel  | mult OFF, panel  | panel OFF (recall) |
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  // Multipliers: a uniform crutch across all modes — ON at easy only.
  const showMultipliers = tier === 'easy';
  // Expanded-form panel: ON at easy + medium, withdrawn only at HARD (it is the
  // primary scaffold of expanded_form mode, so it must survive easy/medium).
  const showExpandedForm = tier !== 'hard';
  const hintDepth: SupportScaffold['hintDepth'] =
    tier === 'easy' ? 'full' : tier === 'medium' ? 'nudge' : 'terse';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-chart SCAFFOLDING only (${tier === 'easy' ? 'maximum support: multiplier labels and the worked expanded-form panel help the student check each digit’s value' : tier === 'medium' ? 'moderate support: multiplier labels withdrawn; the expanded-form panel still confirms the decomposition' : 'minimum support: the student recalls the place values and decomposition unaided'}). Keep the number within the per-mode range; a harder tier NEVER means a bigger number, only less on-chart help.`,
  ];
  switch (pinnedType) {
    case 'identify':
      promptLines.push(
        tier === 'easy'
          ? 'Keep multiplier headers and the expanded-form panel visible so the student can confirm which place the highlighted digit sits in.'
          : tier === 'hard'
            ? 'Withhold multiplier headers and the expanded-form panel; the student names the place from the column headers alone. Hints stay terse — ask what each column is worth, never name the place.'
            : 'Withhold multiplier headers but keep the expanded-form panel; the student reasons about the place with the decomposition still in view.',
      );
      break;
    case 'build':
      promptLines.push(
        tier === 'easy'
          ? 'Keep multiplier headers and the live expanded-form panel visible so the student can self-check each digit as they build.'
          : tier === 'hard'
            ? 'Withhold multiplier headers and the expanded-form panel; the student builds the number from the place-name headers alone and verifies it themselves.'
            : 'Withhold multiplier headers but keep the expanded-form panel as a self-check while building.',
      );
      break;
    case 'compare':
      promptLines.push(
        tier === 'easy'
          ? 'Keep multiplier headers and the expanded-form panel visible to support multi-digit place reasoning.'
          : tier === 'hard'
            ? 'Withhold both multiplier headers and the expanded-form panel; the student reasons about the interior place unaided.'
            : 'Withhold multiplier headers but keep the expanded-form panel to anchor the place reasoning.',
      );
      break;
    case 'expanded_form':
      promptLines.push(
        tier === 'easy'
          ? 'Keep multiplier headers and the worked expanded-form panel visible — the panel shows the decomposition for the student to read.'
          : tier === 'hard'
            ? 'Withhold the expanded-form panel entirely; the student recalls and produces the decomposition unaided (the panel is this mode’s primary scaffold, so it is withdrawn only at hard).'
            : 'Withhold multiplier headers but keep the worked expanded-form panel so the student still sees the decomposition.',
      );
      break;
  }
  return { showMultipliers, showExpandedForm, hintDepth, promptLines };
}

// ---------------------------------------------------------------------------
// Axis 2: STRUCTURAL difficulty (problem SHAPE, not magnitude)
// ---------------------------------------------------------------------------
// Lever = the count of non-zero digits the student must coordinate
// (minNonZeroDigits, fed to the pool service) + which place is highlighted
// (edge → place-confusable interior). The magnitude band (per-mode digit count)
// is invariant; this only fills more real columns and picks a harder column.
//
// Highlight preference resolved against the number's non-zero places:
//   'edge'          — the ones digit or the leftmost digit (least confusable).
//   'interior'      — any non-edge non-zero place.
//   'deep-interior' — a non-edge place as far from both ends as possible
//                     (tens/hundreds in a 4-digit number — most confusable).
//   'any'           — no preference (existing interior-preferring heuristic).
type HighlightPreference = 'edge' | 'interior' | 'deep-interior' | 'any';

interface ProblemShape {
  /** Floor on non-zero digits the pool must produce for this tier+mode.
   *  Clamped INSIDE resolveProblemShape to [modeDefault, bandDigitFloor] so it
   *  can never re-enter another mode (too few) or demand more non-zero digits
   *  than the band's smallest number has (saturation). */
  minNonZeroDigits: number;
  /** Which place to highlight (Phase 1/2 reasoning target). */
  highlightPreference: HighlightPreference;
  /** Soft description folded into the tier prompt block. */
  promptLines: string[];
}

// Per-mode structural defaults. minNonZeroFloor = the mode's identity floor
// (never drop below it — that re-enters an easier mode). bandDigitFloor = the
// digit count of the SMALLEST number in the band, i.e. the largest
// minNonZeroDigits achievable for EVERY number (above it saturates).
const STRUCTURAL_PROFILES: Record<ChallengeType, { minNonZeroFloor: number; bandDigitFloor: number }> = {
  // identify: 2-digit (11-99), already 2-of-2 non-zero. No structural room.
  identify:      { minNonZeroFloor: 2, bandDigitFloor: 2 },
  // build: 3-digit (111-999). Floor 2 (≥1 free zero column allowed), cap 3.
  build:         { minNonZeroFloor: 2, bandDigitFloor: 3 },
  // compare: 4-digit (1111-9999). Floor 2 (pool default), cap 4.
  compare:       { minNonZeroFloor: 2, bandDigitFloor: 4 },
  // expanded_form: 4-5 digit (1111-99999). Smallest is 4-digit, so the floor of
  // achievable non-zero digits across the whole band is 4 (a 5-digit draw can
  // carry 5, but a 4-digit draw cannot — clamping to 4 keeps it non-saturating).
  expanded_form: { minNonZeroFloor: 2, bandDigitFloor: 4 },
};

/**
 * Resolve the structural problem SHAPE for a tier on a pinned mode. ONE source
 * of truth consumed by both the prompt section and the post-process rebuild.
 * Clamps minNonZeroDigits to [floor, cap] so it can never re-enter another mode
 * (below floor) or saturate the pool's digit fixup (above the band digit floor).
 */
function resolveProblemShape(mode: ChallengeType, tier: SupportTier): ProblemShape {
  const prof = STRUCTURAL_PROFILES[mode] ?? STRUCTURAL_PROFILES.compare;
  const clamp = (v: number) =>
    Math.max(prof.minNonZeroFloor, Math.min(prof.bandDigitFloor, v));

  // identify has zero structural headroom (2-of-2 non-zero already). lever=none.
  if (mode === 'identify') {
    return {
      minNonZeroDigits: prof.minNonZeroFloor,
      highlightPreference: 'any',
      promptLines: [
        'PROBLEM SHAPE: a 2-digit number (tens + ones); both columns already carry '
        + 'a value. This mode has no structural headroom — difficulty is the '
        + 'scaffolding tier only, NOT a bigger number.',
      ],
    };
  }

  // The non-zero-digit ladder, clamped per mode.
  const want = tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4;
  const minNonZeroDigits = clamp(want);

  // Highlight preference hardens edge → interior → deep-interior.
  const highlightPreference: HighlightPreference =
    tier === 'easy' ? 'edge' : tier === 'medium' ? 'interior' : 'deep-interior';

  const saturated = want > minNonZeroDigits;
  const promptLines: string[] = [
    `PROBLEM SHAPE: keep the number in the per-mode band but make at least `
    + `${minNonZeroDigits} of its columns carry a real (non-zero) value`
    + `${saturated ? ' (the band cannot pack more non-zero columns than this, so this is the ceiling)' : ''}`
    + `. ${
      tier === 'easy'
        ? 'Highlight an EDGE digit (the ones place or the leftmost place) — the least place-confusable column — and allow a free zero column.'
        : tier === 'medium'
          ? 'Every main column should carry a value; highlight an INTERIOR (non-edge) place so the student cannot rely on position-at-an-end.'
          : 'Pack every column with a non-zero digit (no free zeros) and highlight a DEEP-INTERIOR place (e.g. the tens/hundreds of a 4-digit number) — the most place-confusable column.'
    }`,
    TIER_GUARDRAIL,
  ];
  return { minNonZeroDigits, highlightPreference, promptLines };
}

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
 * Tier-aware highlight selection (axis-2 structural lever). Picks a non-zero
 * place honoring the tier's HighlightPreference; falls back to the existing
 * interior-preferring heuristic when no place matches (always returns a non-zero
 * place when one exists, so Phase-2 distractors stay derivable).
 */
function selectHighlightedPlaceForTier(
  targetNumber: number,
  minPlace: number,
  maxPlace: number,
  preference: HighlightPreference,
): number {
  const candidates: number[] = [];
  for (let p = minPlace; p <= maxPlace; p++) {
    if (getDigitAtPlace(targetNumber, p) !== 0) candidates.push(p);
  }
  if (candidates.length === 0) return minPlace;
  if (preference === 'any') {
    return selectHighlightedPlace(targetNumber, minPlace, maxPlace);
  }

  const isEdge = (p: number) => p === minPlace || p === maxPlace;
  const interior = candidates.filter(p => !isEdge(p));

  let pool: number[];
  if (preference === 'edge') {
    const edges = candidates.filter(isEdge);
    pool = edges.length > 0 ? edges : candidates;
  } else if (preference === 'deep-interior') {
    // Maximize distance from BOTH ends; fall back to any interior, then any.
    const base = interior.length > 0 ? interior : candidates;
    let best = -1;
    pool = [];
    for (const p of base) {
      const dist = Math.min(p - minPlace, maxPlace - p);
      if (dist > best) { best = dist; pool = [p]; }
      else if (dist === best) pool.push(p);
    }
  } else {
    // 'interior'
    pool = interior.length > 0 ? interior : candidates;
  }
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
 * Constructive enforcement of the tier's non-zero-digit floor (axis 2). Counts
 * the number's non-zero digits and, if short of `target`, replaces zero digits
 * (interior/ones first, never the already-non-zero leading digit) with random
 * 1-9 values. Preserves the DIGIT COUNT — so the number stays in the exact same
 * magnitude band (never crosses into another mode) — and clamps to `range`.
 * Idempotent once the floor is met.
 */
function enforceNonZeroDigits(
  n: number,
  target: number,
  range: { min: number; max: number },
): number {
  if (target <= 0) return n;
  const neg = n < 0;
  const digits = String(Math.abs(Math.trunc(n))).split('').map(Number);
  let nonZero = digits.filter(d => d > 0).length;
  if (nonZero >= target) return n;

  // Fill zero positions from the RIGHT (ones-ward) so the leading digit and the
  // overall digit count are untouched. The leading digit (index 0) is already
  // non-zero for every in-band number, so we never need to touch it.
  for (let i = digits.length - 1; i >= 0 && nonZero < target; i--) {
    if (digits[i] === 0) {
      digits[i] = 1 + Math.floor(Math.random() * 9); // 1-9
      nonZero++;
    }
  }
  let result = Number(digits.join(''));
  if (neg) result = -result;
  // Digit count is preserved, so result stays the same order of magnitude.
  // Clamp defensively (an all-9s band max can never be exceeded by this).
  if (result < range.min) result = Math.max(range.min, result);
  if (result > range.max) result = Math.min(range.max, result);
  return result;
}

/**
 * Select N distinct targetNumbers from the pool and build one
 * PlaceValueChartChallenge per number.
 */
function buildChallenges(
  challengeType: string,
  count: number,
  manifestRange?: { min: number; max: number },
  /** Axis-2 structural shape (gated on supportTier upstream). When absent, the
   *  no-tier defaults below reproduce the original behavior byte-for-byte. */
  shape?: ProblemShape,
): PlaceValueChartChallenge[] {
  const profile = MODE_PROFILES[challengeType] ?? MODE_PROFILES.compare;
  const range = manifestRange ?? profile.numberRange;

  const pool = createNumberPool(range, {
    count,
    integers: true,
    unique: true,
    minNonZeroDigits: shape?.minNonZeroDigits ?? 2,
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

  return numbers.slice(0, count).map((rawNumber, idx) => {
    // Axis-2 enforcement: COUNT the pool's actual non-zero columns; if it falls
    // short of the tier target (the pool clamps back to range after its own
    // fixup, which can re-zero a column), RECONSTRUCT deterministically by
    // filling zero columns 1-9 while staying inside the same magnitude band.
    const targetNumber = shape
      ? enforceNonZeroDigits(rawNumber, shape.minNonZeroDigits, range)
      : rawNumber;
    const { minPlace, maxPlace } = computePlaceRange(
      targetNumber,
      profile.minPlace,
      profile.maxPlace,
    );
    const highlightedDigitPlace = shape
      ? selectHighlightedPlaceForTier(targetNumber, minPlace, maxPlace, shape.highlightPreference)
      : selectHighlightedPlace(targetNumber, minPlace, maxPlace);
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
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-chart scaffolding within it. NEVER changes the
     * number or its magnitude.
     */
    difficulty?: string;
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

  // ── Within-mode support tier ─────────────────────────────────────
  // The eval mode owns WHAT skill; config.difficulty owns how much on-chart
  // scaffolding within it. supportTier DRIVES the deterministic application
  // below (gated only on a tier being present). pinnedType is for the prompt
  // tone ONLY — a single pinned mode to describe to the LLM for title/desc.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  // Axis-2 structural shape for the prompt (same source consumed by the rebuild).
  const tierShape =
    pinnedType && supportTier ? resolveProblemShape(pinnedType, supportTier) : null;
  const tierSection =
    tierScaffold || tierShape
      ? `\n## WITHIN-MODE DIFFICULTY TIER "${supportTier}" (scaffolding + problem STRUCTURE — NOT number size)\n${[
          ...(tierScaffold?.promptLines ?? []),
          ...(tierShape?.promptLines ?? []),
        ]
          .map((l) => `- ${l}`)
          .join('\n')}\n`
      : '';

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
${tierSection}
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
  // Axis-2 structural shape — gated ONLY on supportTier being present, resolved
  // from the RESOLVED mode (same gate as the scaffold application below), so a
  // session reached via challengeType inference still gets a harder SHAPE. When
  // supportTier is absent, shape is undefined and buildChallenges reproduces the
  // original no-tier behavior byte-for-byte.
  const problemShape = supportTier
    ? resolveProblemShape(challengeType as ChallengeType, supportTier)
    : undefined;
  const challenges = buildChallenges(
    challengeType,
    instanceCount,
    config?.numberRange,
    problemShape,
  );

  console.log('🔢 Place Value Chart generated:', {
    topic,
    challengeType,
    instanceCount: challenges.length,
    numbers: challenges.map(c => c.targetNumber),
  });

  // ── Resolve the session-level show flags (default = current behavior) ──
  let showExpandedForm = config?.showExpandedForm ?? wrapper.showExpandedForm ?? true;
  let showMultipliers = config?.showMultipliers ?? wrapper.showMultipliers ?? true;
  let resolvedSupportTier: SupportTier | undefined;

  // ── Apply the support-tier scaffold deterministically at the END (code owns
  // the SUPPORT structure; the LLM only chose metadata). Withdraws scaffolds as
  // the tier hardens — never alters the number. Gated ONLY on supportTier being
  // present (not on pinnedType), so a session reached via challengeType inference
  // still gets difficulty. showExpandedForm / showMultipliers are SESSION-level
  // flags and every challenge in this primitive shares one mode (challengeType),
  // so the scaffold resolves once from that mode. Mode guards live inside
  // resolveSupportStructure (e.g. expanded_form keeps the panel through medium).
  // The place-name column headers and highlighted-digit echo are NOT data flags
  // — they have no toggle and stay rendered at every tier (UI contract). ──
  if (supportTier) {
    resolvedSupportTier = supportTier;
    const sc = resolveSupportStructure(challengeType as ChallengeType, supportTier);
    showMultipliers = sc.showMultipliers;
    showExpandedForm = sc.showExpandedForm;
    console.log(
      `[PlaceValue] Support tier "${supportTier}" applied (${pinnedType ? `single-mode ${pinnedType}` : `mode ${challengeType}`}) → multipliers=${showMultipliers}, expandedForm=${showExpandedForm}`,
    );
  }

  return {
    title: wrapper.title || 'Place Value Practice',
    description: wrapper.description || `Explore place values across ${instanceCount} different numbers.`,
    challenges,
    challengeType: challengeType as PlaceValueChartData['challengeType'],
    showExpandedForm,
    showMultipliers,
    supportTier: resolvedSupportTier,
    gradeLevel: wrapper.gradeLevel || gradeLevel,
  };
};
