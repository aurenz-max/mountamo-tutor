// Real production generation for vehicle-comparison-lab on the 10-05 trains
// lesson (evidence_choice) and a people-only lesson, checking the cargo metric
// appears where goods move and evidence_choice keeps a real-world job instead
// of a "which leads on <metric>" template. Pass --run.
// Writes qa/vehicle-comparison-cargo/<date>.json.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const print = console.log.bind(console);
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
  console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]'));
}
const root = process.cwd();
const out = resolve(root, 'qa/vehicle-comparison-cargo');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const cases = [
  {
    name: 'trains', mode: 'evidence_choice', topic: 'Passenger Trains and Freight Trains',
    title: 'Community Helpers on Tracks',
    intent: 'Compare passenger trains and freight trains on capacity, traffic reduction, environmental benefits, and community supply lines, demonstrating how passenger trains reduce road congestion for workers while freight trains stock grocery shelves and bring building supplies.',
    objective: 'Compare how passenger trains and freight trains help our communities',
  },
  {
    name: 'airplanes', mode: 'evidence_choice', topic: 'How airplanes carry people',
    title: 'Airliner Showdown', intent: 'Compare passenger airliners on speed, seats and range.',
    objective: 'Compare airplanes using data',
  },
];
const summary = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateVehicleComparisonLab } = await loader.import('/src/components/lumina/service/engineering/gemini-vehicle-comparison-lab.ts');
  for (const c of cases) {
    const data = await generateVehicleComparisonLab({
      componentId: 'vehicle-comparison-lab', instanceId: `vcl-${c.name}`,
      topic: c.topic, title: c.title, intent: c.intent, gradeLevel: 'elementary', gradeContext: 'Grade 4',
      objective: { text: c.objective }, scope: {}, targetEvalMode: c.mode, raw: { targetEvalMode: c.mode },
    });
    summary.push({
      case: c.name,
      metrics: data.comparisonMetrics,
      vehicles: data.vehicles.map((v) => `${v.name}: ${v.metrics.passengerCapacity.display} | cargo ${v.metrics.cargoCapacity?.display ?? '-'} | ${v.metrics.topSpeed.display}`),
      challenges: data.challenges.map((ch) => ({
        type: ch.type, scenario: ch.scenario,
        key: `${data.vehicles.find((v) => v.id === ch.bestVehicleId)?.name} via ${ch.bestEvidenceMetric}`,
      })),
    });
  }
} finally {
  await server.close();
}
const file = resolve(out, `${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify({ summary, logs: logs.filter((l) => /VehicleComparisonLab/.test(l)) }, null, 2));
print(JSON.stringify(summary, null, 2));
print(logs.filter((l) => /VehicleComparisonLab/.test(l)).join('\n'));
