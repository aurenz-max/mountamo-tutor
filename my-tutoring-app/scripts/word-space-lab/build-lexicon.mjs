// Builds the checked-in word library the generators read: service/wordSpace/lexicon.json.
// Inputs: .cache sources (fetch-sources.mjs), .cache/ratings.json (rate-words.mjs + rate-teachable.mjs),
// and review-overrides.json (the person's review; wins over the ratings). Keeps words that are kid-safe,
// teachable and known by grade 2. The OpenSubtitles frequency list (CC-BY-SA-4.0) is a build-time filter
// only (lexicon.mjs keeps rank <= 40000 as rating candidates); no rank is written to the lexicon.
//   node scripts/word-space-lab/build-lexicon.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLexicon, harvestRepoPictures } from './lexicon.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
const OUT = path.join(APP, 'src/components/lumina/service/wordSpace/lexicon.json');
const L = loadLexicon(path.join(HERE, '.cache'));
harvestRepoPictures(APP, L);
const ratings = JSON.parse(fs.readFileSync(path.join(HERE, '.cache', 'ratings.json'), 'utf8'));
const review = JSON.parse(fs.readFileSync(path.join(HERE, 'review-overrides.json'), 'utf8')).words;

const words = [];
for (const [w, r0] of Object.entries(ratings)) {
  const r = { ...r0, ...(review[w]?.values ?? {}) };
  if (!r.kidSafe || r.teachable === false || !['K', 'G1', 'G2'].includes(r.knownBy)) continue;
  const e = L.words.get(w);
  if (!e || e.proper) continue;
  words.push({
    w,
    p: e.phones.join(' '),
    g: e.gpcs ? e.gpcs.join(' ') : null,
    s: e.shape ?? null,
    y: e.syllables,
    e: r.pictureOk === true && e.picture ? e.picture.emoji : null,
    k: r.knownBy,
    c: r.category,
    ...(review[w] ? { v: 1 } : {}),
  });
}
const GRADE_ORDER = { K: 0, G1: 1, G2: 2 };
words.sort((a, b) => GRADE_ORDER[a.k] - GRADE_ORDER[b.k] || a.w.localeCompare(b.w));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  about: 'Built by scripts/word-space-lab/build-lexicon.mjs. p = CMU phonemes (stress removed); g = grapheme/phoneme pairs; '
    + 's = sound shape; y = syllables; e = emoji that shows the word (null if none fits); k = grade known by; c = category; '
    + 'v = checked by a person. Phonemes from the CMU Pronouncing Dictionary and emoji from Unicode data; see NOTICE. '
    + 'Ratings by gemini-flash-lite, reviewed in part.',
  words,
}));
const by = (k) => words.filter((x) => x.k === k).length;
console.log(`${words.length} words (K ${by('K')}, G1 ${by('G1')}, G2 ${by('G2')}), ${words.filter((x) => x.e).length} pictured, `
  + `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> ${OUT}`);
