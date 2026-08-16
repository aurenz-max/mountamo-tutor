/**
 * letterSpotterScript — HAND-AUTHORED judged-loop script for letter-spotter
 * (ELEVENTH literacy DI port; qa/di/BACKLOG.md item 16). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (which letters, which sentence, which distractors) stays generator-scoped;
 * this module owns the cue shapes, the tier ladder and the reveal policy.
 *
 * ── WHY THIS PORT EXISTS (session 42edfc52e539, 2026-08-13) ─────────────────
 * A live drive of the click-era primitive showed the failure the modality is
 * for, in four stacked pieces:
 *
 *  1. THE SENTENCE WAS SPOKEN 2-4× PER ITEM. Three cue sites each independently
 *     ordered a reading — the advance cue, the wrong-answer cue ("re-read the
 *     sentence slowly") and the CORRECT cue ("read the full sentence aloud as
 *     celebration") — plus a catalog directive saying it a fourth time.
 *  2. TWO CONTRADICTORY CUES MERGED INTO ONE UTTERANCE. The child answered
 *     faster than the tutor spoke, so the floor gate coalesced a try-again hint
 *     and an answer reveal into one turn: "Let's try again… / Great
 *     identification, that's the letter A!"
 *  3. THE ITEM EXISTED ONLY IN AUDIO, RUNNING 8-16s BEHIND THE SCREEN. Tutor
 *     turns were 12-17s of speech (109s of the 125s session) while the option
 *     buttons went live the instant the challenge rendered. The log shows the
 *     child answering while the tutor was still mid-sentence asking.
 *  4. EVERY ITEM CAME WITH A SHAPE RIDDLE. Group 1's `newLetters` IS the whole
 *     group, so the "this is a NEW letter — hint at its shape" branch fired on
 *     every challenge: "a curvy snake", "a triangle with a line across the
 *     middle". That hands the answer to any child who knows letterforms and
 *     bypasses the initial-sound task the mode is supposed to teach.
 *
 * Every one of those is a symptom of the same mechanism: nobody owned the
 * clock. Under the judged loop the tutor asks ONCE, waits, is handed the
 * verdict, and its own line is the advance. There is no re-read, no cue queue
 * to back up, no Check button and no Next button.
 *
 * ── THE SPLIT (standing gate 1 arithmetic, not a preference) ────────────────
 *
 *   name-it   the answer is a LETTER    → VOICE `letter_name`
 *   find-it   the answer is a LOCATION  → GESTURE `manipulation`
 *   match-it  the answer is a FORM      → GESTURE `manipulation`
 *
 * name-it WAS a tap, and its conversion is the 2026-08-13 user ruling: "in real
 * life if i have a sentence with a missing letter, and i ask the student to use
 * context clues and the word to say the missing letter, they should be able to
 * translate the sentence and missing letter verbally. they dont need to click a
 * button." The four option tiles are gone with it, and deleting them is a
 * PEDAGOGIC gain before it is a modality one — a menu turns production into
 * recognition and floors a guess at 25%, and the drive that produced the ruling
 * was offered n / s / i / a, where n and s sit in the same /ɛ/ cluster the
 * option set was supposedly protecting the judge from.
 *
 * The old block on `letter_name` assumed the judge had to classify across 26
 * letters. It does not: it is handed ONE target and asked whether the child said
 * it, and this pack accepts the letter's SOUND as well as its name, so a cluster
 * confusion has to beat two channels. See the class notes in
 * judgedScriptContract.ts for the cluster table a generator must respect.
 *
 * The other two stay gestures because their answers are not sayable, and that is
 * the only reason a DI mode may keep its hands: find-it's answer is WHERE the
 * letter is (there is no spoken form of "third box, second row"), and match-it's
 * answer is which lowercase FORM matches — saying "S" would not prove the child
 * knows the form, which is the entire skill. A gesture mode owes the tutor real
 * silence, not a prose request for it: the runner holds the activity bracket for
 * the whole item so Gemini is never handed a turn it must answer.
 *
 * ── THE THREE REVEAL POLICIES, AND WHY THEY DIFFER ──────────────────────────
 * What the tutor may say before an attempt is decided per mode by what the
 * ANSWER is made of. This is the variance the family calls pedagogy:
 *
 *   name-it   the letter is the ANSWER   → the ask NEVER names it. The tutor
 *             says the WORD, which is the stimulus: mapping its first sound
 *             onto a grapheme is the whole task, so hearing the word gives
 *             nothing away. NO SHAPE DESCRIPTIONS, at any tier — the click-era
 *             defect above was exactly a second channel volunteering the
 *             answer, and shape is the wrong channel for a sound task besides.
 *   find-it   the letter is the STIMULUS → the ask NAMES it. The answer is
 *             WHERE it is, and a search with an unnamed target is not a harder
 *             task, it is a broken one.
 *   match-it  the form is the ANSWER     → the ask names NOTHING; the big
 *             letter is printed and that print is the question side.
 *
 * ── CORRECTIONS ─────────────────────────────────────────────────────────────
 * Open "My turn:", re-model, re-elicit (standing gate 3). Whether the
 * correction may NAME the letter follows the same arithmetic:
 *   - name-it re-models the ROUTE (the word's first sound) and never names the
 *     letter — a retry that gives the answer away is free, not a retry
 *     (hear-see's rule). This is sharper now that the answer is spoken: with the
 *     option tiles gone there is no menu to recognise the answer from, so a
 *     correction that named it would be the only place it could leak.
 *     `moveOnCue` names it at the cap, so a capped item does not end with the
 *     link unmade.
 *   - find-it re-says the target letter (its STIMULUS) and re-elicits.
 *   - match-it NAMES both cases, because "big S and little s are the same
 *     letter" IS the teaching move for case correspondence; withholding it
 *     would leave the correction with nothing to model.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by
 * validateJudgedScriptPack in this pack's test file. Two live hazards, both
 * handled: generated sentences and target words NEVER open a sentence in any
 * cue (they are always introduced by "Listen:" / "The word is") because a
 * generated sentence beginning "Yes, …" would be scanned as a verdict; and
 * `itemsFromChallenges` DROPS any item whose word or sentence starts with the
 * token "yes" as belt-and-braces on the same hazard.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { canProduceSound, spokenSoundFor } from './letterSoundLinkScript';

// Re-exported so the generator imports its build gates from ONE address (the
// decodable-reader precedent) — both sides of the wire must agree on what is
// sayable, and the two hand-synced copies had already drifted (90 vs 100).
export { opensWithSentinel };

export type LetterSpotterMode = 'name-it' | 'find-it' | 'match-it';
export type LetterSpotterTier = 'easy' | 'medium' | 'hard';

/**
 * ONE mystery marker for the whole family, code-owned. The click-era generator
 * rotated a ten-emoji pool by challenge index, so the SPOKEN prompt changed
 * every single item — the live log has a child asked in turn about "the ⭐",
 * "the 🌟", "the crystal ball", "the diamond" and "the target" inside two
 * minutes. A five-year-old is learning the game, not a vocabulary of mystery
 * objects; the marker is now invariant and the tutor calls it "the star".
 */
export const SPOTTER_EMOJI = '⭐';
export const SPOTTER_EMOJI_NAME = 'star';

// ── The item ────────────────────────────────────────────────────────────────

export interface LetterSpotterItem extends JudgedScriptItem {
  mode: LetterSpotterMode;
  /** The answer in every mode, lowercase. Never spoken before a verdict except
   *  in find-it, where it is the stimulus. */
  targetLetter: string;
  tier: LetterSpotterTier;
  /** name-it: the sentence as PRINTED, with the marker over the word's first
   *  letter ("I see an ⭐nt walk away."). */
  sentence?: string;
  /** name-it: the sentence as SPOKEN, word intact ("I see an ant walk away."). */
  spokenSentence?: string;
  /** name-it: the word whose first letter is hidden ("ant"). */
  targetWord?: string;
  /** find-it: sixteen uppercase cells, exactly one of them the target. */
  letterGrid?: string[];
  /** match-it ONLY: the tappable little letters. Empty for the other two —
   *  name-it's answer is spoken and find-it's answer is a grid cell. */
  options: string[];
}

/** name-it is SAID; the other two have answers that cannot be said (a location,
 *  a letterform). Nothing else in this pack gets to choose. */
export const answerKindFor = (mode: LetterSpotterMode): 'voice' | 'gesture' =>
  mode === 'name-it' ? 'voice' : 'gesture';

/** Standing gate 1: the spoken mode is `letter_name`, a tap is a `manipulation`. */
export const responseClassFor = (mode: LetterSpotterMode): ResponseClassId =>
  mode === 'name-it' ? 'letter_name' : 'manipulation';

// ── Voice safety ────────────────────────────────────────────────────────────

/**
 * The stretched rendering of a letter's sound, or null when the sound is a stop
 * (or anything else) our benched table does not spell.
 *
 * Imported from `letterSoundLinkScript` rather than re-declared, so a child
 * hears ONE rendering of /s/ across every literacy pack — that module's table
 * is di-letter-sounds' own, and a second copy here would be a second thing to
 * keep in step. A missing entry is not a gap to fill with a guess: an
 * unmapped glyph in a five-year-old's ear is the failure `phonemeVoice` exists
 * to prevent, so the correction degrades to word-emphasis instead (below).
 */
const heldSoundFor = (letter: string): string | null =>
  canProduceSound(letter) ? spokenSoundFor(letter, '') : null;

// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface LetterSpotterChallengeLike {
  id: string;
  mode: LetterSpotterMode;
  targetLetter: string;
  targetWord?: string;
  sentence?: string;
  spokenSentence?: string;
  letterGrid?: string[];
  options?: string[];
}

/**
 * Is this a WORD a tutor can say aloud, and a SENTENCE it can say in one
 * breath? Both are the same guard against the same failure, and the live probe
 * for this port is what proved it belongs here as well as generator-side.
 *
 * flash-lite returned `targetWord` as 400 characters of its own deliberation
 * ("sheep-invalid-word-fix-start-with-s-no-dash-sheep-is-fine-wait-…") on half
 * the drawn items. Every SEMANTIC gate below passed it — the string started
 * with the target letter and occurred exactly once in a sentence built from it
 * — so the ask would have been babble read aloud to a five-year-old. A field
 * that cannot be enum-locked needs a SHAPE gate, not only a meaning gate.
 */
export const MAX_WORD_CHARS = 12;
/** One breath. The pack said 100 while the generator's copy said 90 — the two
 *  sides of the wire disagreeing on what is sayable IS the bug; the stricter
 *  bound wins because a dropped item is safe and a runaway read is not. The
 *  generator now imports these instead of keeping copies. */
export const MAX_SENTENCE_CHARS = 90;
export const isSayableWord = (word: string): boolean =>
  new RegExp(`^[a-z]{1,${MAX_WORD_CHARS}}$`, 'i').test(word.trim());
/** No underscores (blank markers) — and no double quotes: `spokenSentence` is
 *  interpolated into the cue's `Say exactly: "…"` span, so an embedded quote
 *  CLOSES the span early and everything after it becomes judge-side prose —
 *  the same structural surface the performed-"[WAIT silently]" defect lived
 *  on. Keep-or-drop, per this pack's no-backfill policy. */
/**
 * ⭐ Does this word's FIRST LETTER actually spell its first SOUND?
 *
 * The live probe for this port drew *"Say the letter that sheep starts with"*
 * with an answer key of `S` — and every gate above passed it, because the word
 * does lead with the target letter. Orthographically that is even true. But
 * name-it's whole task, in the catalog's own words, is "initial sound to
 * grapheme", the ask that precedes it is *"Listen for the sound at the very
 * start of the word"*, and the sound at the very start of `sheep` is /ʃ/, which
 * `s` does not spell. Affirming `S` there teaches a five-year-old a mapping
 * that is false, inside the primitive whose job is to make it true.
 *
 * It is a whole CLASS, not one word: the initial digraphs are exactly the shape
 * where letter one is the target and letter one is not the sound. `sh`, `ch`,
 * `th`, `ph` are the common ones a K word list reaches for; `kn`, `wr`, `gn`
 * are the silent-first-letter cousins.
 *
 * What is NOT here, deliberately: blends (`grass`, `stop` — the first letter
 * does spell the first sound of the cluster), `wh` (`w` spells /w/ in `whale`),
 * `gh` (`ghost` opens on /g/), and `qu` (`q` is only ever taught as `qu`, so a
 * child answering Q for `quilt` is right). Banning those would cost real items
 * to buy nothing.
 */
const INITIAL_DIGRAPHS = ['sh', 'ch', 'th', 'ph', 'kn', 'wr', 'gn'];
export const startsWithADigraph = (word: string): boolean => {
  const w = word.trim().toLowerCase();
  return INITIAL_DIGRAPHS.some((d) => w.startsWith(d));
};

export const isSayableSentence = (sentence: string): boolean =>
  sentence.trim().length > 0
  && sentence.trim().length <= MAX_SENTENCE_CHARS
  && !/_/.test(sentence)
  && !/["“”]/.test(sentence);

/**
 * One judged item, or null when the challenge cannot be ASKED. Nothing here
 * backfills: a placeholder in a judged loop becomes a spoken ask the tutor must
 * stand behind, so a broken item is dropped and the session runs shorter.
 *
 * The gates, and the live defect each one closes:
 *  - name-it needs a word AND a sentence, and the word must start with the
 *    target letter. The marker hides the word's FIRST character, so a word that
 *    does not lead with the target hides the WRONG letter while the answer key
 *    still says targetLetter — an unsolvable item ('fox' was once offered for
 *    'x').
 *  - the word must appear in the spoken sentence EXACTLY once: a second
 *    occurrence leaves the target letter spelled out elsewhere on screen.
 *  - find-it needs exactly one target cell. Under the judged loop one tap is
 *    one commit, so a grid with two targets has two right answers to a question
 *    that is asked once, and a grid with none cannot be answered at all.
 *  - match-it needs the answer present among the options (the tap is checked
 *    against it) and at least one distractor (a one-option choice is a costume).
 *    name-it has NO option gate any more: its answer is spoken, and a menu that
 *    is never rendered is a field to keep in step for nothing.
 *  - nothing generated may open a sentence with a sentinel token.
 */
export const itemFromChallenge = (
  ch: LetterSpotterChallengeLike,
  tier: LetterSpotterTier = 'medium',
): LetterSpotterItem | null => {
  const targetLetter = (ch.targetLetter ?? '').trim().toLowerCase();
  if (targetLetter.length !== 1) return null;

  const options = (ch.options ?? []).map((o) => o.trim().toLowerCase()).filter((o) => o.length === 1);

  if (ch.mode === 'name-it') {
    const targetWord = (ch.targetWord ?? '').trim();
    const spokenSentence = (ch.spokenSentence ?? '').trim();
    const sentence = (ch.sentence ?? '').trim();
    if (!targetWord || !spokenSentence || !sentence) return null;
    // SHAPE before meaning: an unbounded string field can arrive as model
    // babble that satisfies every semantic rule below (live probe, 2026-08-13).
    if (!isSayableWord(targetWord) || !isSayableSentence(spokenSentence)) return null;
    if (targetWord[0]?.toLowerCase() !== targetLetter) return null;
    // The word must lead with the target letter AND that letter must spell the
    // sound it leads with — `sheep` satisfies the first and fails the second.
    if (startsWithADigraph(targetWord)) return null;
    if (opensWithSentinel(targetWord) || opensWithSentinel(spokenSentence)) return null;
    const occurrences = spokenSentence.match(
      new RegExp(`\\b${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
    );
    if (!occurrences || occurrences.length !== 1) return null;
    return {
      id: ch.id,
      mode: 'name-it',
      answerKind: 'voice',
      responseClass: 'letter_name',
      action: 'name-it',
      targetLetter,
      tier,
      sentence,
      spokenSentence,
      targetWord,
      // The tiles are gone: the child SAYS the letter. Any `options` the
      // generator still emits are ignored rather than rendered, so a stale
      // cached challenge cannot put a menu back on screen.
      options: [],
    };
  }

  if (ch.mode === 'find-it') {
    const letterGrid = (ch.letterGrid ?? []).map((l) => l.trim().toUpperCase());
    if (letterGrid.length !== 16) return null;
    const targets = letterGrid.filter((l) => l.toLowerCase() === targetLetter).length;
    if (targets !== 1) return null;
    return {
      id: ch.id,
      mode: 'find-it',
      answerKind: 'gesture',
      responseClass: 'manipulation',
      action: 'find-it',
      targetLetter,
      tier,
      letterGrid,
      options: [],
    };
  }

  if (!options.includes(targetLetter) || options.length < 2) return null;
  return {
    id: ch.id,
    mode: 'match-it',
    answerKind: 'gesture',
    responseClass: 'manipulation',
    action: 'match-it',
    targetLetter,
    tier,
    options,
  };
};

/**
 * Build the session, dropping what cannot be asked — AND what cannot be asked
 * SECOND.
 *
 * ⭐ THE SESSION INVARIANT (19h-i-b port 6). Every gate above judges one
 * challenge in isolation, and there is a leak on this port that no single item
 * can commit, because both halves of it are correct alone:
 *
 *   find-it's ask NAMES its target letter out loud — the letter is its
 *   STIMULUS there, and a search for an unnamed target is a broken task, not a
 *   harder one. name-it's and match-it's answers ARE a letter, and the whole
 *   pack is built so no cue says one before the child does.
 *
 * Put "Find the letter A" at item 2 and "say the letter that ant starts with"
 * at item 5 and the tutor has spoken item 5's answer, unearned, as item 2's
 * question. The same thing happens between two answer-side items one beat
 * later: an item always closes on an affirmation or a capped move-on, and BOTH
 * name the letter ("Yes, ant starts with A."), so a second item on `a` is
 * answered from memory of the first rather than from the sound of its word.
 * Under the click-era tap surface this was invisible — nothing said the answer
 * aloud — which is why it arrives with the modality.
 *
 * So: a letter may be ANSWERED once per session. Whoever claims it first keeps
 * it, and a later name-it or match-it item on the same letter is dropped.
 * find-it is never dropped for reuse — its answer is a position, and hearing a
 * letter it is about to hunt for is the task working as intended.
 *
 * This lives here rather than generator-side for the reason §4(d) of the sweep
 * gives: `itemsFromChallenges` is the boundary the RUNNER reads, so it also
 * covers hand-authored and cached payloads that a prompt fix cannot reach. The
 * generator prompt is fixed too, so the gate rarely has to bite.
 */
export const itemsFromChallenges = (
  challenges: LetterSpotterChallengeLike[],
  tier: LetterSpotterTier = 'medium',
): LetterSpotterItem[] => {
  const spokenLetters = new Set<string>();
  const items: LetterSpotterItem[] = [];
  for (const ch of challenges) {
    const item = itemFromChallenge(ch, tier);
    if (!item) continue;
    const answersWithALetter = item.mode !== 'find-it';
    if (answersWithALetter && spokenLetters.has(item.targetLetter)) continue;
    spokenLetters.add(item.targetLetter);
    items.push(item);
  }
  return items;
};

// ── Small speakable helpers ─────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** The target as the TUTOR says it — a letter NAME, which is safe from the
 *  tutor's mouth (only the CHILD's production is the blocked class). */
const letterName = (item: LetterSpotterItem) => item.targetLetter.toUpperCase();

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

/**
 * ⭐ WHY name-it says "The star" and not "A star" (19h-i-b port 6).
 *
 * This pack's answer is ONE CHARACTER, which makes it the first port in the
 * sweep whose leak token collides with ordinary English: the harness scans a
 * tutor turn for `\b<token>\b` over lowercased text, so a target letter of `a`
 * or `i` matches the article "a" and the pronoun "I" wherever they appear.
 *
 * There are two ways to answer that. Exempting a span switches the oracle off
 * over prose WE wrote, which is the half most likely to leak. Removing the
 * collision from our own lines keeps the oracle FLAT for all twenty-six
 * letters, and costs a definite article that was more accurate anyway — there
 * is exactly one marker, so "the star" is what a child sees. The exemption is
 * then spent only where it must be: the GENERATED sentence (see
 * `letterSpotterHarnessAnswers`), which we do not author.
 */
export const howToPlayFor = (item: LetterSpotterItem): string => {
  switch (item.mode) {
    case 'name-it':
      return `The ${SPOTTER_EMOJI_NAME} is hiding the first letter of the word — you tell me the letter it is hiding! `;
    case 'find-it':
      return 'I name a letter — you find it in the boxes and tap it! ';
    case 'match-it':
      // Describes the GAME and stops. It used to end "Tap the little one that
      // is the same letter!" and the ask then said the same imperative again a
      // sentence later — the opening turn issued one instruction twice.
      return 'You will see one big letter, and some little letters underneath. ';
  }
};

// ── The DISTAR lead-in, composed from the SUPPORT TIER ──────────────────────
// easy = model + guide, medium = model only, hard = nothing. What a tier
// changes is how much of the sequence precedes the attempt — never the ask,
// never the judging, and never the correction's re-model (standing gate 3).
//
// NOTE what is absent at every rung: any description of the target's SHAPE.
// The click-era tutor volunteered one per item ("a triangle with a line across
// the middle") and it was the session's largest leak. A strategy may be
// modelled; the answer may not, and shape IS the answer here.

const modelLine = (item: LetterSpotterItem): string => {
  switch (item.mode) {
    case 'name-it':
      return 'Listen for the sound at the very start of the word.';
    case 'find-it':
      return 'Look at one row at a time, all the way across.';
    case 'match-it':
      // Plural, and not "A big letter …": the same one-character leak-token
      // collision documented on `howToPlayFor`. The general statement is the
      // one this line was always trying to make.
      return 'Big letters and little letters can look different and still be the same letter.';
  }
};

const guideLine = (item: LetterSpotterItem): string => {
  switch (item.mode) {
    case 'name-it':
      // Not "I will say the word …" — same collision, on `i` this time.
      return 'Then you will hear the word on its own.';
    case 'find-it':
      return 'Take your time and check every box.';
    case 'match-it':
      return 'Look at the shape of the big letter first.';
  }
};

/**
 * The lead-in belongs to the INTRODUCTION of an action, never to every ask —
 * live drive de8a6a78d9db, and the reason this function is only called where
 * the how-to-play is. Six consecutive match-it items each opened with that
 * mode's model line — the big-and-little-letters one above —
 * and because that mode's ask cannot name anything that varies (the letter IS
 * the answer) the whole utterance came out byte-identical six times: ~14s of
 * speech against a ~13s answer. Repetition is not instruction. DISTAR fades the
 * model; it does not re-read it every round.
 *
 * The tier ladder is unharmed — it still sets how much lead-in the child gets
 * when the action is introduced, and `easy` additionally keeps the fuller ask
 * on repeats (see `askFor`).
 */
const leadInFor = (item: LetterSpotterItem): string => {
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

// ── The asks — short, the problem STATED aloud, one defensible answer ───────
// (drive-2 ruling: an ask must SAY its problem — a pre-reader cannot read the
// screen, and every correction re-ask inherits the ask.)

/** name-it says the sentence, then the word alone at `easy` (the guide line
 *  promised it). The sentence NEVER opens a sentence in the cue — it is always
 *  introduced, because a generated line beginning "Yes, …" would be read as a
 *  verdict by the engine's sentence scan. */
const askFor = (item: LetterSpotterItem, repeat = false): string => {
  switch (item.mode) {
    case 'name-it': {
      // The SENTENCE varies every item, so there is nothing to shorten: the ask
      // is new information each time.
      const wordAlone = item.tier === 'easy' ? ` The word is ${item.targetWord}.` : '';
      return (
        `Listen: ${item.spokenSentence}${wordAlone} `
        + `Your turn. Say the letter that ${item.targetWord} starts with.`
      );
    }
    case 'find-it':
      // The target LETTER varies, so likewise.
      return `Find the letter ${letterName(item)}. Your turn. Tap it in the boxes.`;
    case 'match-it':
      // The only mode with nothing sayable to vary: it may not name the big
      // letter (a child who knows lowercase letters by name would then pick the
      // tile without ever looking at the capital, which is the pairing itself).
      // So the SECOND time onward the ask is short. `easy` keeps the full
      // wording — for the tier that needs the most support, hearing the frame
      // again IS the support, and it is the per-item lever this mode has left.
      return repeat && item.tier !== 'easy'
        ? 'Your turn. Tap the little letter that is the same.'
        : 'Look at the big letter. Your turn. Tap the little letter that is the same letter.';
  }
};

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────

/**
 * name-it re-models the ROUTE, never the answer: the word's first sound where
 * our benched table can spell it, word-emphasis where it cannot (stops are not
 * isolated — that is the same restriction letter-sound-link ships under, and
 * an unmapped glyph read aloud is the failure `phonemeVoice` exists to stop).
 */
const nameItRemodel = (item: LetterSpotterItem): string => {
  const word = item.targetWord ?? '';
  const held = heldSoundFor(item.targetLetter);
  return held
    ? `${cap(held)} … ${word}.`
    : `${cap(word)}. Listen right at the front of that word.`;
};

const correctionFor = (item: LetterSpotterItem): string => {
  switch (item.mode) {
    case 'name-it':
      // The letter is the ANSWER, so it is NOT named here — the route is
      // re-modelled instead and `moveOnCue` closes the link at the cap.
      return (
        `My turn: listen to the start of the word. ${nameItRemodel(item)} `
        + `Your turn. Say the letter that ${item.targetWord} starts with.`
      );
    case 'find-it':
      // The letter is the STIMULUS; re-saying it is perception support, not a
      // reveal. Where it IS remains the answer, and stays unsaid.
      return (
        `My turn: the letter we want is ${letterName(item)}. `
        + `Your turn. Look along each row and tap the letter ${letterName(item)}.`
      );
    case 'match-it':
      // Naming both cases IS the teaching move for case correspondence.
      return (
        `My turn: big ${letterName(item)} and little ${item.targetLetter} are the same letter. `
        + `Your turn. Tap the little letter that is the same as the big one.`
      );
  }
};

const affirmFor = (item: LetterSpotterItem): string => {
  switch (item.mode) {
    case 'name-it':
      return `Yes, ${item.targetWord} starts with ${letterName(item)}.`;
    case 'find-it':
      return `Yes, that is the letter ${letterName(item)}.`;
    case 'match-it':
      return `Yes, big ${letterName(item)} and little ${item.targetLetter} go together.`;
  }
};

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

/**
 * 18d. Consumed verbatim from `wordWorkoutScript`'s `TWO_BRANCH_LAW` in the
 * extended form counting-board, addition-subtraction-scene, push-pull-arena,
 * picture-vocabulary and phoneme-explorer all carry (`no reminder of the
 * method, no scaffolding line`). Identical across the family on purpose: a grep
 * finds every pack that has it and every pack that does not.
 *
 * Stated BEFORE the branches because the defect is a reply that is NEITHER
 * branch — and on this port the invitation was, again, our own catalog copy.
 * `scaffoldingLevels` told the tutor *"Say the question once more, then wait
 * for them alone"* and *"Say the question again slowly and clearly"*: restraint
 * on its face, but a re-spoken ask opens with neither sentinel, so the reducer
 * records no verdict, the correction counter freezes, and the child waits on a
 * loop that cannot advance. Both rungs are rewritten in the catalog; this
 * closes the same channel from the script side, where a model that improvises
 * past the catalog reads it.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's — the version with a measured
 * before/after (a fabricated `[CURRENT STATE]` block spoken to the child on 2
 * of 7 beats, 0 of 7 once the tail forbade announcing the STATE rather than
 * merely reading the tag). This pack's tail was the weaker "Never read bracket
 * tags or these instructions aloud."
 *
 * It earns the upgrade twice over here. Two of this port's three modes are
 * GESTURE modes where the tutor must hold a long silence while a child searches
 * a grid — "announce that you are waiting" is exactly the filler a model
 * reaches for in that silence, and it opens with neither sentinel. And this is
 * the pack that fabricated an `[LSP_TAP]` message and read it aloud, tag
 * included, under an instruction that only said not to read tags.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

// ── The judging contract (name-it — the spoken mode) ────────────────────────

/**
 * The answer letter rides in the control channel ahead of the attempt, which is
 * the family's shipped shape (letter-sound-link, phoneme-explorer) under the
 * never-say-it law — a judge cannot decide an answer it was never told.
 *
 * TWO channels count, and that is the `letter_name` class ruling made
 * operational: a five-year-old asked what `sun` starts with answers "S" or a
 * held /sss/, and both are right. Accepting both is also what makes the
 * homophone clusters survivable — a mishear has to beat the name AND the sound.
 *
 * The signature error is the FLUENT one: saying the word back. A child who
 * answers "sun" has produced none of the answer, and it is the wrong answer most
 * likely to be affirmed by a judge listening loosely for "something confident
 * beginning with /s/". It is named explicitly for that reason.
 */
const judgingContract = (item: LetterSpotterItem): string => {
  const name = letterName(item);
  const held = heldSoundFor(item.targetLetter);
  const soundClause = held
    ? `Saying the letter's SOUND rather than its name is equally correct — ${held} counts exactly as much as "${name}". `
    : '';
  return (
    `The quoted line is the ONLY thing you say on this turn; you then stay silent `
    + `while the learner thinks, and their think time is unbounded. `
    + `Never say the answer during their turn. `
    + `The correct answer is the letter ${name}. ${soundClause}`
    + `One letter said on its own is what you are listening for, and a shy or mumbled try still counts. `
    + `Saying the WORD "${item.targetWord}" back is NOT an answer however confident it sounds — the word is the question. `
    + `Any other letter is wrong. `
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ── The silence contract (find-it and match-it — the tap modes) ─────────────

/**
 * There is nothing to judge until the application describes the tap, and naming
 * a letter on screen would hand the answer over in match-it.
 *
 * This prose is the tutor's INTENT, never the enforcement — the 2026-08-13 drive
 * proved a Live model cannot honour "stay silent" because a closed turn owes a
 * reply, and under this instruction it fabricated a `[LSP_TAP]` message and read
 * it aloud. The enforcement is the runner holding the activity bracket for the
 * whole gesture item, so no turn is ever handed over to be answered.
 */
const tapContract = (item: LetterSpotterItem): string => {
  const neverSay = item.mode === 'find-it'
    // The target is already named — what must stay unsaid is WHERE it is.
    ? `Never say where the letter is, never describe its position, row or column, and never read out the other letters. `
    : `Never say which letter is the answer, never name or spell the letters on screen, and never describe what the answer LOOKS like — not its shape, not its lines, not its curves. `;
  return (
    `The quoted line is the ONLY thing you say on this turn; the learner answers by `
    + `TAPPING, not by speaking, so you then stay completely silent. `
    + neverSay
    + `Do not judge anything you hear through the microphone. `
    + `You will be told what the learner tapped and given the exact line to say; only then do you speak.`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface LetterSpotterCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: LetterSpotterItem,
  opts: LetterSpotterCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Time to go letter spotting! ' : '';
  // Introducing = the run's opening, or the ACTION just changed. Only then does
  // the child hear how the game works and the DISTAR lead-in; every other item
  // goes straight to the ask.
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item, !introducing)}`;
  const contract = item.answerKind === 'gesture' ? tapContract(item) : judgingContract(item);
  return `[LSP_ITEM] Say exactly: "${spoken}" ${contract} ${NEVER_PERFORM}`;
};

/**
 * The gesture verdict ask — find-it and match-it ONLY (name-it is judged from
 * the child's voice in-band). The match is CODE-COMPUTED and the tutor is handed
 * its exact line. The tutor cannot see the screen, so this is the ONLY thing
 * that tells it what happened — and the only place a correction may model.
 */
export const tapVerdictCue = (item: LetterSpotterItem, tapped: string): string => {
  const matches = tapped.trim().toLowerCase() === item.targetLetter.trim().toLowerCase();
  const what = item.mode === 'find-it' ? 'a box holding the letter' : 'the letter';
  return (
    `[LSP_TAP] The learner tapped ${what} "${tapped.toUpperCase()}"; the answer is `
    + `"${letterName(item)}" — that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirmFor(item)}" ` : `Say exactly: "${correctionFor(item)}" `)
    + `Say nothing else. `
    + NEVER_PERFORM
  );
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward.
 * name-it closes by NAMING the letter — its corrections never did, and a capped
 * item must not end with the sound-to-letter link unmade. find-it cannot be
 * closed by voice (the answer is a position the tutor cannot point at) and
 * match-it's corrections already named both cases twice.
 */
export const moveOnCue = (
  item: LetterSpotterItem,
  next: LetterSpotterItem | null,
  opts: LetterSpotterCueOptions = {},
): string => {
  const closeLine = item.mode === 'name-it'
    ? `The word ${item.targetWord} starts with ${letterName(item)}. `
    : '';
  if (!next) {
    return (
      `[LSP_MOVE] Say exactly: "Good try! ${closeLine}Letters take practice — we will spot that one again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  const contract = next.answerKind === 'gesture' ? tapContract(next) : judgingContract(next);
  return (
    `[LSP_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${lead}${askFor(next, !introducing)}" `
    + `${contract} ${NEVER_PERFORM}`
  );
};

export const completeCue = (): string =>
  `[LSP_COMPLETE] Say exactly: "What great letter spotting today! Your eyes are getting sharp. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer — and this channel is
 * the direct fix for the live defect that made the click-era item unanswerable:
 * the sentence lived only in a tutor turn that ran up to 16s behind the screen,
 * with no way to hear it again. It is never withdrawn by band or tier.
 */
export const pronounceCue = (item: LetterSpotterItem): string => {
  const line = (() => {
    switch (item.mode) {
      case 'name-it':
        return `Listen: ${item.spokenSentence} Say the letter that ${item.targetWord} starts with.`;
      case 'find-it':
        return `Find the letter ${letterName(item)}. Tap it in the boxes.`;
      case 'match-it':
        return 'Tap the little letter that is the same as the big letter.';
    }
  })();
  return (
    `[LSP_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 * (di-math-facts rule). name-it and match-it push NO letter at all, because the
 * letter IS the answer in both; find-it pushes it because there the letter is
 * the question and the position is the answer.
 */
export const stimulusFor = (item: LetterSpotterItem): string => {
  switch (item.mode) {
    case 'name-it':
      return 'a sentence with one word’s first letter hidden behind a star';
    case 'find-it':
      return `the letter ${letterName(item)}, hidden in a grid of sixteen letters`;
    case 'match-it':
      return 'one big letter printed on screen, with little letters to choose between';
  }
};

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

/**
 * Everything of this pack that can reach the tutor, in one value.
 *
 * The component spreads this and adds only what the SCREEN owns (`statusLines`,
 * `diagnosisObservation`, which closes over tap state); the drive-plan endpoint
 * hands it to `run_tutor_live.py --di`. A harness that re-typed these cues would
 * test a fiction — and this pack is the reason `JudgedCueSurface` was named at
 * all: 19f found the sayable-length bound drifted to 90 on one side of the wire
 * and 100 on the other, and its own test file has been carrying a hand-rolled
 * pack literal since birth.
 */
export const letterSpotterPackBase = (
  items: LetterSpotterItem[],
): JudgedCueSurface<LetterSpotterItem> => ({
  primitiveType: 'letter-spotter',
  activityLine: 'live direct instruction letter spotting practice',
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

// ── Harness answer material — what a right and a wrong child sound like ──────

/**
 * ⭐ THE ONE-CHARACTER ANSWER, and why this port's leak oracle is not flat.
 *
 * Every earlier port answers with a WORD or a NUMBER WORD, so `\bcow\b` over a
 * lowercased tutor turn is a precise oracle. Here the answer is a single
 * letter, and two of the twenty-six are also English words: `\ba\b` matches the
 * article and `\bi\b` matches the pronoun.
 *
 * Our own prose was fixed rather than exempted (see `howToPlayFor`), so the
 * only remaining collision sits in the GENERATED sentence a name-it ask reads
 * aloud — "I can see the ink." for target `i`, "Look at a big ant." for `a`.
 * That span is exempted, and ONLY for those two letters: for the other
 * twenty-four the oracle stays flat, and the greeting, the how-to-play, the
 * DISTAR lead-in and the hand-over stay governed even for `a` and `i`.
 *
 * Emptying `leakTokens` instead would have switched the oracle off on the half
 * most likely to leak (trap 4). Naming the exemption keeps it honest.
 */
export const leakExemptSpanFor = (item: LetterSpotterItem): string | undefined =>
  item.mode === 'name-it' && (item.targetLetter === 'a' || item.targetLetter === 'i')
    ? item.spokenSentence
    : undefined;

/**
 * The letters a child reaches for when they are wrong but not guessing. Kept
 * off `a` and `i` so a plain wrong answer is never itself unscannable, and off
 * the target by construction at the call site.
 */
const LETTER_DECOYS = ['m', 'k', 'z', 'v', 'w'];

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each
 * of these; this is that claim made testable. Change one, change both.
 *
 * The signature wrong is the contract's own named miss, and on this port it is
 * the sharpest one the family has had a name for since counting-board:
 *
 *  - name-it: the WORD said back. A child asked what "ant" starts with who
 *    answers "ant" has produced none of the answer — but the utterance carries
 *    the target sound at its front, is a real word, is confident, and the tutor
 *    itself said it aloud two seconds earlier. A judge listening loosely for
 *    "something beginning with /a/" affirms it, which is why the contract names
 *    it explicitly rather than leaving it to "any other letter is wrong".
 *
 * find-it and match-it answer with the HANDS, so their material is `tapped`
 * (interactive-book's shape) and their verdict is code-computed — there is no
 * signature wrong to name, because nothing is judged from what the child says.
 */
export const letterSpotterHarnessAnswers = (item: LetterSpotterItem) => {
  const name = item.targetLetter.toUpperCase();
  const decoy = LETTER_DECOYS.find((l) => l !== item.targetLetter) ?? 'm';

  if (item.mode === 'name-it') {
    return {
      correct: name,
      plainWrong: decoy.toUpperCase(),
      signatureWrong: {
        text: item.targetWord ?? '',
        why: 'the word said straight back — it carries the target sound at its front, it is a real word said confidently, and the tutor spoke it aloud seconds earlier, so a judge listening for "something starting with that sound" affirms it. The contract names this miss by name',
      },
      leakTokens: [item.targetLetter],
      leakExemptSpan: leakExemptSpanFor(item),
    };
  }

  // find-it: the wrong tap is a real grid cell that is not the target, so the
  // verdict cue describes something the stage can actually render.
  // match-it: the wrong tap is a real option tile, for the same reason.
  const wrongTap = item.mode === 'find-it'
    ? (item.letterGrid ?? []).find((l) => l.toLowerCase() !== item.targetLetter)?.toLowerCase() ?? decoy
    : item.options.find((o) => o !== item.targetLetter) ?? decoy;

  return {
    correct: name,
    plainWrong: wrongTap.toUpperCase(),
    tapped: { correct: item.targetLetter, wrong: wrongTap },
    // find-it's answer is a POSITION the tutor is never told — it holds the
    // letter as its stimulus and nothing else, so there is no token that could
    // leak. That is a structurally unreachable leak class, not an oracle
    // switched off. match-it's answer IS the letter, so it scans for it.
    leakTokens: item.mode === 'find-it' ? [] : [item.targetLetter],
  };
};
