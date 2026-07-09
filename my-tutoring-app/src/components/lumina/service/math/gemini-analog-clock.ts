import { Type, Schema } from "@google/genai";
import { AnalogClockData } from "../../primitives/visual-primitives/math/AnalogClock";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { buildScopePromptSection } from "../scopeContext";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  read: {
    promptDoc:
      `"read": Student reads an analog clock face and picks the correct time from 4 options. `
      + `Provide only targetHour and targetMinute (the time on the dial) — the system builds the 4 options and marks the correct one. Do NOT author options.`,
    schemaDescription: "'read' (read analog clock face)",
  },
  set_time: {
    promptDoc:
      `"set_time": Student drags clock hands to show a given time. `
      + `Only targetHour and targetMinute are needed — no MC options. `
      + `Instruction tells the student what time to set (e.g., "Set the clock to 3:15").`,
    schemaDescription: "'set_time' (set clock hands to target time)",
  },
  match: {
    promptDoc:
      `"match": Student matches an analog clock face to the correct digital time from 4 options. `
      + `Provide only targetHour and targetMinute (the time on the dial) — the system builds the 4 options and marks the correct one. Do NOT author options.`,
    schemaDescription: "'match' (match analog to digital time)",
  },
  elapsed: {
    promptDoc:
      `"elapsed": Student watches a stopwatch and determines elapsed time. `
      + `Set startHour/startMinute for the starting time and targetHour/targetMinute for the ending time (the system computes elapsed = end − start, builds the 4 duration options, and marks the correct one — do NOT author options). `
      + `Include elapsedDescription (e.g., "30 minutes later") for flavor.`,
    schemaDescription: "'elapsed' (determine elapsed time)",
  },
};

type ChallengeType = 'read' | 'set_time' | 'match' | 'elapsed';

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract: config.targetEvalMode says WHICH skill (task identity,
// matched to the objective by the manifest); config.difficulty says how much
// on-clock SUPPORT the student gets while reading/setting time ('easy' = max
// scaffolding, 'hard' = bare dial). The tier NEVER changes the time value — the
// eval mode + grade-band granularity own that. A harder tier means fewer reading
// aids (minute-tick numbers, hand-color legend, digital echo), never a different
// time. See memory: structural-difficulty-not-numeric.

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** Number labels (0,5,10..55) at the minute-tick positions around the dial —
   *  offloads "what minute does the hand point to?". Strongest reading aid. */
  showMinuteNumbers: boolean;
  /** Hand-color legend ("blue = hour, white = minute") so the student doesn't
   *  have to recall which hand is which. */
  showHandLegend: boolean;
  /** Live digital echo of the displayed time. ANSWER-LEAK on read/match/elapsed
   *  (the displayed/elapsed time IS the asked answer there), so it is ONLY ever
   *  enabled on set_time, where the TARGET time is given and the echo is a
   *  self-check toward it — never the answer. Guarded per-mode in resolve. */
  showDigitalEcho: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-clock reading-support structure for a tier on a pinned mode.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * "what time is it / set this time" task with fewer reading aids — never a
 * different time, never crossing grade-band granularity.
 *
 * Digital-echo answer-leak guard: the echo is the time readout. On read/match
 * the displayed time is the answer; on elapsed the duration is the answer (and
 * the stopwatch already shows live). So the echo is enabled ONLY on set_time —
 * and only at easy — where the asked answer is the TARGET the student is told to
 * reach, so a readout of the *current* hand position is a legitimate self-check.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const showMinuteNumbers = tier === 'easy';
  const showHandLegend = tier !== 'hard';
  // ANSWER-LEAK guard: echo only on set_time (target given), and only at easy.
  const showDigitalEcho = pinnedType === 'set_time' && tier === 'easy';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-clock READING SUPPORT only (${tier === 'easy' ? 'maximum support: minute-position numbers and a hand-color legend help the student read the dial' : tier === 'medium' ? 'moderate support: only the hand-color legend remains; the student reads the minute position themselves' : 'minimum support: a bare dial — the student reads hand positions unaided and explains what they see'}). The TIME VALUE never changes by tier — keep it on the grade-band granularity and within the eval mode. A harder tier removes reading AIDS, never changes the time.`,
  ];
  switch (pinnedType) {
    case 'read':
    case 'match':
      promptLines.push(
        tier === 'easy'
          ? 'The dial shows numbered minute marks and a hand legend; hints may name which hand to read first (short = hour) but never state the time.'
          : tier === 'hard'
            ? 'The dial is bare (no minute numbers, no legend); hints should ask the student to describe where each hand points and reason out the time, never naming it.'
            : 'The dial keeps the hand legend but drops the minute numbers; hints point to a hand position rather than naming the time.',
      );
      break;
    case 'set_time':
      promptLines.push(
        tier === 'easy'
          ? 'The student is told the TARGET time; numbered minute marks, a hand legend, and a digital echo of the current hand position help them check their progress toward the target (the echo shows what they have set, not the answer — the answer was given).'
          : tier === 'hard'
            ? 'Bare dial, no digital echo: the student must judge the hand positions against the target by eye and explain how they know they have it right.'
            : 'Keep the hand legend but drop the minute numbers and the digital echo; the student aligns the hands to the target using the dial alone.',
      );
      break;
    case 'elapsed':
      promptLines.push(
        tier === 'easy'
          ? 'Numbered minute marks and a hand legend help the student read the start and end positions; the duration itself is never stated.'
          : tier === 'hard'
            ? 'Bare dial; the student reads start and end positions and reasons out the elapsed duration unaided.'
            : 'Keep the hand legend but drop the minute numbers; the student reads the positions to find the duration.',
      );
      break;
  }
  return { showMinuteNumbers, showHandLegend, showDigitalEcho, promptLines };
}

// ---------------------------------------------------------------------------
// Deterministic MC synthesis (POST-PROCESS-DERIVE — AC-1)
// ---------------------------------------------------------------------------
// The LLM cannot reliably author 4 well-formed, non-leaking MC options with a
// correct index: flash-lite drops the nullable option fields (SP-14), and its
// free-text elapsed-duration strings defeat any substring match (e.g. "5 minutes"
// ⊂ "45 minutes"). So the SYSTEM owns the options — we compute the correct answer
// from the time values the LLM chose, synthesize [correct + 3 distractors] in ONE
// canonical format, shuffle, and set correctOptionIndex to the correct slot.
// Always emits exactly 4 options → the component's getOptions() filter never drops
// a slot, so the rendered indices can never desync from correctOptionIndex.

/** "H:MM" — mirrors the component's formatTime (hour normalized to 1–12). */
function formatClockTime(hour: number, minute: number): string {
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:${String(minute).padStart(2, '0')}`;
}

/** Canonical elapsed-duration phrasing — used for BOTH the correct option and the
 *  distractors so the correct answer can't be spotted by format. */
function formatDuration(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h} hour${h > 1 ? 's' : ''} ${m} minute${m > 1 ? 's' : ''}`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${m} minute${m > 1 ? 's' : ''}`;
}

/** Grade-band minute granularity — distractors stay on the same grid as the answer
 *  so the correct time isn't the only "clean" value on the dial. */
function allowedMinutesFor(gradeBand: string): number[] {
  if (gradeBand === 'K') return [0, 30];
  if (gradeBand === '1-2') return [0, 15, 30, 45];
  return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
}

/** Shift an hour by ±n keeping it in the 1–12 range. */
function shiftHour(hour: number, delta: number): number {
  return ((hour - 1 + delta) % 12 + 12) % 12 + 1;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 3 plausible wrong "H:MM" times, distinct from the correct time and each other. */
function buildTimeDistractors(targetHour: number, targetMinute: number, gradeBand: string): string[] {
  const correct = formatClockTime(targetHour, targetMinute);
  const minutes = allowedMinutesFor(gradeBand);
  const hours = [targetHour, shiftHour(targetHour, 1), shiftHour(targetHour, -1), shiftHour(targetHour, 2), shiftHour(targetHour, -2)];
  const pool = new Set<string>();
  for (const h of hours) {
    for (const m of minutes) {
      const s = formatClockTime(h, m);
      if (s !== correct) pool.add(s);
    }
  }
  return shuffleInPlace(Array.from(pool)).slice(0, 3);
}

/** 3 plausible wrong elapsed durations, distinct from the correct duration. */
function buildDurationDistractors(elapsedMins: number): string[] {
  const correct = formatDuration(elapsedMins);
  const seen = new Set<string>([correct]);
  const out: string[] = [];
  const offsets = [15, 30, 45, 60, 90, -15, -30, -60, 120, 180];
  for (const off of shuffleInPlace([...offsets])) {
    const v = elapsedMins + off;
    if (v <= 0) continue;
    const s = formatDuration(v);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
    if (out.length === 3) break;
  }
  // Defensive fill — the offset pool is always large enough in practice.
  let mult = 1;
  while (out.length < 3 && mult <= 6) {
    const s = formatDuration(elapsedMins + 60 * mult++);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out.slice(0, 3);
}

/** Synthesize option0-3 + correctOptionIndex on a read/match/elapsed challenge,
 *  DISCARDING any options the LLM produced. Correct-by-construction: no dropped
 *  fields, no string matching. */
function synthesizeMCOptions(
  ch: {
    type: string;
    targetHour: number;
    targetMinute: number;
    startHour?: number;
    startMinute?: number;
    option0?: string;
    option1?: string;
    option2?: string;
    option3?: string;
    correctOptionIndex?: number;
  },
  gradeBand: string,
): void {
  let correctStr: string;
  let distractors: string[];

  if (ch.type === 'elapsed') {
    const sH = ch.startHour ?? ch.targetHour;
    const sM = ch.startMinute ?? 0;
    const startTotal = (sH % 12) * 60 + sM;
    let endTotal = (ch.targetHour % 12) * 60 + ch.targetMinute;
    if (endTotal <= startTotal) endTotal += 720; // crossed 12
    const elapsedMins = endTotal - startTotal;
    correctStr = formatDuration(elapsedMins);
    distractors = buildDurationDistractors(elapsedMins);
  } else {
    // read / match — the answer is the time shown on the dial
    correctStr = formatClockTime(ch.targetHour, ch.targetMinute);
    distractors = buildTimeDistractors(ch.targetHour, ch.targetMinute, gradeBand);
  }

  const options = shuffleInPlace([correctStr, ...distractors]);
  ch.option0 = options[0];
  ch.option1 = options[1];
  ch.option2 = options[2];
  ch.option3 = options[3];
  ch.correctOptionIndex = options.indexOf(correctStr);
}

// ---------------------------------------------------------------------------
// Gemini JSON schema
// ---------------------------------------------------------------------------

const analogClockSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the clock activity (e.g., 'Reading the Clock', 'What Time Is It?')",
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn",
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1-2' for Grades 1-2, '3-5' for Grades 3-5",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')",
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'read' (read analog clock face), 'set_time' (set clock hands to target time), 'match' (match analog to digital time), 'elapsed' (determine elapsed time)",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction. Do NOT reveal the answer in the text.",
          },
          targetHour: {
            type: Type.NUMBER,
            description: "Target hour (1-12)",
          },
          targetMinute: {
            type: Type.NUMBER,
            description: "Target minute (0-59)",
          },
          // NOTE: option0-3 and correctOptionIndex are intentionally NOT in this
          // schema. The system synthesizes the 4 MC options and the correct index
          // deterministically from the time values (see synthesizeMCOptions). Asking
          // flash-lite for them caused dropped fields (SP-14) and substring-match
          // desync (AC-1).
          startHour: {
            type: Type.NUMBER,
            description: "Starting hour for elapsed-time challenges (1-12)",
          },
          startMinute: {
            type: Type.NUMBER,
            description: "Starting minute for elapsed-time challenges (0-59)",
          },
          elapsedDescription: {
            type: Type.STRING,
            description: "Description of elapsed time (e.g., '30 minutes later')",
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after incorrect attempts",
          },
        },
        required: ["id", "type", "instruction", "targetHour", "targetMinute", "hint"],
      },
      description: "Array of 4-6 progressive challenges",
    },
  },
  required: ["title", "challenges", "gradeBand"],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type AnalogClockConfig = {
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-clock reading scaffolding within it. NEVER changes
   * the time value (eval-mode/grade-band axis owns that).
   */
  difficulty?: string;
};

export const generateAnalogClock = async (
  ctx: GenerationContext,
): Promise<AnalogClockData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const config = ctx.raw as AnalogClockConfig;
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'analog-clock',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier (only meaningful within ONE pinned mode for the
  // prompt tone; the deterministic application at the end runs per challenge). ──
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (reading-aid level — NOT time value)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(analogClockSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : analogClockSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational analog clock activity for teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
CONTEXT:
- Students learn to read analog clocks, set times, match analog to digital, and calculate elapsed time
- The analog clock has an hour hand and a minute hand on a 12-hour face
- Key skills: telling time, understanding hour/minute relationship, elapsed time

${challengeTypeSection}
${tierSection}
GRADE-LEVEL TIME GRANULARITY (CRITICAL):
- Kindergarten (gradeBand "K"): ONLY use :00 (on the hour) and :30 (half-hour). targetMinute must be 0 or 30.
- Grades 1-2 (gradeBand "1-2"): Use :00, :15, :30, :45 (quarter-hour intervals). targetMinute must be 0, 15, 30, or 45.
- Grades 3-5 (gradeBand "3-5"): Use 5-minute intervals. targetMinute must be a multiple of 5 (0, 5, 10, 15, ..., 55).

CHALLENGE TYPE RULES:
- "read" and "match": Provide ONLY targetHour and targetMinute (the time on the dial). The system synthesizes the 4 MC options and the correct index — do NOT author options.
- "set_time": Only needs targetHour, targetMinute, and instruction. No MC options needed.
- "elapsed": Set startHour/startMinute and targetHour/targetMinute (the end time). Include elapsedDescription. The system computes elapsed = end − start and synthesizes the 4 duration options and the correct index — do NOT author options.

CRITICAL RULES:
1. Generate 4-6 challenges that progress in difficulty
2. Do NOT reveal the answer in the instruction text
3. Do NOT author multiple-choice options — the system builds them deterministically from your time values. Just choose good, grade-appropriate times.
4. targetHour must be 1-12, targetMinute must be 0-59
5. Use warm, age-appropriate language
6. Include helpful hints that guide without giving the answer
7. Vary the hours used across challenges — do not repeat the same hour

Return the complete analog clock configuration.
`;

  logEvalModeResolution('AnalogClock', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid analog clock data returned from Gemini API');
  }

  // ── Validation & defaults ──

  // gradeBand
  if (data.gradeBand !== 'K' && data.gradeBand !== '1-2' && data.gradeBand !== '3-5') {
    const gl = gradeLevel.toLowerCase();
    if (gl.includes('kinder') || gl.includes('k')) data.gradeBand = 'K';
    else if (gl.includes('1') || gl.includes('2')) data.gradeBand = '1-2';
    else data.gradeBand = '3-5';
  }

  // Filter to valid challenge types
  const validTypes = ['read', 'set_time', 'match', 'elapsed'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type),
  );

  // Validate each challenge
  for (const ch of data.challenges as Array<{
    type: string;
    targetHour: number;
    targetMinute: number;
    startHour?: number;
    startMinute?: number;
    correctOptionIndex?: number;
    option0?: string;
    option1?: string;
    option2?: string;
    option3?: string;
    hint?: string;
  }>) {
    // Clamp targetHour to 1-12
    if (ch.targetHour < 1 || ch.targetHour > 12 || !Number.isInteger(ch.targetHour)) {
      ch.targetHour = Math.max(1, Math.min(12, Math.round(ch.targetHour || 12)));
    }
    // Clamp targetMinute to 0-59
    if (ch.targetMinute < 0 || ch.targetMinute > 59 || !Number.isInteger(ch.targetMinute)) {
      ch.targetMinute = Math.max(0, Math.min(59, Math.round(ch.targetMinute || 0)));
    }

    // Validate elapsed-specific fields
    if (ch.type === 'elapsed') {
      if (ch.startHour != null) {
        ch.startHour = Math.max(1, Math.min(12, Math.round(ch.startHour)));
      }
      if (ch.startMinute != null) {
        ch.startMinute = Math.max(0, Math.min(59, Math.round(ch.startMinute)));
      }
    }

    // MC options + correctOptionIndex are synthesized deterministically below
    // (synthesizeMCOptions), AFTER the fallback so real and fallback challenges
    // are handled uniformly. No string matching, no trust in LLM option fields.

    // Ensure hint exists
    if (!ch.hint) {
      ch.hint = 'Look carefully at where the hour and minute hands are pointing.';
    }
  }

  // ── Fallback if empty ── (options synthesized by the pass below, not hardcoded)
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'read';
    console.log(`[AnalogClock] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{
      id: 'c1',
      type: fallbackType,
      instruction: fallbackType === 'set_time'
        ? 'Set the clock to 3:00!'
        : 'What time does the clock show?',
      targetHour: 3,
      targetMinute: 0,
      hint: 'Look at the short hand first — it points to the hour.',
    }];
  }

  // ── Synthesize MC options + correctOptionIndex for every read/match/elapsed
  // challenge (real or fallback). System owns the options — see synthesizeMCOptions. ──
  for (const ch of data.challenges as Array<{
    type: string;
    targetHour: number;
    targetMinute: number;
    startHour?: number;
    startMinute?: number;
    option0?: string;
    option1?: string;
    option2?: string;
    option3?: string;
    correctOptionIndex?: number;
  }>) {
    if (ch.type === 'read' || ch.type === 'match' || ch.type === 'elapsed') {
      synthesizeMCOptions(ch, data.gradeBand);
    }
  }

  // ── Apply the within-mode support tier deterministically (reading-aids only;
  // code owns the SUPPORT structure, the LLM only chose the time values). Runs
  // PER CHALLENGE, gated only on a tier being present (a blended session must get
  // it too) — each challenge resolves its scaffold from its OWN mode (ch.type).
  // NEVER touches targetHour/targetMinute/options/correctOptionIndex, so the
  // checker (which compares the student's answer to the time value) is untouched
  // and the digital echo can only appear where it is not the answer. ──
  if (supportTier) {
    for (const ch of data.challenges as Array<{
      type: ChallengeType;
      showMinuteNumbers?: boolean;
      showHandLegend?: boolean;
      showDigitalEcho?: boolean;
      supportTier?: SupportTier;
    }>) {
      const sc = resolveSupportStructure(ch.type, supportTier); // per-challenge, mode-correct
      ch.showMinuteNumbers = sc.showMinuteNumbers;
      ch.showHandLegend = sc.showHandLegend;
      // ANSWER-LEAK guard lives inside resolveSupportStructure: showDigitalEcho is
      // already false for every mode except set_time, so this never leaks the
      // read/match/elapsed answer regardless of tier.
      ch.showDigitalEcho = sc.showDigitalEcho;
      ch.supportTier = supportTier;
    }
    console.log(
      `[AnalogClock] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
    );
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map(c => c.type).join(', ');
  console.log(`[AnalogClock] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
