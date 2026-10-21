/**
 * addition-subtraction-scene's domain: the items one lesson asks (the build gates that drop an unaskable challenge),
 * the ask, the code judge of a number sentence (`equationFaultOf`) and the harness answers. Pure and React-free: the
 * boss, the component, the levers and the probes read it. The answer-material fork and the gates are argued in
 * `additionSubtractionSceneScript.ts`, which keeps the retired scripted cues and re-exports this module.
 */
import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import { countWalk, numberWordFor } from './countingBoardDomain';

export type AddSubItemKind = 'act-out' | 'build-equation' | 'solve-story' | 'create-story';
export type AddSubBand = 'K' | '1';
export type AddSubOperation = 'addition' | 'subtraction';
export type AddSubUnknown = 'result' | 'change' | 'start';

/** The benched spoken-number window. Zero is excluded by the class record
 *  itself; 20 is the ceiling `number_word_to_20` was benched at. */
export const SPOKEN_ANSWER_MIN = 1;
export const SPOKEN_ANSWER_MAX = 20;

export interface AddSubSceneItem extends JudgedScriptItem {
  kind: AddSubItemKind;
  band: AddSubBand;
  operation: AddSubOperation;
  /** Plural noun as generated ("ducks"). Never inflected in a cue — see the
   *  directive builders, which are deliberately noun-free so a count of one
   *  cannot produce "bring one more ducks". */
  objectType: string;
  scene: string;
  startCount: number;
  changeCount: number;
  resultCount: number;
  unknownPosition: AddSubUnknown;
  /** The story with its own question(s) stripped — the situation only. Empty
   *  for `create-story`, whose prompt is the equation. */
  situation: string;
  equation: string;
  /** What the child must PRODUCE: said aloud on voice items, enacted on gesture
   *  items (act-out/create-story = objects on the scene; build-equation = the
   *  result slot of the sentence they assemble). */
  answer: number;
  /** Number tiles the tray may offer (R6 AXIS-1 lever). Undefined = full tray. */
  allowedTiles?: string[];
}

// ── Small speakable helpers ─────────────────────────────────────────────────

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** A spoken answer must be inside the benched window. This is the gate that
 *  keeps zero and >20 out of the tutor's ear. */
export const isSayableAnswer = (n: unknown): n is number =>
  int(n) && n >= SPOKEN_ANSWER_MIN && n <= SPOKEN_ANSWER_MAX;

/** "three plus two equals five" — the equation, spoken. The numerals stay off
 *  the tutor's tongue everywhere in this pack. */
export const equationSpoken = (item: Pick<AddSubSceneItem, 'operation' | 'startCount' | 'changeCount' | 'resultCount'>): string =>
  `${numberWordFor(item.startCount)} ${item.operation === 'addition' ? 'plus' : 'take away'} `
  + `${numberWordFor(item.changeCount)} equals ${numberWordFor(item.resultCount)}`;

// ── Answer material — the fork, as code ─────────────────────────────────────

export const answerKindFor = (
  kind: AddSubItemKind,
  band: AddSubBand,
): 'voice' | 'gesture' =>
  kind === 'solve-story' || (kind === 'act-out' && band !== 'K') ? 'voice' : 'gesture';

export const responseClassFor = (
  kind: AddSubItemKind,
  band: AddSubBand,
): ResponseClassId =>
  answerKindFor(kind, band) === 'gesture' ? 'manipulation' : 'number_word_to_20';

/** Task identity for the runner's how-to-play policy: when consecutive items
 *  change `action`, the next cue re-speaks what to do. A mixed session can
 *  interleave enacting, counting, solving, writing and making, so "what to do"
 *  is not a static protocol a non-reader can look up (cvc-speller rule). */
export const actionFor = (kind: AddSubItemKind, band: AddSubBand): string => {
  switch (kind) {
    case 'act-out': return band === 'K' ? 'enact' : 'count';
    case 'solve-story': return 'solve';
    case 'build-equation': return 'write';
    case 'create-story': return 'make';
  }
};

/** Which value this item asks the child to produce. */
export const targetValueFor = (
  ch: Pick<AddSubSceneItem, 'kind' | 'unknownPosition' | 'startCount' | 'changeCount' | 'resultCount'>,
): number => {
  if (ch.kind !== 'solve-story') return ch.resultCount;
  if (ch.unknownPosition === 'change') return ch.changeCount;
  if (ch.unknownPosition === 'start') return ch.startCount;
  return ch.resultCount;
};

/** The values the STORY is allowed to state out loud. Everything the child is
 *  meant to discover is excluded — that is the whole point of the leak gate. */
export const publicValuesFor = (
  ch: Pick<AddSubSceneItem, 'kind' | 'unknownPosition' | 'startCount' | 'changeCount' | 'resultCount'>,
): number[] => {
  if (ch.kind !== 'solve-story') return [ch.startCount, ch.changeCount];
  switch (ch.unknownPosition) {
    case 'change': return [ch.startCount, ch.resultCount];
    case 'start': return [ch.changeCount, ch.resultCount];
    default: return [ch.startCount, ch.changeCount];
  }
};

// ── Content gates over generated prose (shared with the generator) ──────────

/**
 * The situation half of a story: every interrogative sentence removed, because
 * the pack asks its own question and two questions in one breath is two asks.
 * Returns '' when nothing survives — an unaskable item, which the build gate
 * drops rather than repairs.
 */
export const situationOf = (story: string): string =>
  (story ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !sentence.endsWith('?'))
    .join(' ')
    .trim();

/**
 * Does this story state a value the child is supposed to produce? Checked as
 * the numeral AND the number word, since a generator writes both ("3 ducks" /
 * "three ducks"). A value that is also a publicly stated operand is not a leak
 * — 4 − 2 = 2 legitimately prints "2" as the change — so only values that
 * appear NOWHERE in the public set can convict.
 */
export const storyLeaksAnswer = (
  story: string,
  answer: number,
  publicValues: number[],
): boolean => {
  if (!int(answer)) return false;
  if (publicValues.includes(answer)) return false;
  const haystack = ` ${(story ?? '').toLowerCase()} `;
  const numeral = new RegExp(`(?<![0-9])${answer}(?![0-9])`);
  const word = new RegExp(`\\b${numberWordFor(answer)}\\b`);
  return numeral.test(haystack) || word.test(haystack);
};

// ── Build gates — DROP an unaskable item, never repair it into one ───────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface AddSubChallengeLike {
  id: string;
  type: AddSubItemKind;
  storyText?: string;
  scene?: string;
  objectType?: string;
  operation?: AddSubOperation;
  startCount?: number;
  changeCount?: number;
  resultCount?: number;
  equation?: string;
  unknownPosition?: AddSubUnknown;
  allowedTiles?: string[];
}

/**
 * One generated challenge → one judged item, or NULL when the item cannot be
 * asked honestly:
 *   - counts that do not model the operation (a stale cache, a hand-edited fixture)
 *   - a story where nothing happens (`changeCount` 0)
 *   - a SPOKEN answer of 0, or above the benched ceiling
 *   - a story that opens a sentence with a verdict sentinel
 *   - a story that states the value the child must produce
 *   - a story with no situation left once its own questions are stripped
 * Nothing is backfilled: a placeholder item in a judged loop becomes a spoken
 * ask the tutor must judge.
 */
export const itemFromChallenge = (
  ch: AddSubChallengeLike,
  ctx: { band: AddSubBand },
): AddSubSceneItem | null => {
  const { band } = ctx;
  const kind = ch.type;
  if (kind !== 'act-out' && kind !== 'build-equation' && kind !== 'solve-story' && kind !== 'create-story') {
    return null;
  }

  const operation: AddSubOperation = ch.operation === 'subtraction' ? 'subtraction' : 'addition';
  const startCount = ch.startCount;
  const changeCount = ch.changeCount;
  const resultCount = ch.resultCount;
  if (!int(startCount) || !int(changeCount) || !int(resultCount)) return null;
  if (startCount < 0 || changeCount < 1 || resultCount < 0) return null;

  // R5 is the generator's job; this re-checks it because a judged ask states
  // the arithmetic aloud, and an inconsistent triple would be spoken as fact.
  const consistent = operation === 'addition'
    ? startCount + changeCount === resultCount
    : startCount - changeCount === resultCount;
  if (!consistent) return null;

  const unknownPosition: AddSubUnknown =
    ch.unknownPosition === 'change' || ch.unknownPosition === 'start' ? ch.unknownPosition : 'result';
  const answerKind = answerKindFor(kind, band);
  const answer = targetValueFor({ kind, unknownPosition, startCount, changeCount, resultCount });

  // The zero/ceiling gate binds the tutor's EAR, so it applies to spoken
  // answers only — a gesture answer of zero is a scene the child can build.
  if (answerKind === 'voice' && !isSayableAnswer(answer)) return null;

  const situation = situationOf(ch.storyText ?? '');
  if (kind === 'create-story') {
    // The equation IS the prompt here: everything is public and there is no
    // story to gate, but the counts must describe a buildable scene.
    if (operation === 'subtraction' && startCount < 1) return null;
  } else {
    if (situation.length === 0) return null;
    if (opensWithSentinel(situation)) return null;
    if (storyLeaksAnswer(situation, answer, publicValuesFor({ kind, unknownPosition, startCount, changeCount, resultCount }))) {
      return null;
    }
  }

  const objectType = (ch.objectType ?? '').trim() || 'objects';
  const allowed = (ch.allowedTiles ?? []).filter((t) => /^\d+$/.test(t));

  return {
    id: ch.id,
    kind,
    band,
    answerKind,
    responseClass: responseClassFor(kind, band),
    action: actionFor(kind, band),
    operation,
    objectType,
    scene: (ch.scene ?? '').trim() || 'scene',
    startCount,
    changeCount,
    resultCount,
    unknownPosition,
    situation,
    equation: ch.equation ?? `${startCount} ${operation === 'addition' ? '+' : '-'} ${changeCount} = ${resultCount}`,
    answer,
    ...(allowed.length > 0 ? { allowedTiles: allowed } : {}),
  };
};

// ── The equation verdict — code-computed, never counted by the tutor ────────

export type EquationFault = 'match' | 'incomplete' | 'arithmetic' | 'operator' | 'numbers';

/** A finished number sentence: N op N = N. Used both as the STRUCTURAL close
 *  (the tray has reached a terminal shape) and as the verdict input — note it
 *  is not correctness-gated in either role: "3 + 2 = 9" parses fine and is
 *  wrong. */
export const parseEquationTiles = (
  tiles: readonly string[],
): { left: number; op: '+' | '-'; right: number; result: number } | null => {
  const match = tiles.join('').replace(/\s+/g, '').match(/^(\d+)([+-])(\d+)=(\d+)$/);
  if (!match) return null;
  return {
    left: parseInt(match[1], 10),
    op: match[2] as '+' | '-',
    right: parseInt(match[3], 10),
    result: parseInt(match[4], 10),
  };
};

/**
 * Which of the three things went wrong — the same three checks the click-era
 * Check button ran, kept because they name genuinely different misconceptions
 * (arithmetic slip vs. reading the story's direction backwards vs. inventing
 * numbers). The tutor is handed the verdict, never asked to derive it.
 */
export const equationFaultOf = (
  item: Pick<AddSubSceneItem, 'operation' | 'startCount' | 'changeCount' | 'resultCount'>,
  tiles: readonly string[],
): EquationFault => {
  const parsed = parseEquationTiles(tiles);
  if (!parsed) return 'incomplete';
  const { left, op, right, result } = parsed;
  if ((op === '+' ? left + right : left - right) !== result) return 'arithmetic';
  if ((item.operation === 'addition') !== (op === '+')) return 'operator';
  const said = [left, right, result].sort((a, b) => a - b);
  const want = [item.startCount, item.changeCount, item.resultCount].sort((a, b) => a - b);
  if (said[0] !== want[0] || said[1] !== want[1] || said[2] !== want[2]) return 'numbers';
  return 'match';
};


// ── The asks — the story SPOKEN, then one code-owned question ───────────────

/** Noun-free on purpose: the story has already named the objects, and
 *  "bring one more ducks" is the pluralisation bug this avoids entirely. */
export const enactDirective = (item: AddSubSceneItem): string =>
  item.operation === 'addition'
    ? `bring ${numberWordFor(item.changeCount)} more in`
    : `send ${numberWordFor(item.changeCount)} away`;

export const questionFor = (item: AddSubSceneItem): string => {
  if (item.kind === 'solve-story') {
    if (item.unknownPosition === 'change') {
      return `How many ${item.objectType} ${item.operation === 'addition' ? 'came' : 'went away'}?`;
    }
    if (item.unknownPosition === 'start') {
      return `How many ${item.objectType} were there at the start?`;
    }
  }
  return item.operation === 'addition'
    ? `How many ${item.objectType} are there now?`
    : `How many ${item.objectType} are left?`;
};

export const askFor = (item: AddSubSceneItem): string => {
  switch (item.kind) {
    case 'act-out':
      // @K the enactment IS the answer; @1 the child enacts a departure (a
      // static picture cannot show one — contract R3 item 12) and then counts
      // the survivors aloud.
      if (item.answerKind === 'gesture') {
        return `${item.situation} Your turn — ${enactDirective(item)}.`;
      }
      return item.operation === 'subtraction'
        ? `${item.situation} Your turn — ${enactDirective(item)}, then tell me: ${questionFor(item)}`
        : `${item.situation} Your turn. ${questionFor(item)}`;
    case 'solve-story':
      return `${item.situation} Your turn. ${questionFor(item)}`;
    case 'build-equation':
      return `${item.situation} Your turn — build the number sentence for that story.`;
    case 'create-story':
      return `Here is a number sentence: ${equationSpoken(item)}. `
        + `Your turn — make that story with the ${item.objectType} in the ${item.scene}.`;
  }
};

// ── Items — ONE builder for the component and the DI harness ────────────────

export const itemsFromChallenges = (
  challenges: AddSubChallengeLike[],
  ctx: { band: AddSubBand },
): AddSubSceneItem[] =>
  challenges
    .map((ch) => itemFromChallenge(ch, ctx))
    .filter((item): item is AddSubSceneItem => item !== null);

// ── Harness answer material — what a right and a wrong child sound like ─────

export interface AddSubHarnessAnswers {
  /** What a correct child says (or builds). */
  correct: string;
  /** Unambiguously wrong — the baseline refusal test. */
  plainWrong: string;
  /**
   * The FLUENT miss this item's judging contract explicitly refuses. Testing it
   * tests `discriminationFor` rather than mere arithmetic: a judge that only
   * catches "four for five" can still affirm an operand the story said aloud.
   */
  signatureWrong?: { text: string; why: string };
  /** Scene items commit a COUNT of objects — code computes the match. */
  placed?: { correct: number; wrong: number };
  /** build-equation commits TILES; the wire carries them space-joined. */
  tapped?: { correct: string; wrong: string };
  /** Answer tokens that must NOT appear in the spoken ask. */
  leakTokens: string[];
  /**
   * The STORY is read aloud inside the ask, and a story legitimately states its
   * public operands. Those are not the answer, so they are not leak tokens —
   * but on a `solve-story` with an unknown START, the story states the RESULT,
   * and the result is what `affirmTailFor` echoes. Subtracting the story keeps
   * the greeting, how-to-play, question and hand-over governed while letting
   * the stimulus say what a story has to say (story-talk's mechanism, 2nd use).
   */
  leakExemptSpan?: string;
}

/** The tiles a correct number sentence is made of, as the tray emits them. */
const correctTiles = (item: AddSubSceneItem): string[] => [
  String(item.startCount),
  item.operation === 'addition' ? '+' : '-',
  String(item.changeCount),
  '=',
  String(item.resultCount),
];

/**
 * The sharpest wrong sentence there is: the SAME three numbers, arithmetically
 * valid, with the story's direction reversed. `equationFaultOf` classifies it
 * `operator` — the one fault of the three that is a misconception about the
 * STORY rather than a slip, and the only one whose correction names the
 * direction. An arithmetic-slip wrong would be caught by a judge that never
 * read the story at all.
 */
const reversedTiles = (item: AddSubSceneItem): string[] =>
  item.operation === 'addition'
    ? [String(item.resultCount), '-', String(item.changeCount), '=', String(item.startCount)]
    : [String(item.resultCount), '+', String(item.changeCount), '=', String(item.startCount)];

/**
 * The answers a headless student gives on a judged drive. This lives beside the
 * contract it mirrors on purpose: `discriminationFor` above CLAIMS the judge
 * refuses these, and this is the claim made testable. Change one, change both.
 */
export const addSubHarnessAnswers = (item: AddSubSceneItem): AddSubHarnessAnswers => {
  const answerWord = numberWordFor(item.answer);
  const wrongValue = item.answer > SPOKEN_ANSWER_MIN ? item.answer - 1 : item.answer + 1;
  const publicValues = publicValuesFor(item);
  const leakTokens = publicValues.includes(item.answer) ? [] : [answerWord];
  // The stimulus is spoken inside the ask and may legitimately contain the
  // answer (story-talk's mechanism, second use). Two different spans here:
  //   - every story mode: the SITUATION, which states its public operands;
  //   - `create-story`: the EQUATION, because it IS the prompt — this module's
  //     build gate says so ("everything is public and there is no story to
  //     gate"), so the result the child must build is necessarily spoken. The
  //     create_story drive (2026-08-15) filed 5 HIGHs for exactly this, and
  //     they were the oracle missing a mode, not the pack leaking.
  // Subtracting the span keeps the scan STRONGER than emptying `leakTokens`:
  // the answer named in the greeting, the how-to-play or the hand-over is
  // still a HIGH.
  const leakExemptSpan = item.kind === 'create-story'
    ? equationSpoken(item)
    : item.situation || undefined;

  const base: AddSubHarnessAnswers = {
    correct: answerWord,
    plainWrong: numberWordFor(wrongValue),
    leakTokens,
    leakExemptSpan,
  };

  if (item.answerKind === 'voice') {
    // The echo clause is the discrimination this pack claims: an operand the
    // story said out loud, handed back fluently, is not the answer.
    const echoed = publicValues.find((value) => value !== item.answer);
    return {
      ...base,
      signatureWrong: echoed === undefined
        ? {
            text: countWalk(item.answer + 1),
            why: 'a counted walk that ends one PAST the answer — it contains the answer word without landing on it',
          }
        : {
            text: numberWordFor(echoed),
            why: 'an operand the story states out loud, said back — the contract names it as NOT the answer',
          },
    };
  }

  if (item.kind === 'build-equation') {
    return {
      ...base,
      correct: correctTiles(item).join(' '),
      plainWrong: reversedTiles(item).join(' '),
      tapped: {
        correct: correctTiles(item).join(' '),
        wrong: reversedTiles(item).join(' '),
      },
    };
  }

  // act-out @ K and create-story: the commit is a COUNT of objects on the scene.
  return {
    ...base,
    correct: `${item.answer} ${item.objectType} in the picture`,
    // `wrongValue`, never max(0, answer - 1): on a result of 0 ("all 3 ducks swim away") that was the answer itself.
    plainWrong: `${wrongValue} ${item.objectType} in the picture`,
    placed: { correct: item.answer, wrong: wrongValue },
  };
};
