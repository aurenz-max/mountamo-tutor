/**
 * measurement-tools levers: leak rules per mode, the simplify builders over every item shape the generator draws, and
 * "this wrong answer, then this lever" as code, through the lever set.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { MeasurementToolsChallenge, MeasurementToolsData } from './MeasurementTools';
import {
  EDGE_LINE_LEVER, HALF_MARKS_LEVER, INCH_MODEL_LEVER, MEASUREMENT_LEVERS, ORDER_STEPS_LEVER, OWN_LENGTHS_LEVER,
  SHORTER_SHAPE_LEVER, SMALLER_LENGTH_LEVER, SPACE_SHADING_LEVER, THREE_SHAPES_LEVER, leverTextLeaks, practiceItem,
  practiceLeaks, practiceParent, type LeverView,
} from './measurementToolsLevers';
import {
  EMPTY_VIEW, ORDER_ITEM_ID, conversionCorrect, conversionTarget, lessonOf, measureCorrect, measurementItems, orderChoices,
  orderCorrect, orderShapes, type MeasurementItem, type MeasurementMiss,
} from './measurementToolsWorkspace';

type Mode = MeasurementToolsData['challengeType'];
const MODES: Mode[] = ['measure', 'compare', 'estimate', 'convert'];
const COLOURS = ['Blue', 'Red', 'Green', 'Purple', 'Amber', 'Sky'];
const shape = (i: number, w: number): MeasurementToolsChallenge => ({ id: `mt-${i + 1}`, shapeType: 'rectangle', widthInches: w,
  heightInches: 1, color: 'x', label: `${COLOURS[i % COLOURS.length]} Rectangle`, hint: '' });

/** The width pools the generator draws from, per mode. */
const WIDTHS: Record<Mode, number[]> = {
  measure: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  compare: [2, 3, 4, 5, 6, 7, 8, 9],
  estimate: [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5],
  convert: [2, 3, 4, 5, 6, 8, 10],
};
function session(mode: Mode, widths: number[], unit: MeasurementToolsData['unit'] = 'inches'): MeasurementToolsData {
  return { title: 'Measure', challengeType: mode, challenges: widths.map((w, i) => shape(i, w)), rulerLengthInches: 12, unit,
    precision: mode === 'estimate' ? 'half' : 'whole', gradeBand: '3-5' };
}
const itemsOf = (data: MeasurementToolsData) => measurementItems(lessonOf(data));
/** Every session shape the generator can draw: one per width, and compare's orderings of 3-6 shapes. */
function sessions(mode: Mode): MeasurementToolsData[] {
  const out = WIDTHS[mode].map(w => session(mode, [w]));
  if (mode === 'convert') out.push(...WIDTHS.convert.map(w => session(mode, [w], 'centimeters')));
  if (mode === 'compare') for (let n = 3; n <= 6; n++) for (let start = 0; start + n <= WIDTHS.compare.length; start++)
    out.push(session(mode, WIDTHS.compare.slice(start, start + n).reverse()), session(mode, [2, 5, 8, 4, 9, 6].slice(0, n)));
  return out;
}
/** The screen states a lever can be declared in: placed or not, measuring or converting. */
const VIEWS: LeverView[] = [false, true].flatMap(convertStep => [false, true].map(onRuler => ({ convertStep, onRuler })));
/** Nothing placed yet (the ordering item reads no ruler state). */
const IDLE: LeverView = { convertStep: false, onRuler: false };
const PLACED: LeverView = { convertStep: false, onRuler: true };
const CONVERTING: LeverView = { convertStep: true, onRuler: true };

describe('simplify builders', () => {
  it.each(MODES)('%s: same kind and mode, its own id, shorter or fewer, solvable, never the learner\'s item', mode => {
    let built = 0;
    for (const data of sessions(mode)) {
      const lesson = lessonOf(data);
      for (const item of itemsOf(data)) {
        const p = practiceItem(item);
        if (!p) continue;
        built++;
        expect(practiceParent(p.id)).toBe(item.id);
        expect(practiceLeaks(item, p)).toBe(false);
        if (p.kind === 'shape') {
          const c = p.challenge;
          expect(measureCorrect(c, lesson, c.widthInches)).toBe(true);
          if (mode === 'convert') expect(conversionCorrect(c, lesson, Math.round(conversionTarget(c, lesson) * 2) / 2)).toBe(true);
        } else {
          const shapes = orderShapes(p, lesson);
          expect(shapes).toHaveLength(3);
          expect(orderCorrect(shapes, [...shapes].sort((a, b) => a.widthInches - b.widthInches).map(s => s.id))).toBe(true);
          expect(orderChoices(shapes).map(s => s.id)).not.toEqual([...shapes].sort((a, b) => a.widthInches - b.widthInches).map(s => s.id));
        }
        // A practice item has no practice of its own.
        expect(practiceItem(p)).toBeNull();
      }
    }
    expect(built).toBeGreaterThan(3);
  });

  it('the leak rule rejects the learner\'s own item, its length and a sorted listing', () => {
    const item = itemsOf(session('measure', [6]))[0] as Extract<MeasurementItem, { kind: 'shape' }>;
    const p = practiceItem(item) as Extract<MeasurementItem, { kind: 'shape' }>;
    expect(practiceLeaks(item, { ...p, id: item.id })).toBe(true);
    expect(practiceLeaks(item, { ...p, challenge: { ...p.challenge, widthInches: 6 } })).toBe(true);
    expect(practiceLeaks(item, { ...p, challenge: { ...p.challenge, label: 'Blue Rectangle' } })).toBe(true);
    const order = itemsOf(session('compare', [3, 4, 5, 6])).at(-1)!;
    const po = practiceItem(order) as Extract<MeasurementItem, { kind: 'order' }>;
    const sorted = [...po.shapes!].sort((a, b) => a.widthInches - b.widthInches);
    // orderChoices moves the first of a sorted list last, so a sorted practice still lists out of order; the rule
    // catches what would be listed in order (two equal widths here make it unsolvable as well).
    expect(practiceLeaks(order, { ...po, shapes: sorted.map(s => ({ ...s, widthInches: 4 })) })).toBe(true);
  });

  it('a short shape has no shorter practice, and cm-to-inch converts only above five', () => {
    expect(practiceItem(itemsOf(session('measure', [2]))[0])).toBeNull();
    expect(practiceItem(itemsOf(session('estimate', [2.5]))[0])).not.toBeNull();
    expect(practiceItem(itemsOf(session('convert', [4], 'centimeters'))[0])).toBeNull();
    // Three shapes far apart are already the easy set.
    expect(practiceItem(itemsOf(session('compare', [2, 5, 8])).at(-1)!)).toBeNull();
  });
});

describe('leak rules', () => {
  it.each(MODES)('%s: no lever text or scene fact carries a digit', mode => {
    for (const data of sessions(mode)) for (const item of itemsOf(data)) for (const view of VIEWS) {
      const levers = MEASUREMENT_LEVERS.declare(item, view, []);
      for (const l of levers) {
        expect(leverTextLeaks(l.does)).toBe(false);
        expect(leverTextLeaks(l.when)).toBe(false);
      }
      expect(leverTextLeaks(MEASUREMENT_LEVERS.onScreen(item, view, levers.map(l => l.id)))).toBe(false);
    }
  });

  it('a practice item has no easier item of its own', () => {
    const p = practiceItem(itemsOf(session('measure', [6]))[0])!;
    expect(MEASUREMENT_LEVERS.declare(p, PLACED, []).map(l => l.id)).not.toContain(SHORTER_SHAPE_LEVER);
  });

  it('a lever drawn on one step is neither offered nor stated on the other; the edge line waits for the shape on the ruler', () => {
    const item = itemsOf(session('convert', [4]))[0];
    expect(MEASUREMENT_LEVERS.declare(item, IDLE, []).map(l => l.id))
      .toEqual([SPACE_SHADING_LEVER, SMALLER_LENGTH_LEVER]);
    expect(MEASUREMENT_LEVERS.declare(item, PLACED, []).map(l => l.id))
      .toEqual([SPACE_SHADING_LEVER, EDGE_LINE_LEVER, SMALLER_LENGTH_LEVER]);
    expect(MEASUREMENT_LEVERS.declare(item, CONVERTING, []).map(l => l.id)).toEqual([INCH_MODEL_LEVER, SMALLER_LENGTH_LEVER]);
    expect(MEASUREMENT_LEVERS.onScreen(item, CONVERTING, [SPACE_SHADING_LEVER, EDGE_LINE_LEVER])).toBe('');
    // Within one system there is no inch picture to draw.
    const feet = itemsOf({ ...session('convert', [4]), unit: 'feet' })[0];
    expect(MEASUREMENT_LEVERS.declare(feet, CONVERTING, []).map(l => l.id)).toEqual([SMALLER_LENGTH_LEVER]);
  });
});

describe('this wrong answer, then this lever', () => {
  const ids = (mode: Mode, widths: number[], itemAt: number, view: LeverView = PLACED) =>
    MEASUREMENT_LEVERS.declare(itemsOf(session(mode, widths)).at(itemAt)!, view, []);
  it.each<[Mode, number[], number, LeverView, MeasurementMiss, string]>([
    ['measure', [6], 0, PLACED, 'one_over', SPACE_SHADING_LEVER],
    ['measure', [6], 0, PLACED, 'one_short', SPACE_SHADING_LEVER],
    ['measure', [6], 0, PLACED, 'too_long', EDGE_LINE_LEVER],
    ['measure', [6], 0, PLACED, 'too_short', EDGE_LINE_LEVER],
    ['estimate', [6.5], 0, PLACED, 'whole_not_half', EDGE_LINE_LEVER],
    ['convert', [4], 0, CONVERTING, 'same_number', INCH_MODEL_LEVER],
    ['convert', [4], 0, CONVERTING, 'wrong_operation', INCH_MODEL_LEVER],
    ['convert', [4], 0, CONVERTING, 'too_small', INCH_MODEL_LEVER],
    ['convert', [4], 0, PLACED, 'too_short', EDGE_LINE_LEVER],
    ['compare', [4, 6, 5], -1, IDLE, 'longest_first', ORDER_STEPS_LEVER],
    ['compare', [4, 6, 5], -1, IDLE, 'two_swapped', OWN_LENGTHS_LEVER],
    ['compare', [4, 6, 5], -1, IDLE, 'out_of_order', OWN_LENGTHS_LEVER],
  ])('%s %j: %s then %s', (mode, widths, at, view, miss, lever) => {
    expect(nextLever(ids(mode, widths, at, view), miss)).toBe(lever);
  });

  it('a pulled help moves the next pull on: then half marks, then the simpler item', () => {
    const item = itemsOf(session('estimate', [6.5]))[0];
    expect(nextLever(MEASUREMENT_LEVERS.declare(item, PLACED, [EDGE_LINE_LEVER]), 'whole_not_half')).toBe(HALF_MARKS_LEVER);
    expect(nextLever(MEASUREMENT_LEVERS.declare(item, PLACED, [EDGE_LINE_LEVER, HALF_MARKS_LEVER]), 'whole_not_half'))
      .toBe(SHORTER_SHAPE_LEVER);
    const conv = itemsOf(session('convert', [4]))[0];
    expect(nextLever(MEASUREMENT_LEVERS.declare(conv, CONVERTING, [INCH_MODEL_LEVER]), 'same_number')).toBe(SMALLER_LENGTH_LEVER);
    const order = itemsOf(session('compare', [4, 6, 5])).at(-1)!;
    expect(nextLever(MEASUREMENT_LEVERS.declare(order, PLACED, [OWN_LENGTHS_LEVER]), 'two_swapped')).toBe(THREE_SHAPES_LEVER);
  });

  it.each(MODES)('%s: every catalog miss is answered by a lever on some item of the mode', mode => {
    const declared = getComponentById('measurement-tools')!.teachingWorkspace!.misses![mode];
    const answered = new Set<string>();
    for (const data of sessions(mode)) for (const item of itemsOf(data)) for (const view of VIEWS)
      MEASUREMENT_LEVERS.declare(item, view, []).forEach(l => l.answers?.forEach(m => answered.add(m)));
    expect(declared.filter(m => !answered.has(m))).toEqual([]);
  });

  it('the order item is the session\'s last, and its levers answer only ordering misses', () => {
    const items = itemsOf(session('compare', [4, 6, 5]));
    expect(items.at(-1)!.id).toBe(ORDER_ITEM_ID);
    const answers = MEASUREMENT_LEVERS.declare(items.at(-1)!, PLACED, []).flatMap(l => l.answers ?? []);
    expect(new Set(answers)).toEqual(new Set(['longest_first', 'two_swapped', 'out_of_order']));
    expect(EMPTY_VIEW.order).toEqual([]);
  });
});
