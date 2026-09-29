/**
 * decodable-reader's levers (`/add-support-tiers`, handoff 22 L3) on the saved payloads: the practice line prints no
 * story word (R3) and stays a read line (R2), the story region is two whole story sentences with nothing marked, and
 * every lever is shown, never voiced.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { PRACTICE_LINES } from './decodablePracticeLines';
import { itemsFromChallenges, sentenceText, type DecodableSentenceLike } from './decodableReaderScript';
import { DECODABLE_MISSES, decodableReaderLevers, regionLeak, shortLine, shortLineLeak, storyRegion } from './decodableReaderLevers';

const payload = (mode: string) => JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/decodable-reader.${mode}.json`), 'utf8')).data;

describe.each(['literal', 'read_along'])('%s payload', (mode) => {
  const data = payload(mode);
  const sentences: DecodableSentenceLike[] = data.passage.sentences;
  const { items } = itemsFromChallenges(data);

  it('every read line longer than three words gets a three-word practice line with no story word', () => {
    for (const item of items.filter(i => i.kind === 'read_line')) {
      const practice = shortLine(item, sentences);
      if (item.wordCount <= 3) { expect(practice).toBeNull(); continue; }
      expect(practice!.kind).toBe('read_line');
      expect(practice!.wordCount).toBe(3);
      expect(practice!.words!.map(w => w.text).join(' ')).toBe(practice!.text);
      expect(shortLineLeak(practice!, sentences)).toBe(false);
    }
  });

  it('the story region is two whole story sentences, one holding the answer; read-along has none', () => {
    for (const item of items.filter(i => i.kind !== 'read_line')) {
      const region = storyRegion(item, sentences);
      if (mode === 'read_along' || item.kind !== 'answer_spoken') { expect(region).toBeNull(); continue; }
      if (!region) continue;
      expect(regionLeak(region, sentences)).toBe(false);
      expect(region).toContain(item.evidenceLine);
    }
  });
});

describe('levers', () => {
  const data = payload('literal');
  const sentences: DecodableSentenceLike[] = data.passage.sentences;
  const { items } = itemsFromChallenges(data);
  const entry = LITERACY_CATALOG.find(c => c.id === 'decodable-reader')!.teachingWorkspace!;

  it('a read line: underline, dots, short line; a spoken answer: the region; a choice question: none', () => {
    const line = items.find(i => i.kind === 'read_line' && i.wordCount > 3)!;
    expect(decodableReaderLevers(line, [], sentences).map(l => l.id)).toEqual(['tracking_underline', 'sound_dots', 'short_line']);
    expect(nextLever(decodableReaderLevers(line, [], sentences), 'word_skip')).toBe('tracking_underline');
    expect(nextLever(decodableReaderLevers(line, ['tracking_underline'], sentences), 'word_swap')).toBe('sound_dots');
    const answer = items.find(i => i.kind === 'answer_spoken' && storyRegion(i, sentences));
    if (answer) expect(decodableReaderLevers(answer, [], sentences).map(l => l.id)).toEqual(['story_region']);
    const choice = { ...items[0], kind: 'answer_choice' as const, options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] };
    expect(decodableReaderLevers(choice, [], sentences)).toEqual([]);
  });

  it('every lever is shown and answers only catalog misses; every spoken miss is listed unanswered', () => {
    for (const item of items) for (const l of decodableReaderLevers(item, [], sentences)) {
      expect(l.carrier).toBe('shown');
      for (const miss of l.answers ?? []) expect(entry.misses!.literal).toContain(miss);
    }
    for (const [mode, misses] of Object.entries(DECODABLE_MISSES)) {
      expect(entry.misses![mode]).toEqual(misses);
      expect(entry.unanswered![mode]).toEqual(misses);
    }
    expect(entry.levers).toBe(true);
  });

  it('a story that prints every pool line but one still gets that one', () => {
    const story: DecodableSentenceLike[] = PRACTICE_LINES.slice(1).map((l, i) => ({ id: `s${i}`,
      words: l.text.split(' ').map((text, j) => ({ id: `w${i}${j}`, text, phonicsPattern: 'cvc' })) }));
    const line = { ...items.find(i => i.kind === 'read_line' && i.wordCount > 3)! };
    expect(shortLine(line, story)!.text).toBe(PRACTICE_LINES[0].text);
    expect(sentenceText(story[0])).toBe(PRACTICE_LINES[1].text);
  });
});
