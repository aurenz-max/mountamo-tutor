// @vitest-environment jsdom
/**
 * angle-workshop levers on the classic modes (`angleWorkshopLevers.ts`; make_angle's are in AngleWorkshop.workspace.test).
 * The misses `classicMiss` names, which lever answers each, every leak rule over generated items, every simpler-item
 * builder over generated lessons at every tier, and per mode, mounted the way a lesson mounts it: a help pull changes the
 * screen and the scene fact in one commit, a refused pull changes nothing, the next attempt records the lever, and the
 * simpler item is ungraded with the full item back blank and credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/service/geminiClient', () => ({ ai: {} }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { selectAngleWorkshopChallenges } from '../../../service/math/gemini-angle-workshop';
import type { AngleWorkshopChallenge, AngleWorkshopChallengeType } from './AngleWorkshop';
import { CLASSIC_MISSES, algebraicAngles, angleWorkshopHarnessInputs, classicMiss, solveTotal } from './angleWorkshopWorkspace';
import {
  BENCHMARK_LEVER, CORNERS_LEVER, EXTERIOR_LEVER, SIMPLER_LEVER, SLIDE_LEVER, STRAIGHT_ARCS_LEVER, TENS_LEVER, TRY_X_LEVER,
  WHOLE_LEVER, angleLeverFacts, angleWorkshopLevers, practiceFor, practiceLeaks, practiceParent, simplerItem, slideLeaks,
  tensLabels, tensLeak, tryYourX,
} from './angleWorkshopLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const base = { narration: 'A door swings open.', hint: 'Look at the figure.', tolerance: 1 };
const measure = (id: string, m: number): AngleWorkshopChallenge => ({ ...base, id, type: 'measure', instruction: 'Read the angle.',
  answerKind: 'degrees', angleMeasure: m, expectedAnswer: m, tolerance: 2 });
const classify = (id: string, rel: 'complementary' | 'supplementary' | 'vertical' | 'adjacent'): AngleWorkshopChallenge => ({
  ...base, id, type: 'classify_pairs', instruction: 'What is the relationship?', answerKind: 'relationship', relationship: rel,
  expectedRelationship: rel, splitAngle: 70, ...(rel === 'adjacent' ? { outerAngle: 140, splitAngle: 50 } : {}),
  ...(rel === 'vertical' ? { crossAngle: 55 } : {}), expectedAnswer: 0, tolerance: 0.5 });
const solve = (id: string, cfg: 'complementary' | 'supplementary' | 'vertical' | 'around_point', k: number, k2?: number): AngleWorkshopChallenge => {
  const total = { complementary: 90, supplementary: 180, around_point: 360, vertical: 0 }[cfg];
  return { ...base, id, type: 'solve_unknown', instruction: 'Find x.', answerKind: 'degrees', solveConfig: cfg, knownAngle: k,
    ...(k2 !== undefined ? { knownAngle2: k2 } : {}), expectedAnswer: cfg === 'vertical' ? k : total - k - (k2 ?? 0) };
};
const algebra = (id: string, cfg: 'complementary' | 'supplementary' | 'vertical', a1: number, b1: number, a2: number, b2: number, x: number):
  AngleWorkshopChallenge => ({ ...base, id, type: 'solve_algebraic', instruction: 'Solve for x.', answerKind: 'x_value', algConfig: cfg,
  a1, b1, a2, b2, expectedAnswer: x, tolerance: 0.01 });
const parallel = (id: string, rel: 'corresponding' | 'alternate_interior' | 'alternate_exterior' | 'co_interior', g: number): AngleWorkshopChallenge => ({
  ...base, id, type: 'transversal', instruction: 'Find x.', answerKind: 'degrees', transversalShape: 'parallel_transversal',
  transRelation: rel, givenAngle: g, expectedAnswer: rel === 'co_interior' ? 180 - g : g });
const triangle = (id: string, shape: 'triangle_sum' | 'exterior_angle', g1: number, g2: number): AngleWorkshopChallenge => ({
  ...base, id, type: 'transversal', instruction: 'Find x.', answerKind: 'degrees', transversalShape: shape, givenAngle: g1,
  givenAngle2: g2, expectedAnswer: shape === 'triangle_sum' ? 180 - g1 - g2 : g1 + g2 });
const lesson = (challenges: AngleWorkshopChallenge[]) => ({ title: 'Angles', description: '', challengeType: challenges[0].type, gradeBand: '7' as const, challenges });

const MODES: AngleWorkshopChallengeType[] = ['measure', 'classify_pairs', 'solve_unknown', 'solve_algebraic', 'transversal'];

/** Generated lessons of every classic mode at every tier (and none), from the production pool builder. */
function generated(rounds = 40): AngleWorkshopChallenge[] {
  const out: AngleWorkshopChallenge[] = [];
  for (let r = 0; r < rounds; r++) for (const mode of MODES) for (const tier of [null, 'easy', 'medium', 'hard'] as const) {
    out.push(...selectAngleWorkshopChallenges(mode, 6, tier).map(c => ({ ...c, id: `${mode}-${r}-${tier}-${c.id}` })));
  }
  return out;
}
const POOL = generated();

/** The answer a challenge's own figure fixes, recomputed from its fields (independent of `expectedAnswer`). */
function solved(c: AngleWorkshopChallenge): number {
  switch (c.type) {
    case 'measure': return c.angleMeasure!;
    case 'solve_unknown': return c.solveConfig === 'vertical' ? c.knownAngle! : solveTotal(c)! - c.knownAngle! - (c.knownAngle2 ?? 0);
    case 'solve_algebraic': {
      const a = c.a1! - (c.algConfig === 'vertical' ? c.a2! : -c.a2!), b = c.b1! - (c.algConfig === 'vertical' ? c.b2! : -c.b2!);
      const T = c.algConfig === 'vertical' ? 0 : c.algConfig === 'complementary' ? 90 : 180;
      return (T - b) / a;
    }
    case 'transversal':
      if (c.transversalShape === 'triangle_sum') return 180 - c.givenAngle! - c.givenAngle2!;
      if (c.transversalShape === 'exterior_angle') return c.givenAngle! + c.givenAngle2!;
      return c.transRelation === 'co_interior' ? 180 - c.givenAngle! : c.givenAngle!;
    default: return NaN;
  }
}

describe('the misses each wrong answer names', () => {
  it.each([
    [measure('m', 65), 115, 'other_scale'], [measure('m', 65), 70, 'near'], [measure('m', 65), 85, 'far'], [measure('m', 65), 66, undefined],
    [solve('s', 'supplementary', 50), 40, 'total_ninety'], [solve('s', 'complementary', 50), 130, 'total_one_eighty'],
    [solve('s', 'supplementary', 50), 50, 'copied_known'], [solve('s', 'vertical', 50), 130, 'total_one_eighty'],
    [solve('s', 'around_point', 120, 110), 240, 'one_known_left'], [solve('s', 'around_point', 120, 110), -50, 'total_one_eighty'],
    [solve('s', 'around_point', 120, 110), 125, 'near'], [solve('s', 'supplementary', 50), 100, 'far'],
    [algebra('a', 'supplementary', 2, 10, 1, 20, 50), 110, 'typed_an_angle'], [algebra('a', 'supplementary', 2, 10, 1, 20, 50), 20, 'total_ninety'],
    [algebra('a', 'vertical', 2, 10, 1, 20, 10), 50, 'total_one_eighty'], [algebra('a', 'supplementary', 2, 10, 1, 20, 50), 52, 'near'],
    [algebra('a', 'supplementary', 2, 10, 1, 20, 50), 53, 'far'],
    [parallel('t', 'corresponding', 70), 110, 'supplement_given'], [parallel('t', 'co_interior', 70), 70, 'copied_given'],
    [triangle('t', 'triangle_sum', 50, 60), 110, 'added_givens'], [triangle('t', 'triangle_sum', 50, 60), 130, 'one_given_left'],
    [triangle('t', 'triangle_sum', 50, 60), 60, 'copied_given'], [triangle('t', 'exterior_angle', 50, 60), 70, 'found_interior'],
    [triangle('t', 'exterior_angle', 50, 60), 115, 'near'],
  ] as const)('%#: %s typed %s -> %s', (c, value, miss) => {
    expect(classicMiss(c, { value })).toBe(miss);
  });
  it('classify names the relationship tapped; every named miss is in the catalog list', () => {
    expect(classicMiss(classify('c', 'supplementary'), { relationship: 'vertical' })).toBe('chose_vertical');
    expect(classicMiss(classify('c', 'supplementary'), { relationship: 'supplementary' })).toBeUndefined();
    const declared = getComponentById('angle-workshop')!.teachingWorkspace!.misses!;
    for (const c of POOL) {
      const list = declared[c.type]!;
      for (const v of [c.expectedAnswer + 20, c.expectedAnswer - 3, 180 - c.expectedAnswer, c.givenAngle ?? 0, c.knownAngle ?? 0]) {
        const miss = classicMiss(c, c.type === 'classify_pairs' ? { relationship: 'adjacent' } : { value: v });
        if (miss) expect(list, `${c.type} ${miss}`).toContain(miss);
      }
    }
  });
});

describe('which lever answers each miss', () => {
  it('on every generated item, every miss the check can name is answered by a lever on that item (or is a recorded gap)', () => {
    // Recorded per-item gaps: `near` on a solve_unknown item with no simpler item (vertical, or a known on a ten).
    const VALUES = Array.from({ length: 1601 }, (_, i) => -400 + i / 2);
    for (const c of POOL) {
      const levers = angleWorkshopLevers(c, [], c.expectedAnswer + 20);
      const a = (c.a1 ?? 1) + (c.a2 ?? 1), b = (c.b1 ?? 0) + (c.b2 ?? 0);
      const named = new Set(c.type === 'classify_pairs'
        ? (['complementary', 'supplementary', 'vertical', 'adjacent'] as const).map(r => classicMiss(c, { relationship: r }))
        : [...VALUES, (90 - b) / a, (180 - b) / a].map(value => classicMiss(c, { value })));
      for (const miss of Array.from(named).filter((m): m is string => !!m)) {
        if (c.type === 'solve_unknown' && miss === 'near' && !simplerItem(c)) continue;
        expect(levers.some(l => l.answers?.includes(miss)), `${c.type} ${c.solveConfig ?? c.transversalShape ?? ''} ${miss}`).toBe(true);
      }
    }
  });
  it.each([
    [measure('m', 65), 'other_scale', [], TENS_LEVER], [measure('m', 65), 'far', [TENS_LEVER], SIMPLER_LEVER],
    [classify('c', 'supplementary'), 'chose_vertical', [], BENCHMARK_LEVER], [classify('c', 'supplementary'), 'chose_vertical', [BENCHMARK_LEVER], SIMPLER_LEVER],
    [solve('s', 'around_point', 120, 110), 'one_known_left', [], WHOLE_LEVER], [solve('s', 'around_point', 120, 110), 'near', [], SIMPLER_LEVER],
    [solve('s', 'supplementary', 55), 'total_ninety', [], WHOLE_LEVER], [solve('s', 'supplementary', 55), 'near', [WHOLE_LEVER], SIMPLER_LEVER],
    [algebra('a', 'supplementary', 2, 10, 1, 20, 50), 'total_ninety', [], WHOLE_LEVER],
    [algebra('a', 'supplementary', 2, 10, 1, 20, 50), 'typed_an_angle', [], TRY_X_LEVER],
    [algebra('a', 'supplementary', 2, 10, 1, 20, 50), 'far', [TRY_X_LEVER], SIMPLER_LEVER],
    [parallel('t', 'co_interior', 70), 'copied_given', [], SLIDE_LEVER], [parallel('t', 'corresponding', 70), 'supplement_given', [], STRAIGHT_ARCS_LEVER],
    [triangle('t', 'triangle_sum', 50, 60), 'added_givens', [], CORNERS_LEVER], [triangle('t', 'exterior_angle', 50, 60), 'found_interior', [], EXTERIOR_LEVER],
    [triangle('t', 'exterior_angle', 50, 60), 'found_interior', [EXTERIOR_LEVER], SIMPLER_LEVER],
  ] as const)('%#: after %s with %j pulled -> %s', (c, miss, pulled, want) => {
    expect(nextLever(angleWorkshopLevers(c, pulled as unknown as string[], c.expectedAnswer + 3), miss)).toBe(want);
  });
  it('try_your_x is offered only once there is a wrong x to put in', () => {
    const a = algebra('a', 'supplementary', 2, 10, 1, 20, 50);
    expect(angleWorkshopLevers(a, []).map(l => l.id)).toEqual([WHOLE_LEVER, SIMPLER_LEVER]);
    expect(angleWorkshopLevers(a, [], 50).map(l => l.id)).toEqual([WHOLE_LEVER, SIMPLER_LEVER]);
    expect(angleWorkshopLevers(a, [], 53).map(l => l.id)).toEqual([WHOLE_LEVER, TRY_X_LEVER, SIMPLER_LEVER]);
  });
});

describe('leak rules', () => {
  it('tens labels: over every generated measure, numbered from 0 and never at or within 5° of the reading', () => {
    for (const c of POOL.filter(x => x.type === 'measure')) {
      const labels = tensLabels(c);
      expect(labels[0]).toBe(0);
      expect(tensLeak(labels, c), `${c.angleMeasure}`).toBe(false);
      expect(labels.at(-1)!).toBeGreaterThanOrEqual(c.angleMeasure! - 15);
    }
  });
  it('the slid copy never lands on x: no slide on a corresponding pair, straight arcs there instead', () => {
    expect(slideLeaks('corresponding')).toBe(true);
    for (const rel of ['alternate_interior', 'alternate_exterior', 'co_interior'] as const) expect(slideLeaks(rel)).toBe(false);
    expect(angleWorkshopLevers(parallel('t', 'corresponding', 70), []).map(l => l.id)).toEqual([STRAIGHT_ARCS_LEVER]);
  });
  it('try_your_x writes only the learner\'s own number, never the key', () => {
    const a = algebra('a', 'supplementary', 2, 10, 1, 20, 50);
    expect(tryYourX(a, 50)).toBeNull();
    expect(tryYourX(a, undefined)).toBeNull();
    expect(tryYourX(a, 53)).toBe('Your x = 53 put into the labels: (2·53 + 10)° = 116° and (53 + 20)° = 73°');
  });
  it('over every generated item with every help pulled, the scene fact states no answer and no relationship name', () => {
    for (const c of POOL) {
      const help = angleWorkshopLevers(c, [], c.expectedAnswer + 20).filter(l => l.kind === 'help').map(l => l.id);
      const fact = angleLeverFacts(c, help, c.expectedAnswer + 20) ?? '';
      expect(fact.length, `${c.type}`).toBeGreaterThan(0);
      expect(fact).not.toMatch(/complementary|supplementary|vertical|corresponding|alternate|co-interior|adds? to|equal/i);
      const given = [c.givenAngle, c.givenAngle2, c.knownAngle, c.knownAngle2, ...tensLabels(c)].filter(v => v !== undefined);
      if (c.type !== 'classify_pairs' && !given.includes(c.expectedAnswer)) expect(fact).not.toMatch(new RegExp(`\\b${c.expectedAnswer}°`));
    }
  });
});

describe('simpler items: the builders', () => {
  it('over every generated item: same mode, its own id, solvable, never the item\'s answer, and mapped back to its parent', () => {
    let built = 0;
    for (const c of POOL) {
      const p = simplerItem(c);
      if (!p) continue;
      built++;
      expect(p).toMatchObject({ id: `${c.id}~simpler`, type: c.type });
      expect(practiceLeaks(p, c), `${c.id}`).toBe(false);
      expect(practiceParent(p.id, [c])).toBe(c);
      expect(practiceFor(c)).toEqual(p);
      if (p.type === 'classify_pairs') {
        expect(p.choices).toHaveLength(2);
        expect(p.choices).toContain(p.expectedRelationship);
        expect(p.choices).not.toContain(c.expectedRelationship);
      } else {
        expect(solved(p), `${c.id}`).toBeCloseTo(p.expectedAnswer, 6);
        expect(Number.isInteger(p.expectedAnswer)).toBe(true);
        expect(p.expectedAnswer).toBeGreaterThan(0);
      }
      if (p.type === 'solve_algebraic') {
        const [A1, A2] = algebraicAngles(p);
        expect(Math.min(A1, A2)).toBeGreaterThan(5);
        expect(p.algConfig === 'vertical' ? A1 - A2 : A1 + A2).toBe(p.algConfig === 'vertical' ? 0 : p.algConfig === 'complementary' ? 90 : 180);
      }
    }
    expect(built).toBeGreaterThan(POOL.length / 2);
  });
  it.each([
    ['measure on a ten, acute', measure('m', 70)], ['solve_unknown vertical', solve('s', 'vertical', 55)],
    ['solve_unknown known on a ten', solve('s', 'supplementary', 40)], ['algebraic unit coefficients', algebra('a', 'supplementary', 1, 10, 1, 40, 65)],
    ['algebraic vertical 2x and x', algebra('a', 'vertical', 2, 10, 1, 20, 10)], ['corresponding', parallel('t', 'corresponding', 70)],
    ['alternate interior', parallel('t', 'alternate_interior', 70)], ['triangle sum', triangle('t', 'triangle_sum', 50, 60)],
  ])('no simpler item on an item already the plainest of its mode: %s', (_, c) => {
    expect(simplerItem(c)).toBeNull();
    expect(angleWorkshopLevers(c, [], c.expectedAnswer + 20).every(l => l.kind === 'help')).toBe(true);
  });
  it('by mode: an acute ten, a contrast pair, one subtraction, unit coefficients, the next plainer figure', () => {
    expect(simplerItem(measure('m', 125))).toMatchObject({ angleMeasure: 40, expectedAnswer: 40 });
    expect(simplerItem(classify('c', 'supplementary'))).toMatchObject({ expectedRelationship: 'vertical', choices: ['complementary', 'vertical'] });
    expect(simplerItem(solve('s', 'around_point', 120, 110))).toMatchObject({ solveConfig: 'supplementary', knownAngle: 60, expectedAnswer: 120 });
    expect(simplerItem(algebra('a', 'supplementary', 2, 10, 1, 20, 50))).toMatchObject({ a1: 1, a2: 1, expectedAnswer: 6 });
    expect(simplerItem(triangle('t', 'exterior_angle', 50, 60))).toMatchObject({ transversalShape: 'triangle_sum' });
    expect(simplerItem(parallel('t', 'co_interior', 70))).toMatchObject({ transRelation: 'corresponding', givenAngle: 65 });
  });
});

// ── mounted ─────────────────────────────────────────────────────────────────

const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const input = (h: WorkspaceHarness) => h.view.container.querySelector<HTMLInputElement>('input[aria-label="Your answer"]');

/** The journey's inputs for the item on screen; a practice item is rebuilt from its parent, as the journey row does. */
function perform(h: WorkspaceHarness, challenges: AngleWorkshopChallenge[], wrong: boolean) {
  const id = h.state().task!.itemId;
  const parent = practiceParent(id, challenges);
  const c = parent ? practiceFor(parent)! : challenges.find(x => x.id === id)!;
  for (const step of angleWorkshopHarnessInputs(c, wrong, h.state().task!.demand as Record<string, unknown>)) {
    if (step.type === 'choose') h.press(step.label);
    else if (step.type === 'check') h.press('Check');
    else act(() => { fireEvent.change(input(h)!, { target: { value: step.text } }); });
  }
}
const frozen = (h: WorkspaceHarness) => {
  const t = h.state().task!;
  return JSON.stringify({ demand: t.demand, levers: t.workspace!.levers, attempts: t.workspace!.attempts, html: h.view.container.innerHTML });
};

const MOUNTS = [
  ['measure', measure('c1', 65), TENS_LEVER, '[data-lever="tens-labels"] [data-ten]', 4, /numbered every 10° from 0 at the bottom ray up to 60°/],
  ['classify_pairs', classify('c1', 'supplementary'), BENCHMARK_LEVER, '[data-lever="benchmarks"] line', 2, /dashed ray at a square corner/],
  ['solve_unknown', solve('c1', 'around_point', 120, 110), WHOLE_LEVER, '[data-lever="whole-angle"] polyline', 1, /dashed circle .* around the point/],
  ['solve_algebraic', algebra('c1', 'supplementary', 2, 10, 1, 20, 50), TRY_X_LEVER, '[data-lever="try-your-x"]', 1,
    /Your x = 53 put into the labels: \(2·53 \+ 10\)° = 116° and \(53 \+ 20\)° = 73°/],
  ['transversal', parallel('c1', 'co_interior', 70), SLIDE_LEVER, '[data-lever="slide-copy"]', 1, /dashed copy of the marked angle/],
] as const;

describe.each(MOUNTS)('%s, mounted', (mode, item, help, drawn, count, fact) => {
  it('a wrong answer, then help: the picture and its fact in one commit; a refused pull changes nothing; the next try records it', () => {
    const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: mode, data: lesson([item]) });
    expect(levers(h).every(l => !l.pulled)).toBe(true);
    expect(q(h, '[data-lever]')).toHaveLength(0);
    perform(h, [item], true);
    expect(last(h)).toMatchObject({ itemId: 'c1', correct: false });
    expect(CLASSIC_MISSES[mode as keyof typeof CLASSIC_MISSES]).toContain(last(h)!.miss);
    expect(levers(h).some(l => l.id === help && l.answers?.includes(last(h)!.miss!))).toBe(true);
    const receipt = h.dispatch('pull_lever', { lever: help });
    expect(receipt.status).toBe('committed');
    expect(q(h, drawn)).toHaveLength(count);
    expect(String(receipt.state.task!.demand.onScreen)).toMatch(fact);
    const before = frozen(h);
    expect(h.dispatch('pull_lever', { lever: help }).status).toBe('blocked');
    expect(frozen(h)).toBe(before);
    h.dispatch('retry');
    perform(h, [item], false);
    expect(last(h)).toMatchObject({ itemId: 'c1', correct: true, assisted: true, levers: [help] });
    h.close();
  });

  it('the simpler item: ungraded, its own id, the full item back blank after it and credited', () => {
    const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: mode, data: lesson([item]) });
    perform(h, [item], true);
    h.dispatch('pull_lever', { lever: help });
    const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
    expect(receipt.status).toBe('committed');
    expect(h.state().task).toMatchObject({ itemId: 'c1~simpler' });
    expect(h.state().task!.demand.practice).toBeTruthy();
    expect(q(h, '[data-practice]')).toHaveLength(1);
    expect(q(h, '[data-lever]')).toHaveLength(0);
    expect(levers(h)).toEqual([]);
    if (mode === 'classify_pairs') {
      expect(Array.from(q(h, 'button[aria-label]')).map(b => b.getAttribute('aria-label'))).toEqual(['Complementary', 'Vertical']);
    }
    perform(h, [item], true);
    expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: false });
    h.dispatch('retry');
    perform(h, [item], false);
    expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: true });
    h.dispatch('advance');
    expect(h.state().task).toMatchObject({ itemId: 'c1' });
    expect(q(h, '[data-practice]')).toHaveLength(0);
    // Blank: nothing typed, nothing chosen; the session item's help is back on screen.
    if (input(h)) expect(input(h)!.value).toBe('');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/Nothing typed yet|No relationship chosen yet/);
    expect(q(h, '[data-lever]').length).toBeGreaterThan(0);
    perform(h, [item], false);
    const attempts = h.state().task!.workspace!.attempts;
    expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
      ['c1', false, false], ['c1~simpler', false, true], ['c1~simpler', true, true], ['c1', true, false]]);
    expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [help, SIMPLER_LEVER] });
    h.close();
  });
});

it.each([
  ['solve_unknown', solve('c1', 'vertical', 55), WHOLE_LEVER, '[data-lever="whole-angle"] polyline', 2],
  ['solve_algebraic', algebra('c1', 'vertical', 2, 10, 1, 20, 10), WHOLE_LEVER, '[data-lever="whole-angle"] polyline', 2],
  ['transversal', parallel('c1', 'corresponding', 70), STRAIGHT_ARCS_LEVER, '[data-lever="straight-arcs"] polyline', 2],
  ['transversal', triangle('c1', 'triangle_sum', 50, 60), CORNERS_LEVER, '[data-lever="corners-on-line"] [data-corner]', 2],
  ['transversal', triangle('c1', 'exterior_angle', 50, 60), EXTERIOR_LEVER, '[data-lever="straight-at-corner"]', 1],
] as const)('%s: the help picture %s is drawn on the figure', (mode, item, help, drawn, count) => {
  const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: mode, data: lesson([item]) });
  expect(h.dispatch('pull_lever', { lever: help }).status).toBe('committed');
  expect(q(h, drawn)).toHaveLength(count);
  expect(h.state().task!.demand.onScreen).toBeTruthy();
  h.close();
});

it('measure: the tens lever places the protractor, so the answer opens without the learner placing it', () => {
  const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: 'measure', data: lesson([measure('c1', 65)]) });
  expect(h.state().task!.demand.protractor).toBe('not placed');
  expect(input(h)!.disabled).toBe(true);
  h.dispatch('pull_lever', { lever: TENS_LEVER });
  expect(h.state().task!.demand.protractor).toBe('placed');
  expect(input(h)!.disabled).toBe(false);
  h.close();
});
