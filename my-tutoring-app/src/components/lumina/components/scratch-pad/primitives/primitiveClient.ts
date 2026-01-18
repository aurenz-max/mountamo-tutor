import { PrimitiveSuggestion, GeneratedPrimitive } from '../types';

/**
 * Maps component IDs to their API action names
 */
const COMPONENT_TO_ACTION: Record<string, string> = {
  'fraction-bar': 'generateFractionBar',
  'fraction-circles': 'generateFractionBar', // Uses same service
  'number-line': 'generateComponentContent',
  'bar-model': 'generateComponentContent',
  'base-ten-blocks': 'generateComponentContent',
  'place-value-chart': 'generatePlaceValueChart',
  'area-model': 'generateAreaModel',
  'array-grid': 'generateArrayGrid',
  'tape-diagram': 'generateTapeDiagram',
  'factor-tree': 'generateFactorTree',
  'ratio-table': 'generateRatioTable',
  'double-number-line': 'generateDoubleNumberLine',
  'percent-bar': 'generatePercentBar',
  'balance-scale': 'generateBalanceScale',
  'function-machine': 'generateFunctionMachine',
  'coordinate-graph': 'generateCoordinateGraph',
  'slope-triangle': 'generateSlopeTriangle',
  'systems-equations-visualizer': 'generateSystemsEquations',
  'matrix-display': 'generateMatrix',
  'dot-plot': 'generateDotPlot',
  'histogram': 'generateHistogram',
  'two-way-table': 'generateTwoWayTable'
};

/**
 * Generic components that need special handling through generateComponentContent
 */
const GENERIC_COMPONENTS = new Set([
  'number-line',
  'bar-model',
  'base-ten-blocks',
  'fraction-circles'
]);

/**
 * Generate a primitive based on a suggestion
 */
export async function generatePrimitiveFromSuggestion(
  suggestion: PrimitiveSuggestion
): Promise<GeneratedPrimitive> {
  const { componentId, generationConfig } = suggestion;
  const action = COMPONENT_TO_ACTION[componentId];

  if (!action) {
    throw new Error(`No action mapping for component: ${componentId}`);
  }

  let params: Record<string, unknown>;

  // Handle generic components that go through generateComponentContent
  if (GENERIC_COMPONENTS.has(componentId)) {
    params = {
      componentId,
      topic: generationConfig.topic,
      gradeLevel: generationConfig.gradeLevel,
      config: {
        specificContext: generationConfig.specificContext
      }
    };
  } else {
    // Specific component generators
    params = {
      topic: generationConfig.topic,
      gradeLevel: generationConfig.gradeLevel,
      config: {
        specificContext: generationConfig.specificContext
      }
    };
  }

  try {
    const response = await fetch('/api/lumina', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        params
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate primitive');
    }

    const data = await response.json();

    return {
      id: `${componentId}-${Date.now()}`,
      componentId,
      data,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Primitive generation error:', error);
    throw error;
  }
}

/**
 * Enhanced analysis with primitive suggestions
 */
export interface AnalysisContext {
  topic?: string;
  gradeLevel?: string;
}

export interface AnalysisProgressCallback {
  onProgress?: (stage: 'uploading' | 'analyzing' | 'processing' | 'complete', message: string) => void;
}

export async function analyzeScratchPadWithPrimitives(
  imageBase64: string,
  context?: AnalysisContext,
  callbacks?: AnalysisProgressCallback
) {
  callbacks?.onProgress?.('uploading', 'Preparing your work...');

  try {
    callbacks?.onProgress?.('analyzing', 'Analyzing your work...');

    const response = await fetch('/api/lumina', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'analyzeScratchPadWithPrimitives',
        params: {
          imageBase64,
          context
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }

    callbacks?.onProgress?.('processing', 'Processing feedback...');

    const result = await response.json();

    callbacks?.onProgress?.('complete', 'Ready!');

    return result;
  } catch (error) {
    console.error('Enhanced analysis error:', error);
    throw error;
  }
}
