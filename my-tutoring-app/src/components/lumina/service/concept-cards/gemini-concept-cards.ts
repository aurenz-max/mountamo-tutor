/**
 * Concept Card Grid Generator - Dedicated service for concept card generation
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 *
 * Context-native (reader-fit 9b): reads the typed `GenerationContext`, resolves the
 * audience band from the canonical `ctx.grade`, and stamps `gradeLevel` + a flat
 * `cardEmoji` onto each card so the component can render the pre-reader (PRE) card
 * face + read-aloud-on-flip at kindergarten.
 */

import { Type, Schema } from "@google/genai";
import { ConceptCardData } from "../../types";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";

/**
 * Resolve the pre-reader grade KEY from context. Prefers the canonical numeric
 * grade (`ctx.grade`), falls back to the prose display context for the pre-reader
 * signal only. Mirrors resolvePreReaderGradeKey in the other explainer generators.
 */
function resolvePreReaderGradeKey(ctx: GenerationContext): string | undefined {
  const canonical = (ctx.grade ?? '').toString().trim().toLowerCase();
  if (canonical === 'k' || canonical === '0' || canonical === 'kindergarten') return 'K';
  if (/^\d+$/.test(canonical)) return canonical;
  if (/(kinder|preschool|pre-?k\b|prek|pre-?reader)/i.test(ctx.gradeContext ?? '')) return 'K';
  return canonical || undefined;
}

/**
 * Generate Concept Cards content
 *
 * Creates a grid of concept cards with definitions, visual prompts,
 * and pedagogical elements appropriate for the target audience.
 *
 * @param ctx - The single typed generation context (topic, grade, intent…)
 * @returns Array of concept cards with structured educational content
 */
export const generateConceptCards = async (
  ctx: GenerationContext,
): Promise<{ cards: ConceptCardData[] }> => {
  const { topic } = ctx;
  const gradeContext = ctx.gradeContext;
  const config = ctx.raw as { itemCount?: number };
  const gradeKey = resolvePreReaderGradeKey(ctx);
  const isPreReader = gradeKey === 'K';

  const itemCount = config?.itemCount || 3;
  const objectiveText = ctx.objective.text;
  const objectiveVerb = ctx.objective.verb;
  const objectiveContext = objectiveText
    ? `\n\n🎯 LEARNING OBJECTIVE: "${objectiveText}"
The generated content MUST directly support achieving this specific learning objective.
Every element should help the student ${objectiveVerb || 'understand'} the concept.`
    : '';

  // Pre-reader (kindergarten): the card FACE is an emoji (the child cannot read the
  // title), and the tutor reads the back aloud on flip — so the copy must stay short
  // and concrete, and each card MUST carry a depicting emoji.
  const preReaderRules = isPreReader ? `

PRE-READER MODE (kindergarten — the child CANNOT read; the card FACE is a big emoji and a tutor reads the back aloud on flip):
- title: 1-3 words, a CONCRETE thing a 5-year-old can picture.
- cardEmoji: REQUIRED — a SINGLE emoji that clearly depicts the concept (this is the card face the child sees). One distinct emoji per card.
- definition: ONE short spoken sentence, MAX 12 words, concrete.
- curiosityNote: ONE short spoken sentence, MAX 12 words, a fun observable detail.
- conceptElements: at most 2, each label 1-2 words with a very short concrete detail.
- Avoid abstract vocabulary, dates, and technical terms entirely.` : '';

  const cardProperties: Record<string, Schema> = {
    title: { type: Type.STRING },
    subheading: { type: Type.STRING },
    definition: { type: Type.STRING },
    originStory: { type: Type.STRING },
    conceptElements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          detail: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['primary', 'secondary', 'highlight'] }
        }
      }
    },
    timelineContext: { type: Type.STRING },
    curiosityNote: { type: Type.STRING },
    visualPrompt: { type: Type.STRING },
    themeColor: { type: Type.STRING },
    // Flat per-card emoji (NOT nested inside conceptElements) — sidesteps the
    // flash-lite nested-array emoji footgun. Required at K, optional elsewhere.
    cardEmoji: {
      type: Type.STRING,
      nullable: true,
      description: "PRE-READER (kindergarten) only: a single emoji depicting this concept — the card face a non-reader sees",
    },
  };

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      cards: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: cardProperties,
          required: ["title", "subheading", "definition", "conceptElements", "timelineContext", "originStory", "curiosityNote", "visualPrompt", "themeColor"]
        }
      }
    },
    required: ["cards"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create ${itemCount} concept cards for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${ctx.intent || 'Introduce and explain key concepts'}
${objectiveContext}

Generate ${itemCount} key concepts with definitions, visual prompts, and pedagogical elements.
${objectiveContext ? 'Focus on concepts that directly support the learning objective above.' : ''}
${preReaderRules}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  // Stamp the resolved grade key + ensure a card-face emoji so the component can
  // band-gate to the PRE (pre-reader) treatment without re-parsing prose.
  const cards: ConceptCardData[] = (Array.isArray(data.cards) ? data.cards : []).map((c: ConceptCardData) => ({
    ...c,
    ...(gradeKey ? { gradeLevel: gradeKey } : {}),
    ...(isPreReader
      ? { cardEmoji: (typeof c.cardEmoji === 'string' && c.cardEmoji.trim()) ? c.cardEmoji.trim() : '⭐' }
      : (c.cardEmoji ? { cardEmoji: c.cardEmoji } : {})),
  }));

  console.log('📇 Concept Cards Generated from dedicated service:', {
    topic,
    gradeLevel: gradeKey,
    isPreReader,
    cardCount: cards.length,
  });

  return { cards };
};
