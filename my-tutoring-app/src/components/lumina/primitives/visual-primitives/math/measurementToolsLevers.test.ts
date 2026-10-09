/**
 * measurement-tools levers: leak rules per mode, the simplify builders over every item shape the generator draws, and
 * "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { MeasurementToolsChallenge, MeasurementToolsData } from './MeasurementTools';
import {
  EDGE_LINE_LEVER, HALF_MARKS_LEVER, INCH_MODEL_LEVER, ORDER_STEPS_LEVER, OWN_LENGTHS_LEVER, SHORTER_SHAPE_LEVER,
  SMALLER_LENGTH_LEVER, SPACE_SHADING_LEVER, THREE_SHAPES_LEVER, leverFacts, leverTextLeaks, measurementLevers,
  practiceItem, practiceLeaks, practiceParent,
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
/** Every session shape the generator can draw: one per width, and compare's orderings of 3-6 shapes. */
function sessions(mode: Mode): MeasurementToolsData[] {
  const out = WIDTHS[mode].map(w => session(mode, [w]));
  if (mode === 'convert') out.push(...WIDTHS.convert.map(w => session(mode, [w], 'centimeters')));
  if (mode === 'compare') for (let n = 3; n <= 6; n++) for (let start = 0; start + n <= WIDTHS.compare.length; start++)
    out.push(session(mode, WIDTHS.compare.slice(start, start + n).reverse()), session(mode, [2, 5, 8, 4, 9, 6].slice(0, n)));
  return out;
}

describe('simplify builders', () => {
  it.each(MODES)('%s: same kind and mode, its own id, shorter or fewer, solvable, never the learner\'s item', mode => {
    let built = 0;
    for (const data of sessions(mode)) {
      const lesson = lessonOf(data);
      for (const item of measurementItems(mode, data.challenges)) {
        const p = practiceItem(item, lesson);
        if (!p) continue;
        built++;
        expect(practiceParent(p.id)).toBe(item.id);
        expect(practiceLeaks(item, p, lesson)).toBe(false);
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
        expect(practiceItem(p, lesson)).toBeNull();
      }
    }
    expect(built).toBeGreaterThan(3);
  });

  it('the leak rule rejects the learner\'s own item, its length and a sorted listing', () => {
    const data = session('measure', [6]), lesson = lessonOf(data);
    const item = measurementItems('measure', data.challenges)[0] as Extract<MeasurementItem, { kind: 'shape' }>;
    const p = practiceItem(item, lesson) as Extract<MeasurementItem, { kind: 'shape' }>;
    expect(practiceLeaks(item, { ...p, id: item.id }, lesson)).toBe(true);
    expect(practiceLeaks(item, { ...p, challenge: { ...p.challenge, widthInches: 6 } }, lesson)).toBe(true);
    expect(practiceLeaks(item, { ...p, challenge: { ...p.challenge, label: 'Blue Rectangle' } }, lesson)).toBe(true);
    const cmp = session('compare', [3, 4, 5, 6]), cl = lessonOf(cmp);
    const order = measurementItems('compare', cmp.challenges).at(-1)!;
    const po = practiceItem(order, cl) as Extract<MeasurementItem, { kind: 'order' }>;
    const sorted = [...po.shapes!].sort((a, b) => a.widthInches - b.widthInches);
    // orderChoices moves the first of a sorted list last, so a sorted practice still lists out of order; the rule
    // catches what would be listed in order (two equal widths here make it unsolvable as well).
    expect(practiceLeaks(order, { ...po, shapes: sorted.map(s => ({ ...s, widthInches: 4 })) }, cl)).toBe(true);
  });

  it('a short shape has no shorter practice, and cm-to-inch converts only above five', () => {
    expect(practiceItem(measurementItems('measure', [shape(0, 2)])[0], lessonOf(session('measure', [2])))).toBeNull();
    expect(practiceItem(measurementItems('estimate', [shape(0, 2.5)])[0], lessonOf(session('estimate', [2.5])))).not.toBeNull();
    expect(practiceItem(measurementItems('convert', [shape(0, 4)])[0], lessonOf(session('convert', [4], 'centimeters')))).toBeNull();
    // Three shapes far apart are already the easy set.
    const far = session('compare', [2, 5, 8]);
    expect(practiceItem(measurementItems('compare', far.challenges).at(-1)!, lessonOf(far))).toBeNull();
  });
});

describe('leak rules', () => {
  it.each(MODES)('%s: no lever text or scene fact carries a digit', mode => {
    for (const data of sessions(mode)) {
      const lesson = lessonOf(data);
      for (const item of measurementItems(mode, data.challenges)) for (const convertStep of [false, true]) {
        const levers = measurementLevers(item, lesson, [], { convertStep });
        for (const l of levers) {
          expect(leverTextLeaks(l.does)).toBe(false);
          expect(leverTextLeaks(l.when)).toBe(false);
        }
        expect(leverTextLeaks(leverFacts(item, levers.map(l => l.id), { convertStep }))).toBe(false);
      }
    }
  });

  it('no lever on a practice item', () => {
    const data = session('measure', [6]), lesson = lessonOf(data);
    const p = practiceItem(measurementItems('measure', data.challenges)[0], lesson)!;
    expect(measurementLevers(p, lesson, [], { convertStep: false })).toEqual([]);
    expect(leverFacts(p, [EDGE_LINE_LEVER], { convertStep: false })).toBe('');
  });
});

describe('this wrong answer, then this lever', () => {
  const ids = (mode: Mode, widths: number[], itemAt: number, convertStep = false) => {
    const data = session(mode, widths), lesson = lessonOf(data);
    return measurementLevers(measurementItems(mode, data.challenges).at(itemAt)!, lesson, [], { convertStep });
  };
  it.each<[Mode, number[], number, boolean, MeasurementMiss, string]>([
    ['measure', [6], 0, false, 'one_over', SPACE_SHADING_LEVER],
    ['measure', [6], 0, false, 'one_short', SPACE_SHADING_LEVER],
    ['measure', [6], 0, false, 'too_long', EDGE_LINE_LEVER],
    ['measure', [6], 0, false, 'too_short', EDGE_LINE_LEVER],
    ['estimate', [6.5], 0, false, 'whole_not_half', EDGE_LINE_LEVER],
    ['convert', [4], 0, true, 'same_number', INCH_MODEL_LEVER],
    ['convert', [4], 0, true, 'wrong_operation', INCH_MODEL_LEVER],
    ['convert', [4], 0, true, 'too_small', INCH_MODEL_LEVER],
    ['convert', [4], 0, false, 'too_short', EDGE_LINE_LEVER],
    ['compare', [4, 6, 5], -1, false, 'longest_first', ORDER_STEPS_LEVER],
    ['compare', [4, 6, 5], -1, false, 'two_swapped', OWN_LENGTHS_LEVER],
    ['compare', [4, 6, 5], -1, false, 'out_of_order', OWN_LENGTHS_LEVER],
  ])('%s %j: %s then %s', (mode, widths, at, convertStep, miss, lever) => {
    expect(nextLever(ids(mode, widths, at, convertStep), miss)).toBe(lever);
  });

  it('a pulled help moves the next pull on: then half marks, then the simpler item', () => {
    const data = session('estimate', [6.5]), lesson = lessonOf(data), item = measurementItems('estimate', data.challenges)[0];
    expect(nextLever(measurementLevers(item, lesson, [EDGE_LINE_LEVER], { convertStep: false }), 'whole_not_half')).toBe(HALF_MARKS_LEVER);
    expect(nextLever(measurementLevers(item, lesson, [EDGE_LINE_LEVER, HALF_MARKS_LEVER], { convertStep: false }), 'whole_not_half'))
      .toBe(SHORTER_SHAPE_LEVER);
    const conv = session('convert', [4]), cl = lessonOf(conv);
    expect(nextLever(measurementLevers(measurementItems('convert', conv.challenges)[0], cl, [INCH_MODEL_LEVER], { convertStep: true }),
      'same_number')).toBe(SMALLER_LENGTH_LEVER);
    const cmp = session('compare', [4, 6, 5]), ml = lessonOf(cmp);
    expect(nextLever(measurementLevers(measurementItems('compare', cmp.challenges).at(-1)!, ml, [OWN_LENGTHS_LEVER], { convertStep: false }),
      'two_swapped')).toBe(THREE_SHAPES_LEVER);
  });

  it.each(MODES)('%s: every catalog miss is answered by a lever on some item of the mode', mode => {
    const declared = getComponentById('measurement-tools')!.teachingWorkspace!.misses![mode];
    const answered = new Set<string>();
    for (const data of sessions(mode)) {
      const lesson = lessonOf(data);
      for (const item of measurementItems(mode, data.challenges)) for (const convertStep of [false, true])
        measurementLevers(item, lesson, [], { convertStep }).forEach(l => l.answers?.forEach(m => answered.add(m)));
    }
    expect(declared.filter(m => !answered.has(m))).toEqual([]);
  });

  it('the order item is the session\'s last, and its levers answer only ordering misses', () => {
    const cmp = session('compare', [4, 6, 5]);
    const items = measurementItems('compare', cmp.challenges);
    expect(items.at(-1)!.id).toBe(ORDER_ITEM_ID);
    const answers = measurementLevers(items.at(-1)!, lessonOf(cmp), [], { convertStep: false }).flatMap(l => l.answers ?? []);
    expect(new Set(answers)).toEqual(new Set(['longest_first', 'two_swapped', 'out_of_order']));
    expect(EMPTY_VIEW.order).toEqual([]);
  });
});
