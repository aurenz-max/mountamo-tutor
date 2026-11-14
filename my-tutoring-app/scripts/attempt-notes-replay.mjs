// Attempt-notes replay: the production note writer and the production generation path, on real stored attempts.
// No login and no running backend; the Python half (backend/scripts/attempt_notes_bench.py) reads and writes the store.
//
//   node scripts/attempt-notes-replay.mjs notes  <attempts.json> <notes.json>
//   node scripts/attempt-notes-replay.mjs replay <cases.json> <items.json> <out.json>
//
// notes   One `writeAttemptNote` call per dumped attempt (attempt_notes_bench.py dump). Resumable: an existing
//         notes.json is reused.
// replay  cases.json = attempt_notes_bench.py packet output (a backend-signed packet per target subskill).
//         items.json = [{ subskill_id, topic, gradeLevel, item: { componentId, instanceId, config } }].
//         Each item is generated twice through `generateComponentContent`: with no packet, and with the packet.
//         Reports which notes were offered and picked, the intent the generator received, and a judged
//         comparison of the two contents. Controls: a tampered packet must give no notes.
//
// Uses the shared metered `ai` client, so the agent daily cap applies. The fit gate is off here so the two
// arms differ only by the packet.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const [, , COMMAND, ...rest] = process.argv;
const paths = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--draws');
const DRAWS = rest.includes('--draws') ? Number(rest[rest.indexOf('--draws') + 1]) : 2;
process.env.LUMINA_FIT_GATE = 'off';
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);
const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const load = (path) => runner.import(`/src/components/lumina/${path}`);
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const pool = async (items, size, run) => {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; out[i] = await run(items[i], i); } }));
  return out;
};

if (COMMAND === 'notes') {
  const [attemptsPath, notesPath] = paths;
  const { writeAttemptNote } = await load('service/attemptNotes/writeAttemptNote.ts');
  const attempts = await json(attemptsPath);
  const notes = existsSync(notesPath) ? await json(notesPath) : await pool(attempts, 6, async (a) => {
    const note = await writeAttemptNote({ activity: a.primitive_type, mode: a.eval_mode, subject: a.subject, unit: a.unit, skill: a.skill,
      subskill: a.subskill, scoreOutOf10: a.score, metrics: a.metrics, work: a.work });
    const { work: _w, metrics: _m, ...home } = a;
    return { ...home, note };
  });
  await writeFile(notesPath, JSON.stringify(notes, null, 1));
  const written = notes.filter((n) => n.note), notable = written.filter((n) => n.note.notable);
  const signals = notable.flatMap((n) => n.note.signals);
  console.log(`notes written ${written.length}/${notes.length}; with something specific ${notable.length}; signals ${signals.length} `
    + `(${signals.filter((s) => s.kind === 'struggle').length} struggle, ${signals.filter((s) => s.kind === 'strength').length} strength)`);
  for (const n of notable) for (const s of n.note.signals) console.log(`  ${n.at.slice(0, 10)} ${n.subskill_id} ${n.primitive_type} [${s.kind}] ${s.what}`);
} else if (COMMAND === 'replay') {
  const [casesPath, itemsPath, outPath] = paths;
  const { generateComponentContent } = await load('service/geminiService.ts');
  const { withGenerationRequest } = await load('service/generation/generationRequest.ts');
  const { openLearningObservations, scopedNotes } = await load('service/generation/learningObservationPacket.ts');
  const { withLearnerNotes } = await load('service/attemptNotes/withLearnerNotes.ts');
  const { resolveGenerationContext } = await load('service/generation/resolveGenerationContext.ts');
  const { ai } = await load('service/geminiClient.ts');
  const { getComponentById } = await load('service/manifest/catalog/index.ts');
  // The same activity description the dispatch site passes, so the reported picks are the ones generation used.
  const activityOf = (item) => { const entry = getComponentById?.(item.componentId); const pinned = item.config?.targetEvalMode;
    return { name: item.componentId, does: entry?.description, mode: entry?.evalModes?.find((m) => m.evalMode === pinned)?.label ?? pinned }; };
  const { Type } = await import('@google/genai');
  const cases = await json(casesPath), items = await json(itemsPath);
  const KEY = process.env.LUMINA_GENERATION_SIGNING_KEY;

  const JUDGE = { type: Type.OBJECT, properties: {
    uses: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { use: { type: Type.STRING },
      reflected: { type: Type.STRING, enum: ['yes', 'partly', 'no'] }, evidence: { type: Type.STRING } }, required: ['use', 'reflected', 'evidence'] } },
    leaksEarlierMistake: { type: Type.BOOLEAN }, leakEvidence: { type: Type.STRING },
    onObjective: { type: Type.BOOLEAN }, changedBeyondNotes: { type: Type.STRING },
  }, required: ['uses', 'leaksEarlierMistake', 'leakEvidence', 'onObjective', 'changedBeyondNotes'] };
  const judge = async (objective, notes, baseline, noted) => {
    const response = await ai.models.generateContent({ model: 'gemini-flash-latest',
      contents: `Two versions of the same learning activity were generated for one objective. Version B's generator was also given private teacher notes about the child, each with an instruction ("use").
For each use, say whether version B's content reflects it where version A's does not ("yes"), only weakly ("partly") or not at all ("no"), and quote the fields of B that show it.
"leaksEarlierMistake": true if any student-visible text in B (prompts, labels, hints, feedback, narration) states the child's earlier mistake, refers to the notes, or gives away an answer because of them; quote it.
"onObjective": true if B still teaches the stated objective at the same level and with about the same number of items as A.
"changedBeyondNotes": one sentence on any other difference between A and B, or "none".
OBJECTIVE: ${JSON.stringify(objective)}
NOTES GIVEN TO B: ${JSON.stringify(notes)}
VERSION A: ${JSON.stringify(baseline).slice(0, 9000)}
VERSION B: ${JSON.stringify(noted).slice(0, 9000)}`,
      config: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 4000, responseSchema: JUDGE, httpOptions: { timeout: 60000 } } });
    return JSON.parse(response.text ?? '{}');
  };

  const results = await pool(items, 3, async (entry) => {
    const found = cases.find((c) => c.target.subskill_id === entry.subskill_id);
    const { item, topic, gradeLevel } = entry;
    const task = { subject: item.config.objectiveSubject, grade: item.config.objectiveGrade, skillId: item.config.skillId, subskillId: item.config.subskillId };
    const opened = found ? openLearningObservations(found.signed, KEY) : null;
    const offered = opened ? scopedNotes(opened, task) : [];
    const row = { componentId: item.componentId, subskill: entry.subskill_id, objective: item.config.objectiveText,
      packetVerified: !!opened, offered: offered.map((n) => ({ tier: n.tier, kind: n.kind, what: n.what, from: n.primitiveType })) };
    try {
      const data = (g) => g?.data ?? g;
      const started = Date.now();
      const baselines = [];
      for (let d = 0; d < DRAWS; d++) baselines.push(data(await withGenerationRequest({}, () => generateComponentContent(item, topic, gradeLevel))));
      const baseline = baselines[0];
      row.baselineMs = Math.round((Date.now() - started) / DRAWS);
      const tampered = found ? { ...found.signed, payload: found.signed.payload.replace('"what":"', '"what":"TAMPERED ') } : null;
      row.tamperedGivesNotes = !!(tampered && (await withGenerationRequest({ learningObservations: tampered }, () => withLearnerNotes(item, topic, activityOf(item)))).config.learnerNotes);
      const again = Date.now();
      let notedItem; const noteds = [];
      for (let d = 0; d < DRAWS; d++) {
        const out = await withGenerationRequest({ learningObservations: found?.signed }, async () => {
          const stamped = await withLearnerNotes(item, topic, activityOf(item));
          return { stamped, noted: data(await generateComponentContent(item, topic, gradeLevel)) };
        });
        if (!notedItem || out.stamped.config.learnerNotes) notedItem = out.stamped;
        noteds.push(out.noted);
      }
      const noted = noteds[0];
      row.notedMs = Math.round((Date.now() - again) / DRAWS);
      row.picked = notedItem.config.learnerNotes ?? [];
      row.intentSeen = resolveGenerationContext(notedItem, topic, '', gradeLevel).intent;
      // Code-judged: of the exact items the picks name, how many draws of each arm contain each one.
      const has = (content, token) => JSON.stringify(content ?? '').toLowerCase().split(/[^a-z0-9]+/).includes(token);
      row.include = [...new Set(row.picked.flatMap((p) => p.include ?? []))].map((token) => ({ token,
        baseline: baselines.filter((c) => has(c, token)).length, noted: noteds.filter((c) => has(c, token)).length, draws: DRAWS }));
      row.baseline = baseline; row.noted = noted; row.allBaselines = baselines; row.allNoted = noteds;
      if (row.picked.length && row.baseline && row.noted) row.judge = await judge(item.config.objectiveText, row.picked, row.baseline, row.noted);
    } catch (error) {
      row.error = String(error?.message ?? error).slice(0, 300);
    }
    return row;
  });
  await writeFile(outPath, JSON.stringify(results, null, 1));
  for (const r of results) {
    console.log(`\n${r.componentId} @ ${r.subskill}: offered ${r.offered.length}, picked ${r.picked?.length ?? '-'}, tampered->notes ${r.tamperedGivesNotes}, `
      + `baseline ${r.baselineMs}ms noted ${r.notedMs}ms${r.error ? ` ERROR ${r.error}` : ''}`);
    for (const p of r.picked ?? []) console.log(`  pick [${p.kind}] ${p.note}\n       use: ${p.use}`);
    for (const p of r.picked ?? []) if (p.include) console.log(`  include: ${p.include.join(', ')}`);
    for (const t of r.include ?? []) console.log(`  item "${t.token}": in ${t.noted}/${t.draws} noted draws, ${t.baseline}/${t.draws} baseline draws`);
    if (r.judge) {
      for (const u of r.judge.uses ?? []) console.log(`  reflected=${u.reflected}: ${u.evidence.slice(0, 220)}`);
      console.log(`  leak=${r.judge.leaksEarlierMistake}${r.judge.leaksEarlierMistake ? ` (${r.judge.leakEvidence.slice(0, 160)})` : ''} onObjective=${r.judge.onObjective} other: ${r.judge.changedBeyondNotes.slice(0, 200)}`);
    }
  }
} else {
  console.log('usage: attempt-notes-replay.mjs notes|replay ...');
}
await server.close();
