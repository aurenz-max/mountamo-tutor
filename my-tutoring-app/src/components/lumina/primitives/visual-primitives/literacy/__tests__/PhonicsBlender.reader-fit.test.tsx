// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for phonics-blender @ PRE
 * (qa/reader-fit/phonics-blender-PRE-2026-07-15.md). The PRE (Kindergarten)
 * contract this locks in:
 *  1. Adult chrome is hidden at gradeLevel 'K': the phase stepper (Listen/Build/
 *     Blend), the "Word N of M / N completed" counter, the Grade/pattern badges,
 *     and the phase-description badge.
 *  2. Phoneme tiles are LETTER-primary (a pre-reader cannot read /k/ slash
 *     notation); the sound is still spoken on tap via [PRONOUNCE_SOUND].
 *  3. Unreadable instruction labels are gone ("Tap each sound to hear it:",
 *     "Arrange the sounds…", "Sound Bank:", "Blended together:").
 *  4. Arranging the sounds is a multi-part construction, so the Check confirm
 *     stays (rule 2); the Clear affordance is dropped to cut chrome.
 *  5. Reader grades (control, Grade 1) keep the full text UI + /k/ notation.
 *
 * External hooks (live tutor, evaluation, audio, spoken judge) are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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

const makeData = (gradeLevel: string): PhonicsBlenderData => ({
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
  ],
});

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

describe('PhonicsBlender @ PRE (gradeLevel K)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hides adult chrome (phase stepper, word counter, badges)', () => {
    render(<PhonicsBlender data={makeData('K')} />);
    expect(screen.queryByText(/Word 1 of 1/)).toBeNull();       // counter
    expect(screen.queryByText(/completed/)).toBeNull();
    expect(screen.queryByText('Grade K')).toBeNull();           // badge
    expect(screen.queryByText('CVC Words')).toBeNull();         // pattern badge
    expect(screen.queryByText('Listen')).toBeNull();            // stepper label
    expect(screen.queryByText('Build')).toBeNull();
    expect(screen.queryByText('Blend')).toBeNull();
  });

  it('hides unreadable instruction labels; the word emoji still shows', () => {
    render(<PhonicsBlender data={makeData('K')} />);
    expect(screen.queryByText('Tap each sound to hear it:')).toBeNull();
    expect(screen.queryByText('Blended together:')).toBeNull();
    expect(screen.getByText('🐱')).toBeTruthy();
  });

  it('phoneme tiles are LETTER-primary — no /k/ slash notation visible', () => {
    render(<PhonicsBlender data={makeData('K')} />);
    expect(screen.queryByText('/k/')).toBeNull();
    expect(screen.queryByText('/t/')).toBeNull();
    // the letter is the tile face (appears on the tile and the blend breakdown)
    expect(screen.getAllByText('c').length).toBeGreaterThan(0);
  });

  it('tapping a sound tile speaks it via [PRONOUNCE_SOUND] (stimulus is voiced)', () => {
    render(<PhonicsBlender data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    expect(tagged('[PRONOUNCE_SOUND]')).toHaveLength(1);
  });

  it('build phase keeps the Check confirm but drops the Clear affordance', () => {
    render(<PhonicsBlender data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: /Ready to Build/ }));
    expect(screen.queryByText('Clear')).toBeNull();
    expect(screen.queryByText('Sound Bank:')).toBeNull();
    expect(screen.queryByText(/Arrange the sounds/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy();
  });
});

describe('PhonicsBlender @ reader grade (control, Grade 1)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('keeps the full text UI: counter, badges, /k/ notation, instruction labels', () => {
    render(<PhonicsBlender data={makeData('1')} />);
    expect(screen.getByText(/Word 1 of 1/)).toBeTruthy();
    expect(screen.getByText('Grade 1')).toBeTruthy();
    expect(screen.getByText('Tap each sound to hear it:')).toBeTruthy();
    expect(screen.getAllByText('/k/').length).toBeGreaterThan(0);
  });

  it('build phase keeps the Clear button at reader grade', () => {
    render(<PhonicsBlender data={makeData('1')} />);
    fireEvent.click(screen.getByRole('button', { name: /Ready to Build/ }));
    expect(screen.getByText('Clear')).toBeTruthy();
    expect(screen.getByText('Sound Bank:')).toBeTruthy();
  });
});
