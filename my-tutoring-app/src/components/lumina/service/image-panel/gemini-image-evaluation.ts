import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { ImageAnnotation } from "../../primitives/ImagePanel";
import type { StudentPlacement } from "../../primitives/ImagePanel";

/**
 * Schema for LLM annotation evaluation response
 */
const annotationEvaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    annotationResults: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          annotationId: { type: Type.STRING },
          label: { type: Type.STRING },
          placementCorrect: { type: Type.BOOLEAN },
          expectedRegion: {
            type: Type.STRING,
            description: "Name/description of the correct region (e.g., 'upper cranium', 'left ventricle')"
          },
          proximityScore: {
            type: Type.NUMBER,
            description: "0-100 score: 100=perfect, 70-99=close, 40-69=nearby, 0-39=wrong"
          },
          reasoning: {
            type: Type.STRING,
            description: "Brief, encouraging explanation of placement accuracy"
          }
        },
        required: ["annotationId", "label", "placementCorrect", "proximityScore", "reasoning"]
      }
    },
    overallFeedback: {
      type: Type.STRING,
      description: "Encouraging 1-2 sentence summary of annotation quality"
    },
    confidence: {
      type: Type.NUMBER,
      description: "0-100: LLM's confidence in this evaluation"
    }
  },
  required: ["annotationResults", "overallFeedback", "confidence"]
};

export interface ImageEvaluationResult {
  annotationResults: Array<{
    annotationId: string;
    label: string;
    placementCorrect: boolean;
    expectedRegion: string;
    proximityScore: number;
    reasoning: string;
  }>;
  overallFeedback: string;
  confidence: number;
}

export interface EvaluationProgressCallback {
  onProgress?: (stage: 'uploading' | 'analyzing' | 'processing' | 'complete', message: string) => void;
}

/**
 * Evaluate student annotation placements using Gemini Vision API
 */
export async function evaluateImageAnnotations(
  imageBase64: string,
  annotations: ImageAnnotation[],
  studentPlacements: StudentPlacement[],
  learningObjective: string,
  callbacks?: EvaluationProgressCallback
): Promise<ImageEvaluationResult> {
  callbacks?.onProgress?.('uploading', 'Preparing your annotations...');

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  // Build expected annotations context
  const expectedLabels = annotations.map(a =>
    `- "${a.label}"${a.isKey ? ' (KEY CONCEPT - must be accurate)' : ''}: ${a.description}${a.category ? ` [Category: ${a.category}]` : ''}`
  ).join('\n');

  // Build student placement info
  const placementInfo = studentPlacements.map(p =>
    `- "${p.label}" placed at position (${p.position.x.toFixed(1)}%, ${p.position.y.toFixed(1)}%)`
  ).join('\n');

  const prompt = `You are an expert educational AI evaluating a student's image annotation exercise.

LEARNING OBJECTIVE: ${learningObjective}

EXPECTED ANNOTATIONS:
${expectedLabels}

STUDENT'S PLACEMENTS:
${placementInfo}

Analyze the image and evaluate each annotation placement:
1. Determine if each label is placed in the anatomically/geographically/conceptually correct region
2. Give a proximity score (0-100):
   - 100: Perfect placement in the exact correct location
   - 70-99: In the correct general region but not precisely centered
   - 40-69: In an adjacent or nearby region (student shows partial understanding)
   - 0-39: Completely wrong location (fundamental misunderstanding)
3. Provide brief, encouraging reasoning explaining the placement accuracy

EVALUATION GUIDELINES:
- Be lenient with placements in the right general area (70+ score)
- Focus on conceptual understanding, not pixel-perfect precision
- Annotations marked "KEY CONCEPT" require higher accuracy (75+ threshold)
- Consider the learning objective when evaluating correctness
- Use encouraging, educational language in reasoning

Identify the expected region name for each annotation (e.g., "cranium", "heart's left ventricle", "Pacific Ocean").`;

  try {
    callbacks?.onProgress?.('analyzing', 'AI is analyzing your annotations...');

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
        responseSchema: annotationEvaluationSchema
      }
    });

    callbacks?.onProgress?.('processing', 'Processing feedback...');

    const text = result.text;
    if (!text) {
      throw new Error('No response from Gemini API');
    }

    const parsed = JSON.parse(text);

    callbacks?.onProgress?.('complete', 'Evaluation complete!');

    return {
      annotationResults: parsed.annotationResults || [],
      overallFeedback: parsed.overallFeedback || "Great effort on your annotations!",
      confidence: parsed.confidence || 80
    };
  } catch (error) {
    console.error("Gemini Image Annotation Evaluation Error:", error);
    throw error;
  }
}
