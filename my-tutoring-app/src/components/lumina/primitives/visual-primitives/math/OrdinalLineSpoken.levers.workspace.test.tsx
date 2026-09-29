// @vitest-environment jsdom
/**
 * The ordinal-line spoken-mode levers (handoff 23 step 2) on the shared teaching workspace, mounted the way a lesson
 * mounts it. A pull changes the screen and the scene in one commit and names no character's place; the next spoken
 * attempt carries the lever; the easier line is ungraded, judged from speech, and gives the full item back.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const cast = ['Rabbit', 'Turtle', 'Monkey', 'Penguin', 'Lion'].map((name, i) => ({ name, emoji: ['🐰', '🐢', '🐒', '🐧', '🦁'][i] }));
const data = (gradeBand: 'K' | '1', ...challenges: Record<string, unknown>[]) => ({ title: 'Parade', gradeBand, context: 'parade',
  labelFormat: 'symbol', challenges });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('identify: front_flag, tap_marks and word_model change the screen, not the line; the next try carries them', () => {
  const h = mountWorkspace({ primitiveId: 'ordinal-line', evalMode: 'identify', instanceId: 'line',
    data: data('1', { id: 'i1', type: 'identify', characters: cast, targetPosition: 4, correctAnswer: 4 }) });
  expect(levers(h)).toEqual(['front_flag', 'tap_marks', 'word_model', 'shorter_line']);
  h.say('four'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'front_flag' });
  expect(q(h, '[data-lever="front-flag"]')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'tap_marks' });
  const pictures = () => q(h, '[data-tap-mark]');
  expect(pictures()).toHaveLength(5);
  act(() => { fireEvent.click(pictures()[0]); fireEvent.click(pictures()[1]); });
  expect(pictures().map(p => p.getAttribute('data-ringed'))).toEqual(['true', 'true', 'false', 'false', 'false']);
  h.dispatch('pull_lever', { lever: 'word_model' });
  expect(q(h, '[data-lever="word-model"]')[0].textContent).toBe('🚩1st2nd3rd');
  const demand = JSON.stringify(h.state().task!.demand.onScreen);
  expect(demand).toMatch(/flag marks the front/);
  expect(demand).not.toMatch(/fourth|Penguin/);
  h.say('fourth'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: ['front_flag', 'tap_marks', 'word_model'] });
  h.close();
});

it('relative_position: shorter_line is an ungraded three-character line, then the full line is credited', () => {
  const h = mountWorkspace({ primitiveId: 'ordinal-line', evalMode: 'relative_position', instanceId: 'line',
    data: data('K', { id: 'r1', type: 'relative-position', characters: cast, targetPosition: 4, relativeQuery: 'before', correctAnswer: 'Monkey' }) });
  expect(levers(h)).toEqual(['front_flag', 'side_model', 'shorter_line']);
  h.dispatch('pull_lever', { lever: 'side_model' });
  const model = q(h, '[data-lever="side-model"] [data-model-glow="true"]');
  expect(model).toHaveLength(1);
  const full = h.state().task!.itemId;
  h.say('Penguin'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'shorter_line' });
  const task = h.state().task!;
  expect(task.itemId).toBe(`${full}~simpler`);
  expect(task.workspace!.expectedAnswer).toBe('Cat');
  expect(q(h, '[data-lever="side-model"]')).toHaveLength(0);
  h.say('Cat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('Monkey'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['side_model', 'shorter_line'] });
  h.close();
});

it('match: place_model counts plain circles up to the card, the last one ringed, with no words', () => {
  const h = mountWorkspace({ primitiveId: 'ordinal-line', evalMode: 'match', instanceId: 'line',
    data: data('K', { id: 'm1', type: 'match', characters: cast, matchPairs: [{ word: 'third', symbol: '3rd' }] }) });
  h.dispatch('pull_lever', { lever: 'place_model' });
  const model = q(h, '[data-lever="place-model"]')[0];
  expect(model.getAttribute('data-count')).toBe('3');
  expect(model.textContent).toBe('🚩');
  expect(Array.from(model.querySelectorAll('[data-model-ringed="true"]'))).toHaveLength(1);
  h.close();
});
