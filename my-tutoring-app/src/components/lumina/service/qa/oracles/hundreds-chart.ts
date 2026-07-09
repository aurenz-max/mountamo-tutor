import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions, parseScopeCeiling } from './helpers';

/**
 * Hundreds-chart oracle — a CALCULATION oracle for the skip-counting-pattern
 * family (highlight_sequence, complete_sequence, identify_pattern,
 * find_skip_value). Its flagship guarantee is answer-key-desync: the cells a
 * student is graded against must form the SKIP-COUNT RUN the challenge claims,
 * and the correct choice must be selectable — a correct click must not be
 * marked wrong (the vocabulary-explorer class).
 *
 * The component (HundredsChart.tsx) judges correctness in handleCheck (:321-339):
 *  - highlight_sequence / complete_sequence (:327-334): needed =
 *    correctCells.filter(c => !givenCells.has(c)); correct = the student's
 *    selected set EQUALS `needed` (set-equality). So `correctCells` (minus the
 *    pre-highlighted `givenCells`) IS the graded answer key, and the grid only
 *    renders numbers 1..gridMax (:236-238), so any correctCell outside that
 *    range can never be clicked — an unreachable correct state.
 *  - identify_pattern (:335-336): correct = selectedOption === correctAnswer,
 *    where correctAnswer is a FREE-TEXT visual-pattern description chosen from
 *    `options` (:554-576). The correctAnswer must therefore be present in
 *    `options` (else it can never be selected) — but WHICH description actually
 *    matches the grid's visual shape is not derivable from the data without
 *    re-implementing the generator's PATTERN_DESCRIPTIONS table (that would port
 *    the generator's own answer computation → false-pass). So the semantic
 *    "does this text match the shape" contract is recorded in uncheckedTypes;
 *    only the reachability (answer ∈ options) + stimulus-run checks run here.
 *  - find_skip_value (:337-338): correct = selectedOption === String(skipValue)
 *    — note the component grades against `skipValue`, NOT the stored
 *    `correctAnswer` field. So the real contract is that String(skipValue) is
 *    present in `options`, and the shown cells must be a genuine step-skipValue
 *    run the student can deduce the interval from.
 *
 * THE INDEPENDENCE RULE: the oracle never reads `correctCells`/`correctAnswer`
 * as its own proof. For every mode it recomputes the ground-truth skip-count run
 * INDEPENDENTLY as the multiples of `skipValue` up to the chart bound
 * (skipValue, 2·skipValue, … ≤ gridMax) — the canonical "count by N" sequence,
 * derived from skipValue + gridMax alone, never from the stored cells or
 * startNumber. It then checks the graded cells agree:
 *  - highlight/complete: the FULL cell set (givenCells ∪ correctCells) must
 *    equal that multiples run — a set with the wrong step, a truncated run, or a
 *    missing/extra member is a desync (a correct fill marked wrong).
 *  - find_skip_value: the shown cells must be a prefix of the multiples run, and
 *    String(skipValue) must appear in options.
 *  - identify_pattern: the shown cells must be the multiples run, and
 *    correctAnswer must appear in options.
 * A generator that stored a mislabeled cell set, the wrong step, or an answer
 * not among the options can no longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : cell modes — (givenCells ∪ correctCells) equals the
 *    independently-recomputed multiples-of-skipValue run within the chart bound;
 *    any cell outside [1,gridMax] is unreachable. MC modes — the graded choice
 *    (String(skipValue) for find_skip_value; correctAnswer for identify_pattern)
 *    is present in `options`, and the shown cells form a real skip run.
 *  - scope             : every cell the student reads OR produces honors the
 *    objective ceiling. Ceiling = ctx.scopeMax ?? topic ceiling ?? gridMax (the
 *    chart's own bound, default 100). "Skip counting to 50" that renders cells to
 *    100 is content past the objective.
 *  - clustering        : the skip values spread across the set (no "every
 *    challenge is skip-by-5" — checkAnswerVariety). Deliberately NOT an
 *    exact-duplicate-card check: in a single-mode session the grade skip pool is
 *    small (grade 2 = {2,5,10}), so the generator's own variety rule
 *    (gemini-hundreds-chart.ts:231, 572) legitimately reuses a (type, skipValue)
 *    card — real generations repeat c1≡c4, c2≡c5 by design. Flagging those would
 *    false-fire on correct content, worse than an honest gap; spread is guarded
 *    by the variety fraction instead.
 *  - schema            : ≥3 challenges (mastery-over-demo); integer skipValue ≥1;
 *    integer cells; cell modes have a non-empty answer set; MC modes have
 *    non-empty, duplicate-free options.
 *
 * uncheckedTypes: identify_pattern — the free-text "this description matches the
 * grid's visual shape" contract is NOT independently derivable (see above);
 * recorded honestly even though its reachability + stimulus-run are checked.
 *
 * Deliberately NOT checked: answer-leak. The manipulative IS the run made
 * visible — highlight/complete state the skip value in the instruction by design
 * (it is how the student counts), and identify_pattern/find_skip_value show the
 * cells as the stimulus the student reasons over. A leak test would fire on the
 * intended stimulus, worse than an honest gap. Leak/pedagogy stays with /eval-test.
 */

const KNOWN_TYPES = new Set([
  'highlight_sequence',
  'complete_sequence',
  'identify_pattern',
  'find_skip_value',
]);
const CELL_TYPES = new Set(['highlight_sequence', 'complete_sequence']);
// identify_pattern's free-text correctAnswer semantic is not independently derivable.
const FREE_TEXT_TYPES = new Set(['identify_pattern']);

const DEFAULT_GRID_MAX = 100;

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

function asIntArray(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  return v.every(isInt) ? (v as number[]) : null;
}

/** The canonical "count by N" run: N, 2N, … ≤ gridMax. Independent ground truth. */
function multiplesRun(skip: number, gridMax: number): number[] {
  const run: number[] = [];
  for (let n = skip; n <= gridMax; n += skip) run.push(n);
  return run;
}

/** Set-equality on two integer arrays (order/duplicate-insensitive). */
function sameSet(a: number[], b: number[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  return Array.from(sa).every((x) => sb.has(x));
}

export const hundredsChartOracle: ContentOracle = {
  componentId: 'hundreds-chart',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const gridMax = isInt(data.gridMax) ? (data.gridMax as number) : DEFAULT_GRID_MAX;
    // Ceiling on the numbers the student reads/produces. Harness scopeMax wins,
    // then a "to N"/"within N" topic, else the chart's own bound (gridMax).
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? gridMax;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Per-challenge skip value drives the clustering spread check.
    const skipValues: number[] = [];
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      const skip = c.skipValue;
      if (!isInt(skip) || (skip as number) < 1) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `skipValue must be an integer ≥1; got ${JSON.stringify(skip)}`,
        });
        continue;
      }
      const sv = skip as number;
      skipValues.push(sv);

      const given = asIntArray(c.givenCells) ?? [];
      const correct = asIntArray(c.correctCells) ?? [];
      // Reject non-integer cell arrays (present but malformed).
      if ((c.givenCells !== undefined && asIntArray(c.givenCells) === null) ||
          (c.correctCells !== undefined && asIntArray(c.correctCells) === null)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `cells must be integer arrays; givenCells=${JSON.stringify(c.givenCells)} correctCells=${JSON.stringify(c.correctCells)}`,
        });
        continue;
      }

      const allCells = [...given, ...correct];

      // ── scope: every rendered/produced cell honors the objective ceiling ──
      const over = allCells.find((v) => v > ceiling);
      if (over !== undefined) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `cell ${over} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }
      // ── answer-key-desync: a cell off the rendered chart is unreachable ──
      const offChart = allCells.find((v) => v < 1 || v > gridMax);
      if (offChart !== undefined) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `cell ${offChart} is outside the rendered chart [1,${gridMax}] — it can never be selected, so the correct state is unreachable`,
        });
      }

      // ── Independence: recompute the canonical count-by-skip run ──
      const expectedRun = multiplesRun(sv, gridMax);

      if (CELL_TYPES.has(type)) {
        if (correct.length === 0) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `${type} has an empty correctCells — nothing for the student to answer`,
          });
          continue;
        }
        // given/correct must be disjoint (the component subtracts given from correct).
        const overlap = correct.find((v) => new Set(given).has(v));
        if (overlap !== undefined) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `cell ${overlap} appears in BOTH givenCells and correctCells — malformed answer set`,
          });
        }
        checked++;
        // The full skip run the student assembles is given ∪ correct; it must
        // equal the independently-derived multiples-of-skipValue run.
        const full = [...given, ...correct];
        if (!sameSet(full, expectedRun)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${type} skipValue ${sv}: (givenCells ∪ correctCells) is ${JSON.stringify([...full].sort((a, b) => a - b))} but the count-by-${sv} run to ${gridMax} is ${JSON.stringify(expectedRun)} — a correct fill would be marked wrong`,
          });
        }
        continue;
      }

      // ── MC modes (identify_pattern, find_skip_value) ──
      const options = Array.isArray(c.options) ? (c.options as unknown[]) : null;
      if (!options || options.length === 0) {
        violations.push({ check: 'schema', where: id, detail: `${type} needs a non-empty options array; got ${JSON.stringify(c.options)}` });
        continue;
      }
      const dupOpts = checkUniqueOptions(options, id);
      if (dupOpts) violations.push(dupOpts);
      const optionStrs = options.map((o) => String(o));
      checked++;

      // Shown stimulus cells: correctCells (== givenCells for these modes).
      const shown = correct.length > 0 ? correct : given;

      if (type === 'find_skip_value') {
        // Real grading contract (:337-338): String(skipValue) must be selectable.
        if (!optionStrs.includes(String(sv))) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the correct skip value ${sv} is not among options ${JSON.stringify(optionStrs)} — the correct answer can never be selected`,
          });
        }
        // The shown cells must be a genuine prefix of the count-by-skip run.
        if (shown.length > 0) {
          const prefix = expectedRun.slice(0, shown.length);
          if (!sameSet(shown, prefix)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `find_skip_value shows cells ${JSON.stringify([...shown].sort((a, b) => a - b))} but a count-by-${sv} run starts ${JSON.stringify(prefix)} — the interval cannot be deduced from these cells`,
            });
          }
        }
      } else {
        // identify_pattern: correctAnswer must be present in options (:335-336).
        const correctAnswer = c.correctAnswer;
        if (typeof correctAnswer !== 'string' || correctAnswer.length === 0) {
          violations.push({ check: 'schema', where: id, detail: `identify_pattern needs a non-empty string correctAnswer; got ${JSON.stringify(correctAnswer)}` });
        } else if (!optionStrs.includes(correctAnswer)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `correctAnswer "${correctAnswer}" is not among options ${JSON.stringify(optionStrs)} — the correct answer can never be selected`,
          });
        }
        // The shown stimulus must be the real count-by-skip run.
        if (shown.length > 0 && !sameSet(shown, expectedRun)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `identify_pattern shows cells that are not the count-by-${sv} run to ${gridMax} (${JSON.stringify(expectedRun)}) — the described pattern would not match the grid`,
          });
        }
        // Honest gap: whether the free-text description matches the visual shape
        // is not independently derivable (would require the generator's table).
        if (FREE_TEXT_TYPES.has(type)) uncheckedTypes.add(type);
      }
    }

    // ── clustering: skip values must spread (no "every challenge is skip-by-5") ──
    const variety = checkAnswerVariety(skipValues, 'challenges[].skipValue');
    if (variety) violations.push(variety);

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
