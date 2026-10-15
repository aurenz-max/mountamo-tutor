/**
 * The contract every item space implements (service/itemSpace, skill /add-item-space).
 *
 * An item space is one math strand whose problems code can generate, solve and place on a difficulty
 * scale. Consumers (knowledge-check today, primitives next) ask it for items in a beta band and render
 * them; they never choose numbers themselves.
 */

/** Every item carries its predicted difficulty and its structure (the item without its digits). */
export interface SpaceItem {
  /** Predicted beta, logits for a typical learner at the strand's grade who was taught it. */
  beta: number;
  /** Two items with the same structure differ only in incidental digits. Used to spread picks and to calibrate. */
  structure: string;
}

export interface SolvedSpaceItem {
  /** The answer as the learner would give it ("15", "3/4", "2:30"). */
  answer: string;
  /** Every quantity the problem states, as it must appear in the question text. */
  shown: string[];
  /** One line for the wording prompt: the computation and what is unknown. Never shown to the learner. */
  spec: string;
  /**
   * The one operation a result-unknown item asks for, when it has exactly one. The wording check then
   * requires the story to read as that operation (a subtraction worded as pouring more in keeps its
   * numbers but contradicts its key).
   */
  operation?: '+' | '-';
  /**
   * An equation the question must print exactly, for a strand whose task is reading the equation (the
   * equal sign as "the same amount"). Told as a story, it becomes a different task.
   */
  equation?: string;
  /**
   * Words the question must contain because the answer has a part the computation alone does not ask for (a
   * division's remainder: "how many are left over"). A story that asks only "how many in each" keys "73 R 1".
   */
  asks?: RegExp;
}

export interface SpaceDistractor {
  value: string;
  /** near: what a learner who made a known mistake of this strand gets. far: ruled out by half-understanding. */
  distance: 'near' | 'far';
}

export interface ItemSpace<I extends SpaceItem = SpaceItem> {
  id: string;
  /** What the strand asks a learner to do, for the resolver (which objectives this space is). */
  describe: string;
  /**
   * The task needs a picture the space does not draw (a clock face to read). The resolver offers such a
   * space only to a consumer that names it in `only`; a text consumer (knowledge-check) never gets it.
   */
  needsPicture?: boolean;
  /** Canonical grades (`K`, `1`..`12`) the strand is taught in. */
  grades: string[];
  /** The success criterion stamped on a problem. */
  criterion: string;
  /** Grade the wording is written for. */
  wordingGrade: string;
  /**
   * `n` distinct items with beta in [lo, hi], spread across structures. Empty when the band holds none.
   * `accept` keeps only items a consumer can render (a number line draws result-unknown jumps only).
   */
  pick(n: number, lo: number, hi: number, rand?: () => number, accept?: (item: I) => boolean): I[];
  /** Every item, for a listed space (a sampled one omits it). Lets `tierPick` rank what a scope can draw. */
  items?(): I[];
  solve(item: I): SolvedSpaceItem;
  /** Exactly three wrong options, none equal to the answer, at least one `far`. */
  distractors(item: I, rand?: () => number): SpaceDistractor[];
  /** A correct question built in code, used when the written one misses its spec. */
  plainQuestion(item: I): string;
  /**
   * The part of the strand an objective names, when it names one ("unlike denominators" is not 1/2 + 1/2).
   * Undefined = the whole strand. Consumers pass it to `tierPick` as the scope, so every tier stays inside it.
   */
  scopeOf?(objective: string): ((item: I) => boolean) | undefined;
}
