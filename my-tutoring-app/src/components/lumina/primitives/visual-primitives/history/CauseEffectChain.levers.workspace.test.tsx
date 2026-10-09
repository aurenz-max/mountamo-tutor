// @vitest-environment jsdom
/**
 * cause-effect-chain's levers on the real teaching workspace (`causeEffectChainLevers.ts`): a pull changes the screen
 * and the scene fact in one commit, the next attempt records it, a refused pull changes nothing, and a simplify pull
 * opens an ungraded practice item, then the full item comes back blank and is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import fixtures from '../../../pip/testing/workspaceFixtures.json';
import { causeEffectItems } from './causeEffectChainWorkspace';
import { practiceItem } from './causeEffectChainLevers';
import type { CauseEffectChainItem } from './causeEffectChainScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const GENERATED = (fixtures as Record<string, any>)['cause-effect-chain'];
const [ROOT, CHAIN] = GENERATED.challenges;
const IDENTIFY = { ...ROOT, id: 'cec-id', type: 'identify_cause',
  nodes: [...ROOT.nodes, { id: 'cec-id-x', text: 'Townspeople write thank-you letters to the railroad company.', category: 'social', icon: '✉️' }] };
const BY_MODE: Record<string, unknown> = { identify_cause: IDENTIFY, build_chain: CHAIN, root_vs_proximate: ROOT };
const payload = (mode: string) => ({ ...GENERATED, challengeType: mode, challenges: [BY_MODE[mode]] });

function mount(mode: string) {
  const h = mountWorkspace({ primitiveId: 'cause-effect-chain', evalMode: mode, data: payload(mode), instanceId: 'cause-effect-chain' });
  const levers = () => h.state().task!.workspace!.levers?.map(l => [l.id, l.pulled]);
  const onScreen = () => String((h.state().task!.demand as Record<string, unknown>).onScreen ?? '');
  const attempts = () => h.state().task!.workspace!.attempts;
  const lever = (name: string) => h.view.container.querySelector(`[data-lever="${name}"]`);
  return { ...h, levers, onScreen, attempts, lever };
}

const items = (mode: string) => causeEffectItems(payload(mode));
const place = (item: CauseEffectChainItem, ids: readonly string[]) => ids.forEach(id => {
  const text = item.cards.find(c => c.id === id)!.text;
  fireEvent.click(screen.getByRole('button', { name: `Place "${text}"` }));
});
const settle = () => act(() => { vi.advanceTimersByTime(3500); });

it('build_chain: a reversed chain, then model_chain draws a model beside the board in one commit; a second pull is refused', () => {
  const h = mount('build_chain');
  const chain = items('build_chain')[0] as Extract<CauseEffectChainItem, { kind: 'build_chain' }>;
  expect(h.levers()).toEqual([['model_chain', false], ['shorter_chain', false]]);
  place(chain, [...chain.correctOrder].reverse()); settle();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  h.dispatch('retry'); h.confirmVisible();
  expect(h.lever('model-chain')).toBeNull();
  const receipt = h.dispatch('pull_lever', { lever: 'model_chain' });
  expect(receipt.status).toBe('committed');
  expect(String((receipt.state.task!.demand as Record<string, unknown>).onScreen)).toMatch(/model chain from everyday life drawn in order/);
  expect(h.lever('model-chain')!.textContent).toMatch(/🏁/);
  for (const c of chain.cards) expect(h.onScreen()).not.toContain(c.text.replace(/\.$/, ''));
  const before = { html: h.view.container.innerHTML, levers: h.levers(), attempts: h.attempts().length };
  expect(h.dispatch('pull_lever', { lever: 'model_chain' }).status).toBe('blocked');
  expect({ html: h.view.container.innerHTML, levers: h.levers(), attempts: h.attempts().length }).toEqual(before);
  place(chain, chain.correctOrder); settle();
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'cec-2', correct: true, assisted: true, levers: ['model_chain'] });
});

it('build_chain: shorter_chain opens a two-card practice chain; the full chain comes back empty and is credited', () => {
  const h = mount('build_chain');
  const chain = items('build_chain')[0] as Extract<CauseEffectChainItem, { kind: 'build_chain' }>;
  const easier = practiceItem(chain, { items: items('build_chain'), gradeLevel: GENERATED.gradeLevel }) as typeof chain;
  place(chain, [chain.correctOrder[1], chain.correctOrder[0], chain.correctOrder[2]]); settle();
  expect(h.attempts().at(-1)).toMatchObject({ miss: 'two_swapped' });
  h.dispatch('retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'shorter_chain' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('cec-2~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'cec-2' });
  expect(screen.getAllByRole('button', { name: /^Place "/ })).toHaveLength(2);
  expect(h.view.container.querySelector('[data-practice]')).not.toBeNull();
  // A wrong practice chain is retried on the practice board, not the full one.
  place(easier, [...easier.correctOrder].reverse()); settle();
  h.dispatch('retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('cec-2~simpler');
  expect(screen.getAllByRole('button', { name: /^Place "/ })).toHaveLength(2);
  place(easier, easier.correctOrder); settle();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('cec-2');
  expect(screen.getAllByRole('button', { name: /^Place "/ })).toHaveLength(3);
  expect(h.view.container.querySelector('[data-practice]')).toBeNull();
  place(chain, chain.correctOrder); settle();
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['cec-2', false, false], ['cec-2~simpler', false, true], ['cec-2~simpler', true, true], ['cec-2', true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['shorter_chain'] });
});

it('identify_cause: two_tests puts two empty checks under the card; role_model a tagged model beside it; no simplify', () => {
  const h = mount('identify_cause');
  expect(h.levers()).toEqual([['two_tests', false], ['role_model', false]]);
  const first = items('identify_cause')[0] as Extract<CauseEffectChainItem, { kind: 'identify_cause' }>;
  h.say(first.isCause ? 'no' : 'yes'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.dispatch('pull_lever', { lever: 'two_tests' }).status).toBe('committed');
  expect(h.lever('two-tests')!.textContent).toMatch(/☐ Did it happen before the ending\?☐ Did the ending need it\?/);
  expect(h.onScreen()).toMatch(/Neither is ticked/);
  expect(h.dispatch('pull_lever', { lever: 'role_model' }).status).toBe('committed');
  expect(h.lever('role-model')!.textContent).toMatch(/happened after the ending/);
  expect(h.onScreen()).not.toContain(first.card.text.replace(/\.$/, ''));
  h.say(first.isCause ? 'yes' : 'no'); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: first.id, correct: true, assisted: true, levers: ['two_tests', 'role_model'] });
});

it('identify_cause on easy: the checks are on screen from the start, are not offered, and record nothing', () => {
  const h = mountWorkspace({ primitiveId: 'cause-effect-chain', evalMode: 'identify_cause',
    data: { ...payload('identify_cause'), supportTier: 'easy' }, instanceId: 'cause-effect-chain' });
  expect(h.view.container.querySelector('[data-lever="two-tests"]')).not.toBeNull();
  expect(h.state().task!.workspace!.levers!.map(l => l.id)).toEqual(['role_model']);
  const first = items('identify_cause')[0] as Extract<CauseEffectChainItem, { kind: 'identify_cause' }>;
  h.say(first.isCause ? 'yes' : 'no'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true });
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
});

it('root_vs_proximate: ends_model, then ordered_chain opens the same ask on a chain drawn in order; the full item is credited', () => {
  const h = mount('root_vs_proximate');
  expect(h.levers()).toEqual([['ends_model', false], ['ordered_chain', false]]);
  h.say('postal workers'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.dispatch('pull_lever', { lever: 'ends_model' }).status).toBe('committed');
  expect(h.lever('ends-model')!.textContent).toMatch(/\(root\).*\(right before the ending\)/);
  const receipt = h.dispatch('pull_lever', { lever: 'ordered_chain' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('cec-1~simpler');
  expect(receipt.state.task!.workspace!.expectedAnswer).toMatch(/the first card on screen/);
  expect(String((receipt.state.task!.demand as Record<string, unknown>).practice)).toMatch(/drawn in order/);
  expect(h.lever('ordered-chain')).not.toBeNull();
  expect(h.lever('ends-model')).toBeNull();
  h.say('the first one'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('cec-1');
  expect(h.lever('ordered-chain')).toBeNull();
  h.say('railway crews'); h.feedback('correct');
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['cec-1', false, false], ['cec-1~simpler', true, true], ['cec-1', true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['ends_model', 'ordered_chain'] });
});
