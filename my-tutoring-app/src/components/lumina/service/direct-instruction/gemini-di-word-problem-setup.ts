/**
 * gemini-di-word-problem-setup — generator for di-word-problem-setup, the
 * "name the problem, build the family" pack. Fork A (pool service), the
 * di-math-facts discipline: the CONTENT — story frame, numbers, which amount is
 * unknown, the family and the answer — is code-owned (`diWordProblemPlan.ts`)
 * and scoped to the objective. Gemini's only job is the session wrapper (kid
 * title + description) and a THEME per story: two names, a plural object noun,
 * and a gain/loss verb pair. The LLM never emits a number.
 *
 * SCOPE: the objective text is code-enforced. "within 100" / "two-digit" lifts
 * the number ceiling to 100 (the solve step then rides the build-ahead
 * `number_word_to_120` class); everything else stays within 20, where every
 * number word is one benched token. Which steps a story is worked through is
 * the EVAL MODE (find_big_number / build_family / classify_and_build); a
 * session runs ONE mode, because the step list is the how-to-play and mixing
 * lists inside one session would re-teach the protocol every story.
 *
 * SUPPORT TIER (L3) is composed into the cue by the script (`easy` re-reads the
 * story on every step). No structural lever rides the tier in this pilot.
 *
 * KEEP-OR-DROP, NEVER BACKFILL: a theme that fails `themeUsable` is refused,
 * every drawn pair passes `planWordProblem`'s gates by construction, and
 * `itemsFromProblems` re-checks them on the way to the stage. A session with
 * no usable theme ships NO problems — the stage says so — rather than a
 * hardcoded one (no DEFAULT_ITEMS in a DI pack).
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { resolveEvalModes } from '../evalMode';
import { supportForSingleDiMode } from '../../hooks/diModeContract';
import { normalizeObjectiveGrade } from '../generation/resolveGenerationContext';
import {
  BIG_UNKNOWN_FRAMES,
  drawNumbersFor,
  FRAME_IDS,
  PART_ADJECTIVE_PAIRS,
  reseedWordProblemPool,
  shapeOfFrame,
  shuffleWithPool,
  STORY_SHAPES,
  themeUsable,
  type FrameId,
  type StoryShape,
  type StoryTheme,
} from '../../primitives/visual-primitives/direct-instruction/diWordProblemPlan';
import type {
  DiWordProblemSetupData,
  WordProblemProblemSpec,
  WordProblemSupportTier,
} from '../../primitives/visual-primitives/direct-instruction/diWordProblemScript';
import {
  DI_WORD_PROBLEM_CHALLENGE_TYPES,
  DI_WORD_PROBLEM_TYPE_DOCS,
  type WordProblemChallengeType,
} from '../../primitives/visual-primitives/direct-instruction/diWordProblemModes';

const DEFAULT_PROBLEM_COUNT = 3;
const MIN_PROBLEM_COUNT = 2;
const MAX_PROBLEM_COUNT = 4;
const THEMES_TO_ASK = 4;

const SUPPORT_TIERS: readonly WordProblemSupportTier[] = ['easy', 'medium', 'hard'];
const normalizeSupportTier = (raw?: unknown): WordProblemSupportTier | undefined => {
  const d = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as WordProblemSupportTier) : undefined;
};

// ── Eval-mode routing (code stamps the mode; no schema enum exists) ──────────

const CHALLENGE_TYPE_DOCS = DI_WORD_PROBLEM_TYPE_DOCS;
const ALL_TYPES: readonly WordProblemChallengeType[] = DI_WORD_PROBLEM_CHALLENGE_TYPES;

// ── Scope from text (code-enforced over the model) ──────────────────────────

export interface WordProblemScope {
  maxNumber: 20 | 100;
  /** A mode the text pins on its own. */
  mode: WordProblemChallengeType | null;
  /** Story shapes the text names — a session prefers them. */
  shapes: StoryShape[];
}

export const resolveTextScope = (text: string): WordProblemScope => {
  const t = text.toLowerCase();
  const maxNumber: 20 | 100 =
    /within\s*100\b|\b(two|2)[- ]digit|\bto 100\b|up to 100\b/.test(t) ? 100 : 20;
  const mode: WordProblemChallengeType | null =
    /classif|kind of problem|type of problem|problem type/.test(t) ? 'classify_and_build'
    : /number famil|fact famil|number sentence|equation|unknown|missing (number|addend)/.test(t) ? 'build_family'
      : /big number|whole amount|part[- ]?whole|total/.test(t) && !/famil/.test(t) ? null
        : null;
  const shapes: StoryShape[] = [];
  if (/compar|more than|fewer than|how many more/.test(t)) shapes.push('comparison');
  if (/change|add to|take from|start|result unknown|joining|separating/.test(t)) shapes.push('change');
  if (/part[- ]?whole|put together|take apart|in all|altogether|total/.test(t)) shapes.push('part_whole');
  return { maxNumber, mode, shapes };
};

const gradeDefaultMode = (grade: string | undefined): WordProblemChallengeType => {
  if (!grade || grade === 'K' || grade === '1') return 'find_big_number';
  const n = parseInt(grade, 10);
  if (!Number.isFinite(n) || n <= 2) return 'build_family';
  return 'classify_and_build';
};

// ── The wrapper + themes (the only things Gemini writes) ─────────────────────

const themeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    nameA: { type: Type.STRING, description: 'A child\'s first name, one word, capitalised (e.g. Jen).' },
    nameB: { type: Type.STRING, description: 'A different child\'s first name, one word, capitalised.' },
    nounPlural: {
      type: Type.STRING,
      description:
        'A plain plural noun for countable things a child collects or uses (stickers, marbles, '
        + 'apples). Lowercase, one word, ending in s. NEVER a number, size or group word (dozen, pair, '
        + 'half, bunch, set).',
    },
    gainPast: { type: Type.STRING, description: 'A GAIN verb, past tense: found, picked, bought, won, made, earned.' },
    gainBase: { type: Type.STRING, description: 'The same gain verb, base form: find, pick, buy, win, make, earn.' },
    losePast: { type: Type.STRING, description: 'A LOSS verb, past tense: lost, ate, gave away, sold, popped, dropped.' },
    loseBase: { type: Type.STRING, description: 'The same loss verb, base form: lose, eat, give away, sell, pop, drop.' },
  },
  required: ['nameA', 'nameB', 'nounPlural', 'gainPast', 'gainBase', 'losePast', 'loseBase'],
};

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, warm activity title for a grade 1-4 learner (e.g. 'Set Up the Story'). "
        + 'It MUST NOT contain any digits or number words.',
    },
    description: {
      type: Type.STRING,
      description:
        'One sentence telling the child they will build the number family and read it before '
        + 'working each story. Same rule: no digits, no number words.',
    },
    themes: {
      type: Type.ARRAY,
      description: `Exactly ${THEMES_TO_ASK} story themes, each about a different kind of thing.`,
      items: themeSchema,
    },
  },
  required: ['title', 'themes'],
};

const NUMBER_WORD_RE =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/i;
const leaksNumbers = (text: string): boolean => /\d/.test(text) || NUMBER_WORD_RE.test(text);

const DEFAULT_TITLE = 'Set Up the Story';
const DEFAULT_DESCRIPTION = 'Build the story as small + small = big, then solve it.';

const normalizeTheme = (raw: unknown): StoryTheme | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string): string => (typeof r[k] === 'string' ? (r[k] as string).trim() : '');
  const capName = (v: string): string => (v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v);
  const theme: StoryTheme = {
    nameA: capName(s('nameA')),
    nameB: capName(s('nameB')),
    nounPlural: s('nounPlural').toLowerCase(),
    gainPast: s('gainPast').toLowerCase(),
    gainBase: s('gainBase').toLowerCase(),
    losePast: s('losePast').toLowerCase(),
    loseBase: s('loseBase').toLowerCase(),
  };
  return themeUsable(theme) ? theme : null;
};

const framesOfShape = (shape: StoryShape): FrameId[] => FRAME_IDS.filter((f) => shapeOfFrame(f) === shape);

export const generateDiWordProblemSetup = async (
  topic: string,
  gradeLevel: string,
  // Always supplied by the registry wrapper (registerContextGenerator); the
  // canonical objective axis (ctx.intent / ctx.objectiveText / ctx.grade)
  // rides through here rather than the typed GenerationContext directly
  // because the stories are code-planned, not context-native content.
  ctx: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    targetEvalMode?: string;
    difficulty?: string;
    supportTier?: string;
    /** Canonical curriculum grade ('K' | '1'..'12') from the generation context. */
    grade?: string;
    [key: string]: unknown;
  },
): Promise<DiWordProblemSetupData> => {
  const intent = ctx.intent;
  let count = Math.min(
    MAX_PROBLEM_COUNT,
    Math.max(MIN_PROBLEM_COUNT, ctx.challengeCount ?? DEFAULT_PROBLEM_COUNT),
  );
  const grade = normalizeObjectiveGrade(ctx.grade) ?? normalizeObjectiveGrade(gradeLevel);

  const scopeText = `${intent ?? ''} ${ctx.objectiveText ?? ''} ${topic}`;
  const textScope = resolveTextScope(scopeText);

  // Which modes? An explicit pin wins; then the resolver over the objective;
  // then the text's own words. A broad/mixed run explicitly covers all modes.
  const resolution = await resolveEvalModes(
    'di-word-problem-setup',
    { targetEvalMode: ctx.targetEvalMode, intent, objectiveText: ctx.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const supportTier = supportForSingleDiMode(
    resolution,
    normalizeSupportTier(ctx.supportTier) ?? normalizeSupportTier(ctx.difficulty),
  );
  const allowed = (resolution?.allowedTypes as WordProblemChallengeType[] | undefined)
    ?.filter((t) => ALL_TYPES.includes(t)) ?? [];
  const modeTypes: WordProblemChallengeType[] = allowed.length > 0
    ? allowed
    : textScope.mode
      ? [textScope.mode]
      : [...ALL_TYPES];
  count = Math.min(MAX_PROBLEM_COUNT, Math.max(count, modeTypes.length));
  const representativeMode = modeTypes[0] ?? gradeDefaultMode(grade);

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let themes: StoryTheme[] = [];
  let refusedThemes = 0;

  const modePrompt = modeTypes.map((mode) => CHALLENGE_TYPE_DOCS[mode].promptDoc).join(' ');
  const prompt = `Scope a brisk Direct Instruction word-problem SETUP practice for a learner in ${gradeLevel}. This session uses ${modePrompt} The code writes every story and every number; you supply only the THEMES.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

RULES:
- Write exactly ${THEMES_TO_ASK} themes. Each: two different one-word first names, one plain plural noun a child collects or uses (stickers, marbles, shells, apples), a GAIN verb in past + base form (found / find), and a LOSS verb in past + base form (lost / lose). Every theme must use a DIFFERENT noun.
- Nouns are never numbers, sizes or groups (no dozen, pair, half, bunch, set). Verbs are plain gains and plain losses — never shared, traded, swapped, moved, counted, used.
- Names and nouns: letters only, one word. A verb may be two words ("gave away").
- Write a warm, short title and a one-sentence description. They MUST NOT contain any digits or number words — the child produces every number, never hears or sees one first.

Return the wrapper JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: wrapperSchema,
        temperature: 0.8,
        maxOutputTokens: 1024,
      },
    });
    const parsed = JSON.parse(response.text ?? '{}') as {
      title?: string; description?: string; themes?: unknown[];
    };
    if (parsed.title?.trim() && !leaksNumbers(parsed.title)) title = parsed.title.trim();
    if (parsed.description?.trim() && !leaksNumbers(parsed.description)) description = parsed.description.trim();
    const seenNouns = new Set<string>();
    for (const raw of parsed.themes ?? []) {
      const theme = normalizeTheme(raw);
      if (!theme || seenNouns.has(theme.nounPlural)) { refusedThemes++; continue; }
      seenNouns.add(theme.nounPlural);
      themes.push(theme);
    }
  } catch (error) {
    console.warn('[DiWordProblemSetup] wrapper generation failed — no themes, no problems:', error);
  }

  // ── Problems: code-owned frames + numbers over the usable themes ──────────
  reseedWordProblemPool(Date.now() ^ (Math.random() * 0x7fffffff));
  const specs: WordProblemProblemSpec[] = [];
  const maxNumber = textScope.maxNumber;
  if (themes.length > 0) {
    // Shapes round-robin (the text's named shapes first), one frame per story;
    // find_big_number leads with a frame whose big number is the UNKNOWN, so
    // "the biggest number I see" is a live wrong move on the first story.
    const preferred = textScope.shapes.length > 0 ? textScope.shapes : shuffleWithPool(STORY_SHAPES);
    const shapeCycle = [...preferred, ...STORY_SHAPES.filter((s) => !preferred.includes(s))];
    const usedPairs = new Set<string>();
    const usedFrames = new Set<FrameId>();
    themes = shuffleWithPool(themes);
    for (let i = 0; specs.length < count && i < count * 3; i++) {
      const mode = modeTypes[specs.length % modeTypes.length];
      const shape = shapeCycle[i % shapeCycle.length];
      const theme = themes[i % themes.length];
      let candidates = framesOfShape(shape).filter((f) => !usedFrames.has(f));
      if (candidates.length === 0) candidates = framesOfShape(shape);
      if (mode === 'find_big_number' && specs.length === 0) {
        const bigUnknown = candidates.filter((f) => BIG_UNKNOWN_FRAMES.includes(f));
        if (bigUnknown.length > 0) candidates = bigUnknown;
      }
      const frameId = shuffleWithPool(candidates)[0];
      const adjectivePair = Math.floor(Math.random() * PART_ADJECTIVE_PAIRS.length);
      const numbers = drawNumbersFor(frameId, theme, maxNumber, usedPairs, adjectivePair);
      if (!numbers) continue;
      usedPairs.add(`${numbers.first}-${numbers.second}`);
      usedFrames.add(frameId);
      specs.push({
        id: `wps-${specs.length + 1}-${frameId.replace(':', '-')}`,
        frameId,
        theme,
        first: numbers.first,
        second: numbers.second,
        adjectivePair,
        challengeType: mode,
        maxNumber,
        ...(supportTier ? { supportTier } : {}),
      });
    }
  }

  console.log('DI Word Problem Setup Generated:', {
    title,
    modes: `${modeTypes.join(', ')} (${resolution?.source ?? (textScope.mode ? 'text' : 'mixed')})`,
    maxNumber: `${maxNumber} [${maxNumber === 100 ? 'text' : 'default'}]`,
    tier: supportTier ?? 'none',
    themes: `${themes.length} usable / ${refusedThemes} refused`,
    problems: specs.map((s) => `${s.frameId} ${s.first},${s.second} [${s.theme.nounPlural}]`),
    count: specs.length,
  });

  return {
    title,
    description,
    challengeType: representativeMode,
    problems: specs,
    gradeLevel: gradeLevel || 'Grade 2',
  };
};
