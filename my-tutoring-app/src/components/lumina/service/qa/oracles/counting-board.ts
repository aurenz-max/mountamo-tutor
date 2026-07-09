import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Counting-board oracle — a CALCULATION oracle for the K-1 counting family. Its
 * flagship check is answer-key-desync: the board renders a fixed number of
 * tappable objects and the stored `targetAnswer` must equal the count the
 * student actually reaches. A board that shows N objects while the key says M
 * marks a correct counter wrong (the vocabulary-explorer class).
 *
 * How the COMPONENT judges correctness (CountingBoard.tsx). Every mode grades
 * the student's produced number against `targetAnswer`:
 *  - count_all / group_count / compare — checkCountChallenge (:515-519):
 *    correct = countedObjects.size === targetAnswer. The student taps the objects
 *    the board lays out; the board renders exactly `challenge.count` objects
 *    (positions = generatePositions(challengeCount = challenge.count, …), :362,
 *    :382-385). So the counted total the student can reach IS `count`.
 *  - subitize — checkSubitizeAnswer (:547-551): correct = typedNumber === targetAnswer.
 *  - subitize_perceptual — checkSubitizePerceptualAnswer (:578-581): correct =
 *    picked === targetAnswer, where `picked` is a FINGER count from three hand
 *    images fixed to {1,2,3} (handOptions base = [1,2,3], :391-408; HandIcon
 *    fingerCount 1|2|3, :1112). A targetAnswer > 3 (or count > 3) is therefore an
 *    UNREACHABLE correct state — no hand can be the right one (the array-grid
 *    "correct answer isn't among the options" class).
 *  - count_on — checkCountOnAnswer (:609-613): correct = typedNumber === targetAnswer.
 *    The board pre-counts `startFrom` objects (:817-826) and the student counts on
 *    to the TOTAL, which is again `count`.
 *
 * THE INDEPENDENCE RULE — the displayed count is re-derived, never the key trusted:
 *  For all modes EXCEPT compare the oracle computes the number of objects the
 *  board shows (`challenge.count`) and checks it equals the stored `targetAnswer`.
 *  This is a different source than the generator's own `targetAnswer = count`
 *  assignment (gemini-counting-board.ts:572-575): a generation that ships count 8
 *  with targetAnswer 7 can no longer false-pass — the student who taps all 8 and
 *  is marked wrong is exactly what fires. For count_on the total the student
 *  produces is still `count` (startFrom is only the pre-counted head), so the
 *  same targetAnswer===count identity holds; startFrom is separately range-checked.
 *
 *  compare is the ONE mode where targetAnswer ≠ count by contract: the answer is
 *  the LARGER group's size, stored as `groupSize`, while `count` is BOTH groups'
 *  total (gemini-counting-board.ts:534-543). There the oracle re-derives the
 *  answer as `groupSize` and checks (a) targetAnswer === groupSize and (b)
 *  groupSize is genuinely the larger group — the smaller group (count − groupSize)
 *  is ≥ 1 and strictly smaller — so "which has more" has a real, unique answer.
 *
 * Checks:
 *  - answer-key-desync : the re-derived displayed count (compare → groupSize;
 *    every other mode → count) must equal the stored targetAnswer. Plus
 *    reachability: subitize_perceptual's answer must be ≤ 3 (only 1/2/3-finger
 *    hands exist), else the correct state is unreachable.
 *  - scope             : every magnitude the student sees or produces (the
 *    displayed count AND targetAnswer) honors the objective ceiling. "Counting to
 *    10" rendering a 12-object board is content past the objective. Ceiling =
 *    ctx.scopeMax ?? topic ceiling ?? gradeBand intrinsic (K→20, 1→30 — the
 *    generator's own clamps, gemini-counting-board.ts:549-554).
 *  - clustering        : targetAnswers spread (no "every board is 5"), and no
 *    exact-duplicate board card (same type + count + arrangement + groupSize +
 *    startFrom renders an identical board).
 *  - schema            : per-type required fields present and integer; count/
 *    targetAnswer non-negative integers; compare needs a valid groupSize; count_on
 *    with an explicit startFrom needs 1 ≤ startFrom < count (else the count-on has
 *    nothing to count on from / to); ≥3 challenges (mastery-over-demo).
 *
 * Deliberately NOT checked: answer-leak. The manipulative IS the answer made
 * visible — the board renders exactly `count` objects for the student to count,
 * by design — and the generator strips numerals from every subitize_perceptual
 * string (gemini-counting-board.ts:565-569). A leak test would fire on the
 * intended stimulus, worse than an honest gap. Arrangement/position QUALITY
 * (overlap, legibility) is not a content contract and stays with /eval-test.
 */

const KNOWN_TYPES = new Set([
  'count_all',
  'subitize',
  'subitize_perceptual',
  'count_on',
  'group_count',
  'compare',
]);

// Fixed finger-count hand options in subitize_perceptual (CountingBoard.tsx:391, :1112).
const PERCEPTUAL_MAX = 3;

// Intrinsic count ceiling per grade band when neither harness nor topic names one
// (matches the generator's clamps, gemini-counting-board.ts:549-554).
const INTRINSIC_BY_BAND: Record<string, number> = { K: 20, '1': 30 };
const DEFAULT_INTRINSIC = 30;

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

export const countingBoardOracle: ContentOracle = {
  componentId: 'counting-board',
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

    const targetAnswers: number[] = [];
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

      const count = c.count;
      const target = c.targetAnswer;

      // count and targetAnswer are the two numbers everything else keys off — they
      // must be non-negative integers or the challenge has no coherent answer.
      if (!isInt(count) || (count as number) < 0) {
        violations.push({ check: 'schema', where: id, detail: `count ${JSON.stringify(count)} is not a non-negative integer` });
        continue;
      }
      if (!isInt(target) || (target as number) < 0) {
        violations.push({ check: 'schema', where: id, detail: `targetAnswer ${JSON.stringify(target)} is not a non-negative integer` });
        continue;
      }
      const cnt = count as number;
      const tgt = target as number;
      checked++;
      targetAnswers.push(tgt);

      // Magnitudes the student engages: the board shows `count` objects, the answer is `tgt`.
      const magnitudes: number[] = [cnt, tgt];

      if (type === 'compare') {
        // ── Independence: the answer is the LARGER group's size (groupSize), NOT count ──
        const gs = c.groupSize;
        if (!isInt(gs) || (gs as number) < 1) {
          violations.push({ check: 'schema', where: id, detail: `compare needs a positive integer groupSize (the larger group); got ${JSON.stringify(gs)}` });
        } else {
          const larger = gs as number;
          const smaller = cnt - larger;
          if (smaller < 1 || larger <= smaller) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `compare: groupSize ${larger} is not strictly the larger of two groups in a board of ${cnt} (smaller group = ${smaller}) — "which has more" has no unique answer`,
            });
          } else if (tgt !== larger) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `compare: the larger group is ${larger} (groupSize), but targetAnswer says ${tgt} — a correct answer would be marked wrong`,
            });
          }
        }
      } else {
        // ── Independence: for every non-compare mode the displayed/counted total is `count` ──
        if (tgt !== cnt) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${type}: board shows ${cnt} objects but targetAnswer says ${tgt} — a correct count would be marked wrong`,
          });
        }

        // Reachability: only 1/2/3-finger hands exist, so a perceptual answer > 3
        // (or a board of >3) leaves the correct hand unpickable.
        if (type === 'subitize_perceptual') {
          if (cnt < 1 || cnt > PERCEPTUAL_MAX) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `subitize_perceptual shows ${cnt} objects, but only 1/2/3-finger hands exist — the correct answer is unreachable`,
            });
          }
        }

        // count_on: an explicit startFrom must leave something pre-counted AND
        // something to count on to (1 ≤ startFrom < count); null/absent lets the
        // component default it (:817), so only a provided value is checked.
        if (type === 'count_on' && c.startFrom != null) {
          const sf = c.startFrom;
          if (!isInt(sf) || (sf as number) < 1 || (sf as number) >= cnt) {
            violations.push({
              check: 'schema',
              where: id,
              detail: `count_on startFrom ${JSON.stringify(sf)} must be an integer with 1 ≤ startFrom < count (${cnt}) — nothing to count on ${(isInt(sf) && (sf as number) >= cnt) ? 'to' : 'from'} otherwise`,
            });
          }
        }
      }

      // ── scope: every engaged magnitude honors the objective ceiling ──
      const over = magnitudes.find((m) => m > ceiling);
      if (over !== undefined) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `magnitude ${over} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      // Duplicate-card identity: same type + count + arrangement + groupSize + startFrom
      // renders a byte-identical board.
      const cardKey = `${type}:${cnt}:${String(c.arrangement ?? '')}:${c.groupSize ?? ''}:${c.startFrom ?? ''}`;
      cardSeen.set(cardKey, (cardSeen.get(cardKey) ?? 0) + 1);
    }

    // ── clustering: targetAnswers spread, no duplicated board card ──
    const variety = checkAnswerVariety(targetAnswers, 'challenges[].targetAnswer');
    if (variety) violations.push(variety);
    cardSeen.forEach((countN, key) => {
      if (countN > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical board "${key}" appears ${countN}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
