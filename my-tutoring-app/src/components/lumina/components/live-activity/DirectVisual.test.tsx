// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DirectVisual, { type DirectVisualControls } from './DirectVisual';
import { parseDirectVisual } from './directVisualContract';

let frames: FrameRequestCallback[];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { frames.push(f); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const paint = () => act(() => { frames.splice(0).forEach(f => f(0)); });

it('mounts counters without generation, streams removals, and points without clearing student work', () => {
  const visible = vi.fn(), state = vi.fn();
  let controls: DirectVisualControls | null = null;
  const register = (value: DirectVisualControls | null) => { controls = value; };
  render(<DirectVisual data={{ kind: 'counters', count: 6, layout: 'ten_frame', instruction: 'Take away two.', removedIndices: [], highlightedIndices: [] }}
    onVisible={visible} onState={state} onControls={register} />);
  expect(screen.getAllByRole('button')).toHaveLength(6);
  paint(); expect(visible).not.toHaveBeenCalled(); paint(); expect(visible).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Counter 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Counter 2' }));
  expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ remainingCount: 4, removedIndices: [0, 1] }));
  act(() => { expect(controls!.highlight([3])).toBe(true); });
  expect(controls!.getState()).toMatchObject({ highlightedIndices: [3], removedIndices: [0, 1], remainingCount: 4 });
  expect(controls!.highlight([6])).toBe(false);
});

it('uses equal fraction parts and reports actual shading', () => {
  const state = vi.fn();
  render(<DirectVisual data={{ kind: 'fraction', denominator: 4, shadedIndices: [0, 1, 2], instruction: 'Look at the shaded parts.', highlightedIndices: [] }}
    onVisible={vi.fn()} onState={state} onControls={vi.fn()} />);
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Part 4' }));
  expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ denominator: 4, shadedCount: 4 }));
});

it('preserves grapheme tiles and reports the selected sound unit', () => {
  const state = vi.fn();
  render(<DirectVisual data={{ kind: 'letters', tiles: ['sh', 'i', 'p'], selectedIndices: [], instruction: 'Blend these sounds.', highlightedIndices: [] }}
    onVisible={vi.fn()} onState={state} onControls={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Tile 1: sh' }));
  expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ selectedTiles: ['sh'], selectedIndices: [0] }));
});

it('rejects invalid visual shapes before rendering', () => {
  expect(() => parseDirectVisual({ kind: 'fraction', instruction: 'Try it', denominator: 0, shadedIndices: [], highlightedIndices: [] })).toThrow();
  expect(() => parseDirectVisual({ kind: 'letters', instruction: 'Try it', tiles: ['<div>'], selectedIndices: [], highlightedIndices: [] })).toThrow();
});
