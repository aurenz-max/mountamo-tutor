// Real generation of parameter-explorer per mode, with the generator's logs, the adapter verdict and the keys.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

for (const envFile of ['.env.local', process.env.LUMINA_ENV_FILE].filter(Boolean)) {
  if (process.env.GEMINI_API_KEY || !existsSync(envFile)) continue;
  const match = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const log = console.log;
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY ?? '@@', '[REDACTED]'));
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const modes = process.argv.slice(2).filter(a => !a.startsWith('--'));
const topic = (process.argv.find(a => a.startsWith('--topic=')) ?? '--topic=How each variable in a physics formula affects the result').slice(8);
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
const results = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  const { validateParameterExplorerData } = await loader.import('/src/components/lumina/components/live-activity/adapters/parameterExplorerLive.ts');
  const ws = await loader.import('/src/components/lumina/primitives/visual-primitives/math/parameterExplorerWorkspace.ts');
  for (const mode of modes) {
    logs.length = 0;
    // The same call the tutor-test probe (save_payload.py) and the lesson pipeline make.
    const data = (await generateComponentContent({ componentId: 'parameter-explorer', instanceId: `probe-${mode}`,
      config: { targetEvalMode: mode, objectiveGrade: '9' } }, topic, 'Grade 9'))?.data;
    let adapter = 'ok';
    try { validateParameterExplorerData(data); } catch (e) { adapter = String(e.message ?? e); }
    log(`\n== ${mode}: ${data.title} | ${data.formula} | ${data.jsExpression} | adapter ${adapter}`);
    for (const p of data.parameters) log(`  P ${p.symbol} ${p.name} ${p.min}-${p.max} step ${p.step} default ${p.default}`);
    log(`  effects ${JSON.stringify(ws.doublingEffects(data))} leader ${ws.dominantParameter(data)}`);
    for (const c of data.challenges) log(`  C ${c.id} ${c.type} ${JSON.stringify(c.prediction ?? c.correctParameter ?? '')}\n     ${ws.promptFor(data, c)}`);
    for (const l of logs.filter(l => /ParameterExplorer\]/.test(l) && !/Stage|Assembled/.test(l))) log('  LOG ' + l.slice(0, 300));
    results.push({ mode, data, adapter });
  }
  if (out) writeFileSync(out, JSON.stringify(results, null, 1));
} finally {
  await server.close();
}
