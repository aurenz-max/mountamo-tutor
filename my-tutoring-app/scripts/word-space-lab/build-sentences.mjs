// Draft the di-sentence-reading sentence bank once, at build time (service/wordSpace/sentenceBank.json).
//
// For each scope a K-1 sentence lesson names (letter groups 1-4, each short vowel, mixed CVC, sight words), Gemini
// is given the only words the scope lets a sentence use (the word library's decodable words, the scope's tricky
// words, decodable names) and asked for sentences at three lengths. Code then keeps a sentence only when
// `sentenceFits` accepts it for that scope, the same check the runtime space runs. Nothing is drafted while a
// child waits; a person reads the bank before trusting it (the report lists it).
//
//   node scripts/word-space-lab/build-sentences.mjs --run [--per 24] [--match "Short"] [--prune] [--judge]
//   --prune re-checks the bank against today's rules only; --judge runs the sense check on every sentence not yet judged.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
const PER = Number(process.argv[process.argv.indexOf('--per') + 1]) || 24;
const MATCH = process.argv.includes('--match') ? process.argv[process.argv.indexOf('--match') + 1] : null;
const OUT = 'src/components/lumina/service/wordSpace/sentenceBank.json';

const SCOPES = [
  ['decodable_sentence', 'K', 'Letter-Sound Group 1: s, a, t, i, p, n'],
  ['decodable_sentence', 'K', 'Letter-Sound Group 2: c, k, e, h, r, m, d'],
  ['decodable_sentence', 'K', 'Letter-Sound Group 3: g, o, u, l, f, b'],
  ['decodable_sentence', 'K', 'Letter-Sound Group 4 (Final): j, z, w, v, y, x, q'],
  ...['a', 'e', 'i', 'o', 'u'].map((v) => ['decodable_sentence', 'K', `Decode CVC words with Short '${v}'`]),
  ['decodable_sentence', 'K', 'Decode CVC words with Mixed Short Vowels'],
  ['read_sentence', 'K', 'Read simple sentences with CVC words and sight words'],
  ['sight_phrase_sentence', 'K', 'Read sentences with high-frequency sight words'],
  ['sight_phrase_sentence', '1', 'Read sentences with grade 1 high-frequency sight words'],
];

// Content rules code can check that the word check cannot: "fat" said of a person, and hitting a person.
const PEOPLE = new Set(['i', 'you', 'he', 'she', 'we', 'they', 'him', 'her', 'me', 'us', 'man', 'men', 'kid', 'kids', 'mom', 'dad',
  'sam', 'pat', 'tim', 'nan', 'pam', 'tam', 'dan', 'ben', 'meg', 'ted', 'kim', 'jim', 'tom', 'bob', 'gus', 'jan', 'max', 'ron', 'pip',
  'nat', 'tad', 'deb', 'ken', 'rex', 'liz', 'viv', 'peg']);
const unkind = (text) => {
  const w = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const fatPerson = w.includes('fat') && w.some((t) => PEOPLE.has(t)) && !/fat (cat|rat|pig|hog|dog|pup|bug|cub|hen|fox|bun|ham)/.test(w.join(' '));
  const hitPerson = w.some((t, i) => t === 'hit' && w.slice(i + 1).some((u) => PEOPLE.has(u)));
  return fatPerson || hitPerson;
};

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { sentenceFits, scopeVocabulary } = await loader.import('/src/components/lumina/service/wordSpace/sentenceSpaces.ts');
  const { scopeFromObjective } = await loader.import('/src/components/lumina/service/wordSpace/scope.ts');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const previous = JSON.parse(readFileSync(OUT, 'utf8'));
  // A sentence stays only while it still fits the scope it was drafted for (the rule may have tightened since).
  const scopeOf = new Map(SCOPES.map(([mode, grade, objective]) => [objective, [mode, grade, scopeFromObjective([objective])]]));
  const kept = new Map(previous.sentences.filter((s) => {
    const sc = scopeOf.get(s.draftedFor);
    return sc && sentenceFits(s.text, sc[0], sc[1], sc[2]) && !unkind(s.text);
  }).map((s) => [s.text.toLowerCase(), s]));
  console.log(`kept ${kept.size} of ${previous.sentences.length} drafted earlier`);

  // The sense check: the word check guarantees a child can decode every word, not that the sentence makes sense.
  // One build-time judge reads each sentence once (`judged: true` after), and drops the awkward or odd ones; every
  // drop is logged with its reason so a person can overrule it.
  const drops = [];
  const NEWLINE = String.fromCharCode(10);
  const judge = async (texts) => {
    const verdicts = new Map();
    for (let i = 0; i < texts.length; i += 60) {
      const batch = texts.slice(i, i + 60);
      const prompt = [
        'You are a kindergarten teacher checking sentences for a decodable reader. The words are limited on purpose (short,',
        'simple words), so plain or simple sentences are fine. Reject a sentence only when a teacher would not print it for a',
        'five-year-old:',
        '- it does not make sense or describes something odd or physically strange ("Pat sat on Dan", "Jim had a nap on the cat");',
        '- the grammar or word order is awkward or incomplete ("The hog is not as hot", "They walk away quick");',
        '- the words are unusual for a young child or the scene is not one a child knows ("fix the dull ax", "a cop");',
        '- it is unkind, scary or unsafe (someone hit, hurt or called names).',
        'Keep everything else. Sentences:',
        ...batch.map((t, j) => `${j}: ${t}`),
        '',
        'Return JSON: {"verdicts": [{"i": 0, "keep": true, "why": ""}]} with one entry per sentence; "why" says what is wrong when keep is false.',
      ].join(NEWLINE);
      try {
        const res = await ai.models.generateContent({ model: 'gemini-flash-latest', contents: prompt, config: { responseMimeType: 'application/json', temperature: 0 } });
        for (const v of JSON.parse(res.text).verdicts ?? []) if (batch[v.i] !== undefined) verdicts.set(batch[v.i], v);
      } catch (e) { console.log(`  JUDGE ERROR: ${e.message}`); }
    }
    return verdicts;
  };
  const applyJudge = async (entries) => {
    const verdicts = await judge(entries.map((e) => e.text));
    const out = [];
    for (const e of entries) {
      const v = verdicts.get(e.text);
      if (!v) continue; // unjudged (a failed call): left out rather than trusted
      if (v.keep) out.push({ ...e, judged: true });
      else drops.push({ text: e.text, draftedFor: e.draftedFor, why: v.why });
    }
    return out;
  };
  if (process.argv.includes('--judge')) {
    const unjudged = Array.from(kept.values()).filter((e) => !e.judged);
    for (const e of unjudged) kept.delete(e.text.toLowerCase());
    for (const e of await applyJudge(unjudged)) kept.set(e.text.toLowerCase(), e);
    console.log(`judged ${unjudged.length}: dropped ${drops.length}`);
  }
  if (process.argv.includes('--prune')) SCOPES.length = 0; // keep-or-drop the existing bank only, no drafting
  for (const [mode, grade, objective] of SCOPES) {
    if (MATCH && !objective.includes(MATCH)) continue;
    const parsed = scopeFromObjective([objective]);
    const v = scopeVocabulary(mode, grade, parsed);
    const sight = mode === 'sight_phrase_sentence';
    const prompt = `Write sentences for a kindergarten or first-grade child to read aloud, one at a time.

Use ONLY these words (lowercase forms; capitalize the first word and names):
- Words: ${v.words.join(', ')}
- Tricky words: ${v.tricky.join(', ')}
- Names: ${v.names.join(', ') || '(none)'}
No other word, no plural -s or -ed/-ing ending unless that exact form is listed. No commas: one simple clause per sentence.

Write ${PER} sentences of 3-4 words, ${PER} of 5-6 words and ${Math.round(PER * 0.75)} of 7-8 words.${sight ? '\nEvery sentence uses at least two of the tricky words other than a, the and I.' : ''}
Each sentence is a complete, sensible sentence a five-year-old would understand: a person or animal doing something, where something is, what something is like. Prefer concrete pictures. No sentence starts with "Yes". End with a period, or sometimes a question mark or exclamation mark. No two sentences alike.

Return JSON: {"sentences": ["..."]}`;
    let drafted = [];
    try {
      const res = await ai.models.generateContent({ model: 'gemini-flash-latest', contents: prompt, config: { responseMimeType: 'application/json', temperature: 1 } });
      drafted = JSON.parse(res.text).sentences ?? [];
    } catch (e) { console.log(`  ERROR ${objective}: ${e.message}`); }
    const fit = drafted.map((t) => String(t).trim()).filter((t) => sentenceFits(t, mode, grade, parsed) && !unkind(t));
    const fresh = fit.filter((t) => !kept.has(t.toLowerCase())).map((text) => ({ text, draftedFor: objective, reviewed: false }));
    const sensible = await applyJudge(fresh);
    for (const e of sensible) kept.set(e.text.toLowerCase(), e);
    const added = sensible.length;
    console.log(`${objective}: ${v.words.length} words, drafted ${drafted.length}, fit ${fit.length}, new ${fresh.length}, judged sensible ${added}`);
  }
  const sentences = Array.from(kept.values()).sort((a, b) => a.draftedFor.localeCompare(b.draftedFor) || a.text.localeCompare(b.text));
  writeFileSync(OUT, JSON.stringify({ note: previous.note, sentences }, null, 1) + '\n');
  console.log(`bank: ${sentences.length} sentences`);
  if (drops.length) {
    const log = 'qa/word-space-lab/2026-10-13/di-sentence-reading/judge-drops.json';
    let prior = [];
    try { prior = JSON.parse(readFileSync(log, 'utf8')); } catch { /* first run */ }
    writeFileSync(log, JSON.stringify([...prior, ...drops], null, 1) + NEWLINE);
    console.log(`dropped ${drops.length} as awkward or odd: ${log}`);
  }
} finally { await server.close(); }
