// @vitest-environment jsdom
/**
 * Sentence analyzer on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
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
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';
import fixtures from '../../../pip/testing/workspaceFixtures.json';
import { itemsFromPayload } from './sentenceAnalyzerScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

// A generated grade-4 lesson with one challenge of every type.
const GENERATED = (fixtures as Record<string, any>)['sentence-analyzer'];
const MODES = ['identify_pos', 'identify_role', 'label_all', 'parse_structure'];
const payload = (mode: string) => ({ ...GENERATED, challenges: GENERATED.challenges.filter((c: { type: string }) => c.type === mode) });
const mount = (mode: string, pipStore?: PipSurfaceStore, data: Record<string, unknown> = payload(mode)) =>
  mountWorkspace({ primitiveId: 'sentence-analyzer', evalMode: mode, data, instanceId: 'sentence-analyzer', pipStore });
const itemsOf = (mode: string) => itemsFromPayload(payload(mode) as never).items;

it.each(MODES)('%s binds: the build gates\' label is the spoken key', mode => {
  const items = itemsOf(mode);
  expect(items.length).toBeGreaterThan(0);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'sentence-analyzer', pin: mode, objectiveIds: ['o'], data: payload(mode) })).not.toBeNull();
  const h = mount(mode);
  const task = h.state().task!;
  expect(task.workspace!.expectedAnswer!.toLowerCase().startsWith(items[0].answer.toLowerCase())).toBe(true);
  expect(task.task).not.toMatch(/Your turn/);
  expect(task.demand.sentence).toBe(items[0].sentence);
});

it('a label appears under the word only after credit; a miss reopens the item', () => {
  const h = mount('identify_pos');
  const first = itemsOf('identify_pos')[0];
  expect(screen.queryByRole('button', { name: /hear the question|check|next/i })).toBeNull();
  const badges = () => Array.from(document.querySelectorAll('.rounded-full')).map(el => el.textContent);
  expect(badges()).not.toContain(first.answer);
  h.say('Conjunction'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(first.id);
  expect(badges()).not.toContain(first.answer);
  h.say(first.answer); h.feedback('correct');
  expect(badges()).toContain(first.answer);
});

it('a role question refuses a part of speech in its key', () => {
  const h = mount('identify_role');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/part of speech .* is wrong/);
});

it('right answers complete once and submit the grammar metrics', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('identify_pos');
  for (let i = 0; i < itemsOf('identify_pos').length; i++) { h.say('answer'); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'sentence-analyzer', posIdentifyCorrect: itemsOf('identify_pos').length });
});

it('Pip outlines the sentence and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('sentence-analyzer');
  const h = mount('identify_pos', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('noun'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a lesson with nothing askable', () => {
  const adapter = LIVE_ADAPTERS['sentence-analyzer'];
  expect(() => adapter.validate({ ...GENERATED, challenges: [] })).toThrow();
  expect(adapter.validate(GENERATED)).toBeTruthy();
});
