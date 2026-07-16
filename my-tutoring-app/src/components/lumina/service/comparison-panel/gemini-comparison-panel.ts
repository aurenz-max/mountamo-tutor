/**
 * Comparison Panel Generator - Dedicated service for A vs B comparisons
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 *
 * Context-native (reader-fit 9c): reads the whole `GenerationContext`, resolves the
 * audience band from the canonical `ctx.grade`, and stamps `gradeLevel` onto the
 * returned data so the component can render the pre-reader (PRE) treatment at K.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection, buildGradeLine } from "../scopeContext";

// Import types from the centralized types file
import type { ComparisonData } from '../../types';

export interface ComparisonSynthesis {
  mainInsight: string;
  keyDifferences: string[];
  keySimilarities: string[];
  whenToUse?: {
    item1Context: string;
    item2Context: string;
  };
  commonMisconception?: string;
}

export interface ComparisonPanelData extends ComparisonData {}

/**
 * Resolve the pre-reader grade KEY from context. Prefers the canonical numeric
 * grade (`ctx.grade`), falls back to the prose display context for the pre-reader
 * signal only. Mirrors resolvePreReaderGradeKey in the other explainer generators.
 */
function resolvePreReaderGradeKey(ctx: GenerationContext): string | undefined {
  const canonical = (ctx.grade ?? '').toString().trim().toLowerCase();
  if (canonical === 'k' || canonical === '0' || canonical === 'kindergarten') return 'K';
  if (/^\d+$/.test(canonical)) return canonical;
  // Fall back to the display context for the pre-reader signal only.
  if (/(kinder|preschool|pre-?k\b|prek|pre-?reader)/i.test(ctx.gradeContext ?? '')) return 'K';
  return canonical || undefined;
}

/**
 * Generate Comparison Panel content
 *
 * Creates a side-by-side comparison of two items with synthesis insights.
 *
 * @param ctx - The single typed generation context (topic, grade, intent, scope…)
 * @returns Comparison data with two items, synthesis, and a stamped gradeLevel
 */
export const generateComparisonPanel = async (
  ctx: GenerationContext,
): Promise<ComparisonPanelData> => {
  const { topic } = ctx;
  const gradeContext = ctx.gradeContext;
  const gradeKey = resolvePreReaderGradeKey(ctx);
  const isPreReader = gradeKey === 'K';

  const objectiveText = ctx.objective.text || ctx.intent;
  const objectiveContext = objectiveText
    ? `\n\n🎯 LEARNING OBJECTIVE: "${objectiveText}"
The comparison must help students understand the learning objective above.`
    : '';
  const scopeSection = buildScopePromptSection(ctx.scope);
  const gradeLine = buildGradeLine(ctx.grade);

  // Pre-reader (kindergarten) band: the gate becomes a picture true/false the tutor
  // reads aloud, and the child taps 👍/👎 — so the gate statement must be a short,
  // concrete, picturable claim about the two items, and the card copy must stay short.
  const preReaderRules = isPreReader ? `

PRE-READER MODE (kindergarten — the child CANNOT read; a tutor reads everything aloud and the child answers by tapping a PICTURE 👍 or 👎):
- title / intro: title 2-4 words; intro ONE short spoken sentence, MAX 12 words.
- Each item.name: 1-3 words, a CONCRETE thing a 5-year-old can picture (an animal, an object, a place). NO abstract categories.
- item.points: exactly 2 per item, each 1-5 words, concrete and observable (color, size, sound, where it lives). No sentences, no technical terms.
- item.description: ONE short spoken sentence, MAX 10 words.
- gates: exactly 2. Each gate.question is ONE short TRUE/FALSE statement, MAX 12 words, that a child can judge by LOOKING at the two picture cards (e.g. "A cat is bigger than a mouse."). Concrete and observable ONLY. Do NOT let the wording leak whether it is true or false. No "both", no abstract relationships.
- synthesis: keep mainInsight to ONE short sentence; keyDifferences / keySimilarities each 1-2 short concrete phrases. (The tutor speaks these; the child does not read them.)` : '';

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      intro: { type: Type.STRING },
      item1: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "description", "visualPrompt", "points"]
      },
      item2: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "description", "visualPrompt", "points"]
      },
      synthesis: {
        type: Type.OBJECT,
        properties: {
          mainInsight: { type: Type.STRING },
          keyDifferences: { type: Type.ARRAY, items: { type: Type.STRING } },
          keySimilarities: { type: Type.ARRAY, items: { type: Type.STRING } },
          whenToUse: {
            type: Type.OBJECT,
            properties: {
              item1Context: { type: Type.STRING },
              item2Context: { type: Type.STRING }
            },
            required: ["item1Context", "item2Context"]
          },
          commonMisconception: { type: Type.STRING }
        },
        required: ["mainInsight", "keyDifferences", "keySimilarities"]
      },
      gates: {
        type: Type.ARRAY,
        description: "Comprehension gates that progressively unlock content (2 gates recommended)",
        items: {
          type: Type.OBJECT,
          properties: {
            question: {
              type: Type.STRING,
              description: "A true/false question that tests understanding of the comparison"
            },
            correctAnswer: {
              type: Type.BOOLEAN,
              description: "The correct answer (true or false)"
            },
            rationale: {
              type: Type.STRING,
              description: "Explanation of why the answer is correct, providing teaching value (2-3 sentences)"
            },
            unlocks: {
              type: Type.STRING,
              description: "What section this gate unlocks: 'synthesis' for first gate, 'complete' for final gate"
            }
          },
          required: ["question", "correctAnswer", "rationale", "unlocks"]
        }
      }
    },
    required: ["title", "intro", "item1", "item2", "synthesis", "gates"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create comparison panel for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
${gradeLine ? gradeLine + '\n' : ''}INTENT: ${ctx.intent || 'Compare and contrast key aspects'}
${scopeSection}${objectiveContext}

Generate a side-by-side comparison with two items.
${objectiveContext ? 'The comparison must help students understand the learning objective above.' : ''}

For the synthesis section, provide:
- mainInsight: A clear, insightful statement about the relationship between the two items (1-2 sentences)
- keyDifferences: 2-3 specific, concrete differences that students should recognize
- keySimilarities: 2-3 specific, concrete similarities that connect the concepts
- whenToUse: Explain when/why to use item1 vs item2 (practical application context)
- commonMisconception: One common mistake students make when comparing these concepts

CRITICAL - COMPREHENSION GATES:
Create exactly 2 comprehension gates that ensure students read and understand the content:

Gate 1 (unlocks: "synthesis"):
- Question should test understanding of KEY DIFFERENCES between the two items
- Must require reading the comparison cards to answer correctly
- Should be answerable after exploring both item cards
- Example: "Item A uses X approach while Item B uses Y approach" (T/F)

Gate 2 (unlocks: "complete"):
- Question should test understanding of KEY SIMILARITIES or practical application
- Must require reading the synthesis section to answer correctly
- Should reinforce the main insight or common misconception
- Example: "Both items share the characteristic of Z" (T/F)

Gates must:
- Be answerable ONLY by reading the content (not general knowledge)
- Target the MOST IMPORTANT concepts in the comparison
- Have clear, educational rationales that teach when revealed
- Progress from basic (differences) to deeper (synthesis/application)
${preReaderRules}

Make all content clear, grade-appropriate, and actionable for learning.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text) as ComparisonPanelData;

  // Stamp the resolved grade key so the component can band-gate to the PRE
  // (pre-reader) treatment at kindergarten without re-parsing prose.
  if (gradeKey) data.gradeLevel = gradeKey;

  console.log('⚖️ Comparison Panel Generated from dedicated service:', {
    topic,
    gradeLevel: gradeKey,
    isPreReader,
    item1: data.item1?.name,
    item2: data.item2?.name
  });

  return data as ComparisonPanelData;
};
