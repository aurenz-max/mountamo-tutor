import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Comparison-builder oracle — a CALCULATION oracle for the K-1 comparison
 * family. Its flagship check is answer-key-desync on the two RELATIONAL modes,
 * where a stored relation key can genuinely disagree with the quantities it
 * describes (the vocabulary-explorer class: correct click marked wrong).
 *
 * The component (ComparisonBuilder.tsx) judges correctness per type:
 *  - compare-groups   (:457): correct = selectedAnswer === correctAnswer, where
 *    correctAnswer ∈ {more,less,equal} and the feedback (:463-465) confirms the
 *    semantics — "the left group (L) has more/fewer/the same … the right group
 *    (R)". So the relation is LEFT-relative: L>R ⇒ 'more', L<R ⇒ 'less', else 'equal'.
 *  - compare-numbers  (:499): correct = selectedAnswer === correctSymbol, where
 *    correctSymbol ∈ {<,>,=} and feedback (:504) reads "leftNumber SYMBOL rightNumber".
 *    So a<b ⇒ '<', a>b ⇒ '>', else '='.
 *  - order            (:534-540): the component SORTS `numbers` itself
 *    (direction descending ? b-a : a-b) and compares — it ships NO answer key,
 *    so there is nothing to desync. The oracle instead guards the STIMULUS:
 *    ≥2 integer numbers, a valid direction, and no duplicate values (a repeated
 *    value makes the ordered target non-unique — a degenerate ordering task).
 *  - one-more-one-less (:571-583): correct = oneMoreAnswer===target+1 and/or
 *    oneLessAnswer===target-1 per `askFor`. Again no stored key. The oracle's
 *    answer-key-desync analogue is REACHABILITY: if one-less is asked and
 *    target < 1, the correct one-less answer is target-1 < 0 — a value the K-1
 *    counting numberpad cannot produce, so the correct state is unreachable
 *    (the array-grid "unreachable correct state" class).
 *
 * THE INDEPENDENCE RULE: for the two relational modes the oracle derives the
 * relation FROM THE QUANTITIES (leftGroup.count vs rightGroup.count, leftNumber
 * vs rightNumber) — the same source the component's feedback re-narrates — and
 * never trusts the stored `correctAnswer`/`correctSymbol` it is checking. A
 * generator that stores the relation with a shared sign bug can no longer
 * false-pass.
 *
 * Checks:
 *  - answer-key-desync : relational modes — stored relation must match the one
 *    re-derived from the two quantities. one-more-one-less — the asked answer
 *    must be a reachable counting number (one-less of target<1 is unreachable).
 *  - scope             : every quantity the student reads OR produces must honor
 *    the objective ceiling. "Comparing to 10" with an 8-vs-12 pair is content
 *    past the objective; one-more of 10 producing 11 exceeds a "to 10" ceiling.
 *    Ceiling = ctx.scopeMax ?? topic ceiling ?? the gradeBand intrinsic (K→10, 1→20).
 *  - clustering        : within a mode the relations/targets must spread (no
 *    "every pair is 'more'"), and no exact-duplicate card (same ordered pair /
 *    same numbers+direction / same target+askFor twice).
 *  - schema            : per-type required fields present and integer; ≥3
 *    challenges (mastery-over-demo).
 *
 * Deliberately NOT checked: answer-leak. Every prompt states the stimulus by
 * design — compare-groups asks "more, fewer, or the same?" (the answer words
 * ARE the question), compare-numbers and one-more-one-less state the numbers the
 * student reasons over. A leak test would fire on the intended stimulus, worse
 * than an honest gap. Leak/quality stays with /eval-test.
 */

const KNOWN_TYPES = new Set(['compare-groups', 'compare-numbers', 'order', 'one-more-one-less']);
const GROUP_RELATIONS = new Set(['more', 'less', 'equal']);
const NUMBER_SYMBOLS = new Set(['<', '>', '=']);
const ASK_FOR = new Set(['one-more', 'one-less', 'both']);
const DIRECTIONS = new Set(['ascending', 'descending']);

// Intrinsic quantity ceiling when neither the harness nor the topic names one.
const INTRINSIC_BY_BAND: Record<string, number> = { K: 10, '1': 20 };
const DEFAULT_INTRINSIC = 20;

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

export const comparisonBuilderOracle: ContentOracle = {
  componentId: 'comparison-builder',
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

    // Derived-answer buckets for per-mode variety, and duplicate-card tracking.
    const derivedByType: Record<string, Array<string | number>> = {
      'compare-groups': [],
      'compare-numbers': [],
      'one-more-one-less': [],
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

      if (type === 'compare-groups') {
        const L = (c.leftGroup as Record<string, unknown> | undefined)?.count;
        const R = (c.rightGroup as Record<string, unknown> | undefined)?.count;
        if (!isInt(L) || !isInt(R) || (L as number) < 0 || (R as number) < 0) {
          violations.push({ check: 'schema', where: id, detail: `compare-groups needs non-negative integer counts; got left=${JSON.stringify(L)} right=${JSON.stringify(R)}` });
          continue;
        }
        const left = L as number;
        const right = R as number;
        checked++;
        // ── Independence: derive the relation from the two counts ──
        const expected = left > right ? 'more' : left < right ? 'less' : 'equal';
        const key = c.correctAnswer;
        if (!GROUP_RELATIONS.has(String(key))) {
          violations.push({ check: 'schema', where: id, detail: `correctAnswer "${String(key)}" is not one of more|less|equal` });
        } else if (key !== expected) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `left ${left} vs right ${right} is "${expected}", but correctAnswer says "${String(key)}" — a correct click would be marked wrong`,
          });
        }
        if (Math.max(left, right) > ceiling) {
          violations.push({ check: 'scope', where: id, detail: `counts ${left}/${right} exceed objective ceiling ${ceiling} (topic "${ctx.topic}")` });
        }
        derivedByType['compare-groups'].push(expected);
        bump(cardSeen, `g:${left}v${right}`);
        continue;
      }

      if (type === 'compare-numbers') {
        const a = c.leftNumber;
        const b = c.rightNumber;
        if (!isInt(a) || !isInt(b) || (a as number) < 0 || (b as number) < 0) {
          violations.push({ check: 'schema', where: id, detail: `compare-numbers needs non-negative integer leftNumber/rightNumber; got ${JSON.stringify(a)}/${JSON.stringify(b)}` });
          continue;
        }
        const an = a as number;
        const bn = b as number;
        checked++;
        // ── Independence: derive the symbol from the two numbers ──
        const expected = an < bn ? '<' : an > bn ? '>' : '=';
        const key = c.correctSymbol;
        if (!NUMBER_SYMBOLS.has(String(key))) {
          violations.push({ check: 'schema', where: id, detail: `correctSymbol "${String(key)}" is not one of <|>|=` });
        } else if (key !== expected) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${an} vs ${bn} is "${expected}", but correctSymbol says "${String(key)}" — a correct click would be marked wrong`,
          });
        }
        if (Math.max(an, bn) > ceiling) {
          violations.push({ check: 'scope', where: id, detail: `numbers ${an}/${bn} exceed objective ceiling ${ceiling} (topic "${ctx.topic}")` });
        }
        derivedByType['compare-numbers'].push(expected);
        bump(cardSeen, `n:${an}v${bn}`);
        continue;
      }

      if (type === 'order') {
        const nums = c.numbers;
        if (!Array.isArray(nums) || nums.length < 2 || !nums.every(isInt)) {
          violations.push({ check: 'schema', where: id, detail: `order needs ≥2 integer numbers; got ${JSON.stringify(nums)}` });
          continue;
        }
        const arr = nums as number[];
        const direction = String(c.direction ?? 'ascending');
        checked++;
        if (!DIRECTIONS.has(direction)) {
          violations.push({ check: 'schema', where: id, detail: `direction "${direction}" is not ascending|descending` });
        }
        // A repeated value makes the ordered target non-unique — degenerate task.
        if (new Set(arr).size !== arr.length) {
          violations.push({ check: 'schema', where: id, detail: `duplicate values in [${arr.join(', ')}] — the ordered answer is not unique` });
        }
        if (Math.max(...arr) > ceiling) {
          violations.push({ check: 'scope', where: id, detail: `values [${arr.join(', ')}] exceed objective ceiling ${ceiling} (topic "${ctx.topic}")` });
        }
        // Duplicate ORDERING card: same value-set + direction is a byte-identical task.
        bump(cardSeen, `o:${direction}:${[...arr].sort((x, y) => x - y).join(',')}`);
        continue;
      }

      // one-more-one-less
      {
        const T = c.targetNumber;
        const askFor = String(c.askFor ?? 'both');
        if (!isInt(T) || (T as number) < 0) {
          violations.push({ check: 'schema', where: id, detail: `one-more-one-less needs a non-negative integer targetNumber; got ${JSON.stringify(T)}` });
          continue;
        }
        const t = T as number;
        checked++;
        if (!ASK_FOR.has(askFor)) {
          violations.push({ check: 'schema', where: id, detail: `askFor "${askFor}" is not one-more|one-less|both` });
        }
        const asksLess = askFor === 'one-less' || askFor === 'both';
        const asksMore = askFor === 'one-more' || askFor === 'both';
        // ── Reachability (answer-key-desync analogue): one-less of target<1 is
        //    target-1 < 0 — a value the counting numberpad cannot produce. ──
        if (asksLess && t < 1) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `target ${t} with askFor "${askFor}": the correct "one less" is ${t - 1} (< 0), an unreachable answer`,
          });
        }
        // ── scope: the number the student PRODUCES (one more = t+1) must fit. ──
        if (asksMore && t + 1 > ceiling) {
          violations.push({ check: 'scope', where: id, detail: `one-more of ${t} is ${t + 1}, exceeding objective ceiling ${ceiling} (topic "${ctx.topic}")` });
        } else if (t > ceiling) {
          violations.push({ check: 'scope', where: id, detail: `target ${t} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")` });
        }
        derivedByType['one-more-one-less'].push(t);
        bump(cardSeen, `t:${t}:${askFor}`);
      }
    }

    // ── clustering: within each mode the derived answers/targets must spread ──
    for (const [type, values] of Object.entries(derivedByType)) {
      const variety = checkAnswerVariety(values, `${type}[].answer`);
      if (variety) violations.push(variety);
    }
    // ── clustering: no exact-duplicate card ──
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical challenge "${key}" appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
