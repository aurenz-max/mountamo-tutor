/**
 * LIVE probe for letter-spotter generation — skipped unless LIVE_GEMINI=1.
 *
 * Guards the failure this file was written for: flash-lite looped inside an
 * unbounded `options` string, emitted ~130KB, truncated at the token ceiling, and
 * the bare JSON.parse threw `Unterminated string in JSON` — which, under
 * Promise.all in buildCompleteExhibitFromManifest, failed the WHOLE exhibit.
 *
 * Run:  GEMINI_API_KEY=... LIVE_GEMINI=1 npx vitest run gemini-letter-spotter.live
 */
import { describe, it, expect } from 'vitest';
import { generateLetterSpotter } from './gemini-letter-spotter';
import type { GenerationContext } from '../generation/generationContext';

const LIVE = process.env.LIVE_GEMINI === '1';

const GROUPS: Record<number, string[]> = {
  1: ['s','a','t','i','p','n'],
  4: ['s','a','t','i','p','n','c','k','e','h','r','m','d','g','o','u','l','f','b','j','z','w','v','y','x','q'],
};

// NOTE: letter-spotter has no `evalModes` block in the catalog, so
// resolveEvalModeConstraint always returns null and the mode can never be
// pinned — every lesson is blended. The reachable axes are letterGroup (which
// sizes the schema's letter enums) and difficulty. Probe those.
function ctx(letterGroup: number, difficulty: string): GenerationContext {
  return {
    componentId: 'letter-spotter',
    instanceId: 'probe-1',
    topic: 'Animals on the farm',
    intent: 'recognize letters in animal words',
    gradeLevel: 'kindergarten',
    gradeContext: 'Kindergarten (age 5-6)',
    grade: 'K',
    objective: {},
    scope: {},
    raw: { letterGroup, difficulty },
  } as unknown as GenerationContext;
}

describe.skipIf(!LIVE)('letter-spotter live generation', () => {
  for (const [letterGroup, difficulty] of [[1, 'easy'], [1, 'hard'], [4, 'hard'], [4, 'medium']] as const) {
    it(`produces a well-formed lesson for group ${letterGroup} @ ${difficulty}`, async () => {
      const pool = GROUPS[letterGroup];
      const data = await generateLetterSpotter(ctx(letterGroup, difficulty));

      expect(data.challenges.length).toBeGreaterThanOrEqual(3);
      expect(data.challenges.length).toBeLessThanOrEqual(8);

      for (const ch of data.challenges) {
        // The runaway lived here: a "single letter" that was 130k chars long.
        expect(ch.targetLetter).toHaveLength(1);
        expect(pool).toContain(ch.targetLetter);

        if (ch.mode === 'find-it') {
          expect(ch.letterGrid).toHaveLength(16);
          for (const cell of ch.letterGrid!) {
            expect(cell).toHaveLength(1);
            expect(pool).toContain(cell.toLowerCase());
          }
          expect(ch.letterGrid!.filter(c => c.toLowerCase() === ch.targetLetter).length)
            .toBeGreaterThanOrEqual(1);
        } else {
          expect(ch.options!.length).toBeGreaterThanOrEqual(3);
          expect(ch.options!.length).toBeLessThanOrEqual(4);
          for (const o of ch.options!) {
            expect(o).toHaveLength(1);
            expect(pool).toContain(o);
          }
          // Answer-bearing guard: the component grades against targetLetter.
          expect(ch.options).toContain(ch.targetLetter);
        }

        if (ch.mode === 'name-it') {
          expect(ch.emoji).toBeTruthy();
          expect(ch.sentence!.split(ch.emoji!).length - 1).toBe(1);
          expect(ch.targetWord![0].toLowerCase()).toBe(ch.targetLetter);
          // Pedagogy: the hidden word must not also appear spelled out.
          expect(ch.sentence!.toLowerCase()).not.toContain(ch.targetWord!.toLowerCase());
        }
      }
    }, 90_000);
  }
});
