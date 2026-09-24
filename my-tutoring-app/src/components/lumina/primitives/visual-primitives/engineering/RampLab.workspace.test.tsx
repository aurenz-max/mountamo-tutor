// @vitest-environment jsdom
/**
 * Ramp lab on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Carries the investigation flow cases RampInvestigation.test.tsx held for the runner.
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
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { expectClassicWorkspace, mountWithStore } from '../../../pip/testing/classicSurface';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import RampLab, { type RampLabData } from './RampLab';
import { easierComparisonChoice, selectRampChallenges, type RampChallenge, type RampInvestigationChallenge } from './rampChallenges';

// jsdom has no canvas: the trial bench then records its deterministic measurement at once.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const click = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
const MODES = ['compare_conditions', 'find_threshold', 'plan_fair_test', 'design_with_budget', 'explain_from_trials'] as const;
const one = (mode: typeof MODES[number]) => selectRampChallenges([mode], 1)[0] as RampChallenge;
const lab = (challenges: RampChallenge[], extra: Partial<RampLabData> = {}): RampLabData => ({ title: 'Ramps',
  description: 'Investigate', rampLength: 10, rampAngle: 25, adjustableAngle: true, loadWeight: 4, loadType: 'box',
  showMeasurements: true, frictionLevel: 'low', theme: 'generic', challenges, ...extra });
const mount = (data: RampLabData, mode = 'mixed') =>
  mountWorkspace({ primitiveId: 'ramp-lab', evalMode: mode, data: data as unknown as Record<string, unknown> });
function collect() { click('Setup A'); click('Record prediction'); click('Run trial A'); click('Run trial B'); }

describe('ramp lab on the workspace', () => {
  it.each(MODES)('%s binds; only explain publishes a spoken key, and never before both trials are ready', mode => {
    const data = lab([one(mode)]);
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'ramp-lab', pin: mode, objectiveIds: ['o'], data })).not.toBeNull();
    const h = mount(data, mode);
    const key = h.state().task!.workspace!.expectedAnswer;
    if (mode === 'explain_from_trials') expect(key).toMatch(/needed (less|the same) push/);
    else expect(key).toBeUndefined();
  });

  it('free exploration is an ungraded sandbox: it does not bind and renders without a runtime', () => {
    const data = lab([], { freeExplore: true });
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'ramp-lab', pin: 'mixed', objectiveIds: ['o'], data })).toBeNull();
    const view = render(<RampLab data={data} />);
    expect(view.getByRole('button', { name: 'Push' })).toBeTruthy();
    expect(view.container.querySelector('[data-workspace-unbound]')).toBeNull();
  });

  it('compare: a wrong prediction is a checked miss; Try again reopens; the right one is credited', () => {
    const c = one('compare_conditions');
    const right = easierComparisonChoice(c as Extract<RampChallenge, { mode: 'compare_conditions' }>);
    const h = mount(lab([c]), 'compare_conditions');
    click(`Setup ${right === 'a' ? 'B' : 'A'}`); click('Reveal Force Evidence');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect((screen.getByRole('button', { name: 'Reveal Force Evidence' }) as HTMLButtonElement).disabled).toBe(true);
    h.dispatch('retry');
    click(`Setup ${right.toUpperCase()}`); click('Reveal Force Evidence');
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('plan: a two-variable plan stays in the record as a miss; the repaired plan locks; recording both trials is the success', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const plan = one('plan_fair_test') as RampInvestigationChallenge;
    const h = mount(lab([plan]), 'plan_fair_test');
    fireEvent.change(screen.getByLabelText('Setup B surface'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('Setup B angle'), { target: { value: '35' } });
    click('Commit my plan');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/cannot isolate/)).toBeTruthy();
    h.dispatch('retry');
    const variable = plan.variable;
    fireEvent.change(screen.getByLabelText('Setup B angle'), { target: { value: String(plan.scenarios.a.angle) } });
    fireEvent.change(screen.getByLabelText('Setup B surface'), { target: { value: plan.scenarios.a.frictionLevel } });
    fireEvent.change(screen.getByLabelText('Setup B mass'), { target: { value: String(plan.scenarios.a.loadWeight) } });
    const changed = variable === 'angle' ? ['Setup B angle', plan.scenarios.a.angle === 25 ? '35' : '25']
      : variable === 'surface' ? ['Setup B surface', plan.scenarios.a.frictionLevel === 'high' ? 'low' : 'high']
        : ['Setup B mass', plan.scenarios.a.loadWeight === 6 ? '2' : '6'];
    fireEvent.change(screen.getByLabelText(changed[0]), { target: { value: changed[1] } });
    click('Commit my plan');
    expect(screen.getByLabelText('Setup B angle').closest('fieldset')?.disabled).toBe(true);
    // A fair plan alone does not complete the item.
    expect(h.state().task!.evidence.correctness).not.toBe('correct');
    collect(); click('Record investigation');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    const investigation = seam.submit.mock.calls[0][3].investigations[0];
    expect(investigation.planAttempts.map((p: { fair: boolean }) => p.fair)).toEqual([false, true]);
    expect(investigation).toMatchObject({ solved: true, firstTryCorrect: false });
    expect(investigation.trials).toHaveLength(2);
  });

  it('explain: speech is not awaited until both trials are recorded; a credited explanation completes the record', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(lab([one('explain_from_trials')]), 'explain_from_trials');
    expect(h.state().task!.demand).not.toMatchObject({ step: 'explain' });
    collect(); click('Explain my results');
    expect(h.state().task!.demand).toMatchObject({ step: 'explain' });
    h.say('Setup A needed less push than B.'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit.mock.calls[0][3].investigations[0]).toMatchObject({ solved: true, explanation: { solved: true } });
  });

  it('Hear the question asks for the question only, silently, as the host', () => {
    mount(lab([one('explain_from_trials')]), 'explain_from_trials');
    collect(); click('Explain my results'); click('Hear the question');
    const [text, options] = seam.send.mock.calls.at(-1)!;
    expect(text).toContain('Use your two trial results');
    expect(text).not.toMatch(/needed less push/);
    expect(options).toMatchObject({ silent: true, author: 'host' });
  });

  it('keeps the shared Pip workspace contract under the runtime', () => {
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    const data = { ...lab([one('compare_conditions')]), instanceId: 'ramp' };
    seam.activePrimitiveId = 'ramp';
    // The shared contract drives the tutor's speech and the active block through these two fields.
    const tutor = {
      get isAudioPlaying() { return seam.audio; }, set isAudioPlaying(on: boolean) { seam.audio = on; },
      get activePrimitiveId() { return seam.activePrimitiveId; }, set activePrimitiveId(id: string | null) { seam.activePrimitiveId = id ?? ''; },
    };
    const mounted = mountWithStore(() => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <RampLab data={data} runtimePlanItemId="plan-ramp" runtimeEvalMode="compare_conditions" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    expectClassicWorkspace({ mounted, tutor, instanceId: 'ramp' });
  });

  it('the adapter refuses free exploration and a challenge with no brief', () => {
    expect(() => LIVE_ADAPTERS['ramp-lab'].validate(lab([], { freeExplore: true }))).toThrow();
    expect(() => LIVE_ADAPTERS['ramp-lab'].validate(lab([{ ...one('find_threshold'), brief: '' }]))).toThrow();
  });
});
