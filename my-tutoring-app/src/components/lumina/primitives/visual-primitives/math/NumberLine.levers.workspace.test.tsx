// @vitest-environment jsdom
/**
 * The number-line jump levers on the shared teaching workspace (`/add-support-tiers` pilot,
 * handoff 18): the real NumberLine, TeachingSession and LiveLessonRuntime. `pull_lever` must change
 * the line and the scene in the same commit, never draw the landing, record the lever on the next
 * attempt, and a simplify pull must open an ungraded easier jump that returns to the full item.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { AFTER_TURN_FALLBACK_MS, RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

// The summary's confetti draws on a canvas jsdom does not have.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const seam = vi.hoisted(() => ({ send: vi.fn(), view: {} as Record<string, unknown> }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'line',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { primitiveData: Record<string, unknown> }) => {
  seam.view = o.primitiveData;
  return { sendText: vi.fn(), isConnected: true, isAudioPlaying: false, activePrimitiveId: 'line' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn(), elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import NumberLine, { type NumberLineData } from './NumberLine';

beforeEach(() => { vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const jump = (id: string, start: number, back: number, arc = false) => ({ id, type: 'show_jump' as const,
  instruction: `Start at ${start} and hop back ${back}.`, hint: 'Count each hop.', targetValues: [start - back], startValue: start,
  operations: [{ type: 'subtract' as const, startValue: start, changeValue: back, showJumpArc: arc }] });

function mount(challenges = [jump('j0', 8, 3), jump('j1', 15, 4)]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Hops', range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'jump',
    supportTier: 'medium', challenges, instanceId: 'line' } as NumberLineData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberLine data={data} runtimePlanItemId="plan-line" runtimeEvalMode="jump" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const offered = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && (a.action as { operation: string }).operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offered(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'line',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const tap = (value: number) => {
    const svg = document.querySelector('svg[viewBox="0 0 760 240"]')!;
    const min = Number(seam.view.visibleMin), max = Number(seam.view.visibleMax);
    act(() => { fireEvent.click(svg, { clientX: 60 + ((value - min) / (max - min)) * 640 }); });
  };
  const check = () => act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  const hopLabels = (kind: string) => Array.from(view.container.querySelectorAll(`[data-lever="${kind}"] text`)).map(t => t.textContent);
  return { runtime, state, offered, dispatch, tap, check, hopLabels, view };
}

const levers = (h: ReturnType<typeof mount>) => h.state().task!.workspace!.levers ?? [];

it('offers pull_lever on a jump with both levers declared, and states no landing', () => {
  const h = mount();
  expect(h.offered('pull_lever')?.assistance).toEqual({ level: 2, answerExposure: 'none' });
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['numbered_hops', 'help', false], ['simpler_jump', 'simplify', false]]);
  expect(JSON.stringify(h.state().task)).not.toMatch(/\b5\b/);
});

it('a pull without a lever pulls the help lever, as the observer would', () => {
  const h = mount();
  h.tap(6); h.check();
  expect(h.dispatch('pull_lever', {}).status).toBe('committed');
  expect(levers(h).filter(l => l.pulled).map(l => l.id)).toEqual(['numbered_hops']);
  expect(h.hopLabels('learner-hops')).toEqual(['1', '2']);
});

it('numbers the learner\'s own wrong jump in the same commit, and records the lever on the next attempt', () => {
  const h = mount();
  h.tap(6); h.check();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false, assisted: false });
  const receipt = h.dispatch('pull_lever', { lever: 'numbered_hops' });
  expect(receipt.status).toBe('committed');
  // Before any visible receipt: the learner's two hops are numbered, and the scene says so without the landing.
  expect(h.hopLabels('learner-hops')).toEqual(['1', '2']);
  expect(receipt.state.task!.demand.onScreen).toMatch(/Numbered hops/);
  expect(receipt.state.task!.demand.learnerWork).toMatch(/hops drawn: 2/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\b5\b/);
  expect(levers(h).find(l => l.id === 'numbered_hops')!.pulled).toBe(true);

  // A second pull of the same lever is refused and changes nothing.
  const assistance = h.state().assistance.length;
  expect(h.dispatch('pull_lever', { lever: 'numbered_hops' }).status).toBe('blocked');
  expect(h.state().assistance).toHaveLength(assistance);
  expect(h.hopLabels('learner-hops')).toEqual(['1', '2']);

  h.dispatch('retry');
  // Blank line: only the model hop 1 from the start, which stops short of the landing.
  expect(h.hopLabels('learner-hops')).toEqual([]);
  expect(h.hopLabels('model-hop')).toEqual(['1']);
  h.tap(5); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'j0', correct: true, assisted: true, levers: ['numbered_hops'] });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('j1');
  expect(levers(h).every(l => !l.pulled)).toBe(true);
});

it('a jump of 1 offers no lever until the learner places a jump away from the start, and never draws a model hop', () => {
  const h = mount([jump('j0', 8, 1)]);
  expect(h.offered('pull_lever')).toBeUndefined();
  h.tap(8); h.check();
  // Placed on the start itself: there is still nothing safe to number.
  expect(h.offered('pull_lever')).toBeUndefined();
  h.dispatch('retry');
  h.tap(6); h.check();
  expect(h.dispatch('pull_lever', { lever: 'numbered_hops' }).status).toBe('committed');
  expect(h.hopLabels('learner-hops')).toEqual(['1', '2']);
  expect(h.hopLabels('model-hop')).toEqual([]);
});

it('easy starts with the hops lever pulled: no worked arc to the landing, and not recorded as a pull', () => {
  const h = mount([jump('j0', 8, 3, true)]);
  expect(levers(h).find(l => l.id === 'numbered_hops')!.pulled).toBe(true);
  expect(h.hopLabels('model-hop')).toEqual(['1']);
  // The old worked arc drew a "-3" label and an arrowhead at 5; nothing labelled with the change is drawn now.
  expect(Array.from(h.view.container.querySelectorAll('svg text')).map(t => t.textContent)).not.toContain('-3');
  h.tap(5); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toBeUndefined();
});

it('a simplify pull opens an ungraded easier jump, then returns to the full item, which alone is credited', () => {
  const h = mount();
  const receipt = h.dispatch('pull_lever', { lever: 'simpler_jump' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'j0~simpler', task: 'Start at 9. Jump back 2.' });
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'j0' });
  expect(receipt.state.task!.demand.startsAt).toBe(9);
  // No levers during the easier jump, and no advance past the session item.
  expect(h.offered('pull_lever')).toBeUndefined();

  h.tap(6); h.check();
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('j0~simpler');
  h.tap(7); h.check();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'j0', task: 'Start at 8 and hop back 3.' });
  expect(h.state().task!.workspace!.practice).toBeUndefined();
  expect(levers(h).find(l => l.id === 'simpler_jump')!.pulled).toBe(true);

  h.tap(5); h.check();
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['j0~simpler', false, true], ['j0~simpler', true, true], ['j0', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['simpler_jump'], assisted: true });
});

it('the observer pulls the next lever when a learner who answered wrong says they are stuck, and tells the tutor what changed', async () => {
  const h = mount();
  const sent: any[] = [];
  const stuck = vi.fn(async () => ({ asksForHelp: .95, wantsToStop: .01, attemptsAnswer: .02, accepted: true, reason: 'observed', ms: 1 }));
  const transport = new RuntimeTransport(h.runtime, m => sent.push(m), vi.fn(async () => ({ verdict: 'none' as const, transition: 'none' as const,
    confidence: 0, grounded: 0, accepted: false, reason: 'test', ms: 1 })), stuck);
  h.tap(6); h.check();
  // One wrong answer names the miss and pulls nothing.
  await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  expect(levers(h).some(l => l.pulled)).toBe(false);
  // The surface certifies a paint with two animation frames, which this environment does not run: paint by hand.
  const paint = async () => { for (let i = 0; i < 5; i++) await act(async () => {
    await new Promise(r => setTimeout(r, 20)); h.runtime.acknowledgeVisible(h.state().revision); }); };
  act(() => { transport.learnerText("I don't get it", true); });
  await paint();
  expect(levers(h).find(l => l.id === 'numbered_hops')!.pulled).toBe(true);
  expect(h.hopLabels('learner-hops')).toEqual(['1', '2']);
  // The tutor's reply to "I don't get it" comes first; the message opens the turn after it.
  act(() => { transport.beginTurn('Let us look again.'); transport.endTurn(false); });
  expect(sent.find(m => m.type === 'text' && /numbered_hops/.test(m.content))?.content).toMatch(/on screen now/);
  // Stuck again: the simplify lever is next.
  act(() => { transport.learnerText('I still do not get it', true); });
  await paint();
  expect(h.state().task!.itemId).toBe('j0~simpler');
  transport.close();
});

it('the second wrong answer pulls help on its own, once, and tells the tutor why after its reply (handoff 21 S2)', async () => {
  const h = mount();
  const sent: any[] = [];
  const transport = new RuntimeTransport(h.runtime, m => sent.push(m), vi.fn(async () => ({ verdict: 'none' as const, transition: 'none' as const,
    confidence: 0, grounded: 0, accepted: false, reason: 'test', ms: 1 })), vi.fn());
  const paint = async () => { for (let i = 0; i < 5; i++) await act(async () => {
    await new Promise(r => setTimeout(r, 20)); h.runtime.acknowledgeVisible(h.state().revision); }); };
  const told = () => sent.filter(m => m.type === 'text' && /pulled/.test(m.content));
  h.tap(6); h.check();
  await paint();
  expect(levers(h).some(l => l.pulled)).toBe(false);
  h.dispatch('retry');
  await paint();
  h.tap(6); h.check();
  await paint();
  // The screen changed with no "I'm stuck": the learner's hops are numbered. Help only, never simplify.
  expect(levers(h).filter(l => l.pulled).map(l => l.id)).toEqual(['numbered_hops']);
  expect(h.hopLabels('learner-hops')).toEqual(['1', '2']);
  expect(h.state().task!.itemId).toBe('j0');
  // Republishes of the same attempt pull nothing more.
  for (let i = 0; i < 3; i++) act(() => { transport.publish(); });
  await paint();
  expect(levers(h).filter(l => l.pulled).map(l => l.id)).toEqual(['numbered_hops']);
  // The tutor's reply to the wrong answer comes first; then it hears why the screen changed, once.
  expect(told()).toHaveLength(0);
  act(() => { transport.beginTurn('Not quite.'); transport.endTurn(false); });
  expect(told()).toHaveLength(1);
  expect(told()[0].content).toMatch(/^The learner answered this item wrong a second time, so the host pulled numbered_hops/);
  // The next try carries the lever: assisted work.
  h.dispatch('retry');
  await paint();
  h.tap(5); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['numbered_hops'] });
  transport.close();
});

it('stuck before any attempt pulls help only; a wrong answer with that help on screen pulls simplify', async () => {
  const h = mount();
  const sent: any[] = [];
  const stuck = vi.fn(async () => ({ asksForHelp: .95, wantsToStop: .01, attemptsAnswer: .02, accepted: true, reason: 'observed', ms: 1 }));
  const transport = new RuntimeTransport(h.runtime, m => sent.push(m), vi.fn(async () => ({ verdict: 'none' as const, transition: 'none' as const,
    confidence: 0, grounded: 0, accepted: false, reason: 'test', ms: 1 })), stuck);
  const paint = async () => { for (let i = 0; i < 5; i++) await act(async () => {
    await new Promise(r => setTimeout(r, 20)); h.runtime.acknowledgeVisible(h.state().revision); }); };
  act(() => { transport.learnerText("I'm stuck", true); });
  await paint();
  expect(levers(h).filter(l => l.pulled).map(l => l.id)).toEqual(['numbered_hops']);
  expect(h.state().task!.itemId).toBe('j0');
  act(() => { transport.beginTurn('Look at the line.'); transport.endTurn(false); });
  h.tap(6); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, assisted: true, levers: ['numbered_hops'] });
  await paint();
  expect(h.state().task!.itemId).toBe('j0~simpler');
  act(() => { transport.beginTurn('Let us try.'); transport.endTurn(false); });
  expect(sent.filter(m => m.type === 'text' && /pulled/.test(m.content)).map(m => m.content.split(',')[0]))
    .toEqual(['The learner said they were stuck', 'The learner answered wrong with the help already on screen']);
  transport.close();
});

it('a pull whose reply never begins still tells the tutor, after the fallback', async () => {
  const h = mount();
  const sent: any[] = [];
  const stuck = vi.fn(async () => ({ asksForHelp: .95, wantsToStop: .01, attemptsAnswer: .02, accepted: true, reason: 'observed', ms: 1 }));
  const transport = new RuntimeTransport(h.runtime, m => sent.push(m), vi.fn(async () => ({ verdict: 'none' as const, transition: 'none' as const,
    confidence: 0, grounded: 0, accepted: false, reason: 'test', ms: 1 })), stuck);
  const paint = async () => { for (let i = 0; i < 5; i++) await act(async () => {
    await new Promise(r => setTimeout(r, 20)); h.runtime.acknowledgeVisible(h.state().revision); }); };
  const told = () => sent.filter(m => m.type === 'text' && /numbered_hops/.test(m.content));
  h.tap(6); h.check();
  act(() => { transport.learnerText("I'm stuck", true); });
  await paint();
  expect(levers(h).find(l => l.id === 'numbered_hops')!.pulled).toBe(true);
  expect(told()).toHaveLength(0);
  await act(async () => { await new Promise(r => setTimeout(r, AFTER_TURN_FALLBACK_MS + 50)); });
  expect(told()).toHaveLength(1);
  transport.close();
});

it('a pull that lands while the tutor is replying waits for that reply to settle before telling the tutor (LB-8)', async () => {
  const h = mount();
  const sent: any[] = [];
  const stuck = vi.fn(async () => ({ asksForHelp: .95, wantsToStop: .01, attemptsAnswer: .02, accepted: true, reason: 'observed', ms: 1 }));
  const transport = new RuntimeTransport(h.runtime, m => sent.push(m), vi.fn(async () => ({ verdict: 'none' as const, transition: 'none' as const,
    confidence: 0, grounded: 0, accepted: false, reason: 'test', ms: 1 })), stuck);
  const paint = async () => { for (let i = 0; i < 5; i++) await act(async () => {
    await new Promise(r => setTimeout(r, 20)); h.runtime.acknowledgeVisible(h.state().revision); }); };
  const told = () => sent.filter(m => m.type === 'text' && /numbered_hops/.test(m.content));
  h.tap(6); h.check();
  act(() => { transport.learnerText("I'm stuck", true); transport.beginTurn('I can help with that!'); });
  await paint();
  // The screen helps at once; the tutor is not told while its reply is still playing.
  expect(levers(h).find(l => l.id === 'numbered_hops')!.pulled).toBe(true);
  expect(told()).toHaveLength(0);
  act(() => { transport.endTurn(true); });
  expect(told()).toHaveLength(0);
  act(() => { transport.audioChanged(false); });
  expect(told()).toHaveLength(1);
  act(() => { transport.audioChanged(false); });
  expect(told()).toHaveLength(1);
  transport.close();
});

it('a wrong Check records what the jump showed, and the observer answers that miss with its lever', () => {
  const h = mount();
  h.tap(6); h.check();                                              // 8 back 3 lands on 5: one short
  const attempt = h.state().task!.workspace!.attempts.at(-1)!;
  expect(attempt).toMatchObject({ correct: false, miss: 'one_short' });
  expect(observerLever(h.state(), true)).toBe('numbered_hops');
});

it('lost track on the second of two jumps: the observer opens the easier single jump first', () => {
  const chained = { id: 'c0', type: 'show_jump' as const, instruction: 'Start at 2, jump forward 3, then forward 4.', hint: 'Count.',
    startValue: 2, targetValues: [5, 9], operations: [{ type: 'add' as const, startValue: 2, changeValue: 3, showJumpArc: false },
      { type: 'add' as const, startValue: 5, changeValue: 4, showJumpArc: false }] };
  // `mount` is typed from its subtract-only default; the chained item adds.
  const h = mount([chained as unknown as ReturnType<typeof jump>, jump('j1', 15, 4)]);
  h.tap(5); h.tap(10); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'second_jump_off' });
  expect(observerLever(h.state(), true)).toBe('simpler_jump');
});
