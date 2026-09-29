// @vitest-environment jsdom
/**
 * The comparison-builder levers on the shared teaching workspace (handoff 21 M2): the real ComparisonBuilder,
 * TeachingSession and LiveLessonRuntime. `pull_lever` changes the screen and the scene in the same commit, states no
 * answer, records the lever on the next attempt, and a simplify pull opens an ungraded easier item that returns to
 * the full item, which alone is credited.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'compare',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true, isAudioPlaying: false,
  activePrimitiveId: 'compare' }) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: vi.fn(), elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import ComparisonBuilder, { type ComparisonBuilderChallenge, type ComparisonBuilderData } from './ComparisonBuilder';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const groups = (id: string, l: number, r: number): ComparisonBuilderChallenge => ({ id, type: 'compare-groups',
  instruction: 'Does the left group have more, fewer, or the same?', leftGroup: { count: l, objectType: 'bears' },
  rightGroup: { count: r, objectType: 'stars' }, correctAnswer: l > r ? 'more' : l < r ? 'less' : 'equal' });

function mount(evalMode: string, challenges: ComparisonBuilderChallenge[], gradeBand: 'K' | '1' = '1', supportTier?: 'easy') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Comparing', gradeBand, instanceId: 'compare', showCorrespondenceLines: true, useAlligatorMnemonic: false,
    supportTier, challenges } as ComparisonBuilderData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ComparisonBuilder data={data} runtimePlanItemId="plan-compare" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const offered = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && (a.action as { operation: string }).operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offered(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'compare',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const choose = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const check = () => act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  const lever = (kind: string) => view.container.querySelectorAll(`[data-lever="${kind}"]`);
  const levers = () => state().task!.workspace!.levers ?? [];
  return { runtime, state, offered, dispatch, choose, check, lever, levers, view };
}

it('compare_groups: a model pull draws the model beside the groups, states no count, and the next attempt carries it', () => {
  const h = mount('compare_groups', [groups('c1', 4, 7), groups('c2', 3, 3)]);
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['model_match', 'help', false], ['tap_count', 'help', false], ['far_groups', 'simplify', false]]);
  h.choose(/^more$/i); h.check();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false });
  const receipt = h.dispatch('pull_lever', { lever: 'model_match' });
  expect(receipt.status).toBe('committed');
  expect(h.lever('model-match')).toHaveLength(1);
  expect(receipt.state.task!.demand.onScreen).toMatch(/model beside the groups/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\b(4|7)\b/);
  // No match line on the item itself.
  expect(h.view.container.querySelectorAll('svg line').length).toBe(h.lever('model-match')[0].querySelectorAll('line').length);
  expect(h.dispatch('pull_lever', { lever: 'model_match' }).status).toBe('blocked');

  h.dispatch('retry');
  h.choose(/^fewer$/i); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'c1', correct: true, assisted: true, levers: ['model_match'] });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c2');
  expect(h.levers().every(l => !l.pulled)).toBe(true);
  expect(h.lever('model-match')).toHaveLength(0);
});

it('compare_groups at K: tap_count makes each object a counting target that never answers', () => {
  const h = mount('compare_groups', [groups('c1', 4, 7)], 'K');
  expect(h.dispatch('pull_lever', { lever: 'tap_count' }).status).toBe('committed');
  const targets = h.lever('tap-count');
  expect(targets).toHaveLength(11);
  const left = Array.from(targets).filter(t => t.getAttribute('data-side') === 'left');
  act(() => { fireEvent.click(left[2]); fireEvent.click(left[0]); fireEvent.click(left[0]); });
  expect(Array.from(h.lever('tap-number')).map(t => t.textContent)).toEqual(['2', '1']);
  // Counting chose nothing and checked nothing.
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(h.state().task!.demand.onScreen).toMatch(/Tapped so far: 2 on the left, 0 on the right/);
});

it('easy starts with the model shown: a starting position, not a recorded pull', () => {
  const h = mount('compare_groups', [groups('c1', 4, 7)], '1', 'easy');
  expect(h.levers().find(l => l.id === 'model_match')!.pulled).toBe(true);
  expect(h.lever('model-match')).toHaveLength(1);
  h.choose(/^fewer$/i); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toBeUndefined();
});

it('compare_numbers: quantity marks appear under both numbers, drawn alike', () => {
  const h = mount('compare_numbers', [{ id: 'n1', type: 'compare-numbers', instruction: 'Pick the sign.', leftNumber: 13, rightNumber: 16,
    correctSymbol: '<' }]);
  expect(h.dispatch('pull_lever', { lever: 'quantity_marks' }).status).toBe('committed');
  expect(Array.from(h.lever('quantity-marks')).map(m => m.getAttribute('aria-label'))).toEqual(['1 tens and 3 ones', '1 tens and 6 ones']);
});

it('order: slot steps and card marks; neither names a card', () => {
  const h = mount('order', [{ id: 'o1', type: 'order', instruction: 'Put these in order.', numbers: [5, 2, 8], direction: 'ascending' }]);
  expect(h.dispatch('pull_lever', { lever: 'slot_steps' }).status).toBe('committed');
  expect(h.lever('slot-steps')[0].textContent).toBe('');
  expect(h.dispatch('pull_lever', { lever: 'quantity_marks' }).status).toBe('committed');
  expect(h.lever('quantity-marks')).toHaveLength(3);
});

it('one_more_less: hop counts run from the target to the learner\'s own pick', () => {
  const h = mount('one_more_less', [{ id: 's1', type: 'one-more-one-less', instruction: 'One more than 8?', targetNumber: 8, askFor: 'one-more' }]);
  expect(h.dispatch('pull_lever', { lever: 'learner_hops' }).status).toBe('committed');
  expect(Array.from(h.lever('hop')).map(b => b.textContent)).toEqual(['0']);
  h.choose('11');
  expect(Array.from(h.lever('hop')).map(b => [b.parentElement!.textContent!.replace(b.textContent!, ''), b.textContent]))
    .toEqual([['8', '0'], ['9', '1'], ['10', '2'], ['11', '3']]);
});

it('a simplify pull opens an ungraded easier pair, then returns to the full item, which alone is credited', () => {
  const h = mount('compare_groups', [groups('c1', 4, 5), groups('c2', 3, 3)]);
  h.choose(/^more$/i); h.check();
  const receipt = h.dispatch('pull_lever', { lever: 'far_groups' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('c1~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'c1' });
  expect(h.offered('pull_lever')).toBeUndefined();
  // 6 v 2: no count shared with 4 v 5, and the left now has more (the item's left had fewer).
  expect(h.view.container.querySelectorAll('svg text').length).toBeGreaterThanOrEqual(8);
  h.choose(/^more$/i); h.check();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c1');
  expect(h.state().task!.workspace!.practice).toBeUndefined();
  h.choose(/^fewer$/i); h.check();
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['c1', false, false], ['c1~simpler', true, true], ['c1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['far_groups'], assisted: true });
});
