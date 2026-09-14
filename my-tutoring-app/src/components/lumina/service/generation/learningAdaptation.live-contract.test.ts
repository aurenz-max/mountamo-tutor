import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compiledWorthContrast } from '../math/placeValueRemediation';
import { compiledBlockWorthContrast } from '../math/baseTenRemediation';
import { readCount, readWorthWord } from '../../primitives/visual-primitives/math/baseTenModel';
import { placeValueChartOracle } from '../qa/oracles/place-value-chart';

// Replay saved real-engine outputs through the production compilers; no network.
const directory = '../artifacts/learning-applicability';
const report = JSON.parse(readFileSync(`${directory}/report.json`, 'utf8'));
it('real applicability cases survive compilation, preserve scope, and abstain on negative cases', () => {
  expect(report.pass).toBe(true);
  expect(report.cases.filter((c: { pass: boolean }) => c.pass)).toHaveLength(14);
  for (const row of report.cases) {
    const payload = JSON.parse(readFileSync(`${directory}/${row.primitive}-${row.name}-${row.draw}.json`, 'utf8'));
    const d = payload.fullData;
    expect(d.supportTier).toBe('medium');
    // The ordinary blocks generator can repeat mats; adaptation must not add duplicates.
    if (row.expected || row.primitive === 'place-value-chart')
      expect(new Set(d.challenges.map((c: { targetNumber: number }) => c.targetNumber)).size).toBe(d.challenges.length);
    if (row.primitive === 'place-value-chart') {
      expect(d.challengeType).toBe('compare');
      expect(d.challenges).toHaveLength(3);
      const check = placeValueChartOracle.verify(d, { componentId: row.primitive, evalMode: 'compare', topic: 'Place value in four-digit whole numbers', gradeLevel: '4' });
      expect(check.violations.filter(v => v.check === 'answer-key-desync')).toEqual([]);
      if (row.expected && row.pass) {
        const compiled = compiledWorthContrast(d.challenges);
        expect(compiled.count).toBe(2);
        expect(compiled.targets[0].digit).toBe(compiled.targets[1].digit);
        expect(compiled.targets[0].answerText).not.toBe(compiled.targets[1].answerText);
      }
    } else {
      expect(d.challenges.every((c: { type: string; showColumnCounts: boolean; showBlocksTotal: boolean }) => c.type === 'read_blocks' && !c.showColumnCounts && !c.showBlocksTotal)).toBe(true);
      if (row.expected && row.pass) {
        const { targets } = compiledBlockWorthContrast(d.challenges);
        expect(targets).toHaveLength(2);
        expect(readCount(targets[0].problem)).toBe(readCount(targets[1].problem));
        expect(readWorthWord(targets[0].problem)).not.toBe(readWorthWord(targets[1].problem));
      }
      expect(d.misconceptionOpportunity).toBeUndefined();
    }
    if (!row.expected) expect(d.learningAdaptation).toBeUndefined();
    if (row.focus) expect(JSON.stringify(d)).not.toContain(row.focus);
  }
});
