import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions } from './helpers';

/**
 * Histogram oracle — verifies the pre-built histogram challenge pool against the
 * component's own judging contract, across all four challenge types.
 *
 * The component (Histogram.tsx, handleSubmit :599-636) judges each type:
 *  - identify_shape  : selectedShape === expectedShape.
 *  - find_modal_bin  : chosenBin.start === expectedBinStart.
 *  - read_frequency  : Number(input) === targetFrequency.
 *  - estimate_center : |Number(input) − targetAnswer| ≤ tolerance.
 * The bars the student reads are computed from the raw `data[]` by computeBins
 * (:189-204): from effectiveStart (= binStart if binStart ≤ min, else
 * floor(min/binWidth)·binWidth), each bar counts data.filter(v ≥ start && v < end).
 *
 * THE INDEPENDENCE RULE: the shipped keys are expectedBinStart / targetFrequency /
 * targetAnswer, pre-computed by the generator. This oracle re-derives them from
 * the raw `data[]` by REPLICATING computeBins EXACTLY (including the v < end
 * exclusive edge, so it counts the drawn bars, not an idealized binning) and
 * recomputing mean/median itself — never re-using the generator's counts:
 *  - find_modal_bin  : the modal bin is the bar with the highest count; its start
 *    must equal expectedBinStart (and the max must be UNIQUE, else the "modal
 *    bin" is ambiguous and a student clicking the tied bar is marked wrong).
 *  - read_frequency  : the count of data in [targetBinStart, targetBinEnd) must
 *    equal targetFrequency (the drawn bar height).
 *  - estimate_center : the mean / median of data must fall within
 *    [targetAnswer ± tolerance].
 * Because the oracle bins the same way the component draws, a generator that
 * counted the bars a DIFFERENT way (a modal bin off by one, a frequency that
 * miscounts a boundary value, a mean keyed from a stale dataset) is the
 * correct-read-marked-wrong class this oracle catches.
 *
 * Checks:
 *  - answer-key-desync :
 *      (a) find_modal_bin: expectedBinStart is not the (unique) highest bar.
 *      (b) read_frequency: targetFrequency ≠ the count in the target bin.
 *      (c) estimate_center: targetAnswer is outside the tolerance window of the
 *          true mean/median; tolerance ≤ 0 (no reachable answer).
 *      (d) identify_shape: expectedShape is absent from shapeOptions
 *          (unselectable — the correct choice is not on screen).
 *  - scope             : when ctx.evalMode names one of the four types, every
 *      challenge's challengeType must match it (task identity). No numeric
 *      magnitude ceiling — histogram datasets are context-scaled, not
 *      topic-number-bounded.
 *  - answer-leak       : estimate_center — the prompt/hint must not print the
 *      mean/median answer value. (find_modal_bin's bin range and read_frequency's
 *      count overlap the axis givens too heavily to value-match, and identify_
 *      shape's shape words appear in the option prompt — those are /eval-test.)
 *  - clustering        : the answer (shape / modal-bin start / frequency / center)
 *      must spread (checkAnswerVariety); no byte-identical card (same dataset +
 *      binWidth + type).
 *  - schema            : ≥3 challenges (mastery-over-demo); known challengeType;
 *      non-empty data[] with binWidth > 0 and finite binStart; non-empty prompt;
 *      per-type required fields present (unique shapeOptions; finite
 *      expectedBinStart/End; targetBinStart/End/Frequency; targetStatistic ∈
 *      {mean, median} with finite targetAnswer/tolerance).
 *
 * Deliberately NOT checked:
 *  - the SEMANTIC correctness of identify_shape's expectedShape (is this dataset
 *    "really" right-skewed?): shape classification is a perceptual/heuristic
 *    judgment (the component's own skew label uses a ±0.5 skewness cutoff) —
 *    /eval-test's call. The oracle only checks the answer is selectable.
 *  - support-tier display flags (showStatistics / showFrequencyLabels): the
 *    checker never reads them; withdrawal quality is /eval-test.
 */

const EPS = 1e-6;

const KNOWN_TYPES = new Set(['identify_shape', 'find_modal_bin', 'read_frequency', 'estimate_center']);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPS;

interface Bin { start: number; end: number; count: number }

/** Exact replica of Histogram.tsx computeBins (:189-204) — the drawn bars. */
function computeBins(data: number[], binWidth: number, binStart: number): Bin[] {
  if (data.length === 0 || binWidth <= 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const effectiveStart = binStart <= min ? binStart : Math.floor(min / binWidth) * binWidth;
  const effectiveEnd = Math.ceil((max - effectiveStart) / binWidth) * binWidth + effectiveStart;
  const numBins = Math.max(1, Math.ceil((effectiveEnd - effectiveStart) / binWidth));
  const out: Bin[] = [];
  for (let i = 0; i < numBins; i++) {
    const start = effectiveStart + i * binWidth;
    const end = start + binWidth;
    out.push({ start, end, count: data.filter((v) => v >= start && v < end).length });
  }
  return out;
}

function median(data: number[]): number {
  const s = [...data].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/** Standalone numbers in free text. */
function numbersIn(text: string): number[] {
  return text.split(/[^0-9.]+/).map((t) => parseFloat(t)).filter((n) => Number.isFinite(n));
}

function asNumberArray(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: number[] = [];
  for (const x of v) { if (!isNum(x)) return null; out.push(x); }
  return out;
}

export const histogramOracle: ContentOracle = {
  componentId: 'histogram',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const requestedMode = KNOWN_TYPES.has(ctx.evalMode) ? ctx.evalMode : null;
    const answerValues: string[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.challengeType ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      // ── scope: the session must deliver the requested eval mode ──
      if (requestedMode && type !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challengeType "${type}" but the objective asked for eval mode "${requestedMode}" — a different task identity`,
        });
      }

      const dataset = asNumberArray(c.data);
      const binWidth = c.binWidth;
      const binStart = c.binStart;
      const prompt = typeof c.prompt === 'string' ? c.prompt : '';
      const hint = typeof c.hint === 'string' ? c.hint : '';
      if (!dataset || !isNum(binWidth) || binWidth <= 0 || !isNum(binStart) || prompt.trim() === '') {
        violations.push({
          check: 'schema',
          where: id,
          detail: `malformed challenge: data=${dataset ? `[${dataset.length}]` : 'bad'} binWidth=${String(c.binWidth)} binStart=${String(c.binStart)} prompt=${JSON.stringify(c.prompt)}`,
        });
        continue;
      }

      const bins = computeBins(dataset, binWidth, binStart);
      checked++;

      if (type === 'identify_shape') {
        const expectedShape = typeof c.expectedShape === 'string' ? c.expectedShape : '';
        const shapeOptions = Array.isArray(c.shapeOptions) ? c.shapeOptions.map(String) : null;
        if (expectedShape === '' || !shapeOptions || shapeOptions.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `identify_shape missing expectedShape/shapeOptions: expectedShape=${JSON.stringify(c.expectedShape)} shapeOptions=${JSON.stringify(c.shapeOptions)}` });
          continue;
        }
        const dup = checkUniqueOptions(shapeOptions, id);
        if (dup) violations.push(dup);
        // ── (d): the correct shape must be selectable ──
        if (!shapeOptions.includes(expectedShape)) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `expectedShape "${expectedShape}" is not among shapeOptions [${shapeOptions.join(', ')}] — the correct choice is unselectable` });
        }
        answerValues.push(`shape:${expectedShape}`);
      } else if (type === 'find_modal_bin') {
        const eStart = c.expectedBinStart;
        if (!isNum(eStart)) {
          violations.push({ check: 'schema', where: id, detail: `find_modal_bin missing expectedBinStart (got ${String(c.expectedBinStart)})` });
          continue;
        }
        // ── (a): the modal bin must be the unique tallest bar ──
        const maxCount = Math.max(...bins.map((b) => b.count));
        const modal = bins.filter((b) => b.count === maxCount);
        if (modal.length > 1) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `${modal.length} bins tie for the tallest (count ${maxCount}) — "the modal bin" is ambiguous; a student clicking a tied bar is marked wrong` });
        } else if (!near(modal[0].start, eStart)) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `expectedBinStart=${eStart} but the tallest bar (count ${maxCount}) starts at ${modal[0].start} — the student reading the graph is marked wrong` });
        }
        answerValues.push(`modal:${eStart}`);
      } else if (type === 'read_frequency') {
        const tStart = c.targetBinStart, tEnd = c.targetBinEnd, tFreq = c.targetFrequency;
        if (!isNum(tStart) || !isNum(tEnd) || !isNum(tFreq)) {
          violations.push({ check: 'schema', where: id, detail: `read_frequency missing target bin/frequency: targetBinStart=${String(tStart)} targetBinEnd=${String(tEnd)} targetFrequency=${String(tFreq)}` });
          continue;
        }
        // ── (b): the shipped count must equal the drawn bar height ──
        const trueCount = dataset.filter((v) => v >= tStart && v < tEnd).length;
        if (trueCount !== tFreq) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `targetFrequency=${tFreq} but [${tStart}, ${tEnd}) actually contains ${trueCount} data value(s) — the student counting the bar is marked wrong` });
        }
        answerValues.push(`freq:${tStart}:${tFreq}`);
      } else {
        // estimate_center
        const stat = String(c.targetStatistic ?? '');
        const targetAnswer = c.targetAnswer;
        const tolerance = c.tolerance;
        if ((stat !== 'mean' && stat !== 'median') || !isNum(targetAnswer) || !isNum(tolerance)) {
          violations.push({ check: 'schema', where: id, detail: `estimate_center malformed: targetStatistic=${JSON.stringify(c.targetStatistic)} targetAnswer=${String(targetAnswer)} tolerance=${String(tolerance)}` });
          continue;
        }
        if (tolerance <= 0) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `tolerance=${tolerance} — no estimate is acceptable (the window must be positive)` });
        }
        // ── (c): the true center must be inside the accepted window ──
        const trueCenter = stat === 'mean' ? dataset.reduce((a, b) => a + b, 0) / dataset.length : median(dataset);
        if (Math.abs(trueCenter - targetAnswer) > tolerance + EPS) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `targetAnswer=${targetAnswer} (±${tolerance}) but the ${stat} of the data is ${trueCenter.toFixed(3)} — the student computing the ${stat} is marked wrong` });
        }
        // ── answer-leak: the prompt/hint must not print the center value ──
        if (numbersIn(`${prompt} ${hint}`).some((n) => Math.abs(n - targetAnswer) <= tolerance + EPS)) {
          violations.push({ check: 'answer-leak', where: id, detail: `prompt/hint states the ${stat} answer ${targetAnswer}` });
        }
        answerValues.push(`center:${targetAnswer}`);
      }

      const cardKey = `${type}#bw=${binWidth}#${dataset.join(',')}`;
      cardSeen.set(cardKey, (cardSeen.get(cardKey) ?? 0) + 1);
    }

    // ── clustering: answers spread; no byte-identical card ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].answer');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical dataset "${key.slice(0, 80)}…" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
