// Authoring-time audit of the picture-vocabulary pair_build table (picturePairBuild.ts). Every UNLISTED pair of pictures
// of one relation (opposites; goes together) is shown to gemini-flash-latest as emoji + spoken name, three times, and it
// says whether a kindergarten teacher would accept the two as opposites / as going together. A pair accepted 2+ of 3
// times is a clash candidate: it must never share a board (CLASH / KIND_CLASH in picturePairBuild.ts). The model never
// judges a child; this only checks the code-owned table. Writes clash-audit.json beside this file.
// Usage (from my-tutoring-app): node qa/open-build/picture-vocabulary-2026-10-08/clash-audit.mjs --env <path to .env.local>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const envArg = process.argv.indexOf('--env');
const envFile = envArg > 0 ? process.argv[envArg + 1] : '.env.local';
if (!process.env.GEMINI_API_KEY && existsSync(envFile)) {
  const m = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const T = await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/picturePairBuild.ts');
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const QUESTION = {
    opposite: 'Would a kindergarten teacher accept these two pictures as OPPOSITES (one means the opposite of the other)?',
    goes_with: 'Would a kindergarten teacher accept these two pictures as things that GO TOGETHER (used together, one eats '
      + 'or lives in or needs the other, found together)? Two things that are only the same kind of thing (two clothes, '
      + 'two foods, two animals) do NOT count.',
  };
  const out = { generatedAt: new Date().toISOString(), model: 'gemini-flash-latest', runs: 3, relations: {} };
  for (const relation of ['opposite', 'goes_with']) {
    const pics = T.PAIR_PICTURES.filter(p => p.relation === relation);
    const pairs = [];
    for (let i = 0; i < pics.length; i++) for (let j = i + 1; j < pics.length; j++) {
      const miss = T.picturePairMiss([pics[i].word, pics[j].word], [], relation);
      if (miss) pairs.push({ a: pics[i], b: pics[j], miss });
    }
    const votes = new Map(pairs.map(p => [`${p.a.word}+${p.b.word}`, 0]));
    // Batches of 10: a first run with 80-line batches came back nearly all "no" (1 of 1017 flagged, dog + ball and
    // honey + bread rejected), while the same pairs in a batch of 5 were accepted. Small batches, 12 in flight.
    let answered = 0;
    const ask = async (batch) => {
      const list = batch.map((p, k) => `${k}. ${p.a.emoji} "${p.a.word}" and ${p.b.emoji} "${p.b.word}"`).join('\n');
      const res = await ai.models.generateContent({ model: 'gemini-flash-latest',
        contents: `${QUESTION[relation]} Each picture is shown as an emoji and its spoken name. Answer for every line.\n${list}`,
        config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT,
          properties: { index: { type: Type.INTEGER }, accept: { type: Type.BOOLEAN } }, required: ['index', 'accept'] } } } });
      for (const r of JSON.parse(res.text)) {
        const p = batch[r.index];
        if (!p) continue;
        answered++;
        if (r.accept) votes.set(`${p.a.word}+${p.b.word}`, votes.get(`${p.a.word}+${p.b.word}`) + 1);
      }
    };
    const batches = [];
    for (let run = 0; run < 3; run++) for (let s = 0; s < pairs.length; s += 10) batches.push(pairs.slice(s, s + 10));
    for (let s = 0; s < batches.length; s += 12) await Promise.all(batches.slice(s, s + 12).map(ask));
    console.log(`${relation}: ${answered}/${pairs.length * 3} answers`);
    const rows = pairs.map(p => ({ pair: `${p.a.word}+${p.b.word}`, kinds: `${p.a.kind}/${p.b.kind}`, tableSays: p.miss,
      accepted: votes.get(`${p.a.word}+${p.b.word}`) }));
    const flagged = rows.filter(r => r.accepted >= 2);
    out.relations[relation] = { unlistedPairs: rows.length, flagged, allVotes: rows };
    console.log(`${relation}: ${rows.length} unlisted pairs, ${flagged.length} accepted 2+/3`);
    for (const f of flagged) console.log(`  ${f.pair.padEnd(22)} ${f.kinds.padEnd(22)} table=${f.tableSays} votes=${f.accepted}`);
  }
  writeFileSync(new URL('./clash-audit.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
} finally { await server.close(); }
