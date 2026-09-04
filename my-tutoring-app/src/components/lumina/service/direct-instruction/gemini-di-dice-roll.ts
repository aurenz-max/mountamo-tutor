/**
 * Fork-A generator for the DI Dice Roll primitive.
 *
 * Gemini writes answer-free session chrome only. Code owns the eval-mode
 * selection, tier-shaped finalized dice, relations, totals, answer words,
 * and aliases.
 */

import { Schema, Type } from '@google/genai';
import type {
  DiceComparison,
  DiDiceRollChallenge,
  DiDiceRollChallengeType,
  DiDiceRollData,
  DiDiceRollSupportTier,
  DieValue,
} from '../../primitives/visual-primitives/direct-instruction/DiDiceRoll';
import { ai } from '../geminiClient';
import {
  buildModeConstraintSection,
  resolveEvalModes,
  type ChallengeTypeDoc,
} from '../evalMode';

const DEFAULT_INSTANCE_COUNT = 5;
const MIN_INSTANCE_COUNT = 3;
const MAX_INSTANCE_COUNT = 6;

const DEFAULT_TITLE = 'Dice Time';
const DEFAULT_DESCRIPTION = 'Roll, look at the dots, and answer out loud!';

const DIE_VALUES: readonly DieValue[] = [1, 2, 3, 4, 5, 6];
const ALL_TYPES: readonly DiDiceRollChallengeType[] = [
  'count_pips',
  'compare_dice',
  'sum_two_dice',
];

const NUMBER_WORDS: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
};

export const DI_DICE_ROLL_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  count_pips: {
    promptDoc:
      '"count_pips": roll one six-sided die, inspect its pip pattern, and say the quantity as a number word.',
    schemaDescription: "'count_pips' (say one die's pip quantity)",
  },
  compare_dice: {
    promptDoc:
      '"compare_dice": roll two dice, compare their pip quantities, and say left, right, or same.',
    schemaDescription: "'compare_dice' (say which die has more)",
  },
  sum_two_dice: {
    promptDoc:
      '"sum_two_dice": roll two dice, combine both visible pip sets, and say the total as a number word.',
    schemaDescription: "'sum_two_dice' (say the total of two dice)",
  },
};

type SupportTier = DiDiceRollSupportTier;
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup: unknown or absent values leave the pre-L3 behavior intact. */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const value = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(value)
    ? (value as SupportTier)
    : null;
}

/**
 * Dice Roll is a code-owned DI pack, so the support structure is consumed by
 * the exact script rather than delegated to Gemini. The mode-specific wording
 * lives in diDiceRollScript; this resolver owns the shared tier contract.
 */
const resolveSupportStructure = (
  _type: DiDiceRollChallengeType,
  tier: SupportTier,
): { tier: SupportTier; describe: string } => ({
  tier,
  describe: tier === 'hard'
    ? 'answer cold; correction re-models without an added strategy'
    : tier === 'medium'
      ? 'answer cold; correction adds one brief strategy reminder'
      : 'answer cold; correction adds an explicit one-to-one strategy',
});

type SumStepPosition = 'short' | 'middle' | 'long';

interface ProblemShape {
  /** Exact non-tie gap. Ties stay ties so the comparison mode keeps its full relation set. */
  compareGap?: 1 | 2 | 3;
  /** Rank within the total-preserving set of possible right-die addends. */
  sumStepPosition?: SumStepPosition;
  promptLines: string[];
  describe: string;
}

/**
 * L4's single source of truth. The tier describes the private structural
 * intent supplied to Gemini and also drives the code-owned pair reconstruction.
 * count_pips deliberately has no structural lever: changing its face range
 * would be numeric difficulty, while adding a die would change eval mode.
 */
const resolveProblemShape = (
  type: DiDiceRollChallengeType,
  tier: SupportTier,
): ProblemShape => {
  if (type === 'compare_dice') {
    const compareGap = tier === 'easy' ? 3 : tier === 'medium' ? 2 : 1;
    return {
      compareGap,
      promptLines: [
        tier === 'easy'
          ? 'Use clearly separated non-tie dot quantities.'
          : tier === 'medium'
            ? 'Use moderately separated non-tie dot quantities.'
            : 'Use adjacent non-tie dot quantities that require careful comparison.',
      ],
      describe: `non-tie comparison gap ${compareGap}`,
    };
  }

  if (type === 'sum_two_dice') {
    const sumStepPosition: SumStepPosition = tier === 'easy'
      ? 'short'
      : tier === 'medium'
        ? 'middle'
        : 'long';
    return {
      sumStepPosition,
      promptLines: [
        `Keep each total fixed while using a ${sumStepPosition} right-die count-on path.`,
      ],
      describe: `${sumStepPosition} total-preserving count-on path`,
    };
  }

  return {
    promptLines: [
      'Keep one-die quantity recognition structurally unchanged; only its support scaffold varies.',
    ],
    describe: 'no honest in-mode structural lever',
  };
};

const buildTierPromptSection = (
  types: readonly DiDiceRollChallengeType[],
  tier: SupportTier | null,
): string => {
  if (!tier) return '';
  const lines = types.flatMap((type) => resolveProblemShape(type, tier).promptLines);
  return `\nPRIVATE DIFFICULTY DESIGN (never mention this in learner-facing chrome):\n${
    lines.map((line) => `- ${line}`).join('\n')
  }\nThe tier may reshape in-mode structure, but it never changes the eval mode or dice/total bands.`;
};

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'A short, warm title. Do not print any digit or number word.',
    },
    description: {
      type: Type.STRING,
      description:
        'One friendly sentence about rolling, looking at dots, and answering aloud. '
        + 'Do not print any digit or number word.',
    },
  },
  required: ['title', 'description'],
};

type FacePair = readonly [DieValue, DieValue];

interface ChallengeBlueprint {
  type: DiDiceRollChallengeType;
  pair: FacePair;
}

interface ShapeApplication {
  blueprint: ChallengeBlueprint;
  target: string;
  actual: string;
}

const normalizedCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_INSTANCE_COUNT;
  return Math.min(MAX_INSTANCE_COUNT, Math.max(MIN_INSTANCE_COUNT, Math.floor(value)));
};

/** Small deterministic PRNG for reproducible authored and QA sessions. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T,>(source: readonly T[], random: () => number): T[] => {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
};

const isDieValue = (value: unknown): value is DieValue =>
  typeof value === 'number'
  && Number.isInteger(value)
  && value >= 1
  && value <= 6;

const controlledValues = (value: unknown, count: number): DieValue[] | null => {
  if (!Array.isArray(value) || value.length < count) return null;
  const selected = value.slice(0, count);
  return selected.every(isDieValue) ? selected : null;
};

const controlledPairs = (value: unknown, count: number): FacePair[] | null => {
  if (!Array.isArray(value) || value.length < count) return null;
  const selected = value.slice(0, count);
  if (!selected.every((pair) =>
    Array.isArray(pair)
    && pair.length === 2
    && isDieValue(pair[0])
    && isDieValue(pair[1]))) return null;
  return selected.map((pair) => [pair[0], pair[1]] as FacePair);
};

const countPool = (count: number, random: () => number): FacePair[] => {
  const values = shuffle(DIE_VALUES, random).slice(0, count);
  if (!values.some((value) => value <= 3)) {
    values[values.length - 1] = shuffle(DIE_VALUES.filter((value) => value <= 3), random)[0];
  } else if (!values.some((value) => value >= 4)) {
    values[values.length - 1] = shuffle(DIE_VALUES.filter((value) => value >= 4), random)[0];
  }
  return values.map((value) => [value, value]);
};

const comparisonFor = ([left, right]: FacePair): DiceComparison =>
  left === right ? 'same' : left > right ? 'left' : 'right';

const comparisonGap = ([left, right]: FacePair): number => Math.abs(left - right);
const pairKey = ([left, right]: FacePair): string => `${left}:${right}`;

/** Preserve the relation when possible while moving a non-tie pair to the exact tier gap. */
const reshapeComparisonPair = (
  pair: FacePair,
  targetGap: 1 | 2 | 3,
  usedPairs: ReadonlySet<string>,
): FacePair => {
  const relation = comparisonFor(pair);
  if (
    (relation === 'same' || comparisonGap(pair) === targetGap)
    && !usedPairs.has(pairKey(pair))
  ) return pair;

  const candidates: FacePair[] = DIE_VALUES.flatMap((left) =>
    DIE_VALUES
      .filter((right) =>
        comparisonFor([left, right]) === relation
        && Math.abs(left - right) === targetGap)
      .map((right) => [left, right] as FacePair));

  const sorted = candidates.sort((a, b) => {
    const distanceA = Math.abs(a[0] - pair[0]) + Math.abs(a[1] - pair[1]);
    const distanceB = Math.abs(b[0] - pair[0]) + Math.abs(b[1] - pair[1]);
    return distanceA - distanceB || a[0] - b[0] || a[1] - b[1];
  });
  const unusedSameRelation = sorted.find((candidate) => !usedPairs.has(pairKey(candidate)));
  if (unusedSameRelation) return unusedSameRelation;

  // Easy's gap-three band has only three pairs per direction. A six-item run
  // can exhaust one direction; use the opposite direction before duplicating,
  // then rebuild the answer from the finalized pair.
  const unusedExactGap = DIE_VALUES.flatMap((left) =>
    DIE_VALUES
      .filter((right) => left !== right && Math.abs(left - right) === targetGap)
      .map((right) => [left, right] as FacePair))
    .filter((candidate) => !usedPairs.has(pairKey(candidate)))
    .sort((a, b) => {
      const distanceA = Math.abs(a[0] - pair[0]) + Math.abs(a[1] - pair[1]);
      const distanceB = Math.abs(b[0] - pair[0]) + Math.abs(b[1] - pair[1]);
      return distanceA - distanceB || a[0] - b[0] || a[1] - b[1];
    })[0];

  return unusedExactGap
    ?? sorted[0]
    ?? pair;
};

/**
 * Keep the answer magnitude byte-for-byte while changing only how many pips
 * the learner must count on across the right die. Small/extreme totals
 * honestly saturate when their 1..6 face band offers fewer decompositions.
 */
const reshapeSumPair = (pair: FacePair, position: SumStepPosition): FacePair => {
  const total = pair[0] + pair[1];
  const candidates = DIE_VALUES
    .filter((right) => isDieValue(total - right))
    .map((right) => [total - right, right] as FacePair);
  const targetIndex = position === 'short'
    ? 0
    : position === 'long'
      ? candidates.length - 1
      : Math.floor((candidates.length - 1) / 2);
  const selected = candidates[targetIndex] ?? pair;
  return pair[0] === selected[0] && pair[1] === selected[1] ? pair : selected;
};

const applyProblemShape = (
  blueprint: ChallengeBlueprint,
  tier: SupportTier,
  usedComparisonPairs: Set<string>,
): ShapeApplication => {
  const shape = resolveProblemShape(blueprint.type, tier);
  if (blueprint.type === 'compare_dice' && shape.compareGap) {
    const pair = reshapeComparisonPair(blueprint.pair, shape.compareGap, usedComparisonPairs);
    usedComparisonPairs.add(pairKey(pair));
    return {
      blueprint: { ...blueprint, pair },
      target: comparisonFor(blueprint.pair) === 'same'
        ? 'tie preserved'
        : `gap ${shape.compareGap}`,
      actual: comparisonFor(pair) === 'same' ? 'tie' : `gap ${comparisonGap(pair)}`,
    };
  }
  if (blueprint.type === 'sum_two_dice' && shape.sumStepPosition) {
    const originalTotal = blueprint.pair[0] + blueprint.pair[1];
    const pair = reshapeSumPair(blueprint.pair, shape.sumStepPosition);
    return {
      blueprint: { ...blueprint, pair },
      target: `${shape.sumStepPosition} count-on path; total ${originalTotal} preserved`,
      actual: `right die ${pair[1]}; total ${pair[0] + pair[1]}`,
    };
  }
  return {
    blueprint,
    target: shape.describe,
    actual: 'unchanged',
  };
};

const applyProblemShapes = (
  blueprints: readonly ChallengeBlueprint[],
  tier: SupportTier,
): ShapeApplication[] => {
  const usedComparisonPairs = new Set<string>();
  return blueprints.map((blueprint) =>
    applyProblemShape(blueprint, tier, usedComparisonPairs));
};

/** A pinned comparison run includes left, right, and equal relations. */
const comparePool = (count: number, random: () => number): FacePair[] => {
  const allPairs: FacePair[] = DIE_VALUES.flatMap((left) =>
    DIE_VALUES.map((right) => [left, right] as FacePair));
  const groups: Record<DiceComparison, FacePair[]> = {
    left: allPairs.filter((pair) => comparisonFor(pair) === 'left'),
    right: allPairs.filter((pair) => comparisonFor(pair) === 'right'),
    same: allPairs.filter((pair) => comparisonFor(pair) === 'same'),
  };
  const selected = (['left', 'right', 'same'] as DiceComparison[])
    .slice(0, Math.min(3, count))
    .map((relation) => shuffle(groups[relation], random)[0]);
  const used = new Set(selected.map(([left, right]) => `${left}:${right}`));
  const remaining = shuffle(allPairs, random).filter(
    ([left, right]) => !used.has(`${left}:${right}`),
  );
  return [...selected, ...remaining].slice(0, count);
};

/** Unique totals make every pinned addition item semantically distinct. */
const sumPool = (count: number, random: () => number): FacePair[] => {
  const totals = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], random).slice(0, count);
  if (!totals.some((total) => total <= 6)) totals[totals.length - 1] = 6;
  if (!totals.some((total) => total >= 7)) totals[totals.length - 1] = 7;
  return totals.map((total) => {
    const candidates: FacePair[] = DIE_VALUES.flatMap((left) =>
      DIE_VALUES
        .filter((right) => left + right === total)
        .map((right) => [left, right] as FacePair));
    return shuffle(candidates, random)[0];
  });
};

const distribute = (total: number, groups: number): number[] => {
  const base = Math.floor(total / groups);
  const remainder = total % groups;
  return Array.from({ length: groups }, (_, index) => base + (index < remainder ? 1 : 0));
};

const buildBlueprints = (
  type: DiDiceRollChallengeType,
  count: number,
  random: () => number,
  config: { values?: number[]; pairs?: number[][] },
): ChallengeBlueprint[] => {
  if (type === 'count_pips') {
    const injected = config.values === undefined ? null : controlledValues(config.values, count);
    if (config.values !== undefined && injected === null) {
      console.warn(
        `[DiDiceRoll] Ignoring invalid controlled values; expected at least ${count} integers from 1 through 6.`,
      );
    }
    const pairs = injected?.map((value) => [value, value] as FacePair) ?? countPool(count, random);
    return pairs.map((pair) => ({ type, pair }));
  }

  const injected = config.pairs === undefined ? null : controlledPairs(config.pairs, count);
  if (config.pairs !== undefined && injected === null) {
    console.warn(
      `[DiDiceRoll] Ignoring invalid controlled pairs; expected at least ${count} two-value pairs from 1 through 6.`,
    );
  }
  const pairs = injected
    ?? (type === 'compare_dice' ? comparePool(count, random) : sumPool(count, random));
  return pairs.map((pair) => ({ type, pair }));
};

const buildChallenge = (
  blueprint: ChallengeBlueprint,
  index: number,
): DiDiceRollChallenge => {
  const [value, secondValue] = blueprint.pair;

  if (blueprint.type === 'compare_dice') {
    const comparison = comparisonFor(blueprint.pair);
    const asrAliases = comparison === 'same'
      ? ['same', 'equal', 'tie', 'they are equal']
      : [comparison, `the ${comparison} one`, `the ${comparison} die`];
    return {
      id: `didr-${index + 1}`,
      challengeType: 'compare_dice',
      action: 'compare_dice',
      answerKind: 'voice',
      responseClass: 'short_spoken_word',
      sides: 6,
      value,
      secondValue,
      comparison,
      spokenAnswer: comparison,
      asrAliases,
    };
  }

  if (blueprint.type === 'sum_two_dice') {
    const total = value + secondValue;
    const spokenAnswer = NUMBER_WORDS[total];
    return {
      id: `didr-${index + 1}`,
      challengeType: 'sum_two_dice',
      action: 'sum_two_dice',
      answerKind: 'voice',
      responseClass: 'number_word_to_20',
      sides: 6,
      value,
      secondValue,
      total,
      spokenAnswer,
      asrAliases: [spokenAnswer, String(total)],
    };
  }

  const spokenAnswer = NUMBER_WORDS[value];
  return {
    id: `didr-${index + 1}`,
    challengeType: 'count_pips',
    action: 'count_pips',
    answerKind: 'voice',
    responseClass: 'number_word_to_20',
    sides: 6,
    value,
    spokenAnswer,
    asrAliases: [spokenAnswer, String(value)],
  };
};

/** Any possible numeric answer in session chrome would pre-teach a response. */
const leaksAnswer = (text: string): boolean =>
  /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i.test(text);

export const generateDiDiceRoll = async (
  topic: string,
  gradeLevel: string,
  config?: {
    /** Eval mode pin; a `|`-joined value is a curated blend. */
    targetEvalMode?: string;
    /** Within-mode support + structure. Never changes task identity or magnitude bands. */
    difficulty?: string;
    /** Component intent is the primary unpinned routing signal. */
    intent?: string;
    /** Parent objective text is the secondary unpinned routing signal. */
    objectiveText?: string;
    challengeCount?: number;
    /** Deterministic one-die values for count_pips. */
    values?: number[];
    /** Deterministic two-die values for compare_dice and sum_two_dice. */
    pairs?: number[][];
    /** Reproducible local-pool seed. */
    seed?: number;
    [key: string]: unknown;
  },
): Promise<DiDiceRollData> => {
  const count = normalizedCount(config?.challengeCount);
  const resolution = await resolveEvalModes(
    'di-dice-roll',
    {
      targetEvalMode: config?.targetEvalMode,
      intent: config?.intent,
      objectiveText: config?.objectiveText,
    },
    DI_DICE_ROLL_TYPE_DOCS,
  );
  const allowed = new Set(
    (resolution?.allowedTypes as DiDiceRollChallengeType[] | undefined) ?? ALL_TYPES,
  );
  const modeTypes = ALL_TYPES.filter((type) => allowed.has(type));
  const selectedTypes = modeTypes.length > 0 ? modeTypes : [...ALL_TYPES];
  const supportTier = normalizeSupportTier(config?.difficulty);
  const seed = typeof config?.seed === 'number' && Number.isFinite(config.seed)
    ? config.seed
    : undefined;
  const random = seed === undefined ? Math.random : mulberry32(seed);
  const shares = distribute(count, selectedTypes.length);

  // Single pin -> one task throughout. Blend/mixed -> every selected task is
  // represented, ordered from the catalog's concrete rung toward composition.
  const baseBlueprints = selectedTypes.flatMap((type, index) =>
    buildBlueprints(type, shares[index], random, {
      values: config?.values,
      pairs: config?.pairs,
    }));
  const shapeApplications = supportTier
    ? applyProblemShapes(baseBlueprints, supportTier)
    : null;
  const blueprints = shapeApplications
    ? shapeApplications.map(({ blueprint }) => blueprint)
    : baseBlueprints;
  const challenges = blueprints.map(buildChallenge);

  // Difficulty is a student property, so stamp every challenge in a blended
  // run from its own mode. With no valid tier, the old payload stays untouched.
  if (supportTier) {
    for (const challenge of challenges) {
      challenge.supportTier = resolveSupportStructure(
        challenge.challengeType,
        supportTier,
      ).tier;
    }
    console.log(
      `[DiDiceRoll] Support tier "${supportTier}" applied per-challenge (${
        selectedTypes.length === 1 ? `single-mode ${selectedTypes[0]}` : 'blended'
      }): ${resolveSupportStructure(selectedTypes[0] ?? 'count_pips', supportTier).describe}.`,
    );
    shapeApplications?.forEach(({ blueprint, target, actual }, index) => {
      console.log(
        `[DiDiceRoll] Structural tier item ${index + 1} (${blueprint.type}): target ${target}; actual ${actual}.`,
      );
    });
  }

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  const modeSection = buildModeConstraintSection(resolution, DI_DICE_ROLL_TYPE_DOCS);
  const tierSection = buildTierPromptSection(selectedTypes, supportTier);

  const prompt = `Write answer-free session chrome for a brisk early-math dice-dot activity.

TOPIC: "${topic}"${config?.intent ? `\nOBJECTIVE FOCUS: "${config.intent}"` : ''}

The code-owned activity uses this task scope:
${modeSection}${tierSection}

Write a short, warm title and one friendly description about rolling, looking at dots, and
answering aloud. Do not include any digit or any number word; those are judged answers.
Do not describe a specific die face, total, or correct comparison. Return only wrapper JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: wrapperSchema,
        systemInstruction:
          'You write answer-free activity chrome for a young learner. You never include a '
          + 'digit or number word. You do not choose dice, relations, totals, answers, or lesson wording.',
      },
    });
    if (response.text) {
      const parsed = JSON.parse(response.text) as { title?: unknown; description?: unknown };
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
    }
  } catch (error) {
    console.error('Error generating di-dice-roll wrapper:', error);
  }

  if (leaksAnswer(title) || leaksAnswer(description)) {
    title = DEFAULT_TITLE;
    description = DEFAULT_DESCRIPTION;
  }

  const data: DiDiceRollData = {
    title,
    description,
    challengeType: challenges[0]?.challengeType ?? 'count_pips',
    gradeLevel: gradeLevel || 'kindergarten',
    challenges,
  };

  console.log('DI Dice Roll Generated:', {
    title: data.title,
    modes: resolution
      ? `${resolution.modes.map((mode) => mode.evalMode).join('+')} (${resolution.source})`
      : 'mixed',
    types: selectedTypes.join(', '),
    count: data.challenges.length,
  });

  return data;
};
