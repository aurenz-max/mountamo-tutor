/**
 * The ordinal-line spoken-mode levers (handoff 23 step 2): which lever answers which miss, each lever's leak rule on the
 * saved payloads, and the easier lines and stories.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { itemsFromChallenges, type OrdinalLineItem } from './ordinalLineScript';
import { ordinalSpokenMisses } from './ordinalLineWorkspace';
import { FRONT_LEVER, PLACE_MODEL_LEVER, SHORTER_LEVER, SIDE_MODEL_LEVER, STORY_LEVER, TAP_LEVER, WORD_MODEL_LEVER,
  ordinalSpokenLevers, placeModel, shortStory, shorterLine, sideModel, spokenLeverFacts } from './ordinalLineSpokenLevers';

const FILES: Record<string, string[]> = { identify: ['identify', 'identify-g1'], match: ['match'],
  relative_position: ['relative_position'], sequence_story: ['sequence_story'] };
const itemsOf = (file: string) => {
  const data = JSON.parse(readFileSync(join(__dirname,
    `../../../components/live-activity/runtime/testing/w1-payloads/ordinal-line.${file}.json`), 'utf8')).data;
  return itemsFromChallenges(data.challenges, { band: data.gradeBand ?? 'K', context: data.context ?? 'race' }).items;
};
const ids = (item: OrdinalLineItem, pulled: string[] = []) => ordinalSpokenLevers(item, pulled).map(l => l.id);
const [kIdentify] = itemsOf('identify'), [g1Identify] = itemsOf('identify-g1');
const [relative] = itemsOf('relative_position'), [match] = itemsOf('match'), [story] = itemsOf('sequence_story');

describe('which lever answers which miss', () => {
  it.each([
    [g1Identify, 'wrong_end', FRONT_LEVER], [g1Identify, 'next_to_place', TAP_LEVER], [g1Identify, 'cardinal_for_ordinal', WORD_MODEL_LEVER],
    [relative, 'wrong_side', FRONT_LEVER], [relative, 'said_anchor', SIDE_MODEL_LEVER],
    [match, 'cardinal_for_ordinal', PLACE_MODEL_LEVER], [match, 'next_to_place', PLACE_MODEL_LEVER],
    [story, 'cardinal_for_ordinal', WORD_MODEL_LEVER], [story, 'next_to_place', STORY_LEVER],
  ] as const)('%#: after %s', (item, miss, lever) => { expect(nextLever(ordinalSpokenLevers(item, []), miss)).toBe(lever); });
  it('the word model is offered only where the answer is a place word; the line levers only on the spoken line modes', () => {
    expect(kIdentify.direction).toBe('name_character');
    expect(ids(kIdentify)).not.toContain(WORD_MODEL_LEVER);
    expect(ids(g1Identify)).toContain(WORD_MODEL_LEVER);
    expect(ids(match)).toEqual([PLACE_MODEL_LEVER]);
    expect(ordinalSpokenLevers(itemsOf('build_sequence')[0], [])).toEqual([]);
    expect(nextLever(ordinalSpokenLevers(relative, [FRONT_LEVER, SIDE_MODEL_LEVER]), 'wrong_side')).toBe(SHORTER_LEVER);
  });
  it("on every saved payload, the levers answer only the mode's catalog misses, and every miss is answered", () => {
    const entry = getComponentById('ordinal-line')!.teachingWorkspace!;
    for (const [mode, files] of Object.entries(FILES)) {
      const answered = new Set(files.flatMap(itemsOf).flatMap(i => ordinalSpokenLevers(i, [])).flatMap(l => l.answers ?? []));
      answered.forEach(m => expect(entry.misses![mode], mode).toContain(m));
      expect(entry.misses![mode].filter(m => !answered.has(m)), mode).toEqual(entry.unanswered?.[mode] ?? []);
    }
  });
});

describe('leak rules', () => {
  const all = Object.values(FILES).flat().flatMap(itemsOf);
  it('the side model is fixed per question word; the place model counts only to the place the card prints', () => {
    expect(sideModel('before')).toEqual({ ringed: 1, glow: 0 });
    expect(sideModel('after')).toEqual({ ringed: 1, glow: 2 });
    for (const item of itemsOf('match')) expect(placeModel(item)).toBe(Number(item.symbol.replace(/\D/g, '')));
  });
  it('no scene fact names a character, a place word the item answers with, or a digit', () => {
    for (const item of all) {
      const fact = spokenLeverFacts(item, ids(item));
      expect(fact, item.id).not.toMatch(/\d/);
      for (const name of item.lineNames) expect(fact, item.id).not.toContain(name);
      if (item.answerText && !['first', 'second', 'third'].includes(item.answerText)) expect(fact, item.id).not.toContain(item.answerText);
    }
  });
});

describe('the easier items', () => {
  const lines = [...itemsOf('identify'), ...itemsOf('identify-g1'), ...itemsOf('relative_position')];
  it('shorter_line: same mode and question, new characters, a short line, and never the item\'s answer', () => {
    let built = 0;
    for (const item of lines) {
      const easier = shorterLine(item);
      if (!easier) { expect(item.lineNames.length <= 4 && item.askPosition <= 3, item.id).toBe(true); continue; }
      built++;
      const p = easier.item;
      expect([p.kind, p.direction, p.id]).toEqual([item.kind, item.direction, `${item.id}~simpler`]);
      expect(p.lineNames.filter(n => item.lineNames.includes(n))).toEqual([]);
      expect(p.lineNames.length).toBeLessThanOrEqual(4);
      expect(p.answerText).not.toBe(item.answerText);
      if (item.kind === 'relative_position') expect(p.relativeQuery).toBe(item.relativeQuery);
      else expect(p.askPosition).not.toBe(item.askPosition);
      expect(ordinalSpokenMisses(p).length).toBeGreaterThan(0);
      for (const n of p.lineNames) expect(easier.emojis.get(n)).toBeTruthy();
    }
    expect(built).toBeGreaterThan(10);
  });
  it('short_story: four new characters, another middle place than the item, told front to back', () => {
    for (const item of itemsOf('sequence_story')) {
      const easier = shortStory(item)!;
      expect(easier, item.id).not.toBeNull();
      const p = easier.item;
      expect([p.kind, p.id, p.clues.length]).toEqual(['sequence_story', `${item.id}~simpler`, 4]);
      expect(p.askPosition).not.toBe(item.askPosition);
      expect([2, 3]).toContain(p.askPosition);
      expect(p.clues.map(c => c.name).filter(n => item.lineNames.includes(n))).toEqual([]);
    }
  });
});
