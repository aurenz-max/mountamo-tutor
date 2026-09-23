/**
 * What EVERY judged-runner adapter must be true about, proven once.
 *
 * Across the twelve adopted families these eight cases had been hand-written eight
 * to ten times each — roughly forty-two near-identical `it()` blocks. They are not
 * pedagogy; they are the closed action contract in `contract.ts` restated per
 * primitive. Restating a closed contract by hand is how a primitive silently skips
 * part of it, which is exactly what counting-board did: it shipped a mode advertising
 * a reminder and a detour that no test had ever mounted, because the mode list lived
 * in the test file's own fixture helper.
 *
 * So the mode list here comes from `LIVE_ADAPTERS`, the production registry the route
 * and the model both read. A mode added there and not classified below FAILS. A
 * primitive can no longer under-cover itself by forgetting to type a mode name.
 *
 * What this file deliberately does NOT own: which misstep each aid answers, and how a
 * child's answer routes between them. That is the primitive's teaching, it is written
 * beside the primitive, and a hint copied between primitives encodes the wrong one.
 */
import { expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { LIVE_ADAPTERS, type LivePrimitiveId } from '../../activityContract';
import { spokenLine } from '../contract';
import { statesNumber } from '../liveScaffolds';
import type { JudgedHarness } from './judgedRuntimeHarness';

/** The actions a judged-runner family may never advertise. The runner owns the clock. */
export const RUNNER_WITHHELD = ['advance', 'retry', 'point', 'request_support'] as const;

export interface JudgedConformanceSpec<Mode extends string> {
  /** The registry key. Its `modes` become this suite's coverage obligation. */
  primitiveId: LivePrimitiveId;
  /** Mount the real component in this mode, through `mountJudged`. */
  mount: (mode: Mode) => Promise<JudgedHarness>;
  /**
   * Modes that deliberately advertise NOTHING — a timed perceptual flash cannot be
   * re-shown mid-help. Listed rather than skipped, so the silence is a tested claim.
   */
  silentModes?: readonly Mode[];
  /** A fragment every method reminder's description must contain, e.g. what it does NOT draw. */
  reminderSays: string;
  /** A real strategyId from ANOTHER mode or family: it must be refused here. */
  foreignStrategyId: string;
  /** The mode the single-item refusal and fade cases run on. */
  pilotMode: Mode;
  /**
   * Drive to the item whose reminder the fade case paints, when a family's first
   * judged item is not the one carrying it. Used by that case ALONE — the answer
   * sweep and the replay case deliberately run on the item the child first meets.
   */
  reach?: (h: JudgedHarness) => Promise<void>;
  /** Answer wrongly, so the misstep aids this mode can offer become advertised. */
  provokeAid: (h: JudgedHarness, mode: Mode) => Promise<void>;
  /** Everything that would be an answer leak on this mode's mounted item. */
  leak: (mode: Mode) => { numbers?: readonly number[]; words?: readonly string[] };
}

export function describeJudgedConformance<Mode extends string>(spec: JudgedConformanceSpec<Mode>): void {
  const registered = LIVE_ADAPTERS[spec.primitiveId].modes as readonly Mode[];
  const silent = spec.silentModes ?? [];
  const active = registered.filter(m => !silent.includes(m));

  it('classifies every mode the live registry advertises for this family', () => {
    expect([...active, ...silent].sort()).toEqual([...registered].sort());
    // A family on the teaching workspace keeps this scripted path only for a mount with no pin.
    if (!LIVE_ADAPTERS[spec.primitiveId].bindsTeachingWorkspace) expect(LIVE_ADAPTERS[spec.primitiveId].teachingOwner).toBe('di-runner');
    expect(LIVE_ADAPTERS[spec.primitiveId].canAdvance).toBe(false);
  });

  it.each(active)('%s advertises replay and a method reminder, and no tutor clock', async mode => {
    const h = await spec.mount(mode);
    expect(h.runtime.getSnapshot().owner).toBe('runner');
    expect(h.types()).toContain('replay');
    expect(h.types()).toContain('scaffold');
    for (const withheld of RUNNER_WITHHELD) {
      expect(h.types(), `${mode} offered ${withheld}`).not.toContain(withheld);
    }
    const reminder = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
    expect(reminder.description).toContain(spec.reminderSays);
    expect(reminder.assistance).toEqual({ level: 1, answerExposure: 'none' });
  });

  it.each(active)('offers only %s’s method reminder before the child has answered', async mode => {
    const h = await spec.mount(mode);
    expect(h.strategies()).toHaveLength(1);
  });

  if (silent.length) {
    it.each(silent)('%s advertises nothing at all', async mode => {
      const h = await spec.mount(mode);
      expect(h.types()).toEqual([]);
    });
  }

  it.each(active)('no aid %s can offer states the answer', async mode => {
    const h = await spec.mount(mode);
    await spec.provokeAid(h, mode);
    const { numbers = [], words = [] } = spec.leak(mode);
    const aids = h.runtime.getSnapshot().affordances.filter(a => a.action.type === 'scaffold');
    expect(aids.length, `${mode} advertised no aid to sweep`).toBeGreaterThan(0);
    for (const aid of aids) {
      const id = (aid.action as { strategyId?: string }).strategyId;
      const spoken = spokenLine(aid);
      expect(spoken, `${mode} / ${id} quotes no spoken line`).toBeTruthy();
      for (const word of words) {
        expect(new RegExp(`\\b${word}\\b`, 'i').test(spoken), `${mode} / ${id} says "${word}"`).toBe(false);
      }
      for (const n of numbers) {
        expect(statesNumber(spoken, n), `${mode} / ${id} states ${n}`).toBe(false);
      }
    }
    cleanup();
  });

  it('refuses a stale item, a stale revision, an unknown strategy and a duplicate command', async () => {
    const h = await spec.mount(spec.pilotMode);
    const state = h.runtime.getSnapshot();
    const base = { sessionEpoch: state.sessionEpoch, instanceId: state.instanceId!, expectedRevision: state.revision };
    const itemId = state.task!.itemId;
    expect((await h.dispatch({ ...base, commandId: 'a', itemId: 'not-this-item', action: { type: 'replay' } })).status).toBe('stale');
    expect((await h.dispatch({ ...base, commandId: 'b', itemId, expectedRevision: state.revision + 5, action: { type: 'replay' } })).status).toBe('stale');
    expect((await h.dispatch({ ...base, commandId: 'c', itemId,
      action: { type: 'scaffold', strategyId: 'no-such-aid', direction: 1 } })).status).toBe('unsupported');
    // An aid that is real somewhere else is still unsupported here.
    expect((await h.dispatch({ ...base, commandId: 'd', itemId,
      action: { type: 'scaffold', strategyId: spec.foreignStrategyId, direction: 1 } })).status).toBe('unsupported');
    const replay = { ...base, commandId: 'same-id', itemId, action: { type: 'replay' } as const };
    expect((await h.dispatch(replay)).status).toBe('committed');
    expect((await h.dispatch(replay)).status).toBe('duplicate');
  });

  it('refuses every action after the learner stops', async () => {
    const h = await spec.mount(spec.pilotMode);
    const state = h.runtime.getSnapshot();
    await act(async () => { h.runtime.stop(); });
    expect(h.runtime.getSnapshot().affordances).toEqual([]);
    expect((await h.dispatch({ sessionEpoch: state.sessionEpoch, commandId: 'after-stop', instanceId: state.instanceId!,
      itemId: state.task!.itemId, expectedRevision: state.revision, action: { type: 'replay' } })).status).not.toBe('committed');
  });

  it('paints the method reminder, fades it back, and keeps the assistance history', async () => {
    const h = await spec.mount(spec.pilotMode);
    await spec.reach?.(h);
    // The reminder is the only aid offered before the child answers, so it needs no name here.
    const [reminder] = h.strategies();
    expect(reminder, 'no method reminder advertised').toBeTruthy();
    await h.strategy(reminder);
    expect(h.runtime.getSnapshot().task?.support.level).toBe(1);
    // The shared panel, not a per-primitive paragraph: one surface for every family.
    const panel = h.view.container.querySelector('[data-runtime-hint]');
    expect(panel, 'the aid painted no support panel').toBeTruthy();
    expect(panel!.textContent).toContain(spokenLine(
      h.runtime.getSnapshot().affordances.find(a => (a.action as any).strategyId === reminder)!));
    await h.strategy(reminder, -1);
    expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
    expect(h.runtime.getSnapshot().assistance.map(a => a.level)).toEqual([1, 0]);
    expect(h.view.container.querySelector('[data-runtime-hint]'), 'the fade left the aid on screen').toBeNull();
  });

  it('re-asks the same item on replay without changing it', async () => {
    const h = await spec.mount(spec.pilotMode);
    const before = h.runtime.getSnapshot().task!;
    await h.command('replay');
    const after = h.runtime.getSnapshot().task!;
    expect(after.itemId).toBe(before.itemId);
    expect(after.task).toBe(before.task);
    expect(after.demand).toEqual(before.demand);
  });
}
