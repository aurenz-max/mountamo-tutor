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
import { LIVE_ADAPTERS } from '../../components/live-activity/activityContract';

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

  // The catalog tutoring block this once pinned never reached a bound session (`tutoring: null`), and its
  // [SORT_*] tags belonged to a retired runner. The rules a non-reader depends on now ride in the guidance the
  // tutor receives: the shared rotation, filled from the sorter's boss card.
  describe('the guidance the tutor receives keeps the pre-reader and answer rules', () => {
    const guidance = LIVE_ADAPTERS['classification-sorter'].guidance;

    it('is built from a boss card, not prose', () => {
      expect(BIOLOGY_CATALOG.find((c) => c.id === 'classification-sorter')!.teachingWorkspace?.card?.modes.sort)
        .toEqual({ answer: 'tap', judge: 'activity', flow: 'one-at-a-time' });
    });

    it('says the rule, groups and card freely and reads them aloud for a non-reader', () => {
      expect(guidance).toMatch(/The sorting rule, the group names and the card’s name are the question/);
      expect(guidance).toMatch(/read the instruction and every label aloud for a learner who cannot read/);
      expect(guidance).toMatch(/The learner's job is to tap the group each card belongs in/);
    });

    it('never names the group, by elimination or by the deciding fact', () => {
      expect(guidance).toMatch(/which group a card goes in against the lesson's key, which you are not told; that is the answer/);
      expect(guidance).toMatch(/Never rule a choice out/);
      expect(guidance).toMatch(/or state the one fact that decides it/);
      expect(guidance).toMatch(/whether the card’s thing has it is the deciding fact/);
    });

    it('keeps the boundary-case steer', () => {
      expect(guidance).toMatch(/bat, a penguin/);
    });
  });
});
