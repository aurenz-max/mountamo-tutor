// /misconception-test Probe D + Probe G for fraction-bar, number-line,
// fraction-circles, bar-model. Real engines: the shipped evidence builders feed
// the real distiller (D), and the distiller's own sentence feeds the real
// generator through the registry (G). No student data is written.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (v) => String(v).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(clean(format(...a)));

const root = process.cwd();
const out = resolve(root, 'qa/misconception');
mkdirSync(out, { recursive: true });
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const phase = process.argv.find((a) => a.startsWith('--phase='))?.slice(8) ?? 'DG';
const tag = only ?? 'all';

const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const report = { probeD: [], probeG: [] };
const best = {};
try {
  const L = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const P = '/src/components/lumina/primitives/visual-primitives/math';
  const { distillMisconception } = await L.import('/src/components/lumina/evaluation/diagnosis/distillMisconception.ts');
  const { fractionBarDiagnosisEvidence } = await L.import(P + '/fractionBarEvidence.ts');
  const { buildFractionCompareEvidence } = await L.import(P + '/fractionCompareEvidence.ts');
  const { buildPictureGraphEvidence } = await L.import(P + '/barModelEvidence.ts');
  const { buildJumpDiagnosisEvidence, jumpResponseFor } = await L.import(P + '/numberLineEvidence.ts');

  // Probe D personas: wrong-rule and must-abstain, run through the SHIPPED builders.
  // fraction-bar: role swap - picks the denominator when asked for the numerator.
  const fbResp = (id, n, d, ph, expected, selected, attempt) => ({
    challengeId: id, numerator: n, denominator: d, phase: ph, expected, selected,
    attempt, hintsBefore: 0, choices: [n, d, n + 1, d + 1],
  });
  const fbSwap = [];
  [[3, 4], [2, 5], [4, 6]].forEach(([n, d], i) => {
    const id = 'fraction-bar-' + (i + 1);
    fbSwap.push(fbResp(id, n, d, 'numerator', n, d, 1), fbResp(id, n, d, 'numerator', n, n, 2));
    fbSwap.push(fbResp(id, n, d, 'denominator', d, n, 1), fbResp(id, n, d, 'denominator', d, d, 2));
    fbSwap.push(fbResp(id, n, d, 'build', n, d, 1), fbResp(id, n, d, 'build', n, n, 2));
  });
  const fbSlip = [fbResp('fraction-bar-1', 3, 4, 'build', 3, 2, 1), fbResp('fraction-bar-1', 3, 4, 'build', 3, 3, 2)];

  // fraction-circles: bigger denominator implies bigger fraction, on same-numerator pairs.
  const fc = (id, ln, ld, rn, rd, chosen, correct, attempt = 1) => ({
    itemId: id, left: { numerator: ln, denominator: ld }, right: { numerator: rn, denominator: rd },
    chosen, correct, attempt, labelsShown: false, hintShown: false,
  });
  const fcBigger = [fc('fc-1', 1, 3, 1, 6, 'right', 'left'), fc('fc-2', 1, 2, 1, 8, 'right', 'left'),
    fc('fc-3', 2, 3, 2, 6, 'right', 'left'), fc('fc-4', 3, 4, 3, 8, 'right', 'left')];
  const fcSlip = [fc('fc-1', 1, 3, 1, 6, 'left', 'left'), fc('fc-2', 1, 2, 1, 8, 'left', 'left'),
    fc('fc-3', 2, 3, 2, 6, 'right', 'left'), fc('fc-4', 1, 4, 3, 4, 'right', 'right')];

  // bar-model: reads the picture graph one-to-one - answers the icon count, not the total.
  const bm = (i, label, icons, iconValue, picked) => ({
    ch: {
      id: 'bar-model-' + i, evalMode: 'picture_graph', prompt: 'How many ' + label + ' in all?',
      targetBarIndex: 0, values: [{ label, value: icons * iconValue }],
      scale: { iconValue, iconEmoji: '*' }, expectedValue: icons * iconValue,
      options: [icons, icons * iconValue, icons * iconValue + iconValue, icons + 1], showTargetHighlight: true,
    },
    rec: { challengeId: 'bar-model-' + i, selectedOptions: picked },
  });
  const bmIcon = [bm(1, 'apples', 4, 5, [4, 20]), bm(2, 'pears', 3, 5, [3, 15]), bm(3, 'plums', 6, 5, [6, 30])];
  const bmSlip = [bm(1, 'apples', 4, 5, [20]), bm(2, 'pears', 3, 5, [3, 15]), bm(3, 'plums', 6, 5, [30])];

  // number-line: counts the start tick as the first hop - every landing one short.
  const nlJump = (id, type, start, change, placed, attempt = 1) =>
    jumpResponseFor(id, attempt, [{ type, startValue: start, changeValue: change }], [placed], 1);
  const nlShort = [nlJump('nl-1', 'add', 6, 3, 8), nlJump('nl-2', 'add', 4, 5, 8),
    nlJump('nl-3', 'subtract', 12, 4, 9), nlJump('nl-4', 'add', 7, 2, 8)];
  const nlSlip = [nlJump('nl-1', 'add', 6, 3, 9), nlJump('nl-2', 'add', 4, 5, 9),
    nlJump('nl-3', 'subtract', 12, 4, 7), nlJump('nl-4', 'add', 7, 2, 9)];

  const fbIds = ['fraction-bar-1', 'fraction-bar-2', 'fraction-bar-3'];
  const cases = [
    { family: 'fraction-bar', id: 'fraction-bar-role-swap', expect: 'generative', grade: '3', evalMode: 'build',
      subskillId: 'NF001-03-a', score: 30, evidence: fractionBarDiagnosisEvidence(fbIds, fbSwap, 'build', 'medium') },
    { family: 'fraction-bar', id: 'fraction-bar-single-build-slip', expect: 'abstain', grade: '3', evalMode: 'build',
      subskillId: 'NF001-03-a', score: 67, evidence: fractionBarDiagnosisEvidence(fbIds, fbSlip, 'build', 'medium') },
    { family: 'fraction-circles', id: 'fraction-circles-bigger-denominator', expect: 'generative', grade: '3',
      evalMode: 'compare', subskillId: 'NF001-02-e', score: 0, evidence: buildFractionCompareEvidence(fcBigger) },
    { family: 'fraction-circles', id: 'fraction-circles-mixed-slip', expect: 'abstain', grade: '3',
      evalMode: 'compare', subskillId: 'NF001-02-e', score: 50, evidence: buildFractionCompareEvidence(fcSlip) },
    { family: 'bar-model', id: 'bar-model-icon-count-for-total', expect: 'generative', grade: '3',
      evalMode: 'picture_graph', subskillId: 'MEAS003-04-a', score: 40,
      evidence: buildPictureGraphEvidence(bmIcon.map((x) => x.ch), bmIcon.map((x) => x.rec)) },
    { family: 'bar-model', id: 'bar-model-single-slip', expect: 'abstain', grade: '3',
      evalMode: 'picture_graph', subskillId: 'MEAS003-04-a', score: 67,
      evidence: buildPictureGraphEvidence(bmSlip.map((x) => x.ch), bmSlip.map((x) => x.rec)) },
    { family: 'number-line', id: 'number-line-start-tick-as-hop', expect: 'generative', grade: '1', evalMode: 'jump',
      subskillId: 'OPS001-03-a', score: 0, evidence: buildJumpDiagnosisEvidence(nlShort, { min: 0, max: 20 }) },
    { family: 'number-line', id: 'number-line-scattered-misses', expect: 'abstain', grade: '1', evalMode: 'jump',
      subskillId: 'OPS001-03-a', score: 25, evidence: buildJumpDiagnosisEvidence(nlSlip, { min: 0, max: 20 }) },
  ].filter((c) => !only || c.family === only);

  if (phase.includes('D')) {
    for (const c of cases) {
      if (!c.evidence) { report.probeD.push({ family: c.family, id: c.id, expect: c.expect, verdict: 'NO-EVIDENCE' }); continue; }
      const draws = [];
      for (let i = 0; i < 2; i++) {
        draws.push(await distillMisconception(c.evidence, {
          score: c.score, success: false, subskillId: c.subskillId, evalMode: c.evalMode, gradeLevel: c.grade,
        }));
      }
      if (c.expect === 'generative') {
        const gen = draws.find((d) => !d.abstain && d.misconceptionText);
        if (gen && !best[c.family]) best[c.family] = gen;
      }
      report.probeD.push({ family: c.family, id: c.id, expect: c.expect, evidence: c.evidence, draws });
      writeFileSync(resolve(out, 'probe-d-' + tag + '.json'), JSON.stringify({ probeD: report.probeD, best }, null, 2));
    }
  }

  // Probe G: null run vs remediation run through the real registry.
  if (phase.includes('G')) {
    if (!phase.includes('D')) {
      // Reuse the sentences Probe D actually produced; never a hand-written focus.
      const prior = JSON.parse(readFileSync(resolve(out, 'probe-d-all.json'), 'utf8'));
      for (const [k, v] of Object.entries(prior.best ?? {})) best[k] = v;
    }
    const { generateComponentContent } = await L.import('/src/components/lumina/service/geminiService.ts');
    const G = {
      'fraction-bar': { evalMode: 'build', grade: '3', difficulty: 'medium', topic: 'naming and shading fractions of a whole', gradeLevel: 'elementary' },
      'fraction-circles': { evalMode: 'compare', grade: '3', difficulty: 'medium', topic: 'comparing fractions with circle models', gradeLevel: 'elementary', subskillId: 'NF001-02-e' },
      'bar-model': { evalMode: 'picture_graph', grade: '3', difficulty: 'medium', topic: 'reading a picture graph with a key', gradeLevel: 'elementary' },
      'number-line': { evalMode: 'jump', grade: '1', difficulty: 'medium', topic: 'counting on and counting back on a number line', gradeLevel: 'elementary' },
    };
    for (const [family, g] of Object.entries(G)) {
      if (only && family !== only) continue;
      const focus = best[family]?.misconceptionText;
      const run = async (label, observations) => {
        const item = {
          componentId: family, instanceId: 'mt-' + family + '-' + label + '-' + Date.now(),
          config: {
            targetEvalMode: g.evalMode, difficulty: g.difficulty, objectiveGrade: g.grade,
            ...(g.subskillId ? { subskillId: g.subskillId } : {}),
            ...(observations ? { learningObservations: observations } : {}),
          },
        };
        const t = Date.now();
        try {
          const r = await generateComponentContent(item, g.topic, g.gradeLevel);
          return { label, ms: Date.now() - t, data: r?.data ?? null };
        } catch (e) {
          return { label, ms: Date.now() - t, error: clean(e && e.message ? e.message : e) };
        }
      };
      const nullRun = await run('null', null);
      const remRuns = [];
      if (focus) {
        remRuns.push(await run('rem1', [{ id: 'obs-1', summary: focus }]));
        remRuns.push(await run('rem2', [{ id: 'obs-1', summary: focus }]));
      }
      report.probeG.push({ family, focus: focus ?? null, nullRun, remRuns });
      writeFileSync(resolve(out, 'probe-g-' + tag + '.json'), JSON.stringify(report.probeG, null, 2));
    }
  }
} finally {
  await server.close();
  writeFileSync(resolve(out, 'probe-logs-' + tag + '.txt'), logs.join('\n'));
}
process.stdout.write(JSON.stringify({ d: report.probeD.length, g: report.probeG.length }) + '\n');
process.exit(0);
