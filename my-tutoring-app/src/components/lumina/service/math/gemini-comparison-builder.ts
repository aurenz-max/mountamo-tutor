import { Type, Schema } from "@google/genai";
import { ComparisonBuilderData, ComparisonBuilderChallenge } from "../../primitives/visual-primitives/math/ComparisonBuilder";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildRemediationPrompt } from "../generation/remediationPrompt";
import { createNumberPool } from "./numberPoolService";
import { resolveScopeRange } from "../scopeRangeResolver";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

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
  'compare-groups': {
    promptDoc:
      `"compare-groups": Two groups of objects shown side by side in LEFT and RIGHT boxes. `
      + `Student decides whether the LEFT group has MORE, FEWER, or THE SAME as the RIGHT group. `
      + `Requires: leftGroup (count + objectType), rightGroup (count + objectType), correctAnswer ('more'/'less'/'equal'). `
      + `correctAnswer describes the LEFT group relative to the RIGHT group ('more' = left > right, 'less' = left < right, 'equal' = left == right). `
      + `IMPORTANT: The instruction text MUST frame the question about the left group, e.g. "Does the left group have more, fewer, or the same as the right?" `
      + `Do NOT write instructions like "Which group has more?" because the answer buttons are about the left group specifically. `
      + `Use same objectType for both groups within a challenge so comparison is about quantity. Include some "equal" comparisons.`,
    schemaDescription: "'compare-groups' (visual group comparison)",
  },
  'one-more-one-less': {
    promptDoc:
      `"one-more-one-less": Given a target number, student finds one more, one less, or both. `
      + `Requires: targetNumber, askFor ('one-more'/'one-less'/'both'). `
      + `Ensure target stays in range so answers are valid (e.g., not 1 for one-less in K, not max for one-more).`,
    schemaDescription: "'one-more-one-less' (adjacent number reasoning)",
  },
  'compare-numbers': {
    promptDoc:
      `"compare-numbers": Two numbers shown with a blank between them. Student picks <, >, or =. `
      + `Requires: leftNumber, rightNumber, correctSymbol ('<'/'>'/'='). `
      + `correctSymbol goes between leftNumber and rightNumber (e.g., 5 > 3).`,
    schemaDescription: "'compare-numbers' (symbolic comparison with <, >, =)",
  },
  order: {
    promptDoc:
      `"order": A set of 3-5 numbers to arrange in ascending or descending order. `
      + `Requires: numbers (shuffled array), direction ('ascending'/'descending'). `
      + `Provide the numbers in a shuffled (non-sorted) order; the student must sort them.`,
    schemaDescription: "'order' (arrange numbers in sequence)",
  },
};

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// All comparison-builder modes are T2 in the §5a tier table (single-step
// compare / pick). B4 sweep bumps the prompt's "Generate 4-6" range to a
// templated per-mode count, so Gemini stops returning 3 when we want 5.

type ComparisonBuilderChallengeType =
  | 'compare-groups'
  | 'compare-numbers'
  | 'order'
  | 'one-more-one-less';

const DEFAULT_INSTANCE_COUNT = 5; // T2 fallback
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<ComparisonBuilderChallengeType, number> = {
  'compare-groups': 5,       // T2 — B4 bump 4-6 → 5
  'compare-numbers': 5,      // T2 — B4 bump 4-6 → 5
  'order': 5,                // T2 — B4 bump 4-6 → 5
  'one-more-one-less': 5,    // T2 — B4 bump 4-6 → 5
};

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract (same as ten-frame / counting-board): config.targetEvalMode
// says WHICH skill (task identity, matched to the objective by the manifest);
// config.difficulty says how much on-screen SUPPORT the student gets while doing it
// ('easy' = max scaffolding, 'hard' = min). The tier drives TWO axes here:
//   (1) Scaffolding withdrawal — count badges, correspondence lines, alligator
//       mnemonic, number-line target highlight, ordering slot-index hints.
//   (2) Structural problem shape — count-gap |left−right| (compare-groups),
//       digit-overlap (compare-numbers), askFor breadth (one-more-one-less),
//       direction asc→desc (order). All STRUCTURAL, never magnitude: the gap /
//       overlap levers keep the SAME number band — maxNumber (K=10 / G1=20) is
//       NEVER changed by tier.
// See memory: structural-difficulty-not-numeric, llm-window-code-builds-structure.

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

const TIER_GUARDRAIL =
  'Keep every number within the pedagogical scope and grade band (K: 1-10, Grade 1: 1-20). '
  + 'This tier changes problem STRUCTURE (count-gap, digit-overlap, ask breadth, sort direction) '
  + 'and on-screen SUPPORT, NOT raw magnitude — a harder tier NEVER means bigger numbers.';

interface SupportScaffold {
  /** Always-on "Left: N / Right: N" readout under the groups (compare-groups). */
  showCountBadges: boolean;
  /** Correspondence lines lifecycle: 'live' = visible during solve (strongest
   *  self-check), 'on-check' = only after answering (current default), 'off'. */
  correspondenceMode: 'live' | 'on-check' | 'off';
  /** Alligator mouth + hint mnemonic for the inequality symbol (compare-numbers). */
  useAlligatorMnemonic: boolean;
  /** Amber pre-highlight of the target on the number line (one-more-one-less). */
  showTargetMarker: boolean;
  /** Slot-index placeholders (1,2,3…) in the ordering drop slots (order). */
  showSlotHints: boolean;
  /** Forced sort direction for the order mode (asc = easier, desc = harder). */
  orderDirection: 'ascending' | 'descending' | null;
  /** How explicit the hint / instruction prose should be at this tier. */
  hintExplicitness: 'explicit' | 'nudge' | 'minimal';
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-screen support structure (axis 1) for a tier + challenge type.
 * Withdraws scaffolding as the tier hardens — same task, less help. Never changes
 * which numbers appear (axis 2 — resolveProblemShape — owns the structural shape,
 * still within the same magnitude band).
 */
function resolveSupportStructure(
  pinnedType: ComparisonBuilderChallengeType,
  tier: SupportTier,
): SupportScaffold {
  const hintExplicitness: SupportScaffold['hintExplicitness'] =
    tier === 'easy' ? 'explicit' : tier === 'medium' ? 'nudge' : 'minimal';

  // Defaults (medium-ish baseline; per-mode switch overrides what matters).
  const scaffold: SupportScaffold = {
    showCountBadges: tier !== 'hard',
    correspondenceMode: tier === 'easy' ? 'live' : tier === 'medium' ? 'on-check' : 'off',
    useAlligatorMnemonic: tier !== 'hard',
    showTargetMarker: tier !== 'hard',
    showSlotHints: tier === 'easy',
    orderDirection: tier === 'easy' ? 'ascending' : tier === 'hard' ? 'descending' : null,
    hintExplicitness,
    promptLines: [
      `Support tier: ${tier.toUpperCase()} — this sets on-screen SCAFFOLDING and hint explicitness (`
      + `${tier === 'easy'
        ? 'maximum support: the workspace helps the student see the comparison and self-check'
        : tier === 'medium'
          ? 'moderate support: the student reasons with fewer on-screen aids'
          : 'minimum support: the student compares unaided and explains their reasoning'}). ${TIER_GUARDRAIL}`,
    ],
  };

  switch (pinnedType) {
    case 'compare-groups':
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Show the count badges and matching correspondence lines so the student can pair objects one-to-one; hints may name which side has more.'
          : tier === 'medium'
            ? 'Show the count badges; correspondence lines appear only after the student answers. Hints nudge the student to count each side.'
            : 'Hide the count badges and the matching lines; the student must count both scattered groups themselves and justify which has more. Do NOT state either count in the instruction.',
      );
      break;
    case 'compare-numbers':
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Use the alligator mnemonic (mouth + "the alligator eats the bigger number" hint) to support choosing <, >, =.'
          : tier === 'medium'
            ? 'Keep the alligator mouth on the symbol buttons but drop the explicit hint sentence; the student recalls the rule.'
            : 'Use plain < > = symbols with no alligator and no mnemonic hint; the student reads the inequality directly. Keep the answer as a <, >, = symbol pick — never restate the relationship in the instruction.',
      );
      break;
    case 'one-more-one-less':
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Highlight the target on the number line and ask only for one-more; hints may count forward aloud.'
          : tier === 'medium'
            ? 'Keep the target highlighted on the number line with a tightened range; hints nudge counting by one.'
            : 'Withdraw the number-line target highlight (the amber Target box still shows the number); ask for BOTH one-more and one-less; the student counts forward AND backward unaided.',
      );
      break;
    case 'order':
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Show the direction badge and numbered slot hints (1,2,3…) so the student sees how many slots and where they are; sort ASCENDING (least→greatest).'
          : tier === 'medium'
            ? 'Show the direction badge but no slot-index hints; sort either direction.'
            : 'Sort DESCENDING (greatest→least) and remove the slot-index hints; the student tracks position and direction unaided.',
      );
      break;
  }
  return scaffold;
}

/**
 * Resolve the in-mode STRUCTURAL problem shape (axis 2) for a tier + mode. One
 * lever per mode, each structural (gap / overlap / breadth / direction), never
 * magnitude. The numeric levers are code-enforced in the per-mode fixups; the
 * prompt lines only describe the intent so the LLM picks compatible numbers.
 */
interface ProblemShape {
  /** compare-groups: target |left−right| gap. 0 (equal) excluded from hard. */
  countGap?: { min: number; max: number; allowEqual: boolean };
  /** compare-numbers: 'distinct-tens' = far apart (14 vs 7); 'same-tens' = subtle
   *  (14 vs 17) — same magnitude band, just higher digit overlap. */
  digitOverlap?: 'distinct-tens' | 'same-tens';
  /** one-more-one-less: which question(s) to ask. */
  askFor?: 'one-more' | 'one-less' | 'both';
  /** order: forced sort direction (mirrors the scaffold's orderDirection). */
  direction?: 'ascending' | 'descending';
  promptLines: string[];
}

function resolveProblemShape(
  mode: ComparisonBuilderChallengeType,
  tier: SupportTier,
): ProblemShape {
  switch (mode) {
    case 'compare-groups':
      // Structural lever: count-gap. easy = far apart (obvious), hard = adjacent
      // (subtle, gap=1). Exclude gap=0 from hard — equal is its own answer/case.
      return tier === 'easy'
        ? { countGap: { min: 3, max: 6, allowEqual: true }, promptLines: ['Make the two group counts clearly different (a gap of 3 or more) so "more/fewer" is obvious; equal cases are fine.'] }
        : tier === 'medium'
          ? { countGap: { min: 2, max: 3, allowEqual: true }, promptLines: ['Use a moderate count gap (about 2) between the groups; equal cases are fine.'] }
          : { countGap: { min: 1, max: 1, allowEqual: false }, promptLines: ['Make the two group counts adjacent (differ by exactly 1) so the student must count carefully; do NOT use equal groups at this tier.'] };
    case 'compare-numbers':
      // Structural lever: digit-overlap. easy = distinct tens (far apart),
      // hard = same tens digit (14 vs 17) — same magnitude band, subtler compare.
      return tier === 'hard'
        ? { digitOverlap: 'same-tens', promptLines: ['Choose the two numbers in the SAME ten (e.g. 14 vs 17) so they share a tens digit and the student must compare the ones place. Same magnitude band — never larger.'] }
        : { digitOverlap: 'distinct-tens', promptLines: ['Choose two numbers that are clearly far apart (different tens / a wide gap) so the comparison is direct.'] };
    case 'one-more-one-less':
      // Structural lever: ask breadth. easy = one-more only, hard = both.
      return tier === 'easy'
        ? { askFor: 'one-more', promptLines: ['Ask only for ONE MORE than the target.'] }
        : tier === 'medium'
          ? { askFor: 'both', promptLines: ['Ask for one-more or one-less (a single direction is fine).'] }
          : { askFor: 'both', promptLines: ['Ask for BOTH one-more and one-less so the student counts forward and backward.'] };
    case 'order':
      // Structural lever: sort direction (asc → desc). NOT item count — 3→5 items
      // is a magnitude-borderline change, explicitly excluded by the design.
      return tier === 'easy'
        ? { direction: 'ascending', promptLines: ['Order the numbers ASCENDING (least → greatest).'] }
        : tier === 'hard'
          ? { direction: 'descending', promptLines: ['Order the numbers DESCENDING (greatest → least).'] }
          : { promptLines: ['Either sort direction is fine.'] };
  }
}

/** Merge scaffolding (axis 1) + problem-shape (axis 2) prompt lines into one block. */
function buildTierPromptSection(
  pinnedType: ComparisonBuilderChallengeType,
  tier: SupportTier,
): string {
  const scaffold = resolveSupportStructure(pinnedType, tier);
  const shape = resolveProblemShape(pinnedType, tier);
  const lines = [...scaffold.promptLines, ...shape.promptLines];
  return `\n## WITHIN-MODE SUPPORT TIER (scaffolding + problem STRUCTURE — NOT number magnitude)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// compare-groups: code pre-rolls the group COUNTS
// ---------------------------------------------------------------------------
// The K atlas (CB-4) found the same five comparisons — 5v1, 1v4, 3v3, 1v5 — across
// two objectives and two draws, with only the objectType changing. That is the
// convergence /add-number-pool-service exists for: flash-lite resolves a free
// numeric field the same way every run whatever the temperature, so the counts have
// to be rolled in code and handed to it.
//
// Both axes stay where they belong. MAGNITUDE comes from the grade band (K 1-10,
// G1 1-20) — the pool never widens because a tier hardened. The GAP between the two
// sides is structure, which the support tier already owns (resolveProblemShape), so
// the pool draws its pairs to fit the tier's gap instead of fighting the
// code-enforcement pass that follows. An untiered session gets a mixed profile:
// some obvious pairs, some adjacent ones, and one equal pair.
//
// The equal pair is guaranteed rather than hoped for: 'equal' is a third answer with
// its own misconception (a child who reads "more" off the wider scatter rather than
// the count), and a session that never shows it never tests it. It is withheld only
// at the hard tier, where the contract excludes gap=0 on purpose.

interface CountPair {
  left: number;
  right: number;
}

/** The inclusive count range one compare-groups draw may use. */
interface CountWindow {
  min: number;
  max: number;
}

/**
 * The count range the OBJECTIVE names, brought into CODE — not only stated in the
 * prompt. The 2026-09-09 K redraw found COUNT001-03-A and MEAS001-02-B (both "groups
 * of UP TO 5") shipping 5v9, 10v4 and 3v8: the pool was anchored on the grade band
 * alone, and a prompt-only bound never reaches numbers that code picks BEFORE the call.
 *
 * The reading itself is the shared Tier-2 micro-call (`resolveScopeRange`), the same
 * one array-grid, circle-explorer and factor-tree use for their code-picked values: a
 * tiny {min,max} schema over topic + intent + objective. Not a regex — reading scope
 * language is language understanding, and a regex misses "groups of five"
 * ([[schema-over-regex-and-prompt]] rule 1). This function only VALIDATES what came
 * back: the grade band stays the outer ceiling, and anything unusable leaves the band
 * in place, so a lesson that names no range is byte-identical to before.
 */
function normalizeCountWindow(
  resolved: { min: number; max: number } | null,
  bandMax: number,
): CountWindow {
  const band: CountWindow = { min: 1, max: bandMax };
  if (!resolved) return band;
  const max = Math.min(bandMax, Math.round(resolved.max));
  const min = Math.max(1, Math.round(resolved.min));
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < 2) return band;
  // A floor that no longer clears the ceiling (a Grade-1 range read against a K band,
  // or a resolver that answered with a single value) is dropped rather than shipped:
  // a window with no room in it holds no comparison.
  return { min: min < max ? min : 1, max };
}

/**
 * The tier's count gap, refitted to what the objective window can actually supply.
 * Scope wins over structure: a 1-5 window holds only three pairs three-or-more apart,
 * so a five-challenge easy session would have to repeat one ("N challenges = N
 * problems") or leave the window. The gap relaxes instead — downward first (finer
 * gaps), then upward — and only as far as the supply forces.
 */
function fitGapToWindow(
  gap: { min: number; max: number; allowEqual: boolean },
  window: CountWindow,
  wanted: number,
): { min: number; max: number; allowEqual: boolean } {
  const span = Math.max(1, window.max - window.min);
  let max = Math.max(1, Math.min(gap.max, span));
  let min = Math.max(1, Math.min(gap.min, max));
  // Distinct pairs a gap range can produce inside the window: one per (size, low).
  const supply = (): number => {
    let pairs = 0;
    for (let size = min; size <= max; size++) pairs += span - size + 1;
    return pairs;
  };
  while (supply() < wanted && (min > 1 || max < span)) {
    if (min > 1) min -= 1;
    else max += 1;
  }
  return { min, max, allowEqual: gap.allowEqual };
}

/** Any count the model authored, pulled back inside the objective's range. */
function clampToWindow(count: number, window: CountWindow): number {
  if (!Number.isFinite(count)) return window.min;
  return Math.max(window.min, Math.min(Math.round(count), window.max));
}

/** Untiered sessions still get variety: mixed gaps within the band, equal allowed. */
const UNTIERED_COUNT_GAP = { min: 1, max: 4, allowEqual: true };

function rollBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Pre-roll `wanted` LEFT/RIGHT count pairs inside the objective's window whose gaps
 * satisfy the tier, with one equal pair when the tier allows one. Orientation is
 * rolled too so the answer key is not "more" every time.
 *
 * `guaranteeWithin` is the number of pairs the session will actually serve: the pool
 * carries spare pairs, and an equal case parked in the spares is an equal case the
 * child never sees. Pass 0 to roll pairs with no equal case at all (a spare drawn to
 * replace a repeat — the guarantee is already met by then).
 */
function buildCountPairPool(
  window: CountWindow,
  gap: { min: number; max: number; allowEqual: boolean },
  wanted: number,
  guaranteeWithin: number,
): CountPair[] {
  const span = Math.max(1, window.max - window.min);
  const widest = Math.max(1, Math.min(gap.max, span));
  const narrowest = Math.max(1, Math.min(gap.min, widest));
  // The anchor is the LARGER side: it needs room for the gap underneath it AND the
  // smaller side has to land at or above the window's floor.
  const anchorPool = createNumberPool(
    { min: Math.min(window.min + narrowest, window.max), max: window.max },
    { count: wanted, integers: true },
  );
  if (!anchorPool || anchorPool.numbers.length === 0) return [];
  // A narrow objective window (6-10 holds five counts) has fewer distinct anchors
  // than the session has challenges, and createNumberPool dedupes. Cycle them and
  // let the GAP carry the variety the anchor cannot.
  const anchors = Array.from(
    { length: wanted },
    (_, index) => anchorPool.numbers[index % anchorPool.numbers.length],
  );

  const taken = new Set<string>();
  const pairs = anchors.map((anchor) => {
    const room = Math.max(1, Math.min(widest, anchor - window.min));
    const low = Math.max(1, Math.min(narrowest, room));
    const spread = room - low + 1;
    const start = rollBetween(0, spread - 1);
    // Walk the legal sizes from a random start and take the first that is not
    // already a pair in this pool — a repeated anchor then differs by its gap.
    let size = low + start;
    for (let step = 0; step < spread; step++) {
      const candidate = low + ((start + step) % spread);
      if (!taken.has(pairKey(anchor, Math.max(window.min, anchor - candidate)))) {
        size = candidate;
        break;
      }
    }
    const other = Math.max(window.min, anchor - size);
    taken.add(pairKey(anchor, other));
    return Math.random() < 0.5
      ? { left: anchor, right: other }
      : { left: other, right: anchor };
  });

  if (gap.allowEqual && guaranteeWithin > 0 && pairs.length > 0) {
    const served = Math.max(1, Math.min(guaranteeWithin, pairs.length));
    const index = Math.floor(Math.random() * served);
    const same = pairs[index].left;
    pairs[index] = { left: same, right: same };
  }
  return pairs;
}

/** Two counts make one comparison whichever side they land on. */
function pairKey(left: number, right: number): string {
  return `${Math.min(left, right)}-${Math.max(left, right)}`;
}

/**
 * A pair no challenge in this session is using yet: the pool's spares first, then a
 * fresh roll. Returns null only if even the rolls keep colliding, in which case the
 * repeat is left alone rather than replaced with something off-tier.
 */
function pickUnusedPair(
  used: Set<string>,
  pool: CountPair[],
  window: CountWindow,
  gap: { min: number; max: number; allowEqual: boolean },
): CountPair | null {
  for (const pair of pool) {
    if (!used.has(pairKey(pair.left, pair.right))) return pair;
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const [fresh] = buildCountPairPool(window, gap, 1, 0);
    if (fresh && !used.has(pairKey(fresh.left, fresh.right))) return fresh;
  }
  return null;
}

/**
 * The pool as prompt text. Counts are assigned; the objectType, the flavour and the
 * order of the OTHER modes stay the model's — it reads the topic, we own the numbers.
 */
function buildCountPoolPromptSection(pairs: CountPair[], window: CountWindow): string {
  if (pairs.length === 0) return '';
  const lines = pairs
    .map((pair, index) => `- Comparison ${index + 1}: LEFT ${pair.left}, RIGHT ${pair.right}`)
    .join('\n');
  return `
## GROUP COUNT POOL — MANDATORY for compare-groups (do NOT invent your own counts)
Every count below already sits inside the objective's range (${window.min}-${window.max}).
Take the two group counts for each compare-groups challenge from this list, in order:
${lines}
- Use each pair EXACTLY as written: do not swap the sides, round, merge or replace a pair.
- If you generate fewer compare-groups challenges than there are pairs, use the first ones.
- Vary the objectType instead — that choice is yours, and both groups in one challenge
  must use the SAME objectType.
- Never state either count, or which side has more, in the instruction text.
`;
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const comparisonBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the comparison activity (e.g., 'Which Has More?', 'Compare the Numbers!')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'compare-groups' (visual group comparison), 'compare-numbers' (use <, >, = symbols), 'order' (arrange numbers), 'one-more-one-less' (find one more or one less)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging. For compare-groups: always frame about the left group (e.g., 'Does the left group have more, fewer, or the same number of stars?')"
          },
          leftGroup: {
            type: Type.OBJECT,
            properties: {
              count: {
                type: Type.NUMBER,
                description: "Number of objects in the left group"
              },
              objectType: {
                type: Type.STRING,
                description: "Type of object: 'bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'hearts', 'flowers', 'cookies', 'balls'"
              }
            },
            required: ["count", "objectType"],
            description: "Left group for compare-groups challenges"
          },
          rightGroup: {
            type: Type.OBJECT,
            properties: {
              count: {
                type: Type.NUMBER,
                description: "Number of objects in the right group"
              },
              objectType: {
                type: Type.STRING,
                description: "Type of object: 'bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'hearts', 'flowers', 'cookies', 'balls'"
              }
            },
            required: ["count", "objectType"],
            description: "Right group for compare-groups challenges"
          },
          correctAnswer: {
            type: Type.STRING,
            description: "For compare-groups: 'more', 'less', or 'equal' — which describes the LEFT group relative to the RIGHT group"
          },
          leftNumber: {
            type: Type.NUMBER,
            description: "Left number for compare-numbers challenges"
          },
          rightNumber: {
            type: Type.NUMBER,
            description: "Right number for compare-numbers challenges"
          },
          correctSymbol: {
            type: Type.STRING,
            description: "For compare-numbers: '<', '>', or '=' — the correct inequality symbol between leftNumber and rightNumber"
          },
          numbers: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            // Bounded (same class as VE-5): an unbounded number array lets
            // flash-lite loop into a runaway that truncates at MAX_TOKENS →
            // unterminated JSON. Order tasks use 3-5 values by design.
            minItems: "3",
            maxItems: "5",
            description: "For order challenges: EXACTLY 3-5 numbers to arrange in ascending or descending order"
          },
          direction: {
            type: Type.STRING,
            description: "For order challenges: 'ascending' or 'descending'"
          },
          targetNumber: {
            type: Type.NUMBER,
            description: "For one-more-one-less challenges: the reference number"
          },
          askFor: {
            type: Type.STRING,
            description: "For one-more-one-less challenges: 'one-more', 'one-less', or 'both'"
          }
        },
        required: ["id", "type", "instruction"]
      },
      minItems: "3",
      maxItems: "6",
      description: "EXACTLY 4-6 progressive challenges"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    },
    showCorrespondenceLines: {
      type: Type.BOOLEAN,
      description: "Whether to show one-to-one correspondence lines between groups during compare-groups challenges"
    },
    useAlligatorMnemonic: {
      type: Type.BOOLEAN,
      description: "Whether to use the 'alligator eats the bigger number' mnemonic for inequality symbols"
    }
  },
  required: ["title", "challenges", "gradeBand", "showCorrespondenceLines", "useAlligatorMnemonic"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type ComparisonBuilderConfig = {
  gradeBand?: 'K' | '1';
  showCorrespondenceLines?: boolean;
  useAlligatorMnemonic?: boolean;
  title?: string;
  description?: string;
  /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
  targetEvalMode?: string;
  /** How many challenges in this session. Defaults from COUNT_BY_MODE (5 for all T2 modes). */
  instanceCount?: number;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-screen scaffolding + structural problem difficulty
   * within it. NEVER changes number magnitude / maxNumber.
   */
  difficulty?: string;
};

export const generateComparisonBuilder = async (
  ctx: GenerationContext,
): Promise<ComparisonBuilderData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  // The per-component objective the manifest assigned to THIS instance (≠ the
  // broad topic). The LLM authors the actual numbers here (code only clamps to the
  // grade band + recomputes the answer), so feeding intent into the prompt is a
  // genuine Tier-1 scope lever — it moves which numbers/groups the LLM picks within
  // the band, not just title/description flavor. See /topic-fidelity triage.
  const intent = ctx.intent || topic;
  const config = ctx.raw as ComparisonBuilderConfig;
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'comparison-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(comparisonBuilderSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : comparisonBuilderSchema;

  // ── Resolve per-mode instance count up-front ──
  // When pinned to a single eval mode, use the COUNT_BY_MODE table; otherwise
  // fall back to the T2 default (5).
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ComparisonBuilderChallengeType)
      : undefined;
  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.instanceCount ??
        (pinnedType ? COUNT_BY_MODE[pinnedType] : undefined) ??
        DEFAULT_INSTANCE_COUNT,
    ),
  );

  // ── Within-mode support tier (config.difficulty) ──
  // supportTier is the STUDENT's tier and DRIVES the deterministic application at
  // the end (per challenge, blends included). pinnedType is ONLY used for the
  // prompt tone (a curated blend has no single mode to describe to the LLM).
  // ── Grade band: curriculum metadata, never a model choice ──
  // The band picks the number ceiling (K 1-10, G1 1-20), so the pool below cannot be
  // rolled without it, and it cannot come from Gemini: an `eval-test` run at grade=K
  // with the generic 'elementary' prose shipped band '1' and the pool rolled 19v15
  // for a Kindergarten comparison. `ctx.grade` is already normalized by
  // resolveGenerationContext (the only grade parser); the prose fallback is kept for
  // lessons that carry no canonical grade at all.
  const canonicalBand = ctx.grade === 'K' ? 'K' : ctx.grade ? '1' : null;
  const resolvedBand: 'K' | '1' =
    config?.gradeBand
    ?? canonicalBand
    ?? (gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1');

  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierSection =
    (pinnedType && supportTier ? buildTierPromptSection(pinnedType, supportTier) : '')
    + buildRemediationPrompt(ctx.remediationFocus);

  // ── Pre-rolled compare-groups counts (see the pool section above) ──
  // Built per call, so two independent generations of the same lesson diverge. Only
  // compare-groups is pooled: it is the mode the atlas caught converging, and its
  // counts are incidental DATA (the pedagogy is the comparison), so the band is the
  // only ceiling that applies. Ask for two more pairs than the session ships.
  const bandMax = resolvedBand === 'K' ? 10 : 20;
  // ── The objective's own count range (atlas CB-5) ──
  // The band is the outer ceiling; the range the OBJECTIVE names is the real one, and
  // the pool is rolled in code BEFORE the prompt exists, so a prompt-only bound cannot
  // reach it. One shared micro-call, gated on compare-groups being in play — the other
  // three modes pick their own numbers and pay nothing for this.
  const poolsGroups = !pinnedType || pinnedType === 'compare-groups';
  const scopeWindow = poolsGroups
    ? await resolveScopeRange(
      { ...ctx.scope, topic, intent },
      gradeLevel,
      'the two group counts the student compares (how many objects sit in each group)',
      { min: 1, max: bandMax },
    )
    : null;
  const countWindow = normalizeCountWindow(scopeWindow, bandMax);
  if (countWindow.min > 1 || countWindow.max < bandMax) {
    console.log(
      `[ComparisonBuilder] objective count window → ${countWindow.min}-${countWindow.max} `
      + `(band 1-${bandMax})`,
    );
  }
  const tierGap = supportTier
    ? resolveProblemShape('compare-groups', supportTier).countGap ?? UNTIERED_COUNT_GAP
    : UNTIERED_COUNT_GAP;
  // The window can be too narrow to hold a session's worth of distinct pairs at the
  // tier's gap; the gap gives, never the window (see fitGapToWindow).
  const countGap = fitGapToWindow(tierGap, countWindow, instanceCount + 1);
  const countPairs = poolsGroups
    ? buildCountPairPool(countWindow, countGap, instanceCount + 2, instanceCount)
    : [];
  const countPoolSection = buildCountPoolPromptSection(countPairs, countWindow);
  const countWindowLine = countWindow.min > 1 || countWindow.max < bandMax
    ? `\nCOUNT RANGE (overrides the grade guidance below): every group count in this activity`
      + ` MUST be between ${countWindow.min} and ${countWindow.max} inclusive — the objective says so,`
      + ` and the grade band is only the outer ceiling. Never state the range, either count, or`
      + ` which side has more inside an instruction, hint or narration.`
    : '';

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational comparison activity for teaching "${topic}" to ${gradeLevel} students.

THIS ACTIVITY'S SPECIFIC FOCUS: ${intent}
Choose the numbers and group counts so the activity targets that focus (e.g. a focus on
"teen numbers" → numbers in the 11-20 range; "numbers near each other" → close values).
Stay within the grade band below — the grade is the CEILING and is never exceeded. Do NOT
name or hint at any answer (more/less/=, the sorted order) in the instruction text.${countWindowLine}

CONTEXT:
- A comparison builder helps students learn to compare quantities and use inequality symbols (<, >, =)
- Students work through challenges that build from concrete visual comparisons to abstract number comparisons
- Key skills: comparing groups, using inequality symbols, ordering numbers, one-more/one-less reasoning

${challengeTypeSection}
${tierSection}
${countPoolSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Numbers 1-10 only
  * Groups up to 5-10 objects
  * Focus on compare-groups (concrete) and one-more-one-less
  * Include 1-2 compare-numbers challenges with small numbers (1-5)
  * Simple ordering with 3 numbers
  * Use warm, fun language ("Which group has more bears? Let's count and find out!")
  * Set showCorrespondenceLines: true (helps K students see 1-to-1 matching)
  * Set useAlligatorMnemonic: true (the alligator mouth opens toward the bigger number)

- Grade 1 (gradeBand "1"):
  * Numbers 1-20
  * Groups up to 10-15 objects
  * All 4 challenge types in good balance
  * Ordering with 4-5 numbers
  * Introduce both ascending and descending ordering
  * More abstract compare-numbers challenges
  * Use encouraging language that builds confidence with symbols
` : ''}

OBJECT TYPES (pick from these for groups):
bears, apples, stars, blocks, fish, butterflies, hearts, flowers, cookies, balls

${(() => {
  const hints: string[] = [];
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (config?.showCorrespondenceLines !== undefined) hints.push(`- Show correspondence lines: ${config.showCorrespondenceLines}`);
  if (config?.useAlligatorMnemonic !== undefined) hints.push(`- Use alligator mnemonic: ${config.useAlligatorMnemonic}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate EXACTLY ${instanceCount} challenges that progress in difficulty
2. Start with easier challenges and build up
3. Use warm, encouraging instruction text for young children
4. For compare-groups: use the same object type in both groups for fair comparison. The instruction MUST ask about the LEFT group (e.g. "Does the left group have more, fewer, or the same?")
5. For compare-numbers: correctSymbol must be mathematically correct
6. For order: provide numbers in shuffled (non-sorted) order
7. For one-more-one-less: target numbers should be within range (not 1 for one-less in K, not max for one-more)
8. Each challenge must have a unique id (c1, c2, c3, etc.)
9. Vary the difficulty progressively

Return the complete comparison builder configuration.
`;

  logEvalModeResolution('ComparisonBuilder', config?.targetEvalMode, evalConstraint);

  // Same class as VE-5: an unguarded JSON.parse threw a raw truncation
  // SyntaxError ("Expected ',' or '}' … at position 65700") whenever flash-lite
  // ran into a runaway and truncated at MAX_TOKENS. Generators run under
  // Promise.all in the build pipeline, so a thrown SyntaxError fails the WHOLE
  // exhibit — retry once, then degrade to the per-mode fallback challenge below.
  // The schema now bounds challenges (3-6) and order numbers (3-5), and
  // maxOutputTokens backstops any runaway.
  const MAX_ATTEMPTS = 2;
  let data: any = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        // Hard backstop against a runaway. Sized generously for a full
        // 6-challenge payload; a legit generation lands far below.
        maxOutputTokens: 8192,
      },
    });

    if (!result.text) {
      console.warn(`[ComparisonBuilder] Empty response on attempt ${attempt}/${MAX_ATTEMPTS}.`);
      continue;
    }
    try {
      data = JSON.parse(result.text);
      break;
    } catch (err) {
      console.warn(
        `[ComparisonBuilder] JSON parse failed on attempt ${attempt}/${MAX_ATTEMPTS} `
        + `(${result.text.length} chars; finishReason=${result.candidates?.[0]?.finishReason ?? 'unknown'}). `
        + `${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (!data || typeof data !== 'object') {
    console.warn('[ComparisonBuilder] All attempts failed — degrading to skeleton (fallback challenge fills in).');
    data = { title: 'Comparison Practice', description: 'Compare, order, and reason about numbers.' };
  }

  // ── Structural validation ──

  // The band the pool was rolled against is the band that ships (see above).
  data.gradeBand = resolvedBand;

  if (typeof data.showCorrespondenceLines !== 'boolean') {
    data.showCorrespondenceLines = true;
  }
  if (typeof data.useAlligatorMnemonic !== 'boolean') {
    data.useAlligatorMnemonic = true;
  }

  // Valid values for validation
  const validTypes = ['compare-groups', 'compare-numbers', 'order', 'one-more-one-less'];
  const validObjectTypes = ['bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'hearts', 'flowers', 'cookies', 'balls'];
  const maxNumber = data.gradeBand === 'K' ? 10 : 20;

  // Filter to valid challenge types (safety net — schema enum handles the eval mode case)
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // Defensive count clamp — Gemini occasionally over- or under-shoots even with
  // an explicit count in the prompt. Trim to instanceCount when over; if under,
  // accept the shorter list (fallback below handles the empty case).
  if (data.challenges.length > instanceCount) {
    data.challenges = data.challenges.slice(0, instanceCount);
  }

  // Ensure unique IDs
  const seenIds = new Set<string>();
  for (let i = 0; i < data.challenges.length; i++) {
    const challenge = data.challenges[i] as ComparisonBuilderChallenge;
    if (!challenge.id || seenIds.has(challenge.id)) {
      challenge.id = `c${i + 1}`;
    }
    seenIds.add(challenge.id);

    // Per-type validation
    switch (challenge.type) {
      case 'compare-groups': {
        if (!challenge.leftGroup) {
          challenge.leftGroup = { count: 3, objectType: 'bears' };
        }
        if (!challenge.rightGroup) {
          challenge.rightGroup = { count: 5, objectType: 'bears' };
        }
        // The objective's range, not just the band: a "groups of up to 5" lesson that
        // ships a 9 is out of scope even though 9 is a legal K count. The answer key is
        // recomputed from the clamped counts immediately below (contract R4).
        challenge.leftGroup.count = clampToWindow(challenge.leftGroup.count, countWindow);
        challenge.rightGroup.count = clampToWindow(challenge.rightGroup.count, countWindow);
        if (!validObjectTypes.includes(challenge.leftGroup.objectType)) {
          challenge.leftGroup.objectType = 'bears';
        }
        if (!validObjectTypes.includes(challenge.rightGroup.objectType)) {
          challenge.rightGroup.objectType = 'bears';
        }
        // Compute correct answer based on actual counts
        if (challenge.leftGroup.count > challenge.rightGroup.count) {
          challenge.correctAnswer = 'more';
        } else if (challenge.leftGroup.count < challenge.rightGroup.count) {
          challenge.correctAnswer = 'less';
        } else {
          challenge.correctAnswer = 'equal';
        }
        break;
      }
      case 'compare-numbers': {
        if (typeof challenge.leftNumber !== 'number') challenge.leftNumber = 3;
        if (typeof challenge.rightNumber !== 'number') challenge.rightNumber = 5;
        challenge.leftNumber = Math.max(1, Math.min(challenge.leftNumber, maxNumber));
        challenge.rightNumber = Math.max(1, Math.min(challenge.rightNumber, maxNumber));
        if (challenge.leftNumber > challenge.rightNumber) {
          challenge.correctSymbol = '>';
        } else if (challenge.leftNumber < challenge.rightNumber) {
          challenge.correctSymbol = '<';
        } else {
          challenge.correctSymbol = '=';
        }
        break;
      }
      case 'order': {
        if (!Array.isArray(challenge.numbers) || challenge.numbers.length < 3) {
          challenge.numbers = [3, 1, 5];
        }
        challenge.numbers = challenge.numbers.map(
          (n: number) => Math.max(1, Math.min(typeof n === 'number' ? n : 1, maxNumber))
        );
        if (challenge.direction !== 'ascending' && challenge.direction !== 'descending') {
          challenge.direction = 'ascending';
        }
        break;
      }
      case 'one-more-one-less': {
        if (typeof challenge.targetNumber !== 'number') challenge.targetNumber = 5;
        challenge.targetNumber = Math.max(1, Math.min(challenge.targetNumber, maxNumber));
        if (challenge.askFor !== 'one-more' && challenge.askFor !== 'one-less' && challenge.askFor !== 'both') {
          challenge.askFor = 'both';
        }
        if (challenge.askFor === 'one-less' || challenge.askFor === 'both') {
          challenge.targetNumber = Math.max(2, challenge.targetNumber);
        }
        if (challenge.askFor === 'one-more' || challenge.askFor === 'both') {
          challenge.targetNumber = Math.min(maxNumber - 1, challenge.targetNumber);
        }
        break;
      }
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'compare-groups';
    // Even the degraded path honors the window — the pool's first pair when there is
    // one, the literal counts pulled into range when there is not.
    const fallbackPair = countPairs[0]
      ?? { left: clampToWindow(3, countWindow), right: clampToWindow(5, countWindow) };
    const fallbacks: Record<string, ComparisonBuilderChallenge> = {
      'compare-groups': {
        id: 'c1',
        type: 'compare-groups' as const,
        instruction: 'Which group has more bears?',
        leftGroup: { count: fallbackPair.left, objectType: 'bears' },
        rightGroup: { count: fallbackPair.right, objectType: 'bears' },
        correctAnswer: fallbackPair.left > fallbackPair.right
          ? 'more'
          : fallbackPair.left < fallbackPair.right ? 'less' : 'equal',
      },
      'compare-numbers': {
        id: 'c1',
        type: 'compare-numbers' as const,
        instruction: 'Pick the right symbol: is 4 greater than, less than, or equal to 7?',
        leftNumber: 4,
        rightNumber: 7,
        correctSymbol: '<' as const,
      },
      order: {
        id: 'c1',
        type: 'order' as const,
        instruction: 'Put these numbers in order from least to greatest!',
        numbers: [3, 1, 5],
        direction: 'ascending' as const,
      },
      'one-more-one-less': {
        id: 'c1',
        type: 'one-more-one-less' as const,
        instruction: 'What is one more than 5? What is one less?',
        targetNumber: 5,
        askFor: 'both' as const,
      },
    };
    console.log(`[ComparisonBuilder] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [fallbacks[fallbackType] ?? fallbacks['compare-groups']];
  }

  // ── Apply the support tier deterministically (code owns the SUPPORT structure
  // AND the in-mode problem shape; the LLM only chose compatible numbers). Runs
  // AFTER all per-type fixups so a hard tier's structural levers win. Gated ONLY on
  // supportTier (NOT pinnedType) so blended/auto sessions get difficulty too; each
  // structural lever is resolved per challenge from its OWN mode. The new on-screen
  // scaffold flags are data-level (global): for a single-mode session that mode owns
  // them; for a blend we withdraw a flag if its owning mode asks for withdrawal. ──
  if (supportTier) {
    // ---- Axis 2: in-mode structural shape, code-enforced per challenge ----
    for (const challenge of data.challenges as ComparisonBuilderChallenge[]) {
      const mode = challenge.type as ComparisonBuilderChallengeType;
      const shape = resolveProblemShape(mode, supportTier);

      if (mode === 'compare-groups' && shape.countGap && challenge.leftGroup && challenge.rightGroup) {
        // Code-enforce the count-gap structurally — keep the SAME magnitude band
        // (1..maxNumber). Anchor on the larger side and derive the smaller from the
        // enforced gap so we never push past maxNumber. allowEqual=false (hard)
        // excludes gap=0 (equal is its own answer/the '=' case).
        // The FITTED gap (what the pool was built to), not the raw tier gap: a narrow
        // objective window can force the gap to relax, and re-testing against the raw
        // tier here would rewrite every pooled pair straight back out of the window.
        const { min, max, allowEqual } = countGap;
        const currentGap = Math.abs(challenge.leftGroup.count - challenge.rightGroup.count);
        // A gap that already satisfies the tier is LEFT ALONE — that is how the
        // pre-rolled pairs survive this pass. Rewriting unconditionally pinned every
        // gap to max and threw away the pool's variety (and any equal case with it).
        const gapSatisfied = currentGap === 0 ? allowEqual : currentGap >= min && currentGap <= max;
        if (gapSatisfied) {
          challenge.correctAnswer = currentGap === 0
            ? 'equal'
            : challenge.leftGroup.count > challenge.rightGroup.count ? 'more' : 'less';
        } else {
          const leftWasLarger = challenge.leftGroup.count >= challenge.rightGroup.count;
          const anchor = Math.max(challenge.leftGroup.count, challenge.rightGroup.count);
          // Anchor on the larger side, inside the window at both ends. When the window
          // is too tight to hold the tier's gap the WINDOW wins — scope outranks the
          // structural lever, exactly as the grade band already outranks it.
          const high = Math.min(
            countWindow.max,
            Math.max(countWindow.min + min, Math.min(anchor, countWindow.max)),
          );
          const room = Math.max(1, high - countWindow.min);
          const gap = Math.min(Math.max(min, Math.min(max, room)), room);
          const low = Math.max(countWindow.min, high - gap);
          if (leftWasLarger) {
            challenge.leftGroup.count = high;
            challenge.rightGroup.count = low;
          } else {
            challenge.rightGroup.count = high;
            challenge.leftGroup.count = low;
          }
          challenge.correctAnswer =
            challenge.leftGroup.count > challenge.rightGroup.count ? 'more' : 'less';
        }
      }

      if (mode === 'compare-numbers' && shape.digitOverlap &&
          typeof challenge.leftNumber === 'number' && typeof challenge.rightNumber === 'number') {
        if (shape.digitOverlap === 'same-tens' && maxNumber > 10) {
          // Pull both numbers into the same ten (e.g. 14 vs 17) — same band, subtler.
          // Anchor on the larger value's ten; keep both distinct within that ten.
          const anchor = Math.max(challenge.leftNumber, challenge.rightNumber);
          const tens = Math.min(Math.floor(anchor / 10) * 10, maxNumber - 9);
          const base = Math.max(0, tens);
          // two distinct ones digits within [base+1 .. min(base+9, maxNumber)]
          const ceil = Math.min(base + 9, maxNumber);
          const a = Math.max(base + 1, Math.min(challenge.leftNumber, ceil));
          let b = Math.max(base + 1, Math.min(challenge.rightNumber, ceil));
          if (a === b) b = a < ceil ? a + 1 : a - 1;
          challenge.leftNumber = a;
          challenge.rightNumber = b;
        }
        // distinct-tens: leave the LLM's wide-gap numbers as-is (already in band).
        challenge.correctSymbol =
          challenge.leftNumber > challenge.rightNumber ? '>'
            : challenge.leftNumber < challenge.rightNumber ? '<' : '=';
      }

      if (mode === 'one-more-one-less' && shape.askFor && typeof challenge.targetNumber === 'number') {
        challenge.askFor = shape.askFor;
        // Re-apply the range guards for the (possibly changed) askFor.
        if (challenge.askFor === 'one-less' || challenge.askFor === 'both') {
          challenge.targetNumber = Math.max(2, challenge.targetNumber);
        }
        if (challenge.askFor === 'one-more' || challenge.askFor === 'both') {
          challenge.targetNumber = Math.min(maxNumber - 1, challenge.targetNumber);
        }
      }

      if (mode === 'order' && shape.direction && Array.isArray(challenge.numbers)) {
        challenge.direction = shape.direction;
      }
    }

    // ---- Axis 1: on-screen scaffold flags (data-level / global) ----
    // Resolve each flag from the tier on its OWNING mode, withdrawing the flag if
    // that mode is present and asks to withdraw it. For a single-mode session this
    // is exactly the pinned mode; for a blend a mode only governs its own flag.
    const present = new Set((data.challenges as ComparisonBuilderChallenge[]).map((c) => c.type));
    const groupsSc = present.has('compare-groups') ? resolveSupportStructure('compare-groups', supportTier) : null;
    const numbersSc = present.has('compare-numbers') ? resolveSupportStructure('compare-numbers', supportTier) : null;
    const omolSc = present.has('one-more-one-less') ? resolveSupportStructure('one-more-one-less', supportTier) : null;
    const orderSc = present.has('order') ? resolveSupportStructure('order', supportTier) : null;

    // compare-groups owns count badges + correspondence mode.
    if (groupsSc) {
      data.showCountBadges = groupsSc.showCountBadges;
      data.correspondenceMode = groupsSc.correspondenceMode;
      // Keep legacy boolean in sync (true unless lines fully off) for back-compat.
      data.showCorrespondenceLines = groupsSc.correspondenceMode !== 'off';
    }
    // compare-numbers owns the alligator mnemonic.
    if (numbersSc) {
      data.useAlligatorMnemonic = numbersSc.useAlligatorMnemonic;
    }
    // one-more-one-less owns the number-line target marker (NEVER hide the amber
    // Target box too — the component always renders that as the stimulus).
    if (omolSc) {
      data.showTargetMarker = omolSc.showTargetMarker;
    }
    // order owns the slot-index hints.
    if (orderSc) {
      data.showSlotHints = orderSc.showSlotHints;
    }

    // Persist the tier so the live tutor matches what's on screen.
    data.supportTier = supportTier;

    console.log(
      `[ComparisonBuilder] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → `
      + `countBadges=${data.showCountBadges ?? '–'}, correspondence=${data.correspondenceMode ?? '–'}, `
      + `alligator=${data.useAlligatorMnemonic ?? '–'}, targetMarker=${data.showTargetMarker ?? '–'}, `
      + `slotHints=${data.showSlotHints ?? '–'}`,
    );
  }

  // ── Distinct-problem gate for compare-groups ──
  // The pool hands the model distinct pairs, and it can still copy one: a live K draw
  // came back 10v10, 8v10, 6v5, 10v10, 10v10. Reassign the repeat from the pairs
  // nobody used (the pool is rolled two deep for exactly this) instead of dropping
  // the challenge — the session keeps its length, its object types and its prose, and
  // the pairs are already built to the tier's gap so the structure survives. Runs
  // AFTER the tier pass, which can itself collapse two pairs onto one gap.
  if (countPairs.length > 0) {
    const used = new Set<string>();
    let reassigned = 0;
    for (const challenge of data.challenges as ComparisonBuilderChallenge[]) {
      if (challenge.type !== 'compare-groups' || !challenge.leftGroup || !challenge.rightGroup) continue;
      const key = pairKey(challenge.leftGroup.count, challenge.rightGroup.count);
      if (!used.has(key)) {
        used.add(key);
        continue;
      }
      const replacement = pickUnusedPair(used, countPairs, countWindow, countGap);
      if (!replacement) continue;
      challenge.leftGroup.count = replacement.left;
      challenge.rightGroup.count = replacement.right;
      challenge.correctAnswer = replacement.left > replacement.right
        ? 'more'
        : replacement.left < replacement.right ? 'less' : 'equal';
      used.add(pairKey(replacement.left, replacement.right));
      reassigned += 1;
    }
    if (reassigned > 0) {
      console.log(`[ComparisonBuilder] Reassigned ${reassigned} repeated comparison(s) to unused pairs`);
    }
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[ComparisonBuilder] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);
  if (countPairs.length > 0) {
    const served = (data.challenges as ComparisonBuilderChallenge[])
      .filter((c) => c.type === 'compare-groups' && c.leftGroup && c.rightGroup)
      .map((c) => `${c.leftGroup!.count}v${c.rightGroup!.count}`);
    console.log(
      `[ComparisonBuilder] count pool (window ${countWindow.min}-${countWindow.max}, `
      + `gap ${countGap.min}-${countGap.max}`
      + `${countGap.allowEqual ? ', equal included' : ''}): `
      + `[${countPairs.map((p) => `${p.left}v${p.right}`).join(', ')}] → served [${served.join(', ')}]`,
    );
  }

  // Apply config overrides
  if (config) {
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.showCorrespondenceLines !== undefined) data.showCorrespondenceLines = config.showCorrespondenceLines;
    if (config.useAlligatorMnemonic !== undefined) data.useAlligatorMnemonic = config.useAlligatorMnemonic;
    if (config.title !== undefined) data.title = config.title;
    if (config.description !== undefined) data.description = config.description;
  }

  return data as ComparisonBuilderData;
};
