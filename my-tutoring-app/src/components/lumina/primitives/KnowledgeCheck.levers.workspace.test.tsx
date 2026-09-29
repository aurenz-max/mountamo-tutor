// @vitest-environment jsdom
/**
 * knowledge-check's levers on the shared teaching workspace (handoff 25): the cue picture and the greyed-out choice
 * appear in the pull's commit, a greyed-out choice cannot be touched, no pull is offered when it would leave fewer than two
 * untried choices, and the credit after a pull is assisted.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const base = { difficulty: 'easy', gradeLevel: '1', rationale: 'Because.', teachingNote: '', successCriteria: [] };
const HONEY = { ...base, type: 'multiple_choice', id: 'mc1', question: 'Which animal makes honey?', correctOptionId: 'A',
  cue: { picture: '🍯', shows: 'a jar of honey' },
  options: [{ id: 'A', text: 'a bee', distance: 'key' }, { id: 'B', text: 'an ant', distance: 'near' }, { id: 'C', text: 'a cow', distance: 'far' }] };
const SUMS = { ...base, type: 'multiple_choice', id: 'mc2', question: 'What is seven plus three?', optionFormat: 'katex', correctOptionId: 'B',
  options: [{ id: 'A', text: '9' }, { id: 'B', text: '10' }, { id: 'C', text: '11' }, { id: 'D', text: '3' }] };
const mount = (problems: unknown[]) =>
  mountWorkspace({ primitiveId: 'knowledge-check', evalMode: 'recall', data: { problems, instanceId: 'check' }, instanceId: 'check' });
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers?.map(l => [l.id, l.pulled]);
const dropped = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('[data-dropped]')).map(e => e.textContent);

it('spoken choice: the cue shows in the pull; after a wrong answer a 3-choice menu offers no drop', () => {
  const h = mount([HONEY]);
  expect(levers(h)).toEqual([['cue_picture', false], ['drop_far_choice', false]]);
  expect(h.view.container.querySelector('[data-lever-cue]')).toBeNull();

  const receipt = h.dispatch('pull_lever', { lever: 'cue_picture' });
  expect(h.view.container.querySelector('[data-lever-cue]')?.textContent).toBe('🍯');
  expect(String(receipt.state.task!.demand.levers_on_screen)).toContain('a jar of honey');
  expect(String(receipt.state.task!.demand.levers_on_screen)).not.toMatch(/bee/);

  h.say('an ant'); h.feedback('incorrect');
  // The wrong answer is not yet retried: the drop would leave the key and the learner's own pick.
  expect(levers(h)).toEqual([['cue_picture', true]]);
  expect(h.offer('pull_lever')).toBeFalsy();
  expect(dropped(h)).toEqual([]);
  h.dispatch('retry'); h.confirmVisible();
  expect(levers(h)).toEqual([['cue_picture', true]]);

  h.say('a bee'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['cue_picture'] });
  h.close();
});

it('touched choice: the farthest untried choice greys out, cannot be touched, and the credit is assisted', () => {
  const h = mount([SUMS]);
  expect(levers(h)).toEqual([['drop_far_choice', false]]);
  fireEvent.click(h.view.container.querySelector('[data-pip-object="option-C"]')!);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_more' });

  const receipt = h.dispatch('pull_lever', { lever: 'drop_far_choice' });
  expect(receipt.status).toBe('committed');
  expect(dropped(h)).toEqual(['3']);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toBe('choice 4, "3", is greyed out and is not the answer');
  expect(levers(h)).toEqual([['drop_far_choice', true]]);
  expect(h.offer('pull_lever')).toBeFalsy();

  h.dispatch('retry'); h.confirmVisible();
  const before = h.state().task!.workspace!.attempts.length;
  fireEvent.click(h.view.container.querySelector('[data-pip-object="option-D"]')!);
  expect(h.state().task!.workspace!.attempts.length).toBe(before);
  fireEvent.click(h.view.container.querySelector('[data-pip-object="option-B"]')!);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['drop_far_choice'] });
  h.close();
});
