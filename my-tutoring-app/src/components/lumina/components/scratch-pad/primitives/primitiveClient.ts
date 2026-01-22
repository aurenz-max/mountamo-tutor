import { PrimitiveSuggestion } from '../../../service/scratch-pad/gemini-scratch-pad-enhanced';

/**
 * Generated primitive result
 */
export interface GeneratedPrimitive {
  id: string;
  componentId: string;
  data: unknown;
  generatedAt: Date;
}

/**
 * All components now use the universal generateComponentContent endpoint
 * via the content registry pattern. No need for individual action mappings.
 */

/**
 * Generate a primitive based on a suggestion
 * Uses the universal generateComponentContent endpoint (registry pattern)
 */
export async function generatePrimitiveFromSuggestion(
  suggestion: PrimitiveSuggestion
): Promise<GeneratedPrimitive> {
  const { componentId, generationConfig } = suggestion;

  // All components use generateComponentContent via the registry
  const params = {
    componentId,
    topic: generationConfig.topic,
    gradeLevel: generationConfig.gradeLevel,
    config: {
      specificContext: generationConfig.specificContext
    }
  };

  try {
    const response = await fetch('/api/lumina', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateComponentContent',
        params
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate primitive');
    }

    const result = await response.json();
    // The registry returns { type, instanceId, data } - extract the data
    const data = result.data || result;

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
