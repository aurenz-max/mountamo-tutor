import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeachingCapability } from './planLearningAdaptation';

const planner = vi.hoisted(() => vi.fn());
vi.mock('./planLearningAdaptation', () => ({ planLearningAdaptation: planner }));

import { adaptationObservations, adaptationTaskFor, planAdaptation, plannedMode, stampAdaptation } from './adaptationStep';

const capability: TeachingCapability<'contrast_a'> = { activity: 'a', task: 't', moves: [{ id: 'contrast_a', description: 'd' }] };
const ctx = { grade: '1', intent: 'i', objective: { text: 'o' }, learningObservations: [{ id: 'obs-1', summary: 'private' }] };
const task = adaptationTaskFor(ctx, 'topic', { mode: 'jump', tier: 'medium' });

beforeEach(() => { planner.mockReset(); planner.mockResolvedValue('contrast_a'); });

describe('plannedMode', () => {
  it('is the resolved catalog mode for one mode, from either resolution shape, and undefined for a blend or nothing', () => {
    expect(plannedMode({ modes: [{ evalMode: 'operate' }] })).toBe('operate');
    expect(plannedMode({ definition: { evalMode: 'jump' } })).toBe('jump');
    expect(plannedMode({ modes: [{ evalMode: 'a' }, { evalMode: 'b' }] })).toBeUndefined();
    expect(plannedMode({ modes: [] })).toBeUndefined();
    expect(plannedMode(null)).toBeUndefined();
    expect(plannedMode(undefined)).toBeUndefined();
  });
});

describe('adaptationTaskFor / adaptationObservations', () => {
  it('builds the planner task from the context and takes saved observations over the eval-test focus', () => {
    expect(task).toEqual({ grade: '1', topic: 'topic', intent: 'i', objectiveText: 'o', mode: 'jump', tier: 'medium' });
    expect(adaptationObservations(ctx)).toEqual([{ id: 'obs-1', summary: 'private' }]);
    expect(adaptationObservations({ remediationFocus: 'focus' })).toEqual([{ id: 'active-observation', summary: 'focus' }]);
    expect(adaptationObservations({ learningObservations: [], remediationFocus: 'focus' })).toEqual([{ id: 'active-observation', summary: 'focus' }]);
    expect(adaptationObservations({})).toEqual([]);
  });
});

describe('planAdaptation', () => {
  it('calls the planner only with a capability, observations and an eligible task', async () => {
    expect(await planAdaptation(ctx, { task, capability, eligible: () => true })).toBe('contrast_a');
    expect(planner).toHaveBeenCalledWith(capability, task, [{ id: 'obs-1', summary: 'private' }]);
    planner.mockClear();
    expect(await planAdaptation(ctx, { task, capability: null, eligible: () => true })).toBeNull();
    expect(await planAdaptation({ ...ctx, learningObservations: [] }, { task, capability, eligible: () => true })).toBeNull();
    expect(await planAdaptation(ctx, { task, capability, eligible: (t) => t.mode === 'operate' })).toBeNull();
    expect(planner).not.toHaveBeenCalled();
  });
  it('passes the planner\'s abstention through', async () => {
    planner.mockResolvedValue(null);
    expect(await planAdaptation(ctx, { task, capability, eligible: () => true })).toBeNull();
  });
});

describe('stampAdaptation', () => {
  it('is the one status mapping: no-focus becomes insufficient-capacity, nothing without a move or a selection', () => {
    expect(stampAdaptation('contrast_a', { status: 'targeted', count: 2 })).toEqual({ move: 'contrast_a', status: 'targeted', comparisonCount: 2 });
    expect(stampAdaptation('contrast_a', { status: 'already-targeted', count: 1 })).toEqual({ move: 'contrast_a', status: 'already-targeted', comparisonCount: 1 });
    expect(stampAdaptation('contrast_a', { status: 'insufficient-capacity', count: 0 })).toEqual({ move: 'contrast_a', status: 'insufficient-capacity', comparisonCount: 0 });
    expect(stampAdaptation('contrast_a', { status: 'no-focus', count: 0 })).toEqual({ move: 'contrast_a', status: 'insufficient-capacity', comparisonCount: 0 });
    expect(stampAdaptation(null, { status: 'targeted', count: 2 })).toBeUndefined();
    expect(stampAdaptation('contrast_a', null)).toBeUndefined();
  });
});
