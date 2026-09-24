// @vitest-environment jsdom
/**
 * The W1 contract, once for every family that binds the teaching workspace (handoff 15, "W1
 * verification"). Each case mounts the real registry component on a real generated payload (saved by
 * that family's smoke drive, `testing/w1-payloads/`) and checks what every binding owes, whatever the
 * primitive: the lesson binds the content, the tutor owns the surface with no scripted cue, the item
 * has a task, the packet carries the item and learner signals, the tutor is offered no observer-only
 * operation, and the lesson does not move, grade or submit without the learner.
 *
 * The family list comes from `LIVE_ADAPTERS`, so a newly bound family without a payload here FAILS.
 * Adding one: copy its smoke drive's `generatedData` into `w1-payloads/<id>.<mode>.json`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { LIVE_ADAPTERS, LIVE_PRIMITIVE_IDS } from '../activityContract';
import { workspaceBinding } from '../lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from './testing/liveRuntimeSeams';
import { mountWorkspace, OBSERVER_ONLY } from './testing/workspaceHarness';

interface Payload { source: string; primitiveId: string; evalMode: string; data: Record<string, unknown> }
const PAYLOAD_DIR = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS: Payload[] = readdirSync(PAYLOAD_DIR).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(PAYLOAD_DIR, f), 'utf-8')) as Payload)
  .sort((a, b) => `${a.primitiveId}.${a.evalMode}`.localeCompare(`${b.primitiveId}.${b.evalMode}`));
const BOUND = LIVE_PRIMITIVE_IDS.filter(id => LIVE_ADAPTERS[id].bindsTeachingWorkspace);
/** Scripted-cue protocol: a quoted line to recite, or a bracketed runner tag such as `[CO_ASK]`. */
const CUE_PROTOCOL = /say exactly|\[[A-Z]{2,}_[A-Z_]+/i;

beforeEach(() => {
  installRuntimeTimers();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 480,
    right: 760, bottom: 480, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

describe('every bound family', () => {
  it('has a saved generated payload here', () => {
    const covered = new Set(PAYLOADS.map(p => p.primitiveId));
    expect(BOUND.filter(id => !covered.has(id))).toEqual([]);
  });

  it.each(BOUND)('%s advertises exactly the catalog modes, with guidance that carries no cue protocol', id => {
    const adapter = LIVE_ADAPTERS[id];
    expect([...adapter.modes].sort()).toEqual((getComponentById(id)?.evalModes ?? []).map(m => m.evalMode).sort());
    expect(adapter).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null });
    expect(adapter.guidance).not.toMatch(CUE_PROTOCOL);
  });
});

describe.each(PAYLOADS)('$primitiveId $evalMode (saved payload)', ({ primitiveId, evalMode, data }) => {
  it('binds in a lesson and mounts under tutor ownership with a task and no scripted cue', () => {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId, pin: evalMode, objectiveIds: ['objective'], data }),
      'the lesson plan refuses this generated content').not.toBeNull();
    const h = mountWorkspace({ primitiveId, evalMode, data });
    const s = h.state();
    expect(s.owner).toBe('tutor');
    expect(s.task?.task?.trim(), 'the first item has no task').toBeTruthy();
    expect(s.task!.task).not.toMatch(CUE_PROTOCOL);
    const key = s.task!.workspace?.expectedAnswer;
    if (key !== undefined) expect(key.trim(), 'a spoken item publishes an empty key').toBeTruthy();
    expect(h.tutorTools().filter(t => (OBSERVER_ONLY as readonly string[]).includes(t))).toEqual([]);
    expect(seam.legacyAI, 'the legacy AI hook is live beside the workspace').not.toHaveBeenCalled();
    expect(seam.send.mock.calls.flat().filter(x => typeof x === 'string').join(' ')).not.toMatch(CUE_PROTOCOL);
  });

  it('sends the tutor the current item with learner signals', () => {
    const h = mountWorkspace({ primitiveId, evalMode, data });
    const packet = h.packet();
    expect(packet?.task?.itemId).toBe(h.state().task!.itemId);
    expect(packet?.learner?.signals).toMatchObject({ itemId: h.state().task!.itemId, attempts: 0, learnerTurns: 0 });
    h.close();
  });

  it('does not move, grade or submit on its own', () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId, evalMode, data });
    const before = h.state().task!;
    for (let s = 0; s < 12; s++) act(() => { vi.advanceTimersByTime(5000); });
    const after = h.state();
    expect(after.status).not.toBe('completed');
    expect(after.task!.itemId).toBe(before.itemId);
    expect(after.task!.evidence).toMatchObject({ attemptNumber: before.evidence.attemptNumber, correctness: 'unknown' });
    expect(h.offer('advance')).toBeUndefined();
    expect(seam.submit).not.toHaveBeenCalled();
  });
});
