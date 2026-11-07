/**
 * The pictures a wonder walk may show: nouns from the reviewed word library (service/wordSpace/lexicon) that have an
 * emoji a five-year-old recognises. The author names words; code maps each to its picture, so an answer picture always
 * shows what its word says and no image model is ever the answer surface.
 */
import { lexWord, WORDS } from '../../wordSpace/lexicon';

/** Categories whose emoji show a thing (not an action, a quality or a feeling). */
const THING_CATEGORIES = new Set(['animal', 'nature', 'weather', 'food', 'drink', 'plant', 'person', 'home', 'tool',
  'vehicle', 'toy', 'sport', 'clothing', 'body', 'place', 'school', 'music', 'other', 'shape']);

const PICTURED = WORDS.filter(w => w.emoji && THING_CATEGORIES.has(w.category) && (w.knownBy === 'K' || w.knownBy === 'G1'));
const PICTURED_SET = new Set(PICTURED.map(w => w.w));

/** Plural-blind form a library word can be matched by ("frogs" -> "frog", "foxes" -> "fox"). */
export function baseForm(word: string): string {
  const w = word.trim().toLowerCase();
  const stems = [w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, '')].filter(s => s !== w);
  // A pictured word first ("frogs" is a library word too, but "frog" is the picture), then any library word.
  for (const set of [(x: string) => PICTURED_SET.has(x), (x: string) => !!lexWord(x)])
    for (const x of [w, ...stems]) if (set(x)) return x;
  return w;
}

/** The picture for a word, or null when the library has none for it. */
export function pictureOf(word: string): { word: string; emoji: string } | null {
  const w = baseForm(word);
  if (!PICTURED_SET.has(w)) return null;
  return { word: w, emoji: lexWord(w)!.emoji! };
}

/** Action pictures (run, hop, sleep): things a child does, for sorting doing-words from things (L.K.1b). Language stops only. */
const ACTIONS = WORDS.filter(w => w.emoji && w.category === 'action' && (w.knownBy === 'K' || w.knownBy === 'G1') && !/ing$/.test(w.w));
const ACTION_SET = new Set(ACTIONS.map(w => w.w));

/** A picture or an action picture. */
export function wordPictureOf(word: string): { word: string; emoji: string } | null {
  const p = pictureOf(word);
  if (p) return p;
  const w = word.trim().toLowerCase();
  return ACTION_SET.has(w) ? { word: w, emoji: lexWord(w)!.emoji! } : null;
}
export const actionMenu = () => ACTIONS.map(w => w.w).join(', ');

/** The picture menu for the author's prompt: every pictured word, by category. */
export function pictureMenu(): string {
  const by = new Map<string, string[]>();
  for (const w of PICTURED) by.set(w.category, [...(by.get(w.category) ?? []), w.w]);
  return Array.from(by.entries()).map(([c, ws]) => `${c}: ${ws.join(', ')}`).join('\n');
}

/** Close pictured words for a word the library cannot picture (same first letter), for the agent's error message. */
export function picturedNear(word: string, n = 8): string[] {
  const first = word.trim().toLowerCase()[0];
  return PICTURED.filter(w => w.w[0] === first).slice(0, n).map(w => w.w);
}

/** Function words and inflections a narration may use that the word check skips. */
const FUNCTION = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'it', 'its', 'this', 'that', 'these', 'those', 'and', 'or',
  'but', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'can', 'do', 'does', 'you', 'we', 'they', 'he', 'she', 'i', 'me',
  'my', 'your', 'our', 'their', 'what', 'which', 'one', 'who', 'how', 'why', 'not', 'no', 'yes', 'so', 'very', 'all',
  'some', 'has', 'have', 'need', 'needs', 'look', 'see', 'tap', 'here', 'there', 'be', 'from', 'up', 'down', 'out',
  // Kindergarten counting words (K.CC): the math stops say them by design.
  'many', 'more', 'most', 'fewer', 'less', 'count', 'counts', 'group', 'groups', 'number', 'numbers', 'touch', 'each',
  'last', 'same', 'together', 'let', 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  // Kindergarten language words (RF.K.1-3, L.K.1, RL.K): the language stops say them by design.
  'word', 'words', 'sound', 'sounds', 'letter', 'letters', 'rhyme', 'rhymes', 'rhyming', 'listen', 'picture', 'pictures', 'middle',
  'start', 'starts', 'end', 'ends', 'ending', 'clap', 'claps', 'slowly', 'slow', 'fast', 'faster', 'something', 'where', 'than',
  'story', 'first', 'then', 'next', 'after', 'stretch', 'say', 'says', 'said', 'part', 'parts', 'put', 'goes', 'change', 'new', 'now',
  'think', 'back', 'hear', 'different', 'once', 'under', 'beside', 'below', 'show', 'shows', 'find', 'match', 'small', 'big', 'name']);

/** Words a Kindergartner may not know: not in the library, or past grade 1 there. */
export function hardWords(sentence: string): string[] {
  const words = sentence.toLowerCase().match(/[a-z']+/g) ?? [];
  return Array.from(new Set(words)).filter(raw => {
    const w = raw.replace(/'s$/, '');
    if (FUNCTION.has(w) || w.length < 3) return false;
    const forms = [w, baseForm(w), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/d$/, '')];
    return !forms.some(f => { const x = lexWord(f); return x && (x.knownBy === 'K' || x.knownBy === 'G1'); });
  });
}
