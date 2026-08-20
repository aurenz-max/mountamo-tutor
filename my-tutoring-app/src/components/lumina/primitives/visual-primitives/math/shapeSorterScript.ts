/**
 * shapeSorterScript — HAND-AUTHORED judged-loop script for shape-sorter
 * (FIFTH math DI port; qa/di/BACKLOG.md item 18). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (which shapes, which colors, which rotations, which sort attribute) stays
 * generator-scoped; this module owns the cue shapes, the build gates, the
 * geometry table and the leak policy — and it is the ONE address both sides of
 * the wire import them from.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1 — the table picture) ─────────────
 *
 * ALL THREE MODES ARE SPOKEN, and every tap is deleted. Picture a teacher at a
 * table with one child and a tray of paper shapes:
 *
 *   "What shape is this?"                              → "hexagon!"
 *   "How many sides does this shape have?"             → "six!"
 *   "Which group? Curved, or Straight?"                → "straight!"
 *
 * Every one of those is a thing a five-year-old says across a table, so step
 * 1's FIRST question ends the fork in all three modes and the gesture table is
 * never consulted. Three benched classes, no new sitting:
 *
 *   identify  `shape_name`         di-shapes' bench probe set + pack
 *   count     `number_word_to_20`  #46 (2026-07-24) and every math-facts sitting
 *   sort      `short_spoken_word`  word-sorter's three modes (port 18)
 *
 * ⭐ WHAT THE CLICK ERA HAD, AND WHY EACH PIECE OF IT FAILS THE COSTUME TEST.
 *
 *  1. `identify` was SELECT-ALL-THEN-CHECK over a pool, with a green or red
 *     ring painted on every tap. A child who cannot identify a triangle can tap
 *     shapes, read the ring, untap the red ones and reach a correct commit —
 *     the tap produced no evidence of the skill. Worse, the eval mode has said
 *     all along what it actually assesses: *"Name 2D shapes by visual
 *     recognition."* The select-all hunt was the IMPLEMENTATION, not the
 *     identity, and naming is what the catalog always claimed. So the ask
 *     points at ONE shape and the child NAMES it — production, with a 1-in-9
 *     floor instead of a hunt with instant per-tap feedback.
 *  2. `count` had −/+ STEPPERS. Operating a stepper requires no counting (it is
 *     ten-frame's costume, one primitive over), and this pack's is worse than
 *     ten-frame's was, for a reason under (4).
 *  3. `sort` was select-shape-then-tap-bin. word-sorter's ruling, verbatim: a
 *     child who cannot categorise at all can tap a bucket at a 1-in-2 floor and
 *     re-tap until it lands. The category NAME is the evidence.
 *
 * ⭐ WHAT IS NOT A COSTUME, AND STAYS: THE SHAPES AND THE MATS. A naming ask
 * with nothing drawn is not a harder task, it is a different one; a sort whose
 * groups are unknowable is BROKEN, not harder (letter-spotter's find-it rule,
 * word-sorter's mats, ten-frame's R6). The drawn pool, the highlighted shape
 * and the labelled mats are the paper on the table — printed, and nothing on
 * them is tappable. It was the ACTION that was the costume, never the paper.
 *
 * ⭐ AND THE HARD-TIER LEVER MOVED OFF THE SCREEN AND INTO THE ASK. The click
 * era's `showBinLabels: false` blanked the mats at `hard`, which was legal only
 * because the answer was a POSITION — you can tap an unlabelled bin. Once the
 * answer is the label SAID ALOUD, an unlabelled mat is an unanswerable
 * question, so the mats are labelled at every tier and what `hard` withdraws is
 * whether the ASK names the groups (`namesChoices`) — letter-sound-link's
 * tier-conditional exemption, word-sorter's shape. The K band floor beats the
 * tier: a pre-reader cannot read a mat, so the groups are always named aloud.
 *
 * ── ⭐ THREE CONTENT DEFECTS A TAP SURFACE NEVER HAD TO JUSTIFY ─────────────
 *
 * Writing the spoken ask AUDITS THE CONTENT (skill defect class 8), and this
 * primitive's geometry table had three asks with no single defensible answer.
 * All three are DROPS in code, both sides of the wire — never a leniency:
 *
 *  1. CURVED SHAPES CANNOT CARRY A COUNT. *"How many sides does a circle
 *     have?"* is arguable at 0 (no STRAIGHT sides) and at 1 (one continuous
 *     edge) — di-shapes' founding rule #1, decided at its L1. The click era
 *     shipped it anyway AND printed the answer on screen: `CountView` renders
 *     *"This shape has curved sides — no straight sides or corners!"* under the
 *     drawing, which is a stepper problem asking a question it has already
 *     answered. Counting items are POLYGONS only, which also floors the spoken
 *     answer at 3 and puts the zero gate out of scope by construction.
 *  2. A SIDES-SORT CANNOT HOLD A CURVED SHAPE, for the same reason wearing a
 *     bin label: `getShapeBinLabel` mints "0 sides" for a circle, i.e. it
 *     asserts one of the two arguable answers as a group name the child must
 *     say out loud. Curved shapes drop out of a sides sort; they are exactly
 *     what a CURVED sort is for.
 *  3. DIAMOND AND RHOMBUS ARE THE SAME DRAWING. `renderShapeSVG` renders them
 *     from ONE switch branch — pixel-identical — so a naming ask over either
 *     has two right answers. Invisible while the answer was a tap (the checker
 *     compared ids); a broken ask the moment a child says a word. Handled the
 *     way di-shapes handles it, by ACCEPTING both per item (`spokenAlternates`)
 *     rather than dropping a shape the curriculum wants.
 *
 * And one geometry gate that is this pack's own: A SQUARE ROTATED 45° READS AS
 * A DIAMOND. `rotation` is generated across 0-360 deliberately (shape constancy
 * — K.G.2), which is right for counting and sorting, where the answer is
 * unchanged, and wrong for NAMING, where the percept IS the question. Naming
 * items drop a square whose rotation lands in the diamond window; count and
 * sort items keep every rotation, because four sides are four sides however the
 * paper is turned.
 *
 * ── ONE CHALLENGE IS NOT ONE ITEM (skill defect class 1, fifth use) ─────────
 *
 * A click-era challenge was a screenful. A judged item is one ask with one
 * answer, so an identify pool of six shapes is up to six judged asks and a sort
 * of six shapes is six. Two §4d gates ride with that, and both arrive WITH the
 * modality because nothing was ever said before:
 *
 *   - an identify pool holds three triangles on purpose; naming the second one
 *     is recall, not recognition, so naming items DEDUPE BY SHAPE KIND across
 *     the whole session.
 *   - a count item closes by saying the shape's count aloud, so the same shape
 *     may carry only one counting ask per session.
 *
 * A sort deliberately does NOT dedupe: its groups are a fixed set and repeated
 * membership is the practice (word-sorter's shape). What it does instead is
 * INTERLEAVE — consecutive items come from different groups where the material
 * allows, which is better distributed practice than clumping and keeps two
 * consecutive asks from being byte-identical turns.
 *
 * ── SIDES AND CORNERS ARE THE SAME NUMBER, SO WE ASK ONE ───────────────────
 *
 * Every polygon in `SHAPE_PROPERTIES` has `sides === corners`. The click era
 * asked for BOTH and required both to be right, which means the second box was
 * answerable from the first with zero geometry — a free half-mark hidden by a
 * Check button. One count item asks ONE feature, picked in code and alternated
 * across challenges, so a session still meets both words and neither is free.
 *
 * ── THE MODEL IS A STRATEGY, NEVER AN EXEMPLAR ─────────────────────────────
 *
 * Modelling the answer is the whole question in a naming or counting mode
 * (skill step 2), and here modelling it would BE the ask: "this shape is a
 * triangle" said before "what shape is this?" is the answer read aloud. So the
 * lead-in models the STRATEGY (look at the whole shape; count each one once)
 * and the answer is earned in the CORRECTION, which re-models it in full.
 * di-shapes may model the answer at `easy` because its tier ladder is built
 * around exactly that trade; this pack's tiers ride the same ladder over
 * strategy lines instead, so no rung ever speaks the answer first.
 *
 * That is also why there is no contrastive `⟨what they said⟩` slot here, which
 * di-shapes uses to name the child's wrong shape back to them. It is good
 * DISTAR and it is a second improvisation surface in a family that has spent
 * three ports closing the first (18d, `VERDICT_ENDS_THE_TURN`); a byte-exact
 * re-model is what the runner-era packs ship. Filed as a lever, not adopted.
 *
 * ── SENTINELS ──────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by `checkPackGates` in
 * this pack's test file. Every string that can reach a spoken line runs through
 * `opensWithSentinel` — the shape and color vocabularies are code-owned enums
 * so this is belt-and-braces there, but the sort LABELS are built from
 * generated data and the gate is live over them.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { numberWordFor } from './countingBoardScript';

// Re-exported so the generator imports its build gates and its geometry from
// ONE address — both sides of the wire must agree on what is askable, and the
// letter-spotter 90-vs-100 drift is why a hand-synced copy is not allowed.
export { opensWithSentinel, numberWordFor };

// ============================================================================
// The geometry table — the single source of truth, on BOTH sides of the wire
// ============================================================================

/**
 * Shape → its defining attributes. Previously duplicated in `ShapeSorter.tsx`
 * and again in `gemini-shape-sorter.ts` (whose copy carries an SS-1 comment
 * explaining that it could not import a `'use client'` module). This module is
 * not a client module, so both now import from here and the third copy is gone.
 */
export const SHAPE_PROPERTIES: Record<string, { sides: number; corners: number; curved: boolean }> = {
  circle: { sides: 0, corners: 0, curved: true },
  oval: { sides: 0, corners: 0, curved: true },
  triangle: { sides: 3, corners: 3, curved: false },
  square: { sides: 4, corners: 4, curved: false },
  rectangle: { sides: 4, corners: 4, curved: false },
  diamond: { sides: 4, corners: 4, curved: false },
  rhombus: { sides: 4, corners: 4, curved: false },
  pentagon: { sides: 5, corners: 5, curved: false },
  hexagon: { sides: 6, corners: 6, curved: false },
};

export const VALID_SHAPES = Object.keys(SHAPE_PROPERTIES);

/**
 * Names the judge must ALSO accept for a drawing, stated per shape so
 * permissiveness is auditable rather than a judge improvisation (di-shapes'
 * `spokenAlternates` rule).
 *
 * ONLY TRUE SYNONYMS FOR THE SAME FIGURE belong here. `diamond`/`rhombus`
 * because they are ONE branch of `renderShapeSVG` and therefore one drawing;
 * `ellipse` because it is the formal name of an oval. Informal child words
 * ("box", "ball") are deliberately absent: "box" fits a square AND a rectangle,
 * so accepting it would make an item's answer set overlap its own distractor —
 * the ear-separability failure, one layer up.
 *
 * What is NOT here is the K convention, and that is deliberate: square is not
 * rectangle and circle is not oval at this band, however true "a square is a
 * rectangle" becomes in grade 3. Those near-names are the error this mode
 * exists to catch — di-shapes' family ruling, and the drawings are separable
 * (a rectangle is drawn 2:1 and an oval at rx 0.65 / ry 0.4).
 */
export const SHAPE_ALTERNATES: Record<string, string[]> = {
  diamond: ['rhombus'],
  rhombus: ['diamond'],
  oval: ['ellipse'],
};

/**
 * The §4d identity of a shape for NAMING purposes: shapes that share a drawing
 * share a key.
 *
 * ⭐ FOUND BY THE LIVE PROBE, and not by any unit fixture (2026-08-18). A
 * `identify @ Grade 1 / hard` draw returned a pool holding BOTH `diamond` and
 * `rhombus`, and the §4d dedupe — keyed on the raw shape kind — kept them as two
 * separate items. They are ONE branch of `renderShapeSVG`, so the child would
 * have seen the identical figure twice, been asked its name twice, and been
 * right both times for saying the same word: each item accepts the other's name
 * by `SHAPE_ALTERNATES`. The gates all passed because every one of them was
 * per-item and this defect only exists BETWEEN items.
 *
 * Keying the ledger on the equivalence class closes it: naming the drawing once
 * spends it, whichever of its names the generator happened to send.
 */
export const nameClassOf = (shape: string): string => {
  const alternates = SHAPE_ALTERNATES[shape] ?? [];
  return [shape, ...alternates].sort()[0];
};

/**
 * The near-name a child most plausibly says instead — the SIGNATURE wrong the
 * judging contract claims to refuse, and what the headless drive sends. It is
 * fluent, confident and a real shape name, so a judge grading on "did I hear a
 * shape?" affirms it; that is precisely the miss worth driving.
 */
export const NEAR_SHAPE: Record<string, string> = {
  circle: 'oval',
  oval: 'circle',
  square: 'rectangle',
  rectangle: 'square',
  triangle: 'diamond',
  diamond: 'square',
  rhombus: 'square',
  pentagon: 'hexagon',
  hexagon: 'pentagon',
};

/**
 * A square has 4-fold symmetry, so its rotation matters only modulo 90° — and
 * at 45° off-axis the drawing IS a diamond to a five-year-old. This window
 * drops a naming item whose percept is genuinely ambiguous (di-shapes' L4
 * note: "a 45° square reads as a diamond — a different percept, not a harder
 * one"). It binds NAMING alone: a rotated square still has four sides, so
 * counting and sorting keep every rotation, which is what makes rotation the
 * shape-constancy lever the generator intends.
 */
export const DIAMOND_WINDOW_DEG = 20;

export const readsAsDiamond = (shape: string, rotationDeg: number): boolean => {
  if (shape !== 'square') return false;
  const r = ((rotationDeg % 90) + 90) % 90;
  return Math.abs(r - 45) < DIAMOND_WINDOW_DEG;
};

/** Is this shape askable as a NAMING item at this rotation? */
export const isNameable = (shape: string, rotationDeg: number): boolean =>
  !!SHAPE_PROPERTIES[shape] && !readsAsDiamond(shape, rotationDeg);

/**
 * Is this shape askable as a COUNTING item? Polygons only — the curved-shape
 * rule above. The count is then 3..6 by construction, inside the benched
 * `number_word_to_20` range with the zero case unreachable.
 */
export const isCountable = (shape: string): boolean => {
  const props = SHAPE_PROPERTIES[shape];
  return !!props && !props.curved && props.sides >= 1;
};

/** The child's word. K-1 curriculum vocabulary is "corners"; "vertices" is the
 *  G1+ formal term and is deliberately never spoken to a five-year-old. */
export type ShapeCountNoun = 'sides' | 'corners';

/** The sort dimensions this pack can ask about. `shape` is absent on purpose:
 *  a sort whose groups ARE the shape names is the identify mode with the answer
 *  printed on a mat, so it is a degenerate ask rather than a harder one. The
 *  generator's own challenge-type doc already scopes sorting to sides/curved. */
export type ShapeSortRule = 'sides' | 'curved' | 'color';

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * The group a shape belongs to under a rule, in the words the mat prints and
 * the child says. Shared with the component so a mat label and a spoken answer
 * can never disagree.
 */
export const binLabelFor = (shape: string, color: string, rule: ShapeSortRule): string => {
  const props = SHAPE_PROPERTIES[shape];
  switch (rule) {
    case 'sides':
      return `${props?.sides ?? 0} sides`;
    case 'curved':
      return (props?.curved ?? false) ? 'Curved' : 'Straight';
    case 'color':
    default:
      return capitalize(color);
  }
};

/** Can this shape carry a defensible group under this rule? A curved shape has
 *  no defensible side COUNT, so it has no defensible "N sides" mat either. */
export const isSortable = (shape: string, rule: ShapeSortRule): boolean => {
  const props = SHAPE_PROPERTIES[shape];
  if (!props) return false;
  return rule === 'sides' ? !props.curved : true;
};

// ============================================================================
// The item
// ============================================================================

export type ShapeSorterMode = 'identify' | 'count' | 'sort';
export type ShapeSorterTier = 'easy' | 'medium' | 'hard';

export interface ShapeSorterItem extends JudgedScriptItem {
  mode: ShapeSorterMode;
  tier: ShapeSorterTier;
  /** The challenge this item came from — the stage keeps one pool (or one mat
   *  set) per challenge, and the affirm reveal must not light the wrong one. */
  challengeId: string;
  /** Which shape of the challenge's pool this item asks about. The stage rings
   *  it and dims the rest: the ask says "this shape", so exactly one shape on
   *  screen has to be the one meant. */
  shapeIndex: number;
  /** The drawn shape's kind. It is the ANSWER under `identify` (so it is never
   *  printed and never spoken pre-answer) and the STIMULUS under the other two
   *  — but it hands the count away under `count` (triangle → three), so the
   *  pre-answer window withholds it in both. */
  shape: string;
  /** The spoken answer, exactly as the affirmation says it: a shape name, a
   *  number word, or a group label. */
  answer: string;
  /** identify only — the other names for THIS drawing that count as correct. */
  spokenAlternates: string[];
  /** count only — the numeral behind `answer`, for the code side and the tests. */
  countNumeral?: number;
  /** count only — which feature this item asks about. */
  countNoun?: ShapeCountNoun;
  /** sort only — every group label in screen order. Printed for the whole
   *  challenge and never consumed: an option set that shrinks makes the last
   *  item of a challenge answerable without looking (word-sorter's elimination
   *  leak, found on a match column that behaved the same way). */
  choices: string[];
  /** sort only — the dimension being sorted, for the correction's reason. */
  rule?: ShapeSortRule;
  /**
   * sort only — does the ASK name the groups out loud? False only at `hard` for
   * a reader: the mats are printed and the tier withholds the criterion. At
   * Kindergarten the band floor forces it true at every tier.
   */
  namesChoices: boolean;
  /** count render lever — pre-reveal the corner dots. A perception aid: it
   *  marks what to count without ever stating how many, which is the line the
   *  deleted "Side 1 / Side 2 / Side 3" buttons crossed. */
  showCornerHints: boolean;
  /** sort render lever — the running per-mat count of AFFIRMED shapes. */
  showBinCounts: boolean;
}

/** Every mode is SAID. Nothing in this pack answers with its hands: a shape
 *  name, a count and a group name all have spoken forms, so step 1's fork ends
 *  at its first question in all three. */
export const answerKindFor = (_mode: ShapeSorterMode): 'voice' => 'voice';

/** Standing gate 1 — three benched classes, no new sitting owed. */
export const responseClassFor = (mode: ShapeSorterMode): ResponseClassId => {
  switch (mode) {
    case 'identify':
      return 'shape_name';
    case 'count':
      return 'number_word_to_20';
    case 'sort':
    default:
      return 'short_spoken_word';
  }
};

// ============================================================================
// Build gates — DROP an unaskable item, never repair it into one
// ============================================================================

/** One breath, and a label a child can hold in working memory while they
 *  answer. Longer than that is recitation, twice a round. */
export const MAX_LABEL_WORDS = 3;
export const MAX_LABEL_CHARS = 24;

/**
 * A DI drill is fast and reps are the point, but one judged round costs an ask,
 * a think, a verdict and an affirmation. These hold a session at the family's
 * shape without shortening any individual challenge's answer set. Truncation is
 * NOT a build-gate drop and is reported separately.
 */
export const MAX_ITEMS_PER_CHALLENGE = 6;
export const MAX_ITEMS_PER_SESSION = 12;

/**
 * A sort's SPOKEN menu is read out on every ask, so the group count is a
 * property of the ask's length as much as of the task. Three is word-sorter's
 * ceiling (binary and ternary are its two sort modes) and it is what keeps the
 * longest possible ask — "Your turn. Which group? 3 sides, 4 sides, or 6
 * sides?" at eleven words — under the repeated-ask recitation limit. A fourth
 * group pushes it over and asks a five-year-old to hold four labels in working
 * memory while they look at a shape, so the challenge DROPS rather than being
 * silently narrowed to three: which group to discard is a content decision this
 * module has no basis to make.
 */
export const MAX_SORT_GROUPS = 3;

const sanitize = (value: string | undefined | null): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

/**
 * No double quotes anywhere: every one of these strings is interpolated into a
 * `Say exactly: "…"` span, and an embedded quote CLOSES the span early so
 * everything after it becomes judge-side prose the tutor may then perform.
 */
const SPEECH_SAFE_RE = /^[A-Za-z0-9][A-Za-z0-9' -]*$/;

/** Is this a group label a child can hear, hold and say back? */
export const isSayableLabel = (label: string): boolean => {
  const text = sanitize(label);
  if (!text || text.length > MAX_LABEL_CHARS) return false;
  if (!SPEECH_SAFE_RE.test(text)) return false;
  if (text.split(' ').length > MAX_LABEL_WORDS) return false;
  return !opensWithSentinel(text);
};

const normalizeForEar = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Can every option be told from every other BY EAR? decodable-reader's gate,
 * imported here for the same reason word-sorter imported it: if an utterance
 * fits two options there is no honest verdict, and the fix is to drop the ask,
 * never to judge it leniently. It is live over sort labels because those are
 * built from generated data — "3 sides" against "3 sides" is impossible, but a
 * color pool the model narrowed to one word twice is not.
 */
export const optionsEarSeparable = (options: readonly string[]): boolean => {
  const wordsOf = (option: string) => normalizeForEar(option).split(' ').filter(Boolean);
  return options.every((option, i) => {
    const others = new Set(options.flatMap((o, j) => (j === i ? [] : wordsOf(o))));
    return wordsOf(option).some((word) => !others.has(word));
  });
};

/** Free text → the closed sort-rule set, or null when the rule cannot carry a
 *  sort at all (`shape`, or anything unrecognised). */
export const normalizeSortRule = (rule: string | undefined): ShapeSortRule | null => {
  const text = normalizeForEar(rule ?? '');
  if (text === 'sides' || text === 'curved' || text === 'color') return text;
  return null;
};

/** Structural challenge shape as the generator emits it, duck-typed so this
 *  module never imports the component — the component imports us. */
export interface ShapeSorterShapeLike {
  shape: string;
  color: string;
  size?: string;
  rotation?: number;
}

export interface ShapeSorterChallengeLike {
  id: string;
  type: ShapeSorterMode;
  ruleAttribute?: string;
  targetValue?: string;
  shapes?: ShapeSorterShapeLike[];
  supportTier?: ShapeSorterTier;
  showCornerHints?: boolean;
  showBinCounts?: boolean;
}

export interface ShapeSorterBuildOptions {
  tier?: ShapeSorterTier;
  /** Kindergarten. Forces the groups to be named aloud at EVERY tier. */
  isPreReader?: boolean;
  /** Which counting feature this challenge asks about — alternated across a
   *  session by `itemsFromChallenges` so a run meets both words. */
  countNoun?: ShapeCountNoun;
  /**
   * §4d, and the ledger is ASYMMETRIC because the two modes say different
   * things aloud.
   *
   * `namedShapes` — kinds whose NAME the tutor has already spoken (an identify
   * affirmation or correction). It blocks BOTH modes: naming it again is
   * recall, and the name hands the count over outright (triangle → three).
   *
   * `countedShapes` — kinds whose COUNT has been said. It blocks only another
   * count. A counting turn never utters the shape's name — the affirmation is
   * "this shape has three sides" — so a later naming ask about that same kind
   * is still a genuine first ask, and treating it as spent would throw away
   * askable material for no pedagogic reason.
   */
  namedShapes?: Set<string>;
  countedShapes?: Set<string>;
}

/**
 * Round-robin the kept shapes across their groups so consecutive items come
 * from different mats where the material allows.
 *
 * Two reasons, and neither is the gate. Distributed practice beats clumping
 * (six "4 sides" in a row teaches the child to stop looking), and interleaving
 * is what keeps the third and fourth items of a challenge from being the same
 * turn twice — the ask is invariant within a sort challenge by design, so it is
 * the AFFIRMATION, which names the shape, that has to carry the difference.
 */
const interleaveByGroup = <T extends { group: string }>(entries: T[]): T[] => {
  const buckets = new Map<string, T[]>();
  for (const entry of entries) {
    buckets.set(entry.group, [...(buckets.get(entry.group) ?? []), entry]);
  }
  const out: T[] = [];
  const lists = Array.from(buckets.values());
  for (let round = 0; out.length < entries.length; round++) {
    let placedThisRound = false;
    for (const list of lists) {
      if (round < list.length) {
        out.push(list[round]);
        placedThisRound = true;
      }
    }
    if (!placedThisRound) break;
  }
  return out;
};

/**
 * Every judged item one challenge can ask, or `[]` when it can ask none.
 *
 * Nothing here backfills: a placeholder in a judged loop becomes a spoken ask
 * the tutor has to stand behind. The gates, and what each closes:
 *
 *  - IDENTIFY drops a shape whose drawing has two right names at this rotation
 *    (a 45° square), and drops a repeat of a shape kind already named — in this
 *    challenge or earlier in the session.
 *  - COUNT drops curved shapes outright (no defensible count) and a shape
 *    already counted this session.
 *  - SORT drops a rule that cannot carry a sort, labels that are unsayable or
 *    not ear-separable, a pool that reaches fewer than two groups (say one
 *    label every round and be right every round), and — under a sides rule —
 *    every curved shape, whose "0 sides" mat asserts an arguable answer.
 */
export const itemsFromChallenge = (
  ch: ShapeSorterChallengeLike,
  opts: ShapeSorterBuildOptions = {},
): ShapeSorterItem[] => {
  const tier = opts.tier ?? ch.supportTier ?? 'medium';
  const isPreReader = !!opts.isPreReader;
  const named = opts.namedShapes ?? new Set<string>();
  const counted = opts.countedShapes ?? new Set<string>();
  const showCornerHints = ch.showCornerHints === true;
  const showBinCounts = ch.showBinCounts !== false;
  const pool = (ch.shapes ?? [])
    .map((s) => ({
      shape: sanitize(s.shape).toLowerCase(),
      color: sanitize(s.color).toLowerCase(),
      rotation: typeof s.rotation === 'number' ? s.rotation : 0,
    }))
    .filter((s) => !!SHAPE_PROPERTIES[s.shape]);
  if (pool.length === 0) return [];

  if (ch.type === 'identify') {
    // Keyed on the DRAWING, not the word: diamond and rhombus are one figure,
    // so naming either spends both (see `nameClassOf`).
    const seen = new Set<string>();
    const kept: Array<{ index: number; shape: string }> = [];
    pool.forEach((s, index) => {
      if (!isNameable(s.shape, s.rotation)) return;
      const key = nameClassOf(s.shape);
      if (seen.has(key) || named.has(key)) return;
      seen.add(key);
      kept.push({ index, shape: s.shape });
    });
    return kept.slice(0, MAX_ITEMS_PER_CHALLENGE).map(({ index, shape }) => ({
      id: `${ch.id}::name-${index}`,
      mode: 'identify' as const,
      answerKind: 'voice' as const,
      responseClass: responseClassFor('identify'),
      action: 'identify',
      tier,
      challengeId: ch.id,
      shapeIndex: index,
      shape,
      answer: shape,
      spokenAlternates: SHAPE_ALTERNATES[shape] ?? [],
      choices: [],
      namesChoices: false,
      showCornerHints,
      showBinCounts,
    }));
  }

  if (ch.type === 'count') {
    // The generator narrows a count challenge to exactly one shape; take the
    // first countable one so a stale payload with a fuller pool still works.
    // A shape whose NAME has been spoken hands its count over; a shape already
    // counted has nothing left to ask. Both ledgers gate a counting item.
    const index = pool.findIndex(
      (s) => isCountable(s.shape)
        && !named.has(nameClassOf(s.shape))
        && !counted.has(nameClassOf(s.shape)),
    );
    if (index < 0) return [];
    const { shape } = pool[index];
    const props = SHAPE_PROPERTIES[shape];
    const countNoun: ShapeCountNoun = opts.countNoun ?? 'sides';
    const numeral = countNoun === 'corners' ? props.corners : props.sides;
    if (numeral < 1 || numeral > 20) return [];
    return [{
      id: `${ch.id}::count-${index}`,
      mode: 'count' as const,
      answerKind: 'voice' as const,
      responseClass: responseClassFor('count'),
      action: 'count',
      tier,
      challengeId: ch.id,
      shapeIndex: index,
      shape,
      answer: numberWordFor(numeral),
      spokenAlternates: [],
      countNumeral: numeral,
      countNoun,
      choices: [],
      namesChoices: false,
      showCornerHints,
      showBinCounts,
    }];
  }

  const rule = normalizeSortRule(ch.ruleAttribute);
  if (!rule) return [];
  const sortable = pool
    .map((s, index) => ({ ...s, index }))
    .filter((s) => isSortable(s.shape, rule));
  if (sortable.length < 2) return [];

  const labels = Array.from(new Set(sortable.map((s) => binLabelFor(s.shape, s.color, rule)))).sort();
  if (labels.length < 2 || labels.length > MAX_SORT_GROUPS) return [];
  if (!labels.every(isSayableLabel)) return [];
  if (!optionsEarSeparable(labels)) return [];

  const entries = sortable.map((s) => ({
    index: s.index,
    shape: s.shape,
    group: binLabelFor(s.shape, s.color, rule),
  }));
  const ordered = interleaveByGroup(entries).slice(0, MAX_ITEMS_PER_CHALLENGE);
  // One answer repeated every round is a sort the child can pass without
  // sorting — the same defect a one-option menu is.
  if (new Set(ordered.map((e) => e.group)).size < 2) return [];

  // The band floor beats the tier: a pre-reader cannot read a mat, so the ask
  // names the groups at hard too. What hard withholds at K is the STRATEGY.
  const namesChoices = isPreReader || tier !== 'hard';

  return ordered.map(({ index, shape, group }) => ({
    id: `${ch.id}::sort-${index}`,
    mode: 'sort' as const,
    answerKind: 'voice' as const,
    responseClass: responseClassFor('sort'),
    action: 'sort',
    tier,
    challengeId: ch.id,
    shapeIndex: index,
    shape,
    answer: group,
    spokenAlternates: [],
    choices: labels,
    rule,
    namesChoices,
    showCornerHints,
    showBinCounts,
  }));
};

/**
 * The session. Two things happen here that a single challenge cannot see: the
 * §4d used-shape ledger (a name or a count said aloud once is not asked again),
 * and the sides/corners alternation, so a `count` run meets both words instead
 * of asking "how many sides" five times.
 *
 * `MAX_ITEMS_PER_SESSION` is a LENGTH bound, not a gate — it truncates a run
 * that would otherwise ask thirty questions, and it REPORTS what it held back
 * rather than silently shortening (a truncated run that reads as "covered
 * everything" is the trap the skill's step 7 names).
 */
export const itemsFromChallenges = (
  challenges: ShapeSorterChallengeLike[],
  opts: ShapeSorterBuildOptions = {},
): ShapeSorterItem[] => {
  const namedShapes = opts.namedShapes ?? new Set<string>();
  const countedShapes = opts.countedShapes ?? new Set<string>();
  const all: ShapeSorterItem[] = [];
  let countAsks = 0;
  for (const ch of challenges) {
    const countNoun: ShapeCountNoun = countAsks % 2 === 0 ? 'sides' : 'corners';
    const built = itemsFromChallenge(ch, { ...opts, namedShapes, countedShapes, countNoun });
    for (const item of built) {
      // Both ledgers key on the DRAWING (`nameClassOf`), never on the word the
      // generator happened to use for it.
      if (item.mode === 'identify') namedShapes.add(nameClassOf(item.shape));
      if (item.mode === 'count') {
        countedShapes.add(nameClassOf(item.shape));
        countAsks += 1;
      }
    }
    all.push(...built);
  }
  if (all.length <= MAX_ITEMS_PER_SESSION) return all;
  // eslint-disable-next-line no-console
  console.info(
    `[shape-sorter] session capped at ${MAX_ITEMS_PER_SESSION} asks — `
    + `${all.length - MAX_ITEMS_PER_SESSION} askable item(s) held back.`,
  );
  return all.slice(0, MAX_ITEMS_PER_SESSION);
};

// ============================================================================
// Speakable helpers
// ============================================================================

/** "Curved, or Straight?" / "3 sides, 4 sides, or 6 sides?" — the spoken menu,
 *  and the ONE span the leak oracle subtracts. */
export const choicesPhrase = (item: ShapeSorterItem): string => {
  const list = item.choices;
  if (list.length === 0) return '';
  if (list.length === 1) return `${list[0]}?`;
  return `${list.slice(0, -1).join(', ')}, or ${list[list.length - 1]}?`;
};

/** "a triangle" / "an oval" — the article the affirmation and the correction
 *  use. Code-owned so no generated string ever carries one. */
export const articleFor = (word: string): string =>
  /^[aeiou]/i.test(word) ? 'an' : 'a';

const countNounOf = (item: ShapeSorterItem): ShapeCountNoun => item.countNoun ?? 'sides';

// ============================================================================
// How-to-play — inside the quoted line (SWAP-1), re-spoken on action change
// ============================================================================

export const howToPlayFor = (item: ShapeSorterItem): string => {
  switch (item.mode) {
    case 'identify':
      return 'I will point to a shape — you tell me its name out loud. ';
    case 'count':
      return 'I will show you a shape — you count, then tell me the number out loud. ';
    case 'sort':
    default:
      return 'I will point to a shape — you tell me which group it belongs with. ';
  }
};

// ============================================================================
// The DISTAR lead-in, composed from the SUPPORT TIER
// ============================================================================
//
// easy = model + guide, medium = model, hard = nothing. A tier changes how much
// of the sequence precedes the attempt — never the ask, never the judging, and
// never the correction's re-model (standing gate 3).
//
// NOTE WHAT IS ABSENT AT EVERY RUNG: a worked exemplar. In this pack an
// exemplar would BE the answer — "this shape is a triangle" is the ask read out
// — so every rung models the STRATEGY instead and the answer is earned in the
// correction. It is also why the lead-in rides `opening || howToPlay` only: an
// invariant strategy line re-recited every round is the recitation the
// 2026-08-13 rulings struck, and it does not change when the item changes.

const modelLine = (item: ShapeSorterItem): string => {
  switch (item.mode) {
    case 'identify':
      return 'Look at the whole shape before you name it.';
    case 'count':
      return 'Count each one, and count it only once.';
    case 'sort':
    default:
      return 'Think about what is the same about the shapes in each group.';
  }
};

const guideLine = (item: ShapeSorterItem): string => {
  switch (item.mode) {
    case 'identify':
      return 'A shape keeps its name even when it is turned around.';
    case 'count':
      return 'Start at the top and go all the way around.';
    case 'sort':
    default:
      return 'Look at every group before you choose.';
  }
};

const leadInFor = (item: ShapeSorterItem): string => {
  switch (item.tier) {
    case 'hard':
      return '';
    case 'easy':
      return `${modelLine(item)} ${guideLine(item)} `;
    case 'medium':
    default:
      return `${modelLine(item)} `;
  }
};

// ============================================================================
// The asks — short, the problem STATED aloud, one defensible answer
// ============================================================================
//
// A pre-reader cannot read the screen and every correction re-ask inherits the
// ask, so each one says its own problem out loud. All three are SHORT and
// invariant within a mode, which is the correct DI signal rather than a defect:
// the stimulus is DRAWN, so an ask cannot carry it in words without naming the
// very thing being asked about (the shape's name is the answer under identify
// and hands the count over under count). The repeat-ask gate passes them
// because they are the short form the 2026-08-13 fix produced, not the long
// frame it struck.

export const askFor = (item: ShapeSorterItem): string => {
  switch (item.mode) {
    case 'identify':
      return 'Your turn. What shape is this?';
    case 'count':
      return `Your turn. How many ${countNounOf(item)} does this shape have?`;
    case 'sort':
    default:
      return item.namesChoices
        ? `Your turn. Which group? ${choicesPhrase(item)}`
        // `hard` for a reader: the mats are printed and the tier withholds the
        // criterion, so the menu is not spoken. The ask still STATES its
        // problem — an ask that says nothing is broken rather than terser.
        : 'Your turn. Which group does this shape belong with?';
  }
};

// ============================================================================
// Verdict lines — affirm opens "Yes", correction opens "My turn" (gate 3)
// ============================================================================

/** The sentence the tutor ASSERTS about the drawing. Never spoken before the
 *  child answers — it is the answer. */
const statementFor = (item: ShapeSorterItem): string => {
  switch (item.mode) {
    case 'identify':
      return `this shape is ${articleFor(item.answer)} ${item.answer}`;
    case 'count':
      return `this shape has ${item.answer} ${countNounOf(item)}`;
    case 'sort':
    default:
      // Naming the shape KIND is what makes the classification learnable — a
      // group is a fact about the shape, so the reason and the answer arrive
      // together. It is also what keeps two consecutive sort turns from being
      // the same words twice, since the ask cannot vary.
      return `${articleFor(item.shape)} ${item.shape} belongs with ${item.answer}`;
  }
};

export const affirmFor = (item: ShapeSorterItem): string => `Yes, ${statementFor(item)}.`;

/**
 * DISTAR model-lead-test. The correction NAMES the answer, at every tier and on
 * both attempts, because all three of this pack's answers are FACTS a child
 * either holds or does not — there is no route to re-model that stops short of
 * the fact (word-sorter's argument, and letter-spotter's match-it before it).
 * The measurement stays honest because the runner scores a corrected item at 67
 * or 33, never at 100.
 */
export const correctionFor = (item: ShapeSorterItem): string =>
  `My turn: ${statementFor(item)}. ${askFor(item)}`;

// ============================================================================
// The 18d law and the item-21 tail (family wording, grep-able)
// ============================================================================

/**
 * 18d. Consumed verbatim from the family's extended form. Stated BEFORE the
 * branches because the defect is a reply that is NEITHER branch — improvised
 * praise opens with neither sentinel, so the reducer records no verdict, the
 * correction counter freezes, and the child waits on a loop that cannot
 * advance. Authored in from birth here, not reproduced then fixed.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail. It matters here for a reason specific to this port: the
 * screen carries a POOL of shapes whose contents the contract tells the tutor
 * about, so "describe what has changed on the screen" is one sentence away from
 * naming the shape that is the next item's answer.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

/**
 * ⭐ VERDICT_ENDS_THE_TURN (word-sorter's cap-drill finding, 11 of 12
 * affirmations). It applies here for the same measurable reason and arguably
 * more strongly: every ask in this pack is ONE rigid template spoken up to
 * twelve times a session, and the affirmation is short and lands on a name — so
 * the likeliest continuation the model has IS the next ask, invented about a
 * shape the runner was not about to send.
 */
const VERDICT_ENDS_THE_TURN =
  `Your verdict line is the END of your turn: you never continue into another question, `
  + `never ask about another shape, and never announce what is coming — the activity sends you the `
  + `next question when the screen is ready for it, and a question you ask early is about the wrong shape.`;

// ============================================================================
// The judging contract
// ============================================================================

/**
 * The answer rides in the control channel ahead of the attempt — the family's
 * shipped shape under the never-say-it law, since a judge cannot decide an
 * answer it was never told.
 *
 * Each mode owns two clauses that earn their space, and both are what the
 * headless drive tests:
 *
 *  IDENTIFY  accept: young-child pronunciation ("twiangle" is gliding, not a
 *            wrong answer), the article dropped or added, and this drawing's
 *            other true name (diamond/rhombus).
 *            signature wrong: THE NEAR NAME. "rectangle" at a square is a real
 *            shape name said confidently, so a judge listening for "did I hear
 *            a shape?" affirms it — and it is the exact error the mode exists
 *            to catch (di-shapes' family ruling: a different name is always
 *            wrong, however close).
 *
 *  COUNT     accept: THE ROUTE. Counting aloud and landing on the number is
 *            what a five-year-old should be doing and is correct; the judge
 *            reads where the count LANDS, never how it got there.
 *            signature wrong: THE OFF-BY-ONE. A miscount by one is the error
 *            side-counting exists to correct, and it is the answer a judge
 *            grading on "did I hear a number?" affirms.
 *
 *  SORT      accept: the label without its little words or with its ending
 *            changed, and — for a sides mat — the bare number ("three" for
 *            "3 sides"), which is what a child actually says.
 *            signature wrong: THE SHAPE NAME SAID INSTEAD OF THE GROUP.
 *            "square" for "4 sides" is on-topic, confident, and TRUE about the
 *            drawing — but it is not a classification, and a judge that reasons
 *            "a square does have four sides, close enough" has affirmed a child
 *            who never sorted. word-sorter's stimulus-said-back trap, in the
 *            one disguise a drawn stimulus can wear.
 */
const judgingContract = (item: ShapeSorterItem): string => {
  let target: string;
  let acceptTail: string;
  let wrongClause: string;

  if (item.mode === 'identify') {
    const alternates = item.spokenAlternates.length > 0
      ? `They may also call this drawing ${item.spokenAlternates.map((w) => `"${w}"`).join(' or ')} — those are the same shape and count as correct. `
      : '';
    target = `The correct answer is the shape name "${item.answer}". `;
    acceptTail =
      `Young-child pronunciation of that name is correct, and so is saying it with or without "a" or "an". `
      + alternates;
    wrongClause =
      `Any DIFFERENT shape name is wrong, however close it sounds or looks — judge the name you heard, never the name you expected. `;
  } else if (item.mode === 'count') {
    target = `The correct answer is the number "${item.answer}". `;
    acceptTail =
      `Counting out loud and finishing on ${item.answer} is correct — that is the right route at this age, not a hesitation to correct. `
      + `Wait until they stop counting and judge only the number they finish on. `;
    wrongClause =
      `Any DIFFERENT number is wrong, including one more or one less than ${item.answer}. `
      + `A shape name, a colour, or a word like "lots" is not a number and is not an answer. `;
  } else {
    target = `The correct answer is the group "${item.answer}". `;
    acceptTail =
      `They may say it without its little words or with the ending changed — "${item.answer}", "the ${item.answer}", "it is ${item.answer}" all count as the same answer. `
      + (/^\d/.test(item.answer)
        ? `Saying just the number is also correct here: "${item.answer.split(' ')[0]}" means the "${item.answer}" group. `
        : '');
    wrongClause =
      `Naming the SHAPE is not naming the group: "${item.shape}" is a true thing to say about this drawing and is still a wrong answer, `
      + `because the question asks which group it belongs with. `
      + (item.choices.length === 2 ? `The other group is wrong. ` : `Any of the other groups is wrong. `);
  }

  return (
    `The quoted line is the ONLY thing you say on this turn; you then stay silent `
    + `while the learner thinks, and their think time is unbounded. `
    + `Never say the answer during their turn. `
    + target
    + acceptTail
    + `A shy or mumbled try still counts. `
    + wrongClause
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ============================================================================
// Cues
// ============================================================================

export interface ShapeSorterCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: ShapeSorterItem,
  opts: ShapeSorterCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Let us look at some shapes! ' : '';
  // Introducing = the run's opening, or the ACTION just changed. Only then does
  // the child hear how the game works and the DISTAR lead-in; every other item
  // goes straight to the ask.
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return (
    `[SHS_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} `
    + `${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward.
 *
 * NO CLOSE LINE THAT NAMES THE ANSWER, and that is a deduction rather than a
 * shortcut (word-sorter's, re-derived here because the same two facts hold):
 * this pack's correction NAMES the fact and the runner runs it TWICE before
 * capping, so a third telling is redundant — and it is the one place a shape
 * name or a group label would reach the move-on utterance, where the NEXT
 * item's pool is already on screen.
 */
export const moveOnCue = (
  item: ShapeSorterItem,
  next: ShapeSorterItem | null,
  opts: ShapeSorterCueOptions = {},
): string => {
  if (!next) {
    return (
      `[SHS_MOVE] Say exactly: "Good try! We will look at that one again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[SHS_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

export const completeCue = (): string =>
  `[SHS_COMPLETE] Say exactly: "Great shape work today! You told me every one out loud. See you next time!" `
  + `Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer, and is never withdrawn
 * by band or tier. It is the pre-reader's only way back to an ask that lives in
 * audio — and it is deliberately not a hint ladder (cvc-speller's
 * `[ISOLATE_VOWEL]` was an answer leak on demand).
 */
export const pronounceCue = (item: ShapeSorterItem): string => {
  const line = item.mode === 'sort' && item.namesChoices
    ? `Look at the shape I am pointing to. Which group? ${choicesPhrase(item)}`
    : `Look at the shape I am pointing to. ${askFor(item).replace(/^Your turn\. /, '')}`;
  return (
    `[SHS_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 * (di-math-facts rule), and answer-free by construction in all three modes.
 *
 * It never names the SHAPE, and that binds every mode rather than just the
 * naming one: the shape's name IS the answer under `identify`, and it hands the
 * count over under `count` (triangle → three). Under `sort` it names how many
 * groups are printed but never which, because at `hard` for a reader the ask
 * deliberately does not say them and a context line that did would hand the
 * tutor a set it could volunteer.
 */
export const stimulusFor = (item: ShapeSorterItem): string => {
  switch (item.mode) {
    case 'identify':
      return 'one shape highlighted on the screen, with other shapes drawn beside it';
    case 'count':
      return 'one shape drawn large on the screen';
    case 'sort':
    default:
      return `one shape highlighted on the screen, with ${item.choices.length} groups printed beside it`;
  }
};

// ============================================================================
// THE WIRE — what the tutor is told, shared with the DI drive harness
// ============================================================================

/**
 * Everything of this pack that can reach the tutor, in one value. The component
 * spreads this and adds only what the SCREEN owns (`statusLines`,
 * `diagnosisObservation`); the drive-plan endpoint hands it to
 * `run_tutor_live.py --di`. A harness that re-typed these cues would test a
 * fiction.
 */
export const shapeSorterPackBase = (
  items: ShapeSorterItem[],
): JudgedCueSurface<ShapeSorterItem> => ({
  primitiveType: 'shape-sorter',
  activityLine: 'live direct instruction shape practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.mode,
    stimulus: stimulusFor(item),
  }),
});

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

/**
 * The span of the ask inside which the answer may legitimately appear.
 *
 * A SORT ASK CLOSES ON A SPOKEN MENU, so the answer is inside it by
 * construction (push-pull-arena's shape). Subtracting exactly the menu keeps
 * the oracle live over the greeting, the how-to-play, the lead-in and the
 * hand-over, which is the half we author and therefore the half most worth
 * scanning.
 *
 * It returns nothing in every other case, and each of those is the oracle
 * getting STRONGER: `identify` and `count` asks never contain their answer at
 * all, and a `hard` reader's sort ask names no groups, so there is no menu to
 * subtract and the scan is flat there too.
 */
export const leakExemptSpanFor = (item: ShapeSorterItem): string | undefined =>
  item.mode === 'sort' && item.namesChoices ? choicesPhrase(item) : undefined;

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each
 * of these; this is that claim made testable. Change one, change both.
 */
export const shapeSorterHarnessAnswers = (item: ShapeSorterItem) => {
  if (item.mode === 'identify') {
    const near = NEAR_SHAPE[item.answer] ?? 'circle';
    const plainWrong = VALID_SHAPES.find(
      (s) => s !== item.answer && s !== near && !item.spokenAlternates.includes(s),
    ) ?? 'circle';
    return {
      correct: item.answer,
      plainWrong,
      signatureWrong: {
        text: near,
        why:
          'the NEAR NAME — a real shape name, said confidently, for a drawing that genuinely resembles '
          + 'this one, so a judge listening for "did I hear a shape?" affirms it. It is the exact error '
          + 'the mode exists to catch, and the contract refuses it by name',
      },
      leakTokens: [item.answer, ...item.spokenAlternates],
      leakExemptSpan: leakExemptSpanFor(item),
    };
  }

  if (item.mode === 'count') {
    const n = item.countNumeral ?? 0;
    const near = numberWordFor(n > 1 ? n - 1 : n + 1);
    const far = numberWordFor(n >= 10 ? 2 : n + 5);
    return {
      correct: item.answer,
      plainWrong: far,
      signatureWrong: {
        text: near,
        why:
          'the OFF-BY-ONE count — the error side-counting exists to correct, and the answer a judge '
          + 'grading on "did I hear a number?" affirms. The contract names one-more-or-one-less explicitly',
      },
      leakTokens: [item.answer, String(n)],
      leakExemptSpan: leakExemptSpanFor(item),
    };
  }

  const plainWrong = item.choices.find(
    (c) => c.toLowerCase() !== item.answer.toLowerCase(),
  ) ?? 'something else';
  return {
    correct: item.answer,
    plainWrong,
    signatureWrong: {
      text: item.shape,
      why:
        'the SHAPE NAME said instead of the group — on-topic, confident, and TRUE about the drawing, '
        + 'but not a classification. A judge that reasons "a square does have four sides, close enough" '
        + 'has affirmed a child who never sorted; the contract refuses it by name',
    },
    leakTokens: [item.answer],
    leakExemptSpan: leakExemptSpanFor(item),
  };
};
