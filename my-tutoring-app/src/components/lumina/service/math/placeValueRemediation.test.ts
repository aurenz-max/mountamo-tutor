import { describe, expect, it } from 'vitest';
import { compiledWorthContrast, placeValueRemediationMoveFor, selectPlaceValueContrast } from './placeValueRemediation';

const focus = 'The student says the bare digit for its worth regardless of its column.';
const fixture = [2345, 6789, 7526].map((targetNumber, i) => ({ id: `pvc-${i}`, targetNumber, highlightedDigitPlace: 1 }));
describe('place value misconception selection', () => {
  it('accepts the actual Probe D wording without confusing naming a digit with naming its place', () => {
    expect(placeValueRemediationMoveFor('compare', 'medium', 'The student interprets the value of a digit as its face value regardless of its position, naming only the digit itself rather than its place value.')).toBe('contrast_digit_worth');
  });
  it('recognizes only the reviewed mode and tier', () => {
    for (const mode of ['identify', 'build', 'compare', 'expanded_form']) {
      for (const tier of ['easy', 'medium', 'hard']) {
        expect(placeValueRemediationMoveFor(mode, tier, focus)).toBe(mode === 'compare' && tier === 'medium' ? 'contrast_digit_worth' : null);
      }
    }
  });
  it.each(['', '  ', 'The student shifts a digit value one place.', 'The student says a value for the place name.', 'The student omitted zero.', 'Unreliable transcript of a bare digit value.', 'The student adds incorrectly.'])('abstains: %s', text => {
    expect(placeValueRemediationMoveFor('compare', 'medium', text)).toBeNull();
  });
  it('has causal non-vacuity in surviving items and preserves allocation', () => {
    const baseline = compiledWorthContrast(fixture);
    expect(baseline.count).toBeLessThan(2); // reverting selection fails the next assertion
    const selected = selectPlaceValueContrast(fixture, 'contrast_digit_worth');
    expect(selected.count).toBe(2);
    expect(selected.items.map(i => [i.id, i.kind])).toEqual(baseline.items.map(i => [i.id, i.kind]));
    expect(selected.targets.map(i => i.digit)).toEqual([4, 4]);
    expect(new Set(selected.targets.map(i => i.place)).size).toBe(2);
    expect(selected.challenges).toHaveLength(fixture.length);
    expect(new Set(selected.challenges.map(c => c.targetNumber)).size).toBe(fixture.length);
    expect(selected.challenges[1]).toBe(fixture[1]);
    expect(JSON.stringify(selected.challenges)).not.toMatch(/remediation|bare digit/);
  });
  it('returns the identical no-focus input and terminates under tight capacity', () => {
    expect(selectPlaceValueContrast(fixture, null).challenges).toBe(fixture);
    const short = selectPlaceValueContrast(fixture.slice(0, 1), 'contrast_digit_worth');
    expect(short.reason).toBe('saturated');
    expect(short.count).toBe(1);
    expect(selectPlaceValueContrast([], 'contrast_digit_worth').count).toBe(0);
    expect(selectPlaceValueContrast(fixture, 'contrast_digit_worth', { min: 7526, max: 7526 }).reason).toBe('saturated');
  });
});
