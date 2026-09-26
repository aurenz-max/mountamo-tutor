// @vitest-environment jsdom
/**
 * Knowledge check on the teaching workspace: what is its own, plus its Pip surface (ported from the
 * runner-mock `pip/KnowledgeCheck.surface.test.tsx`). The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../components/live-activity/activityContract';
import { workspaceBinding } from '../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../pip/PipSurfaceStore';
import { KnowledgeCheck } from './KnowledgeCheck';
import { knowledgeCheckItems } from './knowledgeCheckWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const base = { difficulty: 'easy', gradeLevel: '1', rationale: 'Because.', teachingNote: '', successCriteria: [] };
const TF = { ...base, type: 'true_false', id: 'tf1', statement: 'A spider has eight legs', correct: true };
const MC = { ...base, type: 'multiple_choice', id: 'mc1', question: 'Which animal says moo?', correctOptionId: 'A',
  options: [{ id: 'A', text: 'cow', emoji: '🐄' }, { id: 'B', text: 'duck', emoji: '🦆' }, { id: 'C', text: 'frog', emoji: '🐸' }] };
const KATEX = { ...base, type: 'multiple_choice', id: 'mc2', question: 'Which expression equals ten?', optionFormat: 'katex',
  correctOptionId: 'A', options: [{ id: 'A', text: '7+3' }, { id: 'B', text: '5+2' }] };
const PROBLEMS = [TF, MC, KATEX];
const data = (problems: unknown[] = PROBLEMS) => ({ problems, instanceId: 'check' });
const items = knowledgeCheckItems(data() as never).items;
const mount = (problems: unknown[] = PROBLEMS, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'knowledge-check', evalMode: 'recall', data: data(problems), instanceId: 'check', pipStore });

it('binds in a lesson; spoken kinds publish a key and the touched kind does not', () => {
  expect(items.map(i => i.kind)).toEqual(['true_false', 'choice', 'choice_tap']);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'knowledge-check', pin: 'recall', objectiveIds: ['o'], data: data() })).not.toBeNull();
  const h = mount();
  expect(h.state().task!.task).toBe('A spider has eight legs. Is that true, or false?');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^true: the statement is true/);
  h.say('yes'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"cow" \(choice 1 of 3\).*"duck", "frog" are wrong/);
  expect(h.state().task!.demand.choices).toBe('Printed choices, in order: 1. cow; 2. duck; 3. frog.');
  h.say('cow'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.demand.response).toBe('gesture');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
});

it('a wrong touch commits as a miss and Try again reopens the choices; the right touch credits', () => {
  const h = mount([KATEX]);
  expect(document.querySelector('button[aria-label]')).not.toBeNull();
  expect(Array.from(document.querySelectorAll('button')).some(b => /say that again/i.test(b.textContent ?? ''))).toBe(false);
  fireEvent.click(document.querySelector('[data-pip-object="option-B"]')!);
  expect(h.state().task!.workspace!.lastResponse?.correct).toBe(false);
  h.dispatch('retry'); h.confirmVisible();
  expect(h.state().task!.phase).toBe('working');
  fireEvent.click(document.querySelector('[data-pip-object="option-A"]')!);
  expect(h.state().task!.workspace!.lastResponse?.correct).toBe(true);
});

it('the answer shows only after credit', () => {
  const h = mount([TF]);
  const reward = () => Array.from(document.querySelectorAll('span')).find(s => s.textContent === '✓ True');
  expect(reward()).toBeUndefined();
  h.say('false'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(reward()).toBeUndefined();
  h.say('true'); h.feedback('correct');
  expect(reward()).toBeTruthy();
});

it('completion submits once per problem (the ::pN bridges)', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  h.say('yes'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('cow'); h.feedback('correct', 'advance'); h.confirmVisible();
  fireEvent.click(document.querySelector('[data-pip-object="option-A"]')!); h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledTimes(3);
  expect(seam.submit.mock.calls.map(c => c[2].problemType)).toEqual(['true_false', 'multiple_choice', 'multiple_choice']);
  expect(seam.submit.mock.calls.every(c => c[0] === true)).toBe(true);
});

it('Pip docks above the question card, points only at it, watches a touched choice and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('check');
  const h = mount(PROBLEMS, store);
  expect(document.querySelector('[data-pip-dock="check"]')).not.toBeNull();
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['question']);
  h.say('yes'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
  h.dispatch('advance'); h.confirmVisible();
  h.say('cow'); h.feedback('correct', 'advance'); h.confirmVisible();
  fireEvent.click(document.querySelector('[data-pip-object="option-B"]')!);
  h.dispatch('retry'); h.confirmVisible();
  expect(store.getActive()?.pose).toMatchObject({ gesture: 'look', targetId: 'question' });
  h.view.unmount();
  expect(store.getActive()).toBeNull();
});

it('a set the judged build cannot run is the tap flow; a judged set outside a runtime shows the needs-the-tutor card', () => {
  const adapter = LIVE_ADAPTERS['knowledge-check'];
  const unaskable = [{ ...base, type: 'true_false', id: 'bad', statement: '', correct: true }];
  expect(knowledgeCheckItems(data(unaskable) as never).judgedViable).toBe(false);
  expect(() => adapter.validate(data(unaskable))).toThrow();
  expect(adapter.validate(data())).toBeTruthy();
  const tap = render(<KnowledgeCheck data={data(unaskable) as never} />);
  expect(tap.container.querySelector('[data-workspace-unbound]')).toBeNull();
  tap.unmount();
  const judged = render(<KnowledgeCheck data={data() as never} />);
  expect(judged.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
});
