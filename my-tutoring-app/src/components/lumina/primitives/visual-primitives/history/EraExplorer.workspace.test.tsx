// @vitest-environment jsdom
/**
 * Era explorer on the teaching workspace: what is its own, plus its Pip surface. The generic
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
import EraExplorer from './EraExplorer';
import { eraItems } from './eraExplorerWorkspace';
import { correctChoiceOf } from './eraExplorerScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

// A generated Pioneer Times lesson (lens_id, era_sort); the other two modes are hand-built over the same card.
const GENERATED = (fixtures as Record<string, any>)['era-explorer'];
const [LENS, SORT] = GENERATED.challenges;
const COMPARE = { id: 'era-compare-1', type: 'era_compare', statement: 'Families cooked their meals over an open fire in the hearth.',
  options: ['Colonial Times', 'Pioneer Times', 'Both eras'], correctIndex: 2, explanation: 'Both eras cooked over fires.' };
const CAUSE = { id: 'era-cause-1', type: 'cause_of_change', statement: 'Most families today buy bread at a store instead of baking it.',
  options: ['Factories began making food cheaply', 'Children started going to school', 'Wagons got painted brighter colors'],
  correctIndex: 0, explanation: 'Factories made store bread cheap.' };
const BY_MODE: Record<string, unknown> = { lens_id: LENS, era_sort: SORT, era_compare: COMPARE, cause_of_change: CAUSE };
const MODES = Object.keys(BY_MODE);
const payload = (mode: string, extra: Record<string, unknown> = {}) => ({ ...GENERATED, challengeType: mode, challenges: [BY_MODE[mode]], ...extra });
const mount = (mode: string, pipStore?: PipSurfaceStore, extra: Record<string, unknown> = {}) =>
  mountWorkspace({ primitiveId: 'era-explorer', evalMode: mode, data: payload(mode, extra), instanceId: 'era-explorer', pipStore });

it.each(MODES)('%s binds: the pack\'s menu choice is the spoken key', mode => {
  const items = eraItems(payload(mode));
  expect(items.length).toBe(1);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'era-explorer', pin: mode, objectiveIds: ['o'], data: payload(mode) })).not.toBeNull();
  const task = mount(mode).state().task!;
  expect(task.task).not.toMatch(/Your turn|^Listen/);
  expect(task.task).toContain(items[0].statement);
  expect(task.workspace!.expectedAnswer!.startsWith(`"${correctChoiceOf(items[0]).phrase}"`)).toBe(true);
  expect(task.demand.statement).toBe(items[0].statement);
  expect(task.demand.card1).toMatch(/^Daily Life: /);
  expect(!!task.demand.before).toBe(mode === 'era_compare');
});

it('the answer appears only after credit; a miss reopens the item', () => {
  const h = mount('era_sort');
  const item = eraItems(payload('era_sort'))[0];
  expect(screen.queryByRole('button', { name: /hear the question|check|next/i })).toBeNull();
  // The era name is printed on the source card by design; the answer is the reveal under the statement.
  const revealed = () => document.querySelector('.text-emerald-200')?.textContent ?? null;
  expect(revealed()).toBeNull();
  h.say('today'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(item.id);
  expect(revealed()).toBeNull();
  h.say('back then'); h.feedback('correct');
  expect(revealed()).toBe(correctChoiceOf(item).label);
});

it('the hard tier folds the cards away: the tutor is told, and opening them publishes them', () => {
  const h = mount('lens_id', undefined, { lensAccess: 'collapsible' });
  expect(h.state().task!.demand.card1).toBeUndefined();
  expect(h.state().task!.demand.cards).toMatch(/folded away/);
  fireEvent.click(screen.getByRole('button', { name: /Open the era cards/ }));
  expect(h.state().task!.demand.card1).toMatch(/^Daily Life: /);
});

it('reading a card aloud is a silent host request for its body', () => {
  mount('lens_id');
  fireEvent.click(screen.getByRole('button', { name: /Read this to me/ }));
  const sent = seam.send.mock.calls.at(-1)!;
  expect(sent[0]).toContain(GENERATED.lenses[0].body);
  expect(sent[1]).toMatchObject({ silent: true, author: 'host' });
});

it('right answers complete once and submit the era metrics', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('era_sort', undefined, { challenges: [LENS, SORT] });
  for (let i = 0; i < 2; i++) { h.say('answer'); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'era-explorer', correctCount: 2, totalChallenges: 2 });
});

it('Pip outlines the statement and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('era-explorer');
  const h = mount('era_sort', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('back then'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a lesson with nothing askable; outside a runtime the surface shows the needs-the-tutor card', () => {
  const adapter = LIVE_ADAPTERS['era-explorer'];
  expect(() => adapter.validate({ ...GENERATED, challenges: [] })).toThrow();
  expect(adapter.validate(GENERATED)).toBeTruthy();
  const view = render(<EraExplorer data={GENERATED} />);
  expect(view.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
});
