// What a learner hears for each labelled build: the surface's code check first (`inflectMiss`), and the judge's reading
// from a saved calibration run only when code passes the row. No model call.
// Usage (from my-tutoring-app): node qa/open-build/word-flip-2026-10-08/effective-inflect.mjs <calibration tag>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const tag = process.argv[2] ?? 'r1';
const here = new URL('.', import.meta.url);
const { rows } = JSON.parse(readFileSync(new URL(`./calibration-inflect-${tag}.json`, here), 'utf8'));
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { inflectMiss, basePart, ENDING_CARDS } = await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/inflectBuild.ts');
  const VERBS = new Set(['jump', 'walk', 'play', 'help', 'open', 'wash', 'kick', 'look', 'clean', 'paint']);
  const out = rows.map(r => {
    const [b, e] = r.pieces.split(' + ');
    const base = basePart(b, VERBS.has(b) ? 'verb' : 'noun', '*');
    const ending = ENDING_CARDS.find(x => x.text === e);
    const yWords = /ends in y/.test(r.ask);
    const item = { id: 'x', ask: r.ask, examples: [], ways: 1, inflect: /more than one/.test(r.ask) ? 'plural' : 'past',
      ...(yWords ? { bases: [base.id].filter(() => /y$/.test(b)) } : {}) };
    const code = inflectMiss(item, [base, ending]);
    const judge = r.prod.error ? 'error' : r.prod.met ? 'pass' : r.prod.miss;
    const heard = code ?? judge;
    return { made: r.made, ask: r.ask, expect: r.scored ? r.expect : 'either', code: code ?? '-', judge, heard,
      // An expected miss is right when the learner hears a miss: code names a more specific one than the judge would.
      right: r.scored ? (r.expect === 'pass' ? heard === 'pass' : heard !== 'pass' && heard !== 'error') : null };
  });
  const s = out.filter(r => r.expect !== 'either');
  const summary = { tag, scored: s.length, right: s.filter(r => r.right).length, codeDecided: s.filter(r => r.code !== '-').length,
    wrong: s.filter(r => !r.right).map(r => `${r.made}: heard ${r.heard}, expected ${r.expect}`) };
  for (const r of out) console.log(`${r.expect.padEnd(13)} ${r.made.padEnd(9)} code=${String(r.code).padEnd(18)} judge=${String(r.judge).padEnd(13)} heard=${r.heard}`);
  console.log(JSON.stringify(summary));
  writeFileSync(new URL(`./effective-inflect-${tag}.json`, here), JSON.stringify({ summary, rows: out }, null, 2) + '\n');
} finally {
  await server.close();
}
