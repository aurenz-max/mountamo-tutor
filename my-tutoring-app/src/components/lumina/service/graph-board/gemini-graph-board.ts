/**
 * Graph Board Generator - Dedicated service for interactive polynomial graphing
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

export interface GraphBoardData {
  title: string;
  description: string;
}

/**
 * Generate Graph Board content
 *
 * Graph Board is a fully interactive, self-contained component where students
 * plot points and see the polynomial curve that fits through them.
 * No AI generation is needed - just pass through the title and description.
 *
 * @param topic - The topic being explored
 * @param config - Optional configuration including title and intent
 * @returns Graph board configuration data
 */
export const generateGraphBoard = async (
  topic: string,
  config?: {
    title?: string;
    intent?: string;
  }
): Promise<GraphBoardData> => {
  // GraphBoard is fully interactive and self-contained
  // Just return the title and description from the manifest
  const data: GraphBoardData = {
    title: config?.title || `Exploring ${topic}`,
    description: config?.intent || "Click on the grid to plot points and see the polynomial curve that fits through them."
  };

  console.log('📈 Graph Board Generated from dedicated service:', {
    topic,
    title: data.title
  });

  return data;
};
