import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { sentenceSpokenMisses } from './sentenceAnalyzerDomain';
import { EXAMPLES_LEVER, PLAIN_KIND_LEVER, SENTENCE_LEVERS, SHORT_SENTENCE_LEVER, SHORT_SUBJECT_LEVER, modelSentenceFor,
  poolLeak, practiceFor, sentenceSession, splitModelFor, startingLevers, twoRowModelFor, wallExamplesFor } from './sentenceAnalyzerLevers';
import { sentenceAnalyzerCard } from './sentenceAnalyzer.card';
import { MODEL_SENTENCES, PRACTICE_KIND, PRACTICE_POS, PRACTICE_ROLE, PRACTICE_SIDE, WALL_EXAMPLES } from './sentenceModels';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS = readdirSync(DIR).filter(f => f.startsWith('sentence-analyzer.')).map(f => {
  const data = JSON.parse(readFileSync(join(DIR, f), 'utf-8')).data;
  return { file: f, session: sentenceSession(data) };
});

describe('the hand-labelled pool', () => {
  it('every word is keyed; a subject boundary sits inside the sentence', () => {
    for (const p of [...MODEL_SENTENCES, ...PRACTICE_POS, ...PRACTICE_ROLE, ...PRACTICE_SIDE, ...PRACTICE_KIND]) {
      for (const w of p.words) expect(w.pos && w.role, `${p.sentence} ${w.text}`).toBeTruthy();
      if (p.subjectEnd !== null) expect(p.subjectEnd).toBeLessThan(p.words.length - 1);
    }
    for (const p of PRACTICE_SIDE) expect(p.subjectEnd).toBe(1);
    expect(new Set(PRACTICE_KIND.map(p => p.kind)).size).toBe(4);
  });
  it('every wall example underlines a word of its phrase', () => {
    for (const [label, list] of Object.entries(WALL_EXAMPLES)) for (const e of list)
      if (!['Declarative', 'Interrogative', 'Exclamatory'].includes(label)) expect(e.phrase.replace(/[.,!?]/g, '').split(' ')).toContain(e.word);
  });
});

describe.each(PAYLOADS.map(p => [p.file, p] as const))('%s', (_f, { session: s }) => {
  it('has items', () => expect(s.items.length).toBeGreaterThan(0));
  it.each(s.items.map(i => [i.id, i] as const))('%s: its levers are leak-free and answer every miss it can show', (_id, item) => {
    const levers = SENTENCE_LEVERS.declare(item, s, []);
    const ids = levers.map(l => l.id);
    if (item.action === 'name-pos') {
      const m = modelSentenceFor(item, s.words);
      expect(m).not.toBeNull();
      expect(poolLeak(m!, s.words)).toBe(false);
      for (const [a, b] of [['Adjective', 'Adverb'], ['Noun', 'Pronoun']]) if (item.wallLabels.includes(a) && item.wallLabels.includes(b))
        expect(m!.words.some(w => w.pos === a) && m!.words.some(w => w.pos === b)).toBe(true);
    }
    if (item.action === 'name-role') {
      const m = twoRowModelFor(item, s.words, s.posWall);
      expect(m).not.toBeNull();
      for (const role of item.wallLabels) expect(m!.words.some(w => w.role === role), role).toBe(true);
    }
    if (item.action === 'name-side') expect(splitModelFor(item, s.words)).not.toBeNull();
    if (item.wallLabels.length && item.action !== 'name-side') expect(wallExamplesFor(item, s.words)).not.toBeNull();
    const practice = practiceFor(item, s);
    const subjectWords = (s.sentences.find(x => x.index === item.sentenceIndex)?.subjectEndIndex ?? -1) + 1;
    if (item.action === 'name-side' && subjectWords <= 2) expect(practice).toBeNull();
    else {
      expect(practice, 'a practice item').not.toBeNull();
      expect(practice!.id).not.toBe(item.id);
      expect(practice!.sentence).not.toBe(item.sentence);
      expect(practice!.mode).toBe(item.mode);
      if (item.action !== 'name-side' && item.action !== 'name-type') expect(item.wallLabels).toContain(practice!.answer);
      expect(ids).toContain(item.action === 'name-side' ? SHORT_SUBJECT_LEVER : item.action === 'name-type' ? PLAIN_KIND_LEVER : SHORT_SENTENCE_LEVER);
    }
    // A starting lever (easy: the wall examples) is already on screen, so a miss it answers goes to the next lever.
    const started = startingLevers(item.tier).length > 0;
    for (const miss of sentenceSpokenMisses(item)) {
      expect(levers.some(l => l.answers?.includes(miss.id)), miss.id).toBe(true);
      if (!started) expect(levers.find(l => l.id === nextLever(levers, miss.id))?.kind, miss.id).toBe('help');
    }
    // The scene fact never labels a word of this sentence.
    const fact = SENTENCE_LEVERS.onScreen(item, s, levers.map(l => l.id));
    if (item.targetWord) expect(fact.toLowerCase()).not.toMatch(new RegExp(`(^|[ :])${item.targetWord.toLowerCase().replace(/[.?!,]/g, '')} \\(`));
  });
});

describe('answer-blind (R1, R2)', () => {
  const { session: s } = PAYLOADS.find(p => p.session.items.some(i => i.action === 'name-pos'))!;
  const item = s.items.find(i => i.action === 'name-pos')!;
  it('two items that differ only in the answer get the same model and practice', () => {
    const a = { ...item, answer: 'Adjective' }, b = { ...item, answer: 'Adverb' };
    expect(modelSentenceFor(a, s.words)).toEqual(modelSentenceFor(b, s.words));
    expect(practiceFor(a, s)?.sentence).toBe(practiceFor(b, s)?.sentence);
    expect(practiceFor(a, s)?.targetIndex).toBe(practiceFor(b, s)?.targetIndex);
  });
});

describe('misses and card', () => {
  const base = PAYLOADS.flatMap(p => p.session.items);
  it('describing_word on adjective and adverb asks; named_the_side on role asks that are not subject or predicate', () => {
    const pos = base.find(i => i.action === 'name-pos')!;
    expect(sentenceSpokenMisses({ ...pos, answer: 'Adverb' }).map(m => m.id)).toContain('describing_word');
    expect(sentenceSpokenMisses({ ...pos, answer: 'Noun' }).map(m => m.id)).not.toContain('describing_word');
    const role = base.find(i => i.action === 'name-role')!;
    expect(sentenceSpokenMisses({ ...role, answer: 'Modifier' }).map(m => m.id)).toContain('named_the_side');
    expect(sentenceSpokenMisses({ ...role, answer: 'Subject' }).map(m => m.id)).not.toContain('named_the_side');
  });
  it('declares levers, and every mode miss is answered by a lever on a saved payload of that mode', () => {
    expect(sentenceAnalyzerCard.levers).toBe(true);
    for (const [mode, { misses }] of Object.entries(sentenceAnalyzerCard.modes)) {
      const answered = new Set(PAYLOADS.flatMap(p => p.session.items.filter(i => i.mode === mode)
        .flatMap(i => SENTENCE_LEVERS.declare(i, p.session, []).flatMap(l => l.answers ?? []))));
      for (const m of misses) expect(answered.has(m), `${mode} ${m}`).toBe(true);
    }
  });
  it('a pulled help lever is reported pulled; easy starts with the wall examples, not offered', () => {
    const { session: s } = PAYLOADS[0], item = s.items[0];
    const helpId = SENTENCE_LEVERS.declare(item, s, []).find(l => l.kind === 'help')!.id;
    expect(SENTENCE_LEVERS.declare(item, s, [helpId]).find(l => l.id === helpId)?.pulled).toBe(true);
    expect(startingLevers('easy')).toEqual([EXAMPLES_LEVER]);
    expect(SENTENCE_LEVERS.declare({ ...item, tier: 'easy' }, s, []).map(l => l.id)).not.toContain(EXAMPLES_LEVER);
  });
});
