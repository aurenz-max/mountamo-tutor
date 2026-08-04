// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for spelling-pattern-explorer.
 *
 * The tier is 100% component display withdrawal — the generator stamps
 * `supportTier` and the content (patternWords, dictationWords, rule) is
 * byte-identical across tiers. Levers:
 *   L1 pattern-reveal panel      shown (easy/legacy) → HIDDEN (medium/hard)
 *   L2 word-tile highlights      all → first 3 worked examples → none
 *   L3 ruleTemplate display      shown → shown → HIDDEN
 *   L4 live correct-glow         live → live → NEUTRAL until Review
 *   L5 "show" reveal button      available → available → HIDDEN
 *
 * Absolute keep-trues asserted here:
 *   - The per-word hint button is the ONLY stimulus identifying which word to
 *     spell (no TTS exists) — it is NEVER tier-gated, at any tier.
 *   - The "What pattern do they share?" prompt renders at every tier.
 *   - A payload with NO supportTier renders the legacy full-help UI unchanged.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
  }),
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import SpellingPatternExplorer, {
  type SpellingPatternExplorerData,
} from '../SpellingPatternExplorer';

const RULE_TEMPLATE = 'When a word ends in -ake, the a says ___';

/** Base payload = what the generator emits with NO support tier (legacy full help). */
const makeData = (
  tierFields: Partial<SpellingPatternExplorerData> = {},
): SpellingPatternExplorerData => ({
  title: 'Magic E Lab',
  gradeLevel: '2',
  patternType: 'long-vowel',
  patternWords: ['cake', 'lake', 'bake', 'make', 'take', 'rake'],
  highlightPattern: 'ake',
  ruleTemplate: RULE_TEMPLATE,
  correctRule: 'The silent e makes the a say its long name.',
  dictationWords: ['snake', 'flake', 'brake', 'shake'],
  dictationHints: [
    'a slithering reptile',
    'one bit of falling snow',
    'it stops the car',
    'wiggle quickly side to side',
  ],
  ...tierFields,
});

/** Count of highlighted-pattern spans: each highlighted word tile renders a span
 *  whose exact text is the pattern substring ('ake'); the reveal panel adds one more. */
const highlightedSpanCount = () => screen.queryAllByText('ake').length;

const toRulePhase = () =>
  fireEvent.click(screen.getByRole('button', { name: /I see the pattern/ }));

const toApplyPhase = () => {
  toRulePhase();
  fireEvent.change(
    screen.getByPlaceholderText('Write the spelling rule in your own words...'),
    { target: { value: 'The silent e makes the vowel say its name.' } },
  );
  fireEvent.click(screen.getByRole('button', { name: /Next: Apply the Rule/ }));
};

const dictationInputs = () =>
  screen.getAllByPlaceholderText('Type the word...') as HTMLInputElement[];

const typeSpelling = (index: number, value: string) => {
  fireEvent.change(dictationInputs()[index], { target: { value } });
};

// ============================================================================
// L1 + L2 — observe phase: pattern-reveal panel + word-tile highlights
// ============================================================================

describe('spelling-pattern-explorer tier · L1 panel + L2 highlights (observe)', () => {
  afterEach(cleanup);

  it('legacy (no tier) shows the reveal panel and highlights every word', () => {
    render(<SpellingPatternExplorer data={makeData()} />);
    expect(screen.getByText(/^Pattern:/)).toBeTruthy();
    // 6 highlighted word tiles + 1 panel span, all exactly "ake"
    expect(highlightedSpanCount()).toBe(7);
  });

  it('easy renders byte-identical to legacy (panel + all highlights)', () => {
    render(<SpellingPatternExplorer data={makeData({ supportTier: 'easy' })} />);
    expect(screen.getByText(/^Pattern:/)).toBeTruthy();
    expect(highlightedSpanCount()).toBe(7);
  });

  it('medium HIDES the reveal panel and keeps only the first 3 worked-example highlights', () => {
    render(<SpellingPatternExplorer data={makeData({ supportTier: 'medium' })} />);
    expect(screen.queryByText(/^Pattern:/)).toBeNull();
    expect(highlightedSpanCount()).toBe(3);
    // words 3-5 render PLAIN (whole-word text nodes — no highlight split)
    for (const w of ['make', 'take', 'rake']) {
      expect(screen.getByText(w)).toBeTruthy();
    }
    // words 0-2 are the worked examples: still on screen, split around the highlight
    for (const prefix of ['c', 'l', 'b']) {
      expect(screen.getByText(prefix)).toBeTruthy();
    }
  });

  it('hard HIDES the panel and every highlight — the student induces the pattern', () => {
    render(<SpellingPatternExplorer data={makeData({ supportTier: 'hard' })} />);
    expect(screen.queryByText(/^Pattern:/)).toBeNull();
    expect(highlightedSpanCount()).toBe(0);
    for (const w of ['cake', 'lake', 'bake', 'make', 'take', 'rake']) {
      expect(screen.getByText(w)).toBeTruthy();
    }
  });

  it('keep-true: the "What pattern do they share?" prompt renders at EVERY tier', () => {
    for (const tier of [undefined, 'easy', 'medium', 'hard'] as const) {
      cleanup();
      render(<SpellingPatternExplorer data={makeData(tier ? { supportTier: tier } : {})} />);
      expect(
        screen.getByText('Look at these words. What pattern do they share?'),
      ).toBeTruthy();
    }
  });
});

// ============================================================================
// L3 — rule phase: ruleTemplate visibility
// ============================================================================

describe('spelling-pattern-explorer tier · L3 ruleTemplate (rule phase)', () => {
  afterEach(cleanup);

  it('legacy shows the fill-in-the-blank template', () => {
    render(<SpellingPatternExplorer data={makeData()} />);
    toRulePhase();
    expect(screen.getByText(RULE_TEMPLATE)).toBeTruthy();
  });

  it('easy and medium show the template', () => {
    for (const tier of ['easy', 'medium'] as const) {
      cleanup();
      render(<SpellingPatternExplorer data={makeData({ supportTier: tier })} />);
      toRulePhase();
      expect(screen.getByText(RULE_TEMPLATE), tier).toBeTruthy();
    }
  });

  it('hard HIDES the template — the student states the rule unaided', () => {
    render(<SpellingPatternExplorer data={makeData({ supportTier: 'hard' })} />);
    toRulePhase();
    expect(screen.queryByText(RULE_TEMPLATE)).toBeNull();
    // the textarea (the task surface) is still there
    expect(
      screen.getByPlaceholderText('Write the spelling rule in your own words...'),
    ).toBeTruthy();
  });
});

// ============================================================================
// L4 — apply phase: live correct-glow suppression
// ============================================================================

describe('spelling-pattern-explorer tier · L4 live correct-glow (apply phase)', () => {
  afterEach(cleanup);

  it('legacy glows emerald the moment the spelling matches', () => {
    render(<SpellingPatternExplorer data={makeData()} />);
    toApplyPhase();
    typeSpelling(0, 'snake');
    expect(dictationInputs()[0].className).toContain('bg-emerald-500/5');
  });

  it('easy and medium keep the live glow', () => {
    for (const tier of ['easy', 'medium'] as const) {
      cleanup();
      render(<SpellingPatternExplorer data={makeData({ supportTier: tier })} />);
      toApplyPhase();
      typeSpelling(0, 'snake');
      expect(dictationInputs()[0].className, tier).toContain('bg-emerald-500/5');
    }
  });

  it('hard stays NEUTRAL on a correct spelling — no live answer signal', () => {
    render(<SpellingPatternExplorer data={makeData({ supportTier: 'hard' })} />);
    toApplyPhase();
    typeSpelling(0, 'snake');
    expect(dictationInputs()[0].className).not.toContain('bg-emerald-500/5');
    expect(dictationInputs()[0].className).toContain('bg-white/5');
  });
});

// ============================================================================
// L5 — apply phase: "show" reveal availability
// ============================================================================

describe('spelling-pattern-explorer tier · L5 "show" reveal button (apply phase)', () => {
  afterEach(cleanup);

  it('legacy offers "show" on a wrong spelling', () => {
    render(<SpellingPatternExplorer data={makeData()} />);
    toApplyPhase();
    typeSpelling(0, 'snak');
    expect(screen.getByRole('button', { name: 'show' })).toBeTruthy();
  });

  it('easy and medium keep the "show" reveal', () => {
    for (const tier of ['easy', 'medium'] as const) {
      cleanup();
      render(<SpellingPatternExplorer data={makeData({ supportTier: tier })} />);
      toApplyPhase();
      typeSpelling(0, 'snak');
      expect(screen.getByRole('button', { name: 'show' }), tier).toBeTruthy();
    }
  });

  it('hard HIDES "show" — a stuck student still has the hint channel', () => {
    render(<SpellingPatternExplorer data={makeData({ supportTier: 'hard' })} />);
    toApplyPhase();
    typeSpelling(0, 'snak');
    expect(screen.queryByRole('button', { name: 'show' })).toBeNull();
    // the hint (the word-identification stimulus) is still offered
    expect(screen.getAllByRole('button', { name: 'hint' }).length).toBeGreaterThan(0);
  });
});

// ============================================================================
// KEEP-TRUE — the per-word hint button is NEVER tier-gated (it is the stimulus)
// ============================================================================

describe('spelling-pattern-explorer tier · hint button is the stimulus, never withdrawn', () => {
  afterEach(cleanup);

  it('renders one hint button per dictation word at EVERY tier, and hints still open', () => {
    for (const tier of [undefined, 'easy', 'medium', 'hard'] as const) {
      cleanup();
      render(<SpellingPatternExplorer data={makeData(tier ? { supportTier: tier } : {})} />);
      toApplyPhase();
      const hints = screen.getAllByRole('button', { name: 'hint' });
      expect(hints.length, String(tier)).toBe(4);
      fireEvent.click(hints[0]);
      expect(screen.getByText('a slithering reptile'), String(tier)).toBeTruthy();
    }
  });
});

// ============================================================================
// LEGACY DEFAULT — absent supportTier renders full help identical to easy
// ============================================================================

describe('spelling-pattern-explorer tier · legacy default (no supportTier field)', () => {
  afterEach(cleanup);

  it('renders every full-support surface: panel, all highlights, template, glow, show', () => {
    render(<SpellingPatternExplorer data={makeData()} />);
    // observe: panel + all 6 highlights
    expect(screen.getByText(/^Pattern:/)).toBeTruthy();
    expect(highlightedSpanCount()).toBe(7);
    // rule: template shown
    toRulePhase();
    expect(screen.getByText(RULE_TEMPLATE)).toBeTruthy();
    // apply: live glow + show button + hints
    fireEvent.change(
      screen.getByPlaceholderText('Write the spelling rule in your own words...'),
      { target: { value: 'silent e says the name' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /Next: Apply the Rule/ }));
    typeSpelling(0, 'snake');
    expect(dictationInputs()[0].className).toContain('bg-emerald-500/5');
    typeSpelling(1, 'flak');
    expect(screen.getByRole('button', { name: 'show' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'hint' }).length).toBe(4); // one per dictation word
  });
});
