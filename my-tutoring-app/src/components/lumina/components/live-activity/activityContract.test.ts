import { describe, expect, it } from 'vitest';
import { initialActivityState, parseActivityRequest, validateActivityData, validateTenFrameData, validateShapeSorterData,
  generatedActivityState, LIVE_ADAPTERS, LIVE_PRIMITIVE_IDS, type LiveActivityAdapter } from './activityContract';
import { getComponentById } from '../../service/manifest/catalog';

export const fixture = () => ({ title: 'Subtraction within 10', range: { min: 0, max: 10 },
  interactionMode: 'jump' as const, challenges: [{ id: 'c1', type: 'show_jump' as const,
    instruction: 'Start at 7 and subtract 3.', hint: 'Move left.', startValue: 7, targetValues: [4],
    operations: [{ type: 'subtract' as const, startValue: 7, changeValue: 3, showJumpArc: true }],
  }],
});

describe('live activity boundary', () => {
  it('advertises the shape workspace across every catalog mode and rejects shapes it cannot draw truthfully', () => {
    const data = { title: 'Shapes', gradeBand: 'K', challenges: [{ id: 'c1', type: 'identify', ruleAttribute: 'shape',
      instruction: 'Name it.', shapes: [{ shape: 'triangle', color: 'red', size: 'medium', rotation: 0 }] }] };
    expect(generatedActivityState('shape-sorter', validateShapeSorterData(data))).toMatchObject({ teachingOwner: 'tutor', totalChallenges: 1 });
    expect(LIVE_ADAPTERS['shape-sorter']).toMatchObject({ tutoring: null, canAdvance: false,
      modes: ['identify', 'find_real_object', 'count', 'sort'] });
    // A shape whose real-object fields are unusable for its challenge type is rejected either way:
    // `identify` never carries them, and `identify-real-object` needs a real, known object id.
    for (const patch of [{ shape: 'unknown' }, { emoji: '🔺' }, { realObjectId: 'clock' }, { rotation: NaN }]) {
      expect(() => validateShapeSorterData({ ...data, challenges: [{ ...data.challenges[0],
        shapes: [{ ...data.challenges[0].shapes[0], ...patch }] }] })).toThrow();
    }
    const realObject = { title: 'Shapes', gradeBand: 'K', challenges: [{ id: 'c1', type: 'identify-real-object', ruleAttribute: 'shape',
      instruction: 'Name it.', shapes: [{ shape: 'circle', color: 'blue', size: 'large', rotation: 0, realObject: 'clock face', realObjectId: 'clock' }] }] };
    expect(validateShapeSorterData(realObject)).toBeTruthy();
    expect(() => validateShapeSorterData({ ...realObject, challenges: [{ ...realObject.challenges[0],
      shapes: [{ ...realObject.challenges[0].shapes[0], realObjectId: 'not-a-real-object' }] }] })).toThrow();
    for (const mode of ['count', 'sort', 'find_real_object']) {
      expect(() => parseActivityRequest({ primitiveId: 'shape-sorter', mode, topic: 'Shapes', intent: 'Practice' })).not.toThrow();
    }
    expect(() => parseActivityRequest({ primitiveId: 'shape-sorter', mode: 'not_a_real_mode', topic: 'Shapes', intent: 'Practice' })).toThrow();
  });
  it('validates ten-frame content through the real item gates and mounts it on the teaching workspace', () => {
    const data = { title: 'Make ten', mode: 'single', gradeBand: '1-2',
      challenges: [{ id: 'a', type: 'make_ten', targetCount: 6, instruction: 'How many more?' }] };
    const valid = validateTenFrameData(data);
    expect(generatedActivityState('ten-frame', valid)).toMatchObject({ instruction: expect.stringContaining('How many more counters make ten?'), teachingOwner: 'tutor', totalChallenges: 1 });
    expect(() => validateTenFrameData({ ...data, challenges: [{ ...data.challenges[0], targetCount: 10 }] })).toThrow();
    expect(() => parseActivityRequest({ primitiveId: 'ten-frame', topic: 'Make ten', intent: 'Practice', mode: 'jump' })).toThrow();
  });
  it.each(LIVE_PRIMITIVE_IDS)('%s declares its facts once and consistently', id => {
    const adapter: LiveActivityAdapter = LIVE_ADAPTERS[id];
    const entry = getComponentById(id);
    // An ungraded teaching surface has no eval modes; it mounts unpinned content as `mixed`.
    const catalogModes = entry?.teachingWorkspace?.ungraded ? ['mixed'] : (entry?.evalModes ?? []).map(m => m.evalMode);
    // The picker can only offer what the route accepts, and the route only what the catalog defines.
    for (const [mode] of adapter.copy.lessons) expect(adapter.modes).toContain(mode);
    for (const mode of adapter.modes) expect(catalogModes).toContain(mode);
    // `live_activity_tools.parse_activity_spec` closes the socket above this length.
    expect(adapter.guidance.length).toBeLessThanOrEqual(2000);
  });
  it('accepts only declared capabilities and bounded intent', () => {
    expect(parseActivityRequest({ primitiveId: 'number-line', topic: ' subtract ', intent: 'Move left', mode: 'jump' }).topic).toBe('subtract');
    for (const patch of [{ primitiveId: 'react' }, { mode: 'unknown' }, { intent: 'x'.repeat(1001) }, { topic: '' }]) {
      expect(() => parseActivityRequest({ primitiveId: 'number-line', topic: 'Subtract', intent: 'Move left', mode: 'jump', ...patch })).toThrow();
    }
  });
  it('rejects malformed output and contradictory jump answer keys', () => {
    expect(validateActivityData(fixture()).challenges).toHaveLength(1);
    const bad = fixture(); bad.challenges[0].targetValues = [9];
    expect(() => validateActivityData(bad)).toThrow('answer');
    const outside = fixture(); outside.challenges[0].operations[0].changeValue = 20;
    expect(() => validateActivityData(outside)).toThrow('leaves');
    expect(() => validateActivityData({ ...fixture(), range: { min: NaN, max: 1 } })).toThrow();
  });
  it('grounds the tutor in the actual first challenge', () => {
    const state = initialActivityState(fixture());
    expect(state.instruction).toBe('Start at 7 and subtract 3.');
    expect(state.targetValues).toEqual([4]);
    expect(state.placedPoints).toEqual([]);
  });
});
