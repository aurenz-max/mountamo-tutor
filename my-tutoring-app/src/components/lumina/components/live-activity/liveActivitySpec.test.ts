import { describe, expect, it } from 'vitest';
import { buildLiveActivitySpec } from './liveActivitySpec';
import { buildDirectVisual } from './directVisualContract';
import { LIVE_ADAPTERS } from './activityContract';

it('publishes the registered adapter modes and owners without exposing task answers', () => {
  const spec = buildLiveActivitySpec(['ten-frame', 'number-line']);
  expect(spec.activities[0]).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, modes: [...LIVE_ADAPTERS['ten-frame'].modes] });
  expect(spec.activities[1]).toMatchObject({ teachingOwner: 'tutor', canAdvance: false });
  expect(spec.visuals).toEqual([]);
  expect(JSON.stringify(spec)).not.toContain('targetCount');
  expect(() => buildLiveActivitySpec(['unknown' as any])).toThrow();
});

describe('host-owned direct visual parameters', () => {
  it('uses the exact existing renderer contract', () => {
    expect(buildDirectVisual('show_fraction', { numerator: 3, denominator: 4, instruction: 'Look.' })).toMatchObject({ shadedIndices: [0, 1, 2] });
    expect(buildDirectVisual('show_letter_tiles', { tiles: ['sh', 'i', 'p'], instruction: 'Blend.' })).toMatchObject({ tiles: ['sh', 'i', 'p'] });
    expect(buildLiveActivitySpec([], true).visuals.map(v => v.name)).toEqual(['show_counters', 'show_fraction', 'show_letter_tiles']);
  });
  it.each([
    ['show_counters', { count: 21, layout: 'rows' }],
    ['show_counters', { count: true, layout: 'rows' }],
    ['show_fraction', { numerator: 5, denominator: 4 }],
    ['show_fraction', { numerator: 100000, denominator: 100000 }],
    ['show_letter_tiles', { tiles: ['<script>'] }],
    ['unknown_tool', {}],
  ])('rejects malformed %s input before mounting', (name, args) => {
    expect(() => buildDirectVisual(name as string, { ...(args as object), instruction: 'Try it.' })).toThrow();
  });
});
