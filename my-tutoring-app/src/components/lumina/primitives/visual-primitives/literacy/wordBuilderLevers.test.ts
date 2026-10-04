import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { itemFromTarget, itemsFromTargets, type WordBuilderComplexity } from './wordBuilderScript';
import { wordBuilderSpokenMisses } from './wordBuilderWorkspace';
import { MODEL_LEVER, POOL, SLOTS_LEVER, SMALL_BOARD_LEVER, leversOnScreen, modelFor, modelLeak, practiceLeak, slotFrame,
  smallBoardWordFor, startingLevers, wordBuilderLevers } from './wordBuilderLevers';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS = readdirSync(DIR).filter(f => f.startsWith('word-builder.')).map(f => {
  const d = JSON.parse(readFileSync(join(DIR, f), 'utf-8')).data;
  const level = d.complexityLevel as WordBuilderComplexity;
  return { file: f, board: d.availableParts, items: itemsFromTargets(d.targets, d.availableParts, level) };
});

describe('the pools', () => {
  it.each(Object.entries(POOL).flatMap(([tier, words]) => words.map(w => [tier, w.word, w] as const)))('%s %s passes the build gates', (_t, _w, p) => {
    const board = p.parts.map(([text, type, meaning], i) => ({ id: `p${i}`, text, type, meaning }));
    const item = itemFromTarget({ word: p.word, parts: board.map(b => b.id), hint: p.clue, definition: p.clue }, board, 'compound_affix');
    expect(item?.word).toBe(p.word);
  });
});

describe.each(PAYLOADS.map(p => [p.file, p] as const))('%s', (_f, { board, items }) => {
  it('has items', () => expect(items.length).toBeGreaterThan(1));
  it.each(items.map(i => [i.word, i] as const))('%s: the frame is types only; model and practice are leak-free', (_w, item) => {
    expect(slotFrame(item)).toEqual(item.parts.map(p => p.type));
    const model = modelFor(item, items, board);
    expect(model, 'a model exists').not.toBeNull();
    expect(modelLeak(model!, items)).toBe(false);
    expect(model!.parts.map(p => p[1])).toEqual(slotFrame(item));
    const practice = smallBoardWordFor(item, items, board);
    expect(practice, 'a practice word exists').not.toBeNull();
    expect(practiceLeak(practice!, items, model)).toBe(false);
    expect(practice!.item.parts.map(p => p.text).join('')).toBe(practice!.item.word);
    expect(practice!.item.id).not.toBe(item.id);
    // One step simpler on a 3-part Greek/Latin item, the same shape otherwise.
    const want = item.complexity === 'greek_latin' && item.parts.length === 3 ? ['prefix', 'root'] : slotFrame(item);
    expect(practice!.item.parts.map(p => p.type)).toEqual(want);
    // The board is the word's parts plus at most one foil per type.
    const types = new Set(practice!.item.parts.map(p => p.type));
    expect(practice!.board.length).toBeLessThanOrEqual(practice!.item.parts.length + types.size);
    // The scene fact names the model word and kinds, never this word or its parts.
    const fact = leversOnScreen([SLOTS_LEVER, MODEL_LEVER], item, items, board)!;
    expect(fact.toLowerCase()).not.toContain(item.word.toLowerCase());
    for (const p of item.parts) expect(fact.toLowerCase()).not.toMatch(new RegExp(`\\b${p.text.toLowerCase()}\\b`));
  });
  it('every miss an item can show has a lever, and the first lever after it is help', () => {
    for (const item of items) {
      const levers = wordBuilderLevers(item, items, board, []);
      for (const miss of wordBuilderSpokenMisses(item, board)) {
        expect(levers.some(l => l.answers?.includes(miss.id)), miss.id).toBe(true);
        expect(levers.find(l => l.id === nextLever(levers, miss.id))?.kind).toBe('help');
      }
      // Help pulled, the next lever after a miss is the practice word.
      const pulled = wordBuilderLevers(item, items, board, [SLOTS_LEVER, MODEL_LEVER]);
      expect(nextLever(pulled, 'root_only')).toBe(SMALL_BOARD_LEVER);
    }
  });
});

describe('catalog', () => {
  const tw = getComponentById('word-builder')!.teachingWorkspace!;
  it('declares levers, and every mode miss is answered by a lever', () => {
    expect(tw.levers).toBe(true);
    const answered = new Set(PAYLOADS.flatMap(p => p.items.flatMap(i => wordBuilderLevers(i, p.items, p.board, []).flatMap(l => l.answers ?? []))));
    for (const [mode, misses] of Object.entries(tw.misses!)) for (const m of misses) expect(answered.has(m), `${mode} ${m}`).toBe(true);
    expect(tw.misses!.simple_affix).not.toContain('part_missing');
  });
});

describe('starting positions (R8)', () => {
  it('easy starts with the frame on screen and does not offer it; other tiers start with nothing', () => {
    const { items, board } = PAYLOADS[0];
    expect(startingLevers('easy')).toEqual([SLOTS_LEVER]);
    expect(wordBuilderLevers(items[0], items, board, [], startingLevers('easy')).map(l => l.id)).not.toContain(SLOTS_LEVER);
    for (const t of ['medium', 'hard', undefined]) expect(startingLevers(t)).toEqual([]);
  });
});
