import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Math-fact-fluency oracle — the first pure-CALCULATION oracle (arithmetic
 * facts with a numeric answer key). Where vocabulary-explorer re-derives a word
 * and ten-frame re-derives a count, this one re-derives the ARITHMETIC:
 * expected = operand1 (+|-) operand2, computed INDEPENDENTLY from the operands,
 * never by trusting the shipped `result`/`correctAnswer` the generator wrote.
 *
 * The component (MathFactFluency.tsx) judges correctness as:
 *  - numeric types (visual-fact / equation-solve / missing-number / speed-round):
 *    `answer === challenge.correctAnswer`, where correctAnswer must match
 *    unknownPosition (result | operand1 | operand2).
 *  - options MCQ: the correct option is the one `=== correctAnswer`.
 *  - match (visual-to-equation): the correct choice is the equationOption whose
 *    parsed RHS `=== correctAnswer` — so TWO options with the same result would
 *    both grade correct (an ambiguous key). That is the CRITICAL contract.
 *
 * Checks:
 *  - answer-key-desync : result must equal op1(+|-)op2; correctAnswer must equal
 *    the unknownPosition-selected value; the equation string must reconstruct;
 *    options must contain correctAnswer exactly once; match options must contain
 *    exactly ONE equation whose result equals correctAnswer, incl. the shipped one.
 *  - scope             : every operand and result within [0, ceiling]; subtraction
 *    never negative; maxNumber must not exceed the objective ceiling.
 *  - clustering        : answers must spread (no "every answer is 5"), and no
 *    exact-duplicate challenge (same fact + type + unknown). The same fact shown
 *    as a different type/unknown is legitimate practice, not flagged.
 *
 * Deliberately NOT checked: answer-leak. In this primitive the operands appear
 * in the instruction by design ("What is 0 + 4?") and can numerically equal the
 * answer, and the `equation` field always contains the solved result. A whole-
 * number leak test would false-positive constantly and route phantom bugs to
 * /eval-fix — worse than an honest gap. Leak/instruction quality stays with
 * /eval-test.
 */

const NUMERIC_TYPES = new Set(['visual-fact', 'equation-solve', 'missing-number', 'speed-round', 'match']);

/** Parse the number after the last "=" in an equation string, mirroring the component. */
function parseEquationResult(eq: string): number | null {
  const rhs = eq.split('=').pop()?.trim() ?? '';
  const n = parseInt(rhs, 10);
  return Number.isNaN(n) ? null : n;
}

export const mathFactFluencyOracle: ContentOracle = {
  componentId: 'math-fact-fluency',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const maxNumber = Number.isInteger(data.maxNumber) ? (data.maxNumber as number) : undefined;
    // Objective ceiling wins when the topic/harness carries one; else fall back to
    // the generator's declared frame, else the primitive's intrinsic max (20).
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? maxNumber ?? 20;

    // The generator claims a frame (maxNumber). If it claims a frame WIDER than the
    // objective, that is itself a scope miss ("facts to 5" → maxNumber 10).
    if (maxNumber !== undefined && maxNumber > ceiling) {
      violations.push({
        check: 'scope',
        where: 'maxNumber',
        detail: `maxNumber ${maxNumber} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
      });
    }

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const answers: number[] = [];
    // Keyed on the full task identity, not the fact alone: the same fact shown as
    // a different challenge type or with a different unknown position is legitimate
    // multi-representation practice ("solve 1+1" vs "find ?+1=2"), NOT a repeat.
    // Only a byte-identical challenge (same fact, type, AND unknown) is a defect.
    const taskSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const type = String(c.type ?? '');
      const id = String(c.id ?? `#${i + 1}`);
      const where = `${id}(${type})`;

      if (!NUMERIC_TYPES.has(type)) {
        uncheckedTypes.add(type);
        continue;
      }

      const op1 = c.operand1;
      const op2 = c.operand2;
      const operation = String(c.operation ?? '');
      if (!Number.isInteger(op1) || !Number.isInteger(op2)) {
        violations.push({ check: 'schema', where, detail: `operands not integers: op1=${JSON.stringify(op1)} op2=${JSON.stringify(op2)}` });
        continue;
      }
      if (operation !== 'addition' && operation !== 'subtraction') {
        violations.push({ check: 'schema', where, detail: `unknown operation "${operation}"` });
        continue;
      }
      checked++;
      const a = op1 as number;
      const b = op2 as number;

      // ── Independence: compute the result ourselves, never trust c.result ──
      const expectedResult = operation === 'addition' ? a + b : a - b;
      if (c.result !== expectedResult) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `shipped result ${JSON.stringify(c.result)} but ${a} ${operation === 'addition' ? '+' : '-'} ${b} = ${expectedResult}`,
        });
      }
      if (operation === 'subtraction' && expectedResult < 0) {
        violations.push({ check: 'scope', where, detail: `subtraction yields negative result ${expectedResult} (${a} - ${b})` });
      }

      // ── correctAnswer must match the unknownPosition-selected value ──
      const unknownPosition = String(c.unknownPosition ?? 'result');
      const expectedAnswer =
        unknownPosition === 'operand1' ? a
        : unknownPosition === 'operand2' ? b
        : expectedResult;
      if (c.correctAnswer !== expectedAnswer) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `correctAnswer ${JSON.stringify(c.correctAnswer)} ≠ ${expectedAnswer} (unknownPosition="${unknownPosition}")`,
        });
      }
      answers.push(expectedAnswer);

      // ── equation string must reconstruct from the operands/result ──
      const sign = operation === 'addition' ? '+' : '-';
      const expectedEq = `${a} ${sign} ${b} = ${expectedResult}`;
      if (String(c.equation ?? '').replace(/\s+/g, ' ').trim() !== expectedEq) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `equation "${String(c.equation)}" does not reconstruct to "${expectedEq}"`,
        });
      }
      // Exact-duplicate challenge (same fact + type + unknown) — the student would
      // see a byte-identical card twice. Different type/unknown is allowed.
      const taskKey = `${type}|${unknownPosition}|${expectedEq}`;
      taskSeen.set(taskKey, (taskSeen.get(taskKey) ?? 0) + 1);

      // ── numeric MCQ options: correctAnswer present exactly once ──
      if (Array.isArray(c.options) && c.options.length > 0) {
        const opts = c.options as unknown[];
        const hits = opts.filter((o) => o === expectedAnswer).length;
        if (hits === 0) {
          violations.push({ check: 'answer-key-desync', where, detail: `correct answer ${expectedAnswer} is not among options [${opts.join(', ')}]` });
        } else if (hits > 1) {
          violations.push({ check: 'answer-key-desync', where, detail: `correct answer ${expectedAnswer} appears ${hits}× in options [${opts.join(', ')}]` });
        }
        const strs = opts.map((o) => String(o));
        if (new Set(strs).size !== strs.length) {
          violations.push({ check: 'schema', where, detail: `duplicate options: [${opts.join(', ')}]` });
        }
      }

      // ── match visual-to-equation: exactly ONE option resolves to correctAnswer ──
      if (type === 'match' && Array.isArray(c.equationOptions) && (c.equationOptions as unknown[]).length > 0) {
        const eqOpts = (c.equationOptions as unknown[]).map((e) => String(e));
        const matches = eqOpts.filter((e) => parseEquationResult(e) === expectedAnswer);
        if (matches.length === 0) {
          violations.push({ check: 'answer-key-desync', where, detail: `no equationOption resolves to the answer ${expectedAnswer}: [${eqOpts.join(' | ')}]` });
        } else if (matches.length > 1) {
          violations.push({
            check: 'answer-key-desync',
            where,
            detail: `${matches.length} equationOptions resolve to ${expectedAnswer} — ambiguous key: [${matches.join(' | ')}]`,
          });
        }
        if (!eqOpts.includes(expectedEq)) {
          violations.push({ check: 'answer-key-desync', where, detail: `shipped equation "${expectedEq}" is not among equationOptions [${eqOpts.join(' | ')}]` });
        }
      }

      // ── scope: operands and result within the objective ceiling ──
      for (const [label, val] of [['operand1', a], ['operand2', b], ['result', expectedResult]] as const) {
        if (val > ceiling || val < 0) {
          violations.push({
            check: 'scope',
            where,
            detail: `${label} ${val} outside [0, ${ceiling}] (topic "${ctx.topic}", maxNumber ${maxNumber ?? 'n/a'})`,
          });
        }
      }
    }

    // ── clustering: answers spread, facts not repeated ──
    const variety = checkAnswerVariety(answers, 'challenges[].correctAnswer');
    if (variety) violations.push(variety);
    taskSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical challenge "${key}" appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
