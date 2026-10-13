import { describe, expect, it } from 'vitest';
import { compileExpr } from './drawerExpr';
import {
  causeChainProblems, modelSliderProblems, partWholeProblems, propagate, waffleCells,
  type DrawerCauseChainData, type DrawerModelSliderData, type DrawerPartWholeData,
} from './drawerSpecs';

describe('compileExpr', () => {
  it('follows precedence and right-associative powers', () => {
    expect(compileExpr('1 + 2 * 3')({})).toBe(7);
    expect(compileExpr('2^3^2')({})).toBe(512);
    expect(compileExpr('-2^2')({})).toBe(-4);
    expect(compileExpr('(v/3.6)^2/(2*mu*9.8)')({ v: 36, mu: 0.5 })).toBeCloseTo(10.204, 3);
    expect(compileExpr('max(a, b, 3)')({ a: 1, b: 2 })).toBe(3);
  });
  it('rejects names it was not given and anything that is not arithmetic', () => {
    expect(() => compileExpr('x + 1')({})).toThrow(/Unknown name/);
    expect(() => compileExpr('alert(1)')).toThrow(/Unknown function/);
    expect(() => compileExpr('a.constructor')).toThrow();
    expect(() => compileExpr('a[0]')).toThrow();
    expect(() => compileExpr('constructor')({})).toThrow(/Unknown name/);
    expect(() => compileExpr('1 +')).toThrow();
  });
});

const stopping = (): DrawerModelSliderData => ({
  title: 'Stopping distance', caption: 'Braking grows with speed squared.',
  inputs: [
    { id: 'v', label: 'Speed', unit: 'km/h', min: 20, max: 120, step: 5, value: 80 },
    { id: 'mu', label: 'Road grip', unit: '', min: 0.1, max: 0.8, step: 0.1, value: 0.7 },
  ],
  outputs: [
    { id: 'think', label: 'Thinking distance', unit: 'm', expr: 'v/3.6*1', digits: 1 },
    { id: 'brake', label: 'Braking distance', unit: 'm', expr: '(v/3.6)^2/(2*mu*9.8)', digits: 1 },
    { id: 'total', label: 'Total', unit: 'm', expr: 'think + brake', digits: 0, primary: true },
  ],
  barParts: ['think', 'brake'],
  check: { set: { v: 50, mu: 0.7 }, output: 'total', expect: 28, tolerance: 0.5, fact: 'At 50 km/h on a dry road a car needs about 28 m to stop.' },
});

describe('model-slider checks', () => {
  it('passes a correct spec', () => expect(modelSliderProblems(stopping())).toEqual([]));
  it('drops a spec whose formula contradicts its own fact', () => {
    const d = stopping(); d.outputs[1].expr = '(v/3.6)/(2*mu*9.8)';
    expect(modelSliderProblems(d).join()).toMatch(/check failed/);
  });
  it('drops a formula that divides by zero somewhere on the sliders', () => {
    const d = stopping(); d.inputs[1].min = 0; d.check.set = { v: 50, mu: 0.7 };
    expect(modelSliderProblems(d).join()).toMatch(/not a number/);
  });
  it('drops a check placed at the starting values', () => {
    const d = stopping(); d.check = { ...d.check, set: { v: 50, mu: 0.7 } };
    d.inputs[0].value = 50; d.inputs[1].value = 0.7;
    expect(modelSliderProblems(d).join()).toMatch(/different from the starting/);
  });
  it('drops a tolerance wide enough to pass anything', () => {
    const d = stopping(); d.check.expect = 31; d.check.tolerance = 10;
    expect(modelSliderProblems(d).join()).toMatch(/check failed/);
  });
  it('drops an output that uses a name it was not given', () => {
    const d = stopping(); d.outputs[0].expr = 'v * t';
    expect(modelSliderProblems(d).join()).toMatch(/Unknown name "t"/);
  });
});

const air = (): DrawerPartWholeData => ({
  title: 'What is air made of?', caption: 'Open the smallest slice.', wholeLabel: 'the air', unit: '%', total: 100,
  parts: [
    { label: 'Nitrogen', value: 78.08, parent: '' }, { label: 'Oxygen', value: 20.95, parent: '' },
    { label: 'Everything else', value: 0.97, parent: '' },
    { label: 'Argon', value: 0.93, parent: 'Everything else' }, { label: 'Carbon dioxide', value: 0.04, parent: 'Everything else' },
  ],
});

describe('part-whole checks', () => {
  it('passes a correct spec and fills exactly 100 squares', () => {
    expect(partWholeProblems(air())).toEqual([]);
    expect(waffleCells(air())).toEqual([78, 21, 1]);
  });
  it('drops parts that do not add up to the whole', () => {
    const d = air(); d.parts[0].value = 70;
    expect(partWholeProblems(d).join()).toMatch(/sum to/);
  });
  it('drops a breakdown that does not add up to its part', () => {
    const d = air(); d.parts[4].value = 0.4;
    expect(partWholeProblems(d).join()).toMatch(/breakdown of "Everything else"/);
  });
});

const otters = (): DrawerCauseChainData => ({
  title: 'Sea otters and kelp', caption: 'A change travels down the food chain.',
  nodes: [{ id: 'otter', label: 'Sea otters' }, { id: 'urchin', label: 'Sea urchins' }, { id: 'kelp', label: 'Kelp' }],
  links: [
    { from: 'otter', to: 'urchin', effect: 'opposite', because: 'Sea otters eat sea urchins' },
    { from: 'urchin', to: 'kelp', effect: 'opposite', because: 'Sea urchins chew kelp' },
  ],
});

describe('cause-chain checks', () => {
  it('passes a correct spec and propagates signs', () => {
    expect(causeChainProblems(otters())).toEqual([]);
    expect(propagate(otters(), -1)).toEqual([-1, 1, -1]);
  });
  it('drops links out of order', () => {
    const d = otters(); d.links.reverse();
    expect(causeChainProblems(d).join()).toMatch(/must join/);
  });
});
