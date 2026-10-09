// Real production generation for lever-lab's open builds (build_balance, build_lift), checked by code against the
// judge: routing (pin and intent), the session shape (a build, the same target a different way, a new target), every
// target levels/lifts many builds, a reference build passes and a one-over build misses, the ask names no seat or
// weight it should not, and an unpinned broad lesson still gets the sandbox. Writes
// qa/open-build/lever-lab-overnight/generation.json. Flash-lite only (title + intent routing). No student data, no Live.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate lever-lab build sessions (K balance, Grade 4 lift, Grade 3 by intent, broad intent).');
  process.exit(0);
}
for (const envFile of ['.env.local', 'C:/Users/xbox3/claude web tutor/my-tutoring-app/.env.local']) {
  if (process.env.GEMINI_API_KEY || !existsSync(envFile)) continue;
  const match = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const print = (...args) => process.stdout.write(`${format(...args)}\n`);

const root = process.cwd();
const out = resolve(root, 'qa/open-build/lever-lab-overnight');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const runs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateLeverLab } = await loader.import('/src/components/lumina/service/engineering/gemini-lever-lab.ts');
  const L = await loader.import('/src/components/lumina/primitives/visual-primitives/engineering/leverLabBuild.ts');
  const cases = [
    ['k-balance', 'K', 'Kindergarten', 'build_balance', 'Balance a seesaw', ['build_balance']],
    ['g4-lift', '4', 'Grade 4', 'build_lift', 'Use a lever to lift a heavy load with less force', ['build_lift']],
    ['g3-intent', '3', 'Grade 3', undefined, 'Balance a seesaw by changing where heavier and lighter kids sit', ['build_balance']],
    ['g2-broad', '2', 'Grade 2', undefined, undefined, null],
  ];
  for (const [name, grade, gradeContext, pin, intent, want] of cases) {
    const topic = 'Levers and balance';
    const data = await generateLeverLab({ componentId: 'lever-lab', instanceId: `ll-${name}`, topic, grade, gradeLevel: 'elementary',
      gradeContext, intent, objective: {}, scope: { topic, intent }, targetEvalMode: pin, raw: pin ? { targetEvalMode: pin } : {} });
    const ch = data.challenges ?? [];
    const issues = [];
    const types = [...new Set(ch.map(c => c.type))];
    if (want === null) {
      if (ch.length) issues.push(`broad lesson should keep the sandbox, got ${JSON.stringify(types)}`);
      if (!Array.isArray(data.loads) || data.loads.length < 2) issues.push('sandbox has no loads');
    } else {
      if (JSON.stringify(types) !== JSON.stringify(want)) issues.push(`routing: got ${JSON.stringify(types)}`);
      if (ch.length !== 3) issues.push(`${ch.length} items, want 3`);
      if (ch[1] && ch[1].differentFrom !== ch[0].id) issues.push('item 2 is not "a different way" on item 1');
      if (new Set(ch.map(c => c.id)).size !== ch.length) issues.push('duplicate ids');
      const band = L.leverBand(grade, gradeContext);
      for (const c of ch) {
        if (c.type === 'build_balance') {
          const target = L.balanceTarget(c);
          const ways = L.balanceSeatings(target, c.palette);
          if (ways.length < 4) issues.push(`${c.id}: only ${ways.length} seatings level ${target}`);
          if (c.instruction !== L.balanceInstruction(c.given, !!c.differentFrom)) issues.push(`${c.id}: ask not code-written`);
          if (/\d/.test(c.instruction)) issues.push(`${c.id}: ask names a number`);
          if (JSON.stringify(c.palette) !== JSON.stringify(L.PALETTE[band])) issues.push(`${c.id}: palette not the ${band} palette`);
          // The judge on the generated item: a reference seating passes, one more kid on the end tips it.
          const ref = ways[0];
          if (!L.judgeBalance(c.given, ref).pass) issues.push(`${c.id}: reference seating failed`);
          const over = [...ref.filter(k => k.seat !== 5), { seat: 5, weight: 1, icon: '' }];
          if (L.judgeBalance(c.given, over).pass && L.seatingKey(over) !== L.seatingKey(ref)) issues.push(`${c.id}: one-over passed`);
          if (c.differentFrom && L.judgeBalance(c.given, ref, L.seatingKey(ref)).miss !== 'same_way') issues.push(`${c.id}: repeat not refused`);
        } else {
          const spots = L.liftFulcrums(c.rockWeight, c.pusherWeight);
          if (c.pusherWeight >= c.rockWeight) issues.push(`${c.id}: helper not lighter than the rock`);
          if (spots.length < 2) issues.push(`${c.id}: ${spots.length} fulcrum spots lift it`);
          if (c.instruction !== L.liftInstruction(c.rockWeight, c.pusherWeight, !!c.differentFrom)) issues.push(`${c.id}: ask not code-written`);
          const pass = L.judgeLift(c.rockWeight, c.pusherWeight, { fulcrum: spots[0], pusherAt: L.LIFT_BAR });
          const weak = L.judgeLift(c.rockWeight, c.pusherWeight, { fulcrum: spots[spots.length - 1] + 1, pusherAt: L.LIFT_BAR });
          if (!pass?.pass) issues.push(`${c.id}: reference lever failed`);
          if (weak?.miss !== 'too_weak') issues.push(`${c.id}: fulcrum one past the last spot did not miss too_weak (${weak?.miss})`);
        }
      }
      // Where to sit or put the fulcrum is the build; a heavy rock is a given (the ask states its weight).
      if (/\b(left|right|closer|farther|nearer|middle|end)\b/i.test(data.title)) issues.push(`title hints the build: ${data.title}`);
    }
    runs.push({ name, grade, pin: pin ?? null, intent: intent ?? null, issues, title: data.title, challengeType: data.challengeType ?? null,
      challenges: ch, sandboxLoads: ch.length ? undefined : data.loads });
    print(`${name}: ${ch.length ? `${ch.length} items ${JSON.stringify(types)}` : 'sandbox'} | title "${data.title}" | ${issues.length ? issues.join('; ') : 'clean'}`);
    for (const c of ch) print(`  ${c.id} ${c.type}${c.differentFrom ? ' (again)' : ''}: ${c.instruction}`
      + (c.given ? ` given ${JSON.stringify(c.given.map(k => [k.seat, k.weight]))}` : ` rock ${c.rockWeight} helper ${c.pusherWeight}`));
  }
} finally {
  writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs, logs }, null, 2));
  await server.close();
}
