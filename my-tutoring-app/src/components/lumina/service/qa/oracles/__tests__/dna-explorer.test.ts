import { describe, expect, it } from 'vitest';
import { dnaExplorerOracle } from '../dna-explorer';

/**
 * Seeded-violation tests for the dna-explorer oracle. The clean fixture is
 * trimmed verbatim from a real /api/lumina/eval-test run (componentId=dna-explorer,
 * evalMode=base-pairing, topic "DNA base pairing"). Each mutation exercises one
 * check class the oracle must fire on. An oracle that never fires is decoration.
 */

const ctx = {
  componentId: 'dna-explorer',
  evalMode: 'base-pairing',
  topic: 'DNA base pairing',
  gradeLevel: 'middle',
};

// Real generation: templateStrand ATGCGT ↔ TACGCA; both challenges correctly paired.
//
// Challenge #2 was `GCATGC` when this fixture was captured, and the oracle
// called it clean — `GCATGC` is not EQUAL to `ATGCGT`, which was the whole
// leak test at the time. It shares the run `ATGC` with it, so four of its six
// answer bases were printed on the Explore tab. Re-pointed at `TTAACG` (2026-08-08,
// DNA-1) once the oracle learned to see partial overlap; the leak it used to
// carry is now its own regression case below.
const clean = {
  title: 'The DNA Puzzle: Matching the Bases',
  description: 'Explore how DNA acts like a twisted ladder.',
  mode: 'base-pairing',
  sequence: {
    templateStrand: 'ATGCGT',
    complementaryStrand: 'TACGCA',
    highlightedRegion: { start: 0, end: 2, label: 'A gene' },
  },
  nucleotides: [
    { base: 'A', fullName: 'Adenine', type: 'purine', pairsWith: 'T', color: '#e11d48', bondType: '2 hydrogen bonds' },
    { base: 'T', fullName: 'Thymine', type: 'pyrimidine', pairsWith: 'A', color: '#f59e0b', bondType: '2 hydrogen bonds' },
    { base: 'C', fullName: 'Cytosine', type: 'pyrimidine', pairsWith: 'G', color: '#22c55e', bondType: '3 hydrogen bonds' },
    { base: 'G', fullName: 'Guanine', type: 'purine', pairsWith: 'C', color: '#3b82f6', bondType: '3 hydrogen bonds' },
  ],
  structuralFeatures: {
    sugarPhosphateBackbone: 'The two sturdy side rails of a ladder.',
    antiparallelOrientation: 'The two strands run in opposite directions.',
  },
  zoomLevels: [
    { level: 'chromosome', description: 'The entire DNA strand packed tight.', visibleFeatures: ['Cell nucleus'] },
    { level: 'base-pair', description: 'A, T, C, G lock together.', visibleFeatures: ['Hydrogen bonds'] },
  ],
  centralDogmaStep: 'none',
  buildChallenges: [
    { givenStrand: 'AATTCC', task: 'Complete the complementary strand.', correctAnswer: 'TTAAGG' },
    { givenStrand: 'TTAACG', task: 'Match each base with its partner.', correctAnswer: 'AATTGC' },
  ],
  gradeBand: '5-6',
};

describe('dna-explorer oracle', () => {
  it('passes clean data with zero violations', () => {
    const result = dnaExplorerOracle.verify(clean, ctx);
    expect(result.violations).toEqual([]);
    expect(result.uncheckedTypes).toEqual(['zoomLevels(descriptive text)', 'structuralFeatures(descriptive text)']);
  });

  it('flags answer-key-desync — a build challenge correctAnswer is not the true complement', () => {
    // TTAACG complements to AATTGC; ship the wrong key (one base off).
    const data = {
      ...clean,
      buildChallenges: [
        clean.buildChallenges[0],
        { givenStrand: 'TTAACG', task: 'Match each base.', correctAnswer: 'AATTGA' },
      ],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'buildChallenge#2')).toBe(true);
  });

  it('flags answer-key-desync — complementaryStrand mispairs the template', () => {
    const data = { ...clean, sequence: { ...clean.sequence, complementaryStrand: 'TACGCT' } }; // last base wrong
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'sequence')).toBe(true);
  });

  it('flags answer-key-desync — a nucleotide pairs with the wrong base', () => {
    const data = {
      ...clean,
      nucleotides: [{ ...clean.nucleotides[0], pairsWith: 'G' }, ...clean.nucleotides.slice(1)],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'nucleotide(A)')).toBe(true);
  });

  it('flags answer-key-desync — a nucleotide has the wrong purine/pyrimidine type', () => {
    const data = {
      ...clean,
      nucleotides: [{ ...clean.nucleotides[0], type: 'pyrimidine' }, ...clean.nucleotides.slice(1)],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.detail.includes('purine'))).toBe(true);
  });

  it('flags answer-leak — a build challenge reuses the Explore-tab template strand', () => {
    const data = {
      ...clean,
      buildChallenges: [
        { givenStrand: 'ATGCGT', task: 'Complete the strand.', correctAnswer: 'TACGCA' }, // == sequence
        clean.buildChallenges[1],
      ],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'buildChallenge#1')).toBe(true);
  });

  it('flags answer-leak — a challenge shares a 4-base run with the displayed template', () => {
    // The form that actually shipped: 19 of 20 generations probed 2026-08-08.
    // `ATCG` against a displayed `ATCGGATA` is not equality, so the pre-DNA-1
    // oracle passed it while the answer sat on screen.
    const data = {
      ...clean,
      buildChallenges: [
        { givenStrand: 'GCATGC', task: 'Complete the strand.', correctAnswer: 'CGTACG' }, // ATGC ⊂ ATGCGT
        clean.buildChallenges[0],
      ],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'buildChallenge#1')).toBe(true);
  });

  it('flags answer-leak — a shared run read backwards off the display', () => {
    const data = {
      ...clean,
      buildChallenges: [
        { givenStrand: 'CGTAAA', task: 'Complete the strand.', correctAnswer: 'GCATTT' }, // CGTA = ATGC reversed
        clean.buildChallenges[0],
      ],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'buildChallenge#1')).toBe(true);
  });

  it('does not fire on a 3-base coincidence — chance, not a leak', () => {
    const data = {
      ...clean,
      buildChallenges: [
        { givenStrand: 'ATGAAA', task: 'Complete the strand.', correctAnswer: 'TACTTT' }, // shares ATG only
        clean.buildChallenges[1],
      ],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.filter((x) => x.check === 'answer-leak')).toEqual([]);
  });

  it('flags answer-leak — the task text spells out the answer', () => {
    const data = {
      ...clean,
      buildChallenges: [
        { givenStrand: 'AATTCC', task: 'The answer is TTAAGG — type it in.', correctAnswer: 'TTAAGG' },
        clean.buildChallenges[1],
      ],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-leak')).toBe(true);
  });

  it('flags schema — givenStrand contains a blank (contract: full A/T/C/G template)', () => {
    const data = {
      ...clean,
      buildChallenges: [
        { givenStrand: 'AAT_CC', task: 'Complete the strand.', correctAnswer: 'TTAAGG' },
        clean.buildChallenges[1],
      ],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'buildChallenge#1')).toBe(true);
  });

  it('flags clustering — every challenge has the same answer', () => {
    const data = {
      ...clean,
      buildChallenges: [
        { givenStrand: 'AATTCC', task: 'Complete.', correctAnswer: 'TTAAGG' },
        { givenStrand: 'AATTCC', task: 'Complete.', correctAnswer: 'TTAAGG' },
        { givenStrand: 'AATTCC', task: 'Complete.', correctAnswer: 'TTAAGG' },
      ],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = {
      ...clean,
      buildChallenges: [{ givenStrand: 'AATTCC', task: 'Complete.', correctAnswer: 'TTAAGG' }],
    };
    const v = dnaExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'buildChallenges')).toBe(true);
  });
});
