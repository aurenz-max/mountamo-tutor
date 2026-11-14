/** Studio plans written offline (PROTOTYPE, `../studioPlan.ts`). Plain data: the tester imports the list in the browser. */
import type { StudioPlan } from '../studioPlan';
import leverLift from './lever-lift.json';
import streamSettle from './stream-settle.json';
import truckTrips from './truck-trips.json';

export const STUDIO_PLANS: readonly StudioPlan[] = [leverLift, streamSettle, truckTrips] as unknown as StudioPlan[];

export const studioPlan = (id: string) => STUDIO_PLANS.find(p => p.id === id);
