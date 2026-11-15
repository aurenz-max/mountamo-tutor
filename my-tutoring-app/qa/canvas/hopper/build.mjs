// Builds hopper.html from hopper.json + template.html. Run: node qa/canvas/hopper/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const data = JSON.parse(readFileSync(new URL('hopper.json', dir), 'utf8'));
const ids = new Set();
for (const e of data.entries) {
  if (ids.has(e.id)) throw new Error(`duplicate id ${e.id}`);
  ids.add(e.id);
  if (!data.modalities[e.modality]) throw new Error(`${e.id}: unknown modality ${e.modality}`);
  if (e.ladder.length < 3 || e.ladder.length > 5) throw new Error(`${e.id}: ladder must have 3-5 problems`);
}
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = readFileSync(new URL('template.html', dir), 'utf8').replace('/*HOPPER*/null', json);
writeFileSync(new URL('hopper.html', dir), html);
console.log(`${data.entries.length} entries`);
