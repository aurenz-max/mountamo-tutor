// @vitest-environment jsdom
/**
 * deep-dive on the shared teaching workspace: what its own Next challenge does. A check answered aloud must count
 * toward the lesson's end, or the last Next challenge closes the session and shows nothing.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('canvas-confetti', () => ({ default: vi.fn() })); // the summary panel's celebration needs a real canvas

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const CHECK = (id: string, question: string, options: string[]) => ({
  id, blockType: 'multiple-choice', label: `Check ${id}`, question, options, correctIndex: 0, explanation: 'Because of how it works.',
});
const DATA = {
  title: 'Hydraulic arms', topic: 'Hydraulics', gradeLevel: 'Grade 4',
  blocks: [
    CHECK('c1', 'What moves the piston?', ['oil', 'air', 'sand']),
    CHECK('c2', 'What does the rod do under pressure?', ['extends', 'shrinks', 'melts']),
    { id: 'after', blockType: 'prose', label: 'What comes next', paragraphs: ['The closing section of this lesson.'] },
  ],
};

const mount = () => {
  const h = mountWorkspace({ primitiveId: 'deep-dive', evalMode: 'recall', instanceId: 'deep-dive', data: DATA });
  h.settle(1000);
  return h;
};
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const tapRight = (h: WorkspaceHarness, option: string) => { h.press(option); h.press(/Check Answer/); h.settle(); };
/** The learner's Next challenge, through the transport the shell's button calls. */
const next = async (h: WorkspaceHarness) => {
  let done = false;
  void h.transport.learnerProgress('advance').then(() => { done = true; });
  for (let i = 0; i < 40 && !done; i++) { h.settle(50); await flush(); }
  h.settle();
  await flush();
};
const progressLog = (h: WorkspaceHarness) => h.runtime.trace.getSnapshot().filter(e => (e.stage as string) === 'learner_progress');

it('the lesson ends and shows its closing section when an earlier check was answered aloud', async () => {
  const h = mount();
  h.say('oil'); await flush();
  h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush();
  expect(h.state().task!.itemId).toBe('c2');
  tapRight(h, 'extends');
  expect(h.state().task!.phase).toBe('checked');
  expect(text(h)).not.toContain('The closing section');
  await next(h);
  expect(h.state().task!.phase).toBe('completed');
  expect(text(h)).toContain('The closing section');
  expect(text(h)).toContain('Deep Dive Complete!');
});

it('when every check was tapped, the last Next challenge is still what opens the end of the lesson', async () => {
  const h = mount();
  tapRight(h, 'oil');
  await next(h);
  tapRight(h, 'extends');
  expect(text(h)).not.toContain('Deep Dive Complete!');
  await next(h);
  expect(text(h)).toContain('The closing section');
  expect(text(h)).toContain('Deep Dive Complete!');
});

it('every Next challenge leaves a trace: what it found and what it changed', async () => {
  const h = mount();
  tapRight(h, 'oil');
  await next(h);
  expect(h.state().task!.itemId).toBe('c2');
  expect(progressLog(h).at(-1)).toMatchObject({ status: 'visible', input: { type: 'advance', itemId: 'c1', phase: 'checked' },
    result: { itemId: 'c2', phase: 'working', tutorToldNextTask: true } });
});

it('a press that cannot act says why instead of doing nothing', async () => {
  const h = mount();
  await h.transport.learnerProgress('advance');
  expect(progressLog(h).at(-1)).toMatchObject({ status: 'refused', input: { type: 'advance', itemId: 'c1', phase: 'working' } });
  expect(progressLog(h).at(-1)!.reason).toMatch(/no advance/i);
  h.close();
  await h.transport.learnerProgress('advance');
  expect(progressLog(h).at(-1)!.reason).toMatch(/closed/i);
});
