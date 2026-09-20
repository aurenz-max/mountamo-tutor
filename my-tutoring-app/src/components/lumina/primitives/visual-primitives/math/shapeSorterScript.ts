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

import { opensWithSentinel, type JudgedCueSurface } from '../../../hooks/judgedScriptContract';
import { SHAPE_PROPERTIES, articleFor, askFor, capitalize, choicesPhrase, countNounOf,
  howToPlayFor, leadInFor, numberWordFor, stimulusFor, type ShapeSorterItem } from './shapeSorterDomain';

// The task itself is domain, not script. Re-exported so the generator, the
// component, the tester and the drive plan keep ONE address for shape facts
// while the scripted protocol is retired out from under them.
export * from './shapeSorterDomain';
export { opensWithSentinel };

// ============================================================================
// Verdict lines — affirm opens "Yes", correction opens "My turn" (gate 3)
// ============================================================================

/** The sentence the tutor ASSERTS about the drawing. Never spoken before the
 *  child answers — it is the answer. */
const statementFor = (item: ShapeSorterItem): string => {
  if (item.mode === 'identify' && item.realObject) {
    return `the shape in this ${item.realObject} is ${articleFor(item.answer)} ${item.answer}`;
  }
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
const outlineTraceFor = (item: ShapeSorterItem): string => {
  const properties = SHAPE_PROPERTIES[item.shape];
  if (!properties || !item.realObject) return '';
  if (properties.curved) {
    return `Trace the curved outline of the ${item.realObject} with me; it has no corners. `;
  }
  const count = numberWordFor(properties.sides);
  const countTogether = Array.from(
    { length: properties.sides },
    (_, index) => numberWordFor(index + 1),
  ).join(', ');
  return `Trace the ${item.realObject}'s outline with me: ${countTogether}. That makes ${count} straight sides and ${count} corners. `;
};

export const correctionFor = (item: ShapeSorterItem): string =>
  `My turn: ${outlineTraceFor(item)}${statementFor(item)}. ${askFor(item)}`;

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

// ============================================================================
// THE WIRE — what the tutor is told, shared with the DI drive harness
// ============================================================================

/**
 * Everything of this pack that can reach the tutor, in one value. The component
 * spreads this and adds only what the SCREEN owns (`statusLines`,
 * `observation`); the drive-plan endpoint hands it to
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
