// @vitest-environment jsdom
/**
 * di-deduction on the teaching workspace (rollout C6): every case shape binds; the rule and case are
 * printed and the verdict words are a guide that nothing lights before credit; the key carries the
 * reason requirement and the signature error; credit writes a conclusion to the ledger of its rule.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import DiDeduction, { type DiDeductionData } from './DiDeduction';
import type { DeductionShape } from './diDeductionPlan';
import { deductionItems } from './diDeductionWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const birds = { id: 'birds', category: 'bird', categoryPlural: 'birds', propertyPlural: 'lay eggs', propertySingular: 'lays eggs',
  propertyNegated: 'does not lay eggs', kindNoun: 'animal', members: ['robin'], nonMembers: ['dog'], lookalikes: ['turtle'] };
const pack = (shapes: DeductionShape[], challengeType: DeductionShape = shapes[0]): DiDeductionData => ({
  title: 'Use the Rule', description: 'Decide only from the rule.', challengeType, rules: [{ ...birds, shapes }] });
const mount = (data: DiDeductionData, mode: string = data.challengeType) =>
  mountWorkspace({ primitiveId: 'di-deduction', evalMode: mode, data: data as unknown as Record<string, unknown> });

describe('DiDeduction — every shape binds and is spoken', () => {
  it.each(['conclude', 'deny', 'cannot_tell'] as const)('%s binds in a lesson and asks from the rule', shape => {
    const data = pack([shape]);
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'di-deduction', pin: shape, objectiveIds: ['o'], data })).not.toBeNull();
    const h = mount(data);
    const task = h.state().task!;
    expect(task.demand).toMatchObject({ kind: shape });
    expect(screen.getByText('All birds lay eggs.')).toBeTruthy();
    expect(screen.queryAllByText(/can't tell/).length).toBe(shape === 'conclude' ? 0 : 1);
    expect(h.view.container.querySelector('[data-lit="true"]')).toBeNull();
  });

  it('the keys carry the reason requirement and the signature error', () => {
    const [deny] = deductionItems(pack(['deny']));
    expect(mount(pack(['deny'])).state().task!.workspace!.expectedAnswer).toContain('A no with no reason');
    expect(deny.case.caseText).not.toContain('not a bird');
    cleanup();
    const key = mount(pack(['cannot_tell'])).state().task!.workspace!.expectedAnswer!;
    expect(key).toContain('a turtle lays eggs and is not a bird');
    expect(key).toContain('signature error');
  });

  it('neither the task nor the scene states the conclusion', () => {
    const h = mount(pack(['conclude']));
    const [item] = deductionItems(pack(['conclude']));
    const handed = JSON.stringify({ task: h.state().task!.task, demand: h.state().task!.demand });
    expect(handed).not.toContain(item.case.conclusionText);
    expect(screen.queryByText(item.case.conclusionText)).toBeNull();
  });

  it('the adapter refuses a rule the plan gates drop', () => {
    expect(() => LIVE_ADAPTERS['di-deduction'].validate({ ...pack(['conclude']), rules: [{ ...birds, members: [] }] })).toThrow();
  });
});

describe('DiDeduction — credit writes the conclusion, a miss never does', () => {
  it('a wrong verdict reopens; credit lights the verdict and writes the ledger of its rule', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const data = pack(['conclude', 'deny'], 'conclude');
    const [conclude, deny] = deductionItems(data);
    const h = mount(data, 'mixed');
    h.say('it does not lay eggs'); h.feedback('incorrect', 'retry');
    expect(h.view.container.querySelector('[data-deduction-credited]')).toBeNull();
    h.say('a robin lays eggs'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.view.container.querySelector(`[data-deduction-credited="${conclude.id}"]`)?.textContent).toBe(conclude.case.conclusionText);
    h.say('no, a dog is not a bird, because all birds lay eggs and a dog does not'); h.feedback('correct', 'none');
    expect(h.view.container.querySelector('[data-verdict="no"]')?.getAttribute('data-lit')).toBe('true');
    expect(h.view.container.querySelector(`[data-deduction-credited="${deny.id}"]`)).not.toBeNull();
  });

  it('completes and reports the rule count', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(pack(['conclude', 'cannot_tell'], 'conclude'), 'mixed');
    h.say('a robin lays eggs'); h.feedback('correct', 'advance'); h.confirmVisible();
    h.say("can't tell, a turtle lays eggs too"); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'di-deduction', ruleCount: 1, correctCount: 2,
      cannotTellTotal: 1, cannotTellCorrect: 1 });
  });

  it('outside a runtime the stage shows the needs-the-tutor card', () => {
    const view = render(<DiDeduction data={pack(['conclude'])} />);
    expect(view.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
  });
});
