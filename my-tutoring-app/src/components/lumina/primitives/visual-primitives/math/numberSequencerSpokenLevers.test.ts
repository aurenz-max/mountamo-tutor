/**
 * The number-sequencer spoken-mode levers (handoff 23 step 2): which lever answers which miss, each lever's leak rule on
 * the saved payloads, and the easier trains over many generated shapes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { NumberSequencerChallenge } from './NumberSequencer';
import { buildSequencerItems, numberSequencerSpokenMisses, sequencerItemsForChallenge, type SequencerItem } from './numberSequencerDomain';
import { CAR_MARKS_LEVER, MODEL_TRAIN_LEVER, SMALLER_LEVER, STEP_ARROW_LEVER, modelTrain, smallerNumbers, spokenLeverFacts,
  spokenSequencerLevers, stepArrow } from './numberSequencerSpokenLevers';

const MODES = ['count_from', 'before_after', 'spot_error', 'fill_missing', 'decade_fill'] as const;
const itemsOf = (mode: string) => buildSequencerItems(JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/number-sequencer.${mode}.json`), 'utf8')).data.challenges).items;
const range = (values: number[]) => ({ rangeMin: Math.min(...values), rangeMax: Math.max(...values) });
const ch = (c: Omit<NumberSequencerChallenge, 'instruction' | 'rangeMin' | 'rangeMax'>): SequencerItem[] =>
  sequencerItemsForChallenge({ instruction: '', ...c, ...range([...c.sequence.filter((n): n is number => n !== null), ...c.correctAnswers,
    ...(c.startNumber ? [c.startNumber] : [])]) } as NumberSequencerChallenge);
const countFrom = (start: number, n: number, direction: 'forward' | 'backward' = 'forward') => ch({ id: `cf${start}${direction}`,
  type: 'count-from', sequence: [start], startNumber: start, direction,
  correctAnswers: Array.from({ length: n }, (_, i) => start + (direction === 'forward' ? i + 1 : -(i + 1))) });
const trainOf = (full: number[], gaps: number[], type: NumberSequencerChallenge['type'] = 'fill-missing') =>
  ch({ id: `t${full.join('-')}`, type, sequence: full.map((n, i) => gaps.includes(i) ? null : n), correctAnswers: gaps.map(i => full[i]) });
const levers = (item: SequencerItem, pulled: string[] = []) => spokenSequencerLevers(item, pulled, []);

describe('which lever answers which miss', () => {
  const [cf] = countFrom(28, 3), [ba] = trainOf([28, 29], [1], 'before-after'), [fm] = trainOf([20, 25, 30, 35], [2]);
  it.each([
    [cf, 'said_start', STEP_ARROW_LEVER], [cf, 'wrong_direction', STEP_ARROW_LEVER], [cf, 'decade_word', CAR_MARKS_LEVER],
    [ba, 'wrong_side', STEP_ARROW_LEVER], [ba, 'said_shown', STEP_ARROW_LEVER], [ba, 'teen_ty_swap', CAR_MARKS_LEVER],
    [fm, 'counted_by_one', STEP_ARROW_LEVER], [fm, 'said_neighbor', STEP_ARROW_LEVER], [fm, 'over_by_more', CAR_MARKS_LEVER],
  ])('%#: after %s', (item, miss, lever) => { expect(nextLever(levers(item), miss)).toBe(lever); });
  it('with car_marks pulled, a big-number miss opens the smaller train; spot_error gets the model train only', () => {
    expect(nextLever(levers(cf, [CAR_MARKS_LEVER]), 'decade_word')).toBe(SMALLER_LEVER);
    const [spot] = ch({ id: 's', type: 'spot-error', sequence: [12, 13, 19, 15, 16], wrongIndex: 2, correctAnswers: [14] });
    expect(levers(spot).map(l => l.id)).toEqual([MODEL_TRAIN_LEVER]);
    expect(nextLever(levers(spot), 'said_repair')).toBe(MODEL_TRAIN_LEVER);
  });
  it('numbers of ten or less get no smaller train; order_cards gets no spoken lever', () => {
    expect(levers(trainOf([7, 8, 9, 10], [1])[0]).map(l => l.id)).toEqual([STEP_ARROW_LEVER, CAR_MARKS_LEVER]);
    expect(levers(itemsOf('order_cards')[0])).toEqual([]);
  });
  it("on every saved payload, the levers answer only the mode's catalog misses, and every miss is answered", () => {
    const entry = getComponentById('number-sequencer')!.teachingWorkspace!;
    for (const mode of MODES) {
      const items = itemsOf(mode);
      const answered = new Set(items.flatMap(i => spokenSequencerLevers(i, [], items)).flatMap(l => l.answers ?? []));
      answered.forEach(m => expect(entry.misses![mode], mode).toContain(m));
      expect(entry.misses![mode].filter(m => !answered.has(m)), mode).toEqual(entry.unanswered?.[mode] ?? []);
    }
  });
});

describe('leak rules', () => {
  const all = MODES.flatMap(itemsOf);
  it('the step arrow sits on a printed car beside the glowing one and carries the train step', () => {
    for (const item of all) {
      const arrow = stepArrow(item);
      if (!arrow) continue;
      expect(Math.abs(arrow.from - item.slot), item.id).toBe(1);
      if (item.challengeType === 'count-from') expect(arrow.step).toBe(item.answer - item.previous);
      else {
        expect(item.sequence[arrow.from], item.id).not.toBeNull();
        expect(item.sequence[arrow.from]! + arrow.step, item.id).toBe(item.answer);
      }
    }
  });
  it('the model train shares no number with the item; no scene fact carries a digit', () => {
    for (const item of all) {
      const model = modelTrain(item);
      if (model) for (const n of model.cars) expect(item.sequence).not.toContain(n);
      expect(spokenLeverFacts(item, levers(item).map(l => l.id)), item.id).not.toMatch(/\d/);
    }
  });
});

describe('the easier trains', () => {
  const shapes: SequencerItem[] = [];
  for (let start = 11; start <= 110; start += 3) {
    shapes.push(...countFrom(start, 3), ...countFrom(start, 2, 'backward'));
    shapes.push(...trainOf([start, start + 1], [0], 'before-after'), ...trainOf([start, start + 1], [1], 'before-after'));
    for (const step of [1, 2, 5, 10]) if (start + 4 * step <= 120) shapes.push(...trainOf([0, 1, 2, 3, 4].map(k => start + k * step), [1, 3]));
    if (start % 10 >= 7) shapes.push(...trainOf([start, start + 1, start + 2, start + 3, start + 4], [2], 'decade-fill'));
  }
  it('each keeps the mode, the step and the ones digit, has one gap, a smaller answer not on the item, and passes the gate', () => {
    let built = 0;
    for (const source of shapes) {
      const other = { ...source, id: 'other', answer: source.answer - 10 };
      const p = smallerNumbers(source, [other]);
      if (!p) {
        // None only when no shift of ten fits, or every shifted answer is one of the item's own numbers (a skip-count by 5 or 10).
        const own = new Set(source.sequence.filter(n => n !== null).concat(source.challengeType === 'fill-missing'
          ? Array.from({ length: source.sequence.length }, (_, i) => source.sequence[0]! + i * (stepArrow(source)?.step ?? 1)) : []));
        for (let s = 10; source.rangeMin - s >= 1; s += 10) expect(own.has(source.answer - s), source.id).toBe(true);
        continue;
      }
      built++;
      expect(p.challengeType).toBe(source.challengeType);
      expect(p.id).toBe(`${source.id}~simpler`);
      expect(p.answer).toBeLessThan(source.answer);
      expect((source.answer - p.answer) % 10).toBe(0);
      expect([...source.sequence, source.previous]).not.toContain(p.answer);
      expect(p.sequence.filter(n => n === null).length).toBeLessThanOrEqual(1);
      if (p.answer === other.answer) expect(smallerNumbers(source, [])!.answer).toBe(other.answer);
      expect(stepArrow(p)?.step).toBe(stepArrow(source)?.step);
      expect(numberSequencerSpokenMisses(p).length).toBeGreaterThan(0);
    }
    expect(built).toBeGreaterThan(300);
  });
});
