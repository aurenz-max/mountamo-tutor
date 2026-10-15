import { describe, expect, it } from 'vitest';
import { lexWord, shapeOf } from './lexicon';
import { decodableWords, isDecodable, scopeFromObjective, hitsFocus } from './scope';

const G1 = 'Letter Group 1: s, a, t, i, p, n\n\n**New Letters Introduced:**\ns, a, t, i, p, n\n\n**Full Practice Set (Cumulative):**\ns, a, t, i, p, n';
const G2 = 'Letter-Sound Group 2: c, k, e, h, r, m, d\n\n**New Sounds Introduced:**\n/k/, /ĕ/\n\n**Full Practice Set (Cumulative):**\ns, a, t, i, p, n, c, k, e, h, r, m, d';
const words = (text: string, grade = '1') => decodableWords(scopeFromObjective([text])!, { grade }).map((x) => x.w);

describe('letter scope', () => {
  it('group 1 admits sat, pin, snap and never is, pain, pass, cake', () => {
    const w = words(G1);
    for (const ok of ['sat', 'pin', 'snap']) expect(w).toContain(ok);
    for (const no of ['is', 'pain', 'pass', 'cake']) expect(w).not.toContain(no);
  });
  it('reads SATPIN and a space-separated letter list as the same scope', () => {
    expect(words('SATPIN words').sort()).toEqual(words(G1).sort());
    expect(words('Read words with s a t i p n').sort()).toEqual(words(G1).sort());
  });
  it('every group-2 word uses only known pairs; new letters are the focus', () => {
    const scope = scopeFromObjective([G2])!;
    expect(scope.focusLetters).toEqual(['c', 'k', 'e', 'h', 'r', 'm', 'd']);
    const known = new Set(['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'ck']);
    const list = decodableWords(scope, { grade: '1' });
    expect(list.length).toBeGreaterThan(20);
    for (const x of list) for (const g of x.gpcs!) expect(known.has(g.split('/')[0]), `${x.w} ${g}`).toBe(true);
    expect(list.some((x) => hitsFocus(scope, x))).toBe(true);
  });
  it.each([
    ['Decode CVC words with Short \'a\' (e.g., cat, map, van)', 'K', ['cat', 'map', 'van', 'sad', 'tap', 'bag', 'ham', 'pan']],
    ['Decode CVC words with Short \'e\' (e.g., hen, wet, leg)', 'K', ['hen', 'wet', 'leg', 'bed', 'pen', 'jet', 'red']],
    ['Decode CVC words with Short \'o\'', 'K', ['dog', 'hot', 'mop', 'log', 'top', 'pot', 'hop', 'fox']],
    ['Decode CVC words with Short \'u\'', 'K', ['sun', 'bug', 'cup', 'mud', 'run', 'tub', 'gum', 'hug']],
    ['Decode short vowel CVC words by mapping sounds to letters', '1', ['cat', 'map', 'tin', 'dot', 'bus', 'bed', 'pig', 'hot', 'sun', 'leg']],
    ['Decode words featuring the silent e pattern to produce long vowel sounds', '1', ['make', 'ride', 'hope', 'cute', 'cake', 'kite', 'bone', 'tune', 'safe', 'gate']],
  ])('recalls the curriculum examples: %s', (text, grade, examples) => {
    const w = new Set(words(text, grade));
    const missed = examples.filter((x) => lexWord(x) && !w.has(x));
    expect(missed).toEqual([]);
  });
  it('a single named vowel is the focus of every word', () => {
    const scope = scopeFromObjective(['Encode CVC words with Short \'i\''])!;
    expect(decodableWords(scope, { grade: 'K' }).every((x) => x.phones.includes('IH'))).toBe(true);
  });
  it('blends, digraphs and word families narrow the shape', () => {
    expect(words('Initial consonant blends (bl, cl, fl)').every((w) => ['bl', 'cl', 'fl'].includes(w.slice(0, 2)))).toBe(true);
    expect(words('Identify and read common consonant digraphs (sh, ch, th, wh)')).toContain('ship');
    expect(words('Spell CVC words in the -at family: cat, hat', 'K').every((w) => w.endsWith('at') && w.length === 3)).toBe(true);
  });
  it('cute is a silent-e word by shape', () => {
    expect(shapeOf(lexWord('cute')!)).toBe('CVCe');
    expect(isDecodable(scopeFromObjective(['silent e'])!, lexWord('cute')!)).toBe(true);
  });
  it('returns null when the objective names no letters or pattern', () => {
    expect(scopeFromObjective(['Recognize if two words rhyme'])).toBeNull();
  });
});

describe('inflected forms', () => {
  it('catches plurals, -ed and -ing, with doubling and a dropped e', async () => {
    const { isInflected } = await import('./scope');
    for (const w of ['cats', 'letting', 'gaming', 'jogging', 'jumped', 'snorts']) if (lexWord(w)) expect(isInflected(lexWord(w)!), w).toBe(true);
    for (const w of ['bed', 'red', 'king', 'bus', 'sing', 'kitten']) if (lexWord(w)) expect(isInflected(lexWord(w)!), w).toBe(false);
  });
});
