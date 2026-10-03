// @vitest-environment jsdom
/**
 * The di-spoken-practice levers (DI family 9 of `/add-support-tiers`) on the shared teaching workspace, mounted the way
 * a lesson mounts it: tappable pictures and rows of five on a count; one model pair per menu word on a compare; dots
 * under the print on a read; a generated spare as the model and an easier spare as the practice on say_answer.
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
import type { SpokenPracticeItem } from './diSpokenPracticeScript';
import countP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.count_and_say.json';
import compareP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.compare_choice.json';
import readP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.read_aloud.json';
import sayP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.say_answer.json';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

type Payload = { data: { items: SpokenPracticeItem[]; spares?: SpokenPracticeItem[] } };
const mount = (mode: string, items: SpokenPracticeItem[], tier?: 'easy' | 'medium' | 'hard', spares?: SpokenPracticeItem[]) => mountWorkspace({
  primitiveId: 'di-spoken-practice', evalMode: mode, instanceId: 'spoken',
  data: { title: 'Say it', description: 'Out loud.', challengeType: mode, items: items.map(i => tier ? { ...i, supportTier: tier } : i),
    ...(spares ? { spares } : {}) } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const first = (p: unknown) => (p as Payload).data.items.slice(0, 1);

it('count_and_say at hard: tapped pictures get rings, rows of five; no numeral; the next try carries the levers', () => {
  const [item] = (countP as unknown as Payload).data.items.filter(i => i.stimulusCount > 5);
  const h = mount('count_and_say', [item], 'hard');
  h.say('six'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'touch_marks' });
  const pics = () => q(h, '[data-pip-tap]');
  expect(pics()).toHaveLength(item.stimulusCount);
  act(() => { fireEvent.click(pics()[0]); });
  expect(pics()[0].getAttribute('data-ringed')).toBe('true');
  h.dispatch('pull_lever', { lever: 'five_rows' });
  expect(q(h, '[data-five-rows]')).toHaveLength(1);
  expect(h.view.container.textContent).not.toMatch(new RegExp(`\\b${item.stimulusCount}\\b`));
  h.say(item.expectedAnswer); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['touch_marks', 'five_rows'] });
  h.close();
});

it('compare_choice at easy: the model card has one pair per menu word (R1); a try under it records no lever', () => {
  const items = first(compareP);
  const h = mount('compare_choice', items);
  expect(q(h, '[data-lever="word_model"] [data-model-pair]').map(e => e.getAttribute('data-model-pair'))).toEqual(items[0].choices);
  h.say(items[0].expectedAnswer); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('read_aloud at hard: dots under each letter and no other text', () => {
  const items = first(readP);
  const h = mount('read_aloud', items, 'hard');
  h.dispatch('pull_lever', { lever: 'sound_dots' });
  expect(q(h, '[data-sound-dot]')).toHaveLength(items[0].stimulusText.replace(/[^a-z0-9]/gi, '').length);
  expect(h.view.container.querySelector('[data-spoken-object="stimulus"]')!.textContent).toBe(items[0].stimulusText);
  h.close();
});

it('say_answer: the easier spare is an ungraded practice item, then the full question is credited', () => {
  const p = sayP as unknown as Payload;
  const h = mount('say_answer', p.data.items.slice(0, 1), 'hard', p.data.spares);
  const full = h.state().task!.itemId;
  h.say('banana'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'easier_item' });
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  const easier = p.data.spares!.find(s => s.easier)!;
  h.say(easier.expectedAnswer); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say(p.data.items[0].expectedAnswer); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  h.close();
});
