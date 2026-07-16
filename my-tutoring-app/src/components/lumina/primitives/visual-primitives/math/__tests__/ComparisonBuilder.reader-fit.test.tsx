// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for the K (PRE-band) compare-groups rebuild:
 * the two group PICTURES plus a middle "=" ARE the tappable answer surface
 * (tap=choose, picture-primary) — there are no "More/Fewer/The Same" text buttons
 * and no Check button. Tapping the side with more (or "=" for equal) atomically
 * answers; a wrong tap does not complete the challenge.
 *
 * These are the behaviors tsc can't verify. External hooks (live tutor, evaluation,
 * audio) are mocked so we drive pure component logic.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Stable sendText spy (a fresh vi.fn() per render would lose the DISAMBIGUATE call
// we assert on). Cleared in beforeEach.
const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import ComparisonBuilder, { type ComparisonBuilderChallenge } from '../ComparisonBuilder';

const groups = (
  id: string,
  leftCount: number,
  rightCount: number,
  correctAnswer: 'more' | 'less' | 'equal',
): ComparisonBuilderChallenge => ({
  id,
  type: 'compare-groups',
  instruction: 'Which side has more?',
  leftGroup: { count: leftCount, objectType: 'bears' },
  rightGroup: { count: rightCount, objectType: 'bears' },
  correctAnswer,
});

const data = (challenges: ComparisonBuilderChallenge[]) => ({
  title: 'Reader-fit test',
  challenges,
  gradeBand: 'K' as const,
  showCorrespondenceLines: true,
  useAlligatorMnemonic: true,
});

// Grade-1 (EMERGING) control — the adult chrome is intentionally PRESENT here; the
// band gate only strips it at K.
const data1 = (challenges: ComparisonBuilderChallenge[]) => ({
  title: 'Reader-fit test',
  challenges,
  gradeBand: '1' as const,
  showCorrespondenceLines: true,
  useAlligatorMnemonic: true,
});

// The compare-groups SVG has exactly two <rect> during solve (the group boxes,
// index 0 = left, 1 = right) and one <circle> (the middle "=") at K. Scope the
// circle to THAT svg (the one carrying the rects) — the K Read-me button renders a
// LuminaReadAloud glyph svg earlier in the DOM that also contains <circle>s.
const workspaceSvg = () => document.querySelector('svg rect')?.closest('svg') ?? null;
const groupRects = () => Array.from(document.querySelectorAll('svg rect'));
const sameCircle = () => workspaceSvg()?.querySelector('circle') as SVGCircleElement;

const oneMoreLess = (
  id: string,
  targetNumber: number,
  askFor: 'one-more' | 'one-less' | 'both',
): ComparisonBuilderChallenge => ({
  id,
  type: 'one-more-one-less',
  instruction: `One more and one less than ${targetNumber}?`,
  targetNumber,
  askFor,
});

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('ComparisonBuilder reader-fit (K band, compare-groups)', () => {
  it('K surface: no text answer buttons and no Check — pictures are the answer', () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 1, 'more'), groups('c2', 1, 1, 'equal')])} />);
    expect(screen.queryByRole('button', { name: /^more$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^fewer$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /the same/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^check/i })).toBeNull();
    // Two group boxes + the "=" affordance are present as the tappable surface.
    expect(groupRects().length).toBe(2);
    expect(sameCircle()).toBeTruthy();
  });

  it('tapping the LEFT group when left has more atomically completes the challenge', async () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 1, 'more'), groups('c2', 2, 2, 'equal')])} />);
    fireEvent.click(groupRects()[0]); // left box → "left has more"
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('tapping the RIGHT group when right has more (left = less) completes', async () => {
    render(<ComparisonBuilder data={data([groups('c1', 2, 4, 'less'), groups('c2', 2, 2, 'equal')])} />);
    fireEvent.click(groupRects()[1]); // right box → "right has more" = left less
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('tapping the middle "=" when the groups are equal completes', async () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 3, 'equal'), groups('c2', 1, 2, 'less')])} />);
    fireEvent.click(sameCircle());
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('a WRONG tap does not complete the challenge (still solvable, no Next yet)', () => {
    render(<ComparisonBuilder data={data([groups('c1', 1, 4, 'less'), groups('c2', 2, 2, 'equal')])} />);
    fireEvent.click(groupRects()[0]); // taps LEFT (asserts left more) but left has fewer
    expect(screen.queryByText(/next challenge/i)).toBeNull();
  });
});

describe('ComparisonBuilder reader-fit (K chrome band-gate — item 2b)', () => {
  it('PEDAGOGY: the "Left: N / Right: N" count badges are HIDDEN at K (no answer leak)', () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 5, 'less'), groups('c2', 2, 2, 'equal')])} />);
    // The SVG "Left"/"Right" orientation labels remain (no colon); the count
    // readout ("Left:") must be gone — that is what handed the child the answer.
    expect(screen.queryByText(/Left:/)).toBeNull();
    expect(screen.queryByText(/Right:/)).toBeNull();
  });

  it('adult chrome (mode tabs, "Challenge 1 of N" counter, Kindergarten badge) is HIDDEN at K', () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 1, 'more'), groups('c2', 1, 1, 'equal')])} />);
    expect(screen.queryByText(/Compare Groups/i)).toBeNull(); // mode tab + type badge
    expect(screen.queryByText(/Challenge 1 of/i)).toBeNull();  // counter
    expect(screen.queryByText(/Kindergarten/i)).toBeNull();    // grade badge
  });

  it('the persistent 🔊 Read-me replay button is present at K', () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 1, 'more'), groups('c2', 1, 1, 'equal')])} />);
    expect(screen.getByRole('button', { name: /read the question to me again/i })).toBeTruthy();
  });

  it('GRADE-1 control: count badges, mode tabs, counter, grade badge PRESENT; no Read-me', () => {
    render(<ComparisonBuilder data={data1([groups('c1', 3, 5, 'less'), groups('c2', 2, 2, 'equal')])} />);
    expect(screen.getByText(/Left:/)).toBeTruthy();                          // count badges shown
    expect(screen.getAllByText(/Compare Groups/i).length).toBeGreaterThan(0); // mode tab + type badge
    expect(screen.getByText(/Challenge 1 of/i)).toBeTruthy();               // counter present
    expect(screen.getByText(/Grade 1/i)).toBeTruthy();                       // grade badge present
    expect(screen.queryByRole('button', { name: /read the question to me again/i })).toBeNull();
  });
});

describe('ComparisonBuilder reader-fit (one_more_less DISAMBIGUATE symmetry — item 2b)', () => {
  // Two number rows render for askFor 'both' (one-more first, one-less second), so a
  // number label appears twice; index 0 = one-more row, index 1 = one-less row.
  // The DISAMBIGUATE beat is a silent system trigger — sendText(msg, {silent:true}) —
  // so scan the calls' first arg rather than matching the whole arg list. Anchored on
  // the tag so the [ACTIVITY_START] intro (which echoes the instruction) can't match.
  const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

  it('answering "one MORE" first voices the "one LESS" ask at K', () => {
    render(<ComparisonBuilder data={data([oneMoreLess('c1', 5, 'both')])} />);
    fireEvent.click(screen.getAllByRole('button', { name: '6' })[0]); // one-more row
    expect(sentMessages().some((m) => /\[DISAMBIGUATE\][\s\S]*one LESS than 5/i.test(m))).toBe(true);
  });

  it('answering "one LESS" first voices the "one MORE" ask at K (symmetric)', () => {
    render(<ComparisonBuilder data={data([oneMoreLess('c1', 5, 'both')])} />);
    fireEvent.click(screen.getAllByRole('button', { name: '4' })[1]); // one-less row
    expect(sentMessages().some((m) => /\[DISAMBIGUATE\][\s\S]*one MORE than 5/i.test(m))).toBe(true);
  });

  it('the DISAMBIGUATE beat is answer-free (never states the target±1 value)', () => {
    render(<ComparisonBuilder data={data([oneMoreLess('c1', 5, 'both')])} />);
    fireEvent.click(screen.getAllByRole('button', { name: '6' })[0]);
    const disambiguateCall = sendTextSpy.mock.calls
      .map((c) => String(c[0]))
      .find((m) => /DISAMBIGUATE/.test(m));
    expect(disambiguateCall).toBeTruthy();
    // "one less than 5" is fine; asserting the ANSWER (4) is not.
    expect(disambiguateCall).not.toMatch(/one less is 4|the answer is 4|is 4\b/i);
  });
});
