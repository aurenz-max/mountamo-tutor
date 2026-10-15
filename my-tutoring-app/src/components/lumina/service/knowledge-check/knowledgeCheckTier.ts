/**
 * Requested difficulty for generated knowledge-check problems (`config.difficulty` from a lesson or Pulse).
 *
 * An objective with an item space gets its problems picked by code (service/itemSpace). Every other objective
 * (science, literacy, social studies, math with no strand) is written by the per-type generators, and this is
 * what makes easy / medium / hard differ there. The tier is a ladder within the grade, never above it: the
 * grade's reading load and the Grade-1 shape bounds still win. It changes two things:
 *   - the task: what the learner has to do with the idea, defined per subject (SUBJECT_LADDER);
 *   - the shape, where it can be counted: blanks, pairs, categories and items, steps, and how many wrong
 *     options are tempting (`distance` near) vs easy to rule out (far). Code checks these (checkTierShape).
 * The Bloom tier (eval mode) stays the KIND of thinking; this sets how hard that thinking is.
 */
import type { ProblemData } from '../../types';

export type KcTier = 'easy' | 'medium' | 'hard';
export type KcShape =
  | 'multiple_choice' | 'true_false' | 'fill_in_blanks'
  | 'matching_activity' | 'categorization_activity' | 'sequencing_activity';

/** What a per-type generator needs to write a problem at a requested tier. */
export interface KcTierRequest {
  difficulty: KcTier;
  /** The orchestrator's subject guess (MATHEMATICS, SCIENCE, LANGUAGE_ARTS, SOCIAL_STUDIES); absent on the direct path. */
  subject?: string;
}

export function normalizeKcTier(raw?: string): KcTier | undefined {
  const t = raw?.toLowerCase().trim();
  return t === 'easy' || t === 'medium' || t === 'hard' ? t : undefined;
}

const SUBJECT_LADDER: Record<string, { name: string; easy: string; medium: string; hard: string }> = {
  MATHEMATICS: {
    name: 'Math',
    easy: 'one step, with the numbers or picture given plainly (count it, read it, do the one operation the objective names).',
    medium: 'one step that first needs a translation: a short word problem, a picture or model to read, or the unknown in a less usual place.',
    hard: 'two linked steps, or check or explain a result (find the mistake, which answer is right and why), or compare two strategies. Numbers stay inside the objective\'s range.',
  },
  SCIENCE: {
    name: 'Science',
    easy: 'name or identify the idea in its most typical example (a fish lives in water; ice is a solid).',
    medium: 'apply the idea to a new everyday example, or sort an example the lesson did not show, or say what happens next.',
    hard: 'predict or explain a cause and effect, or judge a less typical example that tests the idea\'s edge (a cactus still needs water; sand pours but is a solid), or choose the observation that supports the idea.',
  },
  LANGUAGE_ARTS: {
    name: 'Reading and language',
    easy: 'the answer is stated directly or follows the most common pattern (a regular word, a detail said in one sentence, a word whose meaning the sentence gives outright).',
    medium: 'connect two sentences or clues, or use a less common pattern, or tell a key detail from a minor one.',
    hard: 'infer what is not stated, or tell apart two close answers (the main idea vs. an interesting detail; a clue that works by contrast), or handle an exception to the pattern.',
  },
  SOCIAL_STUDIES: {
    name: 'Social studies',
    easy: 'identify a person, place, symbol, or rule in its most familiar example.',
    medium: 'connect two facts (where and why, who and what they did), or apply the idea to a new local example.',
    hard: 'explain a cause and effect, compare two times, places, or points of view, or judge which choice fits a rule best.',
  },
};

const GENERIC = {
  easy: 'the question asks for the idea directly, in the lesson\'s own words, on a typical example.',
  medium: 'one step of reasoning: use the idea on a new example, or recognize it said in different words.',
  hard: 'two linked steps, a less typical example, or telling the idea apart from a close one.',
};

function band(gradeLevel: string, preciseGrade?: string): 'K' | 'G1' | 'elem' | 'upper' {
  if (preciseGrade === 'K' || ['toddler', 'preschool', 'kindergarten'].includes(gradeLevel)) return 'K';
  if (preciseGrade === '1') return 'G1';
  if (gradeLevel === 'elementary' || (preciseGrade && /^[2-5]$/.test(preciseGrade))) return 'elem';
  return 'upper';
}

/** Countable shape for a tier, already held to the grade's bounds. Fields absent = not counted for that shape. */
export interface TierShapeTarget {
  blanks?: number;
  pairs?: number;
  categories?: [number, number];
  items?: [number, number];
  steps?: number;
  /** Wrong MC options tagged `near`: [min, max]; every other wrong option is `far`. */
  near?: (wrongOptions: number) => [number, number];
}

const I = (t: KcTier, e: number, m: number, h: number) => (t === 'easy' ? e : t === 'medium' ? m : h);

export function tierShape(tier: KcTier, shape: KcShape, gradeLevel: string, preciseGrade?: string): TierShapeTarget {
  const b = band(gradeLevel, preciseGrade);
  switch (shape) {
    case 'multiple_choice':
      // R12 keeps at least one `far` option once there are 2+ wrong options (the drop_far_choice lever needs it).
      return {
        near: (w) => {
          const maxNear = w >= 2 ? w - 1 : w;
          if (tier === 'easy') return [0, Math.min(1, maxNear)];
          if (tier === 'medium') return [1, 1];
          return [maxNear, maxNear];
        },
      };
    case 'fill_in_blanks':
      return { blanks: b === 'G1' || b === 'K' ? 1 : I(tier, 1, 2, 3) };
    case 'matching_activity':
      return { pairs: b === 'G1' || b === 'K' ? 3 : b === 'elem' ? I(tier, 3, 4, 5) : I(tier, 4, 6, 8) };
    case 'categorization_activity':
      if (b === 'G1' || b === 'K') return { categories: [2, 2], items: tier === 'easy' ? [4, 4] : tier === 'medium' ? [5, 5] : [6, 6] };
      if (b === 'elem') return { categories: tier === 'hard' ? [3, 3] : [2, 2], items: tier === 'easy' ? [4, 5] : tier === 'medium' ? [6, 6] : [6, 8] };
      return { categories: tier === 'easy' ? [2, 2] : [3, 3], items: tier === 'easy' ? [6, 6] : tier === 'medium' ? [8, 8] : [8, 10] };
    case 'sequencing_activity':
      return { steps: b === 'G1' || b === 'K' ? I(tier, 3, 3, 4) : b === 'elem' ? I(tier, 3, 4, 5) : I(tier, 4, 5, 6) };
    default:
      return {};
  }
}

function shapeLine(t: TierShapeTarget, shape: KcShape, optionCount?: number): string {
  if (shape === 'multiple_choice' && t.near && optionCount) {
    const w = optionCount - 1;
    const [lo, hi] = t.near(w);
    const near = lo === hi ? `${lo}` : `${lo} to ${hi}`;
    return `Of the ${w} wrong options, tag exactly ${near} as "near" (a tempting mistake a learner who half-understood would pick) and the rest "far".`;
  }
  if (t.blanks) return `Use exactly ${t.blanks} blank${t.blanks > 1 ? 's' : ''}.`;
  if (t.pairs) return `Use exactly ${t.pairs} matching pairs.`;
  if (t.categories && t.items) {
    const [c0, c1] = t.categories; const [i0, i1] = t.items;
    return `Use ${c0 === c1 ? c0 : `${c0}-${c1}`} categories and ${i0 === i1 ? i0 : `${i0}-${i1}`} items to sort.`;
  }
  if (t.steps) return `Use exactly ${t.steps} steps to put in order.`;
  return '';
}

/** At K the option count is fixed at 3, so a tier is how close the wrong pictures are to the answer. */
const K_NEAR: Record<KcTier, string> = {
  easy: 'both wrong pictures are a different kind of thing from the answer (water vs. a hat and a ball; ball vs. moon and fish).',
  medium: 'one wrong picture is the same kind of thing as the answer, one a child could pick by mistake (water vs. juice; sun vs. ship; 5 vs. 4); the other is a different kind of thing.',
  hard: 'one wrong picture is the most common kindergarten mistake for this idea: something that seems right but is not (sunshine instead of water for a plant\'s drink; fan vs. van; a group that looks bigger because it is spread out). Never a toy or clothing.',
};

const TF_LINE: Record<KcTier, string> = {
  easy: 'The statement restates the idea plainly; a false statement swaps in something clearly wrong.',
  medium: 'The statement is about a new example of the idea, not a sentence from the lesson.',
  hard: 'The statement states a common misconception that sounds right, or turns on one key word (all/some, always/sometimes) the learner must check.',
};

/**
 * Prompt section for one problem at a requested tier. Placed after the grade section, so the grade is read first.
 */
export function buildKcTierPrompt(
  req: KcTierRequest | undefined, shape: KcShape, gradeLevel: string, preciseGrade?: string, optionCount?: number,
): string {
  if (!req) return '';
  const tier = req.difficulty;
  const ladder = req.subject ? SUBJECT_LADDER[req.subject] : undefined;
  const target = tierShape(tier, shape, gradeLevel, preciseGrade);
  const shapeRule = shape === 'true_false' ? TF_LINE[tier] : shapeLine(target, shape, optionCount);
  const taskLines = ladder
    ? `- ${ladder.name} at ${tier.toUpperCase()}: ${ladder[tier]}`
    : [`- In general: ${GENERIC[tier]}`,
      ...Object.values(SUBJECT_LADDER).map((l) => `- If the topic is ${l.name.toLowerCase()}: ${l[tier]}`)].join('\n');
  const ladderAll = ladder
    ? `(For reference: easy = ${ladder.easy} medium = ${ladder.medium} hard = ${ladder.hard})`
    : '';
  return `
## REQUESTED DIFFICULTY: ${tier.toUpperCase()} (set "difficulty" to "${tier}" on every problem)
Difficulty is a step WITHIN this grade. The grade section above still sets the words, sentence length, and option count; never make it harder with harder words or bigger numbers than the objective allows.
Every tier tests the SAME skill the objective names. A harder tier never adds a skill or operation the objective does not name (a counting objective stays counting, never adding two groups).
A "near" wrong answer is a mistake learners of THIS objective really make (a sound that is easy to confuse, a number one off, a common misconception), never a random object.${band(gradeLevel, preciseGrade) === 'K' ? `
KINDERGARTEN has only 3 picture choices, so the tier lives in how close the wrong pictures are: ${K_NEAR[tier]}` : ''}
What the learner has to do:
${taskLines}
${ladderAll}
Shape: ${shapeRule} This replaces any easy/medium/hard counts listed further down.
`;
}

/** Problem-type key (`problem.type`) → shape. */
const TYPE_TO_SHAPE: Record<string, KcShape> = {
  multiple_choice: 'multiple_choice', true_false: 'true_false', fill_in_blanks: 'fill_in_blanks',
  matching_activity: 'matching_activity', categorization_activity: 'categorization_activity',
  sequencing_activity: 'sequencing_activity',
};

/**
 * The countable parts of a generated problem that miss the tier's shape. Empty = on spec (or nothing to count).
 */
export function checkTierShape(problem: ProblemData, tier: KcTier, gradeLevel: string, preciseGrade?: string): string[] {
  const shape = TYPE_TO_SHAPE[problem.type];
  if (!shape) return [];
  const t = tierShape(tier, shape, gradeLevel, preciseGrade);
  const p = problem as any;
  const misses: string[] = [];
  if (t.near && Array.isArray(p.options)) {
    const wrong = p.options.filter((o: any) => o.id !== p.correctOptionId);
    const near = wrong.filter((o: any) => o.distance === 'near').length;
    const [lo, hi] = t.near(wrong.length);
    if (near < lo || near > hi) misses.push(`near options ${near}, want ${lo === hi ? lo : `${lo}-${hi}`}`);
  }
  if (t.blanks && Array.isArray(p.blanks) && p.blanks.length !== t.blanks) misses.push(`blanks ${p.blanks.length}, want ${t.blanks}`);
  if (t.pairs && Array.isArray(p.leftItems) && p.leftItems.length !== t.pairs) misses.push(`pairs ${p.leftItems.length}, want ${t.pairs}`);
  if (t.categories && Array.isArray(p.categories)) {
    const n = p.categories.length;
    if (n < t.categories[0] || n > t.categories[1]) misses.push(`categories ${n}, want ${t.categories.join('-')}`);
  }
  if (t.items && Array.isArray(p.categorizationItems)) {
    const n = p.categorizationItems.length;
    if (n < t.items[0] || n > t.items[1]) misses.push(`items ${n}, want ${t.items.join('-')}`);
  }
  if (t.steps && Array.isArray(p.items) && shape === 'sequencing_activity' && p.items.length !== t.steps) {
    misses.push(`steps ${p.items.length}, want ${t.steps}`);
  }
  return misses;
}
