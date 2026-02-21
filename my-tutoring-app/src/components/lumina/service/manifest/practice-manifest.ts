/**
 * Practice Manifest Generator
 *
 * Generates a structured manifest that pairs practice problems with
 * interactive visual primitives. Follows the same pattern as gemini-manifest.ts
 * but produces a flat problem list instead of objective-centric blocks.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import { PracticeManifest } from "../../types";
import { ai } from "../geminiClient";
import { buildPracticeVisualCatalogContext } from "./practice-visual-catalog";

/**
 * Progress callback for practice manifest generation streaming
 */
export interface PracticeManifestProgressCallback {
  onProgress?: (message: string) => void;
  onThinking?: (thought: string) => void;
}

/**
 * Grade level context for practice problems
 */
const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'toddler': 'toddlers (ages 1-3)',
    'preschool': 'preschool children (ages 3-5)',
    'kindergarten': 'kindergarten students (ages 5-6)',
    'elementary': 'elementary students (grades 1-5)',
    'middle-school': 'middle school students (grades 6-8)',
    'high-school': 'high school students (grades 9-12)',
    'undergraduate': 'undergraduate college students',
    'graduate': 'graduate students',
    'phd': 'doctoral students and researchers',
  };
  return contexts[gradeLevel] || contexts['elementary'];
};

/**
 * Gemini structured output schema for PracticeManifest
 */
const practiceManifestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    problemCount: { type: Type.NUMBER },
    items: {
      type: Type.ARRAY,
      description: "Ordered list of practice items. Each is one problem.",
      items: {
        type: Type.OBJECT,
        properties: {
          instanceId: {
            type: Type.STRING,
            description: "Unique ID (e.g., 'problem-1', 'problem-2')"
          },
          problemText: {
            type: Type.STRING,
            description: "The problem question or contextual prompt the student sees"
          },
          difficulty: {
            type: Type.STRING,
            enum: ["easy", "medium", "hard"],
          },
          rationale: {
            type: Type.STRING,
            description: "Educational rationale for this problem"
          },
          teachingNote: {
            type: Type.STRING,
            description: "Brief teaching guidance for scaffolding"
          },
          visualPrimitive: {
            type: Type.OBJECT,
            nullable: true,
            description: "When set, the student answers by interacting with this visual primitive instead of text options. Set to null if no visual fits.",
            properties: {
              componentId: {
                type: Type.STRING,
                description: "Visual primitive ID from the catalog (e.g., 'fraction-circles', 'balance-scale')"
              },
              intent: {
                type: Type.STRING,
                description: "Natural-language instructions for the generator: what to build, target values, task type, difficulty context. The dedicated generator will handle full configuration."
              },
              successCriteria: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "What the student needs to do to answer correctly" },
                  targetValue: { type: Type.STRING, description: "Expected answer value for validation" },
                },
                required: ["description"],
              },
            },
            required: ["componentId", "intent", "successCriteria"],
          },
          standardProblem: {
            type: Type.OBJECT,
            nullable: true,
            description: "When visualPrimitive is null, this specifies a standard text-based problem type. Set to null if using a visual.",
            properties: {
              problemType: {
                type: Type.STRING,
                enum: ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", "sequencing_activity", "categorization_activity"],
              },
              generationIntent: {
                type: Type.STRING,
                description: "Detailed instructions for generating this specific problem"
              },
            },
            required: ["problemType", "generationIntent"],
          },
        },
        required: ["instanceId", "problemText", "difficulty", "rationale", "teachingNote"],
      },
    },
  },
  required: ["topic", "gradeLevel", "problemCount", "items"],
};

/**
 * Generate a practice manifest that pairs problems with visual primitives.
 * Supports optional progress callbacks for streaming UI updates.
 */
export const generatePracticeManifest = async (
  topic: string,
  gradeLevel: string,
  problemCount: number,
  callbacks?: PracticeManifestProgressCallback,
): Promise<PracticeManifest> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);
  const visualCatalog = buildPracticeVisualCatalogContext();

  callbacks?.onProgress?.(`Designing ${problemCount} practice problems...`);

  const prompt = `You are an educational content designer creating an interactive practice session.

ASSIGNMENT: Generate ${problemCount} practice problems for: "${topic}"
TARGET AUDIENCE: ${gradeLevelContext}

${visualCatalog}

## YOUR TASK

For each problem, decide:
1. Is there a visual primitive that would create a BETTER learning experience than multiple choice?
   - If YES: set "visualPrimitive" with componentId, intent, and successCriteria. Set "standardProblem" to null.
   - If NO: set "standardProblem" with problemType and generationIntent. Set "visualPrimitive" to null.

2. EVERY item must have exactly one of: visualPrimitive OR standardProblem (never both, never neither)

## VISUAL PRIMITIVE RULES
- The "intent" field is natural language describing what the generator should build (target values, task type, context). Dedicated generators handle the full configuration — you just describe what you want.
- successCriteria.description: tell the student what to DO
- successCriteria.targetValue: the expected answer

## PROBLEM VARIETY
- Vary difficulty (some easy, some medium, some hard)
- Math topics: aim for 60-80% visual primitives
- Non-math topics: use standard problems mostly (0-20% visual)
- Mix different visual primitives when possible

## EXAMPLE (Fractions for Elementary)

{
  "topic": "Fractions",
  "gradeLevel": "elementary",
  "problemCount": 3,
  "items": [
    {
      "instanceId": "problem-1",
      "problemText": "An explorer finds a ribbon and cuts it into 3 equal parts. What fraction is one part?",
      "difficulty": "easy",
      "rationale": "Tests basic understanding of unit fractions",
      "teachingNote": "Connect to real-world sharing scenarios",
      "visualPrimitive": {
        "componentId": "fraction-circles",
        "intent": "Build a fraction circle for 1/3. Task type: build. The student shades one out of three equal sections.",
        "successCriteria": {
          "description": "Shade the circle to show 1/3",
          "targetValue": "1/3"
        }
      },
      "standardProblem": null
    },
    {
      "instanceId": "problem-2",
      "problemText": "Which fraction is larger: 1/2 or 1/4?",
      "difficulty": "medium",
      "rationale": "Tests fraction comparison using visual reasoning",
      "teachingNote": "Use side-by-side fraction bars to compare",
      "visualPrimitive": {
        "componentId": "fraction-bar",
        "intent": "Compare fractions 1/2 and 1/4 using fraction bars. Task type: compare.",
        "successCriteria": {
          "description": "Shade both fraction bars and identify that 1/2 is larger",
          "targetValue": "1/2"
        }
      },
      "standardProblem": null
    },
    {
      "instanceId": "problem-3",
      "problemText": "True or false: 2/4 is the same as 1/2.",
      "difficulty": "easy",
      "rationale": "Tests understanding of equivalent fractions",
      "teachingNote": "Conceptual check before visual exploration",
      "visualPrimitive": null,
      "standardProblem": {
        "problemType": "true_false",
        "generationIntent": "True/false about whether 2/4 equals 1/2. Answer: TRUE."
      }
    }
  ]
}

Now generate the practice manifest for: "${topic}" (${gradeLevel}, ${problemCount} problems)
Return ONLY valid JSON matching the schema.`;

  callbacks?.onProgress?.('AI is thinking about the best problems...');

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: practiceManifestSchema,
    },
  });

  let accumulatedText = '';
  let chunkCount = 0;
  for await (const chunk of responseStream) {
    if (chunk.text) {
      accumulatedText += chunk.text;
      chunkCount++;
      // Send periodic progress as chunks arrive
      if (chunkCount % 3 === 0) {
        callbacks?.onProgress?.('Generating problem details...');
      }
    }
  }

  if (!accumulatedText) throw new Error("No practice manifest returned");

  callbacks?.onProgress?.('Parsing manifest...');

  let jsonStr = accumulatedText.trim();
  const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) jsonStr = match[1].trim();

  const firstOpen = jsonStr.indexOf('{');
  const lastClose = jsonStr.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
  }

  const manifest = JSON.parse(jsonStr) as PracticeManifest;

  const visualCount = manifest.items.filter(i => i.visualPrimitive).length;
  const standardCount = manifest.items.filter(i => i.standardProblem).length;
  console.log(`📋 Practice Manifest Generated: ${manifest.items.length} items`);
  console.log(`   🎨 Visual primitives: ${visualCount}, 📝 Standard problems: ${standardCount}`);

  callbacks?.onProgress?.(`Manifest ready: ${manifest.items.length} problems (${visualCount} interactive, ${standardCount} text)`);

  return manifest;
};
