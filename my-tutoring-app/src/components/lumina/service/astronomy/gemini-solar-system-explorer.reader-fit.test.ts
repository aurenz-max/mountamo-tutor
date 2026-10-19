/**
 * Reader-fit: solar-system-explorer SCAFFOLD-GAP + degrade-path grade blindness
 * — 2026-08-06. Item 15B / S11.
 *
 * Unlike S8/S10 this generator's HAPPY path was already correct at K (a probe
 * at `grade=K` returned `gradeLevel:'K'`, `initialZoom:'inner'`, 5 bodies) —
 * because the prompt carries the audience in prose, which is the one place
 * prose belongs. The defect was on the DEGRADE path:
 *
 *   data.bodies = getDefaultBodies(gradeLevel)   // gradeLevel = ctx.gradeContext
 *   ...
 *   if (gradeLevel === 'K' || gradeLevel === '1' || gradeLevel === '2') { ... }
 *
 * Prose never equals 'K', so the K-2 branch was UNREACHABLE and a Kindergartener
 * fell back to all eight planets instead of the inner four — precisely when
 * Gemini had already failed and the lesson was least able to absorb it. This is
 * the `matter-explorer` shape: an INLINE resolver a named-resolver grep misses.
 */
import { describe, it, expect } from 'vitest';
import { solarSystemGradeFromGrade } from './gemini-solar-system-explorer';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

describe('solar-system-explorer — reader-fit scaffold + fallback grade rung', () => {
  describe('solarSystemGradeFromGrade', () => {
    it('resolves Kindergarten to its own rung', () => {
      expect(solarSystemGradeFromGrade('K')).toBe('K');
      expect(solarSystemGradeFromGrade('kindergarten')).toBe('K');
      expect(solarSystemGradeFromGrade('preschool')).toBe('K');
    });

    it('maps the K-2 band that the fallback branch actually tests for', () => {
      // getDefaultBodies returns inner planets only for K, 1 and 2.
      for (const g of ['K', '1', '2']) {
        expect(['K', '1', '2']).toContain(solarSystemGradeFromGrade(g));
      }
    });

    it('passes 3-5 through and tops out at 5', () => {
      expect(solarSystemGradeFromGrade('3')).toBe('3');
      expect(solarSystemGradeFromGrade('5')).toBe('5');
      expect(solarSystemGradeFromGrade('8')).toBe('5');
    });

    it('returns null with no canonical grade so the prose fallback stands', () => {
      expect(solarSystemGradeFromGrade(undefined)).toBeNull();
      expect(solarSystemGradeFromGrade('')).toBeNull();
    });

    it('never returns a value that leaves the K-2 fallback branch unreachable', () => {
      // The exact bite: prose in, nothing that === 'K'/'1'/'2' out.
      const proseShapes = [
        'kindergarten students - Use age-appropriate language',
        'elementary students (grades 1-5)',
      ];
      for (const p of proseShapes) {
        // Prose is NOT a canonical grade — the resolver must abstain rather than
        // invent a rung, so the dedicated prose resolver handles it.
        expect(solarSystemGradeFromGrade(p)).toBeNull();
      }
      // And a real canonical grade must land on a branch value.
      expect(['K', '1', '2']).toContain(solarSystemGradeFromGrade('K')!);
    });
  });

  describe('catalog wiring', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'solar-system-explorer')!;

    // The scaffold this suite once pinned was the free-exploration voice: the tutor no longer receives a tutoring
    // block, and the explore face sends it nothing. The live wiring is the boss (`solarSystem.card.ts`).
    it('is wired by its boss card, with no tutoring block beside it', () => {
      expect(entry.teachingWorkspace?.card).toBeDefined();
      expect(entry.tutoring).toBeUndefined();
    });
  });
});
