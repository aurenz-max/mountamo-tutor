// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for opinion-builder.
 *
 * The tier is DISPLAY withdrawal only — it never changes the framework, the
 * prompt, the scaffold arrays, reasonCount, counterArgumentEnabled, or scoring.
 * What it does change:
 *   L1 starter chips       easy = all phases (legacy) → medium = CLAIM phase only
 *                          → hard = no chips anywhere
 *   L2 linking palette     easy = palette + live green usage highlight (legacy)
 *                          → medium = palette shown, highlight OFF → hard = hidden
 *   L3 placeholders        easy = exact legacy instructional strings (incl. the
 *                          counter worked frame) → medium = generic non-modeling
 *                          prompts → hard = neutral short prompts
 *
 * Scoring keep-true: countLinkingWords scans the TEXT, never the palette render,
 * so a typed linking word still credits at hard (palette hidden).
 *
 * A payload with NO tier field must render the legacy full-help UI unchanged —
 * that is the legacy-default guarantee the generator relies on.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const submitResult = vi.hoisted(() => vi.fn());
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult,
    hasSubmitted: false,
  }),
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import OpinionBuilder, { type OpinionBuilderData } from '../OpinionBuilder';

// ============================================================================
// Fixtures — deterministic scaffold; oreo = 4 phases, cer = 5 (counter enabled)
// ============================================================================

const makeData = (
  framework: 'oreo' | 'cer',
  tierFields: Partial<OpinionBuilderData> = {},
): OpinionBuilderData => ({
  title: 'Should school be year-round?',
  gradeLevel: framework === 'oreo' ? '3' : '5',
  framework,
  prompt: 'Should students go to school all year round?',
  scaffold: {
    claimLabel: framework === 'oreo' ? 'Opinion' : 'Claim',
    claimStarters: ['I think that', 'In my opinion'],
    reasonLabel: framework === 'oreo' ? 'Reasons' : 'Evidence',
    reasonStarters: ['One reason is', 'Another reason is'],
    reasonCount: 2,
    conclusionLabel: framework === 'oreo' ? 'Restate Opinion' : 'Conclusion',
    conclusionStarters: ['In conclusion'],
    linkingWords: ['because', 'therefore', 'also'],
    counterArgumentEnabled: framework === 'cer',
    ...(framework === 'cer' ? { counterArgumentStarters: ['Some might say'] } : {}),
  },
  ...tierFields,
});

const EASY: Partial<OpinionBuilderData> = { supportTier: 'easy' };
const MEDIUM: Partial<OpinionBuilderData> = { supportTier: 'medium' };
const HARD: Partial<OpinionBuilderData> = { supportTier: 'hard' };

// Chip accessible names (renderStarters appends "..." to each starter)
const CHIP = {
  claim: 'I think that...',
  reason: 'One reason is...',
  counter: 'Some might say...',
  conclusion: 'In conclusion...',
};

const typeInto = (el: Element, value: string) =>
  fireEvent.change(el, { target: { value } });
const clickBtn = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }));
// A chip can repeat (reason starters render once per reason textarea) — count, don't get.
const hasChip = (name: string) => screen.queryAllByRole('button', { name }).length > 0;
const paletteVisible = () => !!screen.queryByText('Linking words:');

interface WalkSnapshot {
  chips: { claim: boolean; reasons: boolean; counter?: boolean; conclusion: boolean };
  placeholders: { claim: string; reason: string; counter?: string; conclusion: string };
  paletteAtReasons: boolean;
  paletteAtReview: boolean;
}

/** Drive claim → reasons → (counter) → conclusion → review, typing fixed text
 *  (exactly ONE linking word — "because" — inside reason 1), capturing what
 *  each phase showed. Content typed is identical across tiers. */
const walkToReview = (fw: 'oreo' | 'cer'): WalkSnapshot => {
  const snap: WalkSnapshot = {
    chips: { claim: false, reasons: false, conclusion: false },
    placeholders: { claim: '', reason: '', conclusion: '' },
    paletteAtReasons: false,
    paletteAtReview: false,
  };
  // claim
  snap.chips.claim = hasChip(CHIP.claim);
  snap.placeholders.claim = (screen.getByRole('textbox') as HTMLTextAreaElement).placeholder;
  typeInto(screen.getByRole('textbox'), 'Dogs are the best pets.');
  clickBtn(/^Next: /);
  // reasons (reasonCount = 2)
  snap.chips.reasons = hasChip(CHIP.reason);
  snap.paletteAtReasons = paletteVisible();
  const reasons = screen.getAllByRole('textbox');
  snap.placeholders.reason = (reasons[0] as HTMLTextAreaElement).placeholder;
  typeInto(reasons[0], 'They are loyal because they love you.');
  typeInto(reasons[1], 'They keep people active.');
  clickBtn('Next');
  // counter (cer only)
  if (fw === 'cer') {
    snap.chips.counter = hasChip(CHIP.counter);
    snap.placeholders.counter = (screen.getByRole('textbox') as HTMLTextAreaElement).placeholder;
    typeInto(screen.getByRole('textbox'), 'Cats may be easier to care for.');
    clickBtn('Next');
  }
  // conclusion
  snap.chips.conclusion = hasChip(CHIP.conclusion);
  snap.placeholders.conclusion = (screen.getByRole('textbox') as HTMLTextAreaElement).placeholder;
  typeInto(screen.getByRole('textbox'), 'Clearly dogs make the finest pets.');
  clickBtn('Review');
  // review
  snap.paletteAtReview = paletteVisible();
  return snap;
};

// ============================================================================
// Lever L1 — starter chips per phase
// ============================================================================

describe('opinion-builder tier · L1: starter chips', () => {
  beforeEach(() => submitResult.mockClear());
  afterEach(cleanup);

  it('easy shows chips on EVERY phase (claim, reasons, counter, conclusion)', () => {
    render(<OpinionBuilder data={makeData('cer', EASY)} />);
    const snap = walkToReview('cer');
    expect(snap.chips).toEqual({ claim: true, reasons: true, counter: true, conclusion: true });
  });

  it('medium shows chips on the CLAIM phase only', () => {
    render(<OpinionBuilder data={makeData('cer', MEDIUM)} />);
    const snap = walkToReview('cer');
    expect(snap.chips).toEqual({ claim: true, reasons: false, counter: false, conclusion: false });
  });

  it('hard shows no chips anywhere', () => {
    render(<OpinionBuilder data={makeData('cer', HARD)} />);
    const snap = walkToReview('cer');
    expect(snap.chips).toEqual({ claim: false, reasons: false, counter: false, conclusion: false });
  });
});

// ============================================================================
// Lever L2 — linking-words palette visibility + live usage highlight
// ============================================================================

describe('opinion-builder tier · L2: linking-words palette', () => {
  beforeEach(() => submitResult.mockClear());
  afterEach(cleanup);

  it('easy shows the palette and lights the typed word green after Finish', () => {
    render(<OpinionBuilder data={makeData('oreo', EASY)} />);
    const snap = walkToReview('oreo');
    expect(snap.paletteAtReasons).toBe(true);
    expect(snap.paletteAtReview).toBe(true);
    clickBtn('Finish'); // countLinkingWords() populates usedLinkingWords
    expect(screen.getByText('because').className).toContain('emerald');
  });

  it('medium keeps the palette but the usage highlight stays OFF', () => {
    render(<OpinionBuilder data={makeData('oreo', MEDIUM)} />);
    const snap = walkToReview('oreo');
    expect(snap.paletteAtReasons).toBe(true);
    expect(snap.paletteAtReview).toBe(true);
    clickBtn('Finish');
    expect(screen.getByText('because').className).not.toContain('emerald');
    expect(screen.getByText('therefore').className).not.toContain('emerald');
  });

  it('hard hides the palette on the reasons AND review phases', () => {
    render(<OpinionBuilder data={makeData('oreo', HARD)} />);
    const snap = walkToReview('oreo');
    expect(snap.paletteAtReasons).toBe(false);
    expect(snap.paletteAtReview).toBe(false);
  });
});

// ============================================================================
// Lever L3 — textarea placeholders per tier
// ============================================================================

describe('opinion-builder tier · L3: placeholders', () => {
  beforeEach(() => submitResult.mockClear());
  afterEach(cleanup);

  it('easy keeps the exact legacy strings, including the counter worked frame', () => {
    render(<OpinionBuilder data={makeData('cer', EASY)} />);
    const snap = walkToReview('cer');
    expect(snap.placeholders).toEqual({
      claim: 'State your claim...',
      reason: 'Provide evidence...',
      counter: 'Some people might say... However, I believe...',
      conclusion: 'Restate your opinion/claim in a new way...',
    });
  });

  it('medium swaps in generic NON-modeling prompts (no worked frame)', () => {
    render(<OpinionBuilder data={makeData('cer', MEDIUM)} />);
    const snap = walkToReview('cer');
    expect(snap.placeholders).toEqual({
      claim: 'Take a clear position on the prompt.',
      reason: 'Give one piece of evidence for your claim.',
      counter: 'Address the other side of the argument.',
      conclusion: 'Bring your argument to a close.',
    });
  });

  it('hard uses neutral short prompts — and the 348 counter worked frame is GONE', () => {
    render(<OpinionBuilder data={makeData('cer', HARD)} />);
    const snap = walkToReview('cer');
    expect(snap.placeholders).toEqual({
      claim: 'Write your claim.',
      reason: 'Write your evidence.',
      counter: 'Write your counter-argument.',
      conclusion: 'Write your conclusion.',
    });
    expect(snap.placeholders.counter).not.toBe('Some people might say... However, I believe...');
  });

  it('hard is framework-aware for oreo (opinion/reason wording)', () => {
    render(<OpinionBuilder data={makeData('oreo', HARD)} />);
    const snap = walkToReview('oreo');
    expect(snap.placeholders.claim).toBe('Write your opinion.');
    expect(snap.placeholders.reason).toBe('Write your reason.');
  });
});

// ============================================================================
// Scoring keep-true — typed linking word still credits with the palette hidden
// ============================================================================

describe('opinion-builder tier · scoring: linking words scan TEXT, not the palette', () => {
  beforeEach(() => submitResult.mockClear());
  afterEach(cleanup);

  it('hard: "because" typed into a reason credits linkingWordsUsed despite no palette', () => {
    render(<OpinionBuilder data={makeData('oreo', HARD)} />);
    const snap = walkToReview('oreo');
    expect(snap.paletteAtReasons).toBe(false); // discoverability withdrawn...
    clickBtn('Finish');
    expect(submitResult).toHaveBeenCalledTimes(1);
    const [success, score, metrics] = submitResult.mock.calls[0];
    expect(metrics.linkingWordsUsed).toBe(1);  // ...but the typed word still counts
    expect(success).toBe(true);
    expect(score).toBeGreaterThanOrEqual(50);
  });
});

// ============================================================================
// LEGACY DEFAULT — a payload with no tier field renders full help, unchanged
// ============================================================================

describe('opinion-builder tier · legacy default (no supportTier field)', () => {
  beforeEach(() => submitResult.mockClear());
  afterEach(cleanup);

  it('renders chips on every phase, palette + live highlight, exact legacy placeholders', () => {
    render(<OpinionBuilder data={makeData('cer')} />);
    const snap = walkToReview('cer');
    expect(snap.chips).toEqual({ claim: true, reasons: true, counter: true, conclusion: true });
    expect(snap.paletteAtReasons).toBe(true);
    expect(snap.paletteAtReview).toBe(true);
    expect(snap.placeholders).toEqual({
      claim: 'State your claim...',
      reason: 'Provide evidence...',
      counter: 'Some people might say... However, I believe...',
      conclusion: 'Restate your opinion/claim in a new way...',
    });
    clickBtn('Finish');
    expect(screen.getByText('because').className).toContain('emerald');
  });

  it('legacy oreo placeholders stay framework-aware (opinion / reason wording)', () => {
    render(<OpinionBuilder data={makeData('oreo')} />);
    const snap = walkToReview('oreo');
    expect(snap.placeholders.claim).toBe('State your opinion...');
    expect(snap.placeholders.reason).toBe('Give a reason...');
  });
});
