/**
 * letterSoundLinkDomain — what letter-sound-link TEACHES, with no teaching engine
 * attached: which letters may be asked in which direction, what is drawn, what the
 * child must produce, and what counts as having produced it.
 *
 * Sunset slice for the SEVENTH workspace adopter and the first literacy primitive
 * outside the DI packs, following `countingBoardDomain`, `shapeSorterDomain`,
 * `numberSequencerDomain` and the three `di*Domain` modules
 * (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md). The split is by
 * ownership:
 *
 *   - HERE: the assignment. The continuant gate, the keyword anchor map, the
 *     session build gate, the question the child hears and the success condition
 *     stated plainly enough for a tutor to judge against.
 *   - `letterSoundLinkScript`: the retiring control protocol — the DISTAR lead-in,
 *     the sentinel-opened affirm and correction lines, the in-band judging
 *     contracts and the bracketed cues. It re-exports this module, so the
 *     generator, the tester, the drive plan and the lesson-bench extractor keep
 *     one address.
 *
 * THE THREE DIRECTIONS, AND WHY THEY ARE NOT ONE ASSIGNMENT:
 *
 *   see-hear       a printed letter        the child SAYS the sound      speech
 *   hear-see       a sound the tutor says  the child TAPS a letter       gesture
 *   keyword-match  a printed letter        the child SAYS a picture word speech
 *
 * `hear-see` is the reason this primitive is worth binding: it is the first
 * workspace mode whose answer the tutor is NEVER TOLD. A letter NAME is a blocked
 * response class (b/p/d/e/g are homophonic to a judge), so the grapheme is touched
 * rather than spoken, the activity checks the tap, and naming either letter on
 * screen would end the item before the child answers. The scene withholds the
 * answer rather than a guidance sentence asking the tutor to keep a secret.
 */
import type { ResponseClassId, TeachingItem } from '../../../hooks/teachingItemContract';
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { speakablePhoneme } from './phonemeVoice';

export type LetterSoundMode = 'see-hear' | 'hear-see' | 'keyword-match';
export type LetterSoundTier = 'easy' | 'medium' | 'hard';

// ── The continuant gate ─────────────────────────────────────────────────────

/**
 * Letters whose sound a KINDERGARTENER may be asked to produce in isolation,
 * with the stretched spelling the tutor should say. Code-owned for the same
 * reason di-letter-sounds owns its `spoken` field: a voice handed `/s/` reads
 * it acceptably but handed `/y/` reads the letter NAME ("why"), and handed
 * `/ă/` reads nothing at all. The short-vowel spellings are di-letter-sounds'
 * own, so a child hears one consistent rendering across both families.
 *
 * The set is the classic DISTAR "continuous sounds" list, the short vowels,
 * and — since 2026-09-05 — the eight stops of Letter-Sound Groups 1-3
 * (t p c k h d g b) as CLIPPED sounds. Standing gate 1 kept them out as
 * "unbenched for child production"; the lesson-coverage judge then showed the
 * phonics objectives naming them on every run with no block able to ask
 * (`unaskableLetters`). User ruling: the clipped sound OR the keyword onset
 * is evidence — `assignmentFor` says so for these letters. Live bench:
 * HUMAN-CHECKS #133. Still absent — affricates (j), glides (w y) and the
 * clusters (x qu) — keep full coverage in `hear-see` and `keyword-match`,
 * where the child's answer is a tap or a whole word.
 */
const SPOKEN_SOUNDS: Record<string, string> = {
  s: 'sss', n: 'nnn', m: 'mmm', f: 'fff', l: 'lll', r: 'rrr', v: 'vvv', z: 'zzz',
  a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu',
  // Stops: slash notation is the reading a voice gets right for an ASCII
  // consonant (phonemeVoice rule 1, proven on this primitive's live lesson).
  t: '/t/', p: '/p/', c: '/k/', k: '/k/', h: '/h/', d: '/d/', g: '/g/', b: '/b/',
};

/** The clipped (stop) subset of the producible letters: one short release,
 *  never held. The accept clause is wider for these — see `assignmentFor` —
 *  because the schwa and the keyword onset both count. */
const CLIPPED_SOUNDS: ReadonlySet<string> = new Set(['t', 'p', 'c', 'k', 'h', 'd', 'g', 'b']);
export const isClippedSound = (letter: string): boolean => CLIPPED_SOUNDS.has(letter.trim().toLowerCase());

/**
 * The letter NAME as a five-year-old says it. Producible letters only, because
 * only `see-hear` needs it — and it needs it because the name IS this
 * primitive's documented signature error, and the success condition has to name
 * the miss it is refusing (`assignmentFor`, and `letterSoundLinkHarnessAnswers`,
 * which drives the same utterance at the judge).
 *
 * Written out rather than sent as the bare glyph: over the wire the child's turn
 * crosses as TEXT, and a lone "S" is not decidably the NAME rather than the
 * sound. "ess" is.
 */
const LETTER_NAMES: Record<string, string> = {
  s: 'ess', n: 'en', m: 'em', f: 'eff', l: 'ell', r: 'ar', v: 'vee', z: 'zee',
  a: 'ay', e: 'ee', i: 'eye', o: 'oh', u: 'you',
  t: 'tee', p: 'pee', c: 'see', k: 'kay', h: 'aitch', d: 'dee', g: 'gee', b: 'bee',
};

export const letterNameFor = (letter: string): string | undefined =>
  LETTER_NAMES[letter.trim().toLowerCase()];

/** May a child be asked to PRODUCE this letter's sound alone? Standing gate 1. */
export const canProduceSound = (letter: string): boolean =>
  letter.trim().toLowerCase() in SPOKEN_SOUNDS;

/** Every letter `see-hear` may target. Exported so the generator constrains its
 *  own draw rather than trusting the prompt (the pool is code's business). */
export const PRODUCIBLE_LETTERS: readonly string[] = Object.keys(SPOKEN_SOUNDS);

/**
 * What the TUTOR should say for this letter's sound. Stretched where the sound
 * can be held; otherwise the generator's slash notation run through
 * `phonemeVoice` (proven on this primitive's live lesson: `/t/` reads fine as
 * long as the cue also forbids the letter name).
 */
export const spokenSoundFor = (letter: string, sound: string): string =>
  SPOKEN_SOUNDS[letter.trim().toLowerCase()] ?? speakablePhoneme(sound);

// ── The keyword anchor: the WORD and the PICTURE, in one place ──────────────

/**
 * ⭐ ONE MAP, because the two halves used to disagree silently (19h-i-b port 7).
 *
 * The anchor WORD lived in the generator (`KEYWORD_MAP`) and the anchor PICTURE
 * lived in the component (`KEYWORD_IMAGES`). Nothing joined them, so a word with
 * no entry on the other side rendered the `📝` fallback — a card showing a memo
 * emoji in the mode whose ask is *"say the picture word"*.
 *
 * `namesItsPicture` is the keyword-match gate, and it is the `x` rule
 * generalised rather than a new one. That mode asks the child to SAY THE WORD
 * THE PICTURE SHOWS, so an anchor whose picture does not read as its word makes
 * the ask undecidable — not harder, undecidable. The probe drew `i` → "itch"
 * → 🤏 and `g` → "go" → 🟢: no five-year-old names those, and the tutor then
 * refuses every answer they can give. Six anchors were re-chosen so the picture
 * reads as the word; `i` and `x` have no short-sound-initial word a child names
 * from a picture at all, so they are barred from keyword-match and keep their
 * full coverage in the other two directions (where the answer is a held sound
 * or a tap).
 *
 * `y` reads "yo-yo", never "yes": the legacy correction says "…and the word
 * <keyword> starts with…", and a keyword that can open a sentence with the
 * affirm sentinel would be read as a VERDICT by the retiring engine's sentence
 * scan. The map outlives that engine; the constraint costs nothing to keep.
 */
export interface LetterKeyword {
  word: string;
  emoji: string;
  /**
   * Does the picture read as the word to a pre-reader? False ⇒ this letter is
   * unaskable in keyword-match (the generator retargets), and the anchor is
   * used only as the post-verdict reveal in the other two directions.
   */
  namesItsPicture: boolean;
}

export const LETTER_KEYWORDS: Record<string, LetterKeyword> = {
  s: { word: 'sun', emoji: '☀️', namesItsPicture: true },
  a: { word: 'apple', emoji: '🍎', namesItsPicture: true },
  // Was "top" → 🔝, which is a TEXT BADGE rather than a picture.
  t: { word: 'tent', emoji: '⛺', namesItsPicture: true },
  // No short-/ĭ/-initial word a five-year-old names from a picture: igloo has
  // no emoji, iguana reads "lizard", insect reads "ant". Barred, like `x`.
  i: { word: 'itch', emoji: '🤏', namesItsPicture: false },
  p: { word: 'pig', emoji: '🐷', namesItsPicture: true },
  n: { word: 'net', emoji: '🥅', namesItsPicture: true },
  c: { word: 'cat', emoji: '🐱', namesItsPicture: true },
  k: { word: 'kite', emoji: '🪁', namesItsPicture: true },
  e: { word: 'egg', emoji: '🥚', namesItsPicture: true },
  h: { word: 'hat', emoji: '🎩', namesItsPicture: true },
  r: { word: 'run', emoji: '🏃', namesItsPicture: true },
  m: { word: 'map', emoji: '🗺️', namesItsPicture: true },
  d: { word: 'dog', emoji: '🐶', namesItsPicture: true },
  // Was "go" → 🟢, a green circle.
  g: { word: 'goat', emoji: '🐐', namesItsPicture: true },
  o: { word: 'octopus', emoji: '🐙', namesItsPicture: true },
  u: { word: 'up', emoji: '⬆️', namesItsPicture: true },
  // Was "lip" → 👄, which reads "lips" or "mouth".
  l: { word: 'leaf', emoji: '🍃', namesItsPicture: true },
  // Was "fan" → 🌬️, which is a wind-blowing face.
  f: { word: 'fish', emoji: '🐟', namesItsPicture: true },
  b: { word: 'bat', emoji: '🦇', namesItsPicture: true },
  // Was "jam" → 🍯, a honey pot.
  j: { word: 'juice', emoji: '🧃', namesItsPicture: true },
  // Was "zip" → ⚡, a lightning bolt.
  z: { word: 'zebra', emoji: '🦓', namesItsPicture: true },
  w: { word: 'web', emoji: '🕸️', namesItsPicture: true },
  v: { word: 'van', emoji: '🚐', namesItsPicture: true },
  y: { word: 'yo-yo', emoji: '🪀', namesItsPicture: true },
  // /ks/ never begins an English word, so `box` is a false anchor here — it was
  // already barred from keyword-match before this map existed.
  x: { word: 'box', emoji: '📦', namesItsPicture: false },
  qu: { word: 'queen', emoji: '👑', namesItsPicture: true },
};

/** The anchor word for a letter. */
export const keywordFor = (letter: string): string =>
  LETTER_KEYWORDS[letter.trim().toLowerCase()]?.word ?? 'sun';

/** The picture for an anchor WORD (the direction the component needs). */
export const emojiForKeyword = (word: string): string => {
  const needle = word.trim().toLowerCase();
  for (const entry of Object.values(LETTER_KEYWORDS)) {
    if (entry.word === needle) return entry.emoji;
  }
  return '📝';
};

/** May keyword-match target this letter? The picture has to name the word. */
export const keywordNamesItsPicture = (letter: string): boolean =>
  LETTER_KEYWORDS[letter.trim().toLowerCase()]?.namesItsPicture ?? false;

const NAMEABLE_ANCHOR_WORDS = new Set(
  Object.values(LETTER_KEYWORDS).filter((a) => a.namesItsPicture).map((a) => a.word),
);

/** The same bar applied to an option WORD — a keyword-match card the child
 *  cannot name is unusable whether it is the answer or the distractor. */
export const anchorWordNamesItsPicture = (word: string): boolean =>
  NAMEABLE_ANCHOR_WORDS.has(word.trim().toLowerCase());

// ── The item ────────────────────────────────────────────────────────────────

export interface LetterSoundOption {
  /** hear-see: the letter. keyword-match: the keyword word. */
  value: string;
  /** keyword-match only — the picture. */
  emoji?: string;
  isCorrect: boolean;
}

/** One letter-sound assignment. Extends the DOMAIN item base (what the answer
 *  is made of); the runtime's own `TeachingItem` (task/expectedAnswer/checker)
 *  is a different layer, and `LetterSoundLinkTeaching` maps onto it explicitly. */
export interface LetterSoundItem extends TeachingItem {
  mode: LetterSoundMode;
  /** The target grapheme, as printed. */
  letter: string;
  /** Display phoneme (`/s/`) — screen only, never handed to a voice raw. */
  sound: string;
  /** The utterable rendering of `sound`. */
  spoken: string;
  keyword: string;
  keywordEmoji: string;
  tier: LetterSoundTier;
  sharedSoundLetters?: string[];
  /** hear-see / keyword-match: the two on-screen choices. */
  options: LetterSoundOption[];
  /** The correct option's value — a letter (hear-see) or a word (keyword-match). */
  answer: string;
  /** The wrong option's value, named in the contract as what is NOT the answer. */
  distractor: string;
}

/** The one mode answered with the hands: a grapheme cannot be spoken, because
 *  `letter_name` is BLOCKED. */
export const answerKindFor = (mode: LetterSoundMode): 'voice' | 'gesture' =>
  mode === 'hear-see' ? 'gesture' : 'voice';

/** Standing gate 1: `see-hear` produces a held sound, `keyword-match` produces
 *  one short word from a closed two-picture set, `hear-see` manipulates. */
export const responseClassFor = (mode: LetterSoundMode): ResponseClassId =>
  mode === 'hear-see'
    ? 'manipulation'
    : mode === 'see-hear'
      ? 'continuant_sound'
      : 'short_spoken_word';

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface LetterSoundChallengeLike {
  id: string;
  mode: LetterSoundMode;
  targetLetter: string;
  targetSound: string;
  keywordWord: string;
  sharedSoundLetters?: string[];
  options?: Array<{ letter?: string; sound?: string; isCorrect: boolean }>;
}

/** hear-see options carry `letter`; keyword-match options carry the word in
 *  `sound` (the generator's field name predates the mode split). see-hear has
 *  no on-screen choices at all — the child speaks. */
const optionValue = (
  mode: LetterSoundMode,
  option: { letter?: string; sound?: string },
): string => (mode === 'hear-see' ? option.letter ?? '' : option.sound ?? '');

export const itemFromChallenge = (
  ch: LetterSoundChallengeLike,
  tier: LetterSoundTier = 'medium',
): LetterSoundItem => {
  const mode = ch.mode;
  // The anchor is CODE-OWNED (`LETTER_KEYWORDS`), not read off the payload: the
  // generator stamps the same value post-parse, and deriving it here is what
  // keeps a CACHED payload carrying a retired anchor ("jam" → 🍯) consistent
  // with the picture the stage renders.
  const keyword = keywordFor(ch.targetLetter);
  const options: LetterSoundOption[] = mode === 'see-hear'
    ? []
    : (ch.options ?? []).map((option) => {
        const raw = optionValue(mode, option);
        const value = mode === 'keyword-match' && option.isCorrect ? keyword : raw;
        return {
          value,
          emoji: mode === 'keyword-match' ? emojiForKeyword(value) : undefined,
          isCorrect: option.isCorrect,
        };
      });

  const correct = options.find((o) => o.isCorrect);
  const wrong = options.find((o) => !o.isCorrect);

  return {
    id: ch.id,
    mode,
    answerKind: answerKindFor(mode),
    responseClass: responseClassFor(mode),
    // Mixed sessions interleave speaking and tapping: `action` drives the
    // retiring runner's how-to-play re-speak whenever the thing-to-do changes
    // (cvc-speller rule), and on the workspace it is the item fact that says
    // the response channel changed.
    action: mode,
    letter: ch.targetLetter,
    sound: ch.targetSound,
    spoken: spokenSoundFor(ch.targetLetter, ch.targetSound),
    keyword,
    keywordEmoji: emojiForKeyword(keyword),
    tier,
    sharedSoundLetters: ch.sharedSoundLetters,
    options,
    // see-hear answers with the SOUND — it has no options and its `answer` is
    // the anchor only so the field is never empty; everything that judges it
    // reads `spoken`. hear-see answers with the letter, keyword-match with the
    // anchor word.
    answer: mode === 'hear-see' ? (correct?.value ?? ch.targetLetter) : (correct?.value ?? keyword),
    distractor: wrong?.value ?? '',
  };
};

/**
 * ⭐ THE SESSION INVARIANT: A LETTER MAY BE ANSWERED ONCE, AND ONCE ANSWERED IT
 * MAY NOT COME BACK AS THE WRONG CHOICE (19h-i-b port 7, sweep §4(d)).
 *
 * No single item can violate this and no per-item gate can see it. Every item
 * closes with its whole triple in the room: see-hear prints the letter, the
 * tutor models the sound and the anchor picture appears the moment the answer
 * is committed; hear-see names the sound and the child's own correct tap
 * identifies the letter; keyword-match prints the letter and the affirmation
 * says the anchor word. So after one item on `s` has closed, (s, sss, sun) is
 * no longer retrievable knowledge — it is something the child was just told.
 *
 * Two ways that leaks into a later item, and the probe drew BOTH in one draw:
 *
 *  1. **The same letter asked twice.** Recall, not production — and at the easy
 *     and medium tiers the model re-hands it over anyway, so the second ask
 *     measures nothing at all.
 *  2. **An answered letter or anchor offered as the DISTRACTOR.** The choice is
 *     binary here. The keyword-match draw came back with ch1 "sun vs net" →
 *     *"Yes, sun."*, then ch6 "net vs sun": the child has been told which
 *     picture is the sun and eliminates it without hearing the sound at all.
 *     Three of six items in that draw were solvable by elimination, and each
 *     one passed every per-item gate.
 *
 * This lives here rather than generator-side for the reason the sweep gives:
 * it is the boundary every consumer reads, so it also covers hand-authored and
 * cached payloads a prompt fix cannot reach. The generator is fixed too — it
 * retargets duplicates and excludes named words when it picks a distractor —
 * so the gate rarely has to bite.
 */
export const itemsFromChallenges = (
  challenges: LetterSoundChallengeLike[],
  tier: LetterSoundTier = 'medium',
  /** The workspace also drops an item that cannot be ASKED. The retiring runner
   *  never did, and this slice does not change what it builds. */
  askableOnly = false,
): LetterSoundItem[] => {
  /** Everything the tutor has already said out loud, or the screen has shown,
   *  as an ANSWER: letters and anchor words share the set because they never
   *  collide (no anchor is one or two characters long). */
  const named = new Set<string>();
  const items: LetterSoundItem[] = [];

  for (const ch of challenges) {
    if (askableOnly && !letterSoundChallengeValid(ch)) continue;
    const item = itemFromChallenge(ch, tier);
    const letter = item.letter.trim().toLowerCase();
    if (named.has(letter)) continue;
    if (item.options.some((o) => named.has(o.value.trim().toLowerCase()))) continue;
    // A "say the picture word" item is unaskable unless BOTH cards can be
    // named. The answer card is obvious; the DISTRACTOR matters just as much,
    // because a child who cannot name the wrong picture answers by picking the
    // one they can — a picture-recognition task wearing a phonics ask. The
    // generator draws both from the nameable pool now, so this reaches only
    // cached payloads.
    if (item.mode === 'keyword-match'
        && (!keywordNamesItsPicture(letter)
            || item.options.some((o) => !anchorWordNamesItsPicture(o.value)))) continue;

    named.add(letter);
    // hear-see is the one direction that never names its anchor: no correction
    // says it, and the stage prints no keyword reveal. Its letter is enough.
    if (item.mode !== 'hear-see') named.add(item.keyword.trim().toLowerCase());
    named.add(item.answer.trim().toLowerCase());
    items.push(item);
  }

  return items;
};

// ── Askability, checked on both sides of the wire ────────────────────────────

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();

const MODES: readonly LetterSoundMode[] = ['see-hear', 'hear-see', 'keyword-match'];

/**
 * Can this challenge be ASKED at all? An item that cannot is dropped rather
 * than repaired: a repaired letter-sound item would drill a letter nobody chose.
 *
 * The per-item bar only. The cross-item bar — a letter answered once, an anchor
 * already named — belongs to `itemsFromChallenges`, which is the only place
 * that can see it.
 */
export function letterSoundChallengeValid(c: LetterSoundChallengeLike): boolean {
  if (!c || !nonEmpty(c.id) || !nonEmpty(c.targetLetter) || !nonEmpty(c.targetSound)) return false;
  if (!MODES.includes(c.mode)) return false;
  if (c.targetLetter.trim().length > 2) return false;
  // Producing an isolated sound is gated on the continuant/stop list; the other
  // two directions never ask the child for one, which is their whole coverage
  // argument (affricates, glides and clusters live there).
  if (c.mode === 'see-hear') return canProduceSound(c.targetLetter);
  const options = c.options ?? [];
  if (options.length !== 2 || options.filter((o) => o.isCorrect).length !== 1) return false;
  if (c.mode === 'hear-see') {
    const letters = options.map((o) => (o.letter ?? '').trim().toLowerCase());
    return letters.every(nonEmpty) && letters[0] !== letters[1];
  }
  // keyword-match: the ask is undecidable unless the target's picture reads as
  // its word. Whether the DISTRACTOR's does is checked where duplicates are —
  // a cached payload with an unnameable distractor loses that item, not the pool.
  return keywordNamesItsPicture(c.targetLetter);
}

// ── The workspace assignment ────────────────────────────────────────────────

/** The eval modes this primitive binds to the shared teaching workspace. All
 *  three: no mode is withheld from a lesson (user ruling 2026-09-20). */
export const LETTER_SOUND_LINK_WORKSPACE_MODES = ['see_hear', 'hear_see', 'keyword_match'] as const;

/** Catalog eval mode ⇄ the challenge `mode` the generator stamps. */
export const CHALLENGE_MODE_FOR_EVAL_MODE: Record<string, LetterSoundMode> = {
  see_hear: 'see-hear', hear_see: 'hear-see', keyword_match: 'keyword-match',
};

/**
 * The ask, in the child's own terms. No bracket tag, no "Say exactly", no model
 * line and no lead-in: the tutor decides how much to model before the child tries.
 *
 * None of the three names its own answer. `hear-see` has to SAY the sound,
 * because the sound is the question — but it never says which letter makes it.
 */
export function askFor(item: Pick<LetterSoundItem, 'mode' | 'letter' | 'spoken'>): string {
  switch (item.mode) {
    case 'see-hear':
      return `What sound does the letter "${item.letter}" make?`;
    case 'hear-see':
      return `Which letter makes the sound ${item.spoken}? Tap it.`;
    case 'keyword-match':
      return `Which picture starts with the sound the letter "${item.letter}" makes? Say the word.`;
  }
}

/**
 * The accepted answer, short, because a tutor's affirmation is compared against
 * a token rather than a paragraph. `hear-see` has NONE on purpose: the activity
 * checks the tap, and a tutor told which letter is right would end the item by
 * naming it. The nuance lives in `assignmentFor`.
 */
export function acceptedFor(item: LetterSoundItem): string | undefined {
  if (item.mode === 'hear-see') return undefined;
  if (item.mode === 'keyword-match') return item.answer;
  return isClippedSound(item.letter) ? `${item.spoken} or ${item.keyword}` : item.spoken;
}

/**
 * The success condition, and what is NOT it — short, because this sentence is
 * what a tutor's feedback gets judged against. Each direction states its own
 * near miss, and each near miss is one this primitive actually drew on a live
 * drive:
 *
 *  - see-hear: the letter NAME said in place of the sound ("ess" for s). The
 *    primitive's documented signature error, and it arrives fluent.
 *  - hear-see: nothing spoken is an answer at all. The tap is the answer.
 *  - keyword-match: the letter's SOUND said back instead of a picture word.
 *    The question names the sound on the way to the answer, so "tuh" was
 *    affirmed 2 for 2 on the drive that found this.
 */
export function assignmentFor(item: LetterSoundItem): string {
  switch (item.mode) {
    case 'see-hear': {
      // The miss is NAMED, the way the other two directions name theirs. A
      // success condition that says only "the letter's name is not the answer"
      // left the observer accepting "Yes, em is right!" as a correct mmm on 2 of
      // 3 replays; the two directions whose assignment names the near miss by
      // its value refuse theirs 3 of 3. Measured, not tuned — see the adoption
      // report's LA-13 section.
      const name = letterNameFor(item.letter);
      const nameBlock = ` The letter's NAME${name ? ` — "${name}" — ` : ' '}is not the answer, `
        + 'however confidently it is said.';
      return isClippedSound(item.letter)
        ? `The learner must say the clipped sound ${item.spoken} that this letter makes. `
          + `A small "uh" after it counts, and so does "${item.keyword}" or another word starting with that sound.`
          + nameBlock
        : `The learner must say the continuous sound ${item.spoken} that this letter makes. `
          + 'A short try counts, and so does a little "uh" on the end.' + nameBlock;
    }
    case 'hear-see':
      return `The learner must TAP the letter that makes the sound ${item.spoken}. `
        + 'The activity checks the tap and reports it; nothing the learner says is an answer to this question. '
        + 'Saying, spelling or pointing out either letter on the screen gives the answer away.';
    case 'keyword-match':
      return `The learner must say the word for the picture that starts with this letter's sound: "${item.answer}". `
        + 'Another fair name for that same picture counts. '
        + (item.distractor ? `The other picture's word, "${item.distractor}", is not the answer. ` : '')
        + `The letter's sound said on its own — "${childVoicedSound(item)}" — is a sound and not the name of a picture, `
        + 'so it is not an answer here however close it sounds.';
  }
}

/**
 * The sound as a CHILD voices it: held sounds stretched, every other one with
 * the schwa a five-year-old cannot help adding ("puh" for /p/). Used both in
 * the success condition, which must name that utterance as a miss, and as the
 * harness's signature wrong, which is the same utterance. Change one, change both.
 */
export const childVoicedSound = (item: Pick<LetterSoundItem, 'letter' | 'sound' | 'spoken'>): string =>
  canProduceSound(item.letter) && !isClippedSound(item.letter)
    ? item.spoken
    : `${item.sound.replace(/\//g, '').trim()}uh`;

/** What the printed stimulus card shows, per direction. `hear-see` prints no
 *  single stimulus at all: its question is the sound, and its two letter cards
 *  are the choices. */
export const printedStimulus = (item: LetterSoundItem): string | null =>
  item.mode === 'hear-see' ? null : item.letter.toUpperCase();

/** The item as the tutor and the outcome observer are told it. `hear-see` deliberately has
 *  no expected answer: the activity checks the tap, and the tutor is never told the letter. */
export const workspaceAssignment = (item: LetterSoundItem): TeachingAssignment => ({ id: item.id, task: askFor(item),
  ...(acceptedFor(item) !== undefined ? { expectedAnswer: acceptedFor(item) } : {}),
  response: item.answerKind === 'gesture' ? 'gesture' : 'speech' });

/** The drawn stage. `tapped` is the letter the learner last tapped on a `hear-see` item. */
export function workspaceScene(item: LetterSoundItem, tapped: string | null = null): WorkspaceScene {
  const gesture = item.answerKind === 'gesture';
  return {
    objects: gesture
      // Both letters carry the SAME group. Nothing in the scene says which one
      // is the answer, because nothing in the scene knows.
      ? item.options.map(option => ({ id: `option-${option.value.toLowerCase()}`,
        label: `a card showing the letter "${option.value.toUpperCase()}"`,
        selected: tapped?.toLowerCase() === option.value.toLowerCase(),
        group: 'one of the two letters the learner chooses between' }))
      : [{ id: 'letter', label: `the letter "${item.letter}" printed on the card`, selected: false,
          group: 'the printed letter this question is about' },
        ...(item.mode === 'keyword-match' ? item.options.map(option => ({
          id: `picture-${option.value.toLowerCase()}`, label: `a picture of a ${option.value}`,
          selected: false, group: 'one of the two pictures' })) : [])],
    facts: { kind: item.mode, assignment: assignmentFor(item), supportTier: item.tier,
      // `hear-see` needs the sound published: the tutor has to say it, and it
      // is the QUESTION rather than the answer. The other two directions carry
      // their sound in `expectedAnswer` (see-hear) or not at all.
      ...(gesture ? { soundToSay: item.spoken } : { printedLetter: item.letter.toUpperCase() }),
      ...(item.tier === 'hard' && !gesture
        ? { coldAsk: 'This item is answered cold on purpose: the sound is not modelled before the learner answers.' }
        : {}) },
  };
}

/** Expand a generated pool into the assignments the workspace actually asks. */
export function buildLetterSoundLinkItems(
  challenges: LetterSoundChallengeLike[] = [],
  tier: LetterSoundTier = 'medium',
): LetterSoundItem[] {
  return itemsFromChallenges(challenges, tier, true);
}

// ── Harness answer material — what a right and a wrong child do ──────────────

/**
 * What the mounted journey driver DOES for this item. Two channels, because
 * this primitive has two: a spoken direction answers with an utterance, and
 * `hear-see` answers by tapping a letter card, whose label is the uppercase
 * letter the stage prints.
 *
 * The wrong answers are plainly different rather than the signature misses the
 * pack exists to correct — a transport harness must not score the tutor's
 * handling of a real misconception as a transport failure. The signature misses
 * belong in the JEV probe, where the tutor's reply is fixed and only the
 * observer is under test.
 */
export function letterSoundLinkWorkspaceAnswers(item: LetterSoundItem): { correct: string; plainWrong: string } {
  if (item.mode === 'hear-see') {
    const wrong = item.distractor || item.options.find((o) => !o.isCorrect)?.value
      || (item.letter.toLowerCase() === 'm' ? 'n' : 'm');
    return { correct: item.answer.toUpperCase(), plainWrong: wrong.toUpperCase() };
  }
  if (item.mode === 'keyword-match') {
    return { correct: item.answer, plainWrong: item.distractor || 'net' };
  }
  const decoy = ['mmm', 'fff', 'lll', 'sss'].find((s) => s !== item.spoken) ?? 'mmm';
  return { correct: item.spoken, plainWrong: decoy };
}
