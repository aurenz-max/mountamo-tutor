// Builds service/wordSpace/nonsense.json: every letter-sound CVC string (consonant, short vowel, consonant)
// that is NOT a word. A string is left out when the CMU Pronouncing Dictionary lists it, when the hunspell
// en_US dictionary lists it (any case: names count), when it is on the deny list, or when any CMU word is
// said with the same sounds (a homophone: "kat" sounds like cat). Real-vs-nonsense items read this list;
// nothing is decided at lesson time.
//   node scripts/word-space-lab/build-nonsense.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLexicon } from './lexicon.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
const OUT = path.join(APP, 'src/components/lumina/service/wordSpace/nonsense.json');
const L = loadLexicon(path.join(HERE, '.cache'));
// One sound per letter, as letter-sound lessons teach it; c and k both /k/. No x, q (two sounds), no h, w,
// y, j at the end (they do not close a short-vowel syllable).
const SOUND = { b: 'B', c: 'K', d: 'D', f: 'F', g: 'G', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', p: 'P', r: 'R',
  s: 'S', t: 'T', v: 'V', w: 'W', y: 'Y', z: 'Z' };
const VOWEL = { a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH' };
const ONSETS = Object.keys(SOUND);
const CODAS = ONSETS.filter((c) => !'hwyjcr'.includes(c));
const prons = new Set([...L.prons.values()].flat().map((p) => p.join(' ')));
const out = [];
for (const a of ONSETS) for (const v of Object.keys(VOWEL)) for (const b of CODAS) {
  const s = a + v + b;
  if (L.prons.has(s) || L.dicLower.has(s) || L.dicUpper.has(s) || L.bad.has(s)) continue;
  const sounds = [SOUND[a], VOWEL[v], SOUND[b]];
  if (prons.has(sounds.join(' ')) || (v === 'o' && prons.has([SOUND[a], 'AO', SOUND[b]].join(' ')))) continue;
  out.push(s);
}
fs.writeFileSync(OUT, JSON.stringify({
  about: 'Built by scripts/word-space-lab/build-nonsense.mjs: CVC letter strings that are not words, names or homophones '
    + 'of a word in the CMU Pronouncing Dictionary or hunspell en_US. See NOTICE.',
  words: out,
}));
console.log(`${out.length} nonsense CVC strings -> ${OUT}`);
