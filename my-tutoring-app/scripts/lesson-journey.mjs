#!/usr/bin/env node
/** Run from my-tutoring-app. See qa/lesson-bench/journeys/README.md. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer, createServerModuleRunner } from 'vite';
import { journeyHtml, journeyModel } from './lib/lesson-journey-report.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const scenarioFile = resolve(opt('scenario', 'qa/lesson-bench/journeys/phonics-starter.json'));
const scenario = JSON.parse(readFileSync(scenarioFile, 'utf8'));
const output = resolve(opt('out', 'qa/lesson-bench/journeys/runs'));
const sha = (v) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve('src'), 'server-only': resolve('vitest.stubs/server-only.ts') } } });

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { parseLessonPackage } = await runner.import('/src/components/lumina/service/qa/lessonBench/lessonPackage.ts');
  const { ContentLearner, MODEL_VERSION, PROFILES, runJourney, validateScenario } = await runner.import('/src/components/lumina/service/qa/lessonBench/journey/run.ts');
  const { extractLesson } = await runner.import('/src/components/lumina/service/qa/lessonBench/journey/extract.ts');
  const { PRODUCIBLE_LETTERS } = await runner.import('/src/components/lumina/primitives/visual-primitives/literacy/letterSoundLinkScript.ts');
  validateScenario(scenario);
  let profiles = scenario.profiles ?? PROFILES;
  const profile = opt('profile', 'all');
  if (profile !== 'all') profiles = profiles.filter((p) => p.id === profile);
  if (!profiles.length) throw new Error(`Unknown profile ${profile}`);
  const inputs = [];
  for (const contract of scenario.lessons) {
    const file = resolve(dirname(scenarioFile), contract.packagePath);
    if (args.includes('--generate')) {
      console.log(`Generating ${contract.id}: ${contract.topic}`);
      const request = { ...contract.generationRequest, topic: contract.topic, gradeLevel: contract.gradeLevel, package: true };
      // AbortController timer is transport cleanup, not a wait that blocks status updates.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 900000);
      let raw;
      try {
        const response = await fetch(`${opt('base', 'http://localhost:3000')}/api/lumina/topic-trace`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal,
        });
        if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 250)}`);
        raw = (await response.json()).package;
        parseLessonPackage(raw);
      } finally { clearTimeout(timer); }
      raw.provenance.generationRequest = request;
      mkdirSync(dirname(file), { recursive: true });
      // Archive by immutable package ID. The scenario path is only the latest pointer/copy.
      writeFileSync(join(dirname(file), `${raw.id}.json`), JSON.stringify(raw, null, 2));
      writeFileSync(file, JSON.stringify(raw, null, 2));
      console.log(`Saved ${contract.id}: ${raw.id}`);
    }
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    inputs.push({ contract, package: parseLessonPackage(raw) });
  }
  const waivePrerequisites = args.includes('--waive-prerequisites');
  const runs = profiles.flatMap((p) => scenario.seeds.map((seed) => runJourney(scenario, inputs, p, seed, { waivePrerequisites })));
  // Exposure record per lesson for the viewer: the production extractor's events, with a hearing learner's
  // `independent` flag, so a lesson nobody reached (blocked by a prerequisite) is still shown as generated.
  const hearing = profiles.find((p) => p.hearsTutor) ?? PROFILES[0];
  const exposure = Object.fromEntries(inputs.map(({ contract, package: pkg }) => {
    const extracted = extractLesson(pkg, contract);
    const learner = new ContentLearner(hearing, 1);
    const events = extracted.events.map((e) => {
      const inScope = !extracted.findings.some((f) => f.source === e.source && f.code === 'OUT_OF_SCOPE');
      return { ...e, independent: learner.act(e, inScope).independent, inScope };
    });
    return [contract.id, { events, findings: extracted.findings, unknowns: extracted.unknowns, exposures: extracted.exposures }];
  }));
  const sourceFiles = [
    ...readdirSync('src/components/lumina/service/qa/lessonBench/journey').filter((f) => f.endsWith('.ts')).map((f) => `src/components/lumina/service/qa/lessonBench/journey/${f}`),
    'src/components/lumina/primitives/visual-primitives/direct-instruction/diLetterSoundsScript.ts',
    'src/components/lumina/primitives/visual-primitives/direct-instruction/diWordReadingScript.ts',
    'src/components/lumina/primitives/visual-primitives/literacy/phonicsBlenderScript.ts',
    'src/components/lumina/primitives/visual-primitives/literacy/letterSoundLinkScript.ts',
  ];
  let gitSha = null;
  try { gitSha = execFileSync('git', ['-c', `safe.directory=${resolve('..').replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* source hashes remain authoritative in dirty/unowned trees */ }
  const report = { version: 1, model: MODEL_VERSION, claim: 'Synthetic content and evidence audit; not empirical learning efficacy or live voice/UI certification.',
    scenario, profiles, waivePrerequisites, provenance: { gitSha, scenarioHash: sha(scenario), sources: Object.fromEntries(sourceFiles.map((f) => [f, sha(readFileSync(f, 'utf8'))])),
      packages: inputs.map((i) => ({ id: i.package.id, hash: sha(i.package) })) }, runs };
  mkdirSync(output, { recursive: true });
  const id = `${scenario.id}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const jsonFile = join(output, `${id}.json`);
  writeFileSync(jsonFile, JSON.stringify(report, null, 2));
  const md = [`# ${scenario.id}`, '', report.claim, '', `Curriculum: ${scenario.curriculumSource}`, '',
    ...(waivePrerequisites ? ['**Prerequisites WAIVED for audit** — every lesson ran from retained state; no decision here is a readiness claim.', ''] : []),
    '| Persona | Seed | Lesson | Decision | Independent items | Post / delayed |', '|---|---:|---|---|---:|---|'];
  const fraction = (rows) => `${rows.filter((r) => r.correct).length}/${rows.length}`;
  for (const run of runs) for (const lesson of run.lessons) md.push(`| ${run.profile} | ${run.seed} | ${lesson.lessonId} | ${lesson.decision} | ${lesson.independentItems} | ${fraction(lesson.after)} / ${fraction(lesson.delayed)} |`);
  for (const run of runs) {
    md.push('', `## ${run.profile}, seed ${run.seed}`);
    for (const l of run.lessons) {
      md.push('', `### ${l.lessonId}: ${l.decision}`, '', ...l.reasons.map((r) => `- ${r}`));
      for (const f of [...l.findings, ...l.unknowns, ...(l.exposures ?? [])]) md.push(`- ${f.code} [${f.layer}] ${f.instanceId} ${f.source ?? ''}: ${f.note}`);
    }
  }
  md.push('', `Evidence ledger: ${basename(jsonFile)}`, '');
  writeFileSync(join(output, `${id}.md`), md.join('\n'));
  if (args.includes('--production')) {
    const backend = resolve('../backend');
    const python = opt('python', resolve(backend, process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python'));
    const curriculum = resolve(opt('curriculum', join(dirname(scenarioFile), 'curriculum-k.json')));
    console.log('Auditing attempts through the in-memory production mastery and selection services');
    execFileSync(python, ['-m', 'tests.pulse_agent.lesson_journey', jsonFile, '--curriculum', curriculum], { cwd: backend, stdio: 'inherit' });
    report.production = JSON.parse(readFileSync(jsonFile.replace(/\.json$/, '.production.json'), 'utf8'));
    writeFileSync(jsonFile, JSON.stringify(report, null, 2));
  }
  writeFileSync(join(output, `${id}.html`), journeyHtml(journeyModel(report, inputs, exposure, PRODUCIBLE_LETTERS, basename(jsonFile))));
  const against = opt('against', null);
  if (against) {
    const previous = JSON.parse(readFileSync(resolve(against), 'utf8'));
    const sameModel = JSON.stringify(previous.provenance.sources) === JSON.stringify(report.provenance.sources)
      && JSON.stringify(previous.profiles) === JSON.stringify(report.profiles);
    const comparison = { previous: resolve(against), sameModel,
      sameContract: previous.provenance.scenarioHash === report.provenance.scenarioHash,
      note: 'A different model/contract invalidates a causal before-after comparison. Regenerate multiple variants before making a campaign readiness claim.',
      changes: runs.flatMap((r) => r.lessons.map((l) => {
        const before = previous.runs.find((p) => p.profile === r.profile && p.seed === r.seed)?.lessons.find((p) => p.lessonId === l.lessonId);
        return { profile: r.profile, seed: r.seed, lessonId: l.lessonId, before: before?.decision ?? null, after: l.decision,
          independentBefore: before?.independentItems ?? null, independentAfter: l.independentItems,
          findingsBefore: before?.findings.length ?? null, findingsAfter: l.findings.length };
      })) };
    writeFileSync(join(output, `${id}.diff.json`), JSON.stringify(comparison, null, 2));
  }
  console.log(md.slice(0, 8 + runs.length * scenario.lessons.length).join('\n'));
  console.log(`Report: ${jsonFile}`);
  // A successful execution is distinct from a readiness gate. CI can explicitly require a cohort pass.
  if (args.includes('--require-advance') && runs.some((r) => r.lessons.some((l) => l.decision !== 'ADVANCE'))) process.exitCode = 1;
} finally { await server.close(); }
