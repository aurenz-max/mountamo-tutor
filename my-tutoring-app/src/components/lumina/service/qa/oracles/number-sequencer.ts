import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Number-sequencer oracle — a CALCULATION oracle for the K-1 number-sequence
 * family (fill-missing, before-after, order-cards, count-from, decade-fill). Its
 * flagship guarantee is answer-key-desync: every `correctAnswers[i]` must equal
 * the value the surrounding pattern actually demands at the i-th blank — a click
 * that matches the pattern must not be marked wrong (the vocabulary-explorer class).
 *
 * The component (NumberSequencer.tsx) judges correctness per type in
 * handleCheckAnswer (:312-395):
 *  - fill-missing / before-after (:320-329): blankIndices = the null positions in
 *    `sequence` (:296-301); studentValues = the digit typed into each blank IN
 *    NULL ORDER; correct = correctAnswers.every((ans,i) => studentValues[i] === ans).
 *    So correctAnswers must list, in left-to-right null order, the value the
 *    sequence's arithmetic rule requires at each null — and its length MUST equal
 *    the null count (a shorter/longer key silently mis-grades).
 *  - decade-fill (:330-344): the grid is rendered from rangeMin..rangeMax and a
 *    cell blanks iff its number ∈ correctAnswers (:811-812); the student types that
 *    number back and correct = correctAnswers.every((ans,i) => dfValues[i] === ans).
 *    So a correctAnswer OUTSIDE [rangeMin,rangeMax] never renders a blank cell —
 *    an unreachable answer — and `sequence` (with its nulls) is the pattern spec the
 *    key must still agree with arithmetically.
 *  - order-cards (:345-352): correct = correctAnswers.every((ans,i) => orderedCards[i] === ans);
 *    the tappable pool is sequence.filter(non-null) (:647). So correctAnswers must be
 *    a PERMUTATION of the pool (else a value can never be placed — unreachable) AND,
 *    per the generator/UI contract, its ascending sort (:377 "correctAnswers must be
 *    the sorted version"; no direction is shown, so the student orders ascending).
 *  - count-from (:353-361): sequence = [] or [startNumber]; correct = the typed run
 *    equals correctAnswers, which must continue FROM startNumber in `direction`.
 *
 * THE INDEPENDENCE RULE: the oracle never reads `correctAnswers` as truth. For the
 * null-fill types it INFERS the arithmetic step from the VISIBLE (non-null) terms
 * of `sequence` (a step from two visible terms / span, forced to 1 for before-after
 * adjacency), (a) checks every visible term is self-consistent with that single
 * rule, then (b) recomputes the value the pattern demands at each null index and
 * checks it EQUALS the corresponding correctAnswers entry, and (c) checks
 * correctAnswers.length equals the null count. For order-cards it re-derives the
 * answer by SORTING the pool ascending itself and comparing. For count-from it
 * re-derives the run's structure from `startNumber` + `direction` (the run must be
 * uniform, its sign must match the direction, and its first term must be
 * startNumber + step) — the step MAGNITUDE is intrinsic to the run (nothing else
 * encodes the skip value), so structure + anchor are what we can verify independently.
 * A generator that stored a mislabeled blank value, a non-ascending order key, or a
 * run that doesn't start at startNumber can no longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : each correctAnswers entry equals the pattern value at its
 *    blank (null-fill: recomputed from the visible terms; order-cards: ascending
 *    sort of the pool; count-from: uniform run anchored at startNumber, sign =
 *    direction); the visible terms follow one consistent rule; count matches nulls;
 *    a decade-fill answer must fall in [rangeMin,rangeMax] (else its blank cell is
 *    unreachable); an order-cards key must be a permutation of the pool.
 *  - scope             : every value the student reads OR produces (visible terms +
 *    all correctAnswers) honors the objective ceiling. Ceiling = ctx.scopeMax ??
 *    topic ceiling ?? the gradeBand intrinsic (K→20, 1→100 — the generator's own clamp).
 *  - clustering        : answer sets spread across challenges (no "every card has the
 *    same answers"), and no exact-duplicate card (same type + sequence + answers).
 *  - schema            : sequence non-trivial (≥2 terms and ≥1 blank for null-fill;
 *    ≥2 cards for order-cards; ≥2 continuation values for count-from), integer terms,
 *    non-negative integer answers, ≥3 challenges (mastery-over-demo).
 *
 * Deliberately NOT checked: answer-leak. The manipulative IS the sequence made
 * visible — the surrounding terms are shown by design (they are how the student
 * reasons to the blank), and count-from states startNumber. A leak test would fire
 * on the intended stimulus, worse than an honest gap. Leak/pedagogy stays with /eval-test.
 */

const KNOWN_TYPES = new Set(['fill-missing', 'before-after', 'order-cards', 'count-from', 'decade-fill']);
const NULL_FILL_TYPES = new Set(['fill-missing', 'before-after', 'decade-fill']);
const DIRECTIONS = new Set(['forward', 'backward']);

// Intrinsic value ceiling when neither the harness nor the topic names one — the
// generator's own per-band clamp (gemini-number-sequencer.ts:440).
const INTRINSIC_BY_BAND: Record<string, number> = { K: 20, '1': 100 };
const DEFAULT_INTRINSIC = 100;

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

interface Visible { idx: number; val: number; }

/**
 * Infer the constant arithmetic step from ≥2 visible (index,value) terms, and
 * confirm ALL visible terms are self-consistent with that single rule anchored at
 * the first visible term. Returns null step when it cannot be derived integrally.
 */
function inferRule(visible: Visible[]): { step: number | null; consistent: boolean } {
  if (visible.length < 2) return { step: null, consistent: true };
  const a = visible[0];
  const b = visible[1];
  const span = b.idx - a.idx;
  if (span === 0) return { step: null, consistent: false };
  const raw = (b.val - a.val) / span;
  if (!Number.isInteger(raw)) return { step: null, consistent: false };
  const step = raw;
  const consistent = visible.every((v) => v.val === a.val + step * (v.idx - a.idx));
  return { step, consistent };
}

export const numberSequencerOracle: ContentOracle = {
  componentId: 'number-sequencer',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const gradeBand = String(data.gradeBand ?? '');
    const intrinsic = INTRINSIC_BY_BAND[gradeBand] ?? DEFAULT_INTRINSIC;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? intrinsic;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Per-challenge answer signature for variety + duplicate-card tracking.
    const varietyValues: string[] = [];
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

      const sequence = Array.isArray(c.sequence) ? (c.sequence as unknown[]) : null;
      const answers = Array.isArray(c.correctAnswers) ? (c.correctAnswers as unknown[]) : null;
      if (!sequence || !answers) {
        violations.push({ check: 'schema', where: id, detail: `sequence/correctAnswers not both arrays (sequence=${JSON.stringify(c.sequence)}, correctAnswers=${JSON.stringify(c.correctAnswers)})` });
        continue;
      }
      // Non-null sequence terms and all answers must be integers.
      const badSeq = sequence.some((v) => v !== null && !isInt(v));
      if (badSeq) {
        violations.push({ check: 'schema', where: id, detail: `sequence has a non-integer term: ${JSON.stringify(sequence)}` });
        continue;
      }
      if (answers.length === 0 || answers.some((v) => !isInt(v))) {
        violations.push({ check: 'schema', where: id, detail: `correctAnswers must be a non-empty integer array; got ${JSON.stringify(answers)}` });
        continue;
      }
      const ans = answers as number[];
      if (ans.some((v) => v < 0)) {
        violations.push({ check: 'schema', where: id, detail: `correctAnswers has a negative value ${JSON.stringify(ans)} — invalid for K-1 counting` });
      }

      // ── scope: every visible term + every answer honors the ceiling ──
      const visibleVals = sequence.filter((v): v is number => typeof v === 'number');
      const allVals = [...visibleVals, ...ans];
      const over = allVals.find((v) => v > ceiling);
      if (over !== undefined) {
        violations.push({ check: 'scope', where: id, detail: `value ${over} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")` });
      }

      // ── type-specific answer-key-desync ──
      if (NULL_FILL_TYPES.has(type)) {
        const nullIndices = sequence
          .map((v, idx) => (v === null ? idx : -1))
          .filter((idx) => idx >= 0);

        // schema: non-trivial null-fill sequence — ≥2 terms and ≥1 blank.
        if (sequence.length < 2 || nullIndices.length < 1) {
          violations.push({ check: 'schema', where: id, detail: `${type} needs ≥2 terms with ≥1 blank; got ${JSON.stringify(sequence)}` });
          continue;
        }
        checked++;

        // answer-key-desync: null count must match the key length.
        if (nullIndices.length !== ans.length) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${nullIndices.length} blank(s) in ${JSON.stringify(sequence)} but correctAnswers has ${ans.length} entr(y/ies) — the key mis-aligns with the blanks`,
          });
        }

        const visible: Visible[] = sequence
          .map((v, idx) => ({ idx, val: v }))
          .filter((p): p is Visible => typeof p.val === 'number');

        // before-after is single-visible adjacency: the rule is step 1 by contract.
        // fill-missing / decade-fill infer the step from the visible terms.
        let step: number | null;
        let anchor: Visible | undefined = visible[0];
        if (type === 'before-after') {
          step = 1;
        } else {
          const rule = inferRule(visible);
          if (!rule.consistent) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `visible terms ${JSON.stringify(visibleVals)} do not follow one arithmetic rule — no single pattern defines the blanks`,
            });
          }
          step = rule.step;
        }

        if (step === 0) {
          violations.push({ check: 'schema', where: id, detail: `flat sequence (step 0) in ${JSON.stringify(sequence)} — no progression to learn` });
        }

        // (b) recompute the value the pattern demands at each null, compare to the key.
        if (step !== null && anchor && nullIndices.length === ans.length) {
          for (let k = 0; k < nullIndices.length; k++) {
            const expected = anchor.val + step * (nullIndices[k] - anchor.idx);
            if (expected !== ans[k]) {
              violations.push({
                check: 'answer-key-desync',
                where: id,
                detail: `blank at index ${nullIndices[k]} of ${JSON.stringify(sequence)} needs ${expected} (step ${step}), but correctAnswers[${k}]=${ans[k]} — a correct fill would be marked wrong`,
              });
            }
          }
        } else if (step === null && type !== 'before-after') {
          violations.push({ check: 'schema', where: id, detail: `cannot derive an arithmetic rule from visible terms ${JSON.stringify(visibleVals)} — too few visible terms` });
        }

        // decade-fill: each answer must fall in the rendered grid [rangeMin,rangeMax].
        if (type === 'decade-fill' && isInt(c.rangeMin) && isInt(c.rangeMax)) {
          const lo = c.rangeMin as number;
          const hi = c.rangeMax as number;
          for (const a of ans) {
            if (a < lo || a > hi) {
              violations.push({
                check: 'answer-key-desync',
                where: id,
                detail: `decade-fill answer ${a} is outside the rendered grid [${lo},${hi}] — its blank cell never appears, so the correct state is unreachable`,
              });
            }
          }
        }

        varietyValues.push(ans.join(','));
        bump(cardSeen, `${type}|${sequence.map((v) => (v === null ? '_' : v)).join(',')}|${ans.join(',')}`);
        continue;
      }

      if (type === 'order-cards') {
        const pool = sequence.filter((v): v is number => typeof v === 'number');
        if (sequence.some((v) => v === null)) {
          violations.push({ check: 'schema', where: id, detail: `order-cards sequence must contain no nulls; got ${JSON.stringify(sequence)}` });
        }
        if (pool.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `order-cards needs ≥2 cards; got ${JSON.stringify(sequence)}` });
          continue;
        }
        checked++;

        // answer-key-desync: the key must have one entry per card...
        if (ans.length !== pool.length) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${pool.length} card(s) but correctAnswers has ${ans.length} — the ordered target cannot be assembled from the pool`,
          });
        } else {
          // ...and be a PERMUTATION of the pool sorted ASCENDING (the shown contract).
          const expected = [...pool].sort((x, y) => x - y);
          const poolMulti = [...pool].sort((x, y) => x - y).join(',');
          const ansMulti = [...ans].sort((x, y) => x - y).join(',');
          if (poolMulti !== ansMulti) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `correctAnswers ${JSON.stringify(ans)} is not a permutation of the card pool ${JSON.stringify(pool)} — an answer value can never be placed`,
            });
          } else if (expected.join(',') !== ans.join(',')) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `correctAnswers ${JSON.stringify(ans)} is not the ascending order of ${JSON.stringify(pool)} (expected ${JSON.stringify(expected)}) — a student ordering ascending is marked wrong`,
            });
          }
        }

        varietyValues.push([...ans].sort((x, y) => x - y).join(','));
        bump(cardSeen, `order|${[...pool].sort((x, y) => x - y).join(',')}`);
        continue;
      }

      // count-from
      {
        const start = c.startNumber;
        const direction = String(c.direction ?? 'forward');
        if (!isInt(start)) {
          violations.push({ check: 'schema', where: id, detail: `count-from needs an integer startNumber; got ${JSON.stringify(start)}` });
          continue;
        }
        if (!DIRECTIONS.has(direction)) {
          violations.push({ check: 'schema', where: id, detail: `direction "${direction}" is not forward|backward` });
        }
        if (ans.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `count-from needs ≥2 continuation values; got ${JSON.stringify(ans)}` });
          continue;
        }
        checked++;
        const s = start as number;

        // Independence: derive the run's structure. Step magnitude is intrinsic to
        // the run (nothing else encodes the skip value); its UNIFORMITY, SIGN, and
        // ANCHOR are what we verify against startNumber + direction.
        const step = ans[1] - ans[0];
        const uniform = ans.every((v, k) => k === 0 || v - ans[k - 1] === step);
        if (!uniform) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `count-from run ${JSON.stringify(ans)} is not a constant step — it does not describe one counting rule`,
          });
        } else {
          if (step === 0) {
            violations.push({ check: 'schema', where: id, detail: `count-from run ${JSON.stringify(ans)} has step 0 — no progression` });
          }
          if (direction === 'forward' && step < 0) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `direction "forward" but the run ${JSON.stringify(ans)} decreases (step ${step}) — counting up is marked wrong` });
          }
          if (direction === 'backward' && step > 0) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `direction "backward" but the run ${JSON.stringify(ans)} increases (step ${step}) — counting down is marked wrong` });
          }
          // Anchor: the run must start one step from startNumber.
          if (ans[0] !== s + step) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `count-from starts at ${s} with step ${step}: the next value is ${s + step}, but correctAnswers[0]=${ans[0]} — the run does not continue from startNumber`,
            });
          }
        }

        varietyValues.push(`${s}:${ans.join(',')}`);
        bump(cardSeen, `count|${direction}|${s}|${ans.join(',')}`);
      }
    }

    // ── clustering: answer sets spread, no duplicated card ──
    const variety = checkAnswerVariety(varietyValues, 'challenges[].correctAnswers');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical card "${key}" appears ${count}× — a duplicated challenge` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
