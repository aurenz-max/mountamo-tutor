// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for moon-phases-lab — item 15B / S8 of the
 * supply-side sweep. The interaction (drag/tap the Moon and watch it change) is
 * genuinely K-fit; what was missing was the VOICE and the band gating.
 *
 * These are the behaviors tsc cannot see:
 *  - the ORIENT beat fires on mount, so a non-reader is told what to do
 *  - the read-aloud taps send the on-screen words verbatim to the tutor
 *  - every tagged send is silent (system trigger, not student chat)
 *  - adult chrome (illumination %, 29.5-day counter, score ledger, degree
 *    readout) is gone at K-1 but still present at Grade 3
 *  - phase options are picture-primary at K-1 and named at Grade 3
 *  - the challenge pick never leaks right/wrong
 *
 * External hooks are mocked to drive pure component logic.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    resetAttempt: vi.fn(),
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import MoonPhasesLab, { type MoonPhasesLabData } from '../MoonPhasesLab';

const TITLE = 'Peek-a-Boo Moon';
const DESCRIPTION = 'The Moon looks different on different nights. Move it and see!';

// The real K rung the generator now emits (verified via /api/lumina/eval-test
// at grade=K after the prose-grade fix in gemini-moon-phases-lab.ts).
const kData = (over: Partial<MoonPhasesLabData> = {}): MoonPhasesLabData => ({
  title: TITLE,
  description: DESCRIPTION,
  viewMode: 'from_earth',
  moonPosition: 0,
  showSunDirection: false,
  showOrbit: false,
  phaseLabels: false,
  showEarthView: true,
  showTidalLocking: false,
  interactivePosition: true,
  animateOrbit: true,
  cycleSpeed: 8,
  gradeLevel: 'K',
  learningObjectives: ['Does the Moon look the same every night?'],
  ...over,
});

const g3Data = (over: Partial<MoonPhasesLabData> = {}): MoonPhasesLabData =>
  kData({
    viewMode: 'split_view',
    showSunDirection: true,
    showOrbit: true,
    phaseLabels: true,
    cycleSpeed: 5,
    gradeLevel: '3',
    ...over,
  });

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));
const optionsOf = (call: number) => sendTextSpy.mock.calls[call]?.[1];

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('MoonPhasesLab reader-fit — the voice (was the SCAFFOLD-GAP)', () => {
  it('fires an ORIENT beat on mount so a pre-reader is told what to do unprompted', () => {
    render(<MoonPhasesLab data={kData()} />);
    const orient = sent().find((m) => m.includes('[MOON_ORIENT]'));
    expect(orient).toBeTruthy();
    expect(orient).toMatch(/pre-reader who cannot read any text/i);
    expect(orient).toMatch(/child words/i);
  });

  it('names the challenge as the task in ORIENT, but never where to find it', () => {
    render(<MoonPhasesLab data={kData({ challengePhase: 'first_quarter' })} />);
    const orient = sent().find((m) => m.includes('[MOON_ORIENT]'))!;
    expect(orient).toMatch(/find the First Quarter/i);
    expect(orient).toMatch(/never where it is/i);
    // The answer is an orbit position — it must never be spoken.
    expect(orient).not.toMatch(/\d+\s*degrees?|\d+°/);
  });

  it('read-aloud on the header sends the title + description verbatim', () => {
    render(<MoonPhasesLab data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read this to me/i }));
    const msg = sent().find((m) => m.includes('[MOON_READ_ALOUD]'));
    expect(msg).toBeTruthy();
    expect(msg).toContain(TITLE);
    expect(msg).toContain(DESCRIPTION);
    expect(msg).toMatch(/word for word/i);
  });

  it('read-aloud on the Moon reads the current phase name and what it looks like', () => {
    render(<MoonPhasesLab data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /tell me about this moon/i }));
    const msg = sent().find((m) => m.includes('[MOON_READ_ALOUD]'))!;
    expect(msg).toContain('New Moon');
    expect(msg).toContain('we see the dark side');
  });

  it('EVERY tagged send is silent — none may appear as student chat', () => {
    render(<MoonPhasesLab data={kData({ challengePhase: 'full_moon' })} />);
    fireEvent.click(screen.getByRole('button', { name: /read this to me/i }));
    sendTextSpy.mock.calls.forEach((call, i) => {
      if (/^\[[A-Z_]+\]/.test(String(call[0]))) {
        expect(optionsOf(i)).toEqual({ silent: true });
      }
    });
    expect(sendTextSpy).toHaveBeenCalled();
  });

  it('a challenge pick never leaks right or wrong (the student has not submitted)', () => {
    render(<MoonPhasesLab data={kData({ challengePhase: 'full_moon' })} />);
    sendTextSpy.mockClear();
    // Challenge picker is the second group of phase buttons; pick by accessible name.
    fireEvent.click(screen.getAllByRole('button', { name: 'Full Moon' })[1]);
    const msg = sent().find((m) => m.includes('[MOON_CHALLENGE_PICK]'))!;
    expect(msg).toMatch(/NOT say whether the pick is right or wrong/i);
    expect(msg).toMatch(/do NOT name the correct phase/i);
  });
});

describe('MoonPhasesLab reader-fit — band contract at PRE (K-1)', () => {
  it('hides the adult stat panel at K: no illumination %, cycle-day or score ledger', () => {
    render(<MoonPhasesLab data={kData()} />);
    expect(screen.queryByText(/illumination/i)).toBeNull();
    expect(screen.queryByText(/day in cycle/i)).toBeNull();
    expect(screen.queryByText(/phases explored/i)).toBeNull();
    expect(screen.queryByText(/29\.5/)).toBeNull();
  });

  it('keeps that panel at Grade 3 — the fix band-gates, it does not delete', () => {
    render(<MoonPhasesLab data={g3Data()} />);
    expect(screen.getByText(/illumination/i)).toBeTruthy();
    expect(screen.getByText(/day in cycle/i)).toBeTruthy();
    expect(screen.getByText(/phases explored/i)).toBeTruthy();
  });

  it('hides the degree readout and the days/sec speed text at K', () => {
    render(<MoonPhasesLab data={kData()} />);
    expect(screen.queryByText(/moon position:/i)).toBeNull();
    expect(screen.queryByText(/days\/sec/i)).toBeNull();
  });

  it('shows the degree readout and speed at Grade 3', () => {
    render(<MoonPhasesLab data={g3Data()} />);
    expect(screen.getByText(/moon position:/i)).toBeTruthy();
    expect(screen.getByText(/days\/sec/i)).toBeTruthy();
  });

  it('phase options are picture-primary at K — emoji visible, name only to screen readers', () => {
    render(<MoonPhasesLab data={kData()} />);
    const btn = screen.getAllByRole('button', { name: 'Waxing Crescent' })[0];
    expect(btn.textContent).toBe('🌒');
    expect(btn.textContent).not.toMatch(/waxing/i);
  });

  it('phase options carry their names at Grade 3', () => {
    render(<MoonPhasesLab data={g3Data()} />);
    const btn = screen.getAllByRole('button', { name: 'Waxing Crescent' })[0];
    expect(btn.textContent).toMatch(/Waxing Crescent/);
  });

  it('never renders the doubled emoji the K branch used to produce ("🌑 🌑")', () => {
    render(<MoonPhasesLab data={kData()} />);
    screen.getAllByRole('button').forEach((b) => {
      expect(b.textContent).not.toMatch(/(🌑|🌒|🌓|🌔|🌕|🌖|🌗|🌘)\s*\1/u);
    });
  });

  it('every load-bearing panel at K carries a read-aloud twin', () => {
    render(<MoonPhasesLab data={kData({ challengePhase: 'full_moon' })} />);
    // header, the Moon itself, the challenge, and the Think About It questions
    expect(screen.getByRole('button', { name: /read this to me/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /tell me about this moon/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /read the challenge to me/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /read these questions to me/i })).toBeTruthy();
  });

  it('the challenge read-aloud states the task without naming a position', () => {
    render(<MoonPhasesLab data={kData({ challengePhase: 'third_quarter' })} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the challenge to me/i }));
    const msg = sent().find((m) => m.includes('[MOON_READ_ALOUD]'))!;
    expect(msg).toMatch(/Third Quarter/i);
    expect(msg).not.toMatch(/\d+\s*degrees?|\d+°/);
  });
});
