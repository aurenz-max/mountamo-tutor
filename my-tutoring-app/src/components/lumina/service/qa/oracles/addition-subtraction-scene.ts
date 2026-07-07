import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Addition-subtraction-scene oracle — a CALCULATION oracle for K-1 story
 * problems whose answer shape is `start (+|-) change = result`. Like
 * math-fact-fluency it re-derives the ARITHMETIC independently:
 * expected = startCount (+|-) changeCount, computed FROM THE OPERANDS,
 * never by trusting the shipped `resultCount` / `equation` the generator wrote.
 *
 * The component (AdditionSubtractionScene.tsx) judges correctness per type:
 *  - act-out (handleCheckActOut ~L344-345):
 *      `answer === challenge.resultCount`.
 *  - build-equation (handleCheckEquation ~L392-407): the student assembles
 *      `A op B = C` from tiles; correct iff (1) the arithmetic holds, (2) the
 *      multiset {A,B,C} equals {startCount, changeCount, resultCount}
 *      (order-independent), and (3) the operator matches `operation`. The
 *      canonical solution `start op change = result` exists ONLY when
 *      resultCount === start±change — so an arithmetic desync makes the key
 *      UNSOLVABLE, not just mislabeled. The offered tiles come from
 *      `allowedTiles` (build-equation support tier); if that restricted tray
 *      is missing any of the three numbers the correct equation cannot be built.
 *  - solve-story (handleCheckSolveStory ~L453-456): target = resultCount |
 *      changeCount | startCount, selected by `unknownPosition`.
 *  - create-story (handleCheckCreateStory ~L485): ALWAYS correct (open-ended —
 *      the student picks a scene+object). No answer key to verify; only its
 *      displayed equation must be arithmetically sound + in scope.
 *
 * Checks:
 *  - answer-key-desync : resultCount must equal start(+|-)change; the equation
 *    string must reconstruct from the operands; for solve-story the derived
 *    target must be a real count; build-equation `allowedTiles`, when present,
 *    must contain start, change AND result (else the key is unbuildable — the
 *    option/choice-integrity contract for this primitive).
 *  - scope             : every count and the result within [0, ceiling];
 *    subtraction never negative; maxNumber must not exceed the objective ceiling.
 *  - clustering        : gradable answers must spread (no "every answer is 3"),
 *    and no exact-duplicate challenge (same type + unknown + equation — a
 *    byte-identical card). The same fact shown as a different type / unknown
 *    position is legitimate multi-representation practice, not a repeat.
 *
 * Deliberately NOT checked: answer-leak. Every story states its operands by
 * design ("2 ducks swimming, 1 more joins…") and the numbers can equal the
 * answer; create-story renders the target equation verbatim ("Show 3 + 2 = 5").
 * A whole-number leak test would false-positive on nearly every challenge and
 * route phantom bugs to /eval-fix — worse than an honest gap. Leak/instruction
 * quality stays with /eval-test. Also NOT checked: story↔operation SEMANTIC
 * consistency (e.g. a take-away story mislabeled `part-whole`) — that is a
 * pedagogy read the component never grades on, so it belongs to /eval-test, not
 * a content-contract oracle.
 */

const KNOWN_TYPES = new Set(['act-out', 'build-equation', 'solve-story', 'create-story']);

export const additionSubtractionSceneOracle: ContentOracle = {
  componentId: 'addition-subtraction-scene',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const maxNumber = Number.isInteger(data.maxNumber) ? (data.maxNumber as number) : undefined;
    // Objective ceiling wins when the topic/harness carries one; else fall back to
    // the generator's declared frame (maxNumber), else the primitive's intrinsic
    // Grade-1 max (10). K is 5 but that lives in maxNumber, not guessed here.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? maxNumber ?? 10;

    // A declared frame WIDER than the objective is itself a scope miss
    // ("within 5" → maxNumber 10).
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
    // Keyed on the full task identity: same type + unknown + equation is a
    // byte-identical card; a different type or unknown slot is legit practice.
    const taskSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const type = String(c.type ?? '');
      const id = String(c.id ?? `#${i + 1}`);
      const where = `${id}(${type})`;

      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type);
        continue;
      }

      const start = c.startCount;
      const change = c.changeCount;
      const operation = String(c.operation ?? '');
      if (!Number.isInteger(start) || !Number.isInteger(change) || !Number.isInteger(c.resultCount)) {
        violations.push({
          check: 'schema',
          where,
          detail: `counts not integers: start=${JSON.stringify(start)} change=${JSON.stringify(change)} result=${JSON.stringify(c.resultCount)}`,
        });
        continue;
      }
      if (operation !== 'addition' && operation !== 'subtraction') {
        violations.push({ check: 'schema', where, detail: `unknown operation "${operation}"` });
        continue;
      }
      checked++;
      const a = start as number;
      const b = change as number;
      const result = c.resultCount as number;

      // ── Independence: compute the result ourselves, never trust resultCount ──
      const expectedResult = operation === 'addition' ? a + b : a - b;
      if (result !== expectedResult) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `resultCount ${result} but ${a} ${operation === 'addition' ? '+' : '-'} ${b} = ${expectedResult}`,
        });
      }
      if (operation === 'subtraction' && expectedResult < 0) {
        violations.push({ check: 'scope', where, detail: `subtraction yields negative result ${expectedResult} (${a} - ${b})` });
      }

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

      // ── derived answer (mirrors each handler) + variety pool ──
      const unknownPosition = String(c.unknownPosition ?? 'result');
      if (type !== 'create-story') {
        // solve-story keys on the hidden slot; act-out & build-equation key on the result.
        const answerValue =
          type === 'solve-story'
            ? (unknownPosition === 'start' ? a : unknownPosition === 'change' ? b : expectedResult)
            : expectedResult;
        answers.push(answerValue);
      }

      // ── build-equation option integrity: the restricted tray must be able to
      //    build the correct equation (contain start, change AND result) ──
      if (type === 'build-equation' && Array.isArray(c.allowedTiles) && (c.allowedTiles as unknown[]).length > 0) {
        const tiles = new Set((c.allowedTiles as unknown[]).map((t) => String(t)));
        for (const [label, val] of [['startCount', a], ['changeCount', b], ['resultCount', expectedResult]] as const) {
          if (!tiles.has(String(val))) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `allowedTiles [${Array.from(tiles).join(', ')}] cannot build the answer — missing ${label} ${val}`,
            });
          }
        }
      }

      // ── exact-duplicate challenge (same type + unknown + equation) ──
      const taskKey = `${type}|${unknownPosition}|${expectedEq}`;
      taskSeen.set(taskKey, (taskSeen.get(taskKey) ?? 0) + 1);

      // ── scope: every count and the result within the objective ceiling ──
      for (const [label, val] of [['startCount', a], ['changeCount', b], ['resultCount', expectedResult]] as const) {
        if (val > ceiling || val < 0) {
          violations.push({
            check: 'scope',
            where,
            detail: `${label} ${val} outside [0, ${ceiling}] (topic "${ctx.topic}", maxNumber ${maxNumber ?? 'n/a'})`,
          });
        }
      }
    }

    // ── clustering: gradable answers spread, no duplicated card ──
    const variety = checkAnswerVariety(answers, 'challenges[].answer');
    if (variety) violations.push(variety);
    taskSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical challenge "${key}" appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
