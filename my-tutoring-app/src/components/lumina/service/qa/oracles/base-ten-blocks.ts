import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Base-ten-blocks oracle — a CALCULATION oracle for the place-value block
 * primitive. Its flagship check is answer-key-desync on the two OPERATE modes,
 * where the instruction NAMES the operands the student adds/subtracts and the
 * stored answer can genuinely disagree with them (the vocabulary-explorer class:
 * a correct answer marked wrong).
 *
 * How the COMPONENT judges correctness (BaseTenBlocks.tsx):
 *  - checkAnswer (:403-408): the student TYPES a number; correct =
 *    Math.abs(parseFloat(typedAnswer) - currentChallenge.targetNumber) < 0.01.
 *    So for EVERY challenge type, `targetNumber` IS the answer the student types.
 *  - The place-value blocks the student reads are NOT a stored decomposition —
 *    for read_blocks/regroup the component PRE-PLACES them via
 *    decomposeNumber(targetNumber, activePlaces) (:183-184, :490-491, :96-105),
 *    i.e. the blocks are a pure function of targetNumber. computeTotal of that
 *    decomposition (:130-136) is identically targetNumber, so there is NO stored
 *    hundreds/tens/ones field that could desync from the target — nothing to
 *    cross-check on those modes beyond scope/integrity/clustering.
 *
 * THE INDEPENDENCE RULE — where it bites (operate modes only):
 *  For add_with_blocks / subtract_with_blocks the generator's contract is
 *  targetNumber = the SUM / DIFFERENCE (the answer) and the INSTRUCTION names
 *  the two operands the student works from ("Add 347 + 285 using blocks.",
 *  "Subtract 168 from 500 using blocks.", gemini-base-ten-blocks.ts:67-82,
 *  :853-855). The first operand lives ONLY in the instruction text, so the
 *  oracle re-derives the answer the way the STUDENT does — it parses the two
 *  named operands out of the instruction and computes op1+op2 (add) or
 *  max−min (subtract), then checks that INDEPENDENT result equals the stored
 *  targetNumber (same <0.01 tolerance the component uses). A generator that
 *  ships "Add 465 + 378" with targetNumber 841 (should be 843) can no longer
 *  false-pass: the student who adds correctly, types 843, and is marked wrong is
 *  exactly what this fires on. secondNumber is cross-checked for integrity
 *  (must be one of the named addends / must equal the named subtrahend).
 *
 *  Independence is HONEST-GATED: the strong check runs only when EXACTLY two
 *  numbers parse from the instruction. If the phrasing yields ≠2 numbers the
 *  oracle cannot re-derive the answer from the stimulus, so it falls back to a
 *  reachability guard (the recovered first operand must be a positive number)
 *  and records the challenge under uncheckedTypes rather than inventing a second
 *  derivation that isn't there.
 *
 * Checks:
 *  - answer-key-desync : OPERATE modes — the answer re-derived from the two
 *    instruction operands must equal the stored targetNumber. Also targetNumber
 *    must be a positive number (a non-positive / non-finite answer is an
 *    unreachable correct state — the calculator input forbids negatives).
 *  - scope             : every magnitude the student reads OR produces
 *    (targetNumber, and for operate the named operands / minuend) honors the
 *    objective ceiling. "within 1000" with a 632+843 sum is content past the
 *    objective. Ceiling = ctx.scopeMax ?? topic ceiling ?? gradeBand intrinsic
 *    (K-1→20, 2-3→999, 4-5→9999).
 *  - clustering        : targetNumbers spread (no "every answer is 42"), and no
 *    exact-duplicate card (same type + same target + same secondNumber twice).
 *  - schema            : per-type required fields present and well-formed;
 *    targetNumber a positive integer (decimal allowed only when decimalMode);
 *    operate modes carry a valid secondNumber; ≥3 challenges (mastery-over-demo).
 *
 * Deliberately NOT cross-checkable for DESYNC (documented, not silently skipped):
 *  build_number, read_blocks, regroup ship a BARE targetNumber; the blocks are
 *  code-derived from it (see above), so there is no second representation to
 *  disagree with. Those modes get full scope + schema + clustering coverage but
 *  the desync dimension has nothing to bite on — an honest partial per the skill.
 *
 * Deliberately NOT checked: answer-leak. read_blocks' instruction is a generic
 * "what number do these blocks show?" by contract (the generator strips digit
 * leaks, :732-759) and operate instructions state the operands (the stimulus,
 * not the answer) by design. A leak test would fire on the intended stimulus.
 * Leak/quality stays with /eval-test.
 */

const KNOWN_TYPES = new Set([
  'build_number',
  'read_blocks',
  'regroup',
  'add_with_blocks',
  'subtract_with_blocks',
]);
const OPERATE_TYPES = new Set(['add_with_blocks', 'subtract_with_blocks']);
// Modes that ship a bare targetNumber (decomposition is code-derived → no desync surface).
const BARE_TARGET_TYPES = new Set(['build_number', 'read_blocks', 'regroup']);

// Intrinsic magnitude ceiling per grade band when neither harness nor topic names one
// (matches the generator's bandMax at gemini-base-ten-blocks.ts:788).
const INTRINSIC_BY_BAND: Record<string, number> = { 'K-1': 20, '2-3': 999, '4-5': 9999 };
const DEFAULT_INTRINSIC = 999;

// Component grading tolerance (BaseTenBlocks.tsx:408).
const TOL = 0.01;

/** Pull the numeric operands out of an operate instruction ("Add 347 + 285 …"). */
function parseInstructionNumbers(instruction: string): number[] {
  const matches = instruction.match(/\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number).filter((n) => Number.isFinite(n)) : [];
}

export const baseTenBlocksOracle: ContentOracle = {
  componentId: 'base-ten-blocks',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const decimalMode = data.decimalMode === true;
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

    // A positive number, integer unless decimals are in scope for this session.
    const isValidMagnitude = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 && (decimalMode || Number.isInteger(v));

    const targets: number[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const type = String(c.type ?? '');
      const where = `${type || '?'}-${i}`;

      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      const target = c.targetNumber;
      if (!isValidMagnitude(target)) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `targetNumber ${JSON.stringify(target)} is not a positive ${decimalMode ? 'number' : 'integer'} — the correct answer is unreachable (the calculator forbids negatives)`,
        });
        continue;
      }
      const t = target as number;
      checked++;
      targets.push(t);

      // Magnitudes the student reads or produces (extended below for operate).
      const magnitudes: number[] = [t];

      if (OPERATE_TYPES.has(type)) {
        const isAdd = type === 'add_with_blocks';
        const second = c.secondNumber;
        const instruction = String(c.instruction ?? '');

        // secondNumber integrity (feeds tutor context; contract = addend2 / subtrahend).
        if (!isValidMagnitude(second)) {
          violations.push({
            check: 'schema',
            where,
            detail: `${type} needs a positive secondNumber (the ${isAdd ? 'second addend' : 'subtrahend'}); got ${JSON.stringify(second)}`,
          });
        } else {
          magnitudes.push(second as number);
        }

        // ── Independence: re-derive the answer from the NAMED operands ──
        const nums = parseInstructionNumbers(instruction);
        if (nums.length === 2) {
          const [x, y] = nums;
          magnitudes.push(x, y);
          const minuend = Math.max(x, y);
          const subtrahend = Math.min(x, y);
          const expected = isAdd ? x + y : minuend - subtrahend;
          if (Math.abs(expected - t) >= TOL) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `instruction names operands ${x} and ${y} → ${isAdd ? `${x}+${y}` : `${minuend}−${subtrahend}`} = ${expected}, but targetNumber says ${t} — a correct answer would be marked wrong`,
            });
          }
          // secondNumber must reconcile with the named operands.
          if (isValidMagnitude(second)) {
            const s = second as number;
            const reconciles = isAdd
              ? Math.abs(s - x) < TOL || Math.abs(s - y) < TOL
              : Math.abs(s - subtrahend) < TOL;
            if (!reconciles) {
              violations.push({
                check: 'schema',
                where,
                detail: `secondNumber ${s} is not the ${isAdd ? `named addend (${x} or ${y})` : `named subtrahend (${subtrahend})`} — instruction/secondNumber desync`,
              });
            }
          }
        } else {
          // Can't re-derive from the stimulus → honest gap + reachability fallback.
          uncheckedTypes.add(`${type} (instruction not parseable to 2 operands)`);
          if (isValidMagnitude(second)) {
            const op1 = isAdd ? t - (second as number) : t + (second as number);
            if (!(Number.isFinite(op1) && op1 > 0)) {
              violations.push({
                check: 'answer-key-desync',
                where,
                detail: `recovered first operand ${op1} is not a positive number (target ${t}, secondNumber ${second}) — a degenerate/unreachable operation`,
              });
            }
          }
        }
      } else if (!BARE_TARGET_TYPES.has(type)) {
        // Defensive: a KNOWN but unhandled type (should not happen).
        uncheckedTypes.add(type);
      }

      // ── scope: every magnitude the student engages honors the ceiling ──
      const over = magnitudes.find((m) => m > ceiling);
      if (over !== undefined) {
        violations.push({
          check: 'scope',
          where,
          detail: `magnitude ${over} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      // Duplicate-card identity: same type + same answer + same secondNumber.
      const secondKey = c.secondNumber == null ? '' : String(c.secondNumber);
      cardSeen.set(`${type}:${t}:${secondKey}`, (cardSeen.get(`${type}:${t}:${secondKey}`) ?? 0) + 1);
    }

    // ── clustering: targets spread, no duplicated card ──
    const variety = checkAnswerVariety(targets, 'challenges[].targetNumber');
    if (variety) violations.push(variety);
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
