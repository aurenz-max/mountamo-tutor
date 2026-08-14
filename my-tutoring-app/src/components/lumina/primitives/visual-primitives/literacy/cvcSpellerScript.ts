/**
 * cvcSpellerScript — HAND-AUTHORED Direct Instruction script for cvc-speller,
 * the FOURTH literacy port of the DI modality (`phonicsBlenderScript.ts` is
 * port 1, `soundSwapScript.ts` port 2, `wordFlipScript.ts` port 3). The exact
 * wording IS the pedagogy (DISTAR discipline), so these lines are authored,
 * never generated. Item CONTENT (which words, which letters, which emoji)
 * stays generator-scoped to the objective; this module owns only the cue
 * SHAPE, the judging contract, and the correction wording.
 *
 * WHY THIS EXISTS (qa/di/BACKLOG.md item 16). cvc-speller shipped a
 * push-to-talk mic, a 1400ms auto-advance `setTimeout`, a Check button, a
 * Next/Finish/Skip trio, and a tutor whose scaffolding was driven by an
 * attempt counter rather than by what it heard. Under all of that, two of its
 * three modes had the same costume word-flip had: the answer was PRINTED ON
 * SCREEN as one of two buttons.
 *
 * ⚠️ TWO MODES DIED BY THE ANSWER-LEAK GATE, NOT BY THE TIMER, and that is
 * this port's finding. `fill-vowel` offered two vowel buttons ("a · apple" /
 * "e · egg") and `word-sort` offered two vowel buckets with the same captions.
 * In both, ONE OF THE TWO OPTIONS IS THE ANSWER, printed, captioned with its
 * keyword, and a Grade 1 child can read it — the identical object word-flip
 * deleted its chips for. It also made the task RECOGNITION: a child who cannot
 * isolate the middle sound of "cat" picks correctly half the time, and a child
 * who can, can mis-tap. Isolating a sound inside a spoken word is an oral act
 * end to end, so both answers are now oral.
 *
 * ⚠️ `spell-word` IS THE ONE THAT STAYS IN THE HANDS, and it is the gesture
 * anchor's first production caller (`submitGestureAttempt`). Placing three
 * letters in order out of a distractor-populated bank is not guessable and is
 * not a costume — it is ENCODING, which is the whole reason this primitive
 * exists next to phonics-blender (which decodes). Porting it to speech would
 * have deleted the primitive's own curriculum home ("spell words using common
 * patterns"). What went instead was the Check button and the stopwatch: the
 * third letter landing IS the commit, and the tutor's own verdict is the
 * advance.
 *
 * WHAT IS MODELED, AND WHAT IS NOT. This is sound-swap's answer, not
 * phonics-blender's: the cue models only the STIMULUS (the word), never the
 * answer, and the move is modeled in the CORRECTION. Saying "cat" is always
 * safe — the tutor has to say it, it is the whole stimulus. Saying the middle
 * SOUND, or spelling the word out letter by letter, is the leak.
 *
 * ⚠️ THE HOW-TO-PLAY IS SPOKEN AT EVERY GRADE HERE, AND WHENEVER THE ACTION
 * CHANGES — a deliberate divergence from ports 1-2, which band-gate it to
 * Kindergarten because a reader can see the protocol printed on screen. This
 * primitive has THREE different actions and a blended session interleaves
 * them, so "what to do" is not a static statement anybody can look up: it
 * changes mid-session. A Grade 1 child who has been saying sounds for three
 * items and is suddenly handed letter boxes has no other channel.
 * (Residual SWAP-1 still holds: the how-to-play is TEXT INSIDE the quoted
 * line, so the opening turn's only job is the one every other turn has —
 * speak this exactly. Nothing here asks the tutor to compose.)
 *
 * ANSWER-LEAK RULE. The word and its picture ARE the stimulus and are said and
 * shown. The middle sound (`fill-vowel` / `word-sort`) and the spelling
 * (`spell-word`) are the answer: nothing prints, offers or speaks them until
 * the tutor has affirmed. On `word-sort` the two vowel columns are built out
 * of answers ALREADY GIVEN — the first word of a column labels it at the
 * moment it is affirmed, never before.
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn").
 * Standing gate 2 (collision) — no line below opens with either token except
 * the verdict branches themselves; classic DISTAR's "My turn." model opener is
 * FORBIDDEN and the model opens with "Listen:" instead, exactly as
 * di-letter-sounds, di-word-reading and the three earlier ports resolved it.
 *
 * RESPONSE CLASS (standing gate 1). The spoken answer is ONE short vowel
 * sound — the class `di-letter-sounds` benched and ships live on (its vowel
 * modes ask for exactly this, and its own spellings are what this module
 * speaks). No new bench sitting is owed. `spell-word` produces no spoken
 * answer at all, so it owes none either. **This pack still asks for the SOUND,
 * never the letter NAME** — not because the name is blocked (that block was
 * OVERTURNED 2026-08-13; `letter_name` is `accepted-build-ahead`, see
 * judgedScriptContract.ts) but because sounding is the skill `cvc-speller`
 * teaches. The one place a letter name is spoken is the tutor's own second
 * correction.
 *
 * EVERY PHONEME IN A SPOKEN LINE GOES THROUGH `phonemeVoice`, with one
 * deliberate strengthening for the vowel: it is resolved from the vowel LETTER
 * through a code-owned map first, and only falls back to the generator's
 * phoneme glyph. `speakablePhoneme` passes ASCII through untouched by design,
 * so a generation that wrote `/a/` instead of `/æ/` would reach the tutor as
 * the letter NAME "ay" — the exact wrong sound, in the one line the whole mode
 * turns on. The letter is always known and always right.
 */

import { speakablePhoneme } from './phonemeVoice';

/** The three task identities. Mirrors the catalog's eval modes. */
export type CvcTask = 'fill-vowel' | 'spell-word' | 'word-sort';

/** One CVC item. Mirrors the generator's shape, narrowed to what a line needs. */
export interface CvcItem {
  id: string;
  task: CvcTask;
  /** "cat" — the STIMULUS. Always safe to say; never safe to spell aloud. */
  word: string;
  /** ['c','a','t'] — the `spell-word` ANSWER. Never spoken before a verdict. */
  letters: string[];
  /** ['/k/','/æ/','/t/'] as the GENERATOR wrote them (screen-facing). */
  phonemes: string[];
  /** 'a' — the middle letter, code-derived so it cannot desync from `letters`. */
  vowelLetter: string;
  /** 🐱 — picture stimulus. May be withdrawn by support tier. */
  emoji: string;
}

/**
 * Short-vowel spellings for the VOICE. These are di-letter-sounds' own
 * ("aaa", "eee", …), so a child hears one consistent rendering of the same
 * sound across the two families. Code-owned rather than read off the
 * generator's phoneme string — see the module header.
 */
const SHORT_VOWEL_SPOKEN: Record<string, string> = {
  a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu',
};

/** The keyword anchor for each short vowel. Correction-only: naming it before
 *  an answer would hand the sound over. */
const VOWEL_KEYWORDS: Record<string, string> = {
  a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up',
};

export const vowelKeyword = (letter: string): string =>
  VOWEL_KEYWORDS[letter.toLowerCase()] ?? '';

/**
 * The middle sound, as the tutor should SAY it. Falls back to the generator's
 * phoneme (through `phonemeVoice`) only when the middle letter is not one of
 * the five short vowels — which the generator's CVC contract makes impossible,
 * but a malformed draw should degrade to a mapped glyph rather than to
 * nothing.
 */
export const spokenVowel = (item: CvcItem): string => {
  const mapped = SHORT_VOWEL_SPOKEN[item.vowelLetter.toLowerCase()];
  if (mapped) return mapped;
  return speakablePhoneme(item.phonemes[1] ?? item.vowelLetter);
};

/** Position words a five-year-old already has from the Elkonin frame. */
const POSITION_WORDS = ['first', 'middle', 'last'] as const;

export const positionWord = (index: number): string => POSITION_WORDS[index] ?? 'next';

/**
 * The sound at one position, spoken. The middle position routes through
 * `spokenVowel` (letter-derived); the consonants go through `phonemeVoice`,
 * which leaves ASCII exactly as the generator authored it.
 */
export const spokenSoundAt = (item: CvcItem, index: number): string =>
  index === 1 ? spokenVowel(item) : speakablePhoneme(item.phonemes[index] ?? '');

/**
 * "caaat" — the word with its vowel held. The `easy` support tier's one lever
 * (see the component + generator): a held vowel is a perception scaffold, not
 * the answer, because the child must still name the sound they heard.
 * ASCII by construction, so the voice reads it as a stretched word rather than
 * as notation.
 */
export const stretchedWord = (item: CvcItem): string => {
  const [first, , last] = item.letters;
  if (!first || !last) return item.word;
  return `${first}${item.vowelLetter.repeat(3)}${last}`;
};

/**
 * How to play, per ACTION. Spoken inside the quoted line on the first item and
 * again whenever the action changes — see the module header for why this is
 * not band-gated the way ports 1-2 are.
 */
export const HOW_TO_PLAY: Record<CvcTask, string> = {
  'fill-vowel':
    'We are listening for the sound in the middle of a word. I say a word, and you say just the middle sound out loud!',
  'word-sort':
    'We are listening for the sound in the middle of a word. I say a word, and you say just the middle sound out loud — it changes from word to word, so listen closely!',
  'spell-word':
    'I say a word, and you put a letter in each box for the sounds you hear!',
};

/**
 * The spoken ask — THREE BEATS at every mode: the word, the optional held
 * repeat, the hand-over. The answer is nowhere in it.
 *
 * The hand-over is "Say the middle sound." rather than the family's usual
 * "What word?", and that is the pedagogy rather than style. "What word?" after
 * "Listen: cat" is answered honestly with "cat" — the child repeats the
 * stimulus and is technically right. "Say the middle sound" has exactly one
 * correct completion. (word-flip's "Three what?" ruling, reached a second
 * time: an ambiguous ask is not a harder task, it is a broken one.)
 *
 * `spell-word` hands over to the HANDS instead, and names the word again
 * rather than any letter — spelling it aloud would be the answer.
 */
export const askLine = (item: CvcItem, opts: { stretch?: boolean } = {}): string => {
  const hold = opts.stretch ? ` ${stretchedWord(item)}.` : '';
  return item.task === 'spell-word'
    ? `Listen: ${item.word}.${hold} Your turn. Put in the letters for ${item.word}.`
    : `Listen: ${item.word}.${hold} Your turn. Say the middle sound.`;
};

/**
 * The correction, and the first legitimate moment the answer is spoken at all.
 * Standing gate 3: every correction re-models, then re-elicits.
 *
 * It FADES across the two allowed corrections rather than repeating itself,
 * which is what makes a second attempt worth having:
 *  - correction 1 names the SOUND and hands it straight back;
 *  - correction 2 adds the LETTER, because a child who has now missed twice is
 *    not going to find it by listening harder.
 * On `spell-word` the letter is the answer, so correction 1 deliberately
 * withholds it and names only the sound at the box that is wrong.
 */
export const correctionLine = (
  item: CvcItem,
  opts: { correction: number; wrongIndex?: number } = { correction: 1 },
): string => {
  const ask = askLine(item);
  if (item.task === 'spell-word') {
    const index = opts.wrongIndex ?? 1;
    const sound = spokenSoundAt(item, index);
    const where = positionWord(index);
    return opts.correction >= 2
      ? `My turn: ${item.word}. The ${where} sound is ${sound}, and the ${where} letter is ${item.letters[index]?.toUpperCase() ?? '?'}. ${ask}`
      : `My turn: ${item.word}. Listen to the ${where} sound: ${sound}. ${ask}`;
  }
  const sound = spokenVowel(item);
  const keyword = vowelKeyword(item.vowelLetter);
  return opts.correction >= 2 && keyword
    ? `My turn: ${item.word}. The middle sound is ${sound}, like in ${keyword}. ${ask}`
    : `My turn: ${item.word}. The middle sound is ${sound}. ${ask}`;
};

/**
 * The in-band judging contract for one SPOKEN item. The Live tutor hears the
 * raw audio and judges the attempt ITSELF; the engine reads which branch it
 * took from the sentinel opener and alone decides progression.
 *
 * Three rules carry the pedagogy, and the second is the one this response
 * class will be wrongly affirmed on:
 *  - The sound counts however it arrives — clipped, held, or inside a phrase
 *    ("it's aaa"). Refusing a held vowel would correct a child who was right,
 *    and holding it is what a five-year-old does when they are sure.
 *  - SAYING THE WHOLE WORD BACK is the signature error of isolation. It is
 *    fluent, confident, and exactly what the tutor just said, which is why it
 *    is the answer most likely to be mistaken for success — the same shape as
 *    sound-swap's starting-word-back and word-flip's bare singular.
 *  - Naming the LETTER instead of the sound ("ay" for /æ/) is a real
 *    Kindergarten confusion, not carelessness, and it is precisely the
 *    distinction this mode exists to teach. It takes the correction branch.
 */
export function judgingContract(item: CvcItem): string {
  const sound = spokenVowel(item);
  const first = spokenSoundAt(item, 0);
  const last = spokenSoundAt(item, 2);
  return `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner answers.
Each time the learner responds, judge the audio you heard against the middle sound of "${item.word}", which is "${sound}":
- The learner made the "${sound}" sound — clipped, held, or inside a short phrase: say exactly "Yes, ${sound}." and stop.
- Anything else — saying the whole word "${item.word}" back, making one of the other sounds in it (${first} or ${last}), saying the NAME of a letter instead of a sound, or a different sound entirely: say exactly "${correctionLine(item, { correction: 1 })}" and stop — the learner tries again while you stay silent.
Judge on the MIDDLE sound only: the answer is the one sound in the middle of "${item.word}", not the whole word and not the sounds around it. The name of a letter is not the answer either — the sound it makes is.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, you stay silent until the application's next instruction.`;
}

/**
 * What a `spell-word` item asks of the TUTOR: say the line, then be silent.
 *
 * There is no judging contract here because there is nothing to judge — the
 * learner answers with their hands and Gemini hears none of it. The verdict
 * arrives as its own cue (`buildVerdictCue`) once the third letter lands.
 * The silence has to be spelled out: a helpful model with an open microphone
 * and three visible boxes will otherwise start naming letters, which is the
 * answer.
 */
const gestureWaitContract = (item: CvcItem): string =>
  `Then stop and wait. The learner answers by putting letters into boxes, which you cannot hear, so say NOTHING at all until the application sends you the next message.
Do not repeat the word, do not name or sound out any letter of "${item.word}", do not spell it, and do not comment on what the learner is doing.
Never begin any other sentence with the word "Yes" or the words "My turn".`;

/**
 * MODEL THE STIMULUS → TEST, in one turn.
 *
 * `howToPlay` prepends the action AS SPOKEN TEXT (residual SWAP-1 — the
 * opening turn gets ONE job, speak this). `opening` additionally carries the
 * anti-echo frame, exactly once per session.
 */
export const itemCue = (
  item: CvcItem,
  opts: { opening?: boolean; howToPlay?: boolean; stretch?: boolean } = {},
): string =>
  `[DI_CVC_ITEM]${opts.opening
    ? ' You are running a short, brisk sounds-and-letters game for a young child.'
      + ' Never say, reproduce, or invent text inside square brackets; those labels are'
      + ' private application metadata. Speak the quoted line below and nothing else —'
      + ' it already contains the greeting and how to play, so do not add your own.'
    : ''}
Speak exactly:
"${opts.howToPlay ? `${HOW_TO_PLAY[item.task]} ` : ''}${askLine(item, { stretch: opts.stretch })}"
${item.task === 'spell-word' ? gestureWaitContract(item) : judgingContract(item)}`;

/**
 * The learner committed a BUILD. This is the gesture anchor's ask: it carries
 * what they did, and asks for exactly one line back.
 *
 * The application already knows whether the placement is right — nothing was
 * spoken, so there is no audio to judge and no honest way to pretend
 * otherwise. What the tutor owns here is the CLOCK and the VOICE: the child
 * gets the same waiting teacher, the same contrastive correction, and the same
 * verdict-is-the-advance as a child who says a word, instead of a Check button
 * and a `setTimeout`. The engine binds the verdict through the ordinary
 * sentinel scan, which is why the line is still quoted rather than described.
 */
export const buildVerdictCue = (
  item: CvcItem,
  opts: { placed: (string | null)[]; correct: boolean; wrongIndex?: number; correction?: number },
): string => {
  const shown = opts.placed.map((l) => l ?? '_').join(' ');
  return opts.correct
    ? `[DI_CVC_BUILD] The learner filled the boxes correctly for "${item.word}".
Speak exactly:
"Yes, ${item.word}."
Then stop. Never begin any other sentence with the word "Yes" or the words "My turn". Speak nothing beyond that exact line, and you stay silent until the application's next instruction.`
    : `[DI_CVC_BUILD] The learner put "${shown}" in the boxes, and the word is "${item.word}".
Speak exactly:
"${correctionLine(item, { correction: opts.correction ?? 1, wrongIndex: opts.wrongIndex })}"
${gestureWaitContract(item)}
Speak nothing beyond that exact line.`;
};

/**
 * Corrections capped: acknowledge neutrally and move on. A hard word resurfaces
 * through distributed review, not by drilling a frustrated five-year-old in
 * place. The next item's own contract rides along, so the tutor is never left
 * asking a question it has no rule for.
 */
export const moveOnCue = (
  item: CvcItem,
  next: CvcItem | null,
  opts: { howToPlay?: boolean; stretch?: boolean } = {},
): string => next
  ? `[DI_CVC_MOVE_ON] Stop correcting "${item.id}". Speak exactly:
"Good try. We'll play that one again later. ${opts.howToPlay ? `${HOW_TO_PLAY[next.task]} ` : ''}${askLine(next, { stretch: opts.stretch })}"
${next.task === 'spell-word' ? gestureWaitContract(next) : judgingContract(next)}`
  : `[DI_CVC_MOVE_ON] Stop correcting "${item.id}". Speak exactly:
"Good try. We'll play that one again later. That's the end of our sounds game."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = (): string =>
  `[DI_CVC_COMPLETE] Speak exactly: "That's the end of our sounds game. Great listening today!"`;

/**
 * A tapped picture / word card speaks the WORD. This is the primitive's
 * stimulus channel for a child who lost the word or does not recognise the
 * emoji, and it is NEVER withdrawn by band or support tier, so it is an
 * ordinary send rather than anything the loop paces. Kept self-contained (the
 * word is in the body, not only the tag) because the catalog directive keys on
 * the prefix.
 *
 * ⚠️ It says the word and STOPS. The control it replaces was a three-tap
 * ladder that escalated into segmenting the word and then isolating its middle
 * sound — which on two of the three modes IS the answer, spoken on demand,
 * before the child had answered anything. Segmenting now lives only in the
 * correction, where it is earned.
 */
export const pronounceCue = (word: string): string =>
  `[SAY_WORD] Say this word clearly, twice, and nothing else: "${word}". `
  + `Do NOT spell it, do NOT say its letters, do NOT break it into separate sounds, `
  + `do not say any other word, and do not treat this as an attempt to judge.`;
