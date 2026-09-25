// @vitest-environment jsdom
/**
 * Interactive book on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/service/geminiClient-api', () => ({ generateConceptImage: vi.fn(async () => null) }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const page = (n: number, heading: string, caption: string, paragraph: string) => ({
  id: `p${n}`, pageNumber: n, heading, caption, paragraphs: [paragraph],
  imagePrompt: '', imageAlt: 'a picture', imageUrl: 'data:image/png;base64,', focusWords: [],
});
const READ = { id: 'ib-w1', type: 'read-focus-word', prompt: '', hint: '', targetPageId: 'p1', targetFeature: 'focus-word',
  targetText: 'frog', optionTexts: ['frog', 'pond'], readLead: 'The green', readTail: 'can hop by the pond.' };
const FIND = { id: 'ib-f2', type: 'find-feature', prompt: '', hint: '', targetPageId: 'p2', targetFeature: 'caption',
  targetText: 'Nest Above', optionTexts: ['Safe Nests', 'Nest Above', 'Page 2'] };
const data = (...challenges: unknown[]): Record<string, unknown> => ({
  title: 'Pond', description: '', gradeLevel: 'K', mode: 'mixed', challengeType: 'mixed', wordDifficulty: 'easy',
  books: [{
    id: 'b1', bookTitle: 'Pond Neighbors', author: 'Mia Lee', coverColor: 'blue', coverImagePrompt: '', coverImageAlt: 'a pond',
    coverImageUrl: 'data:image/png;base64,',
    pages: [page(1, 'At the Pond', 'Frog Friends', 'The green frog can hop by the pond.'),
      page(2, 'Safe Nests', 'Nest Above', 'A bird sits in a nest.')],
  }],
  challenges,
});

it.each([['read-focus-word', READ], ['find-feature', FIND]] as const)('%s binds; a spoken key is published, a tap key is not', (mode, challenge) => {
  const d = data(challenge);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'interactive-book', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'interactive-book', evalMode: mode, data: d });
  const task = h.state().task!;
  if (mode === 'read-focus-word') {
    expect(task.workspace!.expectedAnswer).toMatch(/^frog/);
    expect(task.task).toContain('The green');
    expect(task.task).not.toMatch(/frog/);
  } else {
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(JSON.stringify(h.packet())).not.toMatch(/Nest Above/);
  }
});

it('a wrong tap reopens on Try again with the page cleared; a right tap and a read word complete once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'interactive-book', evalMode: 'mixed', data: data(READ, FIND) });
  h.say('frog'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('ib-f2');
  h.touch('part-p2-heading');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry'); h.confirmVisible();
  expect(h.state().task!.phase).toBe('working');
  expect(document.querySelector('[data-pip-object="part-p2-heading"]')!.className).not.toMatch(/rose|red/);
  h.touch('part-p2-caption');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ totalChallenges: 2, correctCount: 2 });
});

it('the speaker asks for the question silently, as the host, never the word', () => {
  mountWorkspace({ primitiveId: 'interactive-book', evalMode: 'read-focus-word', data: data(READ) });
  fireEvent.click(screen.getByRole('button', { name: 'Hear the question again' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('The green');
  expect(text).not.toMatch(/frog/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('Pip points at the glowing word and celebrates the credited read', () => {
  const store = new PipSurfaceStore();
  store.setActive('book');
  const h = mountWorkspace({ primitiveId: 'interactive-book', evalMode: 'read-focus-word', data: data(READ),
    instanceId: 'book', pipStore: store });
  expect(store.getActive()?.targets.map(t => t.id)).toContain('glow');
  h.say('frog'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a book with an item that cannot be asked', () => {
  const adapter = LIVE_ADAPTERS['interactive-book'];
  expect(() => adapter.validate(data({ ...READ, readLead: 'The' }))).toThrow();
  expect(adapter.validate(data(READ, FIND))).toBeTruthy();
});
