// @vitest-environment jsdom
/**
 * Smoke contract for Pip. jsdom cannot see the animation, so this asserts only
 * what code can own: every mood mounts and transitions without throwing, the
 * character is a real control when pokeable (and inert when not), the poke
 * fires, and the window pointer listener is cleaned up. The performance itself
 * still needs a browser pass.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BROW, PipCharacter, type PipMood } from './PipCharacter';

vi.mock('../utils/SoundManager', () => ({
  SoundManager: { playById: vi.fn() },
}));

const MOODS: PipMood[] = ['sleeping', 'thinking', 'speaking', 'listening', 'happy', 'excited'];

afterEach(cleanup);

describe('PipCharacter', () => {
  it('mounts in every mood and survives transitions between them', () => {
    const { rerender } = render(<PipCharacter mood="happy" />);
    for (const mood of MOODS) {
      expect(() => rerender(<PipCharacter mood={mood} level={0.06} />)).not.toThrow();
    }
    // …and back through the wake path, which swaps the whole eye/mouth tree.
    expect(() => rerender(<PipCharacter mood="sleeping" />)).not.toThrow();
    expect(() => rerender(<PipCharacter mood="excited" />)).not.toThrow();
  });

  it('is a labelled button only when pokeable', () => {
    const onPoke = vi.fn();
    const { rerender } = render(<PipCharacter mood="sleeping" onPoke={onPoke} />);

    const pip = screen.getByRole('button');
    expect(pip.getAttribute('aria-label')).toMatch(/asleep/i);
    fireEvent.click(pip);
    expect(onPoke).toHaveBeenCalledTimes(1);

    rerender(<PipCharacter mood="happy" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Pip/);
  });

  it('tracks the pointer without crashing on zero-size layout, and unhooks on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<PipCharacter mood="happy" />);

    // jsdom reports a 0x0 rect; the guard must swallow it rather than divide by zero.
    expect(() => fireEvent.pointerMove(window, { clientX: 400, clientY: 220 })).not.toThrow();

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    removeSpy.mockRestore();
  });

  // Pip wears 'thinking' on every single turn, including the ones where a child
  // is stuck. A tutor that scowls while it waits is a pedagogical defect, not a
  // style nit — the first cut of this table mirrored a furrow and read as angry.
  it('never wears an angry brow in any mood', () => {
    for (const mood of MOODS) {
      const { left, right } = BROW[mood];
      const innerEndsDown = left.rotate > 0 && right.rotate < 0;
      expect(innerEndsDown, `${mood} furrows both inner brow ends downward`).toBe(false);
    }
  });

  it('carries "thinking" on asymmetry rather than a furrow', () => {
    const { left, right } = BROW.thinking;
    expect(left.y).not.toBe(right.y);
    // Small rotations only; the meaning must come from the height difference.
    expect(Math.abs(left.rotate)).toBeLessThanOrEqual(5);
    expect(Math.abs(right.rotate)).toBeLessThanOrEqual(5);
    // …but a WIDE gap stops reading as pondering and starts reading as "huh?".
    expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(4);
  });

  // Brows sit at y=39 and the body ellipse edge under their outer ends is at
  // y≈34, so a raise past -3.5 renders the brow floating off the top of the head.
  it('keeps every brow raise inside the head silhouette', () => {
    for (const mood of MOODS) {
      for (const side of ['left', 'right'] as const) {
        expect(BROW[mood][side].y, `${mood}.${side} lifts the brow off the head`)
          .toBeGreaterThanOrEqual(-3.5);
      }
    }
  });

  it('drops the pointer listener entirely when tracking is off', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(<PipCharacter mood="happy" trackPointer={false} />);
    expect(addSpy.mock.calls.some(([event]) => event === 'pointermove')).toBe(false);
    addSpy.mockRestore();
  });
});
