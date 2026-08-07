/**
 * The shared biology band resolver — reader-fit sweep item 15B (S9/S13/S14/S15).
 *
 * Four biology generators had independently written the same broken lookup:
 *
 *   const gradeBand = config.gradeBand || gradeBandMap[ctx.gradeContext] || '3-5';
 *
 * with the map keyed on bare grade TOKENS but indexed with PROSE. It missed on
 * every input at every grade, so the '3-5' default always won. Verified by
 * probe at `grade=K` on classification-sorter (3 categories against a K-2 rung
 * reading "Binary sorts only") and on life-cycle-sequencer.
 *
 * These tests pin the shared module so the four call sites cannot re-diverge.
 */
import { describe, it, expect } from 'vitest';
import { biologyBandFromGrade, biologyBandFromProse, resolveBiologyBand } from './gradeBand';

describe('biologyBandFromGrade — canonical grade wins', () => {
  it('sends Kindergarten to the K-2 rung', () => {
    expect(biologyBandFromGrade('K')).toBe('K-2');
    expect(biologyBandFromGrade('k')).toBe('K-2');
    expect(biologyBandFromGrade('kindergarten')).toBe('K-2');
    expect(biologyBandFromGrade('preschool')).toBe('K-2');
  });

  it('maps each numeric grade to its real band', () => {
    expect(biologyBandFromGrade('1')).toBe('K-2');
    expect(biologyBandFromGrade('2')).toBe('K-2');
    expect(biologyBandFromGrade('3')).toBe('3-5');
    expect(biologyBandFromGrade('5')).toBe('3-5');
    expect(biologyBandFromGrade('6')).toBe('6-8');
    expect(biologyBandFromGrade('8')).toBe('6-8');
  });

  it('passes an explicit band token straight through', () => {
    expect(biologyBandFromGrade('K-2')).toBe('K-2');
    expect(biologyBandFromGrade('3-5')).toBe('3-5');
    expect(biologyBandFromGrade('6-8')).toBe('6-8');
  });

  it('abstains (null) without a canonical grade so the prose fallback stands', () => {
    expect(biologyBandFromGrade(undefined)).toBeNull();
    expect(biologyBandFromGrade('')).toBeNull();
    expect(biologyBandFromGrade('nonsense')).toBeNull();
  });

  it('NEVER sends a K-2 grade to the 3-5 default — the exact bite', () => {
    for (const g of ['K', 'k', 'kindergarten', 'preschool', '1', '2']) {
      expect(biologyBandFromGrade(g)).toBe('K-2');
    }
  });
});

describe('biologyBandFromProse — the kept fallback, which actually parses prose', () => {
  it('reads the real ctx.gradeContext shapes the old map could never match', () => {
    expect(biologyBandFromProse('kindergarten students - Use age-appropriate language'))
      .toBe('K-2');
    expect(biologyBandFromProse('grade 4 students, elementary')).toBe('3-5');
    expect(biologyBandFromProse('grade 7 students, middle school')).toBe('6-8');
  });

  it('defaults to 3-5 only when the prose genuinely says nothing', () => {
    expect(biologyBandFromProse('')).toBe('3-5');
    expect(biologyBandFromProse(undefined)).toBe('3-5');
  });
});

describe('resolveBiologyBand — precedence', () => {
  it('an explicit config override wins over everything', () => {
    expect(resolveBiologyBand('6-8', 'K', 'kindergarten students')).toBe('6-8');
  });

  it('canonical grade beats prose', () => {
    // The real failure mode: prose says elementary, the objective says K.
    expect(resolveBiologyBand(undefined, 'K', 'elementary students (grades 1-5)'))
      .toBe('K-2');
  });

  it('falls back to prose when there is no canonical grade', () => {
    expect(resolveBiologyBand(undefined, undefined, 'kindergarten students')).toBe('K-2');
  });

  it('reproduces the pre-fix bug ONLY if prose were used as a key (it is not)', () => {
    // Guard against a regression to map-lookup semantics: a prose string must
    // never silently produce the default while a canonical grade is available.
    const prose = 'kindergarten students - Use age-appropriate language and concrete examples';
    expect(resolveBiologyBand(undefined, 'K', prose)).not.toBe('3-5');
    expect(resolveBiologyBand(undefined, undefined, prose)).not.toBe('3-5');
  });
});
