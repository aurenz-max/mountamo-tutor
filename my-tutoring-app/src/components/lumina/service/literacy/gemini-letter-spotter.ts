import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { LetterSpotterData } from "../../primitives/visual-primitives/literacy/LetterSpotter";
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
  'name-it': {
    promptDoc:
      `"name-it" (Sentence Spotter): Student sees a short sentence where one letter in a key word is replaced by an emoji. `
      + `The AI reads the full sentence aloud. Student must figure out which letter the emoji replaced. `
      + `REQUIRED fields for name-it: sentence, emoji, targetWord, options. `
      + `Example: targetLetter "s", targetWord "sun", emoji "⭐", sentence "The ⭐un is bright.", options ["s","t","n","p"]. `
      + `The emoji MUST replace exactly ONE occurrence of the targetLetter in the targetWord within the sentence. `
      + `Use fun, varied emojis (⭐🌟🔮💎🎯🎪🦋🌈🎨🌺). Each challenge should use a different emoji. `
      + `Sentences should be simple, 4-7 words, age-appropriate for K-2. `
      + `The targetLetter should appear at the START of the targetWord for clarity (e.g., "⭐un" not "bu⭐"). `
      + `2-3 challenges per session. Do NOT include letterGrid or targetCount for this mode.`,
    schemaDescription: "'name-it' (sentence spotter — find missing letter)",
  },
  'find-it': {
    promptDoc:
      `"find-it": Student hears a letter name and finds all instances in a 4x4 grid of 16 uppercase letters. `
      + `2-3 challenges per session. Grid contains 2-3 instances of the target mixed with distractors. `
      + `targetCase must be "uppercase". Do NOT include options for this mode.`,
    schemaDescription: "'find-it' (locate letter in grid)",
  },
  'match-it': {
    promptDoc:
      `"match-it": Student sees an uppercase letter and matches it to the correct lowercase form from 4 options. `
      + `2-3 challenges per session. Distractors are visually similar lowercase letters (e.g., b/d, p/q, m/n). `
      + `targetCase must be "uppercase". Do NOT include letterGrid or targetCount for this mode.`,
    schemaDescription: "'match-it' (match uppercase to lowercase)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level, NOT letters
// ---------------------------------------------------------------------------
// Two-field contract: config.targetEvalMode = WHICH recognition task (task
// identity, matched to the objective by the manifest); config.difficulty drives
// TWO axes within that task: (1) how much on-card SUPPORT the student gets
// (withdraw a strategy cue / reference letter / option scaffolding), and (2) the
// problem's STRUCTURE — how visually confusable the DISTRACTORS are (far → near
// letterforms; b/d/p/q at hard). Neither axis ever changes the target letter,
// the letter scope/group, or which answer is correct — only the wrong choices
// (and which letters fill the grid's non-target cells) shift. The answer is
// always recomputed from the rewritten data. See memory: structural-difficulty-not-numeric.

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

type LetterMode = 'name-it' | 'find-it' | 'match-it';

// ---------------------------------------------------------------------------
// Bespoke support scaffold — ONE field per discovered lever. Each lever only
// WITHDRAWS on-card help; none touches targetLetter / options-correctness / grid.
// ---------------------------------------------------------------------------

interface LetterSpotterSupportScaffold {
  /** #2 instruction-as-scaffold: a one-line strategy cue shown on the card.
   *  null = withdrawn (hard) — the student picks an approach unaided. */
  strategyHint: string | null;
  /** #1 perception (find-it only): show the target letter on-card as a self-check
   *  reference. Never reveals which cells. false at hard (audio only). */
  showTargetReference: boolean;
  /** #5 answer-form (name-it / match-it): how many letter options to present.
   *  Fewer distractors = more support. The correct answer is ALWAYS retained
   *  (answer-bearing guard); only distractors are trimmed/kept. */
  optionCount: number;
  promptLines: string[];
}

/** Per-mode strategy cue text, authored per tier. Never names the target letter. */
function strategyText(mode: LetterMode): string {
  switch (mode) {
    case 'name-it':
      return 'Say the whole sentence out loud and listen for the sound the emoji is hiding.';
    case 'find-it':
      return 'Scan the grid row by row, left to right, so you do not skip any.';
    case 'match-it':
      return 'Picture how the big letter looks small — does its shape stay the same or flip?';
  }
}

/** TRUTHFUL guardrail shared by BOTH axes. Tier changes problem STRUCTURE
 *  (distractor letterform similarity — how confusable the wrong choices are)
 *  and on-card help — NEVER the letter scope, the target letter, or which
 *  answer is correct. Magnitude (the letter group + grade band) is owned by
 *  the eval mode; the tier never reaches past it. */
const TIER_GUARDRAIL =
  'This tier changes problem STRUCTURE (how visually confusable the wrong choices are — '
  + 'far vs. near letterforms) and on-screen help — NOT the letter scope or which answer is correct. '
  + 'Every letter still comes from the cumulative group; never add letters outside it, and never '
  + 'just "use harder letters". The target letter and the correct answer are unchanged.';

/**
 * Resolve the on-card support structure for a tier on a pinned (or per-challenge)
 * mode. Support is withdrawn as the tier hardens; the lines reframe the SAME task
 * with less help — never a different task, never different letters.
 */
function resolveSupportStructure(mode: LetterMode, tier: SupportTier): LetterSpotterSupportScaffold {
  const strategyHint = tier === 'hard' ? null : strategyText(mode);
  const showTargetReference = mode === 'find-it' && tier !== 'hard';
  // Option count is the answer-form lever for the option modes. find-it has no
  // options, so it ignores this. easy = fewest distractors, hard = most.
  const optionCount = tier === 'easy' ? 3 : tier === 'medium' ? 4 : 4;

  const lead =
    `Support tier "${tier}" sets on-card SCAFFOLDING only — it NEVER changes the target letter, `
    + `the grid, the sentence, or which answer is correct. A harder tier just gives less help.`;

  const lines: string[] = [lead];
  switch (mode) {
    case 'name-it':
      lines.push(
        tier === 'easy'
          ? 'A short strategy cue ("say the sentence, listen for the missing sound") is shown, and only a few options appear so the choice is focused.'
          : tier === 'hard'
            ? 'No strategy cue is shown; the student decides how to find the missing letter and justifies it from the sound of the sentence.'
            : 'A light strategy cue is shown; the student works through the sentence themselves.',
      );
      break;
    case 'find-it':
      lines.push(
        tier === 'easy'
          ? 'The target letter is shown on-card as a reference to self-check against, plus a "scan row by row" cue — but the student still must locate every instance.'
          : tier === 'hard'
            ? 'No on-card target reference and no scan cue: the student holds the letter from the audio alone and explains how they searched the grid.'
            : 'The on-card target reference is shown, but no scan cue — the student organizes their own search.',
      );
      break;
    case 'match-it':
      lines.push(
        tier === 'easy'
          ? 'A shape-strategy cue is shown and only a few options appear so the match is focused.'
          : tier === 'hard'
            ? 'No strategy cue; the student reasons about the letter shape unaided across the full set of options.'
            : 'A light shape cue is shown; the student compares the options themselves.',
      );
      break;
  }
  lines.push('Keep the title and challenge text neutral — never state the support level or name the answer.');
  return { strategyHint, showTargetReference, optionCount, promptLines: lines };
}

// ---------------------------------------------------------------------------
// SECOND AXIS — Structural problem difficulty (config.difficulty, same dial).
//
// Recognition-card lever: DISTRACTOR LETTERFORM SIMILARITY (far → near).
// easy = wrong choices look nothing like the target (low discrimination load);
// hard = wrong choices are near-confusable letterforms (b/d/p/q, m/n/u, …) so
// the student must truly DISCRIMINATE the shape. This changes problem SHAPE,
// never magnitude: the target letter, the letter group, and the correct answer
// are unchanged — only WHICH cumulative-group letters fill the distractor slots
// shifts along the similarity axis. It never turns one eval mode into another.
//
// Floor (per mode): the distractors are always REAL letters from the cumulative
// group and the answer is always present — easy is still a genuine discrimination
// task, just an easy one. find-it always keeps its ≥1 target instances (the mode
// identity). Band cap: distractors are drawn ONLY from the cumulative group, so
// the lever can never inflate scope; when the group offers few near-confusables
// of the target (e.g. Group 1) the hard tier SATURATES at the nearest available.
// ---------------------------------------------------------------------------

/** How structurally confusable distractors should be at this tier. */
type SimilarityTarget = 'far' | 'mixed' | 'near';

/** Confusability clusters — letterforms students routinely mix up. Membership is
 *  by visual shape (case-insensitive on the lowercase letter). A distractor inside
 *  the target's cluster is "near"; one outside is "far". Mirror/rotation pairs
 *  (b/d/p/q) are the densest cluster — the hardest discrimination. */
const CONFUSABLE_CLUSTERS: string[][] = [
  ['b', 'd', 'p', 'q', 'g'], // mirror / rotation family (densest)
  ['m', 'n', 'h', 'r', 'u'], // hump / stem family
  ['i', 'l', 't', 'j', 'f'], // tall-thin / dotted family
  ['c', 'e', 'o', 'a', 's'], // round / open family
  ['v', 'w', 'y', 'x', 'z', 'k'], // angular family
];

/** Map each letter to the set of its cluster-mates (excluding itself). */
const CLUSTER_MATES: Record<string, Set<string>> = (() => {
  const m: Record<string, Set<string>> = {};
  for (const cluster of CONFUSABLE_CLUSTERS) {
    for (const ch of cluster) {
      m[ch] = m[ch] ?? new Set<string>();
      for (const other of cluster) if (other !== ch) m[ch].add(other);
    }
  }
  return m;
})();

/** Similarity distance: 0 = same cluster (near/confusable), 1 = different cluster (far). */
function similarityDistance(target: string, candidate: string): 0 | 1 {
  const t = target.toLowerCase();
  const c = candidate.toLowerCase();
  return CLUSTER_MATES[t]?.has(c) ? 0 : 1;
}

interface LetterSpotterProblemShape {
  similarity: SimilarityTarget;
  promptLines: string[];
}

/** Map a tier to the structural intent (similarity target) for a mode, plus the
 *  prompt lines that DESCRIBE that shape to the LLM. All three modes share the
 *  same recognition lever (distractor similarity), so the table is mode-uniform;
 *  the prompt wording is tailored to each mode's surface (options vs. grid). */
function resolveProblemShape(mode: LetterMode, tier: SupportTier): LetterSpotterProblemShape {
  // Clamp lives in the consumer: distractors are picked ONLY from the cumulative
  // group, so "near" saturates to the nearest-available when no true cluster-mate
  // of the target is in scope. The intent itself is just easy/medium/hard → target.
  const similarity: SimilarityTarget = tier === 'easy' ? 'far' : tier === 'medium' ? 'mixed' : 'near';

  const surface =
    mode === 'find-it'
      ? 'the non-target cells in the grid'
      : 'the wrong-answer option letters';

  const lines: string[] = [TIER_GUARDRAIL];
  switch (similarity) {
    case 'far':
      lines.push(
        `EASY structure: make ${surface} look NOTHING like the target letter — pick distractors `
        + `from a different shape family (no b/d/p/q-style mirrors, no same-hump or same-round confusions). `
        + `Discrimination is easy; the student just has to spot the obvious match.`,
      );
      break;
    case 'mixed':
      lines.push(
        `MEDIUM structure: mix ${surface} — some clearly different, some moderately similar in shape. `
        + `A couple of distractors should share a feature with the target so the student looks twice.`,
      );
      break;
    case 'near':
      lines.push(
        `HARD structure: make ${surface} NEAR-CONFUSABLE with the target — same shape family `
        + `(mirror/rotation like b/d/p/q, same-hump like m/n/u, same-round like c/e/o) wherever the `
        + `cumulative group allows. The student must truly DISCRIMINATE the letterform, not just glance.`,
      );
      break;
  }
  return { similarity, promptLines: lines };
}

/**
 * Constructive distractor selector — the CODE-ENFORCED half of the structural
 * axis. Given the target, the in-scope pool, how many distractors are needed,
 * and the tier's similarity target, deterministically pick distractors that hit
 * the target similarity AS CLOSELY AS THE POOL ALLOWS.
 *
 * - 'near' → prefer cluster-mates (distance 0); saturates to far ones only if
 *   the group has too few mates (HONEST band saturation — never invents letters).
 * - 'far'  → prefer non-mates (distance 1); falls back to mates if forced.
 * - 'mixed'→ aim for a roughly even split of near and far.
 *
 * Never returns the target itself; never exceeds the pool; never duplicates.
 * `rng` is injectable for deterministic stress-testing.
 */
function selectDistractorsBySimilarity(
  target: string,
  pool: string[],
  count: number,
  similarity: SimilarityTarget,
  rng: () => number = Math.random,
): string[] {
  const t = target.toLowerCase();
  const candidates = Array.from(new Set(pool.map(l => l.toLowerCase()))).filter(l => l !== t);
  const near = candidates.filter(c => similarityDistance(t, c) === 0);
  const far = candidates.filter(c => similarityDistance(t, c) === 1);

  const shuffle = (arr: string[]) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const sNear = shuffle(near);
  const sFar = shuffle(far);

  let ordered: string[];
  if (similarity === 'near') {
    ordered = [...sNear, ...sFar]; // mates first; saturate to far if too few mates
  } else if (similarity === 'far') {
    ordered = [...sFar, ...sNear]; // non-mates first; saturate to near if forced
  } else {
    // mixed: interleave near/far so we get an even-ish split
    ordered = [];
    const a = sNear, b = sFar;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < a.length) ordered.push(a[i]);
      if (i < b.length) ordered.push(b[i]);
    }
  }

  return ordered.slice(0, Math.min(count, candidates.length));
}

/**
 * Schema definition for Letter Spotter Data
 *
 * Generates interactive letter recognition activities for K-2 students.
 * Three modes: Name It (identify letter by name), Find It (locate letter in grid),
 * Match It (match uppercase to lowercase). Follows cumulative group progression
 * across 4 letter groups based on instructional frequency.
 */
const letterSpotterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the letter recognition activity (e.g., 'Spot the Letters - Group 1!')",
    },
    letterGroup: {
      type: Type.NUMBER,
      description: "Which letter group (1, 2, 3, or 4)",
    },
    cumulativeLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "All letters available in this group (lowercase)",
    },
    newLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Letters newly introduced in this group (lowercase)",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'ch1', 'ch2')",
          },
          mode: {
            type: Type.STRING,
            enum: ["name-it", "find-it", "match-it"],
            description: "Challenge mode: name-it, find-it, or match-it",
          },
          targetLetter: {
            type: Type.STRING,
            description: "The letter to identify (lowercase, e.g., 's', 'a')",
          },
          targetCase: {
            type: Type.STRING,
            enum: ["uppercase", "lowercase", "both"],
            description: "How to display the target letter",
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For name-it: 4 letter name options. For match-it: 4 lowercase letter options. Include the correct answer.",
          },
          letterGrid: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For find-it: 16 uppercase letters in a 4x4 grid with 2-3 instances of the target mixed with distractors",
          },
          targetCount: {
            type: Type.NUMBER,
            description: "For find-it: how many instances of the target letter are in the grid (2 or 3)",
          },
          sentence: {
            type: Type.STRING,
            description: "For name-it: a short sentence with the emoji replacing one letter (e.g., 'The ⭐un is bright.')",
          },
          emoji: {
            type: Type.STRING,
            description: "For name-it: the emoji used as placeholder (e.g., '⭐', '🌟', '🔮')",
          },
          targetWord: {
            type: Type.STRING,
            description: "For name-it: the full word containing the target letter (e.g., 'sun')",
          },
        },
        required: ["id", "mode", "targetLetter", "targetCase"],
      },
      description: "Array of 6-8 challenges mixing name-it, find-it, and match-it modes",
    },
  },
  required: ["title", "letterGroup", "cumulativeLetters", "newLetters", "challenges"],
};

// ============================================================================
// Letter Group Definitions
// ============================================================================

const LETTER_GROUPS: Record<number, string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b'],
  4: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'q'],
};

const NEW_LETTERS: Record<number, string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['g', 'o', 'u', 'l', 'f', 'b'],
  4: ['j', 'z', 'w', 'v', 'y', 'x', 'q'],
};

/**
 * Generate Letter Spotter data using Gemini AI
 *
 * Creates interactive letter recognition activities with three modes:
 * - Name It: See a letter displayed visually, pick its name from options
 * - Find It: Hear a letter name, find all instances in a 4x4 grid
 * - Match It: See an uppercase letter, match it to the correct lowercase
 *
 * Follows cumulative group progression:
 * - Group 1: s, a, t, i, p, n (6 letters)
 * - Group 2: Group 1 + c, k, e, h, r, m, d (13 letters)
 * - Group 3: Group 2 + g, o, u, l, f, b (19 letters)
 * - Group 4: Group 3 + j, z, w, v, y, x, q (full 26)
 *
 * @param topic - Theme or context for the activity
 * @param gradeLevel - Grade level ('K', '1', or '2')
 * @param config - Optional config with letterGroup override and targetEvalMode
 * @returns LetterSpotterData with challenges across all three modes
 */
export const generateLetterSpotter = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<{
    letterGroup: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
    /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). Second
     *  axis: difficulty = how much scaffolding within the mode. NEVER changes letters. */
    difficulty: string;
  }>,
): Promise<LetterSpotterData> => {

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'letter-spotter',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('LetterSpotter', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(letterSpotterSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
      })
    : letterSpotterSchema;

  // -------------------------------------------------------------------------
  // Letter group setup
  // -------------------------------------------------------------------------
  const letterGroup = (config?.letterGroup && config.letterGroup >= 1 && config.letterGroup <= 4)
    ? config.letterGroup
    : 1;

  const cumulativeLetters = LETTER_GROUPS[letterGroup];
  const newLetters = NEW_LETTERS[letterGroup];

  // -------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT letters.
  //    pinnedType drives prompt TONE only when the manifest pinned exactly one mode;
  //    the actual withdrawal is applied per-challenge (from each challenge's OWN mode)
  //    after generation, so blended/auto sessions get difficulty too. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: LetterMode | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as LetterMode)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // Second axis (structural): fold the problem-shape lines (distractor similarity)
  // into the SAME tier block so the LLM sees ONE coherent "what this tier means" —
  // axis 1 = how much help, axis 2 = how confusable the distractors are.
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier)
    : null;
  const tierSection = (tierScaffold || tierShape)
    ? `\n## WITHIN-MODE DIFFICULTY TIER (scaffolding + distractor similarity — NOT the letter scope)\n${[
        ...(tierShape?.promptLines ?? []),
        ...(tierScaffold?.promptLines ?? []),
      ].map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const generationPrompt = `Create an interactive letter recognition activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevel}
LETTER GROUP: ${letterGroup}
CUMULATIVE LETTERS (all available): ${cumulativeLetters.join(', ')}
NEW LETTERS (just introduced): ${newLetters.join(', ')}

Generate 6-8 challenges. Prioritize new letters but include some review letters too.

${challengeTypeSection}
${tierSection}
MODE-SPECIFIC FIELD RULES:
- name-it (SENTENCE SPOTTER): set sentence, emoji, targetWord, and options (4 letters). Do NOT set letterGrid or targetCount.
  * sentence: a short (4-7 word) sentence where the emoji replaces the targetLetter at the START of targetWord
  * emoji: a fun emoji (⭐🌟🔮💎🎯🎪🦋🌈🎨🌺) — use a DIFFERENT emoji per challenge
  * targetWord: the full word (e.g., "sun") — must contain the targetLetter
  * options: 4 lowercase letters including the correct one
  * Example: targetLetter "s", targetWord "sun", emoji "⭐", sentence "The ⭐un is bright."
- find-it: set letterGrid (16 uppercase letters) and targetCount (2-3), do NOT set options, sentence, emoji, or targetWord
- match-it: set options (4 lowercase letters), do NOT set letterGrid, targetCount, sentence, emoji, or targetWord

RULES:
- Use IDs: ch1, ch2, ch3, etc.
- At least half the challenges should target NEW letters.
- All distractor letters must come from the cumulative letters list.
- For find-it grids: exactly 16 cells, each cell is a single UPPERCASE letter.
- For name-it and match-it: exactly 4 options, each a single lowercase letter.
- Vary targetCase across name-it challenges (some uppercase, some lowercase, some both).
${!evalConstraint ? '- Order challenges so modes alternate (don\'t cluster all the same mode together).' : ''}

LETTER GROUP DATA:
- letterGroup: ${letterGroup}
- cumulativeLetters: [${cumulativeLetters.map(l => `"${l}"`).join(', ')}]
- newLetters: [${newLetters.map(l => `"${l}"`).join(', ')}]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 literacy specialist designing letter recognition activities. You create engaging, developmentally appropriate challenges that help young students learn to identify letters by name, find them visually, and match uppercase to lowercase forms. You understand common letter confusions (b/d, p/q, m/n, u/n) and use them as strategic distractors to strengthen discrimination skills. You always use letters only from the specified cumulative group.`,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as LetterSpotterData;

    // ========================================================================
    // Post-generation validation & defaults
    // ========================================================================

    // Ensure letterGroup is correct
    result.letterGroup = letterGroup as 1 | 2 | 3 | 4;

    // Enforce correct cumulative and new letter sets
    result.cumulativeLetters = cumulativeLetters;
    result.newLetters = newLetters;

    // Validate challenges
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, i) => {
        // Ensure IDs exist
        if (!ch.id) ch.id = `ch${i + 1}`;

        // Ensure targetLetter is lowercase
        ch.targetLetter = (ch.targetLetter || 's').toLowerCase();

        // Ensure targetLetter is within the cumulative group
        if (!cumulativeLetters.includes(ch.targetLetter)) {
          ch.targetLetter = newLetters[i % newLetters.length];
        }

        // Validate name-it sentence fields
        if (ch.mode === 'name-it') {
          const FALLBACK_EMOJIS = ['⭐', '🌟', '🔮', '💎', '🎯', '🎪', '🦋', '🌈', '🎨', '🌺'];

          // Ensure emoji exists and varies per challenge
          if (!ch.emoji) {
            ch.emoji = FALLBACK_EMOJIS[i % FALLBACK_EMOJIS.length];
          }

          // Ensure targetWord exists
          if (!ch.targetWord) {
            // Simple fallback words for common letters
            const fallbackWords: Record<string, string> = {
              s: 'sun', a: 'ant', t: 'top', i: 'ink', p: 'pan', n: 'net',
              c: 'cat', k: 'kit', e: 'egg', h: 'hat', r: 'run', m: 'map', d: 'dog',
              g: 'gum', o: 'owl', u: 'up', l: 'log', f: 'fan', b: 'bat',
              j: 'jam', z: 'zip', w: 'wet', v: 'van', y: 'yam', x: 'fox', q: 'quiz',
            };
            ch.targetWord = fallbackWords[ch.targetLetter] || ch.targetLetter + 'at';
          }

          // Ensure sentence exists with emoji placeholder
          if (!ch.sentence || !ch.sentence.includes(ch.emoji)) {
            const word = ch.targetWord;
            const emojiWord = ch.emoji + word.slice(1);
            ch.sentence = `I see a ${emojiWord}.`;
          }

          // Clean up fields that shouldn't exist for name-it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).letterGrid;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).targetCount;
        }

        // Validate mode-specific fields
        if (ch.mode === 'find-it') {
          // Ensure grid has exactly 16 cells
          if (!ch.letterGrid || ch.letterGrid.length !== 16) {
            // Build a valid grid with 2-3 target instances
            const count = ch.targetCount || 2;
            const grid: string[] = [];
            for (let j = 0; j < count; j++) {
              grid.push(ch.targetLetter.toUpperCase());
            }
            const distractors = cumulativeLetters.filter(l => l !== ch.targetLetter);
            while (grid.length < 16) {
              grid.push(distractors[Math.floor(Math.random() * distractors.length)].toUpperCase());
            }
            // Shuffle
            for (let j = grid.length - 1; j > 0; j--) {
              const k = Math.floor(Math.random() * (j + 1));
              [grid[j], grid[k]] = [grid[k], grid[j]];
            }
            ch.letterGrid = grid;
          } else {
            // Ensure all grid cells are uppercase
            ch.letterGrid = ch.letterGrid.map(l => l.toUpperCase());
          }

          // Ensure targetCount matches actual target instances in grid
          ch.targetCount = ch.letterGrid.filter(
            l => l.toLowerCase() === ch.targetLetter
          ).length;

          // Clean up fields that shouldn't exist for find-it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).options;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).sentence;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).emoji;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).targetWord;
        } else {
          // name-it or match-it: ensure 4 options including correct answer
          if (!ch.options || ch.options.length < 4) {
            const correct = ch.targetLetter;
            const distractors = cumulativeLetters
              .filter(l => l !== correct)
              .sort(() => Math.random() - 0.5)
              .slice(0, 3);
            ch.options = [correct, ...distractors].sort(() => Math.random() - 0.5);
          } else {
            // Ensure correct answer is in options
            ch.options = ch.options.map(o => o.toLowerCase());
            if (!ch.options.includes(ch.targetLetter)) {
              ch.options[Math.floor(Math.random() * ch.options.length)] = ch.targetLetter;
            }
          }

          // Clean up fields that shouldn't exist for name-it / match-it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).letterGrid;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).targetCount;

          // sentence/emoji/targetWord only belong to name-it — remove for match-it
          if (ch.mode === 'match-it') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (ch as any).sentence;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (ch as any).emoji;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (ch as any).targetWord;
          }
        }

        return ch;
      });

      // Fallback: ensure at least one challenge exists
      if (result.challenges.length === 0) {
        const fallbackMode = evalConstraint?.allowedTypes[0] ?? 'name-it';
        const targetLetter = newLetters[0];
        const distractors = cumulativeLetters
          .filter(l => l !== targetLetter)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        result.challenges = [{
          id: 'ch1',
          mode: fallbackMode as 'name-it' | 'find-it' | 'match-it',
          targetLetter,
          targetCase: 'uppercase' as const,
          options: [targetLetter, ...distractors].sort(() => Math.random() - 0.5),
        }];
      }
    }

    // ========================================================================
    // Within-mode support tier — withdraw on-card scaffolding (never the letters).
    // Applied PER CHALLENGE from each challenge's OWN mode, so a blended/auto
    // session gets difficulty too (the tier is a STUDENT property, not single-mode).
    // Gated ONLY on supportTier; runs AFTER all structural fixups so it can only
    // remove help. Code owns the SUPPORT structure; the LLM only chose the letters.
    // ========================================================================
    if (supportTier && result.challenges) {
      for (const ch of result.challenges) {
        const sc = resolveSupportStructure(ch.mode as LetterMode, supportTier);
        // Second axis: structural similarity target for this challenge's OWN mode.
        const shape = resolveProblemShape(ch.mode as LetterMode, supportTier);

        // #2 strategy cue — display-only, withdrawn at hard (null).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ch as any).strategyHint = sc.strategyHint ?? undefined;

        // #1 perception reference — find-it only (UI contract: other modes ignore it).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ch as any).showTargetReference = ch.mode === 'find-it' ? sc.showTargetReference : undefined;

        const correct = ch.targetLetter.toLowerCase();
        const pool = cumulativeLetters.map(l => l.toLowerCase());

        // #5 answer-form (option count, support axis) × distractor similarity
        // (structural axis) — name-it / match-it only. ANSWER-BEARING GUARD: the
        // component checks the picked option against targetLetter, so the correct
        // letter MUST always remain. We keep the correct answer, then build the
        // distractor set deterministically to the tier's similarity target.
        //
        // COUNT → HONOR-IF-VALID → RECONSTRUCT: if the LLM's own distractors
        // already match the target similarity AND hit the option count, keep them
        // (don't churn a coherent question); otherwise reconstruct from the pool.
        if ((ch.mode === 'name-it' || ch.mode === 'match-it') && Array.isArray(ch.options)) {
          const needed = Math.max(1, sc.optionCount - 1); // minus the correct answer
          const llmDistractors = Array.from(
            new Set(ch.options.map(o => o.toLowerCase()).filter(o => o !== correct)),
          ).filter(o => pool.includes(o)); // band cap: in-group only

          // What similarity would we IDEALLY achieve from this pool? (saturation-aware)
          const idealNear = selectDistractorsBySimilarity(correct, pool, needed, 'near');
          const idealNearCount = idealNear.filter(d => similarityDistance(correct, d) === 0).length;

          const countNear = (arr: string[]) =>
            arr.filter(d => similarityDistance(correct, d) === 0).length;

          // The LLM's set is "valid" if it has the right size AND its near-count
          // already matches what the tier would build (so we don't fight a good set).
          const targetNear =
            shape.similarity === 'near'
              ? idealNearCount
              : shape.similarity === 'far'
                ? 0
                : Math.min(idealNearCount, Math.ceil(needed / 2));
          const llmValid =
            llmDistractors.length === needed && countNear(llmDistractors) === targetNear;

          const finalDistractors = llmValid
            ? llmDistractors
            : selectDistractorsBySimilarity(correct, pool, needed, shape.similarity);

          ch.options = [correct, ...finalDistractors].sort(() => Math.random() - 0.5);
        }

        // find-it: re-fill the NON-target grid cells by similarity. ANSWER-BEARING
        // + FLOOR GUARD: keep exactly the target instances (the mode identity — the
        // answer is "every cell == target"); only the distractor cells change. The
        // component recomputes targetCount from the grid, so the answer stays sound.
        if (ch.mode === 'find-it' && Array.isArray(ch.letterGrid) && ch.letterGrid.length === 16) {
          const upperTarget = correct.toUpperCase();
          const targetCells = ch.letterGrid.filter(l => l.toUpperCase() === upperTarget).length;
          const distractorSlots = 16 - targetCells;
          if (targetCells >= 1 && distractorSlots > 0) {
            // Build a similarity-tilted distractor BAG sized to fill every slot,
            // cycling the ranked pool (the grid may need more cells than distinct
            // in-group letters). Ranking respects the tier similarity target.
            const ranked = selectDistractorsBySimilarity(
              correct, pool, pool.length - 1, shape.similarity,
            );
            const bag: string[] = [];
            for (let j = 0; j < distractorSlots; j++) {
              bag.push((ranked[j % ranked.length] ?? pool.find(l => l !== correct) ?? 'x').toUpperCase());
            }
            const grid: string[] = [];
            for (let j = 0; j < targetCells; j++) grid.push(upperTarget);
            grid.push(...bag);
            // Shuffle so targets aren't clustered.
            for (let j = grid.length - 1; j > 0; j--) {
              const k = Math.floor(Math.random() * (j + 1));
              [grid[j], grid[k]] = [grid[k], grid[j]];
            }
            ch.letterGrid = grid;
            ch.targetCount = grid.filter(l => l.toUpperCase() === upperTarget).length;
          }
        }
      }
      console.log(`[letter-spotter] Tier "${supportTier}" applied per-challenge (support + distractor-similarity; ${pinnedType ? 'single-mode ' + pinnedType : 'blended'})`);
    }

    // Surface the tier to the live tutor (reveal policy is mode-aware per challenge).
    if (supportTier) {
      result.supportTier = supportTier;
    }

    console.log('Letter Spotter Generated:', {
      title: result.title,
      letterGroup: result.letterGroup,
      cumulativeLetters: result.cumulativeLetters.join(', '),
      newLetters: result.newLetters.join(', '),
      challengeCount: result.challenges?.length || 0,
      modes: result.challenges?.map(ch => ch.mode) || [],
    });

    return result;

  } catch (error) {
    console.error("Error generating letter spotter:", error);
    throw error;
  }
};
