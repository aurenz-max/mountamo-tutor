import type { ContentOracle } from './types';
import { additionSubtractionSceneOracle } from './addition-subtraction-scene';
import { arrayGridOracle } from './array-grid';
import { coinCounterOracle } from './coin-counter';
import { factorTreeOracle } from './factor-tree';
import { mathFactFluencyOracle } from './math-fact-fluency';
import { multiplicationExplorerOracle } from './multiplication-explorer';
import { numberBondOracle } from './number-bond';
import { placeValueChartOracle } from './place-value-chart';
import { skipCountingRunnerOracle } from './skip-counting-runner';
import { tenFrameOracle } from './ten-frame';
import { vocabularyExplorerOracle } from './vocabulary-explorer';

export type { ContentOracle, OracleContext, OracleResult, OracleViolation } from './types';

/**
 * Registry of content oracles — the per-primitive calculation engines.
 * Add new oracles here; `/oracle-test` reports catalog coverage against this list.
 */
export const CONTENT_ORACLES: ContentOracle[] = [
  additionSubtractionSceneOracle,
  arrayGridOracle,
  coinCounterOracle,
  factorTreeOracle,
  mathFactFluencyOracle,
  multiplicationExplorerOracle,
  numberBondOracle,
  placeValueChartOracle,
  skipCountingRunnerOracle,
  tenFrameOracle,
  vocabularyExplorerOracle,
];

export function getOracle(componentId: string): ContentOracle | undefined {
  return CONTENT_ORACLES.find((o) => o.componentId === componentId);
}
