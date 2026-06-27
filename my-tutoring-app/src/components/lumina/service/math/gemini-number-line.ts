import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  NumberLineData,
  NumberLineOperation,
  NumberLineChallenge,
} from "../../primitives/visual-primitives/math/NumberLine";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { createSubRangePool } from './numberPoolService';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  plot_point: {
    promptDoc:
      `"plot_point": Student places a point at the correct value on the number line. `
      + `K-2: integers 0-20, warm language ("Can you find where 7 lives?"). `
      + `3-5: fractions, decimals, negatives. Concrete manipulative with full guidance.`,
    schemaDescription: "'plot_point' (place value on line)",
  },
  show_jump: {
    promptDoc:
      `"show_jump": Student shows an operation as movement on the number line. `
      + `K-2: simple +1/+2/+3 jumps within 0-20. 3-5: larger jumps, fractions, negatives.`,
    schemaDescription: "'show_jump' (operation as movement)",
  },
  order_values: {
    promptDoc:
      `"order_values": Student arranges 3-4 values in order on the number line. `
      + `K-2: integers only, typically 3 values within 0-20. `
      + `3-5: fractions, decimals, mixed numbers, negatives.`,
    schemaDescription: "'order_values' (sequence values)",
  },
  find_between: {
    promptDoc:
      `"find_between": Student estimates or finds a value between two given marks. `
      + `Primarily 3-5: fractions between benchmarks, decimals on a zoomed line.`,
    schemaDescription: "'find_between' (estimate between marks)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — second axis of the two-field
// contract: targetEvalMode = WHICH skill, difficulty = HOW MUCH on-screen
// scaffolding within it. A tier withdraws perception/tracking aids (tick labels,
// benchmark anchors, the worked jump arc) and dials hint explicitness — it NEVER
// changes the target values, the scope `range`, or the snap precision/tolerance
// (those are owned by the eval mode + scope + numberType). The one STRUCTURAL
// lever is show_jump's steps-to-solve (1 op easy/med → 2 chained ops hard), and
// even that keeps every cumulative landing INSIDE the same scope `range`. See
// memory [[structural-difficulty-not-numeric]] / [[feedback_llm-window-code-builds-structure]].
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// Tuning — per-mode instance counts (see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a)
// ---------------------------------------------------------------------------

type ChallengeType = 'plot_point' | 'show_jump' | 'order_values' | 'find_between';

const DEFAULT_INSTANCE_COUNT = 7; // tier fallback (T1)
const MAX_INSTANCE_COUNT = 8;

// NOTE: this primitive uses an orchestrator-per-challenge pattern — each
// sub-generator fans out N parallel single-challenge Gemini calls. Per the
// instance-count audit hook, orchestrator-per-challenge modes are capped at 5
// (not the T1 fallback of 7) to keep cost/latency in check. `plot_point` covers
// both the `plot` and `identify` eval modes; bumping it to 5 is the most we can
// safely do without converting the sub-generator to pool-service.
const COUNT_BY_MODE: Record<ChallengeType, number> = {
  plot_point: 5,
  show_jump: 4,
  order_values: 4,
  find_between: 4,
};

function resolveCount(type: ChallengeType): number {
  return Math.max(1, Math.min(MAX_INSTANCE_COUNT, COUNT_BY_MODE[type] ?? DEFAULT_INSTANCE_COUNT));
}

// ---------------------------------------------------------------------------
// Bespoke support-tier levers (the creative 20%) — one field per lever found in
// the COMPONENT. Number-line's interaction surface exposes:
//   • tickInterval (NumberLineData)  → coarser interval = sparse labels = harder
//     to read a position. getLabelInterval() then derives label density from it.
//   • highlights[] (NumberLineData)  → benchmark anchor dots ("a helper mark") the
//     student reads from. NEVER the target value (leak guard, see addAnchors()).
//   • operations[].showJumpArc       → the worked arc + ±N label = near-complete
//     worked example; ON only at EASY, withdrawn by MEDIUM.
//   • operations[] length            → STRUCTURAL steps-to-solve: 1 op (easy/med)
//     → 2 chained ops (hard). Cumulative landing clamped inside `range`.
//   • instruction/hint tone          → modality #2 (text), shaped via promptLines.
// Snap precision / answer tolerance stays tied to numberType, NEVER the tier.
// ---------------------------------------------------------------------------

interface SupportScaffold {
  /** Forced tick-label coarseness multiplier vs. the default interval. 1 = default
   *  major ticks; >1 = sparser labels (coarser interval); <1 (never used) denser.
   *  null = leave the component default. plot_point/find_between/order_values. */
  labelCoarseness: number | null;
  /** Show a benchmark anchor highlight NEAR (never equal to) each target so the
   *  student counts from a helper mark. plot_point / find_between only. */
  showAnchors: boolean;
  /** show_jump only: draw the worked arc + ±N (a worked example). EASY only. */
  showJumpArc: boolean;
  /** show_jump only: STRUCTURAL steps-to-solve. 1 op (easy/med) → 2 chained (hard). */
  jumpSteps: 1 | 2;
  /** Prompt lines describing the tier to the sub-generator (hint-tone only #2). */
  promptLines: string[];
}

const TIER_GUARDRAIL =
  'Support tier sets on-screen SCAFFOLDING and (for jumps) problem STRUCTURE only — ' +
  'it NEVER changes the target numbers, the number-line range, or how precisely the ' +
  'student must place a point. Keep every value within the given range.';

/** easy → hard support gradient, per challenge type. Code owns the structure
 *  (anchors, arc, tick coarseness, jump steps); the LLM only writes the words. */
function resolveSupportStructure(type: ChallengeType, tier: SupportTier): SupportScaffold {
  switch (type) {
    case 'show_jump':
      return {
        labelCoarseness: null,
        showAnchors: false,
        showJumpArc: tier === 'easy',          // worked arc + ±N only at easy
        jumpSteps: tier === 'hard' ? 2 : 1,    // STRUCTURAL: chained ops at hard
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: a single jump, and the worked arc + size are drawn on the line. The hint may NAME the hop count ("count 3 hops to the right").'
            : tier === 'medium'
              ? 'MEDIUM: a single jump, the start marker is shown but the arc is hidden — the student counts the hops themselves. The hint nudges direction/count without naming the landing.'
              : 'HARD: TWO chained jumps (multi-step) — the student performs the first hop, then jumps again from where they landed. No arc, no anchors. Hint is terse: ask which way each jump goes; never name a landing value.',
        ],
      };
    case 'order_values':
      return {
        labelCoarseness: tier === 'easy' ? 1 : tier === 'hard' ? 2 : null,
        showAnchors: tier === 'easy',          // benchmark dots to compare against
        showJumpArc: false,
        jumpSteps: 1,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: dense tick labels and benchmark anchor dots are on the line. Hint may say "find each number on the line first".'
            : tier === 'medium'
              ? 'MEDIUM: default labels, no anchors — the student locates each value unaided.'
              : 'HARD: sparse tick labels and no anchors — the student estimates positions. No hint hand-holding; ask them to compare two at a time.',
        ],
      };
    case 'find_between':
      return {
        labelCoarseness: tier === 'easy' ? 1 : tier === 'hard' ? 2 : null,
        showAnchors: tier === 'easy',          // anchors in the gap (never the bounds-as-answer)
        showJumpArc: false,
        jumpSteps: 1,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: dense labels in the gap and benchmark anchor dots between the two marks. Hint may name the tick marks that sit between the bounds.'
            : tier === 'medium'
              ? 'MEDIUM: default labels, a wider gap, no anchors — the student reasons about what lies between.'
              : 'HARD: sparse labels, a wide gap, no anchors — the student estimates. Vague hint only ("somewhere in the middle of the two"); never name a tick.',
        ],
      };
    case 'plot_point':
    default:
      return {
        labelCoarseness: tier === 'easy' ? 1 : tier === 'hard' ? 2 : null,
        showAnchors: tier === 'easy',          // a benchmark anchor NEAR (≠) the target
        showJumpArc: false,
        jumpSteps: 1,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: every tick is labeled and a benchmark anchor dot sits near the target. The instruction may name the neighbouring tick marks the target lives between.'
            : tier === 'medium'
              ? 'MEDIUM: major ticks only, no anchor — the student finds the spot using the labeled ticks.'
              : 'HARD: sparse tick labels (coarser interval) and no anchor — an estimate-style placement. The hint is vague ("about how far along?"); never name the neighbouring numbers.',
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// STRUCTURAL problem difficulty (the SECOND thing config.difficulty drives) —
// distinct from the scaffolding withdrawal above. This makes the generated
// PROBLEM itself genuinely harder per tier by reshaping WHICH in-band values the
// pickers choose, NEVER by inflating magnitude (range/numberType are owned by the
// eval mode + scope) and NEVER by reshaping into another mode. number-line is a
// graph-data primitive: every mode reduces to reading a position against a tick
// lattice, so the canonical levers are gap-subtlety and step-depth.
//
//   identify/plot (plot_point) → target-to-LABELED-tick distance: target sits ON a
//        labeled tick (easy) → on a minor/unlabeled tick (medium) → maximally
//        BETWEEN two labeled ticks, forcing the widest interpolation (hard).
//   jump (show_jump)          → steps-to-solve depth: 1 op (easy/medium) → 2
//        chained ops (hard). (Built in resolveSupportStructure.jumpSteps; mirrored
//        here for one coherent prompt voice.)
//   order (order_values)      → adjacent-value gap |a-b|: values spread far apart
//        (easy) → mixed (medium) → tightly clustered, near-indistinguishable (hard).
//   between (find_between)    → bound-gap width: bounds far apart, many in-between
//        ticks (easy) → moderate (medium) → bounds adjacent, exactly one in-between
//        value (hard).
//
// The structural numeric levers (labelOffset / orderGap / boundGap) are ENFORCED
// by constructive re-selectors in each sub-generator's post-process (count the
// LLM-agnostic picker output → honor if already on-target → else reconstruct to
// the EXACT target, in band, preserving solvability). The answer in every mode is
// the re-selected value(s), so the emitted targetValues ARE the recomputed answer.
// See memory [[structural-difficulty-not-numeric]] / [[structural-difficulty-regrouping-pilot]].
// ---------------------------------------------------------------------------

/**
 * Effective LABEL interval for an integer line — mirrors the component's
 * getLabelInterval(numberType, tickInterval, range) so the generator's notion of
 * "on a labeled tick" matches what the student actually sees. For non-integer
 * types the label interval equals the tick interval (component contract). `range`
 * here is the SPAN (max-min), matching the component.
 */
/** Snap precision per numberType — mirrors the component's getSnapPrecision so
 *  the generator only ever proposes targets the snap-check can actually honor. */
function snapPrecisionFor(numberType: ResolvedRange['numberType']): number {
  if (numberType === 'integer') return 1;
  if (numberType === 'decimal') return 0.01;
  return 1 / 8; // fraction / mixed
}

/** Default tick interval per numberType+span — mirrors the component's
 *  getDefaultTickInterval so "labeled tick" math matches what renders. */
function defaultTickIntervalFor(numberType: ResolvedRange['numberType'], span: number): number {
  if (numberType === 'integer') {
    if (span <= 30) return 1;
    if (span <= 100) return 5;
    return 10;
  }
  const precision = snapPrecisionFor(numberType);
  let interval = precision;
  while (span / interval > 25) interval *= 2;
  return interval;
}

function effectiveLabelInterval(
  numberType: ResolvedRange['numberType'],
  tickInterval: number,
  span: number,
): number {
  if (numberType !== 'integer') return Math.max(tickInterval, 1e-9);
  if (tickInterval === 1) {
    if (span <= 10) return 1;
    if (span <= 20) return 2;
    return 5;
  }
  if (tickInterval === 5) {
    if (span <= 50) return 5;
    return 10;
  }
  return tickInterval;
}

interface ProblemShape {
  /** plot_point: where the target should sit relative to the LABEL grid.
   *  'on' = on a labeled tick; 'minor' = on an unlabeled tick one step from a
   *  label; 'mid' = maximally between two labeled ticks. null = no constraint. */
  labelPlacement: 'on' | 'minor' | 'mid' | null;
  /** order_values: target adjacent-value gap profile. 'wide' = far apart;
   *  'mixed' = default sampling; 'clustered' = small min adjacent gap. */
  orderGap: 'wide' | 'mixed' | 'clustered' | null;
  /** find_between: target bound separation in LABEL-interval units. 'wide' = many
   *  in-between ticks; 'moderate' = a few; 'narrow' = exactly one. null = none. */
  boundGap: 'wide' | 'moderate' | 'narrow' | null;
  /** Prompt lines describing what HARDER means here (soft; the picker enforces). */
  promptLines: string[];
}

/** One tier → one structural intent per mode. Clamped to [floor, cap] from the
 *  brief INSIDE the constructive re-selectors (range/numberType never widen). */
function resolveProblemShape(type: ChallengeType, tier: SupportTier): ProblemShape {
  switch (type) {
    case 'show_jump':
      // Steps-to-solve depth lives in resolveSupportStructure.jumpSteps (1→2);
      // this only contributes the coherent PROBLEM prose. No numeric lever here.
      return {
        labelPlacement: null, orderGap: null, boundGap: null,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: a single jump from start to landing — one operation to track.'
            : tier === 'medium'
              ? 'PROBLEM: still a single jump, but the worked arc is gone — track the hop yourself.'
              : 'PROBLEM: TWO chained jumps — land, then jump again from the new position, tracking the intermediate landing.',
        ],
      };
    case 'order_values':
      return {
        labelPlacement: null,
        orderGap: tier === 'easy' ? 'wide' : tier === 'hard' ? 'clustered' : 'mixed',
        boundGap: null,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: the values are spread FAR apart across the range, so left-to-right order is visually obvious.'
            : tier === 'medium'
              ? 'PROBLEM: the values have mixed gaps — some close, some far.'
              : 'PROBLEM: the values are tightly CLUSTERED (small gaps between neighbours), so positions look near-identical — read the ticks carefully.',
        ],
      };
    case 'find_between':
      return {
        labelPlacement: null, orderGap: null,
        boundGap: tier === 'easy' ? 'wide' : tier === 'hard' ? 'narrow' : 'moderate',
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: the two bounds are FAR apart with several ticks between them — many obvious in-between values.'
            : tier === 'medium'
              ? 'PROBLEM: the two bounds are a moderate gap apart — a few values lie between.'
              : 'PROBLEM: the two bounds are ADJACENT (one step apart) — only one value lies strictly between, so the student must estimate carefully.',
        ],
      };
    case 'plot_point':
    default:
      return {
        labelPlacement: tier === 'easy' ? 'on' : tier === 'hard' ? 'mid' : 'minor',
        orderGap: null, boundGap: null,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: the target lands exactly ON a labeled tick — a direct, snap-obvious read.'
            : tier === 'medium'
              ? 'PROBLEM: the target lands on an unlabeled tick, one step from the nearest label — count from the label.'
              : 'PROBLEM: the target lands MIDWAY between two labeled ticks — count the unlabeled subdivisions across the widest span.',
        ],
      };
  }
}

/** Combined tier prompt block: scaffolding tone (resolveSupportStructure) PLUS
 *  structural problem difficulty (resolveProblemShape). One coherent section so
 *  the LLM sees both axes of config.difficulty together. */
function buildTierPromptSection(
  type: ChallengeType,
  tier: SupportTier,
  heading: string,
): string {
  const lines = [
    ...resolveSupportStructure(type, tier).promptLines,
    ...resolveProblemShape(type, tier).promptLines,
  ];
  return `\n\n## WITHIN-MODE SUPPORT TIER "${tier}" (${heading} — NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

// ---------------------------------------------------------------------------
// Constructive re-selectors — enforce the structural lever to the EXACT target,
// in band, preserving each mode's solvability invariants. Each takes the LLM-/
// picker-chosen value(s) plus the resolved line geometry and returns reshaped
// in-band value(s); if it cannot satisfy the band it returns the input UNCHANGED
// (the band SATURATES honestly rather than overflowing magnitude).
// ---------------------------------------------------------------------------

/**
 * plot_point / identify: reshape a target so it sits ON / on a MINOR tick / MIDWAY
 * between two labeled ticks. Magnitude stays inside `range`; numberType unchanged.
 *  - 'on'    → snap to nearest labeled tick (multiple of labelIv).
 *  - 'minor' → a tick one step (tickInterval) off the nearest label, when the
 *              label grid is coarser than the tick grid (labelIv > tickInterval);
 *              otherwise (every tick labeled, e.g. 0-10) the mode SATURATES at 'on'.
 *  - 'mid'   → the value halfway between two adjacent labels, when that midpoint is
 *              representable at this numberType (snap precision); else nearest minor;
 *              else 'on'. Never leaves [min,max]; never collides with the bounds.
 */
function reshapePlotTarget(
  target: number,
  placement: ProblemShape['labelPlacement'],
  geom: { min: number; max: number; tickInterval: number; labelIv: number; precision: number },
): number {
  if (!placement) return target;
  const { min, max, tickInterval, labelIv, precision } = geom;
  const inRange = (v: number) => v >= min - 1e-9 && v <= max + 1e-9;
  const snapPrec = (v: number) => Math.round(v / precision) * precision;
  // Nearest labeled tick, CLAMPED to the in-range label grid (the topmost label
  // may sit below max for non-integer intervals — never fall back off-grid).
  const labelIndex = Math.round((target - min) / labelIv);
  const maxLabelIndex = Math.floor((max - min) / labelIv + 1e-9);
  const clampIdx = (i: number) => Math.max(0, Math.min(maxLabelIndex, i));
  const labelAt = (i: number) => snapPrec(min + clampIdx(i) * labelIv);
  const nearestLabel = labelAt(labelIndex);

  if (placement === 'on') {
    return nearestLabel;
  }

  if (placement === 'minor') {
    // A tick one tickInterval off a label. Only meaningful if labels are sparser
    // than ticks; otherwise saturate ON the label.
    if (labelIv <= tickInterval + 1e-9) {
      return nearestLabel;
    }
    for (const dir of [1, -1]) {
      const cand = snapPrec(nearestLabel + dir * tickInterval);
      // must NOT itself land on another label, and stay in range
      const onLabel = Math.abs((cand - min) / labelIv - Math.round((cand - min) / labelIv)) < 1e-6;
      if (inRange(cand) && !onLabel) return cand;
    }
    return nearestLabel; // saturation: every tick labeled near the edge
  }

  // 'mid' — halfway between two ADJACENT in-range labels (widest interpolation).
  // Anchor on the lower of the two labels that bracket the target, clamped so the
  // upper label stays in range; the midpoint then never exceeds max.
  const lowerIdx = clampIdx(Math.min(Math.floor((target - min) / labelIv + 1e-9), maxLabelIndex - 1));
  const lowerLabel = labelAt(lowerIdx);
  const midRaw = lowerLabel + labelIv / 2;
  const midSnap = snapPrec(midRaw);
  // The snapped midpoint must be strictly interior (not back on a label) AND in range.
  const onLabel = Math.abs((midSnap - min) / labelIv - Math.round((midSnap - min) / labelIv)) < 1e-6;
  if (inRange(midSnap) && !onLabel) return midSnap;
  // Fall back to a minor tick, then to the label (saturation).
  if (labelIv > tickInterval + 1e-9) {
    for (const dir of [1, -1]) {
      const cand = snapPrec(lowerLabel + dir * tickInterval);
      const candOnLabel = Math.abs((cand - min) / labelIv - Math.round((cand - min) / labelIv)) < 1e-6;
      if (inRange(cand) && !candOnLabel) return cand;
    }
  }
  return nearestLabel; // saturation
}

/**
 * order_values: reshape a set of DISTINCT in-range values to the tier's gap
 * profile. 'wide' → maximise the minimum adjacent gap (spread across the range);
 * 'clustered' → minimise it (a tight contiguous-ish run). Returns `perSet`
 * DISTINCT values inside [min,max]; if the pool is too small to satisfy the
 * profile it falls back to the widest distinct set it can (never < perSet, never
 * duplicates — the floor). numberType/range never change.
 */
function reshapeOrderSet(
  pool: number[],
  perSet: number,
  gap: ProblemShape['orderGap'],
): number[] | null {
  const sorted = Array.from(new Set(pool.filter(Number.isFinite))).sort((a, b) => a - b);
  if (sorted.length < perSet) return null;
  if (!gap || gap === 'mixed') return null; // medium = default sampling (no reshape)

  if (gap === 'clustered') {
    // Tightest window of perSet consecutive-in-pool values (smallest span).
    let best = sorted.slice(0, perSet);
    let bestSpan = best[best.length - 1] - best[0];
    for (let i = 0; i + perSet <= sorted.length; i++) {
      const win = sorted.slice(i, i + perSet);
      const span = win[win.length - 1] - win[0];
      if (span < bestSpan) { best = win; bestSpan = span; }
    }
    // Randomise WHICH tight window among ties so parallel sessions differ.
    const ties: number[][] = [];
    for (let i = 0; i + perSet <= sorted.length; i++) {
      const win = sorted.slice(i, i + perSet);
      if (win[win.length - 1] - win[0] === bestSpan) ties.push(win);
    }
    return ties.length ? ties[Math.floor(Math.random() * ties.length)] : best;
  }

  // 'wide' — maximise the minimum adjacent gap via even spread across the pool.
  const out: number[] = [];
  for (let k = 0; k < perSet; k++) {
    const idx = Math.round((k * (sorted.length - 1)) / (perSet - 1));
    out.push(sorted[idx]);
  }
  // De-dup collisions (can happen on a tiny pool) by nudging to the next free slot.
  const seen = new Set<number>();
  const used = new Set(out);
  const result: number[] = [];
  for (const v of out) {
    if (!seen.has(v)) { seen.add(v); result.push(v); continue; }
    const alt = sorted.find(s => !used.has(s) && !seen.has(s));
    if (alt == null) return null; // cannot make perSet distinct → caller keeps original
    seen.add(alt); used.add(alt); result.push(alt);
  }
  return result.length === perSet ? result : null;
}

/**
 * find_between: reshape a [lo,hi] bound pair to the tier's bound-gap width,
 * measured in LABEL-interval units. 'narrow' → bounds one labelIv apart (exactly
 * one strictly-between value at this numberType); 'wide' → bounds maximally far
 * apart in the pool. The floor (>=1 representable value strictly between) is
 * ASSERTED: a 'narrow' pair is only accepted if a snap-representable value lies
 * strictly between it, else it widens by one step. Bounds stay in [min,max].
 */
function reshapeBetweenPair(
  pair: [number, number],
  pool: number[],
  width: ProblemShape['boundGap'],
  geom: { labelIv: number; precision: number },
): [number, number] | null {
  if (!width || width === 'moderate') return null; // medium = default builder
  const sorted = Array.from(new Set(pool.filter(Number.isFinite))).sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  const { labelIv, precision } = geom;

  // Does at least one snap-representable value lie STRICTLY between a<b?
  const hasBetween = (a: number, b: number): boolean => {
    if (b - a <= precision + 1e-9) return false;
    // a representable value at `precision` strictly inside (a,b)
    const firstInside = Math.floor(a / precision + 1) * precision;
    return firstInside > a + 1e-9 && firstInside < b - 1e-9;
  };

  if (width === 'narrow') {
    // Prefer bounds exactly one labelIv apart with a value between; among such
    // pairs choose randomly. Fall back to the smallest gap that still has a
    // between-value (floor) — never collapse to no in-between value.
    const oneApart: Array<[number, number]> = [];
    const anyValid: Array<[number, number]> = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        if (!hasBetween(a, b)) continue;
        anyValid.push([a, b]);
        if (Math.abs((b - a) - labelIv) < 1e-6) oneApart.push([a, b]);
      }
    }
    const fromOne = oneApart.length ? oneApart : null;
    const pickFrom = fromOne ?? (anyValid.length
      ? anyValid.filter(([a, b]) => (b - a) === Math.min(...anyValid.map(([x, y]) => y - x)))
      : null);
    if (!pickFrom || pickFrom.length === 0) return null;
    return pickFrom[Math.floor(Math.random() * pickFrom.length)];
  }

  // 'wide' — the largest-gap pair (most in-between ticks); random among ties.
  let maxGap = -Infinity;
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const g = sorted[j] - sorted[i];
      if (hasBetween(sorted[i], sorted[j]) && g > maxGap) maxGap = g;
    }
  }
  if (!Number.isFinite(maxGap)) return null;
  const widest: Array<[number, number]> = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (hasBetween(sorted[i], sorted[j]) && sorted[j] - sorted[i] === maxGap) {
        widest.push([sorted[i], sorted[j]]);
      }
    }
  }
  return widest.length ? widest[Math.floor(Math.random() * widest.length)] : null;
}

/**
 * Build benchmark anchor highlights for a challenge WITHOUT ever including a
 * target value (the leak guard — an anchor equal to the answer trivialises the
 * task for plot_point/find_between). Anchors sit on labeled ticks NEAR the
 * targets and stay inside `range`, so the auto-zoom (which fits all highlights)
 * does not widen the view and undermine the aid.
 */
function buildAnchorsForChallenge(
  ch: NumberLineChallenge,
  range: { min: number; max: number },
  tickInterval: number,
): { label: string; value: number }[] {
  const targets = ch.targetValues ?? [];
  if (targets.length === 0) return [];
  const lo = Math.min(...targets);
  const hi = Math.max(...targets);

  // Candidate anchor values: labeled ticks (multiples of tickInterval) that are
  // NEAR the target span but never coincide with any target.
  const isTarget = (v: number) => targets.some((t) => Math.abs(t - v) < 1e-6);
  const step = Math.max(tickInterval, 1);

  const candidates: number[] = [];
  if (ch.type === 'find_between') {
    // Anchors strictly BETWEEN the two bounds, on a tick, not equal to a bound.
    for (let v = Math.ceil((lo + step) / step) * step; v < hi; v += step) {
      if (!isTarget(v)) candidates.push(v);
    }
  } else {
    // A helper mark just below and just above the target span (on a tick).
    const below = Math.floor((lo - step) / step) * step;
    const above = Math.ceil((hi + step) / step) * step;
    for (const v of [below, above]) {
      if (v >= range.min && v <= range.max && !isTarget(v)) candidates.push(v);
    }
  }

  // Keep at most 2 anchors, all in-range, de-duplicated, never a target.
  const seen = new Set<number>();
  const anchors: { label: string; value: number }[] = [];
  for (const v of candidates) {
    if (v < range.min || v > range.max || isTarget(v) || seen.has(v)) continue;
    seen.add(v);
    anchors.push({ label: 'helper', value: v });
    if (anchors.length >= 2) break;
  }
  return anchors;
}

// ---------------------------------------------------------------------------
// Shared single-challenge text schema (used by every per-mode sub-generator)
// ---------------------------------------------------------------------------
//
// Every per-mode Gemini call now generates ONE challenge worth of text, given
// pre-selected numerics in the prompt. Schema is tiny (4 fields) so Flash Lite
// has zero field-drop risk (SP-14). Session-level metadata is taken from the
// first non-empty result (orchestrator-same-mode pattern, §6a #7).

function buildChallengeTextSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging, age-appropriate session title" },
      description: { type: Type.STRING, description: "Brief explanation of the learning goal for this session" },
      instruction: { type: Type.STRING, description: "Warm, grade-appropriate instruction for THIS specific challenge" },
      hint: { type: Type.STRING, description: "Hint that guides without giving the answer" },
    },
    required: ["title", "description", "instruction", "hint"],
  };
}

interface ChallengeText {
  title: string;
  description: string;
  instruction: string;
  hint: string;
}

async function generateChallengeText(prompt: string): Promise<ChallengeText | null> {
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        temperature: 0.9,
        topP: 0.95,
        responseMimeType: 'application/json',
        responseSchema: buildChallengeTextSchema(),
      },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);
    if (!parsed?.instruction || !parsed?.hint) return null;
    return {
      title: parsed.title || '',
      description: parsed.description || '',
      instruction: parsed.instruction,
      hint: parsed.hint,
    };
  } catch (e) {
    console.warn('[NumberLine] challenge text generation failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Topic-driven number range resolver (micro-LLM)
// ---------------------------------------------------------------------------
//
// The manifest deliberately does NOT emit numberRange (numeric scope is
// pedagogy's job, not the curator's). Without it, the topic/intent strings only
// ever reach prompt PROSE — the numeric pickers run in CODE off a range that, when
// unset, falls back to a blanket 0–20. So "counting to 10" rendered a 0–20 line.
// This reads the lesson's OWN words and returns the integer range it is actually
// about ("counting to 10" → 0–10). Grade stays the CEILING; on any failure we
// return null and callers keep their existing grade-band defaults (no regression).
// Schema, not regex — see memory [[schema-over-regex-and-prompt]].

function buildRangeSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      min: { type: Type.NUMBER, description: "Smallest number the lesson works with (almost always 0)" },
      max: { type: Type.NUMBER, description: "Largest number the lesson works with, inferred from the topic/intent" },
    },
    required: ["min", "max"],
  };
}

async function resolveTopicNumberRange(
  topic: string,
  intent: string | undefined,
  gradeLevel: string,
): Promise<{ min: number; max: number } | null> {
  try {
    const prompt = `A number-line lesson needs its numeric range inferred from what it is teaching.

TOPIC: "${topic}"
${intent ? `INTENT: "${intent}"\n` : ''}GRADE: ${gradeLevel}

Return the integer range the student actually works with in THIS lesson.
- Read the topic/intent for an explicit bound ("counting to 10" → max 10; "numbers to 20" → max 20; "adding within 100" → max 100).
- min is almost always 0; use a negative min ONLY when the lesson is explicitly about negative numbers.
- The grade is a CEILING — never return a max larger than that grade would ever use. If the topic gives no bound, pick the conventional top of the grade's range.`;
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: buildRangeSchema(),
      },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);
    const min = Math.round(Number(parsed?.min));
    const max = Math.round(Number(parsed?.max));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    return { min, max };
  } catch (e) {
    console.warn('[NumberLine] topic range resolution failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-mode numeric pickers (pool service — §6a #1, §6a #2)
// ---------------------------------------------------------------------------
//
// Gemini Flash Lite's structured-output mode is convergent for numeric values
// regardless of temperature. To avoid getting the same target/start/etc on
// every parallel call, pre-select the numerics in code.

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniqueIntegerPool(min: number, max: number): number[] {
  const result: number[] = [];
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  for (let v = lo; v <= hi; v++) result.push(v);
  return result;
}

interface ResolvedRange {
  min: number;
  max: number;
  numberType: 'integer' | 'fraction' | 'decimal' | 'mixed';
}

function resolvedPoolNumbers(
  config: { numberRange?: { min: number; max: number } } | undefined,
  fallback: { min: number; max: number },
): number[] {
  const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true, maxSpan: 25 });
  if (pool?.numbers && pool.numbers.length > 0) return [...pool.numbers];
  return uniqueIntegerPool(fallback.min, fallback.max);
}

function selectPlotPointTargets(pool: number[], count: number): number[] {
  const filtered = pool.filter(v => Number.isFinite(v));
  const shuffled = shuffleInPlace(Array.from(new Set(filtered)));
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

interface ShowJumpTuple {
  startValue: number;
  opType: 'add' | 'subtract';
  change: number;
  targetValue: number;
}

function selectShowJumpTuples(
  range: { min: number; max: number },
  gradeBand: 'K-2' | '3-5',
  count: number,
): ShowJumpTuple[] {
  const jumpChoices = gradeBand === 'K-2' ? [1, 2, 3, 4, 5] : [2, 3, 5, 7, 10];
  const tuples: ShowJumpTuple[] = [];
  const seen = new Set<string>();

  // Try every viable combination, then sample.
  const candidates: ShowJumpTuple[] = [];
  for (let start = Math.ceil(range.min); start <= Math.floor(range.max); start++) {
    for (const change of jumpChoices) {
      for (const opType of ['add', 'subtract'] as const) {
        const target = opType === 'add' ? start + change : start - change;
        if (target < range.min || target > range.max) continue;
        candidates.push({ startValue: start, opType, change, targetValue: target });
      }
    }
  }
  shuffleInPlace(candidates);

  for (const c of candidates) {
    const key = `${c.startValue}|${c.opType}|${c.change}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tuples.push(c);
    if (tuples.length >= count) break;
  }
  return tuples;
}

function selectOrderValueSets(
  pool: number[],
  count: number,
  perSet: number,
): number[][] {
  const sets: number[][] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 12 && sets.length < count; attempt++) {
    if (pool.length < perSet) break;
    const shuffled = shuffleInPlace([...pool]).slice(0, perSet);
    const key = [...shuffled].sort((a, b) => a - b).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    sets.push(shuffled);
  }
  return sets;
}

function selectFindBetweenPairs(
  pool: number[],
  count: number,
): Array<[number, number]> {
  if (pool.length < 2) return [];
  const sorted = Array.from(new Set(pool)).sort((a, b) => a - b);
  const pairs: Array<[number, number]> = [];
  const seen = new Set<string>();

  // Build all gapped pairs (gap >= 2 ticks where possible), then sample.
  const candidates: Array<[number, number]> = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 2; j < sorted.length; j++) {
      candidates.push([sorted[i], sorted[j]]);
    }
  }
  if (candidates.length === 0) {
    // Fall back to adjacent pairs.
    for (let i = 0; i < sorted.length - 1; i++) candidates.push([sorted[i], sorted[i + 1]]);
  }
  shuffleInPlace(candidates);

  for (const [a, b] of candidates) {
    const key = `${a}|${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, b]);
    if (pairs.length >= count) break;
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Per-mode result container
// ---------------------------------------------------------------------------

type SubResult = {
  title: string;
  description: string;
  range: { min: number; max: number };
  gradeBand: 'K-2' | '3-5';
  numberType: 'integer' | 'fraction' | 'decimal' | 'mixed';
  interactionMode: 'plot' | 'jump' | 'compare' | 'order';
  challenges: NumberLineChallenge[];
  highlights: { label: string; value: number }[];
  operations: NumberLineOperation[];
};

function emptySubResult(interactionMode: SubResult['interactionMode']): SubResult {
  return {
    title: '', description: '',
    range: { min: 0, max: 10 },
    gradeBand: 'K-2', numberType: 'integer',
    interactionMode,
    challenges: [], highlights: [], operations: [],
  };
}

function resolveGradeBand(gradeLevel: string): 'K-2' | '3-5' {
  const lower = gradeLevel.toLowerCase();
  return lower.includes('k') || lower.includes('1') || lower.includes('2') ? 'K-2' : '3-5';
}

// ---------------------------------------------------------------------------
// Per-mode sub-generators (orchestrator-same-mode, §6a #7)
// ---------------------------------------------------------------------------

async function generatePlotPointChallenges(
  topic: string,
  gradeLevel: string,
  config?: { targetEvalMode?: string; numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const isIdentify = config?.targetEvalMode === 'identify';
  const gradeBand: 'K-2' | '3-5' = isIdentify ? 'K-2' : resolveGradeBand(gradeLevel);
  const numberType: ResolvedRange['numberType'] = isIdentify
    ? 'integer'
    : (gradeBand === 'K-2' ? 'integer' : 'decimal');
  const range = isIdentify
    ? { min: 0, max: 10 }
    : (config?.numberRange ?? { min: 0, max: 20 });

  const poolNumbers = isIdentify
    ? uniqueIntegerPool(0, 10)
    : resolvedPoolNumbers(config, range);
  let targets = selectPlotPointTargets(poolNumbers, resolveCount('plot_point'));
  if (targets.length === 0) return emptySubResult('plot');

  const tier = normalizeSupportTier(config?.difficulty);

  // STRUCTURAL difficulty: reshape each target relative to the LABEL grid (on a
  // labeled tick → on a minor tick → midway between labels). Magnitude stays in
  // `range`; numberType unchanged. The reshaped values ARE the recomputed answer.
  if (tier) {
    const placement = resolveProblemShape('plot_point', tier).labelPlacement;
    if (placement) {
      const span = Math.max(1, range.max - range.min);
      const tickInterval = defaultTickIntervalFor(numberType, span);
      const labelIv = effectiveLabelInterval(numberType, tickInterval, span);
      const precision = snapPrecisionFor(numberType);
      const geom = { min: range.min, max: range.max, tickInterval, labelIv, precision };
      const reshaped: number[] = [];
      const seen = new Set<number>();
      for (const t of targets) {
        let v = reshapePlotTarget(t, placement, geom);
        // Keep targets DISTINCT (a plot session shows variety); on collision try
        // the next pool member, else accept the dup-free original.
        if (seen.has(v)) {
          const alt = poolNumbers
            .map((p) => reshapePlotTarget(p, placement, geom))
            .find((c) => !seen.has(c));
          if (alt != null) v = alt;
        }
        seen.add(v);
        reshaped.push(v);
      }
      targets = reshaped;
    }
  }

  const modeBanner = isIdentify
    ? 'IDENTIFY MODE (Kindergarten): use very warm, simple language. Every tick is labeled; this is pure number recognition.'
    : `GRADE BAND: ${gradeBand}. ${gradeBand === 'K-2' ? 'Use counting language, warm tone.' : 'Concise, neutral tone.'}`;

  const tierSection = tier
    ? buildTierPromptSection('plot_point', tier, 'scaffolding + structural problem difficulty')
    : '';

  const promptFor = (target: number, index: number) => `Create text for ONE Number Line PLOT challenge for "${topic}" (Grade ${gradeLevel}).

${modeBanner}

This is challenge ${index + 1} of ${targets.length} in a session that asks the student to plot a target value on a number line ranging from ${range.min} to ${range.max}.

For THIS challenge the target value is: ${target}

Return ONLY:
- title: an engaging session title (will be shared across all challenges in this session)
- description: a brief session-level learning goal
- instruction: a warm, grade-appropriate instruction that asks the student to plot ${target} on the number line (you may vary phrasing across calls — "Can you find...", "Show me where...", "Place a point at...", etc.)
- hint: a hint that guides the student to ${target} WITHOUT naming the number directly (e.g. reference neighboring tick marks or counting from a benchmark)${tierSection}`;

  const texts = await Promise.all(targets.map((t, i) => generateChallengeText(promptFor(t, i))));

  const wrapperSource = texts.find(t => t && t.title) ?? texts.find(t => !!t) ?? null;
  const challenges: NumberLineChallenge[] = targets.map((target, i) => {
    const text = texts[i];
    const instruction = text?.instruction ?? `Can you find ${target} on the number line?`;
    const hint = text?.hint ?? 'Count the tick marks from the start.';
    return {
      id: `plot_point-${i}`,
      type: 'plot_point',
      instruction,
      targetValues: [target],
      hint,
    };
  });

  return {
    title: wrapperSource?.title || `Number Line: ${topic}`,
    description: wrapperSource?.description || '',
    range,
    gradeBand,
    numberType,
    interactionMode: 'plot',
    challenges,
    highlights: [],
    operations: [],
  };
}

async function generateShowJumpChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const gradeBand = resolveGradeBand(gradeLevel);
  const range = config?.numberRange ?? { min: 0, max: gradeBand === 'K-2' ? 20 : 30 };
  const tier = normalizeSupportTier(config?.difficulty);
  const scaffold = tier ? resolveSupportStructure('show_jump', tier) : null;
  const tierSection = tier
    ? buildTierPromptSection('show_jump', tier, 'scaffolding + jump-step depth')
    : '';

  const tuples = selectShowJumpTuples(range, gradeBand, resolveCount('show_jump'));
  if (tuples.length === 0) return emptySubResult('jump');

  // STRUCTURAL lever: at the hard tier each challenge is TWO chained jumps — the
  // student lands, then jumps again from there. We build the second op from the
  // first op's landing and CLAMP the cumulative landing inside `range` (mirroring
  // the single-op clamp in selectShowJumpTuples). The magnitude stays in scope.
  const wantSteps = scaffold?.jumpSteps ?? 1;
  const jumpChoices = gradeBand === 'K-2' ? [1, 2, 3, 4, 5] : [2, 3, 5, 7, 10];

  /** Pick a second op from `from` that lands in range and is non-trivial. */
  function secondOp(from: number): { opType: 'add' | 'subtract'; change: number; landing: number } | null {
    const opts: { opType: 'add' | 'subtract'; change: number; landing: number }[] = [];
    for (const change of jumpChoices) {
      for (const opType of ['add', 'subtract'] as const) {
        const landing = opType === 'add' ? from + change : from - change;
        if (landing < range.min || landing > range.max) continue;
        opts.push({ opType, change, landing });
      }
    }
    if (opts.length === 0) return null;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  const promptFor = (t: ShowJumpTuple, index: number, steps: number, secondLanding: number | null) =>
    `Create text for ONE Number Line JUMP challenge for "${topic}" (Grade ${gradeLevel}).

GRADE BAND: ${gradeBand}. ${gradeBand === 'K-2' ? 'Use counting language, warm tone.' : 'Concise, neutral tone.'}

This is challenge ${index + 1} of ${tuples.length} in a session on a number line ranging from ${range.min} to ${range.max}.

For THIS challenge:
- Start position: ${t.startValue}
- ${steps === 2
        ? `TWO chained jumps: first ${t.opType === 'add' ? `add ${t.change}` : `subtract ${t.change}`}, then from where you land jump again to reach ${secondLanding}. The student places BOTH landings.`
        : `Operation: ${t.opType === 'add' ? `add ${t.change} (jump right)` : `subtract ${t.change} (jump left)`}`}
- Final landing value: ${steps === 2 ? secondLanding : t.targetValue}

Return ONLY:
- title: an engaging session title (shared across all challenges)
- description: a brief session-level learning goal
- instruction: a warm, grade-appropriate instruction telling the student to ${steps === 2
        ? `start at ${t.startValue}, make the first jump, then jump again from where they landed`
        : `start at ${t.startValue} and ${t.opType === 'add' ? 'jump forward' : 'jump back'} ${t.change}`} (vary phrasing — do NOT state the final landing number)
- hint: a hint that guides counting the hops WITHOUT giving any landing number directly${tierSection}`;

  // Pre-resolve the (possibly chained) operations per tuple so prompt + data agree.
  const ops: NumberLineOperation[][] = tuples.map((t) => {
    const first: NumberLineOperation = {
      type: t.opType,
      startValue: t.startValue,
      changeValue: t.change,
      showJumpArc: scaffold?.showJumpArc ?? false,
    };
    if (wantSteps !== 2) return [first];
    const second = secondOp(t.targetValue);
    if (!second) return [first]; // no in-range second hop → stay single-step
    return [first, {
      type: second.opType,
      startValue: t.targetValue,   // chain: second jump begins at the first landing
      changeValue: second.change,
      showJumpArc: false,          // arc never shown at hard (jumpSteps===2 ⇒ hard)
    }];
  });

  const texts = await Promise.all(tuples.map((t, i) => {
    const chainLanding = ops[i].length === 2
      ? (ops[i][1].type === 'add' ? ops[i][1].startValue + ops[i][1].changeValue : ops[i][1].startValue - ops[i][1].changeValue)
      : null;
    return generateChallengeText(promptFor(t, i, ops[i].length, chainLanding));
  }));

  const wrapperSource = texts.find(t => t && t.title) ?? texts.find(t => !!t) ?? null;
  const challenges: NumberLineChallenge[] = tuples.map((t, i) => {
    const text = texts[i];
    const challengeOps = ops[i];
    const last = challengeOps[challengeOps.length - 1];
    const finalLanding = last.type === 'add' ? last.startValue + last.changeValue : last.startValue - last.changeValue;
    const instruction = text?.instruction
      ?? (challengeOps.length === 2
        ? `Start at ${t.startValue}. Make the first jump, then jump again. Where do you land?`
        : `Start at ${t.startValue} and jump ${t.opType === 'add' ? 'forward' : 'back'} ${t.change}. Where do you land?`);
    const hint = text?.hint ?? `Count the hops one jump at a time, starting from ${t.startValue}.`;
    return {
      id: `show_jump-${i}`,
      type: 'show_jump',
      instruction,
      // For chained jumps the answer is BOTH landings (the component checks each
      // op's endpoint); for single jumps it is the one landing.
      targetValues: challengeOps.length === 2 ? [t.targetValue, finalLanding] : [t.targetValue],
      hint,
      startValue: t.startValue,
      operations: challengeOps,
    };
  });

  // Backward-compat global operations.
  const globalOps = challenges[0]?.operations ?? [];

  return {
    title: wrapperSource?.title || `Number Line Jumps: ${topic}`,
    description: wrapperSource?.description || '',
    range,
    gradeBand,
    numberType: 'integer',
    interactionMode: 'jump',
    challenges,
    highlights: [],
    operations: globalOps,
  };
}

async function generateOrderValuesChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const gradeBand = resolveGradeBand(gradeLevel);
  const range = config?.numberRange ?? { min: 0, max: gradeBand === 'K-2' ? 20 : 30 };
  const perSet = gradeBand === 'K-2' ? 3 : 4;
  const poolNumbers = resolvedPoolNumbers(config, range);
  let sets = selectOrderValueSets(poolNumbers, resolveCount('order_values'), perSet);
  if (sets.length === 0) return emptySubResult('order');

  const tier = normalizeSupportTier(config?.difficulty);

  // STRUCTURAL difficulty: reshape each set's adjacent-value gap profile (wide
  // spread → clustered). Values stay DISTINCT and inside `range` (floor); on a
  // pool too small to satisfy the profile the original (already-distinct) set is
  // kept — the band saturates honestly.
  if (tier) {
    const gap = resolveProblemShape('order_values', tier).orderGap;
    if (gap && gap !== 'mixed') {
      sets = sets.map((s) => reshapeOrderSet(poolNumbers, perSet, gap) ?? s);
    }
  }

  const tierSection = tier
    ? buildTierPromptSection('order_values', tier, 'scaffolding + structural problem difficulty')
    : '';

  const promptFor = (values: number[], index: number) => `Create text for ONE Number Line ORDER challenge for "${topic}" (Grade ${gradeLevel}).

GRADE BAND: ${gradeBand}.

This is challenge ${index + 1} of ${sets.length} in a session on a number line ranging from ${range.min} to ${range.max}.

For THIS challenge the student must arrange these values in order: ${values.join(', ')}.

Return ONLY:
- title: an engaging session title (shared across all challenges)
- description: a brief session-level learning goal
- instruction: a warm, grade-appropriate instruction asking the student to put the values in order from smallest to largest
- hint: a hint that guides comparison WITHOUT giving the answer (e.g. "Find each number on the line first" or "Compare two at a time")${tierSection}`;

  const texts = await Promise.all(sets.map((s, i) => generateChallengeText(promptFor(s, i))));

  const wrapperSource = texts.find(t => t && t.title) ?? texts.find(t => !!t) ?? null;
  const challenges: NumberLineChallenge[] = sets.map((values, i) => {
    const text = texts[i];
    const instruction = text?.instruction ?? 'Put these numbers in order from smallest to largest.';
    const hint = text?.hint ?? 'Find each number on the line. Which is furthest left?';
    return {
      id: `order_values-${i}`,
      type: 'order_values',
      instruction,
      targetValues: values,
      hint,
    };
  });

  return {
    title: wrapperSource?.title || `Number Line Order: ${topic}`,
    description: wrapperSource?.description || '',
    range,
    gradeBand,
    numberType: gradeBand === 'K-2' ? 'integer' : 'decimal',
    interactionMode: 'order',
    challenges,
    highlights: [],
    operations: [],
  };
}

async function generateFindBetweenChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const gradeBand = resolveGradeBand(gradeLevel);
  const range = config?.numberRange ?? { min: 0, max: 10 };
  const poolNumbers = resolvedPoolNumbers(config, range);
  let pairs = selectFindBetweenPairs(poolNumbers, resolveCount('find_between'));
  if (pairs.length === 0) return emptySubResult('compare');

  const tier = normalizeSupportTier(config?.difficulty);

  // STRUCTURAL difficulty: reshape the bound-gap width (wide → narrow/adjacent).
  // The FLOOR (at least one snap-representable value strictly between the bounds)
  // is asserted inside reshapeBetweenPair — a 'narrow' pair is only accepted if it
  // remains answerable, else the band saturates at the smallest valid gap.
  if (tier) {
    const width = resolveProblemShape('find_between', tier).boundGap;
    if (width && width !== 'moderate') {
      const numberType: ResolvedRange['numberType'] = gradeBand === 'K-2' ? 'integer' : 'decimal';
      const span = Math.max(1, range.max - range.min);
      const tickInterval = defaultTickIntervalFor(numberType, span);
      const labelIv = effectiveLabelInterval(numberType, tickInterval, span);
      const geom = { labelIv, precision: snapPrecisionFor(numberType) };
      pairs = pairs.map((p) => reshapeBetweenPair(p, poolNumbers, width, geom) ?? p);
    }
  }

  const tierSection = tier
    ? buildTierPromptSection('find_between', tier, 'scaffolding + structural problem difficulty')
    : '';

  const promptFor = ([b0, b1]: [number, number], index: number) => `Create text for ONE Number Line FIND-BETWEEN challenge for "${topic}" (Grade ${gradeLevel}).

GRADE BAND: ${gradeBand}.

This is challenge ${index + 1} of ${pairs.length} in a session on a number line ranging from ${range.min} to ${range.max}.

For THIS challenge the student must find a value strictly between ${b0} and ${b1}.

Return ONLY:
- title: an engaging session title (shared across all challenges)
- description: a brief session-level learning goal
- instruction: a warm, grade-appropriate instruction asking the student to find a number between ${b0} and ${b1}
- hint: a hint that guides reasoning between the two boundaries WITHOUT naming a specific answer${tierSection}`;

  const texts = await Promise.all(pairs.map((p, i) => generateChallengeText(promptFor(p, i))));

  const wrapperSource = texts.find(t => t && t.title) ?? texts.find(t => !!t) ?? null;
  const challenges: NumberLineChallenge[] = pairs.map(([b0, b1], i) => {
    const text = texts[i];
    const instruction = text?.instruction ?? `Find a number between ${b0} and ${b1}.`;
    const hint = text?.hint ?? 'Look at the tick marks between the two values.';
    return {
      id: `find_between-${i}`,
      type: 'find_between',
      instruction,
      targetValues: [b0, b1],
      hint,
    };
  });

  return {
    title: wrapperSource?.title || `Number Line: Find Between — ${topic}`,
    description: wrapperSource?.description || '',
    range,
    gradeBand,
    numberType: gradeBand === 'K-2' ? 'integer' : 'decimal',
    interactionMode: 'compare',
    challenges,
    highlights: [],
    operations: [],
  };
}

// ---------------------------------------------------------------------------
// Fallback challenges
// ---------------------------------------------------------------------------

function buildFallbackChallenge(type: string, range: { min: number; max: number }): NumberLineChallenge {
  const mid = Math.round((range.min + range.max) / 2);

  const fallbacks: Record<string, NumberLineChallenge> = {
    plot_point: {
      id: 'fallback-0', type: 'plot_point',
      instruction: `Can you find ${mid} on the number line?`,
      targetValues: [mid],
      hint: 'Count the tick marks from the start.',
    },
    show_jump: {
      id: 'fallback-0', type: 'show_jump',
      instruction: `Start at ${range.min} and jump forward 3. Where do you land?`,
      targetValues: [range.min + 3],
      hint: 'Count 3 hops to the right from the start.',
      startValue: range.min,
      operations: [{ type: 'add', startValue: range.min, changeValue: 3, showJumpArc: false }],
    },
    order_values: {
      id: 'fallback-0', type: 'order_values',
      instruction: 'Put these numbers in order from smallest to largest.',
      targetValues: [range.min + 1, mid, range.max - 1],
      hint: 'Find each number on the line. Which is furthest left?',
    },
    find_between: {
      id: 'fallback-0', type: 'find_between',
      instruction: `Find a number between ${range.min + 1} and ${mid}.`,
      targetValues: [range.min + 1, mid],
      hint: 'Look at the tick marks between the two values.',
    },
  };

  return fallbacks[type] ?? fallbacks.plot_point;
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

/**
 * Generate interactive Number Line content.
 *
 * Two-layer orchestration:
 *   1. Top level dispatches per allowed eval-mode challenge type.
 *   2. Each per-mode sub-generator pre-selects N=4 numeric challenge tuples
 *      via a local pool service (avoids §6a #2 Gemini convergence on numbers),
 *      then fans out N parallel single-challenge Gemini calls for instruction
 *      and hint text. Session-level title/description are taken from the first
 *      non-empty result.
 *
 * Per-call schema is 4 fields — no SP-14 field-drop risk.
 */
export const generateNumberLine = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    intent: string;
    targetEvalMode: string;
    numberRange: { min: number; max: number };
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes the
     * target numbers, the scope range, or the snap precision/answer tolerance.
     */
    difficulty: string;
  }>
): Promise<NumberLineData> => {
  // Resolve eval mode from the catalog (single source of truth).
  const evalConstraint = resolveEvalModeConstraint(
    'number-line',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('NumberLine', config?.targetEvalMode, evalConstraint);

  const allowedTypes = evalConstraint
    ? evalConstraint.allowedTypes
    : ['plot_point', 'show_jump', 'order_values', 'find_between'];

  // Within-mode support tier (config.difficulty). The STUDENT's tier DRIVES the
  // application below (gated only on the tier being present, resolved per-challenge
  // from each challenge's own type so a blended session gets difficulty too).
  // pinnedType is for the application LOG tone only.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType = (evalConstraint?.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0]
    : undefined) as ChallengeType | undefined;

  // The manifest does not emit numberRange (scope is pedagogy's, not the curator's).
  // When it is absent, infer the range from the lesson's OWN topic + intent so the
  // code-side pickers stop falling back to a blanket 0–20. Grade stays the ceiling;
  // a resolution failure leaves it undefined and the grade-band defaults stand.
  let resolvedRange = config?.numberRange;
  if (!resolvedRange) {
    const inferred = await resolveTopicNumberRange(topic, config?.intent, gradeLevel);
    if (inferred) {
      resolvedRange = inferred;
      console.log(`[NumberLine] topic-resolved range:`, inferred, `(topic="${topic}", intent="${config?.intent ?? ''}")`);
    }
  }

  const pool = createSubRangePool(resolvedRange, { sorted: true, unique: true, maxSpan: 25 });
  console.log(`[NumberLine] display:`, pool?.displayRange ?? 'none', `pool:`, pool?.numbers ?? 'none', `difficulty:`, config?.difficulty ?? 'none');

  const subConfig = {
    targetEvalMode: config?.targetEvalMode,
    numberRange: resolvedRange,
    difficulty: config?.difficulty,
  };

  // Dispatch per-mode sub-generators in parallel.
  const generators: Promise<SubResult>[] = [];

  if (allowedTypes.includes('plot_point')) {
    generators.push(generatePlotPointChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('show_jump')) {
    generators.push(generateShowJumpChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('order_values')) {
    generators.push(generateOrderValuesChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('find_between')) {
    generators.push(generateFindBetweenChallenges(topic, gradeLevel, subConfig));
  }

  const subResults = await Promise.all(generators);

  const allChallenges = subResults.flatMap(r => r.challenges);
  const primary = subResults.find(r => r.challenges.length > 0) ?? subResults[0] ?? emptySubResult('plot');

  const data: NumberLineData = {
    title: primary.title || `Number Line: ${topic}`,
    description: primary.description || undefined,
    range: primary.range,
    gradeBand: primary.gradeBand,
    numberType: primary.numberType,
    interactionMode: primary.interactionMode,
    challenges: allChallenges,
    highlights: primary.highlights,
    operations: primary.operations,
  };

  // ---------------------------------------------------------------------------
  // Validation & Defaults
  // ---------------------------------------------------------------------------

  if (data.gradeBand !== 'K-2' && data.gradeBand !== '3-5') {
    data.gradeBand = resolveGradeBand(gradeLevel);
  }

  const validNumberTypes = ['integer', 'fraction', 'decimal', 'mixed'];
  if (!data.numberType || !validNumberTypes.includes(data.numberType)) {
    data.numberType = data.gradeBand === 'K-2' ? 'integer' : 'decimal';
  }

  const validModes = ['plot', 'jump', 'compare', 'order'];
  if (!data.interactionMode || !validModes.includes(data.interactionMode)) {
    data.interactionMode = 'plot';
  }

  if (!data.range || typeof data.range.min !== 'number' || typeof data.range.max !== 'number') {
    data.range = { min: 0, max: 10 };
  }
  if (data.range.min >= data.range.max) {
    data.range = { min: 0, max: data.gradeBand === 'K-2' ? 20 : 10 };
  }

  if (data.gradeBand === 'K-2') {
    data.numberType = 'integer';
    data.range.min = Math.max(-1, Math.round(data.range.min));
    data.range.max = Math.min(30, Math.round(data.range.max));
  }

  if (!data.challenges || data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'plot_point';
    console.log(`[NumberLine] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [buildFallbackChallenge(fallbackType, data.range)];
  }

  if (!Array.isArray(data.highlights)) {
    data.highlights = [];
  }
  if (!Array.isArray(data.operations)) {
    data.operations = [];
  }

  // ── Apply the support-tier scaffold deterministically AFTER all structural
  // fixups + the range clamps. Gated ONLY on a tier being present; each lever is
  // resolved from each challenge's OWN type and guarded to its modes. Code owns
  // the support STRUCTURE; the LLM only wrote the words + (already-clamped) numbers.
  // The number magnitudes, scope `range`, and snap precision are untouched here. ──
  if (supportTier) {
    // Persist the tier onto the data so the AI tutor's reveal level matches the
    // on-screen scaffold (set whenever a tier is present, blends included).
    data.supportTier = supportTier;

    // tickInterval (label coarseness) is a single line-level field. Drive it from
    // the coarseness of whichever non-jump challenge type is present (uniform in a
    // single-mode session; in a blend the coarsest non-null wins so labels never
    // imply a finer read than any challenge allows). show_jump leaves labels alone.
    // Base label interval: respect an LLM-set tickInterval if present, else fall
    // back to a unit tick for small spans and a ~10-segment default for wide ones.
    // (No magnitude change — this only governs how many ticks are LABELLED.)
    const span = Math.max(1, data.range.max - data.range.min);
    const baseInterval =
      typeof data.tickInterval === 'number' && data.tickInterval > 0
        ? data.tickInterval
        : Math.max(1, Math.round(span / 10));
    let coarseness: number | null = null;
    for (const ch of data.challenges) {
      const c = resolveSupportStructure(ch.type as ChallengeType, supportTier).labelCoarseness;
      if (c != null) coarseness = coarseness == null ? c : Math.max(coarseness, c);
    }
    if (coarseness != null) {
      // Coarser interval = sparser labels (hard); finer/default = denser (easy).
      data.tickInterval = Math.max(baseInterval, Math.round(baseInterval * coarseness));
    }

    // Benchmark anchors are written PER-CHALLENGE (ch.highlights) — NOT into the
    // line-level data.highlights — so an anchor built for one target never renders
    // during (or widens the auto-zoom of) another challenge. show_jump's worked
    // arc is likewise per-challenge/per-operation. buildAnchorsForChallenge
    // guarantees no anchor equals a target (leak guard) and all sit inside `range`.
    const anchorInterval = data.tickInterval ?? baseInterval;
    let anchorTotal = 0;
    for (const ch of data.challenges) {
      const sc = resolveSupportStructure(ch.type as ChallengeType, supportTier);
      // show_jump worked-arc lever (per challenge, per operation).
      if (ch.type === 'show_jump' && ch.operations?.length) {
        // Only the FIRST op may ever show the worked arc; chained (hard) ops never do.
        ch.operations = ch.operations.map((op, i) => ({
          ...op,
          showJumpArc: i === 0 ? sc.showJumpArc : false,
        }));
      }
      // Benchmark anchors (plot_point / find_between / order_values when easy).
      if (sc.showAnchors && (ch.type === 'plot_point' || ch.type === 'find_between' || ch.type === 'order_values')) {
        ch.highlights = buildAnchorsForChallenge(ch, data.range, anchorInterval);
        anchorTotal += ch.highlights.length;
      } else {
        ch.highlights = [];
      }
    }

    // Keep the backward-compat global operations array in sync with the first
    // challenge's (possibly arc-toggled) operations.
    data.operations = data.challenges[0]?.operations ?? data.operations;

    console.log(
      `[NumberLine] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → `
      + `tickInterval=${data.tickInterval ?? 'default'}, anchors=${anchorTotal}, `
      + `jumpArc=${data.challenges.some(c => c.operations?.[0]?.showJumpArc) ? 'on' : 'off'}`,
    );
  }

  const typeBreakdown = data.challenges.map(c => c.type).join(', ');
  console.log(`[NumberLine] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  console.log('Number Line Generated:', {
    topic,
    gradeBand: data.gradeBand,
    mode: data.interactionMode,
    numberType: data.numberType,
    range: `${data.range.min}-${data.range.max}`,
    challengeCount: data.challenges.length,
    operationCount: data.operations?.length || 0,
  });

  return data;
};
