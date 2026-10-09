/**
 * ramp-lab levers (`rampLabLevers.ts`): each leak rule per mode, each simplify builder over every pool and saved-payload
 * item, the "this miss, then this lever" table, and per-item coverage of every catalog miss (journey J12, offline).
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import {
  changedRampVariables, isFairRampTest, maxWorkableAngle, measureRampTrial, minimumPushSetting, requiredPushForce,
  selectRampChallenges, type RampChallenge, type RampInvestigationChallenge,
} from './rampChallenges';
import {
  BOTH_RAMPS_LEVER, FEWER_ANGLES_LEVER, LIGHTER_LOAD_LEVER, MODEL_EXPLAIN_LEVER, MODEL_PAIR_LEVER, MODEL_PLAN_LEVER,
  PUSH_BARS_LEVER, SAME_OR_CHANGED_LEVER, TEST_LOG_LEVER, TWO_SETTINGS_LEVER, VARIABLE_NAME, fewerAngles, leverFacts,
  lighterLoad, modelFor, practiceFromId, pushBars, rampLevers, rampSketches, settingMarks, simplerRamp, startLevers, testLog,
  testLogLeaks, twoSettings,
} from './rampLabLevers';
import { rampSpokenMisses } from './rampLabWorkspace';

const MODES = ['compare_conditions', 'find_threshold', 'plan_fair_test', 'design_with_budget', 'explain_from_trials'] as const;
const POOL = selectRampChallenges(MODES, 99);
const DIR = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
const PAYLOAD_ITEMS: RampChallenge[] = readdirSync(DIR).filter(f => f.startsWith('ramp-lab.'))
  .flatMap(f => (JSON.parse(readFileSync(join(DIR, f), 'utf-8')).data.challenges ?? []) as RampChallenge[]);
const ALL = [...POOL, ...PAYLOAD_ITEMS];
const of = <M extends RampChallenge['mode']>(mode: M) => ALL.filter(c => c.mode === mode) as Array<RampChallenge & { mode: M }>;
const CATALOG = getComponentById('ramp-lab')!.teachingWorkspace!;
const RANKING = /\b(less|more|easier|harder|smaller|bigger|larger|lower|higher)\b/i;

describe('leak rules', () => {
  it('test_log shows only what the learner tested, each with what the lab showed', () => {
    for (const c of of('find_threshold')) {
      const answer = minimumPushSetting(c.scenario, c.forceStep);
      const tested = [answer - 2 * c.forceStep, answer + c.forceStep, answer - 2 * c.forceStep];
      const log = testLog(c, tested);
      expect(testLogLeaks(log, tested)).toBe(false);
      expect(log.map(e => e.value)).toEqual([answer - 2 * c.forceStep, answer + c.forceStep]);
      expect(log.map(e => e.result)).toEqual(['stayed still', 'moved']);
      expect(leverFacts(c, [TEST_LOG_LEVER], { tested })).not.toContain(answer.toFixed(1));
    }
    for (const c of of('design_with_budget')) {
      const answer = maxWorkableAngle(c.scenario, c.forceBudget, c.angleRange);
      const log = testLog(c, [answer + 3, answer - 2]);
      expect(log).toEqual([{ value: answer - 2, result: 'climbs' }, { value: answer + 3, result: 'too steep' }]);
      expect(leverFacts(c, [TEST_LOG_LEVER], { tested: [answer + 3, answer - 2] })).not.toMatch(new RegExp(`\\b${answer} degrees`));
    }
  });

  it('both_ramps draws the setups as given: no force, no ranking word', () => {
    for (const c of of('compare_conditions')) {
      const sketches = rampSketches(c);
      expect(sketches.map(s => s.angle)).toEqual([c.scenarios.a.angle, c.scenarios.b.angle]);
      for (const s of sketches) expect(Object.keys(s).sort()).toEqual(['angle', 'load', 'mass', 'side', 'surface']);
      const fact = leverFacts(c, [BOTH_RAMPS_LEVER], {});
      expect(fact).not.toMatch(RANKING);
      expect(fact).not.toMatch(/\d N\b|newton/);
    }
  });

  it('every model is on a condition the item does not touch, and its two setups differ only in it', () => {
    for (const c of ALL) {
      const model = modelFor(c)!;
      expect(model).not.toBeNull();
      const changed = changedRampVariables(model.one, model.two);
      expect(changed).toHaveLength(1);
      if ('variable' in c) expect(model.variable).not.toBe(c.variable);
      if ('scenarios' in c) {
        const own = changedRampVariables(c.scenarios.a, c.scenarios.b);
        expect(own).not.toContain(changed[0]);
      }
      // A rolling-against-sliding swap is not modelled by a surface change.
      if (c.mode === 'compare_conditions' && c.changedVariable === 'load') expect(model.variable).not.toBe('surface');
      if (c.mode === 'compare_conditions' && c.changedVariable !== 'load') expect(model.variable).not.toBe(c.changedVariable);
    }
  });

  it('every model lever fences the tutor off the learner\'s item', () => {
    for (const c of ALL) for (const lever of rampLevers(c, []))
      if ([MODEL_PAIR_LEVER, MODEL_PLAN_LEVER, MODEL_EXPLAIN_LEVER].includes(lever.id)) expect(lever.does).toMatch(/never say/i);
  });

  it('the plan model never names the item\'s condition; same_or_changed tags every setting alike', () => {
    for (const c of of('plan_fair_test')) {
      expect(leverFacts(c, [MODEL_PLAN_LEVER], {})).not.toContain(VARIABLE_NAME[c.variable]);
      const a = c.scenarios.a;
      expect(settingMarks(a, a)).toEqual({ angle: 'same as A', mass: 'same as A', surface: 'same as A' });
      expect(settingMarks(a, { ...a, angle: a.angle === 15 ? 25 : 15, loadWeight: a.loadWeight + 2 }))
        .toEqual({ angle: 'changed', mass: 'changed', surface: 'same as A' });
      expect(leverFacts(c, [SAME_OR_CHANGED_LEVER], {})).not.toContain(VARIABLE_NAME[c.variable]);
    }
  });

  it('push_bars draws nothing before both trials, then the recorded trials with no ranking word', () => {
    for (const c of of('explain_from_trials')) {
      const a = measureRampTrial('a', c.scenarios.a), b = measureRampTrial('b', c.scenarios.b);
      expect(pushBars(c, [a])).toEqual([]);
      const bars = pushBars(c, [b, a]);
      expect(bars.map(x => [x.side, x.push])).toEqual([['a', a.firstMovingForce], ['b', b.firstMovingForce]]);
      expect(Math.max(...bars.map(x => x.widthPercent))).toBe(100);
      expect(leverFacts(c, [PUSH_BARS_LEVER], { trials: [a, b] })).not.toMatch(RANKING);
    }
  });
});

describe('simplify builders', () => {
  it('lighter_load: the same mode, a new id, a smaller whole-newton search on a different load', () => {
    for (const c of of('find_threshold')) {
      const p = lighterLoad(c)!;
      expect(p).toMatchObject({ id: `${c.id}~simpler`, mode: 'find_threshold', forceStep: 1 });
      expect(changedRampVariables(p.scenario, c.scenario).length).toBeGreaterThan(0);
      const answer = minimumPushSetting(p.scenario, 1);
      expect(answer).toBeLessThanOrEqual(8);
      expect(answer).not.toBe(minimumPushSetting(c.scenario, c.forceStep));
      expect(answer).toBeGreaterThan(requiredPushForce(p.scenario));
      expect(lighterLoad(p)).toBeNull();
    }
  });

  it('fewer_angles: the same mode, six angles, a unique steepest answer that is not the item\'s, a different load', () => {
    for (const c of of('design_with_budget')) {
      const p = fewerAngles(c)!;
      expect(p).toMatchObject({ id: `${c.id}~simpler`, mode: 'design_with_budget', targetHeight: c.targetHeight });
      expect(p.angleRange.max - p.angleRange.min).toBe(5);
      const answer = maxWorkableAngle(p.scenario, p.forceBudget, p.angleRange);
      expect(answer).toBeGreaterThan(p.angleRange.min);
      expect(answer).toBeLessThan(p.angleRange.max);
      expect(p.forceBudget).toBeGreaterThan(requiredPushForce({ ...p.scenario, angle: answer }));
      expect(p.forceBudget).toBeLessThan(requiredPushForce({ ...p.scenario, angle: answer + 1 }));
      expect(answer).not.toBe(maxWorkableAngle(c.scenario, c.forceBudget, c.angleRange));
      expect(p.scenario.angle).toBe(p.angleRange.max);
      expect(fewerAngles(p)).toBeNull();
    }
  });

  it('two_settings: the same mode, another condition, two editable settings, never the item\'s condition, solvable', () => {
    for (const c of of('plan_fair_test')) {
      const p = twoSettings(c)!;
      expect(p).toMatchObject({ id: `${c.id}~simpler`, mode: 'plan_fair_test' });
      expect(p.variable).not.toBe(c.variable);
      expect(p.editable).toHaveLength(2);
      expect(p.editable).toContain(p.variable);
      expect(p.editable).not.toContain(c.variable);
      expect(changedRampVariables(p.scenarios.a, c.scenarios.a).length).toBeGreaterThan(0);
      // Setup B starts as A, and a fair plan exists among the select options.
      expect(changedRampVariables(p.scenarios.a, p.scenarios.b)).toEqual([]);
      const fair = { angle: { angle: p.scenarios.a.angle === 25 ? 35 : 25 }, surface: { frictionLevel: p.scenarios.a.frictionLevel === 'high' ? 'low' : 'high' },
        mass: { loadWeight: p.scenarios.a.loadWeight === 6 ? 2 : 6 } }[p.variable] as object;
      expect(isFairRampTest(p.variable, p.scenarios.a, { ...p.scenarios.a, ...fair })).toBe(true);
      expect(twoSettings(p)).toBeNull();
    }
  });

  it('compare and explain have no simplify; practiceFromId rebuilds a practice item from its parent', () => {
    for (const c of [...of('compare_conditions'), ...of('explain_from_trials')]) expect(simplerRamp(c)).toBeNull();
    for (const c of [...of('find_threshold'), ...of('design_with_budget'), ...of('plan_fair_test')])
      expect(practiceFromId([c], `${c.id}~simpler`)).toEqual(simplerRamp(c));
  });
});

describe('which lever comes next', () => {
  const at = (mode: typeof MODES[number]) => POOL.find(c => c.mode === mode)!;
  it.each([
    ['compare_conditions', 'harder_setup', [], BOTH_RAMPS_LEVER], ['compare_conditions', 'harder_setup', [BOTH_RAMPS_LEVER], MODEL_PAIR_LEVER],
    ['find_threshold', 'load_did_not_move', [], TEST_LOG_LEVER], ['find_threshold', 'more_than_minimum', [TEST_LOG_LEVER], LIGHTER_LOAD_LEVER],
    ['design_with_budget', 'over_budget', [], TEST_LOG_LEVER], ['design_with_budget', 'not_steepest', [TEST_LOG_LEVER], FEWER_ANGLES_LEVER],
    ['plan_fair_test', 'nothing_changed', [], SAME_OR_CHANGED_LEVER], ['plan_fair_test', 'other_condition', [SAME_OR_CHANGED_LEVER], MODEL_PLAN_LEVER],
    ['plan_fair_test', 'nothing_changed', [SAME_OR_CHANGED_LEVER], TWO_SETTINGS_LEVER],
    ['explain_from_trials', 'reversed_comparison', [], PUSH_BARS_LEVER], ['explain_from_trials', 'one_setup', [PUSH_BARS_LEVER], MODEL_EXPLAIN_LEVER],
  ] as const)('%s: after %s with %j pulled, %s', (mode, miss, pulled, want) => {
    expect(nextLever(rampLevers(at(mode), pulled), miss)).toBe(want);
  });

  it('easy starts the self-checking help; medium and hard start bare', () => {
    expect(MODES.map(m => startLevers(at(m), 'easy'))).toEqual([[BOTH_RAMPS_LEVER], [TEST_LOG_LEVER], [SAME_OR_CHANGED_LEVER],
      [TEST_LOG_LEVER], [PUSH_BARS_LEVER]]);
    expect(MODES.flatMap(m => [...startLevers(at(m), 'medium'), ...startLevers(at(m), 'hard'), ...startLevers(at(m))])).toEqual([]);
  });
});

describe('coverage', () => {
  it('every catalog miss of every item (pool and saved payloads) is answered by a lever on that item', () => {
    for (const c of ALL) {
      const misses = CATALOG.misses?.[c.mode] ?? [];
      expect(misses.length).toBeGreaterThan(0);
      const levers = rampLevers(c, []);
      for (const miss of misses) expect(levers.some(l => l.answers?.includes(miss)), `${c.id}: ${miss}`).toBe(true);
    }
    expect(CATALOG.levers).toBe(true);
  });

  it('the spoken misses are the catalog\'s, and name the trials\' real direction', () => {
    for (const c of of('explain_from_trials') as RampInvestigationChallenge[]) {
      const misses = rampSpokenMisses(c);
      expect(misses.map(m => m.id)).toEqual(['reversed_comparison', 'said_same', 'one_setup']);
      for (const m of misses) expect(CATALOG.misses!.explain_from_trials).toContain(m.id);
      const a = measureRampTrial('a', c.scenarios.a).firstMovingForce, b = measureRampTrial('b', c.scenarios.b).firstMovingForce;
      expect(misses[0].pattern).toContain(`setup ${a < b ? 'A' : 'B'} needed less push`);
    }
  });
});
