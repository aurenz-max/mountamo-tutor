// @vitest-environment jsdom
/**
 * Support-tier (scaffolding-withdrawal) behaviour for PhonemeExplorer.
 *
 * The tier NEVER changes which content is drawn — the generator stamps these
 * display/instruction flags in code AFTER the parse, so the same phonemes, words,
 * choices and correct answer are on screen at every tier. What changes is how much
 * help surrounds them:
 *
 *   1. isolate worked-example card  — easy: whole card · medium: card without the
 *      "starts with" sub-label · hard: no card. The phoneme TILE is the stimulus
 *      and survives every tier.
 *   2. picture cue on the answer surface — hard hides the emoji on the choice
 *      buttons and on the segment/manipulate target so the student decodes print.
 *      The emoji stays in the DATA; this is a render-time withdrawal.
 *   3. instruction furniture — blend loses the "Blend these sounds together:" cue
 *      and its "+" separators; manipulate's printed operation spell-out becomes a
 *      fixed neutral line chosen in CODE ("Make a new word.").
 *   4. tutor — the automatic enumeration of all four options is suppressed at hard
 *      (task framing kept, pronunciation on demand kept).
 *
 * BAND WINS: a declared pre-reader band keeps the picture cue and the read-aloud
 * whatever the tier says. LEGACY: a payload with no tier fields renders full help.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn<(m: string, opts?: unknown) => void>();
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({
    sendText, isConnected: true, isAIResponding: false, isAudioPlaying: false,
  }),
}));

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(), select: vi.fn(), pop: vi.fn(),
    playCorrect: vi.fn(), playIncorrect: vi.fn(), playStreak: vi.fn(),
    isEnabled: () => false, getVolume: () => 1, play: vi.fn(),
  },
}));

vi.mock('../../../hooks/useVoiceChoice', () => ({
  useVoiceChoice: () => ({
    focusIdx: 0, answers: [], allSolved: false, highlight: null, note: '',
    voice: {
      state: 'idle', level: 0, isSupported: false, dormant: true,
      start: vi.fn(), stop: vi.fn(),
    },
    tapOption: vi.fn(), focusItem: vi.fn(), reset: vi.fn(),
  }),
}));

import PhonemeExplorer, { type PhonemeExplorerData } from './PhonemeExplorer';

// ── Fixtures — identical CONTENT at every tier; only the flags differ ────────
type Challenge = PhonemeExplorerData['challenges'][number];

const ISOLATE: Challenge = {
  id: 'c1',
  mode: 'isolate',
  phoneme: 'B',
  phonemeSound: 'buh',
  exampleWord: 'Bear',
  exampleEmoji: '🐻',
  choices: [
    { word: 'Ball', emoji: '⚽', correct: true },
    { word: 'Cat', emoji: '🐱', correct: false },
    { word: 'Dog', emoji: '🐶', correct: false },
    { word: 'Sun', emoji: '☀️', correct: false },
  ],
};

const BLEND: Challenge = {
  id: 'c1',
  mode: 'blend',
  phonemeSequence: ['k', 'a', 't'],
  phonemeDisplay: '/k/ /a/ /t/',
  choices: [
    { word: 'Cat', emoji: '🐱', correct: true },
    { word: 'Cap', emoji: '🧢', correct: false },
    { word: 'Cot', emoji: '🛏️', correct: false },
    { word: 'Cut', emoji: '✂️', correct: false },
  ],
};

const SEGMENT: Challenge = {
  id: 'c1',
  mode: 'segment',
  targetWord: 'fish',
  targetEmoji: '🐟',
  segmentOptions: ['/f/ /i/ /sh/', '/f/ /sh/', '/f/ /i/ /s/ /h/', '/fi/ /sh/'],
  correctSegmentation: 0,
};

const MANIPULATE: Challenge = {
  id: 'c1',
  mode: 'manipulate',
  originalWord: 'cat',
  originalEmoji: '🐱',
  operation: 'substitute',
  operationDescription: "Change the /k/ in 'cat' to /b/",
  choices: [
    { word: 'Bat', emoji: '🦇', correct: true },
    { word: 'Cot', emoji: '🛏️', correct: false },
    { word: 'Cap', emoji: '🧢', correct: false },
    { word: 'Can', emoji: '🥫', correct: false },
  ],
};

/** Stamp a challenge the way the generator does for one tier. */
function withFlags(ch: Challenge, flags: Partial<Challenge>): Challenge {
  return { ...ch, ...flags };
}

function makeData(ch: Challenge, over: Partial<PhonemeExplorerData> = {}): PhonemeExplorerData {
  return {
    title: 'Sound Safari: beginning sounds',
    challenges: [ch],
    voiceEligible: false,
    ...over,
  };
}

function start(data: PhonemeExplorerData) {
  render(<PhonemeExplorer data={data} />);
  fireEvent.click(screen.getByText('Start Activity'));
}

/** The phoneme TILE (the stimulus) — distinguished from the "B" that also appears
 *  inside the worked-example sub-label and the question line. */
function phonemeTileText(): string | undefined {
  return document.querySelector('.text-5xl.font-black')?.textContent ?? undefined;
}

/** The worked-example sub-label ("starts with B"). Anchored so it cannot collide
 *  with the question line, which also contains the words "starts with". */
const SUB_LABEL = /^starts with/i;

/** The intro message the tutor was told to speak for the current challenge. */
function introMessage(): string {
  const call = sendText.mock.calls.find(
    ([m]) => typeof m === 'string' && (m.includes('[ACTIVITY_START]') || m.includes('[NEW_CHALLENGE]')),
  );
  return (call?.[0] as string) ?? '';
}

beforeEach(() => { sendText.mockClear(); });
afterEach(() => cleanup());

// ============================================================================
// LEGACY — a payload with no tier fields must render exactly as it always did
// ============================================================================

describe('PhonemeExplorer support tiers — legacy default (no tier fields)', () => {
  it('isolate renders the FULL worked-example card, sub-label and picture cues', () => {
    start(makeData(ISOLATE));

    // stimulus
    expect(phonemeTileText()).toBe('B');
    // worked example, whole card
    expect(screen.getByText('Bear')).toBeTruthy();
    expect(screen.getByText('🐻')).toBeTruthy();
    expect(screen.getByText(SUB_LABEL)).toBeTruthy();
    // picture cue on every choice
    for (const emoji of ['⚽', '🐱', '🐶', '☀️']) {
      expect(screen.getByText(emoji)).toBeTruthy();
    }
  });

  it('blend renders the cue label and the "+" separators', () => {
    start(makeData(BLEND));
    expect(screen.getByText('Blend these sounds together:')).toBeTruthy();
    // 3 phonemes → 2 separators
    expect(screen.getAllByText('+')).toHaveLength(2);
  });

  it('manipulate renders the authored operation description', () => {
    start(makeData(MANIPULATE));
    expect(screen.getByText("Change the /k/ in 'cat' to /b/")).toBeTruthy();
    expect(screen.queryByText('Make a new word.')).toBeNull();
  });

  it('the tutor reads every option aloud and carries no tier policy', () => {
    start(makeData(ISOLATE));
    const msg = introMessage();
    expect(msg).toContain('read each option aloud');
    expect(msg).toContain('Ball, Cat, Dog, Sun');
    expect(msg).toContain('like in Bear');
    expect(msg).not.toContain('[SUPPORT_TIER');
  });
});

// ============================================================================
// HARD — withdrawal
// ============================================================================

describe('PhonemeExplorer support tiers — hard withdraws scaffolding', () => {
  const hardIsolate = withFlags(ISOLATE, {
    showExampleWord: false, showExampleHint: false,
    showChoiceEmoji: false, readOptionsAloud: false,
  });

  it('isolate hides the worked-example card but KEEPS the phoneme tile (stimulus)', () => {
    start(makeData(hardIsolate, { supportTier: 'hard' }));

    expect(screen.queryByText('Bear')).toBeNull();
    expect(screen.queryByText('🐻')).toBeNull();
    expect(screen.queryByText(SUB_LABEL)).toBeNull();

    // the sound object survives every tier
    expect(phonemeTileText()).toBe('B');
    expect(screen.getByText(/buh/)).toBeTruthy();
  });

  it('hides the picture cue on the choice buttons while keeping every option word', () => {
    start(makeData(hardIsolate, { supportTier: 'hard' }));

    for (const emoji of ['⚽', '🐱', '🐶', '☀️']) {
      expect(screen.queryByText(emoji)).toBeNull();
    }
    // answer form is untouched: all four options, correct one included
    for (const word of ['Ball', 'Cat', 'Dog', 'Sun']) {
      expect(screen.getByText(word)).toBeTruthy();
    }
  });

  it('blend drops the cue label and the "+" separators, tiles intact', () => {
    start(makeData(
      withFlags(BLEND, { showBlendCue: false, showChoiceEmoji: false, readOptionsAloud: false }),
      { supportTier: 'hard' },
    ));

    expect(screen.queryByText('Blend these sounds together:')).toBeNull();
    expect(screen.queryAllByText('+')).toHaveLength(0);
    // the phoneme tiles ARE the stimulus
    expect(screen.getByText('/k/')).toBeTruthy();
    expect(screen.getByText('/a/')).toBeTruthy();
    expect(screen.getByText('/t/')).toBeTruthy();
  });

  it('segment hides the target picture but keeps the word and all four options', () => {
    start(makeData(
      withFlags(SEGMENT, { showChoiceEmoji: false, readOptionsAloud: false }),
      { supportTier: 'hard' },
    ));

    expect(screen.queryByText('🐟')).toBeNull();
    expect(screen.getAllByText(/fish/).length).toBeGreaterThan(0);
    for (const option of SEGMENT.segmentOptions ?? []) {
      expect(screen.getByText(option)).toBeTruthy();
    }
  });

  it('manipulate replaces the printed operation with the fixed neutral line', () => {
    start(makeData(
      withFlags(MANIPULATE, {
        showOperationDetail: false, showChoiceEmoji: false, readOptionsAloud: false,
      }),
      { supportTier: 'hard' },
    ));

    expect(screen.getByText('Make a new word.')).toBeTruthy();
    expect(screen.queryByText("Change the /k/ in 'cat' to /b/")).toBeNull();
    // stimulus + answer form untouched
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.queryByText('🐱')).toBeNull();
    for (const word of ['Bat', 'Cot', 'Cap', 'Can']) {
      expect(screen.getByText(word)).toBeTruthy();
    }
  });

  it('the tutor stops enumerating the options and does not voice the withdrawn example', () => {
    start(makeData(hardIsolate, { supportTier: 'hard' }));
    const msg = introMessage();

    expect(msg).not.toContain('Ball, Cat, Dog, Sun');
    expect(msg).toContain('Do NOT read the options aloud');
    expect(msg).not.toContain('like in Bear');
    // task framing + the sound itself survive
    expect(msg).toContain('buh');
    expect(msg).toContain('[SUPPORT_TIER hard]');
  });

  it('manipulate keeps the operation in the tutor VOICE when the print is withdrawn', () => {
    start(makeData(
      withFlags(MANIPULATE, {
        showOperationDetail: false, showChoiceEmoji: false, readOptionsAloud: false,
      }),
      { supportTier: 'hard' },
    ));
    const msg = introMessage();

    // otherwise the item would be unanswerable — the audio channel carries it
    expect(msg).toContain("Change the /k/ in 'cat' to /b/");
    expect(msg).not.toContain('Bat, Cot, Cap, Can');
  });
});

// ============================================================================
// MEDIUM — the sub-label goes first, the card stays
// ============================================================================

describe('PhonemeExplorer support tiers — medium thins the worked example', () => {
  it('keeps the example card but drops the "starts with" sub-label', () => {
    start(makeData(
      withFlags(ISOLATE, {
        showExampleWord: true, showExampleHint: false,
        showChoiceEmoji: true, readOptionsAloud: true,
      }),
      { supportTier: 'medium' },
    ));

    expect(screen.getByText('Bear')).toBeTruthy();
    expect(screen.getByText('🐻')).toBeTruthy();
    expect(screen.queryByText(SUB_LABEL)).toBeNull();
    expect(screen.getByText('⚽')).toBeTruthy();
  });
});

// ============================================================================
// BAND WINS — a declared pre-reader band overrides the tier
// ============================================================================

describe('PhonemeExplorer support tiers — pre-reader band wins over the tier', () => {
  it('K keeps the picture cue even if a payload says to hide it', () => {
    start(makeData(
      withFlags(ISOLATE, { showChoiceEmoji: false, readOptionsAloud: false }),
      { supportTier: 'hard', gradeLevel: 'K' },
    ));

    for (const emoji of ['⚽', '🐱', '🐶', '☀️']) {
      expect(screen.getByText(emoji)).toBeTruthy();
    }
  });

  it('K keeps the tutor read-aloud even if a payload says to suppress it', () => {
    start(makeData(
      withFlags(ISOLATE, { showChoiceEmoji: false, readOptionsAloud: false }),
      { supportTier: 'hard', gradeLevel: 'kindergarten' },
    ));

    expect(introMessage()).toContain('Ball, Cat, Dog, Sun');
  });

  it('K still loses the worked example at hard (it is not a pre-reader need)', () => {
    start(makeData(
      withFlags(ISOLATE, { showExampleWord: false, showExampleHint: false }),
      { supportTier: 'hard', gradeLevel: 'K' },
    ));

    expect(screen.queryByText('Bear')).toBeNull();
    expect(phonemeTileText()).toBe('B');
  });
});
