/**
 * measure-lab fill_level: the generator draws every level and key in code (the model call is mocked: it supplies only
 * words); the key re-derives from the levels; the tells (side, ask word, empty or full) alternate; the levers draw.
 */
import { describe, expect, it, vi } from 'vitest';

const words: Record<string, string> = { title: 'Water Table', description: 'Look at the water.', unitName: 'cups', unitEmoji: '🥤' };
for (let i = 0; i < 8; i++) { words[`object${i}Name`] = `thing ${i}`; words[`object${i}Emoji`] = '🍎'; }
['jug', 'bowl', 'pot', 'mug', 'jar', 'bottle'].forEach((n, i) => { words[`container${i}Name`] = n; });
vi.mock('../../../service/geminiClient', () => ({ ai: { models: { generateContent: vi.fn(async () => ({ text: JSON.stringify(words) })) } } }));

import { generateMeasureLab } from '../../../service/math/gemini-measure-lab';
import type { GenerationContext } from '../../../service/generation/generationContext';
import type { MeasureLabChallenge } from './MeasureLab';
import { EMPTY_VIEW, fillLevelKey, measureCorrect, measureMiss, workspaceScene } from './measureLabWorkspace';
import { FAR_FILL_LEVER, FILL_WORDS_LEVER, LEVEL_LINES_LEVER, MEASURE_LEVERS, farFillLeaks, practiceItem } from './measureLabLevers';
import { validateMeasureLabData } from './measureLab.boss';

const ctx = (difficulty?: string) => ({ topic: 'Empty and full', gradeContext: 'Kindergarten', intent: 'empty, full, more, less',
  raw: { targetEvalMode: 'fill_level', ...(difficulty ? { difficulty } : {}) } }) as unknown as GenerationContext;
const levels = (c: MeasureLabChallenge) => (c.containers ?? []).map(j => j.filled ?? 0);

describe('fill_level generation', () => {
  it('every key re-derives from the levels drawn; the tier sets the gap; the tells alternate', async () => {
    for (const [tier, gap] of [['easy', 5], ['medium', 3], ['hard', 2]] as const) {
      for (let run = 0; run < 10; run++) {
        const d = await generateMeasureLab(ctx(tier));
        expect(d.challengeType).toBe('fill_level');
        expect(() => validateMeasureLabData(d)).not.toThrow();
        const ef = d.challenges.filter(c => c.fillAsk === 'empty_full');
        const ml = d.challenges.filter(c => c.fillAsk !== 'empty_full');
        expect(ef.length).toBeGreaterThanOrEqual(2);
        expect(ml.length).toBeGreaterThanOrEqual(2);
        for (const c of d.challenges) {
          expect(c.type).toBe('fill_level');
          expect(c.expectedChoice).toBe(fillLevelKey(c));
          expect(c.prompt).not.toMatch(/\d/);
        }
        expect(new Set(ef.map(c => c.expectedChoice))).toEqual(new Set(['empty', 'full']));
        for (const c of ml) {
          const [a, b] = c.containers!;
          expect(a.shape).toBe(b.shape);
          expect(a.capacity).toBe(b.capacity);
          expect(Math.abs((a.filled ?? 0) - (b.filled ?? 0))).toBe(gap);
          expect(a.name).not.toMatch(/\d/);
        }
        // Neither "always the left" nor "always the fuller one" wins.
        expect(new Set(ml.map(c => c.fillAsk))).toEqual(new Set(['more', 'less']));
        expect(new Set(ml.map(c => c.expectedChoice === c.containers![0].id)).size).toBe(2);
        const fuller = ml.map(c => { const [a, b] = c.containers!; return c.expectedChoice === ((a.filled ?? 0) > (b.filled ?? 0) ? a.id : b.id); });
        expect(new Set(fuller).size).toBe(2);
      }
    }
  });

  it('the check, the miss, the scene and the levers', async () => {
    const d = await generateMeasureLab(ctx('hard'));
    for (const c of d.challenges) {
      const wrong = c.fillAsk === 'empty_full' ? (c.expectedChoice === 'full' ? 'empty' : 'full')
        : c.containers!.find(j => j.id !== c.expectedChoice)!.id;
      expect(measureCorrect(c, { ...EMPTY_VIEW, prediction: c.expectedChoice! })).toBe(true);
      expect(measureMiss(c, { ...EMPTY_VIEW, prediction: wrong })).toBe(c.fillAsk === 'empty_full' ? 'mixed_empty_full' : 'picked_opposite');
      // No level, amount or answer is stated: the drawn water is the only evidence.
      const facts = JSON.stringify(workspaceScene(c, EMPTY_VIEW).facts);
      expect(facts).not.toMatch(/\d|fuller|emptier/);
      const ids = MEASURE_LEVERS.declare(c, null, []).map(l => l.id);
      expect(ids).toEqual(expect.arrayContaining([FILL_WORDS_LEVER, LEVEL_LINES_LEVER]));
      // The easier pair comes only on a more-or-less item, whose levels are close at the hard tier.
      expect(ids.includes(FAR_FILL_LEVER)).toBe(c.fillAsk !== 'empty_full');
      const p = practiceItem(c);
      if (c.fillAsk === 'empty_full') { expect(p).toBeNull(); continue; }
      expect(farFillLeaks(c, p!)).toBe(false);
      expect(p!.expectedChoice).toBe(fillLevelKey(p!));
      expect(Math.abs(levels(p!)[0] - levels(p!)[1])).toBeGreaterThanOrEqual(5);
    }
  });
});
