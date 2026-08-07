/**
 * Reader-fit: moon-phases-lab SCAFFOLD-GAP + prose-grade — 2026-08-06
 *
 * Item 15B / S8 of the reader-fit supply-side sweep
 * (`qa/reader-fit/supply-sweep-triage-2026-08-06.md`). Two defects, one slice:
 *
 * 1. **SCAFFOLD-GAP.** The interaction is genuinely K-fit (drag the Moon, watch
 *    it change) but the primitive had NO tutoring block and NO `useLuminaAI`
 *    channel, so `lumina_tutor.py` fell through to "No specific scaffolding
 *    instructions for this primitive type" — a non-reader was never told what to
 *    do, and nothing on screen could be decoded.
 * 2. **Prose-vs-canonical grade** (the 2026-08-04 `14m` sweep class). The rung
 *    came from regexing PROSE `ctx.gradeContext` for /grade\s*(\d|K)/. The
 *    kindergarten prose has no "grade N", so the match failed and the whole
 *    expression fell through to the literal default `'3'` — a K student got
 *    Grade 3 content with `viewMode: 'split_view'`, contradicting the catalog's
 *    own K rung ("from_earth view only"). This also made the component's
 *    `isPreReader` band gate dead code at K, since `gradeLevel` was never 'K'.
 *
 * Non-vacuity: every assertion here fails if the fix is reverted — the resolver
 * did not exist, and the K/1/2/4 cases all returned '3' through the old prose
 * regex fall-through.
 */
import { describe, it, expect } from 'vitest';
import { moonPhasesGradeFromGrade } from './gemini-moon-phases-lab';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

describe('moon-phases-lab — reader-fit scaffold + grade resolution', () => {
  describe('moonPhasesGradeFromGrade — canonical grade, NO floor', () => {
    it('resolves Kindergarten to its own rung (the whole point of 15B)', () => {
      expect(moonPhasesGradeFromGrade('K')).toBe('K');
      expect(moonPhasesGradeFromGrade('k')).toBe('K');
      expect(moonPhasesGradeFromGrade('kindergarten')).toBe('K');
      expect(moonPhasesGradeFromGrade('preschool')).toBe('K');
    });

    it('passes every served grade through unclamped', () => {
      expect(moonPhasesGradeFromGrade('1')).toBe('1');
      expect(moonPhasesGradeFromGrade('2')).toBe('2');
      expect(moonPhasesGradeFromGrade('3')).toBe('3');
      expect(moonPhasesGradeFromGrade('4')).toBe('4');
      expect(moonPhasesGradeFromGrade('5')).toBe('5');
    });

    it('tops out at 5 for grades above the primitive ceiling', () => {
      expect(moonPhasesGradeFromGrade('6')).toBe('5');
      expect(moonPhasesGradeFromGrade('12')).toBe('5');
    });

    it('returns null with no canonical grade so the prose fallback stands', () => {
      expect(moonPhasesGradeFromGrade(undefined)).toBeNull();
      expect(moonPhasesGradeFromGrade('')).toBeNull();
      expect(moonPhasesGradeFromGrade('nonsense')).toBeNull();
    });

    it('NEVER silently defaults a low grade to the Grade 3 rung', () => {
      // This is the exact bite: the old prose regex sent K and 1 to '3'.
      for (const g of ['K', 'k', 'kindergarten', '1']) {
        expect(moonPhasesGradeFromGrade(g)).not.toBe('3');
      }
    });

    it('only ever returns a rung the GRADE_CONFIGURATIONS table defines', () => {
      const inputs = ['K', 'k', '', '0', '1', '2', '3', '4', '5', '9', 'x', undefined];
      for (const g of inputs) {
        const r = moonPhasesGradeFromGrade(g);
        expect(r === null || ['K', '1', '2', '3', '4', '5'].includes(r)).toBe(true);
      }
    });
  });

  describe('catalog tutoring scaffold exists and is pre-reader safe', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'moon-phases-lab')!;

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

    it('carries the pre-reader read-aloud directive that survives the lesson one-sentence cap', () => {
      const directives = entry.tutoring!.aiDirectives ?? [];
      const preReader = directives.find((d) => /PRE-READER/i.test(d.title));
      expect(preReader).toBeDefined();
      expect(preReader!.instruction).toMatch(/OVERRIDES/);
      expect(preReader!.instruction).toMatch(/MOON_ORIENT/);
      expect(preReader!.instruction).toMatch(/MOON_READ_ALOUD/);
    });

    it('addresses the primitive\'s stated critical misconception (shadow, not geometry)', () => {
      const struggles = JSON.stringify(entry.tutoring!.commonStruggles);
      expect(struggles).toMatch(/shadow/i);
      expect(struggles).toMatch(/eclipse/i);
    });

    it('never tells the tutor to reveal a position, degree or button (answer-leak discipline)', () => {
      const spoken = [
        entry.tutoring!.scaffoldingLevels.level1,
        entry.tutoring!.scaffoldingLevels.level2,
        entry.tutoring!.scaffoldingLevels.level3,
        ...(entry.tutoring!.commonStruggles ?? []).map((s) => s.response),
      ].join(' ');
      expect(spoken).not.toMatch(/\d+\s*degrees?/i);
      expect(spoken).not.toMatch(/\d+°/);
    });

    it('uses no {{#if}} handlebars — interpolate_template renders them literally', () => {
      const all = JSON.stringify(entry.tutoring);
      expect(all).not.toMatch(/\{\{#/);
    });
  });
});
