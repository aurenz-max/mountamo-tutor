/**
 * phoneme-explorer's levers (`/add-support-tiers`, handoff 22 L2): models and practice items never use a session
 * word or a sound the session asks, practice keeps the mode, and every lever's misses are the catalog's.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { itemFromChallenge, itemsFromChallenges, type PhonemeChallengeLike, type PhonemeExplorerItem } from './phonemeExplorerScript';
import {
  CVC_POOL, PHONEME_MISSES, askedSound, changedBox, phonemeExplorerLevers, phonemeSessionWords, positionModelFor,
  practiceItemFor, practiceLeak,
} from './phonemeExplorerLevers';

const PAYLOADS = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const payload = (mode: string): PhonemeExplorerItem[] =>
  itemsFromChallenges(JSON.parse(readFileSync(join(PAYLOADS, `phoneme-explorer.${mode}.json`), 'utf8')).data.challenges);
const menu = (right: string, ...wrong: string[]) => [{ word: right, emoji: '⭐', correct: true }, ...wrong.map(w => ({ word: w, emoji: '⭐', correct: false }))];
const build = (ch: PhonemeChallengeLike) => itemFromChallenge(ch)!;
const BY_MODE: Record<string, PhonemeExplorerItem> = {
  isolate: build({ id: 'i', mode: 'isolate', phoneme: 'm', phonemeSound: 'mmm', exampleWord: 'mouse', choices: menu('moon', 'dog', 'fish', 'cake') }),
  ending: build({ id: 'e', mode: 'ending', targetWord: 'cap', targetEmoji: '🧢', finalPhoneme: 'p', choices: menu('mop', 'cat', 'sun', 'dog') }),
  medial: build({ id: 'm', mode: 'medial', targetWord: 'cat', targetEmoji: '🐱', vowel: 'a', choices: menu('hat', 'hot', 'hit', 'hut') }),
  blend: build({ id: 'b', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' }),
  segment: build({ id: 's', mode: 'segment', targetWord: 'sheep', targetEmoji: '🐑', segments: ['sh', 'ee', 'p'] }),
  manipulate: build({ id: 'x', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱', operationDescription: "Change the /k/ in 'cat' to /b/",
    resultWord: 'bat', resultEmoji: '🦇' }),
};
const every = Object.values(BY_MODE);

describe('the pool', () => {
  it('holds only one-letter-per-sound CVC picture words, none spelled with c or x', () => {
    expect(CVC_POOL.length).toBeGreaterThan(30);
    for (const w of CVC_POOL) { expect(w.word).toMatch(/^[^cx][aeiou][^cx]$/); expect(w.emoji).toBeTruthy(); }
  });
});

describe.each([...Object.keys(BY_MODE).map(m => [m, [BY_MODE[m], ...every]] as const),
  ['saved isolate', payload('isolate')] as const, ['saved blend', payload('blend')] as const])('%s', (_label, items) => {
  it('every practice item keeps the mode and uses no session word or asked sound', () => {
    for (const item of items) {
      const practice = practiceItemFor(item, items);
      expect(practice, item.id).toBeTruthy();
      expect(practiceLeak(practice!, item, items)).toBe(false);
      expect(practice!.id).toBe(`${item.id}~simpler`);
      if (practice!.menu) expect(practice!.menu).toHaveLength(2);
    }
  });

  it('a position model is never a session word, and its lit sound is never one the session asks', () => {
    const asked = new Set(items.map(askedSound).filter(Boolean));
    const used = phonemeSessionWords(items);
    for (const item of items.filter(i => ['isolate', 'ending', 'medial'].includes(i.kind))) {
      const model = positionModelFor(item, items)!;
      expect(used.has(model.word)).toBe(false);
      const at = { isolate: 0, medial: 1, ending: 2 }[item.kind as 'isolate'];
      expect(asked.has(askedSound({ kind: 'isolate', phoneme: model.sounds[at] } as PhonemeExplorerItem))).toBe(false);
    }
  });
});

describe('practice items', () => {
  it('isolate practises a held sound; its foil differs in every position', () => {
    const p = practiceItemFor(BY_MODE.isolate, every)!;
    expect(['m', 's', 'f', 'n', 'l', 'r']).toContain(p.phoneme);
    const [a, f] = [p.menu!.find(c => c.word === p.answer)!.word, p.menu!.find(c => c.word !== p.answer)!.word];
    expect(a.split('').every((ch, i) => ch !== f[i])).toBe(true);
  });

  it('segment practises a two-sound word; manipulate changes a first sound', () => {
    expect(practiceItemFor(BY_MODE.segment, every)).toMatchObject({ soundCount: 2, answer: 'two' });
    const m = practiceItemFor(BY_MODE.manipulate, every)!;
    expect(m.originalWord!.slice(1)).toBe(m.answer.slice(1));
    expect(m.operationSpoken).not.toMatch(new RegExp(`\\b${m.answer}\\b`));
  });
});

describe('levers', () => {
  const entry = LITERACY_CATALOG.find(c => c.id === 'phoneme-explorer')!.teachingWorkspace!;

  it('each mode\'s levers; tier aids only where the tier withdrew them; carriers count at K', () => {
    const ids = (item: PhonemeExplorerItem, w = {}) => phonemeExplorerLevers(item, [], every, w).map(l => l.id);
    expect(ids(BY_MODE.isolate)).toEqual(['position_model', 'two_cards_far']);
    expect(ids(BY_MODE.isolate, { example: true })).toEqual(['position_model', 'example_word', 'two_cards_far']);
    expect(ids({ ...BY_MODE.medial, enumerateMenu: false })).toEqual(['position_model', 'name_cards', 'two_cards_far']);
    expect(ids(BY_MODE.blend)).toEqual(['slide_tiles', 'short_blend']);
    expect(ids(BY_MODE.segment)).toEqual(['push_tokens', 'two_sound_word']);
    expect(ids(BY_MODE.manipulate, { operation: true })).toEqual(['mark_position', 'operation_detail', 'first_sound_change']);
    for (const item of every) for (const l of phonemeExplorerLevers(item, [], every, { example: true, operation: true })) {
      expect(['shown', 'both']).toContain(l.carrier);
      for (const miss of l.answers ?? []) expect(entry.misses![item.kind]).toContain(miss);
    }
  });

  it('mark_position only where one sound changes for one sound', () => {
    expect(changedBox(BY_MODE.manipulate)).toBe(0);
    expect(changedBox(build({ id: 'y', mode: 'manipulate', originalWord: 'at', operationDescription: 'Add /m/ to the start.', resultWord: 'mat' }))).toBeNull();
  });

  it('the catalog declares every mode\'s misses, all unanswered until spoken misses land; the ladder goes help first', () => {
    for (const mode of Object.keys(PHONEME_MISSES) as Array<keyof typeof PHONEME_MISSES>) {
      expect(entry.misses![mode]).toEqual(PHONEME_MISSES[mode]);
      expect(entry.unanswered![mode]).toEqual(PHONEME_MISSES[mode]);
    }
    expect(entry.levers).toBe(true);
    expect(nextLever(phonemeExplorerLevers(BY_MODE.segment, [], every), undefined)).toBe('push_tokens');
    expect(nextLever(phonemeExplorerLevers(BY_MODE.segment, ['push_tokens'], every), 'word_for_count')).toBe('two_sound_word');
  });
});
