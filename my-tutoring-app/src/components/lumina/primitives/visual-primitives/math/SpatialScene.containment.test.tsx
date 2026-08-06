// @vitest-environment jsdom
/**
 * SpatialScene — the containment / two-reference interaction, driven.
 *
 * WHY A COMPONENT TEST AND NOT JUST THE GENERATOR SUITE: `place_in` inverts the rule
 * the tap surface was built on. `GridScene` gated the tap affordance on
 * `interactive && !obj`, and `renderPlace` returned early on an occupied cell — so a
 * correct containment answer was literally unclickable before this slice. That is a
 * runtime behavior a generator test and `tsc` are both blind to (CLAUDE.md verification
 * doctrine), so it is exercised here against the real component.
 *
 * Contract: `docs/contracts/spatial-scene.md` R11 (`place` → empty cell) and its
 * deliberate inversion for `place_in`.
 */
import React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SpatialScene, { type SpatialSceneChallenge, type SpatialSceneData } from './SpatialScene';

// The tutor socket, auth and the sound engine are not what is under test here.
vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: () => () => {} },
  db: {},
  app: {},
}));
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false }),
}));
vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    playCorrect: vi.fn(), playIncorrect: vi.fn(), select: vi.fn(), tap: vi.fn(), snap: vi.fn(),
    // The completion panel reads these on mount (a single-challenge deck finishes
    // as soon as the answer is right).
    isEnabled: () => false, getVolume: () => 0, celebrate: vi.fn(), play: vi.fn(),
  },
}));

afterEach(cleanup);

/** box occupies (1,1) — the containment answer cell. */
const PLACE_IN: SpatialSceneChallenge = {
  id: 'c1',
  type: 'place_in',
  instruction: 'Put the ball IN the box',
  hint: 'Which one could hold it?',
  sceneObjects: [
    { name: 'box', image: '📦', position: { row: 1, col: 1 } },
    { name: 'tree', image: '🌳', position: { row: 0, col: 0 } },
    { name: 'cat', image: '🐱', position: { row: 2, col: 2 } },
  ],
  targetObject: { name: 'ball', image: '⚽', position: { row: 0, col: 0 } },
  correctPosition: 'in',
  referenceObjectName: 'box',
  correctCell: { row: 1, col: 1 },
};

/** box(1,0) and tree(1,2) — the answer is the EMPTY cell (1,1) between them. */
const PLACE_BETWEEN: SpatialSceneChallenge = {
  id: 'c1',
  type: 'place_between',
  instruction: 'Put the ball BETWEEN the box and the tree',
  hint: 'One on each side.',
  sceneObjects: [
    { name: 'box', image: '📦', position: { row: 1, col: 0 } },
    { name: 'tree', image: '🌳', position: { row: 1, col: 2 } },
    { name: 'cat', image: '🐱', position: { row: 0, col: 0 } },
  ],
  targetObject: { name: 'ball', image: '⚽', position: { row: 0, col: 0 } },
  correctPosition: 'between',
  referenceObjectName: 'box',
  referenceObjectName2: 'tree',
  correctCell: { row: 1, col: 1 },
};

/** `place` — the legacy mode whose empty-cell rule must survive the fork. */
const PLACE: SpatialSceneChallenge = {
  id: 'c1',
  type: 'place',
  instruction: 'Put the ball above the box',
  hint: 'Above is higher up.',
  sceneObjects: [
    { name: 'box', image: '📦', position: { row: 2, col: 1 } },
    { name: 'tree', image: '🌳', position: { row: 0, col: 0 } },
  ],
  targetObject: { name: 'ball', image: '⚽', position: { row: 0, col: 0 } },
  correctPosition: 'above',
  correctCell: { row: 1, col: 1 },
};

function mount(challenge: SpatialSceneChallenge) {
  const data: SpatialSceneData = {
    title: 'Spatial Scene',
    // A second challenge keeps the deck open after the first is answered — a
    // one-item deck auto-submits and swaps the feedback for the summary panel.
    challenges: [challenge, { ...PLACE, id: 'filler' }],
    gridSize: 3,
    gradeBand: 'K',
    instanceId: `test-${challenge.type}`,
  };
  const { container } = render(<SpatialScene data={data} />);
  return container;
}

/** The 9 grid cells, in row-major order — the same order GridScene renders them. */
const cells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('button')).filter(
    (b) => b.className.includes('w-16'),
  );

const cellAt = (container: HTMLElement, row: number, col: number) => cells(container)[row * 3 + col];

const checkButton = () =>
  Array.from(document.querySelectorAll('button')).find((b) => /check/i.test(b.textContent ?? ''));

describe('place_in — the occupied container cell is the answer AND is tappable', () => {
  it('renders 9 grid cells with the container drawn on (1,1)', () => {
    const c = mount(PLACE_IN);
    expect(cells(c)).toHaveLength(9);
    expect(cellAt(c, 1, 1).textContent).toContain('📦');
  });

  it('REGRESSION: tapping the CONTAINER cell selects it (it was unclickable before)', () => {
    const c = mount(PLACE_IN);
    // Nothing selected yet → Check is disabled.
    expect(checkButton()?.hasAttribute('disabled')).toBe(true);
    fireEvent.click(cellAt(c, 1, 1));
    expect(checkButton()?.hasAttribute('disabled')).toBe(false);
  });

  it('checking the container cell is CORRECT and nests the object inside it', () => {
    const c = mount(PLACE_IN);
    fireEvent.click(cellAt(c, 1, 1));
    fireEvent.click(checkButton()!);
    expect(screen.getByText(/is in the box/i)).toBeTruthy();
    // The placed ball is drawn INSIDE the box's cell, not replacing it.
    const answerCell = cellAt(c, 1, 1);
    expect(answerCell.textContent).toContain('📦');
    expect(answerCell.textContent).toContain('⚽');
  });

  it('an empty cell is selectable but WRONG — "next to the box" is not "in the box"', () => {
    const c = mount(PLACE_IN);
    fireEvent.click(cellAt(c, 1, 2)); // empty, beside the container
    fireEvent.click(checkButton()!);
    expect(screen.getByText(/could hold it INSIDE/i)).toBeTruthy();
  });
});

describe('place_between — the empty cell between the two references', () => {
  it('the between cell is tappable and correct; a reference cell is not the answer', () => {
    const c = mount(PLACE_BETWEEN);
    fireEvent.click(cellAt(c, 1, 1));
    fireEvent.click(checkButton()!);
    // Distinct from the instruction, which contains the same phrase.
    expect(screen.getByText(/Perfect! The ball is between the box and the tree/i)).toBeTruthy();
  });

  it('tapping an occupied reference cell does nothing — R11 still holds here', () => {
    const c = mount(PLACE_BETWEEN);
    fireEvent.click(cellAt(c, 1, 0)); // the box itself
    expect(checkButton()?.hasAttribute('disabled')).toBe(true);
  });
});

describe('place — the legacy mode is untouched by the fork', () => {
  it('an occupied cell is still NOT selectable (contract R11)', () => {
    const c = mount(PLACE);
    fireEvent.click(cellAt(c, 2, 1)); // the box
    expect(checkButton()?.hasAttribute('disabled')).toBe(true);
  });

  it('an empty cell is selectable and judged by correctCell', () => {
    const c = mount(PLACE);
    fireEvent.click(cellAt(c, 1, 1));
    fireEvent.click(checkButton()!);
    expect(screen.getByText(/right spot/i)).toBeTruthy();
  });
});
