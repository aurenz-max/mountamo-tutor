/**
 * Fast Fact Generator - Dedicated service for fluency drill content
 *
 * Subject-agnostic: infers subject from the topic / learning objective.
 * Generates 8-12 challenges across 2-3 phases (recall, apply, rapid-recall, etc.)
 *
 * Untimed by design — there is no countdown or deadline. Response time is
 * measured silently for the automaticity signal only.
 *
 * Uses a FLAT Gemini schema to avoid malformed nested JSON, then reconstructs
 * the nested FastFactChallenge structure during validation.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection, gradeToBand, buildGradeLine } from "../scopeContext";
import type { FastFactData, FastFactChallenge } from '../../primitives/visual-primitives/core/FastFact';

/**
 * Infer the grade-level label from the grade-context prose string.
 *
 * Copied verbatim from coreGenerators.ts so this generator is self-contained
 * under the context-native calling convention. The mapping MUST stay identical
 * to the original handler's `inferGradeLevel`.
 */
function inferGradeLevelFromContext(gradeContext: string): string {
  if (gradeContext.includes('toddler')) return 'Toddler';
  if (gradeContext.includes('preschool')) return 'Preschool';
  if (gradeContext.includes('kindergarten')) return 'Kindergarten';
  if (gradeContext.includes('elementary') || gradeContext.includes('grades 1-5')) return 'Elementary';
  if (gradeContext.includes('middle') || gradeContext.includes('grades 6-8')) return 'Middle School';
  if (gradeContext.includes('high') || gradeContext.includes('grades 9-12')) return 'High School';
  if (gradeContext.includes('undergraduate')) return 'Undergraduate';
  if (gradeContext.includes('graduate')) return 'Graduate';
  if (gradeContext.includes('phd')) return 'PhD';
  return 'Elementary';
}

// ============================================================================
// Grade-Level Context Helper
// ============================================================================

const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'Toddler': 'toddlers (ages 1-3) — very simple concepts, concrete examples, playful engagement.',
    'Preschool': 'preschool children (ages 3-5) — simple sentences, colorful examples, hands-on concepts.',
    'Kindergarten': 'kindergarten students (ages 5-6) — clear language, foundational skills, engaging visuals.',
    'Elementary': 'elementary students (grades 1-5) — age-appropriate vocabulary, concrete examples, interactive elements.',
    'Middle School': 'middle school students (grades 6-8) — more complex vocabulary, abstract concepts, real-world applications.',
    'High School': 'high school students (grades 9-12) — advanced vocabulary, sophisticated concepts, academic rigor.',
    'Undergraduate': 'undergraduate college students — academic language, theoretical frameworks, research-based content.',
    'Graduate': 'graduate students — specialized terminology, advanced theory, professional applications.',
    'PhD': 'doctoral students — expert-level terminology, cutting-edge research, scholarly discourse.',
  };
  return contexts[gradeLevel] || contexts['Elementary'];
};

// ============================================================================
// Flat Gemini Schema (avoids nested objects that cause malformed JSON)
// ============================================================================

const flatChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier, e.g. 'ff_1', 'ff_2'",
    },
    type: {
      type: Type.STRING,
      description: "Phase grouping key, e.g. 'recall', 'apply', 'speed-round'",
    },
    promptText: {
      type: Type.STRING,
      description: "Primary question or stimulus shown to the student",
    },
    promptSubtext: {
      type: Type.STRING,
      description: "Optional brief instruction above the question (empty string if none)",
    },
    visualType: {
      type: Type.STRING,
      enum: ["emoji", "text-large", "none"],
      description: "Type of visual to show: emoji, text-large, or none",
    },
    visualContent: {
      type: Type.STRING,
      description: "The emoji character or large text value. Empty string if visualType is 'none'. MUST be a DIFFERENT representation from the answer — never equal to correctAnswer or any acceptableAnswers entry",
    },
    visualRepeat: {
      type: Type.NUMBER,
      description: "For a COUNTING visual: put ONE emoji in visualContent and set this to how many should be drawn (2-25) — the code repeats it, so never type the emoji out by hand. Use 1 for a single decorative emoji or any non-counting visual",
    },
    visualAlt: {
      type: Type.STRING,
      description: "Accessibility alt text for the visual. Empty string if none",
    },
    correctAnswer: {
      type: Type.STRING,
      description: "The single correct answer (as a string)",
    },
    acceptableAnswers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Additional accepted answers besides correctAnswer (can be empty array)",
    },
    responseMode: {
      type: Type.STRING,
      enum: ["choice"],
      description: "Always 'choice' — all challenges use multiple-choice buttons",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Answer options: exactly 2 for yes/no or true/false questions, 3-4 otherwise. Must include the correct answer exactly once — every other option must be a real, plausible, DIFFERENT answer (no duplicates, no filler). Required for every challenge",
    },
    explanation: {
      type: Type.STRING,
      description: "Brief explanation shown after the answer is revealed (1 sentence)",
    },
    difficulty: {
      type: Type.STRING,
      enum: ["easy", "medium", "hard"],
      description: "Challenge difficulty level",
    },
  },
  required: [
    "id", "type", "promptText", "promptSubtext", "visualType", "visualContent",
    "visualRepeat", "visualAlt", "correctAnswer", "acceptableAnswers",
    "responseMode", "options", "explanation", "difficulty",
  ],
};

const phaseConfigItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    key: {
      type: Type.STRING,
      description: "Phase key matching challenge.type values, e.g. 'recall', 'apply'",
    },
    label: {
      type: Type.STRING,
      description: "Human-readable phase label, e.g. 'Quick Recall'",
    },
    icon: {
      type: Type.STRING,
      description: "Single emoji icon for the phase, e.g. a brain or lightning bolt",
    },
    accentColor: {
      type: Type.STRING,
      description: "Tailwind color class, e.g. 'blue', 'emerald', 'amber'",
    },
  },
  required: ["key", "label", "icon", "accentColor"],
};

const fastFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short, engaging title for the drill (3-8 words)",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence description of the drill",
    },
    subject: {
      type: Type.STRING,
      description: "Inferred subject area (e.g. 'Math', 'Science', 'Language Arts', 'History')",
    },
    challenges: {
      type: Type.ARRAY,
      items: flatChallengeSchema,
      description: "Array of 8-12 fluency challenges across 2-3 phases",
    },
    phaseConfigItems: {
      type: Type.ARRAY,
      items: phaseConfigItemSchema,
      description: "Phase display config — one entry per unique challenge.type value used",
    },
    targetResponseTime: {
      type: Type.NUMBER,
      description: "Seconds — answers within this count as 'fast' (4-12) for the SILENT automaticity metric only; never shown to the student or enforced as a deadline. Scale up for younger learners",
    },
    showStreakCounter: {
      type: Type.BOOLEAN,
      description: "Whether to show a streak counter. Usually true",
    },
    showAccuracy: {
      type: Type.BOOLEAN,
      description: "Whether to show accuracy percentage. Usually true",
    },
    maxAttemptsPerChallenge: {
      type: Type.NUMBER,
      description: "Max wrong answers before advancing (1 for speed-rounds, 2 normally)",
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band label, e.g. 'K-2', '3-5', '6-8'",
    },
  },
  required: [
    "title", "description", "subject", "challenges", "phaseConfigItems",
    "targetResponseTime", "showStreakCounter",
    "showAccuracy", "maxAttemptsPerChallenge", "gradeBand",
  ],
};

// ============================================================================
// Validation & Reconstruction
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

// ----------------------------------------------------------------------------
// Answer-integrity guards — REPRESENTATION SHIFT (oracle-test 2026-08-06)
// ----------------------------------------------------------------------------
//
// The invariant: the visual and the options must be DIFFERENT representations
// of the same fact, so the student has to TRANSLATE rather than pattern-match.
// `Fe` → "Iron" honors it. `7` → `7` and `the` → `the` do not — a live
// "Counting within 20" drill rendered `text-large: "7"` above "Which number is
// shown here?" with options 6/7/8, and nothing was measured. The same leak was
// then found in every subject the primitive serves (LA 24, Science 15, Math 6
// violations across 5 runs each), so it is the primitive's default behaviour
// wherever the generator reaches for a visual, not a math bug.
//
// These predicates are deliberately NOT shared with the fast-fact oracle
// (`service/qa/oracles/fast-fact.ts`). The oracle must keep re-deriving the
// contract from the data independently; importing this code into it would make
// a bug in this guard invisible to QA. Two implementations of one rule is the
// price of that independence.

const normAnswer = (value: unknown): string => String(value ?? '').trim().toLowerCase();

/** Escape for literal RegExp use. */
const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The component's grading predicate (FastFact.tsx `isAnswerCorrect`), mirrored. */
function gradesCorrect(option: string, correctAnswer: string, acceptable: string[]): boolean {
  const n = normAnswer(option);
  if (!n) return false;
  if (n === normAnswer(correctAnswer)) return true;
  return acceptable.some((a) => normAnswer(a) === n);
}

/**
 * Collapse every option the component would treat as the same button, then
 * leave exactly one that grades correct.
 *
 * Two shapes shipped live from one root cause. A literal duplicate —
 * `[New Mexico, Nevada, Arizona, Arizona]` in a capitals drill — collides the
 * component's `key={opt}` AND makes two buttons grade correct. And an
 * `acceptableAnswers` entry can silently promote a distractor to a second
 * correct answer without any duplication at all ("5" keyed, "five" listed as
 * acceptable, "five" also offered as a distractor). Both resolve to: keep the
 * first option of each normalized value, then keep only the FIRST option that
 * grades correct.
 */
export function normalizeOptions(
  rawOptions: unknown,
  correctAnswer: string,
  acceptable: string[],
): string[] {
  const source = Array.isArray(rawOptions) ? rawOptions.map(String) : [];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const option of source) {
    const key = normAnswer(option);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(option);
  }

  let keptCorrect = false;
  const single = unique.filter((option) => {
    if (!gradesCorrect(option, correctAnswer, acceptable)) return true;
    if (keptCorrect) return false;
    keptCorrect = true;
    return true;
  });

  // Nothing gradeable — the student could never be right. Add the key itself;
  // final placement decides where it sits.
  if (!keptCorrect && correctAnswer.trim()) single.push(correctAnswer);
  return single;
}

/** Split into grapheme clusters so an emoji, ZWJ sequence or VS pair counts once. */
function splitGraphemes(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Iterated by hand rather than for..of: the Lumina tsconfig targets ES5-era
  // iteration, so for..of over a non-array Iterable needs --downlevelIteration.
  type GraphemeSegments = { [Symbol.iterator](): Iterator<{ segment: string }> };
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): GraphemeSegments };
  }).Segmenter;
  const out: string[] = [];
  if (Segmenter) {
    const iterator = new Segmenter('en', { granularity: 'grapheme' }).segment(trimmed)[Symbol.iterator]();
    for (let r = iterator.next(); !r.done; r = iterator.next()) {
      if (r.value.segment.trim()) out.push(r.value.segment);
    }
    return out;
  }
  return Array.from(trimmed).filter((c) => c.trim());
}

/**
 * CODE draws the counting visual; the model only names the glyph and the count.
 *
 * Steering counting items onto emoji (so the numeral stops being shown) walked
 * straight into SP-8 — flash-lite writes "the key is 10" and then emits seven
 * faces, and a child who counts correctly is marked wrong (measured 2/50 on the
 * first post-fix run). Asking for a NUMBER it can get right and repeating the
 * glyph here removes the failure mode at its source rather than detecting it
 * afterwards; `visualRepeat <= 1` means "decorative, use as authored".
 */
export function buildEmojiVisual(emoji: string, repeat: unknown): string {
  const glyphs = splitGraphemes(emoji);
  if (glyphs.length === 0) return '';
  const n = Math.floor(Number(repeat));
  if (!isFinite(n) || n <= 1) return emoji;
  // A countable visual has to be homogeneous, so the first glyph wins.
  return glyphs[0].repeat(Math.min(n, 25));
}

/** The visual IS the answer — the student matches a glyph to a button. */
export function visualLeaksAnswer(
  visualContent: string,
  correctAnswer: string,
  acceptable: string[],
): boolean {
  if (!visualContent.trim() || !correctAnswer.trim()) return false;
  return gradesCorrect(visualContent, correctAnswer, acceptable);
}

/**
 * What to do with a challenge whose visual gives the answer away.
 *
 * `text-large` is the STIMULUS in this primitive — when the generator reaches
 * for it there is nothing else on the card, so a leaking large text means the
 * item's entire task was pixel-matching and there is nothing to salvage:
 * REJECT. A leaking emoji is different — emoji here are usually decorative
 * ("🤠" beside "What is the capital of Texas?"), so the prompt normally stands
 * on its own once the emoji is gone: STRIP, unless the stem points at it.
 */
export function resolveLeakingVisual(
  visualType: string,
  promptText: string,
  promptSubtext: string,
): 'strip' | 'reject' {
  if (visualType === 'text-large') return 'reject';
  return stemNeedsVisual(promptText, promptSubtext) ? 'reject' : 'strip';
}

/** Stems that point AT the visual — remove it and nothing is being asked. */
const VISUAL_DEICTIC = /\b(this|these|here|shown|showing|see|seen|above|below|picture|image|displayed|following)\b/i;

export function stemNeedsVisual(promptText: string, promptSubtext = ''): boolean {
  const text = promptText.trim();
  if (!text) return true;
  // "Find the word:" — a lead-in whose object is the visual. Tested against the
  // primary text only; a subtext sentence would hide the trailing colon.
  if (text.endsWith(':')) return true;
  if (VISUAL_DEICTIC.test(`${text} ${promptSubtext}`)) return true;
  return !text.includes('?') && text.split(/\s+/).length < 4;
}

/** Prompts that COMPUTE rather than name — operands legitimately appear. */
const isExpressionStem = (text: string): boolean =>
  /[+\-×÷*/=]|\bplus\b|\bminus\b|\btimes\b/i.test(text);

const containsWholeWord = (text: string, word: string): boolean => {
  const e = escRe(word.trim());
  return e ? new RegExp(`\\b${e}\\b`, 'i').test(text) : false;
};

const quotedInStem = (stem: string, answer: string): boolean =>
  new RegExp(`['"‘’“”]\\s*${escRe(answer)}\\s*['"‘’“”]`, 'i').test(stem);

/**
 * The stem hands over the answer — "Find the word: look", "Which option spells
 * 'and'?", "What is the final number when counting to 20?".
 *
 * Fires only when the answer is named AND no distractor is, since a stem that
 * names both is stating the problem rather than giving it away. Short function
 * words ("the", "is", "to") occur incidentally in instruction text, so a BARE
 * occurrence only counts for alphabetic answers of 4+ characters — a QUOTED
 * occurrence counts at any length, which is what catches the sight-word leaks.
 */
export function stemLeaksAnswer(
  promptText: string,
  promptSubtext: string,
  correctAnswer: string,
  options: string[],
): boolean {
  const stem = `${promptText} ${promptSubtext}`.trim();
  const answer = correctAnswer.trim();
  if (!stem || !answer || isExpressionStem(stem)) return false;

  const quoted = quotedInStem(stem, answer);
  const bareCounts = !/[a-z]/i.test(answer) || answer.length >= 4;
  const named = quoted || (containsWholeWord(stem, answer) && bareCounts);
  if (!named) return false;

  const distractorNamed = options.some((option) => {
    const o = option.trim();
    if (!o || normAnswer(o) === normAnswer(answer)) return false;
    return quotedInStem(stem, o) || containsWholeWord(stem, o);
  });
  return !distractorNamed;
}

/**
 * Move the correct option to a chosen slot, preserving distractor order.
 *
 * Live drills parked the key in slot 1 in 8/10 and 9/10 challenges — "tap the
 * middle button" won without reading anything. The caller rotates the slot
 * across the challenge set from a per-drill random offset, so the answer both
 * spreads evenly (which random shuffling does not guarantee over 10 items) and
 * stays unpredictable across sessions (which a bare `index % n` would not).
 */
export function placeAnswerAtSlot(options: string[], correctIndex: number, slot: number): string[] {
  if (options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return options;
  const rest = options.filter((_, i) => i !== correctIndex);
  const target = ((slot % options.length) + options.length) % options.length;
  rest.splice(target, 0, options[correctIndex]);
  return rest;
}

/** Why a challenge was dropped — surfaced in the generator log, never silent. */
type RejectionReason = 'no-answer' | 'visual-leak' | 'stem-leak' | 'no-distractor';

/**
 * Reconstruct a FastFactChallenge from the flat Gemini output.
 *
 * Returns null when the challenge cannot be shipped without breaking rule #1.
 * Rejecting is deliberate: a short drill measures less, but a leaking drill
 * measures nothing at all, and padding with invented options is worse than both.
 */
function reconstructChallenge(
  flat: any,
  index: number,
  rejected: RejectionReason[],
): FastFactChallenge | null {
  const id = flat.id || `ff_${index + 1}`;
  const correctStr = String(flat.correctAnswer ?? '').trim();

  // Gemini omitted the answer. The old `|| '???'` sentinel shipped an
  // unwinnable challenge — no click can ever be correct.
  if (!correctStr) {
    rejected.push('no-answer');
    return null;
  }

  const acceptable = Array.isArray(flat.acceptableAnswers) && flat.acceptableAnswers.length > 0
    ? flat.acceptableAnswers.map(String)
    : [];

  const promptText = String(flat.promptText || '');
  const promptSubtext = String(flat.promptSubtext || '');

  let options = normalizeOptions(flat.options, correctStr, acceptable);

  // Binary questions (yes/no, true/false) legitimately have exactly 2 options.
  // NEVER pad with placeholder junk ('Option 3') — a visibly-fake option is
  // trivially eliminable, reveals structure, and violates pedagogy.
  if (options.length < 2) {
    const correctLower = normAnswer(correctStr);
    if (correctLower === 'yes' || correctLower === 'no') {
      options = ['Yes', 'No'];
    } else if (correctLower === 'true' || correctLower === 'false') {
      options = ['True', 'False'];
    } else {
      // Pathological: Gemini returned no usable distractors. A single button is
      // answered correctly without knowing anything, so the item is dropped
      // rather than shipped as a freebie or padded with a fake.
      rejected.push('no-distractor');
      return null;
    }
  }

  // The prompt already forbids naming the answer; this is the net under it.
  if (stemLeaksAnswer(promptText, promptSubtext, correctStr, options)) {
    rejected.push('stem-leak');
    return null;
  }

  // Build visual (only if type is not 'none'). Counting emoji are drawn here
  // from the model's glyph + count, never copied from what it typed out.
  let visual: FastFactChallenge['prompt']['visual'] | undefined;
  const visualContent = flat.visualType === 'emoji'
    ? buildEmojiVisual(String(flat.visualContent || ''), flat.visualRepeat)
    : String(flat.visualContent || '');
  if (flat.visualType && flat.visualType !== 'none' && visualContent) {
    if (visualLeaksAnswer(visualContent, correctStr, acceptable)) {
      if (resolveLeakingVisual(String(flat.visualType), promptText, promptSubtext) === 'reject') {
        rejected.push('visual-leak');
        return null;
      }
      // strip: the prompt stands on its own without the give-away visual
    } else if (flat.visualType === 'emoji') {
      visual = {
        type: 'emoji',
        emoji: visualContent,
        alt: flat.visualAlt || undefined,
      };
    } else if (flat.visualType === 'text-large') {
      visual = {
        type: 'text-large',
        largeText: visualContent,
        alt: flat.visualAlt || undefined,
      };
    }
  }

  return {
    id,
    type: flat.type || 'recall',
    prompt: {
      text: promptText,
      subtext: promptSubtext || undefined,
      visual,
    },
    correctAnswer: correctStr,
    acceptableAnswers: acceptable.length > 0 ? acceptable : undefined,
    responseMode: 'choice',
    options,
    explanation: flat.explanation || undefined,
    difficulty: ['easy', 'medium', 'hard'].includes(flat.difficulty) ? flat.difficulty : undefined,
  };
}

/**
 * Convert phaseConfigItems array to the Record<string, ...> expected by FastFactData.
 */
function buildPhaseConfig(items: any[]): Record<string, { label: string; icon: string; accentColor: string }> {
  const record: Record<string, { label: string; icon: string; accentColor: string }> = {};
  if (!Array.isArray(items)) return record;
  for (const item of items) {
    if (item.key) {
      record[item.key] = {
        label: item.label || item.key,
        icon: item.icon || '',
        accentColor: item.accentColor || 'blue',
      };
    }
  }
  return record;
}

/**
 * Clamp a numeric value to a range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Minimum drill length that still measures automaticity (catalog contract: 8-12). */
const MIN_MEASURABLE_CHALLENGES = 6;

/**
 * Validate and reconstruct the full FastFactData from raw Gemini output.
 *
 * Exported for the answer-contract tests, which drive it with unmutated flat
 * output from real 2026-08-06 generations.
 */
export function validateFastFactData(raw: any): FastFactData {
  const rejected: RejectionReason[] = [];
  const challenges: FastFactChallenge[] = (Array.isArray(raw.challenges) ? raw.challenges : [])
    .map((c: any, i: number) => reconstructChallenge(c, i, rejected))
    .filter((c: FastFactChallenge | null): c is FastFactChallenge => c !== null);

  // Spread the correct button across slots. Rotating from a per-drill random
  // offset gives both an even spread (which shuffling does not guarantee at
  // n=10) and cross-session unpredictability (which `i % n` would not).
  const slotOffset = Math.floor(Math.random() * 4);
  for (let i = 0; i < challenges.length; i++) {
    const ch = challenges[i];
    const correctIndex = ch.options.findIndex(
      (o) => gradesCorrect(o, ch.correctAnswer, ch.acceptableAnswers ?? []),
    );
    ch.options = placeAnswerAtSlot(ch.options, correctIndex, i + slotOffset);
  }

  if (rejected.length > 0) {
    const tally = rejected.reduce<Record<string, number>>((acc, r) => {
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    console.warn(
      `[Fast Fact] Rejected ${rejected.length} challenge(s) that broke the answer contract:`,
      tally,
      `— ${challenges.length} shipped.`,
    );
  }
  if (challenges.length === 0) {
    // Fail loudly rather than render an empty card. Every challenge broke the
    // representation-shift or answer-key contract; there is nothing to ship.
    throw new Error(
      '[Fast Fact] every generated challenge broke the answer contract '
      + `(${JSON.stringify(rejected)}) — nothing shippable`,
    );
  }
  if (challenges.length < MIN_MEASURABLE_CHALLENGES) {
    console.warn(
      `[Fast Fact] only ${challenges.length} challenge(s) survived validation — `
      + `below the ${MIN_MEASURABLE_CHALLENGES}-item floor for measuring automaticity.`,
    );
  }

  const phaseConfig = buildPhaseConfig(raw.phaseConfigItems);

  // Ensure every challenge.type has a phaseConfig entry
  for (const ch of challenges) {
    if (ch.type && !phaseConfig[ch.type]) {
      phaseConfig[ch.type] = {
        label: ch.type.charAt(0).toUpperCase() + ch.type.slice(1).replace(/-/g, ' '),
        icon: '',
        accentColor: 'blue',
      };
    }
  }

  return {
    title: raw.title || 'Fast Fact Drill',
    description: raw.description || undefined,
    subject: raw.subject || 'General',
    challenges,
    targetResponseTime: typeof raw.targetResponseTime === 'number'
      ? clamp(raw.targetResponseTime, 4, 12) : 6,
    phaseConfig,
    showStreakCounter: raw.showStreakCounter !== false,
    showAccuracy: raw.showAccuracy !== false,
    maxAttemptsPerChallenge: typeof raw.maxAttemptsPerChallenge === 'number'
      ? Math.max(1, Math.min(3, raw.maxAttemptsPerChallenge)) : 2,
    gradeBand: raw.gradeBand || undefined,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================================
// Generator
// ============================================================================

type FastFactConfig = Record<string, unknown>;

/**
 * Generate a FastFact timed fluency drill for any subject.
 */
export const generateFastFact = async (
  ctx: GenerationContext,
): Promise<FastFactData> => {
  const { topic } = ctx;
  // Band label: canonical curriculum grade first (authoritative), prose-inferred
  // band as the fallback. Feeding a real map KEY to getGradeLevelContext.
  const gradeLevel = (ctx.grade && gradeToBand(ctx.grade)) || inferGradeLevelFromContext(ctx.gradeContext);
  const config = ctx.raw as FastFactConfig;
  const gradeLevelContext = getGradeLevelContext(gradeLevel);
  const challengeCount = (config?.challengeCount as number) || 10;
  const scopeSection = buildScopePromptSection(ctx.scope);
  // Numeric-grade surfacing — discriminates grades WITHIN a band (grade 2 ≠ grade 5)
  // by tuning realization (reading level, vocab, sentence length) only. Does NOT
  // change the eval mode / challenge-type axis.
  const gradeLine = buildGradeLine(
    ctx.grade,
    undefined,
    ctx.grade ? `Set gradeBand to the band containing grade ${ctx.grade}.` : '',
  );

  const prompt = `You are a curriculum expert creating fluency drill challenges.

TOPIC / LEARNING OBJECTIVE: ${topic}
${scopeSection}
TARGET AUDIENCE: ${gradeLevelContext}
${gradeLine ? `${gradeLine}\n` : ''}${config?.context ? `ADDITIONAL CONTEXT: ${config.context}\n` : ''}
NUMBER OF CHALLENGES: ${challengeCount} (8-12 range)

## Your Mission:
Create a Fast Fact fluency drill for "${topic}". Infer the subject area from the topic (Math, Science, Language Arts, History, etc.).

## Phase Design:
- Generate challenges across 2-3 PHASES (e.g. 'recall', 'apply', 'rapid-recall').
- Each challenge has a \`type\` field that groups it into a phase.
- Early phases should be easier; later phases should be harder (more abstract / less scaffolded), NOT faster.
- Distribute challenges roughly evenly across phases.

## Challenge Design:
- Each challenge must have a SINGLE clear correct answer.
- ALL challenges use CHOICE mode (multiple choice). Match the option count to the question: exactly 2 options for yes/no or true/false questions, 3-4 options for everything else. NEVER invent filler options to reach a count — every option must be a plausible, real answer. The correct answer MUST be one of the options.
- responseMode must always be "choice". Never use "type".

## REPRESENTATION SHIFT (hard rule — a challenge that breaks this is DISCARDED):
The visual and the options must be DIFFERENT representations of the same fact, so the student has to TRANSLATE between them. They must never be able to match a shape on screen to a button.
- GOOD  visual "Fe"    -> options Iron / Fluorine / Francium   (symbol -> name)
- GOOD  visual 🍎🍎🍎  -> options 2 / 3 / 4                    (quantity -> numeral)
- BAD   visual "7"     -> options 6 / 7 / 8                    (the visual IS the answer)
- BAD   visual "the"   -> options the / and / big              (the visual IS the answer)
visualContent must NEVER equal correctAnswer, and must never be a spelling, casing or spacing variant of it or of any acceptableAnswers entry.

## NEVER NAME THE ANSWER IN THE QUESTION (hard rule — DISCARDED if broken):
- promptText and promptSubtext must never contain the correct answer as a word, quoted or unquoted. "Which option spells 'and'?" answered by "and", or "Find the word: look" answered by "look", measures nothing — ask by MEANING, USE or SOUND instead.
- The only exception is a computation stem, where the operands are the problem: "7 + 3 = ?" answered by 10 is fine.

## Visual choices that work, by subject:
- Sight words / vocabulary: NEVER display the target word. Use a sentence with a blank ("I ___ a bird." -> the / see / big), or a meaning cue. Displaying the word and asking the student to pick it out is pattern-matching, not reading.
- Symbols (elements, units, currency, notation): show the symbol and ask for the NAME, or name the thing and ask for the SYMBOL — never show both.
- Counting / quantity: ask for the numeral, never show it. Put ONE emoji in visualContent and set visualRepeat to how many should be drawn — the code repeats the glyph, so never type a row of emoji by hand and never rely on counting the characters you wrote.
- Math facts: show the expression and ask for the result. Never show the result.
- Use visualType: "none" whenever a visual would carry the answer. No visual is always better than a revealing one, and most challenges need none.
- visualAlt describes what is drawn (e.g. "15 stars") so the visual is accessible.

## Difficulty:
- Adjust difficulty for the grade level. The drill is UNTIMED — there is no countdown and no deadline. Never reference speed, timers, or "answer quickly" anywhere in the content.
- targetResponseTime is a SILENT automaticity signal (never shown to the student): K-2 / Preschool / Kindergarten 8, grades 3-5 / Elementary 6, grades 6-8 / Middle School 5, grades 9+ / High School and above 4.

## Critical Rules:
- promptText is the main question shown large — keep it concise and clear.
- promptSubtext is an optional instruction shown smaller above the question.
- correctAnswer must be an exact string match to one of the options (for choice mode).
- acceptableAnswers covers alternate spellings or equivalent forms.
- explanation is a 1-sentence reason shown after the answer is revealed.
- maxAttemptsPerChallenge: use 1 for rapid-recall phases, 2 otherwise.

Now generate the Fast Fact drill.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fastFactSchema,
      },
    });

    if (!response.text) throw new Error("No content generated for fast-fact");

    const raw = JSON.parse(response.text);
    const data = validateFastFactData(raw);

    console.log('[Fast Fact] Generated from dedicated service:', {
      topic,
      gradeLevel,
      challengeCount: data.challenges.length,
      phases: Object.keys(data.phaseConfig),
      subject: data.subject,
    });

    return data;
  } catch (error) {
    console.error("[Fast Fact] Generation error:", error);
    throw error;
  }
};
