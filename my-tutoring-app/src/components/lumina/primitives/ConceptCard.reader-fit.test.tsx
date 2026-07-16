// @vitest-environment jsdom
/**
 * Behavioral test for the ConceptCard pre-reader (PRE band) presentation —
 * reader-fit BACKLOG item 9b. At K the card FACE is a big emoji (the child cannot
 * read the title), flipping reads the card aloud via the tutor ([CARD_READ_ALOUD],
 * a silent background trigger + the catalog PRE-READER directive), a 🔊 button
 * replays it without closing the card, and adult chrome ("Exhibit 0N", "Flip to
 * Analyze", the section-header labels) is hidden. The reader-grade render is unchanged.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn<(m: string, opts?: unknown) => void>();
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

// vi.hoisted: the SoundManager mock reads these EAGERLY when the factory runs at
// import, so they must exist before hoisting (a plain top-level const is in the TDZ).
const { toggle, tap } = vi.hoisted(() => ({ toggle: vi.fn(), tap: vi.fn() }));
vi.mock('../utils/SoundManager', () => ({
  SoundManager: {
    toggle, tap, select: vi.fn(), pop: vi.fn(),
    playCorrect: vi.fn(), playIncorrect: vi.fn(),
    isEnabled: () => false, getVolume: () => 1, play: vi.fn(),
  },
}));

vi.mock('../service/geminiClient-api', () => ({
  generateConceptImage: vi.fn(async () => null),
}));

import { ConceptCard } from './ConceptCard';
import type { ConceptCardData } from '../types';

const makeCard = (over: Partial<ConceptCardData> = {}): ConceptCardData => ({
  title: 'Cat',
  subheading: 'A pet',
  definition: 'A cat is a soft furry pet.',
  originStory: '',
  conceptElements: [{ label: 'Fur', detail: 'soft', type: 'primary' }],
  timelineContext: 'Today',
  curiosityNote: 'A cat can purr.',
  visualPrompt: 'a cat',
  themeColor: '#22d3ee',
  gradeLevel: 'K',
  cardEmoji: '🐱',
  ...over,
});

const readAloud = () =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[CARD_READ_ALOUD]'));

describe('ConceptCard @ PRE (kindergarten)', () => {
  beforeEach(() => { sendText.mockClear(); toggle.mockClear(); tap.mockClear(); });
  afterEach(() => cleanup());

  it('renders an emoji face + title and hides adult chrome', () => {
    render(<ConceptCard data={makeCard()} index={0} totalCards={3} />);
    expect(screen.getAllByText('🐱').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Exhibit 0/i)).toBeNull();
    expect(screen.queryByText(/Flip to Analyze/i)).toBeNull();
    expect(screen.queryByText(/^Overview$/)).toBeNull();
    expect(screen.queryByText(/Component Breakdown/i)).toBeNull();
    expect(screen.queryByText(/Return to Artifact/i)).toBeNull();
  });

  it('flipping reads the card aloud (name + definition + curiosity note)', () => {
    render(<ConceptCard data={makeCard()} index={0} totalCards={3} />);
    expect(readAloud()).toHaveLength(0); // nothing on mount
    fireEvent.click(screen.getAllByText('Cat')[0]); // tap the card face → flip
    expect(toggle).toHaveBeenCalled();
    const calls = readAloud();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('A cat is a soft furry pet.');
    expect(calls[0]).toContain('A cat can purr.');
  });

  it('the 🔊 button replays the read-aloud WITHOUT closing the card', () => {
    render(<ConceptCard data={makeCard()} index={0} totalCards={3} />);
    toggle.mockClear();
    fireEvent.click(screen.getByLabelText('Hear this card again'));
    expect(readAloud()).toHaveLength(1); // replayed
    expect(tap).toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled(); // stopPropagation → card did not flip
  });
});

describe('ConceptCard standard (reader grade)', () => {
  beforeEach(() => { sendText.mockClear(); toggle.mockClear(); });
  afterEach(() => cleanup());

  it('keeps the Exhibit chrome + fires [CARD_FLIPPED] (not the read-aloud) at grade 3', () => {
    render(<ConceptCard data={makeCard({ gradeLevel: '3' })} index={0} totalCards={3} />);
    expect(screen.getByText(/Exhibit 01/i)).toBeTruthy();
    expect(screen.getByText(/Flip to Analyze/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/Flip to Analyze/i)); // flip
    expect(readAloud()).toHaveLength(0);
    const flipped = sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[CARD_FLIPPED]'));
    expect(flipped).toHaveLength(1);
  });
});
