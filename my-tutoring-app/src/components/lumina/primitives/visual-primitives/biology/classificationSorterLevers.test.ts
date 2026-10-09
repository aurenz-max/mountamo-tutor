/**
 * The classification-sorter `sort` levers: which lever answers which miss, and each lever's leak rule.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ClassificationCategory, ClassificationItem, ClassificationSorterData } from './ClassificationSorter';
import { SORT_MISSES } from './classificationSorterWorkspace';
import { CLUE_LEVER, MARKS_LEVER, MEANING_LEVER, blankGroupWords, cardClue, groupMeanings, leverFact, namesAGroup, sortLevers }
  from './classificationSorterLevers';

const cat = (id: string, label: string, description: string, parentId: string | null = null): ClassificationCategory =>
  ({ id, label, description, parentId });
const item = (id: string, label: string, correctCategoryId: string, hint: string): ClassificationItem =>
  ({ id, label, imagePrompt: null, hint, correctCategoryId, distractorReasoning: '' });

const WINGS = [cat('w', 'Has Wings', 'Animals that have wings on their bodies'), cat('n', 'No Wings', 'Animals that do not have wings')];
const CLASSES = [cat('m', 'Mammals', 'Warm-blooded animals with hair that feed milk to their young'),
  cat('b', 'Birds', 'Animals with feathers that lay eggs; not mammals'), cat('f', 'Fish', 'Animals with gills and fins')];
const BAT = item('bat', 'Bat', 'w', 'Even though it flies in the night sky like a bird, look at its skin wings and furry body.');
const DOLPHIN = item('dol', 'Dolphin', 'm', 'It lives in water like a fish, but does it breathe air and feed milk? Mammals do.');
const PAYLOAD: ClassificationSorterData = JSON.parse(readFileSync(
  new URL('../../../components/live-activity/runtime/testing/w1-payloads/classification-sorter.sort.json', import.meta.url), 'utf8')).data;

describe('which lever comes next', () => {
  it.each(SORT_MISSES.map(m => [m] as const))('pre-reader, after %s: the group meanings first', miss => {
    expect(nextLever(sortLevers(BAT, WINGS, { descriptionsShown: false, sortedCount: 0 }, []), miss)).toBe(MEANING_LEVER);
  });
  it('then the card clue; the sorted marks only once a card is sorted, and never for a parent group', () => {
    const levers = sortLevers(BAT, WINGS, { descriptionsShown: false, sortedCount: 2 }, [MEANING_LEVER]);
    expect(nextLever(levers, 'wrong_group')).toBe(CLUE_LEVER);
    expect(levers.find(l => l.id === MARKS_LEVER)!.answers).not.toContain('parent_group');
    expect(sortLevers(BAT, WINGS, { descriptionsShown: false, sortedCount: 0 }, []).map(l => l.id)).not.toContain(MARKS_LEVER);
  });
  it('a reader band shows the descriptions already: no meaning lever', () => {
    expect(sortLevers(DOLPHIN, CLASSES, { descriptionsShown: true, sortedCount: 0 }, []).map(l => l.id)).toEqual([CLUE_LEVER]);
  });
  it('every lever is help, every miss is answered on every saved payload item', () => {
    for (const it of PAYLOAD.items) {
      const levers = sortLevers(it, PAYLOAD.categories, { descriptionsShown: PAYLOAD.gradeBand !== 'K-2', sortedCount: 0 }, []);
      expect(levers.every(l => l.kind === 'help')).toBe(true);
      for (const miss of SORT_MISSES) expect(levers.some(l => l.answers?.includes(miss)), `${it.id} ${miss}`).toBe(true);
    }
  });
});

describe('leak rules', () => {
  it('the clue blanks every word of every group name, plurals and stems too', () => {
    expect(cardClue(BAT, WINGS)).toBe('Even though it flies in the night sky like a bird, look at its skin ___ and furry body.');
    expect(cardClue(DOLPHIN, CLASSES)).toBe('It lives in water like a ___, but does it breathe air and feed milk? ___ do.');
    expect(blankGroupWords('A mammal, two mammals, a winged bird', [...CLASSES, ...WINGS])).toBe('A ___, two ___, a ___ ___');
  });
  it.each([...PAYLOAD.items, BAT, DOLPHIN].map(i => [i.label, i] as const))('%s: no lever text or fact names a group', (_l, it) => {
    const groups = it === DOLPHIN ? CLASSES : it === BAT ? WINGS : PAYLOAD.categories;
    const clue = cardClue(it, groups);
    if (clue) expect(namesAGroup(clue, groups)).toBe(false);
    const fact = leverFact(it, groups, [CLUE_LEVER]);
    // The fact may say the group names as the question; the clue inside it may not.
    if (clue) expect(namesAGroup(fact.replace(/^Under the card, a clue: /, ''), groups)).toBe(false);
    for (const l of sortLevers(it, groups, { descriptionsShown: false, sortedCount: 1 }, []))
      expect(namesAGroup(`${l.when} ${l.does}`, groups), l.id).toBe(false);
  });
  it('a clue with nothing left after blanking is not offered', () => {
    expect(cardClue(item('x', 'Owl', 'w', 'Has wings!'), WINGS)).toBeNull();
    expect(sortLevers(item('x', 'Owl', 'w', 'Has wings!'), WINGS, { descriptionsShown: true, sortedCount: 0 }, [])).toEqual([]);
  });
  it('group meanings never repeat a group name and are refused when one names the card', () => {
    const named = [cat('m', 'Mammals', 'Not Birds: Mammals like the bat'), cat('b', 'Birds', 'Feathers')];
    expect(groupMeanings(named, item('d', 'Dog', 'm', ''))).toEqual({ m: 'Not ___: this group like the bat', b: 'Feathers' });
    expect(groupMeanings(named, BAT)).toBeNull();
    expect(groupMeanings([cat('m', 'Mammals', ''), cat('b', 'Birds', 'Feathers')], BAT)).toBeNull();
  });
});
