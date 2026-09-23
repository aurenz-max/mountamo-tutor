import { expect, it } from 'vitest';
import type { BarModelChallenge } from '../BarModel';
import { buildPictureGraphEvidence } from '../barModelEvidence';

const graph = (id: string, target: number, options: number[]): BarModelChallenge => ({
  id, evalMode: 'picture_graph', graphStyle: 'picture', prompt: 'Each 🐶 stands for 5. How many dogs?',
  hint: 'Count the icons, then multiply by 5.', showTargetHighlight: true, showBarValues: false, supportTier: 'medium',
  values: [{ label: 'Dogs', value: target }, { label: 'Cats', value: 10 }, { label: 'Birds', value: 20 }, { label: 'Fish', value: 15 }],
  scale: { step: 5, max: 25, iconEmoji: '🐶', iconValue: 5 }, targetBarIndex: 0, expectedValue: target, options,
});

it('ignores other modes and unsolved graphs stay factual', () => {
  const scale = { ...graph('s', 20, [16, 18, 20, 22]), evalMode: 'read_scale' as const, graphStyle: 'scaled_bar' as const, scale: { step: 2, max: 20 } };
  expect(buildPictureGraphEvidence([scale], [{ challengeId: 's', selectedOptions: [18, 20] }])).toBeUndefined();
  const evidence = buildPictureGraphEvidence([graph('g', 15, [3, 10, 15, 20])], [{ challengeId: 'g', selectedOptions: [3, 20] }]);
  expect(evidence?.observed).toBe('Selections in order: 3, 20 (not solved)');
  expect(evidence?.priorAttempts).toEqual([]);
});
