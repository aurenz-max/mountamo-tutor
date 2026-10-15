// Curriculum text -> a scope the word library can filter on. Code only: no LLM.
//
// A scope names the TASK (what the child does with the word) and, for reading/spelling tasks, the
// taught letter-sound pairs: `known` (everything taught so far) and `focus` (what this lesson is
// about). A word is decodable under a scope when all of its GPCs are in `known`.

// The most common sound of each letter, as letter-sound lessons teach it ("q is taught as qu").
export const BASIC_SOUND = {
  s: ['S'], a: ['AE'], t: ['T'], i: ['IH'], p: ['P'], n: ['N'], c: ['K'], k: ['K'], e: ['EH'], h: ['HH'], r: ['R'], m: ['M'],
  d: ['D'], g: ['G'], o: ['AA', 'AO'], u: ['AH'], l: ['L'], f: ['F'], b: ['B'], j: ['JH'], z: ['Z'], w: ['W'], v: ['V'],
  y: ['Y'], x: ['K S'], qu: ['K W'],
};
export const ALPHABET = Object.keys(BASIC_SOUND);
// Group progression the published K units use (Letter Group 1..4).
export const GROUP_NEW = { 1: 'satipn', 2: 'ckehrmd', 3: 'goulfb', 4: ['j', 'z', 'w', 'v', 'y', 'x', 'qu'] };
const SHORT = { a: 'AE', e: 'EH', i: 'IH', o: ['AA', 'AO'], u: 'AH' };

export const gpcsForLetters = (letters) => {
  const out = new Set();
  for (const l of letters) for (const p of BASIC_SOUND[l] ?? []) out.add(`${l}/${p}`);
  // Assumption (flagged in the report): ck is taught with c and k, as in the group-2 sequence.
  if (letters.includes('c') && letters.includes('k')) out.add('ck/K');
  return out;
};

const lettersIn = (s) => {
  const out = [];
  for (const m of s.toLowerCase().matchAll(/\b(qu|[a-z])\b/g)) {
    const l = m[1] === 'q' ? 'qu' : m[1];
    if (!out.includes(l)) out.push(l);
  }
  return out;
};

/** Example words a subskill names ("Examples: cat, map" / "(e.g., cat, map)" / "cap/cape"). */
export function examplesIn(text) {
  const out = [];
  const grab = (s) => { for (const m of s.matchAll(/[a-z]+(?:\/[a-z]+)?/g)) out.push(m[0]); };
  for (const m of text.matchAll(/Examples?:\s*([^\n]*)/gi)) grab(m[1].split(/Constraints?:|Task:/i)[0].toLowerCase());
  for (const m of text.matchAll(/\(e\.g\.,?\s*([^)]*)\)/gi)) grab(m[1].toLowerCase());
  return [...new Set(out)].filter((w) => !['etc', 'or', 'and', 'the', 'e', 'g', 'vs', 'a'].includes(w));
}

/**
 * Parse one subskill into a scope. Returns { task, ... } or { task: 'none', why }.
 * `primitive` is the curriculum's target_primitive, used only as a tie-breaker for the task.
 */
export function parseScope(sub) {
  const text = sub.subskill_description ?? '';
  const t = text.toLowerCase();
  const title = t.split('\n')[0];
  const base = { examples: examplesIn(text), title: text.split('\n')[0].trim().slice(0, 90) };

  // ---- Letter groups: "Letter Group 2: c, k, e ..." / "Full Practice Set (Cumulative): s, a, t ..."
  const groupM = /group\s*([1-4])/.exec(title);
  if (groupM && /letter/.test(title)) {
    const cumM = /cumulative\):?\**\s*\n?([a-z ,]+)/i.exec(text);
    const known = cumM ? lettersIn(cumM[1]) : null;
    const focus = lettersIn(title.split(':').slice(1).join(':'));
    const kind = /formation/.test(title) ? 'letter-form' : /sound/.test(title) ? 'letter-sound' : 'letter-id';
    return { ...base, task: kind, group: Number(groupM[1]), knownLetters: known, focusLetters: focus,
      known: gpcsForLetters(known ?? []), focus: gpcsForLetters(focus) };
  }

  const allBasic = gpcsForLetters(ALPHABET);
  const vowelsNamed = [...t.matchAll(/short\s*['‘’"]?([aeiou])\b/g)].map((m) => m[1]);
  const shortFocus = (vs) => new Set(vs.flatMap((v) => [].concat(SHORT[v]).map((p) => `${v}/${p}`)));

  // ---- Oral phonological tasks (no reading: the word is heard, a picture may show it).
  if (/rhyme/.test(t)) {
    if (/recognize if two/.test(t)) return { ...base, task: 'rhyme-recognize' };
    if (/identify the rhyming word/.test(t)) return { ...base, task: 'rhyme-identify' };
    if (/produce a word that rhymes|generate rhyming/.test(t)) return { ...base, task: 'rhyme-produce' };
    if (/famil|three-word|pairs/.test(t)) return { ...base, task: 'rhyme-family' };
  }
  if (/syllable/.test(t)) {
    if (/^blend/.test(t)) return { ...base, task: 'syllable-blend' };
    if (/^segment/.test(t)) return { ...base, task: 'syllable-segment' };
  }
  if (/onset and rime/.test(t)) return { ...base, task: /^blend/.test(t) ? 'onset-rime-blend' : 'onset-rime-split' };
  if (/beginning sound/.test(t)) return { ...base, task: 'sound-initial' };
  if (/ending sound/.test(t)) return { ...base, task: 'sound-final' };
  if (/medial sound/.test(t)) return { ...base, task: 'sound-medial' };
  if (/blend three phonemes|blend and segment individual sounds/.test(t)) return { ...base, task: 'phoneme-blend' };
  if (/segment a cvc word into three phonemes/.test(t)) return { ...base, task: 'phoneme-segment' };
  if (/^add a phoneme/.test(t)) return { ...base, task: 'swap-add' };
  if (/^delete a phoneme/.test(t)) return { ...base, task: 'swap-delete' };
  if (/^substitute one phoneme/.test(t)) return { ...base, task: 'swap-substitute' };
  if (/long and short vowel sounds in single-syllable/.test(t)) return { ...base, task: 'vowel-length' };

  // ---- Not word-library tasks (yet): routed before the patterns they mention in passing.
  if (/-ed and -ing|suffix|inflectional/.test(t)) return { ...base, task: 'none', why: 'morphology (base + ending): library can supply bases; ending rules are a next step' };
  if (/phrases|sentences|connected text/.test(t) && !/sight word recognition/.test(t)) return { ...base, task: 'none', why: 'connected text: LLM band (words drawn from the decode hopper)' };
  if (/seasonal|defining characteristics|attributes/.test(t)) return { ...base, task: 'none', why: 'category needs knowledge the ratings do not hold (season, attributes)' };

  // ---- Reading / spelling tasks (decodability matters).
  if (/minimal pairs between short and long/.test(t)) return { ...base, task: 'long-short-pairs' };
  if (/silent e/.test(t)) {
    return { ...base, task: 'decode', shapes: ['CVCe'], known: new Set([...allBasic, 'a_e/EY', 'i_e/AY', 'o_e/OW', 'u_e/UW', 'u_e/Y UW', 'e_e/IY']),
      focus: new Set(['a_e/EY', 'i_e/AY', 'o_e/OW', 'u_e/UW', 'u_e/Y UW', 'e_e/IY']), focusRule: 'every' };
  }
  const clusterList = (s) => [...s.matchAll(/\b([a-z]{2})\b/g)].map((m) => m[1]);
  if (/initial consonant blends/.test(t)) {
    const list = clusterList(/blends\s*\(([^)]*)\)/.exec(t)?.[1] ?? '');
    return { ...base, task: 'decode', shapes: ['CCVC', 'CCVCC'], known: allBasic, onsetClusters: list, focusRule: 'every' };
  }
  if (/final consonant blends|final blends/.test(t)) {
    const list = clusterList(/final blends including ([^.]*)\./.exec(t)?.[1] ?? '');
    return { ...base, task: 'decode', shapes: ['CVCC'], known: allBasic, codaClusters: list, focusRule: 'every' };
  }
  if (/digraphs/.test(t)) {
    const digraphs = ['sh/SH', 'ch/CH', 'th/TH', 'th/DH', 'wh/W'];
    return { ...base, task: 'decode', shapes: ['CVC', 'CVCC', 'CCVC'], known: new Set([...allBasic, ...digraphs]),
      focus: new Set(digraphs), focusRule: 'every', alsoClusters: ['st', 'pl', 'br'] };
  }
  if (/high-frequency|sight word/.test(t)) return { ...base, task: 'sight' };
  if (/real & nonsense|real and nonsense/.test(t)) return { ...base, task: 'real-vs-nonsense', known: allBasic, shapes: ['CVC'] };
  if (/cvc/.test(t)) {
    const vowels = /mixed short vowels/.test(t) || !vowelsNamed.length ? ['a', 'e', 'i', 'o', 'u'] : vowelsNamed;
    const task = /^encode|spell/.test(t) ? 'encode' : /pictures/.test(t) ? 'decode-picture' : 'decode';
    return { ...base, task, shapes: ['CVC'], singleLetters: true, known: allBasic, focus: shortFocus(vowels),
      focusRule: vowels.length === 1 ? 'every' : 'spread', vowels };
  }

  // ---- Concepts (vocabulary): categories come from the emoji taxonomy.
  if (/odd word out/.test(t)) return { ...base, task: 'concept-odd-one-out' };
  if (/categor|sort|group words by function/.test(t) && /animal|food|cloth|eat|wear|topic|categor/.test(t)) return { ...base, task: 'concept-sort' };
  if (/match basic vocabulary words to corresponding pictures/.test(t)) return { ...base, task: 'concept-picture-match' };
  if (/opposite|antonym|synonym|gradable|related objects|typical locations|multiple meanings/.test(t)) {
    return { ...base, task: 'none', why: 'relation between words (opposite, synonym, scale, goes-with): no public source; needs a curated relation table' };
  }
  return { ...base, task: 'none', why: 'not a word-level task (prose, grammar, print concepts, comprehension): LLM band' };
}
