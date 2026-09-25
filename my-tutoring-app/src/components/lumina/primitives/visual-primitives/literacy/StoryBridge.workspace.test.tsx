// @vitest-environment jsdom
/**
 * Story bridge on the teaching workspace: what is its own, plus its Pip surface. The generic
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
import { FALLBACK_PAIR, challengesFromPair } from '../../../service/literacy/gemini-story-bridge';
import { itemsFromChallenges } from './storyBridgeScript';
import type { StoryBridgeChallengeType } from './StoryBridge';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const stories = [FALLBACK_PAIR.a, FALLBACK_PAIR.b];
const data = (...modes: StoryBridgeChallengeType[]): Record<string, unknown> =>
  ({ title: 'Two stories', description: '', gradeLevel: 'K', challengeType: 'mixed', stories,
    challenges: challengesFromPair(FALLBACK_PAIR, 0, 0, modes) });
const firstItem = (d: Record<string, unknown>) => itemsFromChallenges(d.challenges as never, stories)[0];

const MODES: StoryBridgeChallengeType[] = ['match_character', 'match_setting', 'venn_place', 'sequence_two', 'say_alike', 'say_different', 'main_idea_compare'];

it.each(MODES)('%s binds; a spoken comparison publishes its reference, a tap key never reaches the tutor', mode => {
  const d = data(mode);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'story-bridge', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'story-bridge', evalMode: mode, data: d });
  const item = firstItem(d);
  const task = h.state().task!;
  expect(task.itemId).toBe(item.id);
  if (item.answerKind === 'voice') {
    expect(task.workspace!.expectedAnswer).toContain(item.comparisonSummary);
  } else {
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(JSON.stringify(h.packet())).not.toContain(`"correctChoiceId"`);
  }
  // Before credit no evidence panel is shown.
  expect(document.body.textContent).not.toContain(item.comparisonSummary);
});

it('a wrong tap reopens on Try again; a right tap and a spoken comparison complete once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const d = data('match_setting', 'say_alike');
  const items = itemsFromChallenges(d.challenges as never, stories);
  const h = mountWorkspace({ primitiveId: 'story-bridge', evalMode: 'mixed', data: d });
  const wrong = items[0].choiceIds.find(id => id !== items[0].correctChoiceId)!;
  h.touch(`choice-${wrong}`);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry'); h.confirmVisible();
  expect(h.state().task!.phase).toBe('working');
  h.touch(`choice-${items[0].correctChoiceId}`);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(items[1].id);
  h.say(items[1].comparisonSummary); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ totalChallenges: 2, correctCount: 2 });
});

it('the replay button asks for both stories silently, as the host, never the comparison', () => {
  const d = data('say_alike');
  mountWorkspace({ primitiveId: 'story-bridge', evalMode: 'say_alike', data: d });
  fireEvent.click(screen.getByRole('button', { name: 'Hear both stories again' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain(FALLBACK_PAIR.a.title);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('Pip points at the ringed friend on a character match and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('bridge');
  const d = data('match_character');
  const h = mountWorkspace({ primitiveId: 'story-bridge', evalMode: 'match_character', data: d, instanceId: 'bridge', pipStore: store });
  expect(store.getActive()?.targets.map(t => t.id)).toContain('anchor');
  h.touch(`choice-${firstItem(d).correctChoiceId}`);
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a bridge without its story pair', () => {
  const adapter = LIVE_ADAPTERS['story-bridge'];
  expect(() => adapter.validate({ ...data('say_alike'), stories: [FALLBACK_PAIR.a] })).toThrow();
  expect(adapter.validate(data('say_alike'))).toBeTruthy();
});
