/**
 * SST-L1: a card must not give its bin away. Saved draw: Science K design review 2026-10-17
 * (qa/curriculum-design-review/science-k-2026-10-17/evidence/SCI002-02-B-sorting-station-sort_attribute.json).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));

import { ai } from '../geminiClient';
import { binLeak, generateSortingStation } from './gemini-sorting-station';

const generateContent = vi.mocked(ai.models.generateContent);
const BINS = [
  { label: 'Food', bucketEmoji: '🍎' }, { label: 'Water', bucketEmoji: '🌊' }, { label: 'Shelter', bucketEmoji: '🏠' },
];

describe('binLeak', () => {
  it('catches the saved leaks: a bin word in the label, a bin picture on the card', () => {
    expect(binLeak({ label: 'Fresh Water Drop', emoji: '💧' }, BINS, 'category')).toMatch(/water/);
    expect(binLeak({ label: 'Water Bottle', emoji: '🍼' }, BINS, 'category')).toMatch(/water/);
    expect(binLeak({ label: 'Sweet Apple', emoji: '🍎' }, BINS, 'category')).toMatch(/Food bin's picture/);
  });

  it('catches another instance: a plural bin word, a picture with a variation selector', () => {
    const bins = [{ label: 'Plants', bucketEmoji: '🌱' }, { label: 'Animals', bucketEmoji: '🐾' }];
    expect(binLeak({ label: 'Animal Tracks', emoji: '👣' }, bins, 'category')).toMatch(/animal/);
    expect(binLeak({ label: 'Rose', emoji: '🐾️' }, bins, 'type')).toMatch(/picture/);
    // Retest draw 2026-10-17: "Clear Waterfall" into Water.
    expect(binLeak({ label: 'Clear Waterfall', emoji: '⛲' }, BINS, 'category')).toMatch(/water/);
    expect(binLeak({ label: 'Seafood', emoji: '🦐' }, BINS, 'category')).toMatch(/food/);
    expect(binLeak({ label: 'Hotdog', emoji: '🌭' }, [{ label: 'Hot' }, { label: 'Cold' }], 'category')).toBeNull();
  });

  it('keeps valid cards: other words, and color/size labels that describe the picture', () => {
    expect(binLeak({ label: 'Puddle', emoji: '💦' }, BINS, 'category')).toBeNull();
    expect(binLeak({ label: 'Juicy Berry', emoji: '🫐' }, BINS, 'category')).toBeNull();
    expect(binLeak({ label: 'Red Apple', emoji: '🍎' }, [{ label: 'Red' }, { label: 'Yellow' }], 'color')).toBeNull();
  });
});

const ctx = (targetEvalMode: string): GenerationContext => ({
  componentId: 'sorting-station', instanceId: 't', topic: 'Animals need food, water and shelter',
  gradeLevel: 'kindergarten', gradeContext: 'Kindergarten students', grade: 'K',
  intent: 'Sort things animals need into food, water and shelter', objective: {},
  scope: {} as GenerationContext['scope'], targetEvalMode, raw: { targetEvalMode },
});
const card = (label: string, emoji: string, category: string, type: string) => ({ label, emoji, category, type });
const EMOJIS = [{ value: 'food', emoji: '🍎' }, { value: 'water', emoji: '🌊' }, { value: 'shelter', emoji: '🏠' }];

describe('sort_attribute session (saved draw)', () => {
  beforeEach(() => { generateContent.mockReset(); });

  it('drops the leaking cards and keeps every bin filled', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({
      title: 'Needs Sorter', description: 'Sort.', challenges: [
        { instruction: 'Sort into food, water and shelter.', sortingAttribute: 'category', categoryEmojis: EMOJIS, objects: [
          card('Juicy Berry', '🫐', 'food', 'plant'), card('Fresh Water Drop', '💧', 'water', 'liquid'),
          card('Bird Nest', '🪹', 'shelter', 'home'), card('Yummy Seed', '🌻', 'food', 'plant'),
          card('Puddle', '💦', 'water', 'liquid'), card('Cozy Den', '🪵', 'shelter', 'home')] },
        { instruction: 'Where do these belong?', sortingAttribute: 'category', categoryEmojis: EMOJIS, objects: [
          card('Sweet Apple', '🍎', 'food', 'fruit'), card('River Stream', '🏞️', 'water', 'liquid'),
          card('Tree Hollow', '🌳', 'shelter', 'home'), card('Leafy Plant', '🥬', 'food', 'plant'),
          card('Water Bottle', '🍼', 'water', 'liquid'), card('Dog House', '🛖', 'shelter', 'home')] },
      ] }) } as never);

    const result = await generateSortingStation(ctx('sort_attribute'));
    const sorts = result.challenges.filter((c) => c.type === 'sort-by-attribute');
    expect(sorts.length).toBeGreaterThan(0);
    for (const ch of sorts) {
      for (const o of ch.objects) expect(binLeak(o, ch.categories ?? [], ch.sortingAttribute ?? '')).toBeNull();
      for (const k of ch.categories ?? []) {
        expect(ch.objects.some((o) => Object.entries(k.rule).every(([a, v]) => o.attributes[a] === v))).toBe(true);
      }
      expect(ch.objects.length).toBeGreaterThanOrEqual(4);
    }
    const labels = sorts.flatMap((c) => c.objects.map((o) => o.label));
    expect(labels).not.toContain('Fresh Water Drop');
    expect(labels).not.toContain('Sweet Apple');
    expect(labels).toContain('Puddle');
  });
});
