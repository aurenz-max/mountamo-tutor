/**
 * The in-item levers on phoneme-explorer (`/add-support-tiers`, handoff 22 L2). Every answer is a spoken word or
 * count, so no lever turns one into a choice or a tap (R2). Help never emphasises the item's own sounds before a
 * try (contract R2): a model acts on another word, a counter counts only what the learner pushes, and the tiles
 * already on screen move but gain nothing. Simplify opens a NEW ungraded item of the same mode from code-owned
 * picture words the session never uses (R3).
 *
 * - `position_model` (isolate, ending, medial): another word in three sound boxes, the asked position lit; its
 *   sound there is never the item's.
 * - `name_cards` (isolate, medial, where the tier withdrew the read-aloud): speaker marks; the tutor reads the cards.
 * - `example_word` (isolate) / `operation_detail` (manipulate): the tier's withdrawn example card / printed change.
 * - `slide_tiles` (blend): the item's sound tiles slide together over an arrow; the word is never shown or said.
 * - `push_tokens` (segment): a counter pad; the learner pushes one per sound they say. No boxes are pre-drawn (their
 *   number would be the answer).
 * - `mark_position` (manipulate): the starting word's sound boxes, the one that changes emptied. Never the new sound.
 * - `two_cards_far` / `short_blend` / `two_sound_word` / `first_sound_change` (simplify).
 *
 * Misses are spoken and not emitted yet (handoff 20 Part B): the ids are declared for the ladder to come and listed
 * as unanswered for J9.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemFromChallenge, spokenPhonemeToken, walkFor, type PhonemeExplorerItem, type PhonemeItemKind } from './phonemeExplorerScript';
import { K_RHYME_FAMILIES, PRACTICE_EXTRA_FAMILIES, freeFamilies, sessionWords } from './rhymeModels';
import { graphemes } from './wordWorkoutLevers';

export const POSITION_LEVER = 'position_model';
export const NAME_CARDS_LEVER = 'name_cards';
export const EXAMPLE_LEVER = 'example_word';
export const OPERATION_LEVER = 'operation_detail';
export const SLIDE_LEVER = 'slide_tiles';
export const TOKENS_LEVER = 'push_tokens';
export const MARK_LEVER = 'mark_position';
export const SIMPLIFY_LEVER: Record<PhonemeItemKind, string> = {
  isolate: 'two_cards_far', ending: 'two_cards_far', medial: 'two_cards_far',
  blend: 'short_blend', segment: 'two_sound_word', manipulate: 'first_sound_change',
};

/** The misses a spoken answer will name once spoken misses land (handoff 20 Part B). */
export const PHONEME_MISSES = {
  isolate: ['echo_stimulus', 'letter_name'],
  ending: ['echo_stimulus', 'onset_match'],
  medial: ['echo_stimulus', 'onset_match'],
  blend: ['sounds_no_word', 'near_word'],
  segment: ['word_for_count', 'count_off_one'],
  manipulate: ['echo_original', 'other_position'],
} as const;
export type PhonemeMiss = typeof PHONEME_MISSES[keyof typeof PHONEME_MISSES][number];

/**
 * A picturable three-sound word. `sounds` is what the model's boxes print; `phon`, when present, is what is said
 * (a vowel team prints `ai` and is said "ay"). `c` and `x` never: neither is one sayable sound.
 */
export interface CvcWord { word: string; emoji: string; sounds: [string, string, string]; phon?: [string, string, string] }
const CVC = /^[bdfghjklmnprstvwz][aeiou][bdfgklmnprtz]$/;
export const CVC_POOL: readonly CvcWord[] = [...K_RHYME_FAMILIES, ...PRACTICE_EXTRA_FAMILIES]
  .flatMap(f => f.words.map(([word, emoji]) => ({ word, emoji })))
  .filter(w => CVC.test(w.word))
  .map(w => ({ ...w, sounds: w.word.split('') as [string, string, string] }));

/**
 * Long-vowel words, for medial and ending (measured 09-29, handoff 24). A medial session usually asks all five short
 * vowels, and every CVC word's middle is one of them, so medial had no model and no practice item. A saved ending
 * session asked final n, p, t and g, which left the CVC pool no ending pair. Each pair here shares its middle sound and
 * differs in both others; seal and mail share a final /l/, which the CVC families rarely end in.
 */
export const LONG_MIDDLE_POOL: readonly CvcWord[] = [
  { word: 'rain', emoji: '🌧️', sounds: ['r', 'ai', 'n'], phon: ['r', 'ā', 'n'] },
  { word: 'mail', emoji: '📬', sounds: ['m', 'ai', 'l'], phon: ['m', 'ā', 'l'] },
  { word: 'feet', emoji: '🦶', sounds: ['f', 'ee', 't'], phon: ['f', 'ē', 't'] },
  { word: 'seal', emoji: '🦭', sounds: ['s', 'ea', 'l'], phon: ['s', 'ē', 'l'] },
  { word: 'boat', emoji: '⛵', sounds: ['b', 'oa', 't'], phon: ['b', 'ō', 't'] },
  { word: 'soap', emoji: '🧼', sounds: ['s', 'oa', 'p'], phon: ['s', 'ō', 'p'] },
];
const phon = (w: CvcWord) => w.phon ?? w.sounds;
const poolFor = (kind: PhonemeItemKind): readonly CvcWord[] =>
  kind === 'medial' || kind === 'ending' ? [...CVC_POOL, ...LONG_MIDDLE_POOL] : CVC_POOL;

/** Two-sound picture words for a segment practice item. */
export const TWO_SOUND_POOL: ReadonlyArray<{ word: string; emoji: string; segments: [string, string] }> = [
  { word: 'bee', emoji: '🐝', segments: ['b', 'ee'] }, { word: 'key', emoji: '🔑', segments: ['k', 'ee'] },
  { word: 'egg', emoji: '🥚', segments: ['e', 'g'] }, { word: 'shoe', emoji: '👟', segments: ['sh', 'oo'] },
  { word: 'cow', emoji: '🐄', segments: ['k', 'ow'] }, { word: 'pie', emoji: '🥧', segments: ['p', 'ie'] },
];

const CONTINUANTS = ['m', 's', 'f', 'n', 'l', 'r'];
const POSITION = { isolate: 0, medial: 1, ending: 2 } as const;
const low = (w: string | undefined) => (w ?? '').trim().toLowerCase();

/** Every word the session says, prints or asks for. A model or practice word may be none of them. */
export function phonemeSessionWords(items: readonly PhonemeExplorerItem[]): Set<string> {
  return new Set(items.flatMap(i => [i.answer, i.targetWord, i.exampleWord, i.originalWord, ...(i.menu ?? []).map(c => c.word)])
    .map(low).filter(Boolean));
}

/** The sound an item asks about, as the tutor says it: isolate's sound, ending's final, medial's vowel. */
export function askedSound(item: PhonemeExplorerItem): string | null {
  if (item.kind === 'isolate') return spokenPhonemeToken(item.phoneme ?? item.phonemeSound ?? '');
  if (item.kind === 'ending') return item.finalPhonemeSpoken ?? null;
  if (item.kind === 'medial') return item.vowelSpoken ?? null;
  return null;
}
const say = (letter: string) => spokenPhonemeToken(letter);

/** A stable 0/1 from an id, so a card order is not predictable from the item. */
const bit = (id: string) => id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 2;

/** The model word for a menu item: not a session word, and its sound at the asked position is not the item's. */
export function positionModelFor(item: PhonemeExplorerItem, items: readonly PhonemeExplorerItem[]): CvcWord | null {
  if (!(item.kind in POSITION)) return null;
  const at = POSITION[item.kind as keyof typeof POSITION];
  const used = phonemeSessionWords(items), sounds = new Set(items.map(askedSound).filter(Boolean));
  return poolFor(item.kind).find(w => !used.has(w.word) && !sounds.has(say(phon(w)[at]))) ?? null;
}

/** The box the manipulate change lands in, when the change is one sound for one sound; else null. */
export function changedBox(item: PhonemeExplorerItem): number | null {
  if (item.kind !== 'manipulate' || !item.originalWord) return null;
  const [a, b] = [graphemes(low(item.originalWord)), graphemes(low(item.answer))];
  if (a.length !== b.length) return null;
  const diff = a.map((g, i) => g !== b[i] ? i : -1).filter(i => i >= 0);
  return diff.length === 1 ? diff[0] : null;
}

const differsEverywhere = (a: CvcWord, b: CvcWord) => phon(a).every((s, i) => s !== phon(b)[i]);

/**
 * The practice item for `item`, in its own mode, on pool words the session never uses and a sound it never asks.
 * Menu kinds get two cards: the match and a card that differs in every position. Null when the pool runs out.
 */
export function practiceItemFor(item: PhonemeExplorerItem, items: readonly PhonemeExplorerItem[]): PhonemeExplorerItem | null {
  const id = `${item.id}~simpler`;
  const used = phonemeSessionWords(items), asked = new Set(items.map(askedSound).filter(Boolean));
  const free = poolFor(item.kind).filter(w => !used.has(w.word));
  const cards = (answer: CvcWord, foil: CvcWord) => {
    const both = [{ word: answer.word, emoji: answer.emoji, correct: true }, { word: foil.word, emoji: foil.emoji, correct: false }];
    return bit(item.id) === 0 ? both : both.reverse();
  };
  const readAloud = item.enumerateMenu !== false;
  if (item.kind === 'isolate' || item.kind === 'ending' || item.kind === 'medial') {
    const at = POSITION[item.kind];
    for (const answer of free) {
      const sound = phon(answer)[at];
      if (asked.has(say(sound)) || !say(sound) || (item.kind === 'isolate' && !CONTINUANTS.includes(sound))) continue;
      const target = item.kind === 'isolate' ? null
        : free.find(t => t !== answer && phon(t)[at] === sound && phon(t).every((s, i) => i === at || s !== phon(answer)[i]));
      if (item.kind !== 'isolate' && !target) continue;
      const foil = free.find(f => f !== answer && f !== target && differsEverywhere(f, answer) && (!target || phon(f)[at] !== phon(target)[at]));
      if (!foil) continue;
      const built = itemFromChallenge(item.kind === 'isolate'
        ? { id, mode: 'isolate', phoneme: sound, phonemeSound: `/${sound}/`, choices: cards(answer, foil), readOptionsAloud: readAloud }
        : { id, mode: item.kind, targetWord: target!.word, targetEmoji: target!.emoji, choices: cards(answer, foil),
          ...(item.kind === 'ending' ? { finalPhoneme: sound } : { vowel: sound }), readOptionsAloud: readAloud });
      if (built) return built;
    }
    return null;
  }
  if (item.kind === 'blend') {
    const word = free.find(w => CONTINUANTS.includes(w.sounds[0]) && walkFor(w.sounds));
    return word ? itemFromChallenge({ id, mode: 'blend', word: word.word, emoji: word.emoji, phonemeSequence: [...word.sounds] }) : null;
  }
  if (item.kind === 'segment') {
    const word = TWO_SOUND_POOL.find(w => !used.has(w.word));
    return word ? itemFromChallenge({ id, mode: 'segment', targetWord: word.word, targetEmoji: word.emoji, segments: [...word.segments] }) : null;
  }
  for (const family of freeFamilies(sessionWords(Array.from(used)))) {
    const words = family.words.filter(w => CVC.test(w.word) && say(w.word[0]));
    if (words.length < 2) continue;
    const [from, to] = words;
    const built = itemFromChallenge({ id, mode: 'manipulate', originalWord: from.word, originalEmoji: from.emoji,
      resultWord: to.word, resultEmoji: to.emoji, operationDescription: `Change /${from.word[0]}/ to /${to.word[0]}/.` });
    if (built) return built;
  }
  return null;
}

/** Leak rule for a practice item: true if it changes the mode, uses a session word, or asks a session sound. */
export function practiceLeak(practice: PhonemeExplorerItem, item: PhonemeExplorerItem, items: readonly PhonemeExplorerItem[]): boolean {
  const used = phonemeSessionWords(items), asked = new Set(items.map(askedSound).filter(Boolean));
  const words = [practice.answer, practice.targetWord, practice.originalWord, ...(practice.menu ?? []).map(c => c.word)].map(low).filter(Boolean);
  const sound = askedSound(practice);
  return practice.kind !== item.kind || words.some(w => used.has(w)) || (!!sound && asked.has(sound));
}

/** What the pulled help levers put on screen, for the tutor. Never the item's answer or its asked sound. */
export function leversOnScreen(item: PhonemeExplorerItem, pulled: readonly string[], items: readonly PhonemeExplorerItem[]): string | null {
  const parts: string[] = [];
  const model = pulled.includes(POSITION_LEVER) ? positionModelFor(item, items) : null;
  if (model) {
    const at = POSITION[item.kind as keyof typeof POSITION];
    parts.push(`a model on another word, ${model.word}, in three sound boxes with the ${['first', 'middle', 'last'][at]} box lit: `
      + `its ${['first', 'middle', 'last'][at]} sound is ${say(phon(model)[at])}. Say the model; it is not this item's sound`);
  }
  if (pulled.includes(NAME_CARDS_LEVER)) parts.push('a speaker mark on each card: read every card aloud in screen order, evenly');
  if (pulled.includes(EXAMPLE_LEVER)) parts.push(`the example card for the sound (${item.exampleWord})`);
  if (pulled.includes(OPERATION_LEVER)) parts.push('the change is printed under the starting word');
  if (pulled.includes(SLIDE_LEVER)) parts.push('the sound tiles slid close together over an arrow. Say the sounds again with short gaps, '
    + 'each held into the next; stop before the word');
  if (pulled.includes(TOKENS_LEVER)) parts.push('a counter pad: the learner pushes one counter for each sound they say. It counts only their pushes');
  if (pulled.includes(MARK_LEVER)) parts.push('the starting word\'s sound boxes, with the box of the sound that changes emptied. Never say the new word');
  return parts.length ? parts.join('; ') : null;
}

/**
 * The levers this item declares. `withdrawn` says which tier aids the item's challenge withdrew (the example
 * card, the printed operation): only those come back as levers.
 */
export function phonemeExplorerLevers(item: PhonemeExplorerItem | null, pulled: readonly string[], items: readonly PhonemeExplorerItem[],
  withdrawn: { example?: boolean; operation?: boolean } = {}): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], answers: readonly PhonemeMiss[], when: string, does: string,
    carrier: WorkspaceLever['carrier'] = 'both') => levers.push({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const menu = item.kind === 'isolate' || item.kind === 'ending' || item.kind === 'medial';
  if (menu && positionModelFor(item, items)) add(POSITION_LEVER, 'help',
    item.kind === 'isolate' ? ['letter_name', 'echo_stimulus'] : ['onset_match'],
    item.kind === 'isolate' ? 'The learner names a letter or says the example back.' : 'The learner matches the first sound instead.',
    `Shows another word in three sound boxes with the ${item.kind === 'isolate' ? 'first' : item.kind === 'medial' ? 'middle' : 'last'} `
    + 'box lit. Say the model word and that sound; never this item\'s sound.');
  if (item.kind === 'isolate' && withdrawn.example && item.exampleWord) add(EXAMPLE_LEVER, 'help', ['letter_name'],
    'The learner cannot hear the sound at the start of a word yet.', 'Shows the example card: a picture word that starts with the sound.');
  if ((item.kind === 'isolate' || item.kind === 'medial') && item.enumerateMenu === false) add(NAME_CARDS_LEVER, 'help', ['echo_stimulus'],
    'The learner says a word that is not a card.', 'Marks each card with a speaker: read every card aloud in screen order, evenly.');
  if (item.kind === 'blend') add(SLIDE_LEVER, 'help', ['sounds_no_word', 'near_word'],
    'The learner says the sounds but no word, or a close different word.',
    'Slides the sound tiles together over an arrow. Say the sounds again with short gaps, each held into the next; stop before the word.');
  if (item.kind === 'segment') add(TOKENS_LEVER, 'help', ['count_off_one', 'word_for_count'],
    'The learner says the word back or a count one off.',
    'Shows a counter pad: the learner pushes one counter for each sound as they say it, then counts their counters.', 'shown');
  if (item.kind === 'manipulate' && changedBox(item) !== null) add(MARK_LEVER, 'help', ['other_position'],
    'The learner changes a different sound.', 'Shows the starting word in sound boxes and empties the box of the sound that changes.');
  if (item.kind === 'manipulate' && withdrawn.operation) add(OPERATION_LEVER, 'help', ['echo_original'],
    'The learner says the starting word back.', 'Prints the change under the starting word.');
  if (practiceItemFor(item, items)) add(SIMPLIFY_LEVER[item.kind], 'simplify', PHONEME_MISSES[item.kind],
    'The learner still cannot do it after help.',
    `Opens an easier practice item first: ${{ isolate: 'a held sound and two cards', ending: 'a new word and two cards', medial: 'a new word and two cards',
      blend: 'a short word that starts with a held sound', segment: 'a word with only two sounds', manipulate: 'a change to the first sound of a new word' }[item.kind]}. `
    + 'Not graded; the full item comes back after it.');
  return levers;
}
