// @vitest-environment jsdom
/**
 * Within-mode support tiers for phonics-blender, re-based 2026-08-09 onto the purely-verbal task and 2026-10-20 onto
 * the boss (`phonicsBlender.boss.ts`).
 *
 * The tier withdraws SEGMENTATION HELP, never the stimulus and never the answer:
 *
 *   showBlendPreview   LIVE — 'full' separated letters with dots · 'word' separated, no dots · 'none' joined into one
 *                      solid word, so the child does the segmenting (and the scene tells the tutor not to split it).
 *   supportTier        LIVE — when the model lever comes (the lever set's `support` fact).
 *   nameTargetPhonemes DEAD — the scripted model line that read it is gone.
 *   showSlotCount      DEAD — there are no build slots; nothing is arranged.
 *   showTileLetters    DEAD — the letters ARE the stimulus and cannot be a sub-label of themselves.
 *
 * What counts as a blend is the spoken key (`blendKey`), asserted here in place of the retired judging contract.
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

import { spokenKeyText } from '../../../../components/live-activity/spokenKey';
import { blendKey, blendScene, phonicsBlenderItems, type BlendWord } from '../phonicsBlenderDomain';
import { BLEND_LEVERS } from '../phonicsBlenderLevers';

const makeData = (
  gradeLevel: string,
  tierFields: Partial<PhonicsBlenderData> = {},
): PhonicsBlenderData => ({
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
  ...tierFields,
});

const EASY: Partial<PhonicsBlenderData> = {
  supportTier: 'easy',
  showBlendPreview: 'full',
  nameTargetPhonemes: true,
};
const MEDIUM: Partial<PhonicsBlenderData> = {
  supportTier: 'medium',
  showBlendPreview: 'word',
  nameTargetPhonemes: true,
};
const HARD: Partial<PhonicsBlenderData> = {
  supportTier: 'hard',
  showBlendPreview: 'none',
  nameTargetPhonemes: false,
};

describe('phonics-blender tier · lever 1: showBlendPreview (segmentation help)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('easy separates the letters and marks the breaks with dots', () => {
    render(bound(makeData('1', EASY)));
    expect(screen.getAllByText('·').length).toBe(2);
  });

  it('medium keeps the letters separated but drops the dots', () => {
    render(bound(makeData('1', MEDIUM)));
    expect(screen.queryByText('·')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^sound / }).length).toBe(3);
  });

  it('hard joins the letters into one solid word — the child segments it', () => {
    render(bound(makeData('1', HARD)));
    expect(screen.queryByText('·')).toBeNull();
    // The stimulus is NOT withdrawn: every letter is still there and tappable.
    expect(screen.getAllByRole('button', { name: /^sound / }).length).toBe(3);
    expect(screen.getByText('c')).toBeTruthy();
  });

  it('NO tier withdraws tap-to-hear — a stuck child can always recover a sound (R2)', () => {
    for (const tier of [EASY, MEDIUM, HARD]) {
      sendText.mockClear();
      const view = render(bound(makeData('1', tier)));
      fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
      expect(sendText.mock.calls.filter(c => String(c[0]).startsWith('The learner tapped a letter'))).toHaveLength(1);
      view.unmount();
    }
  });

  it('NO tier leaks the answer — no picture and no printed word at any tier', () => {
    for (const tier of [EASY, MEDIUM, HARD]) {
      const view = render(bound(makeData('1', tier)));
      expect(screen.queryByText('🐱')).toBeNull();
      expect(screen.queryByText('cat')).toBeNull();
      view.unmount();
    }
  });
});

describe('phonics-blender tier · dead levers (asserted, not ignored)', () => {
  afterEach(cleanup);

  it('showSlotCount has no surface — there are no build slots to count', () => {
    render(bound(makeData('1', { ...EASY, showSlotCount: false })));
    expect(screen.queryByText('?')).toBeNull();
  });

  it('showTileLetters has no surface — the letters ARE the stimulus', () => {
    render(bound(makeData('1', { ...EASY, showTileLetters: false })));
    expect(screen.getByText('c')).toBeTruthy();
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('t')).toBeTruthy();
  });
});

describe('phonics-blender tier · what the tutor is told', () => {
  const item = (tier: Partial<PhonicsBlenderData>) => phonicsBlenderItems(makeData('1', tier))[0] as BlendWord;

  it('the joined row of the hard tier tells the tutor not to split the word; the split tiers do not', () => {
    expect(String(blendScene(item(HARD), 'none').facts!.constraints)).toContain('do not split it into sounds');
    expect(String(blendScene(item(EASY), 'full').facts!.constraints)).not.toContain('split');
    expect(blendScene(item(HARD), 'none').facts!.letters).toBe('cat');
    expect(blendScene(item(EASY), 'full').facts!.letters).toBe('c a t');
  });

  it('the tier says when the model lever comes: easy before a try, hard never before one', () => {
    expect(BLEND_LEVERS.support(item(EASY))).toMatch(/^before the learner tries/);
    expect(BLEND_LEVERS.support(item(HARD))).not.toMatch(/^before the learner tries/);
  });
});

describe('phonics-blender · the spoken key (what counts as a blend)', () => {
  const key = spokenKeyText(blendKey(phonicsBlenderItems(makeData('1'))[0])!);

  it('the word is the answer, and a sound-out that ENDS in the word is right — blending aloud is the skill', () => {
    expect(key).toMatch(/^"cat"\./);
    expect(key).toContain('Sounding it out first and then saying cat whole is right.');
  });

  it('separate sounds with no word at the end, letter names, and a near neighbour are not the word', () => {
    expect(key).toContain('separate sounds with no word at the end');
    expect(key).toContain('letter names');
    expect(key).toContain('a close but different word (one sound changed) are not yet cat');
  });
});
