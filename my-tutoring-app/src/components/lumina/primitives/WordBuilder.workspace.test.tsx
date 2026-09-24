// @vitest-environment jsdom
/**
 * Word builder on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../components/live-activity/activityContract';
import { workspaceBinding } from '../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../pip/PipSurfaceStore';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const PARTS = [
  { id: 'pre-un', text: 'un', type: 'prefix', meaning: 'not' },
  { id: 'root-help', text: 'help', type: 'root', meaning: 'to help' },
  { id: 'suf-ful', text: 'ful', type: 'suffix', meaning: 'full of' },
  { id: 'root-kind', text: 'kind', type: 'root', meaning: 'gentle and caring' },
  { id: 'suf-ness', text: 'ness', type: 'suffix', meaning: 'the state of being' },
];
const UNHELPFUL = { word: 'unhelpful', parts: ['pre-un', 'root-help', 'suf-ful'], hint: 'Describing someone who does not make things any easier',
  definition: 'Not giving any assistance.', sentenceContext: 'The broken lift was ___ for anyone pushing a pram.' };
const KINDNESS = { word: 'kindness', parts: ['root-kind', 'suf-ness'], hint: 'The quality of being gentle and caring toward others',
  definition: 'Being kind.', sentenceContext: 'Her ___ made the new student feel welcome.' };
const data = (mode: string, ...targets: unknown[]) =>
  ({ title: 'Build', complexityLevel: mode, availableParts: PARTS, targets }) as unknown as Record<string, unknown>;

it.each(['simple_affix', 'compound_affix', 'greek_latin', 'multi_morpheme'])('%s binds: the spoken word is the key; nothing on screen shows it', mode => {
  const d = data(mode, UNHELPFUL);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'word-builder', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'word-builder', evalMode: mode, data: d });
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^unhelpful \(un \+ help \+ ful\)/);
  expect(h.state().task!.task).not.toMatch(/unhelpful/);
  expect(document.body.textContent).not.toMatch(/unhelpful/i);
});

it('a wrong word reopens with no reveal; a right one reveals the assembly; the lesson completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'word-builder', evalMode: 'simple_affix', data: data('simple_affix', UNHELPFUL, KINDNESS) });
  h.say('help'); h.feedback('incorrect', 'retry');
  expect(document.body.textContent).not.toMatch(/unhelpful/i);
  h.say('unhelpful'); h.feedback('correct');
  expect(screen.getByText('unhelpful')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('kindness');
  h.say('kindness'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ wordsCompleted: 2, wordsTotal: 2 });
});

it('Say the clue again asks for the clue silently, as the host, never the word', () => {
  mountWorkspace({ primitiveId: 'word-builder', evalMode: 'simple_affix', data: data('simple_affix', UNHELPFUL) });
  fireEvent.click(screen.getByRole('button', { name: 'Say the clue again' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('Describing someone who does not make things any easier');
  expect(text).not.toMatch(/unhelpful/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('Pip points at the clue, never the word-part wall, and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('words');
  const h = mountWorkspace({ primitiveId: 'word-builder', evalMode: 'simple_affix', data: data('simple_affix', UNHELPFUL),
    instanceId: 'words', pipStore: store });
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('unhelpful'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a word whose parts do not spell it', () => {
  const adapter = LIVE_ADAPTERS['word-builder'];
  expect(() => adapter.validate(data('simple_affix', { ...UNHELPFUL, parts: ['pre-un', 'root-help'] }))).toThrow();
  expect(adapter.validate(data('simple_affix', UNHELPFUL, KINDNESS))).toBeTruthy();
});
