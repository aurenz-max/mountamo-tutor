// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for day-night-seasons — 15B / S10.
 *
 * The queued verdict was SCAFFOLD-GAP ("rotate the Earth, watch the light").
 * The voice was missing, but the audit also found a hard PRE contract rule 6
 * failure the triage had not: the only assessment was a free-text
 * `<input placeholder="Type your answer...">` — typing, at Kindergarten — and
 * the scoring credited ANY non-empty string, so it measured nothing.
 *
 * Behaviors tsc cannot see: no typing path at K, the location <select> becomes
 * tappable place buttons, the hours readout and degree readout are gone, and
 * the instrument (spin / play / visit) is what actually gets scored.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
const submitResultSpy = vi.fn();
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitResultSpy,
    hasSubmitted: false,
    resetAttempt: vi.fn(),
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import DayNightSeasons, { type DayNightSeasonsData } from '../DayNightSeasons';

const OBJECTIVE = 'When is it daytime?';

const kData = (over: Partial<DayNightSeasonsData> = {}): DayNightSeasonsData => ({
  title: 'Day and Night',
  description: 'Spin the Earth and see where the sunshine goes.',
  focusMode: 'day-night',
  initialEarthPosition: 'june_solstice',
  viewPerspective: 'space_side',
  showTiltAxis: false,
  showSunRays: true,
  showTerminator: true,
  showDaylightHours: true,
  showTemperatureZones: false,
  animationMode: 'rotation',
  timeSpeed: 8,
  markerLatitudes: [
    { id: 'ny', name: 'New York', latitude: 40, longitude: -74, emoji: '🗽', color: '#f00' },
    { id: 'quito', name: 'Quito', latitude: 0, longitude: -78, emoji: '🌴', color: '#0f0' },
  ],
  gradeLevel: 'K',
  learningObjectives: [OBJECTIVE],
  ...over,
});

const g4Data = () => kData({
  gradeLevel: '4',
  showTiltAxis: true,
  timeSpeed: 4,
  learningObjectives: [OBJECTIVE, 'Why do we have seasons?'],
});

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
  submitResultSpy.mockClear();
});

describe('DayNightSeasons reader-fit — the voice (was the SCAFFOLD-GAP)', () => {
  it('fires an ORIENT beat telling a pre-reader what to do, with no hours', () => {
    render(<DayNightSeasons data={kData()} />);
    const orient = sent().find((m) => m.includes('[EARTH_ORIENT]'))!;
    expect(orient).toBeTruthy();
    expect(orient).toMatch(/pre-reader who cannot read any text/i);
    expect(orient).toMatch(/spin the Earth/i);
    expect(orient).toMatch(/do not say any number of hours/i);
  });

  it('reads the header aloud verbatim on tap', () => {
    render(<DayNightSeasons data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read this to me/i }));
    const msg = sent().find((m) => m.includes('[EARTH_READ_ALOUD]'))!;
    expect(msg).toContain('Spin the Earth and see where the sunshine goes.');
  });

  it('names the place and whether it is day or night when one is chosen', () => {
    render(<DayNightSeasons data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Quito' }));
    const msg = sent().find((m) => m.includes('[EARTH_LOCATION_SELECTED]'))!;
    expect(msg).toBeTruthy();
    expect(msg).toContain('Quito');
    expect(msg).toMatch(/DAYTIME|NIGHT/);
    expect(msg).toMatch(/never read a number of hours/i);
  });

  it('every tagged send is silent', () => {
    render(<DayNightSeasons data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /read this to me/i }));
    sendTextSpy.mock.calls.forEach((call) => {
      if (/^\[[A-Z_]+\]/.test(String(call[0]))) {
        expect(call[1]).toEqual({ silent: true });
      }
    });
    expect(sendTextSpy).toHaveBeenCalled();
  });
});

describe('DayNightSeasons reader-fit — band contract at PRE (K-1)', () => {
  it('has NO typing path at K (rule 6) — the old free-text answer box is gone', () => {
    const { container } = render(<DayNightSeasons data={kData()} />);
    expect(container.querySelector('input[type="text"]')).toBeNull();
    expect(screen.queryByPlaceholderText(/type your answer/i)).toBeNull();
  });

  it('still asks the question at K — as spoken prompt with a read-aloud', () => {
    render(<DayNightSeasons data={kData()} />);
    expect(screen.getByText(OBJECTIVE)).toBeTruthy();
    expect(screen.getByRole('button', { name: /read these questions to me/i })).toBeTruthy();
  });

  it('keeps the typed answer box at Grade 4 — band-gated, not deleted', () => {
    const { container } = render(<DayNightSeasons data={g4Data()} />);
    expect(container.querySelector('input[type="text"]')).not.toBeNull();
    expect(screen.getAllByPlaceholderText(/type your answer/i).length).toBe(2);
  });

  it('replaces the location <select> with tappable place buttons at K (rule 2)', () => {
    const { container } = render(<DayNightSeasons data={kData()} />);
    expect(container.querySelector('select')).toBeNull();
    expect(screen.getByRole('button', { name: 'New York' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quito' })).toBeTruthy();
  });

  it('keeps the <select> at Grade 4', () => {
    const { container } = render(<DayNightSeasons data={g4Data()} />);
    expect(container.querySelector('select')).not.toBeNull();
  });

  it('hides the hours readout and the degree readout at K (rule 7)', () => {
    render(<DayNightSeasons data={kData()} />);
    expect(screen.queryByText(/daylight hours/i)).toBeNull();
    expect(screen.queryByText(/earth rotation:/i)).toBeNull();
  });

  it('shows both readouts at Grade 4', () => {
    render(<DayNightSeasons data={g4Data()} />);
    expect(screen.getByText(/daylight hours/i)).toBeTruthy();
    expect(screen.getByText(/earth rotation:/i)).toBeTruthy();
  });

  it('scores the INSTRUMENT at K, not a typed string (rule 8)', () => {
    render(<DayNightSeasons data={kData()} />);
    // Drive the three instrument signals: spin, play, visit a second place.
    fireEvent.change(screen.getByRole('slider', { name: /spin the earth/i }), {
      target: { value: '120' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quito' }));
    fireEvent.click(screen.getByRole('button', { name: /check understanding/i }));

    expect(submitResultSpy).toHaveBeenCalled();
    const [success, score] = submitResultSpy.mock.calls[0];
    expect(score).toBe(100);
    expect(success).toBe(true);
  });

  it('does NOT credit a K student who touched nothing (the old bug scored any string)', () => {
    render(<DayNightSeasons data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /check understanding/i }));
    const [success, score] = submitResultSpy.mock.calls[0];
    expect(score).toBeLessThan(70);
    expect(success).toBe(false);
  });
});
