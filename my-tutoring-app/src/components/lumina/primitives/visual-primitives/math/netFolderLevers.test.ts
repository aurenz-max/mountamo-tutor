/**
 * net-folder levers on every mode: the leak rules over every lever's words and facts, the easier-item builders over
 * every item the generator can build, and "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { NetFolderChallenge } from './NetFolder';
import { NET_MISSES_BY_MODE, matchItem, matchTarget, netFolds, surfaceTotal, validItem, type NetFolderMode } from './netFolderWorkspace';
import { CROSS_NET, INVALID_CUBE_NETS, VALID_CUBE_NETS, cellsOf, shapeKey, type Cell } from './netFolderGeometry';
import {
  EASIER_NET, FAMILY_MODEL, SEE_THROUGH, SMALLER_BOX, TWO_CHOICES, isPracticeNet, leverFacts, leverTextLeaks, netLevers,
  practiceLeaks, simplerNet, solidOf, thirdLabelCell,
} from './netFolderLevers';
import { countsOf, itemSolid } from './netFolderWorkspace';

const SOLIDS = ['cube', 'rectangular_prism', 'triangular_prism', 'square_pyramid', 'triangular_pyramid'];
const counts: NetFolderChallenge[] = SOLIDS.map(s => ({ id: `k-${s}`, type: 'count_faces_edges_vertices', instruction: 'Count.',
  targetAnswer: 'check-solid', hint: '', narration: '', solid: solidOf(s) }));
const identifies: NetFolderChallenge[] = SOLIDS.map(s => ({ id: `i-${s}`, type: 'identify_solid', instruction: 'Name it.',
  targetAnswer: s, options: [s, ...SOLIDS.filter(x => x !== s).slice(0, 3)], hint: '', narration: '', solid: solidOf(s) }));
/** Every match item the generator can build: each net, each root, each square beside it, each other square. */
const matches: NetFolderChallenge[] = VALID_CUBE_NETS.flatMap((art, n) => {
  const cells = cellsOf(art);
  return cells.flatMap((rc, root) => cells.map((_, a) => a)
    .filter(a => Math.abs(cells[a][0] - rc[0]) + Math.abs(cells[a][1] - rc[1]) === 1)
    .flatMap(anchor => cells.map((_, h) => matchItem(`m${n}-${root}-${anchor}-${h}`, cells, root, anchor, h))))
    .filter((c): c is NetFolderChallenge => !!c);
});
const valids: NetFolderChallenge[] = [...VALID_CUBE_NETS, ...INVALID_CUBE_NETS].map((art, i) => validItem(`v${i}`, cellsOf(art)));
const box = (l: number, w: number, h: number): NetFolderChallenge => ({ id: `s${l}${w}${h}`, type: 'surface_area', instruction: 'Add the faces.',
  targetAnswer: 2 * (l * w + l * h + w * h), hint: '', narration: '', unitLabel: 'square units',
  faceDimensions: [{ width: l, height: w }, { width: l, height: w }, { width: l, height: h }, { width: l, height: h },
    { width: w, height: h }, { width: w, height: h }] });
const surfaces: NetFolderChallenge[] = [];
for (let l = 1; l <= 10; l++) for (let w = 1; w <= l; w++) for (let h = 1; h <= w; h++) surfaces.push(box(l, w, h));
const SESSION = solidOf('cube');
const ALL = [...counts, ...identifies, ...matches, ...valids, ...surfaces];
const solidFor = (c: NetFolderChallenge) => itemSolid(SESSION, c);
const levers = (c: NetFolderChallenge, pulled: string[] = [], foldGuidesShown = false) =>
  netLevers(c, pulled, { solid: solidFor(c), foldGuidesShown });

describe('leak rules', () => {
  it('no lever word, caption fact or refusal names the item\'s answer, on every item of every mode', () => {
    for (const c of ALL) {
      const ls = levers(c);
      for (const l of ls) expect(leverTextLeaks(c, `${l.when} ${l.does}`), `${c.id} ${l.id}`).toBe(false);
      expect(leverTextLeaks(c, leverFacts(c, ls.map(l => l.id))), c.id).toBe(false);
    }
  });
  it('third_label never names the yellow square or its face, and leaves at least three options unnamed', () => {
    for (const c of matches) {
      const cell = thirdLabelCell(c);
      expect(cell, c.id).not.toBeNull();
      expect(cell).not.toBe(c.highlightCell);
      expect(c.anchorCells).not.toContain(cell);
      const named = new Set([...(c.anchorCells ?? []), cell!].map(i => matchItemFace(c, i)));
      expect(named.has(matchTarget(c))).toBe(false);
      expect((c.faceOptions ?? []).filter(o => !named.has(o)).length).toBeGreaterThanOrEqual(3);
    }
  });
  it('the family model never draws the item\'s solid', async () => {
    const { familyModelSolids } = await import('./netFolderLevers');
    for (const s of SOLIDS) expect(familyModelSolids(s)).not.toContain(s);
  });
  it('the valid model net is never the item\'s shape', async () => {
    const { validModelNet } = await import('./netFolderLevers');
    for (const c of valids) expect(shapeKey(validModelNet(c.netCells as Cell[]))).not.toBe(shapeKey(c.netCells as Cell[]));
  });
});

function matchItemFace(c: NetFolderChallenge, i: number): string {
  return matchTarget({ ...c, highlightCell: i });
}

describe('easier items', () => {
  it('every one keeps the mode, has its own id, is never the item\'s answer, and is not offered twice', () => {
    for (const c of ALL) {
      const s = simplerNet(c, solidFor(c));
      if (!s) continue;
      expect(s.type, c.id).toBe(c.type);
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(isPracticeNet(s)).toBe(true);
      expect(practiceLeaks(c, solidFor(c), s), c.id).toBe(false);
      expect(simplerNet(s, solidFor(s))).toBeNull();
    }
  });
  it('count: a solid with fewer faces, edges and vertices, none for the triangular pyramid', () => {
    for (const c of counts) {
      const s = simplerNet(c, solidFor(c));
      if (c.solid!.type === 'triangular_pyramid') { expect(s).toBeNull(); continue; }
      const [a, b] = [countsOf(solidFor(c)), countsOf(solidFor(s!))];
      expect(b.faces < a.faces && b.edges < a.edges && b.vertices < a.vertices, c.id).toBe(true);
    }
  });
  it('identify: another solid between two names, neither the item\'s', () => {
    for (const c of identifies) {
      const s = simplerNet(c, solidFor(c))!;
      expect(s.options).toHaveLength(2);
      expect(s.options).toContain(s.targetAnswer);
      expect(s.options).not.toContain(c.targetAnswer);
      expect(s.solid!.type).toBe(s.targetAnswer);
    }
  });
  it('match: the cross, the yellow square beside the front, another face; none when the item is already that', () => {
    let none = 0;
    for (const c of matches) {
      const s = simplerNet(c, solidFor(c));
      if (!s) { none++; expect(shapeKey(c.netCells as Cell[])).toBe(shapeKey(cellsOf(CROSS_NET))); continue; }
      expect(shapeKey(s.netCells as Cell[])).toBe(shapeKey(cellsOf(CROSS_NET)));
      expect(matchTarget(s)).not.toBe(matchTarget(c));
    }
    expect(none).toBeGreaterThan(0);
  });
  it('valid: the cross or a strip of six, never the item\'s shape, chosen without reading the item\'s verdict', () => {
    const verdicts = new Map<boolean, Set<boolean>>();
    for (const c of valids) {
      const s = simplerNet(c, solidFor(c))!;
      expect([shapeKey(cellsOf(CROSS_NET)), shapeKey(cellsOf('XXXXXX'))]).toContain(shapeKey(s.netCells as Cell[]));
      if (!verdicts.has(netFolds(c))) verdicts.set(netFolds(c), new Set());
      verdicts.get(netFolds(c))!.add(netFolds(s));
    }
    // Both verdicts of practice follow items of either verdict: the practice says nothing about the item.
    expect(verdicts.get(true)!.size).toBe(2);
    expect(verdicts.get(false)!.size).toBe(2);
  });
  it('surface: a smaller box with another total', () => {
    for (const c of surfaces) {
      const s = simplerNet(c, solidFor(c));
      if (!s) continue;
      expect(surfaceTotal(s)).not.toBe(surfaceTotal(c));
      expect(surfaceTotal(s)).toBeLessThanOrEqual(24);
    }
    expect(surfaces.filter(c => !simplerNet(c, solidFor(c))).length).toBe(0);
  });
});

describe('this wrong answer, then this lever', () => {
  const first: Record<NetFolderMode, Record<string, string>> = {
    count_faces_edges_vertices: { swapped_counts: 'part_names', faces_off: SEE_THROUGH, edges_off: SEE_THROUGH, vertices_off: SEE_THROUGH,
      several_off: SEE_THROUGH },
    identify_solid: { prism_pyramid: 'base_outline', base_shape: 'base_outline', curved_solid: 'base_outline' },
    match_faces: { opposite_face: 'fold_guides', adjacent_face: 'fold_guides' },
    valid_net: { missed_overlap: 'fold_guides', missed_count: 'six_faces_model', rejected_valid: 'fold_guides' },
    surface_area: { half_the_faces: 'match_list', missed_a_face: 'match_list', extra_face: 'match_list', one_face: 'match_list',
      volume: 'area_vs_volume', other_total: 'match_list' },
  };
  const sample: Record<NetFolderMode, NetFolderChallenge> = {
    count_faces_edges_vertices: counts[3], identify_solid: identifies[2], match_faces: matches[3], valid_net: valids[12], surface_area: box(4, 3, 2),
  };
  it.each(Object.keys(first) as NetFolderMode[])('%s: every catalog miss has a first lever', mode => {
    expect(Object.keys(first[mode]).sort()).toEqual([...NET_MISSES_BY_MODE[mode]].sort());
    for (const [miss, lever] of Object.entries(first[mode])) expect(nextLever(levers(sample[mode]), miss), `${mode} ${miss}`).toBe(lever);
  });
  it('with the tier\'s fold lines already drawn, a match or valid miss goes to the next lever', () => {
    expect(nextLever(levers(sample.match_faces, [], true), 'opposite_face')).toBe('opposite_rule');
    expect(nextLever(levers(sample.valid_net, [], true), 'rejected_valid')).toBe('valid_model');
  });
  it('every mode offers a simplify lever on the items the generator builds', () => {
    expect(levers(counts[0]).map(l => l.id)).toContain('smaller_solid');
    expect(levers(identifies[0]).map(l => l.id)).toContain(TWO_CHOICES);
    expect(levers(valids[0]).map(l => l.id)).toContain(EASIER_NET);
    expect(levers(box(4, 3, 2)).map(l => l.id)).toContain(SMALLER_BOX);
    expect(levers(identifies[0]).map(l => l.id)).toContain(FAMILY_MODEL);
  });
  it('every catalog miss of every mode is answered by a lever on every item (J12 on the builders)', () => {
    const declared = getComponentById('net-folder')!.teachingWorkspace!.misses!;
    for (const c of ALL) {
      const answered = new Set(levers(c).flatMap(l => l.answers ?? []));
      for (const miss of declared[c.type] ?? []) expect(answered.has(miss), `${c.id} ${miss}`).toBe(true);
    }
  });
});
