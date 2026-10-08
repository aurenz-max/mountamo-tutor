// Real production generation for transport-challenge, checking that scenarios
// follow the lesson (people or tons of cargo) instead of a fixed theme list.
// Case 1 is the 10-05 "passenger trains and freight trains" lesson intent that
// produced "move 60 people to a hospital"; case 2 is a people-only topic to
// show the passenger path still works.
//
// Pass --run. Writes qa/transport-challenge-load/<date>.json.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate transport-challenge for the trains lesson and a people-only lesson.');
  process.exit(0);
}
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
const out = resolve(root, 'qa/transport-challenge-load');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const cases = [
  {
    name: 'trains',
    mode: 'multi_constraint',
    topic: 'Passenger Trains and Freight Trains',
    title: 'The Town Delivery & Travel Challenge',
    intent: 'Interactive simulation where students choose between passenger rail, freight rail, and highway vehicles to solve community logistics problems: safely transporting 500 tourists to a festival and delivering 2,000 tons of building lumber without gridlocking town roads.',
    objective: 'Compare how passenger trains and freight trains help our communities',
  },
  {
    name: 'field-trip',
    mode: 'single_constraint',
    topic: 'Planning a class trip',
    title: 'Getting to the Museum',
    intent: 'Students choose how to get a class to a museum within a budget.',
    objective: 'Use capacity and cost to choose a vehicle',
  },
];

const summary = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateTransportChallenge } = await loader.import('/src/components/lumina/service/engineering/gemini-transport-challenge.ts');
  for (const c of cases) {
    const data = await generateTransportChallenge({
      componentId: 'transport-challenge', instanceId: `tc-${c.name}`,
      topic: c.topic, title: c.title, intent: c.intent, gradeLevel: 'elementary', gradeContext: 'Grade 4',
      objective: { text: c.objective }, scope: {}, targetEvalMode: c.mode, raw: { targetEvalMode: c.mode },
    });
    const rows = data.scenarios.map((s) => ({
      title: s.title,
      route: `${s.originEmoji} ${s.origin} -> ${s.destinationEmoji} ${s.destination} (${s.distanceKm} km)`,
      load: `${s.load.amount} ${s.load.unit} (${s.load.kind}: ${s.load.name})`,
      bestPosition: s.vehicles.findIndex((v) => v.id === s.bestVehicleId),
      answerPosition: s.tradeOffCorrectIndex,
      vehicles: s.vehicles.map((v) => `${v.emoji} ${v.name} cap ${v.capacity} @${v.speedKmh}km/h $${v.costPerTrip}`),
      constraints: s.constraints.map((k) => `${k.type}<=${k.limit}`),
      best: s.vehicles.find((v) => v.id === s.bestVehicleId)?.name,
      question: s.tradeOffQuestion,
      answer: s.tradeOffOptions[s.tradeOffCorrectIndex],
    }));
    summary.push({ case: c.name, mode: c.mode, scenarios: rows });
  }
} finally {
  await server.close();
}
const file = resolve(out, `${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify({ summary, logs: logs.filter((l) => /TransportChallenge/.test(l)) }, null, 2));
print(JSON.stringify(summary, null, 2));
print(`saved ${file}`);
