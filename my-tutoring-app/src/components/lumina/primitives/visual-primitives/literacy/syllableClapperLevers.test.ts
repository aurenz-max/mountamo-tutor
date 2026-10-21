/**
 * syllable-clapper's lever set (`/add-support-tiers`, handoff 22 L2): models and practice stay off the session's
 * words and parts, a counting model never has the item's count, practice keeps the act, and no lever tallies claps.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { syllableClapperCard } from './syllableClapper.card';
import { itemsFromChallenges, type SyllableClapperItem } from './syllableClapperDomain';
import {
  COMPOUNDS, SYLLABLE_LEVERS, clapModelFor, deleteModelFor, practiceItemFor, practiceLeak, syllableBuildLevers, syllableSessionWords,
} from './syllableClapperLevers';
import type { LetterBuildItem } from './letterBuild';

const payload = (mode: string): SyllableClapperItem[] => itemsFromChallenges(JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/syllable-clapper.${mode}.json`), 'utf8')).data.challenges);
const DELETE = itemsFromChallenges([
  { id: 'd1', word: 'cowboy', syllables: ['cow', 'boy'], challengeType: 'delete_compound', removePart: 'cow', residue: 'boy' },
  { id: 'd2', word: 'sunhat', syllables: ['sun', 'hat'], challengeType: 'delete_compound', removePart: 'hat', residue: 'sun' },
]);

describe.each([['blend', payload('blend_syllables')], ['count', payload('count_parts')], ['delete', DELETE]] as const)('%s', (_l, items) => {
  it('builds', () => expect(items.length).toBeGreaterThan(1));

  it('every practice item keeps the act and uses no session word or part', () => {
    for (const item of items) {
      const practice = practiceItemFor(item, items);
      if (item.task === 'count_parts' && item.partCount < 2) { expect(practice).toBeNull(); continue; }
      expect(practice, item.id).toBeTruthy();
      expect(practiceLeak(practice!, item, items)).toBe(false);
      if (item.task === 'count_parts') expect(practice!.partCount).toBeLessThan(item.partCount);
    }
  });

  it('models share no word or part with the session; a clap model never has the item\'s count', () => {
    const used = syllableSessionWords(items);
    for (const item of items) {
      const clap = clapModelFor(item, items), del = deleteModelFor(item, items);
      if (item.task === 'count_parts') {
        expect(clap!.parts.length).not.toBe(item.partCount);
        expect(used.has(clap!.word)).toBe(false);
      }
      if (item.task === 'delete_compound') expect([del!.word, ...del!.parts].some(w => used.has(w))).toBe(false);
    }
  });
});

describe('levers', () => {
  const [blend, count] = [payload('blend_syllables')[0], payload('count_parts')[0]];
  const ids = (item: SyllableClapperItem, items: readonly SyllableClapperItem[]) =>
    SYLLABLE_LEVERS.declare(item, { items }, []).map(l => l.id);

  it('each act\'s levers; the slow echo comes back only where the tier dropped it; no clap tally', () => {
    expect(ids(blend, [blend])).toEqual(['part_beats', 'two_part_blend']);
    expect(ids(DELETE[0], DELETE)).toEqual(['delete_model', 'drop_first_part']);
    expect(ids({ ...count, echoSlowly: false }, [count])).toContain('stretched_joined');
    expect(ids({ ...count, echoSlowly: true }, [count])).not.toContain('stretched_joined');
    for (const items of [[blend], [count], DELETE]) for (const item of items) {
      for (const l of SYLLABLE_LEVERS.declare({ ...item, echoSlowly: false }, { items }, [])) {
        expect(l.id).not.toMatch(/counter|tally/);
        for (const miss of l.answers ?? []) expect(syllableClapperCard.modes[item.task].misses).toContain(miss);
      }
    }
  });

  it('the voiced lever names no count; a pulled model is told to the tutor as another word', () => {
    const stretch = SYLLABLE_LEVERS.declare({ ...count, echoSlowly: false }, { items: [count] }, []).find(l => l.id === 'stretched_joined')!;
    expect(stretch.carrier).toBe('voiced');
    expect(stretch.does).not.toMatch(/\b(one|two|three|four|five|\d)\b/);
    expect(SYLLABLE_LEVERS.onScreen(DELETE[0], { items: DELETE }, ['delete_model'])).toMatch(/is left\. Say it through; it is not this item's word/);
    expect(nextLever(SYLLABLE_LEVERS.declare(DELETE[0], { items: DELETE }, []), 'whole_word')).toBe('delete_model');
    expect(COMPOUNDS.every(c => c.parts.join('') === c.word)).toBe(true);
  });

  it('a model lever is told when to come by the lesson tier', () => {
    expect(SYLLABLE_LEVERS.support({ ...count, supportTier: 'easy' }, { items: [count] })).toMatch(/clap_model/);
    expect(SYLLABLE_LEVERS.support(blend, { items: [blend] })).toBe('');
  });

  it('build_parts: clap marks, a model word and a smaller bank, stamped for the shared surface', () => {
    const three: LetterBuildItem = { id: 't', kind: 'syllables', parts: 3, ask: 'Make a word with three parts.', ways: 1,
      bank: ['ba', 'ter', 'pop', 'na', 'fly', 'corn', 'but'], examples: ['banana', 'butterfly'] };
    const bound = syllableBuildLevers('medium');
    expect(bound.declare(three, []).map(l => l.id)).toEqual(['clap_cards', 'model_word', 'small_bank']);
    expect(bound.simpler(three, 'small_bank')).toMatchObject({ parts: 2, mode: 'build_parts' });
    expect(bound.onScreen(three, ['clap_cards'])).toMatch(/clap mark/);
  });
});
