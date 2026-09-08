import { describe, expect, it } from 'vitest';
import { LETTER_TEMPLATES } from './letterWorkshopGeometry';
import { LETTER_WORKSHOP_MODES } from './letterWorkshopModes';
import { letterStructure, normalizeSupportTier, resolveProblemShape, resolveSupportStructure } from './letterWorkshopDifficulty';
const tiers = ['easy', 'medium', 'hard'] as const;

describe('Letter Workshop difficulty', () => {
  it('normalizes tiers without treating unknown values as hard', () => {
    expect(normalizeSupportTier(' EASY ')).toBe('easy');
    expect(normalizeSupportTier(3)).toBeNull();
    expect(normalizeSupportTier('unknown')).toBeNull();
  });
  it('withdraws trace aids independently and never adds target cues to copy/write', () => {
    expect(tiers.map(t => resolveSupportStructure('trace', t).showStarts)).toEqual([true, true, false]);
    expect(tiers.map(t => resolveSupportStructure('trace', t).showArrows)).toEqual([true, false, false]);
    for (const mode of ['copy', 'write'] as const) for (const tier of tiers) {
      expect(resolveSupportStructure(mode, tier)).toMatchObject({ showStarts: false, showArrows: false });
    }
  });
  it('saturates a one-letter scope at all tiers', () => {
    for (const tier of tiers) expect(resolveProblemShape('write', tier, ['lowercase-l']).templateIds).toEqual(['lowercase-l']);
  });
  it('never collapses a broad scope to one repeated form', () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    for (const casing of ['uppercase', 'lowercase'] as const) {
      const pool = Array.from(alphabet).map(l => `${casing}-${casing === 'uppercase' ? l.toUpperCase() : l}`);
      for (const tier of tiers) for (const count of [3, 4, 5, 6]) {
        expect(resolveProblemShape('trace', tier, pool, count).templateIds.length).toBeGreaterThanOrEqual(count);
      }
    }
    // Regression: uppercase hard anchors on a score only B carries; without
    // widening a four-item session rendered B four times.
    const upper = Array.from(alphabet).map(l => `uppercase-${l.toUpperCase()}`);
    expect(resolveProblemShape('trace', 'hard', upper, 1).templateIds).toEqual(['uppercase-B']);
    expect(resolveProblemShape('trace', 'hard', upper, 4).templateIds).toContain('uppercase-B');
  });
  it('stress-tests 1,000 scoped pools across every mode/tier/count without scope or case drift', () => {
    let seed = 1729;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
    // Violations are collected and asserted once per run: 9,000 shapes through
    // expect() per template is slow enough to trip the suite timeout.
    const violations: string[] = [];
    for (let run = 0; run < 1000; run++) {
      const pool = LETTER_TEMPLATES.filter(() => random() > 0.7).map(t => t.id);
      if (!pool.length) pool.push('lowercase-l');
      const count = 3 + Math.floor(random() * 4);
      for (const mode of LETTER_WORKSHOP_MODES) {
        const results = tiers.map(t => resolveProblemShape(mode, t, pool, count));
        results.forEach((result, i) => {
          const where = `${mode}/${tiers[i]}/count ${count}/run ${run}`;
          if (!result.templateIds.length) violations.push(`${where}: empty band`);
          for (const id of result.templateIds) {
            const casing = id.split('-')[0];
            const complexity = letterStructure(id).complexity;
            if (!pool.includes(id)) violations.push(`${where}: ${id} outside scope`);
            if (complexity < result.targets[casing].min || complexity > result.targets[casing].max) {
              violations.push(`${where}: ${id} complexity ${complexity} outside reported band`);
            }
          }
          // One distinct form per challenge whenever the scoped case can supply them.
          for (const casing of Object.keys(result.targets)) {
            const inScope = pool.filter(id => id.startsWith(`${casing}-`)).length;
            const supplied = result.templateIds.filter(id => id.startsWith(`${casing}-`)).length;
            if (supplied < Math.min(count, inScope)) violations.push(`${where}: ${casing} supplied ${supplied} of ${Math.min(count, inScope)}`);
          }
        });
        for (const casing of Object.keys(results[0].targets)) {
          const [easy, medium, hard] = results.map(r => r.targets[casing]);
          if (!(easy.min <= medium.min && medium.min <= hard.min && easy.max <= medium.max && medium.max <= hard.max)) {
            violations.push(`${mode}/count ${count}/run ${run}: ${casing} bands not monotone ${JSON.stringify([easy, medium, hard])}`);
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });
});
