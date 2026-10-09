// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShapeComposer, { type ShapeComposerChallenge } from './ShapeComposer';
import { SHAPE_BUILD_MISS_WORDS } from './shapeComposerBuild';

vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: false, activePrimitiveId: null }),
}));
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

afterEach(cleanup);

const build: ShapeComposerChallenge = {
  id: 'fc0', type: 'free-create', instruction: 'Make your own picture with one square and one triangle. Every shape must touch another shape.',
  recipe: [{ shape: 'square', count: 1 }, { shape: 'triangle', count: 1 }],
};

describe('shape-composer free-create open build', () => {
  it('opens empty with the recipe drawn; a miss names the problem, keeps the build, and Start over clears it', () => {
    const { container } = render(<ShapeComposer data={{ title: 'Shapes', challenges: [build], gradeBand: 'K', instanceId: 'sc' }} />);
    const recipe = container.querySelector('[data-recipe]')!;
    expect(recipe.getAttribute('aria-label')).toBe('Shapes to use: one square and one triangle');
    expect(recipe.querySelectorAll('svg')).toHaveLength(2);
    const board = () => container.querySelectorAll('[data-pip-object="canvas"] svg [data-shape]').length;
    expect(board()).toBe(0);
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);

    // The K palette offers every K shape, not only the asked ones.
    const palette = container.querySelector('[data-pip-object="palette"]') as HTMLElement;
    expect(within(palette).getAllByRole('button')).toHaveLength(4);

    fireEvent.click(within(palette).getByRole('button', { name: /square/ }));
    fireEvent.click(screen.getByRole('button', { name: "I'm done!" }));
    expect(screen.getByText(SHAPE_BUILD_MISS_WORDS.missing_piece)).toBeTruthy();
    expect(board()).toBe(1);

    // New pieces land apart, so two asked pieces placed and not joined read as not touching.
    fireEvent.click(within(palette).getByRole('button', { name: /triangle/ }));
    fireEvent.click(screen.getByRole('button', { name: "I'm done!" }));
    expect(screen.getByText(SHAPE_BUILD_MISS_WORDS.not_touching)).toBeTruthy();
    expect(board()).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(board()).toBe(0);
  });

  it('an older payload with no recipe keeps the any-two-shapes check', () => {
    const old: ShapeComposerChallenge = { id: 'old', type: 'free-create', instruction: 'Build anything!' };
    const { container } = render(<ShapeComposer data={{ title: 'Shapes', challenges: [old, { ...old, id: 'old2' }], gradeBand: 'K' }} />);
    expect(container.querySelector('[data-recipe]')).toBeNull();
    const palette = container.querySelector('[data-pip-object="palette"]') as HTMLElement;
    fireEvent.click(within(palette).getByRole('button', { name: /circle/ }));
    fireEvent.click(within(palette).getByRole('button', { name: /square/ }));
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
    expect(screen.getByText('Amazing creation! 🎉')).toBeTruthy();
  });
});
