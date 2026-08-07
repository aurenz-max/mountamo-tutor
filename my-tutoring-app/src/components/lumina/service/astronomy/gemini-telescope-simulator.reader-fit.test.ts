/**
 * Reader-fit: telescope-simulator BAND FLOOR (Grade 2+) — 2026-08-06
 *
 * Two defects are locked down here, both found by the supply-side sweep
 * (`qa/reader-fit/supply-sweep-triage-2026-08-06.md`) and fixed in the same slice:
 *
 * 1. **Band floor.** The primitive claimed K-5 but has a permanently-visible
 *    instrument panel with text-only labels and NO tutoring scaffold at all, so
 *    a pre-reader/emerging reader cannot learn the task. Verdict WRONG-BAND at
 *    PRE and EMERGING; floored to Grade 2.
 * 2. **Prose-vs-canonical grade** (the 2026-08-04 `14m` sweep class). The
 *    generator read prose `ctx.gradeContext` into `=== 'K'` / `<= '2'`
 *    comparisons that could never match, so every structural default silently
 *    fell through to its last branch.
 *
 * Non-vacuity: each assertion below fails if the fix is reverted — the floor
 * cases return 'K'/'1' under the old enum, and the prose cases returned the
 * fall-through branch under the old `ctx.gradeContext` read.
 */
import { describe, it, expect } from 'vitest';
import { telescopeGradeFromGrade } from './gemini-telescope-simulator';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

describe('telescope-simulator — reader-fit band floor', () => {
  describe('telescopeGradeFromGrade — canonical grade, floored at 2', () => {
    it('floors Kindergarten to Grade 2 (never returns K)', () => {
      expect(telescopeGradeFromGrade('K')).toBe('2');
      expect(telescopeGradeFromGrade('k')).toBe('2');
    });

    it('floors Grade 1 to Grade 2 (never returns 1)', () => {
      expect(telescopeGradeFromGrade('1')).toBe('2');
    });

    it('passes through the grades the primitive genuinely serves', () => {
      expect(telescopeGradeFromGrade('2')).toBe('2');
      expect(telescopeGradeFromGrade('3')).toBe('3');
      expect(telescopeGradeFromGrade('4')).toBe('4');
      expect(telescopeGradeFromGrade('5')).toBe('5');
    });

    it('tops out at 5 for grades above the primitive ceiling', () => {
      expect(telescopeGradeFromGrade('6')).toBe('5');
      expect(telescopeGradeFromGrade('12')).toBe('5');
    });

    it('returns null with no canonical grade so the prose fallback stands', () => {
      expect(telescopeGradeFromGrade(undefined)).toBeNull();
      expect(telescopeGradeFromGrade('')).toBeNull();
      expect(telescopeGradeFromGrade('kindergarten students, ages 5-6')).toBeNull();
    });

    it('NEVER returns a below-floor rung for any input', () => {
      const inputs = ['K', 'k', '', '1', '2', '3', '4', '5', '9', 'nonsense', undefined];
      for (const g of inputs) {
        const r = telescopeGradeFromGrade(g);
        expect(r === null || ['2', '3', '4', '5'].includes(r)).toBe(true);
      }
    });
  });

  describe('catalog entry stops claiming K-1', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'telescope-simulator')!;

    it('exists', () => {
      expect(entry).toBeDefined();
    });

    it('declares an explicit BAND FLOOR the curator can read', () => {
      expect(entry.constraints).toMatch(/BAND FLOOR/);
      expect(entry.constraints).toMatch(/Grade 2\+ ONLY/);
    });

    it('no longer advertises a K-inclusive range in description or constraints', () => {
      const text = `${entry.description} ${entry.constraints}`;
      // The strings that made the manifest curator pick this for a K objective.
      expect(text).not.toMatch(/K-5/);
      expect(text).not.toMatch(/K-4/);
      expect(text).not.toMatch(/grades K-5/i);
      expect(text).not.toMatch(/Progressive difficulty from K\b/);
    });

    it('names where K-1 astronomy demand should route instead', () => {
      expect(entry.constraints).toMatch(
        /solar-system-explorer|day-night-seasons|moon-phases-lab/,
      );
    });
  });
});
