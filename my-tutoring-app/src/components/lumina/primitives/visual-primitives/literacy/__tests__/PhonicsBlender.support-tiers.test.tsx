// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for phonics-blender.
 *
 * The tier is scaffold WITHDRAWAL only — it never changes which words are drawn,
 * the patternType, the tile set, or the answer (contract R9). What it does change:
 *   #1 showBlendPreview   'full' ("c · a · t → cat") → 'word' → 'none'
 *   #2 showSlotCount      exact-phoneme-count "?" slots → ONE open drop zone
 *   #3 showTileLetters    the letters sub-label under /k/ on READER tiles (NO-OP at K)
 *   #4 nameTargetPhonemes the tutor enumerates the word's sounds when introducing it
 *
 * And what it may NEVER withdraw (band supports always win):
 *   R1 the Grade-K how-to-play protocol · R2 tap-to-hear phoneme/word audio ·
 *   R3 letter-primary K tiles · R4 the Check confirm, never auto-submit ·
 *   R6/R7 no distractor or extra tiles · R8 the word emoji ·
 *   plus the deterministic "Blend!" fallback.
 *
 * A payload with NO tier fields must render the legacy full-help UI unchanged —
 * that is the legacy-default guarantee the generator relies on.
 *
 * External hooks (live tutor, evaluation, audio, spoken judge) are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
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

vi.mock('../../../../hooks/useSpokenWordCapture', () => ({
  useSpokenWordCapture: () => ({
    state: 'idle', level: 0, isSupported: false,
    start: vi.fn(), cancel: vi.fn(),
  }),
}));

import PhonicsBlender, { type PhonicsBlenderData } from '../PhonicsBlender';

/** Base payload = what the generator emits with NO support tier (legacy full help). */
const makeData = (
  gradeLevel: string,
  tierFields: Partial<PhonicsBlenderData> = {},
): PhonicsBlenderData => ({
  title: 'Animal Sounds',
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
    {
      id: 'w2',
      targetWord: 'dog',
      emoji: '🐶',
      imageDescription: 'a friendly dog',
      phonemes: [
        { id: 'w2_p1', sound: '/d/', letters: 'd' },
        { id: 'w2_p2', sound: '/o/', letters: 'o' },
        { id: 'w2_p3', sound: '/g/', letters: 'g' },
      ],
    },
  ],
  ...tierFields,
});

/** Exactly what the generator stamps for each tier (mirrors resolveSupportScaffold). */
const EASY: Partial<PhonicsBlenderData> = {
  supportTier: 'easy',
  showBlendPreview: 'full',
  showSlotCount: true,
  showTileLetters: true,
  nameTargetPhonemes: true,
};
const MEDIUM: Partial<PhonicsBlenderData> = {
  supportTier: 'medium',
  showBlendPreview: 'word',
  showSlotCount: true,
  showTileLetters: true,
  nameTargetPhonemes: true,
};
const HARD: Partial<PhonicsBlenderData> = {
  supportTier: 'hard',
  showBlendPreview: 'none',
  showSlotCount: false,
  showTileLetters: false,
  nameTargetPhonemes: false,
};

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

const goToBuild = () =>
  fireEvent.click(screen.getByRole('button', { name: /Ready to Build/ }));

const checkButton = () =>
  screen.getByRole('button', { name: 'Check' }) as HTMLButtonElement;

// ============================================================================
// Lever #1 — showBlendPreview (listen-phase preview row)
// ============================================================================

describe('phonics-blender tier · lever 1: showBlendPreview', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('easy shows the full ordered chain "c · a · t → cat"', () => {
    render(<PhonicsBlender data={makeData('1', EASY)} />);
    expect(screen.getAllByText('·').length).toBe(2);   // 3 phonemes → 2 separators
    expect(screen.getByText('→')).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy();
  });

  it('medium drops the ordered letter chain but keeps the target word', () => {
    render(<PhonicsBlender data={makeData('1', MEDIUM)} />);
    expect(screen.queryByText('·')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
    expect(screen.getByText('cat')).toBeTruthy();
  });

  it('hard hides the preview row entirely — no chain, no word, no label', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    expect(screen.queryByText('·')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
    expect(screen.queryByText('cat')).toBeNull();
    expect(screen.queryByText('Blended together:')).toBeNull();
  });

  it('hard STILL keeps the two things the row is replaced by: emoji + tap-to-hear tiles', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    expect(screen.getByText('🐱')).toBeTruthy();                              // R8
    expect(screen.getByRole('button', { name: 'sound /k/' })).toBeTruthy();   // R2
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    expect(tagged('[PRONOUNCE_SOUND]')).toHaveLength(1);
  });
});

// ============================================================================
// Lever #2 — showSlotCount (build-area drop zones)
// ============================================================================

describe('phonics-blender tier · lever 2: showSlotCount', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('easy renders one "?" slot per phoneme (the count is a cue)', () => {
    render(<PhonicsBlender data={makeData('1', EASY)} />);
    goToBuild();
    expect(screen.getAllByText('?')).toHaveLength(3);
  });

  it('hard collapses them into a SINGLE open drop zone', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    goToBuild();
    expect(screen.getAllByText('?')).toHaveLength(1);
  });

  it('hard keeps the tile set exact — no distractor or extra tiles (R6/R7)', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    goToBuild();
    expect(screen.getAllByRole('button', { name: /^sound / })).toHaveLength(3);
  });

  it('hard keeps the Check confirm length-based: disabled until ALL sounds are placed (R4)', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    goToBuild();
    expect(checkButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    fireEvent.click(screen.getByRole('button', { name: 'sound /a/' }));
    expect(checkButton().disabled).toBe(true);   // 2 of 3 — no auto-submit, no early enable
    fireEvent.click(screen.getByRole('button', { name: 'sound /t/' }));
    expect(checkButton().disabled).toBe(false);
    // the open zone is consumed once everything is placed
    expect(screen.queryByText('?')).toBeNull();
  });
});

// ============================================================================
// Lever #3 — showTileLetters (reader tiles only)
// ============================================================================

describe('phonics-blender tier · lever 3: showTileLetters', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('easy keeps the letters sub-label under the /k/ notation', () => {
    render(<PhonicsBlender data={makeData('1', EASY)} />);
    const tile = screen.getByRole('button', { name: 'sound /k/' });
    expect(within(tile).getByText('/k/')).toBeTruthy();
    expect(within(tile).getByText('c')).toBeTruthy();
  });

  it('hard withdraws the letters sub-label but KEEPS the phoneme notation (the stimulus)', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    const tile = screen.getByRole('button', { name: 'sound /k/' });
    expect(within(tile).getByText('/k/')).toBeTruthy();
    expect(within(tile).queryByText('c')).toBeNull();
  });

  it('hard is a NO-OP at Kindergarten — tiles stay LETTER-primary (band support wins, R3)', () => {
    render(<PhonicsBlender data={makeData('K', HARD)} />);
    const tile = screen.getByRole('button', { name: 'sound /k/' });
    expect(within(tile).getByText('c')).toBeTruthy();   // the letter is still the face
    expect(within(tile).queryByText('/k/')).toBeNull(); // pre-readers never get slash notation
  });
});

// ============================================================================
// Lever #4 — nameTargetPhonemes (tutor instruction channel)
// ============================================================================

describe('phonics-blender tier · lever 4: nameTargetPhonemes', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('easy lets the tutor enumerate the sounds and carries the easy reveal policy', () => {
    render(<PhonicsBlender data={makeData('1', EASY)} />);
    const [start] = tagged('[ACTIVITY_START]');
    expect(start).toContain('(/k/, /a/, /t/)');
    expect(start).toContain('[SUPPORT_TIER easy]');
  });

  it('hard introduces the word WITHOUT its sounds or their count, and says so to the tutor', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    const [start] = tagged('[ACTIVITY_START]');
    expect(start).toContain('"cat"');
    expect(start).not.toContain('(/k/, /a/, /t/)');
    expect(start).not.toContain('3 sounds');
    expect(start).toContain('do NOT list its sounds');
    expect(start).toContain('[SUPPORT_TIER hard]');
  });

  it('hard withholds the sound list at [PHASE_TO_BUILD] but keeps the arrange-the-tiles protocol', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    goToBuild();
    const [build] = tagged('[PHASE_TO_BUILD]');
    expect(build).not.toContain('The sounds are:');
    expect(build).toContain('arrange the sound tiles in the right order');
  });

  it('hard withholds the sound list at [NEXT_WORD]', async () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    goToBuild();
    ['sound /k/', 'sound /a/', 'sound /t/'].forEach(n =>
      fireEvent.click(screen.getByRole('button', { name: n })),
    );
    fireEvent.click(checkButton());
    // build → blend runs behind a 1s celebration timer, then Blend! → Next Word
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Blend!' })).toBeTruthy(),
      { timeout: 3000 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Blend!' }));
    fireEvent.click(screen.getByRole('button', { name: /Next Word/ }));
    const [next] = tagged('[NEXT_WORD]');
    expect(next).toContain('"dog"');
    expect(next).not.toContain('/d/ + /o/ + /g/');
    expect(next).toContain('do NOT list its sounds');
  });

  it('hard stops [BUILD_INCORRECT] from handing the tutor the correct order', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    goToBuild();
    ['sound /t/', 'sound /a/', 'sound /k/'].forEach(n =>
      fireEvent.click(screen.getByRole('button', { name: n })),
    );
    fireEvent.click(checkButton());
    const [wrong] = tagged('[BUILD_INCORRECT]');
    expect(wrong).not.toContain('The correct order is');
    expect(wrong).toContain('Do NOT state the correct order');
    expect(wrong).toContain('level-1 hint style');
  });

  it('easy DOES hand the tutor the correct order at [BUILD_INCORRECT]', () => {
    render(<PhonicsBlender data={makeData('1', EASY)} />);
    goToBuild();
    ['sound /t/', 'sound /a/', 'sound /k/'].forEach(n =>
      fireEvent.click(screen.getByRole('button', { name: n })),
    );
    fireEvent.click(checkButton());
    expect(tagged('[BUILD_INCORRECT]')[0]).toContain('The correct order is: /k/ + /a/ + /t/');
  });
});

// ============================================================================
// Band supports compose with tiers and ALWAYS WIN (K + hard)
// ============================================================================

describe('phonics-blender tier · K band supports survive the hard tier', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('R1 — the Grade-K how-to-play protocol is explicitly NOT withdrawn', () => {
    render(<PhonicsBlender data={makeData('K', HARD)} />);
    const [start] = tagged('[ACTIVITY_START]');
    expect(start).toContain('Grade K');                       // K directive still triggers
    expect(start).toContain('how-to-play protocol is NOT withdrawn');
    expect(start).toContain('tap each sound tile to hear it');
  });

  it('R2/R8 — tap-to-hear audio and the word emoji survive at K + hard', () => {
    render(<PhonicsBlender data={makeData('K', HARD)} />);
    expect(screen.getByText('🐱')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'sound /a/' }));
    expect(tagged('[PRONOUNCE_SOUND]')).toHaveLength(1);
  });

  it('R4 — the Check confirm stays at K + hard (no auto-submit)', () => {
    render(<PhonicsBlender data={makeData('K', HARD)} />);
    goToBuild();
    expect(checkButton()).toBeTruthy();
    expect(checkButton().disabled).toBe(true);
  });

  it('the Blend! fallback is never tier-gated', async () => {
    render(<PhonicsBlender data={makeData('K', HARD)} />);
    goToBuild();
    ['sound /k/', 'sound /a/', 'sound /t/'].forEach(n =>
      fireEvent.click(screen.getByRole('button', { name: n })),
    );
    fireEvent.click(checkButton());
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Blend!' })).toBeTruthy(),
      { timeout: 3000 },
    );
  });
});

// ============================================================================
// LEGACY DEFAULT — a payload with no tier fields renders full help, unchanged
// ============================================================================

describe('phonics-blender tier · legacy default (no tier fields at all)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('renders the full-help listen phase identically to easy', () => {
    render(<PhonicsBlender data={makeData('1')} />);
    expect(screen.getAllByText('·').length).toBe(2);
    expect(screen.getByText('→')).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('Blended together:')).toBeTruthy();
    const tile = screen.getByRole('button', { name: 'sound /k/' });
    expect(within(tile).getByText('c')).toBeTruthy();
  });

  it('renders per-phoneme "?" slots and the full tutor intro, with NO tier policy line', () => {
    render(<PhonicsBlender data={makeData('1')} />);
    const [start] = tagged('[ACTIVITY_START]');
    expect(start).toContain('which has 3 sounds (/k/, /a/, /t/)');
    expect(start).not.toContain('[SUPPORT_TIER');
    goToBuild();
    expect(screen.getAllByText('?')).toHaveLength(3);
    expect(tagged('[PHASE_TO_BUILD]')[0]).toContain('The sounds are: /k/, /a/, /t/.');
  });

  it('a partial payload (supportTier alone, no scaffold fields) still renders full help', () => {
    // Defensive: fields are read with `!== false` / `?? legacy`, never truthiness.
    render(<PhonicsBlender data={makeData('1', { supportTier: 'hard' })} />);
    expect(screen.getAllByText('·').length).toBe(2);
    goToBuild();
    expect(screen.getAllByText('?')).toHaveLength(3);
  });
});
