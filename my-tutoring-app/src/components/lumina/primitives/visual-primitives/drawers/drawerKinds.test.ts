import { describe, expect, it } from 'vitest';
import { FIXTURES } from './drawerFixtures';
import { bandScaleProblems, ladderItems, magnitudeLadderProblems, metricSwitchProblems, rangeBarsProblems, rangeIsLog } from './scaleSpecs';
import {
  chanceDistribution, chanceRunProblems, crossingX, formatAmount, growthRaceProblems, ratioScalerProblems, scaleFactor,
  unitChainProblems, unitChainValues,
} from './growthSpecs';
import {
  cycleWheelProblems, formFor, perspectiveLensProblems, rhythmCounts, rhythmGridProblems, shadesOfMeaningProblems,
  storyArcProblems, thenAndNowProblems, wordAnatomyProblems,
} from './textSpecs';

const F = FIXTURES;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('every fixture passes its checks', () => {
  it.each([
    ['magnitude-ladder', () => magnitudeLadderProblems(F['magnitude-ladder'])],
    ['band-scale', () => bandScaleProblems(F['band-scale'])],
    ['range-bars', () => rangeBarsProblems(F['range-bars'])],
    ['metric-switch', () => metricSwitchProblems(F['metric-switch'])],
    ['unit-chain', () => unitChainProblems(F['unit-chain'])],
    ['ratio-scaler', () => ratioScalerProblems(F['ratio-scaler'])],
    ['growth-race', () => growthRaceProblems(F['growth-race'])],
    ['chance-run', () => chanceRunProblems(F['chance-run'])],
    ['cycle-wheel', () => cycleWheelProblems(F['cycle-wheel'])],
    ['story-arc', () => storyArcProblems(F['story-arc'])],
    ['then-and-now', () => thenAndNowProblems(F['then-and-now'])],
    ['perspective-lens', () => perspectiveLensProblems(F['perspective-lens'])],
    ['word-anatomy', () => wordAnatomyProblems(F['word-anatomy'])],
    ['shades-of-meaning', () => shadesOfMeaningProblems(F['shades-of-meaning'])],
    ['rhythm-grid', () => rhythmGridProblems(F['rhythm-grid'])],
  ])('%s', (_k, problems) => { expect(problems()).toEqual([]); });
});

describe('checks catch what a renderer would draw wrong', () => {
  it('magnitude ladder: sorts itself, and refuses a span too small for the scale switch', () => {
    expect(ladderItems(F['magnitude-ladder']).map(x => x.label)[0]).toBe('Red blood cell');
    const d = clone(F['magnitude-ladder']); d.items = d.items.map(x => ({ ...x, value: 1 + x.value / 1e9 }));
    expect(magnitudeLadderProblems(d).join()).toMatch(/1000 times/);
  });
  it('band scale: gaps between bands and broken formulas', () => {
    const gap = clone(F['band-scale']); gap.bands[1].from = 6.8;
    expect(bandScaleProblems(gap).join()).toMatch(/must start where/);
    const bad = clone(F['band-scale']); bad.bands[0].text = '{10^(7-y)} times';
    expect(bandScaleProblems(bad).join()).toMatch(/formula fails/);
  });
  it('range bars: log scale chosen by code; a range outside the scale', () => {
    expect(rangeIsLog(F['range-bars'])).toBe(true);
    const d = clone(F['range-bars']); d.items[0].to = 200000;
    expect(rangeBarsProblems(d).join()).toMatch(/must fit/);
  });
  it('metric switch: refuses metrics that rank identically', () => {
    const d = clone(F['metric-switch']); d.items.forEach(x => { x.values[1] = x.values[0] / 1000; });
    expect(metricSwitchProblems(d).join()).toMatch(/same order/);
  });
  it('unit chain: computes the product and catches a wrong fact', () => {
    expect(unitChainValues(F['unit-chain'], { bpm: 70, years: 80 }).at(-1)).toBe(2943360000);
    const d = clone(F['unit-chain']); d.check.expect = 3e9 * 1.2;
    expect(unitChainProblems(d).join()).toMatch(/check failed/);
  });
  it('ratio scaler: fractions read like a recipe', () => {
    expect(scaleFactor(12, 8)).toBe('3/2');
    expect(formatAmount(0.75 * 1.5)).toBe('1 1/8');
    expect(formatAmount(1.5)).toBe('1 1/2');
    expect(formatAmount(2)).toBe('2');
    const d = clone(F['ratio-scaler']); d.base = 40;
    expect(ratioScalerProblems(d).join()).toMatch(/base must be inside/);
  });
  it('growth race: finds the crossing and refuses a race with none', () => {
    expect(crossingX(F['growth-race'])).toBe(14); // day 13: $130 vs $81.91; day 14: $140 vs $163.83
    const d = clone(F['growth-race']); d.series[1].expr = '0.01*x';
    expect(growthRaceProblems(d).join()).toMatch(/never overtakes/);
    // The multiplying series ahead at the start, briefly behind, then ahead: not a race that reads true.
    const e = clone(F['growth-race']); e.min = 0; e.series = [{ label: 'Raise', expr: '5000*x' }, { label: 'Compound', expr: '1000*1.1^x' }]; e.max = 50;
    expect(growthRaceProblems(e).join()).toMatch(/must be ahead/);
  });
  it('chance run: exact distribution; non-numbers cannot be summed', () => {
    const dist = chanceDistribution(F['chance-run']);
    expect(dist.find(x => x.key === '7')?.p).toBeCloseTo(6 / 36);
    expect(dist.reduce((s, x) => s + x.p, 0)).toBeCloseTo(1);
    const coins = { ...clone(F['chance-run']), combine: 'together' as const, sources: [{ label: 'A', outcomes: ['H', 'T'] }, { label: 'B', outcomes: ['H', 'T'] }] };
    expect(chanceDistribution(coins).find(x => x.key === 'H + T')?.p).toBeCloseTo(0.5);
    expect(chanceRunProblems({ ...coins, combine: 'sum' }).join()).toMatch(/must be numbers/);
  });
  it('perspective lens: every viewpoint answers every question', () => {
    const d = clone(F['perspective-lens']); d.views[1].answers.pop();
    expect(perspectiveLensProblems(d).join()).toMatch(/must answer all 2/);
  });
  it('word anatomy: finds a form by its pieces in any order; refuses a word without the root', () => {
    expect(formFor(F['word-anatomy'], ['able', 'break'])?.word).toBe('breakable');
    expect(formFor(F['word-anatomy'], ['un', 'break'])).toBeNull();
    const d = clone(F['word-anatomy']); d.forms[1].word = 'capable';
    expect(wordAnatomyProblems(d).join()).toMatch(/does not contain the root/);
  });
  it('then and now: a row that says the same thing twice must be marked same', () => {
    const d = clone(F['then-and-now']); d.rows[0].now = 'Oil lamps';
    expect(thenAndNowProblems(d).join()).toMatch(/not marked same/);
  });
  it('story arc, cycle wheel, shades: structure', () => {
    const s = clone(F['story-arc']); s.events.climax = '';
    expect(storyArcProblems(s).join()).toMatch(/Big moment/);
    const c = clone(F['cycle-wheel']); c.stages = c.stages.slice(0, 2);
    expect(cycleWheelProblems(c).join()).toMatch(/3-8/);
    const w = clone(F['shades-of-meaning']); w.frame = 'No blank here.';
    expect(shadesOfMeaningProblems(w).join()).toMatch(/exactly one/);
  });
  it('rhythm grid: counts and pattern length', () => {
    expect(rhythmCounts(F['rhythm-grid'])).toEqual(['1', '&', '2', '&', '3', '&', '4', '&']);
    const d = clone(F['rhythm-grid']); d.tracks[0].pattern = 'xx..';
    expect(rhythmGridProblems(d).join()).toMatch(/8 characters/);
  });
});
