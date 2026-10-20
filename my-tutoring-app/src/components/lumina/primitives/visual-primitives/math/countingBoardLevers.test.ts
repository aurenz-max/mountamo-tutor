/**
 * The counting-board lever set (handoff 21 M1, `bossLevers.ts`): which lever answers which miss, and each lever's
 * leak rule, held on the saved generated payloads and on every small board the generator can draw. The board's own
 * checks first (handover, build, hand match), then the spoken kinds.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { countingBoardSpokenMisses, itemFromChallenge, itemsFromChallenges, numberWordFor, type CountingChallengeLike, type CountingItem }
  from './countingBoardDomain';
import { CHANGE_ONE_LEVER, COUNTING_LEVERS, COUNT_LEVER, COUNT_ON_LEVER, FEWER_GROUPS_LEVER, FIVES_LEVER, GROUP_TAG_LEVER, HANDS,
  HANDS_LEVER, LINE_LEVER, PAIR_LEVER, ROWS_LEVER, SMALLER_LEVER, SMALLER_SET_LEVER, TAGS_LEVER, droppedHand, pairedHand,
  practiceFromId, smallerGive, spokenPractice, startLevers } from './countingBoardLevers';

const ctxOf = (pulled: readonly string[], arrangement: string, missed: number | null = null, session: readonly CountingItem[] = [],
  moved = false) => ({ pulled, arrangement, missed, session, moved });
/** The levers an item declares, as the component asks the set for them. */
const countingBoardLevers = (item: CountingItem, pulled: readonly string[], arrangement: string, missed?: number | null,
  session: readonly CountingItem[] = []) => COUNTING_LEVERS.declare(item, ctxOf(pulled, arrangement, missed ?? null, session), pulled);
/** The scene fact while these levers are pulled. */
const leverFacts = (item: CountingItem, pulled: readonly string[], moved = false) =>
  COUNTING_LEVERS.onScreen(item, ctxOf(pulled, 'scattered', null, [], moved), pulled);

const payload = (mode: string) => JSON.parse(readFileSync(join(process.cwd(),
  `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/counting-board.${mode}.json`), 'utf-8')).data;
const saved = (mode: string) => { const d = payload(mode);
  return { items: itemsFromChallenges(d.challenges, { objectWord: d.objects.word ?? 'bears' }), challenges: d.challenges as { id: string; arrangement: string }[] }; };
const give = (target: number, count: number): CountingItem => itemsFromChallenges([{ id: 'g', type: 'give_me_n', count, targetAnswer: target }],
  { objectWord: 'bears' })[0];
const hand = (target: number): CountingItem => itemsFromChallenges([{ id: 'h', type: 'subitize_perceptual', count: target, targetAnswer: target }],
  { objectWord: 'bears' })[0];
const ids = (levers: { id: string }[]) => levers.map(l => l.id);

describe('which lever answers which miss (nextLever over the declared levers)', () => {
  it.each([
    ['one_short', COUNT_LEVER], ['one_over', COUNT_LEVER], ['gave_all', COUNT_LEVER],
    ['short_by_more', TAGS_LEVER], ['over_by_more', TAGS_LEVER], [undefined, COUNT_LEVER],
  ])('give_me_n, nothing pulled: after %s, %s', (miss, lever) => {
    expect(nextLever(countingBoardLevers(give(4, 8), [], 'scattered'), miss)).toBe(lever);
  });
  it('give_me_n, both counting aids already on (the easy tier): a lost count gets the row, then the easier ask', () => {
    const levers = countingBoardLevers(give(4, 8), [COUNT_LEVER, TAGS_LEVER], 'scattered');
    expect(nextLever(levers, 'short_by_more')).toBe(LINE_LEVER);
    expect(nextLever(countingBoardLevers(give(4, 8), [COUNT_LEVER, TAGS_LEVER, LINE_LEVER], 'scattered'), 'gave_all')).toBe(SMALLER_LEVER);
    expect(nextLever(levers, 'one_over', 'simplify')).toBe(SMALLER_LEVER);
  });
  it.each([
    [1, 'over_by_more', HANDS_LEVER], [3, 'short_by_more', HANDS_LEVER], [2, 'one_over', LINE_LEVER], [3, 'one_short', LINE_LEVER],
  ])('a hand match of %i, after %s: %s', (target, miss, lever) => {
    expect(nextLever(countingBoardLevers(hand(target), [], 'scattered'), miss)).toBe(lever);
  });
  it('a spoken count declares only its own levers, none of the board-check ones', () => {
    const count = itemsFromChallenges([{ id: 'c', type: 'count_all', count: 5, targetAnswer: 5 }], { objectWord: 'bears' })[0];
    expect(ids(countingBoardLevers(count, [], 'scattered'))).toEqual([LINE_LEVER, SMALLER_SET_LEVER]);
  });
});

describe('leak rules', () => {
  const boards = Array.from({ length: 5 }, (_, i) => i + 2).flatMap(target =>
    Array.from({ length: 6 }, (_, j) => give(target, target + 1 + j)));

  it.each(boards.map(b => [b.target, b.count, b] as const))('smaller_give on %i from %i: a new id, never the ask, at least 2, less than the pile', (_t, _c, item) => {
    const easier = smallerGive(item);
    if (item.target < 3) { expect(easier).toBeNull(); return; }
    expect(easier).toMatchObject({ kind: 'give_me_n', count: item.count, id: `${item.id}~smaller` });
    expect(easier!.target).not.toBe(item.target);
    expect(easier!.target).toBeGreaterThanOrEqual(2);
    expect(easier!.target).toBeLessThan(item.count);
    expect(ids(countingBoardLevers(item, [], 'scattered')).includes(SMALLER_LEVER)).toBe(!!easier);
  });

  it.each([1, 2, 3])('two_hands on a group of %i never takes the matching hand, and leaves two', target => {
    const dropped = droppedHand(hand(target));
    if (target === 2) { expect(dropped).toBeNull(); return; }
    expect(dropped).not.toBe(target);
    expect(HANDS.filter(h => h !== dropped)).toContain(target);
    expect(HANDS.filter(h => h !== dropped)).toHaveLength(2);
  });

  it('the row is not offered when the pile is already a row, or one object', () => {
    expect(ids(countingBoardLevers(give(4, 8), [], 'line'))).not.toContain(LINE_LEVER);
    expect(ids(countingBoardLevers(hand(1), [], 'scattered'))).not.toContain(LINE_LEVER);
  });

  it('the scene facts for every pulled lever name no number at all', () => {
    for (const item of [...boards, hand(1), hand(2), hand(3)]) {
      const facts = leverFacts(item, [COUNT_LEVER, TAGS_LEVER, LINE_LEVER, HANDS_LEVER, SMALLER_LEVER, PAIR_LEVER]);
      expect(facts).not.toMatch(/\d/);
      for (let n = 1; n <= 20; n++) expect(facts.toLowerCase()).not.toMatch(new RegExp(`\\b${numberWordFor(n)}\\b`));
    }
  });

  it('what each lever says it does names no number', () => {
    for (const item of [...boards, hand(1), hand(2), hand(3)]) for (const l of countingBoardLevers(item, [], 'scattered', item.target === 1 ? 2 : 1))
      // Pre-numeric hand matches carry no number word at all: the tutor repeats a lever's words (replay 09-28).
      expect(`${l.when} ${l.does}`).not.toMatch(item.kind === 'subitize_perceptual' ? /\d|\b(one|two|three)\b/i : /\d|\b(two|three|four|five|six)\b/i);
  });
});

describe('on the saved generated payloads', () => {
  it('give_me_n: the tier starts both counting aids pulled, and every item still has an open help lever or an easier ask', () => {
    const { items, challenges } = saved('give_me_n');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const start = startLevers(item, payload('give_me_n').showOptions);
      expect(start).toEqual([COUNT_LEVER, TAGS_LEVER]);
      const arrangement = challenges.find(c => c.id === item.id)!.arrangement;
      const open = countingBoardLevers(item, start, arrangement).filter(l => !l.pulled);
      expect(open.length, `${item.id} (${arrangement})`).toBeGreaterThan(0);
      const easier = smallerGive(item);
      if (easier) expect(easier.target).not.toBe(item.target);
    }
  });

  it('subitize_perceptual: every item offers a help lever, and none states the group', () => {
    const { items, challenges } = saved('subitize_perceptual');
    for (const item of items) {
      const levers = countingBoardLevers(item, [], challenges.find(c => c.id === item.id)!.arrangement);
      expect(levers.every(l => l.kind === 'help'), item.id).toBe(true);
      if (droppedHand(item) !== null) expect(droppedHand(item)).not.toBe(item.target);
    }
  });
});

// ── pair_up: a hand one off on every hand-match item (J12 queue row, 2026-10-09) ──
describe('pair_up', () => {
  const oneOff = HANDS.flatMap(target => HANDS.filter(h => Math.abs(h - target) === 1).map(picked => [target, picked] as const));

  it.each(oneOff)('a group of %i, after the hand of %i: pair_up answers it, in any arrangement', (target, picked) => {
    const miss = picked > target ? 'one_over' : 'one_short';
    for (const arrangement of ['scattered', 'line', 'groups']) {
      const levers = countingBoardLevers(hand(target), [], arrangement, picked);
      expect(levers.some(l => l.id === PAIR_LEVER && l.answers?.includes(miss)), `${arrangement}`).toBe(true);
      // Where the row can change the board it comes first; on a single object or a row, pair_up is next.
      expect(nextLever(levers, miss)).toBe(lineUpOffered(target, arrangement) ? LINE_LEVER : PAIR_LEVER);
    }
  });
  const lineUpOffered = (target: number, arrangement: string) => target > 1 && arrangement !== 'line';

  it.each(HANDS.flatMap(target => [null, ...HANDS].map(picked => [target, picked] as const)))(
    'leak rule: a group of %i, picked %s: drawn only for a wrong pick, never the matching hand', (target, picked) => {
      const paired = pairedHand(hand(target), picked);
      expect(paired).toBe(picked !== null && picked !== target ? picked : null);
      expect(ids(countingBoardLevers(hand(target), [], 'scattered', picked)).includes(PAIR_LEVER)).toBe(paired !== null);
    });

  it('only on hand matches', () => {
    expect(pairedHand(give(4, 8), 3)).toBeNull();
    expect(ids(countingBoardLevers(give(4, 8), [], 'scattered', 3))).not.toContain(PAIR_LEVER);
  });

  it('the saved payload: every item where a one-off hand exists has a lever answering it (c1, c4 were the J12 gaps)', () => {
    const { items, challenges } = saved('subitize_perceptual');
    for (const item of items) for (const picked of HANDS.filter(h => Math.abs(h - item.target) === 1)) {
      const levers = countingBoardLevers(item, [], challenges.find(c => c.id === item.id)!.arrangement, picked);
      const miss = picked > item.target ? 'one_over' : 'one_short';
      expect(levers.some(l => l.answers?.includes(miss)), `${item.id} picked ${picked}`).toBe(true);
    }
  });
});

// ── build_n (open build: the learner puts the set in an empty scene) ─────────
describe('build_n', () => {
  const build = (target: number): CountingItem => itemsFromChallenges([{ id: `b${target}`, type: 'build_n', count: target, targetAnswer: target }],
    { objectWord: 'bears' })[0];
  const builds = Array.from({ length: 20 }, (_, i) => build(i + 1));

  it.each([
    ['one_short', COUNT_LEVER], ['one_over', COUNT_LEVER], ['short_by_more', TAGS_LEVER], ['over_by_more', TAGS_LEVER],
  ])('nothing pulled: after %s, %s', (miss, lever) => {
    expect(nextLever(countingBoardLevers(build(7), [], 'scattered'), miss)).toBe(lever);
  });
  it('with both counting aids pulled, a far miss gets the easier build; no row on an empty scene', () => {
    const levers = countingBoardLevers(build(7), [COUNT_LEVER, TAGS_LEVER], 'scattered');
    expect(ids(levers)).toEqual([COUNT_LEVER, TAGS_LEVER, SMALLER_LEVER]);
    expect(nextLever(levers, 'over_by_more')).toBe(SMALLER_LEVER);
  });
  it('starts bare whatever the tier says: keeping count of what is put in is the task', () => {
    expect(startLevers(build(7), { showRunningCount: true, showLastNumber: true })).toEqual([]);
  });
  it.each(builds.map(b => [b.target, b] as const))('the easier build for %i: a new id, never the ask, at least 2, an empty scene of its own size', (_t, item) => {
    const easier = smallerGive(item);
    if (item.target < 3) { expect(easier).toBeNull(); expect(ids(countingBoardLevers(item, [], 'scattered'))).not.toContain(SMALLER_LEVER); return; }
    expect(easier).toMatchObject({ kind: 'build_n', id: `${item.id}~smaller`, count: easier!.target });
    expect(easier!.target).not.toBe(item.target);
    expect(easier!.target).toBeGreaterThanOrEqual(2);
    expect(easier!.target).toBeLessThan(item.target);
  });
  it('no lever text or scene fact names a number', () => {
    for (const item of builds) {
      const facts = leverFacts(item, [COUNT_LEVER, TAGS_LEVER, SMALLER_LEVER]);
      expect(facts).toMatch(/put in/);
      expect(facts).not.toMatch(/\d/);
      for (let n = 1; n <= 20; n++) expect(facts.toLowerCase()).not.toMatch(new RegExp(`\b${numberWordFor(n)}\b`));
      for (const l of countingBoardLevers(item, [], 'scattered')) expect(`${l.when} ${l.does}`).not.toMatch(/\d|\b(two|three|four|five|six)\b/i);
    }
  });
});

// ── The spoken kinds (handoff 21 M1 spoken slice) ────────────────────────────
const SPOKEN_MODES = ['count', 'recount_moved', 'subitize', 'group', 'count_on', 'compare', 'take_away', 'add_more'];
const spokenItems = (mode: string) => {
  const data = payload(mode);
  return { items: itemsFromChallenges(data.challenges, { objectWord: data.objectType ?? 'bears' }), data };
};
const spoken = (ch: Omit<CountingChallengeLike, 'id'>) => itemFromChallenge({ id: 'x', ...ch } as CountingChallengeLike, { objectWord: 'bears' })!;

describe('spoken kinds: which lever answers which miss', () => {
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
    expect(nextLever(countingBoardLevers(spoken(ch as never), [], arrangement), miss)).toBe(lever);
  });
  it('recount_moved: the row before the move and a smaller moving set; nothing on a set too small to halve', () => {
    expect(countingBoardLevers(spoken({ type: 'recount_moved', count: 6, targetAnswer: 6 }), [], 'scattered')
      .map(l => [l.id, l.kind])).toEqual([[LINE_LEVER, 'help'], [SMALLER_SET_LEVER, 'simplify']]);
    expect(countingBoardLevers(spoken({ type: 'recount_moved', count: 4, targetAnswer: 4 }), [], 'line')).toEqual([]);
  });
  it('recount_moved: the row fact holds only until the set has moved', () => {
    const r = spoken({ type: 'recount_moved', count: 6, targetAnswer: 6 });
    expect(leverFacts(r, [LINE_LEVER], false)).toMatch(/single row/);
    expect(leverFacts(r, [LINE_LEVER], true)).toBe('');
  });
  it('give_me_n declares none of the spoken levers', () => {
    const spokenIds = [FIVES_LEVER, GROUP_TAG_LEVER, ROWS_LEVER, SMALLER_SET_LEVER, CHANGE_ONE_LEVER, COUNT_ON_LEVER, FEWER_GROUPS_LEVER];
    expect(ids(countingBoardLevers(spoken({ type: 'give_me_n', count: 8, targetAnswer: 3 }), [], 'scattered'))
      .filter(id => spokenIds.includes(id))).toEqual([]);
  });
  it('line_up is not offered on a board already in a row; tag_one_group only on a board that draws its groups', () => {
    expect(ids(countingBoardLevers(spoken({ type: 'count_all', count: 9, targetAnswer: 9 }), [], 'line'))).not.toContain(LINE_LEVER);
    expect(ids(countingBoardLevers(spoken({ type: 'group_count', count: 15, groupSize: 5, targetAnswer: 15 }), [], 'scattered')))
      .not.toContain(GROUP_TAG_LEVER);
  });
  it('on every saved payload, each lever answers only its mode misses, and the rest are declared unanswered', () => {
    const entry = getComponentById('counting-board')!.teachingWorkspace!;
    for (const mode of SPOKEN_MODES) {
      const { items, data } = spokenItems(mode);
      const answered = new Set(items.flatMap(i => countingBoardLevers(i,
        [], data.challenges.find((c: { id: string }) => c.id === i.id)?.arrangement ?? 'scattered', null, items).flatMap(l => l.answers ?? [])));
      const declared = entry.misses![mode];
      answered.forEach(m => expect(declared, mode).toContain(m));
      expect(declared.filter(m => !answered.has(m)).sort(), mode).toEqual([...(entry.unanswered?.[mode] ?? [])].sort());
    }
  });
  it('no scene fact carries a digit, on every saved payload with every lever pulled', () => {
    for (const mode of SPOKEN_MODES) for (const i of spokenItems(mode).items) {
      const all = countingBoardLevers(i, [], 'scattered').map(l => l.id);
      expect(leverFacts(i, [...all, LINE_LEVER])).not.toMatch(/\d/);
    }
  });
});

describe('the easier spoken boards', () => {
  const shapes: CountingItem[] = [];
  for (let n = 2; n <= 20; n++) {
    shapes.push(spoken({ type: 'count_all', count: n, targetAnswer: n }));
    for (let c = 1; c < n; c++) {
      const take = itemFromChallenge({ id: `t${n}-${c}`, type: 'take_away', count: n, changeBy: c, targetAnswer: n - c }, { objectWord: 'bears' });
      const add = itemFromChallenge({ id: `a${n}-${c}`, type: 'add_more', count: n, changeBy: c, targetAnswer: n + c }, { objectWord: 'bears' });
      const on = itemFromChallenge({ id: `o${n}-${c}`, type: 'count_on', count: n, startFrom: c, targetAnswer: n }, { objectWord: 'bears' });
      [take, add, on].forEach(x => { if (x) shapes.push(x); });
    }
    shapes.push(spoken({ type: 'recount_moved', count: n, targetAnswer: n }));
  }
  for (const size of [2, 5, 10]) for (let g = 2; g <= 5; g++)
    shapes.push(spoken({ type: 'group_count', count: size * g, groupSize: size, targetAnswer: size * g }));

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
      // The set opens the board the lever builds.
      expect(COUNTING_LEVERS.simpler(source, ctxOf([], 'scattered', null, [other]), lever)).toEqual(p);
    }
    expect(built).toBeGreaterThan(200);
  });

  it('the journey rebuilds a practice item from its id, as the lever built it', () => {
    const g = give(6, 9);
    expect(practiceFromId(`${g.id}~smaller`, [g])).toEqual(smallerGive(g));
    const c = spoken({ type: 'count_all', count: 9, targetAnswer: 9 });
    expect(practiceFromId(`${c.id}~simpler`, [c])).toEqual(spokenPractice(c, SMALLER_SET_LEVER, [c])!.item);
    expect(practiceFromId('nope~smaller', [g])).toBeNull();
  });
});
