/** Direct Instruction data and the Live-judged per-item cues. */

import type { TutoringScaffold } from '../../types';
import type { DIItem } from './diBenchModel';

export const DEFAULT_ITEMS: DIItem[] = [
  {
    id: 'sound-m', kind: 'sound', display: 'm', spoken: 'mmm', keyword: 'moon', reference: 'mmm',
    asrAliases: ['m', 'mm', 'mmm', 'hm', 'hmm', 'mhm', 'um'],
  },
  {
    id: 'sound-s', kind: 'sound', display: 's', spoken: 'sss', keyword: 'sun', reference: 'sss',
    // Cross-check-only tradeoff: Live ASR often lexicalizes a sustained /s/
    // as "shh". The Live tutor judges from the audio it heard; these aliases
    // only measure transcript agreement.
    asrAliases: ['s', 'ss', 'sss', 'ess', 'sh', 'shh', 'hiss'],
  },
  {
    id: 'sound-a',
    kind: 'sound',
    display: 'a',
    spoken: 'aaa',
    keyword: 'apple',
    elicitation: 'keyword',
    reference: 'aaa',
    asrAliases: ['apple'],
  },
  { id: 'word-sam', kind: 'word', display: 'sam', spoken: 'sam', reference: 'sam', asrAliases: ['sam'] },
];

/**
 * di-word-reading bench probe (BACKLOG item 2). Single whole words are a NEW
 * response class relative to letter sounds, so standing gate 1 requires a
 * sitting here — hand-rolled 10-item list, ~K pace — to confirm Live-judge
 * reliability on lone words BEFORE any primitive wiring. Seven decodable CVC
 * spanning all five short vowels + three high-frequency sight words; a few
 * near-neighbours ("mat"/"matt", "sun"/"son", "red"/"read", "see"/"sea") are
 * left in on purpose so the probe stresses over-affirmation, not just easy
 * hits. "sam" leads for continuity — it was DEFAULT_ITEMS' word anchor (bench
 * item 4, affirmed). The primitive will generator-scope its menu to the
 * objective's phonics pattern (reuse word-workout's resolveScopedVowels
 * family); nothing here ships hardcoded into a primitive.
 */
export const WORD_READING_PROBE_ITEMS: DIItem[] = [
  { id: 'word-sam', kind: 'word', display: 'sam', spoken: 'sam', reference: 'sam', asrAliases: ['sam'] },
  { id: 'word-mat', kind: 'word', display: 'mat', spoken: 'mat', reference: 'mat', asrAliases: ['mat', 'matt'] },
  { id: 'word-pig', kind: 'word', display: 'pig', spoken: 'pig', reference: 'pig', asrAliases: ['pig'] },
  { id: 'word-dog', kind: 'word', display: 'dog', spoken: 'dog', reference: 'dog', asrAliases: ['dog', 'dawg'] },
  { id: 'word-sun', kind: 'word', display: 'sun', spoken: 'sun', reference: 'sun', asrAliases: ['sun', 'son'] },
  { id: 'word-red', kind: 'word', display: 'red', spoken: 'red', reference: 'red', asrAliases: ['red', 'read'] },
  { id: 'word-cup', kind: 'word', display: 'cup', spoken: 'cup', reference: 'cup', asrAliases: ['cup'] },
  { id: 'word-the', kind: 'word', display: 'the', spoken: 'the', reference: 'the', asrAliases: ['the', 'thee', 'duh'] },
  { id: 'word-see', kind: 'word', display: 'see', spoken: 'see', reference: 'see', asrAliases: ['see', 'sea', 'c'] },
  { id: 'word-go', kind: 'word', display: 'go', spoken: 'go', reference: 'go', asrAliases: ['go', 'goh', 'goe'] },
];

/**
 * di-math-facts bench probe (BACKLOG item 3). Spoken NUMBER WORDS are a NEW
 * response class relative to letter sounds and read words, so standing gate 1
 * requires a sitting here — hand-rolled 10-item list, K-1 addition facts —
 * to confirm Live-judge reliability on number-word answers BEFORE any
 * primitive wiring. The printed problem ("2 + 1") is the stimulus; the spoken
 * answer number word ("three") is the judged target. Answers deliberately
 * cover every number word 1–10, and the homophonic ones stay in on purpose
 * (one/won, two/to/too, four/for, eight/ate) so the probe stresses
 * over-affirmation and digit-vs-word ASR lexicalization, not just easy hits.
 * Sentinel call for the probe: keep the proven engine defaults ("Yes" /
 * "My turn") — both branches are exact-scripted so a spontaneous math-tutor
 * "Yes!" cannot leak a verdict; whether arithmetic wants a distinct correction
 * opener is exactly what the sitting decides before the primitive locks its
 * script. The primitive will generator-scope fact families to the objective;
 * nothing here ships hardcoded into a primitive.
 */
export const MATH_FACTS_PROBE_ITEMS: DIItem[] = [
  { id: 'fact-1p1', kind: 'fact', display: '1 + 1', problem: 'one plus one', spoken: 'two', reference: 'two', asrAliases: ['two', '2', 'to', 'too'] },
  { id: 'fact-2p1', kind: 'fact', display: '2 + 1', problem: 'two plus one', spoken: 'three', reference: 'three', asrAliases: ['three', '3', 'free', 'tree'] },
  { id: 'fact-2p2', kind: 'fact', display: '2 + 2', problem: 'two plus two', spoken: 'four', reference: 'four', asrAliases: ['four', '4', 'for', 'fore'] },
  { id: 'fact-3p2', kind: 'fact', display: '3 + 2', problem: 'three plus two', spoken: 'five', reference: 'five', asrAliases: ['five', '5'] },
  { id: 'fact-3p3', kind: 'fact', display: '3 + 3', problem: 'three plus three', spoken: 'six', reference: 'six', asrAliases: ['six', '6', 'sick'] },
  { id: 'fact-4p3', kind: 'fact', display: '4 + 3', problem: 'four plus three', spoken: 'seven', reference: 'seven', asrAliases: ['seven', '7'] },
  { id: 'fact-4p4', kind: 'fact', display: '4 + 4', problem: 'four plus four', spoken: 'eight', reference: 'eight', asrAliases: ['eight', '8', 'ate'] },
  { id: 'fact-5p4', kind: 'fact', display: '5 + 4', problem: 'five plus four', spoken: 'nine', reference: 'nine', asrAliases: ['nine', '9'] },
  { id: 'fact-5p5', kind: 'fact', display: '5 + 5', problem: 'five plus five', spoken: 'ten', reference: 'ten', asrAliases: ['ten', '10', 'tin'] },
  { id: 'fact-0p1', kind: 'fact', display: '0 + 1', problem: 'zero plus one', spoken: 'one', reference: 'one', asrAliases: ['one', '1', 'won'] },
];

/**
 * di-math-facts `counting_next` to 120 — bench probe for the MULTI-WORD NUMERAL
 * response class (BACKLOG item 10, reader-fit 14g). Standing gate 1: this class
 * must bench here BEFORE the pack's number-word ceiling moves off twenty.
 *
 * Why it is a new class, not more of #46. Every benched DI response so far is a
 * SINGLE token — one held sound, one word, one number word ("three"). Past
 * twenty a counting answer becomes a compound utterance said as two or three
 * words ("fifty-one", "one hundred seven"), and three things change at once:
 *
 *  (a) **Teen/decade confusability — the make-or-break.** "Thirteen" and
 *      "thirty" differ by an unstressed syllable that child speech routinely
 *      flattens, and they are ADJACENT in exactly the range a 1-120 counting
 *      objective drills. If Live affirms "thirty" for "thirteen", the pack
 *      cannot measure counting accuracy past twelve at all and Option B is
 *      dead — the honest answer would be to keep saturating at twenty. Items
 *      1-6 put both sides of the 13/30, 14/40, 16/60 and 17/70 pairs on the
 *      table; drive at least one deliberately wrong ACROSS a pair (say "thirty"
 *      for thirteen) — an affirm there is the finding.
 *  (b) **Completeness.** A compound number is ONE answer that arrives in
 *      pieces, so a partial production ("twenty" for "one hundred twenty",
 *      "hundred seven") is a wrong answer that sounds like a right one starting
 *      or ending. Items 8-10 are the stress; the 500ms family `silenceCloseMs`
 *      is also on trial, because a child who pauses between "one hundred" and
 *      "seven" splits one answer into two voice turns — the exact break
 *      di-sentence-reading hit at 3-8 words (it raised to 1100ms; a compound
 *      numeral may need the same, and that is a PACK config, never the family
 *      default).
 *  (c) **Cue readability at length.** The bench-proven DISTAR lines are
 *      `problem`-phrased and should carry unchanged — "Listen: the number after
 *      one hundred nineteen is one hundred twenty." Judge whether that still
 *      reads at pace to a six-year-old, or whether the model/guide pair drags
 *      once every line carries two long numerals.
 *
 * Deliberately NOT cross-aliased: a teen NEVER lists its decade sibling (or the
 * reverse) in `asrAliases`. The alias check is the passive judge-vs-transcript
 * disagreement meter, so listing "thirty" under thirteen would hide precisely
 * the confusion being measured. Digit lexicalizations and true spelling
 * variants ("fourty", "a hundred") stay in, because the 07-24 sitting showed
 * ASR writes number WORDS and the digit form was never needed.
 *
 * Items are hand-rolled per standing gate 1 — nothing here ships into a
 * primitive, and the pack's code-owned numeral builder is written only after
 * this sitting passes.
 */
export const COUNTING_SEQUENCE_PROBE_ITEMS: DIItem[] = [
  // 1-2: both sides of the 13/30 pair, the highest-risk confusion in the range.
  { id: 'count-12', kind: 'counting', display: '12 →', problem: 'the number after twelve', spoken: 'thirteen', reference: 'thirteen', asrAliases: ['thirteen', '13'] },
  { id: 'count-29', kind: 'counting', display: '29 →', problem: 'the number after twenty-nine', spoken: 'thirty', reference: 'thirty', asrAliases: ['thirty', '30'] },
  // 3-4: the first decade transition a child meets past twenty, then 14/40.
  { id: 'count-39', kind: 'counting', display: '39 →', problem: 'the number after thirty-nine', spoken: 'forty', reference: 'forty', asrAliases: ['forty', '40', 'fourty'] },
  { id: 'count-13', kind: 'counting', display: '13 →', problem: 'the number after thirteen', spoken: 'fourteen', reference: 'fourteen', asrAliases: ['fourteen', '14'] },
  // 5: the first TWO-WORD answer — a compound inside a decade, no boundary.
  { id: 'count-50', kind: 'counting', display: '50 →', problem: 'the number after fifty', spoken: 'fifty-one', reference: 'fifty-one', asrAliases: ['fifty one', '51'] },
  // 6-7: 16/60 and 17/70, then a two-word answer over a repeated stem.
  { id: 'count-69', kind: 'counting', display: '69 →', problem: 'the number after sixty-nine', spoken: 'seventy', reference: 'seventy', asrAliases: ['seventy', '70'] },
  { id: 'count-76', kind: 'counting', display: '76 →', problem: 'the number after seventy-six', spoken: 'seventy-seven', reference: 'seventy-seven', asrAliases: ['seventy seven', '77'] },
  // 8-10: the hundred boundary and the three-word forms, up to the objective's
  // ceiling. "One hundred" answered as "hundred" is the completeness stress.
  { id: 'count-99', kind: 'counting', display: '99 →', problem: 'the number after ninety-nine', spoken: 'one hundred', reference: 'one hundred', asrAliases: ['one hundred', '100', 'a hundred'] },
  { id: 'count-106', kind: 'counting', display: '106 →', problem: 'the number after one hundred six', spoken: 'one hundred seven', reference: 'one hundred seven', asrAliases: ['one hundred seven', '107', 'a hundred seven', 'one hundred and seven'] },
  { id: 'count-119', kind: 'counting', display: '119 →', problem: 'the number after one hundred nineteen', spoken: 'one hundred twenty', reference: 'one hundred twenty', asrAliases: ['one hundred twenty', '120', 'a hundred twenty', 'one hundred and twenty'] },
];

/**
 * di-sentence-reading bench probe (BACKLOG item 2 — the 4th-pack candidate).
 * CONNECTED TEXT is the biggest response-class jump the family has made: every
 * benched class so far is a SHORT production judged whole (one held sound, one
 * word, one number word), where "did they say the target" is close to binary.
 * A sentence is not. The sitting exists to answer three things BEFORE any
 * primitive wiring:
 *
 *  (a) **Can Live detect a ONE-WORD error inside a 5-8 word utterance?** This is
 *      the make-or-break. A judge that affirms "The big pig had a red hut on"
 *      is not measuring reading accuracy, it is rubber-stamping. Items 7 and 10
 *      carry near-neighbour words (hen/pen, hat/hut, had/has) precisely so a
 *      plausible misread is available; item 9 repeats a phrase so a SKIPPED
 *      word is easy to produce. Drive those deliberately wrong.
 *  (b) **Does the whole-sentence correction hold?** Real DISTAR reading
 *      correction targets the MISSED WORD ("My turn: that word is mat. Now go
 *      back and read the whole sentence"), but naming the missed word means the
 *      tutor must fill a variable the script cannot know — a direct threat to
 *      "speak exactly" and the sentinel discipline the engine depends on. The
 *      probe therefore scripts the SAFE whole-sentence re-model; whether that
 *      is pedagogically good enough, or whether the pack needs word-targeted
 *      correction (and the off-script risk that carries), is a sitting call.
 *  (c) **Does the restating affirm drag?** "Yes, that says <whole sentence>"
 *      mirrors the fact/word precedent (the affirm restates the correct
 *      production), but tutor talk-time already dominates the per-item cycle
 *      (bench run-2 timing ruling) and a sentence doubles it. If it drags, the
 *      pack ships a short affirm — but then the long form was never benched, so
 *      the probe tests the maximal form on purpose.
 *
 * Length ladder 3 → 8 words, so the sitting also shows WHERE reliability breaks
 * by length — that ceiling is the pack's max sentence length. Vocabulary is
 * carried from the word-reading probe (sam, mat, pig, dog, sun, red, cup, the,
 * see, go) so a failure is attributable to connected text, not new words.
 * Nothing here ships hardcoded into a primitive.
 */
export const SENTENCE_READING_PROBE_ITEMS: DIItem[] = [
  { id: 'sent-cat-sat', kind: 'sentence', display: 'The cat sat.', spoken: 'the cat sat', reference: 'The cat sat.', asrAliases: ['the cat sat'] },
  { id: 'sent-see-pig', kind: 'sentence', display: 'I see a pig.', spoken: 'i see a pig', reference: 'I see a pig.', asrAliases: ['i see a pig', 'i sea a pig'] },
  { id: 'sent-red-cup', kind: 'sentence', display: 'Sam has a red cup.', spoken: 'sam has a red cup', reference: 'Sam has a red cup.', asrAliases: ['sam has a red cup'] },
  { id: 'sent-sat-mat', kind: 'sentence', display: 'Sam sat on the mat.', spoken: 'sam sat on the mat', reference: 'Sam sat on the mat.', asrAliases: ['sam sat on the mat', 'sam sat on the matt'] },
  { id: 'sent-dog-sun', kind: 'sentence', display: 'The dog is in the sun.', spoken: 'the dog is in the sun', reference: 'The dog is in the sun.', asrAliases: ['the dog is in the sun', 'the dog is in the son'] },
  { id: 'sent-big-pig', kind: 'sentence', display: 'I can see the big pig.', spoken: 'i can see the big pig', reference: 'I can see the big pig.', asrAliases: ['i can see the big pig'] },
  // One-word-error stress: hen/pen and ran/run are a misread away from each other.
  { id: 'sent-hen-pen', kind: 'sentence', display: 'The red hen ran to the pen.', spoken: 'the red hen ran to the pen', reference: 'The red hen ran to the pen.', asrAliases: ['the red hen ran to the pen'] },
  { id: 'sent-get-ball', kind: 'sentence', display: 'Can the dog get the ball?', spoken: 'can the dog get the ball', reference: 'Can the dog get the ball?', asrAliases: ['can the dog get the ball'] },
  // Repeated phrase: skipping one "we go" is the easiest omission to produce.
  { id: 'sent-up-down', kind: 'sentence', display: 'We go up and we go down.', spoken: 'we go up and we go down', reference: 'We go up and we go down.', asrAliases: ['we go up and we go down'] },
  // Longest (8) + hat/hut, had/has near-misses.
  { id: 'sent-red-hat', kind: 'sentence', display: 'The big pig had a red hat on.', spoken: 'the big pig had a red hat on', reference: 'The big pig had a red hat on.', asrAliases: ['the big pig had a red hat on'] },
];

/** Selectable bench probe sets. The bench swaps its live item list between
 *  these; each new DI response class benches here before a primitive wires it. */
export interface BenchSet {
  id: string;
  label: string;
  items: DIItem[];
}

export const BENCH_SETS: BenchSet[] = [
  { id: 'letter-sounds', label: 'Letter sounds', items: DEFAULT_ITEMS },
  { id: 'word-reading', label: 'Word reading', items: WORD_READING_PROBE_ITEMS },
  { id: 'math-facts', label: 'Math facts', items: MATH_FACTS_PROBE_ITEMS },
  { id: 'counting-120', label: 'Counting to 120', items: COUNTING_SEQUENCE_PROBE_ITEMS },
  { id: 'sentence-reading', label: 'Sentence reading', items: SENTENCE_READING_PROBE_ITEMS },
];

const sentenceCase = (value: string | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

/**
 * The two kinds whose answer is a spoken NUMBER. They share every cue line
 * byte-for-byte — the #46-benched wording is `problem`-phrased and already
 * reads correctly for counting ("the number after twenty-nine is thirty"), so
 * the probe tests the numeral class rather than new sentences. Only the
 * JUDGING bar forks (see `judgingCriteria`).
 */
const isNumberAnswer = (it: DIItem) => it.kind === 'fact' || it.kind === 'counting';

/** 'fact' / 'counting' only: spoken form of the printed problem. */
const factProblem = (it: DIItem) => it.problem ?? it.display;

/** 'sentence' only: the printed text as it should be READ, sentence-cased. */
const sentenceText = (it: DIItem) => it.display.replace(/\s+$/, '');

export const modelLine = (it: DIItem) =>
  isNumberAnswer(it)
    ? `Listen: ${factProblem(it)} is ${it.spoken}.`
    : it.kind === 'sentence'
      // No "as in"/restatement scaffold — the model IS the fluent reading.
      ? `Listen: ${sentenceText(it)}`
      : it.elicitation === 'keyword'
        ? `The first sound in ${it.keyword} is short ${it.display}. Listen: ${it.keyword}.`
        : it.kind === 'sound'
          // Single model repetition: run-2 timing showed tutor talk-time dominates
          // the per-item cycle (~10s of ~13s); pacing is the product at this age.
          ? `This sound is ${it.spoken}, as in ${it.keyword}. Listen: ${it.spoken}.`
          : `This word is ${it.spoken}. Listen: ${it.spoken}.`;

export const guideLine = (it: DIItem) =>
  isNumberAnswer(it)
    ? `Together: ${factProblem(it)} is ${it.spoken}.`
    : it.kind === 'sentence'
      // Choral reading — the DISTAR guided step for connected text.
      ? `Together: ${sentenceText(it)}`
      : it.elicitation === 'keyword'
        ? `Together, say ${it.keyword}: ${it.keyword}.`
        : it.kind === 'sound'
          ? `Together: ${it.spoken}, as in ${it.keyword}.`
          : `Together: ${it.spoken}.`;

export const testLine = (it: DIItem) =>
  isNumberAnswer(it)
    ? `Your turn. What is ${factProblem(it)}?`
    : it.kind === 'sentence'
      ? 'Your turn. Read it.'
      : it.elicitation === 'keyword'
        ? `Your turn. Say ${it.keyword}.`
        : it.kind === 'sound'
          ? 'Your turn. What sound?'
          : 'Your turn. What word?';

/** Affirmation branch. MUST begin with "Yes" — the bench parses that sentinel. */
export const verifyLine = (it: DIItem) =>
  isNumberAnswer(it)
    ? `Yes, ${factProblem(it)} is ${it.spoken}.`
    : it.kind === 'sentence'
      // Restates the correct production, like every other kind. Probe question
      // (c): a whole sentence doubles tutor talk-time — does it drag?
      ? `Yes, that says ${sentenceText(it)}`
      : it.elicitation === 'keyword'
        ? `Yes. ${sentenceCase(it.keyword)} starts with short ${it.display}.`
        : `Yes, ${it.spoken}.`;

/** Correction branch. MUST begin with "My turn" — the bench parses that sentinel. */
export const correctionLine = (it: DIItem) =>
  isNumberAnswer(it)
    ? `My turn: ${factProblem(it)} is ${it.spoken}. Your turn. What is ${factProblem(it)}?`
    : it.kind === 'sentence'
      // Whole-sentence re-model. Word-targeted correction ("that word is mat")
      // is the DISTAR ideal but needs the tutor to fill a variable the script
      // cannot know — off-script risk. Probe question (b) decides.
      ? `My turn: ${sentenceText(it)} Your turn. Read it again.`
      : it.elicitation === 'keyword'
        ? `My turn: ${it.keyword}. Your turn. Say ${it.keyword}.`
        : it.kind === 'sound'
          ? `My turn: ${it.spoken}, as in ${it.keyword}. Your turn. What sound?`
          : `My turn: ${it.spoken}. Your turn. What word?`;

const targetDescription = (it: DIItem) =>
  it.kind === 'counting'
    ? `the spoken number "${it.spoken}", said in full, answering ${factProblem(it)}`
    : it.kind === 'fact'
      ? `the spoken number word "${it.spoken}" answering ${factProblem(it)}`
        : it.kind === 'sentence'
          ? `the printed sentence "${sentenceText(it)}" read aloud, every word in order`
          : it.elicitation === 'keyword'
            ? `the word "${it.keyword}"`
            : it.kind === 'sound'
              ? `the continuous sound ${it.spoken}`
              : `the word "${it.spoken}"`;

/**
 * The judging criteria, per response class. The generic "reasonably close for a
 * kindergartener" is right for a single short production but WRONG for
 * connected text — "close" would rubber-stamp a read that dropped or swapped a
 * word, which is precisely the error reading fluency exists to catch. The
 * sentence branch therefore names accuracy word-by-word, allows the
 * self-correction that real fluency practice depends on, and explicitly refuses
 * to penalise slowness (pace is a later eval mode, never the L0 judgment).
 *
 * `counting` forks for the same reason one rung up: past twenty the plausible
 * near-miss is not a different-sounding number but the item's own teen/decade
 * sibling, and "reasonably close" would wave through exactly the error the
 * sitting exists to detect. It also names COMPLETENESS, because a compound
 * numeral is one answer that arrives in pieces. Permissiveness that survives
 * both forks: young-child pronunciation and counting up to the answer, matching
 * the pack's shipped contract (`diMathFactsScript.judgingContract`) so the
 * bench measures the conditions the primitive would actually run under.
 */
const judgingCriteria = (it: DIItem) => it.kind === 'sentence'
  ? `- Every word read correctly and in order — including after the learner catches and fixes their own slip — say exactly "${verifyLine(it)}" and stop.
- ANY word skipped, added, or read as a different word and left uncorrected: say exactly "${correctionLine(it)}" and stop, then wait again.
Slow, effortful sounding-out that lands on the right words is CORRECT — judge accuracy, never speed. Do not accept a near-miss word to be kind: a different word is a different word.`
  : it.kind === 'counting'
    ? `- The learner said the whole number ${it.spoken} — right away, with young-child pronunciation, or after counting up to it: say exactly "${verifyLine(it)}" and stop.
- A DIFFERENT number, or only part of this one: say exactly "${correctionLine(it)}" and stop, then wait again.
A teen and its decade are DIFFERENT numbers, never near-misses: thirteen is not thirty, fourteen is not forty, sixteen is not sixty. They sound alike on purpose — that is the error being practiced out, so listen for the ending and correct the one you actually heard.
A number said as several words is ONE answer and must arrive whole: "twenty" is not "one hundred twenty", and "hundred seven" is not "one hundred seven". If the learner stops partway, that is the correction branch.
Judge the number you heard, never the number you expected. Slow is fine; incomplete is not.`
    : `- Correct or reasonably close for a kindergartener: say exactly "${verifyLine(it)}" and stop.
- Wrong, missing, or a different sound: say exactly "${correctionLine(it)}" and stop, then wait again.`;

/**
 * The in-band judging contract for one item. The Live tutor hears the raw
 * audio and judges each attempt itself; the bench reads which branch it took
 * from the output transcript and alone decides progression.
 */
export const judgingContract = (it: DIItem) => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against ${targetDescription(it)}:
${judgingCriteria(it)}
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/** Present one item: model, guide, test, then judge in-band until told otherwise. */
export const itemCue = (it: DIItem, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk kindergarten practice. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${modelLine(it)} ${guideLine(it)} ${testLine(it)}"
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward. */
export const moveOnCue = (it: DIItem, next?: DIItem) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${modelLine(next)} ${guideLine(next)} ${testLine(next)}"
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. That's the end of our practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our practice. Great work today!"`;

export const DI_TUTORING: TutoringScaffold = {
  taskDescription:
    'Live-judged Direct Instruction bench for a kindergarten learner. You speak the exact ' +
    'scripted lines from each bracketed application message and judge each learner attempt ' +
    'from the audio you heard, using only the two allowed reply branches.',
  scaffoldingLevels: {
    level1: 'Repeat the prompt once, slowly.',
    level2: 'Model the requested sound or word, then ask for one retry.',
    level3: 'Accept the attempt warmly and continue as instructed.',
  },
  aiDirectives: [
    {
      title: 'LIVE-JUDGED DIRECT INSTRUCTION',
      instruction:
        'Messages tagged [DI_ITEM], [DI_MOVE_ON], or [DI_COMPLETE] contain the only lesson ' +
        'words you may speak. The square-bracket label is private metadata: never speak, ' +
        'reproduce, or invent it. Each [DI_ITEM] message includes a two-branch judging rule: ' +
        'affirmations must begin with "Yes" and corrections must begin with "My turn", using ' +
        'the exact quoted lines. Never begin any other sentence with those words. Judge ' +
        'honestly from the audio: affirm a reasonable kindergarten production of the target; ' +
        'correct a wrong, missing, or different production. Do not praise to be kind. The ' +
        'application decides which item comes next; never introduce one yourself.',
    },
    {
      title: 'SOUND PRONUNCIATION',
      instruction:
        'A stretched letter sequence like "mmm", "sss", or "aaa" is a continuous ' +
        'letter sound held for about two seconds. Never say a letter name and never spell it out.',
    },
    {
      // Scoped to MULTI-WORD numbers on purpose. The `Math facts` set benched
      // 2026-07-24 (#46) answers one..ten, where no teen/decade pair and no
      // compound form exists — so this clause cannot change the conditions that
      // sitting validated, while giving the counting probe the session-level
      // rule the pack's own catalog entry already carries.
      title: 'MULTI-WORD NUMBERS',
      instruction:
        'Say every number as words, never as digits — read "29 →" aloud as "the number after ' +
        'twenty-nine". Past twenty an answer may take several words: "fifty-one", "one hundred ' +
        'seven". That is still ONE answer and it only counts when the whole number arrives — ' +
        '"hundred seven" and a trailing-off "one hundred" are incomplete, not close. A teen and ' +
        'its decade are different numbers however alike they sound: thirteen is not thirty, ' +
        'fourteen is not forty, seventeen is not seventy. Affirming one for the other is a wrong ' +
        'answer waved through, so judge the number you actually heard.',
    },
    {
      title: 'CONNECTED TEXT',
      instruction:
        'When the item is a printed SENTENCE, read it aloud at an unhurried but natural pace — ' +
        'this is the fluent model the learner copies, so never spell it, never sound it out ' +
        'word-by-word, and never explain it. Judge the learner on ACCURACY: every word, in ' +
        'order. A learner who reads slowly, or who stumbles and then fixes it themselves, read ' +
        'it correctly. A learner who swaps, skips, or adds a word did not — say so, however ' +
        'small the word.',
    },
    {
      title: 'BREVITY',
      instruction:
        'Speak only the exact quoted lesson text. Never narrate judging, scoring, or ' +
        'application state. Keep pacing brisk: no filler, no chit-chat.',
    },
  ],
};

const tokenize = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

export interface Fidelity {
  coverage: number;
  extras: number;
}

export function scoreFidelity(scripted: string, transcript: string): Fidelity {
  const want = tokenize(scripted);
  const got = tokenize(transcript);
  if (want.length === 0) return { coverage: 1, extras: got.length };

  const dp = Array.from({ length: want.length + 1 }, () =>
    new Array<number>(got.length + 1).fill(0));
  for (let i = 1; i <= want.length; i++) {
    for (let j = 1; j <= got.length; j++) {
      dp[i][j] = want[i - 1] === got[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const orderedMatches = dp[want.length][got.length];
  return {
    coverage: orderedMatches / want.length,
    extras: Math.max(0, got.length - orderedMatches),
  };
}
