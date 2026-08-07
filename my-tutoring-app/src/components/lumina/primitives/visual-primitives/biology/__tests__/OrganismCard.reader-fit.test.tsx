// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for organism-card — 15B / S15, the last
 * item in the class.
 *
 * Queued as SCAFFOLD-GAP ("picture card display", risk 3). The card shape is
 * right for K; everything on it was text — a Latin binomial, a kingdom badge, a
 * "Grade Band: 3-5" developer readout, and five static fact boxes with no way
 * to hear any of them.
 *
 * The probe at `grade=K` also showed the shared biology prose-keyed-map defect:
 * `gradeBand:'3-5'` with 8 attributes against a K-2 rung reading "only basic
 * attributes with icons: habitat, diet, size, locomotion".
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));

import OrganismCard, { type OrganismCardData } from '../OrganismCard';

const FUN_FACT = 'A blue whale calf drinks enough milk to fill a bathtub every day.';

const kData = (over: Partial<OrganismCardData> = {}): OrganismCardData => ({
  organism: {
    commonName: 'Blue Whale',
    scientificName: 'Balaenoptera musculus',
    kingdom: 'Animalia',
    imagePrompt: 'a blue whale swimming',
  } as OrganismCardData['organism'],
  attributes: {
    habitat: 'the open ocean',
    diet: 'tiny shrimp called krill',
    locomotion: 'swimming',
    lifespan: 'about 80 years',
    size: 'as long as three school buses',
  } as OrganismCardData['attributes'],
  funFact: FUN_FACT,
  gradeBand: 'K-2',
  visibleFields: ['habitat', 'diet', 'size', 'locomotion', 'funFact'],
  instanceId: 'test-organism',
  ...over,
});

const g4Data = () => kData({
  gradeBand: '3-5',
  visibleFields: ['habitat', 'diet', 'size', 'locomotion', 'lifespan', 'funFact'],
});

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('OrganismCard reader-fit — the voice (was the SCAFFOLD-GAP)', () => {
  it('fires an ORIENT beat with the no-scientific-name clause at K-2', () => {
    render(<OrganismCard data={kData()} />);
    const orient = sent().find((m) => m.includes('[ORGANISM_ORIENT]'))!;
    expect(orient).toBeTruthy();
    expect(orient).toContain('Blue Whale');
    expect(orient).toMatch(/pre-reader who cannot read any text/i);
    expect(orient).toMatch(/NEVER say the scientific name/i);
    expect(orient).toMatch(/never read out a measurement/i);
  });

  it('drops the clause at 3-5', () => {
    render(<OrganismCard data={g4Data()} />);
    const orient = sent().find((m) => m.includes('[ORGANISM_ORIENT]'))!;
    expect(orient).not.toMatch(/NEVER say the scientific name/i);
  });

  it('each fact box speaks itself at K-2 — every fact gets a spoken twin', () => {
    render(<OrganismCard data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /hear about size/i }));
    const msg = sent().find((m) => m.includes('[ORGANISM_FACT_OPENED]'))!;
    expect(msg).toBeTruthy();
    expect(msg).toContain('Size');
    expect(msg).toContain('as long as three school buses');
  });

  it('fact boxes are NOT buttons at 3-5, where the child can read them', () => {
    render(<OrganismCard data={g4Data()} />);
    expect(screen.queryByRole('button', { name: /hear about size/i })).toBeNull();
    // The value is still on screen, just not tappable.
    expect(screen.getByText('as long as three school buses')).toBeTruthy();
  });

  it('read-aloud on the header covers name, habitat, diet and the fun fact', () => {
    render(<OrganismCard data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /tell me about the blue whale/i }));
    const msg = sent().find((m) => m.includes('[ORGANISM_READ_ALOUD]'))!;
    expect(msg).toContain('Blue Whale');
    expect(msg).toContain('the open ocean');
    expect(msg).toContain('tiny shrimp called krill');
    expect(msg).toContain(FUN_FACT);
  });

  it('the fun fact has its own read-aloud', () => {
    render(<OrganismCard data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the fun fact to me/i }));
    expect(sent().some((m) => m.includes('[ORGANISM_READ_ALOUD]') && m.includes(FUN_FACT)))
      .toBe(true);
  });

  it('every tagged send is silent', () => {
    render(<OrganismCard data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /hear about diet/i }));
    sendTextSpy.mock.calls.forEach((call) => {
      if (/^\[[A-Z_]+\]/.test(String(call[0]))) {
        expect(call[1]).toEqual({ silent: true });
      }
    });
    expect(sendTextSpy).toHaveBeenCalled();
  });
});

describe('OrganismCard reader-fit — band contract at PRE (K-2)', () => {
  it('hides the Latin binomial at K-2 (rule 7)', () => {
    render(<OrganismCard data={kData()} />);
    expect(screen.queryByText('Balaenoptera musculus')).toBeNull();
  });

  it('shows the Latin binomial at 3-5', () => {
    render(<OrganismCard data={g4Data()} />);
    expect(screen.getByText('Balaenoptera musculus')).toBeTruthy();
  });

  it('hides the kingdom badge and the developer band readout at K-2', () => {
    render(<OrganismCard data={kData()} />);
    expect(screen.queryByText('Animalia')).toBeNull();
    expect(screen.queryByText(/Grade Band:/i)).toBeNull();
  });

  it('shows the kingdom badge at 3-5', () => {
    render(<OrganismCard data={g4Data()} />);
    expect(screen.getByText('Animalia')).toBeTruthy();
  });

  it('still shows the child the name, the picture slot and the facts', () => {
    render(<OrganismCard data={kData()} />);
    expect(screen.getByText('Blue Whale')).toBeTruthy();
    expect(screen.getByText('the open ocean')).toBeTruthy();
    expect(screen.getByText(FUN_FACT)).toBeTruthy();
  });
});
