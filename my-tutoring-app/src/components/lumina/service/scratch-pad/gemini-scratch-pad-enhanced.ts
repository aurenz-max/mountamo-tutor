import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { ComponentId } from "../../types";

/**
 * Topic-to-Primitive mapping for intelligent suggestions
 */
const CONCEPT_PRIMITIVE_MAP: Record<string, { componentIds: ComponentId[]; keywords: string[] }> = {
  'fractions': {
    componentIds: ['fraction-bar', 'fraction-circles'],
    keywords: ['fraction', 'numerator', 'denominator', 'half', 'quarter', 'third', 'equivalent', 'simplify']
  },
  'multiplication': {
    componentIds: ['array-grid', 'area-model'],
    keywords: ['multiply', 'multiplication', 'times', 'product', 'factor', 'array', 'groups of']
  },
  'addition-subtraction': {
    componentIds: ['number-line', 'bar-model', 'tape-diagram'],
    keywords: ['add', 'addition', 'subtract', 'subtraction', 'plus', 'minus', 'sum', 'difference', 'total']
  },
  'place-value': {
    componentIds: ['base-ten-blocks', 'place-value-chart'],
    keywords: ['place value', 'ones', 'tens', 'hundreds', 'thousands', 'digit', 'expanded form']
  },
  'equations': {
    componentIds: ['balance-scale', 'tape-diagram'],
    keywords: ['equation', 'solve', 'variable', 'equals', 'unknown', 'x =', 'algebra']
  },
  'ratios-proportions': {
    componentIds: ['ratio-table', 'double-number-line'],
    keywords: ['ratio', 'proportion', 'rate', 'per', 'equivalent ratio', 'scale']
  },
  'percentages': {
    componentIds: ['percent-bar'],
    keywords: ['percent', 'percentage', '%', 'discount', 'tax', 'tip', 'increase', 'decrease']
  },
  'graphing': {
    componentIds: ['coordinate-graph', 'slope-triangle'],
    keywords: ['graph', 'plot', 'coordinate', 'x-axis', 'y-axis', 'slope', 'linear', 'point']
  },
  'statistics': {
    componentIds: ['dot-plot', 'histogram'],
    keywords: ['data', 'mean', 'median', 'mode', 'average', 'frequency', 'distribution']
  },
  'factoring': {
    componentIds: ['factor-tree'],
    keywords: ['factor', 'prime', 'composite', 'divisible', 'GCF', 'LCM', 'factorization']
  },
  'functions': {
    componentIds: ['function-machine', 'coordinate-graph'],
    keywords: ['function', 'input', 'output', 'f(x)', 'rule', 'pattern', 'transform']
  },
  'systems': {
    componentIds: ['systems-equations-visualizer', 'coordinate-graph'],
    keywords: ['system', 'intersection', 'simultaneous', 'two equations', 'solution']
  },
  'matrices': {
    componentIds: ['matrix-display'],
    keywords: ['matrix', 'determinant', 'row', 'column', 'inverse', 'transpose']
  }
};

/**
 * Primitive metadata for UI display
 */
export const PRIMITIVE_METADATA: Record<string, { icon: string; displayName: string; description: string }> = {
  'fraction-bar': {
    icon: '📊',
    displayName: 'Fraction Bar',
    description: 'Interactive bars to visualize and compare fractions'
  },
  'fraction-circles': {
    icon: '🥧',
    displayName: 'Fraction Circles',
    description: 'Pie charts showing fractional parts of a whole'
  },
  'array-grid': {
    icon: '🔢',
    displayName: 'Array Grid',
    description: 'Rows and columns to visualize multiplication'
  },
  'area-model': {
    icon: '📐',
    displayName: 'Area Model',
    description: 'Rectangle model for multiplication and factoring'
  },
  'number-line': {
    icon: '📏',
    displayName: 'Number Line',
    description: 'Visualize addition, subtraction, and counting'
  },
  'bar-model': {
    icon: '📊',
    displayName: 'Bar Model',
    description: 'Compare quantities with visual bars'
  },
  'tape-diagram': {
    icon: '🎗️',
    displayName: 'Tape Diagram',
    description: 'Part-whole relationships for word problems'
  },
  'base-ten-blocks': {
    icon: '🧱',
    displayName: 'Base Ten Blocks',
    description: 'Hundreds, tens, and ones for place value'
  },
  'place-value-chart': {
    icon: '📋',
    displayName: 'Place Value Chart',
    description: 'Interactive chart showing digit positions'
  },
  'balance-scale': {
    icon: '⚖️',
    displayName: 'Balance Scale',
    description: 'Visualize equation solving and equality'
  },
  'ratio-table': {
    icon: '📊',
    displayName: 'Ratio Table',
    description: 'Table of equivalent ratios'
  },
  'double-number-line': {
    icon: '📏',
    displayName: 'Double Number Line',
    description: 'Two parallel lines for proportional relationships'
  },
  'percent-bar': {
    icon: '📊',
    displayName: 'Percent Bar',
    description: 'Visualize percentages and part-whole'
  },
  'coordinate-graph': {
    icon: '📈',
    displayName: 'Coordinate Graph',
    description: 'Plot points and graph equations'
  },
  'slope-triangle': {
    icon: '📐',
    displayName: 'Slope Triangle',
    description: 'Visualize rise over run for slope'
  },
  'dot-plot': {
    icon: '📍',
    displayName: 'Dot Plot',
    description: 'Data visualization with stacked dots'
  },
  'histogram': {
    icon: '📊',
    displayName: 'Histogram',
    description: 'Frequency distribution bar chart'
  },
  'factor-tree': {
    icon: '🌳',
    displayName: 'Factor Tree',
    description: 'Break down numbers into prime factors'
  },
  'function-machine': {
    icon: '🎰',
    displayName: 'Function Machine',
    description: 'Input-rule-output visualization'
  },
  'systems-equations-visualizer': {
    icon: '📉',
    displayName: 'Systems Visualizer',
    description: 'Graph and solve systems of equations'
  },
  'matrix-display': {
    icon: '🔲',
    displayName: 'Matrix Display',
    description: 'Interactive matrix operations'
  }
};

/**
 * Detected topic from student work
 */
export interface DetectedTopic {
  subject: 'mathematics' | 'language-arts' | 'science' | 'general';
  concept: string;
  gradeEstimate: string;
  confidence: number;
}

/**
 * Primitive suggestion with generation config
 */
export interface PrimitiveSuggestion {
  id: string;
  componentId: ComponentId;
  icon: string;
  displayName: string;
  purpose: string;
  relevanceScore: number;
  generationConfig: {
    topic: string;
    gradeLevel: string;
    specificContext?: string;
  };
}

/**
 * Enhanced analysis result including primitive suggestions
 */
export interface EnhancedAnalysisResult {
  // Existing analysis fields
  summary: string;
  feedback: string;
  latex?: string | null;
  nextSteps?: string[];
  encouragement?: string;

  // New fields for primitive integration
  detectedTopic?: DetectedTopic;
  suggestedPrimitives: PrimitiveSuggestion[];
  shouldSuggestPrimitives: boolean;
  suggestionReason?: string;
}

/**
 * Schema for enhanced scratch pad analysis
 */
const enhancedAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A brief 1-2 sentence summary of what is written or drawn"
    },
    latex: {
      type: Type.STRING,
      description: "The mathematical content converted to LaTeX format if applicable, otherwise null",
      nullable: true
    },
    feedback: {
      type: Type.STRING,
      description: "Constructive feedback. If solving a problem, check steps. If correct, encourage. If mistake, provide helpful hint without giving answer"
    },
    nextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "1-3 CONCRETE next steps using ACTUAL values from the student's work"
    },
    encouragement: {
      type: Type.STRING,
      description: "A short, motivating message for the student"
    },
    detectedTopic: {
      type: Type.OBJECT,
      description: "Classification of the mathematical/educational content",
      properties: {
        subject: {
          type: Type.STRING,
          enum: ['mathematics', 'language-arts', 'science', 'general'],
          description: "The broad subject area"
        },
        concept: {
          type: Type.STRING,
          description: "Specific concept (e.g., 'fractions', 'multiplication', 'equations', 'place-value', 'graphing', 'statistics')"
        },
        gradeEstimate: {
          type: Type.STRING,
          description: "Estimated grade level (e.g., 'kindergarten', 'elementary', 'middle-school', 'high-school')"
        },
        confidence: {
          type: Type.NUMBER,
          description: "Confidence in topic detection (0-1)"
        }
      },
      required: ['subject', 'concept', 'gradeEstimate', 'confidence']
    },
    shouldSuggestPrimitives: {
      type: Type.BOOLEAN,
      description: "Whether to suggest visual tools (true if: clear math concept, student could benefit, not too early in work)"
    },
    suggestionReason: {
      type: Type.STRING,
      description: "Brief reason for suggesting (or not suggesting) visual tools",
      nullable: true
    }
  },
  required: ["summary", "feedback", "encouragement", "shouldSuggestPrimitives"]
};

/**
 * Progress callback interface
 */
export interface EnhancedAnalysisProgressCallback {
  onProgress?: (stage: 'uploading' | 'analyzing' | 'processing' | 'complete', message: string) => void;
}

/**
 * Map detected concept to suggested primitives
 */
function mapConceptToPrimitives(
  concept: string,
  context: string,
  gradeLevel: string
): PrimitiveSuggestion[] {
  const suggestions: PrimitiveSuggestion[] = [];
  const conceptLower = concept.toLowerCase();

  // Find matching concept categories
  for (const [category, mapping] of Object.entries(CONCEPT_PRIMITIVE_MAP)) {
    const categoryMatch = conceptLower.includes(category.replace('-', ' ')) ||
      mapping.keywords.some(kw => conceptLower.includes(kw.toLowerCase()));

    if (categoryMatch) {
      for (const componentId of mapping.componentIds) {
        const metadata = PRIMITIVE_METADATA[componentId];
        if (metadata && suggestions.length < 3) {
          suggestions.push({
            id: `${componentId}-${Date.now()}`,
            componentId: componentId as ComponentId,
            icon: metadata.icon,
            displayName: metadata.displayName,
            purpose: metadata.description,
            relevanceScore: 0.8,
            generationConfig: {
              topic: context || concept,
              gradeLevel: gradeLevel,
              specificContext: concept
            }
          });
        }
      }
    }
  }

  return suggestions.slice(0, 3); // Max 3 suggestions
}

/**
 * Enhanced scratch pad analysis with primitive suggestions
 */
export async function analyzeScratchPadEnhanced(
  imageBase64: string,
  context?: {
    topic?: string;
    gradeLevel?: string;
  },
  callbacks?: EnhancedAnalysisProgressCallback
): Promise<EnhancedAnalysisResult> {
  callbacks?.onProgress?.('uploading', 'Preparing your work...');

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const gradeLevel = context?.gradeLevel || 'elementary';

  const contextInfo = context?.topic
    ? `The student is currently learning about: ${context.topic}. Grade level: ${gradeLevel}.`
    : `Grade level: ${gradeLevel}.`;

  const prompt = `You are an expert AI tutor observing a student's whiteboard/scratch pad.
${contextInfo}

Analyze the visible handwriting, diagrams, and calculations in this image.

## Standard Analysis:
- Provide a brief 1-2 sentence summary of what is written or drawn
- If there's mathematical content, convert it to proper LaTeX format
- Give constructive feedback - if solving a problem, check their steps
- If correct, encourage them enthusiastically
- If there's a mistake, provide a helpful hint without giving the answer immediately

## CRITICAL FOR NEXT STEPS:
- Next steps MUST be concrete and specific to what the student has written
- Tell them EXACTLY what to write or calculate next, with actual numbers/values from their work
- BAD example: "Identify the dimensions of each matrix" (too vague)
- GOOD example: "Multiply the first row [1, 2] by the first column [3, 4] to get: (1×3) + (2×4) = ?"

## Topic Detection:
Classify what mathematical/educational concept the student is working on:
- fractions, multiplication, addition-subtraction, place-value, equations, ratios-proportions
- percentages, graphing, statistics, factoring, functions, systems, matrices, geometry
- Or any other specific concept you can identify

## Visual Tool Suggestions:
Determine if a visual math tool would help this student. Set shouldSuggestPrimitives to TRUE if:
1. The work clearly relates to a visual-friendly concept (fractions, multiplication arrays, number lines, graphs, etc.)
2. The student would benefit from seeing their work visualized interactively
3. There's enough work to warrant a visual aid (not just a few strokes)
4. The student seems to be working through a concept (not just writing an answer)

Set shouldSuggestPrimitives to FALSE if:
- The whiteboard is empty or has minimal content
- The student has already solved the problem correctly
- The concept doesn't lend itself to visualization
- It would interrupt their flow

Be encouraging, educational, and helpful in tone.`;

  try {
    callbacks?.onProgress?.('analyzing', 'Analyzing your work...');

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data,
              },
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: enhancedAnalysisSchema
      }
    });

    callbacks?.onProgress?.('processing', 'Processing feedback...');

    const text = result.text;
    if (!text) {
      throw new Error('No response from Gemini API');
    }

    const parsed = JSON.parse(text);

    // Map detected topic to primitive suggestions
    let suggestedPrimitives: PrimitiveSuggestion[] = [];
    if (parsed.shouldSuggestPrimitives && parsed.detectedTopic) {
      suggestedPrimitives = mapConceptToPrimitives(
        parsed.detectedTopic.concept,
        context?.topic || parsed.detectedTopic.concept,
        gradeLevel
      );
    }

    callbacks?.onProgress?.('complete', 'Ready!');

    return {
      summary: parsed.summary || "Analysis complete.",
      feedback: parsed.feedback || "Keep up the great work!",
      latex: parsed.latex || null,
      nextSteps: parsed.nextSteps || [],
      encouragement: parsed.encouragement || "You're doing great!",
      detectedTopic: parsed.detectedTopic || undefined,
      suggestedPrimitives,
      shouldSuggestPrimitives: parsed.shouldSuggestPrimitives && suggestedPrimitives.length > 0,
      suggestionReason: parsed.suggestionReason || undefined
    };
  } catch (error) {
    console.error("Enhanced Scratch Pad Analysis Error:", error);
    throw error;
  }
}
