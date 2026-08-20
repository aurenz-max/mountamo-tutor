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

  describe('catalog tutoring scaffold', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'solar-system-explorer')!;

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

    it('forbids speaking measurements to a pre-reader (free-exploration face)', () => {
      const explore = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /FREE EXPLORATION/i.test(d.title))!;
      expect(explore).toBeDefined();
      expect(explore.instruction).toMatch(/that IS your greeting/i);
      expect(explore.instruction).toMatch(/NEVER speak a measurement/i);
      expect(explore.instruction).toMatch(/kilometres|AU|Celsius/i);
    });

    it('carries scale honesty — the model cannot show size and distance truthfully at once', () => {
      const explore = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /FREE EXPLORATION/i.test(d.title))!;
      expect(explore.instruction).toMatch(/trade-off/i);
      const struggles = JSON.stringify(entry.tutoring!.commonStruggles);
      expect(struggles).toMatch(/lined up|in a line/i);
      expect(struggles).toMatch(/emptier|spread/i);
    });

    it('references only tags the component or the judged script actually emits', () => {
      const directiveText = (entry.tutoring!.aiDirectives ?? [])
        .map((d) => `${d.title} ${d.instruction}`).join(' ');
      const referenced = Array.from(directiveText.matchAll(/\[([A-Z_]+)\]/g)).map((m) => m[1]);
      // Must stay in sync with every sendText() tag in SolarSystemExplorer.tsx
      // and every cue tag in solarSystemScript.ts — a directive naming a tag
      // that is never sent is a rule the tutor can never apply.
      const emitted = [
        // Free-exploration face:
        'SOLAR_ORIENT', 'SOLAR_BODY_SELECTED', 'SOLAR_READ_ALOUD',
        // Judged-loop cues (solarSystemScript.ts):
        'SOLAR_ITEM', 'SOLAR_MOVE', 'SOLAR_COMPLETE', 'SOLAR_HEAR',
        // The generic never-read-tags directive names its own placeholder:
        'BRACKETS',
      ];
      for (const tag of referenced) expect(emitted).toContain(tag);
    });

    it('uses no {{#if}} handlebars', () => {
      expect(JSON.stringify(entry.tutoring)).not.toMatch(/\{\{#/);
    });
  });
});
