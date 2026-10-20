/**
 * Reader-fit: rocket-builder, re-based on the 2026-10-16 rebuild.
 *
 * Item 15A / S3 (2026-08-07) ruled that K is served here, not floored away, and found the grade rung read from prose
 * (every degraded lesson landed on Grade 3). Those rulings still hold, re-stated against the rebuilt builder:
 *   1. The grade rung comes from the canonical grade, never from prose; the resolved rung is stamped on the data.
 *   2. K and Grade 1 get can_it_lift only: counting blocks and arrows on one rocket and a yes-or-no tap.
 *   3. Gemini writes the title and overview only; every rocket and key is code-built (the triage leak: Gemini's parts and
 *      target altitude were never checked for reachability).
 *   4. The catalog keeps a tutoring block for the scripted path, with the pre-reader read-aloud and a never-name-the-
 *      answer directive.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));
vi.mock('../evalMode', async (orig) => ({ ...(await orig() as object), resolveEvalModes: vi.fn(async () => null) }));

import { rocketBuilderGradeFromGrade, rocketRungIndex, generateRocketBuilder } from './gemini-rocket-builder';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';
import { defaultModes, validRocketItem } from '../../primitives/visual-primitives/astronomy/rocketWorkspace';
import type { GenerationContext } from '../generation/generationContext';

const ctx = (over: Partial<GenerationContext>): GenerationContext =>
  ({ topic: 'What a rocket needs to lift off', gradeContext: 'kindergarten students (ages 5-6)', raw: {}, ...over } as GenerationContext);

beforeEach(() => {
  generateContentMock.mockReset();
  generateContentMock.mockResolvedValue({ text: JSON.stringify({ title: 'Ready for Lift-Off?', overview: 'Predict what each rocket will do.' }) });
});

describe('rocket-builder — reader-fit after the rebuild', () => {
  describe('rocketBuilderGradeFromGrade — canonical grade, NO floor', () => {
    it('resolves Kindergarten to its own rung', () => {
      for (const g of ['K', 'k', 'kindergarten', 'preschool']) expect(rocketBuilderGradeFromGrade(g)).toBe('K');
    });
    it('passes every served grade through, and tops out at 5', () => {
      for (const g of ['1', '2', '3', '4', '5']) expect(rocketBuilderGradeFromGrade(g)).toBe(g);
      expect(rocketBuilderGradeFromGrade('6')).toBe('5');
    });
    it('returns null with no canonical grade so the prose fallback stands', () => {
      for (const g of [undefined, '', 'nonsense']) expect(rocketBuilderGradeFromGrade(g)).toBeNull();
    });
    it('places K below every numbered grade', () => {
      expect(rocketRungIndex('K')).toBe(0);
      expect(rocketRungIndex('1')).toBe(1);
    });
  });

  describe('the generator', () => {
    it('stamps the canonical rung, not the prose one, and builds K items code can key', async () => {
      const d = await generateRocketBuilder(ctx({ grade: 'K' }));
      expect(d.gradeLevel).toBe('K');
      expect(d.challengeTypes).toEqual(['can_it_lift']);
      expect(d.items!.length).toBe(4);
      for (const i of d.items!) expect(validRocketItem(i)).toBe(true);
      expect(d.title).toBe('Ready for Lift-Off?');
    });
    it('asks Gemini for the frame only: the schema has no parts, altitude or budget', async () => {
      await generateRocketBuilder(ctx({ grade: '4' }));
      const schema = generateContentMock.mock.calls[0][0].config.responseSchema;
      expect(Object.keys(schema.properties).sort()).toEqual(['overview', 'title']);
    });
    it('a failed framing call still yields a working lesson', async () => {
      generateContentMock.mockRejectedValueOnce(new Error('down'));
      const d = await generateRocketBuilder(ctx({ grade: '3' }));
      expect(d.title).toBeTruthy();
      expect(d.challengeTypes).toEqual(['can_it_lift', 'add_to_lift', 'on_budget']);
      expect(d.items!.every(validRocketItem)).toBe(true);
    });
  });

  describe('modes by grade', () => {
    it('K and Grade 1 ask can_it_lift only; the ladder opens from Grade 2', () => {
      expect(defaultModes('K')).toEqual(['can_it_lift']);
      expect(defaultModes('1')).toEqual(['can_it_lift']);
      expect(defaultModes('2')).toEqual(['can_it_lift', 'add_to_lift']);
      expect(defaultModes('3')).toEqual(['can_it_lift', 'add_to_lift', 'on_budget']);
      expect(defaultModes('5')).toEqual(['can_it_lift', 'add_to_lift', 'on_budget', 'reach_target']);
    });
  });

  // The catalog tutoring block went with the scripted path (boss migration 10-19): a bound session sends tutoring: null.
  describe('catalog entry', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'rocket-builder')!;

    it('does not carry a band floor; K-1 are told the task is a count and a tap', () => {
      expect(entry.constraints).not.toMatch(/BAND FLOOR|Grade 2\+ ONLY/i);
      expect(entry.constraints).toMatch(/K and Grade 1 MAY be routed here/);
      expect(entry.teachingWorkspace!.grades).toContain('Kindergarten');
    });
  });
});
