// The word library: every candidate word with its pronunciation, its letter-to-sound alignment, its
// familiarity, a picture when one exists, and its structure. Built from public sources in .cache/.
//
// The alignment is what makes "s a t i p n" usable: a word is decodable when every grapheme -> phoneme
// pair (GPC) in it has been taught. "pain" uses only s-a-t-i-p-n letters but needs ai -> /EY/, so it
// is out; "is" needs s -> /Z/, so it is out. Words the aligner cannot explain are dropped (safe side).
import fs from 'node:fs';
import path from 'node:path';

export const VOWEL_PHONES = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
// Sounds a child can stretch (/mmm/, /sss/): easier to isolate and blend than stops (/b/, /t/).
export const CONTINUANTS = new Set(['M', 'N', 'S', 'F', 'L', 'R', 'V', 'Z', 'SH', 'TH', 'DH', 'W', 'Y', 'HH', 'NG']);

// Grapheme -> phoneme sequences it may spell. Longest graphemes are tried first.
const GRAPHEMES = {
  tch: ['CH'], dge: ['JH'], igh: ['AY'],
  sh: ['SH'], ch: ['CH', 'K'], th: ['TH', 'DH'], wh: ['W', 'HH'], ng: ['NG'], ph: ['F'], ck: ['K'], qu: ['K W'], wr: ['R'], kn: ['N'],
  ss: ['S'], ll: ['L'], ff: ['F'], zz: ['Z'], tt: ['T'], pp: ['P'], nn: ['N'], dd: ['D'], gg: ['G'], bb: ['B'], mm: ['M'], rr: ['R'],
  ai: ['EY'], ay: ['EY'], ee: ['IY'], ea: ['IY', 'EH'], oa: ['OW'], ow: ['OW', 'AW'], ou: ['AW'], oi: ['OY'], oy: ['OY'],
  oo: ['UW', 'UH'], ew: ['UW', 'Y UW'], ue: ['UW'], au: ['AO'], aw: ['AO'],
  le: ['AH L', 'L'], ar: ['AA R'], or: ['AO R'], er: ['ER'], ir: ['ER'], ur: ['ER'],
  a: ['AE', 'EY', 'AH', 'AA', 'AO'], e: ['EH', 'IY', 'AH'], i: ['IH', 'AY', 'AH'], o: ['AA', 'AO', 'OW', 'AH'], u: ['AH', 'UW', 'UH', 'Y UW'],
  y: ['Y', 'IY', 'AY', 'IH'],
  b: ['B'], c: ['K', 'S'], d: ['D'], f: ['F'], g: ['G', 'JH'], h: ['HH'], j: ['JH'], k: ['K'], l: ['L'], m: ['M'], n: ['N', 'NG'],
  p: ['P'], r: ['R'], s: ['S', 'Z'], t: ['T'], v: ['V'], w: ['W'], x: ['K S', 'G Z'], z: ['Z'],
};
// Split digraph (vowel-consonant-e): the vowel letter carries the long sound, the final e is silent.
const SPLIT = { a: ['EY'], e: ['IY'], i: ['AY'], o: ['OW'], u: ['UW', 'Y UW'] };
const GRAPHEME_LIST = Object.keys(GRAPHEMES).sort((a, b) => b.length - a.length);
const VOWEL_GRAPHEME = /^[aeiou]|^y$|_e$/;

/** Align a spelling to phonemes. Returns [{g, p}] (p = space-joined phonemes) or null. */
export function align(word, phones) {
  const tryAlign = (letters, splitIdx) => {
    const memo = new Map();
    const go = (i, j) => {
      if (i === letters.length) return j === phones.length ? [] : null;
      const key = i * 100 + j;
      if (memo.has(key)) return memo.get(key);
      let found = null;
      const options = i === splitIdx
        ? [[`${letters[i]}_e`, SPLIT[letters[i]] ?? []]]
        : GRAPHEME_LIST.filter((g) => letters.slice(i, i + g.length).join('') === g
            && !(splitIdx >= 0 && splitIdx > i && splitIdx < i + g.length)).map((g) => [g, GRAPHEMES[g]]);
      for (const [g, seqs] of options) {
        const len = g.endsWith('_e') ? 1 : g.length;
        for (const seq of seqs) {
          const ps = seq.split(' ');
          if (ps.every((p, k) => phones[j + k] === p)) {
            const rest = go(i + len, j + ps.length);
            if (rest) { found = [{ g, p: seq }, ...rest]; break; }
          }
        }
        if (found) break;
      }
      memo.set(key, found);
      return found;
    };
    return go(0, 0);
  };
  const letters = [...word];
  const m = /^(.*?)([aeiou])([b-df-hj-np-tv-z]|ch|sh|th|ng|ck)e$/.exec(word);
  if (m) {
    // Try the split digraph first: "cake" = c|a_e|k, final e silent.
    const split = tryAlign([...word.slice(0, -1)], m[1].length);
    if (split) return split;
  }
  return tryAlign(letters, -1);
}

const stripStress = (p) => p.replace(/\d/g, '');

export function loadLexicon(cacheDir) {
  const read = (f) => fs.readFileSync(path.join(cacheDir, f), 'utf8');
  // Frequency rank (1 = most frequent).
  const rank = new Map();
  read('freq50k.txt').split('\n').forEach((line, i) => { const w = line.split(' ')[0]; if (w && !rank.has(w)) rank.set(w, i + 1); });
  // Words never offered to a child: public list + school-specific additions.
  const bad = new Set(read('badwords.txt').split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean));
  for (const w of ['tit', 'tits', 'nip', 'nips', 'pee', 'poo', 'poop', 'butt', 'fart', 'kill', 'gun', 'die', 'dead', 'hell', 'damn', 'crap',
    'sex', 'sexy', 'pot', 'beer', 'wine', 'drug', 'drugs', 'gay', 'fag', 'hoe', 'ho', 'pimp', 'slut', 'cum', 'jap', 'nig', 'coon', 'spic',
    'dick', 'cock', 'puss', 'piss', 'bra', 'nude', 'rape', 'stab', 'shot', 'bomb', 'god', 'sin', 'sins', 'hag', 'wop', 'kike', 'gyp', 'dope']) bad.add(w);
  // Restore the ones a K classroom needs back (pot = cooking pot is standard CVC; drop it from the deny list).
  bad.delete('pot');
  // Proper nouns: a word hunspell lists only capitalized.
  const dicLower = new Set(); const dicUpper = new Set();
  for (const line of read('en_US.dic').split('\n')) {
    const w = line.split('/')[0].trim();
    if (!w) continue;
    if (w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()) dicUpper.add(w.toLowerCase()); else dicLower.add(w);
  }
  // Pictures + concept taxonomy from emoji names.
  const emoji = new Map();
  let group = ''; let subgroup = '';
  for (const line of read('emoji-test.txt').split('\n')) {
    if (line.startsWith('# group:')) group = line.slice(8).trim();
    else if (line.startsWith('# subgroup:')) subgroup = line.slice(11).trim();
    else if (line.includes('; fully-qualified')) {
      const m = /#\s(\S+)\sE[\d.]+\s(.+)$/.exec(line);
      if (!m || m[2].includes(':')) continue; // skip skin-tone / gender variants
      const name = m[2].toLowerCase();
      const words = name.split(' ');
      const entry = { emoji: m[1], group, subgroup, name };
      if (words.length === 1 && !emoji.has(name)) emoji.set(name, entry);
      else if (words.length === 2 && words[1] === 'face' && !emoji.has(words[0])) emoji.set(words[0], { ...entry, name: words[0] });
    }
  }
  // Pronunciations.
  const prons = new Map();
  for (const line of read('cmudict.dict').split('\n')) {
    const m = /^([a-z]+)(?:\(\d\))?\s+([A-Z0-9 ]+?)(?:\s+#.*)?$/.exec(line.trim());
    if (!m) continue;
    const list = prons.get(m[1]) ?? [];
    list.push(m[2].split(' ').map(stripStress));
    prons.set(m[1], list);
  }

  const words = new Map();
  for (const [w, variants] of prons) {
    if (w.length > 10 || (w.length < 2 && w !== 'a' && w !== 'i')) continue;
    const r = rank.get(w);
    if (!r || r > 40000) continue;
    if (bad.has(w)) continue;
    const proper = dicUpper.has(w) && !dicLower.has(w);
    let alignment = null; let phones = null;
    for (const v of variants) { alignment = align(w, v); if (alignment) { phones = v; break; } }
    const syllables = (phones ?? variants[0]).filter((p) => VOWEL_PHONES.has(p)).length;
    const entry = { w, rank: r, proper, phones: phones ?? variants[0], allPhones: variants, alignment, syllables, picture: emoji.get(w) ?? null };
    if (alignment) {
      entry.gpcs = alignment.map(({ g, p }) => `${g}/${p}`);
      entry.shape = alignment.map(({ g, p }) => (VOWEL_GRAPHEME.test(g) && VOWEL_PHONES.has(p.split(' ')[0]) ? 'V' : 'C')).join('')
        + (alignment.some(({ g }) => g.endsWith('_e')) ? 'e' : '');
      entry.singleLetters = alignment.every(({ g }) => g.length === 1);
    }
    words.set(w, entry);
  }
  return { words, emoji, rank, bad, dicLower, dicUpper, prons };
}

/** Rime (vowel to end) of a one-syllable pronunciation; the rhyme key. */
export const rimeOf = (phones) => {
  const i = phones.findIndex((p) => VOWEL_PHONES.has(p));
  return i < 0 ? null : phones.slice(i).join(' ');
};
export const onsetOf = (phones) => {
  const i = phones.findIndex((p) => VOWEL_PHONES.has(p));
  return i < 0 ? phones : phones.slice(0, i);
};

/** Pictures already hand-picked in the repo's literacy tables ([word, emoji] pairs); fills words Unicode names miss. */
export function harvestRepoPictures(appDir, lexicon) {
  const harvested = new Map();
  for (const dir of ['src/components/lumina/primitives/visual-primitives/literacy', 'src/components/lumina/service/literacy']) {
    for (const f of fs.readdirSync(path.join(appDir, dir))) {
      if (!/\.tsx?$/.test(f) || /test/.test(f)) continue;
      const src = fs.readFileSync(path.join(appDir, dir, f), 'utf8');
      const re = /['"]([a-z]{2,12})['"][^'"\n]{0,30}?['"]((?:\p{Extended_Pictographic})[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f]*)['"]/gu;
      for (const m of src.matchAll(re)) if (!harvested.has(m[1])) harvested.set(m[1], { emoji: m[2], source: f });
    }
  }
  for (const [w, h] of harvested) { const e = lexicon.words.get(w); if (e && !e.picture) e.picture = { emoji: h.emoji, subgroup: null, source: h.source }; }
  return harvested;
}
