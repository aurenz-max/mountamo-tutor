/**
 * The counting board's spoken-kind levers (handoff 21 M1 spoken slice): which lever answers which miss, each lever's
 * leak rule, and the easier boards, on the saved generated payloads and on generated item shapes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { countingBoardSpokenMisses, itemFromChallenge, itemsFromChallenges, type CountingChallengeLike, type CountingItem }
  from './countingBoardDomain';
import { LINE_LEVER } from './countingBoardLevers';
import { CHANGE_ONE_LEVER, COUNT_ON_LEVER, FEWER_GROUPS_LEVER, FIVES_LEVER, GROUP_TAG_LEVER, ROWS_LEVER, SMALLER_SET_LEVER,
  countingBoardSpokenLevers, spokenLeverFacts, spokenPractice } from './countingBoardSpokenLevers';

const MODES = ['count', 'recount_moved', 'subitize', 'group', 'count_on', 'compare', 'take_away', 'add_more'];
const payload = (mode: string) => JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/counting-board.${mode}.json`), 'utf8')).data;
const itemsOf = (mode: string) => {
  const data = payload(mode);
  return { items: itemsFromChallenges(data.challenges, { objectWord: data.objectType ?? 'bears' }), data };
};
const item = (ch: Omit<CountingChallengeLike, 'id'>) => itemFromChallenge({ id: 'x', ...ch } as CountingChallengeLike, { objectWord: 'bears' })!;
const ids = (levers: { id: string }[]) => levers.map(l => l.id);

describe('which lever answers which miss', () => {
  it.each([
    [{ type: 'count_all', count: 9, targetAnswer: 9 }, 'scattered', 'skipped_a_number', LINE_LEVER],
    [{ type: 'count_all', count: 9, targetAnswer: 9 }, 'scattered', 'over_by_more', SMALLER_SET_LEVER],
    [{ type: 'count_on', count: 9, startFrom: 4, targetAnswer: 9 }, 'scattered', 'said_start', COUNT_ON_LEVER],
    [{ type: 'take_away', count: 8, changeBy: 3, targetAnswer: 5 }, 'scattered', 'said_change', CHANGE_ONE_LEVER],
    [{ type: 'add_more', count: 4, changeBy: 3, targetAnswer: 7 }, 'scattered', 'one_over', LINE_LEVER],
    [{ type: 'subitize', count: 4, targetAnswer: 4 }, 'scattered', 'one_short', FIVES_LEVER],
    [{ type: 'group_count', count: 15, groupSize: 5, targetAnswer: 15 }, 'groups', 'said_group_count', GROUP_TAG_LEVER],
    [{ type: 'group_count', count: 15, groupSize: 5, targetAnswer: 15 }, 'groups', 'short_by_more', FEWER_GROUPS_LEVER],
    [{ type: 'compare', count: 9, compareGroups: [4, 5], targetAnswer: 5 }, 'groups', 'smaller_group', ROWS_LEVER],
    [{ type: 'recount_moved', count: 8, targetAnswer: 8 }, 'scattered', 'one_over', LINE_LEVER],
    [{ type: 'recount_moved', count: 8, targetAnswer: 8 }, 'scattered', 'short_by_more', SMALLER_SET_LEVER],
    [{ type: 'recount_moved', count: 8, targetAnswer: 8 }, 'line', 'one_short', SMALLER_SET_LEVER],
  ])('%o on a %s board, after %s: %s', (ch, arrangement, miss, lever) => {
    expect(nextLever(countingBoardSpokenLevers(item(ch as never), [], arrangement, []), miss)).toBe(lever);
  });
  it('recount_moved: the row before the move and a smaller moving set; nothing on a set too small to halve', () => {
    expect(countingBoardSpokenLevers(item({ type: 'recount_moved', count: 6, targetAnswer: 6 }), [], 'scattered', [])
      .map(l => [l.id, l.kind])).toEqual([[LINE_LEVER, 'help'], [SMALLER_SET_LEVER, 'simplify']]);
    expect(countingBoardSpokenLevers(item({ type: 'recount_moved', count: 4, targetAnswer: 4 }), [], 'line', [])).toEqual([]);
  });
  it('recount_moved: the row fact holds only until the set has moved', () => {
    const r = item({ type: 'recount_moved', count: 6, targetAnswer: 6 });
    expect(spokenLeverFacts(r, [LINE_LEVER], { moved: false })).toMatch(/single row/);
    expect(spokenLeverFacts(r, [LINE_LEVER], { moved: true })).toBe('');
  });
  it('the gesture kinds declare no spoken levers', () => {
    expect(countingBoardSpokenLevers(item({ type: 'give_me_n', count: 8, targetAnswer: 3 }), [], 'scattered', [])).toEqual([]);
  });
  it('line_up is not offered on a board already in a row; tag_one_group only on a board that draws its groups', () => {
    expect(ids(countingBoardSpokenLevers(item({ type: 'count_all', count: 9, targetAnswer: 9 }), [], 'line', []))).not.toContain(LINE_LEVER);
    expect(ids(countingBoardSpokenLevers(item({ type: 'group_count', count: 15, groupSize: 5, targetAnswer: 15 }), [], 'scattered', [])))
      .not.toContain(GROUP_TAG_LEVER);
  });
  it("on every saved payload, each lever answers only its mode's catalog misses, and the rest are declared unanswered", () => {
    const entry = getComponentById('counting-board')!.teachingWorkspace!;
    for (const mode of MODES) {
      const { items, data } = itemsOf(mode);
      const answered = new Set(items.flatMap(i => countingBoardSpokenLevers(i,
        [], data.challenges.find((c: { id: string }) => c.id === i.id)?.arrangement ?? 'scattered', items).flatMap(l => l.answers ?? [])));
      const declared = entry.misses![mode];
      answered.forEach(m => expect(declared, mode).toContain(m));
      expect(declared.filter(m => !answered.has(m)).sort(), mode).toEqual([...(entry.unanswered?.[mode] ?? [])].sort());
    }
  });
});

describe('leak rules', () => {
  it('no scene fact carries a digit or the answer, on every saved payload with every lever pulled', () => {
    for (const mode of MODES) for (const i of itemsOf(mode).items) {
      const all = countingBoardSpokenLevers(i, [], 'scattered', []).map(l => l.id);
      expect(spokenLeverFacts(i, [...all, LINE_LEVER])).not.toMatch(/\d/);
    }
  });
});

describe('the easier boards', () => {
  const shapes: CountingItem[] = [];
  for (let n = 2; n <= 20; n++) {
    shapes.push(item({ type: 'count_all', count: n, targetAnswer: n }));
    for (let c = 1; c < n; c++) {
      const take = itemFromChallenge({ id: `t${n}-${c}`, type: 'take_away', count: n, changeBy: c, targetAnswer: n - c }, { objectWord: 'bears' });
      const add = itemFromChallenge({ id: `a${n}-${c}`, type: 'add_more', count: n, changeBy: c, targetAnswer: n + c }, { objectWord: 'bears' });
      const on = itemFromChallenge({ id: `o${n}-${c}`, type: 'count_on', count: n, startFrom: c, targetAnswer: n }, { objectWord: 'bears' });
      [take, add, on].forEach(x => { if (x) shapes.push(x); });
    }
    shapes.push(item({ type: 'recount_moved', count: n, targetAnswer: n }));
  }
  for (const size of [2, 5, 10]) for (let g = 2; g <= 5; g++)
    shapes.push(item({ type: 'group_count', count: size * g, groupSize: size, targetAnswer: size * g }));

  it('each is the same kind, a new answer (no session answer where one is free), passes the item gate, and is simpler in shape', () => {
    let built = 0;
    for (const source of shapes) for (const lever of [SMALLER_SET_LEVER, CHANGE_ONE_LEVER, COUNT_ON_LEVER, FEWER_GROUPS_LEVER]) {
      const other = { ...source, id: 'other', target: source.target + 1 };
      const easier = spokenPractice(source, lever, [other]);
      if (!easier) continue;
      built++;
      const p = easier.item;
      expect(p.kind).toBe(source.kind);
      expect(p.id).toBe(`${source.id}~simpler`);
      expect(p.target).not.toBe(source.target);
      // Another session answer only when no simpler board avoids all of them.
      if (p.target === other.target) expect(spokenPractice(source, lever, [])!.item.target).toBe(other.target);
      expect(countingBoardSpokenMisses(p).length).toBeGreaterThan(0);
      if (lever === SMALLER_SET_LEVER) expect(p.count).toBeLessThanOrEqual(Math.ceil(source.count / 2));
      // A moving set of three or more: the move is still something to see past.
      if (source.kind === 'recount_moved') expect([p.count, p.target === p.count, p.count >= 3]).toEqual([p.count, true, true]);
      if (lever === CHANGE_ONE_LEVER) expect(p.changeBy).toBe(1);
      if (lever === COUNT_ON_LEVER) expect([p.startFrom, p.target - (p.startFrom ?? 0)]).toEqual([source.startFrom, 2]);
      if (lever === FEWER_GROUPS_LEVER) expect([p.groupSize, p.count / (p.groupSize ?? 1)]).toEqual([source.groupSize, 2]);
    }
    expect(built).toBeGreaterThan(200);
  });
});
