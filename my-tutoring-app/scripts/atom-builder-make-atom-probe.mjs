// Real production generation for atom-builder's open build, make_atom, checked by code against the judge: single-mode
// routing, a code-owned ask per item, distinct asks, grades 3-5 neutral only, the instruction code-written from the ask,
// no target written, and every ask passable by at least two different elements inside the band's proton limit.
// One unpinned run (flash-lite) checks the classic path never yields make_atom. Writes
// qa/open-build/atom-builder-overnight/generation.json. No student data, no Live.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate make_atom sessions (grades 3-8) and one unpinned session.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const key = process.env.GEMINI_API_KEY ?? '';
const clean = (value) => (key ? String(value).replaceAll(key, '[REDACTED]') : String(value));
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const print = (...args) => process.stdout.write(`${format(...args)}\n`);

const root = process.cwd();
const out = resolve(root, 'qa/open-build/atom-builder-overnight');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const runs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateAtomBuilder } = await loader.import('/src/components/lumina/service/chemistry/gemini-atom-builder.ts');
  const { atomAskInstruction, passingBuilds } = await loader.import('/src/components/lumina/primitives/visual-primitives/chemistry/atomBuild.ts');
  const ctx = (grade, targetEvalMode) => ({
    componentId: 'atom-builder', instanceId: `ab-${grade}`, topic: 'Atomic structure', grade, gradeLevel: 'elementary',
    gradeContext: `Grade ${grade}`, intent: 'Build atoms and explain what makes each one', objective: {},
    scope: { topic: 'Atomic structure', intent: 'Build atoms' }, targetEvalMode, raw: targetEvalMode ? { targetEvalMode } : {},
  });
  for (const grade of ['3', '4', '5', '6', '7', '8']) for (let rep = 0; rep < 3; rep++) {
    const data = await generateAtomBuilder(ctx(grade, 'make_atom'));
    const ch = data.challenges ?? [];
    const issues = [];
    const band = Number(grade) <= 5 ? '3-5' : '6-8';
    if (data.gradeBand !== band) issues.push(`band ${data.gradeBand} for grade ${grade}`);
    if (ch.some(c => c.type !== 'make_atom' || !c.ask)) issues.push('routing: an item without a make_atom ask');
    if (new Set(ch.map(c => JSON.stringify(c.ask))).size !== ch.length) issues.push('asks repeat');
    if (band === '3-5' && ch.some(c => ['charge', 'isotopes'].includes(c.ask?.kind))) issues.push('ion or isotope ask at 3-5');
    const passable = [];
    for (const c of ch) {
      if (c.instruction !== atomAskInstruction(c.ask)) issues.push(`instruction not code-written: ${c.instruction}`);
      if (c.targetProtons !== null || c.targetNeutrons !== null || c.targetElectrons !== null) issues.push(`${c.id}: a target was written`);
      const builds = passingBuilds(c.ask, data.constraints.maxProtons);
      const elements = new Set(builds.map(b => (Array.isArray(b) ? b[0].protons : b.protons)));
      passable.push({ ask: c.ask, passingBuilds: builds.length, elements: elements.size });
      if (elements.size < 2) issues.push(`${c.id}: fewer than two elements pass`);
    }
    if (data.showOptions.showCharge || data.showOptions.showMassNumber || data.showOptions.showElectronConfiguration) issues.push('a property readout is on');
    runs.push({ grade, rep, issues, asks: ch.map(c => c.instruction), passable });
    print(`${issues.length ? 'FAIL' : 'PASS'} grade ${grade} #${rep}: ${ch.map(c => c.instruction).join(' | ')}${issues.length ? ` :: ${issues.join('; ')}` : ''}`);
  }
  // The classic path, unpinned: the model's own mix. make_atom is not in its schema, so it must never appear.
  if (key) {
    const data = await generateAtomBuilder(ctx('7', undefined));
    const types = (data.challenges ?? []).map(c => c.type);
    const issues = types.includes('make_atom') ? ['unpinned session holds make_atom'] : [];
    runs.push({ grade: '7', rep: 'unpinned', issues, types });
    print(`${issues.length ? 'FAIL' : 'PASS'} grade 7 unpinned: ${types.join(', ')}`);
  } else {
    print('SKIP unpinned run: no GEMINI_API_KEY');
  }
} finally {
  await server.close();
}
const failed = runs.filter(r => r.issues.length);
writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ when: new Date().toISOString(), runs, logs: logs.slice(-40) }, null, 2));
print(`${runs.length - failed.length}/${runs.length} clean`);
process.exit(failed.length ? 1 : 0);
