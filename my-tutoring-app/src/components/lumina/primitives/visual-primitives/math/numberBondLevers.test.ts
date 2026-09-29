/**
 * The number-bond levers (handoff 21 M1, slice 1): which lever answers which miss, and each lever's leak rule.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { buildBondItems, type NumberBondItem } from './numberBondScript';
import { expandNumberBondInteractions } from './numberBondModes';
import { getComponentById } from '../../../service/manifest/catalog';
import { COUNTERS_LEVER, FRAME_LEVER, MOVE_LEVER, SMALLER_LEVER, WAYS_LEVER, leverFacts, madeWaysOrder, numberBondLevers,
  smallerTeen } from './numberBondLevers';

const items = (challenges: object[], band: 'K' | '1' = 'K', maxNumber = 19) =>
  expandNumberBondInteractions(buildBondItems(challenges as never, { band, maxNumber }).items);
const teen = (whole: number) => items([{ id: `t${whole}`, type: 'ten-and-ones', whole }]).find(i => i.splitPhase === 'build')!;
const decompose = items([{ id: 'd', type: 'decompose', whole: 5, allPairs: [[0, 5], [1, 4], [2, 3]] }], 'K', 5)
  .find(i => i.splitPhase === 'build')!;
const related = items([{ id: 'r', type: 'related-fact', whole: 5, part1: 1, part2: 4 }], 'K', 5);
const missing = items([{ id: 'm', type: 'missing-part', whole: 4, part1: 1 }], 'K', 5)[0];
const none = { pairsMade: 0, countersOpen: false };
const ids = (l: { id: string }[]) => l.map(x => x.id);

describe('which lever answers which miss', () => {
  it.each([
    ['ten_one_off', FRAME_LEVER], ['no_full_ten', FRAME_LEVER], [undefined, FRAME_LEVER],
  ])('ten_and_ones on fourteen, after %s: %s', (miss, lever) => {
    expect(nextLever(numberBondLevers(teen(14), [], none), miss)).toBe(lever);
  });
  it('ten_and_ones: with the frame pulled, a split with no ten gets the easier teen next', () => {
    expect(nextLever(numberBondLevers(teen(14), [FRAME_LEVER], none), 'no_full_ten')).toBe(SMALLER_LEVER);
  });
  it('decompose: the ways already made answer a repeated way, once a way exists', () => {
    expect(numberBondLevers(decompose, [], none)).toEqual([]);
    expect(nextLever(numberBondLevers(decompose, [], { pairsMade: 1, countersOpen: false }), 'same_way_again')).toBe(WAYS_LEVER);
  });
  it('related_fact: the move steps offer show_move; the spoken steps offer the frame of the whole', () => {
    for (const item of related) {
      const moves = item.interactionPhase === 'related-join' || item.interactionPhase === 'related-separate';
      expect(ids(numberBondLevers(item, [], none))).toEqual(moves ? [MOVE_LEVER] : [FRAME_LEVER]);
    }
    expect(nextLever(numberBondLevers(related.find(i => i.interactionPhase === 'related-join')!, [], none), 'other_move')).toBe(MOVE_LEVER);
  });
  it('missing_part: the counters tray, only while it is closed', () => {
    expect(ids(numberBondLevers(missing, [], none))).toEqual([COUNTERS_LEVER]);
    expect(numberBondLevers(missing, [], { pairsMade: 0, countersOpen: true })).toEqual([]);
  });
});

describe('the spoken turns (M1 spoken slice)', () => {
  const say = (kind: string, challenge: object, band: 'K' | '1' = 'K') => items([challenge], band, 19)
    .filter(i => i.answerKind !== 'gesture' && i.kind === kind);
  it.each([
    ['decompose', { id: 'd', type: 'decompose', whole: 5, allPairs: [[1, 4]] }, ['said_whole', 'one_over']],
    ['ten-and-ones', { id: 't', type: 'ten-and-ones', whole: 14 }, ['said_ten', 'said_whole', 'short_by_more']],
    ['related-fact', { id: 'r', type: 'related-fact', whole: 5, part1: 1, part2: 4 }, ['said_change', 'added_both', 'one_short']],
  ])('%s say turns: the frame answers every spoken miss', (kind, challenge, misses) => {
    const turns = say(kind, challenge);
    expect(turns.length).toBeGreaterThan(0);
    for (const item of turns) for (const miss of misses) expect(nextLever(numberBondLevers(item, [], none), miss)).toBe(FRAME_LEVER);
  });
  it.each(['said_given_part', 'said_whole', 'added_both', 'over_by_more'])('missing_part, after %s: the counters tray', miss => {
    expect(nextLever(numberBondLevers(missing, [], none), miss)).toBe(COUNTERS_LEVER);
  });
  it("every lever's answers are catalog misses of its mode, and every other catalog miss is declared unanswered", () => {
    const entry = getComponentById('number-bond')!.teachingWorkspace!;
    const modes: Record<string, object[]> = {
      decompose: [{ id: 'd', type: 'decompose', whole: 5, allPairs: [[0, 5], [1, 4], [2, 3]] }],
      ten_and_ones: [{ id: 't', type: 'ten-and-ones', whole: 14 }],
      missing_part: [{ id: 'm', type: 'missing-part', whole: 4, part1: 1 }],
      related_fact: [{ id: 'r', type: 'related-fact', whole: 5, part1: 1, part2: 4 }],
    };
    for (const [mode, challenges] of Object.entries(modes)) {
      const answered = new Set(items(challenges, 'K', 19).flatMap(i => numberBondLevers(i, [], { pairsMade: 1, countersOpen: false })
        .flatMap(l => l.answers ?? [])));
      const declared = entry.misses![mode];
      answered.forEach(m => expect(declared, mode).toContain(m));
      expect(declared.filter(m => !answered.has(m)).sort(), mode).toEqual([...(entry.unanswered?.[mode] ?? [])].sort());
    }
  });
});

describe('leak rules', () => {
  it.each([11, 12, 13, 14, 15, 16, 17, 18, 19])('smaller_teen on %i: eleven as a new item, never the item, none at twelve or below', whole => {
    const easier = smallerTeen(teen(whole));
    if (whole <= 12) { expect(easier).toBeNull(); expect(ids(numberBondLevers(teen(whole), [], none))).not.toContain(SMALLER_LEVER); return; }
    expect(easier).toMatchObject({ kind: 'ten-and-ones', splitPhase: 'build', whole: 11, answerKind: 'gesture' });
    expect(easier!.id).not.toBe(teen(whole).id);
    expect(easier!.sourceId).toBe(`t${whole}~smaller`);
  });

  it('made_ways keeps the pairs exactly as made, in order, adding and sorting nothing', () => {
    const found: [number, number][] = [[2, 3], [0, 5]];
    expect(madeWaysOrder(found)).toEqual([[2, 3], [0, 5]]);
  });

  it('no lever text or scene fact carries a digit or a number word', () => {
    const all = [teen(14), teen(11), decompose, missing, ...related];
    for (const item of all) {
      const facts = leverFacts(item, [WAYS_LEVER, FRAME_LEVER, MOVE_LEVER, COUNTERS_LEVER, SMALLER_LEVER]);
      expect(facts).not.toMatch(/\d|\b(one|two|three|four|five|six|seven|eight|nine|eleven|twelve)\b/i);
      for (const l of numberBondLevers(item as NumberBondItem, [], { pairsMade: 1, countersOpen: false }))
        expect(`${l.when} ${l.does}`).not.toMatch(/\d|\b(one|three|four|six|seven|eight|nine|eleven|twelve)\b/i);
    }
  });
});
