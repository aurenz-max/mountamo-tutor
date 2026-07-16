// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for the K (PRE-band) interactions:
 *  1. act-out at K is DIRECT MANIPULATION (item 11): the scene is seeded with the
 *     story's startCount objects; the child taps objects to send them away
 *     (subtraction) or taps the Add control to bring more in (addition). The
 *     enacted scene count auto-judges — no number entry, no Check button.
 *  2. solve-story at K answers via TAPPING a number tile (item 1b — no typing,
 *     tap=choose); the correct tile completes the challenge.
 *  3. create-story is a BUILD-the-story production task at K — adding objects up to
 *     resultCount (addition) or removing down to it (subtraction) auto-judges.
 *
 * These are the behaviors tsc can't verify. External hooks (live tutor, evaluation,
 * audio) are mocked so we drive pure component logic.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true }),
}));
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

import AdditionSubtractionScene, { type AddSubChallenge } from '../AdditionSubtractionScene';

const baseData = (challenges: AddSubChallenge[]) => ({
  title: 'Reader-fit test',
  gradeBand: 'K' as const,
  maxNumber: 5,
  showTenFrame: false,
  showEquationBar: true,
  challenges,
});

const ch = (over: Partial<AddSubChallenge>): AddSubChallenge => ({
  id: 'c1', type: 'act-out', instruction: '', storyText: 's', scene: 'pond',
  objectType: 'ducks', operation: 'addition', storyType: 'join',
  startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3', ...over,
});

const sceneObjects = () => Array.from(document.querySelectorAll('svg g'));

// The (x,y) of each object's hit-target circle — its stable identity on screen.
const objectPositions = () =>
  sceneObjects().map((g) => {
    const c = g.querySelector('circle')!;
    return `${c.getAttribute('cx')},${c.getAttribute('cy')}`;
  });

beforeEach(() => cleanup());

describe('AdditionSubtractionScene reader-fit (K band)', () => {
  it('act-out subtraction at K: no typing; the scene seeds startCount objects and sending changeCount away auto-completes', async () => {
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'a1', type: 'act-out', operation: 'subtraction', storyType: 'separate', startCount: 4, changeCount: 2, resultCount: 2, equation: '4 - 2 = 2' }),
      ch({ id: 'a2', type: 'act-out', operation: 'subtraction', storyType: 'separate', startCount: 3, changeCount: 1, resultCount: 2, equation: '3 - 1 = 2' }),
    ])} />);

    // No keyboard and no proxy number tiles — the enacted scene IS the answer.
    expect(document.querySelector('input[type="number"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /^check/i })).toBeNull();
    // Scene starts pre-filled with startCount(4) tappable objects.
    expect(sceneObjects().length).toBe(4);
    // Each object MUST carry a hit-target <circle> — an SVG <g> paints nothing and
    // the emoji <text> is pointer-events:none, so without this the object is
    // unclickable in a real browser (jsdom can't hit-test; this guards the fix).
    expect(sceneObjects()[0].querySelector('circle')).not.toBeNull();
    // Tap two objects to send them away → reach result(2) → complete.
    fireEvent.click(sceneObjects()[0]);
    expect(screen.queryByText(/next challenge/i)).toBeNull(); // at 3, not done
    fireEvent.click(sceneObjects()[0]);
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('act-out subtraction at K: tapping a specific object removes THAT object — survivors keep their exact positions', () => {
    // Regression: the scene once tracked only a count, so removing recomputed positions
    // and always dropped the visually-last object — the child tapped one apple and a
    // DIFFERENT one vanished. Objects now carry stable slot ids keyed to fixed positions.
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'r1', type: 'act-out', operation: 'subtraction', storyType: 'separate', startCount: 5, changeCount: 2, resultCount: 3, equation: '5 - 2 = 3' }),
    ])} />);

    const before = objectPositions();
    expect(before.length).toBe(5);
    const tappedIndex = 1; // a middle object, not the last-positioned one
    const tappedPos = before[tappedIndex];

    fireEvent.click(sceneObjects()[tappedIndex]);

    const after = objectPositions();
    expect(after.length).toBe(4);
    // The tapped object's position is gone…
    expect(after).not.toContain(tappedPos);
    // …and every OTHER object is still exactly where it was (no reshuffle).
    expect(after).toEqual(before.filter((_, i) => i !== tappedIndex));
  });

  it('act-out addition at K: seeded with startCount; the Add control brings changeCount more in, auto-completing at resultCount', async () => {
    const user = userEvent.setup();
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'p1', type: 'act-out', operation: 'addition', storyType: 'join', startCount: 1, changeCount: 2, resultCount: 3, equation: '1 + 2 = 3' }),
      ch({ id: 'p2', type: 'act-out', operation: 'addition', storyType: 'join', startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3' }),
    ])} />);

    // Seeded with the start group (1); an Add control is the primary action, no Check.
    expect(screen.queryByRole('button', { name: /^check/i })).toBeNull();
    expect(sceneObjects().length).toBe(1);
    const addBtn = screen.getByRole('button', { name: /add one ducks/i });
    await user.click(addBtn); // 2
    expect(screen.queryByText(/next challenge/i)).toBeNull(); // not yet at 3
    await user.click(addBtn); // 3 → complete
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('solve-story at K (result-unknown): tapping a bunny counts it (highlight appears); the tile still answers', async () => {
    const user = userEvent.setup();
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'sc1', type: 'solve-story', operation: 'addition', storyType: 'join', startCount: 3, changeCount: 2, resultCount: 5, unknownPosition: 'result', equation: '3 + 2 = 5' }),
      ch({ id: 'sc2', type: 'solve-story', operation: 'addition', storyType: 'join', startCount: 2, changeCount: 1, resultCount: 3, unknownPosition: 'result', equation: '2 + 1 = 3' }),
    ])} />);

    // The scene shows resultCount(5) bunnies; before any tap, each object has only its
    // hit-target circle.
    expect(sceneObjects().length).toBe(5);
    const circlesBefore = document.querySelectorAll('svg circle').length;
    // Tapping a bunny tags it (highlight ring + ordinal badge appear) — the count aid.
    fireEvent.click(sceneObjects()[0]);
    expect(document.querySelectorAll('svg circle').length).toBeGreaterThan(circlesBefore);
    // The answer is still SELECTED from the tiles (count-and-report identity, 1b).
    await user.click(screen.getByRole('button', { name: '5' }));
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('solve-story at K: no text input; number tiles present; tapping the right tile completes (item 1b)', async () => {
    const user = userEvent.setup();
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 's1', type: 'solve-story', operation: 'addition', storyType: 'join', startCount: 2, changeCount: 1, resultCount: 3, unknownPosition: 'result', equation: '2 + 1 = 3' }),
      ch({ id: 's2', type: 'solve-story', operation: 'addition', storyType: 'join', startCount: 3, changeCount: 1, resultCount: 4, unknownPosition: 'result', equation: '3 + 1 = 4' }),
    ])} />);

    // No keyboard: the solve-story answer is a tapped numeral, not typed.
    expect(document.querySelector('input[type="number"]')).toBeNull();
    // Tapping the correct tile (3) atomically answers — Next Challenge appears.
    await user.click(screen.getByRole('button', { name: '3' }));
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('create-story addition at K: adding objects up to the total auto-completes (no Check)', async () => {
    const user = userEvent.setup();
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'b1', type: 'create-story', operation: 'addition', startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3' }),
      ch({ id: 'b2', type: 'act-out', resultCount: 2, startCount: 1, changeCount: 1, equation: '1 + 1 = 2' }),
    ])} />);

    // No Check button in the build task; an Add control is the primary action.
    expect(screen.queryByRole('button', { name: /^check/i })).toBeNull();
    const addBtn = screen.getByRole('button', { name: /add one ducks/i });
    // Build up to resultCount (3) — the third add completes the challenge.
    await user.click(addBtn);
    await user.click(addBtn);
    expect(screen.queryByText(/next challenge/i)).toBeNull(); // not yet at 3
    await user.click(addBtn);
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('create-story subtraction at K: removing objects down to the result auto-completes', async () => {
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'd1', type: 'create-story', operation: 'subtraction', startCount: 4, changeCount: 2, resultCount: 2, equation: '4 - 2 = 2' }),
      ch({ id: 'd2', type: 'act-out', resultCount: 2, startCount: 1, changeCount: 1, equation: '1 + 1 = 2' }),
    ])} />);

    // Subtraction pre-fills the scene with startCount(4) tappable objects.
    expect(sceneObjects().length).toBe(4);
    // Remove two (tap two objects) → reach result(2) → complete.
    fireEvent.click(sceneObjects()[0]);
    expect(screen.queryByText(/next challenge/i)).toBeNull(); // at 3, not done
    fireEvent.click(sceneObjects()[0]);
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });
});
