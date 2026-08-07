// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for solar-system-explorer — 15B / S11.
 *
 * Queued as SCAFFOLD-GAP ("tap planets"). The tap IS K-fit; what surrounded it
 * was not: a three-clause protocol instruction in 12px, three display
 * checkboxes, a scale-mode <select>, a raw speed multiplier, a calendar date,
 * and a six-cell stat grid reading AU / km / days / hours / °C / moons.
 *
 * Behaviors tsc cannot see: the ORIENT beat fires, tapping a body voices it,
 * the chrome is gone at K-1 and still present at 3-5, and no measurement is
 * ever pushed at a pre-reader.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));

import SolarSystemExplorer, { type SolarSystemExplorerData } from '../SolarSystemExplorer';

const body = (over: Partial<SolarSystemExplorerData['bodies'][0]>) => ({
  id: 'earth',
  name: 'Earth',
  type: 'planet' as const,
  color: '#3B82F6',
  radiusKm: 6371,
  distanceAu: 1,
  orbitalPeriodDays: 365,
  rotationPeriodHours: 24,
  moons: 1,
  description: 'Our home planet, the only one we know with life.',
  textureGradient: 'earthGrad',
  temperatureC: 15,
  funFact: 'Earth is the only planet not named after a god.',
  ...over,
});

const kData = (over: Partial<SolarSystemExplorerData> = {}): SolarSystemExplorerData => ({
  title: 'Our Solar System',
  description: 'Tap a planet to meet it.',
  bodies: [
    body({ id: 'sun', name: 'Sun', type: 'star', distanceAu: 0, orbitalPeriodDays: 0 }),
    body({}),
    body({ id: 'mars', name: 'Mars', distanceAu: 1.52, description: 'The red planet.' }),
  ],
  initialZoom: 'inner',
  gradeLevel: 'K',
  focusBody: 'earth',
  ...over,
});

const g4Data = () => kData({ gradeLevel: '4', initialZoom: 'system' });

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('SolarSystemExplorer reader-fit — the voice (was the SCAFFOLD-GAP)', () => {
  it('fires an ORIENT beat naming the bodies, with a no-measurements clause at K', () => {
    render(<SolarSystemExplorer data={kData()} />);
    const orient = sent().find((m) => m.includes('[SOLAR_ORIENT]'))!;
    expect(orient).toBeTruthy();
    expect(orient).toMatch(/pre-reader who cannot read any text/i);
    expect(orient).toContain('Sun, Earth, Mars');
    expect(orient).toMatch(/Never speak a measurement/i);
  });

  it('drops the no-measurements clause at Grade 4, where numbers are the point', () => {
    render(<SolarSystemExplorer data={g4Data()} />);
    const orient = sent().find((m) => m.includes('[SOLAR_ORIENT]'))!;
    expect(orient).not.toMatch(/Never speak a measurement/i);
  });

  it('voices the selected body without listing numbers', () => {
    render(<SolarSystemExplorer data={kData()} />);
    const msg = sent().find((m) => m.includes('[SOLAR_BODY_SELECTED]'))!;
    expect(msg).toBeTruthy();
    expect(msg).toContain('Earth');
    expect(msg).toMatch(/do not list numbers/i);
  });

  it('read-aloud sends the description and the fun fact verbatim', () => {
    render(<SolarSystemExplorer data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /tell me about earth/i }));
    const msg = sent().find((m) => m.includes('[SOLAR_READ_ALOUD]'))!;
    expect(msg).toContain('Our home planet, the only one we know with life.');
    expect(msg).toContain('Earth is the only planet not named after a god.');
  });

  it('every tagged send is silent', () => {
    render(<SolarSystemExplorer data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /tell me about earth/i }));
    sendTextSpy.mock.calls.forEach((call) => {
      if (/^\[[A-Z_]+\]/.test(String(call[0]))) {
        expect(call[1]).toEqual({ silent: true });
      }
    });
    expect(sendTextSpy).toHaveBeenCalled();
  });
});

describe('SolarSystemExplorer reader-fit — band contract at PRE (K-1)', () => {
  it('hides the display toggles and the scale selector at K (rule 7)', () => {
    const { container } = render(<SolarSystemExplorer data={kData()} />);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
  });

  it('keeps the toggles and selector at Grade 4 — band-gated, not deleted', () => {
    const { container } = render(<SolarSystemExplorer data={g4Data()} />);
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(3);
    expect(container.querySelector('select')).not.toBeNull();
  });

  it('hides the speed slider and the calendar date at K', () => {
    const { container } = render(<SolarSystemExplorer data={kData()} />);
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(screen.queryByText(/Speed:/)).toBeNull();
  });

  it('hides the three-clause protocol help text at K (the ORIENT beat carries it)', () => {
    render(<SolarSystemExplorer data={kData()} />);
    expect(screen.queryByText(/Scroll to Zoom/i)).toBeNull();
  });

  it('shows the help text at Grade 4', () => {
    render(<SolarSystemExplorer data={g4Data()} />);
    expect(screen.getByText(/Scroll to Zoom/i)).toBeTruthy();
  });

  it('does not show AU / km / °C stat readouts to a K child (rule 7)', () => {
    render(<SolarSystemExplorer data={kData()} />);
    expect(screen.queryByText(/Distance from Sun/i)).toBeNull();
    expect(screen.queryByText(/6,371/)).toBeNull();
    expect(screen.queryByText(/Temperature/i)).toBeNull();
  });

  it('shows the full stat grid at Grade 4', () => {
    render(<SolarSystemExplorer data={g4Data()} />);
    expect(screen.getByText(/Distance from Sun/i)).toBeTruthy();
    expect(screen.getByText(/Temperature/i)).toBeTruthy();
  });

  it('still gives a K child the planet story — by voice, with a read-aloud', () => {
    render(<SolarSystemExplorer data={kData()} />);
    expect(screen.getByRole('button', { name: /tell me about earth/i })).toBeTruthy();
    expect(screen.getByText('Our home planet, the only one we know with life.')).toBeTruthy();
  });
});
