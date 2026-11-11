/**
 * K math audit CV1, MEAS001-02-C: "count up to 10 objects per category". The K band window (4-6 objects) is the
 * default, not a cap: the objective's own per-group count is read through the shared resolveObjectiveRange, and a
 * lesson that names no number keeps the band window (and makes no range call).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));

import { ai } from '../geminiClient';
import { generateSortingStation, groupWindowFault, objectWindowFor } from './gemini-sorting-station';

const generateContent = vi.mocked(ai.models.generateContent);

const ctx = (intent: string, targetEvalMode = 'tally_record'): GenerationContext => ({
  componentId: 'sorting-station', instanceId: 't', topic: 'Sorting and counting',
  gradeLevel: 'kindergarten', gradeContext: 'Kindergarten students', grade: 'K', intent, objective: {},
  scope: {} as GenerationContext['scope'], targetEvalMode, raw: { targetEvalMode, difficulty: 'medium', challengeCount: 2 },
});

const NOUNS = ['Apple', 'Cherry', 'Rose', 'Ladybug', 'Strawberry', 'Tomato', 'Heart', 'Crab', 'Pepper', 'Cardinal',
  'Banana', 'Lemon', 'Corn', 'Chick', 'Sun', 'Star'];
const PICTURES = ['🍎', '🍒', '🌹', '🐞', '🍓', '🍅', '❤️', '🦀', '🌶️', '🐦', '🍌', '🍋', '🌽', '🐤', '☀️', '⭐'];
/** A draw with `red` red cards and `yellow` yellow cards per challenge. */
const draw = (red: number, yellow: number) => ({ text: JSON.stringify({ title: 'Count', description: 'Sort and count.',
  challenges: [0, 1, 2, 3].map(c => ({ instruction: 'Sort and count.', sortingAttribute: 'color',
    categoryEmojis: [{ value: 'red', emoji: '🔴' }, { value: 'yellow', emoji: '🟡' }],
    objects: [...Array(red).fill(0).map((_, i) => ({ label: NOUNS[(i + c) % 10], emoji: PICTURES[(i + c) % 10], color: 'red' })),
      ...Array(yellow).fill(0).map((_, i) => ({ label: NOUNS[10 + (i % 6)], emoji: PICTURES[10 + (i % 6)], color: 'yellow' }))] })) }) }) as never;

const prompts: string[] = [];
function reply(range: { min: number; max: number } | null, ...draws: unknown[]) {
  let d = 0;
  generateContent.mockImplementation((async (req: { contents: string }) => {
    prompts.push(req.contents);
    if (req.contents.includes('report the groups it names')) return { text: JSON.stringify({ namesAnExplicitSet: false, categories: [] }) };
    if (req.contents.includes('Infer the range')) return { text: JSON.stringify(range ? { hasExplicitScope: true, ...range } : { hasExplicitScope: false, min: 0, max: 0 }) };
    return draws[Math.min(d++, draws.length - 1)];
  }) as never);
}

const largestGroup = (ch: { objects: { attributes: Record<string, string> }[] }) => {
  const n = new Map<string, number>();
  for (const o of ch.objects) n.set(o.attributes.color, (n.get(o.attributes.color) ?? 0) + 1);
  return Math.max(...Array.from(n.values()));
};

describe('the objective sets the per-group count', () => {
  beforeEach(() => { generateContent.mockReset(); prompts.length = 0; });

  it('a named count lifts the window, holds every group under it, and reaches it', () => {
    expect(objectWindowFor('K', null)).toEqual({ min: 4, max: 6 });
    expect(objectWindowFor('K', { min: 1, max: 10 })).toEqual({ min: 10, max: 16, groupMax: 10 });
    expect(objectWindowFor('K', { min: 1, max: 40 }).groupMax).toBe(10);
    const w = objectWindowFor('K', { min: 1, max: 10 });
    const ch = (red: number) => ({ sortingAttribute: 'color', objects: Array(red).fill({ attributes: { color: 'red' } })
      .concat([{ attributes: { color: 'yellow' } }]) });
    expect(groupWindowFault(ch(9), w)).toBeNull();
    expect(groupWindowFault(ch(5), w)).toMatch(/counts to 10/);
    expect(groupWindowFault(ch(11), w)).toMatch(/over/);
  });

  it('MEAS001-02-C: a K tally session counts groups of 8 to 10, and a draw that stops at 6 is redrawn', async () => {
    reply({ min: 1, max: 10 }, draw(4, 2), draw(9, 4));
    const result = await generateSortingStation(ctx('Sort objects into given categories (up to 3 categories) and count up to 10 objects per category'));
    expect(prompts.some(p => p.includes('Infer the range'))).toBe(true);
    expect(prompts.find(p => p.includes('TASK TYPE: tally-record'))).toMatch(/one group holds 8 to 10/);
    expect(result.challenges.length).toBe(2);
    for (const ch of result.challenges) {
      expect(largestGroup(ch)).toBeGreaterThanOrEqual(8);
      expect(largestGroup(ch)).toBeLessThanOrEqual(10);
    }
  });

  it('a big/small sort the model filed under category is filed under size, so the cards are drawn to size', async () => {
    const sizes = { text: JSON.stringify({ title: 'Big and Small', description: 'Sort.', challenges: [0, 1].map(() => ({
      instruction: 'Big or small?', sortingAttribute: 'category', objects: [
        { label: 'Elephant', emoji: '🐘', category: 'big' }, { label: 'Ant', emoji: '🐜', category: 'small' },
        { label: 'Whale', emoji: '🐳', category: 'big' }, { label: 'Mouse', emoji: '🐭', category: 'small' },
        { label: 'Horse', emoji: '🐴', category: 'big' }] })) }) } as never;
    reply(null, sizes);
    const result = await generateSortingStation(ctx('Sort objects by size into big and small', 'sort_one'));
    for (const ch of result.challenges) {
      expect(ch.sortingAttribute).toBe('size');
      expect(ch.objects.every(o => o.attributes.size && !o.attributes.category)).toBe(true);
      expect(ch.categories!.map(c => c.label).sort()).toEqual(['Big', 'Small']);
    }
  });

  it('say_rule: a group of one card has nothing to explain, so the draw is redrawn', async () => {
    const say = (yellow: number) => ({ text: JSON.stringify({ title: 'Say the rule', description: 'Why?', challenges: [0, 1].map(() => ({
      instruction: 'Why do these go together?', sortingAttribute: 'color', objects: [
        ...['Apple', 'Cherry', 'Rose'].map((label, i) => ({ label, emoji: PICTURES[[0, 1, 2][i]], color: 'red', type: i ? 'plant' : 'fruit' })),
        ...['Banana', 'Lemon', 'Corn'].slice(0, yellow).map((label, i) => ({ label, emoji: PICTURES[10 + i], color: 'yellow', type: i ? 'plant' : 'fruit' }))] })) }) }) as never;
    reply(null, say(1), say(3));
    const result = await generateSortingStation(ctx('Verbally describe the sorting rule used for a single-attribute group', 'say_rule'));
    expect(result.challenges.length).toBeGreaterThan(0);
    for (const ch of result.challenges) {
      const yellow = ch.objects.filter(o => o.attributes.color === 'yellow').length;
      expect(yellow).toBeGreaterThanOrEqual(2);
    }
    // medium tier: the second challenge carries one card in the wrong group.
    expect(result.challenges[1]?.intruder).toBeTruthy();
  });

  it('a lesson that names no number keeps the band window and makes no range call', async () => {
    reply(null, draw(3, 2));
    const result = await generateSortingStation(ctx('Sort objects by color and count each group'));
    expect(prompts.some(p => p.includes('Infer the range'))).toBe(false);
    expect(prompts.find(p => p.includes('TASK TYPE: tally-record'))).toMatch(/Kindergarten: 4-6 objects/);
    expect(result.challenges.every(ch => ch.objects.length <= 6)).toBe(true);
  });
});
