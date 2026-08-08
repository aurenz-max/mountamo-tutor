// @vitest-environment jsdom
/**
 * The perch rules decide whether Pip sits on the lesson or stays in the corner,
 * and a wrong answer puts the character on top of the work. jsdom can't see the
 * result, but it can hold the geometry: what counts as perchable, and where the
 * rim point lands once it is.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePerchAnchor } from './usePerchAnchor';

const EDGE_INSET = 28;
const TOP_SAFE = 96;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

function mountCard(id: string, rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-primitive-instance-id', id);
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...rect }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('usePerchAnchor', () => {
  it('perches on the card rim, inset from its right edge', () => {
    setViewport(1440, 900);
    mountCard('sec-1', { top: 300, bottom: 800, right: 1180, height: 500 });

    const { result } = renderHook(() => usePerchAnchor('sec-1', true));

    expect(result.current).toEqual({ x: 1180 - EDGE_INSET, y: 300 });
  });

  it('stays docked when there is nothing to sit on', () => {
    setViewport(1440, 900);
    mountCard('sec-1', { top: 300, bottom: 800, right: 1180, height: 500 });

    expect(renderHook(() => usePerchAnchor('sec-1', false)).result.current).toBeNull();
    expect(renderHook(() => usePerchAnchor(null, true)).result.current).toBeNull();
    expect(renderHook(() => usePerchAnchor('no-such-section', true)).result.current).toBeNull();
  });

  it('stays docked on a viewport too narrow to give up the space', () => {
    setViewport(820, 900);
    mountCard('sec-1', { top: 300, bottom: 800, right: 780, height: 500 });

    expect(renderHook(() => usePerchAnchor('sec-1', true)).result.current).toBeNull();
  });

  it('rides down inside a tall card whose rim has scrolled past the header', () => {
    setViewport(1440, 900);
    // Rim is 400px above the viewport top; the card still fills the screen.
    mountCard('tall', { top: -400, bottom: 1600, right: 1180, height: 2000 });

    const { result } = renderHook(() => usePerchAnchor('tall', true));

    // Clamped to just under the app header rather than following the rim off screen.
    expect(result.current).toEqual({ x: 1180 - EDGE_INSET, y: TOP_SAFE });
  });

  it('lets go once the card leaves the screen in either direction', () => {
    setViewport(1440, 900);
    mountCard('above', { top: -900, bottom: -40, right: 1180, height: 860 });
    mountCard('below', { top: 880, bottom: 1400, right: 1180, height: 520 });

    expect(renderHook(() => usePerchAnchor('above', true)).result.current).toBeNull();
    expect(renderHook(() => usePerchAnchor('below', true)).result.current).toBeNull();
  });

  it('treats an unlaid-out card as nothing to sit on', () => {
    setViewport(1440, 900);
    mountCard('empty', { top: 0, bottom: 0, right: 0, height: 0 });

    expect(renderHook(() => usePerchAnchor('empty', true)).result.current).toBeNull();
  });
});
