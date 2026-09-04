/**
 * Era Explorer — the judged DI script (port 24, FIRST history / social-studies
 * port).
 *
 * ── THE MODALITY ────────────────────────────────────────────────────────────
 * ALL FOUR MODES ARE SPOKEN. Zero taps on the answer. The click era's surface —
 * three bins to tap, a Check button, a Next button, a hint disclosure, a
 * two-strikes reveal ladder — is deleted, because every answer this primitive
 * wants is a proposition a child says out loud at a table: "the Technology
 * lens", "only back then", "both times", "because the trains came".
 *
 * ── WHY EVERY MODE IS `closed_set_choice`, AND WHY THAT IS NOT A HEDGE ──────
 * The uniformity is suspicious enough to justify: era-explorer is a THREE-BIN
 * CLASSIFICATION primitive in all four of its modes. The answer is always one
 * whole proposition out of three the question itself states, and free
 * production in any of them is open-set — "why did life change?" answered cold
 * has countless right-sounding answers, and "which lens?" answered cold needs
 * the three lens names spoken anyway. So the MENU stays (the mats rule: the ask
 * names the groups, and the answer sits inside the question by construction)
 * and the BUTTON is what the port deletes. The child was already picking one of
 * three; the change is that they now have to SAY which, out loud, and the tutor
 * has to hear it.
 *
 * That also settles the βs: nothing structural moved (still one-of-three), so
 * the eval modes keep their identities and their weights.
 *
 * ── THE ANSWER-MATERIAL FORK (standing gate 1 arithmetic) ───────────────────
 *   lens_id          say WHICH lens the detail came from     closed_set_choice
 *   era_sort         say WHEN life looked like that          closed_set_choice
 *   era_compare      say WHICH of two past times it belongs  closed_set_choice
 *   cause_of_change  say WHY life changed                    closed_set_choice
 * No gesture item exists. Opening a lens tab is not an answer — it is reading
 * the source, which IS the page in the teacher-at-a-table picture and stays.
 *
 * ── THE SOURCE STAYS ON THE TABLE ───────────────────────────────────────────
 * This primitive is open-book by design (birth certificate, 2026-08-23): the
 * era card IS the evidence and consulting it IS the historian's method.
 * Deleting it would turn historical reasoning into a memory quiz — the "a task
 * whose groups are unknowable is BROKEN, not harder" failure one domain over.
 * So the lens card survives the port, with an on-demand read-aloud
 * (`sourceCue`) that is the pre-reader's only channel to it. That read is
 * question-side by construction: it speaks a lens BODY, never a statement,
 * never an option, never a verdict.
 *
 * ── WHAT THE CLICK ERA'S TIER LEVERS BECOME ─────────────────────────────────
 * Three of the six L3 levers governed on-screen scaffolding that no longer
 * exists, so they move into the SPOKEN ask rather than being dropped:
 *   showStrategy    → the guide line, spoken at `easy` only
 *   hintLevel       → deleted; the scripted correction re-models instead, and
 *                     the tutor can no longer hand back what the tier withdrew
 *                     because it is no longer improvising
 *   showBinCaptions → the plain-language HALF of each menu phrase
 * `lensAccess` survives untouched as a PAGE lever (the source folds away
 * between items at hard). `requireAllLenses` dies with the Start button — the
 * tutor owns the clock, so there is no gate for the child to press through.
 *
 * ── THE LEAK GATES LIVE HERE, AND THE GENERATOR IMPORTS THEM ────────────────
 * `statementLeaks` and its vocabulary moved out of `gemini-era-explorer.ts`
 * into this module so both sides of the wire run ONE copy (letter-spotter's two
 * hand-synced copies disagreed live on what a sayable sentence was). The
 * generator's structural machinery — `selectForShape`, `lensReachOf`, the
 * distractor-distance lever — stays where it is; only the predicates moved.
 *
 * ── THE LEAK THIS PRIMITIVE'S DATA INVITES (defect 11, its exact shape) ─────
 * The STATEMENT is read aloud. The click era only ever printed it beside three
 * buttons, so a statement carrying its own answer cost a guess; spoken, it
 * costs the whole item. Five audits ride: the generator's four (verbatim lens
 * copy, lens title named, time word or year, causal connective / cause echo),
 * plus a new one this port adds — `answerWordsInStatement`, which drops a
 * statement containing the words that DISTINGUISH its own correct choice. That
 * last one is not reachable generator-side alone: the distinguishing words are
 * a property of the SPOKEN menu, which did not exist before this file.
 *
 * ── EAR-SEPARABILITY IS A BUILD GATE, NOT A HOPE ────────────────────────────
 * `closed_set_choice` owes it (decodable-reader's `optionsEarSeparable`): every
 * option must own a content word no other option carries, or an utterance fits
 * two of them and there is no honest verdict. It bites on two real shapes here
 * — two era names sharing a word ("Pioneer Times" against "Early Pioneer
 * Days"), and `cause_of_change` at HARD, where the structural lever
 * deliberately picks the NEAREST distractors. That tension is the point: the
 * gate is the floor under the lever, and an item whose nearest distractors are
 * not separable by ear drops rather than shipping an unjudgeable ask.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"). Era names, lens titles, statements and
 * causes are ALL generated here, so every one of them is scanned in
 * `itemFromChallenge` and the item drops rather than being reworded.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';

export { opensWithSentinel };

// ============================================================================
// Domain
// ============================================================================

export type EraKind = 'lens_id' | 'era_sort' | 'era_compare' | 'cause_of_change';
export type EraTier = 'easy' | 'medium' | 'hard';

/** Ladder order: locate → place in time → contrast two past times → explain.
 *  Also the order items ship in, which is what keeps the how-to-play from
 *  being re-recited every round (defect 13). */
export const ERA_KINDS: readonly EraKind[] = [
  'lens_id', 'era_sort', 'era_compare', 'cause_of_change',
];

export const isEraKind = (v: unknown): v is EraKind =>
  typeof v === 'string' && (ERA_KINDS as readonly string[]).includes(v);

/** The session material every ask is built from — duck-typed so this module
 *  never imports the component or the generator; both import US. */
export interface EraSessionLike {
  eraName: string;
  priorEraName: string;
  lensTitles: string[];
  lensBodies: string[];
}

/** One structural challenge as the generator emits it. `options` and
 *  `correctIndex` are already CODE-OWNED there (built from the session's own
 *  era and lens names, or from the emitted causes with the real one spliced
 *  in), so this port reads a key it does not have to re-derive from free
 *  text — the click era's one honest measurement, kept. */
export interface EraChallengeLike {
  id: string;
  type: string;
  statement: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

/**
 * One spoken option. The menu speaks `phrase`; the child answers with
 * `distinguisher` or anything in `alsoCounts`; the reveal prints `label`; the
 * close and the affirmation use `closeForm`.
 *
 * The split exists because a five-year-old never recites a proposition back
 * (the `closed_set_choice` accept rule). "Was it only back then in Pioneer
 * Times, only today in your own life, or true in both times?" is answered
 * "back then", "pioneer", "today", "both" — never with the sentence.
 */
export interface EraChoice {
  /** The printed on-screen label. Reveal only — nothing prints before the affirm. */
  label: string;
  /** How the menu speaks this option. */
  phrase: string;
  /** How the close and the affirmation name it. */
  closeForm: string;
  /** The short form a child actually says. */
  distinguisher: string;
  /** Other short forms that count. Never overlapping across options. */
  alsoCounts: string[];
}

export interface EraExplorerItem extends JudgedScriptItem {
  kind: EraKind;
  /** Catalog contextKey. Same value as `kind` — the eval modes ARE the kinds. */
  challengeType: EraKind;
  tier: EraTier;
  /** The life detail the tutor reads aloud. The question, never the answer. */
  statement: string;
  /** The three spoken propositions, in the order the ask offers them. */
  choices: EraChoice[];
  correctIndex: number;
  /** Post-affirm teaching note. Rendered behind `revealHeld`, never spoken. */
  explanation?: string;
}

export const correctChoiceOf = (item: EraExplorerItem): EraChoice =>
  item.choices[item.correctIndex];

// ============================================================================
// Word tools — one tokenizer, used by every gate in this file
// ============================================================================

/**
 * Lowercase, punctuation-stripped, and lightly de-pluralised. The plural fold
 * is deliberate and is the one place this tokenizer is stricter than the
 * family's: era names collide by INFLECTION more than by identity, and a menu
 * where one option says "today" while another carries "today's" is not
 * separable by ear however cleanly the two strings differ.
 */
export const eraTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));

/** Function words carry no subject matter and would make every option look
 *  equally close to every other. */
const EAR_STOPWORDS = new Set([
  'the', 'and', 'or', 'but', 'for', 'with', 'from', 'into', 'onto', 'over', 'about',
  'was', 'were', 'are', 'been', 'being', 'its', 'they', 'them', 'their', 'this',
  'that', 'these', 'those', 'there', 'than', 'not', 'out', 'off', 'have', 'has',
  'had', 'did', 'does', 'get', 'got', 'one', 'two', 'all', 'any', 'own', 'you',
  'your', 'his', 'her', 'him', 'she', 'lens', 'time', 'thing', 'life', 'people',
  'more', 'most', 'some', 'each', 'every', 'other', 'very', 'can', 'will', 'just',
  'only', 'true', 'like', 'made', 'make', 'used', 'use',
]);

const contentWords = (text: string): string[] =>
  eraTokens(text).filter((w) => w.length > 2 && !EAR_STOPWORDS.has(w));

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const containsPhrase = (haystack: string, phrase: string): boolean =>
  new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(haystack);

export const toWords = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);

// ============================================================================
// The leak vocabulary — ONE copy, consumed by the generator too
// ============================================================================

/**
 * Words that place a statement in time and therefore answer the sort for the
 * student. Any hit rejects the statement (years like "1850" included; the
 * unanchored \d{4} also catches "1800s"). Applies to era_sort / era_compare.
 */
export const TIME_LEAK =
  /\b(today|now|nowadays|long ago|back then|these days|modern)\b|\d{4}/i;

/**
 * A cause_of_change statement must state the CHANGE only. A causal connective
 * means the reason is already in the stem, so the three options are decoration.
 */
export const CAUSAL_CONNECTIVE =
  /\b(because|since|due to|thanks to|owing to|as a result|which led to|so that)\b/i;

/** Generic era-name words that are safe inside statements ("times", "age"…). */
export const GENERIC_ERA_WORDS = new Set([
  'times', 'time', 'days', 'day', 'era', 'age', 'ages', 'the', 'old', 'early', 'life', 'years',
]);

/**
 * Verbatim tripwire: a statement sharing this many CONSECUTIVE words with a
 * source body is a copied sentence, not a paraphrase — the judgment degrades
 * into a string-match lookup. Anchor phrases ("single-room schoolhouse",
 * "wagons pulled by oxen") stay well under this bar, so paraphrases survive.
 */
export const VERBATIM_RUN = 7;

/** Shorter run for cause echoes: the cause is only a few words to begin with. */
export const CAUSE_ECHO_RUN = 4;

export const sharesRun = (statement: string, sources: string[], run: number): boolean => {
  const words = toWords(statement);
  if (words.length < run) return false;
  for (const source of sources) {
    const haystack = ` ${toWords(source).join(' ')} `;
    for (let i = 0; i + run <= words.length; i++) {
      if (haystack.includes(` ${words.slice(i, i + run).join(' ')} `)) return true;
    }
  }
  return false;
};

/** Distinctive words of an era name — "Pioneer" counts, "Times" doesn't. */
export const eraKeywords = (eraName: string): string[] =>
  eraName
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !GENERIC_ERA_WORDS.has(word));

export const namesEra = (statement: string, eraNames: string[]): boolean =>
  eraNames
    .flatMap(eraKeywords)
    .some((word) => new RegExp(`\\b${escapeRegExp(word)}`, 'i').test(statement));

/**
 * The reason a statement answers its own question, or null when it doesn't.
 * Each mode leaks a different way, so each gets its own audit rather than one
 * blanket regex. Runs generator-side (before the challenge is kept) AND
 * build-side (before the ask is spoken) from this one definition.
 */
export const statementLeaks = (
  type: EraKind,
  statement: string,
  answer: string,
  ctx: EraSessionLike,
): string | null => {
  // Every mode: a copied source sentence turns the judgment into a string match.
  if (sharesRun(statement, ctx.lensBodies, VERBATIM_RUN)) return 'verbatim lens copy';

  switch (type) {
    case 'lens_id':
      // Naming a lens hands over the only thing being asked.
      if (ctx.lensTitles.some((t) => containsPhrase(statement, t))) return 'names a lens';
      return null;
    case 'era_sort':
      if (TIME_LEAK.test(statement)) return 'time word or year';
      if (namesEra(statement, [ctx.eraName])) return 'names the era';
      return null;
    case 'era_compare':
      if (TIME_LEAK.test(statement)) return 'time word or year';
      if (namesEra(statement, [ctx.eraName, ctx.priorEraName])) return 'names an era';
      return null;
    case 'cause_of_change':
      if (CAUSAL_CONNECTIVE.test(statement)) return 'states its own cause';
      if (sharesRun(statement, [answer], CAUSE_ECHO_RUN)) return 'echoes the cause';
      return null;
  }
};

// ============================================================================
// Ear-separability — what `closed_set_choice` owes
// ============================================================================

/**
 * Every option must own at least one CONTENT word that appears nowhere in any
 * other option's spoken phrase or accepted short forms. Without it an utterance
 * fits two options and there is no honest verdict — and the fix is never to
 * judge leniently, it is to drop the ask (decodable-reader's rule).
 *
 * Measured on the DISTINGUISHER against every other option's FULL bag, which is
 * the asymmetry that matters: the child says the short form, and it must not be
 * findable anywhere inside a rival proposition.
 */
export const optionsEarSeparable = (choices: EraChoice[]): boolean => {
  if (choices.length < 2) return false;
  const bags = choices.map(
    (c) => new Set(contentWords(`${c.phrase} ${c.distinguisher} ${c.alsoCounts.join(' ')}`)),
  );
  return choices.every((c, i) => {
    const mine = contentWords(c.distinguisher);
    return mine.some((w) => bags.every((bag, j) => j === i || !bag.has(w)));
  });
};

/**
 * Defect 11, in the shape this primitive's data actually produces: the
 * statement carrying the words that distinguish its OWN correct choice.
 *
 * The generator's audits catch the obvious forms — a named lens, a time word, a
 * year, a stated cause, a four-word cause echo. This one catches what only
 * exists once the menu is spoken: a single distinguishing word. A
 * `cause_of_change` statement sharing one rare noun with its own cause
 * ("Families stopped carrying water home" against "water pipes were built into
 * houses") is a giveaway out loud that no run-length gate reaches, and an
 * `era_sort` statement containing "both" answers the continuity bin outright.
 */
export const answerWordsInStatement = (statement: string, correct: EraChoice): boolean => {
  const bag = new Set(eraTokens(statement));
  return contentWords(correct.distinguisher).some((w) => bag.has(w));
};

// ============================================================================
// The split (standing gate 1 arithmetic, not a preference)
// ============================================================================

/** Every mode SPEAKS. See the header for why there is no gesture item — the
 *  three bins were never the page, they were a menu with a tap on it. */
export const answerKindFor = (_kind: EraKind): 'voice' | 'gesture' => 'voice';

export const responseClassFor = (_kind: EraKind): ResponseClassId => 'closed_set_choice';

// ============================================================================
// Building the spoken menu
// ============================================================================

const ORDINALS = ['the first one', 'the second one', 'the third one'];

/** The words an era name contributes to its own accept clause. */
const eraShortForms = (eraName: string): string[] => {
  const keys = eraKeywords(eraName);
  return keys.length > 0 ? keys : [eraName.toLowerCase()];
};

/**
 * The words UNIQUE to one cause among the three. This is both the accept clause
 * and the ear-separability evidence for `cause_of_change`, whose options are
 * free prose rather than a fixed vocabulary.
 *
 * ⚠ COMPARE ON THE FOLDED FORM, RETURN THE SURFACE ONE. `eraTokens` folds
 * plurals so that "today" and "today's" collide by ear, which is right for the
 * comparison and WRONG for anything the tutor is handed: the first live draw
 * put "automobile factorie" and "widespread electrical" into the accept clause,
 * i.e. told the judge to listen for a misspelling and handed the drive harness
 * a non-word to say. The fold is a lens for matching, never a source of text.
 */
const uniqueCauseWords = (causes: string[]): string[][] => {
  // Surface words, in order, paired with the folded key they compare under.
  const surfaces = causes.map((c) =>
    c.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean),
  );
  const bags = causes.map((c) => new Set(contentWords(c)));
  return surfaces.map((mine, i) =>
    mine.filter((word) => {
      const [folded] = contentWords(word);
      if (!folded) return false;
      return bags.every((other, j) => j === i || !other.has(folded));
    }),
  );
};

/**
 * Turn the challenge's code-owned `options` into spoken propositions.
 *
 * The three fixed-bin modes get a HAND-WRITTEN phrase per slot, because the
 * printed labels are not sayable as they stand: "Both then and now" is a
 * perfectly good button and a terrible spoken option, since it contains the
 * word "now" and would collide with the today bin in the child's mouth. The
 * plain-language half of each phrase is what `showBinCaptions` used to print.
 *
 * Returns null when the options are not the shape this mode's generator builds
 * — a keep-or-drop gate, never a backfill.
 */
export const choicesFor = (
  kind: EraKind,
  options: string[],
): EraChoice[] | null => {
  if (options.length !== 3 || options.some((o) => !o || !o.trim())) return null;

  switch (kind) {
    case 'lens_id':
      return options.map((title) => ({
        label: title,
        phrase: `the ${title} lens`,
        closeForm: `from the ${title} lens`,
        distinguisher: title,
        alsoCounts: contentWords(title),
      }));

    case 'era_sort': {
      // Generator order: [eraName, 'Today', 'Both then and now'].
      const era = options[0];
      return [
        {
          label: options[0],
          phrase: `only back then in ${era}`,
          closeForm: `true only back then in ${era}`,
          distinguisher: 'back then',
          alsoCounts: ['long ago', 'only then', ...eraShortForms(era)],
        },
        {
          label: options[1],
          phrase: 'only today in your own life',
          closeForm: 'true only today',
          distinguisher: 'today',
          alsoCounts: ['now', 'our time', 'my day'],
        },
        {
          label: options[2],
          phrase: 'true in both times',
          closeForm: 'true in both times',
          distinguisher: 'both',
          alsoCounts: ['both times', 'then and now'],
        },
      ];
    }

    case 'era_compare': {
      // Generator order: [priorEraName, eraName, 'Both eras'].
      const earlier = options[0];
      const later = options[1];
      return [
        {
          label: options[0],
          phrase: `only in ${earlier}`,
          closeForm: `true only in ${earlier}`,
          distinguisher: earlier,
          alsoCounts: [...eraShortForms(earlier), 'the earlier one'],
        },
        {
          label: options[1],
          phrase: `only in ${later}`,
          closeForm: `true only in ${later}`,
          distinguisher: later,
          alsoCounts: [...eraShortForms(later), 'the later one'],
        },
        {
          label: options[2],
          phrase: 'true in both of those times',
          closeForm: 'true in both of those times',
          distinguisher: 'both',
          alsoCounts: ['both times', 'both of them'],
        },
      ];
    }

    case 'cause_of_change': {
      const unique = uniqueCauseWords(options);
      // A cause with no word of its own cannot be picked by ear. Drop the item.
      if (unique.some((words) => words.length === 0)) return null;
      return options.map((cause, i) => ({
        label: cause,
        phrase: `because ${cause}`,
        closeForm: `because ${cause}`,
        distinguisher: unique[i].slice(0, 2).join(' '),
        alsoCounts: unique[i].slice(2),
      }));
    }
  }
};

// ============================================================================
// Items
// ============================================================================

const endWithStop = (s: string): string => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** Nothing spoken may carry a double quote: the cue's own quoted span ends at
 *  the first one, so a quoted statement would truncate the tutor's line and
 *  strand the judging contract outside it. */
const hasQuote = (s: string): boolean => /["“”]/.test(s);

/**
 * One judged item, or null when the challenge cannot be ASKED. Keep-or-drop,
 * never backfill: a placeholder in a judged loop becomes a spoken ask the tutor
 * must judge, and there is no honest verdict behind it.
 *
 * The gates and what each protects:
 *  - the type must be one of the four eval modes;
 *  - the statement must be a real sentence, quote-free, and must not open with
 *    a sentinel — it is GENERATED and it is spoken, so both are live risks;
 *  - the code-owned key must be in range and the options must build into three
 *    sayable propositions (`choicesFor` refuses a `cause_of_change` triple with
 *    no word of its own);
 *  - `statementLeaks` re-runs build-side — the same predicate the generator
 *    already ran, on the same bytes, because two copies drift and one does not;
 *  - `answerWordsInStatement`: the statement may not carry the words that
 *    distinguish its own correct choice (defect 11, the spoken half);
 *  - `optionsEarSeparable`: every option owns a content word no other has, or
 *    an utterance fits two of them and the verdict is a coin toss.
 */
export const itemFromChallenge = (
  ch: EraChallengeLike,
  session: EraSessionLike,
  opts: { tier?: EraTier } = {},
): EraExplorerItem | null => {
  if (!isEraKind(ch.type)) return null;
  const kind = ch.type;

  const statement = (ch.statement || '').trim();
  if (toWords(statement).length < 3) return null;
  if (hasQuote(statement) || opensWithSentinel(statement)) return null;

  const options = (ch.options ?? []).map((o) => (o ?? '').trim());
  if (options.length !== 3) return null;
  if (options.some((o) => !o || hasQuote(o) || opensWithSentinel(o))) return null;
  if (!Number.isInteger(ch.correctIndex) || ch.correctIndex < 0 || ch.correctIndex > 2) return null;

  const choices = choicesFor(kind, options);
  if (!choices) return null;
  if (!optionsEarSeparable(choices)) return null;

  const correct = choices[ch.correctIndex];
  if (statementLeaks(kind, statement, correct.label, session)) return null;
  if (answerWordsInStatement(statement, correct)) return null;

  return {
    id: ch.id,
    answerKind: answerKindFor(kind),
    responseClass: responseClassFor(kind),
    action: kind,
    kind,
    challengeType: kind,
    tier: opts.tier ?? 'medium',
    statement: endWithStop(statement),
    choices,
    correctIndex: ch.correctIndex,
    explanation: ch.explanation,
  };
};

/**
 * Build the session.
 *
 * Defect class 1 does NOT bite here and the absence is worth stating: one
 * era-explorer challenge was ALREADY one statement with one answer, so a
 * challenge maps to exactly one judged item and no expansion is owed. What does
 * bite is class 2 and class 13:
 *
 *  - defect 2 — every item closes by naming its answer aloud, so a later item
 *    on the same answer is recall rather than the skill. `lens_id` gets the
 *    strong form (a lens may be the answer ONCE per session; the generator
 *    already asks for this, and asking is not enforcing), and the fixed-bin
 *    modes get the weak form (consecutive items may not share an answer),
 *    because three bins across up to six items cannot all differ.
 *  - defect 13 — the runner re-speaks the how-to-play whenever `action`
 *    changes, so an interleaved draw makes EVERY item an action change and
 *    recites the protocol before every question. The modes therefore ship as
 *    RUNS in `ERA_KINDS` order, which is also the pedagogically right order:
 *    locate → place in time → contrast two past times → explain the cause.
 */
export const itemsFromChallenges = (
  challenges: EraChallengeLike[],
  session: EraSessionLike,
  opts: { tier?: EraTier; maxItems?: number } = {},
): EraExplorerItem[] => {
  const built: EraExplorerItem[] = [];
  const usedLenses = new Set<string>();
  for (const ch of challenges) {
    const item = itemFromChallenge(ch, session, opts);
    if (!item) continue;
    if (item.kind === 'lens_id') {
      const answer = correctChoiceOf(item).label.toLowerCase();
      if (usedLenses.has(answer)) continue;
      usedLenses.add(answer);
    }
    built.push(item);
  }

  const cap = opts.maxItems ?? 8;
  const runs = ERA_KINDS.map((kind) => built.filter((i) => i.kind === kind));

  const selected: EraExplorerItem[] = [];
  for (const run of runs) {
    const pending = [...run];
    while (pending.length && selected.length < cap) {
      const prev = selected[selected.length - 1];
      // Only the ANSWER may not repeat back to back; the action deliberately
      // does, because that repetition is what buys the run.
      const idx = pending.findIndex(
        (c) => !prev
          || prev.action !== c.action
          || correctChoiceOf(prev).distinguisher !== correctChoiceOf(c).distinguisher,
      );
      if (idx === -1) break;
      selected.push(pending.splice(idx, 1)[0]);
    }
  }
  return selected;
};

// ============================================================================
// How to play, lead-in, asks
// ============================================================================

export const howToPlayFor = (item: EraExplorerItem): string => {
  switch (item.kind) {
    case 'lens_id':
      return 'I read you something from the era cards — you say which lens it came from, out loud! ';
    case 'era_sort':
      return 'I read you something about life — you say when life looked like that, out loud! ';
    case 'era_compare':
      return 'I read you something about life — you say which of the two old times it belongs to, out loud! ';
    case 'cause_of_change':
      return 'I read you a way life changed — you say why it changed, out loud! ';
  }
};

/**
 * The model line NAMES EVERY OPTION KIND and therefore discloses none — the
 * mats rule in lead-in form, and the reason it can be spoken without leaking.
 * It is also the line the CORRECTION re-models at every tier, which is why the
 * harness exempts it unconditionally while the guide line below is exempt only
 * where it is actually spoken.
 */
export const modelLineFor = (item: EraExplorerItem): string => {
  switch (item.kind) {
    case 'lens_id':
      return `Every detail on these cards comes from one of the three lenses: ${item.choices.map((c) => c.label).join(', ')}.`;
    case 'era_sort':
      return 'Some things happened only back then, some happen only today, and some happen in both times.';
    case 'era_compare':
      return 'Some things belong only to the earlier time, some only to the later one, and some to both.';
    case 'cause_of_change':
      return 'Life changes for a reason — a new invention, a new way to earn a living, or a new rule.';
  }
};

/** The historian move, named. This is `showStrategy` — the click era's easy
 *  tier printed it under the question; the tier is a spoken lever now. */
export const guideLineFor = (item: EraExplorerItem): string => {
  switch (item.kind) {
    case 'lens_id': return 'Ask yourself what KIND of thing the sentence is about.';
    case 'era_sort': return 'Picture it back then, then picture your own day. Both pictures decide it.';
    case 'era_compare': return 'Your own day is not one of the choices here.';
    case 'cause_of_change': return 'Ask which one had to happen FIRST.';
  }
};

/** Speaks ONLY where the how-to-play does (the introduction of an action),
 *  never per item — DISTAR fades the model, it does not re-read it. */
export const leadInFor = (item: EraExplorerItem): string => {
  switch (item.tier) {
    case 'hard': return '';
    case 'easy': return `${modelLineFor(item)} ${guideLineFor(item)} `;
    case 'medium':
    default: return `${modelLineFor(item)} `;
  }
};

/** The menu IS the ask (the mats rule) and is spoken at every tier — without it
 *  the answer set is open and unjudgeable. */
export const menuClauseFor = (item: EraExplorerItem): string => {
  const [a, b, c] = item.choices.map((ch) => ch.phrase);
  return `was it ${a}, ${b}, or ${c}?`;
};

/** The short re-elicit — the part of the ask that names the move. */
const elicitFor = (item: EraExplorerItem): string => {
  switch (item.kind) {
    case 'lens_id': return 'Say which lens that came from';
    case 'era_sort': return 'Say when life looked like that';
    case 'era_compare': return 'Say which time that belongs to';
    case 'cause_of_change': return 'Say why life changed';
  }
};

const askFor = (item: EraExplorerItem): string =>
  `Listen. ${item.statement} Your turn. ${elicitFor(item)} — ${menuClauseFor(item)}`;

// ============================================================================
// Corrections and affirmations — DISTAR re-model then re-elicit
// ============================================================================
// Neither lands the answer: the correction re-models the RULE and hands the
// question back, so the child still earns it. The tier hid the historian move
// on screen — the tutor may not give it back (the L3 reveal-policy gotcha, now
// enforced by the correction being SCRIPTED rather than improvised).

const correctionFor = (item: EraExplorerItem): string =>
  `My turn: ${modelLineFor(item)} Your turn. Listen again. ${item.statement} `
  + `${elicitFor(item)} — ${menuClauseFor(item)}`;

const affirmFor = (item: EraExplorerItem): string => {
  const c = correctChoiceOf(item);
  switch (item.kind) {
    case 'lens_id':
      return `Yes, that detail came ${c.closeForm} — you found where it lives.`;
    case 'era_sort':
      return `Yes, that was ${c.closeForm} — you pictured both times and chose.`;
    case 'era_compare':
      return `Yes, that was ${c.closeForm} — you weighed the two old times.`;
    case 'cause_of_change':
      return `Yes, life changed ${c.phrase} — you found the cause, not just the change.`;
  }
};

const closeLineFor = (item: EraExplorerItem): string => {
  const c = correctChoiceOf(item);
  switch (item.kind) {
    case 'lens_id': return `That detail came ${c.closeForm}. `;
    case 'era_sort':
    case 'era_compare': return `That one was ${c.closeForm}. `;
    case 'cause_of_change': return `Life changed ${c.phrase}. `;
  }
};

// ============================================================================
// The laws (family wording, grep-able)
// ============================================================================

const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/** Defect class 5 (word-sorter: 11 of 12 affirmations ran on into a fabricated
 *  next ask). Named on every contract AND in the catalog directive. */
const VERDICT_ENDS_THE_TURN =
  `Your reply ends when that quoted line ends — never run on into another question, another statement, `
  + `another era, or a next round of your own: the activity sends you every next question itself. `;

/**
 * Defect class 6, in this primitive's shape. The ask is content-rich (it reads
 * the statement aloud), so the near-empty-ask channel is not open — but the
 * SOURCE is, and it is worse: the era cards are on screen, the tutor can see
 * them described, and reading a lens aloud unprompted would answer a `lens_id`
 * item outright. The tail therefore forbids volunteering the source, the box
 * and the method, not merely reading the bracket tag.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never read the era cards or a lens aloud unless a message asks you to, `
  + `never say which of the three choices is right or rule one out, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

// ============================================================================
// The judging contracts
// ============================================================================

const acceptClauseFor = (item: EraExplorerItem): string => {
  const c = correctChoiceOf(item);
  const shorts = [c.distinguisher, ...c.alsoCounts, ORDINALS[item.correctIndex]]
    .filter(Boolean)
    .map((w) => `'${w}'`)
    .join(', ');
  return (
    `The full answer is '${c.phrase}', but a child never says a whole sentence back: `
    + `${shorts} all count on their own, and so does any of them inside a longer sentence. `
  );
};

/**
 * The signature error per mode — the wrong answer that is fluent, confident and
 * most likely to be wrongly affirmed. Every one is a documented struggle from
 * this primitive's own tutoring block, which is where a judging contract should
 * get them from: the misconceptions were observed before the port and they did
 * not change because the answer became spoken.
 */
const signatureFor = (item: EraExplorerItem): string => {
  const c = correctChoiceOf(item);
  switch (item.kind) {
    case 'lens_id':
      return (
        `The signature miss is answering with the THING instead of the lens — naming something out of the `
        + `sentence, or the era itself, rather than one of the three lenses. That is not an answer to this `
        + `question however confidently it is said. `
      );
    case 'era_sort':
      return c.distinguisher === 'both'
        ? `The signature miss here is refusing the continuity answer — judging by how old-fashioned the detail `
          + `SOUNDS and putting something that still happens back in the past. Affirm nothing but the both-times answer. `
        : `The signature miss here is the hedge — answering 'both' for something that belongs to one time only. `
          + `Count it wrong and correct it. `;
    case 'era_compare':
      return (
        `The signature miss here is weighing the statement against TODAY, which is not one of the three choices: `
        + `'today', 'now' and 'our time' are all WRONG on this question, however reasonable they sound. `
        + `Count them wrong and correct them. `
      );
    case 'cause_of_change':
      return (
        `The signature miss here is restating WHAT changed instead of naming WHY — saying the statement back, or `
        + `describing the change in other words. That is not a cause. Count it wrong and correct it. `
      );
  }
};

const judgingContract = (item: EraExplorerItem): string => {
  const c = correctChoiceOf(item);
  const others = item.choices
    .filter((_, i) => i !== item.correctIndex)
    .map((o) => `'${o.distinguisher}'`)
    .join(' or ');

  const head =
    `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks and `
    + `reads the cards, and their think time is unbounded. Never say the answer during their turn. `;

  const body =
    `The learner picks ONE of the three things the question offered, and the correct one is `
    + `${ORDINALS[item.correctIndex]} you said. `
    + acceptClauseFor(item)
    + `Picking ${others} is wrong. `
    + signatureFor(item)
    + `If what they said does not clearly pick one of the three, it is wrong. `;

  return (
    head + body + TWO_BRANCH_LAW + VERDICT_ENDS_THE_TURN
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ============================================================================
// Cues
// ============================================================================

export interface EraCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export const itemCue = (item: EraExplorerItem, opts: EraCueOptions = {}): string => {
  // The greeting names NO era: the era name is an answer-choice label in two of
  // the four modes, so an orienting "today we are visiting Pioneer Times" would
  // put an answer token into the spoken line OUTSIDE the menu. The card on
  // screen carries the era name, and the menu says it every round anyway.
  const greeting = opts.opening ? 'Hi! Time to be a historian and work out how life used to be! ' : '';
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return `[ERA_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} ${NEVER_PERFORM}`;
};

/** Correction cap reached: acknowledge warmly, CLOSE THE LINK by naming what
 *  the corrections could not, and carry the lesson forward. */
export const moveOnCue = (
  item: EraExplorerItem,
  next: EraExplorerItem | null,
  opts: EraCueOptions = {},
): string => {
  const close = closeLineFor(item);
  if (!next) {
    return (
      `[ERA_MOVE] Say exactly: "Good try! ${close}Reading the past takes practice — we will visit another time another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[ERA_MOVE] Say exactly: "Good try! ${close}Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM}`
  );
};

export const completeCue = (): string =>
  `[ERA_COMPLETE] Say exactly: "What good history today! You read what life was like and worked out the rest yourself. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer and never a hint. */
export const pronounceCue = (item: EraExplorerItem): string =>
  `[ERA_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: `
  + `"Listen again. ${item.statement} ${elicitFor(item)} — ${menuClauseFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
  + NEVER_PERFORM;

/**
 * READ THE SOURCE ALOUD — the pre-reader's only channel to an open-book
 * primitive, and the one cue in this pack the runner does not own.
 *
 * It is question-side by construction: it speaks a lens BODY, which is the
 * evidence the whole activity is built on, and never a statement, an option or
 * a verdict. It is NOT a hint ladder (the thing tap-to-hear may never become):
 * hearing the source is baseline access to it, exactly as the click era's
 * read-aloud was, and the card is on screen for a reader at the same moment.
 *
 * Sent the way the runner sends its own tap-to-hear — `sendText(..., { silent:
 * true, scripted: true })` — so it lands as a cue and not as a turn the model
 * owes a verdict on.
 */
export const sourceCue = (lensTitle: string, lensBody: string): string | null => {
  // A lens body that OPENS with a sentinel cannot be read aloud: the reducer
  // scans the tutor's sentences for exactly those openers, so "Yes, families
  // cooked on a wood stove…" arrives as an affirmation of an answer nobody
  // gave and desyncs the loop. The body is generated, so this is a live risk
  // and not a formality — and it also carries a double quote check, because
  // one would close the cue's own spoken span early.
  if (!lensBody || opensWithSentinel(lensBody) || /["“”]/.test(lensBody)) return null;
  return (
    `[ERA_SOURCE] The learner tapped to hear the ${lensTitle} card and cannot read it themselves. `
    + `Say ONLY this, warmly and slowly, then wait: "${lensBody}" `
    + `Read it word for word. Do not summarise it, do not add a question, do not treat anything you just `
    + `heard as an answer, and never say which choice it points to. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY, and
 * answer-free by construction.
 *
 * Defect 12: this string goes LAST in the catalog's `taskDescription`, with the
 * never-read-aloud clause IMMEDIATELY before it. It names no era, no lens and
 * no cause on purpose: two of the four modes answer with an era name and one
 * with a lens title, so a scenic description is the only shape that cannot
 * become a live audio channel to the answer.
 */
export const stimulusFor = (item: EraExplorerItem): string => {
  switch (item.kind) {
    case 'lens_id':
      return 'the era cards with their three lens tabs, open beside the sentence being judged; '
        + 'this state line is for you alone and is never spoken to the learner';
    case 'era_sort':
      return 'the era cards, open beside the sentence being judged';
    case 'era_compare':
      return 'two era cards side by side — the earlier time and the later one — beside the sentence being judged';
    case 'cause_of_change':
      return 'the era cards, open beside a sentence describing something that changed';
  }
};

// ============================================================================
// THE WIRE — what the tutor is told, shared with the DI drive harness
// ============================================================================

export const eraExplorerPackBase = (
  items: EraExplorerItem[],
): JudgedCueSurface<EraExplorerItem> => ({
  primitiveType: 'era-explorer',
  activityLine: 'live direct instruction historical thinking practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.challengeType,
    stimulus: stimulusFor(item),
  }),
});

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

/** The confident wrong answer this mode's contract CLAIMS the judge refuses. */
const signatureWrongFor = (item: EraExplorerItem): { text: string; why: string } => {
  const c = correctChoiceOf(item);
  switch (item.kind) {
    case 'lens_id':
      return {
        text: toWords(item.statement).slice(0, 3).join(' '),
        why: 'the THING named instead of the lens — the child says what the sentence is about, which is fluent, '
          + 'confident, and answers a question that was not asked',
      };
    case 'era_sort':
      return c.distinguisher === 'both'
        ? {
          text: 'back then',
          why: 'the continuity answer refused because the detail SOUNDS old-fashioned — this primitive\'s '
            + 'first documented struggle, and the one an over-eager judge affirms',
        }
        : {
          text: 'both',
          why: 'the hedge — "both" is never obviously wrong to a child, which is exactly why a lenient judge affirms it',
        };
    case 'era_compare':
      return {
        text: 'today',
        why: 'the era weighed against TODAY instead of against the era before it — not one of the three choices '
          + 'at all, and the documented struggle for this mode',
      };
    case 'cause_of_change':
      return {
        text: toWords(item.statement).slice(0, 5).join(' '),
        why: 'WHAT changed restated instead of WHY — the statement said back, which sounds like an answer and is not a cause',
      };
  }
};

export const eraExplorerHarnessAnswers = (item: EraExplorerItem) => {
  const c = correctChoiceOf(item);
  const wrong = item.choices.find((_, i) => i !== item.correctIndex)!;
  return {
    correct: c.distinguisher,
    plainWrong: wrong.distinguisher,
    signatureWrong: signatureWrongFor(item),
    leakTokens: [c.distinguisher],
    /**
     * Two spans, and only one of them is tier-conditional.
     *
     * The MENU is a legal part of the ask at every tier (the mats rule) — all
     * three options are spoken by construction, so naming them discloses none.
     * The MODEL line names every option KIND for the same reason, and it is
     * exempt unconditionally because the CORRECTION re-models at every tier,
     * `hard` included: the tier governs what the ASK carries, not what a
     * correction may teach. The GUIDE line is the one that moves — spoken at
     * `easy` only, so exempt only there, and at `hard` the lead-in is empty and
     * the whole cue is governed by the menu alone.
     */
    leakExemptSpan: [
      menuClauseFor(item),
      modelLineFor(item),
      ...(item.tier === 'easy' ? [guideLineFor(item)] : []),
    ],
  };
};
