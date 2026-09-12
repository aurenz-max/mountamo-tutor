// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KindergartenStage } from './KindergartenStage';
import { ManifestOrderRenderer } from './ManifestOrderRenderer';
import type { OrderedComponent } from '../types';

const ctx = vi.hoisted(() => ({
  sessionMode: 'lesson', isConnected: true, activePrimitiveId: 'first',
  switchPrimitive: vi.fn(), sendText: vi.fn(),
}));
const openings = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/LuminaAIContext', () => ({ useLuminaAIContext: () => ctx }));
vi.mock('../evaluation', () => ({ useEvaluationContext: () => ({ submittedResults: [] }) }));
vi.mock('../contexts/ExhibitContext', () => ({ useExhibitContext: () => ({
  getObjectivesForComponent: () => [], manifestItems: [],
}) }));
vi.mock('./ObjectiveBadge', () => ({ ObjectiveBadge: () => null }));
vi.mock('../ui', () => ({ LuminaPanel: 'div', LuminaSectionLabel: 'span' }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: { pop: vi.fn() } }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../config/primitiveRegistry', () => ({
  getPrimitive: () => ({ component: Probe }),
  SectionHeader: () => null, CenteredSectionHeader: () => null,
}));
// Exercise mounted-frame focus; animation duration itself is not simulated.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: {
    div: ({ children }: any) => <div>{children}</div>,
    button: ({ children, initial, animate, exit, transition, ...props }: any) => <button {...props}>{children}</button>,
  },
}));
function Probe({ data }: any) {
  useEffect(() => { openings(data.id, ctx.activePrimitiveId); }, [data.id]);
  return <div>{data.id}</div>;
}
const sections: OrderedComponent[] = [
  { componentId: 'ten-frame', instanceId: 'first', title: 'First', data: { id: 'first' } },
  { componentId: 'number-line', instanceId: 'second', title: 'Second', data: { id: 'second' } },
];
let pick: () => void;
let nearest = 'first';
beforeEach(() => {
  vi.useFakeTimers();
  ctx.isConnected = true;
  ctx.activePrimitiveId = 'first';
  ctx.switchPrimitive.mockImplementation(({ instance_id }) => { ctx.activePrimitiveId = instance_id; });
  nearest = 'first';
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: () => void) { pick = callback; }
    observe() {} disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { top: this.dataset.primitiveInstanceId === nearest ? 0 : 2000,
      bottom: this.dataset.primitiveInstanceId === nearest ? 1000 : 3000 } as DOMRect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('focuses before the activity opening, without extra narration, including Back to first', () => {
  render(<KindergartenStage orderedComponents={sections} onFinished={vi.fn()} />);
  act(() => vi.advanceTimersByTime(2500));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(openings).toHaveBeenLastCalledWith('second', 'second');
  expect(ctx.sendText).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(ctx.activePrimitiveId).toBe('first');
  expect(openings).toHaveBeenLastCalledWith('first', 'first');
});

it('synchronizes the mounted stage when the connection becomes ready', () => {
  ctx.isConnected = false;
  const view = render(<KindergartenStage orderedComponents={sections} onFinished={vi.fn()} />);
  act(() => vi.advanceTimersByTime(2500));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(ctx.switchPrimitive).not.toHaveBeenCalled();
  ctx.isConnected = true;
  view.rerender(<KindergartenStage orderedComponents={sections} onFinished={vi.fn()} />);
  expect(ctx.activePrimitiveId).toBe('second');
});

it('hands off after 500ms in the same activity despite continuous observations', () => {
  render(<ManifestOrderRenderer orderedComponents={sections} />);
  nearest = 'second';
  act(() => pick());
  for (let i = 0; i < 4; i++) {
    act(() => vi.advanceTimersByTime(100));
    act(() => pick());
  }
  expect(ctx.switchPrimitive).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(100));
  expect(ctx.switchPrimitive).toHaveBeenCalledTimes(1);
  expect(ctx.activePrimitiveId).toBe('second');
});

it('cancels a pending handoff when the student scrolls back', () => {
  render(<ManifestOrderRenderer orderedComponents={sections} />);
  nearest = 'second';
  act(() => pick());
  act(() => vi.advanceTimersByTime(250));
  nearest = 'first';
  act(() => pick());
  act(() => vi.advanceTimersByTime(500));
  expect(ctx.switchPrimitive).not.toHaveBeenCalled();
});

it('rechecks the visible activity on connection without another scroll', () => {
  ctx.isConnected = false;
  nearest = 'second';
  const view = render(<ManifestOrderRenderer orderedComponents={sections} />);
  act(() => vi.advanceTimersByTime(500));
  expect(ctx.switchPrimitive).not.toHaveBeenCalled();
  ctx.isConnected = true;
  view.rerender(<ManifestOrderRenderer orderedComponents={sections} />);
  act(() => vi.advanceTimersByTime(500));
  expect(ctx.activePrimitiveId).toBe('second');
});
