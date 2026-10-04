import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { gradeNumberOf, itemsFromPayload, posWallFor, type SentenceAnalyzerItem } from './sentenceAnalyzerScript';
import { sentenceSpokenMisses } from './sentenceAnalyzerWorkspace';
import { EXAMPLES_LEVER, MODEL_LEVER, PLAIN_KIND_LEVER, SHORT_SENTENCE_LEVER, SHORT_SUBJECT_LEVER, SPLIT_LEVER, TWO_ROW_LEVER,
  leversOnScreen, modelSentenceFor, poolLeak, practiceFor, sentenceAnalyzerLevers, sessionWords, splitModelFor,
  startingLevers, twoRowModelFor, wallExamplesFor, type LeverContext } from './sentenceAnalyzerLevers';
import { MODEL_SENTENCES, PRACTICE_KIND, PRACTICE_POS, PRACTICE_ROLE, PRACTICE_SIDE, WALL_EXAMPLES } from './sentenceModels';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS = readdirSync(DIR).filter(f => f.startsWith('sentence-analyzer.')).map(f => {
  const data = JSON.parse(readFileSync(join(DIR, f), 'utf-8')).data;
  const built = itemsFromPayload(data);
  const ctxFor = (item: SentenceAnalyzerItem): LeverContext => ({ items: built.items, posWall: posWallFor(gradeNumberOf(data.gradeLevel)),
    readsAloud: built.readsAloud, subjectWords: (built.sentences.find(x => x.index === item.sentenceIndex)?.subjectEndIndex ?? -1) + 1 });
  return { file: f, items: built.items, ctxFor };
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

describe.each(PAYLOADS.map(p => [p.file, p] as const))('%s', (_f, { items, ctxFor }) => {
  const session = sessionWords(items);
  it('has items', () => expect(items.length).toBeGreaterThan(0));
  it.each(items.map(i => [i.id, i] as const))('%s: its levers are leak-free and answer every miss it can show', (_id, item) => {
    const ctx = ctxFor(item);
    const levers = sentenceAnalyzerLevers(item, ctx, []);
    const ids = levers.map(l => l.id);
    if (item.action === 'name-pos') {
      const m = modelSentenceFor(item, session);
      expect(m).not.toBeNull();
      expect(poolLeak(m!, session)).toBe(false);
      for (const [a, b] of [['Adjective', 'Adverb'], ['Noun', 'Pronoun']]) if (item.wallLabels.includes(a) && item.wallLabels.includes(b))
        expect(m!.words.some(w => w.pos === a) && m!.words.some(w => w.pos === b)).toBe(true);
    }
    if (item.action === 'name-role') {
      const m = twoRowModelFor(item, session, ctx.posWall);
      expect(m).not.toBeNull();
      for (const role of item.wallLabels) expect(m!.words.some(w => w.role === role), role).toBe(true);
    }
    if (item.action === 'name-side') expect(splitModelFor(item, session)).not.toBeNull();
    if (item.wallLabels.length && item.action !== 'name-side') expect(wallExamplesFor(item, session)).not.toBeNull();
    const practice = practiceFor(item, session, ctx);
    if (item.action === 'name-side' && ctx.subjectWords <= 2) expect(practice).toBeNull();
    else {
      expect(practice, 'a practice item').not.toBeNull();
      expect(practice!.item.id).not.toBe(item.id);
      expect(practice!.item.sentence).not.toBe(item.sentence);
      if (item.action !== 'name-side' && item.action !== 'name-type') expect(item.wallLabels).toContain(practice!.item.answer);
      expect(ids).toContain(item.action === 'name-side' ? SHORT_SUBJECT_LEVER : item.action === 'name-type' ? PLAIN_KIND_LEVER : SHORT_SENTENCE_LEVER);
    }
    for (const miss of sentenceSpokenMisses(item)) {
      expect(levers.some(l => l.answers?.includes(miss.id)), miss.id).toBe(true);
      expect(levers.find(l => l.id === nextLever(levers, miss.id))?.kind, miss.id).toBe('help');
    }
    // The scene fact never labels a word of this sentence.
    const fact = leversOnScreen(levers.map(l => l.id), item, ctx) ?? '';
    if (item.targetWord) expect(fact.toLowerCase()).not.toMatch(new RegExp(`(^|[ :])${item.targetWord.toLowerCase().replace(/[.?!,]/g, '')} \\(`));
  });
});

describe('answer-blind (R1, R2)', () => {
  const { items, ctxFor } = PAYLOADS.find(p => p.items.some(i => i.action === 'name-pos'))!;
  const item = items.find(i => i.action === 'name-pos')!;
  it('two items that differ only in the answer get the same model and practice', () => {
    const a = { ...item, answer: 'Adjective' }, b = { ...item, answer: 'Adverb' };
    const sa = sessionWords(items);
    expect(modelSentenceFor(a, sa)).toEqual(modelSentenceFor(b, sa));
    expect(practiceFor(a, sa, ctxFor(item))?.item.sentence).toBe(practiceFor(b, sa, ctxFor(item))?.item.sentence);
    expect(practiceFor(a, sa, ctxFor(item))?.item.targetIndex).toBe(practiceFor(b, sa, ctxFor(item))?.item.targetIndex);
  });
});

describe('misses and catalog', () => {
  const base = PAYLOADS.flatMap(p => p.items);
  it('describing_word on adjective and adverb asks; named_the_side on role asks that are not subject or predicate', () => {
    const pos = base.find(i => i.action === 'name-pos')!;
    expect(sentenceSpokenMisses({ ...pos, answer: 'Adverb' }).map(m => m.id)).toContain('describing_word');
    expect(sentenceSpokenMisses({ ...pos, answer: 'Noun' }).map(m => m.id)).not.toContain('describing_word');
    const role = base.find(i => i.action === 'name-role')!;
    expect(sentenceSpokenMisses({ ...role, answer: 'Modifier' }).map(m => m.id)).toContain('named_the_side');
    expect(sentenceSpokenMisses({ ...role, answer: 'Subject' }).map(m => m.id)).not.toContain('named_the_side');
  });
  it('declares levers, and every mode miss is answered by a lever on a saved payload', () => {
    const tw = getComponentById('sentence-analyzer')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    const answered = new Set(PAYLOADS.flatMap(p => p.items.flatMap(i => sentenceAnalyzerLevers(i, p.ctxFor(i), []).flatMap(l => l.answers ?? []))));
    for (const [mode, misses] of Object.entries(tw.misses!)) for (const m of misses) expect(answered.has(m), `${mode} ${m}`).toBe(true);
  });
  it('a pulled help lever is reported pulled; easy starts with the wall examples, not offered', () => {
    const p = PAYLOADS[0], item = p.items[0];
    const helpId = sentenceAnalyzerLevers(item, p.ctxFor(item), []).find(l => l.kind === 'help')!.id;
    expect(sentenceAnalyzerLevers(item, p.ctxFor(item), [helpId]).find(l => l.id === helpId)?.pulled).toBe(true);
    expect(startingLevers('easy')).toEqual([EXAMPLES_LEVER]);
    expect(sentenceAnalyzerLevers(item, p.ctxFor(item), [], ['wall_examples']).map(l => l.id)).not.toContain(EXAMPLES_LEVER);
    expect([MODEL_LEVER, TWO_ROW_LEVER, SPLIT_LEVER]).toBeTruthy();
  });
});
