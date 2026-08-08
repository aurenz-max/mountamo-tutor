import { describe, expect, it } from 'vitest';
import {
  buildNonLeakingStrand,
  cleanStrand,
  complementStrand,
  strandLeaksTemplate,
  validateDnaExplorerData,
} from './gemini-dna-explorer';
import { dnaExplorerOracle } from '../qa/oracles/dna-explorer';
import type { DnaExplorerData } from '../../primitives/visual-primitives/biology/DnaExplorer';

/**
 * Answer-contract regression for DNA-1.
 *
 * Fixtures are UNMUTATED payload shapes from the 2026-08-08 pre-fix probe
 * (20 real generations, 13 leaking). The leak that actually shipped was not the
 * exact-equality form the tracker described but the partial one: `givenStrand`
 * "ATCG" against a displayed template of "ATCGGATA", whose complement
 * "TAGCCTAT" is printed directly under it on the Explore tab.
 */

const rand = () => 0.42; // deterministic; the repair must not depend on luck

/** Everything the contract does not touch, so the fixtures stay readable. */
const shell = {
  title: 'DNA Detective',
  description: 'Explore the double helix.',
  mode: 'base-pairing' as const,
  nucleotides: [],
  structuralFeatures: { sugarPhosphateBackbone: 'The backbone.', antiparallelOrientation: 'Opposite ways.' },
  zoomLevels: [],
  centralDogmaStep: 'none' as const,
  gradeBand: '5-6' as const,
};

/** Run 2 of the pre-fix probe, verbatim: challenge #1 is a prefix of the template. */
const leakySoft: DnaExplorerData = {
  ...shell,
  sequence: { templateStrand: 'ATCGGATA', complementaryStrand: 'TAGCCTAT' },
  buildChallenges: [
    { givenStrand: 'ATCG', task: 'Complete the complementary strand.', correctAnswer: 'TAGC' },
    { givenStrand: 'GCAT', task: 'Now try this one.', correctAnswer: 'CGTA' },
  ],
};

/** Run 7 of probe B, verbatim: challenge #3 IS the displayed template. */
const leakyHard: DnaExplorerData = {
  ...shell,
  sequence: { templateStrand: 'ATCGGATA', complementaryStrand: 'TAGCCTAT' },
  buildChallenges: [
    { givenStrand: 'ATCG', task: 'Pair the bases.', correctAnswer: 'TAGC' },
    { givenStrand: 'GCTA', task: 'Keep going.', correctAnswer: 'CGAT' },
    { givenStrand: 'ATCGGATA', task: 'Final challenge.', correctAnswer: 'TAGCCTAT' },
  ],
};

/**
 * Run B3 — the ONE generation of 20 that was clean. Must survive untouched.
 *
 * Note what the near-miss runs looked like: `CGATCG` against a template of
 * `ATCGTTA` reads as a fresh strand but carries `ATCG` in the middle, so it
 * leaked too. Whole-strand comparison finds neither; only the run check does.
 */
const clean: DnaExplorerData = {
  ...shell,
  sequence: { templateStrand: 'ATCGGATA', complementaryStrand: 'TAGCCTAT' },
  buildChallenges: [
    { givenStrand: 'AATTCCGG', task: 'Complete the complementary strand.', correctAnswer: 'TTAAGGCC' },
    { givenStrand: 'GCATGCAT', task: 'Try a longer one.', correctAnswer: 'CGTACGTA' },
  ],
};

// ---------------------------------------------------------------------------
// The predicate
// ---------------------------------------------------------------------------

describe('strandLeaksTemplate', () => {
  it('flags the live partial leak — a 4-base prefix of the displayed template', () => {
    expect(strandLeaksTemplate('ATCG', 'ATCGGATA')).toBe(true);
  });

  it('flags the live exact leak', () => {
    expect(strandLeaksTemplate('ATCGGATA', 'ATCGGATA')).toBe(true);
  });

  it('flags a run read backwards off the display', () => {
    expect(strandLeaksTemplate('GCTA', 'ATCGGATA')).toBe(true); // "ATCG" reversed
  });

  it('flags an INTERIOR run — the form whole-strand comparison misses entirely', () => {
    // Probe run A1: reads as a fresh strand, carries "ATCG" at offset 2.
    expect(strandLeaksTemplate('CGATCG', 'ATCGTTA')).toBe(true);
  });

  it('lets a genuinely new strand through', () => {
    expect(strandLeaksTemplate('AATTCCGG', 'ATCGGATA')).toBe(false);
    expect(strandLeaksTemplate('GCATGCAT', 'ATCGGATA')).toBe(false);
  });

  it('ignores 3-base coincidences — chance, not a leak', () => {
    expect(strandLeaksTemplate('ATCTTTT', 'ATCGGATA')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The repair
// ---------------------------------------------------------------------------

describe('buildNonLeakingStrand', () => {
  it('produces a strand of the requested length that does not leak', () => {
    const s = buildNonLeakingStrand('ATCG', 'ATCGGATA', 6, rand);
    expect(s).toHaveLength(6);
    expect(strandLeaksTemplate(s, 'ATCGGATA')).toBe(false);
    expect(cleanStrand(s)).toBe(s);
  });

  it('keeps a clean strand byte-identical instead of churning content', () => {
    expect(buildNonLeakingStrand('AATTCCGG', 'ATCGGATA', 8, rand)).toBe('AATTCCGG');
  });

  it('never reuses a strand another challenge already took', () => {
    const first = buildNonLeakingStrand('ATCG', 'ATCGGATA', 6, rand);
    const second = buildNonLeakingStrand('ATCG', 'ATCGGATA', 6, rand, new Set([first]));
    expect(second).not.toBe(first);
    expect(strandLeaksTemplate(second, 'ATCGGATA')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// End to end, over the real pre-fix generations
// ---------------------------------------------------------------------------

describe('validateDnaExplorerData — real 2026-08-08 generations', () => {
  const expectContractHeld = (out: DnaExplorerData) => {
    const { templateStrand, complementaryStrand } = out.sequence;
    // Biology first: the displayed pair is a true complement.
    expect(complementaryStrand).toBe(complementStrand(templateStrand));
    const seen = new Set<string>();
    for (const c of out.buildChallenges) {
      expect(c.givenStrand).toMatch(/^[ATCG]+$/);
      expect(c.correctAnswer).toBe(complementStrand(c.givenStrand));
      expect(c.correctAnswer).toHaveLength(c.givenStrand.length);
      expect(strandLeaksTemplate(c.givenStrand, templateStrand)).toBe(false);
      // The answer must be as unreadable as the prompt — complementing is a
      // bijection, so this is the same claim from the student's side.
      expect(strandLeaksTemplate(c.correctAnswer, complementaryStrand)).toBe(false);
      expect(seen.has(c.givenStrand)).toBe(false);
      seen.add(c.givenStrand);
    }
    // The oracle re-derives all of this from the pairing rules, independently.
    const oracleCtx = {
      componentId: 'dna-explorer',
      evalMode: 'base_pairing',
      topic: 'DNA structure and base pairing',
      gradeLevel: 'middle',
    };
    expect(
      dnaExplorerOracle.verify(out as unknown as Record<string, unknown>, oracleCtx).violations,
    ).toEqual([]);
  };

  it('repairs the partial leak that shipped in 12 of 20 generations', () => {
    const { data, repairs } = validateDnaExplorerData(leakySoft);
    expect(repairs.strands).toBeGreaterThan(0);
    expectContractHeld(data);
  });

  it('repairs the exact-equality leak the tracker described', () => {
    const { data } = validateDnaExplorerData(leakyHard);
    expect(data.buildChallenges.some((c) => c.givenStrand === 'ATCGGATA')).toBe(false);
    expectContractHeld(data);
  });

  it('ships the one clean generation of 20 untouched', () => {
    const { data, repairs } = validateDnaExplorerData(clean);
    expect(repairs).toEqual({ strands: 0, keys: 0, tasks: 0, added: 0 });
    expect(data.buildChallenges.map((c) => c.givenStrand)).toEqual(['AATTCCGG', 'GCATGCAT']);
    expectContractHeld(data);
  });

  it('rebuilds a desynced key rather than marking a correct student wrong', () => {
    const desynced = {
      ...clean,
      buildChallenges: [
        { ...clean.buildChallenges[0], correctAnswer: 'TTAAGGCG' }, // one base wrong
        clean.buildChallenges[1],
      ],
    };
    const { data, repairs } = validateDnaExplorerData(desynced);
    expect(repairs.keys).toBe(1);
    expect(data.buildChallenges[0].correctAnswer).toBe('TTAAGGCC');
    expectContractHeld(data);
  });

  it('strips blanks from a strand instead of rendering "?" boxes with no key', () => {
    const blanked = {
      ...clean,
      buildChallenges: [
        { givenStrand: 'AT_G__', task: 'Fill in the blanks.', correctAnswer: 'TA?C??' },
        clean.buildChallenges[1],
      ],
    };
    const { data } = validateDnaExplorerData(blanked);
    expectContractHeld(data);
  });

  it('backfills to the mastery floor when the model ships one challenge', () => {
    const thin = { ...clean, buildChallenges: [clean.buildChallenges[0]] };
    const { data, repairs } = validateDnaExplorerData(thin);
    expect(data.buildChallenges.length).toBeGreaterThanOrEqual(2);
    expect(repairs.added).toBeGreaterThan(0);
    expectContractHeld(data);
  });

  it('replaces task text that quotes the key or promises an mRNA the grader rejects', () => {
    const talky = {
      ...clean,
      buildChallenges: [
        { ...clean.buildChallenges[0], task: 'The answer is TTAAGGCC — type it in.' },
        { ...clean.buildChallenges[1], task: 'Write the mRNA transcript for this strand.' },
      ],
    };
    const { data, repairs } = validateDnaExplorerData(talky);
    expect(repairs.tasks).toBe(2);
    expect(data.buildChallenges[0].task).not.toContain('TTAAGGCC');
    expect(data.buildChallenges[1].task).not.toMatch(/mRNA/i);
    expectContractHeld(data);
  });

  it('holds the contract at the 7-8 band, where strands run 6-12 bases', () => {
    const senior = { ...leakyHard, gradeBand: '7-8' as const };
    const { data } = validateDnaExplorerData(senior);
    expect(data.buildChallenges.length).toBeGreaterThanOrEqual(3);
    for (const c of data.buildChallenges) {
      expect(c.givenStrand.length).toBeGreaterThanOrEqual(6);
      expect(c.givenStrand.length).toBeLessThanOrEqual(12);
    }
    expectContractHeld(data);
  });
});
