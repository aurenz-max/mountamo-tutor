// Runs the word-flip build_inflect labelled builds through the production judge (judgeWordBuild, imported directly:
// no dev server), once as production runs it (Jev, flash second opinion on a rejection) and once forced to flash-latest
// alone. Prints raw probabilities and agreement; "reported" cases are read, not scored.
// Usage (from my-tutoring-app): node qa/open-build/word-flip-2026-10-08/calibrate-inflect.mjs <tag> [--env <.env.local>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const envArg = process.argv.indexOf('--env');
const envFile = envArg > 0 ? process.argv[envArg + 1] : '.env.local';
if (existsSync(envFile)) {
  for (const key of ['GEMINI_API_KEY', 'TYPESAFE_API_KEY']) {
    const m = readFileSync(envFile, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (m && !process.env[key]) process.env[key] = m[1].trim().replace(/^["']|["']$/g, '');
  }
}
const tag = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'run';
const here = new URL('.', import.meta.url);
const { scored, reported } = JSON.parse(readFileSync(new URL('./labelled-inflect.json', here), 'utf8'));
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { judgeWordBuild } = await loader.import('/src/components/lumina/service/build-layer/word-build-judge.ts');
  const call = async (c, judge) => {
    try { return await judgeWordBuild({ ask: c.ask, made: c.made, pieces: c.pieces, grade: 'Grade 2', ...(judge ? { judge } : {}) }); }
    catch (e) { return { error: String(e.message ?? e) }; }
  };
  const all = [...scored.map(c => ({ ...c, scored: true })), ...reported.map(c => ({ ...c, scored: false }))];
  const rows = [];
  for (let i = 0; i < all.length; i += 6) {
    const batch = all.slice(i, i + 6);
    rows.push(...await Promise.all(batch.map(async c => ({ ...c, prod: await call(c), flash: await call(c, 'flash') }))));
  }
  const got = v => (v.error ? 'error' : v.met ? 'pass' : v.miss);
  const ok = (r, k) => got(r[k]) === r.expect;
  const s = rows.filter(r => r.scored);
  for (const r of rows) {
    console.log(`${(r.scored ? r.expect : 'either').padEnd(13)} ${r.made.padEnd(9)} prod=${got(r.prod).padEnd(13)} `
      + `rw=${r.prod.realWord?.toFixed(2)} fit=${r.prod.fits?.toFixed(2)} (${r.prod.judge})  flash=${got(r.flash)}`);
  }
  const byKind = {};
  for (const r of s) { const k = (byKind[r.kind] ??= { n: 0, prod: 0, flash: 0 }); k.n++; if (ok(r, 'prod')) k.prod++; if (ok(r, 'flash')) k.flash++; }
  const falseRejects = s.filter(r => r.expect === 'pass' && got(r.prod) !== 'pass').map(r => `${r.made} (${got(r.prod)})`);
  const falseAccepts = s.filter(r => r.expect !== 'pass' && got(r.prod) === 'pass').map(r => r.made);
  const summary = { tag, scored: s.length, prod: s.filter(r => ok(r, 'prod')).length, flash: s.filter(r => ok(r, 'flash')).length,
    byKind, falseRejects, falseAccepts, reported: rows.filter(r => !r.scored).map(r => ({ made: r.made, ask: r.ask, prod: got(r.prod), flash: got(r.flash) })) };
  console.log(JSON.stringify(summary, null, 1));
  writeFileSync(new URL(`./calibration-inflect-${tag}.json`, here), JSON.stringify({ summary, rows }, null, 2) + '\n');
} finally {
  await server.close();
}
