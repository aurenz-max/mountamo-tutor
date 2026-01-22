/**
 * Scale Spectrum Generator - Dedicated service for nuanced judgment activities
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface SpectrumAnchor {
  position: number;
  label: string;
  example: string;
}

export interface SpectrumConfig {
  leftLabel: string;
  rightLabel: string;
  leftColor: string;
  rightColor: string;
  anchors: SpectrumAnchor[];
}

export interface SpectrumItem {
  id: number;
  title: string;
  description: string;
  correctPosition: number;
  tolerance: number;
  explanation: string;
  metadata?: string;
}

export interface ScaleSpectrumData {
  title: string;
  description: string;
  spectrum: SpectrumConfig;
  items: SpectrumItem[];
}

/**
 * Generate Scale Spectrum content
 *
 * Creates an interactive spectrum/scale activity where students place items
 * along a continuum, learning to make nuanced judgments.
 *
 * @param topic - The topic being explored
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Scale spectrum data with items to place
 */
export const generateScaleSpectrum = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<ScaleSpectrumData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Question framing the spectrum judgment" },
      description: { type: Type.STRING, description: "Brief instruction for the student" },
      spectrum: {
        type: Type.OBJECT,
        properties: {
          leftLabel: { type: Type.STRING, description: "Left endpoint (3 words max)" },
          rightLabel: { type: Type.STRING, description: "Right endpoint (3 words max)" },
          leftColor: { type: Type.STRING, description: "Hex color for left (default #ef4444)" },
          rightColor: { type: Type.STRING, description: "Hex color for right (default #22c55e)" },
          anchors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                position: { type: Type.NUMBER, description: "Position 0-100 on spectrum" },
                label: { type: Type.STRING, description: "Endpoint label" },
                example: { type: Type.STRING, description: "Concrete example (5 words max)" }
              },
              required: ["position", "label", "example"]
            },
            description: "Exactly 5 anchors at positions 0, 25, 50, 75, 100"
          }
        },
        required: ["leftLabel", "rightLabel", "leftColor", "rightColor", "anchors"]
      },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.NUMBER },
            title: { type: Type.STRING, description: "Item name (concise)" },
            description: { type: Type.STRING, description: "One sentence explaining what this item is" },
            correctPosition: { type: Type.NUMBER, description: "Position 0-100 on spectrum" },
            tolerance: { type: Type.NUMBER, description: "Acceptable margin of error (5-18)" },
            explanation: { type: Type.STRING, description: "2-3 sentences justifying the position" },
            metadata: { type: Type.STRING, description: "Optional contextual metadata like date (e.g., '235 CE'), step number (e.g., 'Step 3'), category, or other brief identifier relevant to the topic. Leave empty if not applicable." }
          },
          required: ["id", "title", "description", "correctPosition", "tolerance", "explanation"]
        },
        description: "4-6 items that span the spectrum meaningfully"
      }
    },
    required: ["title", "description", "spectrum", "items"]
  };

  const prompt = `You are generating a Scale/Spectrum learning activity. The student will place items along a continuum, learning to make nuanced judgments rather than binary classifications.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || 'Help students make nuanced judgments'}

## Design Principles

1. **Anchors calibrate judgment**: Each anchor should be an unambiguous reference point. Students use these to triangulate where items belong. Choose anchors that are widely understood and not themselves debatable.

2. **Tolerance reflects genuine ambiguity**: Items with clear positions get tolerance 5-8. Items where reasonable people disagree get tolerance 12-18. Never use tolerance > 20 (that's too vague to teach anything).

3. **Avoid clustering**: Distribute items across the spectrum. Include at least one item in each third (0-33, 34-66, 67-100). Clustering defeats the purpose.

4. **Explanations model reasoning**: The explanation should articulate the factors that determine position, not just assert it. Use phrases like "because...", "considering that...", "while X, also Y..."

5. **Title as genuine question**: Frame the title as something worth asking, not a label. "How formal is this writing?" not "Writing Formality Spectrum"

6. **Metadata usage**: Include the metadata field when contextually relevant:
   - For historical topics: Include dates (e.g., "235 CE", "1776", "14th Century")
   - For sequential processes: Include step numbers (e.g., "Step 1", "Phase 2")
   - For categorized items: Include category names (e.g., "Politics", "Science")
   - For general topics without natural metadata: Leave empty or omit

## Common Spectrum Types

- **Degree/Intensity**: How much of a quality (formal↔informal, concrete↔abstract)
- **Moral/Ethical**: How justifiable, fair, democratic, ethical
- **Temporal**: How recent, how long-lasting, how fast-changing
- **Certainty**: How well-established, how disputed, how speculative
- **Complexity**: How simple↔complex, how many factors involved
- **Scope**: How narrow↔broad, local↔global, individual↔systemic

Generate 4-6 items that span the spectrum meaningfully. Ensure the activity teaches discrimination—students should finish understanding WHY things fall where they do, not just WHERE.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('📊 Scale Spectrum Generated from dedicated service:', {
    topic,
    itemCount: data.items?.length || 0
  });

  return data as ScaleSpectrumData;
};
