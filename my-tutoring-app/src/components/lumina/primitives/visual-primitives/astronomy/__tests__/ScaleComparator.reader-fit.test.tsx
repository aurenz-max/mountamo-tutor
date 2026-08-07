// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for scale-comparator — 15B / S12.
 *
 * Queued as SCAFFOLD-GAP ("compare two objects visually"). The comparison IS
 * K-fit; what surrounded it was numeric: a kilometre figure under every object
 * card and again under every drawn circle, a "N selected" tally, a log-scale
 * checkbox whose label is a sentence of adult prose, and a ratio panel reading
 * "3.7× larger" that the catalog explicitly says must be off at K-1.
 *
 * Note these gates were UNREACHABLE before this slice: the generator force-cast
 * prose into `data.gradeLevel`, so `=== 'K'` could never be true — including in
 * the component's own pre-existing `formatNumber` branch.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));

import ScaleComparator, { type ScaleComparatorData } from '../ScaleComparator';

const kData = (over: Partial<ScaleComparatorData> = {}): ScaleComparatorData => ({
  title: 'Earth and the Moon',
  description: 'Tap them to see which one is bigger.',
  compareType: 'size',
  objects: [
    {
      id: 'earth', name: 'Earth', type: 'planet', diameterKm: 12742, massKg: 5.97e24,
      distanceFromSunAu: 1, color: '#4A90E2', textureGradient: 'g', description: 'Our planet',
      funFact: 'Earth is the only planet with liquid water on its surface.',
    },
    {
      id: 'moon', name: 'The Moon', type: 'moon', diameterKm: 3474, massKg: 7.3e22,
      distanceFromSunAu: 1, color: '#C0C0C0', textureGradient: 'g', description: 'Our moon',
      funFact: 'The Moon is drifting away from Earth a tiny bit each year.',
    },
  ] as ScaleComparatorData['objects'],
  referenceObjects: [],
  showRatios: false,
  showFamiliarEquivalent: true,
  interactiveWalk: false,
  units: 'km',
  gradeLevel: 'K',
  ...over,
});

const g4Data = () => kData({ gradeLevel: '4', showRatios: true });

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('ScaleComparator reader-fit — the voice (was the SCAFFOLD-GAP)', () => {
  it('fires an ORIENT beat with a no-measurements clause at K', () => {
    render(<ScaleComparator data={kData()} />);
    const orient = sent().find((m) => m.includes('[SCALE_ORIENT]'))!;
    expect(orient).toBeTruthy();
    expect(orient).toMatch(/pre-reader who cannot read any text or numbers/i);
    expect(orient).toContain('Earth, The Moon');
    expect(orient).toMatch(/NEVER kilometres/i);
    expect(orient).toMatch(/never a "times bigger" number/i);
  });

  it('drops the no-measurements clause at Grade 4', () => {
    render(<ScaleComparator data={g4Data()} />);
    const orient = sent().find((m) => m.includes('[SCALE_ORIENT]'))!;
    expect(orient).not.toMatch(/NEVER kilometres/i);
  });

  it('describes an added object by how it LOOKS, not by a number', () => {
    render(<ScaleComparator data={kData({ objects: kData().objects, showRatios: false })} />);
    sendTextSpy.mockClear();
    // Both start selected via the default pair; deselect then re-add the Moon.
    fireEvent.click(screen.getByRole('button', { name: /The Moon/ }));
    fireEvent.click(screen.getByRole('button', { name: /The Moon/ }));
    const msg = sent().find((m) => m.includes('[SCALE_OBJECT_ADDED]'));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/much bigger|tiny next to it/i);
    expect(msg).toMatch(/Never say kilometres/i);
  });

  it('read-aloud sends the fun fact verbatim', () => {
    render(<ScaleComparator data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the fun fact to me/i }));
    const msg = sent().find((m) => m.includes('[SCALE_READ_ALOUD]'))!;
    expect(msg).toContain('Earth is the only planet with liquid water on its surface.');
  });

  it('every tagged send is silent', () => {
    render(<ScaleComparator data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /read this to me/i }));
    sendTextSpy.mock.calls.forEach((call) => {
      if (/^\[[A-Z_]+\]/.test(String(call[0]))) {
        expect(call[1]).toEqual({ silent: true });
      }
    });
    expect(sendTextSpy).toHaveBeenCalled();
  });
});

describe('ScaleComparator reader-fit — band contract at PRE (K-1)', () => {
  it('shows NO kilometre figures anywhere at K (rule 7)', () => {
    const { container } = render(<ScaleComparator data={kData()} />);
    expect(container.textContent).not.toMatch(/km/);
    expect(container.textContent).not.toMatch(/12,742|12742/);
  });

  it('shows kilometre figures at Grade 4 — band-gated, not deleted', () => {
    const { container } = render(<ScaleComparator data={g4Data()} />);
    expect(container.textContent).toMatch(/km/);
  });

  it('hides the "N selected" tally and the section heading at K', () => {
    render(<ScaleComparator data={kData()} />);
    expect(screen.queryByText(/selected/i)).toBeNull();
    expect(screen.queryByText(/Select Objects to Compare/i)).toBeNull();
  });

  it('hides the logarithmic-scale checkbox at K (its label is adult prose)', () => {
    const { container } = render(<ScaleComparator data={kData()} />);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(screen.queryByText(/logarithmic/i)).toBeNull();
  });

  it('shows the log-scale control at Grade 4', () => {
    const { container } = render(<ScaleComparator data={g4Data()} />);
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('never shows the ratio panel at K even if showRatios slipped through true', () => {
    // Defence in depth: the catalog rule is "showRatios false for K-1", and the
    // component owns its own band contract rather than trusting upstream.
    render(<ScaleComparator data={kData({ showRatios: true })} />);
    expect(screen.queryByText(/× larger|× smaller/)).toBeNull();
    expect(screen.queryByText(/Size Comparisons/i)).toBeNull();
  });

  it('shows the ratio panel at Grade 4 when showRatios is on', () => {
    render(<ScaleComparator data={g4Data()} />);
    expect(screen.getByText(/Size Comparisons/i)).toBeTruthy();
  });

  it('keeps the reset affordance at K, as a glyph', () => {
    render(<ScaleComparator data={kData()} />);
    const reset = screen.getByRole('button', { name: /reset zoom/i });
    expect(reset.textContent).toBe('🔄');
  });

  it('still gives a K child the object names and the fun fact by voice', () => {
    render(<ScaleComparator data={kData()} />);
    // The name appears on the selector card AND as the SVG label — both are wanted.
    expect(screen.getAllByText('Earth').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /read the fun fact to me/i })).toBeTruthy();
  });
});
