/**
 * rhyme-studio's domain: the items, the ask, the spoken key, the known misses, the scene, the content gate and the
 * harness's answers. Pure; the boss, the levers, the component and the tests read the same rules.
 *
 * Every word item is one spoken answer: yes or no (recognition), the rhyming choice (identification), any real rhyme
 * (production), or a new rhyme for the family being collected (collection). The ask never names the ending: it is the
 * answer's family. Production and collection are judged by a RULE, never a list (contract R3: a generated "acceptable
 * answer" was once the nonword "nake"), so their key names no example rhyme. A board item (`pair_build`) is the shared
 * pair board (`rhymePairBuild.ts`); its check lives there.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import type { RhymeStudioData } from './RhymeStudio';
import { isSentinelSafeWord, onsetOf, rimeOfWord, sessionWords, type SessionWords } from './rhymeModels';
import { ASK, pairItemsFrom, pairMiss, rhymingPairs, type RhymePairItem } from './rhymePairBuild';

export type RhymeMode = 'recognition' | 'identification' | 'production' | 'collection';
export type RhymeTier = SupportTier;
export const RHYME_COLLECTION_SIZE = 3;

export interface RhymeChoice {
  word: string;
  /** Pre-reader picture surface; absent at reader grades. */
  emoji?: string;
  isCorrect: boolean;
}

/** One spoken ask. A collection challenge expands into three of them that share one family on screen. */
export interface RhymeItem {
  id: string;
  /** The generator challenge that owns this response. */
  challengeId: string;
  mode: RhymeMode;
  /** The stimulus, never the answer. */
  targetWord: string;
  targetEmoji?: string;
  /** "-at" → "at". Never said before a credited answer. */
  rime: string;
  tier: RhymeTier;
  comparisonWord?: string;
  comparisonEmoji?: string;
  doesRhyme?: boolean;
  /** The on-screen set (identification only). */
  choices: RhymeChoice[];
  /** The words that count, when the mode has a closed set: the verdict, or the rhyming choice. Empty when open. */
  acceptedWords: string[];
  answer: string;
  /** Whether the tutor may read the choices aloud (forced on at the pre-reader band). */
  namesChoices: boolean;
  collectionId?: string;
  collectionSlot?: number;
  collectionSize?: number;
  /** The family's credited words from earlier slots, which a later slot may not repeat (runtime state). */
  priorAcceptedWords: string[];
}

/** A picture board on pair_build, stamped with its mode and the lesson's tier (when the model lever comes). */
export type RhymeBoard = RhymePairItem & { mode: 'pair_build'; tier: RhymeTier };
export type RhymeStudioItem = RhymeItem | RhymeBoard;

export const isRhymeBoard = (item: RhymeStudioItem): item is RhymeBoard => item.mode === 'pair_build';
export const asRhymeBoard = (item: RhymePairItem, tier: RhymeTier): RhymeBoard => ({ ...item, mode: 'pair_build', tier });

/** The challenge as the generator emits it (structural, so this module never imports the component's values). */
export interface RhymeChallengeLike {
  id: string;
  mode: RhymeMode;
  targetWord: string;
  targetWordEmoji?: string;
  rhymeFamily: string;
  comparisonWord?: string;
  comparisonWordEmoji?: string;
  doesRhyme?: boolean;
  options?: Array<{ word: string; image?: string; isCorrect: boolean }>;
  tutorNamesOptions?: boolean;
}

/** "-at" → "at". */
export const rimeOf = (rhymeFamily: string): string => rhymeFamily.trim().replace(/^-+/, '').toLowerCase();

/** One challenge as one item. Only identification has choices; the accepted set is exactly what is on screen. */
export function itemFromChallenge(ch: RhymeChallengeLike, tier: RhymeTier = 'medium'): RhymeItem {
  const choices: RhymeChoice[] = ch.mode === 'identification'
    ? (ch.options ?? []).filter(o => isSentinelSafeWord(o.word)).map(o => ({ word: o.word, emoji: o.image, isCorrect: o.isCorrect }))
    : [];
  const accepted = ch.mode === 'recognition' ? [ch.doesRhyme ? 'yes' : 'no']
    : ch.mode === 'identification' ? choices.filter(c => c.isCorrect).map(c => c.word) : [];
  return {
    id: ch.id, challengeId: ch.id, mode: ch.mode, targetWord: ch.targetWord, targetEmoji: ch.targetWordEmoji,
    rime: rimeOf(ch.rhymeFamily), tier, comparisonWord: ch.comparisonWord, comparisonEmoji: ch.comparisonWordEmoji,
    doesRhyme: ch.doesRhyme, choices, acceptedWords: accepted, answer: accepted[0] ?? '',
    // Band floor: the generator forces this true at K; the tier may withdraw it only for readers.
    namesChoices: ch.tutorNamesOptions !== false, priorAcceptedWords: [],
  };
}

/** One collection challenge is three independently judged spoken turns on one family; any other challenge is one item. */
export function itemsFromChallenge(ch: RhymeChallengeLike, tier: RhymeTier = 'medium'): RhymeItem[] {
  const base = itemFromChallenge(ch, tier);
  if (ch.mode !== 'collection') return [base];
  return Array.from({ length: RHYME_COLLECTION_SIZE }, (_, index) => ({ ...base, id: `${ch.id}-slot-${index + 1}`,
    collectionId: ch.id, collectionSlot: index + 1, collectionSize: RHYME_COLLECTION_SIZE, priorAcceptedWords: [] }));
}

const tierOf = (data: Pick<RhymeStudioData, 'supportTier'>): RhymeTier => data.supportTier ?? 'medium';

/** The session's items: the picture boards on pair_build, the spoken asks otherwise. */
export function rhymeStudioItems(data: RhymeStudioData): RhymeStudioItem[] {
  if (data.task === 'pair_build') return pairItemsFrom(data.pairItems ?? [], data.supportTier).map(i => asRhymeBoard(i, tierOf(data)));
  return (data.challenges ?? []).flatMap(c => itemsFromChallenge(c as RhymeChallengeLike, tierOf(data)));
}

/** The last word of a short transcript ("I said hat" → "hat"): the learner's response. */
export const normalizeCollectedRhyme = (transcript: string): string => {
  const words = transcript.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? [];
  return words[words.length - 1] ?? '';
};

/** Keep a credited collection word and expose it to every later slot of its family. Returns the family's words. */
export function recordCollectedRhyme(items: readonly RhymeItem[], item: RhymeItem, transcript: string): string[] {
  if (item.mode !== 'collection' || !item.collectionId) return [];
  const word = normalizeCollectedRhyme(transcript);
  const group = items.filter(candidate => candidate.collectionId === item.collectionId);
  const existing = group.reduce<string[]>((longest, c) => (c.priorAcceptedWords.length > longest.length ? c.priorAcceptedWords : longest), []);
  const next = word && !existing.some(a => normalizeCollectedRhyme(a) === word) ? [...existing, word] : [...existing];
  for (const candidate of group) candidate.priorAcceptedWords = [...next];
  return next;
}

/** Every word a session asks, compares or offers, with its families: what a model or practice item may not use. */
export const rhymeSessionWords = (items: ReadonlyArray<Pick<RhymeItem, 'rime' | 'targetWord' | 'comparisonWord' | 'choices'>>): SessionWords =>
  sessionWords(items.flatMap(i => [i.targetWord, i.comparisonWord ?? '', ...i.choices.map(c => c.word)]), items.map(i => i.rime));

// ── The ask and the key ─────────────────────────────────────────────────────

const waysLine = (board: RhymePairItem) => (board.ways === 2 ? ' Then find a different pair.' : '');

/** What the learner is asked. The ending sound is never named: it is the answer's family. */
export function rhymeAsk(item: RhymeStudioItem): string {
  if (isRhymeBoard(item)) return `${ASK}${waysLine(item)}`;
  switch (item.mode) {
    case 'recognition':
      return `Listen to these two words: ${item.targetWord}, ${item.comparisonWord}. Do they rhyme? Say yes or no.`;
    case 'identification':
      return `Listen to this word: ${item.targetWord}. Which word on the screen rhymes with ${item.targetWord}? Say it.`;
    case 'production':
      return `Listen to this word: ${item.targetWord}. Tell me a word that rhymes with ${item.targetWord}.`;
    case 'collection':
      return `Listen to this word: ${item.targetWord}. Say a new word that rhymes with ${item.targetWord}.`;
  }
}

/** What the ask says by design: recognition's "yes or no" is the question, not its answer. */
export const rhymeGiven = (item: RhymeStudioItem): readonly string[] =>
  (!isRhymeBoard(item) && item.mode === 'recognition' ? ['Say yes or no.'] : []);

/**
 * The spoken key; null on a board (the board checks it). Production and collection carry the rule and no example
 * rhyme (R3); collection also names the words the family already holds.
 */
export function rhymeKey(item: RhymeStudioItem): SpokenKey | null {
  if (isRhymeBoard(item)) return null;
  const t = item.targetWord;
  const notIt = `${t} said back, a word that only starts like ${t}, a word that only means something close, or a made-up `
    + 'word is not a rhyme.';
  switch (item.mode) {
    case 'recognition':
      return item.doesRhyme
        ? { answer: 'yes', alsoAccept: ['yeah', 'yep'], acceptRule: `${t} and ${item.comparisonWord} end with the same sound; `
            + 'any natural yes counts ("they do", "they rhyme").', signatureError: `Saying ${t} back is not a verdict.` }
        : { answer: 'no', alsoAccept: ['nope'], acceptRule: `${t} and ${item.comparisonWord} do not end with the same sound; `
            + 'any natural no counts ("they don\'t").', signatureError: `Saying ${t} back is not a verdict.` };
    case 'identification':
      return { answer: item.answer, alsoAccept: [],
        acceptRule: `It is the choice on the screen (${item.choices.map(c => c.word).join(', ')}) that rhymes with ${t}.`,
        signatureError: `${t} said back, or a word that is not one of the choices, does not answer.` };
    case 'production':
      return { answer: `any real word that rhymes with ${t}`, alsoAccept: [],
        acceptRule: `Any real word that ends with the same sound as ${t} (-${item.rime}) counts, a name too.`, signatureError: notIt };
    case 'collection': {
      const taken = item.priorAcceptedWords;
      return { answer: `a new real word that rhymes with ${t}`, alsoAccept: [],
        acceptRule: `Any real word that ends with the same sound as ${t} (-${item.rime}) counts, a name too`
          + (taken.length ? `, but not one the family already holds (${taken.join(', ')}).` : '.'),
        signatureError: notIt };
    }
  }
}

const OFF_MENU_WORDS = ['ball', 'fish', 'tree', 'moon', 'duck'];

/**
 * A spoken item's known wrong answers, from the ids the card declares. recognition: the one wrong verdict, named by
 * what the pair shares. identification: a choice that only starts like the target, the target said back, a word that
 * is no choice. Production and collection accept any real rhyme: their misses are the tutor's to name.
 */
export function rhymeSpokenMisses(item: RhymeStudioItem): KnownMiss[] {
  if (isRhymeBoard(item)) return [];
  const target = item.targetWord.toLowerCase();
  if (item.mode === 'recognition' && item.comparisonWord) {
    const other = item.comparisonWord.toLowerCase(), pair = `"${target}" and "${other}"`;
    if (item.doesRhyme) return [{ id: 'no_to_rhyme', pattern: `${pair} rhyme: they end with the same sound. The learner says no, they do not rhyme.`, examples: ['no', "no, they don't"] }];
    const sameStart = !!onsetOf(target) && onsetOf(target) === onsetOf(other);
    return [sameStart
      ? { id: 'yes_same_start', pattern: `${pair} start with the same sound but do not rhyme. The learner says yes, they rhyme.`, examples: ['yes', 'yes, they rhyme'] }
      : { id: 'yes_no_rhyme', pattern: `${pair} do not rhyme and do not start alike. The learner says yes, they rhyme.`, examples: ['yes', 'yes, they rhyme'] }];
  }
  if (item.mode !== 'identification') return [];
  const choices = item.choices.map(c => c.word.toLowerCase()), menu = choices.join(', ');
  const foils = choices.filter(w => w !== item.answer.toLowerCase() && !!onsetOf(w) && onsetOf(w) === onsetOf(target));
  const off = OFF_MENU_WORDS.filter(w => !choices.includes(w) && w !== target && rimeOfWord(w) !== rimeOfWord(target)).slice(0, 1);
  return [
    ...(foils.length ? [{ id: 'onset_foil', pattern: `The choices are ${menu}. ${foils.map(w => `"${w}"`).join(' and ')} starts with the same sound as "${target}" but does not rhyme with it. The learner says ${foils.map(w => `"${w}"`).join(' or ')}.`, examples: foils }] : []),
    { id: 'echo_target', pattern: `The word to rhyme with is "${target}". The learner says "${target}" itself back instead of a choice.`, examples: [target] },
    { id: 'off_menu', pattern: `The choices on the screen are ${menu}. The learner says a word that is none of them and not "${target}" either.`, examples: off },
  ];
}

// ── The scene ───────────────────────────────────────────────────────────────

export interface RhymeView {
  /** Words of the family already credited, in slot order (collection). */
  collected: readonly string[];
  /** The rime is highlighted on the target card at this tier. */
  familyShown: boolean;
  /** The name_choices lever is up: the tutor reads every choice. */
  choicesNamed: boolean;
}

/** What the tutor is told about a word item: the choices and whether it may read them, the family so far, and the
 *  item's own never-say rules (the card's move, tapping the card to hear the question, is not repeated here). The pair
 *  board's scene is `pairScene` (`rhymePairBuild.ts`). */
export function rhymeScene(item: RhymeItem, view: RhymeView): SceneOf {
  const facts: Record<string, string> = {};
  if (item.mode === 'identification') {
    facts.choices = item.choices.map(c => c.word).join(', ');
    facts.namingChoices = view.choicesNamed ? 'Read every choice aloud, in screen order, evenly; stress none.'
      : item.namesChoices ? 'You may say the choices aloud; the learner cannot read them.'
        : 'The learner reads the choices on screen: do not read them aloud.';
  }
  if (item.mode === 'collection') {
    facts.slot = `${item.collectionSlot ?? 1} of ${item.collectionSize ?? RHYME_COLLECTION_SIZE}`;
    facts.collected = view.collected.length ? view.collected.join(', ') : 'none yet';
  }
  facts.constraints = (item.mode === 'recognition' ? 'Both words are shown; which endings match is shown only after credit.'
    : item.mode === 'identification' ? 'The target and the choices are shown; the rhyming choice is marked only after credit.'
      : item.mode === 'production' ? 'Only the target word is shown; there are no choices.'
        : 'The target and the rhymes collected so far are shown; empty spots show no example.')
    + (view.familyShown && item.mode !== 'recognition' ? ' The ending of the target word is highlighted at this level.' : '')
    + ' Before the learner has tried, never say which words rhyme, never name the ending, and never stretch a word to '
    + 'point at its ending.';
  return { objects: [], facts };
}

/** What a tapped card asks the tutor to say: the question only, never which words rhyme. */
export const hearRhymeRequest = (item: RhymeItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${rhymeAsk(item)}" Never say which words rhyme or name the ending.`;

// ── The content gate ────────────────────────────────────────────────────────

const MODES: readonly string[] = ['recognition', 'identification', 'production', 'collection'];

/** The open build: every board must pass the board's own gate. */
function validatePairBuild(d: RhymeStudioData): RhymeStudioData {
  if (typeof d.title !== 'string' || !Array.isArray(d.pairItems) || !d.pairItems.length || d.pairItems.length > 12
      || pairItemsFrom(d.pairItems, d.supportTier).length !== d.pairItems.length)
    throw new Error('Generated rhyme studio has invalid lesson content.');
  return d;
}

/** Reject an item that cannot be asked: recognition needs a comparison and a verdict, identification two or more
 *  choices with one that rhymes; a pair board must pass the board's gate. */
export const validateRhymeStudioData = (value: unknown): RhymeStudioData => ((value as RhymeStudioData)?.task === 'pair_build'
  ? validatePairBuild(value as RhymeStudioData)
  : validateChallengePool<RhymeStudioData>(value, c => {
    if (!c || !MODES.includes(c.mode) || typeof c.targetWord !== 'string' || !c.targetWord.trim()
      || typeof c.rhymeFamily !== 'string' || !c.rhymeFamily.trim()) return false;
    if (c.mode === 'recognition') return typeof c.comparisonWord === 'string' && !!c.comparisonWord.trim() && typeof c.doesRhyme === 'boolean';
    if (c.mode === 'identification') {
      const item = itemFromChallenge(c as RhymeChallengeLike);
      return item.choices.length >= 2 && !!item.answer;
    }
    return true;
  }, { pool: 'Generated rhyme studio has invalid lesson content.', item: 'A rhyme studio item cannot be asked.' }));

// ── The harness ─────────────────────────────────────────────────────────────

/** The journey's spoken answers. Production and collection have no code-owned answer (R3), so the journey cannot
 *  drive them (journey-sweep baseline). */
export function rhymeHarnessAnswers(item: RhymeItem): { correct: string; plainWrong: string } {
  if (item.mode === 'recognition') return { correct: item.doesRhyme ? 'yes' : 'no', plainWrong: item.doesRhyme ? 'no' : 'yes' };
  if (item.mode === 'identification') return { correct: item.answer, plainWrong: item.choices.find(c => !c.isCorrect)?.word ?? item.targetWord };
  throw new Error(`rhyme-studio ${item.mode} has no code-owned answer to drive`);
}

/**
 * The journey's moves on a pair board, through its real pictures: wrong is the board's same-first-sound decoy; right
 * is a rhyming pair not made yet, two of them on a two-pair board. Try again keeps the tray, so it is cleared first.
 */
export function rhymeBoardMoves(right: boolean, board: RhymeBoard, demand: Record<string, unknown> | null | undefined): DriverInput[] {
  const pick = (pair: readonly string[]): DriverInput[] => [...pair.map(w => ({ type: 'choose' as const, label: `picture ${w}` })),
    { type: 'choose', label: "I'm done!" }];
  const clear: DriverInput[] = Number(demand?.picturesInTray ?? 0) > 0 ? [{ type: 'choose', label: 'Clear' }] : [];
  if (!right) {
    const decoy = board.board.flatMap((a, i) => board.board.slice(i + 1).map(b => [a, b])).find(p => pairMiss(p) === 'same_start');
    if (!decoy) throw new Error(`rhyme-studio pair_build ${board.id}: no same-start decoy on the board`);
    return [...clear, ...pick(decoy)];
  }
  const made = String(demand?.madeBefore ?? '').split('; ').filter(m => m && m !== 'none').map(m => m.split(' and ').sort().join('+'));
  const left = rhymingPairs(board.board).filter(p => !made.includes(p)).map(p => p.split('+'));
  const need = Math.max(1, board.ways - made.length);
  if (left.length < need) throw new Error(`rhyme-studio pair_build ${board.id}: ${left.length} rhyming pairs left, ${need} needed`);
  return [...clear, ...left.slice(0, need).flatMap(pick)];
}
