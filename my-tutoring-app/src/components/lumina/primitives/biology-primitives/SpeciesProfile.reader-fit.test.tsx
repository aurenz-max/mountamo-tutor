// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for species-profile — 15A / S6.
 *
 * Pre-fix this primitive had NO channel to a non-reader (no catalog tutoring
 * block, no `useLuminaAI`), no `gradeBand` field to gate on, and rendered the
 * Latin binomial, a kingdom/phylum taxonomy table, raw kilograms and an
 * 18th-century discovery citation at Kindergarten.
 *
 * Behaviors tsc cannot see: the ORIENT beat fires, facts can be heard, the adult
 * chrome is gone at K-2 and still present at 3-5, and `imagePrompt` is never
 * printed as student copy at any grade.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import SpeciesProfile, { type SpeciesProfileData } from './SpeciesProfile';

const IMAGE_PROMPT = 'a polar bear standing on Arctic sea ice at golden hour, photorealistic';

const kData = (over: Partial<SpeciesProfileData> = {}): SpeciesProfileData => ({
  commonName: 'Polar Bear',
  scientificName: 'Ursus maritimus',
  nameMeaning: 'Maritime Bear',
  imagePrompt: IMAGE_PROMPT,
  gradeBand: 'K-2',
  category: 'mammal',
  diet: { type: 'carnivore', description: 'Hunts seals on the sea ice.' },
  habitat: { environment: 'Arctic sea ice', location: 'The Arctic' },
  physicalStats: {
    height: '1.3 to 1.6 meters tall at the shoulder',
    heightComparison: 'As tall as a kitchen counter',
    weight: '300 to 600 kilograms',
    weightComparison: 'Heavier than a grand piano',
  },
  taxonomy: { kingdom: 'Animalia', phylum: 'Chordata', species: 'Ursus maritimus' },
  interestingFacts: [
    { title: 'Invisible Fur', description: 'Polar bear fur is not actually white — each hair is see-through.' },
  ],
  discoveryInfo: 'Formally described in 1774 by the Constantine John Phipps.',
  biologicalNiche: 'Top hunter of the Arctic sea ice',
  ...over,
});

const g4Data = (over: Partial<SpeciesProfileData> = {}) => kData({ gradeBand: '3-5', ...over });

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));
const sentWith = (t: string) => sent().filter((m) => m.includes(t));

beforeEach(() => {
  sendTextSpy.mockReset();
  cleanup();
});

describe('SpeciesProfile — the scaffold reaches the child', () => {
  it('fires an orient beat once on mount', () => {
    render(<SpeciesProfile data={kData()} />);
    expect(sentWith('[SPECIES_ORIENT]')).toHaveLength(1);
    expect(sentWith('[SPECIES_ORIENT]')[0]).toContain('Polar Bear');
  });

  it('offers read-aloud on the name and on every fact at K-2', () => {
    render(<SpeciesProfile data={kData()} />);
    expect(screen.getByLabelText(/hear the name polar bear/i)).toBeTruthy();
    expect(screen.getByLabelText(/read the fact invisible fur aloud/i)).toBeTruthy();
  });

  it('reads the fact word for word, title and body', () => {
    render(<SpeciesProfile data={kData()} />);
    fireEvent.click(screen.getByLabelText(/read the fact invisible fur aloud/i));
    const msg = sentWith('[SPECIES_READ_ALOUD]')[0];
    expect(msg).toContain('Invisible Fur');
    expect(msg).toContain('each hair is see-through');
    expect(msg).toMatch(/word for word/i);
  });

  it('sends every beat silently', () => {
    render(<SpeciesProfile data={kData()} />);
    fireEvent.click(screen.getByLabelText(/hear the name polar bear/i));
    expect(sendTextSpy.mock.calls.length).toBeGreaterThan(1);
    for (const c of sendTextSpy.mock.calls) {
      expect((c[1] as { silent?: boolean } | undefined)?.silent).toBe(true);
    }
  });

  it('offers no read-aloud chrome at 3-5', () => {
    render(<SpeciesProfile data={g4Data()} />);
    expect(screen.queryByLabelText(/hear the name polar bear/i)).toBeNull();
  });
});

describe('SpeciesProfile — band contract rule 7 (no adult chrome at K-2)', () => {
  it('withholds the Latin binomial at K-2 and shows it at 3-5', () => {
    const { unmount } = render(<SpeciesProfile data={kData()} />);
    expect(screen.queryByText('Ursus maritimus')).toBeNull();
    unmount();
    render(<SpeciesProfile data={g4Data()} />);
    expect(screen.getAllByText('Ursus maritimus').length).toBeGreaterThan(0);
  });

  it('withholds the name-meaning etymology at K-2', () => {
    const { unmount } = render(<SpeciesProfile data={kData()} />);
    expect(screen.queryByText(/Name Meaning:/i)).toBeNull();
    unmount();
    render(<SpeciesProfile data={g4Data()} />);
    expect(screen.getByText(/Name Meaning:/i)).toBeTruthy();
  });

  it('withholds the discovery citation at K-2 and shows it at 3-5', () => {
    const { unmount } = render(<SpeciesProfile data={kData()} />);
    expect(screen.queryByText(/Constantine John Phipps/)).toBeNull();
    unmount();
    render(<SpeciesProfile data={g4Data()} />);
    expect(screen.getByText(/Constantine John Phipps/)).toBeTruthy();
  });

  it('withholds the whole taxonomy section at K-2 and shows it at 3-5', () => {
    // Assert on the accordion TRIGGER, not its body: the body is lazily
    // rendered while collapsed, so a `not.toMatch(/Animalia/)` on the K-2 render
    // would pass whether or not the gate existed. The trigger is the thing the
    // gate actually controls.
    const { unmount, container } = render(<SpeciesProfile data={kData()} />);
    expect(screen.queryByText(/Family Tree/i)).toBeNull();
    expect(container.textContent).not.toMatch(/Animalia|Chordata/);
    unmount();
    render(<SpeciesProfile data={g4Data()} />);
    expect(screen.getByText(/Family Tree/i)).toBeTruthy();
  });

  it('withholds the category badge at K-2', () => {
    const { unmount } = render(<SpeciesProfile data={kData()} />);
    expect(screen.queryByText('mammal')).toBeNull();
    unmount();
    render(<SpeciesProfile data={g4Data()} />);
    expect(screen.getByText('mammal')).toBeTruthy();
  });
});

describe('SpeciesProfile — sizes are comparisons, not numbers, at K-2', () => {
  it('drops the raw metric value and keeps the child-scale comparison', () => {
    const { container } = render(<SpeciesProfile data={kData()} />);
    expect(container.textContent).not.toMatch(/300 to 600 kilograms/);
    expect(container.textContent).not.toMatch(/1\.3 to 1\.6 meters/);
    expect(container.textContent).toMatch(/Heavier than a grand piano/);
    expect(container.textContent).toMatch(/As tall as a kitchen counter/);
  });

  it('keeps BOTH at 3-5', () => {
    const { container } = render(<SpeciesProfile data={g4Data()} />);
    expect(container.textContent).toMatch(/300 to 600 kilograms/);
    expect(container.textContent).toMatch(/Heavier than a grand piano/);
  });
});

describe('SpeciesProfile — imagePrompt is never student copy', () => {
  it('is absent at K-2 AND at 3-5', () => {
    // An image-GENERATION instruction printed at the student. Fourth appearance
    // of the S9 / S13 / S5 leak; removed at every grade, as in those slices.
    for (const d of [kData(), g4Data()]) {
      const { container, unmount } = render(<SpeciesProfile data={d} />);
      expect(container.textContent).not.toContain(IMAGE_PROMPT);
      unmount();
    }
  });
});

describe('SpeciesProfile — structural', () => {
  it('never nests a button inside a button', () => {
    for (const d of [kData(), g4Data()]) {
      const { container, unmount } = render(<SpeciesProfile data={d} />);
      expect(container.querySelectorAll('button button')).toHaveLength(0);
      unmount();
    }
  });

  it('degrades safely when the generator stamped no band (treated as not-K)', () => {
    const { container } = render(<SpeciesProfile data={kData({ gradeBand: undefined })} />);
    expect(container.textContent).toMatch(/Ursus maritimus/);
  });
});
