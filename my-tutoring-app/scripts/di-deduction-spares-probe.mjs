// Real di-deduction generation per mode, with the generator's own log: how many rules were written, how many the
// truth review kept, which the session used, and which became lever spares (ruling R3). No student data, no Live.
//   node scripts/di-deduction-spares-probe.mjs --run [--runs N]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run to generate conclude, deny and cannot_tell.'); process.exit(0); }
const runs = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 1;
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const print = console.log.bind(console);
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateDiDeduction } = await loader.import('/src/components/lumina/service/direct-instruction/gemini-di-deduction.ts');
  for (let r = 0; r < runs; r++) for (const mode of (process.env.MODES || 'conclude,deny,cannot_tell').split(',')) {
    logs.length = 0;
    const data = await generateDiDeduction(process.env.TOPIC || 'Using a rule about animal groups to decide what follows', process.env.GRADE || 'Grade 3', { targetEvalMode: mode });
    print(`\n== ${mode} run ${r + 1}: ${data.rules.length} rules, ${data.spares?.length ?? 0} spares`);
    for (const rule of data.rules) print(`  rule  All ${rule.categoryPlural} ${rule.propertyPlural} [${rule.lookalikes.join('/') || '-'}]`);
    for (const rule of data.spares ?? []) print(`  spare All ${rule.categoryPlural} ${rule.propertyPlural} [${rule.lookalikes.join('/') || '-'}]`);
    for (const line of logs) print(`  log   ${line.slice(0, 400).replace(/\n/g, ' ')}`);
  }
} finally {
  await server.close();
}
