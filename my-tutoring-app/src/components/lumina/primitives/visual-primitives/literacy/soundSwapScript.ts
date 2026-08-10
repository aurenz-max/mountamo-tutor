/**
 * soundSwapScript — HAND-AUTHORED Direct Instruction script for sound-swap, the
 * SECOND literacy port of the DI modality (pilot: `phonicsBlenderScript.ts`).
 * The exact wording IS the pedagogy (DISTAR discipline), so these lines are
 * authored, never generated. Item CONTENT (which word pairs, which phonemes,
 * where the manipulated sound sits) stays generator-scoped to the objective;
 * this module owns only the cue SHAPE, the judging contract, and the correction
 * wording.
 *
 * WHY THIS EXISTS (qa/di/BACKLOG.md item 16). sound-swap carried BOTH defects
 * the lane exists to undo: a 1400ms `setTimeout` that advanced the challenge on
 * a stopwatch, and a push-to-talk mic the child had to find and press before
 * answering. Underneath them the task itself was a costume — the child TAPPED a
 * phoneme tile or PICKED one of 3-5 sound buttons, and the screen computed the
 * new word. Phoneme manipulation is a purely ORAL skill: you hold a word in your
 * head, change one sound in it, and say what is left. A child who cannot do that
 * can still tap the highlighted tile; a child who can do it can still mis-tap.
 * So the tapping is gone and there is exactly one answer per challenge: the new
 * word, said aloud, judged in-band from the audio.
 *
 * WHAT IS MODELED, AND WHAT IS NOT. In phonics-blender the model IS the answer
 * (blending is reproduction, so "Listen: /k/ … /a/ … /t/ … cat" can precede the
 * ask). Here it must not be: the answer is a word the child has to BUILD. So the
 * item cue models only the STIMULUS — the starting word, optionally segmented —
 * then names the move and stops. The move itself is modeled in the CORRECTION,
 * which is exactly where DI puts it (standing gate 3: every correction re-models
 * and then re-elicits).
 *
 * THE ASK IS THREE BEATS AND NOTHING ELSE — user ruling, 2026-08-09, from the
 * first live run: *"the 'an… Add /p/' works great and the student can clearly
 * hear the instructions, but the gibberish comes across as a distraction."*
 * The shipped line walked the starting word sound by sound first
 * ("Listen: an. /æ/ … /n/. Add /p/…"), and the tutor's voice cannot say `/æ/`.
 * The walk is DELETED — not made sayable, deleted: it was a scaffold around the
 * instruction, and the instruction was already clear without it. What survives
 * is `Listen: <word>. <move>. Your turn. What word?` at every tier.
 *
 * Where a phoneme genuinely CANNOT be removed — the ask itself, since
 * "Change /æ/ to /ɛ/" is the whole instruction — it is rendered through
 * `phonemeVoice`, which maps the non-Latin glyphs to di-letter-sounds' own
 * spellings ("aaa", "eee"). Latin-letter phonemes like `/k/` and `/p/` are left
 * exactly as authored, because those are the ones the user confirmed read well.
 *
 * TWO TIER LEVERS DIED HERE, and neither is quietly ignored (both are asserted
 * dead in the tests). `optionCount` went with the answer buttons.
 * `nameTargetSound` went with the walk: it originally meant "the instruction
 * does not name the sound to change", which was survivable only because 3-5
 * answer buttons made the answer determinate anyway — with them gone, an
 * unnamed target makes the ask AMBIGUOUS ("change one sound in cat" is answered
 * correctly by cap, can, cot, bat, hat and a dozen more) and the contract would
 * correct a child who was right. **An ambiguous ask is not a harder task, it is
 * a broken one.** It was then re-based onto the walk — and the walk is now gone
 * too. So this primitive's within-mode difficulty is carried by the STRUCTURAL
 * axis (WHERE the sound sits: beginning → end → middle, which is where it
 * belonged all along) plus the two on-screen perception levers. That is an
 * honest outcome, not a gap: the spoken ask is the same three beats for every
 * child, and only the problem underneath it gets harder.
 *
 * ANSWER-LEAK RULE (di-word-reading's, inherited through the pilot). The
 * starting word and its sounds ARE the stimulus and are shown. The RESULT word
 * is the answer: it must not be printed, pictured, or spoken before the child
 * says it. The generator's `resultImage` description is a post-affirmation
 * reward, on the same footing as the pilot's emoji.
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn"). Standing
 * gate 2 (collision) — no line below opens with either token except the verdict
 * branches themselves; classic DISTAR's "My turn." model opener is FORBIDDEN
 * here and the model line opens with "Listen." instead, exactly as
 * di-letter-sounds, di-word-reading and phonics-blender resolved it.
 *
 * RESPONSE CLASS (standing gate 1). The answer is ONE short word said aloud —
 * the class di-word-reading benched and ships on, and the same class the pilot
 * runs. Deletion answers reach into VC words ("at", "in", "up"), which are
 * shorter than anything benched; that is the one honest residual, flagged for
 * the mic sitting rather than assumed away.
 */

import { speakablePhoneme } from './phonemeVoice';

/** One phoneme-manipulation challenge. Mirrors the generator's derived shape. */
export interface SwapItem {
  id: string;
  operation: 'addition' | 'deletion' | 'substitution';
  originalWord: string;
  originalPhonemes: string[];
  resultWord: string;
  addPhoneme?: string;
  addPosition?: 'beginning' | 'end';
  deletePhoneme?: string;
  oldPhoneme?: string;
  newPhoneme?: string;
}

/**
 * The MOVE, as an imperative. This names the sound every time, at every tier —
 * an unnamed target has many right answers, and a contract cannot judge a
 * question that has many right answers.
 *
 * Every phoneme here goes through `speakablePhoneme`: this line is SPOKEN, and
 * a medial-vowel swap ("Change /æ/ to /ɛ/") is the one place a phoneme cannot
 * be dropped for being unsayable.
 */
export function moveAsk(item: SwapItem): string {
  const say = speakablePhoneme;
  if (item.operation === 'addition') {
    return `Add ${say(item.addPhoneme ?? '')} at the ${item.addPosition ?? 'beginning'}.`;
  }
  if (item.operation === 'deletion') {
    return `Take away ${say(item.deletePhoneme ?? '')}.`;
  }
  return `Change ${say(item.oldPhoneme ?? '')} to ${say(item.newPhoneme ?? '')}.`;
}

/**
 * The move re-stated CONTRASTIVELY and carried through to the answer — the
 * teaching half of the correction. It always names both the starting word and
 * the new one, so the child hears the difference the sound made rather than
 * just the word they missed.
 */
export function moveModel(item: SwapItem): string {
  const say = speakablePhoneme;
  if (item.operation === 'addition') {
    return `${item.originalWord} with ${say(item.addPhoneme ?? '')} at the ${item.addPosition ?? 'beginning'} — ${item.resultWord}.`;
  }
  if (item.operation === 'deletion') {
    return `${item.originalWord} without ${say(item.deletePhoneme ?? '')} — ${item.resultWord}.`;
  }
  return `${item.originalWord} with ${say(item.newPhoneme ?? '')} instead of ${say(item.oldPhoneme ?? '')} — ${item.resultWord}.`;
}

/**
 * The in-band judging contract for one challenge. The Live tutor hears the raw
 * audio and judges the attempt ITSELF; the engine reads which branch it took
 * from the sentinel opener and alone decides progression.
 *
 * Three rules carry the pedagogy:
 *  - The new word said aloud is CORRECT, whether it arrives whole or is sounded
 *    out first. Sounding out is the method being taught at this age.
 *  - Saying the STARTING word back is the signature error of this skill — the
 *    child held the word but never operated on it. It looks like an answer, it
 *    is fluent, and it is wrong; the contract names it explicitly so the tutor
 *    cannot mistake fluency for success.
 *  - Strict on near neighbours (bat/cat, pin/pen) for the reason di-word-reading
 *    is: affirming a close-but-different word teaches a child their miss was
 *    right — and in THIS task a near neighbour is usually a different, equally
 *    plausible manipulation, which is exactly the confusion being corrected.
 */
export function judgingContract(item: SwapItem) {
  return `Then wait for the learner to speak.
Each time the learner responds, judge the audio you heard against the word "${item.resultWord}":
- The learner said ${item.resultWord} — on its own, or sounded it out and then said it fast: say exactly "Yes, ${item.resultWord}." and stop.
- Anything else — saying "${item.originalWord}" back unchanged, a different word (even one that sounds close to ${item.resultWord}), or only separate sounds with no word at the end: say exactly "My turn: ${moveModel(item)} Your turn. What word?" and stop, then wait again.
Judge strictly on the FINAL word: a near-sounding DIFFERENT word is wrong, not close enough. Sounding it out first is correct, not a fault. Saying the starting word back is not the answer — changing it is the whole task.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;
}

/**
 * The spoken ask for one challenge — THREE BEATS, and the same three at every
 * tier: name the starting word, name the move, hand it over.
 *
 * There is deliberately no sound-by-sound walk between beats 1 and 2. It was
 * there, the tutor could not say `/æ/`, and the user's ruling from the first
 * live run was to delete it rather than make it sayable: the instruction was
 * already clear without it and the walk read as noise.
 */
const askLine = (item: SwapItem) =>
  `Listen: ${item.originalWord}. ${moveAsk(item)} Your turn. What word?`;

/**
 * How to play, as SPOKEN TEXT — residual SWAP-1, observed on the first live run
 * (2026-08-09) and fixed here after word-flip (port 3) proved the shape.
 *
 * This sentence used to be a CATALOG DIRECTIVE: "on the FIRST [DI_SWAP_ITEM],
 * before the scripted line, tell them HOW TO PLAY in kid words". That gave the
 * opening turn two jobs — compose something, then recite something — and driven
 * live the tutor did the first, spoke the literal string "[DI_SWAP_ITEM]",
 * improvised its own ask ("Now, let's try one. Start with 'at'…") and only
 * reached the scripted line after a barge-in. **Item 1 ran without its model.**
 * The anti-echo warning was already in the opening cue and it did not hold,
 * because the problem was never the warning: it was asking one turn to do two
 * jobs. As text inside the quote, the opening turn's only job is the one every
 * other turn has — speak this exactly.
 */
export const HOW_TO_PLAY = "I'll say a word and one sound to change. You say the new word out loud!";

/**
 * MODEL THE STIMULUS → TEST, in one turn. The starting word is spoken, the
 * change is named, and the child answers. Tap-to-hear is never withdrawn, so a
 * child who wants the sounds can still get them one at a time, on demand,
 * without the tutor reciting them at everybody.
 *
 * `howToPlay` prepends the protocol sentence above and is passed at Grade K
 * only: for a pre-reader the voice is the only instruction channel, while a
 * reader has the same protocol printed under the tiles. It is a band scaffold
 * here, unlike word-flip's opening line, which is the DI MODEL and is spoken to
 * everybody.
 */
export const itemCue = (
  item: SwapItem,
  opts: { opening?: boolean; howToPlay?: boolean } = {},
) =>
  `[DI_SWAP_ITEM]${opts.opening
    ? ' You are running a short, brisk sound-changing practice for a young reader.'
      + ' Never say, reproduce, or invent text inside square brackets; those labels are'
      + ' private application metadata. Speak the quoted line below and nothing else —'
      + ' it already contains how to play, so do not add your own.'
    : ''}
Speak exactly:
"${opts.opening && opts.howToPlay ? `${HOW_TO_PLAY} ` : ''}${askLine(item)}"
${judgingContract(item)}`;

/**
 * Corrections capped: acknowledge neutrally and move on. A hard word resurfaces
 * through distributed review, not by drilling a frustrated five-year-old in
 * place.
 */
export const moveOnCue = (item: SwapItem, next: SwapItem | null) => next
  ? `[DI_SWAP_MOVE_ON] Stop correcting "${item.id}". Speak exactly:
"Good try. We'll practice that one again later. ${askLine(next)}"
${judgingContract(next)}`
  : `[DI_SWAP_MOVE_ON] Stop correcting "${item.id}". Speak exactly:
"Good try. We'll practice that one again later. That's the end of our sound-changing practice."`;

/** Final challenge affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_SWAP_COMPLETE] Speak exactly: "That's the end of our sound-changing practice. Great sound changing today!"`;

/**
 * A tapped tile speaks its sound. This is the primitive's whole stimulus
 * channel and is NEVER withdrawn by band or support tier, so it is an ordinary
 * send rather than anything the loop paces. Kept self-contained (the sound is
 * in the body, not only the tag) because the catalog's pronunciation directive
 * keys on a different prefix.
 *
 * It speaks the SOUND, never a word: both words in this task are answers or
 * become one. A child who taps every sound has the starting word in pieces,
 * which is what the tap is for — they still have to do the change themselves.
 */
export const pronounceCue = (raw: string) => {
  // Rendered for the VOICE, not the screen: the tile keeps showing `/æ/` while
  // the tutor is asked for "aaa". Same defect class as the deleted walk — this
  // channel just never got its own live run to catch it.
  const spoken = speakablePhoneme(raw);
  return `[PRONOUNCE_SOUND] This sound is ${spoken}. ${spoken}.`;
};
