// @vitest-environment jsdom
/**
 * Cause-effect chain on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';
import fixtures from '../../../pip/testing/workspaceFixtures.json';
import CauseEffectChain from './CauseEffectChain';
import { causeEffectItems } from './causeEffectChainWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

// A generated lesson (a root pick and a chain); identify_cause is the root chain with a consequence card added.
const GENERATED = (fixtures as Record<string, any>)['cause-effect-chain'];
const [ROOT, CHAIN] = GENERATED.challenges;
const IDENTIFY = { ...ROOT, id: 'cec-id', type: 'identify_cause',
  nodes: [...ROOT.nodes, { id: 'cec-id-x', text: 'Townspeople write thank-you letters to the railroad company.', category: 'social', icon: '✉️' }] };
const BY_MODE: Record<string, unknown> = { identify_cause: IDENTIFY, build_chain: CHAIN, root_vs_proximate: ROOT };
const MODES = Object.keys(BY_MODE);
const payload = (mode: string) => ({ ...GENERATED, challengeType: mode, challenges: [BY_MODE[mode]] });
const mount = (mode: string, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'cause-effect-chain', evalMode: mode, data: payload(mode), instanceId: 'cause-effect-chain', pipStore });
const itemsOf = (mode: string) => causeEffectItems(payload(mode));
const text = (id: string) => CHAIN.nodes.find((n: { id: string }) => n.id === id).text as string;
const placeAll = (ids: string[]) => ids.forEach(id => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Place "${text(id).slice(0, 20)}`) })));
const settle = () => act(() => { vi.advanceTimersByTime(3500); });

it.each(MODES)('%s binds; a spoken item publishes its key, the chain does not', mode => {
  const items = itemsOf(mode);
  expect(items.length).toBeGreaterThan(0);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'cause-effect-chain', pin: mode, objectiveIds: ['o'], data: payload(mode) })).not.toBeNull();
  const task = mount(mode).state().task!;
  expect(task.task).not.toMatch(/Your turn|^Listen/);
  expect(task.demand.ending).toBe(items[0].outcome.text);
  if (mode === 'build_chain') expect(task.workspace!.expectedAnswer).toBeUndefined();
  else expect(task.workspace!.expectedAnswer).toBeTruthy();
});

it('identify asks one card at a time, balanced, with the consequence refused', () => {
  const items = itemsOf('identify_cause');
  expect(items.map(i => i.kind === 'identify_cause' && i.isCause).filter(Boolean).length).toBe(items.length / 2);
  const h = mount('identify_cause');
  const first = items[0] as Extract<typeof items[0], { kind: 'identify_cause' }>;
  expect(h.state().task!.workspace!.expectedAnswer!.startsWith(first.isCause ? 'yes' : 'no')).toBe(true);
});

it('root: the key names the card and refuses the others', () => {
  const key = mount('root_vs_proximate').state().task!.workspace!.expectedAnswer!;
  expect(key.startsWith('"Railway crews lay heavy iron tracks')).toBe(true);
  expect(key).toMatch(/Any other event is wrong .*Local postal workers/);
});

it('a partial chain never commits; a reversed full chain commits as a miss and Try again empties the board', () => {
  const h = mount('build_chain');
  placeAll(['cec-2-3', 'cec-2-2']);
  settle();
  expect(h.state().task!.phase).toBe('working');
  placeAll(['cec-2-1']);
  expect(h.state().task!.phase).toBe('working'); // inside the stillness window
  settle();
  expect(h.state().task!.phase).toBe('checked');
  expect(h.state().task!.workspace!.lastResponse?.correct).toBe(false);
  h.dispatch('retry'); h.confirmVisible();
  expect(screen.getAllByRole('button', { name: /^Place "/ })).toHaveLength(3);
});

it('taking a card back inside the window cancels the commit', () => {
  const h = mount('build_chain');
  placeAll(['cec-2-1', 'cec-2-2', 'cec-2-3']);
  fireEvent.click(screen.getByRole('button', { name: /^Remove "Carpenters/ }));
  settle();
  expect(h.state().task!.phase).toBe('working');
});

it('the right chain commits once and completes the lesson with its metrics', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build_chain');
  expect(screen.queryByRole('button', { name: /hear the question|check|next/i })).toBeNull();
  placeAll(['cec-2-1', 'cec-2-2', 'cec-2-3']);
  settle();
  expect(h.state().task!.workspace!.lastResponse?.correct).toBe(true);
  expect(screen.getByText(CHAIN.explanation)).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'cause-effect-chain', correctCount: 1, totalChallenges: 1 });
});

it('Pip outlines the ending and the events and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('cause-effect-chain');
  const h = mount('root_vs_proximate', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('railway crews'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a lesson with nothing askable; outside a runtime the surface shows the needs-the-tutor card', () => {
  const adapter = LIVE_ADAPTERS['cause-effect-chain'];
  expect(() => adapter.validate({ ...GENERATED, challenges: [] })).toThrow();
  expect(adapter.validate(GENERATED)).toBeTruthy();
  const view = render(<CauseEffectChain data={GENERATED} />);
  expect(view.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
});
