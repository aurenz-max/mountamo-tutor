/**
 * sound-swap's levers (`/add-support-tiers`, handoff 22 L2): models and practice stay off the session's words and
 * sound, practice keeps the operation, and the misses are the catalog's.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { rimeOfWord } from './rhymeModels';
import type { SoundSwapChallenge } from './SoundSwap';
import { SWAP_MISSES, operatedSound, practiceItemFor, practiceLeak, soundSwapLevers, swapModelFor, swapSessionWords, targetTile } from './soundSwapLevers';

const saved: SoundSwapChallenge[] = JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads/sound-swap.addition.json'), 'utf8')).data.challenges;
const ch = (id: string, operation: SoundSwapChallenge['operation'], from: string, to: string, fields: Partial<SoundSwapChallenge>): SoundSwapChallenge =>
  ({ id, operation, originalWord: from, originalPhonemes: from.split('').map(c => `/${c}/`), originalImage: '', resultWord: to,
    resultPhonemes: [], resultImage: '', ...fields });
const DEL = ch('d', 'deletion', 'stop', 'top', { deletePhoneme: '/s/', deletePosition: 'beginning' });
const SUB = ch('s', 'substitution', 'cat', 'cot', { oldPhoneme: '/a/', newPhoneme: '/o/', substitutePosition: 'middle' });
const END = ch('e', 'addition', 'car', 'card', { addPhoneme: '/d/', addPosition: 'end' });

describe.each([['saved addition', saved], ['deletion', [DEL, ...saved]], ['substitution', [SUB, DEL]], ['end addition', [END, SUB]]] as const)('%s', (_l, session) => {
  it('the model and the practice item use no session word, not the item\'s sound, and no rhyme of its answer', () => {
    const used = swapSessionWords(session);
    for (const item of session) {
      const model = swapModelFor(item, session)!;
      expect(model, item.id).toBeTruthy();
      expect(used.has(model.from) || used.has(model.to)).toBe(false);
      expect(rimeOfWord(model.to)).not.toBe(rimeOfWord(item.resultWord));
      const practice = practiceItemFor(item, session)!;
      expect(practice, item.id).toBeTruthy();
      expect(practiceLeak(practice, item, session)).toBe(false);
      expect(practice.id).toBe(`${item.id}~simpler`);
    }
  });
});

describe('the item', () => {
  it('an end addition gets an end model; practice changes the first sound with a held sound', () => {
    expect(swapModelFor(END, [END])).toMatchObject({ position: 'end' });
    const p = practiceItemFor(END, [END])!;
    expect(p).toMatchObject({ operation: 'addition', addPosition: 'beginning' });
    expect(['/f/', '/l/', '/m/', '/s/', '/r/']).toContain(p.addPhoneme);
  });

  it('the mark lever finds the tile to change or take away; an addition has none, only an empty tile', () => {
    expect(targetTile(DEL)).toBe(0);
    expect(targetTile({ ...SUB, oldPhoneme: '/a/' })).toBe(1);
    expect(targetTile(saved[0])).toBe(-1);
  });

  it('mark is offered where it adds something: never over the tier\'s own highlight', () => {
    const ids = (c: SoundSwapChallenge) => soundSwapLevers(c, [], [c, ...saved]).map(l => l.id);
    expect(ids(saved[0])).toEqual(['swap_model', 'mark_target_sound', 'easier_operation_item']);
    expect(ids(SUB)).toEqual(['swap_model', 'easier_operation_item']);
    expect(ids({ ...SUB, showTargetHighlight: false })).toEqual(['swap_model', 'mark_target_sound', 'easier_operation_item']);
    expect(ids(DEL)).toContain('mark_target_sound');
  });

  it('carriers count at K; the catalog declares every miss, unanswered until spoken misses land', () => {
    const entry = LITERACY_CATALOG.find(c => c.id === 'sound-swap')!.teachingWorkspace!;
    for (const mode of ['addition', 'deletion', 'substitution']) {
      expect(entry.misses![mode]).toEqual(SWAP_MISSES);
      expect(entry.unanswered![mode]).toEqual(SWAP_MISSES);
    }
    for (const l of soundSwapLevers(DEL, [], [DEL])) expect(['shown', 'both']).toContain(l.carrier);
    expect(nextLever(soundSwapLevers(DEL, [], [DEL]), 'echo_start')).toBe('swap_model');
    expect(operatedSound(DEL)).toBe('/s/');
  });
});
