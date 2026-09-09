import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions, parseScopeCeiling } from './helpers';

/**
 * Bar-model oracle — a CALCULATION oracle for the bar/picture-graph reading &
 * building family (compare_bars, read_scale, picture_graph, scaled_bar_graph,
 * graph_word_problem, build_graph). Its flagship guarantee is answer-key-desync
 * on the read modes: the value the student is graded against must be the value of
 * the bar the prompt actually names, and it must be selectable among the options —
 * the vocabulary-explorer class (a correct read marked wrong) fused with the
 * array-grid class (the correct value isn't among the choices).
 *
 * The component (BarModel.tsx) judges correctness per mode:
 *  - build_one_to_one (handleStickerSubmit): correct = every row's placed sticker
 *    count equals expectedCounts[row]. The key is independently re-derivable —
 *    recount `sourceItems` by categoryIndex — so a pile that disagrees with the
 *    key, a pre-filled row, or a row too short to hold its own answer is caught.
 *  - match_to_bar (handleBarClick): correct = clicked index === targetBarIndex,
 *    and the keyed row must be the one whose value equals stimulusCount, with no
 *    second row showing the same count (two right answers, one accepted).
 *  - most_least (handleBarClick): same shape as compare_bars — the prompt's
 *    superlative plus the row counts re-derive the winner.
 *  - read_one_to_one (handleOptionClick): a read mode — expectedValue must be the
 *    count of the row the prompt names, and must be among the options.
 *  - compare_bars (handleBarClick, :697-700): correct = clicked index ===
 *    targetBarIndex. So targetBarIndex IS the answer key; it must be a real bar
 *    index, and — when the prompt asks for the "most/least" — it must point at the
 *    argmax/argmin of `values`. (expectedValue is null in this mode.)
 *  - read_scale / picture_graph / scaled_bar_graph (handleOptionClick, :704-708):
 *    correct = selectedOption === expectedValue, options rendered from `options[]`.
 *    The answer bar (`targetBarIndex`) is HIDDEN and its value IS the answer
 *    (answerBarIndex, :752-759), so the real contract is expectedValue ===
 *    values[targetBarIndex].value AND expectedValue ∈ options.
 *  - graph_word_problem (handleOptionClick, :704-708): correct = selectedOption ===
 *    expectedValue, but expectedValue is a COMPUTED quantity ("how many more…"),
 *    not a single bar value — so only reachability (expectedValue ∈ options) is
 *    independently checkable; the arithmetic-matches-the-word-problem contract is
 *    recorded in uncheckedTypes (deriving it would require parsing the story →
 *    porting the generator's own computation → false-pass risk).
 *  - build_graph (handleBuildSubmit, :711-725): correct = the built dataset matches
 *    `expectedDataset` (label→value) AND chosenStep === expectedScaleStep. Bars are
 *    built by ±1 increments (adjust, :349-354), so any non-negative integer is
 *    buildable — reachability is (a) expectedScaleStep ∈ availableScaleSteps (the
 *    correct step must be selectable) and (b) every dataset value is a non-negative
 *    integer ≤ scale.max (a value off the axis can never be shown). WHICH step is
 *    "best" is a pedagogy judgment, not a contract, so it is not second-guessed.
 *
 * THE INDEPENDENCE RULE: the oracle never trusts expectedValue as its own proof
 * for the read modes — it re-reads the named bar's value from `values[targetBarIndex]`
 * and checks the stored key agrees. For compare_bars it re-derives the winner from
 * the prompt's superlative + the bar magnitudes and checks targetBarIndex agrees. A
 * generator that stored the wrong bar value, pointed at the wrong bar, or listed an
 * answer absent from the options can no longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : read modes — expectedValue === values[targetBarIndex].value
 *    AND expectedValue ∈ options. compare_bars — targetBarIndex is a real index and
 *    (when the prompt names most/least) equals the argmax/argmin of the bars.
 *    graph_word_problem — expectedValue ∈ options (reachability only). build_graph —
 *    expectedScaleStep ∈ availableScaleSteps.
 *  - scope             : bar values / read answers honor an EXPLICIT objective
 *    ceiling (ctx.scopeMax ?? a "to N" topic). Survey counts carry no intrinsic
 *    ceiling, so absent an explicit one there is nothing to bite (documented, not a
 *    silent skip).
 *  - clustering        : the produced answers spread within a mode (read answers
 *    don't collapse to one value; compare answers don't all sit on the same SIDE —
 *    the position the student clicks, not the winning value), and no exact-duplicate
 *    read/compare card.
 *  - schema            : ≥3 challenges (mastery-over-demo); values is a non-empty
 *    array of {label, numeric value}; read modes have a valid targetBarIndex, a
 *    finite expectedValue and a non-empty duplicate-free options array; build_graph
 *    has a non-empty expectedDataset of {label, non-negative-int value} + a numeric
 *    expectedScaleStep.
 *
 * Deliberately NOT checked: answer-leak. Every prompt states the stimulus by
 * design — a read prompt names the bar to read, a compare prompt asks which is
 * more/less, and a build prompt LISTS the dataset the student must construct
 * ("Tomatoes=14, Carrots=18…"). A leak test would fire on the intended task,
 * worse than an honest gap. Leak/pedagogy (incl. "is this the best scale") stays
 * with /eval-test.
 */

const READ_MODES = new Set(['read_one_to_one', 'read_scale', 'picture_graph', 'scaled_bar_graph']);
/** Modes whose answer key is targetBarIndex and whose prompt carries a superlative. */
const EXTREME_MODES = new Set(['compare_bars', 'most_least']);
const KNOWN_MODES = new Set([
  'say_what_it_shows', 'compare_two_graphs',
  'build_one_to_one',
  'read_one_to_one',
  'match_to_bar',
  'most_least',
  'compare_bars',
  'read_scale',
  'picture_graph',
  'scaled_bar_graph',
  'graph_word_problem',
  'build_graph',
]);

const MORE_RE = /\b(more|most|greater|greatest|tallest|largest|highest|biggest|maximum|max)\b/i;
const LESS_RE = /\b(less|least|fewer|fewest|smaller|smallest|shortest|lowest|minimum|min)\b/i;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

interface Bar {
  label: string;
  value: number;
}

/** Read the {label, value} bars, or null if the array is malformed. */
function readBars(v: unknown): Bar[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const bars: Bar[] = [];
  for (const raw of v) {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (!isNum(r.value)) return null;
    bars.push({ label: String(r.label ?? ''), value: r.value as number });
  }
  return bars;
}

/** The unique argmax/argmin of the bars, or -1 on a tie (ambiguous winner). */
function extremeIndex(bars: Bar[], want: 'max' | 'min'): number {
  let best = 0;
  for (let i = 1; i < bars.length; i++) {
    if (want === 'max' ? bars[i].value > bars[best].value : bars[i].value < bars[best].value) best = i;
  }
  const tie = bars.filter((b) => b.value === bars[best].value).length > 1;
  return tie ? -1 : best;
}

export const barModelOracle: ContentOracle = {
  componentId: 'bar-model',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    // Survey counts have no intrinsic ceiling — only an explicit harness/topic one bites.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Per-mode answer buckets for the variety check, plus a duplicate-card map.
    const answersByMode: Record<string, Array<string | number>> = {};
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const mode = String(c.evalMode ?? '');
      if (!KNOWN_MODES.has(mode)) {
        uncheckedTypes.add(mode || '(missing evalMode)');
        continue;
      }

      // ── build_graph: expectedDataset + expectedScaleStep ──
      if (mode === 'build_graph') {
        const dataset = Array.isArray(c.expectedDataset) ? (c.expectedDataset as Array<Record<string, unknown>>) : null;
        if (!dataset || dataset.length === 0) {
          violations.push({ check: 'schema', where: id, detail: `build_graph needs a non-empty expectedDataset; got ${JSON.stringify(c.expectedDataset)}` });
          continue;
        }
        const step = c.expectedScaleStep;
        if (!isNum(step)) {
          violations.push({ check: 'schema', where: id, detail: `build_graph needs a numeric expectedScaleStep; got ${JSON.stringify(step)}` });
          continue;
        }
        // Reachability: the correct step must be selectable among the offered steps.
        const steps = Array.isArray(c.availableScaleSteps) ? (c.availableScaleSteps as unknown[]) : null;
        if (steps && !steps.some((s) => isNum(s) && s === step)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `expectedScaleStep ${step} is not among availableScaleSteps ${JSON.stringify(steps)} — the correct scale can never be chosen`,
          });
        }
        // Reachability: every dataset value is a non-negative integer on the axis.
        const scaleMax = isNum((c.scale as Record<string, unknown> | undefined)?.max) ? ((c.scale as Record<string, unknown>).max as number) : undefined;
        const labels: string[] = [];
        for (const d of dataset) {
          if (!isInt(d.value) || (d.value as number) < 0) {
            violations.push({ check: 'schema', where: id, detail: `build_graph dataset value must be a non-negative integer; got ${JSON.stringify(d.value)} for "${String(d.label)}"` });
          } else if (scaleMax !== undefined && (d.value as number) > scaleMax) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `dataset value ${d.value} for "${String(d.label)}" exceeds the axis max ${scaleMax} — it can never be built on the rendered graph`,
            });
          }
          if (ceiling !== undefined && isNum(d.value) && (d.value as number) > ceiling) {
            violations.push({ check: 'scope', where: id, detail: `dataset value ${d.value} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")` });
          }
          labels.push(String(d.label ?? ''));
        }
        if (new Set(labels).size !== labels.length) {
          violations.push({ check: 'schema', where: id, detail: `build_graph dataset has duplicate labels [${labels.join(', ')}] — matched by label, so a duplicate is ambiguous` });
        }
        checked++;
        (answersByMode.build_graph ??= []).push(dataset.map((d) => `${String(d.label)}:${String(d.value)}`).sort().join(','));
        bump(cardSeen, `build|${labels.slice().sort().join('/')}|${dataset.map((d) => String(d.value)).join(',')}|${step}`);
        continue;
      }

      // All other modes need a well-formed bars array.
      const bars = readBars(c.values);
      if (!bars) {
        violations.push({ check: 'schema', where: id, detail: `values must be a non-empty array of {label, numeric value}; got ${JSON.stringify(c.values)}` });
        continue;
      }
      if (mode === 'say_what_it_shows' || mode === 'compare_two_graphs') {
        const scale = c.scale as Record<string, unknown> | undefined;
        const second = mode === 'compare_two_graphs' ? readBars(c.secondValues) : null;
        if (c.graphStyle !== 'picture' || scale?.iconValue !== 1 || scale?.step !== 1 || c.showBarValues !== false) {
          violations.push({ check: 'schema', where: id, detail: 'Spoken K graphs need one-to-one pictures and hidden numeric totals.' });
        }
        const all = [...bars, ...(second ?? [])];
        if (all.some((v) => !isInt(v.value) || v.value < 1 || v.value > Math.min(10, ceiling ?? 10))) {
          violations.push({ check: 'scope', where: id, detail: 'Both spoken K graphs must contain integer counts in scope and within 1-10.' });
        }
        if (mode === 'compare_two_graphs' && (!second || second.length !== bars.length
          || second.some((v, j) => v.label !== bars[j].label)
          || !c.graphLabel || !c.secondGraphLabel || c.graphLabel === c.secondGraphLabel)) {
          violations.push({ check: 'schema', where: id, detail: 'Related graphs need distinct survey labels and matching category rows.' });
        }
        if (mode === 'compare_two_graphs' && second && second.length === bars.length
          && (!second.some((v, j) => v.value === bars[j].value) || !second.some((v, j) => v.value !== bars[j].value))) {
          violations.push({ check: 'schema', where: id, detail: 'The pair must offer both a similarity and a difference.' });
        }
        const rows = [...asRecordArray(c.values), ...asRecordArray(c.secondValues)];
        if (rows.some((v) => !v.emoji) || all.some((v) => !isNum(scale?.max) || v.value > scale.max)) {
          violations.push({ check: 'schema', where: id, detail: 'Every row needs a countable picture and enough shared scale capacity.' });
        }
        checked++;
        uncheckedTypes.add(`${mode}(live-spoken-meaning)`);
        continue;
      }
      // Scope on the displayed bar magnitudes (only bites with an explicit ceiling).
      if (ceiling !== undefined) {
        const over = bars.find((b) => b.value > ceiling);
        if (over) violations.push({ check: 'scope', where: id, detail: `bar "${over.label}"=${over.value} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")` });
      }

      // ── build_one_to_one: the key must be a recount of the pile ──
      if (mode === 'build_one_to_one') {
        const key = Array.isArray(c.expectedCounts) ? (c.expectedCounts as unknown[]) : null;
        if (!key || key.length !== bars.length) {
          violations.push({ check: 'schema', where: id, detail: `build_one_to_one needs one expectedCounts entry per row; got ${JSON.stringify(c.expectedCounts)} for ${bars.length} rows` });
          continue;
        }
        // Independence: recount the source pile per category rather than trusting
        // the stored key — a pile that disagrees with the key marks a child who
        // recorded it correctly as wrong.
        const src = Array.isArray(c.sourceItems) ? (c.sourceItems as Array<Record<string, unknown>>) : null;
        if (!src || src.length === 0) {
          violations.push({ check: 'schema', where: id, detail: 'build_one_to_one needs a non-empty sourceItems pile — there is nothing to record' });
        } else {
          const tally = new Array<number>(bars.length).fill(0);
          let stray = 0;
          for (const it of src) {
            const ci = it.categoryIndex;
            if (isInt(ci) && (ci as number) >= 0 && (ci as number) < bars.length) tally[ci as number]++;
            else stray++;
          }
          if (stray > 0) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `${stray} source object(s) belong to no row — they can never be recorded, so a perfect chart is still marked wrong` });
          }
          for (let r = 0; r < bars.length; r++) {
            if (tally[r] !== key[r]) {
              violations.push({
                check: 'answer-key-desync',
                where: id,
                detail: `row "${bars[r].label}" holds ${tally[r]} object(s) in the pile but the key expects ${String(key[r])} — recording what is on screen would be marked wrong`,
              });
            }
          }
        }
        // Reachability: the row has to hold its own answer, and starts empty.
        const cap = isNum((c.scale as Record<string, unknown> | undefined)?.max) ? ((c.scale as Record<string, unknown>).max as number) : undefined;
        for (let r = 0; r < key.length; r++) {
          const k = key[r];
          if (!isInt(k) || (k as number) < 1) {
            violations.push({ check: 'schema', where: id, detail: `expectedCounts[${r}] must be a positive integer; got ${JSON.stringify(k)}` });
          } else if (cap !== undefined && (k as number) > cap) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `row "${bars[r].label}" needs ${k} stickers but the row only holds ${cap} — the correct chart cannot be built` });
          }
          if (ceiling !== undefined && isNum(k) && (k as number) > ceiling) {
            violations.push({ check: 'scope', where: id, detail: `expectedCounts[${r}] = ${k} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")` });
          }
        }
        const prefilled = bars.find((b) => b.value !== 0);
        if (prefilled) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `row "${prefilled.label}" already shows ${prefilled.value} sticker(s) — the chart must start empty or the recording is done for the child` });
        }
        checked++;
        (answersByMode.build_one_to_one ??= []).push(key.map((k) => String(k)).join(','));
        bump(cardSeen, `build1to1|${bars.map((b) => b.label).join(',')}|${key.map((k) => String(k)).join(',')}`);
        continue;
      }

      // ── match_to_bar: exactly one row shows the size of the group ──
      if (mode === 'match_to_bar') {
        const tbi = c.targetBarIndex;
        const stim = c.stimulusCount;
        if (!isInt(tbi) || (tbi as number) < 0 || (tbi as number) >= bars.length) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `targetBarIndex ${JSON.stringify(tbi)} is not a valid row index [0,${bars.length - 1}] — the correct row can never be tapped` });
          continue;
        }
        if (!isInt(stim) || (stim as number) < 1) {
          violations.push({ check: 'schema', where: id, detail: `match_to_bar needs a positive integer stimulusCount; got ${JSON.stringify(stim)}` });
          continue;
        }
        const n = stim as number;
        if (bars[tbi as number].value !== n) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `the group holds ${n} but the keyed row "${bars[tbi as number].label}" shows ${bars[tbi as number].value} — the match is not the answer` });
        }
        const matching = bars.filter((b) => b.value === n).length;
        if (matching > 1) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `${matching} rows show ${n} — more than one row is a correct match, but only one is accepted` });
        }
        const src = Array.isArray(c.sourceItems) ? (c.sourceItems as unknown[]) : null;
        if (src && src.length !== n) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `the drawn group has ${src.length} object(s) but stimulusCount says ${n} — counting what is on screen gives the wrong row` });
        }
        checked++;
        (answersByMode.match_to_bar ??= []).push(`pos${tbi}`);
        bump(cardSeen, `match|${bars.map((b) => `${b.label}=${b.value}`).join(',')}|${n}`);
        continue;
      }

      if (EXTREME_MODES.has(mode)) {
        const tbi = c.targetBarIndex;
        if (!isInt(tbi) || (tbi as number) < 0 || (tbi as number) >= bars.length) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `targetBarIndex ${JSON.stringify(tbi)} is not a valid bar index [0,${bars.length - 1}] — the correct bar can never be clicked`,
          });
          continue;
        }
        checked++;
        // Independence: re-derive the winner from the prompt's superlative + magnitudes.
        const prompt = String(c.prompt ?? '');
        const wantsMore = MORE_RE.test(prompt);
        const wantsLess = LESS_RE.test(prompt);
        if (wantsMore !== wantsLess) {
          const want = wantsMore ? 'max' : 'min';
          const expectedIdx = extremeIndex(bars, want);
          if (expectedIdx >= 0 && expectedIdx !== (tbi as number)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `prompt asks for the ${want === 'max' ? 'greatest' : 'least'} bar; magnitudes ${JSON.stringify(bars.map((b) => `${b.label}=${b.value}`))} → index ${expectedIdx} ("${bars[expectedIdx].label}"), but targetBarIndex is ${tbi} ("${bars[tbi as number].label}") — a correct click would be marked wrong`,
            });
          }
          if (expectedIdx < 0) uncheckedTypes.add(`${mode}(tie)`);
        } else {
          // No clear superlative → the semantic winner isn't independently derivable.
          uncheckedTypes.add(`${mode}(ambiguous-prompt)`);
        }
        // Clustering here tracks the answer POSITION (what the student actually
        // clicks), not the winning value — an always-same-side set is guessable.
        (answersByMode[mode] ??= []).push(`pos${tbi}`);
        bump(cardSeen, `${mode}|${bars.map((b) => `${b.label}=${b.value}`).join(',')}|${tbi}`);
        continue;
      }

      // Read modes + graph_word_problem: expectedValue ∈ options.
      const expected = c.expectedValue;
      const options = Array.isArray(c.options) ? (c.options as unknown[]) : null;
      if (!options || options.length === 0) {
        violations.push({ check: 'schema', where: id, detail: `${mode} needs a non-empty options array; got ${JSON.stringify(c.options)}` });
        continue;
      }
      const dup = checkUniqueOptions(options, id);
      if (dup) violations.push(dup);
      if (!isNum(expected)) {
        violations.push({ check: 'schema', where: id, detail: `${mode} needs a finite expectedValue; got ${JSON.stringify(expected)}` });
        continue;
      }
      // Reachability: the correct value must be selectable.
      if (!options.some((o) => isNum(o) && o === expected)) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `expectedValue ${expected} is not among options ${JSON.stringify(options)} — the correct answer can never be selected`,
        });
      }

      if (READ_MODES.has(mode)) {
        // ── Independence: expectedValue must be the value of the bar the prompt names. ──
        const tbi = c.targetBarIndex;
        if (!isInt(tbi) || (tbi as number) < 0 || (tbi as number) >= bars.length) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `read mode needs a valid targetBarIndex (the bar being read); got ${JSON.stringify(tbi)} for ${bars.length} bars`,
          });
        } else if (bars[tbi as number].value !== expected) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `expectedValue ${expected} disagrees with the named bar "${bars[tbi as number].label}"=${bars[tbi as number].value} (targetBarIndex ${tbi}) — reading the graph correctly would be marked wrong`,
          });
        }
      } else {
        // graph_word_problem: the computed answer isn't independently derivable.
        uncheckedTypes.add('graph_word_problem(arithmetic)');
      }

      checked++;
      (answersByMode[mode] ??= []).push(expected);
      bump(cardSeen, `${mode}|${bars.map((b) => `${b.label}=${b.value}`).join(',')}|${expected}`);
    }

    // ── clustering: answers spread within each mode ──
    for (const [mode, vals] of Object.entries(answersByMode)) {
      const variety = checkAnswerVariety(vals, `${mode}[].answer`);
      if (variety) violations.push(variety);
    }
    // ── clustering: no exact-duplicate card ──
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
