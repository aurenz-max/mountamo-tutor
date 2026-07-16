import { Type, Schema, ThinkingLevel } from "@google/genai";
import { FlashcardDeckData, FlashcardItem } from '../../types';
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";

type FlashcardDeckConfig = {
  cardCount?: number;
  focusArea?: string;
  includeExamples?: boolean;
};

/**
 * Schema definition for Flashcard Deck
 */
const flashcardDeckSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      description: "Array of flashcard items",
      items: {
        type: Type.OBJECT,
        properties: {
          term: {
            type: Type.STRING,
            description: "The concept, word, or question (front of card)"
          },
          definition: {
            type: Type.STRING,
            description: "The concise answer or explanation (back of card, under 25 words)"
          },
          category: {
            type: Type.STRING,
            description: "A short sub-category label (e.g., 'Vocabulary', 'Key Concept', 'Formula')"
          },
          // Flat per-card emoji (NOT nested) — the pre-reader card face. Required at
          // K, optional elsewhere. Sidesteps the flash-lite nested-array emoji footgun.
          cardEmoji: {
            type: Type.STRING,
            nullable: true,
            description: "PRE-READER (kindergarten) only: a single emoji depicting the term — the card face a non-reader sees"
          }
        },
        required: ["term", "definition", "category"]
      }
    }
  },
  required: ["cards"]
};

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
 * Generate a flashcard deck using Gemini AI
 * @param topic The main topic for the flashcard deck
 * @param gradeContext The grade level context for appropriate difficulty
 * @param config Optional configuration for deck generation
 * @returns FlashcardDeckData with generated cards
 */
export async function generateFlashcardDeck(
  ctx: GenerationContext
): Promise<FlashcardDeckData> {
  const topic = ctx.topic;
  const gradeContext = ctx.gradeContext;
  const gradeKey = resolvePreReaderGradeKey(ctx);
  const isPreReader = gradeKey === 'K';
  const rawConfig = ctx.raw as FlashcardDeckConfig;
  // Pre-readers get a SHORT deck (a 15-card rote drill is far past the K attention
  // span + violates the band's "one thing at a time" load rule).
  const defaultCount = isPreReader ? 6 : 15;
  const config: FlashcardDeckConfig = {
    cardCount: rawConfig.cardCount || defaultCount,
    focusArea: ctx.intent || rawConfig.focusArea,
    includeExamples: rawConfig.includeExamples,
  };
  const cardCount = isPreReader
    ? Math.min(config?.cardCount || defaultCount, 6)
    : (config?.cardCount || defaultCount);
  const focusArea = config?.focusArea || '';

  const preReaderRules = isPreReader ? `

PRE-READER MODE (kindergarten — the child CANNOT read; the card FACE is a big emoji and a tutor reads each card aloud):
- term: 1-3 words, a CONCRETE thing a 5-year-old can picture (an animal, an object, a color, a shape).
- cardEmoji: REQUIRED — a SINGLE emoji that clearly depicts the term (the card face). One distinct emoji per card.
- definition: ONE short spoken sentence, MAX 12 words, concrete and observable.
- category: a single simple word.
- Avoid abstract terms, formulas, dates, and technical vocabulary entirely.` : '';

  const generationPrompt = `Generate a set of ${cardCount} high-quality flashcards for studying: "${topic}"${focusArea ? ` (focus on: ${focusArea})` : ''}.

Target audience: ${gradeContext}

Create flashcards that:
1. Cover key terms, concepts, and important facts
2. Keep definitions concise (under 25 words) for rapid memorization
3. Use clear, age-appropriate language for ${gradeContext}
4. Group cards by logical sub-categories
5. Progress from basic to more advanced concepts

Ensure each card has:
- term: The concept, word, or question (front of card)
- definition: The concise answer or explanation (back of card)
- category: A short sub-category label (e.g., "Vocabulary", "Key Concept", "Formula")
${preReaderRules}`;

  try {
    console.log('📞 Generator params:', { topic, gradeLevel: gradeContext, cardCount, focusArea });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: generationPrompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: flashcardDeckSchema,
        systemInstruction: `You are an expert educational content creator. Generate high-quality flashcards that promote effective memorization and learning for ${gradeContext} students.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text);
    const cards: FlashcardItem[] = (result.cards || []).map((card: any, index: number) => ({
      id: `${Date.now()}-${index}`,
      term: card.term || '',
      definition: card.definition || '',
      category: card.category || 'General',
      // Pre-reader card face: keep the emoji, ⭐ fallback so no card is faceless.
      ...(isPreReader
        ? { cardEmoji: (typeof card.cardEmoji === 'string' && card.cardEmoji.trim()) ? card.cardEmoji.trim() : '⭐' }
        : (card.cardEmoji ? { cardEmoji: card.cardEmoji } : {})),
    }));

    console.log('🃏 Flashcard Deck Generated:', {
      topic,
      gradeLevel: gradeKey,
      isPreReader,
      cardCount: cards.length,
      categories: Array.from(new Set(cards.map(c => c.category)))
    });

    return {
      title: `${topic} Flashcards`,
      description: `Master ${topic} with ${cards.length} interactive flashcards`,
      cards,
      ...(gradeKey ? { gradeLevel: gradeKey } : {}),
    };
  } catch (error) {
    console.error('Error generating flashcard deck:', error);
    throw error;
  }
}
