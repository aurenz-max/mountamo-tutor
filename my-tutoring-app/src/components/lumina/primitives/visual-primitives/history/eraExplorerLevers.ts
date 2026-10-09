/**
 * The in-item levers on era-explorer (`/add-support-tiers`, report qa/eval-reports/era-explorer-levers-2026-10-08.md).
 * No real-learner evidence: the misses are what `eraSpokenMisses` names on each mode's spoken pick.
 *
 * Every answer is one of three choices the ask names aloud, and the catalog rule is "never name the box": no lever
 * marks a card, a lens or a choice. Help either lays out what is already evidence (the cards, all open at once), puts
 * two empty checks under the detail, or draws a model change from everyday life beside the item. Simplify opens a
 * practice item `<item>~simpler`:
 *
 * - lens_id: `side_by_side` (help) all three era cards open together; `on_the_card` (simplify) a detail copied word
 *   for word from one card, the same three lenses to choose from (find the words, instead of matching a paraphrase).
 * - era_sort: `two_checks` (help) "Back then, in <era>?" and "Today, in your own life?", both empty. No simplify: the
 *   three-bin menu is the mode's floor ("both" IS continuity), and code cannot author a fact about an arbitrary era.
 * - era_compare: `two_checks` (help) "In <earlier era>?" and "In <later era>?", both empty. No simplify, same reason.
 * - cause_of_change: `model_change` (help) a model change from everyday life, its cause, what changed and a line true
 *   at the time, each tagged. No simplify: one change and three causes is the plainest shape of the ask.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  containsPhrase, eraTokens, toWords, type EraExplorerItem, type EraTier,
} from './eraExplorerScript';
import type { SpokenEraMiss } from './eraExplorerWorkspace';

export const SIDE_BY_SIDE_LEVER = 'side_by_side';
export const ON_THE_CARD_LEVER = 'on_the_card';
export const TWO_CHECKS_LEVER = 'two_checks';
export const MODEL_CHANGE_LEVER = 'model_change';
export const PRACTICE_SUFFIX = '~simpler';

/** What a lever reads beyond the item: the lesson's items and its era card. */
export interface EraLeverSession {
  items: readonly EraExplorerItem[];
  eraName: string;
  priorEraName: string;
  lenses: readonly { title: string; body: string }[];
}

const seedOf = (id: string) => Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const STOP = new Set(['with', 'from', 'into', 'onto', 'over', 'their', 'they', 'them', 'this', 'that', 'there', 'then',
  'when', 'have', 'each', 'every', 'only', 'just', 'some', 'more', 'most', 'other', 'were', 'what', 'made', 'used']);
const words = (text: string) => Array.from(new Set(eraTokens(text).filter(w => w.length >= 4 && !STOP.has(w))));

/** Two texts read as the same thing when they share two content words or more. */
const readsAs = (text: string, others: readonly string[]) => {
  const mine = words(text);
  return others.some(o => { const theirs = new Set(words(o)); return mine.filter(w => theirs.has(w)).length >= 2; });
};

/** Every statement and choice the lesson speaks. */
const sessionTexts = (s: EraLeverSession) => s.items.flatMap(i => [i.statement, ...i.choices.map(c => c.label)]);

// ── two_checks (era_sort, era_compare) ─────────────────────────────────────

/** The two empty checks. Built from the mode and the era names only, so they are the same whatever the answer. */
export function twoChecksFor(item: EraExplorerItem, s: EraLeverSession): [string, string] | null {
  if (item.kind === 'era_sort') return [`Back then, in ${s.eraName}?`, 'Today, in your own life?'];
  if (item.kind === 'era_compare' && s.priorEraName) return [`In ${s.priorEraName}?`, `In ${s.eraName}?`];
  return null;
}

// ── model_change (cause_of_change) ─────────────────────────────────────────

/** A change from everyday life with its cause, and a line that was true at the time but did not make it change. */
export interface ChangeModel { id: string; icon: string; change: string; cause: string; notWhy: string }

/** One invention, one new rule, one new way to earn a living, one more invention: the model never teaches a kind. */
export const CHANGE_MODELS: readonly ChangeModel[] = [
  { id: 'movies', icon: '🎬', change: 'Most families stopped renting movies at a video store.',
    cause: 'Movies began streaming over the internet to screens at home.', notWhy: 'The video stores had bright posters in their windows.' },
  { id: 'helmets', icon: '🚲', change: 'Kids in our town started wearing helmets on their bikes.',
    cause: 'A new town rule said every rider needs a helmet.', notWhy: 'The bikes came in lots of colors.' },
  { id: 'kitchen', icon: '💻', change: 'Lots of grown-ups started doing their jobs at the kitchen table.',
    cause: 'Offices let people do their jobs on a computer at home.', notWhy: 'The kitchen tables were painted blue.' },
  { id: 'maps', icon: '🗺️', change: 'Drivers stopped unfolding big paper maps in the car.',
    cause: 'Phones got map apps that speak every turn.', notWhy: 'The paper maps were folded into small squares.' },
];

/** Leak rule for a model: any line of it that reads as one of the lesson's statements or choices. */
export const modelLeaks = (m: ChangeModel, s: EraLeverSession) =>
  [m.change, m.cause, m.notWhy].some(t => readsAs(t, sessionTexts(s)));

export function changeModelFor(item: EraExplorerItem, s: EraLeverSession): ChangeModel | null {
  if (item.kind !== 'cause_of_change') return null;
  const ok = CHANGE_MODELS.filter(m => !modelLeaks(m, s));
  return ok.length ? ok[seedOf(item.id) % ok.length] : null;
}

export const MODEL_TAGS = { change: 'what changed', cause: 'why: it came first and made the change happen', notWhy: 'true then, but not why' } as const;

// ── on_the_card (lens_id simplify) ─────────────────────────────────────────

const sentencesOf = (body: string) => body.split(/(?<=[.!?])\s+/).map(t => t.trim()).filter(t => toWords(t).length >= 5 && !/["“”]/.test(t));

/**
 * The practice item for a lens_id item: one card sentence, word for word, that no statement or choice of the lesson
 * reads as and that names no lens, with the item's own three-lens menu. Null where no such sentence exists.
 */
export function practiceItem(item: EraExplorerItem, s: EraLeverSession): EraExplorerItem | null {
  if (item.kind !== 'lens_id') return null;
  const candidates = s.lenses.flatMap(lens => sentencesOf(lens.body).map(text => ({ text, lens: lens.title })));
  if (!candidates.length) return null;
  const at = seedOf(item.id) % candidates.length;
  for (const { text, lens } of [...candidates.slice(at), ...candidates.slice(0, at)]) {
    const correctIndex = item.choices.findIndex(c => c.label === lens);
    if (correctIndex < 0) continue;
    const built: EraExplorerItem = { ...item, id: `${item.id}${PRACTICE_SUFFIX}`, statement: text, correctIndex, explanation: undefined };
    if (!practiceLeaks(built, item, s)) return built;
  }
  return null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string, items: readonly EraExplorerItem[]) =>
  items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null;

/**
 * Leak rule for a practice item: never the item's id or kind changed, never a menu other than the item's, a sentence
 * found word for word on the card of its own answer, with no word of a lens name, reading as no statement or choice of
 * the lesson.
 */
export function practiceLeaks(practice: EraExplorerItem, item: EraExplorerItem, s: EraLeverSession): boolean {
  if (practice.id === item.id || practice.kind !== 'lens_id' || item.kind !== 'lens_id') return true;
  if (practice.choices.map(c => c.label).join('|') !== item.choices.map(c => c.label).join('|')) return true;
  const card = s.lenses.find(l => l.title === practice.choices[practice.correctIndex]?.label);
  if (!card || !card.body.includes(practice.statement)) return true;
  // Not a lens name, nor any word of one ("school" in a School & Work sentence would answer it outright).
  const said = new Set(words(practice.statement));
  if (s.lenses.some(l => containsPhrase(practice.statement, l.title) || words(l.title).some(w => said.has(w)))) return true;
  return readsAs(practice.statement, sessionTexts(s));
}

// ── what is on screen ──────────────────────────────────────────────────────

const plain = (t: string) => t.replace(/[.!?]+$/, '');

/** What the pulled levers put on screen, for the tutor and JEV: what is drawn, never this item's answer. */
export function leversOnScreen(item: EraExplorerItem, on: readonly string[], s: EraLeverSession): string | null {
  const parts: string[] = [];
  if (on.includes(SIDE_BY_SIDE_LEVER) && item.kind === 'lens_id') {
    parts.push(`all three era cards are open side by side, each under its lens name (${s.lenses.map(l => l.title).join(', ')}). Nothing on a card is marked`);
  }
  const checks = on.includes(TWO_CHECKS_LEVER) ? twoChecksFor(item, s) : null;
  if (checks) parts.push(`under the detail, two empty checks: "${checks[0]}" and "${checks[1]}". Neither is ticked`);
  const model = on.includes(MODEL_CHANGE_LEVER) ? changeModelFor(item, s) : null;
  if (model) {
    parts.push(`beside the item, a model from everyday life, not this item: "${plain(model.change)}" (tagged ${MODEL_TAGS.change}); `
      + `"${plain(model.cause)}" (tagged ${MODEL_TAGS.cause}); "${plain(model.notWhy)}" (tagged ${MODEL_TAGS.notWhy})`);
  }
  return parts.length ? parts.join('; ') : null;
}

// ── the levers ─────────────────────────────────────────────────────────────

const LENS_MISSES: SpokenEraMiss[] = ['other_lens', 'named_a_thing'];
const SORT_MISSES: SpokenEraMiss[] = ['said_back_then', 'said_today', 'said_both'];
const COMPARE_MISSES: SpokenEraMiss[] = ['said_earlier', 'said_later', 'said_both', 'said_today'];
const CAUSE_MISSES: SpokenEraMiss[] = ['other_cause', 'said_what_changed'];

export function eraLevers(item: EraExplorerItem | null, s: EraLeverSession, pulled: readonly string[],
  starting: readonly string[] = []): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], answers: readonly string[], when: string, does: string) => {
    if (!starting.includes(id)) levers.push({ id, kind, carrier: 'both', pulled: pulled.includes(id), answers, when, does });
  };
  if (item.kind === 'lens_id') {
    add(SIDE_BY_SIDE_LEVER, 'help', LENS_MISSES, 'The learner names the wrong lens, or a thing from the sentence instead of a lens.',
      'Lays all three era cards open side by side, each under its lens name, so the learner can look through every card at once. '
      + 'Nothing is marked. Never say which card holds the detail or read the matching words.');
    if (practiceItem(item, s)) add(ON_THE_CARD_LEVER, 'simplify', LENS_MISSES, 'The learner still cannot find the lens after help.',
      'Opens an easier practice item first: a detail copied word for word from one era card, with the same three lenses to choose from. '
      + 'Not graded; the full item comes back after it.');
  } else if (item.kind === 'era_sort' || item.kind === 'era_compare') {
    const checks = twoChecksFor(item, s);
    if (checks) add(TWO_CHECKS_LEVER, 'help', item.kind === 'era_sort' ? SORT_MISSES : COMPARE_MISSES,
      item.kind === 'era_sort' ? 'The learner puts a detail in one time only when it is true in both, or in both when it belongs to one.'
        : 'The learner picks the wrong one of the two past times, says both for one, or says today.',
      `Puts two empty checks under the detail: "${checks[0]}" and "${checks[1]}". Read them and let the learner answer each one `
      + 'from the cards. Never tick one, answer either, or say which choice the learner\'s two answers make.');
  } else {
    if (changeModelFor(item, s)) add(MODEL_CHANGE_LEVER, 'help', CAUSE_MISSES, 'The learner picks a cause that did not make the change, or says what changed instead of why.',
      'Shows a model from everyday life beside the item: a change, the cause that made it happen, and a line that was true then but is '
      + 'not why, each tagged. Read the model if you like; never say which of the learner\'s three causes is like the model\'s cause.');
  }
  return levers;
}

/** Phase 6: easy starts lens_id with the cards side by side and the two time modes with the two checks. Not a pull. */
export const startingLevers = (tier: EraTier | string | undefined, item: EraExplorerItem | null): string[] => {
  if (tier !== 'easy' || !item) return [];
  if (item.kind === 'lens_id') return [SIDE_BY_SIDE_LEVER];
  if (item.kind === 'era_sort' || item.kind === 'era_compare') return [TWO_CHECKS_LEVER];
  return [];
};

/** The lever session for a payload: the shared shape the component, the journey and the tests build. */
export const eraLeverSession = (items: readonly EraExplorerItem[], data: {
  eraName?: string; priorEra?: { name: string }; lenses?: readonly { title: string; body: string }[];
}): EraLeverSession => ({ items, eraName: data.eraName ?? '', priorEraName: data.priorEra?.name ?? '', lenses: data.lenses ?? [] });
