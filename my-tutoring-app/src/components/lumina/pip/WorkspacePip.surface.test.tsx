// @vitest-environment jsdom
/**
 * Pip on every boss that marks `<PipDock />` + `<PipWorkspace>` (`pip/WorkspacePip.tsx`), from the runner alone: one
 * test for the mechanic, run over each such boss's saved payload, in place of a hand-wired surface test per primitive.
 * Found from the bosses on disk, so a new boss is covered the day it lands.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { PipSurfaceStore } from './PipSurfaceStore';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const LUMINA = join(__dirname, '..');
const W1 = join(LUMINA, 'components/live-activity/runtime/testing/w1-payloads');
const read = (f: string) => readFileSync(f, 'utf8');
/** Each boss whose component marks Pip's layout, with its drive (component, instance, default mode). */
const bosses = (readdirSync(join(LUMINA, 'primitives'), { recursive: true }) as string[])
  .map(f => f.replace(/\\/g, '/')).filter(f => f.endsWith('.boss.ts'))
  .map(f => {
    const src = read(join(LUMINA, 'primitives', f));
    const field = (k: string) => src.match(new RegExp(`${k}: '([^']+)'`))?.[1] ?? '';
    return { id: src.match(/id: '([^']+)'/)?.[1] ?? read(join(LUMINA, 'primitives', f.replace('.boss.ts', '.card.ts'))).match(/id: '([^']+)'/)![1],
      component: field('component'), instanceId: field('instanceId'), mode: field('mode') };
  })
  .filter(b => /<PipWorkspace\b/.test(read(join(LUMINA, b.component))));

it('finds the bosses that take Pip from the runner', () => expect(bosses.map(b => b.id).sort()).toEqual(['3d-shape-explorer', 'addition-fact-strategies', 'analog-clock', 'bar-model', 'calendar-explorer', 'cause-effect-chain', 'cell-builder', 'classification-sorter', 'coin-counter', 'compare-objects', 'comparison-builder', 'constellation-builder', 'construction-sequence-planner', 'counting-board', 'cvc-speller', 'decodable-reader', 'di-word-problem-setup', 'energy-of-reactions', 'equation-balancer', 'era-explorer', 'fact-file', 'fast-fact', 'flight-forces-explorer', 'gas-laws-simulator', 'genre-explorer', 'gravity-drop-tower', 'habitat-diorama', 'how-it-works', 'hundreds-chart', 'interactive-book', 'length-lab', 'letter-sound-link', 'letter-spotter', 'light-shadow-lab', 'map-explorer', 'math-fact-fluency', 'matter-explorer', 'mission-planner', 'mixing-and-dissolving', 'oral-sentence-studio', 'orbit-mechanics-lab', 'ordinal-line', 'periodic-table', 'ph-explorer', 'phoneme-explorer', 'phonics-blender', 'picture-vocabulary', 'planetary-explorer', 'propulsion-lab', 'push-pull-arena', 'race-track-lab', 'reaction-lab', 'rhyme-studio', 'rocket-builder', 'sentence-analyzer', 'shape-sorter', 'skip-counting-runner', 'solar-system-explorer', 'sorting-station', 'sound-swap', 'sound-wave-explorer', 'spatial-path', 'spatial-scene', 'states-of-matter', 'stoichiometry-lab', 'story-bridge', 'story-ribbon', 'telescope-simulator', 'text-structure-analyzer', 'time-sequencer', 'timeline-explorer', 'transport-challenge', 'vehicle-comparison-lab', 'vocabulary-explorer', 'word-flip', 'word-sorter', 'word-workout', 'you-and-me']));

it.each(bosses.map(b => [b.id, b] as const))('%s: a dock, one workspace target, a point only on its own speech, a look at a touch', (_id, b) => {
  const store = new PipSurfaceStore();
  const data = JSON.parse(read(join(W1, `${b.id}.${b.mode}.json`))).data;
  const h = mountWorkspace({ primitiveId: b.id, evalMode: b.mode, data, instanceId: b.instanceId, pipStore: store });
  const pose = () => store.getActive()?.pose;
  expect(h.view.container.querySelector(`[data-pip-dock="${b.instanceId}"]`)).not.toBeNull();
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['workspace']);

  // Another block's speech is not this one's cue; this block's is.
  seam.activePrimitiveId = 'someone-else'; seam.audio = true; h.rerender();
  expect(pose()?.gesture).not.toBe('point');
  seam.audio = false; h.rerender();
  seam.activePrimitiveId = b.instanceId; seam.audio = true; h.rerender();
  expect(pose()).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
  seam.audio = false; h.rerender();

  const workspace = h.view.container.querySelector('[data-pip-object="workspace"]') as HTMLElement;
  const target = workspace.querySelector('button:not([disabled]), [role="button"]') ?? workspace;
  act(() => { fireEvent.pointerDown(target); });
  expect(pose()).toEqual({ phase: 'working', gesture: 'look', targetId: target === workspace ? 'workspace' : 'touched' });

  h.view.unmount();
  expect(store.getActive()).toBeNull();
});
