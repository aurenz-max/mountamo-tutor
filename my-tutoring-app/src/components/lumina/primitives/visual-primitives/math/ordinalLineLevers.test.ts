/**
 * The ordinal-line lever set (handoff 21 M2 for the build, handoff 23 for the spoken modes): which lever answers which
 * miss, each lever's leak rule on the saved payloads, and the easier lines, builds and stories.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { itemsFromChallenge, itemsFromChallenges, lineMiss, ordinalSpokenMisses, type OrdinalLineItem } from './ordinalLineDomain';
import { ordinalLineCard } from './ordinalLine.card';
import {
  DOTS_LEVER, FLAG_LEVER, ORDINAL_LEVERS, PLACE_MODEL_LEVER, SHORTER_LEVER, SIDE_MODEL_LEVER, STORY_LEVER, TAP_LEVER, THREE_LEVER,
  WORD_MODEL_LEVER, castEmoji, placeModel, practiceFromId, shortStory, shorterLine, sideModel, threePlaces,
} from './ordinalLineLevers';

const declare = (item: OrdinalLineItem, pulled: string[] = []) => ORDINAL_LEVERS.declare(item, null, pulled);
const ids = (item: OrdinalLineItem, pulled: string[] = []) => declare(item, pulled).map(l => l.id);

const NAMES = ['Fox', 'Bear', 'Duck', 'Mole', 'Hen'];
const EMOJI = ['🦊', '🐻', '🦆', '🐹', '🐔'];
const build = (n: number, band: 'K' | '1' = 'K'): OrdinalLineItem => itemsFromChallenge({ id: `b${n}`, type: 'build-sequence',
  characters: NAMES.slice(0, n).map((name, i) => ({ name, emoji: EMOJI[i] })),
  clues: NAMES.slice(0, n).map((character, i) => ({ character, position: i + 1 })).reverse() }, { band, context: 'race' })[0];

const FILES: Record<string, string[]> = { identify: ['identify', 'identify-g1'], match: ['match'],
  relative_position: ['relative_position'], sequence_story: ['sequence_story'], build_sequence: ['build_sequence'] };
const itemsOf = (file: string) => {
  const data = JSON.parse(readFileSync(join(__dirname,
    `../../../components/live-activity/runtime/testing/w1-payloads/ordinal-line.${file}.json`), 'utf8')).data;
  return itemsFromChallenges(data.challenges, { band: data.gradeBand ?? 'K', context: data.context ?? 'race' }).items;
};
const [kIdentify] = itemsOf('identify'), [g1Identify] = itemsOf('identify-g1');
const [relative] = itemsOf('relative_position'), [match] = itemsOf('match'), [story] = itemsOf('sequence_story');

describe('build_sequence: which lever comes next', () => {
  it.each([['reversed', FLAG_LEVER], ['place_left_empty', DOTS_LEVER], ['two_swapped', DOTS_LEVER], ['other_order', DOTS_LEVER]])(
    'after %s: %s', (miss, lever) => { expect(nextLever(declare(build(4)), miss)).toBe(lever); });
  it('after the dots, a swap opens the easier line; the check and the table agree', () => {
    expect(nextLever(declare(build(4), [DOTS_LEVER]), 'two_swapped')).toBe(THREE_LEVER);
    expect(lineMiss(build(4), ['Mole', 'Duck', 'Bear', 'Fox'])).toBe('reversed');
  });
  it('three places get no simplify', () => {
    expect(ids(build(3))).toEqual([FLAG_LEVER, DOTS_LEVER]);
  });
});

describe('the spoken modes: which lever answers which miss', () => {
  it.each([
    [g1Identify, 'wrong_end', FLAG_LEVER], [g1Identify, 'next_to_place', TAP_LEVER], [g1Identify, 'cardinal_for_ordinal', WORD_MODEL_LEVER],
    [relative, 'wrong_side', FLAG_LEVER], [relative, 'said_anchor', SIDE_MODEL_LEVER],
    [match, 'cardinal_for_ordinal', PLACE_MODEL_LEVER], [match, 'next_to_place', PLACE_MODEL_LEVER],
    [story, 'cardinal_for_ordinal', WORD_MODEL_LEVER], [story, 'next_to_place', STORY_LEVER],
  ] as const)('%#: after %s', (item, miss, lever) => { expect(nextLever(declare(item), miss)).toBe(lever); });
  it('the word model is offered only where the answer is a place word; the line levers only on the spoken line modes', () => {
    expect(kIdentify.direction).toBe('name_character');
    expect(ids(kIdentify)).not.toContain(WORD_MODEL_LEVER);
    expect(ids(g1Identify)).toContain(WORD_MODEL_LEVER);
    expect(ids(match)).toEqual([PLACE_MODEL_LEVER]);
    expect(ids(itemsOf('build_sequence')[0])).not.toContain(TAP_LEVER);
    expect(nextLever(declare(relative, [FLAG_LEVER, SIDE_MODEL_LEVER]), 'wrong_side')).toBe(SHORTER_LEVER);
  });
  it("on every saved payload, the levers answer only the mode's card misses, and every miss is answered", () => {
    for (const [mode, files] of Object.entries(FILES)) {
      const misses: readonly string[] = ordinalLineCard.modes[mode].misses;
      const answered = new Set(files.flatMap(itemsOf).flatMap(i => declare(i)).flatMap(l => l.answers ?? []));
      answered.forEach(m => expect(misses, mode).toContain(m));
      expect(misses.filter(m => !answered.has(m)), mode).toEqual([]);
    }
  });
  it('only relative_position has a model lever, so only it carries a support rule', () => {
    expect(ORDINAL_LEVERS.support(relative)).toMatch(/side_model/);
    for (const item of [kIdentify, g1Identify, match, story, build(4)]) expect(ORDINAL_LEVERS.support(item)).toBe('');
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
      const fact = ORDINAL_LEVERS.onScreen(item, null, ids(item));
      expect(fact, item.id).not.toMatch(/\d/);
      for (const name of item.lineNames) expect(fact, item.id).not.toContain(name);
      if (item.answerText && !['first', 'second', 'third'].includes(item.answerText)) expect(fact, item.id).not.toContain(item.answerText);
    }
  });
});

describe('the easier items', () => {
  it('three_places on four places: three new pictures, contiguous clues, never spoken front to back, its own id', () => {
    for (const band of ['K', '1'] as const) {
      const item = build(4, band);
      const easier = threePlaces(item)!;
      expect(easier).toMatchObject({ kind: 'build_sequence', id: 'b4~simpler', band, context: 'race' });
      expect(easier.answerOrder).toHaveLength(3);
      expect(easier.answerOrder.some(name => item.lineNames.includes(name))).toBe(false);
      expect(easier.clues.map(c => c.position)).not.toEqual([1, 2, 3]);
      for (const name of easier.answerOrder) expect(castEmoji(name)).toBeTruthy();
      expect(ORDINAL_LEVERS.simpler(item, null, THREE_LEVER)).toEqual(easier);
      expect(practiceFromId('b4~simpler', [item])).toEqual(easier);
    }
  });

  const lines = [...itemsOf('identify'), ...itemsOf('identify-g1'), ...itemsOf('relative_position')];
  it('shorter_line: same mode and question, new characters, a short line, and never the item\'s answer', () => {
    let built = 0;
    for (const item of lines) {
      const p = shorterLine(item);
      if (!p) { expect(item.lineNames.length <= 4 && item.askPosition <= 3, item.id).toBe(true); continue; }
      built++;
      expect([p.kind, p.direction, p.id]).toEqual([item.kind, item.direction, `${item.id}~simpler`]);
      expect(p.lineNames.filter(n => item.lineNames.includes(n))).toEqual([]);
      expect(p.lineNames.length).toBeLessThanOrEqual(4);
      expect(p.answerText).not.toBe(item.answerText);
      if (item.kind === 'relative_position') expect(p.relativeQuery).toBe(item.relativeQuery);
      else expect(p.askPosition).not.toBe(item.askPosition);
      expect(ordinalSpokenMisses(p).length).toBeGreaterThan(0);
      for (const n of p.lineNames) expect(castEmoji(n)).toBeTruthy();
      expect(practiceFromId(p.id, [item])).toEqual(p);
    }
    expect(built).toBeGreaterThan(10);
  });
  it('short_story: four new characters, another middle place than the item, told front to back', () => {
    for (const item of itemsOf('sequence_story')) {
      const p = shortStory(item)!;
      expect(p, item.id).not.toBeNull();
      expect([p.kind, p.id, p.clues.length]).toEqual(['sequence_story', `${item.id}~simpler`, 4]);
      expect(p.askPosition).not.toBe(item.askPosition);
      expect([2, 3]).toContain(p.askPosition);
      expect(p.clues.map(c => c.name).filter(n => item.lineNames.includes(n))).toEqual([]);
    }
  });
});
