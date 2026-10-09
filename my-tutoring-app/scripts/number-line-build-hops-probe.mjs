// Real production generation for number-line's open build, build_hops, checked by its own judge: single-mode
// routing, every ask code-written from a start, a target and a hop count, at least two different hop sets per target,
// targets inside the line and distinct, the judge passing a first way and a different second way and naming a one-short
// build, the live adapter and the oracle accepting the session. The only model call is the topic range resolver
// (flash-lite). Writes qa/open-build/number-line-overnight/generation.json and, with --payload, the saved journey
// payload. No student data, no Live.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_hops sessions (K, Grade 1, Grade 2 hard). --payload also saves the G1 session as a journey payload.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  // A worktree has no .env.local of its own; the main checkout's is read when it is not here.
  const file = ['.env.local', resolve(process.cwd(), '../../../../my-tutoring-app/.env.local')].find(f => existsSync(f));
  const match = file && readFileSync(file, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const print = (...args) => process.stdout.write(`${format(...args)}\n`);

const root = process.cwd();
const out = resolve(root, 'qa/open-build/number-line-overnight');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const runs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateNumberLine } = await loader.import('/src/components/lumina/service/math/gemini-number-line.ts');
  const hopsMod = await loader.import('/src/components/lumina/primitives/visual-primitives/math/numberLineBuildHops.ts');
  const { validateActivityData } = await loader.import('/src/components/lumina/components/live-activity/adapters/numberLineLive.ts');
  const { numberLineOracle } = await loader.import('/src/components/lumina/service/qa/oracles/number-line.ts');
  const cases = [
    ['k', 'K', 'kindergarten', 'Kindergarten', undefined, 'Addition within 10', 'Put together two numbers to make a number within 10'],
    ['g1', '1', 'elementary', 'Grade 1', undefined, 'Add within 20', 'Add within 20 by counting on, as hops on a number line'],
    ['g2-hard', '2', 'elementary', 'Grade 2', 'hard', 'Add within 20', 'Make a sum within 20 from three addends'],
  ];
  for (const [name, grade, gradeLevel, gradeContext, difficulty, topic, intent] of cases) {
    const raw = { targetEvalMode: 'build_hops', ...(difficulty ? { difficulty } : {}) };
    const data = await generateNumberLine({ componentId: 'number-line', instanceId: `nl-${name}`, topic, grade, gradeLevel,
      gradeContext, intent, objective: {}, scope: { topic, intent }, targetEvalMode: 'build_hops', raw });
    const ch = data.challenges ?? [];
    const issues = [];
    const types = [...new Set(ch.map(c => c.type))];
    if (types.length !== 1 || types[0] !== 'build_hops') issues.push(`routing: got ${JSON.stringify(types)}`);
    const wantHops = difficulty === 'hard' ? 3 : 2;
    for (const c of ch) {
      const task = hopsMod.hopsTaskOf(c);
      if (!task) { issues.push(`${c.id}: not a hops task`); continue; }
      if (task.hopCount !== wantHops) issues.push(`${c.id}: ${task.hopCount} hops, wanted ${wantHops}`);
      if (c.instruction !== hopsMod.buildHopsInstruction(task)) issues.push(`${c.id}: instruction not code-written: "${c.instruction}"`);
      if (task.start < data.range.min || task.target > data.range.max) issues.push(`${c.id}: off the ${data.range.min}-${data.range.max} line`);
      const ways = hopsMod.waysFor(task.target - task.start, task.hopCount);
      if (ways.length < 2) issues.push(`${c.id}: ${ways.length} way(s)`);
      const builds = hopsMod.hopsHarnessBuilds(task);
      const first = hopsMod.buildHopsMiss(c, builds.first, null);
      const second = hopsMod.buildHopsMiss(c, builds.second, builds.first);
      const again = hopsMod.buildHopsMiss(c, [...builds.first].reverse(), builds.first);
      const wrong = hopsMod.buildHopsMiss(c, builds.wrong, null);
      if (first || second || again !== 'same_way_again' || wrong !== 'one_short')
        issues.push(`${c.id}: judge first=${first} second=${second} again=${again} wrong=${wrong}`);
    }
    if (new Set(ch.map(c => c.targetValues[0])).size !== ch.length) issues.push('repeated target');
    try { validateActivityData(data); } catch (e) { issues.push(`adapter: ${e.message}`); }
    const oracle = numberLineOracle.verify(data, { topic });
    if (oracle.violations.length) issues.push(`oracle: ${oracle.violations.map(v => `${v.check} ${v.detail}`).join(' | ')}`);
    runs.push({ name, grade, difficulty: difficulty ?? null, topic, intent, issues,
      asks: ch.map(c => c.instruction), data });
    print(`${name}: ${ch.length} items, line ${data.range.min}-${data.range.max}, band ${data.gradeBand}, ${issues.length ? issues.join('; ') : 'clean'}`);
    for (const c of ch) print(`  ${c.instruction}  (ways: ${hopsMod.waysFor(c.targetValues[0] - c.startValue, c.hopCount).map(w => w.join('+')).join(', ')})`);
  }
  // --watch <dir>: real watcher lines (flash-lite) on PNG pictures of builds (the component's svg with data-aid
  // removed, rendered 760x240), each file named for its state, under the G1 ask, against the leak rules.
  const watchAt = process.argv.indexOf('--watch');
  if (watchAt > 0) {
    const { readdirSync } = await import('node:fs');
    const { watchBuild } = await loader.import('/src/components/lumina/service/build-layer/gemini-build-watch.ts');
    const picDir = process.argv[watchAt + 1];
    const banned = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|few|many|both|several|done|ready|complete|correct|wrong|right)\b/i;
    const watched = [];
    for (const f of readdirSync(picDir).filter(n => n.endsWith('.png')).sort()) {
      const task = f.startsWith('f-') ? 'Start at 0 and land on 9 in three hops.' : 'Start at 0 and land on 12 in two hops.';
      const { seeing } = await watchBuild({ image: readFileSync(resolve(picDir, f)).toString('base64'), task, numbers: 'never',
        sceneNote: 'A number line with tick marks and numbers under it. The blue dot is the start. Orange arcs are the hops '
          + 'the child made, each from where the last one landed; a yellow dot marks where each hop lands.' });
      watched.push({ state: f.replace(/\.png$/, ''), line: seeing, leak: banned.test(seeing) });
      print(`watch ${f}: ${seeing || '(no line kept)'}`);
    }
    writeFileSync(resolve(out, 'watcher.json'), JSON.stringify({ at: new Date().toISOString(), watched }, null, 2));
  }
  if (process.argv.includes('--payload')) {
    const g1 = runs.find(r => r.name === 'g1');
    const file = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/number-line.build_hops.json');
    writeFileSync(file, `${JSON.stringify({ source: `scripts/number-line-build-hops-probe.mjs ${new Date().toISOString().slice(0, 10)} (g1, real generation)`,
      primitiveId: 'number-line', evalMode: 'build_hops', data: g1.data }, null, 1)}\n`);
    print(`payload: ${file}`);
  }
} finally {
  writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs, logs }, null, 2));
  await server.close();
}
