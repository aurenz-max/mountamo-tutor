/**
 * Reader-fit: planetary-explorer grade resolution + pre-reader content bound.
 *
 * Item 16 slice 2 — the LAST astronomy generator on the prose-grade class
 * (constellation-builder was slice 1, `ea5f60b`).
 *
 *   const gradeLevel   = ctx.gradeContext;                                  // PROSE
 *   const resolvedGrade = gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3';
 *
 * `ctx.grade` was read ZERO times, and probed at `ea5f60b` it missed at BOTH
 * ends of the K neighbourhood, exactly as slice 1 did:
 *
 *   &grade=K&gradeLevel=kindergarten  → gradeLevel "3"
 *   &grade=1&gradeLevel=first grade   → gradeLevel "3"
 *
 * This ladder runs to grade 8, not 5, so the clamp differs from every other
 * astronomy generator — that is what the clamp test below is really guarding.
 *
 * The second finding is the one a resolver alone would not touch. At K the
 * generator produced, verbatim:
 *
 *   "What is the length of a day on Jupiter?"  →  9.9 hours / 24 hours / 365 hours / 48 hours
 *   "Earth is the only known planet that supports life."  (true/false)
 *   "It is made of gas with no solid surface"  (an option)
 *
 * Reading those ALOUD does not rescue them: discriminating 9.9 from 48 hours is
 * not a Kindergarten task in any modality. Only the generator can choose to ask
 * about something a child can SEE, so the bound lives in the prompt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));

import {
  generatePlanetaryExplorer,
  planetaryGradeFromGrade,
  planetaryGradeFromProse,
} from './gemini-planetary-explorer';
import type { GenerationContext } from '../generation/generationContext';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

const K_PROSE = 'kindergarten students (ages 5-6) - Use clear, simple language';
const G1_PROSE = 'first grade students (ages 6-7) - Use clear, simple language';
const G4_PROSE = 'grade 4 students (ages 9-10) - Use grade-appropriate language';

/** A reply that omits every grade-shaped field, forcing the degrade path. */
const bareReply = () => ({ text: JSON.stringify({ title: 'Space', planets: [] }) });

const ctx = (grade: string | undefined, prose: string): GenerationContext =>
  ({
    componentId: 'planetary-explorer',
    instanceId: 'pe-1',
    topic: 'the planets in our solar system',
    gradeLevel: grade === 'K' ? 'kindergarten' : 'elementary',
    gradeContext: prose,
    grade,
    objective: {},
    scope: {},
    raw: {},
  } as unknown as GenerationContext);

const promptFor = async (c: GenerationContext): Promise<string> => {
  generateContentMock.mockClear();
  await generatePlanetaryExplorer(c);
  return String(generateContentMock.mock.calls[0][0].contents);
};

beforeEach(() => {
  generateContentMock.mockReset();
  generateContentMock.mockResolvedValue(bareReply());
});

describe('the bug this replaces — the old prose regex', () => {
  const OLD = (prose: string) => prose.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3';

  it('missed Kindergarten AND Grade 1, sending both to the literal 3', () => {
    expect(OLD(K_PROSE)).toBe('3');
    expect(OLD(G1_PROSE)).toBe('3');
  });

  it('also could never reach grades 6-8, because it only matched one digit', () => {
    // Not the headline defect, but the same expression: this ladder runs to 8.
    expect(OLD('grade 8 students')).toBe('8');
    expect(OLD('eighth grade students')).toBe('3');
  });
});

describe('planetaryGradeFromGrade — canonical first', () => {
  it('maps kindergarten spellings to K', () => {
    for (const g of ['K', 'k', 'Kindergarten', 'PRESCHOOL']) {
      expect(planetaryGradeFromGrade(g)).toBe('K');
    }
  });

  it('clamps at 8, not 5 — this ladder is K-8', () => {
    expect(planetaryGradeFromGrade('5')).toBe('5');
    expect(planetaryGradeFromGrade('8')).toBe('8');
    expect(planetaryGradeFromGrade('12')).toBe('8');
  });

  it('returns null on nothing usable so the prose fallback can stand', () => {
    expect(planetaryGradeFromGrade(undefined)).toBeNull();
    expect(planetaryGradeFromGrade('')).toBeNull();
    expect(planetaryGradeFromGrade('kindergarten students (ages 5-6)')).toBeNull();
  });
});

describe('planetaryGradeFromProse — the fallback parses what the regex could not', () => {
  it('reads spelled-out grades at both ends of the ladder', () => {
    expect(planetaryGradeFromProse(K_PROSE)).toBe('K');
    expect(planetaryGradeFromProse(G1_PROSE)).toBe('1');
    expect(planetaryGradeFromProse(G4_PROSE)).toBe('4');
    expect(planetaryGradeFromProse('eighth grade students')).toBe('8');
  });
  it('still defaults to 3 on prose with no grade in it', () => {
    expect(planetaryGradeFromProse('some students')).toBe('3');
  });
});

describe('planetary-explorer — the rung reaches the prompt and the output', () => {
  it('tells Gemini K, not 3, and hands it the K guidance and planet count', async () => {
    const p = await promptFor(ctx('K', K_PROSE));
    expect(p).toContain('**Grade Level:** K');
    expect(p).toContain('Pick 3 planets');
    expect(p).toContain('age-appropriate for grade K');
  });

  it('stamps K on the output (this is what the tutor prompt prints)', async () => {
    expect((await generatePlanetaryExplorer(ctx('K', K_PROSE))).gradeLevel).toBe('K');
  });

  it('stamps 1 at grade 1 — the neighbouring grade that was also broken', async () => {
    expect((await generatePlanetaryExplorer(ctx('1', G1_PROSE))).gradeLevel).toBe('1');
  });

  it('the ladder still climbs — grade 5 gets 5 planets and its own rung', async () => {
    const out = await generatePlanetaryExplorer(ctx('5', 'grade 5 students'));
    expect(out.gradeLevel).toBe('5');
    expect(await promptFor(ctx('5', 'grade 5 students'))).toContain('Pick 5 planets');
  });

  it('falls back to prose when there is no canonical grade', async () => {
    expect((await generatePlanetaryExplorer(ctx(undefined, G1_PROSE))).gradeLevel).toBe('1');
  });

  it('stamps the rung on the FALLBACK exit path too', async () => {
    generateContentMock.mockRejectedValue(new Error('gemini down'));
    expect((await generatePlanetaryExplorer(ctx('K', K_PROSE))).gradeLevel).toBe('K');
  });
});

describe('planetary-explorer — the pre-reader content bound', () => {
  it('bans number-and-unit answers at K, naming the ones it actually produced', async () => {
    const p = await promptFor(ctx('K', K_PROSE));
    expect(p).toMatch(/PRE-READER RULES \(grade rung K\)/);
    expect(p).toMatch(/NEVER ask about: length of a day or year, distance, mass, gravity/);
    expect(p).toMatch(/a number with a unit or a decimal/);
  });

  it('bounds option and true-false length, quoting the real offenders', async () => {
    const p = await promptFor(ctx('K', K_PROSE));
    expect(p).toMatch(/AT MOST 3 words/);
    // Probed verbatim at `ea5f60b` from a &grade=K request.
    expect(p).toContain('It is made of gas with no solid surface');
    expect(p).toContain('Earth is the only known planet that supports life.');
  });

  it('applies at grade 1 too', async () => {
    expect(await promptFor(ctx('1', G1_PROSE))).toMatch(/PRE-READER RULES \(grade rung 1\)/);
  });

  it('does NOT appear at grade 2 and above — the ladder is not flattened', async () => {
    for (const [g, prose] of [['2', 'grade 2 students'], ['5', 'grade 5 students']] as const) {
      expect(await promptFor(ctx(g, prose))).not.toMatch(/PRE-READER RULES/);
    }
  });
});

describe('planetary-explorer — catalog scaffold reaches a non-reader', () => {
  const entry = ASTRONOMY_CATALOG.find((e) => e.id === 'planetary-explorer');

  it('carries the cap-override clause, so the read-aloud survives a lesson switch', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /PRE-READER READ-ALOUD/i.test(x.title));
    expect(d?.instruction).toMatch(/OVERRIDES any instruction to keep it to one sentence/i);
  });

  it('requires every OPTION to be read aloud, not just the question', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /PRE-READER READ-ALOUD/i.test(x.title));
    expect(d?.instruction).toMatch(/read EVERY option aloud in order/i);
  });

  it('protects the answer until the last try, and says which messages are reveals', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /NEVER SAY THE ANSWER/i.test(x.title));
    expect(d?.instruction).toMatch(/On the FIRST wrong attempt you are told what they picked but NOT what is right/i);
    expect(d?.instruction).toMatch(/never eliminate options down to one/i);
    expect(d?.instruction).toMatch(/final-attempt reveals/i);
  });

  it('bans numbers at K-1, SUPPLIES the replacement register, and kills the reader-only hint', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /NO NUMBERS OR UNITS AT K-1/i.test(x.title));
    expect(d?.instruction).toMatch(/do NOT say kilometres, miles, degrees, hours, days, years/i);
    expect(d?.instruction).toMatch(/so cold your nose would freeze/i);
    // The scaffoldingLevels still say "Look at the stats panel" — correct from
    // grade 2, useless at K. The directive has to override it out loud.
    expect(d?.instruction).toMatch(/Do NOT tell a K-1 child to "look at the stats panel"/i);
    expect(d?.instruction).toMatch(/From grade 2 up the numbers and the Earth comparisons ARE the objective/i);
  });

  it('names every moment tag the read-aloud directive depends on', () => {
    const blob = JSON.stringify(entry?.tutoring ?? {});
    for (const tag of [
      'JOURNEY_START', 'PLANET_ARRIVE', 'QUESTION_SHOWN',
      'PLANET_READ_ALOUD', 'STAT_TAPPED', 'QUIZ_START',
    ]) {
      expect(blob).toContain(tag);
    }
  });

  it('no longer parks the answer key in the prompt for the whole question', () => {
    expect(entry?.tutoring?.contextKeys).not.toContain('correctAnswer');
    // …but the keys that make scaffolding possible are still declared.
    for (const k of ['studentAnswer', 'currentScore', 'attemptNumber']) {
      expect(entry?.tutoring?.contextKeys).toContain(k);
    }
  });

  it('the scaffolding levels ENACT the question instead of narrating the screen', () => {
    // tutor-test's `indirect-script` check flagged level3 for pointing at the UI
    // ("what the question is asking"). The old level1 was the line the 08-07
    // handoff quoted as the proof this scaffold was written for a reader:
    // "Look at the stats panel — one of those numbers will help you."
    // `?? {}` widened this to `Levels | {}`, on which `.level1` does not exist —
    // 3 errors that had the Lumina gate red on HEAD. The entry is asserted
    // present by every other case in this file, so assert it here too.
    const levels = entry!.tutoring!.scaffoldingLevels;
    const blob = Object.values(levels).join(' ');
    expect(blob).not.toMatch(/Look at the stats panel/i);
    expect(blob).not.toMatch(/what the question is asking/i);
    // Every level now speaks the stimulus rather than pointing at it.
    expect(levels.level1).toContain('{{questionText}}');
    expect(levels.level2).toContain('{{questionText}}');
    expect(levels.level3).toMatch(/Do not say which choice is right/i);
  });

  it('has no handlebars conditionals', () => {
    expect(JSON.stringify(entry?.tutoring ?? {})).not.toMatch(/\{\{#/);
  });
});
