/**
 * Letter build — the shared open build for CVC spelling (qa/open-build/ROADMAP.md, OB-3L L2 + L3). The learner puts a
 * letter from a bank into each of three boxes to MAKE a real word for an ask, then presses "I'm done!". Three asks:
 *   - vowel: "Make a real word with the short a sound in the middle"   (cvc-speller `make_word`)
 *   - rhyme: "Make a real word that rhymes with cat"                    (cvc-speller `make_word`)
 *   - swap:  "Change one letter in cat to make a new real word"         (sound-swap `swap_build`)
 * Many words pass. Code checks everything the ask states (the shape, the vowel, the family, one letter changed, not the
 * given word, not a word already made); the shared literacy judge (`judgeWordBuild`, `only: 'real_word'`) decides only
 * whether the word is real. Asks are code-owned: an ask ships only when 3+ words from `letterBuildWords.ts` in the
 * lesson's letter group answer it.
 *
 * Pure: the surface, the generators, the live adapters and the tests read the same rules.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';
import { BLEND_END, BLEND_START, CVC_FAMILIES, CVC_WORDS, GIVEN_WORDS, NOT_FOR_LESSONS } from './letterBuildWords';
import {
  SYLLABLE_BUILD_MISSES, askableSyllableItem, describeSyllableBuild, smallSyllableItem, syllableBuildLevers, syllableBuildScene,
  syllableLeverFacts, syllableMissWords, syllableModelFor, syllableShapeMiss,
} from './syllableBuild';

export type LetterAskKind = 'vowel' | 'rhyme' | 'swap' | 'blend_start' | 'blend_end' | 'syllables';
/** The blend kinds build from two tiles, a start and an ending (bl + ack), not three single letters. */
export const isChunk = (kind: LetterAskKind) => kind === 'blend_start' || kind === 'blend_end';
/** syllables (syllable-clapper `build_parts`, `syllableBuild.ts`): the row grows card by card; how many is the task. */
export const isOpenRow = (kind: LetterAskKind) => kind === 'syllables';

export interface LetterBuildItem {
  id: string;
  kind: LetterAskKind;
  /** The task as said and printed. Names a vowel sound or a given word, never a word that passes. */
  ask: string;
  /** vowel: the short vowel the middle box must hold. */
  vowel?: string;
  /** rhyme / swap: the given word. */
  word?: string;
  /** The letters the learner can use (each is unlimited). */
  bank: string[];
  /** Words that answer the ask from the bank (hidden: the gate, the oracle and the levers read them). */
  examples: string[];
  ways: 1 | 2;
  /** syllables: the number of parts (claps) the ask names. */
  parts?: number;
}

export interface LetterBuildData {
  title: string;
  task: 'letter_build';
  buildItems: LetterBuildItem[];
  gradeLevel?: string;
  supportTier?: 'easy' | 'medium' | 'hard';
}

export type LetterBuildMiss = 'not_cvc' | 'wrong_vowel' | 'wrong_family' | 'same_as_given' | 'changed_more' | 'same_word'
  | 'pick_another' | 'not_a_word' | 'no_blend' | 'wrong_order' | 'too_few_parts' | 'too_many_parts' | 'counted_letters';
export const LETTER_BUILD_MISSES: Record<LetterAskKind, readonly LetterBuildMiss[]> = {
  vowel: ['not_cvc', 'wrong_vowel', 'same_word', 'pick_another', 'not_a_word'],
  rhyme: ['not_cvc', 'same_as_given', 'wrong_family', 'same_word', 'pick_another', 'not_a_word'],
  swap: ['not_cvc', 'same_as_given', 'changed_more', 'same_word', 'pick_another', 'not_a_word'],
  blend_start: ['wrong_order', 'no_blend', 'same_word', 'pick_another', 'not_a_word'],
  blend_end: ['wrong_order', 'no_blend', 'same_word', 'pick_another', 'not_a_word'],
  syllables: SYLLABLE_BUILD_MISSES,
};

const VOWELS = 'aeiou';
const isVowel = (l: string) => VOWELS.includes(l);
export const KEYWORD: Record<string, string> = { a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up' };

/** What the boxes show when an item opens: empty, or the given word on a swap. */
export const startRow = (item: LetterBuildItem): string[] => isOpenRow(item.kind) ? [] :
  item.kind === 'swap' && item.word ? item.word.split('') : isChunk(item.kind) ? ['', ''] : ['', '', ''];

/** Everything the ask states, checked in code before any judge. Undefined: a well-made word, waiting on "is it real?". */
export function letterShapeMiss(item: LetterBuildItem, row: readonly string[], made: readonly string[] = []): LetterBuildMiss | undefined {
  if (item.kind === 'syllables') return syllableShapeMiss(item, row, made);
  const w = row.join('').toLowerCase();
  if (isChunk(item.kind)) {
    const [start, end] = row;
    if (row.length !== 2 || !start || !end || start.split('').some(isVowel) || !isVowel(end[0])) return 'wrong_order';
    if (item.kind === 'blend_start' && start.length < 2) return 'no_blend';
    if (item.kind === 'blend_end' && (end.length < 3 || isVowel(end[end.length - 1]) || isVowel(end[end.length - 2]))) return 'no_blend';
    if (made.includes(w)) return 'same_word';
    if (NOT_FOR_LESSONS.has(w)) return 'pick_another';
    return undefined;
  }
  if ((item.kind === 'rhyme' || item.kind === 'swap') && w === item.word) return 'same_as_given';
  if (row.length !== 3 || isVowel(row[0]) || !isVowel(row[1]) || isVowel(row[2])) return 'not_cvc';
  if (item.kind === 'vowel' && row[1] !== item.vowel) return 'wrong_vowel';
  if (item.kind === 'rhyme' && w.slice(1) !== item.word!.slice(1)) return 'wrong_family';
  if (item.kind === 'swap' && w.split('').filter((l, i) => l !== item.word![i]).length > 1) return 'changed_more';
  if (made.includes(w)) return 'same_word';
  if (NOT_FOR_LESSONS.has(w)) return 'pick_another';
  return undefined;
}

/** The gate: an item ships when its ask names no passing word and at least two bank words answer it. */
export function askableLetterItem(item: LetterBuildItem): LetterBuildItem | null {
  if (!item?.ask || !Array.isArray(item.bank) || !Array.isArray(item.examples)) return null;
  if (item.kind === 'syllables') return askableSyllableItem(item);
  const bank = new Set(item.bank);
  const buildable = (w: string) => isChunk(item.kind)
    ? [1, 2, 3].some(i => bank.has(w.slice(0, i)) && bank.has(w.slice(i)) && !letterShapeMiss({ ...item, ways: 1 }, [w.slice(0, i), w.slice(i)]))
    : w.length === 3 && w.split('').every(l => bank.has(l)) && !letterShapeMiss({ ...item, ways: 1 }, w.split(''));
  const examples = Array.from(new Set(item.examples)).filter(buildable);
  const ask = item.ask.toLowerCase();
  if (examples.length < 2 || examples.some(w => new RegExp(`\\b${w}\\b`).test(ask))) return null;
  if ((item.kind === 'rhyme' || item.kind === 'swap') && !/^[a-z]{3}$/.test(item.word ?? '')) return null;
  if (item.kind === 'vowel' && !isVowel(item.vowel ?? '')) return null;
  return { ...item, examples };
}

export function letterItemsFrom(items: readonly LetterBuildItem[], tier?: string): LetterBuildItem[] {
  return items.map(askableLetterItem).filter((i): i is LetterBuildItem => !!i)
    .map((i, n) => ({ ...i, id: i.id || `l${n + 1}`, ways: tier !== 'easy' && n % 2 === 1 ? 2 : 1 }));
}

// ── Code-owned asks ──────────────────────────────────────────────────────────

const shuffle = <T,>(xs: readonly T[]): T[] => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const fits = (w: string, letters: ReadonlySet<string>) => w.split('').every(l => letters.has(l));

/** One-letter neighbours of a word among the seed words. */
const neighbours = (word: string, letters: ReadonlySet<string>) =>
  CVC_WORDS.filter(w => w !== word && fits(w, letters) && w.split('').filter((l, i) => l !== word[i]).length === 1);

function bankFor(examples: readonly string[], letters: ReadonlySet<string>, extra: readonly string[]): string[] {
  const need = new Set(examples.flatMap(w => w.split('')));
  const foils = shuffle(Array.from(letters).filter(l => !need.has(l) && !isVowel(l))).slice(0, 2);
  return Array.from(new Set([...Array.from(need), ...extra.filter(l => letters.has(l)), ...foils])).sort();
}

/**
 * Asks for a session, code-owned. `kinds` rotates (vowel, rhyme for cvc-speller; swap for sound-swap); `letters` is the
 * lesson's usable letters (the letter group); `vowels` narrows the vowel and the family when the objective names one.
 */
export function makeLetterItems(kinds: readonly LetterAskKind[], letters: readonly string[], vowels: readonly string[],
    count = 4): LetterBuildItem[] {
  const set = new Set(letters);
  const pool = vowels.length ? vowels : VOWELS.split('').filter(v => set.has(v));
  const otherVowel = (v: string) => VOWELS.split('').find(x => x !== v && set.has(x));
  const usedWords = new Set<string>(), usedVowels = new Set<string>();
  const out: LetterBuildItem[] = [];
  for (let n = 0; out.length < count && n < count * 6; n++) {
    const kind = kinds[out.length % kinds.length];
    if (isChunk(kind)) {
      const source = kind === 'blend_start' ? BLEND_START : BLEND_END;
      const fresh = source.filter(([a, b]) => !usedWords.has(a + b));
      const picks = shuffle(fresh).slice(0, 5);
      if (picks.length < 3) continue;
      picks.forEach(([a, b]) => usedWords.add(a + b));
      const starts = Array.from(new Set(picks.map(([a]) => a)));
      const ends = Array.from(new Set(picks.map(([, b]) => b)));
      // One foil of each tile kind: a single consonant start for blend_start, an ending with no blend for blend_end.
      const foils = kind === 'blend_start' ? ['m', 'ug'] : ['bl', 'at'];
      out.push({ id: `l${out.length + 1}`, kind, ways: 1, examples: picks.map(([a, b]) => a + b),
        ask: kind === 'blend_start' ? 'Make a real word that starts with two consonant sounds blended together.'
          : 'Make a real word that ends with two consonant sounds blended together.',
        bank: shuffle([...starts, ...ends, ...foils]) });
      continue;
    }
    if (kind === 'vowel') {
      const v = shuffle(pool.filter(x => !usedVowels.has(x)))[0] ?? shuffle(pool)[0];
      const examples = shuffle(CVC_WORDS.filter(w => w[1] === v && fits(w, set))).slice(0, 6);
      if (examples.length < 3) continue;
      usedVowels.add(v);
      out.push({ id: `l${out.length + 1}`, kind, vowel: v, ways: 1, examples,
        ask: `Make a real word with the short ${v} sound in the middle, like in ${KEYWORD[v]}.`,
        bank: bankFor(examples, set, [otherVowel(v) ?? ''].filter(Boolean)) });
    } else if (kind === 'rhyme') {
      const families = shuffle(Object.entries(CVC_FAMILIES).filter(([rime]) => pool.includes(rime[0])));
      const hit = families.map(([, words]) => words.filter(w => fits(w, set) && !usedWords.has(w)))
        .find(ws => ws.length >= 4 && ws.some(w => GIVEN_WORDS.has(w)));
      if (!hit) continue;
      const word = shuffle(hit).find(w => GIVEN_WORDS.has(w));
      if (!word) continue;
      const examples = shuffle(hit.filter(w => w !== word));
      usedWords.add(word);
      out.push({ id: `l${out.length + 1}`, kind, word, ways: 1, examples: examples.slice(0, 6),
        ask: `Make a real word that rhymes with ${word}.`, bank: bankFor(examples.slice(0, 6), set, []) });
    } else {
      // A given word differs from every earlier one in at least two letters: bat, cat, can in one session is one ask.
      const far = (w: string) => Array.from(usedWords).every(u => w.split('').filter((l, i) => l !== u[i]).length >= 2);
      const word = shuffle(CVC_WORDS.filter(w => GIVEN_WORDS.has(w) && fits(w, set) && pool.includes(w[1]) && far(w)))
        .find(w => neighbours(w, set).length >= 3);
      if (!word) continue;
      const examples = shuffle(neighbours(word, set)).slice(0, 6);
      usedWords.add(word);
      out.push({ id: `l${out.length + 1}`, kind, word, ways: 1, examples,
        ask: `Change one letter in ${word} to make a new real word.`, bank: bankFor([word, ...examples], set, []) });
    }
  }
  return out;
}

// ── The workspace ────────────────────────────────────────────────────────────

const waysLine = (item: LetterBuildItem) => item.ways === 2 ? ' Then make a different one.' : '';

export const letterAssignment = (item: LetterBuildItem): TeachingAssignment =>
  ({ id: item.id, task: `${item.ask}${waysLine(item)}`, response: 'gesture' });

export const describeLetterBuild = (row: readonly string[], kind?: LetterAskKind) => kind === 'syllables' ? describeSyllableBuild(row) :
  row.some(Boolean) ? `Built "${row.map(l => l || '_').join('')}"` : 'Built nothing';

export const letterJudgeRequest = (item: LetterBuildItem, row: readonly string[], grade?: string): WordBuildJudgeRequest =>
  ({ ask: item.ask, made: row.join(''), only: 'real_word', ...(grade ? { grade } : {}) });

export function letterBuildScene(item: LetterBuildItem, row: readonly string[], made: readonly string[], inspectorSaid?: string): WorkspaceScene {
  if (item.kind === 'syllables') return syllableBuildScene(item, row, made, inspectorSaid);
  return { objects: [], facts: {
    ask: item.ask,
    letterBank: item.bank.join(' '),
    boxes: row.map(l => l || '_').join(' '),
    lettersPlaced: row.filter(Boolean).length,
    ...(item.kind === 'swap' ? { lettersChanged: row.filter((l, i) => l && l !== item.word![i]).length } : {}),
    ...(item.ways === 2 ? { waysAsked: 2, waysMade: made.length, madeBefore: made.join(', ') || 'none' } : {}),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The learner taps a letter or tile from the bank into the next empty box, taps a box to empty it, '
      + 'and presses "I\'m done!". The builder checks what the ask states, then whether it is a real word. Many words '
      + 'can pass. You cannot place or remove a letter.',
  } };
}

// ── Levers (start bare) ──────────────────────────────────────────────────────

export const PATTERN_LEVER = 'pattern_card';
export const MODEL_LEVER = 'model_word';
export const SMALL_BANK_LEVER = 'small_bank';

/** What the pattern card shows: the shape the ask fixes, never a letter the learner must choose. */
export function patternFor(item: LetterBuildItem): string {
  if (item.kind === 'blend_start') return 'two consonants + an ending   (start the word with a blend tile)';
  if (item.kind === 'blend_end') return 'a start + an ending that finishes with two consonants';
  if (item.kind === 'vowel') return `_ ${item.vowel} _   (${item.vowel} as in ${KEYWORD[item.vowel!]})`;
  if (item.kind === 'rhyme') return `_ ${item.word![1]} ${item.word![2]}   (the end of ${item.word})`;
  return `${item.word!.split('').join(' ')}   (keep two letters, change one)`;
}

/** A solved item of the same kind on other letters: a different vowel, family or word. */
export function modelFor(item: LetterBuildItem): string | null {
  const other = (w: string) => !item.examples.includes(w) && w !== item.word && (item.kind !== 'vowel' || w[1] !== item.vowel)
    && (item.kind !== 'rhyme' || w.slice(1) !== item.word!.slice(1));
  if (item.kind === 'syllables') { const m = syllableModelFor(item); return m ? `${m.cards.join(' + ')} = ${m.word}` : null; }
  if (isChunk(item.kind)) {
    const pair = (item.kind === 'blend_start' ? BLEND_START : BLEND_END).find(([a, b]) => !item.examples.includes(a + b)
      && !item.bank.includes(a) && !item.bank.includes(b));
    return pair ? `${pair[0]} + ${pair[1]} = ${pair[0] + pair[1]}` : null;
  }
  if (item.kind === 'swap') {
    const base = CVC_WORDS.find(w => other(w) && CVC_WORDS.some(x => x !== w && x.split('').filter((l, i) => l !== w[i]).length === 1 && other(x)));
    const to = base && CVC_WORDS.find(x => x !== base && x.split('').filter((l, i) => l !== base[i]).length === 1 && other(x));
    return base && to ? `${base} → ${to}` : null;
  }
  if (item.kind === 'rhyme') {
    const fam = Object.values(CVC_FAMILIES).find(ws => ws.every(other));
    return fam ? `${fam[0]} → ${fam[1]}` : null;
  }
  const w = CVC_WORDS.find(other);
  return w ? `${w[1]}: ${w}` : null;
}

/** The easier practice item: the same ask, one word, a bank of only the letters one example needs plus one other. */
export function smallBankFor(item: LetterBuildItem): LetterBuildItem | null {
  if (item.kind === 'syllables') return smallSyllableItem(item);
  const ex = item.examples.slice(0, 2);
  if (isChunk(item.kind)) {
    const tiles = item.bank.filter(t => ex.some(w => w.startsWith(t) || w.endsWith(t)));
    return tiles.length < item.bank.length ? { ...item, id: `${item.id}~small`, ways: 1, bank: tiles, examples: ex } : null;
  }
  const bank = Array.from(new Set(ex.flatMap(w => w.split('')))).sort();
  if (bank.length >= item.bank.length) return null;
  return { ...item, id: `${item.id}~small`, ways: 1, bank, examples: ex };
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly LetterBuildMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function letterBuildLevers(item: LetterBuildItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  if (item.kind === 'syllables') return syllableBuildLevers(item, pulled);
  // The card shows the part the ask fixes, which answers every shape miss whatever the ask's kind.
  const shapeMisses: LetterBuildMiss[] = ['not_cvc', 'wrong_vowel', 'wrong_family', 'same_as_given', 'changed_more', 'no_blend', 'wrong_order'];
  return [
    lever(PATTERN_LEVER, 'help', shapeMisses,
      'The learner\'s word does not have the shape the ask needs (the wrong middle sound, a different ending, more than one letter changed, or the given word back).',
      'Shows a pattern card above the boxes with the part the ask fixes and blanks for the rest, such as _ a _ or _ a t. No letter the learner must choose is filled in.',
      pulled),
    ...(modelFor(item) ? [lever(MODEL_LEVER, 'help', ['not_a_word'],
      'The learner makes letters that are not a real word.',
      'Shows one solved example of the same kind made with other letters (another vowel, family or word), so the learner sees how a real word comes out. It shares no answer with this item.',
      pulled)] : []),
    ...(smallBankFor(item) ? [lever(SMALL_BANK_LEVER, 'simplify', ['not_a_word'],
      'The learner keeps making letters that are not a word, or cannot start with so many letters.',
      'Opens the same ask first with a smaller letter bank, one word only. It is not graded; the full item comes back after it.',
      pulled)] : []),
  ];
}

export function letterLeverFacts(pulled: readonly string[], item: LetterBuildItem): string | undefined {
  if (item.kind === 'syllables') return syllableLeverFacts(pulled, item);
  const notes = [
    pulled.includes(PATTERN_LEVER) && `A pattern card above the boxes shows: ${patternFor(item)}.`,
    pulled.includes(MODEL_LEVER) && `A solved example on other letters is shown: ${modelFor(item)}.`,
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

export function letterMissWords(miss: LetterBuildMiss | undefined, item: LetterBuildItem): string {
  if (item.kind === 'syllables') return syllableMissWords(miss, item);
  switch (miss) {
    case 'not_cvc': return 'A word here has a vowel in the middle box and other letters on each side.';
    case 'wrong_vowel': return `Listen to the middle sound. The ask wants the short ${item.vowel} sound.`;
    case 'wrong_family': return `Say ${item.word} and your word. Do they end the same way?`;
    case 'same_as_given': return `That is ${item.word} itself. Make a different word.`;
    case 'changed_more': return 'More than one letter changed. Keep two letters the same.';
    case 'same_word': return 'You already made that word. Make a different one.';
    case 'pick_another': return 'Let us pick a different word for this one.';
    case 'not_a_word': return 'Hmm, that is not a word we use. Try a different letter.';
    case 'no_blend': return item.kind === 'blend_start' ? 'Listen to the start: a blend has two consonant sounds together.'
      : 'Listen to the end: a blend has two consonant sounds together.';
    case 'wrong_order': return 'The start tile goes first and the ending tile goes second.';
    default: return 'Not quite. Try again.';
  }
}
