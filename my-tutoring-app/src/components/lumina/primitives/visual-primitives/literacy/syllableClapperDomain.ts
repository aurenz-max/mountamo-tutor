/**
 * syllable-clapper's domain: the items, the content gates, the ask, the spoken key, the known misses, the scene and the
 * content check. Pure; the boss, the levers, the component, the generator and the tests read the same rules.
 *
 * Three acts, each one spoken answer (the eval modes, `syllableClapperModes.ts`):
 *
 *   blend_syllables  the tutor says the parts one at a time, the learner says the WORD
 *   count_parts      the tutor says the word joined, the learner claps and says HOW MANY
 *   delete_compound  "say cupcake without cup": the learner says the word LEFT
 *
 * How the word is voiced is the pedagogy and it inverts between the acts: on count and delete the word is one joined
 * stream (saying it in beats hands the count over: three beats is three), while on blend the beats ARE the question
 * and the joined word is the answer. The scene states it per item (`voicing`). Nothing is printed before credit: a
 * printed word lets a reader chunk it by sight instead of hearing it.
 *
 * Items a tutor could not honestly ask or judge are DROPPED at build (`itemFromChallenge`): parts that do not spell
 * their word, a count outside the act's window, a word whose syllable count varies by speaker, a silent-e beat, and a
 * deletion whose leftover is not a real word. build_parts is the shared letter build (`syllableBuild.ts`).
 */
import { spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type { SyllableClapperData } from './SyllableClapper';
import { isSyllableTask, syllableTaskShape, type SyllableTask } from './syllableClapperModes';
import { letterAssignment, letterItemsFrom, type LetterBuildItem } from './letterBuild';

/** The WORD-LENGTH band, a fact derived from the split (the generator's ladder reads it); never an eval mode. */
export type SyllableBand = 'easy' | 'medium' | 'hard';

/** A spoken item: one act on one word. */
export interface SyllableClapperItem {
  id: string;
  /** Which act this item asks for (its eval mode). */
  task: SyllableTask;
  /** The word. Never printed before credit on any act. */
  word: string;
  /** The real syllable split: said one at a time on blend, shown in the reveal after credit. */
  parts: string[];
  /** What the learner SAYS: a count word, the blended word, or the word left. */
  answer: string;
  /** The count as a number, for the reveal and the metrics. */
  partCount: number;
  /** `delete_compound` only: the part the ask takes away. */
  removePart?: string;
  /** `delete_compound` only: the real word left behind; equals `answer`. */
  residue?: string;
  /** Reveal-only caption; never rendered before credit. */
  imageDescription?: string;
  /** Tier lever: the ask voices the stimulus a second time. */
  echoSlowly: boolean;
  /** Tier lever: the ask invites the hands. `count_parts` only. */
  inviteClap: boolean;
  /** The lesson's support tier (when the model lever comes); absent is medium. */
  supportTier?: SupportTier;
}

/** A build item: the shared letter build's syllables ask, on build_parts. */
export type SyllableBuild = LetterBuildItem & { mode: 'build_parts'; supportTier: SupportTier };
export type SyllableClapperBossItem = SyllableClapperItem | SyllableBuild;

export const isSyllableBuild = (item: SyllableClapperBossItem): item is SyllableBuild =>
  (item as SyllableBuild).mode === 'build_parts';
/** The item's eval mode. */
export const syllableModeOf = (item: SyllableClapperBossItem): string => (isSyllableBuild(item) ? item.mode : item.task);

// ── Number words ────────────────────────────────────────────────────────────

/** Indices 1-5 are the answers the build gate admits. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** The pedagogic range. 1-4 is the primitive's declared band; 5 is admitted
 *  because the shipped long-word prompt names "refrigerator" (re·frig·er·a·tor),
 *  and refusing a legitimate hard word is a supply bug, not a safety gate. */
export const MIN_PARTS = 1;
export const MAX_PARTS = 5;

// ── Content gates — the generator IMPORTS these, never copies them ──────────

/**
 * One ordinary English word a five-year-old can hear: letters (plus an internal
 * apostrophe or hyphen), no digits, no spaces. A spoken ask cannot carry a
 * phrase, and the 400-char `targetWord` runaway letter-spotter's probe caught
 * is why a field that cannot be enum-locked gets a SHAPE gate as well as a
 * meaning one.
 */
const SAYABLE_WORD = /^[a-z][a-z'-]{0,19}$/i;

export const isSayableSyllableWord = (word: string | undefined): word is string =>
  !!word
  && SAYABLE_WORD.test(word.trim())
  && word.trim().toLowerCase() !== 'yes'
  && !opensWithSentinel(word.trim());

/** A syllable is chanted aloud on its own, so it has to be pronounceable
 *  letters — nothing else can be said as a beat. */
const SAYABLE_PART = /^[a-z][a-z'-]{0,9}$/i;

/**
 * Do the parts spell the word? The click-era generator forced
 * `syllableCount = syllables.length` and never checked this, so a split that
 * drifted from its own word produced a CORRECTION that chants a different word
 * at the child — invisible while a button did the grading, spoken aloud now.
 * Case- and hyphen-insensitive: a split may drop the hyphen of "T-shirt".
 */
export const syllablesJoinToWord = (word: string, parts: string[]): boolean => {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');
  return parts.length > 0 && parts.join('').toLowerCase().replace(/[^a-z]/g, '') === norm(word);
};

/**
 * ⭐ WORDS WHOSE SYLLABLE COUNT IS NOT ONE NUMBER.
 *
 * Used NEGATIVELY, word-workout's oracle pattern: membership means "there is no
 * single defensible answer here", never "this word is bad". Two families, and
 * the second is the one a K word list actually trips over:
 *
 *  (a) SCHWA SYNCOPE — a middle vowel that speakers routinely swallow.
 *      "chocolate" is choc·late or choc·o·late; "every" is ev·ry or ev·e·ry.
 *      The shipped long-word prompt asked for exactly these ("comfortable",
 *      "interesting") as though ambiguity were difficulty.
 *  (b) SYLLABIC LIQUIDS AND DIPHTHONG GLIDES — "squirrel" is one beat or two,
 *      "fire" and "flower" and "hour" the same. These are ordinary K animal and
 *      weather words, which is why the list cannot be an academic-vocabulary
 *      afterthought.
 *
 * A judged loop is what makes this fatal: the tutor refuses a child who was
 * right and then models the "correct" count at them, teaching a dialect as a
 * fact. Held on both sides of the wire so it also covers hand-authored and
 * cached payloads.
 */
export const DIALECT_VARIABLE_WORDS = new Set([
  // (a) schwa syncope
  'chocolate', 'camera', 'family', 'every', 'everyone', 'everything', 'different',
  'interesting', 'comfortable', 'vegetable', 'favorite', 'favourite', 'temperature',
  'several', 'general', 'jewelry', 'business', 'restaurant', 'memory', 'average',
  'natural', 'separate', 'mystery', 'factory', 'history', 'evening', 'probably',
  'actually', 'basically', 'caramel', 'diamond', 'cereal', 'theater', 'medicine',
  'onion', 'union',
  // (b) syllabic liquids and glides
  'squirrel', 'fire', 'fires', 'hire', 'tire', 'wire', 'hour', 'hours', 'our', 'ours',
  'flower', 'flowers', 'flour', 'tower', 'power', 'shower', 'sour', 'towel', 'jewel',
  'cruel', 'fuel', 'real', 'iron', 'lion', 'science', 'poem', 'drawer', 'choir',
  'area', 'idea', 'violet', 'quiet', 'giant',
]);

export const hasStableSyllableCount = (word: string): boolean =>
  !DIALECT_VARIABLE_WORDS.has(word.trim().toLowerCase());

/**
 * ⭐ FOUND BY THE LIVE PROBE, and it is the failure the join gate cannot see:
 * a split that spells its word perfectly and still claims the wrong number of
 * beats. The draw was `centipede → ["cen","ti","pe","de"]`. Those four parts
 * join to "centipede" letter for letter, so every gate above passed it — and
 * the answer key says FOUR for a word English claps in THREE. A judged tutor
 * then refuses the child who said "three" and chants "cen … ti … pe … de" at
 * them as the model.
 *
 * A general syllable counter is not something to attempt here (every cheap
 * heuristic breaks on "-ed" and "-es"), so this gates the one shape that is
 * certain: a FINAL part that is a single consonant plus "e" is a silent final
 * e, not a beat. "-le" endings ("ap|ple", "ta|ble", "un|cle") are three
 * characters and never match, which is what keeps the real syllabic-l words.
 *
 * KNOWN AND ACCEPTED FALSE POSITIVES: words whose final consonant+e IS a beat
 * — "karate", "recipe", "sesame". They are dropped, not mis-graded, and none of
 * them is a concrete picturable K-2 noun, so the cost is supply we do not want
 * anyway. Dropping is always the safe direction here: the alternative is a
 * spoken ask whose answer key is wrong.
 */
const SILENT_FINAL_E_PART = /^[bcdfghjklmnpqrstvwxz]e$/i;

export const endsWithSilentESyllable = (parts: string[]): boolean =>
  parts.length >= 2 && SILENT_FINAL_E_PART.test(parts[parts.length - 1]);

/**
 * ⭐ THE COMPOUND PARTS A DELETION ITEM MAY BE BUILT FROM — a POSITIVE oracle,
 * the only one in this file, and the live probe is what bought it.
 *
 * The first draw returned `peanut → pe|anut`: two parts, they spell the word,
 * the residue is one of them, and it is sayable letters. Every structural gate
 * passed, and the ask would have been "say peanut without pe", whose answer is a
 * nonword. Nothing about the SHAPE of a split can tell you its halves are words;
 * only a list can.
 *
 * A positive list is the wrong tool almost everywhere — word-workout's real-word
 * oracle is used NEGATIVELY for exactly that reason, because a positive
 * requirement over-drops good content. It is the right tool HERE because the
 * K-appropriate compound supply is small and closed: the words below already
 * cover every compound four live draws produced, and a compound outside them is
 * dropped (logged, with the reason) rather than asked. Dropping is always the
 * safe direction when the alternative is a spoken ask with a nonword answer.
 */
export const COMPOUND_PART_WORDS = new Set([
  // things around a house and a day
  'bed', 'room', 'time', 'house', 'home', 'door', 'bell', 'box', 'mail', 'back',
  'pack', 'book', 'case', 'cup', 'cake', 'pan', 'pot', 'pop', 'corn', 'bread',
  'egg', 'plant', 'nut', 'oat', 'meal', 'milk', 'shake', 'tea', 'pie', 'apple',
  'straw', 'berry', 'blue', 'black', 'green', 'gold', 'bowl', 'spoon', 'chair',
  // outdoors, weather, sky
  'sun', 'hat', 'shine', 'rain', 'coat', 'bow', 'drop', 'snow', 'man', 'ball',
  'flake', 'star', 'moon', 'light', 'day', 'night', 'sand', 'castle', 'sea',
  'shell', 'shore', 'tree', 'top', 'wood', 'camp', 'side', 'walk', 'hill',
  // animals and creatures
  'cat', 'dog', 'bird', 'fish', 'nest', 'bug', 'lady', 'bee', 'honey', 'fly',
  'frog', 'bull', 'horse', 'shoe', 'pig', 'pen', 'sheep', 'cow', 'boy', 'girl',
  'dragon', 'butter', 'grass', 'hopper', 'jelly', 'pea', 'duck', 'lamb', 'bear',
  // play, school, going places
  'foot', 'base', 'basket', 'play', 'ground', 'game', 'toy', 'sail', 'boat',
  'air', 'plane', 'rail', 'road', 'way', 'car', 'port', 'bike', 'skate', 'board',
  'class', 'school', 'note', 'paper', 'pencil', 'lunch', 'bag', 'birth', 'party',
  // people and body
  'grand', 'mother', 'father', 'some', 'one', 'body', 'hand', 'finger', 'nail',
  'tooth', 'brush', 'hair', 'cut', 'eye', 'brow', 'key', 'lock', 'rope', 'print',
  // word-space compounds (2026-10-13): parts of the word library's familiar compounds (bathtub, backyard,
  // hallway, waterfall, weekend, sunset, lipstick, inside), each an everyday word on its own
  'bath', 'tub', 'yard', 'hall', 'water', 'melon', 'fall', 'week', 'end', 'set', 'lip', 'stick', 'seat',
  'in', 'out', 'down', 'town', 'rise', 'flash', 'head', 'wall', 'sleep', 'over', 'roof',
]);

/** Is this half of a compound a word a five-year-old owns on its own? */
export const isCompoundPartWord = (part: string | undefined): boolean =>
  !!part && COMPOUND_PART_WORDS.has(part.trim().toLowerCase());

/**
 * ⭐ THE DELETION GATE, and it is the one new content rule this ladder needed.
 *
 * `delete_compound` asks the child to SAY what is left, so the residue has to be
 * a word they can say. Deleting a part of an ordinary multisyllable word almost
 * never leaves one — "banana without ba" is "nana", "elephant without el" is
 * "ephant" — and a judged tutor asking for a nonword is asking for an answer
 * neither the child nor the judge can be confident about. Two-part COMPOUNDS
 * whose parts are both ordinary words are the shape that always works, and it is
 * also the shape the K classroom already uses ("say cowboy without cow").
 *
 * The parts are WORDS, not syllables: "dragon" is one part and two beats, which
 * is correct here and is why this mode is not called syllable deletion.
 */
export const deletionShapeIsValid = (
  parts: string[],
  removePart: string | undefined,
  residue: string | undefined,
): boolean => {
  if (parts.length !== 2) return false;
  const remove = (removePart ?? '').trim().toLowerCase();
  const left = (residue ?? '').trim().toLowerCase();
  if (!remove || !left || remove === left) return false;
  const lower = parts.map((p) => p.toLowerCase());
  if (!lower.includes(remove) || !lower.includes(left)) return false;
  // Both parts stand alone — one in the ask, one in the answer — so both must be
  // sayable, neither may be a single letter read as a letter NAME, and ⭐ both
  // must be actual words. The last clause is what refuses "peanut → pe|anut".
  return parts.every((p) => SAYABLE_PART.test(p) && p.length >= 2 && isCompoundPartWord(p))
    && isSayableSyllableWord(left);
};

/**
 * A syllable as a CHANT says it.
 *
 * A part that is one bare vowel letter reads as the letter NAME when a Live
 * model says it alone — "el … e … phant" comes out "el EE phant" — which is the
 * same defect `phonemeVoice` fixes for phonemes by spelling them out, one level
 * down. An interior or final lone vowel in English is a schwa essentially
 * without exception ("el|e|phant", "ther|mom|e|ter", "ba|nan|a"), so it is
 * spelled the way it is said. Both of those splits came out of the live probe.
 */
export const chantPart = (part: string): string =>
  /^[aeiou]$/i.test(part) ? 'uh' : part;

/** The spoken walk: the parts, voice-safe, one beat apart. */
export const chantOf = (parts: string[]): string =>
  parts.map(chantPart).join(' … ');

// ── Item building — the gates live HERE, not in prose ───────────────────────

export interface SyllableChallengeLike {
  id: string;
  word?: string;
  syllables?: string[];
  syllableCount?: number;
  imageDescription?: string;
  /** The TASK IDENTITY. Legacy payloads carrying a word-length band ('easy'|'medium'|'hard') resolve to
   *  `count_parts`, the only act those payloads ever meant. */
  challengeType?: string;
  /** `delete_compound`: the part the ask takes away. */
  removePart?: string;
  /** `delete_compound`: the real word left behind. */
  residue?: string;
  /** Tier lever (generator-stamped): voice the stimulus a second time. */
  echoWordSlowly?: boolean;
  /** Tier lever (generator-stamped): invite the hands. */
  inviteClap?: boolean;
}

/** Legacy band values mean the counting act and nothing else. */
export const taskOf = (challengeType: string | undefined): SyllableTask =>
  isSyllableTask(challengeType) ? challengeType : 'count_parts';

/**
 * One item, or null to DROP the challenge: an item that cannot be asked or judged honestly ships nothing. Drops: not
 * one sayable word; parts that do not spell the word or are not sayable beats; a count outside the act's window
 * (1..5 counting, 2..4 blending, exactly 2 deleting); a word whose syllable count varies by speaker
 * (`DIALECT_VARIABLE_WORDS`); a silent final e split into a beat; a deletion whose residue is not one of its two
 * parts or not a word (`deletionShapeIsValid`). `syllableCount` from the model is IGNORED: the split is the answer.
 */
export const itemFromChallenge = (ch: SyllableChallengeLike): SyllableClapperItem | null => {
  const word = (ch.word ?? '').trim();
  const parts = (ch.syllables ?? []).map((p) => (p ?? '').trim()).filter(Boolean);
  const task = taskOf(ch.challengeType);
  const shape = syllableTaskShape(task);

  if (!isSayableSyllableWord(word)) return null;
  if (!hasStableSyllableCount(word)) return null;
  if (parts.length < Math.max(MIN_PARTS, shape.partsMin)) return null;
  if (parts.length > Math.min(MAX_PARTS, shape.partsMax)) return null;
  if (parts.some((p) => !SAYABLE_PART.test(p))) return null;
  if (!syllablesJoinToWord(word, parts)) return null;
  if (endsWithSilentESyllable(parts)) return null;

  const removePart = (ch.removePart ?? '').trim();
  const residue = (ch.residue ?? '').trim();
  if (shape.needsResidue && !deletionShapeIsValid(parts, removePart, residue)) return null;

  const answer = task === 'count_parts' ? COUNT_WORDS[parts.length] : task === 'blend_syllables' ? word : residue;
  if (!answer) return null;

  return {
    id: ch.id, task, word, parts, answer, partCount: parts.length,
    ...(task === 'delete_compound' ? { removePart, residue } : {}),
    imageDescription: ch.imageDescription,
    echoSlowly: ch.echoWordSlowly !== false,
    inviteClap: ch.inviteClap !== false,
  };
};

/**
 * All buildable items, in order. A word is ASKED ABOUT ONCE, whatever the act: blend says the parts of its word
 * (the answer to that word's count item) and count says the word (the answer to its blend item). A repeated COUNT is
 * not a leak: three parts twice over is the curriculum.
 */
export const itemsFromChallenges = (challenges: SyllableChallengeLike[]): SyllableClapperItem[] => {
  const kept: SyllableClapperItem[] = [];
  const asked = new Set<string>();
  for (const ch of challenges) {
    const item = itemFromChallenge(ch);
    if (!item) continue;
    const key = item.word.toLowerCase();
    if (asked.has(key)) continue;
    asked.add(key);
    kept.push(item);
  }
  return kept;
};

const tierOf = (data: Pick<SyllableClapperData, 'supportTier'>): SupportTier => data.supportTier ?? 'medium';

/** The session's spoken items, each stamped with the lesson's tier. */
export const syllableWords = (data: Pick<SyllableClapperData, 'challenges' | 'supportTier'>): SyllableClapperItem[] =>
  itemsFromChallenges(data.challenges ?? []).map(item => ({ ...item, supportTier: tierOf(data) }));

/** A letter-build ask as a build item of this lesson. */
export const asSyllableBuild = (item: LetterBuildItem, supportTier: SupportTier): SyllableBuild =>
  ({ ...item, mode: 'build_parts', supportTier });

/** The session's build asks, through the shared build's own gate. */
export const syllableBuilds = (data: Pick<SyllableClapperData, 'buildItems' | 'supportTier'>): SyllableBuild[] =>
  letterItemsFrom(data.buildItems ?? [], data.supportTier).map(i => asSyllableBuild(i, tierOf(data)));

/** The session's items: the build asks on build_parts, the spoken items otherwise. */
export const syllableClapperItems = (data: SyllableClapperData): SyllableClapperBossItem[] =>
  (data.task === 'letter_build' ? syllableBuilds(data) : syllableWords(data));

// ── The ask: the problem stated aloud, one defensible answer ────────────────

type AskFields = Pick<SyllableClapperItem, 'task' | 'word' | 'parts' | 'echoSlowly' | 'inviteClap' | 'removePart'>;

/** What the learner is asked. Never the answer: blend says the parts, count and delete say the word. */
export const askFor = (item: AskFields): string => {
  if (item.task === 'blend_syllables') {
    const chant = chantOf(item.parts);
    const echo = item.echoSlowly ? ` Again: ${chant}.` : '';
    return `Listen: ${chant}.${echo} Your turn. Put the parts together. What word is that?`;
  }
  if (item.task === 'delete_compound') {
    const echo = item.echoSlowly ? ` Again, slowly: ${item.word}.` : '';
    return `Listen: ${item.word}.${echo} Your turn. Say ${item.word} without ${item.removePart}.`;
  }
  const echo = item.echoSlowly ? ` Again, slowly: ${item.word}.` : '';
  const hands = item.inviteClap
    ? `Clap the parts with your hands, then tell me how many parts in ${item.word}.`
    : `How many parts in ${item.word}?`;
  return `Listen: ${item.word}.${echo} Your turn. ${hands}`;
};

/** The ask of any item: a build item's is the shared letter build's task. */
export const syllableAsk = (item: SyllableClapperBossItem): string =>
  (isSyllableBuild(item) ? letterAssignment(item).task : askFor(item));

/**
 * The spoken key. count: the count word; counting aloud that LANDS on it is right, a count that runs past it is not.
 * blend: the whole word, joined; the parts said back apart are not it. delete: the word left; the whole word said
 * back, or the part taken away, is not it. Null on a build item (code counts the parts, the word judge the word).
 */
export function syllableKey(item: SyllableClapperBossItem): SpokenKey | null {
  if (isSyllableBuild(item)) return null;
  if (item.task === 'count_parts') {
    return { answer: item.answer, alsoAccept: [String(item.partCount)],
      acceptRule: `Counting the parts out loud is right when the count lands on ${item.answer}.`,
      signatureError: `A count that runs past ${item.answer}, the word ${item.word} said back, or its parts with no number, is not it.` };
  }
  if (item.task === 'delete_compound') {
    return { answer: item.answer, alsoAccept: [],
      signatureError: `${item.word} said back whole, or ${item.removePart}, the part taken away, is not it.` };
  }
  return { answer: item.word, alsoAccept: [], acceptRule: `${item.word} said as one joined word is right.`,
    signatureError: 'The parts said back one at a time, still apart, are not yet the word.' };
}

/**
 * The item's known wrong answers (handoff 20 Part B), from the ids the card declares. blend: the parts said back
 * apart. count: the word for a count, the sounds counted (stated only on a three-sound word, whose sound count code
 * knows), one part over. delete_compound names none yet.
 */
export function syllableSpokenMisses(item: SyllableClapperBossItem): KnownMiss[] {
  if (isSyllableBuild(item)) return [];
  const word = item.word.toLowerCase();
  if (item.task === 'blend_syllables' && item.parts.length > 1) {
    const apart = item.parts.join('... ');
    return [{ id: 'parts_back', pattern: `The parts are ${item.parts.map(p => `"${p}"`).join(', ')}, and joined they make "${word}". The learner says the parts back one at a time with pauses, "${apart}", and never the joined word.`, examples: [apart] }];
  }
  if (item.task !== 'count_parts') return [];
  const n = item.partCount, threeSounds = /^[bcdfghjklmnprstvwz][aeiou][bcdfgklmnprstvz]$/.test(word) && n === 1;
  return [
    { id: 'word_for_count', pattern: `The word is "${word}". The learner says the word "${word}" itself and no number of parts.`, examples: [word] },
    ...(threeSounds ? [{ id: 'counted_sounds', pattern: `"${word}" has ${spokenNumber(n)} part and three sounds. The learner's answer is three, the number of sounds, not parts.`, examples: ['three'] }] : []),
    { id: 'count_one_over', pattern: `"${word}" has ${spokenNumber(n)} part${n === 1 ? '' : 's'}. The learner's answer is ${n + 1}, one more than the ${spokenNumber(n)} part${n === 1 ? '' : 's'}.`, examples: [spokenNumber(n + 1)] },
  ];
}

/** How the stimulus is said: joined on count and delete (a split hands the count over), in parts on blend. */
const voicing = (item: SyllableClapperItem) => (item.task === 'blend_syllables'
  ? `Say the parts one at a time with a clear pause between them (${chantOf(item.parts)}); saying them joined `
    + 'is the answer.'
  : `Say ${item.word} as one joined word at a natural pace; breaking it into parts before the learner has tried `
    + (item.task === 'count_parts' ? 'hands over the count.' : 'does the task for them.'));

/** What the tutor reads about a spoken item, beyond the ask and the key. */
export function syllableScene(item: SyllableClapperItem): SceneOf {
  return { objects: [], facts: {
    act: item.task,
    voicing: voicing(item),
    constraints: 'Nothing on screen shows the word, its parts or the answer until it is credited.',
  } };
}

/** What the hear-again button asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: SyllableClapperItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}" ${voicing(item)}`;

/** After credit, a tapped part of the reveal asks for that part only. */
export const hearPartRequest = (part: string) => `The learner tapped a word part. Say only this part, once: "${part}".`;

/** Plain-wrong words for blend: ordinary, unrelated, and never a part of the item's own word. */
const DECOY_WORDS = ['table', 'window', 'garden', 'rocket', 'ladder'];

/** The journey's answers: the key's own words, or a plainly different answer of the same kind. */
export function syllableHarnessAnswers(item: SyllableClapperItem): { correct: string; plainWrong: string } {
  if (item.task === 'blend_syllables') {
    return { correct: item.word,
      plainWrong: DECOY_WORDS.find(w => w !== item.word.toLowerCase() && !item.parts.includes(w)) ?? 'ladder' };
  }
  // The part taken AWAY, named in the ask: the commonest real error.
  if (item.task === 'delete_compound') return { correct: item.answer, plainWrong: item.removePart ?? 'ladder' };
  // A real alternative count, never the answer and never the one-past walk.
  return { correct: item.answer, plainWrong: COUNT_WORDS[item.partCount === 1 ? 3 : 1] };
}

/** Reject a word the session would drop (unsayable, a split that does not spell it, a variable count) or ask twice. */
export function validateSyllableClapperData(value: unknown): SyllableClapperData {
  const b = value as SyllableClapperData;
  if (b?.task === 'letter_build') {
    // The open build (build_parts): every syllable ask must pass the surface's own gate.
    if (typeof b.title !== 'string' || !Array.isArray(b.buildItems) || !b.buildItems.length || b.buildItems.length > 12
        || b.buildItems.some(i => i?.kind !== 'syllables') || letterItemsFrom(b.buildItems, b.supportTier).length !== b.buildItems.length)
      throw new Error('Generated syllable clapper has invalid lesson content.');
    return b;
  }
  const d = validateChallengePool<SyllableClapperData>(value, c => !!c && itemFromChallenge(c) !== null,
    { pool: 'Generated syllable clapper has invalid lesson content.', item: 'A syllable clapper word cannot be asked.' });
  if (itemsFromChallenges(d.challenges).length !== d.challenges.length)
    throw new Error('A syllable clapper word is asked twice.');
  return d;
}
