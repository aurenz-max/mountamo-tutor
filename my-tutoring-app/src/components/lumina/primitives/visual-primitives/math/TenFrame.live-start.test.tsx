// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
const seam = vi.hoisted(() => ({
  activeId: 'other', listening: true, opening: vi.fn(), queue: vi.fn(), submit: vi.fn(),
  emit: null as ((event: LoopEmission) => void) | null,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: seam.listening, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: seam.activeId,
  sessionResumeCount: 0, conversation: [], sendText: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn(),
}) }));
vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({ useJudgedSpeechLoop: (options: { onEmission: (event: LoopEmission) => void }) => {
  seam.emit = options.onEmission;
  return { queueCue: seam.queue, sendCueNow: seam.opening, submitGestureAttempt: vi.fn(), clearQueuedCue: vi.fn(),
    arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(), isAwaitingJudgment: () => false, voiceTurns: {}, config: {} };
} }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import TenFrame, { type TenFrameData } from './TenFrame';
const data: TenFrameData = { instanceId: 'frame', title: 'Make ten', mode: 'single', gradeBand: '1-2',
  counters: { count: 0, color: 'red', positions: [] }, challenges: [6, 7].map((n, i) => ({
    id: `c${i}`, type: 'make_ten', targetCount: n, instruction: 'How many more?', hint: '', narration: '',
  })) };
beforeEach(() => { vi.clearAllMocks(); seam.activeId = 'other'; seam.listening = true; });
afterEach(cleanup);

it('waits for activation and the mic, opens once automatically, and uses the real runner to advance after a verdict', async () => {
  const view = render(<TenFrame data={data} autoStart />);
  expect(seam.opening).not.toHaveBeenCalled();
  seam.activeId = 'frame'; seam.listening = false;
  view.rerender(<TenFrame data={data} autoStart />);
  expect(seam.opening).not.toHaveBeenCalled();
  seam.listening = true;
  view.rerender(<TenFrame data={data} autoStart />);
  await waitFor(() => expect(seam.opening).toHaveBeenCalledTimes(1));
  expect(seam.opening.mock.calls[0][0]).toContain('[TF_ITEM]');
  view.rerender(<TenFrame data={data} autoStart />);
  expect(seam.opening).toHaveBeenCalledTimes(1);
  await act(async () => { seam.emit!({ kind: 'verdict', judgment: 'affirmed', attempt: { source: 'voice', transcript: 'four' } } as LoopEmission); });
  expect(seam.queue).toHaveBeenCalledWith(expect.stringContaining('[TF_ITEM]'));
  expect(seam.queue.mock.calls.at(-1)![0]).toContain('seven');
});
