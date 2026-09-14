// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../utils/SoundManager', () => ({ SoundManager: { toggle: vi.fn(), snap: vi.fn(), startProcessing: vi.fn(), stopProcessing: vi.fn() } }));
vi.mock('../../utils/voiceMode', () => ({ useAutoListenEnabled: () => false }));
vi.mock('../../utils/wavEncode', () => ({ encodeWav16kMono: () => ({ bytes: new Uint8Array(64), durationMs: 4000 }), bytesToBase64: () => 'wav' }));
import { useVoiceCapture } from '../useVoiceCapture';

let processor: { onaudioprocess: ((event: unknown) => void) | null; connect: () => void; disconnect: () => void };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  processor = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
  class TestAudioContext {
    state = 'running'; sampleRate = 48000; destination = {};
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createScriptProcessor() { return processor; }
    close() { return Promise.resolve(); }
  }
  vi.stubGlobal('AudioContext', TestAudioContext);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  URL.createObjectURL = vi.fn(() => 'blob:reading');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function frame(time: number, loud: boolean) {
  await act(async () => { vi.setSystemTime(time); processor.onaudioprocess?.({ inputBuffer: {
    getChannelData: () => new Float32Array(4096).fill(loud ? 0.1 : 0),
  } }); });
}
describe('reading capture timing without changing word-capture defaults', () => {
  it('keeps the longer reading window open and judges only the full clip', async () => {
    const judge = vi.fn().mockResolvedValue('heard'); const onSettle = vi.fn();
    const { result } = renderHook(() => useVoiceCapture({ modality: 'ptt', getContext: () => 'reading',
      judge, onSettle, isConfident: () => true, speculative: false, silenceMs: 1800, maxClipMs: 15000 }));
    await act(async () => result.current.start());
    await frame(10000, true); await frame(10900, false);
    expect(judge).not.toHaveBeenCalled();
    await frame(11100, true); await frame(17000, true); // beyond the legacy six-second cap
    expect(judge).not.toHaveBeenCalled();
    await frame(18801, false);
    expect(judge).toHaveBeenCalledTimes(1);
    expect(judge.mock.calls[0][1]).toBe('fresh');
    expect(onSettle).toHaveBeenCalledTimes(1);
  });
  it('preserves the existing speculative and silence defaults for other callers', async () => {
    const judge = vi.fn().mockResolvedValue('heard'); const onSettle = vi.fn();
    const { result } = renderHook(() => useVoiceCapture({ modality: 'ptt', getContext: () => 'word', judge, onSettle, isConfident: () => true }));
    await act(async () => result.current.start());
    await frame(10000, true); await frame(10300, false);
    expect(judge.mock.calls[0][1]).toBe('spec');
    await frame(10751, false);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(judge).toHaveBeenCalledTimes(1);
  });
  it('cancels a pending verdict without delivering it', async () => {
    let resolveJudge!: (value: string) => void;
    const judge = vi.fn(() => new Promise<string>(resolve => { resolveJudge = resolve; }));
    const onSettle = vi.fn();
    const { result } = renderHook(() => useVoiceCapture({ modality: 'ptt', getContext: () => 'reading',
      judge, onSettle, isConfident: () => true, speculative: false, silenceMs: 1800 }));
    await act(async () => result.current.start());
    await frame(10000, true); await frame(11801, false);
    act(() => result.current.stop());
    await act(async () => resolveJudge('heard'));
    expect(onSettle).not.toHaveBeenCalled();
  });
});
