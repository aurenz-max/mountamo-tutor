/**
 * 3d-shape-explorer levers (`/add-support-tiers` 2026-10-08): the leak rules, the models' exclusions, the simplify
 * builder, which lever a named miss gets, and per-item coverage of every checked miss on every saved payload (J12).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { SHAPE_FACTS, THREE_D_SHAPES, buildThreeDShapeItems, type ThreeDShapeChallengeLike, type ThreeDShapeItem } from './threeDShapeExplorerScript';
import { threeDShapeAssignment, threeDShapeSpokenMisses } from './threeDShapeExplorerWorkspace';
import {
  FEWER_FACES, MODEL_OBJECT, MODEL_PROPERTY, SIMPLER_SUFFIX, catalogModeOf, leverLeak, modelObjectFor, modelPropertyFor,
  simplerFaces, simplerFromId, startingLevers, threeDShapeLeverFacts, threeDShapeLevers,
} from './threeDShapeExplorerLevers';

const PAYLOADS = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
const MODES = ['identify_3d', 'match_real_world', '2d_vs_3d', 'faces_properties', 'shape_riddle'];
const payloadItems = (mode: string) =>
  buildThreeDShapeItems(JSON.parse(readFileSync(join(PAYLOADS, `3d-shape-explorer.${mode}.json`), 'utf-8')).data.challenges).items;
const one = (c: ThreeDShapeChallengeLike) => buildThreeDShapeItems([c]).items;
/** Every property question on one solid (a challenge keeps four questions, so two challenges). */
const props = (shape: string) => buildThreeDShapeItems([
  { id: 'p', type: 'faces-and-properties', displayShape: shape, propertyQuestions: [
    { propertyKey: 'flatFaces' }, { propertyKey: 'curvedSurfaces' }, { propertyKey: 'faceShape' }, { propertyKey: 'canRoll' }] },
  { id: 'q', type: 'faces-and-properties', displayShape: shape, propertyQuestions: [{ propertyKey: 'canStack' }, { propertyKey: 'canSlide' }] },
]).items;
const ids = (item: ThreeDShapeItem, items: readonly ThreeDShapeItem[] = [item]) => threeDShapeLevers(item, [], items).map(l => l.id);

/** Every hand-built item kind on every solid, plus every saved payload item. */
const ALL: Array<[string, ThreeDShapeItem, readonly ThreeDShapeItem[]]> = [
  ...THREE_D_SHAPES.flatMap(s => [
    ...one({ id: 'i', type: 'identify-3d', shape3d: s }), ...props(s),
    ...one({ id: 'd', type: '2d-vs-3d', mixedShapes: [{ name: s, is3d: true }] }),
  ].map((item): [string, ThreeDShapeItem, readonly ThreeDShapeItem[]] => [`${s} ${item.id}`, item, [item]])),
  ...MODES.flatMap(mode => {
    const items = payloadItems(mode);
    return items.map((item): [string, ThreeDShapeItem, readonly ThreeDShapeItem[]] => [`${mode} ${item.id}`, item, items]);
  }),
];

describe('levers per item kind', () => {
  it.each([
    ['identify cube', one({ id: 'a', type: 'identify-3d', shape3d: 'cube' })[0], ['see_through', 'face_prints']],
    ['identify sphere: nothing to print', one({ id: 'a', type: 'identify-3d', shape3d: 'sphere' })[0], ['see_through']],
    ['flat circle', one({ id: 'a', type: '2d-vs-3d', mixedShapes: [{ name: 'circle', is3d: false }] })[0], ['edge_view']],
    ['match can', one({ id: 'a', type: 'match-to-real-world', matchPairs: [{ realWorldObject: 'can', shape3d: 'cylinder' }] })[0],
      ['solid_shelf', 'model_object']],
    ['riddle', one({ id: 'a', type: 'shape-riddle', shape3d: 'cone', clues: ['I have one flat circular face.', 'I have one point.', 'I can roll, but I do not stack.'] })[0],
      ['solid_shelf']],
  ] as const)('%s', (_n, item, expected) => { expect(ids(item)).toEqual(expected); });

  it('cube properties: counts get tint + prints + fewer faces; has-any gets no tint; face shape gets no prints', () => {
    const by = (k: string) => props('cube').find(i => i.propertyKey === k)!;
    const [flat, curved, face, roll, stack, slide] = ['flatFaces', 'curvedSurfaces', 'faceShape', 'canRoll', 'canStack', 'canSlide'].map(by);
    expect(ids(flat)).toEqual(['tint_surfaces', 'face_prints', 'fewer_faces']);
    expect(curved.kind).toBe('judge_property');
    expect(ids(curved)).toEqual(['model_property']);
    expect(ids(face)).toEqual(['tint_surfaces', 'model_property']);
    for (const judge of [roll, stack, slide]) expect(ids(judge)).toEqual(['tint_surfaces', 'model_property']);
  });

  it('a curved-surface count (always one) has the tint and no simplify', () => {
    const curved = props('cylinder')[1];
    expect(curved.kind).toBe('count_property');
    expect(ids(curved)).toEqual(['tint_surfaces']);
  });
});

describe('the miss names the next lever', () => {
  const cube = props('cube')[0];
  it.each([
    ['one_short', 'face_prints'], ['over_by_more', 'face_prints'], ['said_other_surface', 'tint_surfaces'], [undefined, 'tint_surfaces'],
  ] as const)('count cube flat faces, %s -> %s', (miss, lever) => {
    expect(nextLever(threeDShapeLevers(cube, [], [cube]), miss)).toBe(lever);
  });
  it('simplify only after help: fewer_faces is the simplify lever', () => {
    expect(nextLever(threeDShapeLevers(cube, [], [cube]), 'one_short', 'simplify')).toBe(FEWER_FACES);
  });
  it.each([
    ['identify cube', one({ id: 'a', type: 'identify-3d', shape3d: 'cube' })[0], 'similar_solid', 'face_prints'],
    ['identify cube', one({ id: 'a', type: 'identify-3d', shape3d: 'cube' })[0], 'flat_look_alike', 'see_through'],
    ['2d', one({ id: 'a', type: '2d-vs-3d', mixedShapes: [{ name: 'cube', is3d: true }] })[0], 'opposite_dimension', 'edge_view'],
    ['match', one({ id: 'a', type: 'match-to-real-world', matchPairs: [{ realWorldObject: 'can', shape3d: 'cylinder' }] })[0], 'said_object', 'solid_shelf'],
    ['face shape', props('cylinder')[2], 'side_view_shape', 'model_property'],
  ] as const)('%s: %s -> %s', (_n, item, miss, lever) => {
    expect(nextLever(threeDShapeLevers(item, [], [item]), miss)).toBe(lever);
  });
});

describe('leak rules', () => {
  it.each(ALL)('%s: no lever fact states the answer, and every checked miss has a lever on this item', (_n, item, items) => {
    const levers = threeDShapeLevers(item, [], items);
    const all = levers.map(l => l.id);
    const facts = threeDShapeLeverFacts(item, all, items);
    for (const id of all) expect(leverLeak(item, threeDShapeLeverFacts(item, [id], items)), id).toBeNull();
    expect(leverLeak(item, levers.map(l => `${l.when} ${l.does}`).join(' '))).toBeNull();
    expect(facts.length).toBeGreaterThan(0);
    for (const miss of threeDShapeSpokenMisses(item)) {
      expect(levers.some(l => l.answers?.includes(miss.id)), `${item.id} ${miss.id}`).toBe(true);
    }
  });

  it('leverLeak catches the answer and its accepted forms, by whole word', () => {
    const [flat] = one({ id: 'a', type: '2d-vs-3d', mixedShapes: [{ name: 'circle', is3d: false }] });
    expect(leverLeak(flat, 'It is flat.')).toBe('flat');
    expect(leverLeak(flat, 'a thin line')).toBeNull();
    const [cube] = one({ id: 'a', type: 'identify-3d', shape3d: 'cube' });
    expect(leverLeak(cube, 'a cube, drawn')).toBe('cube');
    expect(leverLeak(cube, 'cubes of ice')).toBeNull();
  });

  it.each(ALL)('%s: a model never shows the learner\'s solid, the one most like it, or a later item\'s solid', (_n, item, items) => {
    const later = items.slice(items.findIndex(i => i.id === item.id) + 1).map(i => i.shape3d);
    const near: Record<string, string> = { cube: 'rectangular-prism', 'rectangular-prism': 'cube', cylinder: 'cone', cone: 'cylinder' };
    for (const shape of [modelObjectFor(item, items)?.shape, modelPropertyFor(item, items)?.shape].filter(Boolean)) {
      expect(shape).not.toBe(item.shape3d);
      expect(shape).not.toBe(near[item.shape3d ?? '']);
      expect(later).not.toContain(shape);
    }
    const model = modelPropertyFor(item, items);
    if (model?.face) expect(model.face).not.toBe(item.answer);
    if (model && model.key !== 'faceShape') {
      const f = SHAPE_FACTS[model.shape];
      expect(model.key === 'flatFaces' || model.key === 'curvedSurfaces' ? f[model.key] > 0 : f[model.key]).toBe(true);
    }
  });

  it('a model object is never the learner\'s object or a later one', () => {
    const items = one({ id: 'm', type: 'match-to-real-world', matchPairs: [
      { realWorldObject: 'drum', shape3d: 'cone' }, { realWorldObject: 'ball', shape3d: 'cube' }] });
    // drum is the learner's, ball a later one; cone and cylinder are the item's neighbours, cube a later solid.
    expect(modelObjectFor(items[0], items)?.object).toBe('box');
    const solo = one({ id: 'm', type: 'match-to-real-world', matchPairs: [
      { realWorldObject: 'dice', shape3d: 'cube' }, { realWorldObject: 'orange', shape3d: 'sphere' },
      { realWorldObject: 'can', shape3d: 'cylinder' }, { realWorldObject: 'party hat', shape3d: 'cone' }] });
    expect(modelObjectFor(solo[0], solo)).toBeNull();
    expect(threeDShapeLevers(solo[0], [], solo).map(l => l.id)).not.toContain(MODEL_OBJECT);
    expect(modelObjectFor(items[1], items)?.object).toBe('drum');
  });
});

describe('fewer_faces builder', () => {
  it.each([['cube', 'cylinder', 'two'], ['rectangular-prism', 'cylinder', 'two'], ['cylinder', 'cone', 'one']] as const)(
    '%s -> %s', (from, to, answer) => {
      const [item] = props(from);
      const easier = simplerFaces(item, [item])!;
      expect(easier.id).toBe(`${item.id}${SIMPLER_SUFFIX}`);
      expect(easier).toMatchObject({ kind: 'count_property', propertyKey: 'flatFaces', shape3d: to, answer, sourceMode: 'faces-and-properties' });
      expect(SHAPE_FACTS[to].flatFaces).toBeLessThan(SHAPE_FACTS[from].flatFaces);
      expect(threeDShapeAssignment(easier).expectedAnswer).toMatch(new RegExp(`^${answer}\\.`));
      expect(simplerFromId(easier.id, [item])).toEqual(easier);
    });

  it('none on a cone (one face), on curved counts, and never onto a solid a later item is about', () => {
    expect(simplerFaces(props('cone')[0], props('cone'))).toBeNull();
    const items = [...props('cube').slice(0, 1), ...props('cylinder')];
    expect(simplerFaces(items[0], items)?.shape3d).toBe('cone');
    expect(simplerFaces(props('cylinder')[1], props('cylinder'))).toBeNull();
  });
});

it('easy counts start with the tint; a starting lever is drawn but is not a pull', () => {
  const [easy] = one({ id: 'e', type: 'faces-and-properties', displayShape: 'cube', propertyQuestions: [{ propertyKey: 'flatFaces' }], supportTier: 'easy' });
  expect(startingLevers(easy)).toEqual(['tint_surfaces']);
  expect(threeDShapeLevers(easy, [], [easy]).find(l => l.id === 'tint_surfaces')?.pulled).toBe(true);
  expect(threeDShapeLeverFacts(easy, [], [easy])).toMatch(/tinted amber/);
  expect(startingLevers(props('cube')[0])).toEqual([]);
});

it('every saved payload mode is covered', () => {
  for (const mode of MODES) {
    const items = payloadItems(mode);
    expect(items.length, mode).toBeGreaterThan(0);
    expect(new Set(items.map(catalogModeOf))).toEqual(new Set([mode]));
    for (const item of items) expect(threeDShapeLevers(item, [], items).length, item.id).toBeGreaterThan(0);
  }
  expect(modelPropertyFor(props('cube')[1], props('cube'))).not.toBeNull();
  expect(threeDShapeLevers(props('cube')[1], [], props('cube')).map(l => l.id)).toEqual([MODEL_PROPERTY]);
});
