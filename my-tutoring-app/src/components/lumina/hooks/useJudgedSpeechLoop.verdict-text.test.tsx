// @vitest-environment jsdom
/**
 * The tutor's judging line, captured whole — `useJudgedSpeechLoop`'s half of
 * the Misconception-Loop Tier-A path (2026-07-25).
 *
 * WHY THIS LAYER EXISTS AT ALL. The reducer classifies a verdict from the
 * sentinel OPENER and fires immediately, which is correct — progression must
 * not wait on the rest of a sentence. But output transcription streams in
 * sub-word chunks, so `verdict.verdictText` is truncated at "My turn" by
 * construction, and for a contrastive correction that opener is precisely the
 * part carrying NO diagnosis. "not one — two plus one is three" arrives after
 * it. This hook keeps accumulating past the verdict and emits the finished
 * line as `verdict-text` when the turn ends.
 *
 * The reducer is deliberately untouched: these tests pin that the verdict
 * emission still fires early and unchanged, and that the completed line is a
 * SEPARATE, later emission.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LoopEmission } from './judgedLoopModel';

interface Msg { role: 'user' | 'assistant'; content: string; timestamp: number }

const ctxState: { conversation: Msg[]; isAudioPlaying: boolean } = {
  conversation: [],
  isAudioPlaying: false,
};
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    conversation: ctxState.conversation,
    isAudioPlaying: ctxState.isAudioPlaying,
    sendText: vi.fn(),
  }),
}));

/** The voice-turn authority is a mic-bound hook; stub it and keep its close
 *  callback so a test can close a learner turn on demand. */
let closeVoiceTurn: (event: Record<string, unknown>) => void = () => {};
vi.mock('./useLiveVoiceTurns', () => ({
  useLiveVoiceTurns: (options: { onTurnClose: (e: Record<string, unknown>) => void }) => {
    closeVoiceTurn = options.onTurnClose;
    return { isVoiceActive: () => false, reset: vi.fn() };
  },
}));

import { useJudgedSpeechLoop } from './useJudgedSpeechLoop';

/** The correction the tutor speaks, split the way transcription delivers it. */
const CHUNKS = ['My turn', ': not one —', ' two plus one is three.', ' Your turn. What is two plus one?'];
const WHOLE = 'My turn: not one — two plus one is three. Your turn. What is two plus one?';

const setup = () => {
  const emissions: LoopEmission[] = [];
  const view = renderHook(() => useJudgedSpeechLoop({
    enabled: true,
    onEmission: (e) => emissions.push(e),
  }));

  /** Push tutor transcription chunks through the conversation feed. */
  const tutorSays = (...chunks: string[]) => act(() => {
    ctxState.isAudioPlaying = true;
    ctxState.conversation = [
      ...ctxState.conversation,
      ...chunks.map((content, i) => ({ role: 'assistant' as const, content, timestamp: i })),
    ];
    view.rerender();
  });

  /** The tutor's audio fell — its turn is over. */
  const tutorFallsQuiet = () => act(() => {
    ctxState.isAudioPlaying = false;
    view.rerender();
  });

  /** A learner voice turn closed, anchoring an attempt. */
  const learnerAnswers = () => act(() => {
    closeVoiceTurn({
      belowMinVoice: false, startedAt: 1000, durationMs: 600, peak: 0.2, duringTutorAudio: false,
    });
  });

  return { emissions, view, tutorSays, tutorFallsQuiet, learnerAnswers };
};

const kinds = (emissions: LoopEmission[]) => emissions.map((e) => e.kind);

describe('useJudgedSpeechLoop — the tutor’s judging line', () => {
  beforeEach(() => {
    ctxState.conversation = [];
    ctxState.isAudioPlaying = false;
  });

  it('emits the COMPLETE line after the verdict, once the tutor goes quiet', () => {
    const { emissions, view, tutorSays, tutorFallsQuiet, learnerAnswers } = setup();
    act(() => view.result.current.arm());
    learnerAnswers();
    tutorSays(...CHUNKS);
    // The verdict already fired on the first chunk — progression is not held.
    expect(kinds(emissions)).toEqual(['attempt-open', 'verdict']);
    expect(emissions[1]).toMatchObject({ judgment: 'corrected', verdictText: 'My turn' });

    tutorFallsQuiet();
    const finished = emissions.find((e) => e.kind === 'verdict-text');
    expect(finished).toEqual({ kind: 'verdict-text', judgment: 'corrected', text: WHOLE });
  });

  it('does not double-count the chunk that triggered the verdict', () => {
    // The chunk carrying the sentinel is already inside `verdictText`, and the
    // hook seeds the accumulator with it — appending it again would stutter
    // "My turn My turn:" into the quoted evidence.
    const { emissions, view, tutorSays, tutorFallsQuiet, learnerAnswers } = setup();
    act(() => view.result.current.arm());
    learnerAnswers();
    tutorSays(...CHUNKS);
    tutorFallsQuiet();
    const finished = emissions.find((e) => e.kind === 'verdict-text');
    expect(finished && 'text' in finished ? finished.text : '').toBe(WHOLE);
  });

  it('flushes when the learner answers over the line, BEFORE the next attempt opens', () => {
    // A consumer closes its evidence window on 'attempt-open', so the upgrade
    // has to land first or it is dropped on the floor.
    const { emissions, view, tutorSays, learnerAnswers } = setup();
    act(() => view.result.current.arm());
    learnerAnswers();
    tutorSays('My turn', ': not one — two plus one is three.');
    emissions.length = 0;
    learnerAnswers();
    expect(kinds(emissions)).toEqual(['verdict-text', 'attempt-open']);
  });

  it('never merges two judgments into one string', () => {
    const { emissions, view, tutorSays, tutorFallsQuiet, learnerAnswers } = setup();
    act(() => view.result.current.arm());
    learnerAnswers();
    tutorSays('My turn', ': not one — two plus one is three.');
    tutorFallsQuiet();
    learnerAnswers();
    tutorSays('Yes', ', three.');
    tutorFallsQuiet();

    const lines = emissions.filter((e) => e.kind === 'verdict-text');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ judgment: 'corrected' });
    expect(lines[1]).toEqual({ kind: 'verdict-text', judgment: 'affirmed', text: 'Yes, three.' });
  });

  it('reset drops an open line rather than flushing it into the next run', () => {
    const { emissions, view, tutorSays, tutorFallsQuiet, learnerAnswers } = setup();
    act(() => view.result.current.arm());
    learnerAnswers();
    tutorSays('My turn', ': not one —');
    act(() => view.result.current.reset());
    emissions.length = 0;
    tutorFallsQuiet();
    expect(emissions.filter((e) => e.kind === 'verdict-text')).toHaveLength(0);
  });

  it('stays silent when the tutor never produced a judgment at all', () => {
    const { emissions, view, tutorSays, tutorFallsQuiet, learnerAnswers } = setup();
    act(() => view.result.current.arm());
    learnerAnswers();
    tutorSays('Let us keep going.');
    tutorFallsQuiet();
    expect(emissions.filter((e) => e.kind === 'verdict-text')).toHaveLength(0);
  });
});
