// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for constellation-builder, on bound mounts (the component is taught only on
 * the teaching workspace; an unbound mount shows the shared "needs the tutor" card).
 *
 * The tier is render-support withdrawal only — it never changes the stars, the
 * challenges, the connections, or the answer. What it changes:
 *   L1 member-star highlight   easy/legacy = forced opacity-1 + bright #fffbe6
 *                              fill; medium/hard = uniform fill, magnitude-only
 *                              opacity (no membership render signal)
 *   L2 distractor interactivity easy/legacy = background stars inert;
 *                              medium/hard = clickable in free_connect ONLY,
 *                              a wrong tap is a checked miss via the existing
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
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import type { ConstellationBuilderData, ConstellationChallenge, StarData } from '../ConstellationBuilder';

let harness: WorkspaceHarness | null = null;
beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { harness?.close(); harness = null; cleanup(); restoreRuntimeTimers(); });

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

/** A bound mount, the way a lesson mounts it; its container stands in for render's. */
const mount = (data: ConstellationBuilderData) => {
  harness = mountWorkspace({ primitiveId: 'constellation-builder', evalMode: data.challenges[0].type, instanceId: 'constellation', data: data as unknown as Record<string, unknown> });
  harness.settle(1000);
  return { container: harness.view.container as HTMLElement };
};
const text = () => harness!.view.container.textContent ?? '';
const attempts = () => harness!.state().task!.workspace!.attempts;

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

  it('legacy (no tier): member star forced bright #fffbe6 + opacity 1; background dims by magnitude', () => {
    const { container } = mount(makeData([FREE_CONNECT]));
    const m1 = dotAt(container, 60, 45);
    expect(m1.getAttribute('fill')).toBe('#fffbe6');
    expect(opacityOf(m1)).toBeCloseTo(1, 5);
    const b1 = dotAt(container, 300, 225);
    expect(b1.getAttribute('fill')).toBe('#e2e8f0');
    expect(opacityOf(b1)).toBeCloseTo(0.25, 5); // mag 5 → floor
  });

  it('easy renders the member highlight identically to legacy', () => {
    const { container } = mount(makeData([FREE_CONNECT], 'easy'));
    const m1 = dotAt(container, 60, 45);
    expect(m1.getAttribute('fill')).toBe('#fffbe6');
    expect(opacityOf(m1)).toBeCloseTo(1, 5);
  });

  it('medium withdraws the membership signal: uniform fill, magnitude-only opacity', () => {
    const { container } = mount(makeData([FREE_CONNECT], 'medium'));
    const m1 = dotAt(container, 60, 45);
    expect(m1.getAttribute('fill')).toBe('#e2e8f0');         // no bright member fill
    expect(opacityOf(m1)).toBeCloseTo(0.85, 5);              // mag 1 → 1 − 0.15, NOT forced 1
    const b1 = dotAt(container, 300, 225);
    expect(opacityOf(b1)).toBeCloseTo(0.25, 5);              // background unchanged
  });

  it('hard renders all stars purely by magnitude — no membership signal', () => {
    const { container } = mount(makeData([FREE_CONNECT], 'hard'));
    expect(dotAt(container, 60, 45).getAttribute('fill')).toBe('#e2e8f0');
    expect(dotAt(container, 180, 45).getAttribute('fill')).toBe('#e2e8f0');
    expect(opacityOf(dotAt(container, 60, 45))).toBeCloseTo(0.85, 5);  // mag 1
    expect(opacityOf(dotAt(container, 180, 45))).toBeCloseTo(0.55, 5); // mag 3
  });

  it('identify at hard keeps its pre-drawn blue lines (task identity) while star styling follows L1', () => {
    const { container } = mount(makeData([IDENTIFY], 'hard'));
    expect(container.querySelectorAll('line[stroke="#60a5fa"]')).toHaveLength(2);
    expect(dotAt(container, 60, 45).getAttribute('fill')).toBe('#e2e8f0');
  });
});

// ============================================================================
// L2 — distractor-star interactivity (free_connect ONLY, medium/hard)
// ============================================================================

describe('constellation-builder tier · L2 distractor-star interactivity', () => {

  it('legacy free_connect: background stars are inert — no hit circle, no cursor, click does nothing', () => {
    const { container } = mount(makeData([FREE_CONNECT]));
    expect(hitAt(container, 300, 225)).toBeUndefined();
    const b1 = dotAt(container, 300, 225);
    expect(b1.getAttribute('class') ?? '').not.toContain('cursor-pointer');
    fireEvent.click(b1);
    expect(text()).not.toContain(LEGACY_WRONG_STAR);
    expect(text()).not.toContain(GENERIC);
  });

  it('easy free_connect: background stars stay inert (easy = legacy)', () => {
    const { container } = mount(makeData([FREE_CONNECT], 'easy'));
    expect(hitAt(container, 300, 225)).toBeUndefined();
    fireEvent.click(dotAt(container, 300, 225));
    expect(text()).not.toContain(GENERIC);
  });

  it('medium free_connect: a background-star tap fires the wrong-star branch and is a checked miss', () => {
    const { container } = mount(makeData([FREE_CONNECT], 'medium'));
    expect(hitAt(container, 300, 225)).toBeDefined();          // clickable now
    fireEvent.click(dotAt(container, 300, 225));               // wrong tap: a checked miss
    expect(text()).toContain(GENERIC);
    expect(attempts().at(-1)).toMatchObject({ correct: false, miss: 'background_star' });
    // Try again, then complete correctly: m1-m2, m2-m3
    harness!.dispatch('retry'); harness!.confirmVisible();
    fireEvent.click(dotAt(container, 60, 45));
    fireEvent.click(dotAt(container, 120, 45));
    fireEvent.click(dotAt(container, 120, 45));
    fireEvent.click(dotAt(container, 180, 45));
    harness!.settle();
    expect(attempts().map(a => a.correct)).toEqual([false, true]);
  });

  it('hard free_connect: same as medium — every star is clickable (6 hit circles)', () => {
    const { container } = mount(makeData([FREE_CONNECT], 'hard'));
    expect(hitCircles(container)).toHaveLength(6);
  });

  it('medium guided_trace: background stars STAY inert (order is the task)', () => {
    const { container } = mount(makeData([GUIDED], 'medium'));
    expect(hitAt(container, 300, 225)).toBeUndefined();
    expect(hitCircles(container)).toHaveLength(4);             // member-flag stars only
    fireEvent.click(dotAt(container, 300, 225));
    expect(text()).not.toContain(GENERIC);
  });

  it('hard identify: stars stay non-interactive by design (no hit circles at all)', () => {
    const { container } = mount(makeData([IDENTIFY], 'hard'));
    expect(hitCircles(container)).toHaveLength(0);
  });
});

// ============================================================================
// L3 — hint-text specificity (generic at medium/hard, never silent)
// ============================================================================

describe('constellation-builder tier · L3 hint specificity', () => {

  it('legacy guided wrong tap: the specific numbered-star hint', () => {
    const { container } = mount(makeData([GUIDED]));
    fireEvent.click(dotAt(container, 120, 45)); // expected m1, tapped m2
    expect(text()).toContain(LEGACY_GUIDED_HINT);
  });

  it('hard guided wrong tap: generic — but NEVER silent', () => {
    const { container } = mount(makeData([GUIDED], 'hard'));
    fireEvent.click(dotAt(container, 120, 45));
    expect(text()).toContain(GENERIC);
    expect(text()).not.toContain(LEGACY_GUIDED_HINT);
  });

  it('legacy free_connect wrong star names the discriminating feature ("brighter")', () => {
    const { container } = mount(makeData([FREE_CONNECT]));
    // m4 is member-flagged but outside the connections → clickable at legacy,
    // and the checker (constellationStarIds) rejects it.
    fireEvent.click(dotAt(container, 240, 45));
    expect(text()).toContain(LEGACY_WRONG_STAR);
  });

  it('medium free_connect wrong star: generic', () => {
    const { container } = mount(makeData([FREE_CONNECT], 'medium'));
    fireEvent.click(dotAt(container, 300, 225));
    expect(text()).toContain(GENERIC);
    expect(text()).not.toContain(LEGACY_WRONG_STAR);
  });

  it('legacy invalid pair: the specific not-connected hint', () => {
    const { container } = mount(makeData([FREE_CONNECT]));
    fireEvent.click(dotAt(container, 60, 45));   // select m1
    fireEvent.click(dotAt(container, 180, 45));  // m1–m3 is not a correct connection
    expect(text()).toContain(LEGACY_BAD_PAIR);
  });

  it('hard invalid pair: generic', () => {
    const { container } = mount(makeData([FREE_CONNECT], 'hard'));
    fireEvent.click(dotAt(container, 60, 45));
    fireEvent.click(dotAt(container, 180, 45));
    expect(text()).toContain(GENERIC);
    expect(text()).not.toContain(LEGACY_BAD_PAIR);
  });
});

// ============================================================================
// F1 — seasonal option-pool collapse guard (ALL tiers)
// ============================================================================

describe('constellation-builder · F1 seasonal ≥2 options', () => {

  const optionButtons = () => Array.from(harness!.view.container.querySelectorAll('button'))
    .filter(b => ['Cassiopeia', 'Orion', 'Ursa Major', 'Leo', 'Scorpius', 'Lyra'].includes(b.textContent ?? ''));

  it('a collapsed 1-option pool is padded to 3 options, correct answer retained (no tier)', () => {
    mount(makeData([SEASONAL_BARE]));
    const opts = optionButtons();
    expect(opts.length).toBe(3);
    expect(opts.map(b => b.textContent)).toContain('Cassiopeia');
  });

  it('padding applies at hard too — F1 is a defect fix, not a tier lever', () => {
    mount(makeData([SEASONAL_BARE], 'hard'));
    const opts = optionButtons();
    expect(opts.length).toBe(3);
    expect(opts.map(b => b.textContent)).toContain('Cassiopeia');
  });

  it('a pool that already has ≥2 options is left untouched', () => {
    mount(makeData([{ ...SEASONAL_BARE, distractorName0: 'Orion' }]));
    const names = optionButtons().map(b => b.textContent);
    expect(names).toHaveLength(2);
    expect(new Set(names)).toEqual(new Set(['Cassiopeia', 'Orion']));
  });
});

// ============================================================================
// Task identity — guided ring + number survive the hard tier
// ============================================================================

describe('constellation-builder tier · guided ring is task identity', () => {

  it('hard guided_trace keeps the pulsing ring and the step number', () => {
    const { container } = mount(makeData([GUIDED], 'hard'));
    expect(container.querySelector('circle[stroke-dasharray="3,3"]')).toBeTruthy();
    const stepNumber = Array.from(container.querySelectorAll('text'))
      .find(t => t.textContent === '1');
    expect(stepNumber).toBeTruthy();
  });
});
