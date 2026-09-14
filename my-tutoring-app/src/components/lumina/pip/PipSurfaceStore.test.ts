// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PipSurfaceStore, type PipPose, type PipSurface } from './PipSurfaceStore';

const dock = (id: string) => Object.assign(document.createElement('div'), { id });
const surface = (instanceId: string, pose: PipPose, d = dock(instanceId)): PipSurface =>
  ({ instanceId, scopeId: 'item', label: instanceId, dock: d, targets: [], pose });
const idle: PipPose = { phase: 'idle', gesture: 'none' };
const working: PipPose = { phase: 'working', gesture: 'none' };

describe('Pip joins surfaces from their own events, with no tutor session', () => {
  it('gives Pip to the first surface, then to whichever surface engages', () => {
    const store = new PipSurfaceStore();
    const a = dock('a'); const b = dock('b');
    store.publish(surface('a', idle, a));
    store.publish(surface('b', idle, b));
    expect(store.getActive()?.instanceId).toBe('a');
    store.publish(surface('b', working, b));
    expect(store.getActive()?.instanceId).toBe('b');
    store.publish(surface('a', { phase: 'working', gesture: 'look', targetId: 'x' }, a));
    expect(store.getActive()?.instanceId).toBe('a');
  });

  it('does not move Pip on a change into idle, or on a republish that changes nothing', () => {
    const store = new PipSurfaceStore();
    const a = dock('a'); const b = dock('b');
    store.publish(surface('a', working, a));
    store.publish(surface('b', working, b));
    store.publish(surface('b', idle, b));
    expect(store.getActive()?.instanceId).toBe('a');
    const listener = vi.fn();
    store.subscribe(listener);
    store.publish(surface('a', working, a));
    expect(listener).not.toHaveBeenCalled();
  });

  it('lets a host claim, parks Pip on a claimed block without a surface, and falls back on removal', () => {
    const store = new PipSurfaceStore();
    const a = dock('a'); const b = dock('b');
    store.publish(surface('a', working, a));
    store.publish(surface('b', working, b));
    store.setActive('b');
    expect(store.getActive()?.instanceId).toBe('b');
    store.setActive('no-surface-block');
    expect(store.getActive()).toBeNull();
    store.setActive('b');
    store.remove('b', b);
    expect(store.getActive()?.instanceId).toBe('a');
  });
});
