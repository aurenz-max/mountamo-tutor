import { describe, expect, it } from 'vitest';
import { checkDiCatalogEntry, checkPackGates } from '../../../hooks/judgedScriptContract.testkit';
import { spokenSpanOf } from '../../../hooks/judgedScriptContract';
import { buildFractionTouchItems, fractionTouchPack, fractionTouchVerdictCue } from './fractionTouchScript';
import { MATH_CATALOG } from '../../../service/manifest/catalog/math';
import type { FractionCirclesChallenge } from './FractionCircles';

const challenges: FractionCirclesChallenge[] = [2, 3, 4].flatMap(d => Array.from({ length: d - 1 }, (_, i) => ({
  id: `f-${i + 1}-${d}`, type: 'touch_fraction' as const, numerator: i + 1, denominator: d,
  instruction: '', hint: '', narration: '',
})));
describe('fraction touch contract', () => {
  it('all supported targets have exactly one matching picture and distinct distractor values across random draws', () => {
    for (let run = 0; run < 100; run++) for (const item of buildFractionTouchItems(challenges)) {
      expect(item.choices).toHaveLength(3);
      expect(item.choices.filter(c => c.numerator * item.denominator === item.numerator * c.denominator)).toHaveLength(1);
      expect(new Set(item.choices.map(c => c.numerator / c.denominator)).size).toBe(3);
      for (const c of item.choices) {
        expect(c.shaded).toHaveLength(c.numerator);
        expect(new Set(c.shaded).size).toBe(c.numerator);
        expect(c.shaded.every(i => i >= 0 && i < c.denominator)).toBe(true);
        const spoken = spokenSpanOf(fractionTouchVerdictCue(item, c.id));
        expect(spoken.startsWith(c.id === item.correctChoiceId ? 'Yes,' : 'My turn.')).toBe(true);
      }
    }
  });
  it('passes the DI gates and repeats only the question on replay', () => {
    const items = buildFractionTouchItems(challenges);
    const pack = fractionTouchPack(items);
    expect(checkPackGates(pack)).toEqual([]);
    const entry = MATH_CATALOG.find(c => c.id === 'fraction-circles')!;
    // `audioInput` is resolved per mode on this entry (touch_fraction is judged;
    // identify/build/compare/equivalent stay click); the shim lets the shared
    // checker run the rest of the contract, matching baseTenScript.test.ts.
    const shimmed = { ...entry, audioInput: entry.audioInputByMode!['touch_fraction'] };
    expect(checkDiCatalogEntry(shimmed, pack, items[0])).toEqual([]);
    for (const item of items) expect(spokenSpanOf(pack.pronounceCue!(item))).toBe(item.actionContract.instruction);
  });
  it('rejects malformed or out-of-scope content rather than silently changing a target', () => {
    for (const [n, d] of [[0, 4], [4, 4], [1, 8], [1.5, 3], [1, 0]]) {
      expect(() => buildFractionTouchItems([{ ...challenges[0], numerator: n, denominator: d }])).toThrow();
    }
    const item = buildFractionTouchItems(challenges)[0];
    expect(() => fractionTouchVerdictCue(item, 'missing')).toThrow();
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
