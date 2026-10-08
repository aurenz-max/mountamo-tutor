// Real production generation of molecule-constructor (make_molecule open build, plus one classic `build` lesson),
// checked by the oracle, the live adapter and the build's own check. Pass --run. Writes
// qa/open-build/molecule-constructor-2026-10-07/generations.json and, with --payloads, the W1 payloads. Text model only.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate molecule-constructor lessons (add --payloads to save the W1 payloads).');
  process.exit(0);
}
for (const envFile of ['.env.local', process.env.LUMINA_ENV_FILE].filter(Boolean)) {
  if (process.env.GEMINI_API_KEY || !existsSync(envFile)) continue;
  const match = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key (set GEMINI_API_KEY or LUMINA_ENV_FILE)');
const log = console.log;
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]'));
const root = process.cwd();
const out = resolve(root, 'qa/open-build/molecule-constructor-2026-10-07');
const payloadDir = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const LESSONS = [
  { mode: 'make_molecule', grade: '4', topic: 'Atoms bond to make molecules', intent: 'Make a molecule with a double bond' },
  { mode: 'make_molecule', grade: '5', topic: 'Single and double bonds', intent: 'Use valence to build molecules', difficulty: 'easy' },
  { mode: 'make_molecule', grade: '7', topic: 'Covalent bonds and valence', intent: 'Build molecules with double and triple bonds' },
  { mode: 'make_molecule', grade: '8', topic: 'Molecules from carbon, nitrogen, oxygen and chlorine', intent: 'Apply valence rules' },
  { mode: 'build', grade: '4', topic: 'Simple molecules: water, oxygen, carbon dioxide', intent: 'Build a molecule from its formula' },
];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateMoleculeConstructor } = await loader.import('/src/components/lumina/service/chemistry/gemini-molecule-constructor.ts');
  const { moleculeConstructorOracle } = await loader.import('/src/components/lumina/service/qa/oracles/molecule-constructor.ts');
  const { validateMoleculeConstructorData } = await loader.import('/src/components/lumina/components/live-activity/adapters/moleculeConstructorLive.ts');
  const ws = await loader.import('/src/components/lumina/primitives/visual-primitives/chemistry/moleculeConstructorWorkspace.ts');
  const mb = await loader.import('/src/components/lumina/primitives/visual-primitives/chemistry/moleculeBuild.ts');
  const results = [];
  const saved = new Set();
  for (const lesson of LESSONS) {
    const data = await generateMoleculeConstructor({ componentId: 'molecule-constructor', instanceId: lesson.mode, topic: lesson.topic,
      grade: lesson.grade, gradeLevel: 'elementary', gradeContext: `Grade ${lesson.grade}`, intent: lesson.intent,
      scope: { topic: lesson.topic, intent: lesson.intent }, raw: { targetEvalMode: lesson.mode, intent: lesson.intent, difficulty: lesson.difficulty } });
    const oracle = moleculeConstructorOracle.verify(data, { componentId: 'molecule-constructor', evalMode: lesson.mode, topic: lesson.topic, gradeLevel: `grade ${lesson.grade}` });
    let adapter = 'ok';
    try { validateMoleculeConstructorData(data); } catch (e) { adapter = String(e.message ?? e); }
    // make_molecule: the menu's molecule passes, the harness's one-hydrogen-short molecule misses, and the scene names no molecule.
    const items = data.challenges.map((c) => {
      if (c.type !== 'make_molecule') {
        const spec = c.type === 'build_target' ? ws.specForAtoms(c.targetAtoms ?? []) : null;
        return { id: c.id, type: c.type, targetFormula: c.targetFormula, targetName: c.targetName, buildable: c.type === 'build_target' ? !!spec : undefined };
      }
      const spec = mb.passingSpec(ws.askOf(c));
      return { id: c.id, instruction: c.instruction, ask: c.ask,
        passes: spec ? mb.formulaOf(spec.atoms) : null, passMiss: spec ? mb.moleculeMiss(ws.askOf(c), mb.buildOf(spec)) ?? null : 'no spec',
        shortMiss: spec ? mb.moleculeMiss(ws.askOf(c), mb.buildOf(ws.shortOneAtom(spec))) ?? null : null,
        scene: ws.workspaceScene(c, { build: spec ? mb.buildOf(ws.shortOneAtom(spec)) : mb.EMPTY_BUILD, elements: [], bondsFormed: 0,
          allSatisfied: false, formulaInput: '', identifyInput: '' }).facts };
    });
    results.push({ lesson, title: data.title, description: data.description, gradeBand: data.gradeBand, oracle: oracle.violations,
      uncheckedTypes: oracle.uncheckedTypes, checked: oracle.checkedChallenges, adapter, items, data });
    log(`${lesson.mode} G${lesson.grade} | ${data.title} | ${items.map((i) => i.instruction ? `${i.instruction} [${i.passes}; short=${i.shortMiss}]` : `${i.type}=${i.targetFormula ?? i.targetName}${i.buildable === false ? ' UNBUILDABLE' : ''}`).join(' | ')} | oracle ${oracle.violations.length} | adapter ${adapter}`);
    const wantPayload = process.argv.includes('--payloads') && adapter === 'ok' && oracle.violations.length === 0 && !saved.has(lesson.mode)
      && items.every((i) => i.buildable !== false);
    if (wantPayload) {
      saved.add(lesson.mode);
      writeFileSync(resolve(payloadDir, `molecule-constructor.${lesson.mode}.json`), JSON.stringify({
        source: 'qa/open-build/molecule-constructor-2026-10-07/generations.json', primitiveId: 'molecule-constructor', evalMode: lesson.mode, data }, null, 1) + '\n');
    }
  }
  writeFileSync(resolve(out, 'generations.json'), JSON.stringify({ results, logs: logs.filter((l) => l.includes('[MoleculeConstructor]') || l.includes('Molecule Constructor')) }, null, 1));
} finally {
  await server.close();
}
