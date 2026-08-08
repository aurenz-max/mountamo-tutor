/**
 * Reader-fit: bio-compare-contrast band resolution at the CALL SITE — 15A / S5.
 *
 * The fifth copy of the biology prose-keyed band defect, and the only one that
 * did NOT live inside a generator. `gemini-compare-contrast.ts` takes
 * `gradeBand: 'K-2' | '3-5' | '6-8' = '3-5'` as a function PARAMETER, so its
 * body is clean and a grep over `service/biology/*.ts` for the other four
 * copies misses this entirely. The defect was in the registry:
 *
 *   const gradeBandMap = { 'K': 'K-2', '1': 'K-2', … };
 *   const gradeBand = config.gradeBand || gradeBandMap[ctx.gradeContext] || '3-5';
 *
 * — a map keyed on grade TOKENS, indexed with `ctx.gradeContext` PROSE. It
 * missed at every grade, so '3-5' always won. Probed live pre-fix at K, G1 and
 * G4: all three returned `gradeBand: '3-5'` with the same "Mammalian Predators
 * … vertebrate mammals … evolved as social pack runners" draw, against a
 * catalog K-2 rung reading "4-6 attributes, simple observable characteristics".
 *
 * Driven through the REAL registered generator rather than through
 * `resolveBiologyBand` directly: the shared resolver already has its own tests
 * (`service/biology/gradeBand.test.ts`), and what was broken here is the call
 * site's USE of it. Testing the helper would leave the actual defect uncovered
 * — the S3 lesson.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
vi.mock('../../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));

import '../generators/biologyGenerators';
import { getGenerator } from '../contentRegistry';
import type { ManifestItem } from '../contentRegistry';
import { BIOLOGY_CATALOG } from '../../manifest/catalog/biology';

/** Kindergarten prose exactly as `ctx.gradeContext` supplies it — no "grade N". */
const K_PROSE = 'kindergarten students (ages 5-6) - Use clear, simple language';
const G4_PROSE = 'grade 4 students (ages 9-10) - Use grade-appropriate language';

/** A well-formed comparison reply; `gradeBand` is deliberately echoed WRONG so
 *  the assertions can only pass if the call site overrides Gemini's echo. */
const comparisonReply = () => ({
  text: JSON.stringify({
    title: 'Dogs and Cats',
    mode: 'side-by-side',
    entityA: { name: 'Dog', imagePrompt: 'a dog', attributes: [{ category: 'Sound', value: 'Barks', isShared: false }] },
    entityB: { name: 'Cat', imagePrompt: 'a cat', attributes: [{ category: 'Sound', value: 'Meows', isShared: false }] },
    sharedAttributes: [{ category: 'Body covering', value: 'Covered in fur' }],
    keyInsight: 'Both are furry pets.',
    gradeBand: '6-8',
  }),
});

/** An image reply in the shape `gemini-compare-contrast-with-images` expects. */
const imageReply = () => ({
  candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }],
});

/** Route each call by model: the text model gets the comparison, the image model an image. */
const routeByModel = () => {
  generateContentMock.mockImplementation((args: { model?: string }) =>
    String(args?.model || '').includes('image') ? imageReply() : comparisonReply(),
  );
};

const run = async (opts: { grade?: string; prose: string; config?: Record<string, unknown> }) => {
  const gen = getGenerator('bio-compare-contrast');
  if (!gen) throw new Error('bio-compare-contrast is not registered');
  const item: ManifestItem = {
    componentId: 'bio-compare-contrast',
    instanceId: 'cc-1',
    title: 'Dogs vs Cats',
    config: { objectiveGrade: opts.grade, ...(opts.config ?? {}) },
  } as ManifestItem;
  return gen(item, 'Dogs vs Cats', opts.prose, opts.grade === 'K' ? 'kindergarten' : 'elementary');
};

/** The prompt text handed to the TEXT model on the last run. */
const textPrompt = () => {
  const call = generateContentMock.mock.calls.find(
    (c) => !String((c[0] as { model?: string })?.model || '').includes('image'),
  );
  return String((call?.[0] as { contents?: string })?.contents ?? '');
};

const imageCalls = () =>
  generateContentMock.mock.calls.filter((c) =>
    String((c[0] as { model?: string })?.model || '').includes('image'),
  );

beforeEach(() => {
  generateContentMock.mockReset();
  routeByModel();
});

describe('bio-compare-contrast — canonical grade drives the band (15A/S5)', () => {
  it('K resolves to K-2, not the 3-5 default', async () => {
    const out = (await run({ grade: 'K', prose: K_PROSE })) as { data: { gradeBand: string } };
    expect(out.data.gradeBand).toBe('K-2');
  });

  it('grade 1 and 2 also resolve to K-2', async () => {
    for (const g of ['1', '2']) {
      generateContentMock.mockReset();
      routeByModel();
      const out = (await run({ grade: g, prose: K_PROSE })) as { data: { gradeBand: string } };
      expect(out.data.gradeBand).toBe('K-2');
    }
  });

  it('grade 4 stays 3-5 and grade 7 reaches 6-8 (the ladder is not flattened)', async () => {
    const g4 = (await run({ grade: '4', prose: G4_PROSE })) as { data: { gradeBand: string } };
    expect(g4.data.gradeBand).toBe('3-5');

    generateContentMock.mockReset();
    routeByModel();
    const g7 = (await run({ grade: '7', prose: G4_PROSE })) as { data: { gradeBand: string } };
    expect(g7.data.gradeBand).toBe('6-8');
  });

  it("overrides Gemini's echoed gradeBand rather than trusting it", async () => {
    // The stub echoes '6-8'. A band gate keying off `data.gradeBand` would be
    // dead on arrival if the echo won — the S2/S3/S4 "rung never stamped" defect.
    const out = (await run({ grade: 'K', prose: K_PROSE })) as { data: { gradeBand: string } };
    expect(out.data.gradeBand).not.toBe('6-8');
    expect(out.data.gradeBand).toBe('K-2');
  });

  it('falls back to prose only when there is no canonical grade', async () => {
    const out = (await run({ prose: K_PROSE })) as { data: { gradeBand: string } };
    expect(out.data.gradeBand).toBe('K-2');
  });

  it('an explicit config.gradeBand still wins over both', async () => {
    const out = (await run({ grade: 'K', prose: K_PROSE, config: { gradeBand: '6-8' } })) as {
      data: { gradeBand: string };
    };
    expect(out.data.gradeBand).toBe('6-8');
  });

  it('sends the K-2 complexity guidelines to Gemini, not the 3-5 ones', async () => {
    await run({ grade: 'K', prose: K_PROSE });
    const prompt = textPrompt();
    expect(prompt).toContain('GRADE K-2 GUIDELINES');
    expect(prompt).not.toContain('GRADE 3-5 GUIDELINES');
    expect(prompt).toContain('4-6 total attributes per entity');
  });
});

describe('bio-compare-contrast — pictures are the answer surface at K-2', () => {
  it('generates entity images at K-2 without being asked', async () => {
    const out = (await run({ grade: 'K', prose: K_PROSE })) as {
      data: { entityA: { imageUrl?: string }; entityB: { imageUrl?: string } };
    };
    expect(imageCalls()).toHaveLength(2);
    expect(out.data.entityA.imageUrl).toMatch(/^data:image\//);
    expect(out.data.entityB.imageUrl).toMatch(/^data:image\//);
  });

  it('does NOT generate images at 3-5 unless config asks (cost control + control case)', async () => {
    await run({ grade: '4', prose: G4_PROSE });
    expect(imageCalls()).toHaveLength(0);
  });

  it('honours an explicit generateImages:false even at K-2', async () => {
    await run({ grade: 'K', prose: K_PROSE, config: { generateImages: false } });
    expect(imageCalls()).toHaveLength(0);
  });
});

describe('bio-compare-contrast — catalog scaffold reaches a non-reader', () => {
  const entry = BIOLOGY_CATALOG.find((e) => e.id === 'bio-compare-contrast');

  it('has a tutoring block at all (it was one of the 26 mute primitives)', () => {
    expect(entry?.tutoring).toBeTruthy();
  });

  it('carries a PRE-READER READ-ALOUD directive that overrides the lesson one-sentence cap', () => {
    const directives = entry?.tutoring?.aiDirectives ?? [];
    const preReader = directives.find((d) => /PRE-READER READ-ALOUD/i.test(d.title));
    expect(preReader).toBeTruthy();
    expect(preReader?.instruction).toMatch(/OVERRIDES any instruction to keep it to one sentence/i);
  });

  it('forbids giving away which side a characteristic belongs on, including by elimination', () => {
    const directives = entry?.tutoring?.aiDirectives ?? [];
    const answerRule = directives.find((d) => /ANSWER/i.test(d.title));
    expect(answerRule?.instruction).toMatch(/elimination/i);
  });

  it('names every moment tag the component actually emits', () => {
    const blob = JSON.stringify(entry?.tutoring ?? {});
    for (const tag of [
      'COMPARE_ORIENT',
      'COMPARE_ATTRIBUTE_SHOWN',
      'COMPARE_ANSWERED',
      'COMPARE_READ_ALOUD',
    ]) {
      expect(blob).toContain(tag);
    }
  });

  it('has no handlebars conditionals — interpolate_template does key substitution only', () => {
    expect(JSON.stringify(entry?.tutoring ?? {})).not.toMatch(/\{\{#/);
  });

  it('declares the K-2 tap protocol in constraints so the manifest can see it', () => {
    expect(entry?.constraints).toMatch(/K-2 venn-interactive becomes a one-at-a-time picture task/i);
  });
});
