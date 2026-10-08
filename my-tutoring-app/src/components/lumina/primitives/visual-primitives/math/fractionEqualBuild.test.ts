import { describe, expect, it } from 'vitest';
import type { FractionCirclesChallenge } from './FractionCircles';
import {
  cutInto, equalBuildMiss, equalTargets, equalWays, halvePiece, makesEqual, readBuild, smallerTarget, toggleShade, wholeCircle,
  type Piece,
} from './fractionEqualBuild';
import { fractionLevers, leverFacts, leverTextLeaks, simplerItem, startLevers } from './fractionCirclesLevers';
import { describeWork, workspaceAssignment, workspaceScene } from './fractionCirclesWorkspace';

const item = (numerator: number, denominator: number): FractionCirclesChallenge => ({ id: 'q', type: 'build_equal', numerator,
  denominator, instruction: `Make a fraction equal to ${numerator}/${denominator}.`, hint: '', narration: '' });
const shade = (pieces: Piece[], n: number) => pieces.map((p, i) => ({ ...p, shaded: i < n }));
const build = (pieces: number, shaded: number) => readBuild(shade(cutInto(pieces), shaded));

describe('build_equal judgment', () => {
  it('passes any equal cut but the target\'s own: 1/2 as 2/4, 3/6, 4/8; 3/4 as 6/8, 9/12', () => {
    for (const [n, d] of [[2, 4], [3, 6], [4, 8], [5, 10]]) expect(makesEqual(item(1, 2), build(d, n))).toBe(true);
    expect(makesEqual(item(3, 4), build(8, 6))).toBe(true);
    expect(makesEqual(item(3, 4), build(12, 9))).toBe(true);
    expect(makesEqual(item(2, 4), build(2, 1))).toBe(true);
    expect(equalBuildMiss(item(1, 2), build(2, 1))).toBe('same_pieces');
  });

  it('names each miss from the learner\'s circle', () => {
    expect(equalBuildMiss(item(1, 2), build(4, 3))).toBe('one_off');
    expect(equalBuildMiss(item(1, 4), build(8, 5))).toBe('off_by_more');
    expect(equalBuildMiss(item(3, 4), build(8, 2))).toBe('shaded_the_rest');
    expect(equalBuildMiss(item(3, 4), build(6, 4))).toBe('cut_cannot_make');
    // Fourths, one fourth halved: five pieces, not all the same size, though a half of the area is shaded.
    const unequal = halvePiece(cutInto(4), 0)!;
    expect(readBuild(unequal)).toEqual({ pieces: 5, shaded: 0, equal: false });
    expect(equalBuildMiss(item(1, 2), readBuild(shade(unequal, 3)))).toBe('unequal_pieces');
    expect(makesEqual(item(1, 2), readBuild(shade(unequal, 3)))).toBe(false);
  });

  it('halving every piece keeps the pieces equal and the shading, and stops at twelfths', () => {
    let pieces = toggleShade(cutInto(2), 0);
    pieces = halvePiece(pieces, 0)!; pieces = halvePiece(pieces, 2)!;
    expect(readBuild(pieces)).toEqual({ pieces: 4, shaded: 2, equal: true });
    expect(makesEqual(item(1, 2), readBuild(pieces))).toBe(true);
    expect(halvePiece(cutInto(12), 0)).toBeNull();
    expect(halvePiece(wholeCircle(), 0)).toHaveLength(2);
  });

  it('every band target has another way to make it, and never the target\'s own cut', () => {
    for (const band of ['K-2', '3-5']) {
      const targets = equalTargets(band);
      expect(targets.length).toBeGreaterThan(3);
      for (const t of targets) {
        const ways = equalWays(t.numerator, t.denominator, band);
        expect(ways.length).toBeGreaterThan(0);
        for (const w of ways) {
          expect(w.pieces).not.toBe(t.denominator);
          expect(makesEqual(t, build(w.pieces, w.shaded))).toBe(true);
        }
      }
    }
    expect(equalTargets('K-2').every(t => t.denominator <= 4)).toBe(true);
    // 1/8 has no other equal cut of at most twelve pieces.
    expect(equalTargets('3-5').some(t => t.numerator === 1 && t.denominator === 8)).toBe(false);
  });
});

describe('build_equal levers', () => {
  it('start bare at any tier, and every lever names the build and carries no digit', () => {
    expect(startLevers({ ...item(3, 4), showWorkingCount: true })).toEqual([]);
    const levers = fractionLevers(item(3, 4), [], '3-5');
    expect(levers.map(l => [l.id, l.kind])).toEqual([['running_count', 'help'], ['show_reference', 'help'], ['smaller_target', 'simplify']]);
    for (const l of levers) {
      expect(leverTextLeaks(l.when + l.does)).toBe(false);
      expect(l.answers?.length).toBeGreaterThan(0);
    }
    expect(levers.find(l => l.id === 'running_count')!.does).toMatch(/never whether the two are equal/i);
    for (const fact of leverFacts(item(3, 4), ['running_count', 'show_reference'])) expect(leverTextLeaks(fact)).toBe(false);
  });

  it('simplify opens a target with fewer pieces, halves first, never an equal value; none for halves', () => {
    const easier = simplerItem(item(3, 4), '3-5')!;
    expect(easier).toMatchObject({ id: 'q~smaller', type: 'build_equal', numerator: 1, denominator: 2 });
    expect(easier.instruction).toMatch(/equal to 1\/2/);
    expect(smallerTarget(item(2, 4), '3-5')).toMatchObject({ numerator: 1, denominator: 3 });
    expect(smallerTarget(item(1, 2), 'K-2')).toBeNull();
    expect(fractionLevers(item(1, 2), [], 'K-2').map(l => l.id)).not.toContain('smaller_target');
  });
});

describe('build_equal on the workspace', () => {
  it('is a gesture item whose scene carries the made pieces as numbers and no verdict', () => {
    expect(workspaceAssignment(item(3, 4))).toMatchObject({ response: 'gesture' });
    const view = { typed: '', shaded: 6, choice: '' as const, pieces: 8, equalPieces: true };
    const { facts } = workspaceScene(item(3, 4), view);
    expect(facts).toMatchObject({ kind: 'build_equal', printedTarget: '3/4', piecesCut: 8, piecesShaded: 6, pieceSizes: 'all the same size' });
    expect(JSON.stringify(facts)).not.toMatch(/correct|is equal|equivalent to|same amount|6\/8/i);
    expect(describeWork(item(3, 4), { ...view, pieces: 5, equalPieces: false, shaded: 2 }))
      .toBe('Cut the circle into 5 pieces, not all the same size, and shaded 2');
  });
});
