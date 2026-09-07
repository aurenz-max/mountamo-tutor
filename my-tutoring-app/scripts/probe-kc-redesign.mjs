// KC redesign P1–P3 runtime probe (2026-09-05). Run from my-tutoring-app.
//
// For each of the five KC-only lesson packages the handoff names, regenerate
// the knowledge check through the LIVE generator (set-sized plan → code-built
// production items + orchestrator for the legacy slots; real Gemini for those),
// run the oracle + the runtime script gate, swap the new KC block into the
// package, and re-judge the whole lesson with the coverage judge (real Gemini).
// Prints a before/after table per objective and saves the evidence.
//
//   node scripts/probe-kc-redesign.mjs [out.json] [--no-judge] [--only e1b7,mb4f]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const args = process.argv.slice(2);
const output = resolve(root, args.find((a) => a.endsWith('.json') && !a.startsWith('--')) || 'qa/eval-reports/knowledge-check-redesign-2026-09-05.json');
const judge = !args.includes('--no-judge');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).split(',') : null;

const PACKAGES = [
  'kindergarten-subtraction-20260905220159-e1b7',
  'kindergarten-subtraction-for-kindergarten-20260905202425-mb4f',
  'kindergarten-shapes-20260905194513-99mt',
  'kindergarten-addition-20260905190456-xr70',
  'kindergarten-decoding-cvc-words-with-short-a-20260905200116-rw3p',
].filter((f) => !only || only.some((o) => f.includes(o)));

const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const evidence = { startedAt: new Date().toISOString(), judge, packages: [] };
const save = () => writeFileSync(output, JSON.stringify(evidence, null, 2));

const isKc = (e) => /final|check|kc|assessment/i.test(e);

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const { generateKnowledgeCheck } = await runner.import(`${base}service/knowledge-check/gemini-knowledge-check.ts`);
  const { knowledgeCheckOracle } = await runner.import(`${base}service/qa/oracles/knowledge-check.ts`);
  const script = await runner.import(`${base}primitives/knowledgeCheckScript.ts`);
  const { checkPackGates } = await runner.import(`${base}hooks/judgedScriptContract.testkit.ts`);
  const pkgMod = await runner.import(`${base}service/qa/lessonBench/lessonPackage.ts`);
  const evaluator = await runner.import(`${base}service/qa/lessonCoverage/evaluateLessonCoverage.ts`);
  const sink = await runner.import(`${base}service/qa/lessonCoverage/sink.ts`);

  for (const file of PACKAGES) {
    const path = resolve(root, `qa/lesson-bench/packages/${file}.json`);
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const objectives = raw.provenance?.generationRequest?.objectives ?? [];
    const topic = raw.provenance?.generationRequest?.topic ?? raw.manifest?.topic ?? raw.subskill?.description ?? objectives[0]?.text ?? file;
    const kcIndex = (raw.components ?? []).findIndex((c) => c.componentId === 'knowledge-check');
    const kcBlock = raw.components[kcIndex];
    const before = (raw.coverage?.objectives ?? []).map((o) => ({
      id: o.objectiveId, category: o.category, items: o.assessmentCount,
      kcItems: (o.assessmentEvidence ?? []).filter(isKc).length,
    }));
    const beforeConstraints = (raw.coverage?.detectedConstraints ?? []).map((c) => `${c.type}@${c.instanceId ?? ''}`);
    console.log(`\n## ${file}\n   topic "${topic}" · ${objectives.length} objectives · old KC ${kcBlock?.data?.problems?.length ?? 0} problems (${(kcBlock?.data?.problems ?? []).map((p) => p.type).join(', ')})`);

    const started = Date.now();
    let problems;
    try {
      problems = await generateKnowledgeCheck(topic, 'kindergarten', {
        useOrchestrator: true, count: kcBlock?.data?.problems?.length ?? 4, preciseGrade: 'K',
        objectiveText: raw.manifest?.finalAssessment?.intent,
        objectives: objectives.map((o) => ({ id: o.id, text: o.text, subskillId: o.subskillId, skillId: o.skillId, grade: 'K' })),
      });
    } catch (error) {
      console.log('   GENERATION FAILED', error?.message ?? error);
      evidence.packages.push({ file, topic, error: String(error?.message ?? error) });
      save();
      continue;
    }
    const genMs = Date.now() - started;
    const byObjective = objectives.map((o) => ({
      id: o.id, text: o.text,
      problems: problems.filter((p) => p.objectiveId === o.id).map((p) => `${p.type}${p.type === 'production' ? `/${p.kind}` : ''}`),
    }));
    const oracle = knowledgeCheckOracle.verify({ problems }, { gradeLevel: 'kindergarten' });
    const build = script.itemsFromProblems(problems);
    const gateIssues = build.judgedViable ? checkPackGates(script.knowledgeCheckPackBase(build.items)) : ['not judged-viable'];
    console.log(`   NEW KC: ${problems.length} problems in ${genMs}ms · per objective: ${byObjective.map((o) => `${o.id}=${o.problems.length} [${o.problems.join(', ')}]`).join(' · ')}`);
    console.log(`   oracle: ${oracle.violations.length} violation(s) ${oracle.violations.map((v) => `${v.check}:${v.detail}`).join(' | ')}`);
    console.log(`   judged build: viable=${build.judgedViable} items=${build.items.length} dropped=${build.dropped} kinds=[${build.items.map((i) => i.kind).join(', ')}] gates=${gateIssues.length ? gateIssues.join('; ') : 'clean'}`);
    for (const p of problems) {
      if (p.type !== 'production') { console.log(`     - ${p.objectiveId} ${p.type}: ${(p.question ?? p.statement ?? p.textWithBlanks ?? p.prompt ?? p.instruction ?? '').slice(0, 90)}`); continue; }
      const stim = p.stimulus.insetType === 'number-sentence' ? p.stimulus.tokens.map((t) => t.text).join(' ')
        : p.stimulus.insetType === 'arrangement' ? `${p.stimulus.emoji}×${p.stimulus.count}${p.stimulus.removed ? ` (−${p.stimulus.removed})` : ''} ${p.stimulus.layout}`
          : `card ${p.stimulus.glyphKind} ${p.stimulus.glyph || `sides=${p.stimulus.sides}`}`;
      console.log(`     - ${p.objectiveId} production/${p.kind}: "${p.ask}" | ${stim} | answer=${p.expectedAnswer} | menu=${p.options.map((o) => o.text).join('/')}`);
    }

    const record = { file, topic, objectives: byObjective, genMs, oracle: oracle.violations, judgedViable: build.judgedViable, items: build.items.map((i) => i.kind), gateIssues, before, beforeConstraints, problems };
    if (judge && kcIndex >= 0) {
      const swapped = JSON.parse(JSON.stringify(raw));
      swapped.components[kcIndex].data = { ...kcBlock.data, problems };
      delete swapped.coverage;
      const pkg = pkgMod.parseLessonPackage(swapped);
      const exhibit = pkgMod.exhibitFromPackage(pkg);
      const ev = await evaluator.evaluateLessonCoverage(exhibit, { source: 'kc-redesign-p3', lessonId: pkg.id });
      await sink.persistLessonCoverageEval(ev, { console: false });
      const after = ev.objectives.map((o) => ({
        id: o.objectiveId, category: o.category, items: o.assessmentCount,
        kcItems: (o.assessmentEvidence ?? []).filter(isKc).length, notes: o.notes,
      }));
      record.after = after;
      record.afterConstraints = ev.detectedConstraints.map((c) => `${c.type}@${c.instanceId ?? ''}: ${c.description}`);
      record.afterStatus = ev.status;
      record.afterCoverage = ev.overallObjectiveCoverage;
      console.log(`   JUDGE after: ${ev.status.toUpperCase()} coverage ${ev.overallObjectiveCoverage.toFixed(2)} (${ev.meta.latencyMs}ms)`);
      for (const o of after) {
        const b = before.find((x) => x.id === o.id);
        console.log(`     ${o.id}: ${b ? `${b.category} items=${b.items} kc=${b.kcItems}` : '(no before)'}  →  ${o.category} items=${o.items} kc=${o.kcItems}`);
      }
      for (const c of record.afterConstraints) console.log(`     ⚠ ${c}`);
    }
    evidence.packages.push(record);
    save();
  }
} finally {
  await server.close();
}
console.log(`\nsaved ${output}`);
