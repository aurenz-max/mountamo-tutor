// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LeverLab, { type LeverLabData } from './LeverLab';
import { LEVER_MISS_WORDS, type LeverBuildChallenge } from './leverLabBuild';

const submitResult = vi.fn();
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult, hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

afterEach(() => { cleanup(); submitResult.mockClear(); });

const given = [{ seat: -3, weight: 2, icon: '🧒' }];
const challenges: LeverBuildChallenge[] = [
  { id: 'b1', type: 'build_balance', instruction: 'Make the seesaw balance.', given, palette: [1, 2, 3, 4] },
  { id: 'b2', type: 'build_balance', instruction: 'Balance it a different way.', given, palette: [1, 2, 3, 4], differentFrom: 'b1' },
  { id: 'l1', type: 'build_lift', instruction: 'Build a lever that lifts the rock.', rockWeight: 6, pusherWeight: 2 },
];
const data = {
  title: 'Seesaw', description: '', beamLength: 10, fulcrumPosition: 5, fixedFulcrum: true, loads: [], showDistances: false,
  showMA: false, effortInput: 'slider', theme: 'seesaw', challenges, instanceId: 'lever-test',
} as LeverLabData;

const scene = (c: HTMLElement) => c.querySelector('svg[data-build-scene]')!;
const done = () => fireEvent.click(screen.getByRole('button', { name: "I'm done!" }));
const pick = (w: number) => fireEvent.click(screen.getByRole('button', { name: `Kid who weighs ${w}` }));
const seat = (c: HTMLElement, d: number) => fireEvent.click(scene(c).querySelector(`[data-seat="${d}"]`)!);

describe('lever-lab open builds', () => {
  it('balance: over -> named miss, Try again keeps the build, fix -> pass; a repeat is refused; lift miss -> pass; submits', () => {
    const { container } = render(<LeverLab data={data} />);
    // Empty right side, blocks under the seesaw, nothing to check yet, no running total anywhere.
    expect(scene(container).querySelectorAll('[data-placed]')).toHaveLength(0);
    expect(scene(container).querySelectorAll('[data-chock]')).toHaveLength(2);
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);

    // One over: a 4 at seat 2 turns 8 against 6.
    pick(4); seat(container, 2); done();
    expect(screen.getByText(`Not yet. ${LEVER_MISS_WORDS.build_balance.right_down}`)).toBeTruthy();
    expect(scene(container).querySelectorAll('[data-chock]')).toHaveLength(0);
    expect(scene(container).querySelector('[data-beam]')!.getAttribute('data-tilt')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(scene(container).querySelectorAll('[data-placed]')).toHaveLength(1);

    // Swap for a 3 at seat 2: level.
    fireEvent.click(scene(container).querySelector('[data-placed="2"]')!);
    pick(3); seat(container, 2); done();
    expect(screen.getByText(/the seesaw stayed level/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));

    // Item 2 opens empty; the same seating is refused; a different one passes.
    expect(scene(container).querySelectorAll('[data-placed]')).toHaveLength(0);
    pick(3); seat(container, 2); done();
    expect(screen.getByText(`Not yet. ${LEVER_MISS_WORDS.build_balance.same_way}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(scene(container).querySelectorAll('[data-placed]')).toHaveLength(0);
    pick(1); seat(container, 5); seat(container, 1); done();
    expect(screen.getByText(/the seesaw stayed level/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));

    // Lift: fulcrum at 4 is too far from the rock for the helper; at 2 it lifts.
    expect(scene(container).getAttribute('data-build-scene')).toBe('lift');
    fireEvent.click(scene(container).querySelector('[data-fulcrum-slot="4"]')!);
    fireEvent.click(scene(container).querySelector('[data-spot="10"]')!);
    done();
    expect(screen.getByText(`Not yet. ${LEVER_MISS_WORDS.build_lift.too_weak}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(scene(container).querySelector('[data-pusher="10"]')).toBeTruthy();
    fireEvent.click(scene(container).querySelector('[data-fulcrum="4"]')!);
    fireEvent.click(scene(container).querySelector('[data-fulcrum-slot="2"]')!);
    done();
    expect(screen.getByText(/lifted the rock/)).toBeTruthy();
    expect(submitResult).toHaveBeenCalledTimes(1);
    const [success, score, metrics, , , evidence] = submitResult.mock.calls[0];
    expect([success, score]).toEqual([true, 67]);
    expect(metrics).toMatchObject({ type: 'lever-lab', evalMode: 'mixed', challengesSolved: 3, firstTryCorrect: 0,
      misses: { right_down: 1, same_way: 1, too_weak: 1 } });
    expect(evidence.firstResponseScore).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'See results →' }));
    expect(screen.getByText(/Lever Lab Complete!/)).toBeTruthy();
  });

  it('weights, seat numbers and ghost seats are aids; the picture keeps only the scene and the kids', () => {
    const { container } = render(<LeverLab data={data} />);
    pick(2); seat(container, 4);
    const svg = scene(container);
    expect(svg.querySelectorAll('[data-seat]').length).toBe(4);
    svg.querySelectorAll('[data-seat]').forEach(n => expect(n.hasAttribute('data-aid')).toBe(true));
    // No total or target on screen.
    expect(container.textContent).not.toMatch(/torque|total|6/i);
  });

  it('an older payload with no challenges keeps the sandbox', () => {
    const old = { ...data, challenges: undefined, loads: [{ position: 2, weight: 3, isDraggable: true }, { position: 7, weight: 2, isDraggable: true }] } as LeverLabData;
    render(<LeverLab data={old} />);
    expect(screen.getByText('UNBALANCED')).toBeTruthy();
    expect(screen.queryByRole('button', { name: "I'm done!" })).toBeNull();
  });
});
