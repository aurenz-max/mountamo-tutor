import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { betweenHolds, positionHolds } from '../../../service/math/spatial-scene/resolvePrepositionScope';
import type { SpatialSceneChallenge } from './SpatialScene';
import { placeCellCorrect, spatialMiss } from './spatialSceneWorkspace';
import {
  FEWER_LEVER, MARK_LEVER, PICTURE_LEVER, PICTURE_TEXT, SIDES_FACT, SIDES_LEVER, holds, leverFacts, markCells, markLeaks,
  pictureLeaks, pictureWords, practiceItem, practiceLeaks, practiceParent, spatialSceneLevers, stepAsk,
} from './spatialSceneLevers';

const PAYLOADS = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const payload = (mode: string): SpatialSceneChallenge[] =>
  JSON.parse(readFileSync(join(PAYLOADS, `spatial-scene.${mode}.json`), 'utf8')).data.challenges;
const MODES = ['identify', 'describe', 'place', 'place_in', 'place_between', 'follow_directions', 'describe_scene'];
const ALL = MODES.flatMap(m => payload(m));
const cells = Array.from({ length: 9 }, (_, i) => ({ row: Math.floor(i / 3), col: i % 3 }));
const WORDS = ['above', 'below', 'on', 'under', 'left_of', 'right_of', 'beside', 'next_to', 'in'];

const objs = [
  { name: 'box', image: '📦', position: { row: 1, col: 1 } }, { name: 'ball', image: '⚽', position: { row: 0, col: 1 } },
  { name: 'tree', image: '🌳', position: { row: 2, col: 0 } }, { name: 'cat', image: '🐱', position: { row: 2, col: 2 } },
];
const IDENTIFY: SpatialSceneChallenge = { id: 'i1', type: 'identify', instruction: 'Where is the ball?', sceneObjects: objs,
  targetObject: objs[1], correctPosition: 'above', referenceObjectName: 'box', options: ['below', 'beside', 'above', 'next_to'] };
const PLACE: SpatialSceneChallenge = { id: 'p1', type: 'place', instruction: 'Put the star above the box.', sceneObjects: objs.filter(o => o.name !== 'ball'),
  targetObject: { name: 'star', image: '⭐', position: { row: 0, col: 0 } }, correctPosition: 'above', referenceObjectName: 'box',
  correctCell: { row: 0, col: 1 }, acceptableCells: [{ row: 0, col: 1 }] };

describe('grid truth', () => {
  it('holds is positionHolds on every word and cell pair', () => {
    for (const w of WORDS) for (const t of cells) for (const r of cells) expect(holds(w, t, r)).toBe(positionHolds(w, t, r));
  });
});

describe('place names its miss', () => {
  it.each([
    [{ row: 2, col: 1 }, 'opposite_cell'], [{ row: 1, col: 0 }, 'other_axis_cell'], [{ row: 0, col: 0 }, 'off_line_cell'],
    [{ row: 0, col: 1 }, undefined],
  ])('above the box, tapped %j: %s', (cell, miss) => {
    expect(spatialMiss({ ...PLACE, sceneObjects: [objs[0]] }, { cell })).toBe(miss);
  });
  it('on, two rows up, is the right side at the wrong distance', () => {
    const on = { ...PLACE, correctPosition: 'on' as const, sceneObjects: [{ ...objs[0], position: { row: 2, col: 1 } }],
      correctCell: { row: 1, col: 1 }, acceptableCells: [{ row: 1, col: 1 }] };
    expect(spatialMiss(on, { cell: { row: 0, col: 1 } })).toBe('same_axis_cell');
  });
  it('the catalog lists every place miss', () => {
    expect(getComponentById('spatial-scene')!.teachingWorkspace!.misses!.place)
      .toEqual(['opposite_cell', 'same_axis_cell', 'other_axis_cell', 'off_line_cell']);
  });
});

describe('leak rules', () => {
  it('the ring never goes on place_in (its container is the answer), the target, or an empty or answer cell', () => {
    for (const c of payload('place_in')) expect(spatialSceneLevers(c, []).map(l => l.id)).not.toContain(MARK_LEVER);
    expect(markLeaks(payload('place_in')[0], [payload('place_in')[0].correctCell!])).toBe(true);
    expect(markLeaks(IDENTIFY, [objs[1].position])).toBe(true);
    expect(markLeaks(PLACE, [{ row: 0, col: 1 }])).toBe(true);
    expect(markLeaks(PLACE, [{ row: 0, col: 2 }])).toBe(true);
    for (const c of ALL) {
      const steps = c.steps?.length ?? 1;
      for (let s = 0; s < steps; s++) {
        const ring = markCells(c, s);
        if (ring.length && c.type !== 'place_in') expect(markLeaks(c, ring, s), `${c.type} ${c.id} step ${s}`).toBe(false);
      }
    }
  });
  it('word buttons get a picture on every option or none; a cell item pictures only its asked word', () => {
    expect(pictureLeaks(IDENTIFY, ['above'])).toBe(true);
    expect(pictureLeaks(IDENTIFY, IDENTIFY.options!)).toBe(false);
    expect(pictureLeaks(PLACE, ['above'])).toBe(false);
    expect(pictureLeaks(PLACE, ['below'])).toBe(true);
    expect(pictureLeaks(payload('describe_scene')[0], ['left_of'])).toBe(true);
    for (const c of ALL.filter(x => x.type !== 'describe_scene')) expect(pictureLeaks(c, pictureWords(c)), c.id).toBe(false);
  });
  it('no fact names the scene\'s things in a relation; the side labels are the same on every scene', () => {
    for (const c of ALL) {
      const levers = spatialSceneLevers(c, []).map(l => l.id);
      const fact = leverFacts(c, levers) ?? '';
      expect(fact).not.toMatch(/\b(is|are) (above|below|on|under|left of|right of|beside|next to|in front of|behind|between|in)\b/i);
      if (c.type === 'describe_scene') expect(fact).toBe(SIDES_FACT);
    }
    for (const w of Object.keys(PICTURE_TEXT)) expect(PICTURE_TEXT[w]).not.toMatch(/ball|box|cat|tree/);
  });
  it('follow directions reads each saved step\'s word and the thing it names, held to its cell', () => {
    for (const c of payload('follow_directions')) for (let s = 0; s < c.steps!.length; s++) {
      const ask = stepAsk(c, s)!;
      expect(ask, `${c.id} step ${s}`).toBeTruthy();
      expect(positionHolds(ask.word, c.steps![s].correctCell, ask.at)).toBe(true);
    }
    const two = { ...payload('follow_directions')[0], steps: [{ ...payload('follow_directions')[0].steps![0],
      instruction: 'Put the monkey above or below the tree.' }] };
    expect(stepAsk(two, 0)).toBeNull();
  });
});

describe('simpler items', () => {
  const variants = (c: SpatialSceneChallenge) => [c, ...cells.map((p, i) => ({ ...c, id: `${c.id}-${i}`,
    sceneObjects: c.sceneObjects.map((o, j) => j === 0 && c.type === 'place' ? { ...o, position: p } : o) }))];
  it.each(MODES.filter(m => m !== 'follow_directions'))('%s: same mode, a new id, solvable, never the item\'s things or answer', mode => {
    for (const item of payload(mode)) for (const c of variants(item)) {
      const p = practiceItem(c);
      if (!p) { expect(c.type, `${c.id} has no practice`).toBe('place'); continue; }
      expect(p.id).toBe(`${c.id}~simpler`);
      expect(p.type).toBe(c.type);
      expect(practiceLeaks(p, c)).toBe(false);
      expect(p.sceneObjects.length).toBe(c.type === 'place' ? 1 : 2);
      const at = (n?: string) => p.sceneObjects.find(o => o.name === n)?.position;
      if (p.type === 'identify' || p.type === 'describe') {
        expect(p.options).toHaveLength(2);
        expect(p.options!.every(o => c.options!.includes(o))).toBe(true);
        expect(p.options!.filter(o => positionHolds(o, p.targetObject.position, at(p.referenceObjectName)!))).toEqual([p.correctPosition]);
      }
      if (p.type === 'place') {
        expect(p.acceptableCells).toHaveLength(1);
        expect(positionHolds(p.correctPosition, p.correctCell!, at(p.referenceObjectName)!)).toBe(true);
      }
      if (p.type === 'place_in') expect(at(p.referenceObjectName)).toEqual(p.correctCell);
      if (p.type === 'place_between') expect(betweenHolds(p.correctCell!, at(p.referenceObjectName)!, at(p.referenceObjectName2)!)).toBe(true);
      if (p.type !== 'describe_scene' && p.type !== 'identify' && p.type !== 'describe')
        expect(p.sceneObjects.some(o => placeCellCorrect(p, o.position)) === (p.type === 'place_in')).toBe(true);
      expect(practiceParent(p.id, [c])).toBe(c);
    }
  });
  it('is offered on every saved item, and never on an item already the plainest shape', () => {
    for (const c of ALL.filter(x => x.type !== 'follow_directions')) expect(spatialSceneLevers(c, []).map(l => l.id), c.id).toContain(FEWER_LEVER);
    const plain = practiceItem(IDENTIFY)!;
    expect(practiceItem(plain)).toBeNull();
    expect(practiceItem(practiceItem(PLACE)!)).toBeNull();
    for (const c of payload('follow_directions')) expect(spatialSceneLevers(c, []).map(l => l.id)).not.toContain(FEWER_LEVER);
  });
});

describe('this miss, then this lever', () => {
  it.each([
    ['identify', 'other_axis_word', [], MARK_LEVER], ['identify', 'opposite_word', [], PICTURE_LEVER],
    ['identify', 'same_axis_word', [], PICTURE_LEVER], ['identify', 'opposite_word', [PICTURE_LEVER], FEWER_LEVER],
    ['place', 'off_line_cell', [], MARK_LEVER], ['place', 'opposite_cell', [], PICTURE_LEVER],
    ['place', 'same_axis_cell', [PICTURE_LEVER], FEWER_LEVER],
    ['place_in', 'other_object', [], PICTURE_LEVER], ['place_in', 'away_from_container', [PICTURE_LEVER], FEWER_LEVER],
    ['place_between', 'next_to_one', [], MARK_LEVER], ['place_between', 'touches_neither', [MARK_LEVER], PICTURE_LEVER],
    ['follow_directions', 'other_cell', [], MARK_LEVER], ['follow_directions', 'later_step_cell', [], PICTURE_LEVER],
    ['describe_scene', 'opposite_word', [], SIDES_LEVER], ['describe_scene', 'opposite_word', [SIDES_LEVER], FEWER_LEVER],
  ])('%s after %s with %j pulled: %s', (mode, miss, pulled, want) => {
    expect(nextLever(spatialSceneLevers(payload(mode)[0], pulled as string[]), miss)).toBe(want);
  });
  it('every catalog miss has a lever on every saved item of its mode (J12), at every step', () => {
    const misses = getComponentById('spatial-scene')!.teachingWorkspace!.misses!;
    for (const c of ALL) for (let s = 0; s < (c.steps?.length ?? 1); s++) {
      const levers = spatialSceneLevers(c, [], s);
      for (const miss of misses[c.type] ?? []) expect(levers.some(l => l.answers?.includes(miss)), `${c.id} ${c.type} ${miss}`).toBe(true);
    }
  });
});
