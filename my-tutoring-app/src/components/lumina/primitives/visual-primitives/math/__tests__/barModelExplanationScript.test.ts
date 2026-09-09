import { describe, expect, it } from 'vitest';
import { graphComparisonFacts, graphExplanationPack } from '../barModelExplanationScript';
import { validateJudgedScriptPack } from '../../../../hooks/judgedScriptContract';
import type { BarModelChallenge } from '../BarModel';
import { barModelOracle } from '../../../../service/qa/oracles/bar-model';

const chart: BarModelChallenge = {
  id: 'g1', evalMode: 'say_what_it_shows', prompt: 'Tell me what the graph shows.',
  graphStyle: 'picture', scale: { step: 1, max: 10, iconValue: 1 }, showBarValues: false,
  values: [{ label: 'Apples', value: 4, emoji: '🍎' }, { label: 'Pears', value: 2, emoji: '🍐' }, { label: 'Plums', value: 2, emoji: '🟣' }],
};
const pair: BarModelChallenge = { ...chart, evalMode: 'compare_two_graphs', graphLabel: 'Morning', secondGraphLabel: 'Afternoon',
  secondValues: chart.values.map((v, i) => ({ ...v, value: [4, 3, 1][i] })),
};

describe('graph explanation meaning contract', () => {
  it('derives true pairwise facts and handles ties without inventing a unique least', () => {
    expect(graphComparisonFacts(chart)).toEqual([
      'Apples have more than Pears.', 'Apples have more than Plums.',
      'Pears and Plums have the same number.', 'Apples have the most.',
    ]);
  });
  it('compares corresponding categories across surveys', () => {
    expect(graphComparisonFacts(pair)).toEqual([
      'Morning has the same number of Apples as Afternoon.',
      'Morning has fewer Pears than Afternoon.', 'Morning has more Plums than Afternoon.',
    ]);
  });
  it('requires the requested similarity or difference rather than accepting either every time', () => {
    expect(graphComparisonFacts({ ...pair, comparisonFocus: 'same' })).toEqual(['Morning has the same number of Apples as Afternoon.']);
    expect(graphComparisonFacts({ ...pair, comparisonFocus: 'different' })).toHaveLength(2);
  });
  it('passes the shared spoken-pack validation', () => {
    expect(validateJudgedScriptPack(graphExplanationPack(pair))).toEqual([]);
  });
  it('keeps facts private in the ask and accepts meaning rather than tokens', () => {
    const pack = graphExplanationPack(pair);
    const cue = pack.itemCue(pack.items[0], { opening: true, howToPlay: true });
    const performedAsk = cue.match(/Say exactly: "([^"]+)"/)![1];
    expect(performedAsk).not.toMatch(/four|two|4|2|Apples have the most/);
    expect(cue).toContain('Judge MEANING');
    expect(cue).toContain('reversed or negated facts');
    expect(cue).toContain('MUST compare the morning and afternoon');
    expect(pack.maxCorrections).toBe(2);
  });
});

describe('spoken graph oracle', () => {
  const verify = (c: BarModelChallenge) => barModelOracle.verify({ challenges: [c, { ...c, id: 'g2' }, { ...c, id: 'g3' }] },
    { componentId: 'bar-model', evalMode: c.evalMode, topic: 'class survey', gradeLevel: 'Kindergarten' });
  it('passes valid pairs, recording the live-judging boundary', () => {
    expect(verify(pair).violations).toEqual([]);
    expect(verify(pair).uncheckedTypes).toContain('compare_two_graphs(live-spoken-meaning)');
  });
  it('rejects a scaled picture, category mismatch, and out-of-range second graph', () => {
    expect(verify({ ...pair, scale: { step: 2, max: 10, iconValue: 2 } }).violations.length).toBeGreaterThan(0);
    expect(verify({ ...pair, secondValues: pair.secondValues!.map((v) => ({ ...v, label: 'Other' })) }).violations.length).toBeGreaterThan(0);
    expect(verify({ ...pair, secondValues: pair.secondValues!.map((v) => ({ ...v, value: 11 })) }).violations.some((v) => v.check === 'scope')).toBe(true);
  });
});
