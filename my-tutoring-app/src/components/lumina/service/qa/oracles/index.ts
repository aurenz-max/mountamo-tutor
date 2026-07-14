import type { ContentOracle } from './types';
import { additionSubtractionSceneOracle } from './addition-subtraction-scene';
import { analogClockOracle } from './analog-clock';
import { angleWorkshopOracle } from './angle-workshop';
import { areaModelOracle } from './area-model';
import { arrayGridOracle } from './array-grid';
import { balanceScaleOracle } from './balance-scale';
import { barModelOracle } from './bar-model';
import { baseTenBlocksOracle } from './base-ten-blocks';
import { circleExplorerOracle } from './circle-explorer';
import { coinCounterOracle } from './coin-counter';
import { comparisonBuilderOracle } from './comparison-builder';
import { coordinateGraphOracle } from './coordinate-graph';
import { distributionExplorerOracle } from './distribution-explorer';
import { countingBoardOracle } from './counting-board';
import { dnaExplorerOracle } from './dna-explorer';
import { dotPlotOracle } from './dot-plot';
import { doubleNumberLineOracle } from './double-number-line';
import { equationBuilderOracle } from './equation-builder';
import { equationWorkspaceOracle } from './equation-workspace';
import { factorTreeOracle } from './factor-tree';
import { functionMachineOracle } from './function-machine';
import { functionSketchOracle } from './function-sketch';
import { fractionBarOracle } from './fraction-bar';
import { histogramOracle } from './histogram';
import { fractionCirclesOracle } from './fraction-circles';
import { hundredsChartOracle } from './hundreds-chart';
import { knowledgeCheckOracle } from './knowledge-check';
import { mathFactFluencyOracle } from './math-fact-fluency';
import { matrixDisplayOracle } from './matrix-display';
import { multiplicationExplorerOracle } from './multiplication-explorer';
import { numberBondOracle } from './number-bond';
import { numberLineOracle } from './number-line';
import { numberSequencerOracle } from './number-sequencer';
import { percentBarOracle } from './percent-bar';
import { placeValueChartOracle } from './place-value-chart';
import { poetryLabOracle } from './poetry-lab';
import { polygonAreaBuilderOracle } from './polygon-area-builder';
import { ratioTableOracle } from './ratio-table';
import { regroupingWorkbenchOracle } from './regrouping-workbench';
import { skipCountingRunnerOracle } from './skip-counting-runner';
import { slopeTriangleOracle } from './slope-triangle';
import { systemsEquationsVisualizerOracle } from './systems-equations-visualizer';
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
  angleWorkshopOracle,
  areaModelOracle,
  arrayGridOracle,
  balanceScaleOracle,
  barModelOracle,
  baseTenBlocksOracle,
  circleExplorerOracle,
  coinCounterOracle,
  comparisonBuilderOracle,
  coordinateGraphOracle,
  countingBoardOracle,
  distributionExplorerOracle,
  dnaExplorerOracle,
  dotPlotOracle,
  doubleNumberLineOracle,
  equationBuilderOracle,
  equationWorkspaceOracle,
  factorTreeOracle,
  functionMachineOracle,
  functionSketchOracle,
  fractionBarOracle,
  fractionCirclesOracle,
  histogramOracle,
  hundredsChartOracle,
  knowledgeCheckOracle,
  mathFactFluencyOracle,
  matrixDisplayOracle,
  multiplicationExplorerOracle,
  numberBondOracle,
  numberLineOracle,
  numberSequencerOracle,
  percentBarOracle,
  placeValueChartOracle,
  poetryLabOracle,
  polygonAreaBuilderOracle,
  ratioTableOracle,
  regroupingWorkbenchOracle,
  skipCountingRunnerOracle,
  slopeTriangleOracle,
  systemsEquationsVisualizerOracle,
  tapeDiagramOracle,
  tenFrameOracle,
  twoWayTableOracle,
  vocabularyExplorerOracle,
];

export function getOracle(componentId: string): ContentOracle | undefined {
  return CONTENT_ORACLES.find((o) => o.componentId === componentId);
}
