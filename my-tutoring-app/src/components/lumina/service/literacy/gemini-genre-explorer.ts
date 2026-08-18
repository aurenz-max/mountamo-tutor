import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { GenreExplorerData } from "../../primitives/visual-primitives/literacy/GenreExplorer";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
/**
 * ⚠️ THE BUILD GATES ARE IMPORTED, NEVER COPIED (DI port, 2026-08-17).
 *
 * This generator and `genreExplorerScript.ts` are the two sides of one wire, and
 * both have to agree on what is sayable, what counts as a genre, and which
 * option sets can be told apart BY EAR. letter-spotter's two sides drifted to 90
 * vs 100 characters on exactly this question and disagreed live about what a
 * sayable sentence was; one address is the fix.
 *
 * `GENRE_LABEL` in particular is now the pack's, not the model's: the child SAYS
 * the label out loud and the judge is handed it as a target, so it cannot be
 * authored per generation. The schema is enum-constrained to its ids.
 */
import {
  ALL_GENRE_IDS,
  GENRE_LABEL,
  binaryBucketOf,
  GENRE_SIBLING,
  MAX_CONTRAST_ITEMS,
  MAX_EXCERPTS,
  MIN_GENRE_OPTIONS_EASY,
  canonicalGenre,
  isBandFloor,
  isReadableAloud,
  isSayablePredicate,
  namesAGenre,
  opensWithSentinel,
  optionsEarSeparable,
  pruneForEar,
  type GenreId,
} from '../../primitives/visual-primitives/literacy/genreExplorerScript';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// Eval modes are TASK IDENTITIES (Bloom tiers of genre work), not numeric
// difficulty. They map onto the root-level `mode` field of the schema:
//   identify_basic  → binary fiction/nonfiction recognition (RECOGNIZE)
//   classify_genre  → multi-way classification among literary genres (CLASSIFY)
//   compare_genres  → contrast two genres on one topic side-by-side (ANALYZE)
//
// ⚠️ EVERY MODE NOW PRODUCES SEVERAL EXCERPTS, AND identify_basic'S RISE FROM ONE
// IS THE PORT'S BIGGEST CONTENT CHANGE (DI port, 2026-08-17). Under a tap, one
// excerpt with a checklist was a screenful worth 100 points. Under the judged
// loop the genre call is a single spoken ask, and for a BINARY mode that is a
// coin flip deciding the entire measurement of the skill. What deletes the guess
// is the SESSION — two or three texts, each with its own genre call and its own
// feature evidence, is 1/64 rather than 1/2 — so the excerpt count is where the
// measurement lives now.
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify_basic: {
    promptDoc:
      `"identify_basic": Binary FICTION vs NONFICTION recognition. Produce 2-3 SHORT excerpts, `
      + `and they must NOT all be the same genre — at least one "fiction" and at least one "nonfiction". `
      + `genreOptions are the two broad buckets only: ["fiction", "nonfiction"]. `
      + `Features are 4-5 simple perceptual cues a young reader can check ("have animals that talk", `
      + `"tell about things that really happened", "have a made-up ending"). `
      + `Foundational task — grades 1-2, so keep every excerpt to 2-3 short sentences: the tutor READS them aloud.`,
    schemaDescription: "'identify_basic' (fiction vs nonfiction recognition)",
  },
  classify_genre: {
    promptDoc:
      `"classify_genre": Multi-way classification among specific literary/informational genres `
      + `(folktale, fable, myth, poem, informational, biography, historical-fiction — pick a grade-appropriate set). `
      + `Produce 2-3 excerpts, each a DIFFERENT genre. genreOptions list the 4-6 candidate genres including `
      + `2-3 plausible distractors. Features are 5-7 genre-distinguishing characteristics `
      + `("teach a lesson at the end", "use rhyme", "tell about a real person who lived"). `
      + `Core classification task — grades 3-4.`,
    schemaDescription: "'classify_genre' (multi-way genre classification)",
  },
  compare_genres: {
    promptDoc:
      `"compare_genres": Contrast TWO excerpts about the SAME topic written in DIFFERENT genres, side by side. `
      + `Produce EXACTLY 2 excerpts on one shared subject; their genres MUST differ. `
      + `genreOptions list 5-6 genres including the two correct ones plus distractors. `
      + `⚠️ THE FEATURES CARRY THIS MODE: give 6-8 characteristics, and AT LEAST ${MAX_CONTRAST_ITEMS} of them must be `
      + `true of EXACTLY ONE of the two excerpts (presentIn has exactly one excerptId). A feature true of both, or of `
      + `neither, cannot be asked as "which one?" and is discarded — so a set of features that are all shared makes `
      + `this mode produce no contrast questions at all. `
      + `Highest tier — the student analyzes how genre shapes the same content. Grades 5-6.`,
    schemaDescription: "'compare_genres' (contrast two genres on one topic)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding, NOT content
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; full-help defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

const TIER_GUARDRAIL =
  'TIER GUARDRAIL: config.difficulty drives TWO axes on top of the SAME eval mode. Axis 1 (scaffolding) '
  + 'withdraws on-screen and spoken help. Axis 2 (structure) changes how CONFUSABLE the wrong genre options '
  + 'are with the correct one (clearly-different genres at easy → sibling genres that share the correct '
  + 'one\'s whole shape at hard). What NEVER changes: which genre each excerpt actually is, the excerpts '
  + 'themselves, the feature list, or any presentIn value. The lever is distractor SIMILARITY, never the '
  + 'reading level (excerpt length and vocabulary stay grade-scoped).';

interface GenreSupportScaffold {
  /** #2 instruction: easy/medium have the tutor NAME the genre menu aloud. The
   *  script module derives this from `supportTier`; the band floor forces it on
   *  at every tier, because a six-year-old should not have to decode an abstract
   *  genre list as well as the text. */
  nameStrategy: boolean;
  /** #5 answer-form: how many genres are in the spoken menu (correct always kept). */
  maxGenreOptions?: number;
  promptLines: string[];
}

function resolveSupportStructure(tier: SupportTier): GenreSupportScaffold {
  const lead =
    'This tier changes ONLY how much help the student gets while working out the genre. It NEVER changes '
    + 'the excerpts, which genre each one is, or which excerpt each feature is true of — only the '
    + 'scaffolding around the same classification is withdrawn.';

  if (tier === 'easy') {
    return {
      nameStrategy: true,
      /**
       * ⭐ THREE WHERE THREE EXIST. Under a tap, `correct + 1 distractor` was
       * scaffolding: the child picked from a short menu and a wrong pick was
       * corrected instantly. Under the judged loop it is a 1-IN-2 GUESS FLOOR on
       * a spoken ask, and the guess floor is precisely what a judged loop exists
       * to delete. It CLAMPS rather than inflating — `identify_basic` is a
       * two-genre mode by construction and saturates at 2, which is a real
       * ceiling and not a softening (word-sorter's binary_sort shape); that
       * mode's guess floor is deleted by the SESSION length instead.
       */
      maxGenreOptions: MIN_GENRE_OPTIONS_EASY,
      promptLines: [
        lead,
        'EASY: the tutor names the reading strategy before the first question of each step, and the genre menu '
        + 'carries the correct genres plus only clearly-different distractors.',
        'Keep the title neutral — never state the support level and never name any excerpt\'s genre.',
      ],
    };
  }

  if (tier === 'medium') {
    return {
      nameStrategy: true,
      maxGenreOptions: 4,
      promptLines: [
        lead,
        'MEDIUM: the tutor still names the strategy when a step is introduced, and the genre menu includes one '
        + 'distractor that is a close relative of a correct genre.',
        'Keep the title neutral — never state the support level and never name any excerpt\'s genre.',
      ],
    };
  }

  // hard — all scaffolds withdrawn; the student reads the menu and works unaided.
  return {
    nameStrategy: false,
    maxGenreOptions: undefined, // full option set
    promptLines: [
      lead,
      'HARD: the tutor does not name the strategy and does not read the genre list aloud (the student reads it '
      + 'off the screen), and the menu carries the full option set with sibling-genre distractors.',
      'Keep the title neutral — never state the support level and never name any excerpt\'s genre.',
    ],
  };
}

/**
 * AXIS 2 — distractor confusability, applied by ORDERING `genreOptions`.
 *
 * The script module trims the menu from the BACK (the correct genres are seeded
 * first and never trimmed), so leading order IS the tier: sibling genres lead at
 * `hard` and trail at `easy`. `GENRE_SIBLING` is code-owned and shared with the
 * harness, which draws its signature wrong from the same map — the distractor the
 * tier deliberately admits is the exact wrong answer the drive then checks the
 * judge refuses.
 */
function orderDistractors(
  answers: GenreId[],
  distractors: GenreId[],
  tier: SupportTier,
): GenreId[] {
  const siblingSet = new Set(answers.flatMap((id) => GENRE_SIBLING[id] ?? []));
  const near = distractors.filter((id) => siblingSet.has(id));
  const far = distractors.filter((id) => !siblingSet.has(id));
  return tier === 'hard' ? [...near, ...far] : tier === 'easy' ? [...far, ...near] : [...far, ...near];
}

/**
 * Schema definition for Genre Explorer Data.
 *
 * ⚠️ THE FEATURE LIST MOVED TO THE ROOT (DI port, 2026-08-17), and the shape is
 * FLATTER for it. The click era nested a checklist inside each excerpt, which
 * made "is this feature true of excerpt A but not of excerpt B?" — the entire
 * `compare_genres` question — a cross-reference between two sibling arrays that
 * the model had to keep in step by hand. One feature row carrying `presentIn` is
 * the same information with the relationship stated once, and it turns the
 * contrast build gate into a set-size check.
 *
 * ⚠️ AND `predicate` REPLACES `label`, WHICH IS NOT A RENAME. The child hears
 * "Does this one ___?", so the field has to be a BASE-VERB PHRASE that completes
 * it. A checklist heading ("Has characters") produces "Does this one has
 * characters?", and the fix belongs in the schema rather than in a natural-
 * language transform on our side (`isSayablePredicate` DROPS the heading form
 * rather than trying to conjugate it).
 */
const genreExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title. Never names any excerpt's genre." },
    gradeLevel: { type: Type.STRING },
    mode: {
      type: Type.STRING,
      enum: ["identify_basic", "classify_genre", "compare_genres"],
      description: "The classification task identity (eval mode) for this activity"
    },
    // Every array is BOUNDED (flash-lite truncation template) at the ladder's own
    // ceiling, so nothing a grade actually asks for is refused.
    excerpts: {
      type: Type.ARRAY,
      maxItems: String(MAX_EXCERPTS),
      items: {
        type: Type.OBJECT,
        properties: {
          excerptId: { type: Type.STRING, description: "EXACTLY 'e1', 'e2' or 'e3', in order" },
          text: {
            type: Type.STRING,
            description:
              "The excerpt itself. NEVER contains the name of any genre (no 'fable', 'poem', 'myth', "
              + "'biography', 'story', 'article'...) — the child has to work the genre out from how it reads.",
          },
          genre: {
            type: Type.STRING,
            enum: ALL_GENRE_IDS as unknown as string[],
            description: "The correct genre for this excerpt",
          },
        },
        required: ["excerptId", "text", "genre"]
      }
    },
    features: {
      type: Type.ARRAY,
      maxItems: '8',
      items: {
        type: Type.OBJECT,
        properties: {
          featureId: { type: Type.STRING, description: "Short unique id, e.g. 'talking-animals'" },
          predicate: {
            type: Type.STRING,
            description:
              "BASE-VERB phrase that completes 'Does this one ___?'. Write 'have animals that talk', "
              + "'teach a lesson at the end', 'use rhyme', 'tell about a real person'. NEVER a heading "
              + "('Has characters') and NEVER a question ('Does it rhyme?'). 2-7 words, no genre names.",
          },
          presentIn: {
            type: Type.ARRAY,
            maxItems: String(MAX_EXCERPTS),
            items: { type: Type.STRING },
            description: "The excerptIds this is TRUE of ('e1', 'e2'). Empty array = true of none.",
          },
        },
        required: ["featureId", "predicate", "presentIn"]
      }
    },
    genreOptions: {
      type: Type.ARRAY,
      maxItems: '6',
      items: { type: Type.STRING, enum: ALL_GENRE_IDS as unknown as string[] },
      description: "4-6 genre ids: every excerpt's correct genre plus 2-3 plausible distractors",
    },
  },
  required: ["title", "gradeLevel", "excerpts", "features", "genreOptions"]
};

/**
 * Generator-side build gates — the same calls the script module runs on its side
 * of the wire, so a question that would be dropped on screen is reported here
 * instead of silently vanishing. KEEP-OR-DROP, never backfill: a placeholder in a
 * judged loop becomes a spoken ask the tutor must stand behind.
 *
 * ⭐ WRITING THE SPOKEN ASK AUDITED THE CONTENT, and gate 2 is where it landed:
 * a checklist row saying "Is it a fable?" was a perfectly good checkbox and is an
 * answer leak the moment the tutor reads it aloud before the genre question.
 * Nothing about the click era had to justify that relation out loud.
 */
function applyJudgedBuildGates(
  result: GenreExplorerData,
  bandFloor: boolean,
  binaryMode: boolean,
): void {
  // 0. ⭐ THE MODE IS THE TASK IDENTITY. `identify_basic` is fiction-vs-nonfiction
  //    or it is not that mode — a live probe caught it returning a three-genre
  //    menu at grade 2, which turns a Tier-1 β-2.0 binary into something else
  //    without anything downstream noticing. Bucket what has a defensible side and
  //    DROP what does not (`poem`, `drama` can be either).
  if (binaryMode) {
    const before = (result.excerpts ?? []).length;
    const bucketed: GenreExplorerData['excerpts'] = [];
    for (const excerpt of result.excerpts ?? []) {
      const bucket = binaryBucketOf(canonicalGenre(excerpt?.genre));
      if (bucket) bucketed.push({ ...excerpt, genre: bucket });
    }
    result.excerpts = bucketed;
    result.genreOptions = ['fiction', 'nonfiction'];
    if (result.excerpts.length !== before) {
      console.log(
        `[genre-explorer] identify_basic: dropped ${before - result.excerpts.length} excerpt(s) whose `
        + 'genre has no defensible fiction/nonfiction side.',
      );
    }
  }

  // 1. An excerpt must be sayable, must not NAME a genre, and — at the band floor,
  //    where the tutor reads it to the child — must be short enough to repeat in a
  //    correction and must not open a sentence with a verdict sentinel. This is the
  //    family's only pack whose tutor speaks generated narrative at length, so
  //    "Yes, said the fox." is a live hazard rather than a theoretical one.
  const beforeExcerpts = (result.excerpts ?? []).length;
  result.excerpts = (result.excerpts ?? []).filter((excerpt) => {
    if (!excerpt?.excerptId || !excerpt.text) return false;
    if (!canonicalGenre(excerpt.genre)) return false;
    if (namesAGenre(excerpt.text)) return false;
    if (bandFloor && !isReadableAloud(excerpt.text)) return false;
    return true;
  });
  if (result.excerpts.length !== beforeExcerpts) {
    console.log(
      `[genre-explorer] dropped ${beforeExcerpts - result.excerpts.length} excerpt(s) that named a genre, `
      + 'carried an unknown genre, or could not be read aloud at the band floor.',
    );
  }

  // 2. A feature must complete "Does this one ___?", must not name a genre, and
  //    must point only at excerpts that survived gate 1.
  const excerptIds = new Set(result.excerpts.map((e) => e.excerptId));
  const beforeFeatures = (result.features ?? []).length;
  result.features = (result.features ?? []).filter((feature) => {
    if (!feature?.featureId || !isSayablePredicate(feature.predicate ?? '')) return false;
    if (namesAGenre(feature.predicate ?? '')) return false;
    if (opensWithSentinel(feature.predicate ?? '')) return false;
    return (feature.presentIn ?? []).every((id) => excerptIds.has(id));
  });
  if (result.features.length !== beforeFeatures) {
    console.log(
      `[genre-explorer] dropped ${beforeFeatures - result.features.length} feature(s) that were not a `
      + 'base-verb phrase, named a genre, or pointed at a missing excerpt.',
    );
  }

  // 3. The menu must contain every correct genre and must survive the ear gate.
  //    "Fiction" beside "Historical Fiction" is the subset shape that has no
  //    honest verdict, and the generic label is the one that loses.
  const answers = Array.from(
    new Set(result.excerpts.map((e) => canonicalGenre(e.genre)).filter((g): g is GenreId => !!g)),
  );
  const offered = (result.genreOptions ?? [])
    .map((option) => canonicalGenre(option))
    .filter((id): id is GenreId => !!id && !answers.includes(id));
  const kept = pruneForEar(
    answers.map((id) => GENRE_LABEL[id]),
    offered.map((id) => GENRE_LABEL[id]),
  );
  result.genreOptions = kept
    .map((label) => ALL_GENRE_IDS.find((id) => GENRE_LABEL[id] === label) as GenreId);
  if (result.genreOptions.length < 2 || !optionsEarSeparable(kept)) {
    console.warn(
      `[genre-explorer] genre menu [${kept.join(', ')}] is not an askable spoken set — the genre step will `
      + 'build no items.',
    );
  }
}

type GenreExplorerConfig = Partial<GenreExplorerData> & {
  targetEvalMode?: string;
  /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). */
  difficulty?: string;
};

export const generateGenreExplorer = async (
  ctx: GenerationContext,
): Promise<GenreExplorerData> => {

  const { topic } = ctx;
  const intent = ctx.intent;
  const config = ctx.raw as GenreExplorerConfig;

  // ── Eval mode resolution (legacy literacy pattern) ──────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'genre-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('GenreExplorer', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(genreExplorerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
        rootLevel: true,
      })
    : genreExplorerSchema;

  // Grade governs realization (reading level, structural load, option count),
  // NOT the cognitive KIND of the eval mode. ctx.grade is the ONLY parsed grade
  // (normalizeObjectiveGrade); ctx.gradeLevel is a BAND key and ctx.gradeContext
  // is PROSE — neither can be matched against numeric rungs (parse-and-fallback).
  const LADDER = ['1', '2', '3', '4', '5', '6'] as const;
  let gradeLevelKey: string;
  if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
    gradeLevelKey = ctx.grade;
  } else if (ctx.grade && parseInt(ctx.grade, 10) > 6) {
    gradeLevelKey = '6'; // above-ceiling numeric grade clamps to top rung
  } else if (ctx.grade === 'K') {
    gradeLevelKey = '1'; // no K rung on this ladder — clamp to lowest rung
  } else {
    /**
     * ⚠️ `ctx.gradeLevel` IS A BAND KEY AND CANNOT BE READ AS A GRADE — a branch
     * matching it against this ladder was written and deleted on 2026-08-17 as
     * DEAD CODE, which is worth one line because it looks like it works.
     * `normalizeGradeLevel` runs before every generator and collapses grades 1-5
     * to 'elementary', so `gradeLevel=1` on the drive-harness query arrives here
     * as 'elementary' and the branch never fires. The consequence for this port:
     * the band-floor read-aloud path is reachable by `--grade K` (which survives
     * as 'kindergarten') and by any caller that sets the canonical
     * `config.objectiveGrade`, but NOT by `--grade 1`.
     */
    gradeLevelKey = ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool' ? '1' : '3';
  }
  const bandFloor = isBandFloor(gradeLevelKey);

  /**
   * ⚠️ SHAPE AND GENRES ARE SPLIT, AND THAT IS A LIVE-PROBE FINDING (2026-08-17).
   *
   * The click era emitted one fused grade note ONLY when no mode was pinned. This
   * generator needs the SHAPE half unconditionally, because excerpt length stopped
   * being a style note the moment the tutor started reading excerpts aloud at the
   * band floor — an over-long text there is dropped by the build gates rather than
   * printed to a child who cannot read it. Emitting the fused note unconditionally
   * is what broke: at grade 2 it read "Fiction, nonfiction, poem", the model
   * followed it over `identify_basic`'s own "two broad buckets only", and the
   * BINARY Tier-1 mode came back with a three-genre menu. A grade note may not
   * out-vote the eval mode — the mode IS the task identity.
   */
  const gradeShape: Record<string, string> = {
    '1': 'SHAPE: 2-3 excerpts of 2-3 VERY simple sentences each. 4 features.',
    '2': 'SHAPE: 2-3 excerpts of 2-3 short sentences each. 5 features.',
    '3': 'SHAPE: 2-3 excerpts of 3-5 sentences. 6 features.',
    '4': 'SHAPE: 2-3 excerpts of 4-6 sentences. 6-7 features.',
    '5': 'SHAPE: 2 excerpts of 5-7 sentences. 7 features.',
    '6': 'SHAPE: 2 excerpts of 5-8 sentences. 7-8 features.',
  };

  /** Grade-appropriate genres to DRAW FROM. Suppressed for `identify_basic`,
   *  whose genre set is the mode itself. */
  const gradeGenres: Record<string, string> = {
    '1': 'GENRES in band: fiction, nonfiction.',
    '2': 'GENRES in band: fiction, nonfiction, poem.',
    '3': 'GENRES in band: folktale, fable, myth, poem, informational.',
    '4': 'GENRES in band: biography, autobiography, historical-fiction, informational, realistic-fiction.',
    '5': 'GENRES in band: persuasive, informational, drama, historical-fiction, biography.',
    '6': 'GENRES in band: memoir, legend, tall-tale, persuasive, informational, autobiography.',
  };

  const isBinaryMode = evalConstraint?.allowedTypes.length === 1
    && evalConstraint.allowedTypes[0] === 'identify_basic';

  const tier = normalizeSupportTier(config?.difficulty);
  const scaffold = tier ? resolveSupportStructure(tier) : null;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `Create a genre classification activity about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (story context, characters, poem, examples) to serve that focus. Never name or reveal the answer in this focus text.\n` : ''}
GRADE: ${gradeLevelKey}.
${challengeTypeSection}
${gradeShape[gradeLevelKey] || gradeShape['3']}
${isBinaryMode ? '' : gradeGenres[gradeLevelKey] || gradeGenres['3']}
${scaffold ? `\n${TIER_GUARDRAIL}\n${scaffold.promptLines.join('\n')}\n` : ''}
THIS ACTIVITY IS SPOKEN. A live tutor reads your questions to the child and judges the answers out loud.
Everything below follows from that:

1. excerptId MUST be exactly "e1", "e2", "e3" — in that order, one per excerpt.
2. ⚠️ AN EXCERPT MAY NEVER NAME A GENRE. Do not write "fable", "myth", "poem", "biography", "story",
   "article", "play" or any other kind-of-writing word inside excerpt text — naming it hands the child the
   answer, and any excerpt that does is thrown away.
3. Each excerpt is written so its genre is recognisable from HOW IT READS: a fable has animals and a lesson,
   a poem has short lines and rhythm, a biography names a real person and real dates.
4. FEATURES are the evidence step. Each "predicate" is a BASE-VERB phrase that completes the tutor's spoken
   question "Does this one ___?" — write "have animals that talk", "teach a lesson at the end", "use rhyme",
   "tell about a real person who lived", "give facts you could look up". Never a heading ("Has characters"),
   never a question ("Does it rhyme?"), never a genre name. 2-7 words.
5. presentIn lists the excerptIds the feature is TRUE of. Be accurate — the tutor states these out loud as
   facts. A feature true of no excerpt is fine (use []); it becomes a "no" question.
6. Mix them: for each excerpt at least one feature should be TRUE and at least one FALSE, or the child can
   answer "yes" every round without reading.
7. genreOptions are ids from the allowed list, and must include every excerpt's correct genre.
   ⚠️ Never put "fiction" in the same list as "historical-fiction" or "realistic-fiction" — said out loud, the
   short one fits both and the question has no honest answer.
8. The title never names a genre either.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        // Bounded arrays first, then a ceiling picked for the model actually
        // configured above (flash-lite) — the phoneme-explorer / word-builder
        // truncation template. This schema went from unbounded to capped in the
        // same pass, which is the order that matters.
        maxOutputTokens: 8192,
        systemInstruction:
          'You are an expert K-6 reading teacher specializing in genre analysis. You write short, '
          + 'genre-typical excerpts whose kind is recognisable from how they read, never from anyone saying '
          + 'what they are. Your feature list is the evidence a child uses to reach the genre, so every '
          + 'predicate is checkable against the words on the page.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as GenreExplorerData;

    // Merge config overrides, excluding the routing fields from the spread.
    const { targetEvalMode: _unused, difficulty: _unusedDifficulty, ...configRest } = config ?? {};
    void _unused;
    void _unusedDifficulty;
    const finalData: GenreExplorerData = { ...result, ...configRest };

    // Stamp the pinned mode if Gemini omitted it (single pinned mode only).
    if (!finalData.mode && evalConstraint?.allowedTypes.length === 1) {
      finalData.mode = evalConstraint.allowedTypes[0] as GenreExplorerData['mode'];
    }

    /**
     * ⭐ CODE OWNS THE GRADE FIELD, because a READER-FIT ACCOMMODATION hangs off it.
     *
     * `gradeLevel` was whatever the model wrote, and the pack reads it to decide
     * whether the tutor READS EACH TEXT ALOUD at grades K-2. A model that writes
     * "Grade 1" instead of "1" therefore silently withdraws the accommodation and
     * leaves a six-year-old in front of four sentences nobody will read to them —
     * which a grade-1 judged drive reproduced on 2026-08-17. The grade this
     * generator actually resolved and prompted with is the one that ships.
     */
    finalData.gradeLevel = gradeLevelKey;

    applyJudgedBuildGates(finalData, bandFloor, isBinaryMode);

    // Axis 2: order the surviving distractors by sibling-confusability so the
    // script module's menu trim keeps the near ones at `hard`.
    if (tier) {
      const answers = Array.from(
        new Set(
          finalData.excerpts
            .map((e) => canonicalGenre(e.genre))
            .filter((g): g is GenreId => !!g),
        ),
      );
      const distractors = finalData.genreOptions.filter(
        (id) => !answers.includes(id as GenreId),
      ) as GenreId[];
      finalData.genreOptions = [...answers, ...orderDistractors(answers, distractors, tier)];
      finalData.supportTier = tier;
      finalData.maxGenreOptions = scaffold?.maxGenreOptions;
    }

    console.log('Genre Explorer Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      mode: finalData.mode,
      excerptCount: finalData.excerpts?.length || 0,
      featureCount: finalData.features?.length || 0,
      genres: finalData.excerpts?.map(e => e.genre) || [],
      menu: finalData.genreOptions,
      supportTier: finalData.supportTier,
    });

    return finalData;
  } catch (error) {
    console.error("Error generating genre explorer:", error);
    throw error;
  }
};
