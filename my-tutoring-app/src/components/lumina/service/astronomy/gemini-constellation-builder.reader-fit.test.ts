/**
 * Reader-fit: constellation-builder grade resolution + pre-reader content bound.
 *
 * The PROSE-GRADE class, the last of it in astronomy (with planetary-explorer):
 *
 *   const gradeLevel   = ctx.gradeContext;                                  // PROSE
 *   const resolvedGrade = gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3';
 *
 * `ctx.grade` was read exactly ZERO times. Probed live at `98e4928` this missed
 * at BOTH ends of the K neighbourhood, not just below it:
 *
 *   &grade=K&gradeLevel=kindergarten  → gradeLevel "3"
 *   &grade=1&gradeLevel=first grade   → gradeLevel "3"   ← the extension
 *
 * "first grade students" contains no "grade 1", so Grade 1 fell to the literal
 * '3' exactly as Kindergarten did. `resolvedGrade` drives GRADE_CONFIGURATIONS,
 * the prompt's "**Grade Level:**" line, the stamp on the output, AND (because
 * the stamp is what the tutor prompt prints) "Grade Level: 3" in the scaffold.
 *
 * The rung here was stamped WRONG, not missing — so this is a resolver fix, not
 * a stamping fix.
 *
 * Second finding, and the one a resolver alone would not have closed: at K the
 * generator wrote Grade-3 prose into `instruction` ("Trace these sequential
 * stars to reveal the proud celestial lion patrolling the spring skies"). Every
 * string here is spoken by the tutor at K, and that sentence is not sayable to a
 * five-year-old. The language is bounded in the PROMPT, which is the only layer
 * that can — the component cannot shorten a sentence already written.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));

import {
  generateConstellationBuilder,
  constellationGradeFromGrade,
  constellationGradeFromProse,
} from './gemini-constellation-builder';
import type { GenerationContext } from '../generation/generationContext';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

const K_PROSE = 'kindergarten students (ages 5-6) - Use clear, simple language';
const G1_PROSE = 'first grade students (ages 6-7) - Use clear, simple language';
const G4_PROSE = 'grade 4 students (ages 9-10) - Use grade-appropriate language';

/** Gemini's echoed rung is deliberately '3' — the stamp must override it. */
const reply = () => ({
  text: JSON.stringify({
    title: 'Star Patterns',
    description: 'Connect the stars.',
    gradeLevel: '3',
    stars: [
      { id: 's1', x: 10, y: 10, magnitude: 2, isPartOfConstellation: true },
      { id: 's2', x: 20, y: 20, magnitude: 2, isPartOfConstellation: true },
    ],
    challenges: [
      {
        id: 'c1',
        type: 'guided_trace',
        constellationName: 'Big Dipper',
        instruction: 'Tap the stars.',
        starOrderCsv: 's1,s2',
        mythologyFact: 'It looks like a spoon.',
        season: 'year-round',
      },
    ],
  }),
});

const ctx = (grade: string | undefined, prose: string): GenerationContext =>
  ({
    componentId: 'constellation-builder',
    instanceId: 'cb-1',
    topic: 'finding star patterns in the night sky',
    gradeLevel: grade === 'K' ? 'kindergarten' : 'elementary',
    gradeContext: prose,
    grade,
    objective: {},
    scope: {},
    raw: {},
  } as unknown as GenerationContext);

/** The prompt actually sent to Gemini for a given context. */
const promptFor = async (c: GenerationContext): Promise<string> => {
  generateContentMock.mockClear();
  await generateConstellationBuilder(c);
  return String(generateContentMock.mock.calls[0][0].contents);
};

beforeEach(() => {
  generateContentMock.mockReset();
  generateContentMock.mockResolvedValue(reply());
});

describe('the bug this replaces — the old prose regex', () => {
  const OLD = (prose: string) => prose.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3';

  it('missed Kindergarten AND Grade 1, sending both to the literal 3', () => {
    expect(OLD(K_PROSE)).toBe('3');
    expect(OLD(G1_PROSE)).toBe('3');
  });

  it('only ever worked on prose that literally spelled "grade N"', () => {
    expect(OLD(G4_PROSE)).toBe('4');
  });
});

describe('constellationGradeFromGrade — canonical first', () => {
  it('maps kindergarten spellings to K', () => {
    for (const g of ['K', 'k', 'Kindergarten', 'PRESCHOOL']) {
      expect(constellationGradeFromGrade(g)).toBe('K');
    }
  });
  it('maps numerals and clamps above 5', () => {
    expect(constellationGradeFromGrade('1')).toBe('1');
    expect(constellationGradeFromGrade('5')).toBe('5');
    expect(constellationGradeFromGrade('8')).toBe('5');
  });
  it('returns null on nothing usable so the prose fallback can stand', () => {
    expect(constellationGradeFromGrade(undefined)).toBeNull();
    expect(constellationGradeFromGrade('')).toBeNull();
    expect(constellationGradeFromGrade('kindergarten students (ages 5-6)')).toBeNull();
  });
});

describe('constellationGradeFromProse — the fallback parses what the regex could not', () => {
  it('reads spelled-out grades, including the "first grade" that used to fall to 3', () => {
    expect(constellationGradeFromProse(K_PROSE)).toBe('K');
    expect(constellationGradeFromProse(G1_PROSE)).toBe('1');
    expect(constellationGradeFromProse(G4_PROSE)).toBe('4');
  });
  it('still defaults to 3 on prose with no grade in it at all', () => {
    expect(constellationGradeFromProse('some students')).toBe('3');
  });
});

describe('constellation-builder — the rung is resolved and STAMPED', () => {
  it("overrides Gemini's echo: a K request no longer returns '3'", async () => {
    expect((await generateConstellationBuilder(ctx('K', K_PROSE))).gradeLevel).toBe('K');
  });

  it('stamps 1 at grade 1 — the neighbouring grade that was also broken', async () => {
    expect((await generateConstellationBuilder(ctx('1', G1_PROSE))).gradeLevel).toBe('1');
  });

  it('the ladder still climbs — grade 4 is untouched', async () => {
    expect((await generateConstellationBuilder(ctx('4', G4_PROSE))).gradeLevel).toBe('4');
  });

  it('falls back to prose when there is no canonical grade', async () => {
    expect((await generateConstellationBuilder(ctx(undefined, G1_PROSE))).gradeLevel).toBe('1');
  });

  it('stamps the rung on the FALLBACK exit path too', async () => {
    generateContentMock.mockRejectedValue(new Error('gemini down'));
    expect((await generateConstellationBuilder(ctx('K', K_PROSE))).gradeLevel).toBe('K');
  });
});

describe('constellation-builder — the prompt carries the right rung and guidance', () => {
  it('tells Gemini K, not 3, and hands it the K guidance', async () => {
    const p = await promptFor(ctx('K', K_PROSE));
    expect(p).toContain('**Grade Level:** K');
    expect(p).toContain('Focus on guided tracing only');
  });

  it('grade 4 still gets the grade 4 rung and its own guidance', async () => {
    const p = await promptFor(ctx('4', G4_PROSE));
    expect(p).toContain('**Grade Level:** 4');
    expect(p).toContain('All challenge types');
  });
});

describe('constellation-builder — the pre-reader language bound', () => {
  it('bounds instruction and star-story length at K', async () => {
    const p = await promptFor(ctx('K', K_PROSE));
    expect(p).toMatch(/PRE-READER LANGUAGE RULES \(grade rung K\)/);
    expect(p).toMatch(/"instruction": AT MOST 8 words/);
    expect(p).toMatch(/"mythologyFact": AT MOST 15 words/);
  });

  it('quotes the real Grade-3 sentence it exists to prevent', async () => {
    const p = await promptFor(ctx('K', K_PROSE));
    // Probed verbatim at 98e4928 from a &grade=K request.
    expect(p).toContain('proud celestial lion patrolling the spring skies');
  });

  it('applies at grade 1 too — grade 1 is a pre-reader rung here', async () => {
    const p = await promptFor(ctx('1', G1_PROSE));
    expect(p).toMatch(/PRE-READER LANGUAGE RULES \(grade rung 1\)/);
  });

  it('does NOT appear at grade 2 and above — the ladder is not flattened', async () => {
    for (const [g, prose] of [['2', 'grade 2 students'], ['4', G4_PROSE]] as const) {
      const p = await promptFor(ctx(g, prose));
      expect(p).not.toMatch(/PRE-READER LANGUAGE RULES/);
    }
  });
});

describe('constellation-builder — catalog scaffold reaches a non-reader', () => {
  const entry = ASTRONOMY_CATALOG.find((e) => e.id === 'constellation-builder');

  it('carries the cap-override clause, so the read-aloud survives a lesson switch', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /PRE-READER READ-ALOUD/i.test(x.title));
    expect(d?.instruction).toMatch(/OVERRIDES any instruction to keep it to one sentence/i);
  });

  it('protects the answer: the next star is never named', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /NEVER SAY WHICH STAR IS NEXT/i.test(x.title));
    expect(d?.instruction).toMatch(/Naming it, or saying where it sits/i);
    expect(d?.instruction).toMatch(/Only at scaffolding level 3/i);
  });

  it('bans star counts and magnitudes at K-1 and SUPPLIES the replacement register', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /NO STAR NUMBERS OR MAGNITUDES/i.test(x.title));
    expect(d?.instruction).toMatch(/do NOT say a star count, a step number/i);
    expect(d?.instruction).toMatch(/the twinkling one/i);
    expect(d?.instruction).toMatch(/From grade 2 up the counts and the brightness ARE part of the objective/i);
  });

  it('names every moment tag the component emits', () => {
    const blob = JSON.stringify(entry?.tutoring ?? {});
    for (const tag of [
      'CONSTELLATION_ORIENT',
      'CONSTELLATION_CHALLENGE_CHANGED',
      'CONSTELLATION_WRONG_STAR',
      'CONSTELLATION_COMPLETE',
      'CONSTELLATION_READ_ALOUD',
    ]) {
      expect(blob).toContain(tag);
    }
  });

  it('has no handlebars conditionals', () => {
    expect(JSON.stringify(entry?.tutoring ?? {})).not.toMatch(/\{\{#/);
  });
});
