import { describe, expect, it } from 'vitest';
import { buildFractionTouchItems, describeTouch, touchAssignment, touchMatches } from './fractionCirclesWorkspace';
import type { FractionCirclesChallenge } from './FractionCircles';

const challenges: FractionCirclesChallenge[] = [2, 3, 4].flatMap(d => Array.from({ length: d - 1 }, (_, i) => ({
  id: `f-${i + 1}-${d}`, type: 'touch_fraction' as const, numerator: i + 1, denominator: d,
  instruction: '', hint: '', narration: '',
})));
describe('touch_fraction items', () => {
  it('all supported targets have exactly one matching picture and distinct distractor values across random draws', () => {
    for (let run = 0; run < 100; run++) for (const item of buildFractionTouchItems(challenges)) {
      expect(item.choices).toHaveLength(3);
      expect(item.choices.filter(c => c.numerator * item.denominator === item.numerator * c.denominator)).toHaveLength(1);
      expect(new Set(item.choices.map(c => c.numerator / c.denominator)).size).toBe(3);
      for (const c of item.choices) {
        expect(c.shaded).toHaveLength(c.numerator);
        expect(new Set(c.shaded).size).toBe(c.numerator);
        expect(c.shaded.every(i => i >= 0 && i < c.denominator)).toBe(true);
        expect(touchMatches(item, c.id)).toBe(c.id === item.correctChoiceId);
      }
    }
  });
  it('the tutor is told the spoken fraction only, never which picture matches', () => {
    for (const item of buildFractionTouchItems(challenges)) {
      const assignment = touchAssignment(item);
      expect(assignment).toEqual({ id: item.id, task: item.actionContract.instruction, response: 'gesture' });
      expect(JSON.stringify(assignment)).not.toMatch(/picture-\d|correctChoice/);
    }
  });
  it('rejects malformed or out-of-scope content rather than silently changing a target', () => {
    for (const [n, d] of [[0, 4], [4, 4], [1, 8], [1.5, 3], [1, 0]]) {
      expect(() => buildFractionTouchItems([{ ...challenges[0], numerator: n, denominator: d }])).toThrow();
    }
    const item = buildFractionTouchItems(challenges)[0];
    expect(touchMatches(item, 'missing')).toBe(false);
    expect(describeTouch(item, 'missing')).toBe('Touched a picture');
  });
  it('varies answer position and shading rather than identifying the answer by layout', () => {
    const positions = new Set<number>(); const shading = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const item = buildFractionTouchItems([challenges[3]])[0];
      positions.add(item.choices.findIndex(c => c.id === item.correctChoiceId));
      shading.add(item.choices.find(c => c.id === item.correctChoiceId)!.shaded.join(','));
    }
    expect(positions.size).toBe(3); expect(shading.size).toBeGreaterThan(1);
  });
});
