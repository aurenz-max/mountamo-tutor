/**
 * sorting-station's in-item levers: which lever answers which spoken miss, the leak rules, and the two simplify
 * builders (checked on the saved lesson payloads, so a builder that never fires on a real lesson fails here).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { itemsFromChallenge, itemsFromChallenges, type SortingChallengeLike, type SortingStationItem } from './sortingStationScript';
import { sortingStationSpokenMisses } from './sortingStationWorkspace';
import { compareCounts, farCompare, showTraysLeak, simplerFromParent, sortingLeverFacts, sortingLevers, threeCards,
  trayExamples, trayPicturesLeak, type SortingLeverContext } from './sortingStationLevers';

const PAYLOADS = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const saved = readdirSync(PAYLOADS).filter(f => f.startsWith('sorting-station.'))
  .map(f => ({ file: f, data: JSON.parse(readFileSync(join(PAYLOADS, f), 'utf-8')).data as { challenges: SortingChallengeLike[]; gradeBand?: string } }));
const savedItems = saved.flatMap(p => itemsFromChallenges(p.data.challenges, { isPreReader: (p.data.gradeBand ?? 'K') === 'K' })
  .map(item => ({ item, challenge: p.data.challenges.find(c => c.id === item.challengeId)! })));

const ctx = (challenge: SortingChallengeLike | null, extra: Partial<SortingLeverContext> = {}): SortingLeverContext =>
  ({ challenge, preReader: true, credited: [], ...extra });
const obj = (id: string, label: string, emoji: string, attributes: Record<string, string>) => ({ id, label, emoji, attributes });

const SORT: SortingChallengeLike = { id: 'c1', type: 'sort-by-one', sortingAttribute: 'category',
  categories: [{ label: 'Living', bucketEmoji: '🌱' }, { label: 'Non-living', bucketEmoji: '🧱' }],
  objects: [obj('o1', 'Puppy', '🐶', { category: 'living' }), obj('o2', 'Rock', '🪨', { category: 'non-living' }),
    obj('o3', 'Tree', '🌳', { category: 'living' })] };
const ODD: SortingChallengeLike = { id: 'c2', type: 'odd-one-out', oddOneOut: 'o4',
  objects: [obj('o1', 'Dog', '🐶', { category: 'animal' }), obj('o2', 'Cat', '🐱', { category: 'animal' }),
    obj('o3', 'Cow', '🐮', { category: 'animal' }), obj('o4', 'Ball', '⚽', { category: 'toy' })] };
const COMPARE: SortingChallengeLike = { id: 'c3', type: 'count-and-compare', sortingAttribute: 'category',
  categories: [{ label: 'Animal', bucketEmoji: '🐾' }, { label: 'Fruit', bucketEmoji: '🥗' }],
  objects: [obj('o1', 'Dog', '🐶', { category: 'animal' }), obj('o2', 'Cat', '🐱', { category: 'animal' }),
    obj('o3', 'Bunny', '🐰', { category: 'animal' }), obj('o4', 'Apple', '🍎', { category: 'fruit' }), obj('o5', 'Banana', '🍌', { category: 'fruit' })] };
const BOTH: SortingChallengeLike = { id: 'c4', type: 'two-attributes', sortingAttribute: 'category', targetCategory: 'need',
  secondaryAttribute: 'type', secondaryValue: 'food',
  objects: [obj('o1', 'Apple', '🍎', { category: 'need', type: 'food' }), obj('o2', 'Coat', '🧥', { category: 'need', type: 'clothing' }),
    obj('o3', 'Candy', '🍬', { category: 'want', type: 'food' })] };

const first = (ch: SortingChallengeLike, kind: SortingStationItem['kind']) => itemsFromChallenge(ch, { isPreReader: true }).find(i => i.kind === kind)!;
const ids = (item: SortingStationItem, ch: SortingChallengeLike, extra?: Partial<SortingLeverContext>) =>
  sortingLevers(item, [], ctx(ch, extra)).map(l => l.id);

describe('which lever answers which miss (nextLever over the declared levers)', () => {
  const sort = first(SORT, 'sort'), odd = first(ODD, 'odd_one'), count = first(COMPARE, 'count_group');
  const compare = first(COMPARE, 'compare'), both = first(BOTH, 'both_criteria');
  it.each([
    [sort, SORT, 'said_object', 'try_each'], [sort, SORT, 'other_group', 'try_each'],
    [odd, ODD, 'said_all_belong', 'odd_model'], [odd, ODD, 'belonging_card', 'odd_model'],
    [count, COMPARE, 'over_by_more', 'focus_tray'], [count, COMPARE, 'one_over', 'focus_tray'],
    [count, COMPARE, 'one_short', 'tap_marks'], [count, COMPARE, 'short_by_more', 'tap_marks'],
    [compare, COMPARE, 'other_group', 'line_up'], [compare, COMPARE, 'said_same', 'line_up'], [compare, COMPARE, 'bare_more', 'line_up'],
    [both, BOTH, 'one_criterion_only', 'check_boxes'], [both, BOTH, 'opposite_verdict', 'check_boxes'],
  ] as const)('%#: %s', (item, ch, miss, lever) => {
    expect(nextLever(sortingLevers(item, [], ctx(ch)), miss)).toBe(lever);
  });

  it('after help is pulled, the simplify lever answers the next miss', () => {
    expect(nextLever(sortingLevers(odd, ['odd_model'], ctx(ODD)), 'belonging_card')).toBe('three_cards');
    expect(nextLever(sortingLevers(compare, ['line_up'], ctx(COMPARE)), 'said_same')).toBe('far_compare');
  });

  it('every miss an item names has a lever on that item (all saved payload items)', () => {
    const gaps: string[] = [];
    for (const { item, challenge } of savedItems) {
      const answered = new Set(sortingLevers(item, [], ctx(challenge)).flatMap(l => l.answers ?? []));
      for (const m of sortingStationSpokenMisses(item)) if (!answered.has(m.id)) gaps.push(`${item.id}: ${m.id}`);
    }
    expect(gaps).toEqual([]);
  });
});

describe('leak rules', () => {
  it('tray_pictures: readers only, and never when a tray picture is the card\'s own picture', () => {
    const sort = first(SORT, 'sort');
    expect(ids(sort, SORT)).not.toContain('tray_pictures');
    expect(ids(sort, SORT, { preReader: false })).toContain('tray_pictures');
    const own = { ...sort, stimulusEmoji: '🌱' };
    expect(trayPicturesLeak(own)).toBe(true);
    expect(ids(own, SORT, { preReader: false })).not.toContain('tray_pictures');
  });

  it('show_trays: not offered when a tray is named with a way to sort', () => {
    const ch: SortingChallengeLike = { ...SORT, type: 'sort-by-attribute',
      objects: SORT.objects!.map(o => ({ ...o, attributes: { ...o.attributes, size: 'big' } })) };
    const rule = first(ch, 'pick_rule');
    expect(ids(rule, ch)).toEqual(['show_trays']);
    const named = { ...ch, categories: [{ label: 'Size' }, { label: 'Kind' }] };
    expect(showTraysLeak(rule, named)).toBe(true);
    expect(ids(rule, named)).toEqual([]);
  });

  it('tray_examples: only earlier rounds by the same rule, never a card on the page or this challenge', () => {
    const sort = first(SORT, 'sort');
    const card = (challengeId: string, label: string, group: string, rule = 'category') => ({ challengeId, label, emoji: '', group, rule });
    expect(trayExamples(sort, ctx(SORT, { credited: [card('c1', 'Rock', 'Non-living')] })).size).toBe(0);
    expect(trayExamples(sort, ctx(SORT, { credited: [card('c0', 'Tree', 'Living')] })).size).toBe(0);
    expect(trayExamples(sort, ctx(SORT, { credited: [card('c0', 'Kite', 'Living', 'size')] })).size).toBe(0);
    const shown = trayExamples(sort, ctx(SORT, { credited: [card('c0', 'Kitty', 'Living'), card('c0', 'Car', 'Non-living')] }));
    expect(Array.from(shown.keys())).toEqual(['living', 'non-living']);
    expect(ids(sort, SORT, { credited: [card('c0', 'Kitty', 'Living')] })[0]).toBe('tray_examples');
  });

  it('scene facts describe what is drawn, never a group, card or count', () => {
    for (const { item } of savedItems) {
      const all = sortingLevers(item, [], ctx(null)).map(l => l.id);
      const fact = sortingLeverFacts(item, ['try_each', 'tray_examples', 'tray_pictures', 'show_trays', 'odd_model', 'focus_tray',
        'tap_marks', 'line_up', 'check_boxes', ...all]).toLowerCase();
      const words = [item.answer, ...(item.answerValue ? [String(item.answerValue)] : [])].map(w => w.toLowerCase());
      for (const w of words) expect(fact.split(/[^a-z0-9-]+/)).not.toContain(w);
    }
  });
});

describe('simplify builders', () => {
  it('three_cards: three new cards, one odd, same mode, never the item\'s cards or id', () => {
    const odd = first(ODD, 'odd_one');
    const easier = threeCards(odd, ODD)!;
    expect(easier.item).toMatchObject({ kind: 'odd_one', mode: 'odd-one-out', id: `${odd.id}~simpler` });
    expect(easier.item.choices).toHaveLength(3);
    expect(easier.item.choices.map(c => c.toLowerCase())).not.toEqual(expect.arrayContaining([expect.stringMatching(/^(dog|cat|cow|ball)$/)]));
    expect(easier.item.answer).toBe(easier.item.choices[1]);
    const odds = easier.challenge.objects!.filter(o => o.attributes!.category !== easier.challenge.objects![0].attributes!.category);
    expect(odds.map(o => o.label)).toEqual([easier.item.answer]);
    // Already three cards: the plainest shape, no simplify.
    expect(threeCards({ ...odd, choices: odd.choices.slice(0, 3) }, ODD)).toBeNull();
  });

  it('far_compare: two new groups of one and four, never the same, only when the item\'s groups are within 2', () => {
    const compare = first(COMPARE, 'compare');
    expect(compareCounts(compare, COMPARE)).toEqual([3, 2]);
    const easier = farCompare(compare, COMPARE)!;
    expect(easier.item).toMatchObject({ kind: 'compare', id: `${compare.id}~simpler` });
    expect(compareCounts(easier.item, easier.challenge).sort()).toEqual([1, 4]);
    expect(easier.item.answer).not.toBe('the same');
    expect(easier.item.choices.map(c => c.toLowerCase())).not.toContain('animal');
    expect(easier.item.choices.map(c => c.toLowerCase())).not.toContain('fruit');
    const wide: SortingChallengeLike = { ...COMPARE, objects: [...COMPARE.objects!, obj('o6', 'Pig', '🐷', { category: 'animal' }),
      obj('o7', 'Goat', '🐐', { category: 'animal' })].filter(o => o.id !== 'o5') };
    expect(farCompare(first(wide, 'compare'), wide)).toBeNull();
  });

  it('fires on every saved odd-one-out and compare item, and the journey rebuild matches', () => {
    const targets = savedItems.filter(s => s.item.kind === 'odd_one' || s.item.kind === 'compare');
    expect(targets.length).toBeGreaterThan(0);
    for (const { item, challenge } of targets) {
      const easier = simplerFromParent(item, challenge);
      expect(easier, item.id).not.toBeNull();
      const pageLabels = new Set((challenge.objects ?? []).map(o => o.label.toLowerCase()));
      expect(easier!.challenge.objects!.some(o => pageLabels.has(o.label.toLowerCase())), item.id).toBe(false);
      expect(easier!.item.answer.toLowerCase()).not.toBe(item.answer.toLowerCase());
      expect(simplerFromParent(item, challenge)).toEqual(easier);
    }
  });
});
