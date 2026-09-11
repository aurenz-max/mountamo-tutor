/**
 * gemini-di-worked-procedure — generator for di-worked-procedure, the
 * talk-through subtraction pack. Fork A (pool service), the di-math-facts
 * discipline: the CONTENT is a code-owned problem pool scoped to the objective,
 * and the whole step chain (which columns regroup, what every column reads
 * after a lend, every difference) is planned in code. Gemini's only job is the
 * session wrapper (kid title + description) and a scope HINT used only when the
 * objective text does not pin the number range itself.
 *
 * SCOPE: the objective text is code-enforced over the model's pick. Named
 * problems ("52 - 28") win outright; then width words ("two-digit", "within
 * 100", "three-digit", "within 1000"); then the model's hint; then a grade
 * default (≤ G2 → two-digit, G3+ → three-digit). Whether the session regroups
 * is the EVAL MODE (subtract_no_regroup / subtract_regroup); the text can pin
 * it ("without regrouping") when no mode is pinned.
 *
 * SUPPORT TIER (L3) is composed into the cue by the script (`easy` states the
 * column digits). STRUCTURE rides the tier only where the width allows a real
 * lever: a three-digit regroup session goes from one regroup (easy/medium) to
 * two (hard). A two-digit problem can only regroup once, so it saturates
 * honestly (reported, never widened).
 *
 * KEEP-OR-DROP, NEVER BACKFILL: every drawn pair passes `planSubtraction`'s
 * gates (no zero column, no borrow across zero, flip ≠ result, same width) by
 * construction, and `itemsFromProblems` re-checks them on the way to the stage.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { resolveEvalModes } from '../evalMode';
import { normalizeObjectiveGrade } from '../generation/resolveGenerationContext';
import { supportForSingleDiMode } from '../../hooks/diModeContract';
import {
  clampShape,
  drawProblems,
  planSubtraction,
  reseedProblemPool,
  type ProblemShape,
} from '../../primitives/visual-primitives/direct-instruction/diWorkedProcedurePlan';
import type {
  DiWorkedProcedureData,
  WorkedProblemSpec,
} from '../../primitives/visual-primitives/direct-instruction/diWorkedProcedureScript';
import {
  DI_WORKED_PROCEDURE_CHALLENGE_TYPES,
  DI_WORKED_PROCEDURE_TYPE_DOCS,
  type WorkedProcedureChallengeType,
  type WorkedProcedureSupportTier,
} from '../../primitives/visual-primitives/direct-instruction/diWorkedProcedureModes';

const DEFAULT_PROBLEM_COUNT = 3;
const MIN_PROBLEM_COUNT = 2;
const MAX_PROBLEM_COUNT = 4;

const SUPPORT_TIERS: readonly WorkedProcedureSupportTier[] = ['easy', 'medium', 'hard'];
const normalizeSupportTier = (raw?: unknown): WorkedProcedureSupportTier | undefined => {
  const d = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as WorkedProcedureSupportTier) : undefined;
};

// ── Eval-mode routing (code stamps the mode; no schema enum exists) ──────────

export const CHALLENGE_TYPE_DOCS = DI_WORKED_PROCEDURE_TYPE_DOCS;
const ALL_TYPES: readonly WorkedProcedureChallengeType[] = DI_WORKED_PROCEDURE_CHALLENGE_TYPES;

// ── Scope from text (code-enforced over the model) ──────────────────────────

export interface WorkedScope {
  digits: 2 | 3 | null;
  regrouping: 'with' | 'without' | null;
  /** Problems named in the text, planned and gated. */
  named: Array<{ minuend: number; subtrahend: number }>;
}

export const resolveTextScope = (text: string): WorkedScope => {
  const t = text.toLowerCase();
  const digits: 2 | 3 | null =
    /\b(three|3)[- ]digit|within\s*1[,.]?000\b|\bhundreds\b/.test(t) ? 3
    : /\b(two|2)[- ]digit|within\s*100\b|tens and ones/.test(t) ? 2
    : null;
  const regrouping: 'with' | 'without' | null =
    /without\s+(regroup|borrow)|no\s+regroup|not\s+regroup|does not regroup/.test(t) ? 'without'
    : /regroup|borrow|trad(e|ing)|renam/.test(t) ? 'with'
    : null;
  const named: WorkedScope['named'] = [];
  for (const m of Array.from(t.matchAll(/(\d{2,3})\s*[-−–]\s*(\d{2,3})/g))) {
    const minuend = parseInt(m[1], 10);
    const subtrahend = parseInt(m[2], 10);
    if (planSubtraction(minuend, subtrahend)) named.push({ minuend, subtrahend });
  }
  return { digits, regrouping, named };
};

const gradeDefaultDigits = (grade: string | undefined): 2 | 3 => {
  if (!grade || grade === 'K') return 2;
  const n = parseInt(grade, 10);
  return Number.isFinite(n) && n >= 3 ? 3 : 2;
};

/** The structural shape for one problem of one mode at one tier. */
export const shapeFor = (
  type: WorkedProcedureChallengeType,
  digits: 2 | 3,
  tier: WorkedProcedureSupportTier | undefined,
): ProblemShape => clampShape({
  digits,
  regroups: type === 'subtract_no_regroup' ? 0 : digits === 3 && tier === 'hard' ? 2 : 1,
});

// ── The wrapper (the only thing Gemini writes) ───────────────────────────────

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, warm activity title for a grade 2-4 learner (e.g. 'Talk It Through'). "
        + 'It MUST NOT contain any digits or number words.',
    },
    description: {
      type: Type.STRING,
      description:
        'One sentence telling the child they will say each subtraction step out loud, one column at a '
        + 'time. Same rule: no digits, no number words.',
    },
    digits: {
      type: Type.STRING,
      enum: ['two_digit', 'three_digit'],
      description:
        "Your read of the objective's number range: two-digit numbers (within 100) or three-digit "
        + 'numbers (within 1000). Used only when the objective text does not pin one itself.',
    },
  },
  required: ['title', 'digits'],
};

const NUMBER_WORD_RE =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/i;
const leaksNumbers = (text: string): boolean => /\d/.test(text) || NUMBER_WORD_RE.test(text);

const DEFAULT_TITLE = 'Talk It Through';
const DEFAULT_DESCRIPTION = 'Say each step out loud, one column at a time.';

export const generateDiWorkedProcedure = async (
  topic: string,
  gradeLevel: string,
  // Always supplied by the registry wrapper (registerContextGenerator); the
  // canonical objective axis (ctx.intent / ctx.objectiveText / ctx.grade)
  // rides through here rather than the typed GenerationContext directly
  // because the step chain is code-planned, not context-native content.
  ctx: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    targetEvalMode?: string;
    /** Per-component support tier from the manifest. */
    difficulty?: string;
    supportTier?: string;
    /** Canonical curriculum grade ('K' | '1'..'12') from the generation context. */
    grade?: string;
    [key: string]: unknown;
  },
): Promise<DiWorkedProcedureData> => {
  const intent = ctx.intent;
  const count = Math.min(
    MAX_PROBLEM_COUNT,
    Math.max(MIN_PROBLEM_COUNT, ctx.challengeCount ?? DEFAULT_PROBLEM_COUNT),
  );
  const requestedSupportTier = normalizeSupportTier(ctx.supportTier) ?? normalizeSupportTier(ctx.difficulty);
  const grade = normalizeObjectiveGrade(ctx.grade) ?? normalizeObjectiveGrade(gradeLevel);

  const scopeText = `${intent ?? ''} ${ctx.objectiveText ?? ''} ${topic}`;
  const textScope = resolveTextScope(scopeText);

  // Which mode(s)? An explicit pin wins; then the text's own regrouping word;
  // then the resolver over the objective; mixed = both, regroup first.
  const resolution = await resolveEvalModes(
    'di-worked-procedure',
    { targetEvalMode: ctx.targetEvalMode, intent, objectiveText: ctx.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const supportTier = supportForSingleDiMode(resolution, requestedSupportTier);
  let modeTypes: WorkedProcedureChallengeType[] =
    (resolution?.allowedTypes as WorkedProcedureChallengeType[] | undefined) ?? [];
  if (modeTypes.length === 0) {
    modeTypes = textScope.regrouping === 'without'
      ? ['subtract_no_regroup']
      : textScope.regrouping === 'with'
        ? ['subtract_regroup']
        : [...ALL_TYPES];
  }

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let modelDigits: 2 | 3 | null = null;

  const prompt = `Scope a brisk Direct Instruction talk-through subtraction practice (the problem is printed in columns; the child SAYS what they do in each column, out loud) for a learner in ${gradeLevel}.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

RULES:
- Read the objective and pick the number range: 'two_digit' (numbers within 100) or 'three_digit' (numbers within 1000). A generic objective for grade 1 or 2 means 'two_digit'; grade 3 and up means 'three_digit'.
- Write a warm, short title and a one-sentence description. They MUST NOT contain any digits or number words — the child produces every number, never hears or sees one first.

Return the wrapper JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: wrapperSchema,
        temperature: 0.6,
        maxOutputTokens: 512,
      },
    });
    const parsed = JSON.parse(response.text ?? '{}') as {
      title?: string; description?: string; digits?: string;
    };
    if (parsed.title?.trim() && !leaksNumbers(parsed.title)) title = parsed.title.trim();
    if (parsed.description?.trim() && !leaksNumbers(parsed.description)) description = parsed.description.trim();
    modelDigits = parsed.digits === 'three_digit' ? 3 : parsed.digits === 'two_digit' ? 2 : null;
  } catch (error) {
    console.warn('[DiWorkedProcedure] wrapper generation failed — defaults stand:', error);
  }

  const digits: 2 | 3 = textScope.digits ?? modelDigits ?? gradeDefaultDigits(grade);

  // ── Problems: named first, then drawn per mode (code-owned pool) ──────────
  reseedProblemPool(Date.now() ^ (Math.random() * 0x7fffffff));
  const specs: WorkedProblemSpec[] = [];
  const stamp = (pair: { minuend: number; subtrahend: number }, type: WorkedProcedureChallengeType): WorkedProblemSpec => ({
    id: `wp-${specs.length + 1}-${pair.minuend}-${pair.subtrahend}`,
    minuend: pair.minuend,
    subtrahend: pair.subtrahend,
    challengeType: type,
    ...(supportTier ? { supportTier } : {}),
  });

  for (const pair of textScope.named.slice(0, count)) {
    const plan = planSubtraction(pair.minuend, pair.subtrahend)!;
    const type: WorkedProcedureChallengeType = plan.regroupCount > 0 ? 'subtract_regroup' : 'subtract_no_regroup';
    if (!modeTypes.includes(type)) continue; // a named problem that contradicts the pinned mode is dropped
    specs.push(stamp(pair, type));
  }

  const remaining = count - specs.length;
  if (remaining > 0) {
    // Round-robin across the session's modes so a mixed session alternates.
    const perMode = modeTypes.map((type) => ({
      type,
      pool: drawProblems(shapeFor(type, digits, supportTier), remaining),
    }));
    let round = 0;
    while (specs.length < count) {
      let placed = false;
      for (const { type, pool } of perMode) {
        const pair = pool[round];
        if (!pair || specs.length >= count) continue;
        specs.push(stamp(pair, type));
        placed = true;
      }
      if (!placed) break;
      round++;
    }
  }

  const primaryType: WorkedProcedureChallengeType = specs[0]?.challengeType ?? modeTypes[0];

  const shape = shapeFor('subtract_regroup', digits, supportTier);
  console.log('DI Worked Procedure Generated:', {
    title,
    modes: resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : modeTypes.join('+'),
    digits: `${digits}-digit [${textScope.digits ? 'text' : modelDigits ? 'model' : `grade ${grade ?? '?'} default`}]`,
    tier: supportTier ?? 'none',
    structural: supportTier === 'hard' && digits === 2
      ? 'hard saturates at one regroup in two digits'
      : `${shape.regroups} regroup(s) per regroup problem`,
    problems: specs.map((s) => `${s.minuend} - ${s.subtrahend} [${s.challengeType}]`),
    named: textScope.named.length,
    count: specs.length,
  });

  return {
    title,
    description,
    challengeType: primaryType,
    problems: specs,
    gradeLevel: gradeLevel || 'Grade 2',
  };
};
