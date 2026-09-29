/**
 * phonics-blender's levers (`/add-support-tiers`, handoff 24): on every saved payload, each miss has a lever, the
 * name/sound model uses a letter no session word has, and the practice word is never a session word or its ending.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { blendItems } from './phonicsBlenderWorkspace';
import { nameModelFor, nameModelLeak, phonicsBlenderLevers, practiceLeak, shortWordFor, type Segmentation } from './phonicsBlenderLevers';

const MODES = ['cvc', 'cvce_blend', 'digraph', 'advanced'] as const;
const load = (mode: string) => {
  const data = JSON.parse(readFileSync(join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads',
    `phonics-blender.${mode}.json`), 'utf8')).data;
  return { items: blendItems(data.words), patternType: data.patternType as string };
};
const entry = LITERACY_CATALOG.find(c => c.id === 'phonics-blender')!.teachingWorkspace!;

describe.each(MODES)('%s (saved payload)', mode => {
  const { items, patternType } = load(mode);

  it('every catalog miss is answered on a joined row and on a split row; the ladder picks the lever', () => {
    expect(entry.levers).toBe(true);
    for (const seg of ['full', 'none'] as Segmentation[]) {
      for (const item of items) {
        const levers = phonicsBlenderLevers(item, patternType, seg, [], items);
        const answered = new Set(levers.flatMap(l => l.answers ?? []));
        for (const miss of entry.misses![mode]) expect(answered.has(miss), `${item.targetWord} ${seg} ${miss}`).toBe(true);
        for (const miss of entry.misses![mode]) expect(nextLever(levers, miss)).toBeTruthy();
      }
    }
  });

  it('help levers are visual except the name/sound model, which is on a letter no session word has', () => {
    const model = nameModelFor(items)!;
    expect(model).toBeTruthy();
    expect(nameModelLeak(model, items)).toBe(false);
    for (const l of phonicsBlenderLevers(items[0], patternType, 'full', [], items)) {
      expect(l.carrier).toBe(l.id === 'name_sound_model' ? 'both' : 'shown');
      if (l.carrier === 'shown') expect(l.does).not.toMatch(new RegExp(`\\b${items[0].targetWord}\\b`, 'i'));
    }
  });

  it('the practice word is shorter by one step, a session word never, and a two-letter word never a session ending', () => {
    for (const item of items) {
      const practice = shortWordFor(item, patternType, items)!;
      expect(practice, item.targetWord).toBeTruthy();
      expect(practiceLeak(practice.targetWord, items)).toBe(false);
      expect(practice.id).toBe(`${item.id}~simpler`);
      expect(practice.targetWord.length).toBeLessThan(patternType === 'cvc' ? 3 : 4);
      expect(practice.phonemes.map(p => p.letters).join('')).toBe(practice.targetWord);
    }
  });
});

it('sound_dots only on a joined row, blend_slide only on a split one', () => {
  const { items, patternType } = load('cvc');
  const ids = (seg: Segmentation) => phonicsBlenderLevers(items[0], patternType, seg, [], items).map(l => l.id);
  expect(ids('none')).toEqual(['sound_dots', 'tracking_arrow', 'name_sound_model', 'short_word']);
  expect(ids('full')).toEqual(['blend_slide', 'tracking_arrow', 'name_sound_model', 'short_word']);
});

it('practice leak: "at" is refused on a session with "cat"; a session word is refused', () => {
  const items = blendItems([{ id: 'w', targetWord: 'cat', phonemes: [] }]);
  expect(practiceLeak('at', items)).toBe(true);
  expect(practiceLeak('cat', items)).toBe(true);
  expect(practiceLeak('up', items)).toBe(false);
});

it('name_sound_model: its description names no model letter (read before the pull)', () => {
  const { items, patternType } = load('cvc');
  const m = nameModelFor(items)!;
  const lever = phonicsBlenderLevers(items[0], patternType, 'full', [], items).find(l => l.id === 'name_sound_model')!;
  expect(lever.does).not.toMatch(new RegExp(`\b(${m.letter}|${m.name}|${m.sound})\b`, 'i'));
});
