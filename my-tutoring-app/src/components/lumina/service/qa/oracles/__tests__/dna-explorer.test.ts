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
    { givenStrand: 'GCATGC', task: 'Match each base with its partner.', correctAnswer: 'CGTACG' },
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
    // GCATGC complements to CGTACG; ship the wrong key (one base off).
    const data = {
      ...clean,
      buildChallenges: [
        clean.buildChallenges[0],
        { givenStrand: 'GCATGC', task: 'Match each base.', correctAnswer: 'CGTACA' },
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
