// @vitest-environment jsdom
/**
 * Support-tier (scaffolding-withdrawal) behaviour for PhonemeExplorer — DI
 * modality surface (sixth literacy port). The tier NEVER changes which content
 * is drawn; the generator stamps display flags in code and the render honors
 * them:
 *
 *   1. isolate worked-example card — easy: whole card · medium: card without
 *      the "starts with" sub-label · hard: no card. The phoneme TILE is the
 *      stimulus and survives every tier.
 *   2. picture cue — hard hides the emoji on the isolate menu cards and on the
 *      segment/manipulate stimulus. Render-time withdrawal only.
 *   3. instruction furniture — blend loses its cue label + "+" separators;
 *      manipulate's printed operation becomes the fixed neutral line.
 *
 * NEW PINS FROM THE DI PORT (leak rules, not tiers — they hold at EVERY tier):
 *   - segment NEVER prints its word: a reader would count LETTERS, not sounds.
 *   - blend/manipulate answers never appear pre-affirm.
 *   - the tutor-channel tier lever (menu enumeration) moved into the scripted
 *     ask and is pinned in PhonemeExplorer.di-script.test.ts, not here.
 *
 * The runner is mocked to a static "item open, asking" state — this file tests
 * the RENDER halves only; loop behaviour has its own suites.
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

const runnerState = vi.hoisted(() => ({ index: 0 }));

vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (opts: { pack: { items: unknown[] } }) => ({
    running: true,
    preparing: false,
    stage: 'asking',
    statusLine: '',
    currentIndex: runnerState.index,
    currentItem: opts.pack.items[runnerState.index] ?? null,
    solvedIds: new Set<string>(),
    currentSolved: false,
    canAttempt: true,
    summary: null,
    micState: 'idle' as const,
      cancelListening: undefined,
    start: async () => {},
    hearStimulus: () => {},
    stimulusTapped: false,
    submitGestureAttempt: () => {},
    isAwaitingGesture: () => false,
    loop: {},
  }),
}));

vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    isConnected: true,
    sendText: vi.fn(),
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

import PhonemeExplorer, { type PhonemeExplorerData } from './PhonemeExplorer';

// ── Fixtures — identical CONTENT at every tier; only the flags differ ────────
type Challenge = PhonemeExplorerData['challenges'][number];

const ISOLATE: Challenge = {
  id: 'c1', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm',
  exampleWord: 'mouse', exampleEmoji: '🐭',
  choices: [
    { word: 'moon', emoji: '🌙', correct: true },
    { word: 'dog', emoji: '🐶', correct: false },
    { word: 'fish', emoji: '🐟', correct: false },
    { word: 'cake', emoji: '🍰', correct: false },
  ],
};

const BLEND: Challenge = {
  id: 'c2', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱',
};

const SEGMENT: Challenge = {
  id: 'c3', mode: 'segment', targetWord: 'sheep', targetEmoji: '🐑', segments: ['sh', 'ee', 'p'],
};

const MANIPULATE: Challenge = {
  id: 'c4', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱',
  operation: 'substitute', operationDescription: "Change the /k/ in 'cat' to /b/",
  resultWord: 'bat', resultEmoji: '🦇',
};

const renderWith = (ch: Challenge) => {
  runnerState.index = 0;
  return render(
    <PhonemeExplorer data={{ title: 'Sound Safari', challenges: [ch] }} />,
  );
};

afterEach(cleanup);

// ── Legacy default (no tier fields) — full help ─────────────────────────────

describe('PhonemeExplorer support tiers — legacy default (no tier fields)', () => {
  it('isolate renders the FULL worked-example card, sub-label and picture cues', () => {
    renderWith(ISOLATE);
    expect(screen.getByText('mouse')).toBeTruthy();
    expect(screen.getByText(/starts with/i)).toBeTruthy();
    expect(screen.getByText('🌙')).toBeTruthy();
    expect(screen.getByText('moon')).toBeTruthy();
  });

  it('blend renders the cue label and the "+" separators', () => {
    renderWith(BLEND);
    expect(screen.getByText('Blend these sounds together:')).toBeTruthy();
    expect(screen.getAllByText('+').length).toBe(2);
    expect(screen.getByText('/k/')).toBeTruthy();
  });

  it('manipulate renders the authored operation description and the stimulus word', () => {
    renderWith(MANIPULATE);
    expect(screen.getByText("Change the /k/ in 'cat' to /b/")).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy();
  });

  it('segment shows the picture, never the printed word', () => {
    renderWith(SEGMENT);
    expect(screen.getByText('🐑')).toBeTruthy();
    expect(screen.queryByText('sheep')).toBeNull();
  });
});

// ── Hard tier — scaffolding withdrawn, stimulus intact ──────────────────────

describe('PhonemeExplorer support tiers — hard withdraws scaffolding', () => {
  it('isolate hides the worked-example card but KEEPS the phoneme tile (stimulus)', () => {
    renderWith({ ...ISOLATE, showExampleWord: false, showExampleHint: false, showChoiceEmoji: false });
    expect(screen.queryByText('mouse')).toBeNull();
    expect(screen.queryByText(/starts with/i)).toBeNull();
    expect(screen.getByText('M')).toBeTruthy();
  });

  it('hides the picture cue on the menu cards while keeping every card word', () => {
    renderWith({ ...ISOLATE, showChoiceEmoji: false });
    expect(screen.queryByText('🌙')).toBeNull();
    for (const w of ['moon', 'dog', 'fish', 'cake']) {
      expect(screen.getByText(w)).toBeTruthy();
    }
  });

  it('blend drops the cue label and the "+" separators, tiles intact', () => {
    renderWith({ ...BLEND, showBlendCue: false });
    expect(screen.queryByText('Blend these sounds together:')).toBeNull();
    expect(screen.queryByText('+')).toBeNull();
    expect(screen.getByText('/k/')).toBeTruthy();
    expect(screen.getByText('/t/')).toBeTruthy();
  });

  it('segment swaps the picture for a speaker, and still never prints the word', () => {
    renderWith({ ...SEGMENT, showChoiceEmoji: false });
    expect(screen.queryByText('🐑')).toBeNull();
    expect(screen.getByText('🔊')).toBeTruthy();
    expect(screen.queryByText('sheep')).toBeNull();
  });

  it('manipulate replaces the printed operation with the fixed neutral line', () => {
    renderWith({ ...MANIPULATE, showOperationDetail: false });
    expect(screen.queryByText("Change the /k/ in 'cat' to /b/")).toBeNull();
    expect(screen.getByText('Make a new word.')).toBeTruthy();
    // The stimulus word survives every tier.
    expect(screen.getByText('cat')).toBeTruthy();
  });
});

// ── Medium tier ─────────────────────────────────────────────────────────────

describe('PhonemeExplorer support tiers — medium thins the worked example', () => {
  it('keeps the example card but drops the "starts with" sub-label', () => {
    renderWith({ ...ISOLATE, showExampleHint: false });
    expect(screen.getByText('mouse')).toBeTruthy();
    expect(screen.queryByText(/starts with/i)).toBeNull();
  });
});

// ── DI leak rules — these hold at EVERY tier ────────────────────────────────

describe('PhonemeExplorer DI modality — answers never printed pre-affirm', () => {
  it('blend never prints the word before the affirmation', () => {
    renderWith(BLEND);
    expect(screen.queryByText(/cat/)).toBeNull();
  });

  it('manipulate never prints the result before the affirmation', () => {
    renderWith(MANIPULATE);
    expect(screen.queryByText('bat')).toBeNull();
    expect(screen.queryByText('🦇')).toBeNull();
  });

  it('segment never prints its count', () => {
    renderWith(SEGMENT);
    expect(screen.queryByText(/three/i)).toBeNull();
  });
});
