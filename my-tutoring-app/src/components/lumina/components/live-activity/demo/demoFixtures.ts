import { buildDemonstration, type DemoScript } from './demoContract';
import type { DemonstrationSupport } from '../runtime/contract';

/** The five scripts the 2026-09-26 bench authored (qa/tutor-reports/detour-bench-2026-09-26/v2-demo). */
export const DEMO_FIXTURES: Array<{ id: string; obstacle: string; script: DemoScript }> = [
  { id: 'subtract-hops', obstacle: 'Counts the starting number as the first hop (12 - 3 = 10)',
    script: { piece: 'number-line', operation: 'subtract', values: [14, 4], focus: 'the first hop lands on 13', studentValues: [12, 3] } },
  { id: 'fraction-add', obstacle: 'Adds numerators and denominators (2/5 + 1/5 = 3/10)',
    script: { piece: 'number-line', operation: 'add', values: [1, 3], denominator: 5, focus: 'every hop is one fifth', studentValues: [2, 1] } },
  { id: 'make-a-ten', obstacle: 'Writes 13 in the ones place (37 + 26 = 513)',
    script: { piece: 'place-value', operation: 'make-a-ten', values: [14], focus: 'ten ones become one ten', studentValues: [13] } },
  { id: 'compare-digits', obstacle: 'Thinks 3,999 > 4,001 because of the nines',
    script: { piece: 'place-value', operation: 'compare', values: [2999, 3002], focus: 'the thousands place decides', studentValues: [3999, 4001] } },
  { id: 'clock-minutes', obstacle: 'Reads the numeral as minutes (hand on 4 = 3:04)',
    script: { piece: 'clock', operation: 'minutes-from-numeral', values: [2, 3], focus: 'count by fives to the 3', studentValues: [3, 4] } },
];

export function demonstrationArtifact(script: DemoScript, id = 'demo-preview'): DemonstrationSupport {
  const demonstration = buildDemonstration(script);
  return { id, kind: 'demonstration', title: demonstration.title, demonstration,
    altText: demonstration.frames.map((f, i) => `Step ${i + 1}: ${f.caption}`).join(' '),
    answerExposure: demonstration.answerExposure, provenance: 'prepared' };
}
