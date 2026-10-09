import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { itemFromChallenge, publicValuesFor, storyLeaksAnswer, type AddSubSceneItem } from './additionSubtractionSceneScript';
import { addSubMiss } from './additionSubtractionSceneWorkspace';
import {
  FRAME_LEVER, GROUPS_LEVER, SIMPLER_LEVER, addSubLevers, departedSlots, frameBoxes, groupLayout, groupsFact, groupsLeak,
  isPlainest, practiceLeaks, practiceParent, smallerStory,
} from './additionSubtractionSceneLevers';

const item = (over: Record<string, unknown>, band: 'K' | '1' = 'K'): AddSubSceneItem => itemFromChallenge({
  id: 'c1', type: 'act-out', storyText: 'Two ducks swim in the pond. Three more ducks come.', scene: 'pond', objectType: 'ducks',
  operation: 'addition', startCount: 2, changeCount: 3, resultCount: 5, ...over,
} as never, { band })!;
const ctx = (items: AddSubSceneItem[], maxNumber = 5) => ({ items, maxNumber });

describe('story_groups', () => {
  it('is never offered where the pen would set the answer apart as a group (solve-story change or start)', () => {
    for (const unknownPosition of ['change', 'start'] as const) {
      const it_ = item({ type: 'solve-story', unknownPosition, storyText: 'Some ducks swim. Some more come. Now there are five ducks.' }, '1');
      expect(groupsLeak(it_)).toBe(true);
      expect(addSubLevers(it_, [], ctx([it_], 10)).map(l => l.id)).not.toContain(GROUPS_LEVER);
    }
    const result = item({ type: 'solve-story', unknownPosition: 'result' }, '1');
    expect(addSubLevers(result, [], ctx([result], 10)).map(l => l.id)).toContain(GROUPS_LEVER);
  });

  it('lays out exactly the start group inside the pen and the rest to its right', () => {
    for (const [start, capacity] of [[1, 5], [3, 5], [4, 10], [10, 20], [15, 20]]) {
      const { pen, positions } = groupLayout(start, capacity, 220);
      expect(positions).toHaveLength(capacity);
      const inside = positions.map(p => p.x > pen.x && p.x < pen.x + pen.w && p.y > pen.y && p.y < pen.y + pen.h);
      expect(inside).toEqual(positions.map((_, i) => i < start));
      positions.forEach(p => { expect(p.x).toBeLessThan(480); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(220); });
    }
  });

  it('draws faded outlines only where an object went away; an empty create-story pen draws none', () => {
    const minus = item({ operation: 'subtraction', startCount: 4, changeCount: 2, resultCount: 2, storyText: 'Four ducks swim. Two go away.' });
    expect(departedSlots(minus, [0, 1, 2, 3])).toEqual([]);
    expect(departedSlots(minus, [0, 3])).toEqual([1, 2]);
    const create = item({ type: 'create-story', storyText: '' });
    expect(departedSlots(create, [])).toEqual([]);
    // A count-driven picture: the ones that went away are the slots past the end count.
    const counted = item({ type: 'build-equation', operation: 'subtraction', startCount: 4, changeCount: 2, resultCount: 2,
      storyText: 'Four ducks swim. Two go away.' }, '1');
    expect(departedSlots(counted, [])).toEqual([2, 3]);
  });

  it('its fact names what is drawn and never the number the learner must make', () => {
    const plus = item({});
    expect(groupsFact(plus)).toMatch(/two ducks there at the start .* pen/);
    expect(groupsFact(plus)).not.toMatch(/\b5\b|five/);
    const minus = item({ type: 'build-equation', operation: 'subtraction', startCount: 4, changeCount: 2, resultCount: 2,
      storyText: 'Four ducks swim. Two go away.' }, '1');
    expect(groupsFact(minus)).toMatch(/faded outlines/);
    const create = item({ type: 'create-story', storyText: '' });
    expect(groupsFact(create)).toMatch(/empty dashed pen/);
    expect(groupsFact(create)).not.toMatch(/\b[0-9]\b|two|three|five/);
  });
});

describe('sentence_frame', () => {
  it('fills boxes only with the learner\'s own tiles, in order', () => {
    expect(frameBoxes([]).map(b => b.tile)).toEqual([null, null, null, null, null]);
    expect(frameBoxes(['2', '+']).map(b => [b.shape, b.tile])).toEqual([['number', '2'], ['sign', '+'], ['number', null],
      ['sign', null], ['number', null]]);
  });
  it('is offered on build_equation only', () => {
    const eq = item({ type: 'build-equation' }, '1');
    expect(addSubLevers(eq, [], ctx([eq], 10)).map(l => l.id)).toContain(FRAME_LEVER);
    expect(addSubLevers(item({}), [], ctx([item({})])).map(l => l.id)).not.toContain(FRAME_LEVER);
  });
});

describe('smaller_story', () => {
  const kinds = [['act-out', 'K'], ['act-out', '1'], ['create-story', 'K'], ['build-equation', '1'], ['solve-story', '1']] as const;

  it.each(kinds)('%s @%s: over every story in band, the practice keeps mode and operation, is smaller, and never leaks', (type, band) => {
    const max = band === 'K' ? 5 : 10;
    let built = 0;
    for (const operation of ['addition', 'subtraction'] as const) for (let s = 0; s <= max; s++) for (let c = 1; c <= max; c++)
      for (const unknownPosition of type === 'solve-story' ? ['result', 'change', 'start'] as const : ['result'] as const) {
        const r = operation === 'addition' ? s + c : s - c;
        if (r < 0 || r > max) continue;
        const story = `There are ${s} ducks in the pond. ${c} ${operation === 'addition' ? 'more come' : 'go away'}.`
          .replace(new RegExp(`\\b${r}\\b`), 'some');
        const src = itemFromChallenge({ id: 'x', type, storyText: type === 'create-story' ? '' : story, scene: 'pond', objectType: 'ducks',
          operation, startCount: s, changeCount: c, resultCount: r, unknownPosition } as never, { band });
        if (!src) continue;
        const p = smallerStory(src, ctx([src], max));
        if (isPlainest(src)) { expect(p).toBeNull(); continue; }
        if (!p) continue;
        built++;
        expect(p.id).toBe('x~simpler');
        expect([p.kind, p.operation, p.band, p.answerKind, p.unknownPosition]).toEqual([src.kind, src.operation, src.band, src.answerKind, 'result']);
        expect(p.changeCount).toBe(1);
        expect(p.resultCount).toBe(operation === 'addition' ? p.startCount + 1 : p.startCount - 1);
        expect(p.answer).toBe(p.resultCount);
        expect(Math.max(p.startCount, p.resultCount)).toBeLessThanOrEqual(Math.max(src.startCount, src.resultCount));
        expect(practiceLeaks(p, src, [src])).toBe(false);
        expect(p.answer).not.toBe(src.answer);
        if (p.kind !== 'create-story') expect(storyLeaksAnswer(p.situation, p.answer, publicValuesFor(p))).toBe(false);
        // A rebuilt practice story is a valid item of the same mode.
        expect(itemFromChallenge({ ...p, type: p.kind, storyText: p.situation || '' } as never, { band })).not.toBeNull();
      }
    expect(built).toBeGreaterThan(3);
  });

  it('never says the number the item hides, and never repeats another item\'s story', () => {
    const src = item({ type: 'solve-story', unknownPosition: 'change', startCount: 4, changeCount: 3, resultCount: 7,
      storyText: 'Four ducks swim. Some more come. Now there are seven ducks.' }, '1');
    const p = smallerStory(src, ctx([src], 10))!;
    expect([p.startCount, p.changeCount, p.resultCount]).not.toContain(3);
    const taken = { ...p, id: 'other' };
    const p2 = smallerStory(src, ctx([src, taken], 10))!;
    expect(p2.startCount).not.toBe(p.startCount);
    expect(practiceParent(p.id, [src])).toBe(src);
  });

  it('is not offered on the plainest shape', () => {
    const plain = item({ startCount: 2, changeCount: 1, resultCount: 3, storyText: 'Two ducks swim. One more comes.' });
    expect(addSubLevers(plain, [], ctx([plain])).map(l => l.id)).toEqual([GROUPS_LEVER]);
  });
});

describe('the miss, then the lever', () => {
  const k = item({ startCount: 2, changeCount: 3, resultCount: 5 });
  it.each([
    [1, 'wrong_way'], [2, 'no_change'], [4, 'one_short'], [6, 'one_over'], [3, 'short_by_more'],
  ] as const)('a K picture of %i names %s, and story_groups answers it', (placed, miss) => {
    expect(addSubMiss(k, { placed })).toBe(miss);
    expect(nextLever(addSubLevers(k, [], ctx([k])), miss)).toBe(GROUPS_LEVER);
  });

  const eq = item({ type: 'build-equation', startCount: 2, changeCount: 3, resultCount: 5 }, '1');
  it.each([
    [['2', '+'], 'unfinished_equation', FRAME_LEVER], [['5', '-', '3', '=', '2'], 'other_operation', GROUPS_LEVER],
    [['2', '+', '3', '=', '6'], 'false_equation', GROUPS_LEVER], [['1', '+', '4', '=', '5'], 'other_numbers', GROUPS_LEVER],
  ] as const)('a number sentence %j names %s, and %s answers it', (tiles, miss, lever) => {
    expect(addSubMiss(eq, { tiles })).toBe(miss);
    expect(nextLever(addSubLevers(eq, [], ctx([eq], 10)), miss)).toBe(lever);
  });

  it('a spoken story asking for the change answers its misses with the smaller story', () => {
    const src = item({ type: 'solve-story', unknownPosition: 'change', startCount: 4, changeCount: 3, resultCount: 7,
      storyText: 'Four ducks swim. Some more come. Now there are seven ducks.' }, '1');
    for (const miss of ['said_start', 'said_result', 'other_operation', 'one_short'])
      expect(nextLever(addSubLevers(src, [], ctx([src], 10)), miss)).toBe(SIMPLER_LEVER);
  });

  it('a pulled lever is not offered again', () => {
    expect(nextLever(addSubLevers(k, [GROUPS_LEVER], ctx([k])), 'one_short')).toBe(SIMPLER_LEVER);
  });
});
