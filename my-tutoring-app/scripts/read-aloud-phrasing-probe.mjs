// Exercise the production generator and phrase runtime builder with real content.
// Does not exercise the microphone, live judging, or student-data submission.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Use --run to generate three expression passages (grades 2, 3, 5).');
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
const out = resolve(root, 'qa/read-aloud-phrasing');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateReadAloudStudio } = await runner.import('/src/components/lumina/service/literacy/gemini-read-aloud-studio.ts');
  const { studioItems, studioItemCue, studioMoveCue } = await runner.import('/src/components/lumina/primitives/visual-primitives/literacy/readAloudPhrasing.ts');
  const { validateJudgedScriptPack } = await runner.import('/src/components/lumina/hooks/judgedScriptContract.ts');
  for (const grade of ['2', '3', '5']) {
    const data = await generateReadAloudStudio({ componentId: 'read-aloud-studio', instanceId: `phrasing-g${grade}`,
      topic: 'A walk through a park after the rain', grade, gradeLevel: 'elementary',
      gradeContext: `Grade ${grade}`, objective: { text: 'Group words into meaningful phrases while reading aloud.' },
      intent: 'Mark phrases, read, listen to a model, and reread expressively.',
      scope: {}, targetEvalMode: 'expression', raw: { targetEvalMode: 'expression' },
    });
    const items = studioItems(data.lines, data.fluencyFocus);
    const issues = validateJudgedScriptPack({ primitiveType: 'read-aloud-studio', activityLine: 'reading practice',
      items, itemCue: studioItemCue, moveOnCue: studioMoveCue, completeCue: () => 'Done.', contextFor: () => ({}) });
    if (issues.length || items.length !== data.lines.length * 3) throw new Error(`Runtime contract failed: ${issues.join('; ')}`);
    writeFileSync(resolve(out, `grade-${grade}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(),
      data, steps: items.map(({ id, answerKind, step }) => ({ id, answerKind, step })), issues }, null, 2)) + '\n');
    process.stdout.write(JSON.stringify({ grade, lines: data.lines.length, steps: items.length, issues }) + '\n');
  }
} catch (error) {
  process.stderr.write(clean(error?.message ?? error) + '\n');
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'generation.log'), logs.join('\n') + '\n');
  await server.close();
}
