/**
 * Fact File Generator - Magazine-style profile card with key stats,
 * quick facts, deep dive sections, records, and "did you know" callouts.
 *
 * Uses a FLAT Gemini schema to avoid malformed nested JSON.
 * Supports eval modes with recall_easy, recall_medium, recall_hard challenge types.
 *
 * Gemini writes the file and a POOL of self-check questions (6-8); code picks which ship (`pickSelfChecks`) and stamps
 * what the eval-mode pin and `config.difficulty` decide (workspace rollout C33, 2026-10-16):
 * - mode: `fileOpen` (explore keeps the file open beside the question; recall and apply close it), the question count
 *   (explore 3, recall 4, apply 4) and the challenge types allowed;
 * - tier: easy shows the section note from the start (`sectionHint`); hard prefers questions whose wrong choices are
 *   facts stated elsewhere in the file. Every tier keeps four choices, so `drop_far_choice` still has one to drop
 *   after a wrong tap.
 * Code drops a question whose key is printed in its own stem, repeats a choice, or uses "all/none of the above", and
 * ranks down a key that is plainly the longest choice or that the file does not state.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection, gradeToBand, buildGradeLine } from "../scopeContext";
import type { FactFileCheck, FactFileData, FactFileSection } from '../../primitives/visual-primitives/core/FactFile';
import { fileText, normText, statedInFile } from '../../primitives/visual-primitives/core/factFileWorkspace';
import { shuffleIndexedChoices } from '../../utils/choiceOrder';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  recall_easy: {
    promptDoc:
      `"recall_easy": Basic recall questions about explicitly stated facts. `
      + `Questions should reference information directly visible in quickFacts or keyStats. `
      + `Use simple, direct wording. Only one plausible distractor needed among 4 options.`,
    schemaDescription: "'recall_easy' (basic fact recall)",
  },
  recall_medium: {
    promptDoc:
      `"recall_medium": Moderate recall questions that may require connecting two facts, `
      + `or recalling details from deepDive or records sections. `
      + `Distractors should be plausible but clearly distinguishable. `
      + `May ask "which section" or "according to the records" style questions.`,
    schemaDescription: "'recall_medium' (moderate fact recall)",
  },
  recall_hard: {
    promptDoc:
      `"recall_hard": Inference, comparison or application, NOT lookup. The answer is not printed anywhere in the file: `
      + `the learner must combine two facts (which is bigger, which came first), explain why something happens from a `
      + `fact the file gives, or apply a fact to a new situation ("A town is downwind of the eruption. What will it most `
      + `likely see?"). A question answered by finding one number or one sentence is recall_medium, not recall_hard. `
      + `All 4 options should be plausible.`,
    schemaDescription: "'recall_hard' (advanced inference recall)",
  },
};

type ChallengeType = 'recall_easy' | 'recall_medium' | 'recall_hard';
const CHALLENGE_TYPES: readonly string[] = ['recall_easy', 'recall_medium', 'recall_hard'];
const TYPE_DIFFICULTY: Record<ChallengeType, 'easy' | 'medium' | 'hard'> = { recall_easy: 'easy', recall_medium: 'medium', recall_hard: 'hard' };

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/** How many questions each mode asks (the catalog's eval-mode descriptions). */
const MODE_COUNT: Record<string, number> = { explore: 3, recall: 4, apply: 4 };

// ---------------------------------------------------------------------------
// Grade-Level Context Helper
// ---------------------------------------------------------------------------

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

/**
 * Fallback: infer a band KEY from the PROSE gradeContext sentence.
 * ctx.gradeContext is a sentence, not a band key — a direct lookup would
 * always miss and collapse every objective to 'Elementary'.
 */
const inferGradeLevelFromContext = (gradeContext: string): string => {
  const g = (gradeContext || '').toLowerCase();
  if (g.includes('toddler')) return 'Toddler';
  if (g.includes('preschool')) return 'Preschool';
  if (g.includes('kindergarten')) return 'Kindergarten';
  if (g.includes('elementary') || g.includes('grades 1-5')) return 'Elementary';
  if (g.includes('middle') || g.includes('grades 6-8')) return 'Middle School';
  if (g.includes('high') || g.includes('grades 9-12')) return 'High School';
  return 'Elementary';
};

// ---------------------------------------------------------------------------
// Flat Gemini Schema
// ---------------------------------------------------------------------------

const selfCheckSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description: "The self-check question text",
    },
    option0: {
      type: Type.STRING,
      description: "First answer option",
    },
    option1: {
      type: Type.STRING,
      description: "Second answer option",
    },
    option2: {
      type: Type.STRING,
      description: "Third answer option",
    },
    option3: {
      type: Type.STRING,
      description: "Fourth answer option",
    },
    option0Emoji: { type: Type.STRING, nullable: true, description: "PRE-READER (kindergarten) only: single emoji depicting option0 (the answer surface a non-reader taps)" },
    option1Emoji: { type: Type.STRING, nullable: true, description: "PRE-READER (kindergarten) only: single emoji depicting option1" },
    option2Emoji: { type: Type.STRING, nullable: true, description: "PRE-READER (kindergarten) only: single emoji depicting option2" },
    option3Emoji: { type: Type.STRING, nullable: true, description: "PRE-READER (kindergarten) only: single emoji depicting option3" },
    correctIndex: {
      type: Type.NUMBER,
      description: "Index of correct option (0-3)",
    },
    challengeType: {
      type: Type.STRING,
      enum: ["recall_easy", "recall_medium", "recall_hard"],
      description: "Which kind of question this is",
    },
    explanation: {
      type: Type.STRING,
      description: "Brief explanation shown after answering (1-2 sentences)",
    },
    relatedSection: {
      type: Type.STRING,
      enum: ["keyStats", "quickFacts", "deepDive", "records", "didYouKnow"],
      description: "Which section of the file states the fact the question asks about",
    },
  },
  required: [
    "question", "option0", "option1", "option2", "option3",
    "correctIndex", "explanation", "challengeType", "relatedSection",
  ],
};

const keyStatSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.STRING, description: "The stat value (e.g. '4,500', '93%')" },
    unit: { type: Type.STRING, description: "Unit or qualifier (e.g. 'miles', 'species', 'years old')" },
    label: { type: Type.STRING, description: "Short label for the stat (e.g. 'Length', 'Population')" },
  },
  required: ["value", "unit", "label"],
};

const quickFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    fact: { type: Type.STRING, description: "A single interesting fact (1-2 sentences)" },
    icon: { type: Type.STRING, description: "A single emoji icon for this fact" },
  },
  required: ["fact", "icon"],
};

const deepDiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    heading: { type: Type.STRING, description: "Section heading" },
    body: { type: Type.STRING, description: "Main body text (2-4 sentences)" },
    detail: { type: Type.STRING, description: "Optional extra detail or fun aside (1 sentence)" },
  },
  required: ["heading", "body"],
};

const recordSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: "Record category (e.g. 'Fastest', 'Largest')" },
    value: { type: Type.STRING, description: "The record value or description" },
  },
  required: ["label", "value"],
};

const didYouKnowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "Surprising or fascinating fact (1-2 sentences)" },
    source: { type: Type.STRING, description: "Optional source attribution" },
  },
  required: ["text"],
};

const factFileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the fact file (2-5 words, the subject name)",
    },
    category: {
      type: Type.STRING,
      description: "Category label (e.g. 'Animal', 'Planet', 'Historical Figure', 'Landmark')",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence introduction to the subject",
    },
    keyStats: {
      type: Type.ARRAY,
      items: keyStatSchema,
      description: "3-5 headline stats shown prominently at the top",
    },
    quickFacts: {
      type: Type.ARRAY,
      items: quickFactSchema,
      description: "4-6 bullet-point essential facts",
    },
    deepDive: {
      type: Type.ARRAY,
      items: deepDiveSchema,
      description: "2-4 expandable detail sections",
    },
    records: {
      type: Type.ARRAY,
      items: recordSchema,
      description: "2-3 records or superlatives",
    },
    didYouKnow: {
      type: Type.ARRAY,
      items: didYouKnowSchema,
      description: "2-3 surprising 'did you know?' callouts",
    },
    selfChecks: {
      type: Type.ARRAY,
      items: selfCheckSchema,
      description: "6-8 self-check multiple-choice questions about the content (code picks which ones are asked)",
    },
  },
  required: [
    "title", "category", "description", "keyStats", "quickFacts",
    "deepDive", "records", "didYouKnow", "selfChecks",
  ],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function validateFactFileData(
  raw: any,
  opts?: { isPreReader?: boolean; gradeLevel?: string },
): FactFileData {
  const isPreReader = opts?.isPreReader ?? false;
  // --- Basic fields ---
  const title = raw.title || 'Fact File';
  const category = raw.category || 'General';
  const description = raw.description || '';

  // --- keyStats (3-5) ---
  let keyStats: FactFileData['keyStats'] = [];
  if (Array.isArray(raw.keyStats)) {
    keyStats = raw.keyStats.slice(0, 5).map((s: any) => ({
      value: String(s.value || '?'),
      unit: String(s.unit || ''),
      label: String(s.label || ''),
    }));
  }
  if (keyStats.length < 3) {
    while (keyStats.length < 3) {
      keyStats.push({ value: '?', unit: '', label: `Stat ${keyStats.length + 1}` });
    }
  }

  // --- quickFacts (4-6) ---
  let quickFacts: FactFileData['quickFacts'] = [];
  if (Array.isArray(raw.quickFacts)) {
    quickFacts = raw.quickFacts.slice(0, 6).map((f: any) => ({
      fact: String(f.fact || ''),
      icon: f.icon || undefined,
    }));
  }
  if (quickFacts.length < 4) {
    while (quickFacts.length < 4) {
      quickFacts.push({ fact: 'Interesting fact coming soon.', icon: undefined });
    }
  }

  // --- deepDive (2-4) ---
  let deepDive: FactFileData['deepDive'] = [];
  if (Array.isArray(raw.deepDive)) {
    deepDive = raw.deepDive.slice(0, 4).map((d: any) => ({
      heading: String(d.heading || 'Section'),
      body: String(d.body || ''),
      detail: d.detail || undefined,
    }));
  }
  if (deepDive.length < 2) {
    while (deepDive.length < 2) {
      deepDive.push({ heading: 'More Info', body: 'Details coming soon.' });
    }
  }

  // --- records (2-3) ---
  let records: FactFileData['records'] = [];
  if (Array.isArray(raw.records)) {
    records = raw.records.slice(0, 3).map((r: any) => ({
      label: String(r.label || 'Record'),
      value: String(r.value || ''),
    }));
  }
  if (records.length < 2) {
    while (records.length < 2) {
      records.push({ label: 'Notable', value: 'Record details coming soon.' });
    }
  }

  // --- didYouKnow (2-3) ---
  let didYouKnow: FactFileData['didYouKnow'] = [];
  if (Array.isArray(raw.didYouKnow)) {
    didYouKnow = raw.didYouKnow.slice(0, 3).map((d: any) => ({
      text: String(d.text || ''),
      source: d.source || undefined,
    }));
  }
  if (didYouKnow.length < 2) {
    while (didYouKnow.length < 2) {
      didYouKnow.push({ text: 'Fun fact coming soon.' });
    }
  }

  // --- selfChecks: the whole pool, parsed; `pickSelfChecks` chooses which ship ---
  let selfChecks: FactFileCheck[] = [];
  if (Array.isArray(raw.selfChecks)) {
    selfChecks = raw.selfChecks.slice(0, 10).map((c: any): FactFileCheck => {
      // Reconstruct options from flat option0-option3 fields
      const options = [c.option0 ?? c.options?.[0], c.option1 ?? c.options?.[1], c.option2 ?? c.options?.[2], c.option3 ?? c.options?.[3]]
        .map(o => (typeof o === 'string' ? o.trim() : ''));

      let correctIndex = typeof c.correctIndex === 'number' ? c.correctIndex : -1;
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = -1;

      const challengeType = CHALLENGE_TYPES.includes(c.challengeType) ? c.challengeType : undefined;
      const difficulty = challengeType ? TYPE_DIFFICULTY[challengeType as ChallengeType] : 'medium';

      const validSections = ['keyStats', 'quickFacts', 'deepDive', 'records', 'didYouKnow'];
      const relatedSection = validSections.includes(c.relatedSection) ? c.relatedSection : 'quickFacts';

      // Pre-reader picture answer surface: keep optionEmojis only when EVERY option
      // has a non-empty DISTINCT emoji (a partial set strands a non-reader on the
      // options that got no picture). Otherwise undefined → ⭐ fallback.
      const rawEmojis = [c.option0Emoji, c.option1Emoji, c.option2Emoji, c.option3Emoji]
        .map((e) => (typeof e === 'string' ? e.trim() : ''));
      const emojisComplete =
        isPreReader &&
        rawEmojis.every((e) => e.length > 0) &&
        new Set(rawEmojis).size === rawEmojis.length;

      return {
        question: String(c.question || '').trim(),
        options,
        correctIndex,
        explanation: String(c.explanation || ''),
        difficulty,
        relatedSection: relatedSection as FactFileSection,
        ...(challengeType ? { challengeType } : {}),
        ...(emojisComplete ? { optionEmojis: rawEmojis } : {}),
      };
    });
  }

  return {
    title,
    category,
    description,
    keyStats,
    quickFacts,
    deepDive,
    records,
    didYouKnow,
    selfChecks,
    ...(opts?.gradeLevel ? { gradeLevel: opts.gradeLevel } : {}),
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** A stem that asks for one stated fact, not for reasoning with it. */
const LOOKUP_STEM = /^\s*(about |approximately |roughly )?(how (many|much|tall|long|big|far|old|hot|fast)|what (is|was|are) the (name|number|percentage|amount|height|length|size)|what percentage|which .* holds? the record)\b/i;
const ABOVE = /\b(all|none|both) of (the )?(above|these)\b/i;

/** Why a generated check cannot be asked, or null when it can. */
export function checkDefect(c: FactFileCheck): string | null {
  if (!c.question) return 'no question';
  if (c.correctIndex < 0 || c.correctIndex >= c.options.length) return 'no key';
  if (c.options.length !== 4 || c.options.some(o => !o)) return 'not four choices';
  if (new Set(c.options.map(o => normText(o))).size !== c.options.length) return 'a repeated choice';
  if (c.options.some(o => ABOVE.test(o))) return '"all/none of the above"';
  const key = normText(c.options[c.correctIndex]);
  if (key.trim().length >= 4 && normText(c.question).includes(key)) return 'the key is printed in the question';
  return null;
}

/** The key is plainly the longest choice: at least 40% and 8 characters longer than every other. */
export function keyLongest(c: FactFileCheck): boolean {
  const key = c.options[c.correctIndex]?.length ?? 0;
  const other = Math.max(...c.options.filter((_, i) => i !== c.correctIndex).map(o => o.length));
  return key >= other * 1.4 && key - other >= 8;
}

/**
 * The checks that ship, from Gemini's pool: defective ones dropped; the mode's challenge types first; then ranked
 * (a key the file states, a key that is not plainly the longest, and on hard, wrong choices the file states elsewhere);
 * then stamped with an id, the mode's `fileOpen`, the tier's starting position, and a shuffled choice order.
 */
export function pickSelfChecks(pool: FactFileCheck[], data: Omit<FactFileData, 'selfChecks'>, opts: {
  mode?: string; allowedTypes?: readonly string[]; tier: SupportTier | null; preReader: boolean;
}): FactFileCheck[] {
  const text = fileText(data);
  const count = (opts.mode && MODE_COUNT[opts.mode]) || 4;
  const sound = pool.filter(c => !checkDefect(c));
  const inMode = opts.allowedTypes ? sound.filter(c => c.challengeType && opts.allowedTypes!.includes(c.challengeType)) : sound;
  const usable = inMode.length >= Math.min(count, 3) ? inMode : sound;
  const score = (c: FactFileCheck) => {
    const foilsInFile = c.options.filter((o, i) => i !== c.correctIndex && statedInFile(o, text)).length;
    // apply asks for reasoning: a stem that only looks a fact up ("How many...", "What is the name of...") ranks last.
    const lookupInApply = opts.mode === 'apply' && LOOKUP_STEM.test(c.question);
    return (statedInFile(c.options[c.correctIndex], text) ? 4 : 0) + (keyLongest(c) ? 0 : 2)
      + (opts.tier === 'hard' ? foilsInFile : 0) - (lookupInApply ? 8 : 0);
  };
  // One question's key must not be printed in another shipped question's stem or choices: it would answer it
  // (or the two share an answer).
  const answers = (a: FactFileCheck, b: FactFileCheck) =>
    statedInFile(a.options[a.correctIndex], normText(`${b.question} ${b.options.join(' ')}`));
  const accepted: Array<{ c: FactFileCheck; i: number }> = [];
  for (const x of usable.map((c, i) => ({ c, i, s: score(c) })).sort((a, b) => b.s - a.s || a.i - b.i)) {
    if (accepted.length >= count) break;
    if (accepted.some(y => answers(x.c, y.c) || answers(y.c, x.c))) continue;
    accepted.push(x);
  }
  const ranked = accepted.sort((a, b) => a.i - b.i).map(x => x.c);
  const fileOpen = opts.mode === 'explore';
  return ranked.map((c, n) => {
    const emojis = c.optionEmojis;
    const shuffled = shuffleIndexedChoices(c.options, c.correctIndex, `fact-file|${c.question}`);
    return {
      ...c,
      id: `check-${n + 1}`,
      options: shuffled.options,
      correctIndex: shuffled.correctIndex,
      ...(emojis ? { optionEmojis: shuffled.order.map(i => emojis![i]) } : {}),
      fileOpen,
      ...(opts.tier === 'easy' && !opts.preReader ? { sectionHint: true } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type FactFileConfig = Partial<{ targetEvalMode?: string; difficulty?: string }>;

/**
 * Generate a FactFile magazine-style profile card.
 */
export const generateFactFile = async (
  ctx: GenerationContext,
): Promise<FactFileData> => {
  const { topic } = ctx;
  const config = ctx.raw as FactFileConfig;
  // Resolve the audience BAND from the canonical numeric grade first, then
  // fall back to parsing the prose gradeContext. Feeding the raw prose
  // sentence into getGradeLevelContext would always miss and collapse every
  // objective to 'Elementary'.
  const bandKey = gradeToBand(ctx.grade) || inferGradeLevelFromContext(ctx.gradeContext);
  const gradeLevel = bandKey;
  const gradeLevelContext = getGradeLevelContext(bandKey);
  // Surface the EXACT numeric grade so grade-2 ≠ grade-4 within the same band.
  const gradeLine = buildGradeLine(ctx.grade);
  // Pre-reader (kindergarten) band: the self-check goes picture-primary + read-aloud
  // (reader-fit PRE). Resolve 'K' only when confidently kindergarten.
  const canonicalGrade = (ctx.grade ?? '').toString().trim().toLowerCase();
  const isPreReader =
    canonicalGrade === 'k' || canonicalGrade === 'kindergarten' ||
    /(kinder|preschool|pre-?k\b|prek|pre-?reader)/i.test(ctx.gradeContext ?? '');
  const preReaderKey = isPreReader ? 'K' : undefined;
  const preReaderSelfCheckRules = isPreReader ? `
PRE-READER SELF-CHECKS (kindergarten — the child CANNOT read; a tutor reads each question + every option aloud and the child answers by tapping a PICTURE):
- question: ONE short spoken sentence, MAX 12 words. Do NOT reference text or a picture that isn't there.
- option0-option3: each 1-4 words, a CONCRETE thing a 5-year-old can picture. No abstract phrases. Do NOT let the answer leak from the wording.
- option0Emoji-option3Emoji: REQUIRED — one DISTINCT emoji per option, same order, that clearly depicts it. This is the answer surface; it must stand alone without the text.` : '';

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const targetEvalMode = config?.targetEvalMode ?? ctx.targetEvalMode;
  const evalConstraint = resolveEvalModeConstraint(
    'fact-file',
    targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  const tier = normalizeSupportTier(config?.difficulty);

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        factFileSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { arrayName: 'selfChecks', fieldName: 'challengeType' },
      )
    : factFileSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);
  const scopeSection = buildScopePromptSection(ctx.scope);

  const prompt = `You are a curriculum expert creating an engaging magazine-style Fact File profile card.

TOPIC / SUBJECT: ${topic}
${scopeSection}
TARGET AUDIENCE: ${gradeLevelContext}
${gradeLine ? gradeLine + '\n' : ''}
## Your Mission:
Create a rich, informative Fact File about "${topic}" that reads like a page from a children's encyclopedia or magazine.

${challengeTypeSection}
${evalConstraint?.definition.evalMode === 'apply' ? `
APPLY MODE: every question needs reasoning with the facts, not finding one. Ask why something happens, what would most
likely happen in a new situation, or which of two facts is bigger or came first. Never ask "how many", "what is the
name of" or "what percentage": those are lookups.
` : ''}
## Content Guidelines:

### Key Stats (3-5 items)
- Choose the most impressive or memorable numeric facts
- Use rounded, memorable numbers (e.g., "4,500" not "4,487")
- Include units that help students understand scale
- Examples: Speed, Size, Age, Population, Distance

### Quick Facts (4-6 items)
- Bullet-point essentials — one interesting fact per item
- Each fact should be self-contained and memorable
- Include an emoji icon that matches the fact
- Keep each to 1-2 sentences

### Deep Dive (2-4 sections)
- Expandable sections with more detail
- Each has a heading, body (2-4 sentences), and optional extra detail
- Cover different aspects: habitat, history, abilities, behavior, etc.

### Records (2-3 items)
- Superlatives and record-holders related to the topic
- "Fastest", "Largest", "Oldest", etc.
- Concrete values where possible

### Did You Know? (2-3 items)
- Surprising, counterintuitive, or fascinating facts
- The kind of facts students would want to share with friends
- Optional source attribution

### Self-Check Questions (6-8 items; some are set aside, so write each to stand alone)
- Multiple-choice questions that test the content above
- Each question has exactly 4 options with one correct answer
- NEVER reveal answers in the question text, and never use "all of the above" or "none of the above"
- Keep the four options the same kind of thing and about the same length; the correct one must not be the longest or most detailed
- relatedSection names the section that states the fact (keyStats, quickFacts, deepDive, records, or didYouKnow); the question text itself never names a section ("according to the key stats") — the file may be closed while it is asked
- Distractors should be plausible but clearly wrong${tier === 'hard' ? '; prefer distractors that are real facts from ELSEWHERE in this file (another stat, record or fact), so only a learner who remembers which fact goes with the question gets it' : ''}
- Explanation should reinforce the correct answer without just restating it
${preReaderSelfCheckRules}

## Grade-Level Adaptation:
- For K-2: Simple vocabulary, shorter facts, very concrete examples, relatable comparisons (e.g., "as tall as a school bus")
- For 3-5: More detailed facts, introduce some technical terms with explanations
- For 6-8: Richer vocabulary, more nuance, connections to broader concepts

## Critical Rules:
1. All facts must be accurate and age-appropriate
2. Self-check questions must be answerable from the content provided — do not ask about information not in the fact file
3. correctIndex must be 0, 1, 2, or 3 — matching the position of the correct option
4. Every self-check must have exactly 4 distinct options
5. Do not repeat the same information across sections

Now generate the Fact File.`;

  logEvalModeResolution('FactFile', targetEvalMode, evalConstraint);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
      },
    });

    if (!response.text) throw new Error("No content generated for fact-file");

    const raw = JSON.parse(response.text);
    const parsed = validateFactFileData(raw, { isPreReader, gradeLevel: preReaderKey });
    const selfChecks = pickSelfChecks(parsed.selfChecks ?? [], parsed, {
      mode: evalConstraint?.definition.evalMode, allowedTypes: evalConstraint?.allowedTypes, tier, preReader: isPreReader,
    });
    if (selfChecks.length < 2) throw new Error(`fact-file: only ${selfChecks.length} usable self-check question(s) were generated`);
    const data: FactFileData = { ...parsed, selfChecks };

    console.log('[FactFile] Generated:', {
      topic,
      gradeLevel,
      title: data.title,
      category: data.category,
      keyStats: data.keyStats.length,
      quickFacts: data.quickFacts.length,
      deepDive: data.deepDive.length,
      records: data.records.length,
      didYouKnow: data.didYouKnow.length,
      selfChecks: data.selfChecks?.length ?? 0,
    });

    return data;
  } catch (error) {
    console.error("[FactFile] Generation error:", error);
    throw error;
  }
};
