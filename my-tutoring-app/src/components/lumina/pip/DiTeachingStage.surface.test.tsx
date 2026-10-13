// @vitest-environment jsdom
/**
 * Pip on `DiTeachingStage`, once for every spoken DI pack it hosts, on each pack's saved generated
 * payload under the real runtime: Pip outlines the stimulus as a whole, points only while this item's
 * utterance plays, and celebrates only a COMMITTED credit — held or advanced — never a miss and never
 * the new item's own ask.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { PipSurfaceStore } from './PipSurfaceStore';
import { BUILD_WITNESSES, WRONG_BUILD } from '../primitives/visual-primitives/direct-instruction/diShapesBuild';

interface Payload { primitiveId: string; evalMode: string; data: Record<string, unknown> }
const DIR = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
const STAGE_PACKS = ['di-letter-sounds', 'di-math-facts', 'di-sentence-reading', 'di-shapes', 'di-word-reading'];
const PAYLOADS: Payload[] = readdirSync(DIR).filter(f => STAGE_PACKS.some(id => f.startsWith(`${id}.`)))
  .map(f => JSON.parse(readFileSync(join(DIR, f), 'utf-8')) as Payload);

beforeEach(installRuntimeTimers);
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const mount = ({ primitiveId, evalMode, data }: Payload) => {
  const store = new PipSurfaceStore();
  const h = mountWorkspace({ primitiveId, evalMode, data, pipStore: store });
  return { ...h, store, pose: () => store.getActive()?.pose, scope: () => store.getActive()?.scopeId };
};
type Mounted = ReturnType<typeof mount>;
/** A spoken item is answered aloud and judged by the tutor; a build item (di-shapes build_shape) on the board. */
const answer = (h: Mounted, payload: Payload, right: boolean, transition: 'none' | 'advance') => {
  const item = (payload.data.challenges as Array<{ id: string; challengeType: string; shape: string }>)
    .find(c => c.id === h.state().task!.itemId)!;
  if (item.challengeType !== 'build_shape') {
    h.say(right ? 'right answer' : 'banana'); h.feedback(right ? 'correct' : 'incorrect', transition); h.confirmVisible();
    return;
  }
  if (h.view.container.querySelector('[data-corner]')) h.press('Clear Shape');
  const pts = right ? BUILD_WITNESSES[item.shape][0] : item.shape === 'triangle' ? WRONG_BUILD.triangle : WRONG_BUILD.other;
  for (const p of [...pts, pts[0]]) h.touch(`dot-${p.x}-${p.y}`);
  h.press("I'm done!");
  if (transition === 'advance') h.dispatch('advance');
  h.confirmVisible();
};

const POINT = { phase: 'introducing', gesture: 'point', targetId: 'stimulus' };
const LOOK = { phase: 'working', gesture: 'look', targetId: 'stimulus' };
const CELEBRATE = { phase: 'celebrating', gesture: 'none' };

it('covers every pack the stage hosts', () => {
  expect(Array.from(new Set(PAYLOADS.map(p => p.primitiveId))).sort()).toEqual(STAGE_PACKS);
});

describe.each(PAYLOADS)('$primitiveId $evalMode', payload => {
  it('docks one surface on the whole stimulus; points only while the tutor speaks', () => {
    const h = mount(payload);
    expect(h.view.container.querySelector('[data-pip-dock="ws"]')).not.toBeNull();
    expect(h.store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
    expect(h.pose()).toEqual(LOOK);
    h.speak(true);
    expect(h.pose()).toEqual(POINT);
    h.speak(false);
    expect(h.pose()).toEqual(LOOK);
  });

  it('a miss is not celebrated; a held credit is', () => {
    const h = mount(payload);
    answer(h, payload, false, 'none');
    expect(h.pose()?.phase).not.toBe('celebrating');
    if (h.state().task!.workspace!.attempts.at(-1)?.miss) h.dispatch('retry');
    answer(h, payload, true, 'none');
    expect(h.pose()).toEqual(CELEBRATE);
  });

  it('a credit that advances is held over the praise tail, then yields to the new item\'s ask', () => {
    const items = (payload.data.challenges as unknown[] | undefined)?.length ?? 0;
    if (items < 2) return;
    const h = mount(payload);
    const first = h.scope();
    h.speak(true);
    answer(h, payload, true, 'advance');
    expect(h.scope()).not.toBe(first);
    expect(h.pose()).toEqual(CELEBRATE);  // the praise began on the credited item
    h.speak(false);
    expect(h.pose()).toEqual(CELEBRATE);  // still no ask on the new item
    h.speak(true);
    expect(h.pose()).toEqual(POINT);      // the new item's first utterance is its cue
    h.speak(false);
    expect(h.pose()).toEqual(LOOK);       // and the hold never returns
  });

  it('leaves the store on unmount', () => {
    const h = mount(payload);
    expect(h.store.getActive()).not.toBeNull();
    h.view.unmount();
    expect(h.store.getActive()).toBeNull();
  });
});
