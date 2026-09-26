// @vitest-environment jsdom
/**
 * di-worked-procedure on the teaching workspace (rollout C6): both modes bind; every step is spoken and
 * its key carries both new numbers of a regroup and the upside-down column; the page writes a mark only
 * for a credited step, and the ringed column follows the current step.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import DiWorkedProcedure, { type DiWorkedProcedureData } from './DiWorkedProcedure';
import type { WorkedProcedureChallengeType } from './diWorkedProcedureScript';
import { workedProcedureItems } from './diWorkedProcedureWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const pack = (challengeType: WorkedProcedureChallengeType, minuend: number, subtrahend: number): DiWorkedProcedureData => ({
  title: 'Talk It Through', description: 'Work each column out loud.', challengeType,
  problems: [{ id: 'p1', minuend, subtrahend, challengeType }] });
// ones: 4 − 7 regroups → four tens, fourteen ones; 14 − 7 = 7; tens 4 − 2 = 2. (53 − 28 is refused: its
// flipped column lands on the right digit.)
const regroup = () => pack('subtract_regroup', 54, 27);
const clean = () => pack('subtract_no_regroup', 68, 23);
const mount = (data: DiWorkedProcedureData, mode: string = data.challengeType) =>
  mountWorkspace({ primitiveId: 'di-worked-procedure', evalMode: mode, data: data as unknown as Record<string, unknown> });
const ringed = (container: HTMLElement) => container.querySelector('[aria-label^="Current"]')?.getAttribute('aria-label');

describe('DiWorkedProcedure — both modes bind and every step is spoken', () => {
  it.each([['subtract_regroup', regroup], ['subtract_no_regroup', clean]] as const)('%s binds in a lesson', (mode, data) => {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'di-worked-procedure', pin: mode, objectiveIds: ['o'], data: data() })).not.toBeNull();
    const h = mount(data());
    expect(h.state().task!.workspace!.expectedAnswer).toBeTruthy();
    expect(ringed(h.view.container)).toBe('Current ones column, top digit');
  });

  it('a regroup key needs both new numbers and names the upside-down column', () => {
    const key = mount(regroup()).state().task!.workspace!.expectedAnswer!;
    expect(key).toContain('four tens and fourteen ones');
    expect(key).toContain('"seven minus four"');
  });

  it('the page prints no answer digit and the scene states none', () => {
    const h = mount(regroup());
    expect(h.view.container.querySelector('[data-procedure-digit]')).toBeNull();
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/fourteen|twenty-seven|27/);
  });

  it('the adapter refuses a mode that the problem breaks', () => {
    expect(() => LIVE_ADAPTERS['di-worked-procedure'].validate(pack('subtract_no_regroup', 54, 27))).toThrow();
  });
});

describe('DiWorkedProcedure — the page writes only what is credited', () => {
  it('a wrong step reopens and writes nothing; credit writes the regroup and the digits; the lesson completes once', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(regroup());
    expect(workedProcedureItems(regroup()).map(step => step.kind)).toEqual(['decide', 'subtract', 'decide']);
    h.say('seven minus four is three'); h.feedback('incorrect', 'retry');
    expect(h.view.container.querySelector('.line-through')).toBeNull();
    h.say('I regroup, four tens and fourteen ones'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.view.container.querySelector('.line-through')?.textContent).toBe('5'); // the tens 5 is struck; 4 is written above
    expect(h.view.container.querySelector('[data-procedure-digit]')).toBeNull();
    h.say('seven'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.view.container.querySelector('[data-procedure-digit="0"]')?.textContent).toBe('7');
    expect(ringed(h.view.container)).toBe('Current tens column, top digit');
    h.say('two'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'di-worked-procedure', problemCount: 1, correctCount: 3,
      regroupStepsTotal: 1, regroupStepsCorrect: 1 });
  });

  it('outside a runtime the stage shows the needs-the-tutor card', () => {
    const view = render(<DiWorkedProcedure data={clean()} />);
    expect(view.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
  });
});
