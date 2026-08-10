// @vitest-environment jsdom
/**
 * SoundSwap render contract after the DI port (qa/di/BACKLOG.md item 16).
 * What this locks in:
 *  1. Adult chrome is hidden at gradeLevel 'K' (counter, Grade/operation
 *     badges, the reader hint line) — a pre-reader gets the task by voice.
 *  2. The STARTING word and its sounds are the stimulus and are shown at every
 *     grade; tapping a sound speaks that SOUND via [PRONOUNCE_SOUND], never a
 *     word.
 *  3. ANSWER-LEAK: nothing that names the NEW word may appear before the child
 *     says it — not the result word, not its picture description.
 *  4. No button carries the child forward at any grade: no Start Activity, no
 *     answer options, no Next / Finish / Skip. The tutor owns every transition.
 *  5. The two surviving tier levers are visible, and the dead one is asserted
 *     dead rather than quietly ignored.
 *
 * The live loop itself is NOT driven here. It cannot be driven honestly in
 * jsdom (the mic never opens, the context refs never re-render), and the pilot
 * shipped exactly one such assertion, caught it, and replaced it with a pure
 * predicate test — see SoundSwap.di-script.test.ts, where the pedagogy lives.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: false,
  isAudioPlaying: false,
  micLevel: 0,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
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

import SoundSwap, { type SoundSwapData, type SoundSwapChallenge } from '../SoundSwap';

/** substitution: cat → bat, changing the first sound. */
const SUB_CHALLENGE: SoundSwapChallenge = {
  id: 'c1',
  operation: 'substitution',
  originalWord: 'cat',
  originalPhonemes: ['/k/', '/a/', '/t/'],
  originalImage: 'an orange cat sitting',
  oldPhoneme: '/k/',
  newPhoneme: '/b/',
  substitutePosition: 'beginning',
  resultWord: 'bat',
  resultPhonemes: ['/b/', '/a/', '/t/'],
  resultImage: 'a wooden baseball bat',
};

const makeData = (
  gradeLevel: string,
  overrides: Partial<SoundSwapChallenge> = {},
  dataOverrides: Partial<SoundSwapData> = {},
): SoundSwapData => ({
  title: 'Sound Swap: Animals',
  gradeLevel,
  challenges: [{ ...SUB_CHALLENGE, ...overrides }],
  ...dataOverrides,
});

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

describe('SoundSwap @ PRE (gradeLevel K)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hides adult chrome (counter, Grade/operation badges, the reader hint line)', () => {
    render(<SoundSwap data={makeData('K')} />);
    expect(screen.queryByText('Grade K')).toBeNull();
    expect(screen.queryByText(/Substitution/)).toBeNull();
    expect(screen.queryByText(/Tap a sound to hear it/)).toBeNull();
  });

  it('SHOWS the starting word and its sounds — they are the stimulus, not the answer', () => {
    render(<SoundSwap data={makeData('K')} />);
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'sound /k/' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'sound /a/' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'sound /t/' })).toBeTruthy();
  });

  it('tapping a sound speaks that SOUND via [PRONOUNCE_SOUND]', () => {
    render(<SoundSwap data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    const spoken = tagged('[PRONOUNCE_SOUND]');
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toContain('/k/');
  });

  it('tapping a sound never speaks a WORD — the new word is the answer', () => {
    render(<SoundSwap data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    fireEvent.click(screen.getByRole('button', { name: 'sound /a/' }));
    fireEvent.click(screen.getByRole('button', { name: 'sound /t/' }));
    expect(tagged('[PRONOUNCE_SOUND]')).toHaveLength(3);
    expect(sendText.mock.calls.some(c => /\b(bat|cat)\b/i.test(String(c[0])))).toBe(false);
  });

  it('ANSWER-LEAK — the new word is not printed before the child has said it', () => {
    render(<SoundSwap data={makeData('K')} />);
    expect(screen.queryByText('bat')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
  });

  it('ANSWER-LEAK — the new word’s picture description is not shown either', () => {
    // The pilot shipped a printed word AND a picture of it; only the live run
    // caught them. Here the picture is prose, which leaks just as completely.
    render(<SoundSwap data={makeData('K')} />);
    expect(screen.queryByText('a wooden baseball bat')).toBeNull();
  });

  it('no button carries the child forward — the tutor owns every transition', () => {
    render(<SoundSwap data={makeData('K')} />);
    expect(screen.queryByRole('button', { name: /Start Activity/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Next Challenge/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Finish/ })).toBeNull();
    expect(screen.queryByText(/Skip/)).toBeNull();
    // The answer buttons are gone with the click-driven task: the only buttons
    // left are the three sound tiles and the mic.
    expect(screen.queryByText(/Pick the right sound/)).toBeNull();
    expect(screen.queryByText(/Pick the replacement sound/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'sound /b/' })).toBeNull();
  });
});

describe('SoundSwap @ reader grade (control, Grade 1)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('keeps the adult chrome the K band hides', () => {
    render(<SoundSwap data={makeData('1')} />);
    expect(screen.getByText('Grade 1')).toBeTruthy();
    expect(screen.getByText(/Substitution/)).toBeTruthy();
    expect(screen.getByText(/Tap a sound to hear it/)).toBeTruthy();
  });

  it('the modality is not band-gated: no advance button and no leaked answer at Grade 1 either', () => {
    render(<SoundSwap data={makeData('1')} />);
    expect(screen.queryByRole('button', { name: /Next Challenge/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Start Activity/ })).toBeNull();
    expect(screen.queryByText('bat')).toBeNull();
    expect(screen.queryByText('a wooden baseball bat')).toBeNull();
  });
});

describe('SoundSwap tier levers · what survived the verbal port', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('showWordImage LIVE — easy shows the starting word’s picture cue, hard withdraws it', () => {
    const easy = render(<SoundSwap data={makeData('1', { showWordImage: true })} />);
    expect(screen.getByText('an orange cat sitting')).toBeTruthy();
    easy.unmount();

    render(<SoundSwap data={makeData('1', { showWordImage: false })} />);
    expect(screen.queryByText('an orange cat sitting')).toBeNull();
  });

  it('showTargetHighlight LIVE — easy marks the sound to change, hard leaves the child to find it', () => {
    const easy = render(<SoundSwap data={makeData('1', { showTargetHighlight: true })} />);
    expect(screen.getByRole('button', { name: 'sound /k/' }).getAttribute('data-target')).toBe('true');
    expect(screen.getByRole('button', { name: 'sound /a/' }).getAttribute('data-target')).toBeNull();
    easy.unmount();

    render(<SoundSwap data={makeData('1', { showTargetHighlight: false })} />);
    expect(screen.getByRole('button', { name: 'sound /k/' }).getAttribute('data-target')).toBeNull();
  });

  it('the highlight is substitution-only — a deletion never marks a tile', () => {
    render(<SoundSwap data={makeData('1', {
      operation: 'deletion',
      deletePhoneme: '/k/',
      deletePosition: 'beginning',
      resultWord: 'at',
      resultPhonemes: ['/a/', '/t/'],
      showTargetHighlight: true,
    })} />);
    expect(screen.getByRole('button', { name: 'sound /k/' }).getAttribute('data-target')).toBeNull();
  });

  it('NO tier withdraws tap-to-hear — a stuck child can always recover a sound', () => {
    for (const tier of [{}, { showWordImage: false, showTargetHighlight: false, nameTargetSound: false }]) {
      sendText.mockClear();
      const view = render(<SoundSwap data={makeData('1', tier)} />);
      fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
      expect(tagged('[PRONOUNCE_SOUND]')).toHaveLength(1);
      view.unmount();
    }
  });

  it('NO tier leaks the answer', () => {
    for (const tier of [{}, { showWordImage: false, showTargetHighlight: false, nameTargetSound: false }]) {
      const view = render(<SoundSwap data={makeData('1', tier)} />);
      expect(screen.queryByText('bat')).toBeNull();
      expect(screen.queryByText('a wooden baseball bat')).toBeNull();
      view.unmount();
    }
  });

  it('optionCount is DEAD — there are no answer buttons left for it to size', () => {
    render(<SoundSwap data={makeData('1', { optionCount: 5 })} />);
    // Only the three sound tiles of the STARTING word, whatever optionCount says.
    expect(screen.getAllByRole('button', { name: /^sound / })).toHaveLength(3);
  });

  it('nameTargetSound is DEAD — it governed a spoken walk that no longer exists', () => {
    // It first hid the target sound (only safe while answer buttons made the
    // answer determinate), was re-based onto the tutor's sound-by-sound walk,
    // and the walk was then deleted on the live-run ruling. Both settings must
    // now render identically — the tier reaches the screen, not the voice.
    const on = render(<SoundSwap data={makeData('1', { nameTargetSound: true })} />);
    const withLever = on.container.innerHTML;
    on.unmount();
    const off = render(<SoundSwap data={makeData('1', { nameTargetSound: false })} />);
    expect(off.container.innerHTML).toBe(withLever);
  });
});
