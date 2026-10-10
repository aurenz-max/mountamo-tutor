// @vitest-environment jsdom
/**
 * Parameter explorer on the teaching workspace: what is its own. The generic W1 contract
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
import type { ParameterExplorerChallenge, ParameterExplorerData } from './ParameterExplorer';
import {
  EMPTY_WORK, PARAMETER_MISSES_BY_MODE, dominantParameter, parameterCheck, parameterMiss, settleChallenge,
} from './parameterExplorerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, label).toBeTruthy();
  expect(input!.disabled, `${label} is closed`).toBe(false);
  fireEvent.change(input!, { target: { value: text } });
});

/** a = F / m: m divides, so its direction runs against the input; F = 20 N, m = 5 kg gives a = 4. */
const motion = (challenge: ParameterExplorerChallenge): ParameterExplorerData => ({
  title: 'Acceleration', formula: 'a = \\frac{F}{m}', jsExpression: 'F / m', outputName: 'Acceleration', outputUnit: 'm/s²',
  context: 'A cart pushed along a track.',
  parameters: [
    { symbol: 'F', name: 'Net force', unit: 'N', min: 1, max: 100, step: 1, default: 20, description: 'The push' },
    { symbol: 'm', name: 'Mass', unit: 'kg', min: 1, max: 50, step: 1, default: 5, description: 'The cart' },
  ],
  observations: [{ trigger: 'Vary m', prompt: 'A heavier cart speeds up less for the same push.' }],
  challenges: [challenge],
});
/** KE = ½ m v²: doubling v quadruples it, doubling m doubles it, so v leads; m has the larger starting number. */
const energy = (challenge: ParameterExplorerChallenge): ParameterExplorerData => ({
  title: 'Kinetic energy', formula: 'KE = \\frac{1}{2}mv^2', jsExpression: '0.5 * m * Math.pow(v, 2)', outputName: 'Kinetic Energy',
  outputUnit: 'J', context: 'A moving cart.',
  parameters: [
    { symbol: 'm', name: 'Mass', unit: 'kg', min: 1, max: 100, step: 1, default: 10, description: '' },
    { symbol: 'v', name: 'Velocity', unit: 'm/s', min: 0, max: 20, step: 0.5, default: 5, description: '' },
  ],
  challenges: [challenge],
});

type Input = { write: [string, string] } | { press: string };
type Case = { mode: ParameterExplorerChallenge['type']; data: ParameterExplorerData; wrong: Input[] | null; miss?: string;
  right: Input[]; cleared: string; secret: RegExp };
const CASES: Case[] = [
  { mode: 'explore', data: motion({ id: 'e1', type: 'explore', instruction: 'Move the mass and watch the acceleration.' }), wrong: null,
    right: [{ write: ['Mass (m) slider', '6'] }, { press: 'Done Exploring' }], cleared: '', secret: /correctParameter/ },
  { mode: 'predict-direction', data: motion({ id: 'd1', type: 'predict-direction', instruction: 'If the mass increases...',
    prediction: { varyParameter: 'm', newValue: 10, correctDirection: 'decrease', explanation: 'More mass, less acceleration.' } }),
    wrong: [{ press: 'Increase' }, { press: 'Check Answer' }], miss: 'opposite_direction',
    right: [{ press: 'Decrease' }, { press: 'Check Answer' }], cleared: 'no direction chosen yet',
    secret: /correctDirection|\b2 m\/s|less acceleration/ },
  { mode: 'predict-value', data: motion({ id: 'v1', type: 'predict-value', instruction: 'What is a when F is 30 N?',
    prediction: { varyParameter: 'F', newValue: 30, correctValue: 6, tolerance: 0.1, explanation: 'a = 30 ÷ 5 = 6' } }),
    wrong: [{ write: ['Your prediction', '4'] }, { press: 'Check Answer' }], miss: 'unchanged_output',
    right: [{ write: ['Your prediction', '6'] }, { press: 'Check Answer' }], cleared: 'nothing entered yet',
    secret: /\b6\b|correctValue/ },
  { mode: 'identify-relationship', data: energy({ id: 'i1', type: 'identify-relationship', instruction: 'Which matters most?', correctParameter: 'v' }),
    wrong: [{ press: 'm (Mass)' }, { press: 'Check Answer' }], miss: 'largest_value',
    right: [{ press: 'v (Velocity)' }, { press: 'Check Answer' }], cleared: 'no parameter chosen yet',
    secret: /correctParameter|\b375\b/ },
];
const perform = (h: WorkspaceHarness, inputs: Input[]) => inputs.forEach(i => ('write' in i ? write(h, ...i.write) : h.press(i.press)));
const outputState = (h: WorkspaceHarness) => h.view.container.querySelector('[data-output]')?.getAttribute('data-output');

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('parameter-explorer')!;
  expect((entry.evalModes ?? []).map(m => m.evalMode).sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(PARAMETER_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'parameter-explorer', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss, closes input and Try again clears it; the right one completes once',
  async ({ mode, data, wrong, miss, right, cleared, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'parameter-explorer', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // Next is the runtime's on this path; the predict modes hide the output (it is the answer).
    expect(h.view.container.textContent).not.toMatch(/Next Challenge|Finish/);
    if (mode.startsWith('predict')) expect(outputState(h)).toBe('hidden');

    if (wrong) {
      perform(h, wrong);
      expect(h.state().task!.evidence.correctness).toBe('incorrect');
      expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
      // The miss shows nothing new: no explanation, no result line, the output still hidden in the predict modes.
      expect(h.view.container.textContent).toMatch(/Not yet/);
      expect(h.view.container.textContent).not.toMatch(secret);
      if (mode.startsWith('predict')) expect(outputState(h)).toBe('hidden');
      // Input is closed until Try again.
      const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'))
        .filter(el => !el.disabled && /Increase|Decrease|Stay Same|Your prediction|slider|\(Mass\)|\(Velocity\)|Check/
          .test(((el.getAttribute('aria-label') ?? '') || (el.textContent ?? '')).trim()));
      expect(open.map(el => el.getAttribute('aria-label') ?? el.textContent)).toEqual([]);
      h.dispatch('retry');
      expect(h.state().task!.demand.learnerWork).toBe(cleared);
    }

    perform(h, right);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    if (mode !== 'explore') expect(h.view.container.textContent).toMatch(/goes from|Doubling each one/);
    if (mode.startsWith('predict')) expect(outputState(h)).toBe('shown');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'parameter-explorer', evalMode: 'predict-value', data: CASES[2].data as unknown as Record<string, unknown> });
  perform(h, CASES[2].right);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn, built from the data: the setting, what is held, the hidden output', () => {
  const h = mountWorkspace({ primitiveId: 'parameter-explorer', evalMode: 'predict-direction', data: CASES[1].data as unknown as Record<string, unknown> });
  expect(h.state().task!.task).toMatch(/^Mass \(m\) changes from 5 kg to 10 kg while F = 20 N stays fixed\. Will Acceleration increase/);
  expect(h.state().task!.demand).toMatchObject({ outputShown: 'no: hidden until the answer is checked', sliders: 'F 20 N, m 5 kg' });
  // The observation card narrates the relationship: explore only.
  expect(h.view.container.textContent).not.toMatch(/heavier cart/);
});

it('the keys come from the formula, and each wrong answer names its pattern', () => {
  const dir = CASES[1].data, d1 = dir.challenges[0];
  const at = (direction: 'increase' | 'decrease' | 'stay-same') => ({ ...EMPTY_WORK, direction });
  expect(parameterCheck(dir, d1, at('decrease'))).toBe(true);
  // The generator's word is not the key: the formula at the setting is.
  expect(parameterCheck(dir, { ...d1, prediction: { ...d1.prediction!, correctDirection: 'increase' } }, at('decrease'))).toBe(true);
  expect(parameterMiss(dir, d1, at('increase'))).toBe('opposite_direction');
  expect(parameterMiss(dir, d1, at('stay-same'))).toBe('missed_change');
  const val = CASES[2].data, v1 = val.challenges[0], typed = (value: string) => ({ ...EMPTY_WORK, value });
  expect(parameterCheck(val, { ...v1, prediction: { ...v1.prediction!, correctValue: 99 } }, typed('6'))).toBe(true);
  expect(parameterMiss(val, v1, typed('4'))).toBe('unchanged_output');
  expect(parameterMiss(val, v1, typed('6.2'))).toBe('near_miss');
  expect(parameterMiss(val, v1, typed('2'))).toBe('opposite_direction');
  expect(parameterMiss(val, v1, typed('9'))).toBe('too_high');
  expect(parameterMiss(val, v1, typed('5'))).toBe('too_low');
  // m from 5 to 10 with F held: a "scales with m" learner types 4 × 2 = 8.
  const scale = { ...v1, prediction: { ...v1.prediction!, varyParameter: 'm', newValue: 10 } };
  expect(parameterMiss(val, scale, typed('8'))).toBe('assumed_proportional');
  const ke = CASES[3].data, i1 = ke.challenges[0], chose = (parameter: string) => ({ ...EMPTY_WORK, parameter });
  expect(dominantParameter(ke)).toBe('v');
  expect(parameterMiss(ke, i1, chose('m'))).toBe('largest_value');
  // A product of first powers has no leader: the item is dropped, never keyed.
  expect(dominantParameter(CASES[1].data)).toBe('F');
  expect(dominantParameter({ ...ke, jsExpression: 'm * v' })).toBeNull();
  expect(settleChallenge({ ...ke, jsExpression: 'm * v' }, i1)).toBeNull();
  const noEffect = { ...ke, parameters: [...ke.parameters, { symbol: 'k', name: 'Colour', min: 1, max: 9, step: 1, default: 3, description: '' }] };
  expect(parameterMiss(noEffect, i1, chose('k'))).toBe('no_effect');
});

it('settles a direction item on the slider when the generator gave no usable setting', () => {
  const data = CASES[1].data, ch = data.challenges[0];
  const settled = settleChallenge(data, { ...ch, prediction: { ...ch.prediction!, newValue: 500 } })!;
  expect(settled.prediction!.newValue).toBeGreaterThan(5);
  expect(settled.prediction!.newValue).toBeLessThanOrEqual(50);
  expect(settled.prediction!.correctDirection).toBe('decrease');
  expect(settled.prediction!.explanation).toBe('');
});

it('the adapter refuses a challenge its own check cannot answer', () => {
  const validate = LIVE_ADAPTERS['parameter-explorer'].validate;
  const d1 = CASES[1].data.challenges[0];
  expect(() => validate({ ...CASES[1].data, challenges: [{ ...d1, prediction: { ...d1.prediction!, newValue: undefined } }] })).toThrow();
  expect(() => validate({ ...CASES[1].data, challenges: [{ ...d1, prediction: { ...d1.prediction!, correctDirection: 'increase' } }] })).toThrow();
  expect(() => validate({ ...CASES[1].data, challenges: [{ ...CASES[3].data.challenges[0] }] })).not.toThrow(); // F leads in a = F / m
  expect(() => validate({ ...CASES[3].data, jsExpression: 'm * v' })).toThrow();
  expect(validate({ ...CASES[1].data, challenges: CASES.slice(0, 3).map(c => c.data.challenges[0]) })).toBeTruthy();
});
