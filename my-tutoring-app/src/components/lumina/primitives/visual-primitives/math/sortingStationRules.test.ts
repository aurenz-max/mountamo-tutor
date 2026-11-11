/**
 * K math audit CV1 (qa/curriculum-coverage/math-k/REPORT.md): the rule checks code owns on sorting-station.
 * - R14 real size: a size sort draws each card at its size, and only where size is a way the item asks about.
 * - R15 the child's own rule: any rule the cards really split on is credited, and the sorts that follow use it;
 *   an inconsistent sort is not a rule.
 * - R16 say_rule: the rule of a finished sort is the key; the tap menu holds only real wrong rules.
 */
import { describe, expect, it } from 'vitest';
import {
  axisNamedIn, followRule, itemsFromChallenge, rulesOfGroup, ruleOfSort, sayRuleTrays, sizeScales, sortingStationHarnessAnswers,
  sortingStationKey, sortingStationSpokenMisses, sortingStationTapCheck, validSortAxes, type SortingChallengeLike,
} from './sortingStationDomain';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import { askFor } from './sortingStationDomain';

const card = (id: string, label: string, emoji: string, attributes: Record<string, string>) => ({ id, label, emoji, attributes });

/** Six cards that split two real ways: by colour (red / yellow) and by kind (fruit / toy). */
const SIX = [
  card('o1', 'Apple', '🍎', { color: 'red', type: 'fruit' }),
  card('o2', 'Banana', '🍌', { color: 'yellow', type: 'fruit' }),
  card('o3', 'Cherry', '🍒', { color: 'red', type: 'fruit' }),
  card('o4', 'Duck', '🦆', { color: 'yellow', type: 'toy' }),
  card('o5', 'Car', '🚗', { color: 'red', type: 'toy' }),
  card('o6', 'Star', '⭐', { color: 'yellow', type: 'toy' }),
];

describe('a sorting rule is checked in code (R15)', () => {
  it('every attribute the cards split on is a valid rule; one every card shares, or one a card lacks, is not', () => {
    const page = [...SIX.map(o => ({ ...o, attributes: { ...o.attributes, shape: 'round' } })),
      card('o7', 'Pear', '🍐', { color: 'yellow', type: 'fruit', shape: 'round', size: 'big' })];
    expect(validSortAxes(page).sort()).toEqual(['color', 'type']);
  });

  it('a group made by one rule names it; a group that mixes rules names none', () => {
    expect(rulesOfGroup(SIX, ['o1', 'o3', 'o5'])).toEqual([{ axis: 'color', value: 'red' }]);
    expect(rulesOfGroup(SIX, ['o1', 'o2', 'o3'])).toEqual([{ axis: 'type', value: 'fruit' }]);
    // Apple, Banana and Car share nothing that the other cards lack.
    expect(rulesOfGroup(SIX, ['o1', 'o2', 'o5'])).toEqual([]);
  });

  it('a valid sort by the child\'s own rule is credited; an inconsistent sort is not', () => {
    // Planned by colour, the child sorts by kind: credited, and the rule is read back.
    expect(ruleOfSort(SIX, [['o1', 'o2', 'o3'], ['o4', 'o5', 'o6']])).toBe('type');
    expect(ruleOfSort(SIX, [['o1', 'o3', 'o5'], ['o2', 'o4', 'o6']])).toBe('color');
    // One group by colour, the other by kind: no single rule makes both.
    expect(ruleOfSort(SIX, [['o1', 'o3', 'o5'], ['o2', 'o4']])).toBeNull();
    expect(ruleOfSort(SIX, [['o1', 'o2', 'o5'], ['o3', 'o4', 'o6']])).toBeNull();
  });
});

describe('sort_attribute: the child chooses the rule (PTRN001-02-E)', () => {
  const ch: SortingChallengeLike = { id: 'c1', type: 'sort-by-attribute', sortingAttribute: 'color', objects: SIX,
    categories: [{ label: 'Red', rule: { color: 'red' } }, { label: 'Yellow', rule: { color: 'yellow' } }] };
  const items = itemsFromChallenge(ch, { isPreReader: true });
  const pick = items[0];

  it('another valid rule is accepted the same; the miss is only a way the cards do not split by', () => {
    expect(pick.kind).toBe('pick_rule');
    expect(pick.answer).toBe('color');
    expect(pick.alsoAccept).toEqual(['type']);
    const key = sortingStationKey(pick);
    expect(key.alsoAccept).toEqual(['type']);
    // Both ways on the menu are right, so no miss is named for either.
    expect(sortingStationSpokenMisses(pick)).toEqual([]);
    expect(sortingStationHarnessAnswers(pick).plainWrong).not.toBe('type');
  });

  it('a way some card lacks is still on the menu and is the other_rule miss', () => {
    const withShape = { ...ch, objects: SIX.map((o, i) => (i < 3 ? { ...o, attributes: { ...o.attributes, shape: 'round' } } : o)) };
    const rule = itemsFromChallenge(withShape, { isPreReader: true })[0];
    expect(rule.choices).toContain('shape');
    expect(rule.alsoAccept).toEqual(['type']);
    const misses = sortingStationSpokenMisses(rule);
    expect(misses.map(m => m.id)).toEqual(['other_rule']);
    expect(misses[0].examples).toEqual(['shape']);
  });

  it('the child\'s words name the rule they chose', () => {
    expect(axisNamedIn('by what kind of thing they are', ch)).toBe('type');
    expect(axisNamedIn('the colour', ch)).toBe('color');
    expect(axisNamedIn('the red ones and the yellow ones', ch)).toBe('color');
    expect(axisNamedIn('fruit and toys', ch)).toBe('type'); // a value of one rule names it
    expect(axisNamedIn('colour or kind', ch)).toBeNull();
  });

  it('the sorts that follow re-key to the chosen rule, card for card', () => {
    const followed = followRule(items, ch, 'type', { isPreReader: true });
    expect(followed.map(i => i.id)).toEqual(items.map(i => i.id));
    const sorts = followed.filter(i => i.kind === 'sort');
    expect(sorts.length).toBeGreaterThan(1);
    for (const s of sorts) {
      expect(s.ruleName).toBe('type');
      expect(s.choices).toEqual(['Fruit', 'Toy']);
      const obj = SIX.find(o => s.id === `c1::${o.id}`)!;
      expect(s.answer.toLowerCase()).toBe(obj.attributes.type);
    }
    expect(askFor(sorts[0])).toMatch(/Fruit, or Toy\?/);
    // Not a valid rule, or the planned one: unchanged.
    expect(followRule(items, ch, 'shape', { isPreReader: true })).toEqual(items);
    expect(followRule(items, ch, 'color', { isPreReader: true })).toEqual(items);
  });
});

describe('real size (R14)', () => {
  const sized = [card('b1', 'Ball', '⚽', { size: 'big', type: 'toy' }), card('b2', 'Ball', '⚽', { size: 'small', type: 'toy' }),
    card('b3', 'Bear', '🧸', { size: 'big', type: 'toy' }), card('b4', 'Duck', '🦆', { size: 'small', type: 'toy' }),
    card('b5', 'Drum', '🥁', { size: 'big', type: 'toy' }), card('b6', 'Kite', '🪁', { size: 'small', type: 'toy' })];
  const sizeSort: SortingChallengeLike = { id: 'c1', type: 'sort-by-one', sortingAttribute: 'size', objects: sized,
    categories: [{ label: 'Big', rule: { size: 'big' } }, { label: 'Small', rule: { size: 'small' } }] };

  it('two cards of the same object differ only in drawn size', () => {
    const scales = sizeScales(sized)!;
    expect(scales.get('b1')).toBe(1);
    expect(scales.get('b2')).toBe(0.5);
    expect(sized[0].emoji).toBe(sized[1].emoji);
  });

  it('a size the table does not know, or one size for every card, draws nothing', () => {
    expect(sizeScales([card('x', 'A', '⚽', { size: 'tall' }), card('y', 'B', '⚽', { size: 'small' })])).toBeNull();
    expect(sizeScales([card('x', 'A', '⚽', { size: 'big' }), card('y', 'B', '⚽', { size: 'big' })])).toBeNull();
    expect(sizeScales([card('x', 'A', '⚽', { size: 'big' }), card('y', 'B', '⚽', {})])).toBeNull();
  });

  it('a size sort is drawn to size; a sort by another rule over the same cards is not', () => {
    expect(itemsFromChallenge(sizeSort, { isPreReader: true }).every(i => i.drawSizes)).toBe(true);
    const byKind = { ...sizeSort, sortingAttribute: 'type', objects: sized.map((o, i) => ({ ...o, attributes: { ...o.attributes, type: i % 2 ? 'toy' : 'ball' } })),
      categories: [{ label: 'Ball', rule: { type: 'ball' } }, { label: 'Toy', rule: { type: 'toy' } }] };
    expect(itemsFromChallenge(byKind, { isPreReader: true }).some(i => i.drawSizes)).toBe(false);
  });

  it('a card whose name says its size is never asked on a size sort, menu or not', () => {
    const named = { ...sizeSort, objects: [...sized, card('b7', 'Big Truck', '🚚', { size: 'big', type: 'toy' })] };
    expect(itemsFromChallenge(named, { isPreReader: true }).some(i => i.stimulus === 'Big Truck')).toBe(false);
  });

  it('on pick-the-rule, sizes are drawn whenever size is an offered way, whichever is the answer', () => {
    const both = sized.map((o, i) => ({ ...o, attributes: { size: o.attributes.size, color: i < 3 ? 'red' : 'blue' } }));
    const base = { id: 'c1', type: 'sort-by-attribute' as const, objects: both };
    const bySize = itemsFromChallenge({ ...base, sortingAttribute: 'size', categories: [{ label: 'Big', rule: { size: 'big' } }, { label: 'Small', rule: { size: 'small' } }] }, { isPreReader: true });
    const byColor = itemsFromChallenge({ ...base, sortingAttribute: 'color', categories: [{ label: 'Red', rule: { color: 'red' } }, { label: 'Blue', rule: { color: 'blue' } }] }, { isPreReader: true });
    expect(bySize[0].kind).toBe('pick_rule');
    expect(byColor[0].kind).toBe('pick_rule');
    expect(bySize[0].drawSizes).toBe(true);
    expect(byColor[0].drawSizes).toBe(true);
  });
});

describe('say_rule (R16): say why a finished sort\'s group goes together', () => {
  const finished: SortingChallengeLike = { id: 'c1', type: 'say-rule', sortingAttribute: 'color', objects: SIX,
    categories: [{ label: 'Red', rule: { color: 'red' } }, { label: 'Yellow', rule: { color: 'yellow' } }] };

  it('the key is the group\'s rule; every chip is a real wrong rule; the ask never names the group', () => {
    // One group per challenge, rotating, so no ask is answered by elimination.
    const [red] = itemsFromChallenge(finished, { isPreReader: true });
    const items = [red, ...itemsFromChallenge({ ...finished, id: 'c2' }, { isPreReader: true })];
    expect(items.map(i => i.kind)).toEqual(['name_rule', 'name_rule']);
    expect(itemsFromChallenge(finished, { isPreReader: true })).toHaveLength(1);
    const yellow = items[1];
    expect(red.answer).toBe('Red');
    expect(yellow.answer).toBe('Yellow');
    // Red's chips: Red, the other group's rule (Yellow), and what only some red cards are (Fruit or Toy).
    expect(red.choices).toContain('Yellow');
    expect(red.choices.some(c => c === 'Fruit' || c === 'Toy')).toBe(true);
    expect(red.otherGroups).toEqual(['Yellow']);
    for (const item of items) {
      const key = sortingStationKey(item);
      expect(askLeaks(askFor(item), key, [])).toEqual([]);
      expect(askFor(item)).toMatch(/ring/);
    }
    // A pre-reader hears the choices; a reader at hard does not.
    expect(red.namesChoices).toBe(true);
    const hard = itemsFromChallenge({ ...finished, namesSortCriterion: false }, { isPreReader: false });
    expect(hard[0].namesChoices).toBe(false);
    expect(askFor(hard[0])).not.toMatch(/red|yellow|fruit|toy/i);
  });

  it('a value every card shares is never a chip: "they are all fruit" is true of no single group here', () => {
    const allFruit = { ...finished, objects: SIX.map(o => ({ ...o, attributes: { ...o.attributes, kind: 'thing' } })) };
    for (const item of itemsFromChallenge(allFruit, { isPreReader: true })) expect(item.choices).not.toContain('Thing');
  });

  it('a value that makes exactly the same group is accepted as well', () => {
    const coincide = { ...finished, objects: SIX.map(o => ({ ...o, attributes: { color: o.attributes.color, shape: o.attributes.color === 'red' ? 'round' : 'pointy', type: o.attributes.type } })) };
    const [red] = itemsFromChallenge(coincide, { isPreReader: true });
    expect(red.alsoAccept).toEqual(['Round']);
    expect(red.choices).not.toContain('Round');
  });

  it('the tap is checked in code: the rule (or an equal one) is right, a real wrong rule is not', () => {
    const [red] = itemsFromChallenge(finished, { isPreReader: true });
    const check = sortingStationTapCheck(red);
    expect(check('Red')).toBe(true);
    expect(check('Yellow')).toBe(false);
    expect(check(red.choices.find(c => c !== 'Red' && c !== 'Yellow')!)).toBe(false);
    // Kinds that are only said are not tap-checked.
    expect(sortingStationTapCheck(itemsFromChallenge({ ...finished, type: 'sort-by-one' }, { isPreReader: true })[0])('Red')).toBeNull();
  });

  it('a card whose name says the rule drops that group\'s ask', () => {
    const leaky = { ...finished, objects: SIX.map(o => (o.id === 'o1' ? { ...o, label: 'Red Apple' } : o)) };
    expect(itemsFromChallenge(leaky, { isPreReader: true })).toEqual([]);
    expect(itemsFromChallenge({ ...leaky, id: 'c2' }, { isPreReader: true }).map(i => i.answer)).toEqual(['Yellow']);
  });

  it('the card in the wrong group comes first, then why the others go together (PTRN001-02-G)', () => {
    const misplaced = { ...finished, intruder: { objectId: 'o5', trayLabel: 'Yellow' } };
    const drawn = sayRuleTrays(misplaced);
    expect(drawn[1].members.map(o => o.id)).toEqual(['o2', 'o4', 'o6', 'o5']);
    expect(sayRuleTrays(misplaced, true)[0].members.map(o => o.id)).toEqual(['o1', 'o3', 'o5']);
    const items = itemsFromChallenge(misplaced, { isPreReader: true });
    expect(items[0].kind).toBe('misfit');
    expect(items[0].answer).toBe('Car');
    expect(items[0].trayIndex).toBe(1);
    expect(items[0].choices).toEqual(['Banana', 'Duck', 'Star', 'Car']);
    expect(items[1]).toMatchObject({ kind: 'name_rule', trayIndex: 1, answer: 'Yellow' });
    expect(sortingStationTapCheck(items[0])('Car')).toBe(true);
    expect(sortingStationTapCheck(items[0])('Duck')).toBe(false);
    expect(sortingStationSpokenMisses(items[0]).map(m => m.id)).toEqual(['belonging_card', 'said_all_belong']);
    expect(askLeaks(askFor(items[0]), sortingStationKey(items[0]), [])).toEqual([]);
  });
});
