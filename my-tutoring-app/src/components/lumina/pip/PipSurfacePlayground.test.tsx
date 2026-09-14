// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PipSurfacePlayground from './PipSurfacePlayground';

vi.mock('../utils/SoundManager', () => ({ SoundManager: { playById: vi.fn() } }));
afterEach(cleanup);

describe('Pip phase preview', () => {
  it('uses activity phases to drive one Pip, without animation commands', () => {
    const { container } = render(<PipSurfacePlayground />);
    const body = () => container.querySelector('[data-pip-surface-body]')!;
    expect(container.querySelectorAll('[data-pip-surface-body]')).toHaveLength(1);
    expect(body().getAttribute('data-pip-gesture')).toBe('point');
    fireEvent.click(screen.getByRole('button', { name: 'Start activity' }));
    expect(body().getAttribute('data-pip-phase')).toBe('working');
    const apple = screen.getByRole('button', { name: 'Apple 3' });
    fireEvent.click(apple);
    expect(apple.style.top).toBe('235px');
    expect(body().getAttribute('data-pip-gesture')).toBe('look');
    fireEvent.click(screen.getByRole('button', { name: 'Hand to Pip' }));
    expect(body().getAttribute('data-pip-gesture')).toBe('receive');
    expect(container.querySelector('[data-pip-hand="receive"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show success phase' }));
    expect(body().getAttribute('data-pip-phase')).toBe('celebrating');
    fireEvent.click(screen.getByRole('button', { name: 'New board' }));
    expect(apple.style.top).toBe('60px');
    expect(body().getAttribute('data-pip-phase')).toBe('introducing');
  });
});
