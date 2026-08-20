/**
 * associationBench — the scored answer key for `picture-vocabulary`'s
 * `association` mode (qa/di/BACKLOG.md item 25; handoff
 * `qa/HANDOFF-di-picture-vocabulary-association-2026-08-19.md`).
 *
 * WHY A SECOND FIXTURE FOR AN ALREADY-BENCHED CLASS
 * -------------------------------------------------
 * `open_set_word` cleared its bench on 2026-08-19 (rhyme-studio, 72 probes,
 * zero false affirmations), so standing gate 1 does not require a new CLASS
 * sitting here. What it does require is that THIS PACK's guards work, and
 * three of them are new. So this benches the PACK, not the class.
 *
 * ⭐ WHY THE GUARDS ARE NEW: THIS IS A HARDER OPEN SET THAN RHYME
 * --------------------------------------------------------------
 * Rhyme's rule is crisp and nearly binary — does it share the rime, and is it
 * a real word. A judge can be wrong about that, but it cannot RATIONALISE its
 * way to a wrong answer. "Goes with" has no such floor: it is semantic,
 * graded and culture-dependent, and a sufficiently helpful model can build a
 * chain to almost anything.
 *
 *     "A cat goes with a sock — cats love to play with socks!"
 *
 * That is this class's false-affirmation mode and it has no analogue in
 * rhyme, so the bench is built to catch RATIONALISATION rather than
 * mispronunciation. Three buckets carry the load and none of them exists in
 * `openSetWordBench.ts`:
 *
 *   rationalised-chain  any real word defended by an invented story. THE
 *                       signature failure — weighted heaviest.        REFUSE
 *   same-category       "shirt" for sock. Both clothes; they do not go
 *                       TOGETHER. Being the same KIND is not the same
 *                       as belonging together.                        REFUSE
 *   category-word       "clothes" for sock. Names the set the stimulus
 *                       is IN rather than a partner — `opposite`'s
 *                       base-echo failure in a new coat.              REFUSE
 *
 * ECHO, NONWORD and OFF-TASK port straight across from rhyme. ONSET-ONLY has
 * no analogue and is absent rather than faked.
 *
 * ⭐ THE THREE RULINGS THIS KEY SETTLES (handoff §2.3)
 * ----------------------------------------------------
 * The key is worthless until these are decided, and getting one wrong blocks
 * the mode on OUR error — which is exactly what the miskeyed `zell` probe did
 * to the rhyme class on 2026-08-19.
 *
 * 1. IS THE RELATION SYMMETRIC? YES. The generator emits every pair in both
 *    directions (`expandAssociations`), so "what goes with shoe?" is a real
 *    ask and "sock" is its answer. The accept clause says so explicitly
 *    rather than leaving it to be inferred.
 *
 * 2. HOW WIDE IS "GOES WITH"? WIDE, and this is the biggest single difference
 *    from rhyme. `sock → foot`, `sock → drawer` and `sock → laundry` are all
 *    honest answers a five-year-old could give and NONE is the generated
 *    partner, so a clause that only accepts `shoe` fails real children. The
 *    rule written into the contract: accept any concrete, picturable thing
 *    with a plain everyday relation; refuse the connection that needs a story
 *    to explain it. The `partner-unlisted` bucket is that ruling made
 *    testable, and it is also the probe that catches a judge quietly
 *    re-closing the set around its own first guess.
 *
 * 3. IS A CATEGORY WORD RIGHT OR WRONG? WRONG, and named as its own guard.
 *
 * WHY THE PROBES ARE HAND-AUTHORED
 * --------------------------------
 * ⚠️⚠️ Association is MORE exposed to the item-24 instrument mistake than
 * rhyme was. Whether a probe is "a rationalised chain" or "an honest unlisted
 * partner" is a judgment call the AUTHOR makes, and it cannot be made without
 * reading the stimulus. A borrowed or careless probe does not fail loudly —
 * it produces a confident, well-formatted finding pointing at the wrong
 * component, and on 2026-08-19 that happened three times in one day. AUDIT
 * THE KEY BEFORE BELIEVING ANY FINDING THAT INDICTS THE TUTOR. Where a call
 * is genuinely arguable the probe is marked `soft`: recorded, never counted.
 *
 * THE SEED IS CODE-OWNED, NOT INVENTED HERE
 * -----------------------------------------
 * Every stimulus comes from the generator's own curated pair list (its prompt
 * seeds sock/shoe, spoon/fork, bed/pillow, cup/plate, dog/bone, key/lock,
 * pencil/paper, bird/nest, toothbrush/toothpaste). That list was authored for
 * exactly the "natural, concrete, picturable, a young child knows" bar the
 * accept clause needs, so the AFFIRM side is hand-checked before this file
 * even starts.
 *
 * FOUR STIMULI OVER FOUR DIFFERENT RELATION TYPES, which is the analogue of
 * rhyme's six different rimes — a result about the RULE rather than about one
 * lucky pair:
 *
 *   sock/shoe    worn together
 *   dog/bone     a creature and its thing (the highest chain risk: animals
 *                invite stories, and "dogs howl at the moon" is a real
 *                cultural association that is not a goes-with relation)
 *   bed/pillow   a furnishing and its parts
 *   cup/plate    a set of tableware (the sharpest same-category probes:
 *                "mug" is a near-synonym, "bowl" is merely another dish)
 *
 * WHAT THIS BENCH CANNOT ANSWER
 * -----------------------------
 * The harness sends TEXT. That drives the judge's SEMANTICS — the whole
 * question for this class — and touches neither acoustics nor ASR. True
 * silence is not sendable as a text turn, so off-task probes "I don't know"
 * and a filler noise; dead air stays a mic-row question.
 */

import type { OpenSetProbe } from './openSetWordBench';

export interface AssociationBenchStimulus {
  /** Item id in the drive plan. */
  id: string;
  /** The shown thing — the stimulus, never the answer. */
  baseWord: string;
  baseEmoji: string;
  /** The generator's curated partner. ONE right answer, not THE right answer. */
  partnerWord: string;
  partnerEmoji: string;
  probes: OpenSetProbe[];
}

/**
 * The off-task pair, identical for every stimulus — it is about the SHAPE of
 * the turn, not the word.
 */
const offTask = (): OpenSetProbe[] => [
  {
    text: "I don't know",
    bucket: 'off-task',
    expect: 'refuse',
    why: 'an honest non-answer. The contract names it, and a judge without a scripted branch here invents one',
  },
  {
    text: 'um',
    bucket: 'off-task',
    expect: 'refuse',
    why: 'filler, not a thing — the nearest a text turn gets to dead air',
  },
];

/**
 * ⚠️ ON NONWORDS AND THE `zell` TRAP. Rhyme's bench miskeyed the surname
 * "zell" as a nonword, the judge defensibly affirmed it, and that single
 * miskeyed probe blocked the whole class until the user pushed back. The
 * exposure is genuinely LOWER here and it is worth saying why rather than
 * leaving the next reader to re-derive it: a surname is not a plausible
 * answer to "what goes with sock" whether or not it is a real word, so the
 * nonword guard and the name question come apart in a way they could not for
 * rhyme (where "Bill" really does rhyme with "hill"). These four were still
 * checked by eye for real-word status.
 */
export const ASSOCIATION_BENCH_STIMULI: AssociationBenchStimulus[] = [
  {
    id: 'bench-assoc-sock',
    baseWord: 'sock',
    baseEmoji: '🧦',
    partnerWord: 'shoe',
    partnerEmoji: '👟',
    probes: [
      { text: 'shoe', bucket: 'partner', expect: 'affirm', why: 'the generated partner — worn together, and the pair the curated seed list ships' },
      { text: 'foot', bucket: 'partner-unlisted', expect: 'affirm', why: 'THE §2.2 RULING. A sock goes on a foot: plain, everyday, needs no story, and it is NOT the generated partner. A judge that refuses this has re-closed the set around its own first guess' },
      { text: 'drawer', bucket: 'partner-unlisted', expect: 'affirm', why: 'where socks are kept. A second unlisted partner on a different relation (kept-with rather than worn-with), so the bucket is not one lucky word' },
      { text: 'sock', bucket: 'echo', expect: 'refuse', why: 'the stimulus back. THE guard: a child told "Yes!" here learns a thing goes with itself, and deleting the option cards made this the cheapest wrong answer available' },
      { text: 'cat', bucket: 'rationalised-chain', expect: 'refuse', why: 'THE HANDOFF OWN EXAMPLE. "Cats love to play with socks" is a story, not an everyday pairing. If the judge affirms this the mode is teaching that anything goes with anything' },
      { text: 'cloud', bucket: 'rationalised-chain', expect: 'refuse', why: 'no everyday connection at all — the probe a helpful model has to work hardest to defend, which is precisely why it is here' },
      { text: 'shirt', bucket: 'same-category', expect: 'refuse', why: 'both are clothes. Being the same KIND of thing is not going together, and this is the guard the category-word one shades into' },
      { text: 'hat', bucket: 'same-category', expect: 'refuse', why: 'same group, no pairing — a second reading of the same guard' },
      { text: 'clothes', bucket: 'category-word', expect: 'refuse', why: 'names the SET sock belongs to rather than a partner. This is the opposite-mode base-echo failure in a new coat' },
      { text: 'blen', bucket: 'nonword', expect: 'refuse', why: 'not a word — the failure the closed emoji card set made structurally impossible and the rule cannot' },
      ...offTask(),
    ],
  },
  {
    id: 'bench-assoc-dog',
    baseWord: 'dog',
    baseEmoji: '🐶',
    partnerWord: 'bone',
    partnerEmoji: '🦴',
    probes: [
      { text: 'bone', bucket: 'partner', expect: 'affirm', why: 'the generated partner — a creature and its thing, a different relation type from the worn-together sock pair' },
      { text: 'leash', bucket: 'partner-unlisted', expect: 'affirm', why: 'used with a dog every day; plainly goes with it and is not the generated partner' },
      { text: 'collar', bucket: 'partner-unlisted', expect: 'affirm', why: 'worn by a dog — a second unlisted partner a five-year-old would offer first' },
      { text: 'dog', bucket: 'echo', expect: 'refuse', why: 'the stimulus back. Second reading of THE guard, on a stimulus whose partner is not something you wear — so a judge cannot refuse it by pattern from the sock item' },
      { text: 'moon', bucket: 'rationalised-chain', expect: 'refuse', why: 'THE SHARPEST CHAIN IN THE SET. "Dogs howl at the moon" is a REAL cultural association, which makes it far harder to refuse than a random word — and it is still not a thing you find, use or keep with a dog. This probe separates "related somehow" from "goes together"' },
      { text: 'mailman', bucket: 'rationalised-chain', expect: 'refuse', soft: true, why: 'the cliche chain ("dogs chase the mailman"). Filed SOFT because it is genuinely arguable: a mail carrier is an everyday part of a dog world, so a judge affirming it is being defensible rather than gullible' },
      { text: 'cat', bucket: 'same-category', expect: 'refuse', why: 'both are pets. The strongest same-category trap here because cats and dogs are a famous PAIR — famous as opposites, never as things that go together' },
      { text: 'bird', bucket: 'same-category', expect: 'refuse', why: 'same group (a pet, an animal), no pairing whatsoever — the plain reading of the guard, against the harder cat probe above' },
      { text: 'animals', bucket: 'category-word', expect: 'refuse', why: 'names the set dog belongs to rather than a partner. True of the picture and not an answer to the question — the empty superordinate, which is exactly the naming-mode failure in a new mode' },
      { text: 'frell', bucket: 'nonword', expect: 'refuse', why: 'not a word. Checked by eye, and note the asymmetry with rhyme: a surname would still be wrong here, because a name is not a thing that goes with a dog' },
      ...offTask(),
    ],
  },
  {
    id: 'bench-assoc-bed',
    baseWord: 'bed',
    baseEmoji: '🛏️',
    partnerWord: 'pillow',
    partnerEmoji: '🛌',
    probes: [
      { text: 'pillow', bucket: 'partner', expect: 'affirm', why: 'the generated partner — the part of a bed a child names first, and the pair the curated seed list ships' },
      { text: 'blanket', bucket: 'partner-unlisted', expect: 'affirm', why: 'on the bed, every night — plain and unlisted' },
      { text: 'sheet', bucket: 'partner-unlisted', expect: 'affirm', why: 'a second unlisted partner from the same everyday scene' },
      { text: 'bed', bucket: 'echo', expect: 'refuse', why: 'the stimulus back. A thing does not go with itself, and the correction owed here is the scripted ECHO branch rather than the general one' },
      { text: 'boat', bucket: 'rationalised-chain', expect: 'refuse', why: 'no everyday connection; a model reaching for one has to invent it ("you can sleep on a boat")' },
      { text: 'tree', bucket: 'rationalised-chain', expect: 'refuse', why: 'a chain through the material ("beds are made of wood") — the shape of rationalisation that sounds most like reasoning' },
      { text: 'chair', bucket: 'same-category', expect: 'refuse', why: 'both furniture. A chair does not go WITH a bed; it is merely the same kind of object' },
      { text: 'table', bucket: 'same-category', expect: 'refuse', why: 'same group (furniture), no pairing — and unlike chair it shares not even a room-level habit with a bed' },
      { text: 'furniture', bucket: 'category-word', expect: 'refuse', why: 'names the set bed belongs to rather than a partner, and it is the answer a child gives when they have understood the category lesson and not this one' },
      { text: 'drant', bucket: 'nonword', expect: 'refuse', why: 'not a word, with a legal English onset cluster — harder to refuse than obvious nonsense because it SOUNDS like something a child half-remembered' },
      ...offTask(),
    ],
  },
  {
    id: 'bench-assoc-cup',
    baseWord: 'cup',
    baseEmoji: '☕',
    partnerWord: 'plate',
    partnerEmoji: '🍽️',
    probes: [
      { text: 'plate', bucket: 'partner', expect: 'affirm', why: 'the generated partner — tableware laid together, and the relation the same-category probes below are measured against' },
      { text: 'saucer', bucket: 'partner-unlisted', expect: 'affirm', why: 'what a cup SITS ON — a specific functional pairing, and the contrast that makes the "bowl" probe below meaningful' },
      { text: 'tea', bucket: 'partner-unlisted', expect: 'affirm', why: 'what goes IN a cup. A third relation type on the accept side (contents rather than companion object), which is the widest the clause is asked to stretch' },
      { text: 'cup', bucket: 'echo', expect: 'refuse', why: 'the stimulus back. Sharpest on this stimulus because "mug" sits two probes below it: one is the same thing renamed, the other is the same thing repeated, and both are wrong for the same reason' },
      { text: 'shoe', bucket: 'rationalised-chain', expect: 'refuse', why: 'a CROSS-PROBE: "shoe" is another stimulus correct partner, so a judge carrying context between items rather than judging this one is caught here' },
      { text: 'cloud', bucket: 'rationalised-chain', expect: 'refuse', why: 'no everyday connection to a cup; any link a model produces here it has just invented, which is the whole test' },
      { text: 'mug', bucket: 'same-category', expect: 'refuse', why: 'a mug IS a cup — the purest same-category failure in the whole fixture. The child has named the same thing again, not a partner' },
      { text: 'bowl', bucket: 'same-category', expect: 'refuse', soft: true, why: 'another dish, not a companion to a cup — but filed SOFT because tableware genuinely is kept together, so this is the boundary of the guard rather than its centre. Contrast with "saucer" above, which pairs with a cup specifically' },
      { text: 'dishes', bucket: 'category-word', expect: 'refuse', why: 'names the set cup belongs to rather than a partner. Sharpest here because dishes really are used together, so the judge must refuse the GROUP NAME while still affirming saucer' },
      { text: 'plound', bucket: 'nonword', expect: 'refuse', why: 'not a word, and one phoneme from the real word "pound" — the nonword hardest to refuse in the fixture' },
      ...offTask(),
    ],
  },
];

/**
 * THE HARD REFUSE BUCKETS — the ones a false affirmation fails the gate on.
 *
 * Stated as data rather than left implicit in `isFalseAffirmation`'s `soft`
 * check, because this pack's gate has a WEIGHTING the rhyme one did not: an
 * affirmed rationalised chain is the failure the mode exists to prevent, and
 * a run record that buried it among the others would be unreadable.
 */
export const HARD_REFUSE_BUCKETS = [
  'echo',
  'nonword',
  'rationalised-chain',
  'same-category',
  'category-word',
  'off-task',
] as const;

/** Every probe in the fixture, flattened — for tests and run records. */
export const allAssociationProbes = (): Array<{ stimulusId: string; probe: OpenSetProbe }> =>
  ASSOCIATION_BENCH_STIMULI.flatMap((s) => s.probes.map((probe) => ({ stimulusId: s.id, probe })));
