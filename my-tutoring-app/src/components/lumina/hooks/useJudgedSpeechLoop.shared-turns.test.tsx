// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VOICE_TURN_CONFIG } from './voiceTurnMachine';
import type { LoopEmission } from './judgedLoopModel';

let sharedClose: ((event: Record<string, unknown>) => void) | undefined;
let localEnabled: boolean | undefined;
const shared = {
  subscribe: (listener: { onTurnClose?: (event: Record<string, unknown>) => void }) => {
    sharedClose = listener.onTurnClose;
    return () => { sharedClose = undefined; };
  },
  isVoiceActive: () => false,
  reset: vi.fn(),
  lastTurnOpenAtRef: { current: null },
  floorsRef: { current: { ambientRms: 0, echoRms: 0 } },
  config: DEFAULT_VOICE_TURN_CONFIG,
};

vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    conversation: [],
    isAudioPlaying: false,
    sessionMode: 'lesson',
    sessionResumeCount: 0,
    sharedVoiceTurns: shared,
    sendText: vi.fn(),
  }),
}));

vi.mock('./useLiveVoiceTurns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useLiveVoiceTurns')>();
  return {
    ...actual,
    useLiveVoiceTurns: (options: { enabled: boolean }) => {
      localEnabled = options.enabled;
      return {
        isVoiceActive: () => false,
        reset: vi.fn(),
        lastTurnOpenAtRef: { current: null },
        floorsRef: shared.floorsRef,
        config: DEFAULT_VOICE_TURN_CONFIG,
      };
    },
  };
});

import { useJudgedSpeechLoop } from './useJudgedSpeechLoop';

describe('useJudgedSpeechLoop shared lesson turns', () => {
  it('consumes provider closes without opening a second turn authority', () => {
    const emissions: LoopEmission[] = [];
    const closes: Record<string, unknown>[] = [];
    const view = renderHook(() => useJudgedSpeechLoop({
      enabled: true,
      onEmission: (event) => emissions.push(event),
      onVoiceTurnClose: (event) => closes.push(event),
    }));

    expect(localEnabled).toBe(false);
    expect(sharedClose).toBeTypeOf('function');

    act(() => {
      view.result.current.arm();
      sharedClose?.({
        kind: 'close',
        startedAt: 100,
        durationMs: 500,
        voicedMs: 585,
        peak: 0.1,
        duringTutorAudio: false,
        belowMinVoice: false,
      });
    });

    expect(closes).toHaveLength(1);
    expect(emissions.some((event) => event.kind === 'attempt-open')).toBe(true);
    expect(shared.reset).not.toHaveBeenCalled();
  });
});
