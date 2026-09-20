// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import { DEFAULT_VOICE_TURN_CONFIG } from '../../../hooks/voiceTurnMachine';

const seam = vi.hoisted(() => ({ conversation: [] as any[], audio: false, close: null as any,
  send: vi.fn(), submit: vi.fn(), held: 0 }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: seam.audio, sessionMode: 'lesson', activePrimitiveId: 'frame',
  sessionResumeCount: 0, conversation: seam.conversation, sendText: seam.send, startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn(),
  holdVoiceTurns: () => { seam.held++; return () => { seam.held--; }; },
  sharedVoiceTurns: { subscribe: (listener: any) => { seam.close = listener.onTurnClose; return () => { seam.close = null; }; },
    isVoiceActive: () => false, reset: vi.fn(), lastTurnOpenAtRef: { current: null }, floorsRef: { current: { ambientRms: 0, echoRms: 0 } },
    config: DEFAULT_VOICE_TURN_CONFIG },
}) }));
// Only microphone hardware is substituted. The runner, speech hook and reducer are real.
vi.mock('../../../hooks/useLiveVoiceTurns', async original => ({ ...(await original<any>()), useLiveVoiceTurns: () => ({
  isVoiceActive: () => false, reset: vi.fn(), lastTurnOpenAtRef: { current: null }, floorsRef: { current: {} }, config: DEFAULT_VOICE_TURN_CONFIG,
}) }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import TenFrame, { type TenFrameData } from './TenFrame';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.audio = false; seam.close = null; seam.held = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function mount(kind: 'make_ten' | 'build' = 'make_ten', band: 'K' | '1-2' = '1-2', strict = false, planned = false) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data: TenFrameData = { instanceId: 'frame', title: 'Make ten', mode: 'single', gradeBand: band,
    counters: { count: 0, color: 'red', positions: [] }, challenges: [6, 7].map((n, i) => ({
      id: `c${i}`, type: kind, targetCount: n, instruction: 'How many more?', hint: '', narration: '',
    })) };
  const workspace = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <TenFrame data={data} autoStart runtimePlanItemId={planned ? 'plan-1' : undefined} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const content = () => strict ? <React.StrictMode>{workspace()}</React.StrictMode> : workspace();
  const view = render(content());
  const refresh = async () => { await act(async () => view.rerender(content())); };
  await act(async () => {});
  const end = async (audioPending = false) => {
    await act(async () => { transport.endTurn(audioPending); seam.audio = audioPending; view.rerender(content()); });
  };
  const speak = async (text: string) => {
    await act(async () => { transport.beginTurn(); seam.audio = true;
      seam.conversation = [...seam.conversation, { role: 'assistant', content: text, timestamp: performance.now() }]; view.rerender(content()); });
  };
  const answer = async (text: string) => {
    await act(async () => { seam.close?.({ kind: 'close', startedAt: performance.now() - 900, durationMs: 900, peak: .2, duringTutorAudio: false, belowMinVoice: false });
      seam.conversation = [...seam.conversation, { role: 'user', content: text, isAudio: true, timestamp: performance.now() }]; view.rerender(content()); });
  };
  const command = async (type: string) => {
    const state = runtime.getSnapshot(), offer = state.affordances.find(a => a.action.type === type)!;
    expect(offer, `missing ${type}`).toBeTruthy();
    let pending: Promise<void>;
    await act(async () => { pending = transport.command({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(), instanceId: state.instanceId,
      itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    await pending!;
    expect(sent.filter(m => m.type === 'runtime_result').at(-1)?.status).toBe('visible');
  };
  await speak('There are six counters. How many more make ten?'); await end();
  return { runtime, transport, view, refresh, speak, end, answer, command };
}

it('uses actual voice verdicts, keeps the same frame through help, and settles closing audio before completion', async () => {
  const h = await mount();
  expect(h.runtime.getSnapshot().owner).toBe('runner');
  await h.answer('five'); await h.speak('My turn: six and four make ten. Four more. Your turn.'); await h.end();
  expect(h.runtime.getSnapshot().task?.itemId).toBe('c0');
  const frame = screen.getByText('Make ten');
  const before = h.runtime.getSnapshot().task?.demand;
  await h.command('scaffold');
  expect(screen.getByText(/Count each empty space once/)).toBeTruthy();
  await h.answer('four'); // pause with a real judgment pending
  await h.command('request_support');
  const example = screen.getByRole('complementary', { name: 'Worked example' });
  // The item shows six, so the explanation uses a different frame: four, then six more.
  expect(example.getAttribute('data-artifact-kind')).toBe('step-sequence');
  expect(example.querySelectorAll('[data-step-frame]').length).toBe(3);
  expect(example.querySelectorAll('[data-step-frame]')[2].querySelectorAll('[data-step-tone="added"]').length).toBe(6);
  expect(example.textContent).toContain('4 and 6 make 10.');
  await h.speak('Yes, four more.'); await h.end(); // abandoned verdict must not advance
  expect(h.runtime.getSnapshot().task?.itemId).toBe('c0');
  await h.command('return');
  await h.speak('Yes, four more.'); // a late verdict before return settles stays ignored
  expect(h.runtime.getSnapshot().task?.itemId).toBe('c0');
  await h.speak('Your same frame is back.'); await h.end();
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.getByText('Make ten')).toBe(frame);
  expect(h.runtime.getSnapshot().task?.demand).toEqual(before);
  await h.speak('How many more make ten?'); await h.end();
  await h.answer('four'); await h.speak('Yes, four more.'); await h.end();
  expect(h.runtime.getSnapshot().task?.itemId).toBe('c1');
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  await h.speak('There are seven counters. How many more make ten?'); await h.end();
  await h.answer('three'); await h.speak('Yes, three more.'); await h.end();
  expect(seam.submit).not.toHaveBeenCalled();
  expect(h.runtime.getSnapshot().canStartNext).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  await h.speak('Great number work today.'); await h.end(true);
  expect(seam.submit).not.toHaveBeenCalled();
  await act(async () => { seam.audio = false; h.transport.audioChanged(false); }); await h.refresh();
  expect(seam.submit).toHaveBeenCalledTimes(1);
  expect(h.runtime.getSnapshot().status).toBe('completed');
});

it('cancels a real gesture stillness window and preserves placed counters through support and stop', async () => {
  const h = await mount('build', 'K');
  const cells = h.view.container.querySelectorAll('[data-pip-object^="cell-"]');
  expect(cells.length).toBeGreaterThan(0);
  fireEvent.click(cells[0]); fireEvent.click(cells[1]);
  const draft = h.runtime.getSnapshot().task?.demand;
  const sends = seam.send.mock.calls.length;
  await h.command('request_support');
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(seam.send).toHaveBeenCalledTimes(sends);
  await h.command('return'); await h.speak('Back to your frame.'); await h.end();
  expect(h.runtime.getSnapshot().task?.demand).toEqual(draft);
  await act(async () => h.runtime.stop());
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(seam.submit).not.toHaveBeenCalled();
  expect(h.runtime.getSnapshot().status).toBe('stopped');
});

it('keeps judging after development StrictMode replays mount effects', async () => {
  const h = await mount('make_ten', '1-2', true);
  await h.answer('four'); await h.speak('Yes, four more.'); await h.end();
  expect(h.runtime.getSnapshot().task?.itemId).toBe('c1');
  expect(h.runtime.getSnapshot().owner).toBe('runner');
});

it('does not advertise a detour while a committed gesture is awaiting its verdict', async () => {
  const h = await mount('build', 'K');
  const cells = h.view.container.querySelectorAll('[data-pip-object^="cell-"]');
  fireEvent.click(cells[0]); fireEvent.click(cells[1]);
  await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
  expect(h.runtime.getSnapshot().task?.phase).toBe('judging');
  expect(h.runtime.getSnapshot().affordances).toEqual([]);
  await h.speak('My turn: put six counters on the frame. Your turn.'); await h.end();
  expect(h.runtime.getSnapshot().task?.itemId).toBe('c0');
  expect(h.runtime.getSnapshot().affordances.some(a => a.action.type === 'request_support')).toBe(true);
});

it('waits for the visible receipt when the silent return tool turn ends before paint', async () => {
  const h = await mount();
  await h.command('request_support'); await h.end();
  const state = h.runtime.getSnapshot();
  let pending: Promise<void>;
  const sends = seam.send.mock.calls.length;
  await act(async () => {
    pending = h.transport.command({ sessionEpoch: state.sessionEpoch, commandId: 'early-end', instanceId: state.instanceId,
      itemId: state.task!.itemId, expectedRevision: state.revision, action: { type: 'return' } });
    h.transport.endTurn(false);
  });
  expect(seam.send).toHaveBeenCalledTimes(sends);
  await act(async () => { await vi.advanceTimersByTimeAsync(40); });
  await pending!;
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(seam.send.mock.calls.slice(sends).some(call => call[0].includes('How many more'))).toBe(true);
  expect(h.runtime.getSnapshot().task?.itemId).toBe('c0');
  expect(h.runtime.getSnapshot().task?.phase).toBe('asking');
});

it('stop during the final queued cue never emits a successful completion', async () => {
  const h = await mount();
  await h.answer('four'); await h.speak('Yes, four more.'); await h.end();
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  await h.speak('How many more make ten?'); await h.end();
  await h.answer('three'); await h.speak('Yes, three more.'); await h.end();
  expect(h.runtime.getSnapshot().status).toBe('closing');
  const complete = vi.fn(); h.runtime.onCompletion(complete);
  await act(async () => h.runtime.stop());
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(complete).not.toHaveBeenCalled(); expect(seam.submit).not.toHaveBeenCalled();
});

it('uses one activity closing cue in a planned lesson without ending the whole conversation', async () => {
  const h = await mount('make_ten', '1-2', false, true);
  await h.answer('four'); await h.speak('Yes, four more.'); await h.end();
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  await h.speak('How many more make ten?'); await h.end();
  await h.answer('three'); await h.speak('Yes, three more.'); await h.end();
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  const closing = seam.send.mock.calls.map(call => call[0]).filter(text => text.includes('[TF_COMPLETE]'));
  expect(closing).toHaveLength(1);
  expect(closing[0]).toContain('You finished this activity.');
  expect(closing[0]).not.toContain('See you next time');
  await h.speak('You finished this activity. Nice work!'); await h.end();
  expect(seam.submit).toHaveBeenCalledTimes(1);
  expect(h.runtime.getSnapshot().planItemId).toBe('plan-1');
  expect(h.runtime.getSnapshot().canStartNext).toBe(true);
});
