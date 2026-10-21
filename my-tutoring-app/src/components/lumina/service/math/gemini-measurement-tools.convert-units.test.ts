import { describe, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { convertUnitsFor } from './gemini-measurement-tools';
import {
  conversionCorrect, conversionRule, convertValue, lessonOf, measurementMiss, measurementItems,
} from '../../primitives/visual-primitives/math/measurementToolsWorkspace';
import type { MeasurementToolsData } from '../../primitives/visual-primitives/math/MeasurementTools';

const MD4 = 'Know relative sizes of measurement units within one system of units including km, m, cm; kg, g; lb, oz.; l, ml; '
  + 'hr, min, sec. Within a single system of measurement, express measurements in a larger unit in terms of a smaller unit.';
const RP6 = 'Use ratio reasoning to convert measurement units; manipulate and transform units appropriately when multiplying or dividing quantities.';

/** measurement-tools convert (QUEUE 8.1d): the objective's grade sets the units. */
describe('convert units from the lesson', () => {
  it('4.MD.A.1 and 5.MD.A.1 stay within one system in every draw', () => {
    for (const grade of ['4', '5']) for (let i = 0; i < 40; i++) {
      const { unit, convertToUnit } = convertUnitsFor(grade, MD4);
      expect([['feet', 'inches'], ['meters', 'centimeters']]).toContainEqual([unit, convertToUnit]);
    }
  });
  it('a metric lesson converts meters to centimeters; a customary one feet to inches', () => {
    expect(convertUnitsFor('4', 'Convert meters to centimeters')).toEqual({ unit: 'meters', convertToUnit: 'centimeters' });
    expect(convertUnitsFor('4', 'How many inches in a foot?')).toEqual({ unit: 'feet', convertToUnit: 'inches' });
  });
  it('6.RP.3d, or an objective that asks between systems, converts inches and centimeters', () => {
    expect(convertUnitsFor('6', RP6)).toEqual({ unit: 'inches', convertToUnit: 'centimeters' });
    expect(convertUnitsFor('5', 'Convert inches to centimeters')).toEqual({ unit: 'inches', convertToUnit: 'centimeters' });
    expect(convertUnitsFor(undefined, 'Measure and convert')).not.toEqual({ unit: 'inches', convertToUnit: 'centimeters' });
  });
  it('checks a within-system conversion exactly and names its misses', () => {
    const data = { title: 't', challengeType: 'convert', unit: 'feet', convertToUnit: 'inches', rulerLengthInches: 12, precision: 'whole',
      challenges: [{ id: 'a', shapeType: 'rectangle', widthInches: 3, heightInches: 1, color: '', label: 'Red Rectangle', hint: '' }] } as MeasurementToolsData;
    const lesson = lessonOf(data);
    const [item] = measurementItems(lesson);
    const c = data.challenges[0];
    expect(conversionRule('feet', 'inches')).toBe('1 foot = 12 inches');
    expect(convertValue(3, 'feet', 'inches')).toBe(36);
    expect(conversionCorrect(c, lesson, 36)).toBe(true);
    expect(conversionCorrect(c, lesson, 34)).toBe(false);
    const miss = (v: number) => measurementMiss(item, lesson, { onRuler: true, measure: 3, convertStep: true, converted: v, order: [] });
    expect(miss(3)).toBe('same_number');
    expect(miss(0.25)).toBe('wrong_operation');
    expect(miss(30)).toBe('too_small');
    expect(miss(48)).toBe('too_large');
    expect(convertValue(2, 'meters', 'centimeters')).toBe(200);
  });
});
