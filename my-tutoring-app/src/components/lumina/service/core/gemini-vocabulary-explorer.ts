/**
 * Vocabulary Explorer generator. Gemini writes the word bank only: 6-8 words, each with what it means, an example
 * sentence for its card, a second sentence that uses it (for fill_blank), a short situation that never names it (for
 * context), related words and an optional origin. Code builds every item and key from that bank
 * (`vocabularyExplorerWorkspace.ts`, `buildVocabItems`), from the eval-mode pin and `config.difficulty`
 * (structural tiers: pairs and an extra meaning for match, the number and closeness of the other choices for
 * fill_blank and context). Before 2026-10-16 the model wrote each challenge and its options, and the screen ignored the
 * mode's description.
 *
 * Uses a FLAT Gemini schema (one term type) to avoid malformed nested JSON.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection, gradeToBand, buildGradeLine } from "../scopeContext";
import type { VocabularyExplorerData } from '../../primitives/visual-primitives/core/VocabularyExplorer';
import {
  buildVocabItems, clozeOf, clueText, resolveTier, situationOf, VOCAB_KINDS, type ChoiceItem, type VocabItem, type VocabKind,
  type VocabTerm,
} from '../../primitives/visual-primitives/core/vocabularyExplorerWorkspace';
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from '../evalMode';

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  match: { promptDoc: '"match": match words to their meanings', schemaDescription: "'match' (match words to meanings)" },
  fill_blank: { promptDoc: '"fill_blank": choose the word that completes a sentence', schemaDescription: "'fill_blank' (complete a sentence)" },
  context: { promptDoc: '"context": choose the word that fits a situation', schemaDescription: "'context' (the word that fits a situation)" },
};

/** Fallback band resolver from the prose gradeContext, used only when ctx.grade is absent. */
const inferGradeLevelFromContext = (gradeContext: string): string => {
  const gc = (gradeContext || '').toLowerCase();
  if (gc.includes('toddler')) return 'Toddler';
  if (gc.includes('preschool')) return 'Preschool';
  if (gc.includes('kindergarten')) return 'Kindergarten';
  if (gc.includes('elementary') || gc.includes('grades 1-5')) return 'Elementary';
  if (gc.includes('middle') || gc.includes('grades 6-8')) return 'Middle School';
  if (gc.includes('high') || gc.includes('grades 9-12')) return 'High School';
  return 'Elementary';
};

const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'Toddler': 'toddlers (ages 1-3) — very simple concepts, concrete examples.',
    'Preschool': 'preschool children (ages 3-5) — simple sentences, colorful examples.',
    'Kindergarten': 'kindergarten students (ages 5-6) — clear language, foundational concepts.',
    'Elementary': 'elementary students (grades 1-5) — age-appropriate vocabulary, concrete examples.',
    'Middle School': 'middle school students (grades 6-8) — more complex vocabulary, real-world applications.',
    'High School': 'high school students (grades 9-12) — advanced vocabulary, sophisticated concepts.',
  };
  return contexts[gradeLevel] || contexts['Elementary'];
};

const termSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING, description: "The vocabulary word or short term" },
    pronunciation: { type: Type.STRING, description: "Phonetic pronunciation (e.g. 'foh-toh-SIN-thuh-sis')" },
    partOfSpeech: { type: Type.STRING, description: "noun, verb, adjective or adverb" },
    definition: { type: Type.STRING, description: "What the word means, in one or two grade-appropriate sentences; never uses the word itself or another word of the list" },
    exampleSentence: { type: Type.STRING, description: "A sentence using the word exactly as written, in the topic's context" },
    clozeSentence: { type: Type.STRING, description: "A DIFFERENT sentence using the word exactly as written, exactly once, with a clue that fits only this word of the list" },
    scenario: { type: Type.STRING, description: "One or two sentences describing a situation where this word applies, never using the word or any form of it; it fits only this word of the list" },
    relatedWord0: { type: Type.STRING, description: "A related word (prefer another word of this list when one is related)" },
    relatedWord1: { type: Type.STRING, description: "A second related word" },
    relatedWord2: { type: Type.STRING, description: "A third related word" },
    wordOrigin: { type: Type.STRING, description: "Optional: where the word comes from" },
  },
  required: ["word", "partOfSpeech", "definition", "exampleSentence", "clozeSentence", "scenario", "relatedWord0", "relatedWord1", "relatedWord2"],
};

const vocabularyExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A short title for the word set" },
    topic: { type: Type.STRING, description: "The topic these words relate to" },
    introduction: { type: Type.STRING, description: "One or two sentences introducing the word set; names no meaning" },
    terms: {
      type: Type.ARRAY,
      items: termSchema,
      // Bounded (VE-5 / SP-6): unbounded arrays let flash-lite loop into a truncated runaway.
      minItems: "6",
      maxItems: "8",
      description: "EXACTLY 6-8 vocabulary words",
    },
  },
  required: ["title", "topic", "introduction", "terms"],
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The bank as the model wrote it, made safe: words unique, fields trimmed, ids assigned by code. */
export function bankFromRaw(raw: any): VocabTerm[] {
  const seen = new Set<string>();
  const out: VocabTerm[] = [];
  for (const t of Array.isArray(raw?.terms) ? raw.terms.slice(0, 8) : []) {
    const word = String(t?.word ?? '').trim();
    const definition = String(t?.definition ?? '').trim();
    if (!word || !definition || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    const related = [t.relatedWord0, t.relatedWord1, t.relatedWord2, ...(Array.isArray(t.relatedWords) ? t.relatedWords : [])]
      .map((r: any) => String(r ?? '').trim()).filter((r: string) => r && r.toLowerCase() !== word.toLowerCase()).slice(0, 3);
    out.push({
      id: `term${out.length + 1}`,
      word,
      pronunciation: t.pronunciation ? String(t.pronunciation).trim() : undefined,
      partOfSpeech: String(t.partOfSpeech ?? 'noun').trim() || 'noun',
      definition,
      exampleSentence: String(t.exampleSentence ?? '').trim(),
      relatedWords: related,
      wordOrigin: t.wordOrigin ? String(t.wordOrigin).trim() : undefined,
      clozeSentence: t.clozeSentence ? String(t.clozeSentence).trim() : undefined,
      scenario: t.scenario ? String(t.scenario).trim() : undefined,
    });
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const fitSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.INTEGER, description: "The item number" },
          fits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Every choice that fits the clue" },
        },
        required: ["item", "fits"],
      },
    },
  },
  required: ["items"],
};

/**
 * The other choices a careful reader could defend for a sentence or a situation ("steam rises from a pot" fits vapor
 * and evaporation). Code cannot read meaning, so one judge call lists every choice that fits each clue; a listed
 * other choice is never offered beside that answer again. Null when the call fails (the items stand).
 */
async function foilsThatFit(items: VocabItem[], bank: VocabTerm[]): Promise<Set<string> | null> {
  const choice = items.filter((i): i is ChoiceItem => i.kind !== 'match');
  if (!choice.length) return new Set();
  const word = (id: string) => bank.find(t => t.id === id)?.word ?? id;
  const prompt = `For each item, list EVERY choice that fits the clue, meaning a careful reader could defend it, not only the best one.
${choice.map((c, n) => `Item ${n + 1} (${c.kind === 'fill_blank' ? 'the word that completes the sentence' : 'the word for this situation'}): "${clueText(c, bank)}"
Choices: ${c.options.map(word).join(', ')}`).join(String.fromCharCode(10))}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: fitSchema },
    });
    const raw = JSON.parse(response.text || '{}') as { items?: Array<{ item?: number; fits?: string[] }> };
    const bad = new Set<string>();
    for (const r of raw.items ?? []) {
      const c = choice[(r.item ?? 0) - 1];
      if (!c) continue;
      const fits = (r.fits ?? []).map(f => String(f).trim().toLowerCase());
      for (const o of c.options) if (o !== c.term && fits.includes(word(o).toLowerCase())) bad.add(`${c.kind}:${c.term}:${o}`);
    }
    return bad;
  } catch (err) {
    console.warn(`[VocabularyExplorer] the fit check failed; items stand: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export const generateVocabularyExplorer = async (ctx: GenerationContext): Promise<VocabularyExplorerData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { targetEvalMode?: string; difficulty?: string };
  const bandKey = (ctx.grade && gradeToBand(ctx.grade)) || inferGradeLevelFromContext(ctx.gradeContext);
  const gradeLine = buildGradeLine(ctx.grade, 'reading level, sentence length, definition length, and vocabulary');
  const targetEvalMode = ctx.targetEvalMode ?? config.targetEvalMode;
  const constraint = resolveEvalModeConstraint('vocabulary-explorer', targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('VocabularyExplorer', targetEvalMode, constraint);
  const kinds: VocabKind[] = constraint ? VOCAB_KINDS.filter(k => constraint.allowedTypes.includes(k)) : [...VOCAB_KINDS];
  const tier = resolveTier({ difficulty: config.difficulty });

  const prompt = `You are a vocabulary teacher writing the word cards for a Vocabulary Explorer.

TOPIC: ${topic}
${buildScopePromptSection(ctx.scope)}
TARGET AUDIENCE: ${getGradeLevelContext(bandKey)}
${gradeLine ? gradeLine + '\n' : ''}${ctx.intent ? `LEARNING FOCUS: "${ctx.intent}"\n` : ''}
Write 6-8 words central to "${topic}". The app builds every question from your cards (matching words to meanings,
completing a sentence, choosing the word for a situation), so each card must work on its own:
- word: the word exactly as the learner will see it.
- partOfSpeech: noun, verb, adjective or adverb. Mix at least two kinds across the list when the topic allows.
- definition: what it means, in one or two sentences for this grade. Never use the word itself, any form of it, or
  another word of the list.
- exampleSentence: a natural sentence that uses the word exactly as written.
- clozeSentence: a DIFFERENT sentence that uses the word exactly as written, exactly once, with a clue that makes it
  the only word of the list that fits. Write the word itself, not a blank: the app blanks it. Do not change the word's
  form (no plural or past tense of it).
- scenario: one or two sentences describing something happening where this word applies, as a child might see it.
  Never use the word or any form of it. It must fit no other word of the list, above all a related word (a situation
  for "vapor" must not also describe "evaporation").
- relatedWord0-2: three related words; when another word of the list is related, use it.
- pronunciation and wordOrigin: optional.

The title and introduction never state a meaning.`;

  // VE-5 / SP-6: bounded retry + degrade. A thrown parse fails the whole exhibit under Promise.all.
  let raw: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: vocabularyExplorerSchema, maxOutputTokens: 8192 },
      });
      if (!response.text) continue;
      raw = JSON.parse(response.text);
      if (bankFromRaw(raw).length >= 5) break;
    } catch (err) {
      console.warn(`[VocabularyExplorer] attempt ${attempt}/2 failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  const bank = bankFromRaw(raw);
  // Build, ask which other choices also fit each clue, and rebuild without them (twice at most).
  const avoided = new Set<string>();
  let items = buildVocabItems({ bank, kinds, tier, rng: Math.random });
  for (let round = 0; round < 2; round++) {
    const bad = await foilsThatFit(items, bank);
    if (!bad?.size) break;
    bad.forEach(b => avoided.add(b));
    items = buildVocabItems({ bank, kinds, tier, rng: Math.random, avoid: (kind, key, foil) => avoided.has(`${kind}:${key}:${foil}`) });
  }
  const r = (raw ?? {}) as { title?: string; topic?: string; introduction?: string };
  const data: VocabularyExplorerData = {
    title: r.title?.trim() || `${topic} Words`,
    topic: r.topic?.trim() || topic,
    introduction: r.introduction?.trim() || '',
    terms: bank,
    challengeTypes: kinds,
    difficulty: tier,
    items,
  };

  console.log('[VocabularyExplorer] Generated:', {
    topic, gradeLevel: bandKey, tier, kinds, terms: bank.length,
    clozeUsable: bank.filter(t => clozeOf(t)?.clue === 'sentence').length,
    scenarioUsable: bank.filter(t => situationOf(t)?.clue === 'scenario').length,
    items: items.map(i => i.id),
    avoidedFoils: avoided.size,
  });
  return data;
};
