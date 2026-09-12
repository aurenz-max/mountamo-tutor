// Real production generation for base-ten-blocks' two judged modes, plus
// deterministic pack/plan verification over what came back.
//
// It answers the question a vitest fixture cannot: does the LIVE generator hand
// this pack numbers it can actually ask about? The build gates drop a target
// with no place above the ones, and `regroup` also drops one whose receiving
// place is empty (every multiple of ten) — so a generator that likes round
// numbers would ship sessions that quietly shrink or fall back to clicks.
//
// Does not submit student data and does not open a live microphone session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate read_blocks and regroup sessions at each tier.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
  console[method] = (...args) => logs.push(clean(format(...args)));
}
const root = process.cwd();
const out = resolve(root, 'qa/base-ten-blocks-di');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const summary = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateBaseTenBlocks } = await loader.import('/src/components/lumina/service/math/gemini-base-ten-blocks.ts');
  const { buildDiDrivePlan } = await loader.import('/src/components/lumina/service/qa/di/diDrivePlan.ts');
  const { usesBaseTenDi } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/baseTenScript.ts');

  const cases = [
    ['read-easy', 'read_blocks', 'easy', 'Read a place on the block mat and say what it is worth'],
    ['read-medium', 'read_blocks', 'medium', 'Read hundreds, tens and ones on a block mat'],
    ['read-hard', 'read_blocks', 'hard', 'Read a four-digit block mat one place at a time'],
    ['regroup-easy', 'regroup', 'easy', 'Trade one ten for ten ones'],
    ['regroup-medium', 'regroup', 'medium', 'Trade between places on a block mat'],
    ['regroup-hard', 'regroup', 'hard', 'Trade a hundred for ten tens, then a ten for ten ones'],
  ];

  for (const [name, targetEvalMode, difficulty, intent] of cases) {
    const data = await generateBaseTenBlocks({
      componentId: 'base-ten-blocks', instanceId: `bt-${name}`,
      topic: 'Place value with base-ten blocks', grade: '2', gradeLevel: 'elementary',
      gradeContext: 'Grade 2', intent, objective: {}, scope: {},
      targetEvalMode, raw: { targetEvalMode, difficulty },
    });

    const issues = [];
    const types = [...new Set((data.challenges ?? []).map((c) => c.type))];
    if (types.length !== 1 || types[0] !== targetEvalMode) {
      issues.push(`Single-mode routing failed: got ${JSON.stringify(types)}`);
    }
    if (!usesBaseTenDi(data.challenges)) issues.push('Payload does not route to the judged stage');

    const plan = buildDiDrivePlan('base-ten-blocks', data, 'Grade 2');
    issues.push(...plan.packGateIssues);
    if (!plan.items.length) issues.push('No judged items survived the build gates');
    if (plan.droppedChallenges) {
      // Not fatal — the gate dropping a number is the gate working. It IS a
      // signal about the generator's number habits, so it is always reported.
      issues.push(`NOTE: ${plan.droppedChallenges} of ${data.challenges.length} challenges dropped`);
    }

    for (const item of plan.items) {
      if (!item.askLine) issues.push(`${item.id}: empty ask`);
      if (item.answerKind === 'voice') {
        if (!item.affirmLine) issues.push(`${item.id}: no affirmation line`);
        if (!item.correctionLine || item.correctionLine === item.askLine) {
          issues.push(`${item.id}: correction line missing or equal to the ask`);
        }
        // The leak scan the live harness runs, over the scripted ask.
        const exempt = [item.answers.leakExemptSpan ?? []].flat();
        const norm = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
        let scanned = norm(item.askLine);
        for (const span of exempt) scanned = scanned.split(norm(span)).join(' ');
        for (const token of item.answers.leakTokens ?? []) {
          if (new RegExp(`\\b${norm(token)}\\b`).test(scanned)) {
            issues.push(`${item.id}: the ask contains its own answer "${token}"`);
          }
        }
      } else if (!item.gestureVerdict?.correct.includes('solved=true')
        || !item.gestureVerdict?.wrong.includes('solved=false')) {
        issues.push(`${item.id}: hands verdict is not code-computed both ways`);
      }
    }

    const targets = (data.challenges ?? []).map((c) => c.targetNumber);
    writeFileSync(
      resolve(out, `${name}.json`),
      clean(JSON.stringify({ generatedAt: new Date().toISOString(), data, plan, issues }, null, 2)) + '\n',
    );
    const row = { name, challenges: data.challenges?.length ?? 0, targets, items: plan.items.length, issues };
    summary.push(row);
    process.stdout.write(JSON.stringify(row) + '\n');
    if (issues.some((issue) => !issue.startsWith('NOTE:'))) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(clean(error?.stack ?? error?.message ?? error) + '\n');
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  writeFileSync(resolve(out, 'generation.log'), logs.join('\n') + '\n');
  await server.close();
}
