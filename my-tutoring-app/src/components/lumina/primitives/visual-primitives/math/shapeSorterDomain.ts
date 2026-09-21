/**
 * shapeSorterDomain — what shape-sorter TEACHES, with no teaching engine
 * attached: the geometry table both sides of the wire agree on, the spoken
 * alternates, the build gates that drop an unaskable item, the item builders,
 * and the asks.
 *
 * Sunset slice S1 (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md).
 * `ShapeSorterTeaching` — the tutor/JEV naming pilot — needs the geometry and
 * the aliases and nothing else, but reaching them through `shapeSorterScript`
 * pulled the sentinel scanner, the correction wording and the pack base into
 * the destination architecture's import graph. The split is by ownership:
 *
 *   - HERE: the task and its validity gates. Which shapes are nameable at
 *     which rotation, which labels are sayable, which options are separable by
 *     ear, what the child is asked, and the harness answer material. The
 *     generator imports its build gates from this module, so both sides of the
 *     wire still agree on what is askable.
 *   - `shapeSorterScript`: the retiring control protocol — affirmation and
 *     correction wording, the two-branch law, the judging contract, the cues.
 *
 * The geometry table stays a single source of truth. `gemini-shape-sorter.ts`
 * and the component both import it from here; a hand-synced copy is what the
 * letter-spotter 90-vs-100 drift was.
 */

import { type ResponseClassId, type TeachingItem } from '../../../hooks/teachingItemContract';
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { numberWordFor } from './countingBoardDomain';
import {
  objectLabelLeaksShape,
  realWorldShapeObjectById,
  type RealWorldShapeObjectId,
} from '../shared/realWorldShapeObjects';
import { resolveScaffolds, type LiveScaffold } from '../../../components/live-activity/runtime/liveScaffolds';
// LEGACY PROTOCOL GATE (retires with the sentinel engine at S5): a generated
// sort label that opens with "Yes" or "My turn" would be read as a verdict by
// the judged runner. The gate stays live for as long as any mode still runs on
// that runner, and `isSayableLabel` is what the generator checks against.
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';

// Re-exported so the generator imports its build gates and its geometry from
// ONE address — both sides of the wire must agree on what is askable.
export { numberWordFor };


// ============================================================================
// The geometry table — the single source of truth, on BOTH sides of the wire
// ============================================================================

/**
 * Shape → its defining attributes. Previously duplicated in `ShapeSorter.tsx`
 * and again in `gemini-shape-sorter.ts` (whose copy carries an SS-1 comment
 * explaining that it could not import a `'use client'` module). This module is
 * not a client module, so both now import from here and the third copy is gone.
 */
/** The modes the tutor/JEV teaching workspace binds: a bounded naming pilot. The
 *  other modes stay on the standalone drill. The live adapter publishes this list. */
export const SHAPE_SORTER_WORKSPACE_MODES = ['identify'] as const;

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

export const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

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
export type ShapeSorterChallengeType = ShapeSorterMode | 'identify-real-object';
export type ShapeSorterTier = 'easy' | 'medium' | 'hard';

export interface ShapeSorterItem extends TeachingItem {
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
  /**
   * The everyday thing this shape is drawn AS ("clock face", "door"), when the
   * objective asks the child to find shapes in real objects. The name is
   * code-owned and never contains a shape word — the shape is what is being
   * asked for, so an object called "the round plate" would answer the question
   * in the stimulus. Absent = the plain geometric drawing.
   */
  realObject?: string;
  /** Stable key for the code-drawn object. The table owns its label and shape. */
  realObjectId?: RealWorldShapeObjectId;
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
  /** The everyday thing this shape is drawn as (see ShapeSorterItem.realObject). */
  realObject?: string;
  realObjectId?: RealWorldShapeObjectId;
  emoji?: string;
}

export interface ShapeSorterChallengeLike {
  id: string;
  type: ShapeSorterChallengeType;
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
      realObject: s.realObject ? sanitize(s.realObject).toLowerCase() : undefined,
      realObjectId: s.realObjectId,
    }))
    .filter((s) => !!SHAPE_PROPERTIES[s.shape]);
  if (pool.length === 0) return [];

  if (ch.type === 'identify' || ch.type === 'identify-real-object') {
    // Keyed on the DRAWING, not the word: diamond and rhombus are one figure,
    // so naming either spends both (see `nameClassOf`).
    const seen = new Set<string>();
    const kept: Array<{
      index: number;
      shape: string;
      realObject?: string;
      realObjectId?: RealWorldShapeObjectId;
    }> = [];
    pool.forEach((s, index) => {
      if (!isNameable(s.shape, s.rotation)) return;
      if (ch.type === 'identify-real-object') {
        const object = realWorldShapeObjectById(s.realObjectId);
        if (!object || object.shape !== s.shape || object.label !== s.realObject) return;
      }
      const key = nameClassOf(s.shape);
      if (seen.has(key) || named.has(key)) return;
      seen.add(key);
      kept.push({
        index,
        shape: s.shape,
        realObject: s.realObject,
        realObjectId: s.realObjectId,
      });
    });
    return kept.slice(0, MAX_ITEMS_PER_CHALLENGE).map(({ index, shape, realObject, realObjectId }) => ({
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
      // An object whose NAME contains a shape word would answer the question in
      // the stimulus, so it is dropped back to the plain drawing rather than
      // shipped. (The generator's table never produces one; this is the gate.)
      realObject: realObject && !VALID_SHAPES.some((sh) => realObject.includes(sh))
        && !objectLabelLeaksShape(realObject)
        ? realObject
        : undefined,
      realObjectId,
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

export const countNounOf = (item: ShapeSorterItem): ShapeCountNoun => item.countNoun ?? 'sides';

// ============================================================================
// How-to-play — inside the quoted line (SWAP-1), re-spoken on action change
// ============================================================================

export const howToPlayFor = (item: ShapeSorterItem): string => {
  if (item.mode === 'identify' && item.realObject) {
    return 'I will show you an everyday thing; you tell me the shape you see in it. ';
  }
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
  if (item.mode === 'identify' && item.realObject) {
    return 'Look at the outside edge of the object before you name its shape.';
  }
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
  if (item.mode === 'identify' && item.realObject) {
    return "Trace the object's outline with your eyes.";
  }
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

export const leadInFor = (item: ShapeSorterItem): string => {
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
  if (item.mode === 'identify' && item.realObject) {
    return `Your turn. What shape do you see in this ${item.realObject}?`;
  }
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


export const stimulusFor = (item: ShapeSorterItem): string => {
  if (item.mode === 'identify' && item.realObject) {
    return `one code-drawn ${item.realObject} on the screen; its label does not name its shape`;
  }
  switch (item.mode) {
    case 'identify':
      // The object is public — it is what the child is LOOKING at. Its shape is
      // not, and the code-owned object names never contain a shape word.
      return item.realObject
        ? `a ${item.realObject} highlighted on the screen, with other everyday things beside it`
        : 'one shape highlighted on the screen, with other shapes drawn beside it';
    case 'count':
      return 'one shape drawn large on the screen';
    case 'sort':
    default:
      return `one shape highlighted on the screen, with ${item.choices.length} groups printed beside it`;
  }
};


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

/** An `identify` item as the tutor and the outcome observer are told it. Only naming is
 *  bound to the teaching workspace. */
export const workspaceAssignment = (item: ShapeSorterItem): TeachingAssignment => ({ id: item.id,
  task: 'Name the shape inside the gold ring. What shape is it?',
  expectedAnswer: [item.answer, ...item.spokenAlternates].join(' or '), response: 'speech' });

/** The drawn pool for an `identify` item: the gold-ringed target and its comparison shapes. */
export function workspaceScene(item: ShapeSorterItem, shapes: ShapeSorterShapeLike[]): WorkspaceScene {
  const focus = shapes[item.shapeIndex];
  const geometry = SHAPE_PROPERTIES[item.shape];
  return {
    objects: shapes.map((shape, index) => ({ id: `shape-${index}`,
      label: `${shape.size} ${shape.color} ${shape.shape}, rotated ${shape.rotation} degrees`,
      selected: false, group: index === item.shapeIndex ? 'assignment target (gold ring)' : 'comparison shape' })),
    facts: { targetId: `shape-${item.shapeIndex}`, targetShape: item.shape, color: focus.color,
      rotation: focus.rotation ?? 0, sides: geometry.sides, corners: geometry.corners,
      curved: geometry.curved ? 'yes' : 'no',
      assignment: 'Name the gold-ringed shape. Naming a color or counting sides is an intermediate step, not the answer.',
      ringMeaning: 'Gold ring identifies the assignment. Purple dashed rings are tutor marks; they never change the target.' },
  };
}

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

/* ------------------------------------------------------------------ *
 * Live-tutor misstep inventory (see `/add-live-tutor-tools`).
 *
 * Kept beside the correction lines above, because the two answer different
 * things. The correction re-models and STATES the answer, and it fires however
 * the child was wrong. These aids name the misstep and never state the answer —
 * which here means never a SHAPE NAME (the answer on `identify`), never a COUNT
 * (the answer on `count`) and never a GROUP LABEL (the answer on `sort`).
 *
 * Missteps deliberately left to another lane:
 *   - "does not know the shape word yet" — between-item remediation, not an
 *     in-item aid; the correction names it and the next item re-asks.
 *   - "needs the corner dots or the mat counts" — those are render levers of
 *     the support tier (`showCornerHints`, the per-mat tally), a difficulty
 *     axis rather than an error response.
 *   - "counted a curve as a corner" — distinguishing that from a miscount needs
 *     per-feature evidence the adapter does not publish. Publish it first.
 * ------------------------------------------------------------------ */

/** What the child has actually done on this item, as the adapter publishes it. */
export interface ShapeMisstepEvidence {
  /** The raw transcript, lower-cased. Null when nothing has been heard. */
  said: string | null;
  /** The number the transcript names, or null. */
  saidNumber: number | null;
  /** Whether the last committed attempt was judged wrong. */
  wrongNow: boolean;
}

export type ShapeScaffold = LiveScaffold<ShapeSorterItem, ShapeMisstepEvidence>;

/** Did the child name one of the groups the ask actually offered? */
const namedAChoice = (item: ShapeSorterItem, said: string | null) =>
  !!said && item.choices.some(choice => choice && said.includes(choice.toLowerCase()));

/**
 * One method reminder per mode, and none of them contains a shape name, a count
 * or a group label — each is the answer on one of these three asks.
 */
const METHOD: Record<ShapeSorterMode, ShapeScaffold> = {
  identify: { strategyId: 'look-at-its-sides-and-corners', when: 'the child needs the method again',
    hint: () => 'Trace round the edge of the ringed shape and look at its sides and its corners.' },
  count: { strategyId: 'start-at-one-and-go-round', when: 'the child needs the method again',
    hint: () => 'Pick a place to start, then go round the shape the same way and touch each as you count.' },
  sort: { strategyId: 'what-do-the-mats-ask-for', when: 'the child needs the method again',
    hint: () => 'Look at what each mat is collecting, then check the ringed shape against them.' },
};

/**
 * The error-specific aids, offered only once the published evidence fits. Each
 * `when` states the CONDITION, because the model routes on that sentence.
 */
const AIDS: readonly ShapeScaffold[] = [
  { strategyId: 'i-asked-for-the-shape-not-the-thing', when: 'the child named the everyday object rather than its shape',
    hint: () => 'That is what the picture shows. I am asking what shape it is drawn as.',
    matches: (i, e) => i.mode === 'identify' && !!i.realObject && !!e.said
      && e.said.includes(i.realObject.toLowerCase()) },

  { strategyId: 'i-asked-for-a-name-not-a-number', when: 'the child answered a shape question with a number',
    hint: () => 'That is how many. I am asking for the name of the shape.',
    matches: (i, e) => i.mode === 'identify' && e.saidNumber !== null
      && !!e.said && !/[a-z]{4,}/.test(e.said.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, '')) },

  { strategyId: 'go-round-once-only', when: 'the child was one out on the count',
    hint: () => 'You are very close. Start again from the same place and go round only once.',
    matches: (i, e) => i.mode === 'count' && typeof i.countNumeral === 'number'
      && e.saidNumber !== null && Math.abs(e.saidNumber - i.countNumeral) === 1 },

  { strategyId: 'say-one-of-the-mats', when: 'the child answered with something that is not one of the mats',
    hint: () => 'Say the name of one of the mats on the table.',
    matches: (i, e) => e.wrongNow && i.mode === 'sort' && i.namesChoices
      && i.choices.length > 0 && !!e.said && !namedAChoice(i, e.said) },
];

/** The mode's method reminder plus every aid whose evidence currently fits. */
export function shapeScaffoldsFor(item: ShapeSorterItem | null | undefined,
  evidence: ShapeMisstepEvidence): ShapeScaffold[] {
  return resolveScaffolds(item, evidence, item ? METHOD[item.mode] : undefined, AIDS);
}
