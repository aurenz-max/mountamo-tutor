// @vitest-environment jsdom
/**
 * Knowledge check's per-problem fallback, driven on the teaching workspace with the REAL evaluation hook: a problem
 * the spoken kinds cannot ask is worked on its own surface inside the session, its check is the gesture verdict, a
 * retry remounts it fresh, and the backend sees one record per problem (the inner surface is local-only).
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).submittedEvaluationSeam());
vi.mock('@/components/lumina/evaluation/contexts/EvaluationContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationContextSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, recordingEvaluationContext, restoreRuntimeTimers, seam } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { knowledgeCheckItems } from './knowledgeCheckWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const base = { difficulty: 'easy', gradeLevel: '1', rationale: 'Because.', teachingNote: '', successCriteria: [] };
const TF = { ...base, type: 'true_false', id: 'tf1', statement: 'A spider has eight legs', correct: true };
// The stem names its own answer, so the spoken menu cannot ask it (class 11).
const LEAKY = { ...base, type: 'multiple_choice', id: 'mc1', question: 'Which animal is the cow that says moo?', correctOptionId: 'A',
  options: [{ id: 'A', text: 'cow', emoji: '🐄' }, { id: 'B', text: 'duck', emoji: '🦆' }, { id: 'C', text: 'frog', emoji: '🐸' }] };
const data = (problems: unknown[]) => ({ problems, instanceId: 'check' });
const mount = (problems: unknown[]) =>
  mountWorkspace({ primitiveId: 'knowledge-check', evalMode: 'recall', data: data(problems), instanceId: 'check' });

const button = (text: string) => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(text))!;
const answer = (choice: string) => { fireEvent.click(button(choice)); fireEvent.click(button('Verify Answer')); };

it('the unaskable problem is worked on screen: its check is the verdict, a retry remounts it, one record per problem', async () => {
  seam.evaluationContext = recordingEvaluationContext();
  expect(knowledgeCheckItems(data([TF, LEAKY]) as never).items.map(i => i.kind)).toEqual(['true_false', 'on_screen']);
  const h = mount([TF, LEAKY]);
  h.say('yes'); h.feedback('correct', 'advance'); h.confirmVisible();

  // The problem's own surface renders inside the session, and the tutor is told it is a gesture.
  expect(document.querySelector('[data-on-screen="p1-screen"]')).not.toBeNull();
  expect(h.state().task!.demand.response).toBe('gesture');
  expect(h.state().task!.demand.constraints).toMatch(/works this problem on the screen/);
  expect(h.state().task!.task).toBe('Which animal is the cow that says moo? Do it on the screen.');

  answer('duck');
  expect(h.state().task!.workspace!.lastResponse?.correct).toBe(false);
  h.dispatch('retry'); h.confirmVisible();
  // Fresh surface: nothing selected, Verify available again.
  expect(button('Verify Answer')).toBeTruthy();
  answer('cow');
  expect(h.state().task!.workspace!.lastResponse?.correct).toBe(true);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');

  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  const sent = seam.submit.mock.calls.map(c => c[0] as { instanceId?: string });
  // The inner surface is local-only: the backend sees exactly the two ::pN records the session writes.
  expect(sent.map(r => r.instanceId).sort()).toEqual(['check::p0', 'check::p1']);
});
