import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { FigurativeLanguageFinderData, FigurativeType } from "../../primitives/visual-primitives/literacy/FigurativeLanguageFinder";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  alliteration: {
    promptDoc: `"alliteration": Repetition of initial consonant sounds. Easy to identify by sound pattern. Grades 3-4.`,
    schemaDescription: "'alliteration' (repeated initial sounds)",
  },
  onomatopoeia: {
    promptDoc: `"onomatopoeia": Words that imitate sounds (buzz, crash, whisper). Easy to identify. Grades 3-4.`,
    schemaDescription: "'onomatopoeia' (sound words)",
  },
  simile: {
    promptDoc: `"simile": Comparison using "like" or "as". Has clear signal words. Grades 3-5.`,
    schemaDescription: "'simile' (comparison with like/as)",
  },
  metaphor: {
    promptDoc: `"metaphor": Implicit comparison without like/as. Harder than simile. Grades 4-6.`,
    schemaDescription: "'metaphor' (implicit comparison)",
  },
  personification: {
    promptDoc: `"personification": Giving human qualities to non-human things. Grades 4-6.`,
    schemaDescription: "'personification' (human qualities to non-human)",
  },
  hyperbole: {
    promptDoc: `"hyperbole": Extreme exaggeration for effect. Grades 4-6.`,
    schemaDescription: "'hyperbole' (extreme exaggeration)",
  },
  imagery: {
    promptDoc: `"imagery": Vivid sensory language appealing to sight, sound, touch, taste, or smell. Grades 5-6.`,
    schemaDescription: "'imagery' (sensory language)",
  },
  idiom: {
    promptDoc: `"idiom": Culturally specific expressions where meaning differs from literal words. Hardest type. Grades 5-6.`,
    schemaDescription: "'idiom' (culturally specific expression)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode tier (config.difficulty) — drives TWO axes within the eval mode:
//   axis 1 (resolveSupportStructure): scaffolding level — how much on-screen help.
//   axis 2 (resolveProblemShape):     problem SHAPE — how many instances to find/
//                                      classify + how near the classify distractors.
// Second field of the two-field contract: targetEvalMode = which figurative type(s),
// difficulty = how much help AND how hard a problem (structurally). Neither axis
// changes magnitude (passage length / legal types / score) or the eval mode.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// TIER_GUARDRAIL — the one hard rule for BOTH axes that config.difficulty drives.
// Structure changes (how MANY devices to find; how NEAR the classify distractors
// are to the correct type), magnitude does NOT (the grade scope still owns how
// long/complex the passage is, which figurative types are legal, and the score).
// The tier never reshapes a mode into another eval mode — the eval mode pins
// which figurative types are legal, so adding instances or near-type chips keeps
// the same task identity. See [[structural-difficulty-not-numeric]].
// ---------------------------------------------------------------------------
const TIER_GUARDRAIL =
  'Tier changes problem SHAPE (instance count to find/classify; near-type distractor '
  + 'confusability), never MAGNITUDE (passage length, legal figurative types, score) '
  + 'and never the eval mode.';

// ---------------------------------------------------------------------------
// STRUCTURAL DIFFICULTY (axis 2) — config.difficulty also drives a harder PROBLEM
// SHAPE, not just less help. Two in-mode levers, both code-enforceable:
//
//   Lever A — instanceCount: how many figurative devices the passage embeds.
//     A "finder" floors at 2 (it must remain a multi-instance find/classify task);
//     hard packs more devices to locate and label. Capped by grade scope so the
//     passage stays grade-legal in length.
//   Lever B — distractorDistance: how NEAR the wrong classify chips are to the
//     correct type. easy = far/unrelated types compete; hard = the nearest
//     confusable type(s) compete (simile vs metaphor, metaphor vs personification),
//     so classification requires true discrimination, not elimination. Stays
//     in-mode: the correct type is ALWAYS present, and added chips are drawn from
//     the full type universe (confusion, not a new task).
//
// Neither lever moves magnitude or changes which types are legal in the passage.
// ---------------------------------------------------------------------------

/** Nearest-confusable neighbours per figurative type (for the hard distractor
 *  lever). These are the classic mis-classifications: a metaphor read as a simile,
 *  personification read as metaphor, an idiom read as a metaphor/hyperbole. */
const NEAR_TYPES: Record<FigurativeType, FigurativeType[]> = {
  simile: ['metaphor', 'personification'],
  metaphor: ['simile', 'personification', 'idiom'],
  personification: ['metaphor', 'imagery', 'simile'],
  hyperbole: ['imagery', 'idiom', 'metaphor'],
  idiom: ['metaphor', 'hyperbole'],
  imagery: ['personification', 'hyperbole', 'metaphor'],
  alliteration: ['onomatopoeia'],
  onomatopoeia: ['alliteration', 'imagery'],
};

interface FigurativeProblemShape {
  /** Target number of figurative instances embedded in the passage. */
  instanceCount: number;
  /** When true the classify chip set is built from NEAR confusable types (hard);
   *  when false it leans on a tight/far set (handled by the support-tier lever). */
  useNearDistractors: boolean;
  promptLines: string[];
}

/**
 * One tier → one structural intent, CLAMPED to the mode/grade band internally.
 *  - `floor` (2) keeps every tier a real multi-instance finder (never collapses
 *    to a single-phrase recognition task — that would be a different primitive).
 *  - `cap` is the grade-scope instance ceiling passed in by the caller; a narrow
 *    band SATURATES honestly (grade 3 tops out at 4, not a forced overflow).
 */
function resolveProblemShape(tier: SupportTier, cap: number): FigurativeProblemShape {
  const FLOOR = 2;
  const safeCap = Math.max(FLOOR, cap);
  // Lever A — instance count ladder, then clamped to [FLOOR, cap].
  const ladder: Record<SupportTier, number> = { easy: 3, medium: 4, hard: 6 };
  const instanceCount = Math.min(safeCap, Math.max(FLOOR, ladder[tier]));
  // Lever B — near-type distractors only at hard (easy/medium keep the tight set
  // the support-tier answer-form lever already builds).
  const useNearDistractors = tier === 'hard';

  const lines: string[] = [TIER_GUARDRAIL];
  lines.push(
    `Embed EXACTLY ${instanceCount} figurative-language instance(s) in the passage `
    + `(this is the find-and-classify load — more instances = a harder hunt). `
    + `Keep the passage grade-appropriate in length; do not pad with filler.`,
  );
  if (instanceCount >= safeCap) {
    lines.push(
      `(${instanceCount} is the ceiling this grade band allows — saturate here, do not exceed it.)`,
    );
  }
  if (useNearDistractors) {
    lines.push(
      'Hard tier: the student must DISCRIMINATE between easily-confused devices — '
      + 'ensure the embedded types include at least one pair that students commonly '
      + 'mix up (e.g. simile vs metaphor, metaphor vs personification) when the eval '
      + 'mode allows more than one type.',
    );
  } else {
    lines.push(
      'The embedded types may be drawn from clearly different device families so '
      + 'classification is more about recognition than fine discrimination.',
    );
  }
  return { instanceCount, useNearDistractors, promptLines: lines };
}

// ---------------------------------------------------------------------------
// Support-tier scaffold — which on-screen / instructional helps are withdrawn.
// INVARIANT: a tier only removes scaffolding; it never touches the passage, the
// figurative instances, their types, or the score. Gemini still authors all the
// content — these flags only change how it is PRESENTED to the student.
//
// Levers (multi-step solver: Find → Classify → Interpret → Review):
//   #1 perception   prehighlightInstances — easy pre-cues the figurative spans in
//                   the Find phase so locating them is confirmation, not discovery;
//                   hard withdraws the cue (the student scans plain prose).
//   #5 answer-form  reduceClassifyDistractors — easy tightens the classify chip set
//                   (still contains EVERY correct type present, so no answer is made
//                   unselectable); hard offers the full type menu.
//   #2 instruction  nameStrategyInHints — easy names the signal words / strategy for
//                   the types in play; medium/hard withdraw the named strategy so the
//                   student recognizes the device unaided.
// ---------------------------------------------------------------------------

interface FigurativeLanguageFinderSupportScaffold {
  prehighlightInstances: boolean;
  reduceClassifyDistractors: boolean;
  nameStrategyInHints: boolean;
  promptLines: string[];
}

function resolveSupportStructure(tier: SupportTier): FigurativeLanguageFinderSupportScaffold {
  const lead =
    'This tier changes ONLY how much on-screen / instructional help the student gets. '
    + 'It NEVER changes the passage, the figurative phrases, their types, or the answer.';

  // Perception cue and named strategy are full help at easy, withdrawn by hard.
  const prehighlightInstances = tier === 'easy';
  const nameStrategyInHints = tier === 'easy';
  // Distractor reduction (answer-form): easy AND medium trim the chip set; hard
  // shows the full type menu. The set always keeps every correct type present.
  const reduceClassifyDistractors = tier !== 'hard';

  return {
    prehighlightInstances,
    nameStrategyInHints,
    reduceClassifyDistractors,
    promptLines: [
      lead,
      `In the Find phase the figurative phrases are ${prehighlightInstances ? 'pre-cued (faintly marked) so the student confirms them' : 'NOT marked — the student locates them in plain prose'}.`,
      `In the Classify phase the type-choice chips are ${reduceClassifyDistractors ? 'reduced to a tighter set (still containing every correct type)' : 'the full type menu, so more distractor types compete'}.`,
      `The signal words / strategy for each device are ${nameStrategyInHints ? 'named as a "what to look for" cue' : 'NOT named — the student recognizes each device unaided'}.`,
      'Keep the title and passage neutral — never state the support level, and never reveal which phrases are figurative or what type they are in the title/description.',
    ],
  };
}

const figurativeLanguageFinderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the figurative language activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('3' through '6')" },
    passage: { type: Type.STRING, description: "Rich passage with embedded figurative language (6-12 sentences)" },
    instances: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          instanceId: { type: Type.STRING },
          text: { type: Type.STRING, description: "The figurative phrase as it appears in the passage" },
          type: { type: Type.STRING, enum: ["simile", "metaphor", "personification", "hyperbole", "idiom", "alliteration", "onomatopoeia", "imagery"] },
          literalMeaning: { type: Type.STRING, description: "What the phrase literally means" },
          explanation: { type: Type.STRING, description: "Why this is classified as this type" },
        },
        required: ["instanceId", "text", "type", "literalMeaning", "explanation"]
      }
    },
    translateInstanceIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 instance IDs that students must write literal translations for" },
    availableTypes: { type: Type.ARRAY, items: { type: Type.STRING, enum: ["simile", "metaphor", "personification", "hyperbole", "idiom", "alliteration", "onomatopoeia", "imagery"] } },
  },
  required: ["title", "gradeLevel", "passage", "instances", "translateInstanceIds", "availableTypes"]
};

/** SP-8 fix: LLMs can't compute character offsets — derive from passage.indexOf() */
function recomputeOffsets(data: FigurativeLanguageFinderData): void {
  const { passage, instances } = data;
  if (!passage || !instances) return;

  for (const inst of instances) {
    const idx = passage.indexOf(inst.text);
    if (idx >= 0) {
      inst.startIndex = idx;
      inst.endIndex = idx + inst.text.length;
    } else {
      console.warn(`[FigurativeLanguageFinder] recomputeOffsets: "${inst.text}" not found in passage`);
      inst.startIndex = 0;
      inst.endIndex = 0;
    }
  }
}

/** HARD distractor lever (axis 2, code-enforced): build a classify choice set
 *  that pits each correct type against its NEAREST confusable neighbour(s), so the
 *  student must truly discriminate rather than eliminate. INVARIANT: every correct
 *  type present in the passage stays in the set (no answer made unselectable);
 *  added chips are the near-types, padded from availableTypes only if a near-type
 *  isn't grade-legal. Returns undefined if it would not actually grow the
 *  discrimination load beyond the correct set (degenerate → full menu stands). */
function buildNearDistractorChoices(
  instances: FigurativeLanguageFinderData['instances'],
  availableTypes: FigurativeType[],
): FigurativeType[] | undefined {
  const correct = Array.from(new Set(instances.map((i) => i.type))).filter((t) => availableTypes.includes(t));
  if (correct.length === 0) return undefined;
  const chosen = new Set<FigurativeType>(correct);
  // Pull in each correct type's nearest confusables that are grade-legal.
  for (const t of correct) {
    for (const near of NEAR_TYPES[t]) {
      if (availableTypes.includes(near)) chosen.add(near);
    }
  }
  // Need at least one genuine distractor beyond the correct set for discrimination.
  if (chosen.size <= correct.length) {
    // No near-type was grade-legal — pad with the next available type so the chip
    // set still poses a choice (keeps the floor: a classify task needs ≥1 wrong chip).
    for (const t of availableTypes) {
      if (chosen.size > correct.length) break;
      chosen.add(t);
    }
  }
  if (chosen.size <= correct.length) return undefined; // truly degenerate
  // Cap so we don't just rebuild the full menu (that's "no lever"); keep it tight
  // around the confusable cluster — at most correct + 3 near distractors.
  if (chosen.size >= availableTypes.length) return undefined;
  // Preserve availableTypes ordering for a stable legend↔chip relationship.
  return availableTypes.filter((t) => chosen.has(t));
}

/** Build the tier-reduced classify choice set: every correct type PRESENT in the
 *  passage (so no answer is unselectable) plus padding from availableTypes up to a
 *  cap, shuffled-stable by availableTypes order. Returns undefined if it would not
 *  actually reduce the menu (already saturated → no lever, full menu stands). */
function buildReducedClassifyChoices(
  instances: FigurativeLanguageFinderData['instances'],
  availableTypes: FigurativeType[],
): FigurativeType[] | undefined {
  const correct = Array.from(new Set(instances.map((i) => i.type)));
  // Target: the correct types + a couple of distractors, but at least 3 so the
  // student still discriminates, and strictly fewer than the full menu.
  const target = Math.max(3, Math.min(correct.length + 2, availableTypes.length));
  if (target >= availableTypes.length) return undefined; // no genuine reduction
  const chosen = new Set<FigurativeType>(correct.filter((t) => availableTypes.includes(t)));
  for (const t of availableTypes) {
    if (chosen.size >= target) break;
    chosen.add(t);
  }
  // Preserve availableTypes ordering for a stable legend↔chip relationship.
  return availableTypes.filter((t) => chosen.has(t));
}

export const generateFigurativeLanguageFinder = async (
  topic: string,
  gradeLevel: string = '4',
  config?: Partial<FigurativeLanguageFinderData & {
    targetEvalMode: string;
    /** Per-component tier from the manifest ('easy'|'medium'|'hard'). Second field of
     *  the contract: difficulty = how much scaffolding (axis 1) AND how hard a problem
     *  structurally (axis 2: instance count + distractor confusability). Stays in-band
     *  and in-mode — never changes magnitude or which eval mode this is. */
    difficulty?: string;
  }>
): Promise<FigurativeLanguageFinderData> => {
  const evalConstraint = resolveEvalModeConstraint(
    'figurative-language-finder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('FigurativeLanguageFinder', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(figurativeLanguageFinderSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        arrayName: 'instances',
      })
    : figurativeLanguageFinderSchema;

  const gradeLevelKey = ['3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '4';

  const gradeNotes: Record<string, string> = {
    '3': 'Grade 3: Focus on SIMILE (like/as) and ALLITERATION only. 3-4 instances. Simple passage. "What does it REALLY mean?" focus.',
    '4': 'Grade 4: Simile, METAPHOR, PERSONIFICATION, HYPERBOLE. 4-5 instances. Teach simile vs metaphor distinction.',
    '5': 'Grade 5: Add IDIOM, IMAGERY, ONOMATOPOEIA. 5-6 instances. Sensory language emphasis.',
    '6': 'Grade 6: All 8 types. Extended metaphor. How figurative language creates tone/mood. 5-7 instances.',
  };

  const typesByGrade: Record<string, FigurativeType[]> = {
    '3': ['simile', 'alliteration'],
    '4': ['simile', 'metaphor', 'personification', 'hyperbole'],
    '5': ['simile', 'metaphor', 'personification', 'hyperbole', 'idiom', 'imagery', 'onomatopoeia'],
    '6': ['simile', 'metaphor', 'personification', 'hyperbole', 'idiom', 'alliteration', 'onomatopoeia', 'imagery'],
  };

  const availableTypes = typesByGrade[gradeLevelKey] || typesByGrade['4'];

  const activeTypes = evalConstraint
    ? evalConstraint.allowedTypes as FigurativeType[]
    : availableTypes;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Within-mode tier (config.difficulty): axis 1 scaffolding level + axis 2
  //    problem shape. Withdrawal + shape enforcement happen deterministically on the
  //    result below; tierSection nudges the LLM (neutral title, target instance
  //    count, near-distractor cluster) — but the code is authoritative. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: FigurativeType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as FigurativeType)
      : undefined;
  // Grade-scope instance ceiling (cap for the structural instanceCount lever).
  const INSTANCE_CAP_BY_GRADE: Record<string, number> = { '3': 4, '4': 5, '5': 6, '6': 7 };
  const instanceCap = INSTANCE_CAP_BY_GRADE[gradeLevelKey] ?? 5;
  const tierScaffold = supportTier ? resolveSupportStructure(supportTier) : null;
  // Axis 2: structural problem shape (instance count + distractor confusability),
  // clamped to the grade band. Merged into ONE coherent tier prompt section so the
  // LLM sees both axes as a single "what 'hard' means here," not competing knobs.
  const tierShape = supportTier ? resolveProblemShape(supportTier, instanceCap) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE TIER (config.difficulty — scaffolding level + problem shape)\n${[
        ...tierScaffold.promptLines,
        ...(tierShape?.promptLines ?? []),
      ].map((l) => `- ${l}`).join('\n')}\n`
    : '';
  void pinnedType; // pinnedType drives prompt TONE only — the scaffold is type-agnostic.

  const prompt = `Create a figurative language identification activity about: "${topic}".
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['4']}

AVAILABLE TYPES for this grade: ${activeTypes.join(', ')}
${challengeTypeSection}
${tierSection}
Rules:
1. Write a passage that naturally embeds figurative language instances
2. Each instance "text" must be the EXACT substring as it appears in the passage (verbatim, case-sensitive)
3. Each instance must have a clear literal meaning and explanation
4. translateInstanceIds: pick 2-3 of the most interesting instances for literal translation
5. availableTypes: include all types available at this grade (even if not all used in the passage)`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 language arts instructor specializing in figurative language and literary devices. You create engaging passages rich in figurative language with clear, age-appropriate examples. Each instance "text" must be copied VERBATIM from the passage. Literal meanings are written in student-friendly language.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as FigurativeLanguageFinderData;
    recomputeOffsets(result);
    const { targetEvalMode: _unused, difficulty: _unusedDifficulty, ...configRest } = config ?? {};
    void _unused;
    void _unusedDifficulty;
    const merged: FigurativeLanguageFinderData = { ...result, ...configRest };

    // ── Within-mode tier: axis 1 withdraws on-screen/instructional scaffolding;
    //    axis 2 reshapes the problem (instance count + distractor confusability).
    //    Applied AFTER offset recompute and the config merge. Gated solely on
    //    supportTier so the no-tier path stays BYTE-IDENTICAL — a blended/auto
    //    session is a student property too. Axis 2 NEVER changes magnitude (passage
    //    length, legal types) or the eval mode; only shape, within the grade band. ──
    if (supportTier) {
      const sc = resolveSupportStructure(supportTier);
      const shape = resolveProblemShape(supportTier, instanceCap);
      merged.prehighlightInstances = sc.prehighlightInstances;
      merged.nameStrategyInHints = sc.nameStrategyInHints;

      // ── AXIS 2 lever A — instanceCount (structural). COUNT the LLM's actual
      //    instances → HONOR when already at/below target → otherwise TRIM
      //    deterministically to the target. We never FABRICATE instances in code
      //    (each needs verbatim passage text + literal meaning + explanation;
      //    synthesizing those would desync the passage), so over-production is
      //    trimmed to the in-band target and under-production saturates honestly
      //    (the prompt asked for exactly `instanceCount`). Trimming preserves the
      //    earliest spans so the passage still reads coherently. ──
      const allInstances = merged.instances ?? [];
      const target = shape.instanceCount;
      if (allInstances.length > target) {
        // Keep the FIRST `target` instances by passage order (offsets already set).
        const ordered = [...allInstances].sort(
          (a, b) => (a.startIndex ?? 0) - (b.startIndex ?? 0),
        );
        const keep = new Set(ordered.slice(0, target).map((i) => i.instanceId));
        merged.instances = allInstances.filter((i) => keep.has(i.instanceId));
        // Answer-bearing: drop translate targets that pointed at trimmed instances.
        merged.translateInstanceIds = (merged.translateInstanceIds ?? []).filter((id) =>
          keep.has(id),
        );
        // If trimming emptied the translate set, re-seed from the survivors (2-3).
        if ((merged.translateInstanceIds?.length ?? 0) === 0) {
          merged.translateInstanceIds = merged.instances
            .slice(0, Math.min(3, merged.instances.length))
            .map((i) => i.instanceId);
        }
      }

      // ── AXIS 2 lever B (hard) / AXIS 1 answer-form lever (easy/medium) —
      //    classify chip set. Both keep every correct type present (no answer
      //    unselectable). At hard the structural lever PITS correct types against
      //    their nearest confusables (discrimination, not elimination); at
      //    easy/medium the scaffolding lever trims to a tight set. ──
      const liveInstances = merged.instances ?? [];
      const liveTypes = merged.availableTypes ?? [];
      if (shape.useNearDistractors) {
        // Hard: discrimination set (correct + nearest confusables), code-enforced.
        merged.classifyTypeChoices = buildNearDistractorChoices(liveInstances, liveTypes);
      } else if (sc.reduceClassifyDistractors) {
        merged.classifyTypeChoices = buildReducedClassifyChoices(liveInstances, liveTypes);
      } else {
        merged.classifyTypeChoices = undefined; // full menu fallback
      }

      console.log(
        `[figurative-language-finder] Tier "${supportTier}" applied — `
        + `instanceCount target ${target} (have ${liveInstances.length}), `
        + `distractors=${shape.useNearDistractors ? 'near-confusable' : (sc.reduceClassifyDistractors ? 'reduced' : 'full')} `
        + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
      );
    }

    return merged;
  } catch (error) {
    console.error("Error generating figurative language finder:", error);
    throw error;
  }
};
