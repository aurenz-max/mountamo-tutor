import { Type, Schema, ThinkingLevel } from "@google/genai";
import { FlashcardDeckData, FlashcardItem } from '../../types';
import { ai } from "../geminiClient";
import { buildGradeLine } from "../scopeContext";
import type { GenerationContext } from "../generation/generationContext";
import { resolveDeckRequest, type DeckRequest } from "./resolveDeckRequest";

type FlashcardDeckConfig = {
  cardCount?: number;
  focusArea?: string;
  includeExamples?: boolean;
};

/**
 * Schema definition for Flashcard Deck.
 *
 * Built per-call so the `cards` array is BOUNDED to the resolved deck size (house rule:
 * bound ALL schema arrays — [[flash-lite-truncation-template]]; contract R9). The bound is
 * the enforcement surface for a requested card count: prose alone let a 10-card review
 * come back as 15.
 *
 * NOTE: this SDK types `minItems`/`maxItems` as STRINGS (knowledge-check precedent).
 */
const buildFlashcardDeckSchema = (cardCount: number): Schema => ({
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      description: `Array of exactly ${cardCount} flashcard items`,
      minItems: String(cardCount),
      maxItems: String(cardCount),
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
});

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
 * Build the numbered generation rules. Under a REVIEW scope (the lesson asked to review
 * material it already taught, and we could enumerate that material) rules 1 and 5 invert:
 * "cover key terms" and "progress to more advanced concepts" are exactly what turned a
 * 10-card light-bulb review into a 15-card introduction to `patent` and `prototype`
 * (contract R5). Absent a review scope this is byte-identical to the legacy prompt —
 * the constraint-presence fork (contract C1).
 */
function buildDeckRules(gradeContext: string, reviewScope: boolean): string {
  return `Create flashcards that:
1. ${reviewScope
    ? 'Cover ONLY the taught concepts listed below — nothing else'
    : 'Cover key terms, concepts, and important facts'}
2. Keep definitions concise (under 25 words) for rapid memorization
3. Use clear, age-appropriate language for ${gradeContext}
4. Group cards by logical sub-categories
5. ${reviewScope
    ? 'Stay at the level the lesson taught — do NOT progress to more advanced concepts'
    : 'Progress from basic to more advanced concepts'}`;
}

/**
 * The taught-concepts block. Only rendered under a review scope. `cardCount` is compared
 * to the concept count in CODE so the model gets a concrete instruction rather than a
 * judgement call ([[llm-window-code-builds-structure]]): more cards than concepts means
 * revisit from another angle, never pad with new vocabulary.
 */
function buildReviewScopeBlock(taughtConcepts: string[], cardCount: number): string {
  const n = taughtConcepts.length;
  return `

TAUGHT CONCEPTS — the ONLY material this deck may cover (${n}):
${taughtConcepts.map(c => `- ${c}`).join('\n')}

REVIEW RULES — this deck REVIEWS a lesson the student already had. It is NOT an introduction:
- Every card's term MUST be one of the taught concepts above, or a plain-language restatement of one.
- NEVER introduce a term, name, example, or vocabulary word that is not in the list above — no matter how closely related to the topic it seems.
- ${cardCount > n
    ? `You must produce ${cardCount} cards from ${n} taught concepts: revisit concepts from different angles (what it is, what it does, why it mattered, what it changed) instead of adding new material.`
    : `Choose the ${cardCount} most important of the taught concepts above.`}`;
}

/**
 * Generate a flashcard deck using Gemini AI
 * @param ctx The generation context (topic, grade, scope/intent, raw config)
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

  // The lesson's request lives in INTENT PROSE — `config.cardCount` is never stamped by
  // any manifest producer (contract R6). One temperature-0 structured call reads it;
  // absence is reported honestly so the legacy open-study path stays untouched.
  const resolved: DeckRequest | null = await resolveDeckRequest(ctx.scope, gradeContext);
  const configCount = rawConfig.cardCount && rawConfig.cardCount > 0 ? rawConfig.cardCount : null;
  const requestedCount = configCount ?? resolved?.requestedCount ?? null;
  const taughtConcepts = resolved?.taughtConcepts ?? [];
  // A review scope only binds when we could actually enumerate what was taught —
  // "review ONLY the following: (nothing)" would be worse than the legacy prompt.
  const reviewScope = Boolean(resolved?.isReview) && taughtConcepts.length > 0;

  const config: FlashcardDeckConfig = {
    cardCount: requestedCount ?? defaultCount,
    focusArea: ctx.intent || rawConfig.focusArea,
    includeExamples: rawConfig.includeExamples,
  };
  // At K the 6-card cap WINS over a requested count: it is a developmental load rule,
  // not a convenience ceiling (contract C2). At every other grade the lesson's request
  // is law — no hardcoded ceiling may sit below it ([[trust-intent-over-hardcoded-caps]]).
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

  // Canonical grade first, prose fallback kept (the 14m pattern — contract R7). Without
  // this, grade 1 and grade 5 received identical vocabulary guidance from band prose.
  const gradeLine = buildGradeLine(ctx.grade);
  const reviewBlock = reviewScope ? buildReviewScopeBlock(taughtConcepts, cardCount) : '';

  const generationPrompt = `Generate a set of ${cardCount} high-quality flashcards for studying: "${topic}"${focusArea ? ` (focus on: ${focusArea})` : ''}.

Target audience: ${gradeContext}
${gradeLine ? `${gradeLine}\n` : ''}
${buildDeckRules(gradeContext, reviewScope)}

Ensure each card has:
- term: The concept, word, or question (front of card)
- definition: The concise answer or explanation (back of card)
- category: A short sub-category label (e.g., "Vocabulary", "Key Concept", "Formula")
${reviewBlock}${preReaderRules}`;

  try {
    console.log('📞 Generator params:', {
      topic, gradeLevel: gradeContext, cardCount, focusArea,
      requestedCount, reviewScope, taughtConcepts: taughtConcepts.length,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: generationPrompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: buildFlashcardDeckSchema(cardCount),
        systemInstruction: `You are an expert educational content creator. Generate high-quality flashcards that promote effective memorization and learning for ${gradeContext} students.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text);
    // Code owns the final structure: the deck is exactly what was asked for, never more.
    const rawCards: unknown[] = Array.isArray(result.cards) ? result.cards.slice(0, cardCount) : [];
    const cards: FlashcardItem[] = rawCards.map((raw: any, index: number) => ({
      id: `${Date.now()}-${index}`,
      term: raw.term || '',
      definition: raw.definition || '',
      category: raw.category || 'General',
      // Pre-reader card face: keep the emoji, ⭐ fallback so no card is faceless.
      ...(isPreReader
        ? { cardEmoji: (typeof raw.cardEmoji === 'string' && raw.cardEmoji.trim()) ? raw.cardEmoji.trim() : '⭐' }
        : (raw.cardEmoji ? { cardEmoji: raw.cardEmoji } : {})),
    }));

    if (cards.length < cardCount) {
      console.warn(`⚠️ Flashcard deck short: asked for ${cardCount}, model returned ${cards.length}`);
    }

    console.log('🃏 Flashcard Deck Generated:', {
      topic,
      gradeLevel: gradeKey,
      isPreReader,
      reviewScope,
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
