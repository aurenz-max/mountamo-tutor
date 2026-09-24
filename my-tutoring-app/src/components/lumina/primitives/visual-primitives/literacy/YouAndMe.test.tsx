// @vitest-environment jsdom
/**
 * You & Me on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import type { YouAndMeData } from './YouAndMe';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

function fixture(): YouAndMeData {
  const scene = {
    sceneId: 'bag', type: 'describe_action' as const,
    participants: [{ name: 'Maya', emoji: '👧' }, { name: 'Leo', emoji: '👦' }] as YouAndMeData['challenges'][number]['participants'],
    actor: 0 as const, object: 'bag', objectEmoji: '🎒', action: 'packed the bag',
  };
  return { title: 'You & Me', description: 'Trade speaking roles', gradeLevel: 'K', challengeType: 'describe_action',
    challenges: [{ ...scene, id: 'bag-a', speaker: 0 }, { ...scene, id: 'bag-b', speaker: 1 }] };
}
const mount = (data: YouAndMeData, mode = data.challengeType) =>
  mountWorkspace({ primitiveId: 'you-and-me', evalMode: mode, data: data as unknown as Record<string, unknown> });

describe('You & Me learner contract', () => {
  it.each(['describe_action', 'describe_independent_action', 'mixed'])('%s binds in a lesson', mode => {
    const data = fixture();
    if (mode !== 'describe_action') data.challenges[1].type = 'describe_independent_action';
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'you-and-me', pin: mode, objectiveIds: ['o'],
      data })).not.toBeNull();
  });

  it('publishes the pronoun the role needs as the key; the task and screen never print a model sentence', () => {
    const h = mount(fixture());
    expect(h.state().task!.workspace!.expectedAnswer).toContain('"I" as the subject');
    expect(h.state().task!.task).toContain('Maya packed the bag.');
    expect(h.state().task!.task).not.toMatch(/I packed/);
    expect(screen.queryByText('I packed the bag.')).toBeNull();
  });

  it.each(['easy', 'medium', 'hard'] as const)('renders %s support while keeping the task', supportTier => {
    const data = fixture();
    data.challenges = data.challenges.map(ch => ({ ...ch, type: 'describe_independent_action', supportTier }));
    mount(data, 'describe_independent_action');
    expect(Boolean(screen.queryByText('Did the action'))).toBe(supportTier === 'easy');
    expect(screen.getByRole('img', { name: 'Maya' }).parentElement!.className.includes('border-pink-300')).toBe(supportTier !== 'hard');
    expect(Boolean(screen.queryByText(/Check before speaking:/))).toBe(supportTier === 'easy');
    expect(Boolean(screen.queryByText(/Keep the no-help sentence/))).toBe(supportTier === 'medium');
    expect(screen.getByText('Maya packed the bag without any help.')).toBeTruthy();
    expect(screen.getByText(/Use a self word/)).toBeTruthy();
    expect(screen.queryByText(/by myself/)).toBeNull();
  });

  it('a wrong sentence restates the roles on Try again; the next turn trades the speaker and clears it', () => {
    const h = mount(fixture());
    h.say('You packed the bag.'); h.feedback('incorrect', 'retry');
    expect(screen.getByText('Maya is speaking. Maya did the action.')).toBeTruthy();
    h.say('I packed the bag.'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(screen.queryByText('Maya is speaking. Maya did the action.')).toBeNull();
    const leo = screen.getByRole('img', { name: 'Leo' }).parentElement!;
    const maya = screen.getByRole('img', { name: 'Maya' }).parentElement!;
    expect(within(leo).getByText('Speaking now')).toBeTruthy();
    expect(within(maya).getByText('Did the action')).toBeTruthy();
    expect(screen.getByText(/Trade roles/)).toBeTruthy();
    expect(h.state().task!.workspace!.expectedAnswer).toContain('"you" as the subject');
  });

  it('submits per-mode results from the workspace record, once', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const data = fixture();
    data.challengeType = 'mixed';
    data.challenges[1].type = 'describe_independent_action';
    const h = mount(data, 'mixed');
    h.say('I packed the bag.'); h.feedback('correct', 'advance'); h.confirmVisible();
    h.say('You packed the bag.'); h.feedback('incorrect', 'retry');
    h.say('You packed the bag by yourself.'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengeType: 'mixed', correctCount: 2, firstTryCount: 1,
      modeResults: [{ mode: 'describe_action', total: 1, correct: 1, accuracy: 100 },
        { mode: 'describe_independent_action', total: 1, correct: 1, accuracy: 67 }] });
    expect(seam.submit.mock.calls[0][3].perspectives).toHaveLength(2);
  });

  it('Hear the scene again asks for the scene and the ask only, silently, as the host', () => {
    mount(fixture());
    fireEvent.click(screen.getByRole('button', { name: /hear the scene again/i }));
    const [text, options] = seam.send.mock.calls.at(-1)!;
    expect(text).toContain('Maya packed the bag.');
    expect(text).not.toMatch(/I packed/);
    expect(options).toMatchObject({ silent: true, author: 'host' });
  });

  it('the adapter refuses a turn whose speaker is not one of the partners', () => {
    const data = fixture();
    (data.challenges[0] as { speaker: number }).speaker = 2;
    expect(() => LIVE_ADAPTERS['you-and-me'].validate(data)).toThrow();
  });
});
