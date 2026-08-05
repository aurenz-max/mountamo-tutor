/**
 * Reader-fit 14l — flashcard-deck final-assessment scope/count binding.
 *
 * Census failure (`qa/topic-traces/g1-invention-listening-2026-08-01.md`): on the Grade-1
 * `SS004-05-c` light-bulb narration lesson the final-assessment deck was asked for 10
 * simple review cards and instead announced 15 and expanded into Internet, medicine,
 * patent, prototype — untaught vocabulary. The request lived in INTENT PROSE, never in
 * `config.cardCount`.
 *
 * These tests drive the REAL resolver (`resolveDeckRequest`) by dispatching the mocked
 * Gemini client on model id, so the flash-lite → prompt-fork → schema-bound → slice chain
 * is exercised end to end. Contract: `docs/contracts/flashcard-deck.md` (R5/R6/R9 were the
 * violated requirements; R1/R2/R3/R7/R8 + conflicts C1/C2 are the guarded ones).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateFlashcardDeck } from './gemini-flashcard';
import { resolveDeckRequest } from './resolveDeckRequest';
import type { GenerationContext } from '../generation/generationContext';

const generateContent = vi.mocked(ai.models.generateContent);

const RESOLVER_MODEL = 'gemini-flash-lite-latest';

/** What the flash-lite resolver returns; 'THROW' simulates a resolver outage. */
let resolverPayload: unknown = null;
/** What the deck model returns. */
let deckPayload: unknown = null;
/** The captured deck-model request (prompt + schema). */
let deckCall: any = null;

function wire() {
  deckCall = null;
  generateContent.mockImplementation((async (args: any) => {
    if (args.model === RESOLVER_MODEL) {
      if (resolverPayload === 'THROW') throw new Error('resolver down');
      return { text: JSON.stringify(resolverPayload) };
    }
    deckCall = args;
    return { text: JSON.stringify(deckPayload) };
  }) as never);
}

const EMOJI = ['💡', '🕯️', '🏠', '🌙', '📖', '🔌', '⚡', '🏭'];

const makeCards = (n: number, termPrefix = 'Term') =>
  Array.from({ length: n }, (_, i) => ({
    term: `${termPrefix} ${i + 1}`,
    definition: `A short meaning for item ${i + 1}.`,
    category: 'Key Concept',
    cardEmoji: EMOJI[i % EMOJI.length],
  }));

function ctx(over: Partial<GenerationContext> = {}): GenerationContext {
  const topic = over.topic ?? 'How the light bulb changed life';
  return {
    componentId: 'flashcard-deck' as GenerationContext['componentId'],
    instanceId: 'eval-test-flashcard-deck',
    topic,
    gradeLevel: 'elementary',
    gradeContext: 'first grade students',
    objective: {},
    scope: { topic },
    raw: {},
    ...over,
  } as GenerationContext;
}

/** The exact census scope: Grade 1, 10 review cards, light-bulb narration. */
const CENSUS_INTENT =
  'Review the narrated invention lesson with 10 simple review cards about the light bulb.';
const CENSUS_CONCEPTS = ['the light bulb', 'electric light', 'working at night', 'candles and lamps'];

function censusCtx(over: Partial<GenerationContext> = {}): GenerationContext {
  return ctx({
    grade: '1',
    intent: CENSUS_INTENT,
    scope: {
      topic: 'How the light bulb changed life',
      objectiveText: 'Listen to a short narration about an invention and explain how it changed life for people',
      intent: CENSUS_INTENT,
    },
    ...over,
  });
}

const prompt = () => String(deckCall.contents);
const cardsSchema = () => deckCall.config.responseSchema.properties.cards;

beforeEach(() => {
  generateContent.mockReset();
  resolverPayload = null;
  deckPayload = null;
  deckCall = null;
});

describe('14l — the census replay: a requested review count binds (R6)', () => {
  it('emits exactly the 10 cards the intent asked for, not the 15-card default', async () => {
    resolverPayload = { requestedCount: 10, isReview: true, taughtConcepts: CENSUS_CONCEPTS };
    deckPayload = { cards: makeCards(10) };
    wire();

    const deck = await generateFlashcardDeck(censusCtx());

    expect(deck.cards).toHaveLength(10);
    expect(prompt()).toContain('Generate a set of 10 high-quality flashcards');
    expect(prompt()).not.toContain('Generate a set of 15');
  });

  it('bounds the schema array to the resolved count (R9 — house rule)', async () => {
    resolverPayload = { requestedCount: 10, isReview: true, taughtConcepts: CENSUS_CONCEPTS };
    deckPayload = { cards: makeCards(10) };
    wire();

    await generateFlashcardDeck(censusCtx());

    // This SDK types minItems/maxItems as STRINGS (knowledge-check precedent).
    expect(cardsSchema().minItems).toBe('10');
    expect(cardsSchema().maxItems).toBe('10');
  });

  it('slices an over-generating model back to the requested count (code owns structure)', async () => {
    resolverPayload = { requestedCount: 10, isReview: true, taughtConcepts: CENSUS_CONCEPTS };
    // The census failure shape: the model hands back 15 anyway.
    deckPayload = { cards: makeCards(15) };
    wire();

    const deck = await generateFlashcardDeck(censusCtx());

    expect(deck.cards).toHaveLength(10);
    expect(deck.description).toContain('10 interactive flashcards');
  });
});

describe('14l — review scope forbids untaught material (R5)', () => {
  beforeEach(() => {
    resolverPayload = { requestedCount: 10, isReview: true, taughtConcepts: CENSUS_CONCEPTS };
    deckPayload = { cards: makeCards(10) };
    wire();
  });

  it('enumerates the taught concepts as the ONLY permitted material', async () => {
    await generateFlashcardDeck(censusCtx());

    expect(prompt()).toContain('TAUGHT CONCEPTS — the ONLY material this deck may cover (4)');
    for (const concept of CENSUS_CONCEPTS) expect(prompt()).toContain(`- ${concept}`);
    expect(prompt()).toContain('NEVER introduce a term, name, example, or vocabulary word that is not in the list above');
  });

  it('retires the two expansion-inviting rules that produced patent/prototype', async () => {
    await generateFlashcardDeck(censusCtx());

    expect(prompt()).not.toContain('Cover key terms, concepts, and important facts');
    expect(prompt()).not.toContain('Progress from basic to more advanced concepts');
    expect(prompt()).toContain('Cover ONLY the taught concepts listed below');
    expect(prompt()).toContain('Stay at the level the lesson taught');
  });

  it('tells the model to revisit angles when cards outnumber taught concepts', async () => {
    await generateFlashcardDeck(censusCtx());

    // 10 cards from 4 concepts — the exact padding pressure that invented `patent`.
    expect(prompt()).toContain('You must produce 10 cards from 4 taught concepts');
    expect(prompt()).toContain('revisit concepts from different angles');
  });

  it('narrows to the most important concepts when cards are fewer than concepts', async () => {
    resolverPayload = { requestedCount: 2, isReview: true, taughtConcepts: CENSUS_CONCEPTS };
    deckPayload = { cards: makeCards(2) };
    wire();

    await generateFlashcardDeck(censusCtx());

    expect(prompt()).toContain('Choose the 2 most important of the taught concepts above');
  });
});

describe('14l — the constraint-presence fork keeps generic decks legacy (R2, C1)', () => {
  it('makes NO resolver call and keeps the 15-card open-study prompt when scope carries nothing', async () => {
    deckPayload = { cards: makeCards(15) };
    wire();

    const deck = await generateFlashcardDeck(ctx({ grade: '5', gradeContext: 'fifth grade students' }));

    // No intent + no objective => nothing to resolve => no call, no cost.
    expect(generateContent.mock.calls.every((c: any) => c[0].model !== RESOLVER_MODEL)).toBe(true);
    expect(deck.cards).toHaveLength(15);
    expect(prompt()).toContain('Generate a set of 15 high-quality flashcards');
    expect(prompt()).toContain('Cover key terms, concepts, and important facts');
    expect(prompt()).toContain('Progress from basic to more advanced concepts');
    expect(prompt()).not.toContain('TAUGHT CONCEPTS');
  });

  it('keeps the legacy path when scope has text but no request is present', async () => {
    // An open topic-study intent: the resolver reports absence honestly.
    resolverPayload = { requestedCount: null, isReview: false, taughtConcepts: [] };
    deckPayload = { cards: makeCards(15) };
    wire();

    const deck = await generateFlashcardDeck(ctx({
      grade: '5',
      gradeContext: 'fifth grade students',
      intent: 'Study the key vocabulary of photosynthesis',
      scope: { topic: 'Photosynthesis', intent: 'Study the key vocabulary of photosynthesis' },
    }));

    expect(deck.cards).toHaveLength(15);
    expect(prompt()).toContain('Progress from basic to more advanced concepts');
    expect(prompt()).not.toContain('TAUGHT CONCEPTS');
  });

  it('does not bind review rules when a review names no enumerable concepts', async () => {
    // isReview true but nothing enumerated — "review ONLY: (nothing)" would be worse.
    resolverPayload = { requestedCount: 8, isReview: true, taughtConcepts: [] };
    deckPayload = { cards: makeCards(8) };
    wire();

    const deck = await generateFlashcardDeck(censusCtx());

    expect(deck.cards).toHaveLength(8);          // the count still binds
    expect(prompt()).not.toContain('TAUGHT CONCEPTS'); // the scope block does not
    expect(prompt()).toContain('Cover key terms, concepts, and important facts');
  });

  it('degrades to the legacy default when the resolver is down (no regression)', async () => {
    resolverPayload = 'THROW';
    deckPayload = { cards: makeCards(15) };
    wire();

    const deck = await generateFlashcardDeck(censusCtx());

    expect(deck.cards).toHaveLength(15);
    expect(prompt()).toContain('Cover key terms, concepts, and important facts');
  });
});

describe('14l — band rules (R1, R8, C2)', () => {
  it('K keeps the 6-card load cap even against a requested 10 (C2)', async () => {
    resolverPayload = { requestedCount: 10, isReview: true, taughtConcepts: CENSUS_CONCEPTS };
    deckPayload = { cards: makeCards(6) };
    wire();

    const deck = await generateFlashcardDeck(censusCtx({
      grade: 'K',
      gradeContext: 'kindergarten students',
    }));

    expect(deck.cards).toHaveLength(6);
    expect(deck.gradeLevel).toBe('K');
    expect(prompt()).toContain('Generate a set of 6 high-quality flashcards');
    expect(cardsSchema().maxItems).toBe('6');
    // The PRE fork (#9d) is untouched.
    expect(prompt()).toContain('PRE-READER MODE (kindergarten');
    expect(prompt()).toContain('cardEmoji: REQUIRED');
    // …and the scope still binds at K even though the count cannot.
    expect(prompt()).toContain('TAUGHT CONCEPTS');
  });

  it('K keeps distinct emoji faces and the ⭐ fallback (R1)', async () => {
    resolverPayload = { requestedCount: null, isReview: false, taughtConcepts: [] };
    deckPayload = {
      cards: [
        { term: 'Cow', definition: 'A cow says moo.', category: 'Animals', cardEmoji: '🐄' },
        { term: 'Pig', definition: 'A pig says oink.', category: 'Animals' }, // no emoji
      ],
    };
    wire();

    const deck = await generateFlashcardDeck(censusCtx({
      grade: 'K',
      gradeContext: 'kindergarten students',
    }));

    expect(deck.cards[0].cardEmoji).toBe('🐄');
    expect(deck.cards[1].cardEmoji).toBe('⭐');
  });

  it('honors a request ABOVE the old default at a reader grade — no new cap (R8)', async () => {
    resolverPayload = { requestedCount: 18, isReview: true, taughtConcepts: ['erosion', 'weathering'] };
    deckPayload = { cards: makeCards(18) };
    wire();

    const deck = await generateFlashcardDeck(ctx({
      grade: '3',
      gradeContext: 'third grade students',
      intent: 'Review the 18 terms taught in the erosion lesson',
      scope: { topic: 'Erosion', intent: 'Review the 18 terms taught in the erosion lesson' },
    }));

    expect(deck.cards).toHaveLength(18);
    expect(cardsSchema().maxItems).toBe('18');
  });
});

describe('14l — canonical grade threading (R7)', () => {
  it('adds the exact-grade line from ctx.grade', async () => {
    resolverPayload = { requestedCount: null, isReview: false, taughtConcepts: [] };
    deckPayload = { cards: makeCards(15) };
    wire();

    await generateFlashcardDeck(censusCtx({ grade: '1' }));

    expect(prompt()).toContain('EXACT TARGET GRADE: 1');
  });

  it('omits the grade line entirely when no canonical grade is present (prose fallback stands)', async () => {
    resolverPayload = { requestedCount: null, isReview: false, taughtConcepts: [] };
    deckPayload = { cards: makeCards(15) };
    wire();

    await generateFlashcardDeck(censusCtx({ grade: undefined }));

    expect(prompt()).not.toContain('EXACT TARGET GRADE');
    expect(prompt()).toContain('Target audience: first grade students');
  });
});

describe('14l — resolver validation (never invents, never clamps)', () => {
  const scope = { topic: 'Inventions', intent: CENSUS_INTENT };

  it('returns null without calling Gemini when scope carries no intent or objective', async () => {
    wire();
    const out = await resolveDeckRequest({ topic: 'Inventions' }, 'first grade students');
    expect(out).toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('treats an out-of-window count as UNRESOLVED rather than clamping it (R8)', async () => {
    resolverPayload = { requestedCount: 900, isReview: true, taughtConcepts: ['a'] };
    wire();
    const out = await resolveDeckRequest(scope, 'first grade students');
    // null => the caller's default stands. A clamp would be a hidden cap.
    expect(out?.requestedCount).toBeNull();
    expect(out?.isReview).toBe(true);
  });

  it('trims, de-duplicates case-insensitively, and bounds the concept list', async () => {
    resolverPayload = {
      requestedCount: 5,
      isReview: true,
      taughtConcepts: ['  light bulb ', 'Light Bulb', '', 'candles', ...Array.from({ length: 20 }, (_, i) => `c${i}`)],
    };
    wire();
    const out = await resolveDeckRequest(scope, 'first grade students');

    expect(out?.taughtConcepts.slice(0, 2)).toEqual(['light bulb', 'candles']);
    expect(out?.taughtConcepts).toHaveLength(12);
  });

  it('returns null on unparseable resolver output', async () => {
    generateContent.mockImplementation((async () => ({ text: 'not json' })) as never);
    const out = await resolveDeckRequest(scope, 'first grade students');
    expect(out).toBeNull();
  });
});
