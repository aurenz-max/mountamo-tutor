/**
 * Reader-fit: rocket-builder SCAFFOLD-GAP + PRIMITIVE-GAP + prose-grade — 2026-08-07
 *
 * Item 15A / S3, taken under the ruling that overturned 15A's band-floor theory:
 * if the curator routes a primitive at a grade, make it work at that grade.
 *
 * Unlike S2 (orbit-mechanics-lab), this generator's HAPPY path was already
 * correct at BOTH K and G1 when probed live — the prose reaches Gemini through
 * the prompt and steers it well. The defect is on the DEGRADE path:
 * `getDefaultComponents(prose)`, `getDefaultHints(prose)` and
 * `getDefaultLearningFocus(prose)` all miss their maps and fall through to the
 * Grade 3 rung, and `['3','4','5'].includes(prose)` was never true at any grade.
 * Those fire exactly when Gemini omitted a field — when the lesson is already
 * degraded. This is the solar-system-explorer shape: no happy-path probe reaches
 * it, so it is guarded here instead.
 *
 * Non-vacuity: the resolver did not exist pre-fix, and the prose fallback
 * returns '3' for every canonical input below.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Drive the REAL generator body with Gemini stubbed.
 *
 * Testing only the exported pure helpers left the generator's own USE of them
 * uncovered: a revert-bite that put `gradeLevel = ctx.gradeContext` back, or
 * dropped the rung stamp, passed every test. Those are exactly the defects this
 * slice exists to fix, so they get driven end-to-end here instead.
 */
const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));

import {
  rocketBuilderGradeFromGrade,
  rocketRungIndex,
  generateRocketBuilder,
} from './gemini-rocket-builder';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

/** Kindergarten prose exactly as `ctx.gradeContext` supplies it. */
const K_PROSE = 'kindergarten students (ages 5-6) - Use clear, simple language';
const G3_PROSE = 'grade 3 students (ages 8-9) - Use grade-appropriate language';

/** A Gemini reply that OMITS every grade-shaped field, forcing the degrade path. */
const bareReply = () => ({
  text: JSON.stringify({
    title: 'Build a Rocket',
    description: 'Put parts together.',
    gradeLevel: '3',            // deliberately wrong — the echo must not win
    maxStages: 1,
    targetAltitudeKm: 15,
    targetOrbit: false,
    showTWR: false,
    showFuelGauge: false,
    showForces: false,
    atmosphereModel: 'simple',
    guidedMode: true,
    simulationSpeed: 50,
    // availableComponents, hints and learningFocus intentionally absent
  }),
});

const ctxFor = (grade: string | undefined, prose: string) => ({
  topic: 'Rockets have parts',
  grade,
  gradeContext: prose,
  raw: {},
  intent: '',
} as never);

describe('rocket-builder — reader-fit scaffold + grade resolution', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    generateContentMock.mockResolvedValue(bareReply());
  });

  /**
   * The generator BODY, not just its helpers. Every assertion here fails if the
   * prose-grade line comes back, if the rung stamp is dropped, or if the budget
   * rung returns to membership-of-prose.
   */
  describe('generateRocketBuilder — the degrade path at K', () => {
    it('STAMPS the resolved rung over the wrong echo Gemini returned', async () => {
      const data = await generateRocketBuilder(ctxFor('K', K_PROSE));
      expect(data.gradeLevel).toBe('K');
    });

    it('resolves G1 from the canonical grade, not the prose', async () => {
      const data = await generateRocketBuilder(ctxFor('1', K_PROSE));
      expect(data.gradeLevel).toBe('1');
    });

    it('fills K hints from the K rung, NOT the grade-3 fallthrough', async () => {
      const data = await generateRocketBuilder(ctxFor('K', K_PROSE));
      const hints = data.hints.join(' ');
      expect(hints).toBeTruthy();
      // The grade-3 rung talks about staging and ratios; the K rung must not.
      expect(hints).not.toMatch(/stag|ratio|thrust-to-weight|delta-v/i);
    });

    it('fills K components from the K rung and arms NO budget below grade 3', async () => {
      const data = await generateRocketBuilder(ctxFor('K', K_PROSE));
      expect(data.availableComponents.length).toBeGreaterThan(0);
      for (const c of data.availableComponents) {
        expect(c.cost).toBeUndefined();
      }
    });

    it('DOES arm the budget rung at grade 3 (the membership test never did)', async () => {
      const data = await generateRocketBuilder(ctxFor('3', G3_PROSE));
      expect(data.gradeLevel).toBe('3');
      expect(data.availableComponents.some(c => c.cost != null)).toBe(true);
    });

    it('gives K a learning focus of its own rather than the grade-3 one', async () => {
      const k = await generateRocketBuilder(ctxFor('K', K_PROSE));
      const g3 = await generateRocketBuilder(ctxFor('3', G3_PROSE));
      expect(k.learningFocus).toBeTruthy();
      expect(k.learningFocus).not.toBe(g3.learningFocus);
    });

    it('still falls back to prose when there is no canonical grade', async () => {
      const data = await generateRocketBuilder(ctxFor(undefined, K_PROSE));
      expect(data.gradeLevel).toBe('K');
    });

    it('sends the canonical rung to Gemini, and prose only as the audience voice', async () => {
      await generateRocketBuilder(ctxFor('K', K_PROSE));
      const prompt = String(generateContentMock.mock.calls[0][0].contents);
      expect(prompt).toContain('TARGET GRADE RUNG: K');
      expect(prompt).toContain(K_PROSE);   // audience voice, where prose belongs
    });
  });

  describe('rocketBuilderGradeFromGrade — canonical grade, NO floor', () => {
    it('resolves Kindergarten to its own rung', () => {
      expect(rocketBuilderGradeFromGrade('K')).toBe('K');
      expect(rocketBuilderGradeFromGrade('k')).toBe('K');
      expect(rocketBuilderGradeFromGrade('kindergarten')).toBe('K');
      expect(rocketBuilderGradeFromGrade('preschool')).toBe('K');
    });

    it('passes every served grade through unclamped', () => {
      expect(rocketBuilderGradeFromGrade('1')).toBe('1');
      expect(rocketBuilderGradeFromGrade('2')).toBe('2');
      expect(rocketBuilderGradeFromGrade('3')).toBe('3');
      expect(rocketBuilderGradeFromGrade('4')).toBe('4');
      expect(rocketBuilderGradeFromGrade('5')).toBe('5');
    });

    it('tops out at 5 above the primitive ceiling', () => {
      expect(rocketBuilderGradeFromGrade('6')).toBe('5');
      expect(rocketBuilderGradeFromGrade('12')).toBe('5');
    });

    it('returns null with no canonical grade so the prose fallback stands', () => {
      expect(rocketBuilderGradeFromGrade(undefined)).toBeNull();
      expect(rocketBuilderGradeFromGrade('')).toBeNull();
      expect(rocketBuilderGradeFromGrade('nonsense')).toBeNull();
    });

    it('NEVER silently defaults a low grade to the Grade 3 rung (the exact bite)', () => {
      for (const g of ['K', 'k', 'kindergarten', '1', '2']) {
        expect(rocketBuilderGradeFromGrade(g)).not.toBe('3');
      }
    });

    it('never returns a floored rung — K is served, not routed away', () => {
      expect(rocketBuilderGradeFromGrade('K')).not.toBe('2');
      expect(rocketBuilderGradeFromGrade('1')).not.toBe('2');
    });
  });

  /**
   * The budget rung used `['3','4','5'].includes(gradeLevel)` against PROSE, so
   * it was never true at ANY grade — the grade 3+ cost constraint silently never
   * armed on the degrade path.
   */
  describe('rocketRungIndex — ordinal rung, not membership-of-prose', () => {
    it('places K below every numbered grade', () => {
      expect(rocketRungIndex('K')).toBe(0);
      expect(rocketRungIndex('K')).toBeLessThan(rocketRungIndex('1'));
      expect(rocketRungIndex('K')).toBeLessThan(rocketRungIndex('3'));
    });

    it('arms the budget rung from grade 3 and never below it', () => {
      expect(rocketRungIndex('K') >= 3).toBe(false);
      expect(rocketRungIndex('1') >= 3).toBe(false);
      expect(rocketRungIndex('2') >= 3).toBe(false);
      expect(rocketRungIndex('3') >= 3).toBe(true);
      expect(rocketRungIndex('5') >= 3).toBe(true);
    });

    it('a prose string never satisfies the old membership test (why it never armed)', () => {
      const prose = 'kindergarten students (ages 5-6) - Use clear language';
      expect(['3', '4', '5'].includes(prose)).toBe(false);
      // ...and neither does a legitimate grade-3 prose string.
      expect(['3', '4', '5'].includes('grade 3 students (ages 8-9)')).toBe(false);
    });
  });

  describe('catalog tutoring scaffold', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'rocket-builder')!;

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
      expect(preReader!.instruction).toMatch(/OVERRIDES/i);
      expect(preReader!.instruction).toMatch(/ROCKET_ORIENT/);
      expect(preReader!.instruction).toMatch(/ROCKET_READ_ALOUD/);
      expect(preReader!.instruction).toMatch(/ROCKET_PART_ADDED/);
      expect(preReader!.instruction).toMatch(/ROCKET_LAUNCH_RESULT/);
    });

    it('forbids the units and jargon this primitive is full of, and supplies replacements', () => {
      const preReader = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /PRE-READER/i.test(d.title))!;
      expect(preReader.instruction).toMatch(/kilogram/i);
      expect(preReader.instruction).toMatch(/kilonewton/i);
      expect(preReader.instruction).toMatch(/thrust/i);
      expect(preReader.instruction).toMatch(/staging|delta-v/i);
      // replacement register, not just a ban list
      expect(preReader.instruction).toMatch(/"push"|push/i);
    });

    it('does not let the tutor hand over the three required parts on the first ask', () => {
      const rule = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /IS THE ANSWER/i.test(d.title));
      expect(rule).toBeDefined();
      expect(rule!.instruction).toMatch(/checklist/i);
      expect(rule!.instruction).toMatch(/level 3/i);
    });

    it('every contextKey referenced in the task description is declared', () => {
      const keys = entry.tutoring!.contextKeys ?? [];
      const referenced = (entry.tutoring!.taskDescription.match(/\{\{\w+\}\}/g) ?? [])
        .map((m) => m.slice(2, -2));
      expect(referenced.length).toBeGreaterThan(0);
      for (const k of referenced) expect(keys).toContain(k);
    });

    it('has no handlebars conditionals — the backend interpolator cannot render them', () => {
      expect(JSON.stringify(entry.tutoring)).not.toMatch(/\{\{#/);
    });
  });

  describe('catalog band claim', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'rocket-builder')!;

    it('does NOT carry a band floor — K is served by making it age-fit', () => {
      expect(entry.constraints).not.toMatch(/BAND FLOOR/i);
      expect(entry.constraints).not.toMatch(/Grade \d\+ ONLY/i);
    });

    it('tells the curator the K-1 parts are pictures added by one tap', () => {
      expect(entry.constraints).toMatch(/K and Grade 1 are fully supported/i);
      expect(entry.constraints).toMatch(/tap/i);
      expect(entry.constraints).toMatch(/PICTURE/i);
    });
  });
});
