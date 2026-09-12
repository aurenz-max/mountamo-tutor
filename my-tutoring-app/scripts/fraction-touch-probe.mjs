// Real production generation plus deterministic model/cue verification.
// Does not submit student data or simulate a live microphone session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate fraction-touch pinned, intent, blended, and mixed sessions.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const root = process.cwd();
const out = resolve(root, 'qa/fraction-touch');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateFractionCircles } = await loader.import('/src/components/lumina/service/math/gemini-fraction-circles.ts');
  const { buildFractionTouchItems, fractionTouchPack, fractionTouchVerdictCue } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/fractionTouchScript.ts');
  const { checkPackGates } = await loader.import('/src/components/lumina/hooks/judgedScriptContract.testkit.ts');
  const cases = [
    ['pinned-easy', 'touch_fraction', 'easy', 'Touch the picture showing the named fraction'],
    ['pinned-hard', 'touch_fraction', 'hard', 'Recognize halves, thirds and fourths'],
    ['intent', undefined, 'medium', 'Listen to a named fraction and touch its matching shaded circle'],
    ['blend', 'touch_fraction|build', undefined, 'Recognize and build fractions'],
    ['mixed', 'mixed', undefined, 'Explore all fraction circle activities'],
  ];
  for (const [name, targetEvalMode, difficulty, intent] of cases) {
    const data = await generateFractionCircles({ componentId: 'fraction-circles', instanceId: `touch-${name}`,
      topic: 'Halves, thirds, and fourths', grade: '2', gradeLevel: 'elementary', gradeContext: 'Grade 2',
      intent, objective: {}, scope: {}, targetEvalMode, raw: { targetEvalMode, difficulty } });
    const items = buildFractionTouchItems(data.challenges);
    const issues = checkPackGates(fractionTouchPack(items));
    const types = [...new Set(data.challenges.map(c => c.type))];
    if (!items.length) issues.push('No touch_fraction items');
    if (name.startsWith('pinned') || name === 'intent') {
      if (types.length !== 1 || types[0] !== 'touch_fraction') issues.push('Single-mode routing failed');
    }
    if (name === 'blend' && (types.length !== 2 || !types.includes('build'))) issues.push('Blend routing failed');
    if (name === 'mixed' && types.length !== 5) issues.push('Mixed routing omitted a mode');
    const traces = items.map(item => ({ item, ask: fractionTouchPack(items).itemCue(item, { opening: false, howToPlay: false }),
      verdicts: item.choices.map(c => fractionTouchVerdictCue(item, c.id)) }));
    writeFileSync(resolve(out, `${name}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(), data, traces, issues }, null, 2)) + '\n');
    process.stdout.write(JSON.stringify({ name, count: data.challenges.length, types, issues }) + '\n');
    if (issues.length) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(clean(error?.message ?? error) + '\n');
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'generation.log'), logs.join('\n') + '\n');
  await server.close();
}
