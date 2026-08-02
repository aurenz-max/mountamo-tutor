// @vitest-environment jsdom
/**
 * Support-tier + answer-leak behavioral verification for letter-sound-link.
 *
 * Two things are asserted here:
 *
 *  A. DEFECT FIXES (tier-independent, live rule-#1 leaks). The tutor sends used
 *     to hand over the answer before the student had answered:
 *       (a) [ACTIVITY_START] stated letter + sound + fired [SAY_KEYWORD]
 *       (b) [NEXT_CHALLENGE] restated letter + sound + keyword for every item
 *       (c) [ANSWER_INCORRECT] fired [SAY_KEYWORD] mid-attempt
 *     The answer dimension DIFFERS PER MODE (see-hear → the sound; hear-see →
 *     the letter; keyword-match → the keyword), so the fix is mode-aware.
 *
 *  B. SUPPORT TIERS (scaffold withdrawal). Every tier field is optional: a
 *     payload without them must render exactly the legacy full-help card.
 *     Band supports win — the K two-tap protocol is never withdrawn.
 *
 * External hooks (live tutor, evaluation, audio, spoken judge) are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const aiOpts = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: (opts: Record<string, unknown>) => {
    aiOpts.last = opts;
    return { sendText, isConnected: true };
  },
}));

vi.mock('../../../../evaluation', async () => {
  const ReactMod = await import('react');
  return {
    usePrimitiveEvaluation: () => {
      const [hasSubmitted, setHasSubmitted] = ReactMod.useState(false);
      return {
        submitResult: () => setHasSubmitted(true),
        hasSubmitted,
        submittedResult: null,
        elapsedMs: 0,
      };
    },
    useEvaluationContext: () => null,
  };
});

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

vi.mock('../../../../hooks/useSpokenWordCapture', () => ({
  useSpokenWordCapture: () => ({
    state: 'idle', level: 0, isSupported: false,
    start: vi.fn(), cancel: vi.fn(),
  }),
}));

import LetterSoundLink, {
  type LetterSoundLinkData,
  type LetterSoundLinkChallenge,
} from '../LetterSoundLink';

// ---------------------------------------------------------------------------
// Fixtures — index 0 is ALWAYS the correct option so taps are deterministic.
// ---------------------------------------------------------------------------

const seeHear = (over: Partial<LetterSoundLinkChallenge> = {}): LetterSoundLinkChallenge => ({
  id: 'ch1', mode: 'see-hear', targetLetter: 's', targetSound: '/s/',
  keywordWord: 'sun', keywordImage: 'sun',
  options: [{ sound: '/s/', isCorrect: true }, { sound: '/t/', isCorrect: false }],
  ...over,
});

const seeHear2 = (over: Partial<LetterSoundLinkChallenge> = {}): LetterSoundLinkChallenge => ({
  id: 'ch2', mode: 'see-hear', targetLetter: 't', targetSound: '/t/',
  keywordWord: 'top', keywordImage: 'top',
  options: [{ sound: '/t/', isCorrect: true }, { sound: '/p/', isCorrect: false }],
  ...over,
});

const hearSee = (over: Partial<LetterSoundLinkChallenge> = {}): LetterSoundLinkChallenge => ({
  id: 'ch1', mode: 'hear-see', targetLetter: 't', targetSound: '/t/',
  keywordWord: 'top', keywordImage: 'top',
  options: [{ letter: 't', isCorrect: true }, { letter: 'd', isCorrect: false }],
  ...over,
});

const keywordMatch = (over: Partial<LetterSoundLinkChallenge> = {}): LetterSoundLinkChallenge => ({
  id: 'ch1', mode: 'keyword-match', targetLetter: 's', targetSound: '/s/',
  keywordWord: 'sun', keywordImage: 'sun',
  options: [{ sound: 'sun', isCorrect: true }, { sound: 'top', isCorrect: false }],
  ...over,
});

const makeData = (
  gradeLevel: string,
  challenges: LetterSoundLinkChallenge[],
  extra: Partial<LetterSoundLinkData> = {},
): LetterSoundLinkData => ({
  title: 'Letter Sounds',
  letterGroup: 1,
  cumulativeLetters: ['s', 'a', 't', 'i', 'p', 'n'],
  gradeLevel,
  challenges,
  ...extra,
});

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.includes(tag));

/** Tap the wrong bubble twice (audition, then commit) — one full wrong attempt. */
const missOnce = (wrongIndex = 1) => {
  fireEvent.click(screen.getAllByRole('button')[wrongIndex]);
  fireEvent.click(screen.getAllByRole('button')[wrongIndex]);
};

beforeEach(() => { sendText.mockClear(); aiOpts.last = null; });
afterEach(cleanup);

// ===========================================================================
// A. Defect fixes — pre-answer answer leaks in the tutor channel
// ===========================================================================

describe('answer-leak fixes (tier-independent)', () => {
  it('(a) [ACTIVITY_START] in see-hear names neither the sound nor the keyword, and fires no [SAY_KEYWORD]', () => {
    render(<LetterSoundLink data={makeData('1', [seeHear()])} />);
    const [msg] = tagged('[ACTIVITY_START]');
    expect(msg).toBeTruthy();
    expect(msg).not.toContain('[SAY_KEYWORD]');
    expect(msg).not.toContain('/s/');
    expect(msg).not.toContain('sun');
    // the on-screen stimulus (the letter) is still fair game
    expect(msg).toContain('"S"');
  });

  it('(a) [ACTIVITY_START] in hear-see never names the target letter (the letter IS the answer there)', () => {
    render(<LetterSoundLink data={makeData('1', [hearSee()])} />);
    const [msg] = tagged('[ACTIVITY_START]');
    expect(msg).toBeTruthy();
    expect(msg).not.toContain('"T"');
    expect(msg).not.toContain('[SAY_KEYWORD]');
  });

  it('(a) [ACTIVITY_START] in keyword-match names neither the keyword nor the sound', () => {
    render(<LetterSoundLink data={makeData('1', [keywordMatch()])} />);
    const [msg] = tagged('[ACTIVITY_START]');
    expect(msg).toBeTruthy();
    expect(msg).not.toContain('sun');
    expect(msg).not.toContain('/s/');
    expect(msg).not.toContain('[SAY_KEYWORD]');
  });

  it('(b) [NEXT_CHALLENGE] does not restate the next item\'s sound or keyword', () => {
    render(<LetterSoundLink data={makeData('1', [seeHear(), seeHear2()])} />);
    fireEvent.click(screen.getAllByRole('button')[0]);   // audition correct
    fireEvent.click(screen.getAllByRole('button')[0]);   // commit correct
    fireEvent.click(screen.getByRole('button', { name: /Next Challenge/ }));
    const [msg] = tagged('[NEXT_CHALLENGE]');
    expect(msg).toBeTruthy();
    expect(msg).not.toContain('/t/');
    expect(msg).not.toContain('top');
    expect(msg).not.toContain('[SAY_KEYWORD]');
  });

  it('(c) [ANSWER_INCORRECT] fires no [SAY_KEYWORD] in see-hear (the keyword encodes the answer)', () => {
    render(<LetterSoundLink data={makeData('1', [seeHear()])} />);
    missOnce();
    const [msg] = tagged('[ANSWER_INCORRECT]');
    expect(msg).toBeTruthy();
    expect(msg).not.toContain('[SAY_KEYWORD]');
    expect(msg).toContain('WITHOUT saying');
  });

  it('(c) [ANSWER_INCORRECT] fires no [SAY_KEYWORD] in keyword-match', () => {
    render(<LetterSoundLink data={makeData('1', [keywordMatch()])} />);
    missOnce();
    const [msg] = tagged('[ANSWER_INCORRECT]');
    expect(msg).toBeTruthy();
    expect(msg).not.toContain('[SAY_KEYWORD]');
  });

  it('(c) hear-see KEEPS the keyword anchor on a miss (there the sound is the given stimulus)', () => {
    render(<LetterSoundLink data={makeData('1', [hearSee()])} />);
    // hear-see buttons: [0] = the sound replay speaker, [1]/[2] = the letters.
    // It commits on a single tap (letters are visible), so tap the wrong letter.
    fireEvent.click(screen.getAllByRole('button')[2]);
    const [msg] = tagged('[ANSWER_INCORRECT]');
    expect(msg).toBeTruthy();
    expect(msg).toContain('[SAY_KEYWORD]');
    expect(msg).toContain('[PRONOUNCE_SOUND]');          // stimulus channel never withdrawn
  });
});

// ===========================================================================
// B1. Legacy default — a payload with no tier fields renders full help
// ===========================================================================

describe('legacy default (no tier fields present)', () => {
  it('renders the full-help see-hear card and defers the keyword anchor to the first miss', () => {
    render(<LetterSoundLink data={makeData('1', [seeHear()])} />);
    expect(screen.getByText('Which sound does this letter make?')).toBeTruthy();
    expect(screen.getByText(/Tap each speaker to hear the sound/)).toBeTruthy();
    expect(screen.queryByText(/Think of/)).toBeNull();     // not shown up front
    missOnce();
    expect(screen.getByText(/Think of/)).toBeTruthy();     // shown after a miss
    expect(aiOpts.last?.primitiveData).toMatchObject({ supportTier: '' });
  });

  it('renders the legacy keyword-match card and keeps the two-tap audition', () => {
    render(<LetterSoundLink data={makeData('1', [keywordMatch()])} />);
    expect(screen.getByText("Which word starts with this letter's sound?")).toBeTruthy();
    expect(screen.getByText(/Tap each picture to hear the word/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(tagged('[ANSWER_CORRECT]')).toHaveLength(0);    // first tap only auditions
  });

  it('keeps the legacy 3-attempt budget', () => {
    render(<LetterSoundLink data={makeData('1', [seeHear(), seeHear2()])} />);
    missOnce();
    missOnce();
    expect(screen.queryByText(/like in "sun"/)).toBeNull();  // not locked yet at 2
    missOnce();
    expect(screen.getByText(/like in "sun"/)).toBeTruthy();  // locks + reveals at 3
  });
});

// ===========================================================================
// B2. Hard tier — withdrawal stamps
// ===========================================================================

describe('hard tier (scaffold withdrawal)', () => {
  const hardSeeHear = () => makeData(
    '1',
    [seeHear({
      showKeywordAnchor: 'never', strategyHint: null, protocolHint: null,
      showSharedSoundHint: false, auditionBeforeCommit: true,
    }), seeHear2({
      showKeywordAnchor: 'never', strategyHint: null, protocolHint: null,
      showSharedSoundHint: false, auditionBeforeCommit: true,
    })],
    { supportTier: 'hard', maxAttempts: 2 },
  );

  it('withdraws the task cue and the protocol footer', () => {
    render(<LetterSoundLink data={hardSeeHear()} />);
    expect(screen.queryByText('Which sound does this letter make?')).toBeNull();
    expect(screen.queryByText(/Tap each speaker to hear the sound/)).toBeNull();
    // the stimulus and both options are untouched
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('never shows the keyword anchor — not even after a miss', () => {
    render(<LetterSoundLink data={hardSeeHear()} />);
    missOnce();
    expect(screen.queryByText(/Think of/)).toBeNull();
    expect(screen.queryByText('☀️')).toBeNull();
  });

  it('drops the attempt budget to 2 (locks + reveals one miss earlier)', () => {
    render(<LetterSoundLink data={hardSeeHear()} />);
    missOnce();
    expect(screen.queryByText(/like in "sun"/)).toBeNull();
    missOnce();
    expect(screen.getByText(/like in "sun"/)).toBeTruthy();
  });

  it('withdraws the hear-see shared-sound nudge', () => {
    const shared = hearSee({
      targetLetter: 'c', targetSound: '/k/', keywordWord: 'cat', keywordImage: 'cat',
      sharedSoundLetters: ['c', 'k'],
      options: [{ letter: 'c', isCorrect: true }, { letter: 'g', isCorrect: false }],
    });
    render(<LetterSoundLink data={makeData('1', [{ ...shared }])} />);
    expect(screen.getByText(/More than one letter might make this sound/)).toBeTruthy();
    cleanup();
    render(<LetterSoundLink data={makeData('1', [{ ...shared, showSharedSoundHint: false }])} />);
    expect(screen.queryByText(/More than one letter might make this sound/)).toBeNull();
  });

  it('threads supportTier to the tutor and carries a hard reveal policy', () => {
    render(<LetterSoundLink data={hardSeeHear()} />);
    expect(aiOpts.last?.primitiveData).toMatchObject({ supportTier: 'hard' });
    const [msg] = tagged('[ACTIVITY_START]');
    expect(msg).toContain('SUPPORT TIER hard');
    expect(msg).toContain('Reveal nothing');
  });

  it('keyword-match: the audition step is withdrawn — one tap commits', () => {
    render(<LetterSoundLink data={makeData(
      '1',
      [keywordMatch({ auditionBeforeCommit: false, strategyHint: null, protocolHint: null, showKeywordAnchor: 'never' })],
      { supportTier: 'hard', maxAttempts: 2 },
    )} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(tagged('[ANSWER_CORRECT]')).toHaveLength(1);
    // the word audio still plays — the on-demand audio channel is never withdrawn
    expect(tagged('[TAP_OPTION]')).toHaveLength(1);
  });

  it('see-hear NEVER loses its audition even if a payload asks for it (stimulus guard)', () => {
    render(<LetterSoundLink data={makeData(
      '1',
      [seeHear({ auditionBeforeCommit: false })],
      { supportTier: 'hard' },
    )} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(tagged('[TAP_OPTION]')).toHaveLength(1);
    expect(tagged('[ANSWER_CORRECT]')).toHaveLength(0);
  });
});

// ===========================================================================
// B3. Easy tier — proactive support
// ===========================================================================

describe('easy tier (proactive support)', () => {
  const easyData = () => makeData(
    '1',
    [seeHear({
      showKeywordAnchor: 'proactive',
      strategyHint: 'Look at the letter, then listen to BOTH bubbles before you pick.',
      protocolHint: 'Tap each speaker to hear the sound, then tap your answer again to choose it',
      showSharedSoundHint: true,
      auditionBeforeCommit: true,
    })],
    { supportTier: 'easy', maxAttempts: 3 },
  );

  it('shows the keyword anchor before the first attempt and the tier-authored cue', () => {
    render(<LetterSoundLink data={easyData()} />);
    expect(screen.getByText(/Think of/)).toBeTruthy();
    expect(screen.getByText('Look at the letter, then listen to BOTH bubbles before you pick.')).toBeTruthy();
    expect(screen.queryByText('Which sound does this letter make?')).toBeNull();
  });

  it('carries an easy reveal policy that still bars the answer dimension', () => {
    render(<LetterSoundLink data={easyData()} />);
    const [msg] = tagged('[ACTIVITY_START]');
    expect(msg).toContain('SUPPORT TIER easy');
    expect(msg).toContain('NEVER say the sound this letter makes');
  });
});

// ===========================================================================
// B4. Band supports win at K
// ===========================================================================

describe('K band supports always win', () => {
  it('keeps the two-tap audition at K even when the payload withdraws it', () => {
    render(<LetterSoundLink data={makeData(
      'K',
      [keywordMatch({ auditionBeforeCommit: false, showKeywordAnchor: 'never', strategyHint: null, protocolHint: null })],
      { supportTier: 'hard', maxAttempts: 2 },
    )} />);
    fireEvent.click(screen.getAllByRole('button')[0]);   // audition only
    expect(tagged('[TAP_OPTION]')).toHaveLength(1);
    expect(tagged('[ANSWER_CORRECT]')).toHaveLength(0);
    fireEvent.click(screen.getAllByRole('button')[0]);   // commit
    expect(tagged('[ANSWER_CORRECT]')).toHaveLength(1);
  });

  it('leaves the K wordless glyph protocol intact under a hard tier', () => {
    render(<LetterSoundLink data={makeData(
      'K',
      [seeHear({ showKeywordAnchor: 'never', strategyHint: null, protocolHint: null })],
      { supportTier: 'hard', maxAttempts: 2 },
    )} />);
    expect(screen.queryByText('tap to hear')).toBeNull();
    expect(screen.queryByText('tap to choose')).toBeNull();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
