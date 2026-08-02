/**
 * diLetterSoundsScript — HAND-AUTHORED Direct Instruction script for the
 * di-letter-sounds primitive. The exact wording IS the pedagogy (DISTAR
 * discipline), so these lines are authored per pack, never generated. Item
 * CONTENT (which letters, keywords, pictures) is generator-scoped to the
 * objective; this module owns only the model/guide/test/verify/correction
 * cue SHAPE and the in-band judging contract.
 *
 * Ported SHAPE from the DI bench's diScript.ts (proven across four bench runs:
 * open-mic, probe, hook-parity, engine-gate). Differences from the bench:
 * - No hardcoded DEFAULT_ITEMS — items arrive from the generator as challenges.
 * - Scope is continuous letter SOUNDS only. Letter NAMES stay BLOCKED
 *   (LetterSpotter homophone ruling); digraphs/blends/stop consonants are
 *   deliberately excluded (a later benched item).
 *
 * Sentinels are the engine defaults (DI_SENTINELS: affirm "Yes", correct
 * "My turn") — collision-checked against every line below: no model/guide/test
 * line opens with either sentinel, so the sentence-scoped verdict scan is safe.
 */

/**
 * The eval-mode task identities this pack teaches (L1 ladder, all within the
 * benched continuant response class — the produced audio is a held sound in
 * every mode):
 * - `letter_sound`         — isolated grapheme→phoneme (the base skill).
 * - `letter_sound_review`  — mixed-set cumulative/spaced review of taught sounds
 *                            (same production, a WIDE cross-menu spread not a
 *                            focused teaching cluster).
 * - `first_sound_in_word`  — onset isolation: the tutor says a whole word and
 *                            the child produces its FIRST sound (phonemic
 *                            awareness). Continuant keywords only (a short-vowel
 *                            onset distorts for a K child). Letter NAMES stay
 *                            BLOCKED; blends/digraphs/stops bench first.
 */
export type DiLetterSoundChallengeType =
  | 'letter_sound'
  | 'letter_sound_review'
  | 'first_sound_in_word';

/**
 * The within-mode SUPPORT tier (L3, 2026-08-01). Second field of the two-field
 * contract: `challengeType` = WHICH sound skill, `supportTier` = HOW MUCH of
 * the DISTAR sequence the child is handed before they produce the sound. Third
 * use of the DI L3 template (di-sentence-reading 07-25 the original,
 * di-math-facts 08-01 the closest sibling):
 *
 *   easy   MODEL + GUIDE + TEST   hear the sound twice, then produce it alone
 *   medium MODEL + TEST           hear it once, then produce it alone
 *   hard   TEST only              produce it COLD, never having heard it
 *
 * Why `hard` matters here: the model line SPEAKS the very sound the child is
 * about to produce — the echo route. At hard the item becomes a genuine
 * grapheme→sound retrieval probe and the silent `responseMs` becomes true
 * retrieval time rather than partly an echo delay. Two per-mode nuances the
 * withdrawal must respect (and does, because the test lines already carry the
 * stimulus, never the target sound):
 *  - `first_sound_in_word`: the spoken WORD stays in the ask at every tier —
 *    it is the stimulus (there is no printed grapheme on that stage) — but its
 *    first sound is never spoken pre-attempt at hard: a genuine onset probe.
 *  - keyword-elicited vowels: the ask ("Your turn. Say apple.") still speaks
 *    the keyword — the elicitation requires it — so what hard withdraws is the
 *    model's sound-naming ("The first sound in apple is short a"), never the
 *    word. The guard protects the SOUND, not the word.
 *
 * The withdrawal is identical across all three task identities, and that is
 * correct rather than lazy: every mode is the same act (meet the stimulus,
 * produce the held sound), so the same three sub-steps precede it. A MODE
 * changes which items are drawn and how the cue is phrased; a TIER changes how
 * much of the sequence is handed over.
 *
 * NEVER withdrawn at any tier:
 *  - the on-screen stimulus (printed grapheme, or keyword + picture for onset
 *    items — withdrawing it would change the task identity);
 *  - the CORRECTION's re-model (standing gate 3 — DISTAR always re-models on
 *    an error; remediation is not scaffolding). This pack still carries the
 *    PLAIN correction — the contrastive port is frozen on HUMAN-CHECKS #55
 *    (family rule);
 *  - the restating AFFIRM (it models the sound at the moment it is most useful);
 *  - the judging contract (a tier changes how much help precedes the attempt,
 *    never how it is judged — else tiers stop being comparable evidence).
 */
export type DiLetterSoundsSupportTier = 'easy' | 'medium' | 'hard';

/** One letter-sound item the tutor drills. Mirrors the generator output shape. */
export interface DiLetterSoundChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills (see DiLetterSoundChallengeType).
   *  Drives the cue SHAPE (onset items get word-first lines) and the kid-facing
   *  display (onset items show the picture/word, never the isolated grapheme). */
  challengeType: DiLetterSoundChallengeType;
  /** How much of the DISTAR sequence precedes the child's attempt. Absent =
   *  easy (the L0 shape), so a session generated before L3 behaves exactly as
   *  it did. */
  supportTier?: DiLetterSoundsSupportTier;
  /** The grapheme shown on screen, e.g. "m". */
  letter: string;
  /** The stretched continuous sound the learner must produce, e.g. "mmm". */
  spoken: string;
  /** A picturable keyword whose FIRST sound is the target, e.g. "moon". */
  keyword: string;
  /** Emoji picture support for the pre-reader (attached in code by the generator). */
  emoji: string;
  /** Vowels elicit through the keyword ("say apple"); continuants elicit the
   *  isolated sound ("what sound?"). */
  elicitation: 'isolated' | 'keyword';
  /** Whole-token ASR aliases — passive cross-check only, never the judge. */
  asrAliases?: string[];
}

const sentenceCase = (value: string | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

/** Onset-isolation items (first_sound_in_word) drill the SAME continuant sound
 *  but from a whole spoken word, so every cue leads with the word and isolates
 *  its first sound. Checked before elicitation because these items are always
 *  continuants (isolated elicitation) yet need the word-first phrasing. */
const isOnset = (it: DiLetterSoundChallenge) => it.challengeType === 'first_sound_in_word';

/** MODEL: the tutor says the sound first (DISTAR "my turn"). Single repetition —
 *  bench run-2 timing showed tutor talk-time dominates the per-item cycle; brisk
 *  pacing is the product at this age. */
export const modelLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `Listen: ${it.keyword}. ${sentenceCase(it.keyword)} starts with ${it.spoken}.`
    : it.elicitation === 'keyword'
      ? `The first sound in ${it.keyword} is short ${it.letter}. Listen: ${it.keyword}.`
      : `This sound is ${it.spoken}, as in ${it.keyword}. Listen: ${it.spoken}.`;

/** GUIDE: the tutor and learner say it together ("say it with me"). */
export const guideLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `Together: ${it.keyword} starts with ${it.spoken}.`
    : it.elicitation === 'keyword'
      ? `Together, say ${it.keyword}: ${it.keyword}.`
      : `Together: ${it.spoken}, as in ${it.keyword}.`;

/** TEST: the learner produces it alone ("your turn"). */
export const testLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `Your turn. What is the first sound in ${it.keyword}?`
    : it.elicitation === 'keyword'
      ? `Your turn. Say ${it.keyword}.`
      : 'Your turn. What sound?';

/** Affirmation branch. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `Yes, ${it.spoken}.`
    : it.elicitation === 'keyword'
      ? `Yes. ${sentenceCase(it.keyword)} starts with short ${it.letter}.`
      : `Yes, ${it.spoken}.`;

/** Correction branch. MUST begin with "My turn" — the engine scans that
 *  sentinel. Standing gate 3: every correction re-models then re-elicits. */
export const correctionLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `My turn: ${it.keyword} starts with ${it.spoken}. Your turn. What is the first sound in ${it.keyword}?`
    : it.elicitation === 'keyword'
      ? `My turn: ${it.keyword}. Your turn. Say ${it.keyword}.`
      : `My turn: ${it.spoken}, as in ${it.keyword}. Your turn. What sound?`;

const targetDescription = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `the first sound in "${it.keyword}" (the continuous sound ${it.spoken})`
    : it.elicitation === 'keyword'
      ? `the word "${it.keyword}"`
      : `the continuous sound ${it.spoken}`;

/**
 * The in-band judging contract for one item. The Live tutor hears the raw
 * audio and judges each attempt ITSELF; the engine reads which branch it took
 * from the output transcript (sentinel scan) and alone decides progression.
 */
export const judgingContract = (it: DiLetterSoundChallenge) => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against ${targetDescription(it)}:
- Correct or reasonably close for a kindergartener: say exactly "${verifyLine(it)}" and stop.
- Wrong, missing, or a different sound: say exactly "${correctionLine(it)}" and stop, then wait again.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/**
 * The spoken lead-in for one item, composed from its SUPPORT TIER. This is the
 * whole L3 ladder: `easy` hands over model + guide, `medium` only the model,
 * `hard` nothing at all. Absent tier = `easy`, the L0 shape — at which the
 * composed block is byte-for-byte the bench-proven "${model} ${guide} ${test}"
 * string the L0 eval runs validated.
 */
const leadInFor = (it: DiLetterSoundChallenge): string => {
  switch (it.supportTier) {
    case 'hard':   return '';
    case 'medium': return `${modelLine(it)} `;
    case 'easy':
    default:       return `${modelLine(it)} ${guideLine(it)} `;
  }
};

/**
 * At `hard` the tutor must not say the target SOUND before the learner does —
 * that is the entire point of the tier: the model line is the echo route, and
 * withdrawing it makes the item a genuine retrieval probe. The omitted lines
 * already withhold it (the tutor may only speak what "Speak exactly" quotes),
 * but this makes the intent explicit per item rather than relying on the
 * omission alone: the catalog's scaffolding levels and struggle responses are
 * a second channel that could otherwise volunteer the sound (the tier gotcha —
 * a tier withheld by the script but revealed by the tutor is only half
 * applied). Guarded per-SOUND, never per-word: onset asks and keyword
 * elicitations still speak the stimulus word inside the quoted line by design.
 * The CORRECTION branch still re-models at every tier; this guards the
 * pre-attempt window only.
 */
const coldSoundGuard = (it: DiLetterSoundChallenge): string =>
  it.supportTier === 'hard'
    ? '\nThe learner is answering this one cold on purpose: do NOT say, stretch, or model the target sound before they answer.'
    : '';

/** Present one item: the tier's lead-in, then the test, then judge in-band
 *  until told otherwise. */
export const itemCue = (it: DiLetterSoundChallenge, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk kindergarten letter-sounds practice. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${leadInFor(it)}${testLine(it)}"${coldSoundGuard(it)}
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward.
 *  A weak sound resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. The NEXT item presents at ITS tier. */
export const moveOnCue = (it: DiLetterSoundChallenge, next?: DiLetterSoundChallenge) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${leadInFor(next)}${testLine(next)}"${coldSoundGuard(next)}
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. That's the end of our practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our practice. Great work today!"`;

// The DI tutoring block (judging directives, sentinel discipline, struggles)
// lives on the CATALOG entry — catalog/di.ts — since the L2 layer, so both the
// standalone connect fallback and the lesson auth/switch paths resolve it from
// the single source of truth. Any wording change there must be re-checked
// against the sentinel-collision rule this script's cues depend on.
