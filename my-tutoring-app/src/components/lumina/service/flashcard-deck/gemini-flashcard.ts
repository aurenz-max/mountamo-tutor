import { FlashcardDeckData, FlashcardItem } from '../../types';

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

  const prompt = `Generate a set of ${cardCount} high-quality flashcards for studying: "${topic}"${focusArea ? ` (focus on: ${focusArea})` : ''}.

Target audience: ${gradeContext}

Create flashcards that:
1. Cover key terms, concepts, and important facts
2. Keep definitions concise (under 25 words) for rapid memorization
3. Use clear, age-appropriate language for ${gradeContext}
4. Group cards by logical sub-categories
5. Progress from basic to more advanced concepts

Return the flashcards as a JSON array where each card has:
- term: The concept, word, or question (front of card)
- definition: The concise answer or explanation (back of card)
- category: A short sub-category label (e.g., "Vocabulary", "Key Concept", "Formula")

Example format:
[
  {
    "term": "Photosynthesis",
    "definition": "Process by which plants convert sunlight into chemical energy",
    "category": "Key Process"
  }
]`;

  try {
    const response = await fetch('/api/lumina', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generateStructuredContent',
        topic,
        gradeLevel: gradeContext,
        contentType: 'flashcard-deck',
        prompt,
        responseFormat: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate flashcard deck: ${response.statusText}`);
    }

    const data = await response.json();
    const cards: FlashcardItem[] = (data.content || []).map((card: any, index: number) => ({
      id: `${Date.now()}-${index}`,
      term: card.term || '',
      definition: card.definition || '',
      category: card.category || 'General'
    }));

    return {
      title: `${topic} Flashcards`,
      description: `Master ${topic} with ${cards.length} interactive flashcards`,
      cards
    };
  } catch (error) {
    console.error('Error generating flashcard deck:', error);

    // Return a minimal fallback deck
    return {
      title: `${topic} Flashcards`,
      description: 'Study deck for ' + topic,
      cards: [
        {
          id: '1',
          term: topic,
          definition: 'Review the key concepts and terminology',
          category: 'Overview'
        }
      ]
    };
  }
}
