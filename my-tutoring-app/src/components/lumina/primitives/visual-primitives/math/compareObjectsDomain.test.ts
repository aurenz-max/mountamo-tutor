/**
 * compareObjectsDomain: the answer-material fork, the build gates (drop, never repair), the ask and its key, the known
 * spoken misses and the board's check of an ordering. Moved from the retired scripted-pack and workspace suites.
 */
import { describe, expect, it } from 'vitest';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import { MATH_CATALOG } from '../../../service/manifest/catalog/math';
import {
  answerKindFor, askFor, askGiven, askableAttributeOptions, buildCompareItems, compareKey, compareObjectsSpokenMisses,
  compareOrderMiss, comparisonMatchesAttribute, isSayableName, isSayableUnitCount, itemFromChallenge, namesEarSeparable,
  responseClassFor, visualRankAgrees, workspaceScene, type CompareObjectsChallengeLike, type CompareObjectsItem,
} from './compareObjectsDomain';

const CTX_K = { band: 'K' } as const;
const CTX_1 = { band: '1' } as const;

const PENCIL_CRAYON = [{ name: 'pencil', visualSize: 70, actualValue: 19 }, { name: 'crayon', visualSize: 40, actualValue: 9 }];
const IA_CH: CompareObjectsChallengeLike = { id: 'c1', type: 'identify_attribute', attribute: 'length', correctAttribute: 'length',
  attributeOptions: ['length', 'weight', 'capacity'], objects: PENCIL_CRAYON };
const CT_CH: CompareObjectsChallengeLike = { id: 'c2', type: 'compare_two', attribute: 'length', comparisonWord: 'longer',
  correctAnswer: 'jump rope', objects: [{ name: 'jump rope', visualSize: 75, actualValue: 200 }, { name: 'shoelace', visualSize: 35, actualValue: 80 }] };
const CT_LESS_CH: CompareObjectsChallengeLike = { id: 'c3', type: 'compare_two', attribute: 'capacity', comparisonWord: 'holds_less',
  correctAnswer: 'teacup', objects: [{ name: 'teacup', visualSize: 30, actualValue: 8 }, { name: 'bucket', visualSize: 80, actualValue: 40 }] };
const OT_CH: CompareObjectsChallengeLike = { id: 'c4', type: 'order_three', attribute: 'height', comparisonWord: 'taller',
  correctAnswer: 'sunflower, tulip, daisy', objects: [{ name: 'tulip', visualSize: 50, actualValue: 60 },
    { name: 'sunflower', visualSize: 80, actualValue: 150 }, { name: 'daisy', visualSize: 30, actualValue: 30 }] };
const NS_CH: CompareObjectsChallengeLike = { id: 'c5', type: 'non_standard', attribute: 'length', unitName: 'paper clip', unitCount: 5,
  objects: [{ name: 'pencil', visualSize: 50, actualValue: 5 }] };

const IA = itemFromChallenge(IA_CH, CTX_K)!;
const CT = itemFromChallenge(CT_CH, CTX_K)!;
const CT_LESS = itemFromChallenge(CT_LESS_CH, CTX_K)!;
const OT = itemFromChallenge(OT_CH, CTX_1)!;
const NS = itemFromChallenge(NS_CH, CTX_1)!;

describe('the answer-material fork', () => {
  it.each([
    ['identify_attribute', 'voice', 'short_spoken_word'], ['compare_two', 'voice', 'short_spoken_word'],
    ['non_standard', 'voice', 'number_word_to_20'], ['order_three', 'gesture', 'manipulation'],
  ] as const)('%s answers with %s (%s)', (kind, answerKind, responseClass) => {
    expect(answerKindFor(kind)).toBe(answerKind);
    expect(responseClassFor(kind)).toBe(responseClass);
  });
  it('an ordering has no spoken key; every spoken item has one', () => {
    expect(compareKey(OT)).toBeNull();
    for (const item of [IA, CT, CT_LESS, NS]) expect(compareKey(item)).not.toBeNull();
  });
  it('items carry the lesson tier, medium when the lesson pins none', () => {
    expect(CT.supportTier).toBe('medium');
    expect(itemFromChallenge({ ...CT_CH, supportTier: 'easy' }, CTX_K)!.supportTier).toBe('easy');
  });
});

describe('build gates (drop, never repair)', () => {
  it('drops a key that disagrees with the DRAWN attribute', () => {
    expect(itemFromChallenge({ ...IA_CH, correctAttribute: 'weight', attributeOptions: ['length', 'weight'] }, CTX_K)).toBeNull();
  });
  it('drops an attribute menu offering both length and height, one with no distractor, or invented words', () => {
    expect(askableAttributeOptions(['length', 'height', 'weight'], 'length')).toBeNull();
    expect(itemFromChallenge({ ...IA_CH, attributeOptions: ['length', 'height'] }, CTX_K)).toBeNull();
    expect(askableAttributeOptions(['length'], 'length')).toBeNull();
    expect(askableAttributeOptions(['size', 'bigness'], 'length')).toBeNull();
    expect(askableAttributeOptions(['length', 'size', 'weight'], 'length')).toEqual(['length', 'weight']);
  });
  it('drops a comparison word that is not about the drawn attribute, and a key against the measurements', () => {
    expect(comparisonMatchesAttribute('length', 'heavier')).toBe(false);
    expect(itemFromChallenge({ ...CT_CH, comparisonWord: 'heavier' }, CTX_K)).toBeNull();
    expect(itemFromChallenge({ ...CT_CH, correctAnswer: 'shoelace' }, CTX_K)).toBeNull();
  });
  it('drops a DRAWING that ranks the objects against its own key', () => {
    const objects = [{ name: 'jump rope', visualSize: 20, actualValue: 200 }, { name: 'shoelace', visualSize: 90, actualValue: 80 }];
    expect(visualRankAgrees(objects)).toBe(false);
    expect(itemFromChallenge({ ...CT_CH, objects }, CTX_K)).toBeNull();
  });
  it('drops names that cannot be told apart by ear', () => {
    expect(namesEarSeparable(['block', 'small block'])).toBe(false);
    expect(namesEarSeparable(['pencil', 'crayon'])).toBe(true);
    expect(isSayableName('ox')).toBe(false);
    expect(isSayableName('obj_1')).toBe(false);
  });
  it('drops an ordering board already in the answer order, or a key that is not the ranked order', () => {
    expect(itemFromChallenge({ ...OT_CH, objects: [OT_CH.objects![1], OT_CH.objects![0], OT_CH.objects![2]] }, CTX_1)).toBeNull();
    expect(itemFromChallenge({ ...OT_CH, correctAnswer: 'tulip, sunflower, daisy' }, CTX_1)).toBeNull();
  });
  it('drops a unit count outside one spoken word (zero included)', () => {
    expect(isSayableUnitCount(0)).toBe(false);
    expect(isSayableUnitCount(21)).toBe(false);
    expect(itemFromChallenge({ ...NS_CH, unitCount: 25 }, CTX_1)).toBeNull();
  });
  it('drops the Grade 1 modes at Kindergarten', () => {
    expect(itemFromChallenge(OT_CH, CTX_K)).toBeNull();
    expect(itemFromChallenge(NS_CH, CTX_K)).toBeNull();
    expect(itemFromChallenge(IA_CH, CTX_K)).not.toBeNull();
  });
  it('dedups session-wide, ignoring the direction', () => {
    const reversed = { ...CT_CH, id: 'c2b', comparisonWord: 'shorter', correctAnswer: 'shoelace' };
    const { items, droppedChallenges } = buildCompareItems([CT_CH, reversed], CTX_K);
    expect(items).toHaveLength(1);
    expect(droppedChallenges).toBe(1);
  });
});

describe('the ask and the key', () => {
  it('no ask says an accepted answer outside what it must say by design', () => {
    for (const item of [IA, CT, CT_LESS, NS]) expect(askLeaks(askFor(item), compareKey(item)!, askGiven(item))).toEqual([]);
    // Without its menu clause, identify_attribute's ask would be reported: the exemption is that clause only.
    expect(askLeaks(askFor(IA), compareKey(IA)!)).not.toEqual([]);
  });
  it('the counting ask names no number; adjective comparisons take a copula, verb ones do not', () => {
    expect(askFor(NS)).toBe('How many paper clips long is the pencil? Count them, then say the number.');
    expect(askFor(CT)).toMatch(/^Which one is longer — /);
    expect(askFor(CT_LESS)).toMatch(/^Which one holds less — /);
  });
  it('position in the ask never predicts the answer', () => {
    const firsts = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(id => {
      const item = itemFromChallenge({ ...CT_CH, id }, CTX_K)!;
      return item.askOrder[0] === item.answerNames[0];
    });
    expect(new Set(firsts).size).toBe(2);
  });
  it('the keys accept the child word and the grown-up word, refuse a pointing word, and judge the landed count', () => {
    expect(compareKey(IA)).toMatchObject({ answer: 'how long they are', alsoAccept: ['long', 'length'] });
    expect(compareKey(CT)!.signatureError).toMatch(/The shoelace, the other object.*"that one" names no object/);
    expect(compareKey(NS)).toMatchObject({ answer: 'five' });
    expect(compareKey(NS)!.signatureError).toMatch(/^"six"/);
  });
});

describe('misses and the board', () => {
  const [order] = buildCompareItems([{ id: 'co-1', type: 'order_three', attribute: 'length', comparisonWord: 'longer',
    objects: [{ name: 'yellow pencil', visualSize: 50, actualValue: 7 }, { name: 'blue string', visualSize: 20, actualValue: 3 },
      { name: 'red ribbon', visualSize: 80, actualValue: 12 }], correctAnswer: 'red ribbon, yellow pencil, blue string' }], CTX_1).items;

  it.each([
    [['blue string', 'yellow pencil', 'red ribbon'], 'reversed'], [['yellow pencil', 'red ribbon', 'blue string'], 'two_swapped'],
    [['yellow pencil', 'blue string', 'red ribbon'], 'other_order'], [['red ribbon', 'yellow pencil'], 'not_all_placed'],
    [['red ribbon', 'yellow pencil', 'blue string'], undefined],
  ])('placed %j -> %s', (placed, miss) => expect(compareOrderMiss(order, placed)).toBe(miss));

  const spoken = (kind: CompareObjectsItem['kind'], extra: Partial<CompareObjectsItem>) =>
    ({ id: kind, kind, answerKind: 'voice', attribute: 'length', comparisonWord: 'longer', objectNames: ['red ribbon', 'blue string'],
      askOrder: ['blue string', 'red ribbon'], answerNames: ['red ribbon'], attributeOptions: ['length', 'weight'], unitName: 'cube',
      unitCount: 4, ...extra }) as CompareObjectsItem;

  it.each([
    [spoken('compare_two', {}), ['other_object'], ['blue string']],
    [spoken('compare_two', { comparisonWord: 'holds_less', attribute: 'capacity' }), ['other_object'], ['blue string']],
    [spoken('identify_attribute', { attributeOptions: ['weight', 'length', 'capacity'] }), ['other_attribute'],
      ['how heavy they are', 'how much they hold']],
    [spoken('non_standard', {}), ['one_short', 'one_over', 'short_by_more', 'over_by_more'], ['three', 'five', 'two', 'six']],
  ] as const)('spoken %#: known misses in order, none of them the answer', (item, ids, examples) => {
    const misses = compareObjectsSpokenMisses(item);
    expect(misses.map(m => m.id)).toEqual(ids);
    expect(misses.flatMap(m => m.examples ?? [])).toEqual(examples);
  });

  it('an ordering lists no spoken misses', () => expect(compareObjectsSpokenMisses(order)).toEqual([]));

  it('the scene names what is drawn, never a measurement or the ordering\'s answer', () => {
    const facts = JSON.stringify(workspaceScene(order, { placedOrder: [] }).facts);
    expect(facts).not.toMatch(/\b(7|3|12)\b/);
    expect(facts).toContain('none yet');
  });
});

it('every eval mode kept its identity and its beta', () => {
  const entry = MATH_CATALOG.find(c => c.id === 'compare-objects')!;
  expect((entry.evalModes ?? []).map(m => [m.evalMode, m.beta])).toEqual([
    ['identify_attribute', 1.0], ['compare_two', 1.5], ['order_three', 2.5], ['non_standard', 3.5]]);
});
