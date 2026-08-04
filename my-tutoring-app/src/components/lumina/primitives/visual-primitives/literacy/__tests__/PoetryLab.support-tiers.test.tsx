// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for poetry-lab (analysis/composition).
 *
 * The tier is scaffold WITHDRAWAL only — it never changes the poem, the
 * options, the figurative set, the template constraints, or the checking:
 *   L1 figurative count disclosure  easy "(N to find)" + "Found: N / M"
 *                                   → medium "Found: N" only → hard no counts
 *   L2 rhyme-scheme live overlay    easy colored-letter preview
 *                                   → medium letters WITHOUT color → hard none
 *   L3 composition syllable chips   easy judged green/red N/M + placeholder
 *                                   targets → medium neutral live count (targets
 *                                   stay in the hint line) → hard no chips, no
 *                                   placeholder targets (hint line stays)
 *
 * F1 (rule-#1 leak, fixed at ALL tiers): the analysis review phase stays
 * NEUTRAL until submitAnalysis has run — no pre-submit emerald reveal.
 *
 * THE RULE ABOVE ALL: rhyme_hunt is a TIER NO-OP — the RhymeHunt fork never
 * reads supportTier; a stray supportTier on rhyme_hunt data changes nothing.
 *
 * Keep-trues asserted here: acrostic letter chips + composition prompt panel
 * (task identity), Back buttons (navigation), phase Next gates untouched.
 *
 * A payload with NO tier fields must render the legacy full-help UI unchanged.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { sendText, submitResult } = vi.hoisted(() => ({
  sendText: vi.fn(),
  submitResult: vi.fn(),
}));

vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

// Stateful evaluation mock: hasSubmitted flips on submitResult so the F1
// neutral-until-submit gate is exercisable.
vi.mock('../../../../evaluation', async () => {
  const { useState } = await import('react');
  return {
    usePrimitiveEvaluation: () => {
      const [hasSubmitted, setHasSubmitted] = useState(false);
      return {
        submitResult: (...args: unknown[]) => { submitResult(...args); setHasSubmitted(true); },
        hasSubmitted,
      };
    },
    useEvaluationContext: () => null,
  };
});

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import PoetryLab, { type PoetryLabData, type RhymeHuntRound } from '../PoetryLab';

type Tier = 'easy' | 'medium' | 'hard';

// ── Fixtures ────────────────────────────────────────────────────────────────

const POEM_LINES = [
  'The sun smiled down at me',
  'The day was bright and free',
  'A gentle wind did blow',
  'It made the flowers grow',
];
const POEM = POEM_LINES.join('\n');

const analysisData = (tier?: Tier): PoetryLabData => ({
  title: 'Poem Study',
  gradeLevel: '3',
  mode: 'analysis',
  ...(tier ? { supportTier: tier } : {}),
  poem: POEM,
  poemLines: POEM_LINES,
  correctMood: 'happy',
  moodOptions: ['happy', 'sad', 'angry'],
  figurativeInstances: [
    { text: 'sun smiled', startIndex: 4, endIndex: 14, type: 'personification' },
  ],
  rhymeScheme: 'AABB',
  rhymeSchemeOptions: ['AABB', 'ABAB', 'ABCB'],
});

/** No figurative instances → phases mood → rhyme → review (shortest F1 walk). */
const reviewData = (tier?: Tier): PoetryLabData => ({
  ...analysisData(tier),
  figurativeInstances: [],
});

const haikuData = (tier?: Tier): PoetryLabData => ({
  title: 'Write a Haiku',
  gradeLevel: '3',
  mode: 'composition',
  ...(tier ? { supportTier: tier } : {}),
  templateType: 'haiku',
  compositionPrompt: 'Write a haiku about the forest',
  templateConstraints: { lineCount: 3, syllablesPerLine: [5, 7, 5] },
});

const acrosticData = (tier?: Tier): PoetryLabData => ({
  title: 'Acrostic Time',
  gradeLevel: '4',
  mode: 'composition',
  ...(tier ? { supportTier: tier } : {}),
  templateType: 'acrostic',
  compositionPrompt: 'Write an acrostic poem about your pet',
  templateConstraints: { lineCount: 3, acrosticWord: 'CAT' },
});

const rounds: RhymeHuntRound[] = [
  { id: 'r1', type: 'rhyme_hunt', poemLines: ['Moon is bright', 'Cat has a hat', 'Stars glow at night', 'Hello little cat'], candidates: [{ word: 'bright', emoji: '☀️' }, { word: 'hat', emoji: '🎩' }, { word: 'night', emoji: '🌙' }, { word: 'cat', emoji: '🐱' }], rhymeWordA: 'hat', rhymeWordB: 'cat' },
  { id: 'r2', type: 'rhyme_hunt', poemLines: ['Duck in the sun', 'Frog on a log', 'Fox starts to run', 'Hello little frog'], candidates: [{ word: 'sun', emoji: '☀️' }, { word: 'log', emoji: '🪵' }, { word: 'run', emoji: '🏃' }, { word: 'frog', emoji: '🐸' }], rhymeWordA: 'log', rhymeWordB: 'frog' },
  { id: 'r3', type: 'rhyme_hunt', poemLines: ['Mouse sees a star', 'Bike takes a hike', 'Light shines from far', 'I like that bike'], candidates: [{ word: 'star', emoji: '⭐' }, { word: 'hike', emoji: '🥾' }, { word: 'far', emoji: '🌌' }, { word: 'bike', emoji: '🚲' }], rhymeWordA: 'hike', rhymeWordB: 'bike' },
];

const rhymeHuntData = (tier?: Tier): PoetryLabData => ({
  title: 'Rhyme Hunt',
  gradeLevel: 'K',
  mode: 'rhyme_hunt',
  ...(tier ? { supportTier: tier } : {}),
  rounds,
  instanceId: 'stable-rh-1',
});

// ── Navigation helpers ──────────────────────────────────────────────────────

const clickMoodAndAdvance = () => {
  fireEvent.click(screen.getByRole('button', { name: 'happy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Find Figurative Language' }));
};

const goToRhymePhase = () => {
  clickMoodAndAdvance();
  fireEvent.click(screen.getByText('sun smiled'));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Rhyme Scheme' }));
};

const goToReviewNoFig = () => {
  // reviewData walk: mood → rhyme → review
  fireEvent.click(screen.getByRole('button', { name: 'happy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Rhyme Scheme' }));
  fireEvent.click(screen.getByRole('button', { name: 'AABB' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
};

beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
afterEach(cleanup);

// ============================================================================
// Lever L1 — figurative count disclosure
// ============================================================================

describe('poetry-lab tier · L1: figurative count disclosure', () => {
  it.each([['legacy (no tier)', undefined], ['easy', 'easy' as Tier]])(
    '%s shows "(N to find)" and "Found: N / M" (full help)',
    (_label, tier) => {
      render(<PoetryLab data={analysisData(tier)} />);
      clickMoodAndAdvance();
      expect(screen.getByText('Tap the figurative language in the poem (1 to find):')).toBeTruthy();
      expect(screen.getByText('Found: 0 / 1')).toBeTruthy();
    },
  );

  it('medium drops the target count — instruction has no "(N to find)", running count only', () => {
    render(<PoetryLab data={analysisData('medium')} />);
    clickMoodAndAdvance();
    expect(screen.getByText('Tap the figurative language in the poem:')).toBeTruthy();
    expect(screen.queryByText(/to find/)).toBeNull();
    expect(screen.getByText('Found: 0')).toBeTruthy();
    expect(screen.queryByText(/Found: 0 \//)).toBeNull();
    // the running count is live
    fireEvent.click(screen.getByText('sun smiled'));
    expect(screen.getByText('Found: 1')).toBeTruthy();
  });

  it('hard shows no counts at all — the student decides when the hunt is done', () => {
    render(<PoetryLab data={analysisData('hard')} />);
    clickMoodAndAdvance();
    expect(screen.getByText('Tap the figurative language in the poem:')).toBeTruthy();
    expect(screen.queryByText(/to find/)).toBeNull();
    expect(screen.queryByText(/Found:/)).toBeNull();
  });

  it('hard keeps the Next gate on foundFigurative — no dead-end, no auto-advance', () => {
    render(<PoetryLab data={analysisData('hard')} />);
    clickMoodAndAdvance();
    const next = screen.getByRole('button', { name: 'Next: Rhyme Scheme' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByText('sun smiled'));
    expect(next.disabled).toBe(false);
  });

  it('hard keeps the Back button (navigation, not scaffolding)', () => {
    render(<PoetryLab data={analysisData('hard')} />);
    clickMoodAndAdvance();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });
});

// ============================================================================
// Lever L2 — rhyme-scheme live overlay
// ============================================================================

describe('poetry-lab tier · L2: rhyme-scheme live overlay', () => {
  it.each([['legacy (no tier)', undefined], ['easy', 'easy' as Tier]])(
    '%s paints the colored-letter preview on selection',
    (_label, tier) => {
      render(<PoetryLab data={analysisData(tier)} />);
      goToRhymePhase();
      fireEvent.click(screen.getByRole('button', { name: 'AABB' }));
      const aChips = screen.getAllByText('A');
      expect(aChips).toHaveLength(2);           // AABB over 4 lines → two A chips
      expect(screen.getAllByText('B')).toHaveLength(2);
      expect(aChips[0].className).toContain('text-blue-300');   // RHYME_COLORS.A
      expect(screen.getAllByText('B')[0].className).toContain('text-rose-300');
    },
  );

  it('medium keeps the letters but withdraws the color coding', () => {
    render(<PoetryLab data={analysisData('medium')} />);
    goToRhymePhase();
    fireEvent.click(screen.getByRole('button', { name: 'AABB' }));
    const aChips = screen.getAllByText('A');
    expect(aChips).toHaveLength(2);
    for (const chip of [...aChips, ...screen.getAllByText('B')]) {
      expect(chip.className).not.toContain('text-blue-300');
      expect(chip.className).not.toContain('text-rose-300');
      expect(chip.className).toContain('text-slate-300');
    }
  });

  it('hard renders no preview at all — bare poem, scheme chips judged blind', () => {
    render(<PoetryLab data={analysisData('hard')} />);
    goToRhymePhase();
    fireEvent.click(screen.getByRole('button', { name: 'AABB' }));
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('B')).toBeNull();
    // the poem surface itself is untouched
    expect(screen.getByText('The sun smiled down at me')).toBeTruthy();
    // and the option set is content — never trimmed by tier
    expect(screen.getByRole('button', { name: 'ABAB' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ABCB' })).toBeTruthy();
  });
});

// ============================================================================
// Lever L3 — composition syllable feedback
// ============================================================================

describe('poetry-lab tier · L3: composition syllable feedback', () => {
  it.each([['legacy (no tier)', undefined], ['easy', 'easy' as Tier]])(
    '%s shows judged N/M chips + placeholder targets + hint line',
    (_label, tier) => {
      render(<PoetryLab data={haikuData(tier)} />);
      expect(screen.getByPlaceholderText('Line 1 (5 syllables)...')).toBeTruthy();
      expect(screen.getAllByText('0/5')).toHaveLength(2);   // lines 1 & 3
      expect(screen.getByText('0/7')).toBeTruthy();
      expect(screen.getAllByText('0/5')[0].className).toContain('text-rose-300'); // judged
      expect(screen.getByText('Syllables per line: 5-7-5')).toBeTruthy();
    },
  );

  it('medium shows a neutral LIVE count only — no judgment, no placeholder targets, hint line stays', () => {
    render(<PoetryLab data={haikuData('medium')} />);
    expect(screen.getByPlaceholderText('Line 1...')).toBeTruthy();
    expect(screen.queryByText('0/5')).toBeNull();
    const chips = screen.getAllByText('0');
    expect(chips).toHaveLength(3);
    for (const chip of chips) {
      expect(chip.className).toContain('text-slate-300');
      expect(chip.className).not.toContain('text-emerald-300');
      expect(chip.className).not.toContain('text-rose-300');
    }
    // live: typing updates the neutral count
    fireEvent.change(screen.getByPlaceholderText('Line 1...'), { target: { value: 'hello world' } });
    expect(screen.getByText('3')).toBeTruthy();
    // targets stay stated in the hint line
    expect(screen.getByText('Syllables per line: 5-7-5')).toBeTruthy();
  });

  it('hard shows no chips and no placeholder targets — constraints stated once in the prompt panel', () => {
    render(<PoetryLab data={haikuData('hard')} />);
    expect(screen.getByPlaceholderText('Line 1...')).toBeTruthy();
    expect(screen.queryByText('0/5')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
    // keep-true: the constraint statement in the prompt panel survives
    expect(screen.getByText('Syllables per line: 5-7-5')).toBeTruthy();
    expect(screen.getByText('Write a haiku about the forest')).toBeTruthy();
  });

  it('hard NEVER withdraws acrostic letter chips or the prompt panel (task identity)', () => {
    render(<PoetryLab data={acrosticData('hard')} />);
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('T')).toBeTruthy();
    expect(screen.getByText('CAT')).toBeTruthy();               // acrostic word in prompt panel
    expect(screen.getByText('Write an acrostic poem about your pet')).toBeTruthy();
  });
});

// ============================================================================
// F1 — review phase neutral until submit (rule-#1 leak fix, ALL tiers)
// ============================================================================

describe('poetry-lab · F1: review reveals correctness only AFTER submit', () => {
  it.each([
    ['legacy (no tier)', undefined],
    ['easy', 'easy' as Tier],
    ['hard', 'hard' as Tier],
  ])('%s — correct picks stay neutral pre-submit, turn emerald post-submit', (_label, tier) => {
    render(<PoetryLab data={reviewData(tier)} />);
    goToReviewNoFig();

    // Pre-submit: both picks are CORRECT but must render neutral
    const mood = screen.getByText('happy');
    const rhyme = screen.getByText('AABB');
    expect(mood.className).toContain('text-slate-300');
    expect(mood.className).not.toContain('text-emerald-300');
    expect(rhyme.className).toContain('text-slate-300');
    expect(rhyme.className).not.toContain('text-emerald-300');
    // Edit path still available (navigation keep-true) — the leak is the color, not the button
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(submitResult).toHaveBeenCalledTimes(1);
    expect(screen.getByText('happy').className).toContain('text-emerald-300');
    expect(screen.getByText('AABB').className).toContain('text-emerald-300');
  });
});

// ============================================================================
// rhyme_hunt — TIER NO-OP (the fork never reads supportTier)
// ============================================================================

describe('poetry-lab tier · rhyme_hunt is a tier no-op', () => {
  it('a stray supportTier:"hard" on rhyme_hunt data renders IDENTICAL markup to no-tier data', () => {
    const { container: withTier } = render(<PoetryLab data={rhymeHuntData('hard')} />);
    const htmlWithTier = withTier.innerHTML;
    cleanup();
    const { container: withoutTier } = render(<PoetryLab data={rhymeHuntData()} />);
    expect(htmlWithTier).toBe(withoutTier.innerHTML);
  });

  it('rhyme_hunt keep-trues stand with a stray hard tier: 4 emoji candidates, poem panel, no chrome', () => {
    render(<PoetryLab data={rhymeHuntData('hard')} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);      // exactly the four candidates
    expect(screen.getByText('🐱')).toBeTruthy();                // picture answer surface
    expect(screen.getByText('Moon is bright')).toBeTruthy();    // on-screen poem twin
    expect(screen.queryByText(/Grade K/)).toBeNull();           // no adult chrome
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
