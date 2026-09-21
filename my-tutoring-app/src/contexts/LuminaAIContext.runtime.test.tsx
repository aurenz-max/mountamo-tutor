// @vitest-environment jsdom
// The real provider's sendText, with only the socket, audio and auth replaced. It is the one
// place that decides whether a message reaches the live runtime as learner words.
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LuminaAIProvider, useLuminaAIContext } from './LuminaAIContext';
import { LiveLessonRuntime } from '@/components/lumina/components/live-activity/runtime/LiveLessonRuntime';

vi.mock('@/lib/AudioCaptureService', () => ({ default: class {
  setCallbacks() {} setWebSocket() {} getFramePeriodMs() { return 0; } stopCapture() {} destroy() {}
} }));
vi.mock('@/lib/hooks/useAudioPlayback', () => ({ useAudioPlayback: () => ({ processAndPlayRawAudio: vi.fn(),
  stopAudioPlayback: vi.fn(), resetForNextTurn: vi.fn(), isAudioPlaying: false, hasPendingAudio: false }) }));
vi.mock('@/components/lumina/contexts/ExhibitContext', () => ({ useExhibitContext: () => ({ objectives: [], manifestItems: [] }) }));
vi.mock('@/components/lumina/evaluation', () => ({ useEvaluationContext: () => null }));

const sockets: FakeSocket[] = [];
class FakeSocket {
  static OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  constructor(public url: string) { sockets.push(this); }
  send(message: string) { this.sent.push(message); }
  close() {}
}
vi.stubGlobal('WebSocket', FakeSocket);
afterEach(cleanup);

let ai: ReturnType<typeof useLuminaAIContext>;
function Probe() { ai = useLuminaAIContext(); return null; }

it('sends host-written text to the runtime as a host turn, learner text as learner words, and silent text not at all', async () => {
  const events: Array<Record<string, unknown>> = [];
  render(<LuminaAIProvider onActivityEvent={e => events.push(e)} liveLessonRuntime={new LiveLessonRuntime('ctx')}><Probe /></LuminaAIProvider>);
  await act(async () => { void ai.connect({ primitive_type: 'counting-board', instance_id: 'board', primitive_data: {} } as never); });
  act(() => {
    ai.sendText('The learner submitted their selection.', { scripted: false, author: 'host' });
    ai.sendText('which one is red');
    ai.sendText('[ACTIVITY_START]', { silent: true });
  });
  expect(events.filter(e => e.type === 'runtime_host_text' || e.type === 'runtime_learner_text')).toEqual([
    { type: 'runtime_host_text' },
    { type: 'runtime_learner_text', text: 'which one is red', finished: true },
  ]);
  // All three still reach the model; the author is a client-side routing fact, not wire content.
  const wire = sockets.at(-1)!.sent.map(m => JSON.parse(m)).filter(m => m.type === 'text');
  expect(wire.map(m => m.content)).toEqual(['The learner submitted their selection.', 'which one is red', '[ACTIVITY_START]']);
  expect(wire.some(m => 'author' in m)).toBe(false);
});
