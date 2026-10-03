// @vitest-environment jsdom
/**
 * The di-worked-procedure levers (DI family 7 of `/add-support-tiers`) on the shared teaching workspace, mounted the
 * way a lesson mounts it. The model is a different problem, fully worked; the pieces and cubes draw no number;
 * fewer_columns appears only after no_decrement and gives the full step back; the easy start is not a pull.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { WorkedProblemSpec } from './diWorkedProcedureScript';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const mount = (mode: WorkedProblemSpec['challengeType'], ...problems: WorkedProblemSpec[]) => mountWorkspace({
  primitiveId: 'di-worked-procedure', evalMode: mode, instanceId: 'procedure',
  data: { title: 'Subtract', description: 'Talk it through.', challengeType: mode, problems } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);

it('a regroup decide step at medium: top_blocks draws pieces and no number; the next try carries it', () => {
  const h = mount('subtract_regroup', { id: 'a', minuend: 52, subtrahend: 28, challengeType: 'subtract_regroup' });
  expect(levers(h)).toEqual(['model_problem', 'top_blocks']);
  h.say('eight minus two is six'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'top_blocks' });
  // Ones column: two cubes; tens column: five rods. Nothing is labelled.
  expect(q(h, '[data-top-blocks="0"] [data-piece]')).toHaveLength(2);
  expect(q(h, '[data-top-blocks="1"] [data-piece]')).toHaveLength(5);
  expect(q(h, '[data-lever="top_blocks"]')[0].textContent).toBe('');
  h.say('I can\'t take eight from two, so I regroup: four tens, twelve ones'); h.feedback('correct', 'advance'); h.confirmVisible();
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.find(a => a.correct)).toMatchObject({ assisted: true, levers: ['top_blocks'] });
  // The subtract step: take-away cubes, twelve with eight crossed out; no top_blocks on a subtract step.
  expect(levers(h)).toEqual(['model_problem', 'take_away_cubes']);
  h.dispatch('pull_lever', { lever: 'take_away_cubes' });
  expect(q(h, '[data-cube]')).toHaveLength(12);
  expect(q(h, '[data-cube][data-crossed="true"]')).toHaveLength(8);
  h.close();
});

it('easy starts with a different problem, fully worked; a try under it records no lever', () => {
  const h = mount('subtract_no_regroup', { id: 'b', minuend: 57, subtrahend: 23, challengeType: 'subtract_no_regroup', supportTier: 'easy' });
  const model = q(h, '[data-lever="model_problem"]');
  expect(model).toHaveLength(1);
  expect(model[0].getAttribute('data-model-problem')).not.toBe('57-23');
  expect(String(h.state().task!.demand.onScreen)).toMatch(/fully worked/);
  h.say('no regrouping, seven minus three is four'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('fewer_columns appears after no_decrement on a 3-digit tens regroup; the practice step is ungraded', async () => {
  // The spoken_miss observer names no_decrement for every not-credited answer here.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).endsWith('/api/lumina/observe-spoken-miss')
    ? { ok: true, json: async () => ({ miss: 'no_decrement', reading: 'no_decrement', p: 0.9, accepted: true, reason: 'named', ms: 0 }) }
    : { ok: false, json: async () => ({}) }));
  const hear = async (h: WorkspaceHarness, text: string) => { h.say(text); await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); }); };
  // 630 − 498: ones regroup (decide, subtract), then the tens regroup decide step.
  const h = mount('subtract_regroup', { id: 'c', minuend: 630, subtrahend: 498, challengeType: 'subtract_regroup' });
  await hear(h, 'I regroup: two tens, ten ones'); h.feedback('correct', 'advance'); h.confirmVisible();
  await hear(h, 'two'); h.feedback('correct', 'advance'); h.confirmVisible();
  const tens = h.state().task!.itemId;
  expect(tens).toContain('-c1-decide');
  expect(levers(h)).not.toContain('fewer_columns');
  await hear(h, 'I regroup: six hundreds, twelve tens'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'no_decrement' });
  expect(levers(h)).toContain('fewer_columns');
  h.dispatch('pull_lever', { lever: 'fewer_columns' });
  expect(h.state().task!.itemId).toContain(`${tens}~simpler`);
  expect(q(h, '[data-practice-item]')).toHaveLength(1);
  // A two-digit problem: two top digits drawn.
  expect(h.view.container.querySelectorAll('[aria-label^="Current ones column, top"]')).toHaveLength(1);
  h.close();
});
