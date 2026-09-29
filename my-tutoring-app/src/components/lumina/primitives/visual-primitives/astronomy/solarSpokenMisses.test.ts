import { expect, it } from 'vitest';
import { solarSpokenMisses } from './solarSystemWorkspace';
import type { SolarItem } from './solarSystemScript';

// solar-system-explorer's known wrong names (handoff 20 Part B): ids in precedence order, and no example is accepted.
const solar = (kind: SolarItem['kind'], facet: string, answer: string, signatureName: string, wrongName: string) =>
  ({ id: 's', kind, facet, answerNames: [answer], signatureName, wrongName, hottestTrap: facet === 'hottest' }) as unknown as SolarItem;

it.each([
  [solar('identify', 'name', 'Mercury', 'Venus', 'Venus'), ['said_sun', 'neighbour_planet', 'other_planet'], ['Venus', undefined]],
  [solar('compare_attribute', 'biggest', 'Jupiter', 'Sun', 'Mercury'), ['said_sun', 'other_planet'], ['Mercury']],
  [solar('compare_attribute', 'hottest', 'Venus', 'Mercury', 'Mercury'), ['said_sun', 'signature_planet', 'other_planet'], ['Mercury', undefined]],
] as const)('row %#', (item, ids, planets) => {
  const misses = solarSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  expect(misses.slice(1).map(m => m.examples?.[0])).toEqual(planets);
  for (const m of misses) expect(m.examples).not.toContain(item.answerNames[0]);
});
