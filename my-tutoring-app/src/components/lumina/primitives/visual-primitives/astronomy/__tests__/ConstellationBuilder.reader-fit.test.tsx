// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for constellation-builder.
 *
 * Pre-fix this primitive was ORPHANED from the tutor. It was never in item 15's
 * mute set because the catalog DOES carry a full tutoring block (7 contextKeys,
 * 3 scaffolding levels, 3 struggles) — but the component had zero `useLuminaAI`,
 * so the block reached the backend EMPTY. The `tutor-test&probe=1` var-resolution
 * table at `98e4928` returned `sendTextTags: []` and not one contextKey resolved
 * by the component:
 *
 *   **TASK:** Student is building the (not set) constellation.
 *             Stars connected: (not set)/(not set). Mode: (not set).
 *   Level 2: "(not set) has (not set) main stars. You have found (not set) so far."
 *
 * A scaffold that resolves to "(not set)" is worse than no scaffold — it is a
 * prompt telling the tutor to talk about nothing, and no moment ever fired it.
 *
 * Behaviors tsc cannot see: the ORIENT beat fires and withholds which star is
 * next, the instruction line and the Star Lore card have spoken twins at K-1,
 * a wrong tap is voiced (the on-screen correction is unreadable), the step
 * counter and progress badge are gone at K-1 — and none of the K chrome changes
 * appear at grade 3.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    resetAttempt: vi.fn(),
  }),
}));

import ConstellationBuilder, { type ConstellationBuilderData } from '../ConstellationBuilder';

const STARS = [
  { id: 's1', x: 20, y: 20, magnitude: 2, isPartOfConstellation: true },
  { id: 's2', x: 30, y: 25, magnitude: 2, isPartOfConstellation: true },
  { id: 's3', x: 40, y: 30, magnitude: 2, isPartOfConstellation: true },
  { id: 'bg1', x: 80, y: 70, magnitude: 5, isPartOfConstellation: false },
];

const kData = (over: Partial<ConstellationBuilderData> = {}): ConstellationBuilderData => ({
  title: 'Star Pictures',
  description: 'Tap the stars.',
  gradeLevel: 'K',
  stars: STARS,
  challenges: [
    {
      id: 'c1',
      type: 'guided_trace',
      constellationName: 'Big Dipper',
      instruction: 'Tap the twinkling stars to make the Big Dipper.',
      starOrder: ['s1', 's2', 's3'],
      correctConnections: [
        { fromStarId: 's1', toStarId: 's2' },
        { fromStarId: 's2', toStarId: 's3' },
      ],
      mythologyFact: 'The Big Dipper looks like a big soup spoon in the sky.',
      season: 'year-round',
    },
    {
      id: 'c2',
      type: 'guided_trace',
      constellationName: 'Orion',
      instruction: 'Follow the stars to draw Orion.',
      starOrder: ['s1', 's2', 's3'],
      correctConnections: [
        { fromStarId: 's1', toStarId: 's2' },
        { fromStarId: 's2', toStarId: 's3' },
      ],
      mythologyFact: 'Orion wears a belt of three bright stars.',
      season: 'winter',
    },
  ],
  ...over,
});

const g3Data = () => kData({ gradeLevel: '3' });

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));
const sentWith = (t: string) => sent().filter((m) => m.includes(t));

/** Tap the transparent hit-circle for a star — SVG <g> is not clickable. */
const tapStar = (container: HTMLElement, index: number) => {
  const circles = container.querySelectorAll('svg circle.cursor-pointer');
  fireEvent.click(circles[index]);
};

/** Trace the whole 3-star pattern in order, which completes the constellation. */
const traceAll = (container: HTMLElement) => {
  // Hit-circles are emitted per interactive star in `stars` order; the three
  // member stars are s1, s2, s3 and each renders a fill + a hit circle.
  const hits = Array.from(container.querySelectorAll('svg circle.cursor-pointer'));
  for (const id of ['s1', 's2', 's3']) {
    const i = STARS.findIndex((s) => s.id === id);
    // two clickable circles per interactive star (fill + hit target)
    fireEvent.click(hits[i * 2 + 1]);
  }
};

beforeEach(() => {
  sendTextSpy.mockReset();
  cleanup();
});

describe('ConstellationBuilder — ORIENT', () => {
  it('fires exactly once on mount (it fired zero times before)', () => {
    render(<ConstellationBuilder data={kData()} />);
    expect(sentWith('[CONSTELLATION_ORIENT]')).toHaveLength(1);
  });

  it('reads the instruction into the beat, so the task survives the one-sentence cap', () => {
    render(<ConstellationBuilder data={kData()} />);
    expect(sentWith('[CONSTELLATION_ORIENT]')[0])
      .toContain('Tap the twinkling stars to make the Big Dipper.');
  });

  it('refuses to say which star is next — the screen already rings it', () => {
    render(<ConstellationBuilder data={kData()} />);
    expect(sentWith('[CONSTELLATION_ORIENT]')[0]).toMatch(/Do NOT say which star to tap/i);
  });

  it('sends every beat silently', () => {
    const { container } = render(<ConstellationBuilder data={kData()} />);
    fireEvent.click(screen.getByLabelText(/hear what to do/i));
    // s2 — a member star, but not the first in the order, so a wrong tap.
    // (The dim background star is not clickable at all here: non-members stay
    // inert unless the support tier withdraws that, so there are only three
    // interactive stars on screen at K.)
    tapStar(container, 2);
    for (const c of sendTextSpy.mock.calls) {
      expect((c[1] as { silent?: boolean } | undefined)?.silent).toBe(true);
    }
  });
});

describe('ConstellationBuilder — the instruction line has a spoken twin at K-1', () => {
  it('offers read-aloud at K and reads the instruction word for word', () => {
    render(<ConstellationBuilder data={kData()} />);
    fireEvent.click(screen.getByLabelText(/hear what to do/i));
    const msg = sentWith('[CONSTELLATION_READ_ALOUD]')[0];
    expect(msg).toContain('Tap the twinkling stars to make the Big Dipper.');
    expect(msg).toMatch(/word for word/i);
  });

  it('offers it at grade 1 too', () => {
    render(<ConstellationBuilder data={kData({ gradeLevel: '1' })} />);
    expect(screen.getByLabelText(/hear what to do/i)).toBeTruthy();
  });

  it('does NOT offer it at grade 3', () => {
    render(<ConstellationBuilder data={g3Data()} />);
    expect(screen.queryByLabelText(/hear what to do/i)).toBeNull();
  });
});

describe('ConstellationBuilder — a wrong tap is voiced', () => {
  it('speaks the correction, because the on-screen hint is unreadable at K', () => {
    const { container } = render(<ConstellationBuilder data={kData()} />);
    tapStar(container, 2); // s2 — a member star, but not the FIRST in the order
    const msg = sentWith('[CONSTELLATION_WRONG_STAR]')[0];
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/sparkly circle/i);
  });

  it('still refuses to name or place the right star', () => {
    const { container } = render(<ConstellationBuilder data={kData()} />);
    tapStar(container, 2);
    expect(sentWith('[CONSTELLATION_WRONG_STAR]')[0]).toMatch(/Do NOT name it or say where it is/i);
  });

  it('the on-screen hint names the ring at K, not a number that is not there', () => {
    // The step counter is band-gated away at K-1, so "the numbered star" points
    // at nothing on screen — and it is the line an adult alongside reads out.
    const { container } = render(<ConstellationBuilder data={kData()} />);
    tapStar(container, 2);
    expect(screen.getByText('Look for the star with the sparkly circle!')).toBeTruthy();
    expect(screen.queryByText('Look for the numbered star!')).toBeNull();
  });

  it('keeps the numbered wording at grade 3, where the counter IS on screen', () => {
    const { container } = render(<ConstellationBuilder data={g3Data()} />);
    tapStar(container, 2);
    expect(screen.getByText('Look for the numbered star!')).toBeTruthy();
  });
});

describe('ConstellationBuilder — the Star Lore card is read, not just shown', () => {
  it('reads the fact aloud on completion (STIMULUS — it is silent text at K)', () => {
    const { container } = render(<ConstellationBuilder data={kData()} />);
    traceAll(container);
    const msg = sentWith('[CONSTELLATION_COMPLETE]')[0];
    expect(msg).toBeTruthy();
    expect(msg).toContain('The Big Dipper looks like a big soup spoon in the sky.');
    expect(msg).toMatch(/word for word/i);
  });

  it('voices the advance button at K, the last string with no spoken twin', () => {
    const { container } = render(<ConstellationBuilder data={kData()} />);
    traceAll(container);
    expect(sentWith('[CONSTELLATION_COMPLETE]')[0]).toMatch(/tap the big button to go on/i);
  });

  it('does not add the button line at grade 3, where the label is readable', () => {
    const { container } = render(<ConstellationBuilder data={g3Data()} />);
    traceAll(container);
    expect(sentWith('[CONSTELLATION_COMPLETE]')[0]).not.toMatch(/tap the big button/i);
  });

  it('celebrates exactly ONCE — the tutor must not re-read the story on every render', () => {
    const { container } = render(<ConstellationBuilder data={kData()} />);
    traceAll(container);
    // `isConstellationComplete` stays true after the trace, so the completion
    // effect is latched per challenge id. Unlatched it re-fires on any dep
    // change — and with a `sendText` whose identity is not stable that is a
    // render loop, not just a chatty tutor.
    expect(sentWith('[CONSTELLATION_COMPLETE]')).toHaveLength(1);
  });

  it('offers a replay button at K once the card is up', () => {
    const { container } = render(<ConstellationBuilder data={kData()} />);
    traceAll(container);
    fireEvent.click(screen.getByLabelText(/hear the star story/i));
    expect(sentWith('[CONSTELLATION_READ_ALOUD]').some((m) => m.includes('soup spoon'))).toBe(true);
  });
});

describe('ConstellationBuilder — adult chrome is gone at K-1 (band contract rule 7)', () => {
  it('hides the "1 / 2" progress badge at K but keeps it at grade 3', () => {
    const { unmount } = render(<ConstellationBuilder data={kData()} />);
    expect(screen.queryByText('1 / 2')).toBeNull();
    unmount();
    render(<ConstellationBuilder data={g3Data()} />);
    expect(screen.getByText(/1\s*\/\s*2/)).toBeTruthy();
  });

  it('hides the "Tap star N of M" step counter at K but keeps it at grade 3', () => {
    const { unmount } = render(<ConstellationBuilder data={kData()} />);
    expect(screen.queryByText(/Tap star \d+ of \d+/)).toBeNull();
    unmount();
    render(<ConstellationBuilder data={g3Data()} />);
    expect(screen.getByText(/Tap star 1 of 3/)).toBeTruthy();
  });

  it('gates by conditional render, not Tailwind `hidden` — nothing is left in the a11y tree', () => {
    const { container } = render(<ConstellationBuilder data={kData()} />);
    expect(container.querySelectorAll('.hidden')).toHaveLength(0);
  });
});

describe('ConstellationBuilder — structural', () => {
  it('never nests a button inside a button', () => {
    for (const d of [kData(), g3Data()]) {
      const { container, unmount } = render(<ConstellationBuilder data={d} />);
      expect(container.querySelectorAll('button button')).toHaveLength(0);
      unmount();
    }
  });

  it('still renders the instruction text itself at every band', () => {
    for (const d of [kData(), g3Data()]) {
      const { unmount } = render(<ConstellationBuilder data={d} />);
      expect(screen.getByText('Tap the twinkling stars to make the Big Dipper.')).toBeTruthy();
      unmount();
    }
  });
});
