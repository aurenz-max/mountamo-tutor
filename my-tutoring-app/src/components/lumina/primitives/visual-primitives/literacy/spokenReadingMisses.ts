/**
 * Spoken misses shared by the word- and line-reading families (handoff 20 Part B): the observable pattern of a
 * wrong read, stated for THIS printed word or line so the `spoken_miss` observer can match the learner's words to
 * it. Word reading: phonics-blender, di-word-reading, phoneme-explorer blend. Line reading: di-sentence-reading,
 * decodable-reader, read-aloud-studio.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';

/** Every letter's name as a child says it. */
export const LETTER_NAME: Readonly<Record<string, string>> = {
  a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'gee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay',
  l: 'ell', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee',
  w: 'double you', x: 'ex', y: 'why', z: 'zee',
};

/** A letter's sound as a child says it alone: held sounds stretched, the others with the "uh" a child adds. */
const CHILD_SOUND: Readonly<Record<string, string>> = {
  a: 'ah', e: 'eh', i: 'ih', o: 'aw', u: 'uh', m: 'mmm', s: 'sss', f: 'fff', l: 'lll', r: 'rrr', n: 'nnn',
  v: 'vvv', z: 'zzz', b: 'buh', c: 'kuh', k: 'kuh', d: 'duh', g: 'guh', h: 'huh', j: 'juh', p: 'puh', t: 'tuh',
  w: 'wuh', y: 'yuh', x: 'ks', q: 'kwuh',
};
/** One letter's sound as a child says it alone ("kuh" for c, "mmm" for m). */
export const childSound = (letter: string) => CHILD_SOUND[letter.toLowerCase()] ?? letter;

/**
 * Short-vowel CVC words whose letters are their sounds, for the "a real word one sound off" examples. No word
 * here sounds like another (no son/sun pair), so a neighbour is always heard as a different word.
 */
const CVC_WORDS = (
  'bat cat hat mat rat sat fat pat bad dad had mad pad sad bag rag tag wag can fan man pan ran tan van cap map '
  + 'nap tap lap gap jam ham ram dam lab cab tab wax bed red fed led wed bet get jet let met net pet set vet wet '
  + 'hen ten men pen den beg leg peg web big dig fig pig wig bin fin pin tin win kid lid hid bit fit hit kit '
  + 'lit pit sit dip hip lip rip sip tip zip mix six fix him rim cot dot got hot lot not pot box fox dog fog hog '
  + 'jog log job mob rob mop hop pop top cop nod rod mom bug dug hug jug mug rug tug bun fun gun run sun bus but '
  + 'cut hut nut cub rub tub cup pup bud mud gum hum sum'
).split(' ');
const CVC_SET = new Set(CVC_WORDS);

/** Real words close to a sight word in print or sound. */
const SIGHT_LOOKALIKES: Readonly<Record<string, readonly string[]>> = {
  the: ['they', 'then'], and: ['end', 'hand'], see: ['she', 'seed'], go: ['got', 'goat'], was: ['saw', 'as'],
  said: ['sad', 'sat'], is: ['it', 'in'], it: ['is', 'at'], of: ['off', 'on'], you: ['yes', 'yell'],
  to: ['top', 'toe'], he: ['her', 'hen'], she: ['see', 'shed'], we: ['wet', 'web'], me: ['my', 'men'],
  my: ['me', 'may'], are: ['art', 'ark'], for: ['from', 'fork'], with: ['wish', 'will'], they: ['the', 'then'],
  have: ['had', 'hive'], come: ['came', 'cone'], here: ['her', 'hear'], look: ['lock', 'took'], like: ['lick', 'lake'],
  can: ['cat', 'car'], play: ['plan', 'pay'], what: ['want', 'that'], where: ['were', 'there'],
};

/** Words read backwards that are real words. */
const REVERSIBLE_EXTRA = new Set(['was', 'saw', 'no', 'on']);

/** What a wrong read of one printed word shows. */
export type WordReadingMiss = 'sounds_no_word' | 'letter_name' | 'read_backwards' | 'similar_word'
  | 'first_sound_changed' | 'middle_sound_changed' | 'last_sound_changed';

const POSITIONS = [
  { id: 'first_sound_changed', name: 'FIRST' }, { id: 'middle_sound_changed', name: 'MIDDLE' },
  { id: 'last_sound_changed', name: 'LAST' },
] as const;

/** The real words that differ from `word` at letter `at` only, never a spelling of the same sound (c/k). */
function neighbours(word: string, at: number, exclude: ReadonlySet<string>): string[] {
  return CVC_WORDS.filter(w => w.length === word.length && w !== word && !exclude.has(w)
    && w.split('').every((l, i) => (i === at) !== (l === word[i]))
    && !['ck', 'kc'].includes(word[at] + w[at]));
}

export interface WordReadingOptions {
  /** The word's sounds as printed graphemes ("c","a","t"); omitted for a sight word. */
  sounds?: readonly string[];
  /** Words heard as the answer (ASR aliases, homophones): never an example. */
  accepted?: readonly string[];
  /** Ids this family may name, when its catalog declares a narrower set. */
  only?: readonly string[];
  /** The id for a real word one sound off, when the family names it without its position (`near_word`). */
  nearId?: string;
  /** The scene fact the patterns open with; default: the printed word. */
  fact?: string;
}

/**
 * The known wrong reads of one printed word, most specific first: the letter names, the sounds said one at a time
 * with no word, the word read backwards, then a real word one sound off (by position on a three-sound word,
 * a look-alike on a sight word).
 */
export function wordReadingMisses(printed: string, opts: WordReadingOptions = {}): KnownMiss[] {
  const word = printed.trim().toLowerCase(), letters = word.split('').filter(l => /[a-z]/.test(l));
  const exclude = new Set([word, ...(opts.accepted ?? []).map(a => a.trim().toLowerCase())]);
  const sounds = opts.sounds?.map(s => s.toLowerCase().replace(/[^a-z]/g, ''));
  const fact = opts.fact ?? `The printed word is "${word}". `;
  const said = (sounds ?? letters).map(s => CHILD_SOUND[s] ?? s);
  // Letter names first: spelled letters are also "separate parts with no word", and measured, a sounds-first list
  // named "C, A, T" `sounds_no_word` 40 of 40 times.
  const out: KnownMiss[] = [
    { id: 'letter_name', pattern: `${fact}The learner spells it with the NAMES of its letters, "${letters.map(l => l.toUpperCase()).join(', ')}" ("${letters.map(l => LETTER_NAME[l] ?? l).join(' ')}"), and not their sounds, instead of reading it.`,
      examples: [letters.map(l => l.toUpperCase()).join(', '), letters.map(l => LETTER_NAME[l] ?? l).join(' ')] },
    { id: 'sounds_no_word', pattern: `${fact}The learner says its SOUNDS one at a time (a held "mmm" or a clipped "tuh" is a sound, not a letter name), like "${said.join('... ')}", and never says them together as one word.`,
      examples: [said.join('... ')] },
  ];
  const back = word.split('').reverse().join('');
  if (back !== word && !exclude.has(back) && (CVC_SET.has(back) || REVERSIBLE_EXTRA.has(back)))
    out.push({ id: 'read_backwards', pattern: `${fact}The learner reads it backwards, from the last letter to the first, and says "${back}".`, examples: [back] });
  const oneSoundEach = !!sounds && sounds.length === word.length && sounds.every(s => s.length === 1);
  if (oneSoundEach && word.length === 3) {
    const found = POSITIONS.map((p, at) => ({ ...p, words: neighbours(word, at, exclude).slice(0, 2) }));
    if (opts.nearId) {
      const words = found.flatMap(f => f.words.slice(0, 1));
      out.push({ id: opts.nearId, pattern: `${fact}The learner says a different real word with ONE of its three sounds changed and the other two kept, like ${words.map(w => `"${w}"`).join(' or ') || 'another short word'}.`,
        ...(words.length ? { examples: words.slice(0, 2) } : {}) });
    } else {
      for (const f of found) out.push({ id: f.id, pattern: `${fact}The learner says a different real word with the ${f.name} sound of "${word}" changed and its other two sounds kept${f.words.length ? `, like ${f.words.map(w => `"${w}"`).join(' or ')}` : ''}.`,
        ...(f.words.length ? { examples: f.words } : {}) });
    }
  } else if (!sounds) {
    const alike = (SIGHT_LOOKALIKES[word] ?? []).filter(w => !exclude.has(w) && w !== back);
    if (alike.length) out.push({ id: 'similar_word', pattern: `${fact}The learner says a different real word that looks or sounds close to it, like ${alike.map(w => `"${w}"`).join(' or ')}.`, examples: [...alike] });
  }
  return opts.only ? out.filter(m => opts.only!.includes(m.id)) : out;
}

/** What a wrong read of a printed line shows (the skip id is the family's own: `word_skip` or `word_drop`). */
export type LineReadingMiss = 'word_skip' | 'word_drop' | 'word_swap' | 'paraphrase';

const SMALL_WORDS = new Set(['the', 'a', 'an', 'is', 'to', 'of', 'and', 'in', 'on', 'at', 'it', 'his', 'her', 'my', 'so', 'that', 'very']);
const SWAP_WORD: Readonly<Record<string, string>> = {
  the: 'a', a: 'the', an: 'the', is: 'was', was: 'is', he: 'she', she: 'he', his: 'her', her: 'his', we: 'you',
  in: 'on', on: 'in', at: 'on', can: 'ran', my: 'the', that: 'the', him: 'her',
};
const bare = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');
const withCase = (from: string, to: string) => (/^[A-Z]/.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to)
  + from.replace(/^[A-Za-z']+/, '');

/**
 * The known wrong reads of one printed line: a word left out, a word read as a different real word, and on a
 * dialogue line the idea said in other words. Examples change ONE word, the likeliest one (a small word).
 */
export function lineReadingMisses(text: string, ids: { skip: 'word_skip' | 'word_drop'; paraphrase?: boolean }): KnownMiss[] {
  const line = text.trim(), words = line.split(/\s+/);
  const small = words.findIndex((w, i) => i > 0 && SMALL_WORDS.has(bare(w)));
  const dropAt = small > 0 ? small : Math.min(1, words.length - 1);
  const dropped = words.filter((_, i) => i !== dropAt).join(' ');
  const swapAt = words.findIndex(w => SWAP_WORD[bare(w)]);
  const cvcAt = swapAt >= 0 ? -1 : words.findIndex(w => CVC_SET.has(bare(w)) && neighbours(bare(w), 0, new Set()).length);
  const swapped = swapAt >= 0 ? words.map((w, i) => (i === swapAt ? withCase(w, SWAP_WORD[bare(w)]) : w)).join(' ')
    : cvcAt >= 0 ? words.map((w, i) => (i === cvcAt ? withCase(w, neighbours(bare(w), 0, new Set())[0]) : w)).join(' ') : null;
  return [
    ...(words.length > 1 ? [{ id: ids.skip, pattern: `The printed line is "${line}". The learner reads it with a printed word left out and the other words in order, like "${dropped}".`, examples: [dropped] }] : []),
    { id: 'word_swap', pattern: `The printed line is "${line}". The learner reads one printed word as a different real word and the rest as printed${swapped ? `, like "${swapped}"` : ''}.`,
      ...(swapped ? { examples: [swapped] } : {}) },
    ...(ids.paraphrase ? [{ id: 'paraphrase', pattern: `The printed line is "${line}". The learner says what it means in their own words instead of reading it: most of the printed words are missing or changed.` }] : []),
  ];
}
