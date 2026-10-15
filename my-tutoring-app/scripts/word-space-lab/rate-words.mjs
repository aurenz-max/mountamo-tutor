// One-time, build-time rating of library words: the facts code cannot compute from public data.
//   knownBy   - the grade by which most US children know the word when they hear it (K, G1, G2, later)
//   kidSafe   - fine to show a class of five-year-olds
//   pictureOk - the emoji, alone, makes a five-year-old say THIS word (null when there is no emoji)
//   category  - the kindergarten category the word belongs to
// The result is cached in .cache/ratings.json and is meant to be checked into the lexicon after a
// person spot-checks it. Nothing here runs at lesson time.
//   node scripts/word-space-lab/rate-words.mjs [--limit N]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLexicon, harvestRepoPictures } from './lexicon.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
if (!process.env.GEMINI_API_KEY) {
  const m = fs.readFileSync(path.join(APP, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
const MODEL = 'gemini-flash-lite-latest';
const OUT = path.join(HERE, '.cache', 'ratings.json');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

export const CATEGORIES = ['animal', 'food', 'drink', 'clothing', 'vehicle', 'body', 'home', 'toy', 'nature', 'weather', 'place', 'person',
  'school', 'tool', 'music', 'sport', 'color', 'number', 'shape', 'action', 'feeling', 'describing', 'other'];

const L = loadLexicon(path.join(HERE, '.cache'));
harvestRepoPictures(APP, L);
// Candidates: common-enough, a lowercase dictionary word (or an inflection of one), short.
const stemOk = (w) => L.dicLower.has(w) || [w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ed$/, ''), w.replace(/ing$/, ''), w.replace(/ies$/, 'y')]
  .some((s) => s !== w && L.dicLower.has(s));
const cands = [...L.words.values()].filter((e) => !e.proper && e.rank <= 15000 && e.syllables <= 4 && stemOk(e.w) && (e.alignment || e.picture))
  .sort((a, b) => a.rank - b.rank);

const ratings = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const todo = cands.filter((e) => !ratings[e.w]).slice(0, LIMIT);
console.log(`${cands.length} candidates, ${Object.keys(ratings).length} already rated, ${todo.length} to rate`);

const schema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      w: { type: 'STRING' },
      knownBy: { type: 'STRING', enum: ['K', 'G1', 'G2', 'later'] },
      kidSafe: { type: 'BOOLEAN' },
      pictureOk: { type: 'BOOLEAN', nullable: true },
      category: { type: 'STRING', enum: CATEGORIES },
    },
    required: ['w', 'knownBy', 'kidSafe', 'category'],
  },
};
async function rateBatch(batch) {
  const lines = batch.map((e) => { const emo = e.picture?.emoji; return emo ? `${e.w}\t${emo}` : e.w; }).join('\n');
  const prompt = `You are building a word list for kindergarten reading lessons (US, children aged 5-6).
For each word below (one per line, optionally followed by a tab and an emoji), return:
- knownBy: the grade by which MOST US children understand the word when they hear it: K (by age 5-6), G1, G2, or later.
  Rate the everyday child sense. Abbreviations, names, slang, archaic or adult-only words are "later".
- kidSafe: false if the word is unsuitable to show a class of 5-year-olds (violence, drugs, alcohol, body/sexual, slurs, insults, scary).
- pictureOk: only when an emoji is given: true if a 5-year-old shown ONLY that emoji would name THIS word. False if the emoji shows
  something else (e.g. "mat" with a yoga person, "tap" with a faucet, "take" with open hands). null when no emoji is given.
- category: the kindergarten category of the word's everyday sense (${CATEGORIES.join(', ')}).
Return one object per input word, same order, with "w" equal to the input word.

${lines}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 } }),
    });
    if (!res.ok) { console.warn('http', res.status, (await res.text()).slice(0, 200)); await new Promise((r) => setTimeout(r, 2000)); continue; }
    const j = await res.json();
    try {
      const arr = JSON.parse(j.candidates[0].content.parts[0].text);
      const names = new Set(batch.map((e) => e.w));
      return arr.filter((x) => names.has(x.w));
    } catch { /* retry */ }
  }
  return [];
}

const BATCH = 100; const CONC = 4;
const batches = [];
for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
let done = 0;
async function worker() {
  while (batches.length) {
    const b = batches.shift();
    for (const x of await rateBatch(b)) ratings[x.w] = { knownBy: x.knownBy, kidSafe: x.kidSafe, pictureOk: x.pictureOk ?? null, category: x.category };
    done += b.length;
    fs.writeFileSync(OUT, JSON.stringify(ratings));
    process.stdout.write(`\r${done}/${todo.length}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`\nrated ${Object.keys(ratings).length} -> ${OUT}`);
