import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { NEAR_SHAPE, SHAPE_PROPERTIES, VALID_SHAPES, itemsFromChallenges, nameClassOf, shapeSorterSpokenMisses,
  type ShapeSorterChallengeLike, type ShapeSorterItem } from './shapeSorterDomain';
import {
  FEWER_MATS, FEWER_SIDES, MAT_PICTURES, MODEL_COUNT, MODEL_OBJECT, MODEL_SHAPE, OUTLINE_ONLY, PLAIN_DRAWING, SIDE_TICKS,
  START_MARK, TOUCH_MARKS, catalogModeOf, droppedMat, isTurned, matPicture, modelCountFor, modelObjectFor, modelShapeFor,
  shapeLeaks, shapeSorterLeverFacts, shapeSorterLevers, simplerFromId, simplerShape,
} from './shapeSorterLevers';

const PAYLOADS = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const payload = (mode: string) => JSON.parse(readFileSync(join(PAYLOADS, `shape-sorter.${mode}.json`), 'utf-8')).data as {
  challenges: ShapeSorterChallengeLike[] };
const shapesOf = (challenges: ShapeSorterChallengeLike[]) => (item: ShapeSorterItem) =>
  challenges.find(c => c.id === item.challengeId)!.shapes!;

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
const SIZES = ['small', 'medium', 'large'] as const;
/** A random session of one mode, the generator's shape: four shapes per challenge. */
function randomSession(seed: number, type: ShapeSorterChallengeLike['type'], rule?: string) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const challenges: ShapeSorterChallengeLike[] = Array.from({ length: 4 }, (_, c) => ({
    id: `c${c}`, type, ruleAttribute: rule ?? 'shape',
    shapes: Array.from({ length: type === 'count' ? 1 : 4 }, () => ({ shape: pick(VALID_SHAPES), color: pick(COLORS),
      size: pick(SIZES), rotation: pick([0, 0, 15, 45, 90, 120, 200]) })),
  }));
  return { challenges, items: itemsFromChallenges(challenges) };
}

describe('leak rules', () => {
  it('shapeLeaks: the same drawing, a shared name and a look-alike either way round leak', () => {
    expect(shapeLeaks('square', 'square')).toBe(true);
    expect(shapeLeaks('rhombus', 'diamond')).toBe(true);
    expect(shapeLeaks('rectangle', 'square')).toBe(true);
    expect(shapeLeaks('square', 'rectangle')).toBe(true);
    expect(shapeLeaks('oval', 'circle')).toBe(true);
    expect(shapeLeaks('hexagon', 'circle')).toBe(false);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('identify seed %i: the model never leaks the item or a later item', seed => {
    const { items } = randomSession(seed, 'identify');
    items.forEach((item, i) => {
      const model = modelShapeFor(item, items);
      if (!model) return;
      expect(shapeLeaks(model, item.shape)).toBe(false);
      expect(NEAR_SHAPE[item.shape]).not.toBe(model);
      for (const later of items.slice(i + 1)) expect(shapeLeaks(model, later.shape)).toBe(false);
    });
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('count seed %i: the model count is two or more away and no later count', seed => {
    const { items } = randomSession(seed, 'count');
    items.forEach((item, i) => {
      const model = modelCountFor(item, items);
      if (!model) return;
      const g = SHAPE_PROPERTIES[model], n = item.countNoun === 'corners' ? g.corners : g.sides;
      expect(Math.abs(n - item.countNumeral!)).toBeGreaterThan(1);
      expect(nameClassOf(model)).not.toBe(nameClassOf(item.shape));
      for (const later of items.slice(i + 1)) expect(later.countNumeral).not.toBe(n);
    });
  });

  it('find_real_object: the model object is another object whose shape does not leak any item still to come', () => {
    const { challenges } = payload('find_real_object');
    const items = itemsFromChallenges(challenges, { isPreReader: true });
    items.forEach((item, i) => {
      const model = modelObjectFor(item, items);
      if (!model) return;
      expect(model.id).not.toBe(item.realObjectId);
      expect(shapeLeaks(model.shape, item.shape)).toBe(false);
      for (const later of items.slice(i + 1)) expect(shapeLeaks(model.shape, later.shape)).toBe(false);
    });
  });

  it('mat pictures are read from the label only: alike for every mat, none a shape', () => {
    const sort = { mode: 'sort', rule: 'sides', choices: ['3 sides', '4 sides'] } as unknown as ShapeSorterItem;
    expect(matPicture(sort, '3 sides')).toEqual({ kind: 'sticks', n: 3 });
    expect(matPicture({ ...sort, rule: 'curved' }, 'Curved')).toEqual({ kind: 'stroke', curved: true });
    expect(matPicture({ ...sort, rule: 'color' }, 'Red')).toEqual({ kind: 'swatch', color: 'red' });
  });

  it.each(['identify', 'find_real_object', 'count', 'sort'])('%s: pulled-lever facts never state the answer', mode => {
    const { challenges } = payload(mode);
    const items = itemsFromChallenges(challenges, { isPreReader: true });
    for (const item of items) {
      const all = shapeSorterLevers(item, [], items, shapesOf(challenges)(item)).map(l => l.id);
      const fact = shapeSorterLeverFacts(item, all, items).toLowerCase();
      const levers = shapeSorterLevers(item, all, items, shapesOf(challenges)(item)).map(l => `${l.when} ${l.does}`).join(' ').toLowerCase();
      if (item.mode === 'identify') {
        // The model is named; the learner's shape and its look-alike never are.
        for (const word of [item.answer, ...item.spokenAlternates]) {
          expect(fact).not.toMatch(new RegExp(`\\b${word}\\b`));
          expect(levers).not.toMatch(new RegExp(`\\b${word}\\b`));
        }
      }
      if (item.mode === 'count') expect(fact).not.toMatch(new RegExp(`\\b${item.answer}\\b|\\b${item.countNumeral}\\b|\\b${item.shape}\\b`));
      if (item.mode === 'sort') {
        // The mats are printed for everyone; a fact may name them only alike, and never ties the ringed shape to one.
        expect(fact).not.toMatch(new RegExp(`\\b${item.shape}\\b`));
        expect(new Set(item.choices.map(c => fact.includes(c.toLowerCase()))).size).toBe(1);
      }
    }
  });
});

describe('simplify builders', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('identify seed %i: plain_drawing is a different upright large shape, never the model or a later shape', seed => {
    const { challenges, items } = randomSession(seed, 'identify');
    for (const item of items) {
      const easier = simplerShape(item, items, shapesOf(challenges)(item));
      const drawn = shapesOf(challenges)(item)[item.shapeIndex];
      if (!isTurned(item.shape, drawn.rotation ?? 0) && drawn.size !== 'small') { expect(easier).toBeNull(); continue; }
      if (!easier) continue;
      expect(easier.item.id).toBe(`${item.id}~simpler`);
      expect(easier.item.mode).toBe('identify');
      expect(easier.shapes).toEqual([expect.objectContaining({ rotation: 0, size: 'large' })]);
      expect(shapeLeaks(easier.item.shape, item.shape)).toBe(false);
      expect(easier.item.shape).not.toBe(modelShapeFor(item, items));
      const at = items.indexOf(item);
      for (const later of items.slice(at + 1)) expect(shapeLeaks(easier.item.shape, later.shape)).toBe(false);
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('count seed %i: fewer_sides has fewer, keeps the noun, and is no later counted shape', seed => {
    const { challenges, items } = randomSession(seed, 'count');
    items.forEach((item, i) => {
      const easier = simplerShape(item, items, shapesOf(challenges)(item));
      if (item.countNumeral === 3) { expect(easier).toBeNull(); return; }
      if (!easier) return;
      expect(easier.item.mode).toBe('count');
      expect(easier.item.countNoun).toBe(item.countNoun);
      expect(easier.item.countNumeral!).toBeLessThan(item.countNumeral!);
      expect(easier.item.answer).not.toBe(item.answer);
      for (const later of items.slice(i + 1)) expect(nameClassOf(later.shape)).not.toBe(nameClassOf(easier.item.shape));
    });
  });

  it('fewer_mats greys a wrong mat on three mats only, never the answer', () => {
    const base = { mode: 'sort', answer: '4 sides', choices: ['3 sides', '4 sides', '6 sides'] } as unknown as ShapeSorterItem;
    expect(droppedMat(base)).toBe('6 sides');
    expect(droppedMat({ ...base, answer: '6 sides' })).toBe('4 sides');
    expect(droppedMat({ ...base, choices: ['3 sides', '4 sides'] })).toBeNull();
  });

  it('a journey row rebuilds the practice item from its id with the same builder', () => {
    const { challenges } = payload('count');
    const items = itemsFromChallenges(challenges, { isPreReader: true });
    const parent = items.find(i => i.countNumeral! > 3)!;
    const rebuilt = simplerFromId(`${parent.id}~simpler`, items, shapesOf(challenges));
    expect(rebuilt).toEqual(simplerShape(parent, items, shapesOf(challenges)(parent)));
  });
});

describe('miss → lever, per item on the saved payloads (J12)', () => {
  it.each(['identify', 'find_real_object', 'count', 'sort'])('%s: every known miss on every item has a lever', mode => {
    const { challenges } = payload(mode);
    const items = itemsFromChallenges(challenges, { isPreReader: true });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(catalogModeOf(item)).toBe(mode);
      const levers = shapeSorterLevers(item, [], items, shapesOf(challenges)(item));
      for (const miss of shapeSorterSpokenMisses(item))
        expect(levers.some(l => l.answers?.includes(miss.id)), `${item.id} ${miss.id}`).toBe(true);
    }
  });

  it('the simplify levers are offered on saved payload items', () => {
    const offered = (mode: string, id: string) => {
      const { challenges } = payload(mode);
      const items = itemsFromChallenges(challenges, { isPreReader: true });
      return items.filter(i => shapeSorterLevers(i, [], items, shapesOf(challenges)(i)).some(l => l.id === id)).length;
    };
    expect(offered('identify', PLAIN_DRAWING)).toBeGreaterThan(0);
    expect(offered('count', FEWER_SIDES)).toBeGreaterThan(0);
  });

  const item = (mode: string, index = 0) => {
    const { challenges } = payload(mode);
    const items = itemsFromChallenges(challenges, { isPreReader: true });
    return { it: items[index], levers: shapeSorterLevers(items[index], [], items, shapesOf(challenges)(items[index])) };
  };
  it.each([
    ['identify', 'near_name', MODEL_SHAPE], ['identify', 'other_shape_name', MODEL_SHAPE],
    ['find_real_object', 'said_object', OUTLINE_ONLY], ['find_real_object', 'near_name', OUTLINE_ONLY],
    ['count', 'one_short', MODEL_COUNT], ['count', 'said_shape_name', MODEL_COUNT],
    ['sort', 'said_shape_name', MAT_PICTURES], ['sort', 'other_group', MAT_PICTURES],
  ])('%s: %s → %s', (mode, miss, lever) => {
    expect(nextLever(item(mode).levers, miss)).toBe(lever);
  });

  it('count without a model: one_short → start_mark, over_by_more → touch_marks', () => {
    const levers = item('count', 1).levers.filter(l => l.id !== MODEL_COUNT);
    expect(nextLever(levers, 'one_short')).toBe(START_MARK);
    expect(nextLever(levers, 'over_by_more')).toBe(TOUCH_MARKS);
  });

  it('sort by sides offers side_ticks; curved and colour sorts do not', () => {
    const { challenges } = payload('sort');
    const items = itemsFromChallenges(challenges, { isPreReader: true });
    for (const i of items) {
      const ids = shapeSorterLevers(i, [], items, shapesOf(challenges)(i)).map(l => l.id);
      expect(ids.includes(SIDE_TICKS)).toBe(i.rule === 'sides');
      expect(ids.includes(FEWER_MATS)).toBe(i.choices.length === 3);
      expect(ids.includes(MODEL_OBJECT)).toBe(false);
    }
  });
});
