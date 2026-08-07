/**
 * Reader-fit: scale-comparator SCAFFOLD-GAP + the most complete prose-grade
 * instance in the sweep — 2026-08-06. Item 15B / S12.
 *
 * Here the prose did not merely break a branch inside the generator: it ESCAPED
 * the generator through an `as` cast and reached the component.
 *
 *   const gradeLevel = ctx.gradeContext;                    // PROSE
 *   const gradeConfig = getGradeConfig(gradeLevel);         // switch → default
 *   `… for ${gradeLevel === 'K' ? 'Kindergarten' : `Grade ${gradeLevel}`} …`
 *   gradeLevel: gradeLevel as 'K' | '1' | … | '5',          // the lie
 *
 * Verified by probe at `grade=K` BEFORE the fix:
 *   gradeLevel: "kindergarten students (ages 5-6) - Use clear language, rela…"
 *   showRatios: true          ← catalog: "showRatios should be false for K-1"
 *
 * Consequences: the `switch` never matched so every grade got the default rung;
 * the prompt's audience line read "Grade kindergarten students (ages 5-6) -…";
 * all six per-grade prompt blocks were unreachable; and the COMPONENT's own
 * `formatNumber` K branch (`gradeLevel === 'K'`) was dead because the field it
 * tests held a sentence.
 */
import { describe, it, expect } from 'vitest';
import { scaleComparatorGradeFromGrade } from './gemini-scale-comparator';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

describe('scale-comparator — reader-fit scaffold + grade resolution', () => {
  describe('scaleComparatorGradeFromGrade', () => {
    it('resolves Kindergarten to its own rung', () => {
      expect(scaleComparatorGradeFromGrade('K')).toBe('K');
      expect(scaleComparatorGradeFromGrade('kindergarten')).toBe('K');
      expect(scaleComparatorGradeFromGrade('preschool')).toBe('K');
    });

    it('passes every served grade through unclamped', () => {
      expect(scaleComparatorGradeFromGrade('1')).toBe('1');
      expect(scaleComparatorGradeFromGrade('2')).toBe('2');
      expect(scaleComparatorGradeFromGrade('3')).toBe('3');
      expect(scaleComparatorGradeFromGrade('4')).toBe('4');
      expect(scaleComparatorGradeFromGrade('5')).toBe('5');
    });

    it('tops out at 5 above the primitive ceiling', () => {
      expect(scaleComparatorGradeFromGrade('7')).toBe('5');
    });

    it('returns null with no canonical grade so the prose fallback stands', () => {
      expect(scaleComparatorGradeFromGrade(undefined)).toBeNull();
      expect(scaleComparatorGradeFromGrade('')).toBeNull();
    });

    it('ALWAYS yields a value getGradeConfig can switch on — never a sentence', () => {
      // The bite: the emitted `gradeLevel` is typed 'K'|'1'|…|'5' and both the
      // generator's switch AND the component's formatNumber compare against it.
      const valid = ['K', '1', '2', '3', '4', '5'];
      for (const g of ['K', 'kindergarten', '1', '3', '5', '9']) {
        const r = scaleComparatorGradeFromGrade(g);
        expect(r).not.toBeNull();
        expect(valid).toContain(r!);
        expect(r!.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('catalog tutoring scaffold', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'scale-comparator')!;

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

    it('forbids measurements AND ratios to a pre-reader, and supplies the replacement register', () => {
      const preReader = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /PRE-READER/i.test(d.title))!;
      expect(preReader).toBeDefined();
      expect(preReader.instruction).toMatch(/OVERRIDES/);
      expect(preReader.instruction).toMatch(/NEVER give a pre-reader a measurement or a ratio/i);
      expect(preReader.instruction).toMatch(/much bigger/i);
      expect(preReader.instruction).toMatch(/tiny next to it/i);
    });

    it('makes the picture the answer, not the number, at every grade', () => {
      const d = (entry.tutoring!.aiDirectives ?? [])
        .find((x) => /COMPARISON IS THE ANSWER/i.test(x.title))!;
      expect(d).toBeDefined();
      expect(d.instruction).toMatch(/Never lead with a ratio or a figure at any grade/i);
    });

    it('covers the misconception the visualisation itself invites (bigger = closer)', () => {
      expect(JSON.stringify(entry.tutoring!.commonStruggles)).toMatch(/closer, not larger|closer/i);
    });

    it('references only tags the component actually emits', () => {
      const directiveText = (entry.tutoring!.aiDirectives ?? [])
        .map((d) => `${d.title} ${d.instruction}`).join(' ');
      const referenced = Array.from(directiveText.matchAll(/\[([A-Z_]+)\]/g)).map((m) => m[1]);
      const emitted = ['SCALE_ORIENT', 'SCALE_OBJECT_ADDED', 'SCALE_READ_ALOUD'];
      for (const tag of referenced) expect(emitted).toContain(tag);
    });

    it('uses no {{#if}} handlebars', () => {
      expect(JSON.stringify(entry.tutoring)).not.toMatch(/\{\{#/);
    });
  });
});
