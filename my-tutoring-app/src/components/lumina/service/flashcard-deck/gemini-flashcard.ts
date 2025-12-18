import { Type, Schema, ThinkingLevel } from "@google/genai";
import { FlashcardDeckData, FlashcardItem } from '../../types';
import { ai } from "../geminiClient";

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
          }
        },
        required: ["term", "definition", "category"]
      }
    }
  },
  required: ["cards"]
};

/**
 * Generate a flashcard deck using Gemini AI
 * @param topic The main topic for the flashcard deck
 * @param gradeContext The grade level context for appropriate difficulty
 * @param config Optional configuration for deck generation
 * @returns FlashcardDeckData with generated cards
 */
export async function generateFlashcardDeck(
  topic: string,
  gradeContext: string,
  config?: {
    cardCount?: number;
    focusArea?: string;
    includeExamples?: boolean;
  }
): Promise<FlashcardDeckData> {
  const cardCount = config?.cardCount || 15;
  const focusArea = config?.focusArea || '';

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
- category: A short sub-category label (e.g., "Vocabulary", "Key Concept", "Formula")`;

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
      category: card.category || 'General'
    }));

    console.log('🃏 Flashcard Deck Generated:', {
      topic,
      cardCount: cards.length,
      categories: Array.from(new Set(cards.map(c => c.category)))
    });

    return {
      title: `${topic} Flashcards`,
      description: `Master ${topic} with ${cards.length} interactive flashcards`,
      cards
    };
  } catch (error) {
    console.error('Error generating flashcard deck:', error);
    throw error;
  }
}
