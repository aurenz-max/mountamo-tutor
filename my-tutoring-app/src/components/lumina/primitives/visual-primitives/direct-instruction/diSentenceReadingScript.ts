/**
 * diSentenceReadingScript — HAND-AUTHORED Direct Instruction script for the
 * di-sentence-reading primitive. The exact wording IS the pedagogy (DISTAR
 * discipline), so these lines are authored per pack, never generated. Item
 * CONTENT (which sentences, reward pictures) is generator-scoped to the
 * objective; this module owns only the model/guide/test/verify/correction cue
 * SHAPE, the benched scope ceiling, and the in-band judging contract.
 *
 * BENCH-PROVEN WORDING — every spoken line below is byte-for-byte the
 * `kind: 'sentence'` branch of the bench script that PASSED standing gate 1 on
 * 2026-07-25 (`qa/di-bench/run-2026-07-25-sentence-reading-probe.md`, 10/10
 * items, 10 affirmed / 3 corrected / 0 off-script / 0 unanchored). Do not
 * re-word them without a new sitting; the sitting is what these lines cost.
 *
 * What the sitting SETTLED (do not re-litigate):
 * - (a) Live CAN hear a one-word error inside a 5-8 word utterance: 2/2 on
 *   deliberate single-word OMISSIONS, the hardest class (nothing wrong is
 *   said, something merely isn't). That result is what makes the pack viable.
 * - (b) WHOLE-SENTENCE correction ships. **OVERTURNED 2026-07-25 by the first
 *   live correction run in ANY DI pack** (user sitting, HUMAN-CHECKS #54) —
 *   see `contrastCorrectionLine` below. The sitting's evidence was n=2 and both
 *   were OMISSIONS that the learner self-repaired on the first retry. The live
 *   run produced a SUBSTITUTION ("the pot" for "a pot"), no self-repair, and
 *   the identical whole-sentence re-model three times: a re-model asks the
 *   learner to diff it against their memory of what they just said, which they
 *   cannot do — the reader never learns WHICH word was wrong.
 *   The sitting's stated blocker does not survive inspection either: sentinel
 *   classification matches OPENERS only (`matchesOpener`, judgedLoopModel.ts),
 *   so a mid-line slot cannot threaten it. The residual risk is "speak
 *   exactly" fidelity alone, which is what the next sitting measures.
 *   The plain re-model REMAINS as `correctionLine`, byte-for-byte, for the
 *   case that has nothing to contrast against (silence / unintelligible).
 * - (c) The RESTATING affirm stays ("Yes, that says <whole sentence>"). It
 *   costs ~2-3s against a ~15-17s item cycle whose dominant term is learner
 *   think-time (8-11s). Tutor talk is not the bottleneck for connected text —
 *   the child reading is — and the restatement models the correct reading at
 *   the moment it is most useful.
 *
 * The sentence branch gets its OWN judging criteria. The family's generic
 * "reasonably close for a kindergartener" is right for ONE short production and
 * WRONG for connected text, where "close" rubber-stamps exactly the dropped or
 * swapped word that reading fluency exists to catch.
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn") —
 * collision-checked against every line below (standing gate 2). As in the two
 * sibling reading packs, classic DISTAR's "My turn." MODEL opener is FORBIDDEN
 * (it is the correction sentinel), so the model line opens with "Listen:".
 * Corrections alone keep "My turn:" (standing gate 3: every correction
 * re-models the whole sentence, then re-elicits). The generator additionally
 * refuses any menu sentence that would open a spoken line with a sentinel.
 *
 * ANSWER-LEAK RULE (inherited from di-word-reading, the rung below): decoding
 * print IS the skill, so the stage shows the PRINTED SENTENCE ONLY — no
 * picture, no emoji, no audio pre-cue beyond the DI model line itself, which is
 * the instruction rather than a leak (the measured production is the child's
 * independent read at the TEST step). A challenge's `emoji` is a
 * POST-affirmation reward only.
 */

/**
 * The L1 task identities (2026-07-25). Every one of them is the SAME response
 * class — a printed 3-8 word sentence read aloud, judged word by word — which
 * is the class the standing-gate sitting benched, so the ladder needed no new
 * sitting. What differs between them is which sentences are drawn and therefore
 * which reading skill the item exercises:
 *
 *  - `decodable_sentence`   every content word is CVC-decodable → blending
 *                           TRANSFERRED to connected text (a K/G1 skill in its
 *                           own right, and the mode that gives this pack a K
 *                           home the base mode abstains on).
 *  - `read_sentence`        the base: general reading accuracy over mixed
 *                           decodable + high-frequency vocabulary. L0, unchanged.
 *  - `sentence_review`      cumulative / spaced mix drawn WIDE across the whole
 *                           menu → retention and flexible retrieval, not
 *                           first-time decoding.
 *  - `sight_phrase_sentence` sentences dense in IRREGULAR high-frequency words →
 *                           whole-word recall inside connected text, a different
 *                           process from blending (you cannot sound out "you").
 *
 * A LONGER-text rung is deliberately absent — it would leave the benched 3-8
 * word scope and needs its own bench sitting first.
 *
 * Every mode reads through the SAME bench-proven cue lines below: the model,
 * guide, test, affirm, and correction are all phrased around `it.text`, so the
 * ladder ships with ZERO new spoken copy and nothing re-enters the unproven.
 */
export type DiSentenceReadingChallengeType =
  | 'decodable_sentence'
  | 'read_sentence'
  | 'sentence_review'
  | 'sight_phrase_sentence';

/**
 * The benched scope ceiling. The sitting laddered 3 → 8 words and found NO
 * reliability break — the 8-word item read clean and affirmed first try — so 8
 * is the proven ceiling, not an observed failure point. Longer connected text
 * is UNBENCHED: a generator must never exceed this without a new sitting.
 */
export const MAX_SENTENCE_WORDS = 8;

/** The short end of the ladder. Below this a "sentence" is really a phrase. */
export const MIN_SENTENCE_WORDS = 3;

/**
 * The within-mode SUPPORT tier (L3, 2026-07-25). Second field of the two-field
 * contract: `challengeType` = WHICH reading skill, `supportTier` = HOW MUCH of
 * the DISTAR sequence the child is handed before they read.
 *
 * This pack has zero `showOptions` and no visual scaffolds — like AngleWorkshop,
 * its entire ladder is modality #2, instruction-as-scaffold. The sub-steps were
 * already here: DISTAR's model → guide → test IS a scaffold ladder, and a tier
 * withdraws one step at a time.
 *
 *   easy   MODEL + GUIDE + TEST   hear it read, read it together, then alone
 *   medium MODEL + TEST           hear it read once, then read it alone
 *   hard   TEST only              decode it COLD, never having heard it
 *
 * `hard` is the pedagogically important one: it closes the caveat the birth
 * answer-leak audit left open. The model line speaks the sentence before the
 * child reads it — legitimate DI instruction rather than a leak, but it does
 * leave an echo route open. At `hard` there is no echo route; the child must
 * decode print.
 *
 * NEVER withdrawn at any tier:
 *  - the PRINTED SENTENCE itself (it is the manipulable object — withdrawing it
 *    would turn reading into listen-and-repeat, a different task entirely);
 *  - the CORRECTION's re-model (standing gate 3 — DISTAR always re-models on an
 *    error; remediation is not scaffolding);
 *  - the restating AFFIRM (bench sitting question (c), settled with evidence).
 */
export type DiSentenceReadingSupportTier = 'easy' | 'medium' | 'hard';

/** One printed sentence the tutor drills. Mirrors the generator output shape. */
export interface DiSentenceReadingChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills — one identity at birth. */
  challengeType: DiSentenceReadingChallengeType;
  /** How much of the DISTAR sequence precedes the child's read. Absent = easy
   *  (the L0 shape), so a session generated before L3 behaves exactly as it did. */
  supportTier?: DiSentenceReadingSupportTier;
  /** The printed sentence, exactly as shown and read: "The cat sat." */
  text: string;
  /** Word count (3-8). The pack's structural-difficulty axis, computed in code
   *  from `text` — never trusted from the model. */
  wordCount: number;
  /** Short vowels the decodable content words drill — the phonics scoping key,
   *  carried for reporting and for the /add-eval-modes ladder. */
  vowels?: string[];
  /** POST-affirmation reward picture ONLY — never shown before the read
   *  (the answer IS the printed sentence). */
  emoji?: string;
  /** Whole-utterance ASR aliases — passive cross-check only, never the judge.
   *  Near-neighbour readings (matt/mat, son/sun) live here for reporting.
   *  NOTE the sitting's finding 2: these only agree when the whole read lands
   *  in ONE voice turn, which is why the pack raises `silenceCloseMs`. */
  asrAliases?: string[];
}

/** The printed text as it should be READ. Trailing whitespace only — the
 *  sentence carries its own terminal punctuation, and every spoken line below
 *  depends on that (no line appends a period of its own). */
const sentenceText = (it: DiSentenceReadingChallenge) => it.text.replace(/\s+$/, '');

/** MODEL: the tutor reads the whole sentence fluently. No "as in"/restatement
 *  scaffold and no word-by-word sounding out — for connected text the model IS
 *  the fluent reading the learner copies. */
export const modelLine = (it: DiSentenceReadingChallenge) =>
  `Listen: ${sentenceText(it)}`;

/** GUIDE: choral reading — the DISTAR guided step for connected text. */
export const guideLine = (it: DiSentenceReadingChallenge) =>
  `Together: ${sentenceText(it)}`;

/** TEST: the learner reads it alone. */
export const testLine = (_it: DiSentenceReadingChallenge) =>
  'Your turn. Read it.';

/** Affirmation branch. MUST begin with "Yes" — the engine scans that sentinel.
 *  Restates the whole sentence (sitting question (c): kept). */
export const verifyLine = (it: DiSentenceReadingChallenge) =>
  `Yes, that says ${sentenceText(it)}`;

/** Correction branch — FALLBACK. MUST begin with "My turn" — the engine scans
 *  that sentinel. Standing gate 3: every correction re-models, then re-elicits.
 *  Used when there is NOTHING to contrast (silence, an unintelligible attempt,
 *  or a miss the tutor cannot localise to one word). Byte-for-byte the
 *  bench-proven line; `contrastCorrectionLine` is the preferred branch. */
export const correctionLine = (it: DiSentenceReadingChallenge) =>
  `My turn: ${sentenceText(it)} Your turn. Read it again.`;

/** Correction branch — CONTRASTIVE (preferred whenever the miss is localisable).
 *
 *  Names what the learner actually said and contrasts it against the print
 *  before re-modelling, because a whole-sentence re-model asks the learner to
 *  diff it against their own memory of what they just said — which the
 *  2026-07-25 live sitting proved they cannot do (see header note (b)).
 *
 *  `⟨…⟩` is a SLOT the tutor fills from the audio it just judged; it is not
 *  spoken. The opener stays "My turn" byte-for-byte, so sentinel
 *  classification is untouched — the engine matches OPENERS only
 *  (`matchesOpener`, judgedLoopModel.ts), and a mid-line slot cannot reach it.
 *  Ends on the correct reading (recency), then re-elicits. */
export const contrastCorrectionLine = (it: DiSentenceReadingChallenge) =>
  `My turn: not ⟨what they said⟩ — ${sentenceText(it)} Your turn. Read it again.`;

/**
 * The in-band judging contract for one item. The Live tutor hears the raw
 * audio and judges each attempt ITSELF; the engine reads which branch it took
 * from the output transcript (sentinel scan) and alone decides progression.
 *
 * The criteria name accuracy word-by-word, allow the self-correction real
 * fluency practice depends on, and explicitly refuse to penalise slowness —
 * pace is a later eval mode, never the L0 judgment. This is the wording the
 * sitting proved can catch a one-word omission.
 */
export const judgingContract = (it: DiSentenceReadingChallenge) => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against the printed sentence "${sentenceText(it)}" read aloud, every word in order:
- Every word read correctly and in order — including after the learner catches and fixes their own slip — say exactly "${verifyLine(it)}" and stop.
- A word skipped, added, or read as a DIFFERENT word, and you can tell WHICH words came out wrong: say exactly "${contrastCorrectionLine(it)}" and stop, then wait again. Replace ⟨what they said⟩ with the words they actually read in place of the printed ones — just those words, not the whole sentence ("not the pot", "not ran fast"). Never speak the ⟨ ⟩ marks, and change nothing else in the line. Naming their error is the point of this branch: it is the only way they learn WHICH word to fix.
- Anything else — silence, an unintelligible attempt, or a miss you cannot pin to particular words: say exactly "${correctionLine(it)}" and stop, then wait again.
Slow, effortful sounding-out that lands on the right words is CORRECT — judge accuracy, never speed. Do not accept a near-miss word to be kind: a different word is a different word.
The learner may pause in the middle of a sentence; a pause is part of one reading, so wait for them to finish the whole sentence before judging it.
If the learner misses the SAME word again, use the contrast branch again — do not fall back to the plain re-model, and do not invent a third wording.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/**
 * The spoken lead-in for one item, composed from its SUPPORT TIER. This is the
 * whole L3 ladder: `easy` hands over model + guide, `medium` only the model,
 * `hard` nothing at all. Absent tier = `easy`, the L0 shape.
 */
const leadInFor = (it: DiSentenceReadingChallenge): string => {
  switch (it.supportTier) {
    case 'hard':   return '';
    case 'medium': return `${modelLine(it)} `;
    case 'easy':
    default:       return `${modelLine(it)} ${guideLine(it)} `;
  }
};

/**
 * At `hard` the tutor must not read the sentence before the learner does —
 * that is the entire point of the tier. The omitted lines already withhold it
 * (the tutor may only speak what "Speak exactly" quotes), but this makes the
 * intent explicit per item rather than relying on the omission alone: the
 * catalog's scaffolding levels are a second channel that could otherwise
 * re-read it (the tier gotcha — a tier hidden on screen but revealed by the
 * tutor is only half applied).
 */
const coldReadGuard = (it: DiSentenceReadingChallenge): string =>
  it.supportTier === 'hard'
    ? '\nThe learner is reading this one cold on purpose: do NOT read the sentence, or any part of it, before they do.'
    : '';

/**
 * Present one item: the tier's lead-in, then the test, then judge in-band
 * until told otherwise. The opening variant carries the run framing. The
 * "begin with the quoted line" clause addresses the sitting's finding 5 — the
 * tutor prefixed an unscripted greeting ("It's great to see you!") before the
 * scripted "Listen:", which `offScript: 0` did not catch because that counter
 * classifies VERDICTS, not fidelity. Framing only; no judged line changed.
 */
export const itemCue = (it: DiSentenceReadingChallenge, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk sentence-reading practice for a beginning reader. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata. Begin with the quoted line below — no greeting, no introduction.'
  : ''}
Speak exactly:
"${leadInFor(it)}${testLine(it)}"${coldReadGuard(it)}
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward.
 *  A hard sentence resurfaces through distributed review, not by drilling a
 *  discouraged beginning reader in place. */
export const moveOnCue = (
  it: DiSentenceReadingChallenge,
  next?: DiSentenceReadingChallenge,
) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will read that one again another day. ${leadInFor(next)}${testLine(next)}"${coldReadGuard(next)}
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will read that one again another day. That's the end of our reading practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our reading practice. Great reading today!"`;
