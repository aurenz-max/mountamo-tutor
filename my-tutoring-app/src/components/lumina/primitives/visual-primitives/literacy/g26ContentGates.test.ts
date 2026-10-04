/**
 * The content gates added before the G2-6 literacy levers (lever plan 2026-10-03 step 0): each one stops a key
 * that would refuse a defensible answer or hand the answer over.
 */
import { describe, expect, it } from 'vitest';
import { clueInvitesOtherPart, itemsFromTargets } from './wordBuilderScript';
import { unaskableKeys } from './sentenceAnalyzerScript';
import { restatesBinaryGenre } from './genreExplorerScript';
import { passageNamesStructure } from './textStructureAnalyzerScript';

const board = [
  { id: 'root-teach', text: 'teach', type: 'root' as const, meaning: 'show how' },
  { id: 'root-help', text: 'help', type: 'root' as const, meaning: 'assist' },
  { id: 'suf-er', text: 'er', type: 'suffix' as const, meaning: 'one who' },
  { id: 'pre-bio', text: 'bio', type: 'prefix' as const, meaning: 'life' },
  { id: 'root-sphere', text: 'sphere', type: 'root' as const, meaning: 'globe' },
  { id: 'root-geo', text: 'geo', type: 'root' as const, meaning: 'earth' },
];

describe('word-builder: a clue never invites a board-built wrong word (F1, F2)', () => {
  it('drops a clue that names an off-item root, or its one-word meaning', () => {
    expect(clueInvitesOtherPart('a person whose job is helping students learn', ['root-teach', 'suf-er'], board)).toBe(true);
    expect(clueInvitesOtherPart('the zone of life on Earth', ['pre-bio', 'root-sphere'], board)).toBe(true);
    expect(clueInvitesOtherPart('a person who shows others how to do things', ['root-teach', 'suf-er'], board)).toBe(false);
  });
  it('the item is dropped at build', () => {
    const target = { word: 'teacher', parts: ['root-teach', 'suf-er'], hint: 'a person whose job is helping students learn', definition: '' };
    expect(itemsFromTargets([target], board, 'simple_affix')).toEqual([]);
  });
});

describe('sentence-analyzer: keys a child would be refused on are not asked (D1-D3)', () => {
  const words = (spec: Array<[string, string | null, string | null]>) =>
    spec.map(([text, pos, role]) => ({ text, pos, role })) as Parameters<typeof unaskableKeys>[0];
  it('an objectless preposition, an object of no preposition and number words lose their label', () => {
    const w = words([['Three', 'Adjective', 'Modifier'], ['cats', 'Noun', 'Subject'], ['ran', 'Verb', 'Predicate'],
      ['down', 'Preposition', 'Modifier'], ['quickly.', 'Adverb', 'Modifier']]);
    unaskableKeys(w);
    expect(w.map(x => x.pos)).toEqual([null, 'Noun', 'Verb', null, 'Adverb']);
    const v = words([['Stars', 'Noun', 'Subject'], ['shine', 'Verb', 'Predicate'], ['every', 'Determiner', 'Modifier'],
      ['night.', 'Noun', 'Object of Preposition']]);
    unaskableKeys(v);
    expect(v[3].role).toBeNull();
  });
  it('a preposition with its object keeps its key', () => {
    const w = words([['Fish', 'Noun', 'Subject'], ['swim', 'Verb', 'Predicate'], ['under', 'Preposition', 'Modifier'],
      ['the', 'Determiner', 'Modifier'], ['bridge.', 'Noun', 'Object of Preposition']]);
    unaskableKeys(w);
    expect(w.map(x => [x.pos, x.role])).toEqual([['Noun', 'Subject'], ['Verb', 'Predicate'], ['Preposition', 'Modifier'],
      ['Determiner', 'Modifier'], ['Noun', 'Object of Preposition']]);
  });
});

describe('genre-explorer: an identify_basic feature never restates fiction or nonfiction (F1)', () => {
  it.each([
    ['tell a made-up story from someone\'s imagination', true],
    ['give facts you could look up', true],
    ['tell about a real person who lived', true],
    ['have an animal that speaks', false],
    ['use words that rhyme', false],
  ])('%s → %s', (predicate, restates) => expect(restatesBinaryGenre(predicate)).toBe(restates));
});

describe('text-structure-analyzer: a passage that prints its structure name loses the structure ask (R6, D1)', () => {
  it('names the structure', () => {
    expect(passageNamesStructure('The problem is that the river floods.', 'problem-solution')).toBe(true);
    expect(passageNamesStructure('In contrast, toads have dry skin.', 'compare-contrast')).toBe(true);
    expect(passageNamesStructure('To fix this, people built walls.', 'problem-solution')).toBe(false);
    expect(passageNamesStructure('At that time the order of steps mattered.', 'chronological')).toBe(false);
  });
});
