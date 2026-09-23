import type { FractionCirclesChallenge, FractionCirclesData } from '../../../primitives/visual-primitives/math/FractionCircles';
import { buildFractionTouchItems } from '../../../primitives/visual-primitives/math/fractionTouchScript';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const whole = (n: unknown, min: number, max: number): n is number => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/** A challenge the component can actually run to a correct Check (or, for touch_fraction, build three pictures for). */
function runnable(c: FractionCirclesChallenge): boolean {
  if (!c || typeof c.id !== 'string' || typeof c.instruction !== 'string' || !whole(c.denominator, 2, 12)) return false;
  switch (c.type) {
    case 'identify': return whole(c.numerator, 0, c.denominator);
    // The Check needs at least one shaded slice.
    case 'build': return whole(c.numerator, 1, c.denominator);
    case 'compare': return whole(c.numerator, 0, c.denominator) && !!c.compareFraction
      && whole(c.compareFraction.denominator, 2, 12) && whole(c.compareFraction.numerator, 0, c.compareFraction.denominator);
    case 'equivalent': {
      const d = c.equivalentDenominator;
      if (!whole(c.numerator, 1, c.denominator) || !whole(d, 2, 12)) return false;
      const built = c.numerator * d / c.denominator;
      return Number.isInteger(built) && built >= 1 && built <= d;
    }
    case 'touch_fraction':
      try { buildFractionTouchItems([c]); return true; } catch { return false; }
    default: return false;
  }
}

export function validateFractionCirclesData(value: unknown): FractionCirclesData {
  return validateChallengePool<FractionCirclesData>(value, runnable, {
    pool: 'Generated fraction circles have no valid challenges.',
    item: 'A fraction circles challenge cannot run in the lesson.',
  });
}

/** The first task as the tutor is told it: a touch item's ask is spoken, never printed in the data. */
const firstTask = (c: FractionCirclesChallenge) =>
  c.type === 'touch_fraction' ? buildFractionTouchItems([c])[0].actionContract.instruction : c.instruction;

/** What the live adapter needs from fraction circles; the catalog's `teachingWorkspace` declares the rest. */
export const fractionCirclesLiveDomain: WorkspaceDomain<FractionCirclesData> = {
  validate: validateFractionCirclesData,
  initialState: d => workspaceOpening({ title: d.title, task: firstTask(d.challenges[0]), total: d.challenges.length }),
};
