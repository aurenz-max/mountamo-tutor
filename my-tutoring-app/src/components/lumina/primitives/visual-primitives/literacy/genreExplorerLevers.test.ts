import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { BINARY_BUCKET, GENRE_ALTERNATES, GENRE_LABEL, GENRE_SIBLING, askFor, askIsAnswerFree, choicesPhrase, isReadableAloud,
  itemsFromPayload, namesAGenre, type GenreExplorerItem, type GenreId } from './genreExplorerScript';
import { genreSpokenMisses } from './genreExplorerWorkspace';
import { FAR_KINDS_LEVER, KIND_PAIR_LEVER, farKindsFor, genreExplorerLevers, kindPairFor, leversOnScreen, modelLeak,
  pairModelFor, sentenceRows, startingLevers, textModelFor, type GenreSession } from './genreExplorerLevers';
import { GENRE_MODELS } from './genreModels';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS = readdirSync(DIR).filter(f => f.startsWith('genre-explorer.')).map(f => {
  const data = JSON.parse(readFileSync(join(DIR, f), 'utf-8')).data;
  const b = itemsFromPayload(data);
  const session: GenreSession = { items: b.items, excerpts: b.excerpts, menu: b.menu, readsAloud: b.readsAloud };
  return { file: f, mode: data.mode as string, session };
});
const idOf = (label: string) => (Object.keys(GENRE_LABEL) as GenreId[]).find(id => GENRE_LABEL[id] === label)!;

describe('the model pool', () => {
  it.each(GENRE_MODELS.map(m => [m.kind, m] as const))('%s: names no kind, reads aloud, shows its evidence', (_k, m) => {
    expect(namesAGenre(m.text)).toBe(false);
    expect(namesAGenre(m.predicate)).toBe(false);
    expect(isReadableAloud(m.text)).toBe(true);
    expect(m.text).toContain(m.evidence);
  });
  it('every sibling pair the kind_pair_model can draw has a text of each kind', () => {
    const kinds = new Set(GENRE_MODELS.map(m => m.kind));
    for (const k of ['biography', 'autobiography', 'fable', 'folktale', 'myth', 'legend', 'informational', 'persuasive'] as GenreId[]) expect(kinds.has(k), k).toBe(true);
  });
  it('sentence rows keep the text in order', () => expect(sentenceRows('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']));
});

describe.each(PAYLOADS.map(p => [p.file, p] as const))('%s', (_f, { mode, session }) => {
  const off = (k: GenreId) => !session.menu.includes(GENRE_LABEL[k]);
  it('has items', () => expect(session.items.length).toBeGreaterThan(0));
  it.each(session.items.map(i => [i.id, i] as const))('%s: levers are leak-free and answer every miss', (_id, item: GenreExplorerItem) => {
    const levers = genreExplorerLevers(item, session, []);
    const ids = levers.map(l => l.id);
    if (item.action === 'check-feature') {
      const m = textModelFor(item, session)!;
      expect(m).not.toBeNull(); expect(modelLeak(m, session)).toBe(false);
    }
    if (item.action === 'pick-excerpt') {
      const [a, b] = pairModelFor(item, session)!;
      expect(modelLeak(a, session) || modelLeak(b, session)).toBe(false);
      expect(BINARY_BUCKET[a.kind]).not.toBe(BINARY_BUCKET[b.kind]);
      expect(b.text).not.toContain(a.evidence);
    }
    if (item.action === 'name-genre') {
      const binary = mode === 'identify_basic';
      expect(ids.includes(KIND_PAIR_LEVER)).toBe(!binary && !!kindPairFor(item, session));
      if (binary) expect(ids).not.toContain(FAR_KINDS_LEVER);
      const pair = kindPairFor(item, session);
      if (pair) for (const m of pair) expect(off(m.kind), m.kind).toBe(true);
      const far = farKindsFor(item, session);
      if (!binary) {
        expect(far, 'a practice text').not.toBeNull();
        const [a, b] = far!.item.choices.map(idOf);
        expect(off(a) && off(b)).toBe(true);
        expect(BINARY_BUCKET[a]).not.toBe(BINARY_BUCKET[b]);
        expect(GENRE_SIBLING[a] ?? []).not.toContain(b);
        expect(far!.item.choices).toContain(far!.item.answer);
        expect(session.excerpts.map(e => e.text)).not.toContain(far!.text);
        expect(askIsAnswerFree(askFor(far!.item), far!.item.answer, choicesPhrase(far!.item))).toBe(true);
      }
    }
    for (const miss of genreSpokenMisses(item)) {
      expect(levers.some(l => l.answers?.includes(miss.id)), miss.id).toBe(true);
      expect(levers.find(l => l.id === nextLever(levers, miss.id))?.kind, miss.id).toBe('help');
    }
    // The scene fact never names the kind of the learner's text.
    if (item.action === 'name-genre' && !ids.includes('read_glosses')) {
      expect(leversOnScreen(ids, item, session) ?? '').not.toContain(item.answer);
    }
  });
});

describe('misses and catalog', () => {
  it('said_broad_kind never lists a form the answer accepts', () => {
    for (const { session } of PAYLOADS) for (const item of session.items.filter(i => i.action === 'name-genre')) {
      const broad = genreSpokenMisses(item).find(m => m.id === 'said_broad_kind');
      const accepted = [item.answer, ...GENRE_ALTERNATES[idOf(item.answer)]].map(a => a.toLowerCase());
      for (const e of broad?.examples ?? []) expect(accepted.some(a => a.includes(e))).toBe(false);
    }
  });
  it('per-mode misses, each answered by a lever on a saved payload of that mode', () => {
    const tw = getComponentById('genre-explorer')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    for (const [mode, misses] of Object.entries(tw.misses!)) {
      const answered = new Set(PAYLOADS.filter(p => p.mode === mode).flatMap(p => p.session.items
        .flatMap(i => genreExplorerLevers(i, p.session, []).flatMap(l => l.answers ?? []))));
      for (const m of misses) expect(answered.has(m), `${mode} ${m}`).toBe(true);
    }
  });
  it('easy starts with the rows, the two checks, or the menu marks, by action; never offered', () => {
    const all = PAYLOADS.flatMap(p => p.session.items.map(i => [i, p.session] as const));
    for (const [item, s] of all) {
      const start = startingLevers('easy', item);
      expect(start).toHaveLength(1);
      expect(genreExplorerLevers(item, s, [], start).map(l => l.id)).not.toContain(start[0]);
      expect(startingLevers('medium', item)).toEqual([]);
    }
  });
});
