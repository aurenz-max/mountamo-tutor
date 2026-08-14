/**
 * phonicsBlenderScript — HAND-AUTHORED Direct Instruction script for
 * phonics-blender. The exact wording IS the pedagogy (DISTAR discipline), so
 * these lines are authored, never generated. Item CONTENT (which words, which
 * phonemes, the emoji) stays generator-scoped to the objective; this module
 * owns only the cue SHAPE, the judging contract, and the correction wording.
 *
 * WHY THIS EXISTS (2026-08-09, user ruling). phonics-blender had a spoken judge
 * bolted onto the ANSWER while the LOOP stayed click-driven: a push-to-talk mic
 * button, a Check button, a Blend button, a Next Word button, and a
 * `setTimeout` between phases. The tutor now owns every transition.
 *
 * THE TASK IS PURELY VERBAL (second user ruling, same day, after driving it).
 * The first port kept the tile-arranging step and made it a judged gesture, so
 * a word took two answers: arrange, then speak. Driven live, the tutor said
 * "Your turn — put the sounds in order" and the child answered by SAYING
 * "k-a-t" — the pedagogically correct response to a blending task, and the one
 * the screen was not asking for. Blending IS a verbal skill: you look at the
 * letters, you say each sound, you run them together. Dragging tiles is
 * sequencing practice wearing a blending costume. So the letters are now a
 * STIMULUS the child reads, not pieces they assemble, and there is exactly one
 * answer per word: the spoken blend, judged in-band from the audio.
 *
 * ANSWER-LEAK RULE (inherited from di-word-reading, and it bit this primitive
 * live). The letters on screen ARE the stimulus and must be shown. Everything
 * that hands over the ANSWER before the child says it must not: no printed
 * whole word ahead of the read, and no picture — a cat emoji tells a
 * five-year-old the word without a single sound being blended. The emoji is a
 * POST-affirmation reward only.
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn"). Standing
 * gate 2 (collision) — no line below opens with either token except the verdict
 * lines themselves; classic DISTAR's "My turn." model opener is FORBIDDEN here
 * and the model line opens with "Listen." instead, exactly as di-letter-sounds
 * and di-word-reading resolved it. Standing gate 3 — every correction re-models
 * and then re-elicits.
 *
 * RESPONSE CLASS (standing gate 1). The answer is ONE short word said aloud —
 * the class di-word-reading benched and ships on. The child may sound it out
 * first; that is the skill, not a fault, and the contract affirms it either
 * way. Words outside short-vowel CVC (the `cvce` / `digraph` / `advanced`
 * modes) widen the pool but not the response SHAPE.
 */

import { speakablePhoneme, speakableWalk } from './phonemeVoice';

/** One word the child sounds out and blends aloud. Mirrors the generator. */
export interface BlendItem {
  id: string;
  targetWord: string;
  phonemes: Array<{ id: string; sound: string; letters: string }>;
  emoji?: string;
}

/**
 * "/k/ … /a/ … /t/" — the modeled sound-by-sound walk, ellipses included so the
 * tutor paces it instead of running the sounds together.
 *
 * Unlike sound-swap (whose walk was deleted on a user ruling — see
 * `phonemeVoice.ts`), THIS walk stays: running the sounds together is the skill
 * being taught here, not a scaffold around it. But it goes through
 * `phonemeVoice` for the same reason that ruling existed — a voice cannot say
 * `/æ/`. Latin-letter phonemes (`/k/`, `/a/`, `/t/`) pass through untouched, so
 * every CVC word reads exactly as it did; only the glyphs a voice would have
 * stumbled over change. If a word contains a sound we have no spelling for, the
 * walk is dropped entirely rather than spoken raw, and the caller models the
 * whole word instead — the same degrade the `hard` tier already ships.
 */
export const soundWalk = (item: BlendItem): string =>
  speakableWalk(item.phonemes.map((p) => p.sound)) ?? '';

/** Is the sound-by-sound model sayable for this word at all? */
export const canWalk = (item: BlendItem): boolean => soundWalk(item).length > 0;

/**
 * The in-band judging contract for one word. The Live tutor hears the raw audio
 * and judges the attempt ITSELF; the engine reads which branch it took from the
 * sentinel opener and alone decides progression.
 *
 * Two rules carry the pedagogy:
 *  - A sound-out that ENDS in the whole word is CORRECT. Blending aloud is the
 *    skill being taught at this age; marking it down would punish the method.
 *  - Separate sounds with no word at the end is NOT correct. Running them
 *    together is the entire thing being measured, so "cuh-a-tuh" unfinished is
 *    an unfinished answer, and gets the correction, warmly.
 * Strict on near neighbours (cat/cap, pin/pen) for the reason di-word-reading
 * is: affirming a close-but-different word teaches a child their miss was right.
 */
export function judgingContract(item: BlendItem) {
  return `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner answers.
Each time the learner responds, judge the audio you heard against the word "${item.targetWord}":
- The learner said ${item.targetWord} — straight through, or sounded it out and then said it fast: say exactly "Yes, ${item.targetWord}." and stop.
- Anything else — a different word (even one that sounds close to ${item.targetWord}), or only the separate sounds without ever running them into the whole word: say exactly "My turn: ${canWalk(item) ? `${soundWalk(item)} — ` : ''}${item.targetWord}. Your turn. What word?" and stop — the learner tries again while you stay silent.
Judge strictly on the FINAL word: a near-sounding DIFFERENT word is wrong, not close enough. Sounding it out first is correct, not a fault.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, you stay silent until the application's next instruction.`;
}

/**
 * How to play, as SPOKEN TEXT — residual SWAP-1, observed on sound-swap's first
 * live run (2026-08-09) and fixed here after word-flip (port 3) proved the
 * shape. This primitive's opener has the identical two-job structure and was
 * flagged in the same finding.
 *
 * This sentence used to be a CATALOG DIRECTIVE: "on the FIRST [DI_BLEND_ITEM],
 * before the scripted line, tell them HOW TO PLAY in kid words". That gives the
 * opening turn two jobs — compose something, then recite something — and on
 * sound-swap the tutor did the first, spoke the literal bracket tag, improvised
 * its own ask, and only reached the scripted line after a barge-in. Item 1 ran
 * without its model. As text inside the quote, the opening turn's only job is
 * the one every other turn has: speak this exactly.
 */
export const HOW_TO_PLAY = 'Tap a letter to hear its sound. Then say the whole word out loud!';

/**
 * MODEL → GUIDE → TEST, the DISTAR blending sequence, in one turn.
 *
 * `nameSounds: false` is the hard support tier, where the screen shows the word
 * unsegmented: the tutor must not hand back by voice the segmentation the tier
 * just took off the screen, so it models the word only. Tap-to-hear is never
 * withdrawn, so a stuck child can still recover a sound themselves.
 *
 * `howToPlay` prepends the protocol sentence above and is passed at Grade K
 * only: for a pre-reader the voice is the only instruction channel, while a
 * reader has the same protocol printed under the letters.
 */
export const itemCue = (
  item: BlendItem,
  opts: { nameSounds: boolean; opening?: boolean; howToPlay?: boolean },
) =>
  `[DI_BLEND_ITEM]${opts.opening
    ? ' You are running a short, brisk sound-blending practice for a young reader.'
      + ' Never say, reproduce, or invent text inside square brackets; those labels are'
      + ' private application metadata. Speak the quoted line below and nothing else —'
      + ' it already contains how to play, so do not add your own.'
    : ''}
Speak exactly:
"${opts.opening && opts.howToPlay ? `${HOW_TO_PLAY} ` : ''}${opts.nameSounds && canWalk(item)
    ? `Listen: ${soundWalk(item)} … ${item.targetWord}. Together: ${soundWalk(item)} … ${item.targetWord}. Your turn. What word?`
    : `Listen: ${item.targetWord}. Together: ${item.targetWord}. Your turn. What word?`}"
${judgingContract(item)}`;

/**
 * Corrections capped: acknowledge neutrally and move on. A hard word resurfaces
 * through distributed review, not by drilling a frustrated five-year-old in
 * place.
 */
export const moveOnCue = (item: BlendItem, next: BlendItem | null, nameSounds: boolean) => next
  ? `[DI_BLEND_MOVE_ON] Stop correcting "${item.id}". Speak exactly:
"Good try. We'll practice that one again later. ${nameSounds && canWalk(next)
    ? `Listen: ${soundWalk(next)} … ${next.targetWord}. Together: ${soundWalk(next)} … ${next.targetWord}. Your turn. What word?`
    : `Listen: ${next.targetWord}. Together: ${next.targetWord}. Your turn. What word?`}"
${judgingContract(next)}`
  : `[DI_BLEND_MOVE_ON] Stop correcting "${item.id}". Speak exactly:
"Good try. We'll practice that one again later. That's the end of our blending practice."`;

/** Final word affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_BLEND_COMPLETE] Speak exactly: "That's the end of our blending practice. Great blending today!"`;

/**
 * A tapped letter speaks its sound. Contract R2 — this is the primitive's whole
 * stimulus channel and is NEVER withdrawn by band or support tier, so it is an
 * ordinary send rather than anything the loop paces. Kept self-contained (the
 * sound is in the body, not only the tag) because the catalog's pronunciation
 * directive keys on a different prefix.
 *
 * It deliberately speaks the SOUND, never the whole word: the word is the
 * answer. A child who taps every letter has assembled the parts by ear, which
 * is what the tap is for — they still have to run them together themselves.
 */
export const pronounceCue = (raw: string) => {
  // Rendered for the VOICE, not the screen: the letter card keeps showing what
  // the generator wrote while the tutor is asked for a sound it can actually
  // say. Latin-letter phonemes are unchanged.
  const spoken = speakablePhoneme(raw);
  return `[PRONOUNCE_SOUND] This sound is ${spoken}. ${spoken}.`;
};
