import { describe, expect, it } from 'vitest';
import { initialActivityState, parseActivityRequest, validateActivityData, validateTenFrameData, generatedActivityState } from './activityContract';

export const fixture = () => ({ title: 'Subtraction within 10', range: { min: 0, max: 10 },
  interactionMode: 'jump' as const, challenges: [{ id: 'c1', type: 'show_jump' as const,
    instruction: 'Start at 7 and subtract 3.', hint: 'Move left.', startValue: 7, targetValues: [4],
    operations: [{ type: 'subtract' as const, startValue: 7, changeValue: 3, showJumpArc: true }],
  }],
});

describe('live activity boundary', () => {
  it('validates ten-frame content through the real DI item gates and resolves the first scaffold state', () => {
    const data = { title: 'Make ten', mode: 'single', gradeBand: '1-2',
      challenges: [{ id: 'a', type: 'make_ten', targetCount: 6, instruction: 'How many more?' }] };
    const valid = validateTenFrameData(data);
    expect(generatedActivityState('ten-frame', valid)).toMatchObject({ challengeType: 'make_ten', teachingOwner: 'ten-frame-di', totalChallenges: 1 });
    expect(() => validateTenFrameData({ ...data, challenges: [{ ...data.challenges[0], targetCount: 10 }] })).toThrow();
    expect(() => parseActivityRequest({ primitiveId: 'ten-frame', topic: 'Make ten', intent: 'Practice', mode: 'jump' })).toThrow();
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
