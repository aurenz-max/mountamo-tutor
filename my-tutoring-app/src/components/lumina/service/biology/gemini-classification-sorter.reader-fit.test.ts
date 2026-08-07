/**
 * Reader-fit: classification-sorter SCAFFOLD-GAP + prose-band — 2026-08-06
 *
 * Item 15B / S9 of the reader-fit supply-side sweep. Two defects, one slice:
 *
 * 1. **SCAFFOLD-GAP.** No tutoring block, no `useLuminaAI` — the backend fell
 *    through to "No specific scaffolding instructions for this primitive type",
 *    so a non-reader was never told the sorting rule, the group names, or the
 *    item in front of them. All three are text-only on screen.
 * 2. **Prose-band lookup** (the biology flavour of the `14m` class). The band
 *    was `gradeBandMap[ctx.gradeContext] || '3-5'`, with the map keyed on bare
 *    grade tokens but indexed with PROSE. The lookup missed on every input, so
 *    every grade silently got '3-5'. Verified by probe at `grade=K` BEFORE the
 *    fix: `gradeBand: '3-5'` with THREE categories, against a catalog K-2 rung
 *    that reads "Binary sorts only (2 categories)".
 *
 * Non-vacuity: the resolver did not exist pre-fix, and the prose path returned
 * '3-5' for every one of these inputs.
 */
import { describe, it, expect } from 'vitest';
import {
  classificationBandFromGrade,
  classificationBandFromProse,
} from './gemini-classification-sorter';
import { BIOLOGY_CATALOG } from '../manifest/catalog/biology';

describe('classification-sorter — reader-fit scaffold + band resolution', () => {
  describe('classificationBandFromGrade — canonical grade wins', () => {
    it('sends Kindergarten to the K-2 binary-sort rung', () => {
      expect(classificationBandFromGrade('K')).toBe('K-2');
      expect(classificationBandFromGrade('k')).toBe('K-2');
      expect(classificationBandFromGrade('kindergarten')).toBe('K-2');
      expect(classificationBandFromGrade('preschool')).toBe('K-2');
    });

    it('maps each numeric grade to its real band', () => {
      expect(classificationBandFromGrade('1')).toBe('K-2');
      expect(classificationBandFromGrade('2')).toBe('K-2');
      expect(classificationBandFromGrade('3')).toBe('3-5');
      expect(classificationBandFromGrade('5')).toBe('3-5');
      expect(classificationBandFromGrade('6')).toBe('6-8');
      expect(classificationBandFromGrade('8')).toBe('6-8');
    });

    it('passes an explicit band token straight through', () => {
      expect(classificationBandFromGrade('K-2')).toBe('K-2');
      expect(classificationBandFromGrade('6-8')).toBe('6-8');
    });

    it('returns null with no canonical grade so the prose fallback stands', () => {
      expect(classificationBandFromGrade(undefined)).toBeNull();
      expect(classificationBandFromGrade('')).toBeNull();
      expect(classificationBandFromGrade('nonsense')).toBeNull();
    });

    it('NEVER silently sends a K-2 grade to the 3-5 default (the exact bite)', () => {
      for (const g of ['K', 'k', 'kindergarten', '1', '2']) {
        expect(classificationBandFromGrade(g)).toBe('K-2');
      }
    });
  });

  describe('classificationBandFromProse — the kept fallback', () => {
    it('reads the prose the old map lookup could never match', () => {
      // This exact string shape is what ctx.gradeContext actually holds.
      expect(classificationBandFromProse('kindergarten students - Use age-appropriate language'))
        .toBe('K-2');
      expect(classificationBandFromProse('grade 4 students, elementary')).toBe('3-5');
      expect(classificationBandFromProse('grade 7 students, middle school')).toBe('6-8');
    });

    it('still defaults to 3-5 when the prose says nothing', () => {
      expect(classificationBandFromProse('')).toBe('3-5');
      expect(classificationBandFromProse(undefined)).toBe('3-5');
    });
  });

  describe('catalog tutoring scaffold exists and is pre-reader safe', () => {
    const entry = BIOLOGY_CATALOG.find((c) => c.id === 'classification-sorter')!;

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
      expect(preReader!.instruction).toMatch(/SORT_ORIENT/);
      expect(preReader!.instruction).toMatch(/SORT_ITEM_STAGED/);
      // The staged-item beat must NOT leak the destination group.
      expect(preReader!.instruction).toMatch(/Do NOT say which group/i);
    });

    it('has an explicit answer-discipline directive separating question from answer', () => {
      const discipline = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /ANSWER DISCIPLINE/i.test(d.title));
      expect(discipline).toBeDefined();
      // The rule and group names are the QUESTION; the correct group is the ANSWER.
      expect(discipline!.instruction).toMatch(/never name it/i);
      expect(discipline!.instruction).toMatch(/elimination/i);
    });

    it('covers the boundary-case struggle the catalog itself mandates', () => {
      const struggles = JSON.stringify(entry.tutoring!.commonStruggles);
      expect(struggles).toMatch(/bat|penguin|dolphin|platypus/i);
    });

    it('uses no {{#if}} handlebars — interpolate_template renders them literally', () => {
      expect(JSON.stringify(entry.tutoring)).not.toMatch(/\{\{#/);
    });
  });
});
