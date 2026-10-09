// @vitest-environment jsdom
/**
 * Formula lab on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { FormulaLabChallenge, FormulaLabChallengeType, FormulaLabData } from './FormulaLab';
import { EMPTY_WORK, FORMULA_MISSES_BY_MODE, formulaCheck, formulaMiss } from './formulaLabWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, label).toBeTruthy();
  expect(input!.disabled, `${label} is closed`).toBe(false);
  fireEvent.change(input!, { target: { value: text } });
});

/** speed = distance / time: a divisor, so the inverse and the reciprocal are both on the table. */
const item = (type: FormulaLabChallengeType, changed: 'd' | 't', base: [number, number], target: [number, number]): FormulaLabChallenge => ({
  id: `${type}-1`, type, changedVariableSymbol: changed, baselineValues: base, targetValues: target,
  expectedBaselineOutput: base[0] / base[1], expectedTargetOutput: target[0] / target[1],
  correctDirection: target[0] / target[1] > base[0] / base[1] ? 'increase' : target[0] / target[1] < base[0] / base[1] ? 'decrease' : 'stay-same',
});
const lab = (challenge: FormulaLabChallenge): FormulaLabData => ({
  title: 'Speed', description: 'How far per hour', context: 'A cyclist rides a trail.',
  transferContext: 'A train covers a longer route.', formulaLatex: 's = \\frac{d}{t}', expression: 'd / t',
  outputSymbol: 's', outputName: 'speed', outputUnit: 'km/h', sceneKind: 'motion', challengeType: challenge.type, gradeBand: 'Grade 7',
  variables: [
    { symbol: 'd', name: 'distance', unit: 'km', min: 1, max: 100, step: 1, defaultValue: 40, accent: 'cyan' },
    { symbol: 't', name: 'time', unit: 'h', min: 1, max: 20, step: 1, defaultValue: 4, accent: 'amber' },
  ],
  challenges: [challenge],
});

type Input = { write: [string, string] } | { press: string };
type Case = { mode: FormulaLabChallengeType; data: FormulaLabData; wrong: Input[] | null; miss?: string; right: Input[]; cleared: string;
  secret: RegExp };
const tokens = (list: string[]): Input[] => [...list.map(press => ({ press })), { press: 'Check formula' }];
const CASES: Case[] = [
  { mode: 'free-explore', data: lab(item('free-explore', 'd', [20, 4], [60, 4])), wrong: null,
    right: [{ write: ['Changed quantity', '60'] }], cleared: '', secret: /expectedTargetOutput|correctDirection/ },
  { mode: 'predict-direction', data: lab(item('predict-direction', 't', [40, 4], [40, 8])),
    wrong: [{ write: ['Your prediction', '60'] }, { press: 'Lock prediction' }], miss: 'opposite_direction',
    right: [{ write: ['Your prediction', '-60'] }, { press: 'Lock prediction' }], cleared: 'no prediction placed yet',
    secret: /decrease|\b5 km\/h/ },
  { mode: 'predict-magnitude', data: lab(item('predict-magnitude', 'd', [40, 4], [60, 4])),
    wrong: [{ write: ['Your prediction', '-100'] }, { press: 'Lock prediction' }], miss: 'opposite_direction',
    right: [{ write: ['Your prediction', '50'] }, { press: 'Lock prediction' }], cleared: 'no prediction placed yet',
    secret: /\b15\b|correctDirection/ },
  { mode: 'construct-formula', data: lab(item('construct-formula', 'd', [40, 4], [60, 4])),
    wrong: tokens(['t', '/', 'd']), miss: 'inverted', right: tokens(['d', '/', 't']), cleared: 'no tokens chosen yet',
    secret: /d \/ t|d ÷ t|frac/ },
  { mode: 'transfer-apply', data: lab(item('transfer-apply', 'd', [40, 4], [90, 6])),
    wrong: [{ write: ['Transferred output', '10'] }, { press: 'Check transferred output' }], miss: 'used_starting_inputs',
    right: [{ write: ['Transferred output', '15'] }, { press: 'Check transferred output' }], cleared: 'nothing entered yet',
    secret: /\b15\b/ },
];
const perform = (h: WorkspaceHarness, inputs: Input[]) => inputs.forEach(i => ('write' in i ? write(h, ...i.write) : h.press(i.press)));

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('formula-lab')!;
  expect((entry.evalModes ?? []).map(m => m.evalMode).sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(FORMULA_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'formula-lab', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss, closes input and Try again clears it; the right one completes once',
  async ({ mode, data, wrong, miss, right, cleared, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'formula-lab', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/expectedTargetOutput|expectedBaselineOutput|correctDirection/);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // Next and the hint are the tutor's on this path.
    expect(h.view.container.textContent).not.toMatch(/Next experiment|See results/);

    if (wrong) {
      perform(h, wrong);
      expect(h.state().task!.evidence.correctness).toBe('incorrect');
      expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
      // The miss shows nothing new: the output stays hidden, and the formula on construct.
      expect(h.view.container.textContent).toMatch(/Output hidden/);
      if (mode === 'construct-formula') expect(h.view.container.textContent).toMatch(/s = \?/);
      // Input is closed until Try again.
      const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'))
        .filter(el => !el.disabled && /Your prediction|Transferred output|Lock prediction|Check|^[dt/]$/
          .test(((el.getAttribute('aria-label') ?? '') || (el.textContent ?? '')).trim()));
      expect(open.map(el => el.getAttribute('aria-label') ?? el.textContent)).toEqual([]);
      h.dispatch('retry');
      expect(h.state().task!.demand.learnerWork).toBe(cleared);
    }

    perform(h, right);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    expect(h.view.container.textContent).toMatch(/Output visible/);
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'formula-lab', evalMode: 'transfer-apply', data: CASES[4].data as unknown as Record<string, unknown> });
  perform(h, CASES[4].right);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn: the change, what is held fixed, the hidden output; on construct the tokens sorted, never in order', () => {
  const h = mountWorkspace({ primitiveId: 'formula-lab', evalMode: 'predict-direction', data: CASES[1].data as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ changes: 'time from 4 to 8 h', heldFixed: 'distance 40 km', formula: 's = d ÷ t',
    outputShown: 'no: hidden until the prediction is checked' });
  cleanup();
  const c = mountWorkspace({ primitiveId: 'formula-lab', evalMode: 'construct-formula', data: CASES[3].data as unknown as Record<string, unknown> });
  expect(c.state().task!.demand).toMatchObject({ tokens: 'to arrange: d  t  /' });
  expect(String(c.state().task!.demand.formula)).toMatch(/^hidden/);
});

it('construct credits an equivalent order, and names the miss each wrong build shows', () => {
  const product = { ...CASES[3].data, expression: '0.5 * m * v ^ 2',
    variables: [{ symbol: 'm', name: 'mass', unit: 'kg', min: 1, max: 50, step: 1, defaultValue: 2, accent: 'cyan' as const },
      { symbol: 'v', name: 'speed', unit: 'm/s', min: 1, max: 20, step: 1, defaultValue: 3, accent: 'amber' as const }] };
  const ch = { ...item('construct-formula', 'd', [2, 3], [4, 3]), expectedBaselineOutput: 9, expectedTargetOutput: 18 };
  const build = (tokens: string[]) => ({ ...EMPTY_WORK, tokens });
  expect(formulaCheck(product, ch, build(['0.5', '*', 'm', '*', 'v', '^', '2'])).correct).toBe(true);
  expect(formulaCheck(product, ch, build(['m', '*', 'v', '^', '2', '*', '0.5'])).correct).toBe(true);
  expect(formulaMiss(product, ch, build(['0.5', '*', 'm', '*', 'v']))).toBe('incomplete');
  expect(formulaMiss(product, ch, build(['0.5', '*', 'm', '^', 'v', '*', '2']))).toBe('operation_order');
  expect(formulaMiss(product, ch, build(['0.5', 'm', '*', '*', 'v', '^', '2']))).toBe('not_an_expression');
  const speed = CASES[3].data, s = CASES[3].data.challenges[0];
  expect(formulaMiss(speed, s, build(['t', '/', 'd']))).toBe('inverted');
});

it('the prediction and transfer misses name the pattern', () => {
  const dir = CASES[1].data.challenges[0], mag = CASES[2].data.challenges[0], tr = CASES[4].data.challenges[0], d = CASES[1].data;
  const at = (prediction: number) => ({ ...EMPTY_WORK, prediction });
  expect(formulaMiss(d, dir, at(-0.6))).toBeUndefined();
  expect(formulaMiss(d, dir, at(0.6))).toBe('opposite_direction');
  expect(formulaMiss(d, dir, at(0))).toBe('missed_change');
  expect(formulaMiss(d, { ...dir, correctDirection: 'stay-same' }, at(0.6))).toBe('invented_change');
  expect(formulaMiss(d, mag, at(0.5))).toBeUndefined();
  expect(formulaMiss(d, mag, at(-0.8))).toBe('opposite_direction');
  expect(formulaMiss(d, { ...mag, expectedTargetOutput: 11 }, at(1))).toBe('too_strong');
  expect(formulaMiss(d, { ...mag, expectedTargetOutput: 20 }, at(0.2))).toBe('too_weak');
  const typed = (answer: string) => ({ ...EMPTY_WORK, answer });
  expect(formulaMiss(d, tr, typed('15'))).toBeUndefined();
  expect(formulaMiss(d, tr, typed('10'))).toBe('used_starting_inputs');
  expect(formulaMiss(d, tr, typed('15.5'))).toBe('near_miss');
  expect(formulaMiss(d, tr, typed('40'))).toBe('too_high');
  expect(formulaMiss(d, tr, typed('2'))).toBe('too_low');
  const power = { ...d, expression: 'd ^ 2 / t' }, sq = { ...tr, expectedTargetOutput: 1350, expectedBaselineOutput: 400 };
  expect(formulaMiss(power, sq, typed('30'))).toBe('power_as_multiply');
});

it('the adapter refuses a challenge its own check cannot answer', () => {
  const validate = LIVE_ADAPTERS['formula-lab'].validate;
  const bad = CASES[4].data.challenges[0];
  expect(() => validate({ ...CASES[4].data, challenges: [{ ...bad, expectedTargetOutput: 99 }] })).toThrow();
  expect(() => validate({ ...CASES[4].data, challenges: [{ ...bad, changedVariableSymbol: 'q' }] })).toThrow();
  expect(validate({ ...CASES[1].data, challenges: CASES.map(c => c.data.challenges[0]) })).toBeTruthy();
});
