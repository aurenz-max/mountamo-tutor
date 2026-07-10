import type { ContentOracle } from './types';
import { additionSubtractionSceneOracle } from './addition-subtraction-scene';
import { analogClockOracle } from './analog-clock';
import { areaModelOracle } from './area-model';
import { arrayGridOracle } from './array-grid';
import { balanceScaleOracle } from './balance-scale';
import { barModelOracle } from './bar-model';
import { baseTenBlocksOracle } from './base-ten-blocks';
import { coinCounterOracle } from './coin-counter';
import { comparisonBuilderOracle } from './comparison-builder';
import { countingBoardOracle } from './counting-board';
import { dnaExplorerOracle } from './dna-explorer';
import { doubleNumberLineOracle } from './double-number-line';
import { factorTreeOracle } from './factor-tree';
import { functionMachineOracle } from './function-machine';
import { fractionBarOracle } from './fraction-bar';
import { fractionCirclesOracle } from './fraction-circles';
import { hundredsChartOracle } from './hundreds-chart';
import { knowledgeCheckOracle } from './knowledge-check';
import { mathFactFluencyOracle } from './math-fact-fluency';
import { multiplicationExplorerOracle } from './multiplication-explorer';
import { numberBondOracle } from './number-bond';
import { numberLineOracle } from './number-line';
import { numberSequencerOracle } from './number-sequencer';
import { percentBarOracle } from './percent-bar';
import { placeValueChartOracle } from './place-value-chart';
import { ratioTableOracle } from './ratio-table';
import { regroupingWorkbenchOracle } from './regrouping-workbench';
import { skipCountingRunnerOracle } from './skip-counting-runner';
import { slopeTriangleOracle } from './slope-triangle';
import { tapeDiagramOracle } from './tape-diagram';
import { tenFrameOracle } from './ten-frame';
import { twoWayTableOracle } from './two-way-table';
import { vocabularyExplorerOracle } from './vocabulary-explorer';

export type { ContentOracle, OracleContext, OracleResult, OracleViolation } from './types';

/**
 * Registry of content oracles — the per-primitive calculation engines.
 * Add new oracles here; `/oracle-test` reports catalog coverage against this list.
 */
export const CONTENT_ORACLES: ContentOracle[] = [
  additionSubtractionSceneOracle,
  analogClockOracle,
  areaModelOracle,
  arrayGridOracle,
  balanceScaleOracle,
  barModelOracle,
  baseTenBlocksOracle,
  coinCounterOracle,
  comparisonBuilderOracle,
  countingBoardOracle,
  dnaExplorerOracle,
  doubleNumberLineOracle,
  factorTreeOracle,
  functionMachineOracle,
  fractionBarOracle,
  fractionCirclesOracle,
  hundredsChartOracle,
  knowledgeCheckOracle,
  mathFactFluencyOracle,
  multiplicationExplorerOracle,
  numberBondOracle,
  numberLineOracle,
  numberSequencerOracle,
  percentBarOracle,
  placeValueChartOracle,
  ratioTableOracle,
  regroupingWorkbenchOracle,
  skipCountingRunnerOracle,
  slopeTriangleOracle,
  tapeDiagramOracle,
  tenFrameOracle,
  twoWayTableOracle,
  vocabularyExplorerOracle,
];

export function getOracle(componentId: string): ContentOracle | undefined {
  return CONTENT_ORACLES.find((o) => o.componentId === componentId);
}
