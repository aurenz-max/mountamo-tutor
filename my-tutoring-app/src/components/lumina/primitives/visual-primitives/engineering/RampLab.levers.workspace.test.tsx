// @vitest-environment jsdom
/**
 * ramp-lab levers (`rampLabLevers.ts`), mounted the way a lesson mounts it: a pull changes the screen and the scene
 * fact in one commit, the next attempt records the lever, a refused pull changes nothing, and a simplify pull opens an
 * ungraded practice item with the full item back blank after it and credited (with the levers recorded).
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@radix-ui/react-slider', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return { Root: () => <input type="range" />, Track: Pass, Range: Pass, Thumb: Pass };
});

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { RampLabData } from './RampLab';
import {
  easierComparisonChoice, maxWorkableAngle, minimumPushSetting, selectRampChallenges, type RampChallenge, type RampInvestigationChallenge,
} from './rampChallenges';
import {
  BOTH_RAMPS_LEVER, FEWER_ANGLES_LEVER, LIGHTER_LOAD_LEVER, PUSH_BARS_LEVER, SAME_OR_CHANGED_LEVER, TEST_LOG_LEVER, TWO_SETTINGS_LEVER,
  fewerAngles, lighterLoad, twoSettings,
} from './rampLabLevers';

HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

type Mode = RampChallenge['mode'];
const one = <M extends Mode>(mode: M) => selectRampChallenges([mode], 1)[0] as Extract<RampChallenge, { mode: M }>;
const lab = (challenges: RampChallenge[], extra: Partial<RampLabData> = {}): RampLabData => ({ title: 'Ramps',
  description: 'Investigate', rampLength: 10, rampAngle: 25, adjustableAngle: true, loadWeight: 4, loadType: 'box',
  showMeasurements: true, frictionLevel: 'low', theme: 'generic', pushForce: 0, challenges, ...extra });
const mount = (c: RampChallenge, extra: Partial<RampLabData> = {}) =>
  mountWorkspace({ primitiveId: 'ramp-lab', evalMode: c.mode, data: lab([c], extra) as never });
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const last = (h: WorkspaceHarness) => attempts(h).at(-1)!;
const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.onScreen ?? '');
const times = (h: WorkspaceHarness, label: string, n: number) => { for (let i = 0; i < n; i++) h.press(label); };
/** Push from 0 to `value` in the item's steps, then test it. */
const testPush = (h: WorkspaceHarness, value: number, step: number) => {
  h.press('Reset Challenge'); times(h, 'More push', Math.round(value / step)); h.press('Test This Force');
};

describe('find_threshold', () => {
  const c = one('find_threshold');
  const answer = minimumPushSetting(c.scenario, c.forceStep);

  it('a refused pull changes nothing; after a miss test_log shows the learner\'s tests in the same commit, recorded on the next try', () => {
    const h = mount(c);
    expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[TEST_LOG_LEVER, false], [LIGHTER_LOAD_LEVER, false]]);
    const before = { html: h.view.container.innerHTML, levers: JSON.stringify(levers(h)), attempts: attempts(h).length };
    expect(h.dispatch('pull_lever', { lever: TEST_LOG_LEVER }).status).not.toBe('committed');
    expect(h.view.container.innerHTML).toBe(before.html);
    expect(JSON.stringify(levers(h))).toBe(before.levers);
    expect(attempts(h)).toHaveLength(before.attempts);

    testPush(h, answer - c.forceStep, c.forceStep);
    expect(last(h)).toMatchObject({ correct: false, miss: 'load_did_not_move' });
    expect(observerLever(h.state(), true)).toBe(TEST_LOG_LEVER);
    const receipt = h.dispatch('pull_lever', { lever: TEST_LOG_LEVER });
    expect(receipt.status).toBe('committed');
    expect(q(h, '[data-lever="test-log"] [data-log-entry]')).toHaveLength(1);
    expect(q(h, '[data-log-entry="stayed still"]')).toHaveLength(1);
    expect(String(receipt.state.task!.demand.onScreen)).toContain(`${(answer - c.forceStep).toFixed(1)} N stayed still`);
    expect(String(receipt.state.task!.demand.onScreen)).not.toContain(`${answer.toFixed(1)} N`);
    expect(h.dispatch('pull_lever', { lever: TEST_LOG_LEVER }).status).not.toBe('committed');
    h.dispatch('retry');
    testPush(h, answer, c.forceStep);
    expect(last(h)).toMatchObject({ itemId: c.id, correct: true, assisted: true, levers: [TEST_LOG_LEVER] });
    h.close();
  });

  it('lighter_load opens an ungraded whole-newton search; Try again keeps it; the full item comes back blank and is credited', () => {
    const h = mount(c);
    testPush(h, answer + c.forceStep, c.forceStep);
    expect(last(h)).toMatchObject({ correct: false, miss: 'more_than_minimum' });
    h.dispatch('pull_lever', { lever: TEST_LOG_LEVER });
    h.dispatch('pull_lever', { lever: LIGHTER_LOAD_LEVER });
    const practice = lighterLoad(c)!;
    expect(h.state().task).toMatchObject({ itemId: practice.id });
    expect(q(h, '[data-practice-item]')).toHaveLength(1);
    expect(screen.getByText(practice.scenario.label)).toBeTruthy();
    expect(screen.getByText('Push force:').textContent).toContain('0.0 N');
    expect(levers(h)).toEqual([]);
    const easy = minimumPushSetting(practice.scenario, 1);
    testPush(h, easy - 1, 1);
    expect(last(h)).toMatchObject({ itemId: practice.id, correct: false });
    h.dispatch('retry');
    expect(h.state().task).toMatchObject({ itemId: practice.id });
    testPush(h, easy, 1);
    expect(last(h)).toMatchObject({ itemId: practice.id, correct: true });
    h.dispatch('advance');
    expect(h.state().task).toMatchObject({ itemId: c.id });
    expect(q(h, '[data-practice-item]')).toHaveLength(0);
    expect(screen.getByText('Push force:').textContent).toContain('0.0 N');
    // The full item's own log is kept: it is the learner's record on this item.
    expect(q(h, '[data-lever="test-log"] [data-log-entry]')).toHaveLength(1);
    testPush(h, answer, c.forceStep);
    expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
      [c.id, false, false], [practice.id, false, true], [practice.id, true, true], [c.id, true, false]]);
    expect(last(h)).toMatchObject({ assisted: true, levers: [TEST_LOG_LEVER, LIGHTER_LOAD_LEVER] });
    h.close();
  });

  it('easy starts with the log shown, and that is not a pull', () => {
    const h = mount(c, { supportTier: 'easy' });
    expect(levers(h).find(l => l.id === TEST_LOG_LEVER)!.pulled).toBe(true);
    expect(q(h, '[data-lever="test-log"]')).toHaveLength(1);
    testPush(h, answer, c.forceStep);
    expect(last(h)).toMatchObject({ correct: true });
    expect(last(h).levers).toBeUndefined();
    h.close();
  });
});

it('design_with_budget: test_log, then fewer_angles practice; the full design comes back at its start angle and is credited', () => {
  const c = one('design_with_budget');
  const answer = maxWorkableAngle(c.scenario, c.forceBudget, c.angleRange);
  const h = mount(c);
  h.press('Check This Design');
  expect(last(h)).toMatchObject({ correct: false, miss: 'over_budget' });
  h.dispatch('pull_lever', { lever: TEST_LOG_LEVER });
  expect(q(h, '[data-log-entry="too steep"]')).toHaveLength(1);
  expect(onScreen(h)).toContain(`${c.scenario.angle} degrees too steep`);
  h.dispatch('pull_lever', { lever: FEWER_ANGLES_LEVER });
  const practice = fewerAngles(c)!;
  expect(h.state().task).toMatchObject({ itemId: practice.id });
  expect(screen.getByText('Ramp angle:').textContent).toContain(`${practice.angleRange.max} degrees`);
  times(h, 'Gentler', practice.angleRange.max - maxWorkableAngle(practice.scenario, practice.forceBudget, practice.angleRange));
  h.press('Check This Design');
  expect(last(h)).toMatchObject({ itemId: practice.id, correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: c.id });
  expect(screen.getByText('Ramp angle:').textContent).toContain(`${c.scenario.angle} degrees`);
  times(h, 'Gentler', c.scenario.angle - answer);
  h.press('Check This Design');
  expect(last(h)).toMatchObject({ itemId: c.id, correct: true, assisted: true, levers: [TEST_LOG_LEVER, FEWER_ANGLES_LEVER] });
  h.close();
});

it('compare_conditions: both_ramps draws both setups in the same commit, no force shown; recorded on the next try', () => {
  const c = one('compare_conditions');
  const right = easierComparisonChoice(c);
  const h = mount(c);
  h.press(`Setup ${right === 'a' ? 'B' : 'A'}`); h.press('Reveal Force Evidence');
  expect(last(h)).toMatchObject({ correct: false, miss: 'harder_setup' });
  expect(q(h, '[data-lever="ramp-sketch"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: BOTH_RAMPS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="ramp-sketch"]')).toHaveLength(2);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/^Both setups are drawn side by side/);
  expect(q(h, '[data-lever="both-ramps"]')[0].textContent).not.toMatch(/\bN\b|less|more/);
  h.dispatch('retry');
  h.press(`Setup ${right.toUpperCase()}`); h.press('Reveal Force Evidence');
  expect(last(h)).toMatchObject({ itemId: c.id, correct: true, assisted: true, levers: [BOTH_RAMPS_LEVER] });
  h.close();
});

describe('plan_fair_test', () => {
  const c = one('plan_fair_test') as RampInvestigationChallenge;
  const label = { angle: 'Setup B angle', surface: 'Setup B surface', mass: 'Setup B mass' } as const;
  const fairValue = (v: RampInvestigationChallenge['variable'], a: RampInvestigationChallenge['scenarios']['a']) =>
    v === 'angle' ? (a.angle === 25 ? '35' : '25') : v === 'surface' ? (a.frictionLevel === 'high' ? 'low' : 'high') : (a.loadWeight === 6 ? '2' : '6');
  const change = (l: string, value: string) => act(() => { fireEvent.change(screen.getByLabelText(l), { target: { value } }); });

  it('same_or_changed tags every setting; two_settings is an ungraded two-select plan; the full plan keeps its rejected try', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(c);
    h.press('Commit my plan');
    expect(last(h)).toMatchObject({ correct: false, miss: 'nothing_changed' });
    const receipt = h.dispatch('pull_lever', { lever: SAME_OR_CHANGED_LEVER });
    expect(receipt.status).toBe('committed');
    expect(Array.from(q(h, '[data-lever="setting-mark"]')).map(e => e.textContent)).toEqual(['same as A', 'same as A', 'same as A']);
    expect(String(receipt.state.task!.demand.onScreen)).toContain('a tag says whether it is the same as setup A');
    h.dispatch('pull_lever', { lever: TWO_SETTINGS_LEVER });
    const practice = twoSettings(c)!;
    expect(h.state().task).toMatchObject({ itemId: practice.id });
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.queryByLabelText(label[c.variable])).toBeNull();
    expect(q(h, '[data-lever="setting-mark"]')).toHaveLength(0);
    change(label[practice.variable], fairValue(practice.variable, practice.scenarios.a));
    h.press('Commit my plan');
    expect(last(h)).toMatchObject({ itemId: practice.id, correct: true });
    h.dispatch('advance');
    expect(h.state().task).toMatchObject({ itemId: c.id });
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    expect(Array.from(q(h, '[data-lever="setting-mark"]')).map(e => e.textContent)).toEqual(['same as A', 'same as A', 'same as A']);
    change(label[c.variable], fairValue(c.variable, c.scenarios.a));
    expect(q(h, '[data-lever="setting-mark"]')).toHaveLength(3);
    h.press('Commit my plan');
    h.press('Setup A'); h.press('Record prediction'); h.press('Run trial A'); h.press('Run trial B');
    h.press('Record investigation');
    expect(last(h)).toMatchObject({ itemId: c.id, correct: true, assisted: true, levers: [SAME_OR_CHANGED_LEVER, TWO_SETTINGS_LEVER] });
    h.dispatch('advance'); h.confirmVisible();
    await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
    const record = seam.submit.mock.calls[0][3].investigations;
    // One record (the practice plan leaves none), and the rejected plan from before the practice is still in it.
    expect(record).toHaveLength(1);
    expect(record[0].planAttempts.map((p: { fair: boolean }) => p.fair)).toEqual([false, true]);
    expect(record[0]).toMatchObject({ challengeId: c.id, firstTryCorrect: false });
    h.close();
  });
});

it('explain_from_trials: push_bars is refused before both trials, then draws one bar per trial in the same commit', () => {
  const c = one('explain_from_trials') as RampInvestigationChallenge;
  const h = mount(c);
  const before = { html: h.view.container.innerHTML, levers: JSON.stringify(levers(h)) };
  expect(h.dispatch('pull_lever', { lever: PUSH_BARS_LEVER }).status).not.toBe('committed');
  expect(h.view.container.innerHTML).toBe(before.html);
  expect(JSON.stringify(levers(h))).toBe(before.levers);
  h.press('Setup A'); h.press('Record prediction'); h.press('Run trial A'); h.press('Run trial B'); h.press('Explain my results');
  const receipt = h.dispatch('pull_lever', { lever: PUSH_BARS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="push-bars"] > div')).toHaveLength(2);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/a bar for each trial/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\bless\b|\bmore\b/);
  h.say('Setup A needed less push than B because of the ramp.');
  h.feedback('correct', 'advance');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: c.id, correct: true, assisted: true, levers: [PUSH_BARS_LEVER] });
  h.close();
});
