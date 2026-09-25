// @vitest-environment jsdom
/**
 * Decodable reader on the teaching workspace: what is its own, plus its Pip surface. The generic
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
import { itemsFromChallenges } from './decodableReaderScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const sentence = (id: string, text: string) => ({
  id, words: text.split(' ').map((w, i) => ({ id: `${id}_w${i}`, text: w, phonicsPattern: 'cvc' })),
});
const SENTENCES = [sentence('s1', 'The cat sat on a mat.'), sentence('s2', 'The dog can run.')];
const LITERAL = { question: 'What did the cat sit on?', answerWord: 'mat' };
const CHOICE = {
  question: 'What is the story mostly about?', correctOptionId: 'A',
  options: [
    { id: 'A', text: 'A cat and a dog at home.', emoji: '🏠' },
    { id: 'B', text: 'A trip to the moon.', emoji: '🚀' },
    { id: 'C', text: 'Baking a big cake.', emoji: '🎂' },
  ],
};
const data = (mode: string): Record<string, unknown> => ({
  title: 'Story', gradeLevel: '1', phonicsPatternsInPassage: ['cvc'], passage: { sentences: SENTENCES },
  readingMode: mode === 'read_along' ? 'read_along' : 'decode',
  comprehensionType: mode === 'read_along' ? 'literal' : mode,
  comprehensionQuestions: [mode === 'read_along' || mode === 'literal' ? LITERAL : CHOICE],
});
const itemsOf = (d: Record<string, unknown>) => itemsFromChallenges(d as never).items;

it.each(['read_along', 'literal', 'sequence', 'inference', 'main_idea'])('%s binds: every item is spoken and its key never shows before credit', mode => {
  const d = data(mode);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'decodable-reader', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'decodable-reader', evalMode: mode, data: d });
  const first = itemsOf(d)[0];
  const task = h.state().task!;
  expect(task.itemId).toBe(first.id);
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  if (first.kind === 'read_line') {
    // A cold read: the ask never carries the line.
    expect(task.task).not.toMatch(/cat sat/);
    expect(task.workspace!.expectedAnswer).toContain('The cat sat on a mat.');
  } else {
    expect(task.task).not.toMatch(/\bmat\b/);
    expect(document.body.textContent).not.toMatch(/yes!/);
  }
});

it('a wrong read reopens the line with no credit; every item credited completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const d = data('literal');
  const items = itemsOf(d);
  const h = mountWorkspace({ primitiveId: 'decodable-reader', evalMode: 'literal', data: d });
  h.say('The cat sat on the mat.'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe(items[0].id);
  expect(document.body.textContent).not.toMatch(/yes!/);
  h.say('The cat sat on a mat.'); h.feedback('correct');
  expect(document.body.textContent).toMatch(/yes!/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(items[1].id);
  h.say('The dog can run.'); h.feedback('correct', 'advance'); h.confirmVisible();
  // The answer word is on screen only once the question is credited.
  expect(screen.queryByText('mat')).toBeNull();
  h.say('mat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ linesTotal: 2, linesRead: 2, questionsTotal: 1, questionsCorrect: 1 });
});

it('Say that again asks silently, as the host, and never reads the line', () => {
  mountWorkspace({ primitiveId: 'decodable-reader', evalMode: 'literal', data: data('literal') });
  fireEvent.click(screen.getByRole('button', { name: 'Say that again' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).not.toMatch(/cat sat/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('Pip points at the whole line and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('reader');
  const h = mountWorkspace({ primitiveId: 'decodable-reader', evalMode: 'main_idea', data: data('main_idea'),
    instanceId: 'reader', pipStore: store });
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['line']);
  h.say('The cat sat on a mat.'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a story with nothing that can be asked', () => {
  const adapter = LIVE_ADAPTERS['decodable-reader'];
  expect(() => adapter.validate({ ...data('literal'), passage: { sentences: [] } })).toThrow();
  expect(adapter.validate(data('literal'))).toBeTruthy();
});
