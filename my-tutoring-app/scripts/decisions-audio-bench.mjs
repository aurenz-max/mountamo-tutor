#!/usr/bin/env node
/**
 * Does sending the learner's AUDIO to gemini-decision-1 grade a spoken answer better than the transcript alone?
 * The item_score kind (its own question and decision) over spoken-audio-cases.mjs, where the transcript is a
 * plausible ASR error of what was said and the gold label is the spoken answer. The tutor reply is neutral, so
 * the transcript and the clip are the only evidence. Arms:
 *   jev/text            today: transcript only, Jev
 *   gemini/text         transcript only, gemini-decision-1
 *   gemini/text+audio   transcript + clip
 *   gemini/audio        clip only (no transcript)
 *
 *   node scripts/decisions-audio-bench.mjs [--runs 2] [out.json]
 *
 * Clips: synthetic adult speech from Windows SAPI (scripts/decisions-audio-synth.ps1), two voices, synthesized on
 * first run into qa/typesafe/decisions-audio/. Not child speech: a pass here shows the channel works, not that it
 * hears five-year-olds.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AUDIO_CASES, NEUTRAL_TUTOR, VOICES } from './cases/spoken-audio-cases.mjs';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'node_modules', 'vite'))) { console.error('run from my-tutoring-app'); process.exit(1); }
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(TYPESAFE_[A-Z_]+|GEMINI_API_KEY)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const argv = process.argv.slice(2);
const RUNS = Number(argv.includes('--runs') ? argv[argv.indexOf('--runs') + 1] : 2);
const OUT = argv.find(a => a.endsWith('.json')) || `qa/typesafe/decisions-audio-bench-${new Date().toISOString().slice(0, 10)}.json`;
const DIR = join(ROOT, 'qa/typesafe/decisions-audio');

// ── clips ────────────────────────────────────────────────────────────────
const clipName = (said, voice) => `${typeof said === 'string' ? said.replace(/[^a-z]+/gi, '_') : `ups_${said.ups[0].toLowerCase()}`}__${voice.split(' ')[1].toLowerCase()}.wav`;
mkdirSync(DIR, { recursive: true });
const jobs = [];
for (const [, , said] of AUDIO_CASES) if (said !== null) for (const voice of VOICES) {
  const file = clipName(said, voice);
  if (!jobs.some(j => j.file === file)) jobs.push({ file, voice, text: typeof said === 'string' ? said : null, ups: typeof said === 'string' ? null : said.ups });
}
if (jobs.some(j => !existsSync(join(DIR, j.file)))) {
  writeFileSync(join(DIR, 'jobs.json'), JSON.stringify(jobs, null, 1));
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(ROOT, 'scripts/decisions-audio-synth.ps1'), '-dir', DIR], { stdio: 'inherit' });
}
const silence = (() => { const b = Buffer.alloc(44 + 16000 * 2 * 2); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(b.length - 44, 40); return b; })();
const clip = (said, voice) => said === null ? silence : readFileSync(join(DIR, clipName(said, voice)));

// ── model ────────────────────────────────────────────────────────────────
const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { systemOne } = await runner.import('/src/components/lumina/service/manifest/typesafe/typesafeClient.ts');
const { itemScoreKind } = await runner.import('/src/components/lumina/service/typesafe/observeItemScore.ts');

const AUDIO_NOTE = 'The attached audio clip is the learner\'s own spoken answer. `learner` is a machine transcript of that clip '
  + 'and may be wrong; where the two disagree, judge what the learner says in the audio.';
const ARMS = {
  'jev/text': { model: 'jev-latest', audio: false, transcript: true },
  'gemini/text': { model: 'gemini-decision-1', audio: false, transcript: true },
  'gemini/text+audio': { model: 'gemini-decision-1', audio: true, transcript: true },
  'gemini/audio': { model: 'gemini-decision-1', audio: true, transcript: false },
};

async function grade(arm, [name, item, said, transcript], voice) {
  const a = ARMS[arm];
  const request = { scope: { sessionEpoch: 'bench', instanceId: 'audio', itemId: name }, attemptIndex: 0, ...item,
    learner: a.transcript ? transcript : '(no transcript: listen to the attached audio)', tutor: NEUTRAL_TUTOR };
  const state = { ...itemScoreKind.state(request), ...(a.audio ? { learnerAudio: AUDIO_NOTE } : {}) };
  const media = a.audio ? [{ type: 'audio', mime_type: 'audio/wav', data: clip(said, voice).toString('base64') }] : undefined;
  try {
    const r = await systemOne(state, itemScoreKind.questions, { model: a.model, media, signal: AbortSignal.timeout(20000) });
    const d = itemScoreKind.decide(request, r.answers, r.ms, r.model);
    return { p: d.learnerCorrect, ms: r.ms, tokens: r.usage?.input_tokens };
  } catch (e) { return { error: String(e.message || e).slice(0, 200) }; }
}

async function pool(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

const work = [];
for (let rep = 0; rep < RUNS; rep++) for (const c of AUDIO_CASES) for (const voice of VOICES) for (const arm of Object.keys(ARMS)) {
  // Text-only arms never see the voice: one call per case per rep.
  if (!ARMS[arm].audio && voice !== VOICES[0]) continue;
  work.push({ rep, c, voice, arm });
}
console.log(`${work.length} calls`);
const rows = await pool(work, 6, async ({ rep, c, voice, arm }) => {
  const g = await grade(arm, c, voice);
  const [name, , said, transcript, label] = c;
  const reading = typeof g.p !== 'number' ? 'error' : g.p >= 0.8 ? 'correct' : g.p <= 0.2 ? 'not_correct' : 'unclear';
  return { rep, arm, voice: ARMS[arm].audio ? voice : null, name, clean: transcript === said, label, ...g, reading,
    pass: reading === (label ? 'correct' : 'not_correct'), sideRight: typeof g.p === 'number' && (g.p >= 0.5) === label,
    falseCredit: !label && reading === 'correct', brier: typeof g.p === 'number' ? (g.p - (label ? 1 : 0)) ** 2 : undefined };
});

const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const med = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const summarize = rs => ({ n: rs.length, pass: `${rs.filter(r => r.pass).length}/${rs.length}`, sideRight: `${rs.filter(r => r.sideRight).length}/${rs.length}`,
  falseCredit: rs.filter(r => r.falseCredit).length, errors: rs.filter(r => r.error).length,
  brier: +mean(rs.map(r => r.brier).filter(Number.isFinite)).toFixed(3), p50ms: med(rs.map(r => r.ms)), tokens: med(rs.map(r => r.tokens)) });
const summary = Object.keys(ARMS).map(arm => ({ arm, ...summarize(rows.filter(r => r.arm === arm)),
  asrErrorOnly: summarize(rows.filter(r => r.arm === arm && !r.clean)).pass }));
console.table(summary);
console.log('\nPer case (mean P(correct) per arm):');
for (const [name, , , transcript, label] of AUDIO_CASES) {
  const cell = arm => { const ps = rows.filter(r => r.name === name && r.arm === arm && typeof r.p === 'number').map(r => r.p); return ps.length ? mean(ps).toFixed(2) : ' err'; };
  console.log(`  ${name.padEnd(24)} ${String(label).padEnd(6)} ${Object.keys(ARMS).map(a => `${a.split('/')[1].padEnd(10)} ${cell(a)}`).join('  ')}`);
}
const errs = rows.filter(r => r.error).slice(0, 4);
if (errs.length) console.log('\nErrors:', errs.map(r => `${r.arm} ${r.name}: ${r.error}`));
writeFileSync(OUT, JSON.stringify({ date: new Date().toISOString(), runs: RUNS, summary, rows }, null, 2));
console.log(`saved ${OUT}`);
await server.close();
