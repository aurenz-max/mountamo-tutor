// Second build-time pass over short K/G1 words: is this a word a K-1 teacher would put on a list?
// Catches what grade-of-knowing does not: clipped and informal forms (sis, hon, mum, yup), interjections,
// abbreviations, and words mostly heard as names. Adds `teachable` to .cache/ratings.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
if (!process.env.GEMINI_API_KEY) {
  const m = fs.readFileSync(path.join(APP, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
const OUT = path.join(HERE, '.cache', 'ratings.json');
const ratings = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const todo = Object.entries(ratings).filter(([w, r]) => ['K', 'G1'].includes(r.knownBy) && r.kidSafe && r.teachable === undefined).map(([w]) => w);
console.log(todo.length, 'to rate');
const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: { w: { type: 'STRING' }, teachable: { type: 'BOOLEAN' } }, required: ['w', 'teachable'] } };
async function rate(batch) {
  const prompt = `For each word, answer teachable: would a US kindergarten or first-grade teacher put this word, in its everyday sense, on a phonics,
spelling or vocabulary list for 5-6 year olds? false for: clipped or informal forms (sis, hon, mum, gran, yup, nope, mic, cam, til),
interjections and sounds (ha, whoa, yum, hmm), abbreviations, words mostly heard as names or brands, and words whose everyday sense
young children do not know (don as in "don a hat", sub, tan as a verb is fine but "tan" the color is fine too). Inflected forms of
teachable words (cats, jumped) are teachable. Return one object per word, same order.

${batch.join('\n')}`;
  for (let a = 0; a < 3; a++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 } }),
    });
    if (!res.ok) { await new Promise((r) => setTimeout(r, 2000)); continue; }
    try { return JSON.parse((await res.json()).candidates[0].content.parts[0].text); } catch { /* retry */ }
  }
  return [];
}
const batches = []; for (let i = 0; i < todo.length; i += 150) batches.push(todo.slice(i, i + 150));
await Promise.all(Array.from({ length: 4 }, async () => {
  while (batches.length) { for (const x of await rate(batches.shift())) if (ratings[x.w]) ratings[x.w].teachable = x.teachable; fs.writeFileSync(OUT, JSON.stringify(ratings)); }
}));
const t = Object.entries(ratings).filter(([, r]) => r.teachable === false).map(([w]) => w);
console.log('not teachable:', t.length, t.filter((w) => w.length <= 4).slice(0, 120).join(' '));
