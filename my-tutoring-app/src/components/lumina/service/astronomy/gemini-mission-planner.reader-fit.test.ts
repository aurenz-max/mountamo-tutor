/**
 * Reader-fit: mission-planner grade resolution + rung stamp — 15A / S7.
 *
 * The S2 (orbit-mechanics-lab) TRIPLE, all three present here:
 *
 *   1. PROSE GRADE — `const gradeLevel = ctx.gradeContext` fed a dozen
 *      comparisons and three lookup maps.
 *   2. LEXICAL COMPARE that survives a correct resolver — `gradeLevel >= '2'`
 *      is TRUE for 'K' because 'K' (0x4B) sorts above '2' (0x32). Fixing only
 *      the resolver would have switched the supply calculator and a crewed
 *      mission ON at Kindergarten. A grep for the resolver finds only bug 1.
 *      (Bitten here, so this is NOT the S3 case where the same rewrite was a
 *      documented no-op.)
 *   3. THE RUNG WAS NEVER STAMPED — `gradeLevel` is in the response schema, so
 *      Gemini fills it, and it gets it wrong: probed pre-fix, a **grade 4**
 *      request returned `gradeLevel: '1'`. `MissionPlanner.tsx` band-gates on
 *      `data.gradeLevel` in a dozen places, so a Grade 4 student was served the
 *      Grade 1 screen.
 *
 * Driven through the real generator with Gemini stubbed (the S3 technique): a
 * reply that OMITS every grade-shaped field is the only way to cover the
 * degrade path, which is where bug 2 lives.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));

import {
  generateMissionPlanner,
  missionPlannerGradeFromGrade,
  missionPlannerGradeFromProse,
  missionRungIndex,
} from './gemini-mission-planner';
import type { GenerationContext } from '../generation/generationContext';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

const K_PROSE = 'kindergarten students (ages 5-6) - Use clear, simple language';
const G4_PROSE = 'grade 4 students (ages 9-10) - Use grade-appropriate language';

/** A reply that omits every grade-shaped field, forcing the degrade path. */
const bareReply = () => ({
  text: JSON.stringify({
    title: 'Space Trip',
    description: 'Pick a place.',
    gradeLevel: '1', // Gemini's echo — deliberately WRONG for most cases here
    destinations: [],
  }),
});

const ctx = (grade: string | undefined, prose: string): GenerationContext =>
  ({
    componentId: 'mission-planner',
    instanceId: 'mp-1',
    topic: 'Going to the Moon',
    gradeLevel: grade === 'K' ? 'kindergarten' : 'elementary',
    gradeContext: prose,
    grade,
    objective: {},
    scope: {},
    raw: {},
  } as unknown as GenerationContext);

beforeEach(() => {
  generateContentMock.mockReset();
  generateContentMock.mockResolvedValue(bareReply());
});

describe('missionPlannerGradeFromGrade — canonical first', () => {
  it('maps kindergarten spellings to K', () => {
    for (const g of ['K', 'k', 'Kindergarten', 'PRESCHOOL']) {
      expect(missionPlannerGradeFromGrade(g)).toBe('K');
    }
  });
  it('maps numerals and clamps above 5', () => {
    expect(missionPlannerGradeFromGrade('1')).toBe('1');
    expect(missionPlannerGradeFromGrade('5')).toBe('5');
    expect(missionPlannerGradeFromGrade('8')).toBe('5');
  });
  it('returns null on nothing usable so the prose fallback can stand', () => {
    expect(missionPlannerGradeFromGrade(undefined)).toBeNull();
    expect(missionPlannerGradeFromGrade('kindergarten students (ages 5-6)')).toBeNull();
  });
  it('the prose fallback actually parses prose', () => {
    expect(missionPlannerGradeFromProse(K_PROSE)).toBe('K');
    expect(missionPlannerGradeFromProse(G4_PROSE)).toBe('4');
  });
});

describe('missionRungIndex — ordinal, because string compare is broken for K', () => {
  it("proves the bug it replaces: 'K' >= '2' is lexically TRUE", () => {
    // This is why fixing the resolver alone would have made K WORSE.
    expect('K' >= '2').toBe(true);
    expect(missionRungIndex('K') >= 2).toBe(false);
  });
  it('orders K below every numeral', () => {
    expect(missionRungIndex('K')).toBe(0);
    expect(missionRungIndex('1')).toBe(1);
    expect(missionRungIndex('5')).toBe(5);
  });
});

describe('mission-planner — the rung is resolved and STAMPED', () => {
  it("overrides Gemini's echo: a grade 4 request no longer returns '1'", async () => {
    const out = await generateMissionPlanner(ctx('4', G4_PROSE));
    expect(out.gradeLevel).toBe('4');
  });

  it('stamps K at kindergarten', async () => {
    expect((await generateMissionPlanner(ctx('K', K_PROSE))).gradeLevel).toBe('K');
  });

  it('falls back to prose when there is no canonical grade', async () => {
    expect((await generateMissionPlanner(ctx(undefined, G4_PROSE))).gradeLevel).toBe('4');
  });
});

describe('mission-planner — the K degrade path (where the lexical bug lived)', () => {
  it('leaves the adult instruments OFF at K', async () => {
    const out = await generateMissionPlanner(ctx('K', K_PROSE));
    expect(out.supplyCalculator).toBe(false);
    expect(out.crewed).toBe(false);
    expect(out.showTrajectory).toBe(false);
    expect(out.showLaunchWindows).toBe(false);
    expect(out.gravityAssistOption).toBe(false);
    expect(out.missionClock).toBe(false);
  });

  it('gives K a flyby and the loosest fuel constraint', async () => {
    const out = await generateMissionPlanner(ctx('K', K_PROSE));
    expect(out.missionType).toBe('flyby');
    expect(out.fuelConstraint).toBe(100);
  });

  it('gives K only 2 destinations, per the catalog K rung', async () => {
    const out = await generateMissionPlanner(ctx('K', K_PROSE));
    expect(out.destinations).toHaveLength(2);
  });

  it('the ladder still climbs — grade 4 turns the instruments back on', async () => {
    const out = await generateMissionPlanner(ctx('4', G4_PROSE));
    expect(out.supplyCalculator).toBe(true);
    expect(out.crewed).toBe(true);
    expect(out.showTrajectory).toBe(true);
    expect(out.showLaunchWindows).toBe(true);
    expect(out.gravityAssistOption).toBe(true);
    expect(out.missionType).toBe('return');
    expect(out.fuelConstraint).toBe(50);
  });

  it('grade 2 sits between them (supplies on, launch windows off)', async () => {
    const out = await generateMissionPlanner(ctx('2', 'grade 2 students'));
    expect(out.supplyCalculator).toBe(true);
    expect(out.showLaunchWindows).toBe(false);
    expect(out.gravityAssistOption).toBe(false);
  });
});

describe('mission-planner — catalog scaffold reaches a non-reader', () => {
  const entry = ASTRONOMY_CATALOG.find((e) => e.id === 'mission-planner');

  it('has a tutoring block at all (it was one of the 26 mute primitives)', () => {
    expect(entry?.tutoring).toBeTruthy();
  });

  it('carries the cap-override clause', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /PRE-READER READ-ALOUD/i.test(x.title));
    expect(d?.instruction).toMatch(/OVERRIDES any instruction to keep it to one sentence/i);
  });

  it('forbids manufacturing a wrong destination, but still protects the real answer', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /NO WRONG DESTINATION/i.test(x.title));
    expect(d?.instruction).toMatch(/never imply one destination is the correct one/i);
    // …and the launch-window phase DOES have an answer, which must stay protected.
    expect(d?.instruction).toMatch(/do not narrow it by elimination/i);
  });

  it('bans numbers at K-1 and lifts the ban from grade 2', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /NO NUMBERS AT K-1/i.test(x.title));
    expect(d?.instruction).toMatch(/do NOT say kilometres, miles, tons, AU, or a count of days/i);
    expect(d?.instruction).toMatch(/From grade 2 up the numbers ARE the objective/i);
  });

  it('names every moment tag the component emits', () => {
    const blob = JSON.stringify(entry?.tutoring ?? {});
    for (const tag of [
      'MISSION_ORIENT',
      'MISSION_PHASE_CHANGED',
      'MISSION_DESTINATION_SELECTED',
      'MISSION_READ_ALOUD',
    ]) {
      expect(blob).toContain(tag);
    }
  });

  it('has no handlebars conditionals', () => {
    expect(JSON.stringify(entry?.tutoring ?? {})).not.toMatch(/\{\{#/);
  });
});
