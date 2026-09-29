/**
 * syllable-clapper's levers (`/add-support-tiers`, handoff 22 L2): models and practice stay off the session's
 * words and parts, a counting model never has the item's count, practice keeps the act, and no lever tallies claps.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { itemsFromChallenges, type SyllableClapperItem } from './syllableClapperScript';
import {
  COMPOUNDS, SYLLABLE_MISSES, clapModelFor, deleteModelFor, practiceItemFor, practiceLeak, syllableClapperLevers, syllableSessionWords,
} from './syllableClapperLevers';

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
  const entry = LITERACY_CATALOG.find(c => c.id === 'syllable-clapper')!.teachingWorkspace!;
  const [blend, count] = [payload('blend_syllables')[0], payload('count_parts')[0]];

  it('each act\'s levers; the slow echo comes back only where the tier dropped it; no clap tally', () => {
    const ids = (item: SyllableClapperItem, items: readonly SyllableClapperItem[]) => syllableClapperLevers(item, [], items).map(l => l.id);
    expect(ids(blend, [blend])).toEqual(['part_beats', 'two_part_blend']);
    expect(ids(DELETE[0], DELETE)).toEqual(['delete_model', 'drop_first_part']);
    expect(ids({ ...count, echoSlowly: false }, [count])).toContain('stretched_joined');
    for (const items of [[blend], [count], DELETE]) for (const item of items) {
      for (const l of syllableClapperLevers({ ...item, echoSlowly: false }, [], items)) {
        expect(l.id).not.toMatch(/counter|tally/);
        for (const miss of l.answers ?? []) expect(entry.misses![item.task]).toContain(miss);
      }
    }
  });

  it('the voiced lever\'s fact names no count; the catalog lists every miss unanswered', () => {
    const stretch = syllableClapperLevers({ ...count, echoSlowly: false }, [], [count]).find(l => l.id === 'stretched_joined')!;
    expect(stretch.carrier).toBe('voiced');
    expect(stretch.does).not.toMatch(/\b(one|two|three|four|five|\d)\b/);
    for (const mode of Object.keys(SYLLABLE_MISSES) as Array<keyof typeof SYLLABLE_MISSES>) {
      expect(entry.misses![mode]).toEqual(SYLLABLE_MISSES[mode]);
      expect(entry.unanswered![mode]).toEqual(SYLLABLE_MISSES[mode]);
    }
    expect(nextLever(syllableClapperLevers(DELETE[0], [], DELETE), 'whole_word')).toBe('delete_model');
    expect(COMPOUNDS.every(c => c.parts.join('') === c.word)).toBe(true);
  });
});
