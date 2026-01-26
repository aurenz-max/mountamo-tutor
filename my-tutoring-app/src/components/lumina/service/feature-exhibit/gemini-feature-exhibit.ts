/**
 * Feature Exhibit Generator - Dedicated service for deep-dive editorial content
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface FeatureSection {
  heading: string;
  content: string;
}

export interface EvidenceClaim {
  claimText: string;
  correctSectionIndex: number; // Which section (0-based) provides evidence for this claim
}

export interface SynthesisOption {
  id: string;
  text: string;
}

export interface FeatureExhibitData {
  title: string;
  visualPrompt: string;
  sections: FeatureSection[];
  relatedTerms: string[];

  // Phase 1: Explore - True/False knowledge check
  exploreStatement: string;     // A true/false statement about the main concept
  exploreCorrectAnswer: boolean; // The correct answer
  exploreRationale: string;     // Explanation after they answer

  // Phase 2: Practice - Evidence matching
  evidenceClaims: EvidenceClaim[]; // 2-3 claims to match to sections
  evidenceInstructions: string;    // Instructions for the matching task

  // Phase 3: Apply - Multiple choice synthesis
  synthesisQuestion: string;       // A higher-order thinking question
  synthesisOptions: SynthesisOption[]; // 4 multiple choice options
  synthesisCorrectId: string;      // ID of the correct option
  synthesisRationale: string;      // Explanation of the correct answer

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

/**
 * Generate Feature Exhibit content
 *
 * Creates a deep-dive editorial section with multiple subsections
 * for comprehensive topic exploration.
 *
 * @param topic - The topic being explored in depth
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent and objective info
 * @returns Feature exhibit data with sections and related terms
 */
export const generateFeatureExhibit = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    objectiveVerb?: string;
  }
): Promise<FeatureExhibitData> => {
  const objectiveContext = config?.objectiveText
    ? `\n\n🎯 LEARNING OBJECTIVE: "${config.objectiveText}"
All sections must directly support the learning objective above.`
    : '';

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      visualPrompt: { type: Type.STRING },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            heading: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["heading", "content"]
        }
      },
      relatedTerms: { type: Type.ARRAY, items: { type: Type.STRING } },

      // Phase 1: Explore
      exploreStatement: { type: Type.STRING },
      exploreCorrectAnswer: { type: Type.BOOLEAN },
      exploreRationale: { type: Type.STRING },

      // Phase 2: Practice
      evidenceClaims: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            claimText: { type: Type.STRING },
            correctSectionIndex: { type: Type.NUMBER }
          },
          required: ["claimText", "correctSectionIndex"]
        }
      },
      evidenceInstructions: { type: Type.STRING },

      // Phase 3: Apply
      synthesisQuestion: { type: Type.STRING },
      synthesisOptions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["id", "text"]
        }
      },
      synthesisCorrectId: { type: Type.STRING },
      synthesisRationale: { type: Type.STRING }
    },
    required: [
      "title", "visualPrompt", "sections", "relatedTerms",
      "exploreStatement", "exploreCorrectAnswer", "exploreRationale",
      "evidenceClaims", "evidenceInstructions",
      "synthesisQuestion", "synthesisOptions", "synthesisCorrectId", "synthesisRationale"
    ]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create an INTERACTIVE feature exhibit with 3-phase evaluation for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Provide comprehensive exploration of the topic'}
${objectiveContext}

Generate a deep-dive editorial section with multiple subsections AND interactive comprehension questions.
${objectiveContext ? 'All sections must directly support the learning objective above.' : ''}

CONTENT STRUCTURE:
- Create 3-4 well-structured sections with clear headings and detailed content
- Each section should be 2-3 sentences that provide substantive information
- Include 3-5 related terms for deeper exploration

3-PHASE INTERACTIVE ASSESSMENT:

**PHASE 1 - EXPLORE (True/False Knowledge Check):**
Create a single true/false statement that captures the MAIN CONCEPT of the entire exhibit.
- The statement should be clear and definitively true or false
- Write a rationale (2-3 sentences) explaining why the answer is correct
- This activates prior knowledge and sets the reading purpose

**PHASE 2 - PRACTICE (Evidence Matching):**
Create 2-3 specific claims that are supported by evidence in your sections.
- Each claim should clearly connect to ONE specific section (provide the 0-based section index)
- Claims should be factual statements that students can verify by reading the sections
- Example: If section 2 discusses photosynthesis, a claim might be "Plants convert light energy into chemical energy"
- Write clear instructions for the matching task

**PHASE 3 - APPLY (Multiple Choice Synthesis):**
Create a higher-order thinking question that requires synthesizing information across ALL sections.
- Question types: comparison, cause-effect, application, or analysis
- Provide exactly 4 options with IDs "a", "b", "c", "d"
- Include sophisticated distractors:
  * One that reveals a common misconception
  * One that shows partial understanding (correct but incomplete)
  * One that reverses a relationship or confuses concepts
- The correct answer should require understanding the relationships between sections
- Write a detailed rationale (3-4 sentences) explaining why the correct answer is right

QUALITY CHECKLIST:
✓ Sections provide comprehensive, accurate information
✓ True/false statement captures the central concept
✓ Evidence claims can be verified in specific sections
✓ Synthesis question requires thinking across all sections
✓ Distractors are plausible but incorrect for specific reasons
✓ All rationales provide educational explanations`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('📰 Feature Exhibit Generated from dedicated service:', {
    topic,
    sectionCount: data.sections?.length || 0
  });

  return data as FeatureExhibitData;
};
