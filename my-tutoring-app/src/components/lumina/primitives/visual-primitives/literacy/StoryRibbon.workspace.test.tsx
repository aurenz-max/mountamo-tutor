// @vitest-environment jsdom
/**
 * Story ribbon on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';
import { STORY_RIBBON_FALLBACKS } from '../../../service/literacy/gemini-story-ribbon';
import type { StoryRibbonChallenge, StoryRibbonChallengeType } from './StoryRibbon';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const CUE = { tell_present_account: 'Today', tell_future_account: 'Tomorrow', tell_past_account: 'Yesterday' } as const;
const as = (type: StoryRibbonChallengeType, base: StoryRibbonChallenge): StoryRibbonChallenge => {
  const { timeCue: _drop, ...rest } = base;
  return { ...rest, type, ...(type in CUE ? { timeCue: CUE[type as keyof typeof CUE] } : {}) };
};
const data = (type: StoryRibbonChallengeType, count = 1): Record<string, unknown> =>
  ({ title: 'Ribbons', description: '', gradeLevel: 'K', challengeType: type,
    challenges: STORY_RIBBON_FALLBACKS.slice(0, count).map(c => as(type, c)) });

const MODES: StoryRibbonChallengeType[] = ['tell_connected_account', 'tell_present_account', 'tell_future_account', 'tell_past_account', 'story_to_experience'];

it.each(MODES)('%s binds: the spoken account is judged against the three events; none is on screen', mode => {
  const d = data(mode);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'story-ribbon', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'story-ribbon', evalMode: mode, data: d });
  const [first] = STORY_RIBBON_FALLBACKS;
  const task = h.state().task!;
  expect(task.workspace!.expectedAnswer).toContain(first.events[0].modelSentence.replace(/[.!?]$/, ''));
  for (const event of first.events) expect(document.body.textContent).not.toContain(event.modelSentence);
  // The scene lists the pictures without their story order.
  expect(String(task.demand.pictures)).toBe(first.events.map(e => e.pictureLabel).sort((a, b) => a.localeCompare(b)).join('; '));
});

it('a wrong account reopens with the board kept; right accounts complete once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'story-ribbon', evalMode: 'tell_connected_account', data: data('tell_connected_account', 2) });
  const cards = () => Array.from(document.querySelectorAll('[data-pip-object^="card-"]')).map(el => el.getAttribute('data-pip-object'));
  const [a, b] = cards();
  h.touch(a!); h.touch(b!);
  const swapped = cards();
  h.say('a garden'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.phase).toBe('working');
  expect(cards()).toEqual(swapped);
  expect(document.body.textContent).not.toContain(STORY_RIBBON_FALLBACKS[0].events[0].modelSentence);
  h.say('the whole story'); h.feedback('correct');
  expect(screen.getByText('Your story connected')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  h.say('the whole story'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ totalChallenges: 2, correctCount: 2 });
});

it('Hear the directions again asks silently, as the host, and names no event', () => {
  mountWorkspace({ primitiveId: 'story-ribbon', evalMode: 'tell_connected_account', data: data('tell_connected_account') });
  fireEvent.click(screen.getByRole('button', { name: 'Hear the directions again' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  for (const event of STORY_RIBBON_FALLBACKS[0].events) expect(text).not.toContain(event.modelSentence);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('Pip outlines the ribbon and celebrates the credited account', () => {
  const store = new PipSurfaceStore();
  store.setActive('ribbon');
  const h = mountWorkspace({ primitiveId: 'story-ribbon', evalMode: 'tell_connected_account', data: data('tell_connected_account'),
    instanceId: 'ribbon', pipStore: store });
  expect(store.getActive()?.targets.map(t => t.id)).toContain('ribbon');
  h.say('the whole story'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a ribbon whose time cue does not match its mode', () => {
  const adapter = LIVE_ADAPTERS['story-ribbon'];
  expect(() => adapter.validate({ ...data('tell_past_account'), challenges: [{ ...as('tell_past_account', STORY_RIBBON_FALLBACKS[0]), timeCue: 'Today' }] })).toThrow();
  expect(adapter.validate(data('tell_past_account'))).toBeTruthy();
});
