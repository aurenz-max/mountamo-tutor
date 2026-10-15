import { describe, expect, it } from 'vitest';
import { lexWord, isVowel } from './lexicon';
import { mulberry32 } from './pick';
import {
  MIN_PATTERN_WORDS, PATTERNS_BY_KIND, candidatePatterns, drawSpellingSession, patternDef, spellingPatternSpace,
  type SpellingPatternDef,
} from './spellingPatternSpaces';
import { dictationItems, patternRegex, spellingMiss } from '../../primitives/visual-primitives/literacy/spellingPatternExplorerWorkspace';
import { markPattern, patternWordsLeak } from '../../primitives/visual-primitives/literacy/spellingPatternLevers';

const ALL = [...Object.values(PATTERNS_BY_KIND).flat(), '-at', '-op', '-ig', '-un', '-it'];
const GRADES = ['K', '1', '2'];
const TIERS = ['easy', 'medium', 'hard'] as const;

/** The pattern's sound, re-derived from the word's phonemes (never from the spelling). */
const LONG_SOUND: Record<string, string> = { a_e: 'EY', ai: 'EY', ay: 'EY', ee: 'IY', ea: 'IY', i_e: 'AY', igh: 'AY', o_e: 'OW', oa: 'OW' };
const SHORT_SOUND: Record<string, string[]> = { a: ['AE'], e: ['EH'], i: ['IH'], o: ['AA', 'AO'], u: ['AH'] };
function saysPattern(d: SpellingPatternDef, w: string): boolean {
  const x = lexWord(w)!;
  const v = x.phones.find(isVowel)!;
  if (d.kind === 'short-vowel') return SHORT_SOUND[d.shown.replace('-', '')[0]].includes(v) && (!d.family || w.endsWith(d.family));
  if (d.kind === 'long-vowel') return v === LONG_SOUND[d.id];
  if (d.kind === 'r-controlled') return d.id === 'ar' ? x.phones.join(' ').includes('AA R') : d.id === 'or' ? x.phones.join(' ').includes('AO R') : v === 'ER';
  return (w.startsWith('kn') && x.phones[0] === 'N') || (w.startsWith('wr') && x.phones[0] === 'R');
}

describe('spelling-pattern-explorer word space', () => {
  it('every item passes the component gates and its pattern re-derives from the phonemes', () => {
    for (const id of ALL) for (const g of GRADES) {
      const d = patternDef(id)!;
      for (const it of spellingPatternSpace(d, g)) {
        const w = it.payload.word;
        expect(dictationItems([w]), w).toHaveLength(1);
        expect(markPattern(w, d.shown), `${id} ${w}`).not.toBeNull();
        expect(saysPattern(d, w), `${id} ${w}`).toBe(true);
        expect(lexWord(w)!.syllables).toBe(1);
        // A miss is diagnosable: the pattern dropped reads pattern_missing, not a blind "misspelled".
        expect(spellingMiss({ id: 'w1', word: w }, 'zzz', d.shown), w).toBe('pattern_missing');
      }
    }
  });

  it('a session holds four dictation words, 4-6 pattern words, none shared, and keeps every word', () => {
    const rand = mulberry32(7);
    for (const id of ALL) for (const g of ['1', '2']) for (const tier of TIERS) {
      const s = drawSpellingSession([id], g, tier, rand);
      if (spellingPatternSpace(patternDef(id)!, g).length < MIN_PATTERN_WORDS) { expect(s).toBeNull(); continue; }
      if (!s) continue; // a narrow pattern can lose its examples to the rime rule; the generator then takes the model path
      const dictation = s.dictation.map((d) => d.payload.word);
      const examples = s.examples.map((e) => e.payload.word);
      expect(dictation).toHaveLength(4);
      expect(examples.length).toBeGreaterThanOrEqual(4);
      expect(new Set([...dictation, ...examples]).size).toBe(dictation.length + examples.length);
      expect(patternWordsLeak(examples, { patternWords: examples, highlightPattern: s.def.shown, items: dictationItems(dictation) })).toBe(false);
      expect(patternRegex(s.def.shown)).not.toBeNull();
    }
  });

  it('every common pattern fills a session at grade 1 and 2', () => {
    for (const id of ['a', 'e', 'i', 'o', 'u', 'a_e', 'i_e', 'o_e', 'ai', 'ay', 'ee', 'ea', 'oa', 'ar', 'or', 'kn/wr', '-at'])
      expect(spellingPatternSpace(patternDef(id)!, '2').length, id).toBeGreaterThanOrEqual(MIN_PATTERN_WORDS);
  });

  it('tiers separate: easy < medium < hard mean dictation beta', () => {
    for (const id of ['a', 'e', 'i', 'u', 'a_e', 'i_e', 'ai', 'ee', 'ea', 'ar', 'or', 'kn/wr']) {
      const mean = (tier: (typeof TIERS)[number]) => {
        const rand = mulberry32(11);
        let sum = 0; let n = 0;
        for (let r = 0; r < 30; r++) for (const d of drawSpellingSession([id], '2', tier, rand)?.dictation ?? []) { sum += d.beta; n++; }
        return sum / n;
      };
      const [e, m, h] = TIERS.map(mean);
      expect(e, id).toBeLessThan(m);
      expect(m, id).toBeLessThan(h);
    }
  });

  it('regressions from the before probe', () => {
    const words = (id: string, g = '2') => spellingPatternSpace(patternDef(id)!, g).map((i) => i.payload.word);
    expect(words('a_e')).not.toContain('baker'); // two syllables
    expect(words('ar')).not.toContain('bird'); // ir in an ar set
    expect(words('or')).not.toContain('word'); // or said /er/
    expect(words('ea')).not.toContain('ear'); // a long vowel before r is not the long sound
    expect(words('ea')).not.toContain('bread'); // ea said short e
    expect(words('a')).not.toContain('was');
    expect(words('-at')).toEqual(expect.arrayContaining(['cat', 'that', 'flat']));
    expect(words('-at')).not.toContain('what');
    expect(words('kn/wr')).toEqual(expect.arrayContaining(['knee', 'write', 'wrong']));
    // er and ur are too thin for a session; a named mb (no library words) keeps the model path.
    expect(drawSpellingSession(['er'], '2', 'easy', mulberry32(1))).toBeNull();
    expect(candidatePatterns('silent-letter', ['mb'], null, null)).toEqual([]);
    expect(candidatePatterns('silent-letter', ['kn'], null, null)).toEqual(['kn/wr']);
    expect(candidatePatterns('long-vowel', ['ai', 'ay', 'a_e'], null, null)).toEqual(['ai', 'ay', 'a_e']);
    expect(candidatePatterns('short-vowel', [], 'at', null)).toEqual(['-at']);
    expect(candidatePatterns('short-vowel', [], null, ['e'])).toEqual(['e']);
    // Grade 1 stops at five sounds; the r of or is not a cluster: born scores only its familiarity (G1), no blend.
    expect(words('e', '1')).not.toContain('strength');
    const beta = (id: string, w: string) => spellingPatternSpace(patternDef(id)!, '2').find((i) => i.payload.word === w)!.beta;
    expect(spellingPatternSpace(patternDef('or')!, '2').find((i) => i.payload.word === 'born')!.structure).toBe('or:3s');
    expect(beta('or', 'storm')).toBeGreaterThan(beta('or', 'born'));
  });

  it('a kn/wr session dictates both kn and wr words', () => {
    for (const tier of TIERS) for (let i = 0; i < 20; i++) {
      const s = drawSpellingSession(['kn/wr'], '2', tier, mulberry32(i + 1))!;
      const starts = new Set(s.dictation.map((d) => d.payload.word.slice(0, 2)));
      expect(starts, s.dictation.map((d) => d.payload.word).join(',')).toEqual(new Set(['kn', 'wr']));
    }
  });

  it('every candidate pattern is drawn: the session pattern varies', () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const id = drawSpellingSession(['ar', 'or'], '2', 'easy', mulberry32(Math.floor(Math.random() * 2 ** 31)))!.def.id;
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    expect(seen.get('ar') ?? 0).toBeGreaterThan(50);
    expect(seen.get('or') ?? 0).toBeGreaterThan(50);
  });
});
