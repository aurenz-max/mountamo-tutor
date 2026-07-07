import type { ContentOracle } from './types';
import { tenFrameOracle } from './ten-frame';
import { vocabularyExplorerOracle } from './vocabulary-explorer';

export type { ContentOracle, OracleContext, OracleResult, OracleViolation } from './types';

/**
 * Registry of content oracles — the per-primitive calculation engines.
 * Add new oracles here; `/oracle-test` reports catalog coverage against this list.
 */
export const CONTENT_ORACLES: ContentOracle[] = [
  tenFrameOracle,
  vocabularyExplorerOracle,
];

export function getOracle(componentId: string): ContentOracle | undefined {
  return CONTENT_ORACLES.find((o) => o.componentId === componentId);
}
