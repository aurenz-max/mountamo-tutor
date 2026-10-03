// @vitest-environment jsdom
/**
 * The di-deduction levers (DI family 8 of `/add-support-tiers`) on the shared teaching workspace, mounted the way a
 * lesson mounts it. The model is a spare rule worked through every verdict; the frame has empty boxes; the shared words
 * light; the counterexample case prints its lookalike, is ungraded, and gives the full case back.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { DeductionRuleSpec } from './diDeductionScript';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const BIRDS: DeductionRuleSpec = { id: 'b', category: 'bird', categoryPlural: 'birds', propertyPlural: 'lay eggs',
  propertySingular: 'lays eggs', propertyNegated: 'does not lay eggs', kindNoun: 'animal', members: ['robin', 'owl'],
  nonMembers: ['cow', 'horse'], lookalikes: ['turtle'] };
const FISH: DeductionRuleSpec = { id: 'f', category: 'fish', categoryPlural: 'fish', propertyPlural: 'live in water',
  propertySingular: 'lives in water', propertyNegated: 'does not live in water', kindNoun: 'animal', members: ['trout'],
  nonMembers: ['camel'], lookalikes: ['whale'] };
const mount = (mode: 'conclude' | 'deny' | 'cannot_tell', supportTier?: 'easy' | 'medium' | 'hard') => mountWorkspace({
  primitiveId: 'di-deduction', evalMode: mode, instanceId: 'deduction',
  data: { title: 'Rules', description: 'Use the rule.', challengeType: mode, rules: [{ ...BIRDS, shapes: [mode] }], spares: [FISH],
    ...(supportTier ? { supportTier } : {}) } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('easy conclude: the model card works a different rule through yes, no and can\'t tell; a try under it records no lever', () => {
  const h = mount('conclude');
  expect(q(h, '[data-lever="model_case"] [data-model-shape]').map(e => e.getAttribute('data-model-shape'))).toEqual(['conclude', 'deny', 'cannot_tell']);
  expect(q(h, '[data-lever="model_case"]')[0].textContent).not.toMatch(/bird|robin|turtle/i);
  h.say('a robin lays eggs'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('hard deny: the frame and the lit shared words; the next try carries both', () => {
  const h = mount('deny', 'hard');
  expect(q(h, '[data-lever="model_case"]')).toHaveLength(0);
  h.say('no'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'answer_frame' });
  expect(q(h, '[data-lever="answer_frame"]')[0].textContent).toBe('___ because ___');
  h.dispatch('pull_lever', { lever: 'shared_term' });
  expect(q(h, 'mark[data-lever="shared_term"]').map(m => m.textContent)).toEqual(['lay eggs', 'does not lay eggs']);
  h.say('no, a cow is not a bird, because all birds lay eggs and a cow does not lay eggs'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['answer_frame', 'shared_term'] });
  h.close();
});

it('cannot_tell: the counterexample case prints its lookalike, is ungraded, then the full case is credited', () => {
  const h = mount('cannot_tell', 'medium');
  const full = h.state().task!.itemId;
  expect((h.state().task!.workspace!.levers ?? []).map(l => l.id)).not.toContain('shared_term');
  h.say('yes, because it lays eggs'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'counterexample_card' });
  expect(h.state().task!.itemId.startsWith(`${full}~simpler`)).toBe(true);
  expect(q(h, '[data-lever="counterexample_card"]')[0].textContent).toContain('A whale lives in water. A whale is not a fish.');
  h.say("can't tell, a whale lives in water too"); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say("can't tell, the rule does not say only birds lay eggs"); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId === full, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [true, false, false], [false, true, true], [true, true, false]]);
  h.close();
});
