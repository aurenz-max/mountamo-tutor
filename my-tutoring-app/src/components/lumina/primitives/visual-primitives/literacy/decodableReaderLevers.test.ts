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
import { DECODABLE_MISSES, PRACTICE_STORIES, decodableReaderLevers, regionLeak, shortLine, shortLineLeak, shortStory, shortStoryLeak,
  simplerFor, storyRegion } from './decodableReaderLevers';
import { decodableSpokenMisses } from './decodableReaderWorkspace';

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

  it('the story region is two whole story sentences, one holding the answer', () => {
    for (const item of items.filter(i => i.kind !== 'read_line')) {
      const region = storyRegion(item, sentences);
      if (item.kind !== 'answer_spoken') { expect(region).toBeNull(); continue; }
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
      expect(entry.unanswered![mode]).toEqual(mode === 'read_along' ? [] : misses);
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

describe('read_along levers', () => {
  const data = payload('read_along');
  const sentences: DecodableSentenceLike[] = data.passage.sentences;
  const { items } = itemsFromChallenges(data);
  const spoken = items.filter(i => i.kind === 'answer_spoken');
  const sentence = (text: string, i: number): DecodableSentenceLike => ({ id: `s${i}`, words: text.split(' ').map((t, j) => ({ id: `w${i}${j}`, text: t, phonicsPattern: 'cvc' })) });

  it('every spoken question has the region (read aloud) and a practice story, answering both misses', () => {
    expect(spoken.length).toBeGreaterThan(0);
    for (const item of spoken) {
      const levers = decodableReaderLevers(item, [], sentences, items);
      expect(levers.map(l => [l.id, l.kind, l.carrier])).toEqual([['story_region', 'help', 'both'], ['short_story', 'simplify', 'both']]);
      for (const miss of decodableSpokenMisses(item).map(m => m.id)) expect(levers.some(l => l.answers?.includes(miss))).toBe(true);
      expect(nextLever(levers, 'lifted_word')).toBe('story_region');
      expect(nextLever(decodableReaderLevers(item, ['story_region'], sentences, items), 'retell')).toBe('short_story');
    }
  });

  it('the region fences the tutor: read whole, nothing stressed, never which word answers', () => {
    const region = decodableReaderLevers(spoken[0], [], sentences, items)[0];
    expect(region.does).toMatch(/Read those two sentences aloud once, whole/);
    expect(region.does).toMatch(/never say which word answers/);
    for (const item of spoken) expect(region.does).not.toContain(item.answerWord!);
  });

  it('the practice story is a read-along question on two new sentences, its answer in them, no session word', () => {
    for (const item of spoken) {
      const practice = shortStory(item, sentences, items)!;
      expect(practice).toMatchObject({ id: `${item.id}~simpler`, kind: 'answer_spoken' });
      expect(simplerFor(item, sentences, items)).toEqual(practice);
      expect(practice.storyText!.split(/(?<=\.)\s+/)).toHaveLength(2);
      expect(practice.evidenceLine).toBeTruthy();
      expect(practice.storyText).toContain(practice.evidenceLine);
      expect(practice.answerWord).not.toBe(item.answerWord);
      expect(shortStoryLeak(practice, sentences, items)).toBe(false);
      // Its own misses name its own story, never the lesson story.
      for (const m of decodableSpokenMisses(practice)) for (const w of m.examples ?? []) expect(practice.storyText!.toLowerCase()).toContain(w.toLowerCase());
    }
  });

  it('no practice story on a decode question, a story of two sentences, or when every pool story clashes', () => {
    const literal = itemsFromChallenges(payload('literal')).items.find(i => i.kind === 'answer_spoken');
    if (literal) expect(shortStory(literal, payload('literal').passage.sentences, [])).toBeNull();
    expect(shortStory(spoken[0], sentences.slice(0, 2), items)).toBeNull();
    const clash = PRACTICE_STORIES.map((p, i) => sentence(p.sentences[0], i));
    expect(shortStory(spoken[0], clash, items)).toBeNull();
    const allButLast = PRACTICE_STORIES.slice(0, -1).map((p, i) => sentence(p.sentences[0], i));
    expect(shortStory(spoken[0], allButLast, items)!.answerWord).toBe(PRACTICE_STORIES.at(-1)!.answer);
  });

  it("every pool story is reachable: a session that names every other story's answer gets exactly that one", () => {
    const item = { ...spoken[0], question: 'Who is it?', answerWord: 'zed', storyText: 'Zed is Zed.' };
    const base = ['Zed is Zed.', 'Zed is Zed.', 'Zed is Zed.'].map(sentence);
    PRACTICE_STORIES.forEach((p, i) => {
      const others = sentence(PRACTICE_STORIES.filter((_, j) => j !== i).map(o => o.answer).join(' '), 9);
      const practice = shortStory(item, [...base, others], [])!;
      expect(practice.answerWord).toBe(p.answer);
      expect(practice.question).toBe(p.question);
    });
  });
});
