/**
 * wordFlipScript — HAND-AUTHORED Direct Instruction script for word-flip, the
 * THIRD literacy port of the DI modality (`phonicsBlenderScript.ts` is port 1,
 * `soundSwapScript.ts` port 2). The exact wording IS the pedagogy (DISTAR
 * discipline), so these lines are authored, never generated. Item CONTENT
 * (which nouns, which emoji, how many on the many-side) stays generator-scoped
 * to the objective; this module owns only the cue SHAPE, the judging contract,
 * and the correction wording.
 *
 * WHY THIS EXISTS (qa/di/BACKLOG.md item 16). word-flip was already half of
 * this: an open mic, `useVoiceAnswer`, and a header that said the child "SAYS
 * the transformed word". What it also shipped was three tap chips — the answer,
 * the bare singular, and the over-regularized form — plus a 1600ms auto-advance
 * timer and a Next button. Those chips were BOTH defects at once: tapping
 * "dogs" out of three printed words is reading, not producing a plural (a child
 * who cannot form a plural taps it correctly), and the chip PRINTS THE ANSWER
 * on screen, which is the answer-leak gate outright. The catalog defended it by
 * noting a pre-reader cannot read the chips; Grade 1 can. One deletion closed
 * both.
 *
 * WHAT IS MODELED, AND WHAT IS NOT — this is the per-skill question and it has
 * a THIRD answer here. In phonics-blender the model IS the answer (blending is
 * reproduction). In sound-swap it must not be, and nothing is modeled before
 * the ask at all. Here the rule is modeled and the answer is not: the opening
 * line teaches "one hat, two hats" with a noun that is NOT in this session, and
 * then asks about the child's noun. Plural formation is a RULE, and a rule
 * shown on a different word is taught rather than given away. The catalog's own
 * law survives verbatim into every line below: *saying the singular ("dog") is
 * safe, the plural ("dogs") is a leak.*
 *
 * ⚠️ THE OPENING LINE CARRIES ITS OWN HOW-TO-PLAY, AND THAT IS A FIX, NOT A
 * STYLE CHOICE (residual SWAP-1, observed live 2026-08-09 on sound-swap). Ports
 * 1 and 2 put the how-to-play in the CATALOG as a directive — "before the
 * scripted line, tell them HOW TO PLAY in kid words" — so the opening turn had
 * two jobs: compose something, then recite something. Driven live the tutor did
 * the first job, spoke the literal string "[DI_SWAP_ITEM]", improvised its own
 * ask, and only reached the scripted line after a barge-in. Item 1 ran without
 * its model. The fix is to stop asking one turn to do two jobs: the how-to-play
 * is TEXT INSIDE the quote, so the opening turn's only job is the one every
 * other turn has — speak this exactly. Nothing here asks the tutor to compose.
 *
 * ANSWER-LEAK RULE (di-word-reading's, inherited through both earlier ports).
 * The one-thing word and its picture ARE the stimulus and are shown. The
 * many-side word is the answer: it must not be printed, spoken, or offered as a
 * chip before the child says it. The first moment it may appear is the tutor's
 * own affirmation.
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn"). Standing
 * gate 2 (collision) — no line below opens with either token except the verdict
 * branches themselves; classic DISTAR's "My turn." model opener is FORBIDDEN
 * here and the model opens with "Listen:" instead, exactly as di-letter-sounds,
 * di-word-reading, phonics-blender and sound-swap resolved it.
 *
 * RESPONSE CLASS (standing gate 1). The answer is ONE short word said aloud —
 * the class di-word-reading benched and ships on, and the class both live ports
 * run. No new bench sitting is owed. The one honest residual is that the answer
 * differs from the stimulus by a single word-final /s/ or /z/, so the ASR
 * transcript will sometimes drop it; that is exactly why the Live tutor judges
 * the AUDIO in-band and word-matching is only the reporting channel.
 *
 * NO PHONEMES ARE SPOKEN HERE, so this is the one port that does not touch
 * `phonemeVoice`: every word in every line below is an ordinary English word
 * the voice already says correctly. If a future eval mode ever names an ending
 * SOUND out loud ("the sss on the end"), it must go through that module.
 */

/** One "one → many" item. Mirrors the generator's derived shape. */
export interface FlipItem {
  id: string;
  /** The one-thing word shown in the frame — the STIMULUS ("dog"). Safe to say. */
  singular: string;
  /** The word the child must PRODUCE ("dogs"). Code-derived, never spoken early. */
  plural: string;
  /** How many on the many-side (2-5). */
  count: number;
}

/**
 * Number words for the many-side. Spoken AND printed from here, so the tutor's
 * "Now there are three" can never disagree with the caption over the pictures.
 */
const COUNT_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

export const countWord = (count: number): string => COUNT_WORDS[count] ?? String(count);

/** Sentence-initial form of the same word — "Three what?" */
export const countWordCapitalized = (count: number): string => {
  const word = countWord(count);
  return word.charAt(0).toUpperCase() + word.slice(1);
};

/**
 * Nouns the OPENING line may use to model the rule. Code-owned on purpose: the
 * model noun must be a clean regular -s plural, and it must not be a word this
 * session is going to ask about — a child who has just been handed "one dog,
 * two dogs" is repeating, not applying a rule. Eight entries against a maximum
 * of five challenges guarantees `pickModelNoun` always finds a free one.
 */
const MODEL_NOUNS = ['hat', 'cup', 'bug', 'pen', 'mug', 'bed', 'van', 'rug'] as const;

/** A model noun that appears nowhere in this session's items. */
export const pickModelNoun = (items: FlipItem[]): string => {
  const taken = new Set(items.map((item) => item.singular.trim().toLowerCase()));
  return MODEL_NOUNS.find((noun) => !taken.has(noun)) ?? MODEL_NOUNS[0];
};

/**
 * The rule, modeled on a noun that is NOT the answer — the teaching half of the
 * opening line, and the same move the correction makes on the child's own word.
 */
export const ruleModel = (modelNoun: string): string =>
  `One ${modelNoun}, two ${modelNoun}s — when there is more than one, you say the new word.`;

/**
 * The one→many pair for the CHILD'S word, carried through to the answer. This
 * is the correction's teaching half (standing gate 3: every correction
 * re-models, then re-elicits) and the first legitimate moment the plural is
 * spoken at all.
 */
export const pairModel = (item: FlipItem): string =>
  `one ${item.singular}, ${countWord(item.count)} ${item.plural}.`;

/**
 * The spoken ask — THREE BEATS: name the one thing, say how many there are now,
 * hand it over. The answer is nowhere in it.
 *
 * The hand-over is "{Count} what?" rather than the family's usual "What word?".
 * That is deliberate and it is the pedagogy: "What word?" after "Now there are
 * three" can be answered honestly with "dog" — the child names the picture and
 * is technically right — whereas "Three what?" has exactly one correct English
 * completion and it is the plural. An ambiguous ask is not a harder task, it is
 * a broken one (the sound-swap `nameTargetSound` ruling, applied a second time).
 */
export const askLine = (item: FlipItem): string =>
  `Listen: one ${item.singular}. Now there are ${countWord(item.count)}. Your turn. ${countWordCapitalized(item.count)} what?`;

/**
 * The in-band judging contract for one item. The Live tutor hears the raw audio
 * and judges the attempt ITSELF; the engine reads which branch it took from the
 * sentinel opener and alone decides progression.
 *
 * Three rules carry the pedagogy:
 *  - The plural counts whether it arrives bare ("dogs") or inside the natural
 *    phrase a child actually says ("three dogs"). Refusing the phrase would
 *    correct a child who was right.
 *  - Saying the SINGULAR back is the signature error of this skill — the child
 *    named the picture instead of transforming the word. It is fluent,
 *    confident and completely unchanged, which makes it the answer most likely
 *    to be wrongly affirmed. The contract names it explicitly, exactly as
 *    sound-swap names the starting-word-back.
 *  - The over-regularized form ("dogses") is a REAL Kindergarten error, not
 *    carelessness: the child applied the rule twice. It is wrong and it takes
 *    the correction branch — warmly, and without dwelling.
 */
export function judgingContract(item: FlipItem) {
  return `Then wait for the learner to speak.
Each time the learner responds, judge the audio you heard against the word "${item.plural}":
- The learner said ${item.plural} — on its own, or inside a short phrase like "${countWord(item.count)} ${item.plural}": say exactly "Yes, ${item.plural}." and stop.
- Anything else — saying "${item.singular}" back with no ending added, adding too much ending like "${item.singular}ses", saying only the number, or a different word: say exactly "My turn: ${pairModel(item)} Your turn. ${countWordCapitalized(item.count)} what?" and stop, then wait again.
Judge on the ENDING: the answer is "${item.singular}" with the ending sound added and nothing more. Saying the one-thing word back is not the answer — changing it is the whole task. An extra syllable on the end is not the answer either.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;
}

/**
 * MODEL THE RULE → TEST, in one turn.
 *
 * `opening: true` prepends the how-to-play AS SPOKEN TEXT (residual SWAP-1 —
 * see the module header). It is given at every grade, not just to pre-readers:
 * this sentence is the DI MODEL, not a reading scaffold, and a child who can
 * read "Say the new word!" off the screen still deserves to hear the rule
 * applied once before being asked to apply it.
 */
export const itemCue = (
  item: FlipItem,
  opts: { opening?: boolean; modelNoun?: string } = {},
) =>
  `[DI_FLIP_ITEM]${opts.opening
    ? ' You are running a short, brisk one-and-many word game for a young child.'
      + ' Never say, reproduce, or invent text inside square brackets; those labels are'
      + ' private application metadata. Speak the quoted line below and nothing else —'
      + ' it already contains the greeting and how to play, so do not add your own.'
    : ''}
Speak exactly:
"${opts.opening && opts.modelNoun ? `${ruleModel(opts.modelNoun)} ` : ''}${askLine(item)}"
${judgingContract(item)}`;

/**
 * Corrections capped: acknowledge neutrally and move on. A hard word resurfaces
 * through distributed review, not by drilling a frustrated five-year-old in
 * place.
 */
export const moveOnCue = (item: FlipItem, next: FlipItem | null) => next
  ? `[DI_FLIP_MOVE_ON] Stop correcting "${item.id}". Speak exactly:
"Good try. We'll play that one again later. ${askLine(next)}"
${judgingContract(next)}`
  : `[DI_FLIP_MOVE_ON] Stop correcting "${item.id}". Speak exactly:
"Good try. We'll play that one again later. That's the end of our word game."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_FLIP_COMPLETE] Speak exactly: "That's the end of our word game. Great word flipping today!"`;

/**
 * A tapped picture card speaks the ONE-THING word. This is the primitive's
 * stimulus channel for a child who does not recognise the emoji, and it is
 * NEVER withdrawn by band or support tier, so it is an ordinary send rather
 * than anything the loop paces. Kept self-contained (the word is in the body,
 * not only the tag) because the catalog's directive keys on the prefix.
 *
 * It speaks the SINGULAR and says so twice over: the plural is the answer, and
 * the model most likely to be "helpful" here is one that volunteers it.
 */
export const pronounceCue = (singular: string) =>
  `[SAY_WORD] Say this word clearly, twice, and nothing else: "${singular}". `
  + `Do NOT add the ending that means more than one, do not say any other word, `
  + `and do not treat this as an attempt to judge.`;
