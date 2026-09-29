// @vitest-environment jsdom
/**
 * The tester's offline lever bench: a real NumberLine played by hand with no Live session. Wrong answers
 * must run the real ladder (second wrong pulls help, a wrong with help on screen opens the easier item),
 * the panel must say so, and the manual pull and "I'm stuck" controls must do what the tutor's would.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const seam = vi.hoisted(() => ({ view: {} as Record<string, unknown> }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: false, isListening: false, isAudioPlaying: false, sessionMode: null, activePrimitiveId: null,
  conversation: [], sendText: vi.fn(), sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { primitiveData: Record<string, unknown> }) => {
  seam.view = o.primitiveData;
  return { sendText: vi.fn(), isConnected: false, isAudioPlaying: false, activePrimitiveId: null };
} }));
vi.mock('../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn(), elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import NumberLine, { type NumberLineData } from '../../primitives/visual-primitives/math/NumberLine';
import { TesterLeverBench } from './TesterLeverBench';

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
  // The surface certifies paint with animation frames; run them as timers.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const jump = { id: 'j0', type: 'show_jump' as const, instruction: 'Start at 8 and hop back 3.', hint: 'Count each hop.',
  targetValues: [5], startValue: 8, operations: [{ type: 'subtract' as const, startValue: 8, changeValue: 3, showJumpArc: false }] };

function mount(challenges: object[] = [jump]) {
  const data = { title: 'Hops', range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'jump',
    supportTier: 'medium', challenges, instanceId: 'line' } as NumberLineData;
  const binding = { instanceId: 'line', primitiveId: 'number-line' as const, evalMode: 'jump', objectiveId: 'tester', planItemId: 'plan-line', guidance: '' };
  const view = render(<TesterLeverBench binding={binding}>
    <NumberLine data={data} runtimePlanItemId="plan-line" runtimeEvalMode="jump" />
  </TesterLeverBench>);
  const tap = (value: number) => {
    const svg = document.querySelector('svg[viewBox="0 0 760 240"]')!;
    const min = Number(seam.view.visibleMin), max = Number(seam.view.visibleMax);
    act(() => { fireEvent.click(svg, { clientX: 60 + ((value - min) / (max - min)) * 640 }); });
  };
  const click = (name: RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const settle = () => act(async () => { for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 20)); });
  const lever = (id: string) => view.container.querySelector(`[data-bench-lever="${id}"]`)!.textContent;
  const next = () => view.container.querySelector('[data-bench-next-wrong]')!.textContent;
  const log = () => view.container.querySelector("[data-bench-log]")!.textContent ?? "";
  /** Waits for the ladder's pull to be confirmed on screen, which is when the transport traces it. */
  const logged = async (pattern: RegExp) => { for (let i = 0; i < 100 && !pattern.test(log()); i++)
    await act(async () => { await new Promise(r => setTimeout(r, 20)); }); expect(log()).toMatch(pattern); };
  return { view, tap, click, settle, lever, next, log, logged };
}

it('a hand-played second wrong pulls help, then a wrong with help on screen opens the easier item', { timeout: 20000 }, async () => {
  const h = mount();
  await h.settle();
  expect(h.next()).toMatch(/pulls nothing/);
  h.tap(6); h.click(/^check/i);
  await h.settle();
  expect(h.lever('numbered_hops')).toMatch(/Pull/);
  expect(h.view.container.querySelector('[data-bench-miss="one_short"]')!.textContent).toMatch(/numbered_hops/);
  expect(h.next()).toMatch(/numbered_hops.*wrong #2 → help/);

  h.click(/try again/i); await h.settle();
  h.tap(6); h.click(/^check/i);
  await h.settle();
  expect(h.lever('numbered_hops')).toMatch(/pulled/);
  await h.logged(/Ladder \(visible\): The learner answered this item wrong a second time; pulled numbered_hops/);
  expect(h.next()).toMatch(/simpler_jump.*simplify/);

  h.click(/try again/i); await h.settle();
  h.tap(6); h.click(/^check/i);
  await h.settle();
  expect(h.view.container.querySelector('[data-bench-practice]')!.textContent).toMatch(/returns to j0/i);
  await h.logged(/wrong with the help already on screen; pulled simpler_jump/);
});

it('the bench pulls a chosen lever by hand, and "I\'m stuck" before any try pulls help only', async () => {
  const h = mount();
  await h.settle();
  h.click(/say "i'm stuck"/i);
  await h.settle();
  expect(h.lever('numbered_hops')).toMatch(/pulled/);
  expect(h.view.container.querySelector('[data-bench-practice]')).toBeNull();
  const simplify = h.view.container.querySelector('[data-bench-lever="simpler_jump"] button')!;
  act(() => { fireEvent.click(simplify); });
  await h.settle();
  expect(h.view.container.querySelector('[data-bench-practice]')).not.toBeNull();
});
