/**
 * ratio-table levers: the leak rules per mode, the simplify builder over many item shapes, and "this wrong answer,
 * then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { RatioTableChallenge } from './RatioTable';
import {
  ARROWS_LEVER, BANNER_LEVER, BAR_CHART_LEVER, DIVISION_LEVER, GROUPS_LEVER, MODEL_LEVER, SIMPLER_LEVER,
  divisionRow, leverFacts, leverTextLeaks, practiceLeaks, ratioLevers, ratioModel, simplerRatio,
} from './ratioTableLevers';
import { RATIO_MISSES_BY_MODE, RATIO_MODE_TYPES, buildRatioAsk, formatNum, ratioCorrect, ratioKey, ratioMiss } from './ratioTableWorkspace';

const labels: [string, string] = ['Cups of Flour', 'Cookies'];
/** Whole and decimal bases, whole and decimal multipliers, as the generator draws them (payloads 2026-10-09). */
function items(type: RatioTableChallenge['type']): RatioTableChallenge[] {
  const out: RatioTableChallenge[] = [];
  const bases: Array<[number, number]> = [[2, 6], [3, 12], [4, 1.5], [3, 42.75], [2.5, 125.5], [5, 12.5], [4, 52], [15, 225],
    [3.5, 350], [80, 12], [5, 8], [2.5, 45], [3.2, 12.8], [1, 12], [6, 48], [4, 25], [12, 45], [8, 150]];
  const ks = type === 'unit-rate' ? [1] : [2, 2.5, 3, 3.5, 4, 4.5, 2.4, 2.8, 7.5];
  for (const [a, b] of bases) for (const k of ks) for (const hidden of type === 'missing-value' ? ['scaled-first', 'scaled-second'] as const : [undefined]) {
    const c: RatioTableChallenge = { id: `${type}-${a}-${b}-${k}-${hidden ?? ''}`, type, baseRatio: [a, b], rowLabels: labels,
      targetMultiplier: k, hint: '', instruction: `Ratio ${a} to ${b}.`, ...(hidden ? { hiddenValue: hidden } : {}) };
    if (type === 'build-ratio') c.instruction = buildRatioAsk(c);
    out.push(c);
  }
  return out;
}
const MODES = Object.entries(RATIO_MODE_TYPES);

describe('simplify builder', () => {
  it.each(MODES)('%s: same mode, its own id and ask, a different base and answer, solvable, deterministic', (_mode, type) => {
    let built = 0;
    for (const c of items(type)) {
      const s = simplerRatio(c);
      if (!s) continue;
      built++;
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(s.type).toBe(c.type);
      expect(practiceLeaks(c, s)).toBe(false);
      expect(s.baseRatio.every(Number.isInteger)).toBe(true);
      expect(Number.isInteger(ratioKey(s))).toBe(true);
      // Its own check accepts its own key, and its ask states what to find without the answer.
      expect(ratioCorrect(s, { typed: String(ratioKey(s)), multiplier: ratioKey(s) })).toBe(true);
      if (type === 'build-ratio' || type === 'find-multiplier') expect(s.instruction).not.toMatch(new RegExp(`multiplied by ${s.targetMultiplier}|factor`));
      expect(simplerRatio(c)).toEqual(s);
      expect(simplerRatio(s)).toBeNull();
    }
    expect(built).toBeGreaterThan(type === 'unit-rate' ? 10 : 20);
  });

  it('an item already on small whole numbers has no easier version', () => {
    expect(simplerRatio({ ...items('missing-value')[0], baseRatio: [2, 6], targetMultiplier: 2 })).toBeNull();
    expect(simplerRatio({ ...items('unit-rate')[0], baseRatio: [3, 12] })).toBeNull();
  });

  it('the leak rule refuses the learner\'s own base, ask and answer', () => {
    const parent = items('missing-value').find(c => c.baseRatio[0] === 4 && c.baseRatio[1] === 25 && c.targetMultiplier === 3.5)!;
    const kid = simplerRatio(parent)!;
    expect(practiceLeaks(parent, { ...kid, baseRatio: parent.baseRatio })).toBe(true);
    expect(practiceLeaks(parent, { ...kid, instruction: parent.instruction })).toBe(true);
    expect(practiceLeaks(parent, { ...kid, type: 'unit-rate' })).toBe(true);
  });
});

describe('declarations', () => {
  it.each(MODES)('%s: every catalog miss is answered by a help lever on every item; no lever text or fact carries a digit; the model and frame never write the key', (mode, type) => {
    const misses = getComponentById('ratio-table')!.teachingWorkspace!.misses![mode];
    expect(misses).toEqual(RATIO_MISSES_BY_MODE[mode]);
    for (const c of items(type)) for (const barChartShown of [false, true]) for (const bannerOn of [false, true]) {
      const levers = ratioLevers(c, [], { barChartShown, bannerOn });
      const help = levers.filter(l => l.kind === 'help');
      for (const miss of misses) expect(help.some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), l.id).toBe(false);
      expect(leverTextLeaks(leverFacts(c, levers.map(l => l.id)))).toBe(false);
      const key = formatNum(ratioKey(c));
      const model = ratioModel(c);
      if (model) expect([...model.from, ...model.to, model.by].map(formatNum)).not.toContain(key);
      const row = divisionRow(c);
      if (row) expect(row.map(formatNum)).not.toContain(key);
      // The banner is never offered where its number would be the answer.
      if (levers.some(l => l.id === BANNER_LEVER)) expect(formatNum(c.baseRatio[1] / c.baseRatio[0])).not.toBe(key);
    }
  });

  it('the bar chart and banner are offered only where the session does not draw them; a practice problem has no levers', () => {
    const c = items('missing-value').find(x => x.baseRatio[0] === 3 && x.baseRatio[1] === 12 && x.targetMultiplier === 2.5)!;
    expect(ratioLevers(c, [], { barChartShown: false, bannerOn: false }).map(l => l.id))
      .toEqual([BAR_CHART_LEVER, BANNER_LEVER, ARROWS_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(ratioLevers(c, [], { barChartShown: true, bannerOn: true }).map(l => l.id)).toEqual([ARROWS_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(ratioLevers(simplerRatio(c)!, [], { barChartShown: false, bannerOn: false })).toEqual([]);
  });

  // "This wrong answer, then this lever": the number typed (or the slider), the miss, the first open lever.
  const ctx = { barChartShown: true, bannerOn: true };
  const find = (type: RatioTableChallenge['type'], a: number, b: number, k: number, hidden?: string) =>
    items(type).find(c => c.baseRatio[0] === a && c.baseRatio[1] === b && c.targetMultiplier === k && (c.hiddenValue ?? undefined) === hidden)!;
  it.each([
    ['missing-value', [3, 12, 2, 'scaled-second'], '15', 0, 'added_difference', ARROWS_LEVER],
    ['missing-value', [3, 12, 2, 'scaled-second'], '4', 0, 'unit_rate', ARROWS_LEVER],
    ['find-multiplier', [5, 8, 4.5, undefined], '17.5', 0, 'difference', ARROWS_LEVER],
    ['find-multiplier', [5, 8, 4.5, undefined], '0.22', 0, 'inverse', DIVISION_LEVER],
    ['unit-rate', [4, 52, 1, undefined], '0.08', 0, 'inverse_rate', GROUPS_LEVER],
    ['unit-rate', [80, 12, 1, undefined], '6.67', 0, 'inverse_rate', MODEL_LEVER],
    ['build-ratio', [3, 12, 3.5, undefined], '', 4.5, 'one_step_off', ARROWS_LEVER],
  ] as const)('%s %j typed %s / slider %d: %s, then %s', (type, [a, b, k, hidden], typed, multiplier, miss, lever) => {
    const c = find(type, a, b, k, hidden);
    expect(ratioMiss(c, { typed, multiplier })).toBe(miss);
    expect(nextLever(ratioLevers(c, [], ctx), miss)).toBe(lever);
  });

  it('with the first lever pulled, the next one for the same miss comes up', () => {
    const c = find('missing-value', 3, 12, 2, 'scaled-second');
    expect(nextLever(ratioLevers(c, [ARROWS_LEVER], ctx), 'added_difference')).toBe(MODEL_LEVER);
  });
});
