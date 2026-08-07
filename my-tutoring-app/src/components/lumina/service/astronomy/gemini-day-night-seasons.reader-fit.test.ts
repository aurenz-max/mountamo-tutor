/**
 * Reader-fit: day-night-seasons SCAFFOLD-GAP + prose-grade — 2026-08-06
 *
 * Item 15B / S10. This generator was the WORST offender in the astronomy
 * prose-grade table (13 single-char comparisons against a prose string, zero
 * reads of `ctx.grade`). Probe at `grade=K` BEFORE the fix returned
 * `gradeLevel:'3'`, `showTiltAxis:true`, 4 location markers and 3 objectives —
 * against a catalog K rung reading "no tilt axis shown, 2-3 familiar locations,
 * 1-2 simple questions, fast animation (8x speed)". Every K rung was violated.
 *
 * Non-vacuity: the resolver did not exist pre-fix, and the prose regex returned
 * '3' for every one of these inputs.
 */
import { describe, it, expect } from 'vitest';
import { dayNightGradeFromGrade } from './gemini-day-night-seasons';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

describe('day-night-seasons — reader-fit scaffold + grade resolution', () => {
  describe('dayNightGradeFromGrade — canonical grade, NO floor', () => {
    it('resolves Kindergarten to its own rung', () => {
      expect(dayNightGradeFromGrade('K')).toBe('K');
      expect(dayNightGradeFromGrade('k')).toBe('K');
      expect(dayNightGradeFromGrade('kindergarten')).toBe('K');
      expect(dayNightGradeFromGrade('preschool')).toBe('K');
    });

    it('passes every served grade through unclamped', () => {
      expect(dayNightGradeFromGrade('1')).toBe('1');
      expect(dayNightGradeFromGrade('2')).toBe('2');
      expect(dayNightGradeFromGrade('3')).toBe('3');
      expect(dayNightGradeFromGrade('4')).toBe('4');
      expect(dayNightGradeFromGrade('5')).toBe('5');
    });

    it('tops out at 5 above the primitive ceiling', () => {
      expect(dayNightGradeFromGrade('6')).toBe('5');
      expect(dayNightGradeFromGrade('12')).toBe('5');
    });

    it('returns null with no canonical grade so the prose fallback stands', () => {
      expect(dayNightGradeFromGrade(undefined)).toBeNull();
      expect(dayNightGradeFromGrade('')).toBeNull();
      expect(dayNightGradeFromGrade('nonsense')).toBeNull();
    });

    it('NEVER silently defaults a low grade to the Grade 3 rung (the exact bite)', () => {
      for (const g of ['K', 'k', 'kindergarten', '1', '2']) {
        expect(dayNightGradeFromGrade(g)).not.toBe('3');
      }
    });
  });

  describe('catalog tutoring scaffold', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'day-night-seasons')!;

    it('exists and has a tutoring block (was the SCAFFOLD-GAP)', () => {
      expect(entry).toBeDefined();
      expect(entry.tutoring).toBeDefined();
    });

    it('defines all three scaffolding levels and common struggles', () => {
      expect(entry.tutoring!.scaffoldingLevels.level1).toBeTruthy();
      expect(entry.tutoring!.scaffoldingLevels.level2).toBeTruthy();
      expect(entry.tutoring!.scaffoldingLevels.level3).toBeTruthy();
      expect(entry.tutoring!.commonStruggles!.length).toBeGreaterThanOrEqual(3);
    });

    it('carries the pre-reader read-aloud directive that survives the lesson cap', () => {
      const preReader = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /PRE-READER/i.test(d.title));
      expect(preReader).toBeDefined();
      expect(preReader!.instruction).toMatch(/OVERRIDES/);
      expect(preReader!.instruction).toMatch(/EARTH_ORIENT/);
      expect(preReader!.instruction).toMatch(/EARTH_READ_ALOUD/);
      // Hours are a number a pre-reader cannot use.
      expect(preReader!.instruction).toMatch(/never read a number of hours/i);
    });

    it('addresses BOTH misconceptions this primitive exists to correct', () => {
      const struggles = JSON.stringify(entry.tutoring!.commonStruggles);
      // "the Sun moves across the sky"
      expect(struggles).toMatch(/spinning|Earth that is spinning/i);
      // "seasons come from distance"
      expect(struggles).toMatch(/tilt/i);
    });

    it('has a directive forbidding the distance framing even in passing', () => {
      const tilt = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /TILT/i.test(d.title));
      expect(tilt).toBeDefined();
      expect(tilt!.instruction).toMatch(/never say "closer" or "farther"/i);
    });

    it('references only tags the component actually emits', () => {
      // tutor-test flags dead directive tags; this pins the contract in CI too.
      const directiveText = (entry.tutoring!.aiDirectives ?? [])
        .map((d) => `${d.title} ${d.instruction}`).join(' ');
      const referenced = Array.from(directiveText.matchAll(/\[([A-Z_]+)\]/g)).map((m) => m[1]);
      const emitted = [
        'EARTH_ORIENT', 'EARTH_READ_ALOUD', 'EARTH_LOCATION_SELECTED', 'EARTH_ALL_COMPLETE',
      ];
      for (const tag of referenced) expect(emitted).toContain(tag);
    });

    it('uses no {{#if}} handlebars', () => {
      expect(JSON.stringify(entry.tutoring)).not.toMatch(/\{\{#/);
    });
  });
});
