import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Ratio-table oracle — a CALCULATION oracle for the equivalent-ratio / unit-rate
 * family (challenge types missing-value, find-multiplier, build-ratio, unit-rate).
 * Like array-grid and area-model (and unlike comparison-builder), the primitive
 * ships NO stored answer key: a challenge is just a `baseRatio` pair, a
 * `targetMultiplier`, and (for missing-value) which scaled cell is `hiddenValue`.
 * The component derives the correct value LIVE from those fields, so the classic
 * "correct entry marked wrong" desync is structurally impossible in its pure form.
 * "Trusting the shipped key" therefore means trusting that (a) the derived answer
 * is REACHABLE by the interaction the mode uses, and (b) the ratio is well-formed
 * and in scope — which is exactly what this oracle re-derives.
 *
 * The component (RatioTable.tsx) judges correctness as:
 *  - targetValue is computed live (RatioTable.tsx:188-204) — NEVER stored:
 *      missing-value  : hiddenValue==='scaled-first' ? baseRatio[0]*targetMultiplier
 *                                                     : baseRatio[1]*targetMultiplier
 *      find-multiplier: targetMultiplier
 *      unit-rate      : unitRate = baseRatio[0]!==0 ? baseRatio[1]/baseRatio[0] : 0  (:186)
 *      build-ratio    : targetMultiplier
 *  - entered modes (missing-value/find-multiplier/unit-rate), checkAnswer (:345-348):
 *      percentError = |parsed - targetValue| / targetValue * 100;
 *      correct = percentError <= tolerance   (tolerance default 1%, :176).
 *  - slider mode (build-ratio), checkAnswer (:312-313):
 *      sliderError = |(sliderMultiplier - targetMultiplier)/targetMultiplier| * 100;
 *      correct = sliderError <= tolerance*2. The slider only spans
 *      min=0.5 .. max=maxMultiplier (:800-801, maxMultiplier default 10, :109), so a
 *      targetMultiplier OUTSIDE [0.5, maxMultiplier] can NEVER be reached — the
 *      correct state is unreachable, the array-grid "correct answer isn't among the
 *      options" class. Entered modes type freely, so no such cap gates them.
 *
 * THE INDEPENDENCE RULE: the oracle re-derives the answer FROM the ratio the same
 * way the component's live `targetValue` memo does — baseRatio × targetMultiplier
 * (row-selected by hiddenValue) / the multiplier / baseRatio[1]÷baseRatio[0] — and
 * never trusts any stored answer field. It cross-checks that derivation against the
 * mode's REACHABILITY (slider span for build-ratio, non-zero divisor for unit-rate)
 * and against scope, and defensively guards any redundant stored key a future
 * generation might add. A single base ratio is the only "given row"; the scaled
 * column is derived (baseRatio × k), so it is equivalent BY CONSTRUCTION — there is
 * no second independently-stored row whose a/b could disagree, so cross-row
 * equivalence is structurally guaranteed and nothing to check.
 *
 * Checks:
 *  - answer-key-desync : (a) baseRatio must be two POSITIVE numbers and
 *    targetMultiplier positive — a zero/negative baseRatio[0] makes the unit rate
 *    a divide-by-zero (component yields 0) and a non-positive scaled cell an
 *    unreachable/degenerate answer. (b) build-ratio REACHABILITY — targetMultiplier
 *    must lie within the slider span [0.5, maxMultiplier]; outside it the correct
 *    multiplier can never be set and the student is marked wrong forever. (c)
 *    DEFENSIVE: if a generation ever ships a redundant `targetValue`/`answer`/
 *    `correctAnswer` field, it must agree (within the challenge's own tolerance
 *    band) with the value re-derived from the ratio — today none are shipped.
 *  - scope             : the largest quantity ON SCREEN honors the objective
 *    ceiling. For entered/slider modes that is max(baseRatio, scaledColumn) =
 *    max(a, b, a·k, b·k); for unit-rate only the base pair (a, b) is shown (the
 *    scaled column and bar chart are withdrawn). "Ratios within 50" emitting a
 *    12:8 base scaled ×10 to 120:80 is content past the objective. Ceiling =
 *    ctx.scopeMax ?? topic ceiling ?? a loose intrinsic net (1000): ratios have no
 *    hard schema cap, so the real scope signal comes from a scope-bearing topic.
 *  - clustering        : within a (single-mode) session the derived answers must
 *    spread (no "every multiplier is 2") — bucketed per type since the answer's
 *    scale differs by mode — and no exact-duplicate card (same type + baseRatio +
 *    targetMultiplier + hiddenValue twice is a byte-identical challenge).
 *  - schema            : challenges present, >=3 (mastery-over-demo); each has a
 *    known type, a 2-number baseRatio, a 2-item rowLabels, a numeric
 *    targetMultiplier, a numeric tolerance if present, and — for missing-value —
 *    a hiddenValue in {scaled-first, scaled-second}.
 *
 * Deliberately NOT checked:
 *  - answer-leak. Every prompt states the stimulus by design: a ratio word problem
 *    NECESSARILY names the base ratio and the known scaled operand ("If 2 cups make
 *    6 muffins, how many with 4 cups?"), and unit-rate renders the literal
 *    "b ÷ a = ?" division (:681). The title/description are number-free by schema.
 *    A leak test would fire on the intended stimulus — worse than an honest gap.
 *    Leak/quality stays with /eval-test.
 *  - cross-row ratio equivalence. Only ONE row (baseRatio) is stored; the scaled
 *    column is derived, hence equivalent by construction (see INDEPENDENCE above).
 *  - targetMultiplier "cross-check" against a solved row. There is no independently
 *    stored solved row — the scaled column IS baseRatio×targetMultiplier — so the
 *    multiplier is its own sole definition, with nothing to disagree with.
 *  - the slider's 0.1 step granularity. Generators emit integer/half multipliers
 *    (exact 0.1-multiples, reachable within tolerance); the range check above is the
 *    load-bearing reachability guard.
 */

const KNOWN_TYPES = new Set(['missing-value', 'find-multiplier', 'build-ratio', 'unit-rate']);
const HIDDEN_VALUES = new Set(['scaled-first', 'scaled-second']);

// Slider span (RatioTable.tsx:800 min, :801 max, :109 maxMultiplier default).
const SLIDER_MIN = 0.5;
const DEFAULT_MAX_MULTIPLIER = 10;

// Loose intrinsic ceiling on the largest on-screen quantity when neither the
// harness nor the topic names one. Ratios carry no hard schema cap on baseRatio /
// targetMultiplier, so this is only a safety net — the real scope signal is a
// scope-bearing topic ("ratios within 50") or ?scopeMax.
const INTRINSIC_MAX_QUANTITY = 1000;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Re-derive the component's live `targetValue` from the ratio. null = undefined. */
function deriveAnswer(
  type: string,
  a: number,
  b: number,
  tm: number,
  hiddenValue: string,
): number | null {
  switch (type) {
    case 'missing-value':
      return hiddenValue === 'scaled-first' ? a * tm : b * tm;
    case 'find-multiplier':
    case 'build-ratio':
      return tm;
    case 'unit-rate':
      return a !== 0 ? b / a : null;
    default:
      return null;
  }
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export const ratioTableOracle: ContentOracle = {
  componentId: 'ratio-table',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const maxMultiplier = isNum(data.maxMultiplier) ? (data.maxMultiplier as number) : DEFAULT_MAX_MULTIPLIER;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? INTRINSIC_MAX_QUANTITY;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Per-type derived-answer buckets for variety, and duplicate-card tracking.
    const derivedByType: Record<string, Array<number>> = {
      'missing-value': [],
      'find-multiplier': [],
      'build-ratio': [],
      'unit-rate': [],
    };
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');

      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      // ── schema: baseRatio / rowLabels / targetMultiplier shape ──
      const br = c.baseRatio;
      if (!Array.isArray(br) || br.length !== 2 || !isNum(br[0]) || !isNum(br[1])) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `baseRatio must be [number, number]; got ${JSON.stringify(br)}`,
        });
        continue;
      }
      const a = br[0] as number;
      const b = br[1] as number;

      const tm = c.targetMultiplier;
      if (!isNum(tm)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `targetMultiplier must be a number; got ${JSON.stringify(tm)}`,
        });
        continue;
      }
      const mult = tm as number;

      const labels = c.rowLabels;
      if (!Array.isArray(labels) || labels.length !== 2) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `rowLabels must be a 2-item array; got ${JSON.stringify(labels)}`,
        });
      }
      if ('tolerance' in c && c.tolerance !== undefined && (!isNum(c.tolerance) || (c.tolerance as number) < 0)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `tolerance must be a non-negative number when present; got ${JSON.stringify(c.tolerance)}`,
        });
      }

      const hiddenValue = String(c.hiddenValue ?? 'scaled-second');
      if (type === 'missing-value' && !HIDDEN_VALUES.has(hiddenValue)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `missing-value hiddenValue must be scaled-first|scaled-second; got ${JSON.stringify(c.hiddenValue)}`,
        });
      }

      // ── answer-key-desync (a): well-formedness — positive ratio & multiplier ──
      if (a <= 0 || b <= 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `baseRatio [${a}, ${b}] has a non-positive term — a scaled cell / unit rate (b÷a) would be degenerate or divide-by-zero, an unreachable correct state`,
        });
        continue;
      }
      if (mult <= 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `targetMultiplier ${mult} is non-positive — the scaled ratio and derived answer are degenerate`,
        });
        continue;
      }
      checked++;

      // ── Independence: re-derive the component's live targetValue from the ratio ──
      const derived = deriveAnswer(type, a, b, mult, hiddenValue);
      if (derived === null) {
        // Only reachable for unit-rate with a===0, already excluded above.
        continue;
      }

      // ── answer-key-desync (b): build-ratio slider reachability ──
      if (type === 'build-ratio' && (mult < SLIDER_MIN || mult > maxMultiplier)) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `build-ratio targetMultiplier ${mult} is outside the slider span [${SLIDER_MIN}, ${maxMultiplier}] — the correct multiplier can never be set, so the correct state is unreachable`,
        });
      }

      // ── answer-key-desync (c): DEFENSIVE stored-key agreement (none shipped
      //    today; guards a future generation adding a redundant answer field). ──
      const tol = isNum(c.tolerance) ? (c.tolerance as number) : 1;
      for (const key of ['targetValue', 'answer', 'correctAnswer'] as const) {
        if (key in c && isNum(c[key])) {
          const stored = c[key] as number;
          const pctErr = derived !== 0 ? Math.abs((stored - derived) / derived) * 100 : (stored === 0 ? 0 : 100);
          if (pctErr > tol) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `stored ${key}=${stored} disagrees with re-derived answer ${derived} (${pctErr.toFixed(1)}% off, tolerance ${tol}%) — a correct entry would be marked wrong`,
            });
          }
        }
      }

      // ── scope: the largest on-screen quantity honors the objective ceiling ──
      const scaledA = a * mult;
      const scaledB = b * mult;
      const maxQuantity = type === 'unit-rate'
        ? Math.max(a, b)
        : Math.max(a, b, scaledA, scaledB);
      if (maxQuantity > ceiling) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `largest on-screen quantity ${maxQuantity} (base ${a}:${b}${type === 'unit-rate' ? '' : ` scaled ×${mult} → ${scaledA}:${scaledB}`}) exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      derivedByType[type].push(derived);
      bump(cardSeen, `${type}:${a}:${b}:${mult}:${type === 'missing-value' ? hiddenValue : ''}`);
    }

    // ── clustering: derived answers spread within each mode ──
    for (const [type, values] of Object.entries(derivedByType)) {
      const variety = checkAnswerVariety(values, `${type}[].answer`);
      if (variety) violations.push(variety);
    }
    // ── clustering: no exact-duplicate card ──
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical challenge "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
