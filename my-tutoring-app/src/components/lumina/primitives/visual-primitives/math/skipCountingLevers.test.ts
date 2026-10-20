/**
 * skip-counting-runner levers (`SKIP_LEVERS`, skipCountingLevers.ts): each leak rule, each simpler-count builder over
 * many lines, which lever answers which miss, and per item on the saved journey payloads that every card miss has a
 * lever there.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { SkipCountingChallenge, SkipCountingRunnerData } from './SkipCountingRunner';
import { SKIP_MISSES } from './skipCounting.card';
import { gapsOf, linePositions, openingSpots, skipItems, skipMatches, type SkipItem, type SkipLine } from './skipCountingWorkspace';
import {
  ARRAY_ROWS, COUNT_TRAIL, HOP_DOTS, JUMP_MARKS, JUMP_SIZES, MODEL_COUNT, PRACTICE_SUFFIX, RING_GAPS, SIMPLER_LEVER, SKIP_LEVERS,
  STEP_ARCS, TICK_NUMBERS, answerOf, countModel, dotsLeak, hopDots, modelLeaks, practiceItem, practiceLeaks, practiceParent,
  startsShown, type SkipLeverSession,
} from './skipCountingLevers';
import along from '../../../components/live-activity/runtime/testing/w1-payloads/skip-counting-runner.count_along.json';
import predict from '../../../components/live-activity/runtime/testing/w1-payloads/skip-counting-runner.predict.json';
import fill from '../../../components/live-activity/runtime/testing/w1-payloads/skip-counting-runner.fill_missing.json';
import find from '../../../components/live-activity/runtime/testing/w1-payloads/skip-counting-runner.find_skip_value.json';
import connect from '../../../components/live-activity/runtime/testing/w1-payloads/skip-counting-runner.connect_multiplication.json';

type Type = SkipCountingChallenge['type'];
const TYPES: Type[] = ['count_along', 'predict', 'fill_missing', 'find_skip_value', 'connect_multiplication'];
const line = (skipValue: number, jumps = 10, direction: 'forward' | 'backward' = 'forward'): SkipLine =>
  direction === 'forward' ? { skipValue, startFrom: 0, endAt: skipValue * jumps, direction }
    : { skipValue, startFrom: skipValue * jumps, endAt: 0, direction };

/** An item shaped the way the generator builds it, on its line. */
function item(id: string, type: Type, ln: SkipLine, k = 3): SkipItem {
  const all = linePositions(ln);
  const base = { id, type, instruction: 'Do it.', hint: '', narration: '', line: ln };
  switch (type) {
    case 'count_along': return { ...base, startPosition: all[0] };
    case 'predict': return { ...base, startPosition: all[Math.min(k, all.length - 2)] };
    case 'fill_missing': return { ...base, startPosition: all[0], hiddenPositions: [all[k], all[Math.min(k + 3, all.length - 1)]] };
    case 'find_skip_value': return { ...base, startPosition: all[0] };
    case 'connect_multiplication': return { ...base, startPosition: all[Math.min(k + 2, all.length - 1)] };
  }
}
const session = (challenges: SkipItem[], extra: Partial<SkipLeverSession> = {}): SkipLeverSession => ({ challenges, ...extra });
/** The levers on an item, with the tier's starting aids shown (as the component declares them). */
const leversOn = (c: SkipItem, s: SkipLeverSession, pulled: string[] = []) => SKIP_LEVERS.declare(c,
  { session: s, position: openingSpots(c.line, c).at(-1)!, character: 'frog' }, [...startsShown(c, s), ...pulled]);

const LINES = [2, 3, 4, 5, 10].flatMap(sv => [line(sv), line(sv, 6), line(sv, 10, 'backward')]);

describe('leak rules', () => {
  it.each(LINES)('hop_dots on a count by $skipValue ($direction): bare dots strictly inside the first three jumps', ln => {
    const dots = hopDots(ln)!;
    expect(dots.length).toBe(3 * (ln.skipValue - 1));
    expect(dotsLeak(ln, dots)).toBe(false);
    expect(dotsLeak(ln, [...dots, linePositions(ln)[1]])).toBe(true);
    expect(dotsLeak(ln, [...dots, linePositions(ln)[5] - Math.sign(ln.endAt - ln.startFrom)])).toBe(true);
  });

  it.each(LINES)('model_count on a count by $skipValue: another step, and never the jump size among its numbers', ln => {
    const m = countModel(item('s', 'find_skip_value', ln))!;
    expect(m.step).not.toBe(ln.skipValue);
    expect(m.numbers).not.toContain(ln.skipValue);
    expect(modelLeaks(m, ln)).toBe(false);
    expect(modelLeaks({ step: ln.skipValue, numbers: [0, ln.skipValue] }, ln)).toBe(true);
  });

  it('no lever text names the answer of its item', () => {
    for (const ln of LINES) for (const type of TYPES) {
      const c = item('c', type, ln);
      const answer = answerOf(c).split(',');
      for (const l of leversOn(c, session([c]))) {
        for (const a of answer) expect(`${l.when} ${l.does}`, `${type} ${l.id}`).not.toMatch(new RegExp(`(?<!\\d)${a}(?!\\d)`));
      }
    }
  });
});

describe('simpler counts', () => {
  it.each(TYPES)('%s: same mode, own id, its own key checks, never the item\'s answer or a later item\'s', type => {
    let built = 0;
    for (const ln of LINES) for (const k of [2, 3, 4]) {
      const c = item('c1', type, ln, k), later = item('c2', type, ln, k + 1);
      const s = session([c, later]);
      const p = practiceItem(c, s);
      if (!p) continue;
      built++;
      expect(p.type).toBe(type);
      expect(p.id).toBe(`c1${PRACTICE_SUFFIX}`);
      expect(practiceParent(p.id, s.challenges)).toBe(c);
      expect(practiceLeaks(p, c, s)).toBe(false);
      expect(answerOf(p)).not.toBe(answerOf(c));
      if (type !== 'find_skip_value') expect(answerOf(p)).not.toBe(answerOf(later));
      if (type === 'fill_missing') {
        const gaps = gapsOf(p, p.line);
        expect(gaps).toHaveLength(1);
        expect(gapsOf(c, ln)).not.toContain(gaps[0]);
      }
      // Answerable by its own check.
      const at = openingSpots(p.line, p).at(-1)!;
      const answer = Number(answerOf(p).split(',')[0]);
      if (type !== 'count_along') expect(skipMatches(p, p.line, { position: at, landings: [at], filled: [], answer })).toBe(true);
      // Plainer or shorter: never more jumps than the item.
      expect(linePositions(p.line).length).toBeLessThanOrEqual(linePositions(ln).length);
      // The lever set opens the same item.
      expect(SKIP_LEVERS.simpler(c, { session: s, position: 0 }, SIMPLER_LEVER)).toEqual(p);
    }
    expect(built, `${type}: no simpler count was built`).toBeGreaterThan(0);
  });

  it('a count already the plainest and shortest has no simpler count', () => {
    const ln = line(10, 3);
    expect(practiceItem(item('c', 'count_along', ln), session([]))).toBeNull();
  });
});

describe('which lever answers which miss', () => {
  const ln = line(5);
  it.each([
    ['count_along', 'skipped_a_landing', TICK_NUMBERS, { showTrackLabels: false, showSequenceChips: false }],
    ['count_along', 'jumped_far', COUNT_TRAIL, { showTrackLabels: true, showSequenceChips: false }],
    ['predict', 'added_one', JUMP_SIZES, {}],
    ['predict', 'wrong_way', COUNT_TRAIL, { showSequenceChips: false }],
    ['fill_missing', 'near_miss', STEP_ARCS, {}],
    ['fill_missing', 'already_filled', RING_GAPS, {}],
    ['find_skip_value', 'one_short', HOP_DOTS, {}],
    ['find_skip_value', 'typed_a_landing', MODEL_COUNT, {}],
    ['connect_multiplication', 'counted_start', JUMP_MARKS, {}],
    ['connect_multiplication', 'typed_product', ARRAY_ROWS, {}],
  ] as const)('%s: %s -> %s', (type, miss, lever, showOptions) => {
    const c = item('c', type, ln);
    expect(nextLever(leversOn(c, session([c], { showOptions })), miss)).toBe(lever);
  });

  it('easy starts the self-check help shown (not a pull); hard starts every help released', () => {
    const c = item('c', 'find_skip_value', ln);
    expect(leversOn(c, session([c], { supportTier: 'easy' })).find(l => l.id === HOP_DOTS)?.pulled).toBe(true);
    expect(leversOn(c, session([c], { supportTier: 'hard' })).find(l => l.id === HOP_DOTS)?.pulled).toBe(false);
  });

  it('jump_sizes is offered on predict only once the character has jumped', () => {
    const c = item('c', 'predict', ln);
    expect(SKIP_LEVERS.declare(c, { session: session([c]), position: 15 }, []).map(l => l.id)).toContain(JUMP_SIZES);
    expect(SKIP_LEVERS.declare(c, { session: session([c]), position: 0 }, []).map(l => l.id)).not.toContain(JUMP_SIZES);
  });

  it('with every help pulled the next lever is the simpler count', () => {
    const c = item('c', 'predict', ln);
    expect(nextLever(leversOn(c, session([c]), [JUMP_SIZES, COUNT_TRAIL]), 'added_one')).toBe(SIMPLER_LEVER);
  });

  it('the model is a different count, and its support fact follows the item\'s tier', () => {
    const c = item('c', 'find_skip_value', ln);
    expect(SKIP_LEVERS.support({ ...c, supportTier: 'easy' })).toContain(MODEL_COUNT);
    expect(SKIP_LEVERS.support(item('p', 'predict', ln))).toBe('');
  });
});

describe('every card miss has a lever on every saved payload item', () => {
  const misses = getComponentById('skip-counting-runner')?.teachingWorkspace?.misses ?? {};
  it.each([along, predict, fill, find, connect].map(p => [p.evalMode, p] as const))('%s', (mode, payload) => {
    const d = payload.data as unknown as SkipCountingRunnerData;
    expect(misses[mode]).toEqual(SKIP_MISSES[mode as Type]);
    const items = skipItems(d);
    for (const c of items) {
      const levers = leversOn(c, session(items, { showOptions: d.showOptions, supportTier: d.supportTier }));
      for (const miss of misses[mode]) expect(levers.some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
    }
  });
});
