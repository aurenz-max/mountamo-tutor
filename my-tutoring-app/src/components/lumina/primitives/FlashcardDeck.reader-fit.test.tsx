// @vitest-environment jsdom
/**
 * Behavioral test for the FlashcardDeck pre-reader (PRE band) presentation —
 * reader-fit BACKLOG item 9d. At K the deck auto-starts (no text ready screen), the
 * card FACE is a big emoji (the child cannot read the term), the tutor voices the
 * term on show ([FLASHCARD_SHOWN]) and reads the card aloud on flip
 * ([FLASHCARD_READ_ALOUD] + the NEW catalog PRE-READER directive), a 🔊 replays
 * without closing the card, and adult chrome ("Click to Reveal", the N/M counter,
 * progress dots, button sublabels, the stat ledger) is hidden. Reader-grade unchanged.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn<(m: string, opts?: unknown) => void>();
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

vi.mock('../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(), toggle: vi.fn(), select: vi.fn(), pop: vi.fn(),
    playCorrect: vi.fn(), playIncorrect: vi.fn(),
    isEnabled: () => false, getVolume: () => 1, play: vi.fn(),
  },
}));

import FlashcardDeck from './FlashcardDeck';
import type { FlashcardDeckData } from '../types';

const makeData = (over: Partial<FlashcardDeckData> = {}): FlashcardDeckData => ({
  title: 'Farm Animals',
  description: 'Study farm animals.',
  gradeLevel: 'K',
  cards: [
    { id: '1', term: 'Cow', definition: 'A cow says moo.', category: 'Animals', cardEmoji: '🐄' },
    { id: '2', term: 'Pig', definition: 'A pig says oink.', category: 'Animals', cardEmoji: '🐖' },
  ],
  ...over,
});

const readAloud = () =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[FLASHCARD_READ_ALOUD]'));
const shown = () =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[FLASHCARD_SHOWN]'));

describe('FlashcardDeck @ PRE (kindergarten)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(() => cleanup());

  it('auto-starts (no text ready screen), shows the emoji face, hides chrome', () => {
    render(<FlashcardDeck data={makeData()} />);
    expect(screen.queryByText(/Start Studying/i)).toBeNull(); // skipped the ready screen
    expect(screen.getAllByText('🐄').length).toBeGreaterThan(0); // emoji face
    expect(screen.queryByText(/Click to Reveal/i)).toBeNull();
    expect(screen.queryByText(/Study Again/i)).toBeNull();
    expect(screen.queryByText('1 / 2')).toBeNull(); // counter chrome
    expect(shown()).toHaveLength(1); // term voiced on show
  });

  it('flipping reads the card aloud (term + meaning)', () => {
    render(<FlashcardDeck data={makeData()} />);
    expect(readAloud()).toHaveLength(0);
    fireEvent.click(screen.getAllByText('Cow')[0]); // tap the card face → flip
    const calls = readAloud();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('Cow');
    expect(calls[0]).toContain('A cow says moo.');
    // flipped → the self-rate buttons appear
    expect(screen.getByLabelText('I know this')).toBeTruthy();
  });

  it('the 🔊 button replays the read-aloud WITHOUT closing the card', () => {
    render(<FlashcardDeck data={makeData()} />);
    fireEvent.click(screen.getAllByText('Cow')[0]); // flip to back
    expect(readAloud()).toHaveLength(1);
    fireEvent.click(screen.getByLabelText('Hear this card again'));
    expect(readAloud()).toHaveLength(2); // replayed
    expect(screen.getByLabelText('I know this')).toBeTruthy(); // still flipped (stopPropagation)
  });

  it('finishing the deck lands on a wordless celebration (no accuracy ledger)', () => {
    render(<FlashcardDeck data={makeData()} />);
    // card 1: flip + Got It
    fireEvent.click(screen.getAllByText('Cow')[0]);
    fireEvent.click(screen.getByLabelText('I know this'));
    // card 2 appears after the 300ms advance
    return new Promise<void>((resolve) => setTimeout(() => {
      fireEvent.click(screen.getAllByText('Pig')[0]);
      fireEvent.click(screen.getByLabelText('I know this'));
      setTimeout(() => {
        expect(screen.getByText('🎉')).toBeTruthy();
        expect(screen.queryByText(/Accuracy/i)).toBeNull();
        expect(screen.queryByText(/Session Complete/i)).toBeNull();
        resolve();
      }, 350);
    }, 350));
  });
});

describe('FlashcardDeck standard (reader grade)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(() => cleanup());

  it('keeps the text ready screen + chrome and never voices at grade 5', () => {
    render(<FlashcardDeck data={makeData({ gradeLevel: '5' })} />);
    expect(screen.getByText(/Start Studying/i)).toBeTruthy();
    expect(shown()).toHaveLength(0);
    expect(readAloud()).toHaveLength(0);
  });
});
