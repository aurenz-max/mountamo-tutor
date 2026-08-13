/**
 * diSpokenPracticeScript — the CONTENT-GENERIC member of the DI family.
 *
 * WHY THIS EXISTS (user thread 2026-08-11). Every judged-loop consumer so far
 * is a bespoke component: 5 DI packs (694-910 lines each) + 4 literacy ports +
 * 2 runner pilots. Measured against what they actually render, most of that is
 * not a manipulative — after the verbal ruling stripped the costumes,
 * `WordFlip.tsx` (661 lines) and `SoundSwap.tsx` (767 lines) each expose ONE
 * interactive element, a tap-to-hear. They are a stimulus, an ask, and a
 * judged spoken answer: "what is 1 + 2?" / "three!" / "yes".
 *
 * So the fork this pack draws is: DOES THE MANIPULATIVE CARRY PEDAGOGY?
 *   - YES  → a bespoke component, runner plugged in. Touching each bear once
 *            IS one-to-one correspondence (counting-board); Elkonin boxes ARE
 *            encoding (cvc-speller); the sim IS the truth (push-pull-arena).
 *   - NO   → THIS pack. One component, one generator, N skills.
 *
 * WHAT IS CODE AND WHAT IS GENERATED — the line that makes this safe.
 * The family's standing finding is that a cue TEMPLATE ships the answer inside
 * the ask (three ports produced three cue shapes). That finding is about
 * hard-coded SENTENCES, not about structure. Here:
 *   - The DISTAR SKELETON is code: wait-silently, the two verdict branches,
 *     the sentinel openers ("Yes, …" / "My turn: …"), re-model-then-re-elicit,
 *     the bracket-tag discipline. Gemini cannot break a sentinel because it
 *     never writes one.
 *   - Every SENTENCE inside that skeleton is a slot: the ask, the how-to-play,
 *     the correction body, and — the interesting ones — `acceptRule` and
 *     `signatureError`.
 *
 * `acceptRule` / `signatureError` ARE THE EXPERIMENT. They encode what every
 * port had to discover by driving it live: a right answer that does not look
 * right (counting aloud that lands on the target IS the answer; sounding out
 * then saying the word IS the answer), and a wrong answer that sounds right
 * (the starting word said back; the bare singular). Whether flash-lite can
 * write those two clauses per skill is the open question this pack is built to
 * answer — the tester is where you read them before a child ever hears them.
 *
 * WHAT THIS PACK CAN GATE THAT NO BESPOKE PACK CAN. `expectedAnswer` is a
 * FIELD here, so the answer-leak rule stops being a thing a human notices in a
 * live run and becomes `findAnswerLeaks()` — mechanical, and run in the
 * generator before items ship. Every port so far found its leak the expensive
 * way: phonics-blender's printed target word, word-flip's chips, cvc-speller's
 * two vowel buttons, push-pull-arena's labeled Push/Pull.
 *
 * STANDING GATE 1 IS ENFORCED AT THE GENERATION BOUNDARY. `deriveResponseClass`
 * returns null for anything it cannot honestly place in the benched registry —
 * a 4-word answer is open-set production, which is a BLOCKED class, and the
 * generator drops the item rather than laundering it through a free-text field.
 */

import type {
  JudgedCueOptions,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';

// ── Modes ────────────────────────────────────────────────────────────────────

/**
 * L1 task identities. These are genuinely different acts, not difficulty
 * tiers: produce an answer you were not shown / say aloud the thing you were
 * shown / enumerate a set. `answerSource` and `stimulusKind` are stamped from
 * the mode in code (Fork A — Gemini never emits a challenge type).
 */
export type SpokenPracticeMode = 'say_answer' | 'read_aloud' | 'count_and_say';

/** How the stimulus APPEARS. `none` still carries stimulusText — the tutor
 *  says it ("Listen: cat…"), nothing is printed. */
export type StimulusKind = 'text' | 'emoji' | 'objects' | 'none';

/**
 * Where the answer comes from — and therefore whether the printed stimulus is
 * a leak or the task. `decode` is di-word-reading's shape: the word on screen
 * IS the answer and reading it aloud is the skill. `recall` is everything
 * else, and there the stimulus may never contain the answer.
 */
export type AnswerSource = 'recall' | 'decode';

export const MODE_SHAPE: Record<
  SpokenPracticeMode,
  { stimulusKind: StimulusKind; answerSource: AnswerSource; label: string }
> = {
  say_answer: { stimulusKind: 'text', answerSource: 'recall', label: 'Say the Answer' },
  read_aloud: { stimulusKind: 'text', answerSource: 'decode', label: 'Read It Aloud' },
  count_and_say: { stimulusKind: 'objects', answerSource: 'recall', label: 'Count and Say' },
};

/**
 * How-to-play is CODE-OWNED, one line per mode — the model does not write it.
 *
 * Live-run finding 2026-08-11: asked for a how-to-play per item, flash-lite
 * produced "Look at the math fact, then say the answer out loud!" — filler,
 * because in a voice-only pack there is nothing to explain. Every item is
 * answered out loud; saying so before each one is noise a child sits through.
 *
 * The contrast that makes this a rule rather than a taste: counting-board's
 * how-to-play is "Touch each bear one time as you count" — a PROCEDURE, and it
 * exists because that pack has a manipulative. This pack has none, so "what to
 * do" is a property of the MODE and nothing else. Three lines cover it.
 */
export const HOW_TO_PLAY: Record<SpokenPracticeMode, string> = {
  say_answer: 'I will ask, and you say the answer out loud.',
  read_aloud: 'I will show you a word, and you read it out loud.',
  count_and_say: 'Count the pictures, then say how many out loud.',
};

// ── The item ─────────────────────────────────────────────────────────────────

export interface SpokenPracticeItem extends JudgedScriptItem {
  mode: SpokenPracticeMode;
  stimulusKind: StimulusKind;
  answerSource: AnswerSource;
  /** The stimulus content. Printed when `stimulusKind` is 'text'; spoken by
   *  tap-to-hear on recall items; the object word in 'objects' mode. */
  stimulusText: string;
  /** One emoji for 'emoji' / 'objects' modes; '' otherwise. */
  stimulusEmoji: string;
  /** 'objects' mode: how many to draw. Code NEVER prints the numeral. */
  stimulusCount: number;
  /** The tutor's scripted question, ending in the hand-over. Generated. */
  ask: string;
  /** Spoken on the opener and whenever the ACTION changes. CODE-OWNED from
   *  `HOW_TO_PLAY` — see that constant for why the model does not write it. */
  howToPlay: string;
  expectedAnswer: string;
  alternates: string[];
  /** A RIGHT answer that does not look right, in this skill's own terms.
   *  '' when the skill has none. Generated. */
  acceptRule: string;
  /** A WRONG answer that sounds right. '' when the skill has none. Generated. */
  signatureError: string;
  /** The re-model, WITHOUT the "My turn:" opener and WITHOUT the re-ask —
   *  code owns both, so a generated line cannot break sentinel discipline
   *  or end a correction on the answer. Generated. */
  correctionBody: string;
}

// ── Response classes — standing gate 1 at the generation boundary ────────────

const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];

/** 1..20 as words. ZERO is excluded — "zero"/"none" spoken is an unbenched
 *  answer (di-shapes rung 2 residual), so counting items floor at 1. */
export const numberWordFor = (n: number): string => NUMBER_WORDS[n - 1] ?? String(n);

export const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

const isNumberWord = (text: string): boolean =>
  NUMBER_WORDS.includes(text.trim().toLowerCase());

/**
 * A bare numeral is a WRITTEN form; the child SAYS a number word. Normalising
 * it in code is the same rule as computing the counting answer from the count —
 * and it is load-bearing twice over: the verdict line is read aloud, and
 * `deriveResponseClass` cannot recognise the benched number-word class through
 * a digit, so an un-normalised "2" would ship declaring `short_spoken_word`.
 *
 * Found on the first real generation (2026-08-11): flash-lite returned
 * `expectedAnswer: "2"` with `alternates: ["two"]` — the two forms inverted.
 */
export const normalizeSpokenAnswer = (answer: string): string => {
  const trimmed = answer.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const n = Number.parseInt(trimmed, 10);
  return n >= 1 && n <= 20 ? numberWordFor(n) : trimmed;
};

const isBareNumeral = (text: string): boolean => /^\d+$/.test(text.trim());

/**
 * The benched class this item's answer belongs to, or NULL when it cannot be
 * placed honestly — which is a refusal, not a fallback.
 *
 * The refusal that matters: a long free-text answer is open-set production,
 * and `open_set_word` is BLOCKED for want of a bench. A generic primitive with
 * a free-text answer field is exactly the shape that would launder that class
 * into production, so the clamp lives here rather than in a reviewer's head.
 */
export const deriveResponseClass = (
  mode: SpokenPracticeMode,
  expectedAnswer: string,
  stimulusText: string,
): ResponseClassId | null => {
  const answer = expectedAnswer.trim();
  if (!answer) return null;
  // A numeral that survived normalisation is outside 1-20, i.e. a multi-word
  // numeral — the build-ahead class (#63) this pack does not gate on.
  if (isBareNumeral(answer)) return null;

  if (mode === 'count_and_say') {
    return isNumberWord(answer) ? 'number_word_to_20' : null;
  }
  if (mode === 'read_aloud') {
    // The printed stimulus is the utterance; its length picks the class.
    return wordCount(stimulusText) >= 3 ? 'sentence_read_aloud' : 'short_spoken_word';
  }
  // say_answer
  if (isNumberWord(answer)) return 'number_word_to_20';
  return wordCount(answer) <= 3 ? 'short_spoken_word' : null;
};

// ── Answer-leak detection — the gate a bespoke pack cannot run ───────────────

const tokenize = (value: string): string[] =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** Whole-token subsequence match, so "cat" hits "the cat sat" and not "catalog". */
const containsPhrase = (haystack: string, needle: string): boolean => {
  const hay = tokenize(haystack);
  const need = tokenize(needle);
  if (need.length === 0 || need.length > hay.length) return false;
  for (let i = 0; i + need.length <= hay.length; i++) {
    if (need.every((word, j) => hay[i + j] === word)) return true;
  }
  return false;
};

export interface AnswerLeak {
  itemId: string;
  /** Which surface leaked — the field name a fix must target. */
  field: 'ask' | 'howToPlay' | 'stimulusText';
  answer: string;
}

/**
 * Every place the child could read or hear the answer before producing it.
 *
 * Scoping note that IS the pedagogy: on a `decode` item the stimulus is the
 * answer by design ("read this word"), so the stimulus is exempt — but the ASK
 * never is, in either mode. This is the one distinction that separates a leak
 * from the task, and it is why `answerSource` is a field rather than a
 * per-primitive convention.
 */
export function findAnswerLeaks(items: readonly SpokenPracticeItem[]): AnswerLeak[] {
  const leaks: AnswerLeak[] = [];
  for (const item of items) {
    const answers = [item.expectedAnswer, ...item.alternates].filter((a) => a.trim());
    const surfaces: Array<{ field: AnswerLeak['field']; text: string }> = [
      { field: 'ask', text: item.ask },
      { field: 'howToPlay', text: item.howToPlay },
    ];
    if (item.answerSource === 'recall' && item.stimulusKind === 'text') {
      surfaces.push({ field: 'stimulusText', text: item.stimulusText });
    }
    for (const { field, text } of surfaces) {
      for (const answer of answers) {
        if (containsPhrase(text, answer)) {
          leaks.push({ itemId: item.id, field, answer });
          break;
        }
      }
    }
  }
  return leaks;
}

/** 'objects' mode prints pictures, never a numeral — a digit in the stimulus
 *  word would hand over the count. */
export function findPrintedNumerals(items: readonly SpokenPracticeItem[]): string[] {
  return items
    .filter((item) => item.stimulusKind === 'objects' && /\d/.test(item.stimulusText))
    .map((item) => item.id);
}

// ── Arithmetic-consistency gate — the fact on screen is the ground truth ─────

/** A printed two-operand fact: "3 + 2", "7 − 4", "2 x 3", optionally "= ?". */
const ARITHMETIC_FACT = /^\s*(\d+)\s*([+x×*\-−–])\s*(\d+)\s*(?:=\s*\??)?\s*$/;

export interface ArithmeticMismatch {
  itemId: string;
  /** What the printed fact actually equals, as the spoken word. */
  computed: string;
  /** What the item claimed the child should say. */
  claimed: string;
}

/**
 * say_answer items whose printed fact disagrees with their own answer.
 *
 * Opened by the seed pool (run 592abf43424c): once the TARGET number is
 * pooled, the model back-solves operands to fit it — which is the point — but
 * a bad back-solve ships "3 + 2 → six". The stimulus is what the child sees
 * and what the ask says aloud, so the FACT is the ground truth. A mismatched
 * item is DROPPED, never patched: the generated correctionBody states the
 * claimed answer, so overwriting `expectedAnswer` would leave the re-teach
 * asserting the very number this gate just refuted.
 */
export function findArithmeticMismatches(
  items: readonly SpokenPracticeItem[],
): ArithmeticMismatch[] {
  const results: ArithmeticMismatch[] = [];
  for (const item of items) {
    if (item.mode !== 'say_answer') continue;
    const match = ARITHMETIC_FACT.exec(item.stimulusText);
    if (!match) continue;
    const a = Number.parseInt(match[1], 10);
    const b = Number.parseInt(match[3], 10);
    const op = match[2];
    const value = op === '+' ? a + b : /[x×*]/.test(op) ? a * b : a - b;
    // numberWordFor falls back to the numeral outside 1-20 (incl. "0" for a
    // zero result) — never equal to a benched word, so those items drop too.
    const computed = numberWordFor(value);
    if (computed.toLowerCase() !== item.expectedAnswer.trim().toLowerCase()) {
      results.push({ itemId: item.id, computed, claimed: item.expectedAnswer });
    }
  }
  return results;
}

// ── Unspoken-stimulus detection — the ask must SAY the problem ───────────────

/** Operator glyphs survive tokenisation as letters ("2 x 3" → "x"); the ask may
 *  phrase the operation any way it likes ("groups of", "times"), so operator
 *  tokens are never required of it. */
const OPERATOR_TOKENS = new Set(['x']);

export interface UnspokenStimulus {
  itemId: string;
  /** The stimulus tokens the ask never says — what a regeneration must add. */
  missing: string[];
}

/**
 * The counterpart gate to `findAnswerLeaks`, found live (run 436dcb5616cb,
 * 2026-08-11): the tutor asked "Here is a groups problem. What is the answer?"
 * — a question with no problem in it — because nothing required the generated
 * ask to contain the stimulus. In a voice-first pack the ask is the child's
 * EAR-side access to the problem; the printed stimulus is reinforcement, not
 * the carrier. DISTAR asks state the item ("Two plus one. What is two plus
 * one?"), so an ask that never says its own stimulus is a defective item.
 *
 * Scope is deliberately narrow — `say_answer` with a 'text' or 'none'
 * stimulus. The other shapes must NOT state theirs: read_aloud's stimulus is
 * the answer (leak gate bans it from the ask), count_and_say's count is the
 * answer, and an 'emoji'/'objects' stimulus word spoken aloud would name the
 * picture the child is being asked about.
 *
 * Digits match their number word in either direction ("2" is satisfied by
 * "two" and vice versa) — the ask is spoken, so both forms reach the child
 * identically.
 */
export function findUnspokenStimulus(items: readonly SpokenPracticeItem[]): UnspokenStimulus[] {
  const results: UnspokenStimulus[] = [];
  for (const item of items) {
    if (item.mode !== 'say_answer') continue;
    if (item.stimulusKind !== 'text' && item.stimulusKind !== 'none') continue;
    const askTokens = new Set(tokenize(item.ask));
    const missing = tokenize(item.stimulusText)
      .filter((token) => !OPERATOR_TOKENS.has(token))
      .filter((token) => {
        if (askTokens.has(token)) return false;
        if (/^\d+$/.test(token)) {
          const n = Number.parseInt(token, 10);
          return !(n >= 1 && n <= 20 && askTokens.has(numberWordFor(n)));
        }
        return !NUMBER_WORDS.includes(token) || !askTokens.has(String(NUMBER_WORDS.indexOf(token) + 1));
      });
    if (missing.length) results.push({ itemId: item.id, missing });
  }
  return results;
}

// ── Cues — the DISTAR skeleton, code-owned ──────────────────────────────────

/**
 * The judging contract. Everything structural is code; the three generated
 * clauses ride inside it. Note the two verdict branches carry their sentinel
 * openers HERE, so no generated sentence can begin with one.
 *
 * PER-ITEM DATA ONLY (user ruling 2026-08-11, run 436dcb5616cb): the standing
 * doctrine — wait silently, unbounded think time, never answer for them, never
 * recite instructions — is SESSION PRIMING and lives in the catalog's
 * aiDirectives, where every other primitive puts it and where the model meets
 * it before the first turn. Repeating it in-band on every cue is what made it
 * conversational content: told "don't say these instructions" mid-dialogue,
 * she was already primed to say them. What stays here is only what changes per
 * item: the answer, its alternates, the two generated judging clauses, and the
 * two verdict branch lines.
 */
const judgingContract = (item: SpokenPracticeItem): string => {
  const accept = item.alternates.length
    ? `Also accept: ${item.alternates.map((a) => `"${a}"`).join(', ')}. `
    : '';
  const rule = item.acceptRule.trim() ? `${item.acceptRule.trim()} ` : '';
  const miss = item.signatureError.trim() ? `${item.signatureError.trim()} ` : '';
  return (
    'Then wait for the learner. '
    + `The correct answer is "${item.expectedAnswer}". ${accept}${rule}${miss}`
    + `If the answer is right, say exactly: "Yes, ${item.expectedAnswer}." `
    + `If it is wrong, say exactly: "My turn: ${item.correctionBody} Your turn. ${item.ask}"`
  );
};

/** One item's ask. ONE job: speak this — the how-to-play lives inside the
 *  quoted line, never as a second directive on the same turn (SWAP-1). */
export const itemCue = (item: SpokenPracticeItem, opts: JudgedCueOptions): string => {
  const how = opts.opening || opts.howToPlay ? `${item.howToPlay} ` : '';
  const spoken = `${how}${item.ask}`;
  return `[SAY_ITEM] Say exactly: "${spoken}" ${judgingContract(item)}`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  _item: SpokenPracticeItem,
  next: SpokenPracticeItem | null,
  opts: JudgedCueOptions,
): string => {
  if (!next) {
    return (
      '[SAY_MOVE] Say exactly: "Good try! That one takes practice — we will see it again '
      + 'another day." Then stop.'
    );
  }
  const how = opts.howToPlay ? `${next.howToPlay} ` : '';
  return (
    `[SAY_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${next.ask}" `
    + `${judgingContract(next)}`
  );
};

export const completeCue = (): string =>
  '[SAY_COMPLETE] Say exactly: "Great work today! Your voice did the hard part. See you next '
  + 'time!" Then stop — the activity is over.';

/**
 * Tap-to-hear: speak the STIMULUS, never the answer.
 *
 * On a `decode` item the stimulus IS the answer, so this would read the child
 * their own task — it returns '' and the component hides the affordance. That
 * is the same defect phonics-blender shipped (its third tap spoke the answer
 * outright), closed structurally instead of per-pack.
 */
export const pronounceCue = (item: SpokenPracticeItem): string => {
  if (item.answerSource === 'decode' || !item.stimulusText.trim()) return '';
  return `[SAY_HEAR] Say exactly: "${item.stimulusText.trim()}" Then stop — say nothing else.`;
};

/**
 * THE FULL RUNTIME-STATE CHANNEL, RESTORED — user ruling 2026-08-11.
 *
 * An earlier revision shipped this empty after a live run (`5813884d14d3`)
 * where the tutor read the `[CURRENT STATE]` block aloud, on the theory that a
 * channel with no consumer only had a failure mode. The user overruled it:
 * every other Lumina primitive sends state and instructions through this
 * channel with no recitation, and a GENERALIZED pack does not get to amputate
 * the platform's channels to feel safe. The next run (`436dcb5616cb`) proved
 * the real roots were elsewhere anyway — the tutor recited a catalog
 * commonStruggles "response" verbatim ("Wait. Think time is unbounded here;
 * only re-ask if the application tells you to."), i.e. directive-voice text
 * authored into a field whose contract is WORDS THE TUTOR SPEAKS. She was
 * primed at session start to say those instructions; no cue trailer can undo
 * that. The fix is voice discipline in the catalog block, not a dead channel.
 *
 * What rides here follows the family rule di-math-facts wrote down: STIMULUS
 * SIDE ONLY, never the answer — runtime state is echoed far more loosely than
 * a scripted line. `decode` items push no stimulus at all (there the stimulus
 * IS the answer), and counting items push the object word, never the count.
 * Keys must stay in lockstep with `contextKeys` on the catalog entry.
 */
export const contextFor = (item: SpokenPracticeItem): Record<string, string> => {
  const state: Record<string, string> = { challengeType: item.mode };
  if (item.answerSource !== 'decode') {
    state.stimulus = item.stimulusText;
  }
  return state;
};
