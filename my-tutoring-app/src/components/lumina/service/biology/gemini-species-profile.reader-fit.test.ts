/**
 * Reader-fit: species-profile band resolution + K-2 prompt scoping — 15A / S6.
 *
 * Probed pre-fix at grade=K, this generator returned the scientific name
 * "Ursus maritimus", a kingdom/phylum taxonomy, "300 to 600 kilograms", and
 * "Formally described and named by scientific standards in 1774 by the
 * Constantine John Phipps" — to a five-year-old who cannot read any of it.
 *
 * Two distinct causes, and the first alone would not have been enough:
 *   1. NO BAND WAS EVER STAMPED. `SpeciesProfileData` had no `gradeBand` field
 *      at all, so the component had nothing to gate on and every new gate would
 *      have been dead on arrival (the S2/S3/S4 defect, fourth appearance).
 *   2. THE CONTENT ITSELF WAS THE LOAD. `ctx.gradeContext` prose reached only
 *      the prompt — which is where prose belongs — but it was ONE bullet
 *      ("for younger students, use simpler language") against EIGHT mandatory
 *      REQUIREMENTS sections demanding taxonomy, measurements and discovery
 *      history. Band-gating the component alone would have hidden the Latin name
 *      and left "300 to 600 kilograms" sitting in the size row. This is S4's
 *      lesson: a band failure can be a CONTENT gap, and only the generator can
 *      close a content gap.
 *
 * Driven through the real generator with Gemini stubbed (the S3 technique), so a
 * revert of either half is caught.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));

import { generateSpeciesProfile } from './gemini-species-profile';
import type { GenerationContext } from '../generation/generationContext';
import { BIOLOGY_CATALOG } from '../manifest/catalog/biology';

/** Kindergarten prose exactly as `ctx.gradeContext` supplies it — no "grade N". */
const K_PROSE = 'kindergarten students (ages 5-6) - Use clear, simple language';
const G4_PROSE = 'grade 4 students (ages 9-10) - Use grade-appropriate language';

const reply = () => ({
  text: JSON.stringify({
    commonName: 'Polar Bear',
    scientificName: 'Ursus maritimus',
    imagePrompt: 'a polar bear on sea ice',
    diet: { type: 'carnivore', description: 'Hunts seals.' },
    category: 'mammal',
  }),
});

const ctx = (grade: string | undefined, prose: string): GenerationContext =>
  ({
    componentId: 'species-profile',
    instanceId: 'sp-1',
    topic: 'Polar Bear',
    gradeLevel: grade === 'K' ? 'kindergarten' : 'elementary',
    gradeContext: prose,
    grade,
    objective: {},
    scope: {},
    raw: { speciesName: 'Polar Bear' },
  } as unknown as GenerationContext);

const prompt = () => String((generateContentMock.mock.calls[0]?.[0] as { contents?: string })?.contents ?? '');

beforeEach(() => {
  generateContentMock.mockReset();
  generateContentMock.mockResolvedValue(reply());
});

describe('species-profile — the rung is STAMPED onto the output', () => {
  it('stamps K-2 at kindergarten', async () => {
    const out = await generateSpeciesProfile(ctx('K', K_PROSE));
    expect(out.gradeBand).toBe('K-2');
  });

  it('stamps 3-5 at grade 4 and 6-8 at grade 7', async () => {
    expect((await generateSpeciesProfile(ctx('4', G4_PROSE))).gradeBand).toBe('3-5');
    generateContentMock.mockReset();
    generateContentMock.mockResolvedValue(reply());
    expect((await generateSpeciesProfile(ctx('7', G4_PROSE))).gradeBand).toBe('6-8');
  });

  it('falls back to prose when there is no canonical grade', async () => {
    expect((await generateSpeciesProfile(ctx(undefined, K_PROSE))).gradeBand).toBe('K-2');
  });

  it('never leaves the band undefined — a gate keyed on it would be dead', async () => {
    const out = await generateSpeciesProfile(ctx('K', K_PROSE));
    expect(out.gradeBand).toBeDefined();
  });
});

describe('species-profile — the K-2 prompt drops the adult sections', () => {
  it('tells Gemini to leave discoveryInfo EMPTY at K-2', async () => {
    await generateSpeciesProfile(ctx('K', K_PROSE));
    expect(prompt()).toMatch(/Leave `discoveryInfo` EMPTY/);
    expect(prompt()).not.toMatch(/Notable fossil finds or scientific milestones/);
  });

  it('asks for only a broad everyday group instead of full taxonomy at K-2', async () => {
    await generateSpeciesProfile(ctx('K', K_PROSE));
    expect(prompt()).toMatch(/Leave phylum, class, order, family and genus EMPTY/);
    expect(prompt()).not.toMatch(/Kingdom through species/);
  });

  it('forbids numbers with units and demands comparisons at K-2', async () => {
    await generateSpeciesProfile(ctx('K', K_PROSE));
    expect(prompt()).toMatch(/NEVER write a number with a unit/);
    expect(prompt()).toMatch(/CHILD-SIZED COMPARISON/);
  });

  it('bans the jargon register at K-2 and names the replacements', async () => {
    await generateSpeciesProfile(ctx('K', K_PROSE));
    const p = prompt();
    expect(p).toMatch(/NEVER use these words: species, taxonomy, kingdom/);
    expect(p).toMatch(/Most of them CANNOT READ/);
  });

  it('keeps ALL of it at grade 4 — the ladder is not flattened', async () => {
    await generateSpeciesProfile(ctx('4', G4_PROSE));
    const p = prompt();
    expect(p).toMatch(/Kingdom through species/);
    expect(p).toMatch(/Notable fossil finds or scientific milestones/);
    expect(p).toMatch(/Provide accurate measurements/);
    expect(p).not.toMatch(/NEVER write a number with a unit/);
    expect(p).not.toMatch(/CANNOT READ/);
  });
});

describe('species-profile — catalog scaffold reaches a non-reader', () => {
  const entry = BIOLOGY_CATALOG.find((e) => e.id === 'species-profile');

  it('has a tutoring block at all (it was one of the 26 mute primitives)', () => {
    expect(entry?.tutoring).toBeTruthy();
  });

  it('carries the cap-override clause so the beat survives [PRIMITIVE SWITCH]', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /PRE-READER READ-ALOUD/i.test(x.title));
    expect(d?.instruction).toMatch(/OVERRIDES any instruction to keep it to one sentence/i);
  });

  it('forbids the tutor from re-saying what the card deliberately withheld at K-2', () => {
    const d = (entry?.tutoring?.aiDirectives ?? []).find((x) => /NO MEASUREMENTS AND NO LATIN/i.test(x.title));
    expect(d?.instruction).toMatch(/never say a number with a unit/i);
    expect(d?.instruction).toMatch(/puts back exactly what was taken out/i);
    // …and explicitly lifts the restriction where the vocabulary IS the objective.
    expect(d?.instruction).toMatch(/At 3-5 and 6-8 none of this applies/i);
  });

  it('names every moment tag the component emits', () => {
    const blob = JSON.stringify(entry?.tutoring ?? {});
    for (const tag of ['SPECIES_ORIENT', 'SPECIES_READ_ALOUD']) expect(blob).toContain(tag);
  });

  it('has no handlebars conditionals — interpolate_template does keys only', () => {
    expect(JSON.stringify(entry?.tutoring ?? {})).not.toMatch(/\{\{#/);
  });
});
