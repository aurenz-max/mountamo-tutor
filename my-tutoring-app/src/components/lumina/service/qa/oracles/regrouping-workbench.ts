import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Regrouping-workbench oracle — a CALCULATION oracle for the base-ten
 * addition/subtraction-with-regrouping contract. Its flagship guarantee is that
 * the VISIBLE problem string, the SESSION operation the component actually
 * grades on, and the REGROUP label all agree — three fields the generator emits
 * separately, so any pair can genuinely disagree (correct student marked wrong,
 * or a "regrouping" challenge that needs no regroup).
 *
 * The component (RegroupingWorkbench.tsx) judges correctness as:
 *  - operand1/operand2 are parsed FROM the `problem` string, not stored per
 *    challenge (:232-233): `problem.split(/[+\-−]/)` → [op1, op2]; on a parse
 *    miss it silently falls back to the SESSION operand1/operand2, collapsing
 *    every unparseable challenge onto one problem.
 *  - correctAnswer = computeAnswer(operation, operand1, operand2) (:234, :132-134)
 *    = a + b for addition, a - b for subtraction — using the SESSION `operation`,
 *    NOT the operator inside the problem string.
 *  - handleCheckAnswer (:495-545): correct = studentAnswer === correctAnswer,
 *    where studentAnswer is assembled from single-digit inputs (:500-502) — a
 *    numeric digit pad that cannot express a negative value.
 *  - regroupCount / requiresRegrouping drive the phase bucket
 *    (usePhaseResults getChallengeType, :224) and the regrouping metric
 *    (regroupingCorrect = min(regroupedPlaces.size, expectedRegroups), :508-509),
 *    and the success feedback prints `${problem} = ${correctAnswer}` (:514) — so a
 *    problem string whose operator contradicts `operation` renders a false equation.
 *
 * THE INDEPENDENCE RULE: the oracle never trusts the generator's own numbers.
 * It parses the two operands AND the operator out of the `problem` string, and
 * independently:
 *   (a) recomputes a±b for scope/clustering the way the component grades it
 *       (via the SESSION `operation`);
 *   (b) checks the operator written in the string AGREES with `operation` — a
 *       genuine desync surface, since the component ignores the string's operator
 *       but the feedback equation and the tutor read the string verbatim;
 *   (c) re-derives the regroup (carry/borrow) COUNT by simulating column
 *       arithmetic digit-by-digit, and checks the shipped `requiresRegrouping`
 *       flag and `regroupCount` match that ground truth, and that the eval mode's
 *       structural tier is honored (a *_no_regroup mode must contain no carry/borrow).
 * A generator that stored a mislabeled regroup flag or an operator that disagrees
 * with the graded operation can no longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : the string operator must match `operation`; a
 *    subtraction whose a-b < 0 is unreachable on the digit pad; and the regroup
 *    label (requiresRegrouping / regroupCount) must match the re-simulated column
 *    arithmetic, and the mode's no-regroup tier must carry no regroup event.
 *  - scope             : every operand AND the computed result honor the objective
 *    ceiling. "Addition with regrouping to 100" producing 67+85=152 is content past
 *    the objective. Ceiling = ctx.scopeMax ?? topic ceiling ?? 2×the maxPlace max
 *    (a non-false-firing intrinsic floor — the real lever is topic/scopeMax).
 *  - clustering        : computed results must spread (no "every answer is 62"),
 *    and no exact-duplicate problem (same normalized "a op b" twice is a dup card).
 *  - schema            : per-challenge required fields present/well-formed
 *    (problem parses to two integer operands, requiresRegrouping boolean,
 *    regroupCount non-negative integer); ≥3 challenges (mastery-over-demo).
 *
 * Deliberately NOT checked: answer-leak. The written-algorithm panel and the
 * problem display state the operands by design (they ARE the manipulative), and
 * the numeric result never appears as a text field the student reads before
 * answering (answer digits render only AFTER a correct submit, :865-866). A leak
 * test would fire on the intended stimulus — worse than an honest gap. Leak and
 * pedagogy quality stay with /eval-test.
 */

const OPERATIONS = new Set(['addition', 'subtraction']);
// Largest whole number representable at each maxPlace.
const PLACE_MAX: Record<string, number> = { tens: 99, hundreds: 999, thousands: 9999 };
const DEFAULT_PLACE_MAX = 99;

// Eval modes whose structural tier FORBIDS any carry/borrow.
const NO_REGROUP_MODES = new Set(['add_no_regroup', 'subtract_no_regroup']);

/** Digits of n (ones first), padded to `len` places. */
function digitsOf(n: number, len: number): number[] {
  const out: number[] = [];
  let x = Math.abs(Math.floor(n));
  for (let i = 0; i < len; i++) {
    out.push(x % 10);
    x = Math.floor(x / 10);
  }
  return out;
}

/**
 * Independent column-arithmetic simulation → number of regroup (carry/borrow)
 * events. This is derived from the operands, NOT read from any generator field.
 */
function computeRegroupEvents(op: 'addition' | 'subtraction', a: number, b: number): number {
  const len = Math.max(String(Math.abs(a)).length, String(Math.abs(b)).length);
  const da = digitsOf(a, len);
  const db = digitsOf(b, len);
  let count = 0;
  if (op === 'addition') {
    let carry = 0;
    for (let i = 0; i < len; i++) {
      const s = da[i] + db[i] + carry;
      if (s >= 10) { count++; carry = 1; } else { carry = 0; }
    }
  } else {
    let borrow = 0;
    for (let i = 0; i < len; i++) {
      const top = da[i] - borrow;
      if (top < db[i]) { count++; borrow = 1; } else { borrow = 0; }
    }
  }
  return count;
}

export const regroupingWorkbenchOracle: ContentOracle = {
  componentId: 'regrouping-workbench',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const operation = String(data.operation ?? '');
    if (!OPERATIONS.has(operation)) {
      // Every per-challenge check pivots on the graded operation; without it the
      // oracle can only honestly record the gap.
      uncheckedTypes.add(`operation=${operation || '(missing)'}`);
      return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: 0 };
    }
    const op = operation as 'addition' | 'subtraction';

    const maxPlace = String(data.maxPlace ?? 'tens');
    const placeMax = PLACE_MAX[maxPlace] ?? DEFAULT_PLACE_MAX;
    // Intrinsic ceiling that never false-fires on legit place-scoped arithmetic
    // (a two-operand sum can reach 2×placeMax). The real bite comes from topic/scopeMax.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? placeMax * 2;

    const modeForbidsRegroup = NO_REGROUP_MODES.has(ctx.evalMode);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const results: number[] = [];
    const problemSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const problem = c.problem;

      // ── schema: problem must parse to "a <op> b" with two integer operands ──
      const m = typeof problem === 'string'
        ? problem.match(/^\s*(\d+)\s*([+\-−])\s*(\d+)\s*$/)
        : null;
      if (!m) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `problem ${JSON.stringify(problem)} does not parse as "a + b" / "a - b" — the component would fall back to the session operands, collapsing this card`,
        });
        continue;
      }
      const a = parseInt(m[1], 10);
      const b = parseInt(m[3], 10);
      const stringOp = m[2] === '+' ? 'addition' : 'subtraction';
      checked++;

      // ── answer-key-desync: the written operator must match the graded operation ──
      if (stringOp !== op) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `problem "${problem}" is written as ${stringOp} but the session operation is ${op} — the component grades a${op === 'addition' ? '+' : '-'}b while the feedback prints the contradictory equation`,
        });
      }

      // ── Independence: recompute the graded answer (session operation) ──
      const answer = op === 'addition' ? a + b : a - b;
      results.push(answer);

      // ── answer-key-desync: subtraction below zero is unreachable on the digit pad ──
      if (op === 'subtraction' && answer < 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `${a} - ${b} = ${answer} (< 0) — a negative answer the single-digit pad cannot produce, so the correct state is unreachable`,
        });
      }

      // ── answer-key-desync: regroup label must match re-simulated column arithmetic ──
      const events = computeRegroupEvents(op, a, b);
      const requiresRegrouping = c.requiresRegrouping;
      if (typeof requiresRegrouping !== 'boolean') {
        violations.push({ check: 'schema', where: id, detail: `requiresRegrouping is ${JSON.stringify(requiresRegrouping)}, not a boolean` });
      } else if (requiresRegrouping !== events > 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `requiresRegrouping=${requiresRegrouping} but column arithmetic of "${problem}" has ${events} regroup event(s) — the challenge is mislabeled (wrong phase bucket + regrouping metric)`,
        });
      }

      const regroupCount = c.regroupCount;
      if (regroupCount !== undefined) {
        if (!Number.isInteger(regroupCount) || (regroupCount as number) < 0) {
          violations.push({ check: 'schema', where: id, detail: `regroupCount is ${JSON.stringify(regroupCount)}, not a non-negative integer` });
        } else if ((regroupCount as number) !== events) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `regroupCount=${regroupCount} but "${problem}" actually needs ${events} regroup event(s) — the shipped count disagrees with the arithmetic`,
          });
        }
      }

      // ── answer-key-desync: a *_no_regroup mode must carry no carry/borrow ──
      if (modeForbidsRegroup && events > 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `mode "${ctx.evalMode}" forbids regrouping, but "${problem}" needs ${events} regroup event(s) — content exceeds the mode's structural tier`,
        });
      }

      // ── scope: operands AND result honor the objective ceiling ──
      if (a > ceiling || b > ceiling || Math.abs(answer) > ceiling) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `"${problem}" = ${answer} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      // Normalized problem key: same operands+operator twice is a byte-identical card.
      const key = `${a}${op === 'addition' ? '+' : '-'}${b}`;
      problemSeen.set(key, (problemSeen.get(key) ?? 0) + 1);
    }

    // ── clustering: results spread, no duplicated problem card ──
    const variety = checkAnswerVariety(results, 'challenges[].result');
    if (variety) violations.push(variety);
    problemSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical problem "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
