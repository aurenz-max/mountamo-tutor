// @vitest-environment jsdom
/**
 * Oral sentence studio on the teaching workspace: what is its own. Pip is the shared contract's
 * (`pip/WorkspacePip.surface.test.tsx`). The generic W1 contract (runtime/workspaceContract.test.tsx) covers
 * ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { ORAL_SENTENCE_STUDIO_FALLBACKS } from '../../../service/literacy/gemini-oral-sentence-studio';
import { spokenKeyText } from '../../../components/live-activity/spokenKey';
import { itemsFromChallenges, oralSentenceKey } from './oralSentenceStudioDomain';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES = ['describe_scene', 'guided_writing_rehearsal', 'use_story_words'] as const;
const challengesOf = (mode: string) => ORAL_SENTENCE_STUDIO_FALLBACKS.filter(c => c.type === mode).slice(0, 2);
const payload = (mode: string) => ({ title: 'Sentences', description: 'Say one', challengeType: mode, challenges: challengesOf(mode) });
const mount = (mode: string) =>
  mountWorkspace({ primitiveId: 'oral-sentence-studio', evalMode: mode, data: payload(mode), instanceId: 'oral' });

it.each(MODES)('%s binds: the key is judged on meaning, with the anchors as examples', mode => {
  const items = itemsFromChallenges(challengesOf(mode));
  expect(items.length).toBe(2);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'oral-sentence-studio', pin: mode, objectiveIds: ['o'], data: payload(mode) })).not.toBeNull();
  const task = mount(mode).state().task!;
  const key = task.workspace!.expectedAnswer!;
  expect(key).toBe(spokenKeyText(oralSentenceKey(items[0])));
  expect(key).toMatch(/^An explanation in the learner's own words that means/);
  for (const example of items[0].challenge.acceptedSentences) expect(key).toContain(example);
  for (const word of items[0].challenge.targetWords) expect(task.task).toContain(word);
  for (const example of items[0].challenge.acceptedSentences) expect(task.task).not.toContain(example);
});

it('story words carries the story in the ask and refuses a story line said back', () => {
  const task = mount('use_story_words').state().task!;
  const story = challengesOf('use_story_words')[0].storyText!;
  expect(task.task).toContain(story);
  expect(task.demand.story).toContain(story);
  expect(task.workspace!.expectedAnswer).toMatch(/a sentence from the story said back/);
});

it('rehearsal names the step already written and refuses it', () => {
  const c = challengesOf('guided_writing_rehearsal')[0];
  const task = mount('guided_writing_rehearsal').state().task!;
  expect(task.demand.alreadyWritten).toBe(c.priorStepLabel);
  expect(task.workspace!.expectedAnswer).toContain(`a sentence about the step already written ("${c.priorStepLabel}")`);
});

it('the example sentence appears only after credit, never on a retry', () => {
  const h = mount('describe_scene');
  const model = itemsFromChallenges(challengesOf('describe_scene'))[0].modelResponse;
  expect(screen.queryByText(model)).toBeNull();
  expect(screen.queryByRole('button', { name: /hear the words|start/i })).toBeNull();
  h.say('curious tiny'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(screen.queryByText(model)).toBeNull();
  h.say(model); h.feedback('correct');
  expect(screen.getByText(model)).toBeTruthy();
});

it('right answers complete once and submit the sentence metrics', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('use_story_words');
  for (let i = 0; i < 2; i++) { h.say('answer'); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'oral-sentence-studio', totalChallenges: 2, correctCount: 2 });
});

it('the adapter refuses a lesson with nothing askable', () => {
  const adapter = LIVE_ADAPTERS['oral-sentence-studio'];
  expect(() => adapter.validate({ ...payload('describe_scene'), challenges: [] })).toThrow();
  expect(adapter.validate(payload('describe_scene'))).toBeTruthy();
});
