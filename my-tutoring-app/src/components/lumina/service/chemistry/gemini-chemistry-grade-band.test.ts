/**
 * Canonical-grade band mappers — 14m sweep across the 11 chemistry generators.
 *
 * The prose resolvers stay as fallbacks (never deleted); these tests pin each
 * mapper's ladder, the clamps at both ends, and the null-without-a-grade rule
 * that keeps every prose fallback reachable. The bites this closes (verified
 * against the literal production prose):
 *   • safety-lab: kindergarten prose "(ages 5-6)" contains a '6' → K landed 6-8.
 *   • mixing-and-dissolving / atom-builder / molecule-constructor: same '6'
 *     trap → K landed the middle band.
 *   • states-of-matter / reaction-lab / safety-lab: "grades 1-5" matches no
 *     K-2 marker → published G1/G2 lessons landed 3-5.
 *   • gas-laws / stoichiometry: high-school prose matched '12'/"high school"
 *     → every high-school lesson landed 11-12, grade 9 included.
 * Wiring is exercised at runtime via /eval-test probes (see the sweep report).
 */

import { describe, expect, it } from 'vitest';
import { statesOfMatterGradeBandFromGrade } from './gemini-states-of-matter';
import { reactionLabGradeBandFromGrade } from './gemini-reaction-lab';
import { safetyLabGradeBandFromGrade } from './gemini-safety-lab';
import { mixingAndDissolvingGradeBandFromGrade } from './gemini-mixing-and-dissolving';
import { atomBuilderGradeBandFromGrade } from './gemini-atom-builder';
import { moleculeConstructorGradeBandFromGrade } from './gemini-molecule-constructor';
import { phExplorerGradeBandFromGrade } from './gemini-ph-explorer';
import { equationBalancerGradeBandFromGrade } from './gemini-equation-balancer';
import { energyOfReactionsGradeBandFromGrade } from './gemini-energy-of-reactions';
import { gasLawsGradeBandFromGrade } from './gemini-gas-laws-simulator';
import { stoichiometryLabGradeBandFromGrade } from './gemini-stoichiometry-lab';
import { matterExplorerGradeBandFromGrade } from './gemini-matter-explorer';

describe('chemistry canonical grade-band mappers (14m)', () => {
  it('states-of-matter: K/1/2 → K-2 (the published-band bite), 3+ → 3-5', () => {
    expect(statesOfMatterGradeBandFromGrade('K')).toBe('K-2');
    expect(statesOfMatterGradeBandFromGrade('1')).toBe('K-2');
    expect(statesOfMatterGradeBandFromGrade('2')).toBe('K-2');
    expect(statesOfMatterGradeBandFromGrade('3')).toBe('3-5');
    expect(statesOfMatterGradeBandFromGrade('8')).toBe('3-5');
  });

  it('reaction-lab: K-2 / 3-5 / 6-8 rungs with both clamps', () => {
    expect(reactionLabGradeBandFromGrade('K')).toBe('K-2');
    expect(reactionLabGradeBandFromGrade('2')).toBe('K-2');
    expect(reactionLabGradeBandFromGrade('3')).toBe('3-5');
    expect(reactionLabGradeBandFromGrade('5')).toBe('3-5');
    expect(reactionLabGradeBandFromGrade('6')).toBe('6-8');
    expect(reactionLabGradeBandFromGrade('12')).toBe('6-8');
  });

  it('safety-lab: a canonical K lands K-2 — the "(ages 5-6)" prose sent it to 6-8', () => {
    expect(safetyLabGradeBandFromGrade('K')).toBe('K-2');
    expect(safetyLabGradeBandFromGrade('1')).toBe('K-2');
    expect(safetyLabGradeBandFromGrade('4')).toBe('3-5');
    expect(safetyLabGradeBandFromGrade('7')).toBe('6-8');
  });

  it('mixing-and-dissolving: K clamps to the 3-5 floor, 6+ → 6-7', () => {
    expect(mixingAndDissolvingGradeBandFromGrade('K')).toBe('3-5');
    expect(mixingAndDissolvingGradeBandFromGrade('4')).toBe('3-5');
    expect(mixingAndDissolvingGradeBandFromGrade('6')).toBe('6-7');
    expect(mixingAndDissolvingGradeBandFromGrade('9')).toBe('6-7');
  });

  it('atom-builder + molecule-constructor: ≤5 → 3-5 (K clamps to floor), 6+ → 6-8', () => {
    for (const mapper of [atomBuilderGradeBandFromGrade, moleculeConstructorGradeBandFromGrade]) {
      expect(mapper('K')).toBe('3-5');
      expect(mapper('5')).toBe('3-5');
      expect(mapper('6')).toBe('6-8');
      expect(mapper('11')).toBe('6-8');
    }
  });

  it('ph-explorer / equation-balancer / energy-of-reactions: two-rung ladders split at their legacy boundary', () => {
    expect(phExplorerGradeBandFromGrade('6')).toBe('4-6');
    expect(phExplorerGradeBandFromGrade('7')).toBe('7-8');
    expect(equationBalancerGradeBandFromGrade('7')).toBe('6-7');
    expect(equationBalancerGradeBandFromGrade('8')).toBe('7-8');
    expect(energyOfReactionsGradeBandFromGrade('6')).toBe('5-6');
    expect(energyOfReactionsGradeBandFromGrade('7')).toBe('7-8');
  });

  it('gas-laws + stoichiometry: grade 9 lands 9-10, not the 11-12 the prose forced', () => {
    for (const mapper of [gasLawsGradeBandFromGrade, stoichiometryLabGradeBandFromGrade]) {
      expect(mapper('8')).toBe('8');
      expect(mapper('9')).toBe('9-10');
      expect(mapper('10')).toBe('9-10');
      expect(mapper('11')).toBe('11-12');
      expect(mapper('12')).toBe('11-12');
    }
  });

  it('matter-explorer (found during the sweep): K/1 → K-1, 2+ → 1-2', () => {
    expect(matterExplorerGradeBandFromGrade('K')).toBe('K-1');
    expect(matterExplorerGradeBandFromGrade('1')).toBe('K-1');
    expect(matterExplorerGradeBandFromGrade('2')).toBe('1-2');
    expect(matterExplorerGradeBandFromGrade('5')).toBe('1-2');
  });

  it('every mapper returns null without a canonical grade — prose fallbacks stay reachable', () => {
    const mappers = [
      statesOfMatterGradeBandFromGrade, reactionLabGradeBandFromGrade,
      safetyLabGradeBandFromGrade, mixingAndDissolvingGradeBandFromGrade,
      atomBuilderGradeBandFromGrade, moleculeConstructorGradeBandFromGrade,
      phExplorerGradeBandFromGrade, equationBalancerGradeBandFromGrade,
      energyOfReactionsGradeBandFromGrade, gasLawsGradeBandFromGrade,
      stoichiometryLabGradeBandFromGrade, matterExplorerGradeBandFromGrade,
    ];
    for (const mapper of mappers) {
      expect(mapper(undefined)).toBeNull();
      expect(mapper('')).toBeNull();
      expect(mapper('not-a-grade')).toBeNull();
    }
  });
});
