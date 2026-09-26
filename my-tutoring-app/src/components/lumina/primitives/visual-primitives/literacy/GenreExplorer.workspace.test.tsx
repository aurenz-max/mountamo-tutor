// @vitest-environment jsdom
/**
 * Genre explorer on the teaching workspace: what is its own, plus its Pip surface. The generic
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
import { itemsFromPayload } from './genreExplorerScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const BEAR = 'The little brown bear put on his green coat and walked to school. He shared his honey with a friendly fox.';
const FACTS = 'Real bears sleep in dens through the winter months. They wake up in the spring to look for berries.';
const FEATURES = [
  { featureId: 'talk', predicate: 'have animals that talk or dress up', presentIn: ['e1'] },
  { featureId: 'facts', predicate: 'give true facts about real animals', presentIn: ['e2'] },
];
const PAYLOADS: Record<string, Record<string, unknown>> = {
  identify_basic: { title: 'Real or Make-Believe', gradeLevel: '1', mode: 'identify_basic', genreOptions: ['fiction', 'nonfiction'],
    excerpts: [{ excerptId: 'e1', text: BEAR, genre: 'fiction' }, { excerptId: 'e2', text: FACTS, genre: 'nonfiction' }], features: FEATURES },
  classify_genre: { title: 'Kinds of Writing', gradeLevel: '4', mode: 'classify_genre', supportTier: 'medium',
    genreOptions: ['fable', 'informational', 'poem'],
    excerpts: [{ excerptId: 'e1', text: 'A thirsty crow found a pitcher with a little water. It dropped in pebbles until the water rose. Little by little does the trick.', genre: 'fable' },
      { excerptId: 'e2', text: FACTS, genre: 'informational' }],
    features: [{ featureId: 'lesson', predicate: 'teach a lesson at the end', presentIn: ['e1'] }, FEATURES[1]] },
  compare_genres: { title: 'Two Bear Texts', gradeLevel: '5', mode: 'compare_genres', genreOptions: ['fiction', 'nonfiction'],
    excerpts: [{ excerptId: 'e1', text: BEAR, genre: 'fiction' }, { excerptId: 'e2', text: FACTS, genre: 'nonfiction' }], features: FEATURES },
};
const mount = (mode: string, pipStore?: PipSurfaceStore, data = PAYLOADS[mode]) =>
  mountWorkspace({ primitiveId: 'genre-explorer', evalMode: mode, data, instanceId: 'genre-explorer', pipStore });

it.each(Object.keys(PAYLOADS))('%s binds: the build gates\' answer is the spoken key', mode => {
  const d = PAYLOADS[mode];
  const first = itemsFromPayload(d as never).items[0];
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'genre-explorer', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mount(mode);
  const task = h.state().task!;
  expect(task.workspace!.expectedAnswer!.startsWith(first.answer)).toBe(true);
  expect(task.task).not.toMatch(/Your turn/);
  expect(Object.values(task.demand).join(' ')).toMatch(/bear|crow/i);
});

it('at the band floor the ask carries the text the tutor reads; above it the ask does not', () => {
  expect(mount('identify_basic').state().task!.task).toContain('little brown bear');
  cleanup();
  expect(mount('classify_genre').state().task!.task).not.toContain('thirsty crow');
});

it('a genre badge reaches the text only after credit; a miss reopens the item', () => {
  const h = mount('identify_basic');
  expect(screen.queryByRole('button', { name: /hear the question|check|next/i })).toBeNull();
  // Walk to the first genre question, crediting the evidence steps.
  for (let guard = 0; guard < 6 && !/kind of writing/.test(h.state().task!.task); guard++) {
    h.say('yes'); h.feedback('correct', 'advance'); h.confirmVisible();
  }
  expect(h.state().task!.task).toMatch(/kind of writing/);
  const answer = h.state().task!.workspace!.expectedAnswer!.split('.')[0];
  // The printed menu carries every label once; a credited genre adds its badge on the text.
  expect(screen.getAllByText(answer)).toHaveLength(1);
  h.say('the other one'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.task).toMatch(/kind of writing/);
  expect(screen.getAllByText(answer)).toHaveLength(1);
  h.say(answer); h.feedback('correct');
  expect(screen.getAllByText(answer)).toHaveLength(2);
});

it('right answers complete once and submit the genre metrics', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('compare_genres');
  const total = itemsFromPayload(PAYLOADS.compare_genres as never).items.length;
  for (let i = 0; i < total; i++) { h.say('answer'); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'genre-explorer', comparisonMade: true });
});

it('Pip outlines the texts and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('genre-explorer');
  const h = mount('identify_basic', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('yes'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a lesson with nothing askable', () => {
  const adapter = LIVE_ADAPTERS['genre-explorer'];
  expect(() => adapter.validate({ ...PAYLOADS.identify_basic, excerpts: [] })).toThrow();
  expect(adapter.validate(PAYLOADS.identify_basic)).toBeTruthy();
});
