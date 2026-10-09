import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { SCENES, SCENE_IDS, isPracticeScene, placeBlock, presetProjects, type Placed } from './openBuilderModel';
import {
  MARKS_LEVER, PARTS_LEVER, SIMPLER_LEVER, goalParts, jobMarks, marksLeak, openBuilderLevers, partsLeak, practiceItem,
  practiceLeaks, practiceParent,
} from './openBuilderLevers';

const project = (id: (typeof SCENE_IDS)[number]) => presetProjects([id])[0];

describe('open-builder lever rules', () => {
  it('practice scenes are never on the menu the generator and presets choose from', () => {
    expect(SCENE_IDS.some(isPracticeScene)).toBe(false);
    expect(Object.keys(SCENES).filter(id => isPracticeScene(id as never))).toHaveLength(8);
  });

  it.each(SCENE_IDS)('%s: at least one help lever, and every help passes its leak rule', id => {
    const c = project(id);
    const help = openBuilderLevers(c, [c], []).filter(l => l.kind === 'help');
    expect(help.length).toBeGreaterThan(0);
    const marks = jobMarks(c), parts = goalParts(c);
    if (marks) expect(marksLeak(id, marks.marks)).toBe(false);
    if (parts) expect(partsLeak(id, parts)).toBe(false);
    // Every miss the buddy names has a lever on this item.
    for (const miss of ['missing_part', 'does_not_work']) expect(help.some(l => l.answers?.includes(miss))).toBe(true);
  });

  it('a mark in the water, in open air, or a line that runs past the giraffe leaks', () => {
    expect(marksLeak('bridge', [{ kind: 'flag', col: 5, row: 0 }])).toBe(true);
    expect(marksLeak('bridge', [{ kind: 'flag', col: 3, row: 4 }])).toBe(true);
    expect(marksLeak('giraffe', [{ kind: 'line', row: 6, fromCol: 0, toCol: 11 }])).toBe(true);
    expect(marksLeak('giraffe', [{ kind: 'line', row: 4, fromCol: 0, toCol: 8 }])).toBe(true);
    expect(marksLeak('cliff-steps', [{ kind: 'ring', prop: 7 }])).toBe(true);
  });

  it('a card that names an unsaid block, a number or a place leaks', () => {
    expect(partsLeak('puppy-house', [{ glyph: '🔺', word: 'a triangle roof' }])).toBe(true);
    expect(partsLeak('robot', [{ glyph: '🙂', word: '2 arms' }])).toBe(true);
    expect(partsLeak('castle', [{ glyph: '🗼', word: 'a tower on the left' }])).toBe(true);
    expect(partsLeak('puppy-house', [{ glyph: '🧱', word: 'big walls' }])).toBe(true);
    // A block kind the goal itself says is fine: the truck's goal says wheels.
    expect(partsLeak('truck', [{ glyph: '🛞', word: 'wheels' }])).toBe(false);
  });

  it.each(SCENE_IDS.filter(id => id !== 'truck'))('%s: the smaller job is a practice scene, same mode, never the item', id => {
    const c = project(id), session = presetProjects(SCENE_IDS);
    const p = practiceItem(c, session)!;
    expect(p).toMatchObject({ id: `${c.id}~simpler`, type: 'build_to_goal' });
    expect(isPracticeScene(p.sceneId)).toBe(true);
    expect(p.goal).toBe(SCENES[p.sceneId].goal);
    expect(practiceLeaks(p, c, session)).toBe(false);
    expect(practiceParent(p.id, [c])).toBe(c);
    expect(openBuilderLevers(c, session, []).map(l => l.id)).toContain(SIMPLER_LEVER);
  });

  it('the truck has no smaller job; a practice scene already in the lesson is refused', () => {
    expect(practiceItem(project('truck'), [])).toBeNull();
    expect(openBuilderLevers(project('truck'), [], []).map(l => l.id)).toEqual([PARTS_LEVER]);
    const c = project('bridge');
    expect(practiceItem(c, [c, { ...c, id: 'x', sceneId: 'stream' }])).toBeNull();
  });

  it('the smaller jobs can be built: one long block spans the stream, three small blocks reach the pony', () => {
    const across = placeBlock(SCENES.stream, [], 'long', 'blue', 4) as Placed[];
    expect(across[0].row).toBe(1);
    let tower: Placed[] = [];
    for (let i = 0; i < 3; i++) tower = placeBlock(SCENES.pony, tower, 'small', 'blue', 2) as Placed[];
    expect(Math.max(...tower.map(p => p.row)) + 1).toBe(SCENES.pony.props[0].size);
  });

  it.each([
    ['bridge', 'does_not_work', [], MARKS_LEVER], ['bridge', 'missing_part', [MARKS_LEVER], SIMPLER_LEVER],
    ['robot', 'missing_part', [], PARTS_LEVER], ['robot', 'does_not_work', [PARTS_LEVER], SIMPLER_LEVER],
    ['truck', 'missing_part', [PARTS_LEVER], null],
  ] as const)('%s: after %s with %j pulled, the next lever is %s', (id, miss, pulled, want) => {
    const c = project(id);
    expect(nextLever(openBuilderLevers(c, [c], pulled as unknown as string[]), miss)).toBe(want);
  });

  it('easy starts with the help shown; the simplify lever is never shown from the start', () => {
    const c = { ...project('puppy-house'), supportTier: 'easy' as const };
    expect(openBuilderLevers(c, [c], []).map(l => [l.id, l.pulled])).toEqual([[PARTS_LEVER, true], [SIMPLER_LEVER, false]]);
  });
});
