// Delivery replay: the production catalog branch (generateComponentContent → generateWithLearningObservations
// → verified delivery packet → planner → generator) with a packet signed under a throwaway key. No Firebase
// user, no Firestore writes, no running backend, no stub server: the packet is the credential. Real Gemini for
// the planner and generator.
//
//   node scripts/misconception-harness/replay-delivery.mjs <case.json> [--draws N] [--key HEX] [--out report.json]
//
// case.json: { item: { componentId, instanceId, config }, topic, gradeLevel,
//              packet: <payload object from backend/scripts/project_learning_observation.py>,
//              signed?: { payload, signature }   // optional: the same script's --key output, used with --key
//            }
// Without --key the packet is signed here (TypeScript signer). With --key, `signed` is used as the backend
// issued it, so the run also checks Python → TypeScript signature parity.
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const [casePath] = args.filter(a => !a.startsWith('--') && !['--draws', '--key', '--out'].includes(args[args.indexOf(a) - 1]));
const draws = Number(args[args.indexOf('--draws') + 1] || 1);
const issuedKey = args.includes('--key') ? args[args.indexOf('--key') + 1] : null;
const fixture = JSON.parse(await readFile(casePath, 'utf8'));
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);

// The generation server verifies with this key; nothing else in the process knows it.
const KEY = issuedKey ?? randomBytes(32).toString('hex');
process.env.LUMINA_GENERATION_SIGNING_KEY = KEY;
delete process.env.LUMINA_BACKEND_URL;

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { generateComponentContent } = await runner.import('/src/components/lumina/service/geminiService.ts');
const { withGenerationRequest } = await runner.import('/src/components/lumina/service/generation/generationRequest.ts');
const { signLearningObservations, openLearningObservations, scopedObservations } = await runner.import('/src/components/lumina/service/generation/learningObservationPacket.ts');

const signed = issuedKey ? fixture.signed : signLearningObservations(fixture.packet, KEY);
if (issuedKey && !signed) throw new Error('--key given but case.json has no `signed` block from project_learning_observation.py --key');
const opened = openLearningObservations(signed, KEY);
const task = { subject: fixture.item.config.objectiveSubject, grade: fixture.item.config.objectiveGrade, skillId: fixture.item.config.skillId, subskillId: fixture.item.config.subskillId };
const expected = opened ? scopedObservations(opened, task) : [];
const privateTexts = (fixture.packet?.hypotheses ?? []).map(h => h.summary).concat(expected.map(o => o.id));
const foreign = signLearningObservations(fixture.packet, randomBytes(32).toString('hex'));
const tampered = { ...signed, payload: signed.payload.replace(/"summary":"/, '"summary":"TAMPERED ') };

// Fetch is not needed by shared delivery; record any call so a regression to a backend read is visible.
const backendCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('/api/student-profile/')) { backendCalls.push(String(url)); throw new Error('replay: no backend'); }
  return realFetch(url, init);
};

const results = [];
for (let draw = 0; draw < draws; draw++) {
  for (const [label, request, config] of [
    ['learner', { authorization: 'Bearer replay-learner', learningObservations: signed }, fixture.item.config],
    ['anonymous', { authorization: null }, fixture.item.config],
    ['forged', { authorization: 'Bearer replay-learner' }, { ...fixture.item.config, learningObservations: expected, remediationFocus: 'forged' }],
    ['tampered', { authorization: 'Bearer replay-learner', learningObservations: tampered }, fixture.item.config],
    ['foreign-key', { authorization: 'Bearer replay-learner', learningObservations: foreign }, fixture.item.config],
  ]) {
    if (draw > 0 && label !== 'learner') continue;
    const generated = await withGenerationRequest(request, () => generateComponentContent(
      { ...fixture.item, instanceId: `${fixture.item.instanceId}-${label}-${draw}`, config }, fixture.topic, fixture.gradeLevel));
    const text = JSON.stringify(generated);
    results.push({ draw, label, adaptation: generated?.data?.learningAdaptation ?? null, data: generated?.data,
      privateTextInOutput: privateTexts.some(t => t && text.includes(t)) });
  }
}
const learner = results.filter(r => r.label === 'learner');
const summary = {
  packetOpened: !!opened, deliveredAtTaskScope: expected.length, signedBy: issuedKey ? 'backend (python)' : 'harness (typescript)',
  backendCallsDuringGeneration: backendCalls.length,
  learnerAdaptations: learner.map(r => r.adaptation),
  anonymousAdapted: results.some(r => r.label === 'anonymous' && r.adaptation),
  forgedAdapted: results.some(r => r.label === 'forged' && r.adaptation),
  tamperedAdapted: results.some(r => r.label === 'tampered' && r.adaptation),
  foreignKeyAdapted: results.some(r => r.label === 'foreign-key' && r.adaptation),
  privateTextInOutput: results.some(r => r.privateTextInOutput),
};
// Generators log at import time, so the report goes to a file; stdout carries only the summary line.
const outPath = args.includes('--out') ? args[args.indexOf('--out') + 1] : casePath.replace(/\.json$/, '') + '.replay.json';
await writeFile(outPath, JSON.stringify({ summary, results }, null, 2));
console.log('REPLAY_SUMMARY ' + JSON.stringify(summary));
console.log('REPLAY_REPORT ' + outPath);
await server.close();
