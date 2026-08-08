// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for constellation-builder.
 *
 * The tier is render-support withdrawal only — it never changes the stars, the
 * challenges, the connections, or the answer. What it changes:
 *   L1 member-star highlight   easy/legacy = forced opacity-1 + bright #fffbe6
 *                              fill; medium/hard = uniform fill, magnitude-only
 *                              opacity (no membership render signal)
 *   L2 distractor interactivity easy/legacy = background stars inert;
 *                              medium/hard = clickable in free_connect ONLY,
 *                              a wrong tap costs an attempt via the existing
 *                              wrong-star branch (constellationStarIds source)
 *   L3 hint specificity        easy/legacy = specific directive hints;
 *                              medium/hard = generic "Not quite — try again."
 *                              (never silent — the K-5 floor)
 *
 * What it may NEVER withdraw:
 *   - guided_trace pulsing ring + step number (task identity)
 *   - identify pre-drawn blue lines (task identity)
 *   - identify stars stay non-interactive (by design)
 *   - guided_trace background stars stay inert (order is the task)
 *
 * F1 (defect fix, ALL tiers): a seasonal challenge whose option pool collapses
 * below 2 names is padded from a static constellation-name pool to 3 options,
 * correct answer always retained.
 *
 * A payload with NO supportTier field must render the legacy full-help UI.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

// reader-fit: the component now opens a tutor channel. `useLuminaAI` reads a
// React context and THROWS outside a `LuminaAIProvider`, so an unmocked hook
// crashes every render in this file — nothing to do with support tiers. The
// tutor beats are asserted in ConstellationBuilder.reader-fit.test.tsx.
// The stub MUST be hoisted: returning a fresh `vi.fn()` per call gives
// `sendText` a new identity every render, which re-fires any effect that depends
// on it. The real hook returns a `useCallback`, so this keeps the stub honest.
const sendTextStub = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextStub, isAudioPlaying: false, isConnected: true }),
}));

// The real panel fires confetti/celebration timers; here it is only the score
// sink — the attempt-cost lever (L2) is observable through its overallScore prop.
vi.mock('../../../../components/PhaseSummaryPanel', () => ({
  default: ({ overallScore }: { overallScore: number }) => (
    <div data-testid="phase-summary">score:{overallScore}</div>
  ),
}));

import ConstellationBuilder, {
  type ConstellationBuilderData,
  type ConstellationChallenge,
  type StarData,
} from '../ConstellationBuilder';

const GENERIC = 'Not quite — try again.';
const LEGACY_GUIDED_HINT = 'Look for the numbered star!';
const LEGACY_WRONG_STAR = "That star isn't part of this constellation. Try a brighter one!";
const LEGACY_BAD_PAIR = "Those two stars aren't connected in this constellation.";

/** Star field. m4 is member-FLAGGED but outside every connection — the star the
 *  wrong-star branch is reachable through at legacy (checker source = connections). */
const STARS: StarData[] = [
  { id: 'm1', x: 10, y: 10, magnitude: 1, isPartOfConstellation: true },  // cx 60,  cy 45
  { id: 'm2', x: 20, y: 10, magnitude: 2, isPartOfConstellation: true },  // cx 120, cy 45
  { id: 'm3', x: 30, y: 10, magnitude: 3, isPartOfConstellation: true },  // cx 180, cy 45
  { id: 'm4', x: 40, y: 10, magnitude: 3, isPartOfConstellation: true },  // cx 240, cy 45
  { id: 'b1', x: 50, y: 50, magnitude: 5, isPartOfConstellation: false }, // cx 300, cy 225
  { id: 'b2', x: 70, y: 30, magnitude: 4, isPartOfConstellation: false }, // cx 420, cy 135
];

const CONNECTIONS = [
  { fromStarId: 'm1', toStarId: 'm2' },
  { fromStarId: 'm2', toStarId: 'm3' },
];

const FREE_CONNECT: ConstellationChallenge = {
  id: 'c-fc', type: 'free_connect', constellationName: 'Test Row',
  instruction: 'Connect the stars of the constellation.',
  starOrder: ['m1', 'm2', 'm3'], correctConnections: CONNECTIONS,
  mythologyFact: 'A row of stars.', season: 'winter',
};

const GUIDED: ConstellationChallenge = {
  id: 'c-gt', type: 'guided_trace', constellationName: 'Test Row',
  instruction: 'Tap the numbered stars in order.',
  starOrder: ['m1', 'm2', 'm3'], correctConnections: CONNECTIONS,
  mythologyFact: 'A row of stars.', season: 'winter',
};

const IDENTIFY: ConstellationChallenge = {
  id: 'c-id', type: 'identify', constellationName: 'Big Dipper',
  instruction: 'Which constellation is this?',
  starOrder: [], correctConnections: CONNECTIONS,
  mythologyFact: 'A famous dipper.', season: 'spring',
  distractorName0: 'Orion', distractorName1: 'Leo',
};

const SEASONAL_BARE: ConstellationChallenge = {
  id: 'c-se', type: 'seasonal', constellationName: 'Cassiopeia',
  instruction: 'Which constellation is best visible during fall evenings?',
  starOrder: [], correctConnections: [],
  mythologyFact: 'The queen of the sky.', season: 'fall',
};

const makeData = (
  challenges: ConstellationChallenge[],
  tier?: 'easy' | 'medium' | 'hard',
): ConstellationBuilderData => ({
  title: 'Star Lab',
  description: 'Constellation practice.',
  gradeLevel: '3',
  stars: STARS,
  challenges,
  ...(tier ? { supportTier: tier } : {}),
});

/** The visible star dot at an SVG position (fill is one of the two dot fills). */
const dotAt = (container: HTMLElement, cx: number, cy: number): SVGCircleElement => {
  const dot = Array.from(container.querySelectorAll('circle')).find(c =>
    c.getAttribute('cx') === String(cx) &&
    c.getAttribute('cy') === String(cy) &&
    (c.getAttribute('fill') === '#fffbe6' || c.getAttribute('fill') === '#e2e8f0'),
  );
  if (!dot) throw new Error(`no star dot at (${cx}, ${cy})`);
  return dot as SVGCircleElement;
};

/** Enlarged transparent hit circles — rendered ONLY for interactive stars. */
const hitCircles = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('circle[fill="transparent"]'));

const hitAt = (container: HTMLElement, cx: number, cy: number) =>
  hitCircles(container).find(c =>
    c.getAttribute('cx') === String(cx) && c.getAttribute('cy') === String(cy),
  );

const opacityOf = (el: Element) => parseFloat(el.getAttribute('opacity') ?? 'NaN');

// ============================================================================
// L1 — member-star highlight withdrawal (fill + opacity)
// ============================================================================

describe('constellation-builder tier · L1 member-star highlight', () => {
  afterEach(cleanup);

  it('legacy (no tier): member star forced bright #fffbe6 + opacity 1; background dims by magnitude', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT])} />);
    const m1 = dotAt(container, 60, 45);
    expect(m1.getAttribute('fill')).toBe('#fffbe6');
    expect(opacityOf(m1)).toBeCloseTo(1, 5);
    const b1 = dotAt(container, 300, 225);
    expect(b1.getAttribute('fill')).toBe('#e2e8f0');
    expect(opacityOf(b1)).toBeCloseTo(0.25, 5); // mag 5 → floor
  });

  it('easy renders the member highlight identically to legacy', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT], 'easy')} />);
    const m1 = dotAt(container, 60, 45);
    expect(m1.getAttribute('fill')).toBe('#fffbe6');
    expect(opacityOf(m1)).toBeCloseTo(1, 5);
  });

  it('medium withdraws the membership signal: uniform fill, magnitude-only opacity', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT], 'medium')} />);
    const m1 = dotAt(container, 60, 45);
    expect(m1.getAttribute('fill')).toBe('#e2e8f0');         // no bright member fill
    expect(opacityOf(m1)).toBeCloseTo(0.85, 5);              // mag 1 → 1 − 0.15, NOT forced 1
    const b1 = dotAt(container, 300, 225);
    expect(opacityOf(b1)).toBeCloseTo(0.25, 5);              // background unchanged
  });

  it('hard renders all stars purely by magnitude — no membership signal', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT], 'hard')} />);
    expect(dotAt(container, 60, 45).getAttribute('fill')).toBe('#e2e8f0');
    expect(dotAt(container, 180, 45).getAttribute('fill')).toBe('#e2e8f0');
    expect(opacityOf(dotAt(container, 60, 45))).toBeCloseTo(0.85, 5);  // mag 1
    expect(opacityOf(dotAt(container, 180, 45))).toBeCloseTo(0.55, 5); // mag 3
  });

  it('identify at hard keeps its pre-drawn blue lines (task identity) while star styling follows L1', () => {
    const { container } = render(<ConstellationBuilder data={makeData([IDENTIFY], 'hard')} />);
    expect(container.querySelectorAll('line[stroke="#60a5fa"]')).toHaveLength(2);
    expect(dotAt(container, 60, 45).getAttribute('fill')).toBe('#e2e8f0');
  });
});

// ============================================================================
// L2 — distractor-star interactivity (free_connect ONLY, medium/hard)
// ============================================================================

describe('constellation-builder tier · L2 distractor-star interactivity', () => {
  afterEach(cleanup);

  it('legacy free_connect: background stars are inert — no hit circle, no cursor, click does nothing', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT])} />);
    expect(hitAt(container, 300, 225)).toBeUndefined();
    const b1 = dotAt(container, 300, 225);
    expect(b1.getAttribute('class') ?? '').not.toContain('cursor-pointer');
    fireEvent.click(b1);
    expect(screen.queryByText(LEGACY_WRONG_STAR)).toBeNull();
    expect(screen.queryByText(GENERIC)).toBeNull();
  });

  it('easy free_connect: background stars stay inert (easy = legacy)', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT], 'easy')} />);
    expect(hitAt(container, 300, 225)).toBeUndefined();
    fireEvent.click(dotAt(container, 300, 225));
    expect(screen.queryByText(GENERIC)).toBeNull();
  });

  it('medium free_connect: a background-star tap fires the wrong-star branch and costs an attempt (score 90)', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT], 'medium')} />);
    expect(hitAt(container, 300, 225)).toBeDefined();          // clickable now
    fireEvent.click(dotAt(container, 300, 225));               // wrong tap → attempt 1
    expect(screen.getByText(GENERIC)).toBeTruthy();
    // Complete correctly: m1→m2, m2→m3
    fireEvent.click(dotAt(container, 60, 45));
    fireEvent.click(dotAt(container, 120, 45));
    fireEvent.click(dotAt(container, 120, 45));
    fireEvent.click(dotAt(container, 180, 45));
    // 1 wrong attempt → 100 − 10 = 90 (the attempt genuinely cost score)
    expect(screen.getByTestId('phase-summary').textContent).toContain('score:90');
  });

  it('hard free_connect: same as medium — every star is clickable (6 hit circles)', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT], 'hard')} />);
    expect(hitCircles(container)).toHaveLength(6);
  });

  it('medium guided_trace: background stars STAY inert (order is the task)', () => {
    const { container } = render(<ConstellationBuilder data={makeData([GUIDED], 'medium')} />);
    expect(hitAt(container, 300, 225)).toBeUndefined();
    expect(hitCircles(container)).toHaveLength(4);             // member-flag stars only
    fireEvent.click(dotAt(container, 300, 225));
    expect(screen.queryByText(GENERIC)).toBeNull();
  });

  it('hard identify: stars stay non-interactive by design (no hit circles at all)', () => {
    const { container } = render(<ConstellationBuilder data={makeData([IDENTIFY], 'hard')} />);
    expect(hitCircles(container)).toHaveLength(0);
  });
});

// ============================================================================
// L3 — hint-text specificity (generic at medium/hard, never silent)
// ============================================================================

describe('constellation-builder tier · L3 hint specificity', () => {
  afterEach(cleanup);

  it('legacy guided wrong tap: the specific numbered-star hint', () => {
    const { container } = render(<ConstellationBuilder data={makeData([GUIDED])} />);
    fireEvent.click(dotAt(container, 120, 45)); // expected m1, tapped m2
    expect(screen.getByText(LEGACY_GUIDED_HINT)).toBeTruthy();
  });

  it('hard guided wrong tap: generic — but NEVER silent', () => {
    const { container } = render(<ConstellationBuilder data={makeData([GUIDED], 'hard')} />);
    fireEvent.click(dotAt(container, 120, 45));
    expect(screen.getByText(GENERIC)).toBeTruthy();
    expect(screen.queryByText(LEGACY_GUIDED_HINT)).toBeNull();
  });

  it('legacy free_connect wrong star names the discriminating feature ("brighter")', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT])} />);
    // m4 is member-flagged but outside the connections → clickable at legacy,
    // and the checker (constellationStarIds) rejects it.
    fireEvent.click(dotAt(container, 240, 45));
    expect(screen.getByText(LEGACY_WRONG_STAR)).toBeTruthy();
  });

  it('medium free_connect wrong star: generic', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT], 'medium')} />);
    fireEvent.click(dotAt(container, 300, 225));
    expect(screen.getByText(GENERIC)).toBeTruthy();
    expect(screen.queryByText(LEGACY_WRONG_STAR)).toBeNull();
  });

  it('legacy invalid pair: the specific not-connected hint', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT])} />);
    fireEvent.click(dotAt(container, 60, 45));   // select m1
    fireEvent.click(dotAt(container, 180, 45));  // m1–m3 is not a correct connection
    expect(screen.getByText(LEGACY_BAD_PAIR)).toBeTruthy();
  });

  it('hard invalid pair: generic', () => {
    const { container } = render(<ConstellationBuilder data={makeData([FREE_CONNECT], 'hard')} />);
    fireEvent.click(dotAt(container, 60, 45));
    fireEvent.click(dotAt(container, 180, 45));
    expect(screen.getByText(GENERIC)).toBeTruthy();
    expect(screen.queryByText(LEGACY_BAD_PAIR)).toBeNull();
  });
});

// ============================================================================
// F1 — seasonal option-pool collapse guard (ALL tiers)
// ============================================================================

describe('constellation-builder · F1 seasonal ≥2 options', () => {
  afterEach(cleanup);

  const optionButtons = () =>
    screen.getAllByRole('button').filter(b => b.textContent !== 'Check Answer');

  it('a collapsed 1-option pool is padded to 3 options, correct answer retained (no tier)', () => {
    render(<ConstellationBuilder data={makeData([SEASONAL_BARE])} />);
    const opts = optionButtons();
    expect(opts.length).toBe(3);
    expect(opts.map(b => b.textContent)).toContain('Cassiopeia');
  });

  it('padding applies at hard too — F1 is a defect fix, not a tier lever', () => {
    render(<ConstellationBuilder data={makeData([SEASONAL_BARE], 'hard')} />);
    const opts = optionButtons();
    expect(opts.length).toBe(3);
    expect(opts.map(b => b.textContent)).toContain('Cassiopeia');
  });

  it('a pool that already has ≥2 options is left untouched', () => {
    render(
      <ConstellationBuilder
        data={makeData([{ ...SEASONAL_BARE, distractorName0: 'Orion' }])}
      />,
    );
    const names = optionButtons().map(b => b.textContent);
    expect(names).toHaveLength(2);
    expect(new Set(names)).toEqual(new Set(['Cassiopeia', 'Orion']));
  });
});

// ============================================================================
// Task identity — guided ring + number survive the hard tier
// ============================================================================

describe('constellation-builder tier · guided ring is task identity', () => {
  afterEach(cleanup);

  it('hard guided_trace keeps the pulsing ring and the step number', () => {
    const { container } = render(<ConstellationBuilder data={makeData([GUIDED], 'hard')} />);
    expect(container.querySelector('circle[stroke-dasharray="3,3"]')).toBeTruthy();
    const stepNumber = Array.from(container.querySelectorAll('text'))
      .find(t => t.textContent === '1');
    expect(stepNumber).toBeTruthy();
  });
});
