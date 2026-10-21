// @vitest-environment jsdom
/** shape-composer's free-create open build, mounted on the teaching workspace the way a lesson mounts it. */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, within } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { ShapeComposerChallenge } from './ShapeComposer';
import { SHAPE_BUILD_MISS_WORDS } from './shapeComposerBuild';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const build: ShapeComposerChallenge = {
  id: 'fc0', type: 'free-create', instruction: 'Make your own picture with one square and one triangle. Every shape must touch another shape.',
  recipe: [{ shape: 'square', count: 1 }, { shape: 'triangle', count: 1 }],
};
const mount = (challenges: ShapeComposerChallenge[]) =>
  mountWorkspace({ primitiveId: 'shape-composer', evalMode: 'free-create', data: { title: 'Shapes', gradeBand: 'K', challenges } });

describe('shape-composer free-create open build', () => {
  it('opens empty with the recipe drawn; a miss names the problem, keeps the build, and Start over clears it', () => {
    const h = mount([build]);
    const { container } = h.view;
    const recipe = container.querySelector('[data-recipe]')!;
    expect(recipe.getAttribute('aria-label')).toBe('Shapes to use: one square and one triangle');
    expect(recipe.querySelectorAll('svg')).toHaveLength(2);
    const board = () => container.querySelectorAll('[data-part="canvas"] svg [data-shape]').length;
    const done = () => within(container).getByRole('button', { name: "I'm done!" }) as HTMLButtonElement;
    expect(board()).toBe(0);
    expect(done().disabled).toBe(true);

    // The K palette offers every K shape, not only the asked ones.
    const palette = () => container.querySelector('[data-part="palette"]') as HTMLElement;
    expect(within(palette()).getAllByRole('button')).toHaveLength(4);

    h.press('square'); h.press("I'm done!");
    expect(container.textContent).toContain(SHAPE_BUILD_MISS_WORDS.missing_piece);
    expect(board()).toBe(1);

    // New pieces land apart, so two asked pieces placed and not joined read as not touching.
    h.dispatch('retry');
    h.press('triangle'); h.press("I'm done!");
    expect(container.textContent).toContain(SHAPE_BUILD_MISS_WORDS.not_touching);
    expect(board()).toBe(2);

    h.dispatch('retry');
    h.press('Start over');
    expect(board()).toBe(0);
  });

  it('an older payload with no recipe keeps the any-two-shapes check', () => {
    const old: ShapeComposerChallenge = { id: 'old', type: 'free-create', instruction: 'Build anything!' };
    const h = mount([old, { ...old, id: 'old2' }]);
    expect(h.view.container.querySelector('[data-recipe]')).toBeNull();
    h.press('circle'); h.press('square'); h.press(/check answer/i);
    expect(h.view.container.textContent).toContain('Amazing creation! 🎉');
  });
});
