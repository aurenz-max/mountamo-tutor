// @vitest-environment jsdom
/**
 * era-explorer's levers on the real teaching workspace (`eraExplorerLevers.ts`): a pull changes the screen and the
 * scene fact in one commit, the next attempt records it, a refused pull changes nothing, and a simplify pull opens an
 * ungraded practice item, then the full item comes back and is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import lensP from '../../../components/live-activity/runtime/testing/w1-payloads/era-explorer.lens_id.json';
import sortP from '../../../components/live-activity/runtime/testing/w1-payloads/era-explorer.era_sort.json';
import compareP from '../../../components/live-activity/runtime/testing/w1-payloads/era-explorer.era_compare.json';
import causeP from '../../../components/live-activity/runtime/testing/w1-payloads/era-explorer.cause_of_change.json';
import { eraItems } from './eraExplorerWorkspace';
import { eraLeverSession, practiceItem } from './eraExplorerLevers';
import { correctChoiceOf } from './eraExplorerScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const DATA: Record<string, any> = { lens_id: (lensP as any).data, era_sort: (sortP as any).data,
  era_compare: (compareP as any).data, cause_of_change: (causeP as any).data };

function mount(mode: string, extra: Record<string, unknown> = {}) {
  const h = mountWorkspace({ primitiveId: 'era-explorer', evalMode: mode, data: { ...DATA[mode], ...extra }, instanceId: 'era-explorer' });
  const levers = () => h.state().task!.workspace!.levers?.map(l => [l.id, l.pulled]);
  const onScreen = () => String((h.state().task!.demand as Record<string, unknown>).onScreen ?? '');
  const attempts = () => h.state().task!.workspace!.attempts;
  const lever = (name: string) => h.view.container.querySelector(`[data-lever="${name}"]`);
  const statement = () => h.view.container.querySelector('[data-pip-object="stimulus"]')?.textContent ?? '';
  return { ...h, levers, onScreen, attempts, lever, statement };
}
const first = (mode: string) => eraItems(DATA[mode])[0];
const wrongOf = (mode: string) => { const i = first(mode); return i.choices[(i.correctIndex + 1) % 3].distinguisher; };

it('era_sort: two_checks puts two empty checks under the detail in one commit; the next attempt records it', () => {
  const h = mount('era_sort');
  const item = first('era_sort');
  expect(h.levers()).toEqual([['two_checks', false]]);
  h.say(wrongOf('era_sort')); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.lever('two-checks')).toBeNull();
  const receipt = h.dispatch('pull_lever', { lever: 'two_checks' });
  expect(receipt.status).toBe('committed');
  expect(String((receipt.state.task!.demand as Record<string, unknown>).onScreen))
    .toBe('under the detail, two empty checks: "Back then, in Pioneer Times?" and "Today, in your own life?". Neither is ticked');
  expect(h.lever('two-checks')!.textContent).toMatch(/☐ Back then, in Pioneer Times\?.*☐ Today, in your own life\?/);
  expect(h.levers()).toEqual([['two_checks', true]]);
  h.say(correctChoiceOf(item).distinguisher); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: item.id, correct: true, assisted: true, levers: ['two_checks'] });
});

it('lens_id: side_by_side opens every card at once (a second pull is refused); on_the_card opens a word-for-word practice item, then the full item is credited', () => {
  const h = mount('lens_id');
  const item = first('lens_id');
  const easier = practiceItem(item, eraLeverSession(eraItems(DATA.lens_id), DATA.lens_id))!;
  expect(h.levers()).toEqual([['side_by_side', false], ['on_the_card', false]]);
  h.say(wrongOf('lens_id')); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.lever('side-by-side')).toBeNull();
  expect(h.dispatch('pull_lever', { lever: 'side_by_side' }).status).toBe('committed');
  for (const lens of DATA.lens_id.lenses) expect(h.lever('side-by-side')!.textContent).toContain(lens.body);
  expect(h.onScreen()).toMatch(/all three era cards are open side by side/);
  // A second pull of the same lever is refused and changes nothing.
  const before = { html: h.view.container.innerHTML, levers: h.levers(), attempts: h.attempts().length, item: h.state().task!.itemId };
  expect(h.dispatch('pull_lever', { lever: 'side_by_side' }).status).toBe('blocked');
  expect({ html: h.view.container.innerHTML, levers: h.levers(), attempts: h.attempts().length, item: h.state().task!.itemId }).toEqual(before);
  h.say(wrongOf('lens_id')); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'on_the_card' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe(`${item.id}~simpler`);
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: item.id });
  expect(String((receipt.state.task!.demand as Record<string, unknown>).practice)).toMatch(/word for word from one era card/);
  expect(h.statement()).toBe(easier.statement);
  expect(h.view.container.querySelector('[data-practice]')).not.toBeNull();
  // A wrong practice answer is retried on the practice item, not the full one.
  h.say(easier.choices[(easier.correctIndex + 1) % 3].distinguisher); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(`${item.id}~simpler`);
  expect(h.statement()).toBe(easier.statement);
  h.say(correctChoiceOf(easier).distinguisher); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(item.id);
  expect(h.statement()).toBe(item.statement);
  expect(h.view.container.querySelector('[data-practice]')).toBeNull();
  h.say(correctChoiceOf(item).distinguisher); h.feedback('correct');
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    [item.id, false, false], [item.id, false, false], [`${item.id}~simpler`, false, true], [`${item.id}~simpler`, true, true],
    [item.id, true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['side_by_side', 'on_the_card'] });
});

it('cause_of_change: model_change draws a tagged everyday change beside the item, never one of its causes', () => {
  const h = mount('cause_of_change');
  const item = first('cause_of_change');
  expect(h.levers()).toEqual([['model_change', false]]);
  h.say(item.statement); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.dispatch('pull_lever', { lever: 'model_change' }).status).toBe('committed');
  expect(h.lever('model-change')!.textContent).toMatch(/why: it came first and made the change happen/);
  for (const c of item.choices) expect(h.lever('model-change')!.textContent).not.toContain(c.label);
  expect(h.onScreen()).toMatch(/a model from everyday life, not this item/);
  h.say(correctChoiceOf(item).distinguisher); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: item.id, correct: true, assisted: true, levers: ['model_change'] });
});

it('era_compare on easy: the two checks are on screen from the start, are not offered, and record nothing', () => {
  const h = mount('era_compare', { supportTier: 'easy' });
  const item = first('era_compare');
  expect(h.lever('two-checks')!.textContent).toMatch(/In Early Colonial Days\?.*In Pioneer Times\?/);
  expect(h.levers() ?? []).toEqual([]);
  h.say(correctChoiceOf(item).distinguisher); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ correct: true });
  expect(h.attempts().at(-1)!.levers ?? []).toEqual([]);
});
