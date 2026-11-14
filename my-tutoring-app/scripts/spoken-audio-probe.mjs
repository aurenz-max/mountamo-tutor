#!/usr/bin/env node
/**
 * Real-model probe for the PROTOTYPE `spoken_miss_audio` kind (gemini-decision-1 hears the learner's clip) against
 * today's `spoken_miss` on Jev (reads the transcript), on letter-sound-link see_hear items from the saved W1
 * payload, with the misses the runtime sends (`letterSoundLinkBoss.assignment(item).misses`).
 *
 * The transcript for a letter's sound and for its NAME is the same single letter ("s"), which is what speech
 * recognition writes for both; that ambiguity is what the audio is for. Clips are synthetic adult speech
 * (Windows SAPI, two voices), cached in qa/typesafe/decisions-audio/.
 *
 *   node scripts/spoken-audio-probe.mjs [--runs 1] [out.json]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'node_modules', 'vite'))) { console.error('run from my-tutoring-app'); process.exit(1); }
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(TYPESAFE_[A-Z_]+|GEMINI_API_KEY)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const argv = process.argv.slice(2);
const RUNS = Number(argv.includes('--runs') ? argv[argv.indexOf('--runs') + 1] : 1);
const OUT = argv.find(a => a.endsWith('.json')) || `qa/typesafe/spoken-audio-probe-${new Date().toISOString().slice(0, 10)}.json`;
const DIR = join(ROOT, 'qa/typesafe/decisions-audio');
const VOICES = ['Microsoft Zira Desktop', 'Microsoft David Desktop'];

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const L = '/src/components/lumina';
const lss = await runner.import(`${L}/primitives/visual-primitives/literacy/letterSoundLinkDomain.ts`);
const { letterSoundLinkBoss } = await runner.import(`${L}/primitives/visual-primitives/literacy/letterSoundLink.boss.ts`);
const { runObservation } = await runner.import(`${L}/service/typesafe/observationKinds.ts`);
const { spokenMissKind } = await runner.import(`${L}/service/typesafe/observeSpokenMiss.ts`);
const { spokenAudioKind, validSpokenAudioRequest } = await runner.import(`${L}/service/typesafe/observeSpokenAudio.ts`);

// What the child produces, as SAPI input: { ups } is a Microsoft phone string, { text } is read as English.
const SOUND = { s: 'S S S S S S', a: 'AE AE AE', t: 'T AX', i: 'IH IH', p: 'P AX', n: 'N N N N N N', m: 'M M M M M M', f: 'F F F F F F' };
const CONTINUOUS = new Set(['s', 'n', 'm', 'f']);
const NAME_TEXT = { s: 'ess', a: 'ay', t: 'tee', i: 'eye', p: 'pee', n: 'en', m: 'em', f: 'eff' };

const d = JSON.parse(readFileSync(join(ROOT, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/letter-sound-link.see_hear.json'), 'utf8')).data;
const items = lss.buildLetterSoundLinkItems(d.challenges, 'medium').filter(i => i.mode === 'see-hear');
const cases = items.flatMap(item => {
  const l = item.letter.toLowerCase(), a = letterSoundLinkBoss.assignment(item), clipped = lss.isClippedSound(l);
  const other = l === 'f' ? 'm' : 'f';
  // [name, said, transcript, gold reading]
  const rows = [
    ['sound', { ups: SOUND[l] }, l, 'correct'],
    ['name', { text: NAME_TEXT[l] }, l, 'letter_name'],
    ['keyword', { text: item.keyword }, item.keyword, clipped ? 'correct' : 'keyword_word'],
    ...(CONTINUOUS.has(l) ? [['added_vowel', { ups: `${SOUND[l].split(' ')[0]} AX` }, `${l}uh`, 'added_vowel']] : []),
    ['other_sound', { ups: SOUND[other] }, other, 'other_sound'],
    ['dont_know', { text: "I don't know" }, "I don't know", 'no_answer'],
    ['silence', null, l, 'no_answer'],
  ];
  return rows.map(([name, said, transcript, gold]) => ({ id: `${l}/${name}`, letter: l, said, transcript, gold,
    request: { scope: { sessionEpoch: 'probe', instanceId: 'probe', itemId: item.id }, task: a.task, expectedAnswer: a.expectedAnswer,
      learner: transcript, misses: a.misses } }));
});

// ── clips ──
const slug = said => said.ups ? `ups_${said.ups.replace(/\s+/g, '').toLowerCase()}` : said.text.replace(/[^a-z]+/gi, '_').toLowerCase();
const clipFile = (said, voice) => `${slug(said)}__${voice.split(' ')[1].toLowerCase()}.wav`;
const jobs = [];
for (const c of cases) if (c.said) for (const voice of VOICES) {
  const file = clipFile(c.said, voice);
  if (!jobs.some(j => j.file === file) && !existsSync(join(DIR, file))) jobs.push({ file, voice, text: c.said.text ?? null, ups: c.said.ups ?? null });
}
if (jobs.length) {
  writeFileSync(join(DIR, 'jobs.json'), JSON.stringify(jobs, null, 1));
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(ROOT, 'scripts/decisions-audio-synth.ps1'), '-dir', DIR], { stdio: 'inherit' });
}
const silence = (() => { const b = Buffer.alloc(44 + 16000 * 2 * 2); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(b.length - 44, 40); return b; })();
const clip = (said, voice) => said ? readFileSync(join(DIR, clipFile(said, voice))) : silence;

// ── run ──
const work = [];
for (let rep = 0; rep < RUNS; rep++) for (const c of cases) {
  work.push({ rep, c, arm: 'jev/transcript' });
  for (const voice of VOICES) work.push({ rep, c, arm: 'gemini/audio', voice });
}
let next = 0; const rows = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < work.length) {
    const { rep, c, arm, voice } = work[next++];
    const req = arm === 'gemini/audio' ? { ...c.request, audioBase64: clip(c.said, voice).toString('base64') } : c.request;
    if (arm === 'gemini/audio' && !validSpokenAudioRequest(req)) throw new Error(`invalid request ${c.id}`);
    const dcs = await runObservation(arm === 'gemini/audio' ? spokenAudioKind : spokenMissKind, req);
    // Correct and no_answer are readings, not misses: compare the reading.
    const reading = dcs.accepted ? dcs.miss ?? dcs.reading : 'abstain';
    rows.push({ rep, arm, voice: voice?.split(' ')[1] ?? null, id: c.id, gold: c.gold, reading, miss: dcs.miss, p: dcs.p, ms: dcs.ms, reason: dcs.reason,
      pass: reading === c.gold, falseMiss: c.gold === 'correct' && !!dcs.miss, falseCorrect: c.gold !== 'correct' && reading === 'correct' });
  }
}));

const arms = ['jev/transcript', 'gemini/audio'];
const sum = arm => { const rs = rows.filter(r => r.arm === arm); const ms = rs.map(r => r.ms).sort((a, b) => a - b);
  return { arm, n: rs.length, pass: `${rs.filter(r => r.pass).length}/${rs.length}`, falseMiss: rs.filter(r => r.falseMiss).length,
    falseCorrect: rs.filter(r => r.falseCorrect).length, abstain: rs.filter(r => r.reading === 'abstain').length, p50ms: ms[Math.floor(ms.length / 2)] }; };
console.table(arms.map(sum));
console.log('\nBy case kind (pass):');
for (const kind of [...new Set(cases.map(c => c.id.split('/')[1]))]) {
  console.log(`  ${kind.padEnd(12)} ${arms.map(arm => { const rs = rows.filter(r => r.arm === arm && r.id.endsWith('/' + kind)); return `${arm} ${rs.filter(r => r.pass).length}/${rs.length}`; }).join('   ')}`);
}
console.log('\nGemini audio misses:');
for (const r of rows.filter(r => r.arm === 'gemini/audio' && !r.pass)) console.log(`  ${r.id.padEnd(16)} ${r.voice.padEnd(6)} gold ${r.gold.padEnd(12)} read ${r.reading} (${r.reason}, p ${r.p?.toFixed?.(2)})`);
writeFileSync(OUT, JSON.stringify({ date: new Date().toISOString(), summary: arms.map(sum), rows }, null, 2));
console.log(`saved ${OUT}`);
await server.close();
