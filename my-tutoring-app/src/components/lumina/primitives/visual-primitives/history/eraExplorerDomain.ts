/**
 * era-explorer's domain: the build gates that turn a lesson's challenges into spoken items, the ask, the key, the
 * known misses and the scene. Pure; the boss (`eraExplorer.boss.ts`), the levers and the component read it, and the
 * generator imports its leak gates from here so both sides of the wire run one copy.
 *
 * Every item is SAID: one whole choice out of three that the ask names aloud (a menu key).
 *
 *   lens_id          which lens a life detail came from
 *   era_sort         only back then, only today, or both
 *   era_compare      only in the era before, only in this era, or both
 *   cause_of_change  which of three causes changed life
 *
 * The era cards are open-book evidence and stay on screen; consulting them is the historian's method.
 *
 * What the build owes, and why:
 *  - THE STATEMENT IS READ ALOUD, so a statement carrying its own answer costs the whole item. The generator's four
 *    audits (`statementLeaks`: verbatim lens copy, lens title named, time word or year, causal connective or cause
 *    echo) re-run here, plus `answerWordsInStatement`: the statement may not carry the words that distinguish its own
 *    correct choice, a leak that exists only once the menu is spoken.
 *  - EAR-SEPARABILITY IS A BUILD GATE (`optionsEarSeparable`): every option owns a content word no other option
 *    carries, or an utterance fits two of them and there is no honest verdict. An item whose nearest distractors are
 *    not separable by ear drops rather than shipping an unjudgeable ask.
 *  - AN ANSWER IS NOT REPEATED: a lens is the answer once per session, and consecutive items of a fixed-bin mode do
 *    not share an answer. The modes ship as runs in ladder order (locate, place in time, contrast, explain).
 *  - Keep-or-drop, never backfill: a placeholder becomes a spoken ask with no honest verdict behind it.
 */

import {
  opensWithSentinel,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';

// ============================================================================
// Domain
// ============================================================================

export type EraKind = 'lens_id' | 'era_sort' | 'era_compare' | 'cause_of_change';
export type EraTier = 'easy' | 'medium' | 'hard';

/** Ladder order: locate → place in time → contrast two past times → explain.
 *  Also the order items ship in. */
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
 * `distinguisher` or anything in `alsoCounts`; the reveal prints `label`.
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
          distinguisher: 'back then',
          alsoCounts: ['long ago', 'only then', ...eraShortForms(era)],
        },
        {
          label: options[1],
          phrase: 'only today in your own life',
          distinguisher: 'today',
          alsoCounts: ['now', 'our time', 'my day'],
        },
        {
          label: options[2],
          phrase: 'true in both times',
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
          distinguisher: earlier,
          alsoCounts: [...eraShortForms(earlier), 'the earlier one'],
        },
        {
          label: options[1],
          phrase: `only in ${later}`,
          distinguisher: later,
          alsoCounts: [...eraShortForms(later), 'the later one'],
        },
        {
          label: options[2],
          phrase: 'true in both of those times',
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

/** A generated statement or option with a double quote is dropped: it is read aloud, and quoted speech inside a
 *  detail reads as someone's answer. */
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
 *  - the modes ship as RUNS in `ERA_KINDS` order, which is the pedagogically
 *    right order: locate → place in time → contrast two past times → explain
 *    the cause.
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
// The lesson's items
// ============================================================================

/** The lesson fields the build reads. */
export interface EraPayloadLike {
  eraName?: string;
  priorEra?: { name: string; body: string };
  lenses?: { title: string; body: string }[];
  challenges?: EraChallengeLike[];
  supportTier?: EraTier;
}

/** The items a lesson asks, built by the gates above: shared by the component, the boss and the levers. */
export const eraItems = (data: EraPayloadLike): EraExplorerItem[] => {
  const lenses = data.lenses ?? [];
  return itemsFromChallenges(data.challenges ?? [], {
    eraName: data.eraName ?? '', priorEraName: data.priorEra?.name ?? '',
    lensTitles: lenses.map(l => l.title), lensBodies: lenses.map(l => l.body),
  }, { tier: data.supportTier });
};

// ============================================================================
// The ask
// ============================================================================

/** The menu IS the ask (a closed set said in full every time): without it the answer set is open and unjudgeable. */
export const menuClauseFor = (item: EraExplorerItem): string => {
  const [a, b, c] = item.choices.map((ch) => ch.phrase);
  return `was it ${a}, ${b}, or ${c}?`;
};

/** The part of the ask that names the move. */
const elicitFor = (item: EraExplorerItem): string => {
  switch (item.kind) {
    case 'lens_id': return 'Say which lens that came from';
    case 'era_sort': return 'Say when life looked like that';
    case 'era_compare': return 'Say which time that belongs to';
    case 'cause_of_change': return 'Say why life changed';
  }
};

/** The detail, then the move and the three choices. */
export const askFor = (item: EraExplorerItem): string =>
  `${item.statement} ${elicitFor(item)}: ${menuClauseFor(item)}`;

// ============================================================================
// The key
// ============================================================================

const PLACES = ['the first one', 'the second one', 'the third one'];

/** The wrong answer that sounds right, per mode (this primitive's documented struggles). */
const SIGNATURE: Record<EraKind, (both: boolean) => string> = {
  lens_id: () => 'Naming a thing from the sentence, or the era itself, instead of a lens is not an answer.',
  era_sort: both => (both ? 'Putting something that still happens back in the past because it sounds old-fashioned is wrong.'
    : '"Both" for something that belongs to one time only is wrong.'),
  era_compare: () => '"Today", "now" and "our time" are not choices here and are wrong: both times offered are in the past.',
  cause_of_change: () => 'Saying what changed instead of why it changed is not a cause.',
};

/**
 * The key the tutor judges each item with: a menu key over the three phrases the ask says. A child never says the
 * whole phrase back, so the choice's short forms and its place in the menu count.
 */
export function eraKey(item: EraExplorerItem): SpokenKey {
  const c = correctChoiceOf(item);
  const others = item.choices.filter((_, i) => i !== item.correctIndex).map(o => `"${o.distinguisher}"`).join(' and ');
  return {
    answer: c.phrase,
    alsoAccept: [c.distinguisher, ...c.alsoCounts, PLACES[item.correctIndex]],
    menu: item.choices.map(ch => ch.phrase),
    acceptRule: 'A short form counts on its own or inside a sentence.',
    signatureError: `${others} are wrong, and so is an answer that does not pick exactly one of the three. `
      + SIGNATURE[item.kind](c.distinguisher === 'both'),
  };
}

// ============================================================================
// Known misses
// ============================================================================

/** What a wrong spoken pick shows (handoff 20 Part B), by the choice picked. */
export type SpokenEraMiss = 'said_back_then' | 'said_today' | 'said_both' | 'other_cause' | 'said_what_changed'
  | 'other_lens' | 'named_a_thing' | 'said_earlier' | 'said_later';

/** era_sort's menu, in the ask's order: only then, only today, both. */
const SORT_IDS = ['said_back_then', 'said_today', 'said_both'] as const;
/** era_compare's menu, in the ask's order: only the earlier era, only the later one, both. */
const COMPARE_IDS = ['said_earlier', 'said_later', 'said_both'] as const;
/** Words too plain to stand for "a thing from the sentence". */
const THING_STOP = new Set(['their', 'there', 'they', 'with', 'from', 'that', 'this', 'had', 'have', 'were', 'used', 'every',
  'single', 'right', 'together', 'different', 'own', 'help']);

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: on era_sort, each other time
 * named for what it is; on era_compare, each other choice, then "today" (not a choice there); on lens_id, another lens,
 * then a thing from the sentence named instead of a lens; on cause_of_change, another offered cause, then what changed
 * said instead of why.
 */
export function eraSpokenMisses(item: EraExplorerItem): KnownMiss[] {
  const right = correctChoiceOf(item);
  if ((item.kind === 'era_sort' || item.kind === 'era_compare') && item.choices.length === 3) {
    const ids = item.kind === 'era_sort' ? SORT_IDS : COMPARE_IDS;
    const picks: KnownMiss[] = item.choices.flatMap((c, i) => i === item.correctIndex ? [] : [{ id: ids[i],
      pattern: `The right choice is "${right.phrase}". The learner picks "${c.phrase}" instead, for example ${[c.distinguisher, ...c.alsoCounts].slice(0, 2).map(w => `"${w}"`).join(' or ')}.`,
      examples: [c.distinguisher] }]);
    return item.kind === 'era_sort' ? picks : [...picks, { id: 'said_today',
      pattern: 'The learner says "today", "now" or "our time", which is not one of the three choices: both times offered are in the past.',
      examples: ['today', 'now'] }];
  }
  if (item.kind === 'lens_id' && item.choices.length === 3) {
    const others = item.choices.filter((_, i) => i !== item.correctIndex);
    const menu = new Set(item.choices.flatMap(c => eraTokens(`${c.phrase} ${c.distinguisher} ${c.alsoCounts.join(' ')}`)));
    const thing = toWords(item.statement).find(w => w.length >= 4 && !menu.has(eraTokens(w)[0] ?? w) && !THING_STOP.has(w));
    return [
      { id: 'other_lens', pattern: `The right choice is "${right.phrase}". The learner names another lens instead: ${others.map(o => `"${o.phrase}"`).join(' or ')}.`,
        examples: others.map(o => o.distinguisher) },
      ...(thing ? [{ id: 'named_a_thing', pattern: `The learner names something from the sentence, for example "${thing}", instead of naming a lens.`,
        examples: [thing] }] : []),
    ];
  }
  if (item.kind === 'cause_of_change') {
    const others = item.choices.filter((_, i) => i !== item.correctIndex);
    return [
      { id: 'other_cause', pattern: `The right choice is "${right.phrase}". The learner picks another offered cause instead: ${others.map(o => `"${o.phrase}"`).join(' or ')}.`,
        examples: others.map(o => o.distinguisher).slice(0, 2) },
      { id: 'said_what_changed', pattern: `The learner says what changed ("${item.statement.replace(/[.!?]+$/, '')}") instead of why it changed.`,
        examples: [item.statement.replace(/[.!?]+$/, '')] },
    ];
  }
  return [];
}

// ============================================================================
// Scene
// ============================================================================

/** What is drawn: the detail and, while the cards are open, every lens card (and the era before on a compare item). */
export function eraScene(item: EraExplorerItem, data: EraPayloadLike,
  view: { cardsOpen: boolean; readsAloud: boolean; practice?: boolean }): SceneOf {
  const facts: Record<string, string> = { statement: item.statement };
  if (view.cardsOpen) {
    (data.lenses ?? []).forEach((lens, i) => Object.assign(facts, textFacts(`card${i + 1}`, `${lens.title}: ${lens.body}`)));
    if (item.kind === 'era_compare' && data.priorEra) Object.assign(facts, textFacts('before', `Before that, ${data.priorEra.name}: ${data.priorEra.body}`));
  } else {
    facts.cards = 'The era cards are folded away; the learner can open them.';
  }
  facts.constraints = 'No choice is printed until the answer is credited.'
    + (view.readsAloud ? ' The learner does not read yet: read the detail aloud, and a card when the learner asks.' : '');
  if (view.practice) facts.practice = 'An easier practice item, ungraded: its detail is copied word for word from one era card. '
    + 'The full item comes back after it.';
  return { objects: [], facts };
}

/** What a card's read-aloud asks the tutor: the lens body, word for word. It never names a choice. */
export const hearCardRequest = (title: string, body: string) =>
  `The learner tapped to hear the ${title} card. Read it aloud once, word for word, and nothing else: "${body}"`;

// ============================================================================
// Harness answer material
// ============================================================================

/** The journey's answers: the choice's short form, or another choice's. */
export const eraExplorerHarnessAnswers = (item: EraExplorerItem): { correct: string; plainWrong: string } => {
  const wrong = item.choices.find((_, i) => i !== item.correctIndex)!;
  return { correct: correctChoiceOf(item).distinguisher, plainWrong: wrong.distinguisher };
};
