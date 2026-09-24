// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for phonics-blender @ PRE
 * (qa/reader-fit/phonics-blender-PRE-2026-07-15.md), re-based 2026-08-09 onto
 * the DI modality and its purely-verbal task. The PRE (Kindergarten) contract
 * this locks in:
 *  1. Adult chrome is hidden at gradeLevel 'K': the word counter, the
 *     Grade/pattern badges, and the reader instruction line.
 *  2. The word's LETTERS are the stimulus and are shown at every grade — a
 *     pre-reader is learning to decode them, so they are never hidden.
 *  3. Tapping a letter speaks that SOUND via [PRONOUNCE_SOUND] (R2), and never
 *     the whole word — the word is the answer.
 *  4. ANSWER-LEAK: nothing that names the word may appear before the child says
 *     it — no printed whole word, no picture. R8's emoji is a post-answer
 *     reward now; see the contract's C4.
 *  5. R4 RE-BASED — no button carries the child forward at any grade. The tutor
 *     owns every transition.
 *
 * External hooks (live tutor context, evaluation, audio) are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: false,
  isAudioPlaying: false,
  sessionMode: 'lesson' as 'idle' | 'lesson',
  activePrimitiveId: 'blend',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
    sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
  }),
}));

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import PhonicsBlender, { type PhonicsBlenderData } from '../PhonicsBlender';
import { LiveLessonRuntime } from '../../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../../components/live-activity/runtime/LiveRuntimeSurface';

/** Phonics blender runs only on the teaching workspace, so it is mounted the way a lesson mounts it. */
const bound = (data: PhonicsBlenderData) => {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  return <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <PhonicsBlender data={data} runtimePlanItemId="plan-blend" runtimeEvalMode="cvc" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
};


const makeData = (gradeLevel: string): PhonicsBlenderData => ({
  title: 'Animal Sounds',
  instanceId: 'blend',
  gradeLevel,
  patternType: 'cvc',
  words: [
    {
      id: 'w1',
      targetWord: 'cat',
      emoji: '🐱',
      imageDescription: 'a small furry cat',
      phonemes: [
        { id: 'w1_p1', sound: '/k/', letters: 'c' },
        { id: 'w1_p2', sound: '/a/', letters: 'a' },
        { id: 'w1_p3', sound: '/t/', letters: 't' },
      ],
    },
  ],
});

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

describe('PhonicsBlender @ PRE (gradeLevel K)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hides adult chrome (word counter, badges, reader instruction line)', () => {
    render(bound(makeData('K')));
    expect(screen.queryByText('Grade K')).toBeNull();
    expect(screen.queryByText('CVC Words')).toBeNull();
    expect(screen.queryByText(/Tap a letter to hear its sound/)).toBeNull();
  });

  it('SHOWS the word’s letters — they are the stimulus a pre-reader is learning to decode', () => {
    render(bound(makeData('K')));
    expect(screen.getByRole('button', { name: 'sound /k/' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'sound /a/' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'sound /t/' })).toBeTruthy();
    expect(screen.getByText('c')).toBeTruthy();
  });

  it('tapping a letter asks the tutor for its SOUND (R2)', () => {
    render(bound(makeData('K')));
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    const spoken = tagged('The learner tapped a letter');
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toContain('/k/');
  });

  it('tapping a letter never speaks the WORD — the word is the answer', () => {
    render(bound(makeData('K')));
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    fireEvent.click(screen.getByRole('button', { name: 'sound /a/' }));
    fireEvent.click(screen.getByRole('button', { name: 'sound /t/' }));
    expect(tagged('The learner tapped a letter')).toHaveLength(3);
    expect(sendText.mock.calls.some(c => /\bcat\b/i.test(String(c[0])))).toBe(false);
  });

  it('ANSWER-LEAK — the picture is not shown before the child has blended the word', () => {
    render(bound(makeData('K')));
    expect(screen.queryByText('🐱')).toBeNull();
  });

  it('ANSWER-LEAK — the whole word is never printed as a word before the answer', () => {
    render(bound(makeData('K')));
    // The letters render individually; nothing renders the joined string.
    expect(screen.queryByText('cat')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
  });

  it('R4 RE-BASED — no button may carry the child forward', () => {
    render(bound(makeData('K')));
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ready to Build/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Blend!/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Next Word/ })).toBeNull();
    expect(screen.queryByText('Clear')).toBeNull();
    expect(screen.queryByText('Sound Bank:')).toBeNull();
  });
});

describe('PhonicsBlender @ reader grade (control, Grade 1)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('keeps the adult chrome the K band hides', () => {
    render(bound(makeData('1')));
    expect(screen.getByText('Grade 1')).toBeTruthy();
    expect(screen.getByText('CVC Words')).toBeTruthy();
    expect(screen.getByText(/Tap a letter to hear its sound/)).toBeTruthy();
  });

  it('the modality is not band-gated: no advance button and no leaked answer at Grade 1 either', () => {
    render(bound(makeData('1')));
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ready to Build/ })).toBeNull();
    expect(screen.queryByText('🐱')).toBeNull();
    expect(screen.queryByText('cat')).toBeNull();
  });
});
