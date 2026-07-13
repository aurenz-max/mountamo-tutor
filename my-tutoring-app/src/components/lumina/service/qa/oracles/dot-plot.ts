import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety } from './helpers';

/**
 * Dot-plot oracle — verifies the pre-built dot-plot challenge(s) against the
 * primitive's answer contract.
 *
 * IMPORTANT — the component does NOT hard-grade a typed answer: the "check" is a
 * self-report button that always records correct: true (DotPlot.tsx :432-436).
 * The shipped keys (targetAnswer for compute_stats / read_frequency,
 * comparisonAnswer for compare_datasets) instead drive (a) the live tutor's
 * reference answer (aiPrimitiveData.correctAnswer :264) and (b) the on-screen
 * stats panel (calculateStats). So a WRONG key means the tutor coaches toward a
 * wrong value and the stats panel contradicts the task — a real content-contract
 * break even though no student click is marked wrong. This oracle checks that
 * contract; it is the shipped answer-key's independent audit.
 *
 * THE INDEPENDENCE RULE: the keys are pre-computed by the generator's own
 * computeMedian / computeMode / computeNumericRange from dataPoints. This oracle
 * RE-DERIVES each statistic from the same dataPoints with its OWN arithmetic —
 * median from the sorted middle, mode/frequency from a fresh frequency map,
 * range from max − min — and requires the shipped key to agree. It also treats
 * a TIE as the ambiguity it is: computeMode returns the FIRST max-frequency value
 * (:189-202), so a multi-modal dataset yields a single "mode" that a student
 * could reasonably answer differently — flagged, mirroring the histogram
 * modal-bin tie. A generator whose stored answer and the actual dataset drift
 * (a stale median, a mode from a different set, a range off by the excluded max)
 * is the wrong-key class this oracle catches.
 *
 * Because a dot-plot session ships ONE challenge over a shared top-level dataset
 * (the generators return challenges:[single]), there is NO mastery-over-demo
 * (≥3) check here — a count of 1 is the intended shape (knowledge-check precedent).
 *
 * Checks:
 *  - answer-key-desync :
 *      compute_stats  — targetAnswer ≠ the re-derived median/mode/range; a
 *                       multi-modal dataset makes a single mode ambiguous.
 *      read_frequency — targetAnswer is not a frequency EXTREME of the data (not
 *                       the most- nor least-frequent value); the intended extreme
 *                       is tied (ambiguous "most/least frequent").
 *  - scope             : (1) when ctx.evalMode names a dot-plot mode, every
 *      challenge's evalMode must match it (task identity); (2) every dataPoint
 *      lies within the plotted range [min, max] (an off-axis point is unplottable).
 *  - answer-leak       : compute_stats / read_frequency — the instruction / hint /
 *      narration must not state the numeric answer value.
 *  - clustering        : (only when a session carries ≥3 challenges) the answer
 *      must spread (checkAnswerVariety); no byte-identical card (same evalMode +
 *      targetStat + dataset).
 *  - schema            : top-level dataPoints is a non-empty number[]; a finite
 *      range [min < max]; each challenge has a known evalMode and its mode's
 *      required key fields (compute_stats: targetStat ∈ {median, mode, range} with
 *      finite targetAnswer; read_frequency: finite targetAnswer; compare_datasets:
 *      non-empty comparisonAnswer + a secondaryDataPoints dataset).
 *
 * Deliberately NOT checked:
 *  - compare_datasets' comparisonAnswer SEMANTICS: it is a free-text natural-
 *    language comparison ("Team A has a higher median") with no fixed grammar to
 *    value-match — only its presence and the second dataset are checked
 *    (/eval-test owns the phrasing quality).
 *  - the plotting modes (whole_number_plot / measure_and_plot / fractional_units):
 *    the task is BUILDING the plot from the given/measured dataPoints — there is
 *    no derived answer key beyond the dataset itself (checked for in-range only).
 *  - support-tier flags (showStackCounts / showFrequencyTooltip): display-only;
 *    the component never grades on them.
 */

const EPS = 1e-9;

const KNOWN_MODES = new Set([
  'whole_number_plot', 'measure_and_plot', 'read_frequency',
  'fractional_units', 'compute_stats', 'compare_datasets',
]);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPS;

function asNumberArray(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: number[] = [];
  for (const x of v) { if (!isNum(x)) return null; out.push(x); }
  return out;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function freqMap(nums: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const n of nums) m.set(n, (m.get(n) ?? 0) + 1);
  return m;
}

function numbersIn(text: string): number[] {
  return text.split(/[^0-9.]+/).map((t) => parseFloat(t)).filter((n) => Number.isFinite(n));
}

export const dotPlotOracle: ContentOracle = {
  componentId: 'dot-plot',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();

    const dataPoints = asNumberArray(data.dataPoints);
    const range = data.range;
    const validRange = Array.isArray(range) && range.length === 2 && isNum(range[0]) && isNum(range[1]) && range[0] < range[1];
    if (!dataPoints) {
      violations.push({ check: 'schema', where: 'dataPoints', detail: `top-level dataPoints is missing or not a non-empty number[] (got ${JSON.stringify(data.dataPoints)})` });
    }
    if (!validRange) {
      violations.push({ check: 'schema', where: 'range', detail: `malformed range: ${JSON.stringify(range)}` });
    }
    // ── scope (2): every plotted point must sit on the axis ──
    if (dataPoints && validRange) {
      const [lo, hi] = range as [number, number];
      const off = dataPoints.filter((v) => v < lo || v > hi);
      if (off.length > 0) {
        violations.push({ check: 'scope', where: 'dataPoints', detail: `${off.length} data point(s) [${off.slice(0, 5).join(', ')}] fall outside the plotted range [${lo}, ${hi}] — unplottable` });
      }
    }

    const challenges = asRecordArray(data.challenges);
    const requestedMode = KNOWN_MODES.has(ctx.evalMode) ? ctx.evalMode : null;
    const answerValues: string[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    // Frequency facts about the shared dataset (used by compute_stats/read_frequency).
    const fm = dataPoints ? freqMap(dataPoints) : new Map<number, number>();
    const freqs = Array.from(fm.values());
    const maxFreq = freqs.length ? Math.max(...freqs) : 0;
    const minFreq = freqs.length ? Math.min(...freqs) : 0;
    const modeValues = Array.from(fm.entries()).filter(([, f]) => f === maxFreq).map(([v]) => v);
    const leastValues = Array.from(fm.entries()).filter(([, f]) => f === minFreq).map(([v]) => v);

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const mode = String(c.evalMode ?? '');
      if (!KNOWN_MODES.has(mode)) {
        uncheckedTypes.add(mode || '(missing evalMode)');
        continue;
      }

      // ── scope (1): the session must deliver the requested eval mode ──
      if (requestedMode && mode !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challenge evalMode "${mode}" but the objective asked for "${requestedMode}" — a different task identity`,
        });
      }

      const instruction = typeof c.instruction === 'string' ? c.instruction : '';
      const leakText = `${instruction} ${String(c.hint ?? '')} ${String(c.narration ?? '')}`;

      if (mode === 'compute_stats') {
        const stat = String(c.targetStat ?? '');
        const targetAnswer = c.targetAnswer;
        if ((stat !== 'median' && stat !== 'mode' && stat !== 'range') || !isNum(targetAnswer) || !dataPoints) {
          violations.push({ check: 'schema', where: id, detail: `compute_stats malformed: targetStat=${JSON.stringify(c.targetStat)} targetAnswer=${String(c.targetAnswer)}` });
          continue;
        }
        checked++;
        let derived: number;
        if (stat === 'median') derived = median(dataPoints);
        else if (stat === 'range') derived = Math.max(...dataPoints) - Math.min(...dataPoints);
        else {
          // mode — flag a tie as ambiguous (the shipped answer is one of several)
          if (modeValues.length > 1) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `the dataset is multi-modal (values [${modeValues.join(', ')}] all occur ${maxFreq}×) — a single "mode" answer is ambiguous` });
          }
          derived = modeValues[0];
        }
        if (!near(derived, targetAnswer)) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `targetAnswer=${targetAnswer} but the ${stat} of the data is ${derived} — the tutor/stats reference contradicts the dataset` });
        }
        if (numbersIn(leakText).some((n) => near(n, targetAnswer))) {
          violations.push({ check: 'answer-leak', where: id, detail: `instruction/hint/narration states the ${stat} answer ${targetAnswer}` });
        }
        answerValues.push(`${stat}:${targetAnswer}`);
        cardSeen.set(`${mode}#${stat}#${dataPoints.join(',')}`, (cardSeen.get(`${mode}#${stat}#${dataPoints.join(',')}`) ?? 0) + 1);
      } else if (mode === 'read_frequency') {
        const targetAnswer = c.targetAnswer;
        if (!isNum(targetAnswer) || !dataPoints) {
          violations.push({ check: 'schema', where: id, detail: `read_frequency missing targetAnswer (got ${String(c.targetAnswer)})` });
          continue;
        }
        checked++;
        const ansFreq = fm.get(targetAnswer) ?? 0;
        const wantsLeast = /\b(least|fewest|smallest|lowest)\b/i.test(leakText);
        const wantsMost = /\b(most|greatest|highest|frequent|tallest)\b/i.test(leakText) && !wantsLeast;
        if (ansFreq === 0) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `targetAnswer=${targetAnswer} does not appear in the data — it cannot be the most/least frequent value` });
        } else if (wantsMost) {
          if (ansFreq !== maxFreq) violations.push({ check: 'answer-key-desync', where: id, detail: `targetAnswer=${targetAnswer} (freq ${ansFreq}) is not the most frequent (max freq ${maxFreq}, at [${modeValues.join(', ')}])` });
          else if (modeValues.length > 1) violations.push({ check: 'answer-key-desync', where: id, detail: `${modeValues.length} values [${modeValues.join(', ')}] tie for most frequent — the answer is ambiguous` });
        } else if (wantsLeast) {
          if (ansFreq !== minFreq) violations.push({ check: 'answer-key-desync', where: id, detail: `targetAnswer=${targetAnswer} (freq ${ansFreq}) is not the least frequent (min freq ${minFreq}, at [${leastValues.join(', ')}])` });
          else if (leastValues.length > 1) violations.push({ check: 'answer-key-desync', where: id, detail: `${leastValues.length} values [${leastValues.join(', ')}] tie for least frequent — the answer is ambiguous` });
        } else if (ansFreq !== maxFreq && ansFreq !== minFreq) {
          // intent unclear from text — the answer must at least be a frequency extreme
          violations.push({ check: 'answer-key-desync', where: id, detail: `targetAnswer=${targetAnswer} (freq ${ansFreq}) is neither the most (${maxFreq}) nor least (${minFreq}) frequent value` });
        }
        if (numbersIn(leakText).some((n) => near(n, targetAnswer))) {
          violations.push({ check: 'answer-leak', where: id, detail: `instruction/hint/narration states the answer ${targetAnswer}` });
        }
        answerValues.push(`freq:${targetAnswer}`);
        cardSeen.set(`${mode}#${dataPoints.join(',')}`, (cardSeen.get(`${mode}#${dataPoints.join(',')}`) ?? 0) + 1);
      } else if (mode === 'compare_datasets') {
        const comparisonAnswer = typeof c.comparisonAnswer === 'string' ? c.comparisonAnswer : '';
        const secondary = asNumberArray(data.secondaryDataPoints);
        if (comparisonAnswer.trim() === '' || !secondary) {
          violations.push({ check: 'schema', where: id, detail: `compare_datasets needs a non-empty comparisonAnswer and a secondaryDataPoints set (got comparisonAnswer=${JSON.stringify(c.comparisonAnswer)} secondary=${JSON.stringify(data.secondaryDataPoints)})` });
          continue;
        }
        checked++;
        answerValues.push(`cmp:${comparisonAnswer.trim().slice(0, 20)}`);
        cardSeen.set(`${mode}#${dataPoints ? dataPoints.join(',') : ''}`, (cardSeen.get(`${mode}#${dataPoints ? dataPoints.join(',') : ''}`) ?? 0) + 1);
      } else {
        // plotting modes — no derived answer key beyond the dataset (checked in-range above).
        checked++;
      }
    }

    // ── clustering (only meaningful with ≥3 challenges) ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].answer');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical challenge "${key.slice(0, 80)}…" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
