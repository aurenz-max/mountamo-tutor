import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { REAL_WORLD_SHAPE_OBJECTS } from '../shared/realWorldShapeObjects';
import { SHAPE_MENU } from './diShapesMenu';
import { FEWER_SIDES, MODEL_COUNT, MODEL_OBJECT, MODEL_SHAPE, PLAIN_DRAWING, START_MARK, TOUCH_MARKS, modelFor, shapeItem,
  shapeLeaks, shapeLeverFacts, shapeLevers, simplerShape, startingLevers } from './diShapesLevers';
import { shapesSpokenMisses } from './diShapesWorkspace';
import { isCountingType, type DiShapeName, type DiShapesChallenge } from './diShapesScript';
import nameShape from '../../../components/live-activity/runtime/testing/w1-payloads/di-shapes.name_shape.json';
import shapeReview from '../../../components/live-activity/runtime/testing/w1-payloads/di-shapes.shape_review.json';
import findObject from '../../../components/live-activity/runtime/testing/w1-payloads/di-shapes.find_real_object.json';
import countSides from '../../../components/live-activity/runtime/testing/w1-payloads/di-shapes.count_sides.json';
import countCorners from '../../../components/live-activity/runtime/testing/w1-payloads/di-shapes.count_corners.json';

const SHAPES = Object.keys(SHAPE_MENU) as DiShapeName[];
const POLYGONS = SHAPES.filter(s => SHAPE_MENU[s].sides != null);
const NAMING = ['name_shape', 'shape_review'] as const;
const COUNTING = ['count_sides', 'count_corners'] as const;
const item = (shape: DiShapeName, type: DiShapesChallenge['challengeType'], id = `${type}-${shape}`, extra: Partial<DiShapesChallenge> = {}) =>
  ({ ...shapeItem(shape, type, id), ...extra });
const objectItem = (o: typeof REAL_WORLD_SHAPE_OBJECTS[number]) =>
  shapeItem(o.shape === 'diamond' ? 'rhombus' : o.shape, 'name_real_object', `obj-${o.id}`, undefined, o);
const SAVED = [nameShape, shapeReview, findObject, countSides, countCorners].map(p => p.data.challenges as DiShapesChallenge[]);
const CATALOG = DI_CATALOG.find(c => c.id === 'di-shapes')!.teachingWorkspace!;

describe('shapeLeaks: the model never names the answer or its look-alike', () => {
  it.each([
    ['the same shape', 'square', 'square', true],
    ['the look-alike (rectangle beside a square)', 'rectangle', 'square', true],
    ['the look-alike the other way (square beside a rectangle)', 'square', 'rectangle', true],
    ['circle beside an oval', 'circle', 'oval', true],
    ['a rhombus beside a triangle (the K look-alike "diamond")', 'rhombus', 'triangle', true],
    ['a square beside a rhombus', 'square', 'rhombus', true],
    ['a hexagon beside a pentagon', 'hexagon', 'pentagon', true],
    ['a triangle beside a square', 'triangle', 'square', false],
    ['a circle beside a hexagon', 'circle', 'hexagon', false],
  ] as const)('%s', (_, model, of, leaks) => expect(shapeLeaks(model, of)).toBe(leaks));
});

describe('model levers: a different shape, solved', () => {
  it('every drawable shape on a naming mode has a model that does not leak, alone and before every other shape', () => {
    for (const type of NAMING) for (const shape of SHAPES) {
      const it0 = item(shape, type);
      const alone = modelFor(it0, [it0]);
      expect(alone, `${shape} alone`).not.toBeNull();
      expect(shapeLeaks(alone!.shape, shape)).toBe(false);
      // A session where every other core shape is still to come: the model is none of them.
      const coming = SHAPES.filter(s => s !== shape && SHAPE_MENU[s].core).map((s, i) => item(s, type, `c${i}`));
      const model = modelFor(it0, [it0, ...coming]);
      if (model) for (const c of coming) expect(shapeLeaks(model.shape, c.shape) || model.shape === c.shape, `${shape} → ${model.shape} vs ${c.shape}`).toBe(false);
    }
  });

  it('a counting model is a different polygon whose count is not within one of the item, nor of any item still to come', () => {
    for (const type of COUNTING) for (const shape of POLYGONS) {
      const it0 = item(shape, type);
      const model = modelFor(it0, [it0]);
      expect(model, `${type} ${shape}`).not.toBeNull();
      expect(model!.shape).not.toBe(shape);
      expect(Math.abs(model!.countNumeral! - it0.countNumeral!)).toBeGreaterThan(1);
    }
    const tri = item('triangle', 'count_sides', 't'), hex = item('hexagon', 'count_sides', 'h');
    expect(modelFor(tri, [tri, hex])!.countNumeral).toBe(5);
  });

  it('every real object has a model of a different object whose shape is not the answer or its look-alike', () => {
    for (const o of REAL_WORLD_SHAPE_OBJECTS) {
      const it0 = objectItem(o);
      const model = modelFor(it0, [it0]);
      expect(model, o.id).not.toBeNull();
      expect(model!.realObjectId).not.toBe(o.id);
      expect(shapeLeaks(model!.shape, it0.shape)).toBe(false);
    }
  });

  it('every saved payload item has a model, and its scene fact never says the item\'s answer', () => {
    for (const items of SAVED) for (const it0 of items) {
      const model = modelFor(it0, items);
      expect(model, it0.id).not.toBeNull();
      const fact = shapeLeverFacts(it0, [isCountingType(it0.challengeType) ? MODEL_COUNT : it0.challengeType === 'name_real_object' ? MODEL_OBJECT : MODEL_SHAPE], items);
      expect(fact).toMatch(/different one, solved/);
      if (isCountingType(it0.challengeType)) expect(fact).not.toMatch(new RegExp(`\\b${it0.countWord}\\b`));
      else expect(fact).not.toMatch(new RegExp(`\\b${it0.shapeWord}\\b`));
    }
  });
});

describe('simplify levers keep the mode, and never repeat or name the item', () => {
  it('plain_drawing: only on a variant, a turn past the gentle band, or a small drawing; a different, plain shape', () => {
    const plain = item('triangle', 'name_shape');
    expect(simplerShape(plain, PLAIN_DRAWING, [plain])).toBeNull();
    for (const extra of [{ exemplar: 'variant' as const }, { rotationDeg: 170 }, { scalePct: 60 }]) {
      const hard = item('triangle', 'name_shape', 'x', extra);
      const easier = simplerShape(hard, PLAIN_DRAWING, [hard])!;
      expect(easier.id).toBe('x~simpler');
      expect(easier.challengeType).toBe('name_shape');
      expect([easier.exemplar, easier.rotationDeg, easier.scalePct]).toEqual(['prototype', 0, 100]);
      expect(shapeLeaks(easier.shape, 'triangle')).toBe(false);
      expect(easier.shape).not.toBe(modelFor(hard, [hard])!.shape);
    }
  });

  it.each([['square', 'triangle'], ['pentagon', 'triangle'], ['hexagon', 'square'], ['rectangle', 'triangle']] as const)(
    'fewer_sides: a %s gives a %s', (from, to) => {
      for (const type of COUNTING) {
        const it0 = item(from, type);
        const easier = simplerShape(it0, FEWER_SIDES, [it0])!;
        expect(easier.shape).toBe(to);
        expect(easier.challengeType).toBe(type);
        expect(easier.countNumeral).toBeLessThan(it0.countNumeral!);
      }
    });

  it('fewer_sides is refused on a triangle, and simplify never applies to find_real_object', () => {
    const tri = item('triangle', 'count_sides');
    expect(simplerShape(tri, FEWER_SIDES, [tri])).toBeNull();
    expect(shapeLevers(tri, [], [tri]).map(l => l.id)).not.toContain(FEWER_SIDES);
    const obj = objectItem(REAL_WORLD_SHAPE_OBJECTS[0]);
    expect(shapeLevers(obj, [], [obj]).filter(l => l.kind === 'simplify')).toEqual([]);
  });
});

describe('the lever set per mode, and which lever answers which miss', () => {
  it('naming modes get no in-item help: only the model, and plain_drawing when there is a step to drop', () => {
    const it0 = item('hexagon', 'shape_review', 'h', { exemplar: 'variant' });
    expect(shapeLevers(it0, [], [it0]).map(l => l.id)).toEqual([MODEL_SHAPE, PLAIN_DRAWING]);
  });

  it.each([
    ['one_over', [], MODEL_COUNT],
    ['one_over', [MODEL_COUNT], START_MARK],
    ['short_by_more', [MODEL_COUNT], TOUCH_MARKS],
    ['said_shape_name', [], MODEL_COUNT],
    ['one_short', [MODEL_COUNT, START_MARK, TOUCH_MARKS], FEWER_SIDES],
  ] as const)('count_sides on a hexagon: %s with %j pulled → %s', (miss, pulled, expected) => {
    const it0 = item('hexagon', 'count_sides');
    expect(nextLever(shapeLevers(it0, pulled, [it0]), miss)).toBe(expected);
  });

  it.each([['near_name', MODEL_SHAPE], ['described_shape', MODEL_SHAPE], ['other_shape_name', MODEL_SHAPE]] as const)(
    'name_shape: %s → %s', (miss, expected) => {
      const it0 = item('square', 'name_shape', 's', { rotationDeg: 40 });
      expect(nextLever(shapeLevers(it0, [], [it0]), miss)).toBe(expected);
      expect(nextLever(shapeLevers(it0, [MODEL_SHAPE], [it0]), miss)).toBe(PLAIN_DRAWING);
    });

  it('every catalog miss of every mode is answered by a lever on a saved item, and every named miss is listed', () => {
    for (const items of SAVED) {
      const mode = items[0].challengeType === 'name_real_object' ? 'find_real_object' : items[0].challengeType;
      const answered = new Set(items.flatMap(i => shapeLevers(i, [], items).flatMap(l => l.answers ?? [])));
      for (const miss of CATALOG.misses![mode]) expect(answered.has(miss), `${mode}: ${miss}`).toBe(true);
      for (const i of items) for (const m of shapesSpokenMisses(i)) expect(CATALOG.misses![mode], `${mode} ${m.id}`).toContain(m.id);
    }
  });

  it('easy (or no tier) starts with the mode\'s model; medium and hard start with nothing', () => {
    const easy = item('square', 'count_corners'), medium = { ...easy, supportTier: 'medium' as const };
    expect(startingLevers(easy, [easy])).toEqual([MODEL_COUNT]);
    expect(startingLevers(medium, [medium])).toEqual([]);
  });
});
