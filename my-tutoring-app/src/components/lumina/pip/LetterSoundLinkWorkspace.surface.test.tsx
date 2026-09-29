// @vitest-environment jsdom
/**
 * Pip on letter-sound-link's TEACHING mount (the workspace a lesson and the helper render), on each
 * eval mode's saved generated payload under the real runtime. The scripted mount is covered by
 * `LetterSoundLink.surface.test.tsx`; both share `letterSoundLinkPipPose`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { PipSurfaceStore } from './PipSurfaceStore';

interface Payload { primitiveId: string; evalMode: string; data: { challenges: Array<{ targetLetter: string;
  options?: Array<{ letter?: string; isCorrect: boolean }> }> } & Record<string, unknown> }
const DIR = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
const load = (mode: string) => JSON.parse(readFileSync(join(DIR, `letter-sound-link.${mode}.json`), 'utf-8')) as Payload;

beforeEach(installRuntimeTimers);
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const mount = (payload: Payload) => {
  const store = new PipSurfaceStore();
  const h = mountWorkspace({ primitiveId: payload.primitiveId, evalMode: payload.evalMode, data: payload.data, pipStore: store });
  return { ...h, store, pose: () => store.getActive()?.pose, scope: () => store.getActive()?.scopeId,
    ids: () => store.getActive()?.targets.map(t => t.id).sort() };
};
const CELEBRATE = { phase: 'celebrating', gesture: 'none' };

describe.each(['see_hear', 'keyword_match'])('%s (spoken)', mode => {
  it('docks one surface; points at the letter card only while the tutor speaks; never registers a picture', () => {
    const h = mount(load(mode));
    expect(h.view.container.querySelector('[data-pip-dock="ws"]')).not.toBeNull();
    expect(h.ids()).toEqual(['letter']);
    expect(h.pose()).toEqual({ phase: 'working', gesture: 'look', targetId: 'letter' });
    h.speak(true);
    expect(h.pose()).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letter' });
    h.speak(false);
  });

  it('a miss is not celebrated; a held credit is; an advanced credit holds until the new item is cued', () => {
    const h = mount(load(mode));
    h.say('banana'); h.feedback('incorrect', 'none'); h.confirmVisible();
    expect(h.pose()?.phase).not.toBe('celebrating');
    h.say('right answer'); h.feedback('correct', 'none'); h.confirmVisible();
    expect(h.pose()).toEqual(CELEBRATE);
    const first = h.scope();
    h.speak(true);
    h.dispatch('advance'); h.confirmVisible();
    expect(h.scope()).not.toBe(first);
    expect(h.pose()).toEqual(CELEBRATE);
    h.speak(false); h.speak(true);
    expect(h.pose()).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letter' });
  });
});

describe('hear_see (tap)', () => {
  it('outlines the two letters only as a group, never the target; watches the tapped letter', () => {
    const payload = load('hear_see');
    const h = mount(payload);
    expect(h.ids()).toEqual(expect.arrayContaining(['options']));
    expect(h.ids()).not.toContain('letter');
    h.speak(true);
    expect(h.pose()).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'options' });
    h.speak(false);
    expect(h.pose()).toEqual({ phase: 'working', gesture: 'look', targetId: 'options' });
    const first = payload.data.challenges[0];
    const wrong = first.options!.find(o => !o.isCorrect)!.letter!;
    h.touch(`option-${wrong}`);
    expect(h.pose()).toEqual({ phase: 'working', gesture: 'look', targetId: `option-${wrong}` });
    expect(h.pose()?.phase).not.toBe('celebrating');
  });

  it('celebrates only a correct tap', () => {
    const payload = load('hear_see');
    const h = mount(payload);
    h.touch(`option-${payload.data.challenges[0].targetLetter}`);
    expect(h.pose()).toEqual(CELEBRATE);
  });

  it('leaves the store on unmount', () => {
    const h = mount(load('hear_see'));
    expect(h.store.getActive()).not.toBeNull();
    h.view.unmount();
    expect(h.store.getActive()).toBeNull();
  });
});
