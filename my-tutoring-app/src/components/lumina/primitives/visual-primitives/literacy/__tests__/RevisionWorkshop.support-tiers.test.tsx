// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for revision-workshop.
 *
 * The tier is scaffold WITHDRAWAL only — it never changes the draft, the
 * targets, the suggestions data, the alternatives chips, or the checker.
 * Levers under test:
 *   L1 per-target suggestion: easy/absent visible → medium tap-to-reveal
 *      "Show hint" → hard hidden entirely
 *   L2 read-phase dashed skill-colored highlights: kept at easy/medium →
 *      plain draft at hard (student locates the weak spots)
 *   L3 focus-count line: exact "N areas to improve" at easy/medium → count
 *      omitted at hard ("Look for areas to improve.")
 *
 * In-slice defect fixes under test (reorganize mode, ALL tiers):
 *   F1 sentenceOrder never initializes to the identity permutation (identity
 *      IS the answer key — the checker scores origIdx === pos)
 *   F2 the "Ideal Order" panel (the answer) renders only AFTER submit
 *
 * Keep-trues: word-choice alternatives chips are NEVER removed; the
 * original-text strikethrough framing stays; absent tier = byte-identical
 * legacy full-support render.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const evalState = vi.hoisted(() => ({
  hasSubmitted: false,
  submitResult: vi.fn(),
}));

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: evalState.submitResult,
    hasSubmitted: evalState.hasSubmitted,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import RevisionWorkshop, { type RevisionWorkshopData } from '../RevisionWorkshop';

// ---------------------------------------------------------------------------
// Fixtures — exactly what the generator emits (content identical at all tiers)
// ---------------------------------------------------------------------------

/** Non-reorganize payload (word-choice): 3 targets, one with alternatives chips. */
const makeStandardData = (
  tierFields: Partial<RevisionWorkshopData> = {},
): RevisionWorkshopData => ({
  title: 'Better Sentences',
  gradeLevel: '3',
  revisionSkill: 'word-choice',
  draft: 'The dog is big. The park was nice. We had a good time.',
  targets: [
    {
      targetId: 't1', originalText: 'big',
      suggestion: 'Hint one: try a size word with more punch.',
      alternatives: ['enormous', 'gigantic', 'massive'],
      idealRevision: 'enormous',
    },
    {
      targetId: 't2', originalText: 'nice',
      suggestion: 'Hint two: paint a picture of the park.',
      idealRevision: 'sun-dappled',
    },
    {
      targetId: 't3', originalText: 'good',
      suggestion: 'Hint three: how did it feel?',
      idealRevision: 'joyful',
    },
  ],
  ...tierFields,
});

/** Reorganize payload: targets arrive in the CORRECT order (generator contract). */
const makeReorganizeData = (
  tierFields: Partial<RevisionWorkshopData> = {},
): RevisionWorkshopData => ({
  title: 'Order the Story',
  gradeLevel: '5',
  revisionSkill: 'reorganize',
  draft: 'SENT-C SENT-A SENT-D SENT-B',
  targets: [
    { targetId: 'r1', originalText: 'SENT-A', suggestion: 'This is the topic sentence.', idealRevision: 'SENT-A' },
    { targetId: 'r2', originalText: 'SENT-B', suggestion: 'This happens second.', idealRevision: 'SENT-B' },
    { targetId: 'r3', originalText: 'SENT-C', suggestion: 'This happens third.', idealRevision: 'SENT-C' },
    { targetId: 'r4', originalText: 'SENT-D', suggestion: 'This wraps it up.', idealRevision: 'SENT-D' },
  ],
  ...tierFields,
});

const startRevising = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Start Revising' }));
const goToCompare = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

/** Deterministic PRNG for the F1 seeded-mount loop. */
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

beforeEach(() => {
  evalState.hasSubmitted = false;
  evalState.submitResult.mockClear();
});
afterEach(cleanup);

// ============================================================================
// L1 — per-target suggestion visibility
// ============================================================================

describe('revision-workshop tier · L1: suggestion visibility', () => {
  it('easy renders every suggestion, with no Show hint toggle', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'easy' })} />);
    startRevising();
    expect(screen.getByText('Hint one: try a size word with more punch.')).toBeTruthy();
    expect(screen.getByText('Hint two: paint a picture of the park.')).toBeTruthy();
    expect(screen.getByText('Hint three: how did it feel?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show hint' })).toBeNull();
  });

  it('medium hides suggestions behind a per-target Show hint toggle', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'medium' })} />);
    startRevising();
    expect(screen.queryByText('Hint one: try a size word with more punch.')).toBeNull();
    expect(screen.queryByText('Hint two: paint a picture of the park.')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Show hint' })).toHaveLength(3);
  });

  it('medium reveals ONLY the tapped target\'s suggestion', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'medium' })} />);
    startRevising();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show hint' })[0]);
    expect(screen.getByText('Hint one: try a size word with more punch.')).toBeTruthy();
    expect(screen.queryByText('Hint two: paint a picture of the park.')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Show hint' })).toHaveLength(2);
  });

  it('hard hides suggestions entirely — no text, no toggle', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'hard' })} />);
    startRevising();
    expect(screen.queryByText(/Hint one|Hint two|Hint three/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show hint' })).toBeNull();
  });

  it('hard KEEPS the word-choice alternatives chips (answer form never changes)', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'hard' })} />);
    startRevising();
    expect(screen.getByRole('button', { name: 'enormous' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'gigantic' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'massive' })).toBeTruthy();
  });

  it('hard KEEPS the original-text strikethrough framing (core task framing)', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'hard' })} />);
    startRevising();
    const original = screen.getAllByText('big').find(el => el.className.includes('line-through'));
    expect(original).toBeTruthy();
  });
});

// ============================================================================
// L2 — read-phase draft highlights
// ============================================================================

describe('revision-workshop tier · L2: read-phase draft highlights', () => {
  it('easy renders dashed skill-colored highlight spans over each target', () => {
    const { container } = render(<RevisionWorkshop data={makeStandardData({ supportTier: 'easy' })} />);
    expect(container.querySelectorAll('span.border-dashed')).toHaveLength(3);
  });

  it('medium keeps the highlights', () => {
    const { container } = render(<RevisionWorkshop data={makeStandardData({ supportTier: 'medium' })} />);
    expect(container.querySelectorAll('span.border-dashed')).toHaveLength(3);
  });

  it('hard renders the plain draft — no highlight spans, student locates the weak spots', () => {
    const { container } = render(<RevisionWorkshop data={makeStandardData({ supportTier: 'hard' })} />);
    expect(container.querySelectorAll('span.border-dashed')).toHaveLength(0);
    expect(screen.getByText('The dog is big. The park was nice. We had a good time.')).toBeTruthy();
  });
});

// ============================================================================
// L3 — focus-count line
// ============================================================================

describe('revision-workshop tier · L3: focus-count line', () => {
  it('easy announces the exact count', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'easy' })} />);
    expect(screen.getByText(/3 areas to improve/)).toBeTruthy();
  });

  it('medium keeps the count', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'medium' })} />);
    expect(screen.getByText(/3 areas to improve/)).toBeTruthy();
  });

  it('hard omits the count ("Look for areas to improve.")', () => {
    render(<RevisionWorkshop data={makeStandardData({ supportTier: 'hard' })} />);
    expect(screen.queryByText(/3 areas to improve/)).toBeNull();
    expect(screen.getByText(/Look for areas to improve\./)).toBeTruthy();
  });
});

// ============================================================================
// F1 — reorganize never starts solved (ALL tiers)
// ============================================================================

describe('revision-workshop fix · F1: initial sentence order is never the identity', () => {
  it('20 seeded mounts: order is a full permutation and never A,B,C,D', () => {
    const rand = mulberry32(0xC0FFEE);
    const spy = vi.spyOn(Math, 'random').mockImplementation(rand);
    try {
      for (let m = 0; m < 20; m++) {
        const view = render(<RevisionWorkshop data={makeReorganizeData()} />);
        startRevising();
        const rows = screen.getAllByText(/^SENT-[A-D]$/).map(el => el.textContent);
        // fully solvable: every sentence present exactly once (all origIdx reachable)
        expect(rows).toHaveLength(4);
        expect(new Set(rows).size).toBe(4);
        // never starts solved: identity = the answer key (checker scores origIdx === pos)
        expect(rows).not.toEqual(['SENT-A', 'SENT-B', 'SENT-C', 'SENT-D']);
        view.unmount();
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('the shuffled start is still fixable to a perfect order with the arrows', () => {
    render(<RevisionWorkshop data={makeReorganizeData({ supportTier: 'hard' })} />);
    startRevising();
    // Bubble-sort the visible rows into A,B,C,D using only the Move up arrows.
    for (let pass = 0; pass < 4; pass++) {
      const rows = () => screen.getAllByText(/^SENT-[A-D]$/).map(el => el.textContent);
      const want = ['SENT-A', 'SENT-B', 'SENT-C', 'SENT-D'];
      for (let i = 0; i < 4; i++) {
        if (rows()[i] !== want[i]) {
          const from = rows().indexOf(want[i]);
          for (let k = from; k > i; k--) {
            fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[k]);
          }
        }
      }
    }
    expect(screen.getAllByText(/^SENT-[A-D]$/).map(el => el.textContent))
      .toEqual(['SENT-A', 'SENT-B', 'SENT-C', 'SENT-D']);
  });
});

// ============================================================================
// F2 — the Ideal Order panel renders only AFTER submit (ALL tiers)
// ============================================================================

describe('revision-workshop fix · F2: Ideal Order gated behind submit', () => {
  it('pre-submit compare shows Scrambled + Your Order but NO Ideal Order (legacy/no tier)', () => {
    evalState.hasSubmitted = false;
    render(<RevisionWorkshop data={makeReorganizeData()} />);
    startRevising();
    goToCompare();
    expect(screen.getByText('Scrambled')).toBeTruthy();
    expect(screen.getByText('Your Order')).toBeTruthy();
    expect(screen.queryByText('Ideal Order')).toBeNull();
    expect(screen.queryByText('SENT-A SENT-B SENT-C SENT-D')).toBeNull();
    // the Edit path back to revise still exists — the answer must not
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('pre-submit compare hides Ideal Order at hard too', () => {
    evalState.hasSubmitted = false;
    render(<RevisionWorkshop data={makeReorganizeData({ supportTier: 'hard' })} />);
    startRevising();
    goToCompare();
    expect(screen.queryByText('Ideal Order')).toBeNull();
  });

  it('post-submit compare reveals the Ideal Order panel', () => {
    evalState.hasSubmitted = true;
    render(<RevisionWorkshop data={makeReorganizeData()} />);
    startRevising();
    goToCompare();
    expect(screen.getByText('Ideal Order')).toBeTruthy();
    expect(screen.getByText('SENT-A SENT-B SENT-C SENT-D')).toBeTruthy();
  });
});

// ============================================================================
// LEGACY DEFAULT — no tier fields ⇒ full-support render, unchanged
// ============================================================================

describe('revision-workshop tier · legacy default (no tier fields at all)', () => {
  it('read phase: highlights + exact count line, exactly like easy', () => {
    const { container } = render(<RevisionWorkshop data={makeStandardData()} />);
    expect(container.querySelectorAll('span.border-dashed')).toHaveLength(3);
    expect(screen.getByText(/3 areas to improve/)).toBeTruthy();
    expect(screen.getByText(/notice the highlighted areas/)).toBeTruthy();
  });

  it('revise phase: every suggestion visible, no Show hint toggle', () => {
    render(<RevisionWorkshop data={makeStandardData()} />);
    startRevising();
    expect(screen.getByText('Hint one: try a size word with more punch.')).toBeTruthy();
    expect(screen.getByText('Hint two: paint a picture of the park.')).toBeTruthy();
    expect(screen.getByText('Hint three: how did it feel?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show hint' })).toBeNull();
  });

  it('reorganize legacy keeps the exact sentence count line', () => {
    render(<RevisionWorkshop data={makeReorganizeData()} />);
    expect(screen.getByText(/4 sentences to reorder/)).toBeTruthy();
  });
});
