/**
 * read-aloud-studio's levers (`/add-support-tiers`, handoff 22 L3) on the saved payloads: help marks the print and is
 * never voiced on a cold read, the practice line prints no passage word (R3) and stays a read in the same mode (R2),
 * and the phrase plan gets nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { studioItems } from './readAloudPhrasing';
import type { ReadAloudMode } from './readAloudStudioScript';
import { READ_ALOUD_MISSES, readAloudLevers, shortLine, shortLineLeak } from './readAloudStudioLevers';

const items = (mode: ReadAloudMode) => studioItems(JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/read-aloud-studio.${mode}.json`), 'utf8')).data.lines, mode);
const expression = () => studioItems(JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads/read-aloud-studio.accuracy.json'), 'utf8')).data.lines, 'expression');

describe.each(['accuracy', 'dialogue'] as const)('%s', (mode) => {
  const all = items(mode);
  it('builds', () => expect(all.length).toBeGreaterThan(1));

  it('every line gets a three-word practice line in the same mode that prints no passage word', () => {
    for (const item of all) {
      const practice = shortLine(item, all)!;
      expect(practice.kind).toBe(mode);
      expect(practice.wordCount).toBe(3);
      expect(shortLineLeak(practice, all)).toBe(false);
      if (mode === 'dialogue') expect(practice.speaker).toBe(item.speaker);
    }
  });

  it('levers: underline, dots, short line; all shown; misses from the catalog', () => {
    const entry = LITERACY_CATALOG.find(c => c.id === 'read-aloud-studio')!.teachingWorkspace!;
    const levers = readAloudLevers(all[0], [], all);
    expect(levers.map(l => l.id)).toEqual(['tracking_underline', 'sound_dots', 'short_line']);
    for (const l of levers) {
      expect(l.carrier).toBe('shown');
      for (const miss of l.answers ?? []) expect(entry.misses![mode]).toContain(miss);
    }
    expect(nextLever(levers, 'word_drop')).toBe('tracking_underline');
    if (mode === 'dialogue') expect(nextLever(levers, 'paraphrase')).toBe('short_line');
    else expect(levers[0].does).toMatch(/do not read the line/);
  });
});

it('expression: help on the reads, nothing on the plan, no practice line', () => {
  const steps = expression();
  const [mark, first, reread] = steps;
  expect(readAloudLevers(mark, [], steps)).toEqual([]);
  expect(readAloudLevers(first, [], steps).map(l => l.id)).toEqual(['tracking_underline', 'sound_dots']);
  expect(readAloudLevers(reread, [], steps).map(l => l.id)).toEqual(['tracking_underline', 'sound_dots']);
});

it('the catalog lists every spoken miss unanswered', () => {
  const entry = LITERACY_CATALOG.find(c => c.id === 'read-aloud-studio')!.teachingWorkspace!;
  for (const [mode, misses] of Object.entries(READ_ALOUD_MISSES)) {
    expect(entry.misses![mode]).toEqual(misses);
    expect(entry.unanswered![mode]).toEqual(misses);
  }
  expect(entry.levers).toBe(true);
});
