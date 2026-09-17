#!/usr/bin/env node
/**
 * Verify-and-gate bench: TypeSafe (System One) on the misconception loop's
 * three LLM decisions, scored against labels that predate this bench.
 *
 *   A. DISTILLER ABSTAIN GATE — evidence packet → "consistent wrong rule" or
 *      abstain. Labels: evaluation/diagnosis/scenarios.ts `expectation` (38) +
 *      qa/misconception/probe-d-all.json `expect` (8). Arms: the live distiller
 *      (POST /api/lumina distillMisconception) and TypeSafe (Noul + Score).
 *   B. HYPOTHESIS VERIFIER — for every hypothesis the distiller writes, three
 *      pairs: its own evidence (supported), another scenario's evidence (not
 *      supported), and its own evidence with the correct answer injected into
 *      the text (leak). TypeSafe Nouls `supported` and `leaks` must separate
 *      them. This is the job Probe D's LLM judge does today.
 *   C. PLANNER APPLICABILITY GATE — observation + teaching capability → move
 *      or abstain. Labels: the case tables the per-primitive probe scripts
 *      fixed before running (fraction-bar, bar-model, counting-board,
 *      number-line, number-tracer, ten-frame; place-value/base-ten cases are
 *      authored here in the same convention and marked). Arms: the live
 *      planner (planLearningAdaptation, real Gemini) and TypeSafe (Choice over
 *      moves + abstain, plus `applies` and `reliable` Nouls).
 *
 * Every arm is scored by code. The report also carries precision-at-coverage
 * curves so TypeSafe's confidence can be read as a GATE on the LLM's decision,
 * which is the use the retrieval bench found it good at.
 *
 * Usage:
 *   node scripts/typesafe-misconception-bench.mjs [--probes A,B,C] [--limit N]
 *        [--base http://localhost:3000] [--out qa/typesafe]
 * Needs the dev server on :3000 (distiller route) and GEMINI_API_KEY +
 * TYPESAFE_API_KEY in .env.local.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as vite from 'vite';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt; };
const PROBES = new Set(opt('probes', 'A,B,C,D').split(',').map((s) => s.trim().toUpperCase()));
const LIMIT = Number(opt('limit', '999'));
const BASE = opt('base', 'http://localhost:3000');
const OUT = opt('out', 'qa/typesafe');
const TS_URL = process.env.TYPESAFE_ENDPOINT || 'https://api.typesafe.ai/v1/systemone';
const TS_MODEL = process.env.TYPESAFE_MODEL || 'jev-latest';

const envText = readFileSync('.env.local', 'utf8');
const readEnv = (k) => process.env[k] || envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1].trim().replace(/^["']|["']$/g, '');
const TS_KEY = readEnv('TYPESAFE_API_KEY');
process.env.GEMINI_API_KEY = readEnv('GEMINI_API_KEY');
if (!TS_KEY || !process.env.GEMINI_API_KEY) { console.error('need TYPESAFE_API_KEY and GEMINI_API_KEY'); process.exit(2); }

const mean = (xs) => { xs = xs.map((x) => (typeof x === 'boolean' ? Number(x) : x)).filter((x) => typeof x === 'number' && !Number.isNaN(x)); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; };
const pct = (x) => (Number.isNaN(x) ? '-' : `${Math.round(x * 100)}%`);
async function pool(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}
async function systemOne(state, questions) {
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    const res = await fetch(TS_URL, { method: 'POST', headers: { Authorization: `Bearer ${TS_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state, model: TS_MODEL, questions }), signal: AbortSignal.timeout(60_000) });
    const text = await res.text();
    if ((res.status === 429 || res.status === 529) && attempt < 2) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`TypeSafe HTTP ${res.status}: ${text.slice(0, 300)}`);
    return { ...JSON.parse(text), ms: Math.round(performance.now() - t0) };
  }
}
/** Precision among the top X% of rows by `score`, for a correctness predicate. */
function coverageCurve(rows, score, ok, covs = [0.5, 0.7, 0.8, 0.9, 1]) {
  const xs = rows.map((r) => ({ s: score(r), ok: ok(r) })).filter((x) => typeof x.s === 'number' && !Number.isNaN(x.s)).sort((a, b) => b.s - a.s);
  return Object.fromEntries(covs.map((c) => { const n = Math.max(1, Math.round(xs.length * c)); const top = xs.slice(0, n); return [`${Math.round(c * 100)}%`, top.filter((x) => x.ok).length / n]; }));
}
const curveRow = (label, curve) => `| ${label} | ${Object.values(curve).map(pct).join(' | ')} |`;

// ---- module runner (live TS modules; server-only stubbed) ---------------------
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const report = { probes: {}, startedAt: new Date().toISOString() };
const md = [`# TypeSafe verify-and-gate bench — misconception loop`, ``, `TypeSafe ${TS_MODEL} · distiller/planner = production Gemini flash · ${new Date().toISOString().slice(0, 10)}`, ``];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { DIAGNOSIS_SCENARIOS } = await loader.import('/src/components/lumina/evaluation/diagnosis/scenarios.ts');
  const probeD = JSON.parse(readFileSync('qa/misconception/probe-d-all.json', 'utf8'));

  // =========================================================================
  // A. Distiller abstain gate
  // =========================================================================
  const scenarios = [
    ...DIAGNOSIS_SCENARIOS.map((s) => ({ id: s.id, family: s.subskillId, subject: s.subject, evalMode: s.evalMode, gradeLevel: s.gradeLevel, score: s.score, success: s.success, subskillId: s.subskillId, evidence: s.evidence, label: s.expectation, note: s.note, source: 'scenarios.ts' })),
    ...probeD.probeD.filter((c) => c.evidence).map((c) => ({ id: c.id, family: c.family, subject: 'Math', evalMode: undefined, gradeLevel: undefined, score: 40, success: false, subskillId: undefined, evidence: c.evidence, label: c.expect, note: '', source: 'probe-d-all.json' })),
  ].slice(0, LIMIT);
  let A = [];
  if (PROBES.has('A') || PROBES.has('B')) {
    console.error(`A: ${scenarios.length} labeled evidence packets`);
    A = await pool(scenarios, 3, async (s, i) => {
      const row = { id: s.id, family: s.family, label: s.label, source: s.source };
      try {
        const t0 = performance.now();
        const res = await fetch(`${BASE}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120_000), body: JSON.stringify({ action: 'distillMisconception', params: { evidence: s.evidence, score: s.score, success: s.success, subskillId: s.subskillId, evalMode: s.evalMode, gradeLevel: s.gradeLevel } }) });
        const d = await res.json();
        // `verification` is present when the server runs with LUMINA_TYPESAFE_VERIFY=shadow|gate
        // (service/typesafe/verify.ts); in shadow it is the verdict gate mode would enforce.
        row.distiller = { ms: Math.round(performance.now() - t0), abstain: d.abstain, confidence: d.confidence ?? null, tier: d.evidenceTier, text: d.misconceptionText ?? d.rejectedText ?? '', reason: d.reason ?? '', verification: d.verification ?? null, rejectedText: d.rejectedText ?? null };
      } catch (e) { row.distiller = { error: String(e.message) }; }
      try {
        const r = await systemOne(
          { challenge: s.evidence.challengeSummary, correctOutcome: s.evidence.expected, studentDid: s.evidence.observed, judgeFeedback: s.evidence.judgeFeedback ?? null, earlierAttempts: s.evidence.priorAttempts ?? [], phaseObservations: s.evidence.phases ?? [], firstResponseScorePercent: s.evidence.firstResponseScore ?? null, grade: s.gradeLevel ?? null },
          {
            consistent_rule: { type: 'noul', instructions: 'Do these observations of one student show ONE consistent wrong rule the student is applying — a misconception that predicts their next wrong answer — rather than a single slip, an arithmetic error, a guess, or errors that contradict each other?', criteria: { true: 'A repeated or clearly patterned error that one wrong rule explains', false: 'A one-off slip, a guess, contradictory errors, or evidence too thin to tell' } },
            strength: { type: 'score', instructions: 'How strong is the evidence for a consistent wrong rule?', criteria: ['A single slip, guess, or arithmetic error', 'Errors that contradict each other or evidence too thin to read', 'A plausible pattern seen once', 'A clear signature repeated across attempts'] },
            reliable_record: { type: 'noul', instructions: 'Is the record itself reliable — transcripts present and not contradicting the judge, attempts recorded rather than missing?', criteria: { true: 'The evidence is complete enough to read', false: 'Missing transcripts, contradictions between transcript and verdict, or no attempt detail' } },
          },
        );
        row.typesafe = { ms: r.ms, tokens: r.usage.input_tokens, pRule: r.answers.consistent_rule.noul, strength: r.answers.strength.score, strengthConf: r.answers.strength.confidence, pReliable: r.answers.reliable_record.noul };
      } catch (e) { row.typesafe = { error: String(e.message) }; }
      const dOk = row.distiller?.error ? null : (row.distiller.abstain ? 'abstain' : 'generative') === s.label;
      const tOk = row.typesafe?.error ? null : (row.typesafe.pRule >= 0.5 ? 'generative' : 'abstain') === s.label;
      console.error(`[A ${i + 1}/${scenarios.length}] ${s.id.padEnd(46)} label ${s.label.padEnd(10)} distiller ${row.distiller?.error ? 'ERR' : row.distiller.abstain ? 'abstain' : `gen/${row.distiller.confidence}`} ${dOk ? '✓' : '✗'}  typesafe p=${row.typesafe?.pRule?.toFixed(2) ?? 'ERR'} s=${row.typesafe?.strength?.toFixed(1) ?? '-'} ${tOk ? '✓' : '✗'}`);
      return row;
    });
    const ok = A.filter((r) => !r.distiller?.error && !r.typesafe?.error);
    const dCorrect = (r) => (r.distiller.abstain ? 'abstain' : 'generative') === r.label;
    const tCorrect = (r) => (r.typesafe.pRule >= 0.5 ? 'generative' : 'abstain') === r.label;
    const gen = ok.filter((r) => r.label === 'generative'), abs = ok.filter((r) => r.label === 'abstain');
    const confScore = (r) => ({ high: 3, medium: 2, low: 1 })[r.distiller.confidence] ?? (r.distiller.abstain ? 0 : 1);
    const summary = {
      n: ok.length, generative: gen.length, abstain: abs.length,
      distiller: { accuracy: mean(ok.map(dCorrect)), generativeRecall: mean(gen.map((r) => !r.distiller.abstain)), abstainRecall: mean(abs.map((r) => r.distiller.abstain)), msMean: mean(ok.map((r) => r.distiller.ms)) },
      typesafe: { accuracy: mean(ok.map(tCorrect)), generativeRecall: mean(gen.map((r) => r.typesafe.pRule >= 0.5)), abstainRecall: mean(abs.map((r) => r.typesafe.pRule < 0.5)), msMean: mean(ok.map((r) => r.typesafe.ms)), tokensMean: mean(ok.map((r) => r.typesafe.tokens)), pRuleGen: mean(gen.map((r) => r.typesafe.pRule)), pRuleAbs: mean(abs.map((r) => r.typesafe.pRule)) },
      agree: mean(ok.map((r) => (r.distiller.abstain ? 'abstain' : 'generative') === (r.typesafe.pRule >= 0.5 ? 'generative' : 'abstain'))),
      agreePrecision: mean(ok.filter((r) => (r.distiller.abstain ? 'abstain' : 'generative') === (r.typesafe.pRule >= 0.5 ? 'generative' : 'abstain')).map(dCorrect)),
      // Gate view: among the distiller's GENERATIVE verdicts (the ones that reach a student), keep the top X% by score.
      gateCurves: {
        distillerConfidence: coverageCurve(ok.filter((r) => !r.distiller.abstain), confScore, (r) => r.label === 'generative'),
        typesafePRule: coverageCurve(ok.filter((r) => !r.distiller.abstain), (r) => r.typesafe.pRule, (r) => r.label === 'generative'),
        typesafeStrength: coverageCurve(ok.filter((r) => !r.distiller.abstain), (r) => r.typesafe.strength, (r) => r.label === 'generative'),
      },
      generativeVerdicts: ok.filter((r) => !r.distiller.abstain).length,
    };
    report.probes.A = { summary, rows: A };
    md.push(`## A. Distiller abstain gate — ${ok.length} labeled packets (${gen.length} generative, ${abs.length} abstain)`, ``);
    md.push(`| arm | accuracy | generative recall | abstain recall | ms |`, `|---|---|---|---|---|`);
    md.push(`| live distiller (abstain / text) | ${pct(summary.distiller.accuracy)} | ${pct(summary.distiller.generativeRecall)} | ${pct(summary.distiller.abstainRecall)} | ${Math.round(summary.distiller.msMean)} |`);
    md.push(`| TypeSafe Noul "one consistent wrong rule" ≥ 0.5 | ${pct(summary.typesafe.accuracy)} | ${pct(summary.typesafe.generativeRecall)} | ${pct(summary.typesafe.abstainRecall)} | ${Math.round(summary.typesafe.msMean)} |`);
    md.push(``, `Mean P(rule): generative packets ${summary.typesafe.pRuleGen.toFixed(2)} · abstain packets ${summary.typesafe.pRuleAbs.toFixed(2)}. Arms agree on ${pct(summary.agree)}; when they agree the verdict is right ${pct(summary.agreePrecision)}.`, ``);
    md.push(`Gate view — of the distiller's ${summary.generativeVerdicts} GENERATIVE verdicts (the ones that would reach a student), keep the top X% by score; share that are truly generative:`, ``);
    md.push(`| gate score | keep 50% | 70% | 80% | 90% | 100% |`, `|---|---|---|---|---|---|`);
    md.push(curveRow('distiller confidence (high>medium>low)', summary.gateCurves.distillerConfidence));
    md.push(curveRow('TypeSafe P(rule)', summary.gateCurves.typesafePRule));
    md.push(curveRow('TypeSafe strength score', summary.gateCurves.typesafeStrength));
    // Production verifier (service/typesafe/verify.ts) — only when the server ran with the flag.
    const verified = ok.filter((r) => r.distiller.verification?.ran);
    if (verified.length) {
      const written = verified.filter((r) => !r.distiller.abstain || r.distiller.rejectedText);
      const wouldReject = written.filter((r) => r.distiller.verification.pass === false);
      const wrongReject = wouldReject.filter((r) => r.label === 'generative');
      summary.productionVerifier = { mode: verified[0].distiller.verification.mode, written: written.length, wouldReject: wouldReject.length, wrongReject: wrongReject.length, msMean: mean(verified.map((r) => r.distiller.verification.ms)) };
      md.push(`### Production verifier (LUMINA_TYPESAFE_VERIFY=${summary.productionVerifier.mode})`, ``);
      md.push(`Server-side \`supported\` + \`leaks\` ran on ${written.length} written hypotheses: gate mode would reject ${wouldReject.length}, of which ${wrongReject.length} carry a generative label (a wrong rejection). Mean ${Math.round(summary.productionVerifier.msMean)} ms added per written hypothesis.`, ``);
      if (wouldReject.length) {
        md.push(`| id | label | failed | P(supported) / P(leaks) | hypothesis |`, `|---|---|---|---|---|`);
        for (const r of wouldReject) md.push(`| ${r.id} | ${r.label} | ${r.distiller.verification.failed.join(', ')} | ${r.distiller.verification.checks.map((c) => c.p.toFixed(2)).join(' / ')} | ${r.distiller.text.replace(/\|/g, '/').slice(0, 110)} |`);
        md.push(``);
      }
    }
    md.push(``, `### Disagreements`, ``, `| id | label | distiller | TypeSafe P(rule) / strength | note |`, `|---|---|---|---|---|`);
    for (const r of ok.filter((r) => dCorrect(r) !== tCorrect(r))) md.push(`| ${r.id} | ${r.label} | ${r.distiller.abstain ? 'abstain' : `generative (${r.distiller.confidence})`} ${dCorrect(r) ? '✓' : '✗'} | ${r.typesafe.pRule.toFixed(2)} / ${r.typesafe.strength.toFixed(1)} ${tCorrect(r) ? '✓' : '✗'} | ${(scenarios.find((s) => s.id === r.id)?.note ?? '').slice(0, 100)} |`);
    md.push(``);
  }

  // =========================================================================
  // B. Hypothesis verifier
  // =========================================================================
  if (PROBES.has('B')) {
    const withText = A.filter((r) => r.distiller && !r.distiller.error && !r.distiller.abstain && r.distiller.text);
    // Add the stored Probe D `best` hypotheses for families whose live run abstained.
    for (const [family, best] of Object.entries(probeD.best ?? {})) {
      if (best?.misconceptionText && !withText.some((r) => r.family === family)) {
        const sc = scenarios.find((s) => s.family === family && s.label === 'generative');
        if (sc) withText.push({ id: `${sc.id}::stored-best`, family, label: 'generative', distiller: { text: best.misconceptionText, confidence: best.confidence } });
      }
    }
    console.error(`B: ${withText.length} hypotheses → 3 pairs each`);
    const B = await pool(withText, 4, async (r, i) => {
      const own = scenarios.find((s) => r.id.startsWith(s.id));
      const others = withText.filter((o) => o.family !== r.family && o !== r);
      const other = others[i % Math.max(1, others.length)] ?? others[0];
      const leaked = `${r.distiller.text} The correct response here is ${own.evidence.expected}.`;
      const pack = (h) => ({ hypothesis: h });
      const state = { evidence: { challenge: own.evidence.challengeSummary, correctOutcome: own.evidence.expected, studentDid: own.evidence.observed, earlierAttempts: own.evidence.priorAttempts ?? [], phaseObservations: (own.evidence.phases ?? []).slice(0, 8) }, hypotheses: { own: pack(r.distiller.text), other: pack(other?.distiller.text ?? ''), leaked: pack(leaked) } };
      const q = {};
      for (const k of ['own', 'other', 'leaked']) {
        q[`supported_${k}`] = { type: 'noul', instructions: `Is the hypothesis \`hypotheses.${k}.hypothesis\` — a claim about the wrong rule this student applies — supported by the recorded evidence in \`evidence\`?`, criteria: { true: 'The recorded attempts are what this wrong rule would produce', false: 'The hypothesis describes a different error, a different task, or is not what the attempts show' } };
        q[`leaks_${k}`] = { type: 'noul', instructions: `Does the text of \`hypotheses.${k}.hypothesis\` state the correct answer, the target value the student should have produced, or the correct rule?`, criteria: { true: 'It reveals the answer or the correct outcome', false: 'It only describes the student\'s wrong rule' } };
      }
      try {
        const res = await systemOne(state, q);
        const a = res.answers;
        const row = { id: r.id, family: r.family, ms: res.ms, tokens: res.usage.input_tokens, hypothesis: r.distiller.text, otherFrom: other?.id ?? null,
          supported: { own: a.supported_own.noul, other: a.supported_other.noul, leaked: a.supported_leaked.noul }, leaks: { own: a.leaks_own.noul, other: a.leaks_other.noul, leaked: a.leaks_leaked.noul } };
        console.error(`[B ${i + 1}/${withText.length}] ${r.id.padEnd(46)} supported own ${row.supported.own.toFixed(2)} other ${row.supported.other.toFixed(2)} · leaks own ${row.leaks.own.toFixed(2)} injected ${row.leaks.leaked.toFixed(2)}`);
        return row;
      } catch (e) { return { id: r.id, family: r.family, error: String(e.message) }; }
    });
    const ok = B.filter((r) => !r.error);
    const summary = {
      n: ok.length,
      supportedOwnMean: mean(ok.map((r) => r.supported.own)), supportedOtherMean: mean(ok.map((r) => r.supported.other)),
      supportAccuracy: mean(ok.flatMap((r) => [r.supported.own >= 0.5, r.supported.other < 0.5])),
      supportSeparation: mean(ok.map((r) => r.supported.own > r.supported.other)),
      leakDetect: mean(ok.map((r) => r.leaks.leaked >= 0.5)), leakFalse: mean(ok.map((r) => r.leaks.own >= 0.5)),
      leaksOwnMean: mean(ok.map((r) => r.leaks.own)), leaksInjectedMean: mean(ok.map((r) => r.leaks.leaked)),
      msMean: mean(ok.map((r) => r.ms)), tokensMean: mean(ok.map((r) => r.tokens)),
    };
    report.probes.B = { summary, rows: B };
    md.push(`## B. Hypothesis verifier — ${ok.length} distiller hypotheses × {own evidence, another scenario's evidence, answer injected}`, ``);
    md.push(`| question | own evidence | other evidence | answer injected |`, `|---|---|---|---|`);
    md.push(`| mean P(supported) | ${summary.supportedOwnMean.toFixed(2)} | ${summary.supportedOtherMean.toFixed(2)} | — |`);
    md.push(`| mean P(leaks answer) | ${summary.leaksOwnMean.toFixed(2)} | — | ${summary.leaksInjectedMean.toFixed(2)} |`);
    md.push(``, `Supported ≥ 0.5 on own AND < 0.5 on other: ${pct(summary.supportAccuracy)} of judgments · own scored above other: ${pct(summary.supportSeparation)} of hypotheses. Leak Noul fires on the injected text ${pct(summary.leakDetect)} of the time and falsely on the clean text ${pct(summary.leakFalse)}. ${Math.round(summary.msMean)} ms and ${Math.round(summary.tokensMean)} input tokens per hypothesis (six questions in one request).`, ``);
    md.push(`### Weakest separations`, ``, `| id | P(supported) own / other | P(leaks) own / injected | hypothesis |`, `|---|---|---|---|`);
    for (const r of ok.sort((a, b) => (a.supported.own - a.supported.other) - (b.supported.own - b.supported.other)).slice(0, 8)) md.push(`| ${r.id} | ${r.supported.own.toFixed(2)} / ${r.supported.other.toFixed(2)} | ${r.leaks.own.toFixed(2)} / ${r.leaks.leaked.toFixed(2)} | ${r.hypothesis.replace(/\|/g, '/').slice(0, 110)} |`);
    md.push(``);
  }

  // =========================================================================
  // C. Planner applicability gate
  // =========================================================================
  if (PROBES.has('C')) {
    const { planLearningAdaptation } = await loader.import('/src/components/lumina/service/generation/planLearningAdaptation.ts');
    const fb = await loader.import('/src/components/lumina/service/math/fractionBarRemediation.ts');
    const bm = await loader.import('/src/components/lumina/service/math/barModelRemediation.ts');
    const cb = await loader.import('/src/components/lumina/service/math/countingBoardRemediation.ts');
    const nl = await loader.import('/src/components/lumina/service/math/numberLineRemediation.ts');
    const nt = await loader.import('/src/components/lumina/service/math/numberTracerRemediation.ts');
    const tf = await loader.import('/src/components/lumina/service/math/tenFrameRemediation.ts');
    const pv = await loader.import('/src/components/lumina/service/math/placeValueTeachingCapabilities.ts');
    const one = (cap) => cap.moves[0].id;
    const UNRELATED = 'The learner reverses the numerator and denominator when naming a fraction.';
    // [source, name, capability, task, observation, expected move | null]. Observation
    // texts and expectations are copied from the probe scripts' case tables
    // (their literal fallbacks where the script used a live distilled text).
    const C_CASES = [
      // fraction-bar (scripts/probe-fraction-bar-applicability.mjs)
      ['fraction-bar', 'distilled', fb.fractionBarTeaching, { grade: '3', mode: 'build', tier: 'medium', topic: 'Build fractions a/b by shading parts of a bar' }, 'The student identifies the bottom number of a fraction as the numerator, choosing it during selection and shading that many parts of the bar.', one(fb.fractionBarTeaching)],
      ['fraction-bar', 'paraphrase-a', fb.fractionBarTeaching, { grade: '3', mode: 'build', tier: 'medium', topic: 'Build fractions a/b by shading parts of a bar' }, 'When asked how many parts are shaded, the learner reports how many equal parts the whole is cut into.', one(fb.fractionBarTeaching)],
      ['fraction-bar', 'paraphrase-b', fb.fractionBarTeaching, { grade: '3', mode: 'build', tier: 'medium', topic: 'Build fractions a/b by shading parts of a bar' }, 'Says the bottom number is how many are shaded.', one(fb.fractionBarTeaching)],
      ['fraction-bar', 'unrelated', fb.fractionBarTeaching, { grade: '3', mode: 'build', tier: 'medium', topic: 'Build fractions a/b by shading parts of a bar' }, 'Adds the denominators together when adding two fractions.', null],
      ['fraction-bar', 'nearby', fb.fractionBarTeaching, { grade: '3', mode: 'build', tier: 'medium', topic: 'Build fractions a/b by shading parts of a bar' }, 'Believes a fraction with a larger denominator is always the larger fraction when comparing two fractions.', null],
      ['fraction-bar', 'contradictory', fb.fractionBarTeaching, { grade: '3', mode: 'build', tier: 'medium', topic: 'Build fractions a/b by shading parts of a bar' }, 'The selection records are unreliable and contradict each other; no consistent pattern about which number of a fraction plays which role can be inferred.', null],
      ['fraction-bar', 'other-representation', fb.fractionBarTeaching, { grade: '3', mode: 'build', tier: 'medium', topic: 'Build fractions a/b by shading parts of a bar' }, 'The student gives the bare digit for its worth regardless of its position in a whole number.', null],
      // bar-model (scripts/probe-bar-model-applicability.mjs)
      ['bar-model', 'distilled', bm.barModelTeaching, { grade: '3', mode: 'picture_graph', tier: 'medium', topic: 'Reading picture graphs', intent: 'Read a picture graph using its key' }, 'The student reads each icon in a picture graph as a single item, reporting the number of icons in a row as its total instead of applying the key value per icon.', one(bm.barModelTeaching)],
      ['bar-model', 'paraphrase-says-three', bm.barModelTeaching, { grade: '3', mode: 'picture_graph', tier: 'medium', topic: 'Reading picture graphs', intent: 'Read a picture graph using its key' }, 'Says three when three pictures are shown next to a key where each picture means five.', one(bm.barModelTeaching)],
      ['bar-model', 'paraphrase-legend', bm.barModelTeaching, { grade: '3', mode: 'picture_graph', tier: 'medium', topic: 'Reading picture graphs', intent: 'Read a picture graph using its key' }, 'Answers with how many symbols they counted and ignores the legend that says what one symbol is worth.', one(bm.barModelTeaching)],
      ['bar-model', 'unrelated-more-fewer', bm.barModelTeaching, { grade: '3', mode: 'picture_graph', tier: 'medium', topic: 'Reading picture graphs', intent: 'Read a picture graph using its key' }, 'Mixes up the words more and fewer when comparing two groups.', null],
      ['bar-model', 'nearby-axis-step', bm.barModelTeaching, { grade: '3', mode: 'picture_graph', tier: 'medium', topic: 'Reading picture graphs', intent: 'Read a picture graph using its key' }, 'Reads a bar graph by counting grid lines to the top of the bar, ignoring that the axis counts by twos.', null],
      ['bar-model', 'contradictory', bm.barModelTeaching, { grade: '3', mode: 'picture_graph', tier: 'medium', topic: 'Reading picture graphs', intent: 'Read a picture graph using its key' }, 'Evidence is contradictory: the learner applied the picture key correctly on most graphs and the one wrong choice was a tap next to the answer; no pattern about icon values can be inferred.', null],
      ['bar-model', 'cross-digit-worth', bm.barModelTeaching, { grade: '3', mode: 'picture_graph', tier: 'medium', topic: 'Reading picture graphs', intent: 'Read a picture graph using its key' }, 'The student gives the bare digit for its worth regardless of position.', null],
      // counting-board (scripts/probe-counting-board-applicability.mjs)
      ['counting-board', 'take-distilled', cb.countingBoardChangeTeaching, { grade: 'K', mode: 'take_away', tier: 'medium' }, 'On take-away boards the student answers with how many objects were on the board before any were taken away.', one(cb.countingBoardChangeTeaching)],
      ['counting-board', 'take-paraphrase-a', cb.countingBoardChangeTeaching, { grade: 'K', mode: 'take_away', tier: 'medium' }, 'After some counters are removed, the child still gives the size of the whole starting group instead of what remains.', one(cb.countingBoardChangeTeaching)],
      ['counting-board', 'take-paraphrase-b', cb.countingBoardChangeTeaching, { grade: 'K', mode: 'take_away', tier: 'medium' }, 'Answers "how many are left" with the number that was there at the start, as if nothing had been taken off.', one(cb.countingBoardChangeTeaching)],
      ['counting-board', 'add-distilled', cb.countingBoardChangeTeaching, { grade: 'K', mode: 'add_more', tier: 'medium' }, 'On add-more boards the student answers with how many objects were on the board before more were put on.', one(cb.countingBoardChangeTeaching)],
      ['counting-board', 'on-start-back', cb.countingBoardCountOnTeaching, { grade: 'K', mode: 'count_on', tier: 'medium' }, 'Told how many are already in the group, the student says that starting number back instead of counting on.', one(cb.countingBoardCountOnTeaching)],
      ['counting-board', 'on-start-twice', cb.countingBoardCountOnTeaching, { grade: 'K', mode: 'count_on', tier: 'medium' }, 'When counting on, the student says the starting number while touching the first extra object and ends one short.', one(cb.countingBoardCountOnTeaching)],
      ['counting-board', 'unrelated', cb.countingBoardChangeTeaching, { grade: 'K', mode: 'take_away', tier: 'medium' }, UNRELATED, null],
      ['counting-board', 'nearby-tracking', cb.countingBoardChangeTeaching, { grade: 'K', mode: 'take_away', tier: 'medium' }, 'When counting a set of objects the student skips one and says one less than there are.', null],
      ['counting-board', 'nearby-tracking-on', cb.countingBoardCountOnTeaching, { grade: 'K', mode: 'count_on', tier: 'medium' }, 'When counting a set of objects the student skips one and says one less than there are.', null],
      ['counting-board', 'nearby-conservation', cb.countingBoardChangeTeaching, { grade: 'K', mode: 'take_away', tier: 'medium' }, 'After a counted set is spread out, the student thinks there are more objects than before.', null],
      ['counting-board', 'contradictory', cb.countingBoardChangeTeaching, { grade: 'K', mode: 'take_away', tier: 'medium' }, 'The take-away answers contradict each other and the record is unreliable; no consistent pattern can be inferred.', null],
      // number-line (scripts/probe-number-line-applicability.mjs)
      ['number-line', 'distilled', nl.numberLineTeaching, { grade: '1', mode: 'jump', tier: 'medium', topic: 'Adding and subtracting on a number line' }, 'The student counts the starting tick mark as the first count rather than counting the jumps between numbers, causing them to advance one fewer space than requested.', one(nl.numberLineTeaching)],
      ['number-line', 'paraphrase-a', nl.numberLineTeaching, { grade: '1', mode: 'jump', tier: 'medium', topic: 'Adding and subtracting on a number line' }, 'The learner treats the tick mark they begin on as the first step of the jump, so each landing falls one step short.', one(nl.numberLineTeaching)],
      ['number-line', 'paraphrase-b', nl.numberLineTeaching, { grade: '1', mode: 'jump', tier: 'medium', topic: 'Adding and subtracting on a number line' }, 'Counts the tick they start on when hopping along the line.', one(nl.numberLineTeaching)],
      ['number-line', 'unrelated', nl.numberLineTeaching, { grade: '1', mode: 'jump', tier: 'medium', topic: 'Adding and subtracting on a number line' }, UNRELATED, null],
      ['number-line', 'nearby-far', nl.numberLineTeaching, { grade: '1', mode: 'jump', tier: 'medium', topic: 'Adding and subtracting on a number line' }, 'When plotting a number, the learner places the point far from its target, apparently guessing the location.', null],
      ['number-line', 'direction', nl.numberLineTeaching, { grade: '1', mode: 'jump', tier: 'medium', topic: 'Adding and subtracting on a number line' }, 'The learner hops right when asked to subtract and left when asked to add.', null],
      ['number-line', 'contradictory', nl.numberLineTeaching, { grade: '1', mode: 'jump', tier: 'medium', topic: 'Adding and subtracting on a number line' }, 'The recorded landings conflict with one another and the transcription is unreliable; no counting pattern can be inferred.', null],
      // number-tracer (scripts/probe-number-tracer-applicability.mjs)
      ['number-tracer', 'distilled', nt.numberTracerSequenceTeaching, { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10', intent: 'Find the missing number in a counting sequence' }, 'In counting runs the student writes the number that follows the last number shown instead of the hidden number.', one(nt.numberTracerSequenceTeaching)],
      ['number-tracer', 'paraphrase-a', nt.numberTracerSequenceTeaching, { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10', intent: 'Find the missing number in a counting sequence' }, 'Instead of filling the blank inside a counting run, the child writes the next number after the end of the run.', one(nt.numberTracerSequenceTeaching)],
      ['number-tracer', 'paraphrase-b', nt.numberTracerSequenceTeaching, { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10', intent: 'Find the missing number in a counting sequence' }, 'Counts on past the last number shown rather than working out the number that belongs in the gap.', one(nt.numberTracerSequenceTeaching)],
      ['number-tracer', 'neighbour', nt.numberTracerSequenceTeaching, { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10', intent: 'Find the missing number in a counting sequence' }, 'Writes the number just before the gap again instead of the next number.', one(nt.numberTracerSequenceTeaching)],
      ['number-tracer', 'unrelated', nt.numberTracerSequenceTeaching, { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10', intent: 'Find the missing number in a counting sequence' }, UNRELATED, null],
      ['number-tracer', 'nearby-orientation', nt.numberTracerSequenceTeaching, { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10', intent: 'Find the missing number in a counting sequence' }, 'The student confuses numerals of similar shape, writing 9 for 6 and 6 for 9.', null],
      ['number-tracer', 'nearby-teen-order', nt.numberTracerSequenceTeaching, { grade: '1', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 20', intent: 'Find the missing number in a counting sequence' }, 'Writes teen numbers with the digits in the wrong order, 41 for 14, because the ones are said first.', null],
      ['number-tracer', 'nearby-counting-back', nt.numberTracerSequenceTeaching, { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10', intent: 'Find the missing number in a counting sequence' }, 'Asked for the number that comes before a given number, the child gives the number after it; they cannot count back.', null],
      ['number-tracer', 'contradictory', nt.numberTracerSequenceTeaching, { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10', intent: 'Find the missing number in a counting sequence' }, 'The missing-number answers contradict each other and the record is unreliable; no consistent pattern can be inferred.', null],
      // ten-frame (scripts/probe-ten-frame-applicability.mjs)
      ['ten-frame', 'ksub-distilled', tf.tenFrameOperateTeaching, { grade: 'K', mode: 'operate', tier: 'medium' }, 'On take-away items the student answers with the starting number instead of how many are left.', one(tf.tenFrameOperateTeaching)],
      ['ten-frame', 'ksub-paraphrase-a', tf.tenFrameOperateTeaching, { grade: 'K', mode: 'operate', tier: 'medium' }, 'After counters are taken off the frame, the child still reports the size of the group before anything was removed.', one(tf.tenFrameOperateTeaching)],
      ['ten-frame', 'ksub-paraphrase-b', tf.tenFrameOperateTeaching, { grade: 'K', mode: 'operate', tier: 'medium' }, 'Asked how many are left, says the number the frame started with, as if nothing had been taken away.', one(tf.tenFrameOperateTeaching)],
      ['ten-frame', 'kadd-distilled', tf.tenFrameOperateTeaching, { grade: 'K', mode: 'operate', tier: 'medium' }, 'On addition items the student answers with the first number said instead of how many altogether.', one(tf.tenFrameOperateTeaching)],
      ['ten-frame', 'unrelated', tf.tenFrameOperateTeaching, { grade: 'K', mode: 'operate', tier: 'medium' }, UNRELATED, null],
      ['ten-frame', 'nearby-removed', tf.tenFrameOperateTeaching, { grade: 'K', mode: 'operate', tier: 'medium' }, 'On take-away items the student answers with the number taken away instead of how many are left.', null],
      ['ten-frame', 'nearby-one-less', tf.tenFrameOperateTeaching, { grade: 'K', mode: 'operate', tier: 'medium' }, 'On take-away items the student ends one short, answering one less than how many are left.', null],
      ['ten-frame', 'contradictory', tf.tenFrameOperateTeaching, { grade: 'K', mode: 'operate', tier: 'medium' }, 'The take-away answers contradict each other and the record is unreliable; no consistent pattern can be inferred.', null],
      // place-value / base-ten — AUTHORED FOR THIS BENCH in the probe convention (the artifacts hold outcomes, not texts)
      ['place-value*', 'bare-digit-worth', pv.placeValueTeaching, { grade: '3', mode: 'compare', tier: 'medium', topic: 'Place value to hundreds' }, 'The student gives the bare digit as its value regardless of which column it sits in, saying four for a 4 in the tens place.', 'contrast_digit_worth'],
      ['place-value*', 'name-for-value', pv.placeValueTeaching, { grade: '3', mode: 'compare', tier: 'medium', topic: 'Place value to hundreds' }, 'Asked what a highlighted digit is worth, the student names its place ("tens") instead of saying a number.', 'contrast_place_name_and_value'],
      ['place-value*', 'unrelated', pv.placeValueTeaching, { grade: '3', mode: 'compare', tier: 'medium', topic: 'Place value to hundreds' }, UNRELATED, null],
      ['place-value*', 'uncertain', pv.placeValueTeaching, { grade: '3', mode: 'compare', tier: 'medium', topic: 'Place value to hundreds' }, 'The transcripts are missing for two of three items and the remaining answer conflicts with the judge; no pattern about digit worth can be inferred.', null],
      ['base-ten*', 'count-for-worth', pv.baseTenTeaching, { grade: '4', mode: 'read_blocks', tier: 'medium', topic: 'Reading base-ten block mats' }, 'Asked what a column of blocks is worth altogether, the student says how many blocks there are instead of their total value.', one(pv.baseTenTeaching)],
      ['base-ten*', 'place-name', pv.baseTenTeaching, { grade: '4', mode: 'read_blocks', tier: 'medium', topic: 'Reading base-ten block mats' }, 'The student names the wrong position when asked which place a highlighted digit is in.', null],
    ].slice(0, LIMIT);
    console.error(`C: ${C_CASES.length} labeled planner cases`);
    // planLearningAdaptation never throws: a Gemini ApiError comes back as null,
    // indistinguishable from a real abstain. Count its 'planner-failed' warnings
    // and retry a null once — a real abstain is null twice, a blip returns a move.
    let plannerFailedWarns = 0;
    const origWarn = console.warn;
    console.warn = (...a) => { if (String(a[0]).includes('Learning adaptation')) plannerFailedWarns++; origWarn(...a); };
    const C = await pool(C_CASES, 3, async ([source, name, cap, task, observation, expected], i) => {
      const row = { source, name, activity: cap.activity, task, observation, expected, moves: cap.moves.map((m) => m.id) };
      try {
        const t0 = performance.now();
        let move = await planLearningAdaptation(cap, task, [{ id: 'obs-1', summary: observation }]);
        let retried = false;
        if (move === null) { retried = true; move = await planLearningAdaptation(cap, task, [{ id: 'obs-1', summary: observation }]); }
        row.planner = { move, retried, ms: Math.round(performance.now() - t0) };
      } catch (e) { row.planner = { error: String(e.message) }; }
      try {
        const criteria = { abstain: 'No offered move directly addresses this observation for THIS task: the observation is unrelated, describes a different skill, is contradictory or unreliable, or none of the moves would act on it.' };
        for (const m of cap.moves) criteria[m.id] = m.description;
        const r = await systemOne(
          { activity: cap.activity, taskDescription: cap.task, task, observation: { summary: observation, note: 'A tentative, task-local claim about this learner, not an established trait.' } },
          {
            move: { type: 'choice', instructions: 'Select ONE teaching adjustment for the CURRENT activity whose described mechanism directly addresses the observation, or abstain. Interpret the observation semantically, including paraphrases; do not match keywords or assume shared subject matter makes it applicable.', criteria },
            applies: { type: 'noul', instructions: 'Does at least one of the offered moves directly address the learner behaviour the observation describes, for this task?', criteria: { true: 'A move\'s mechanism targets exactly this behaviour', false: 'The observation is about something the moves do not act on' } },
            reliable: { type: 'noul', instructions: 'Does the observation describe reliable, consistent evidence rather than a record it itself calls contradictory, uncertain, or unreadable?', criteria: { true: 'A definite pattern is described', false: 'The observation says the evidence is unreliable, contradictory, or insufficient' } },
          },
        );
        const a = r.answers;
        row.typesafe = { move: a.move.choice === 'abstain' ? null : a.move.choice, pMove: a.move.probabilities, confidence: a.move.confidence, pApplies: a.applies.noul, pReliable: a.reliable.noul, ms: r.ms, tokens: r.usage.input_tokens };
      } catch (e) { row.typesafe = { error: String(e.message) }; }
      const pOk = row.planner?.error ? null : row.planner.move === expected;
      const tOk = row.typesafe?.error ? null : row.typesafe.move === expected;
      console.error(`[C ${i + 1}/${C_CASES.length}] ${(source + '/' + name).padEnd(40)} expect ${String(expected ?? 'abstain').padEnd(38)} planner ${String(row.planner?.error ? 'ERR' : row.planner.move ?? 'abstain').padEnd(38)} ${pOk ? '✓' : '✗'} typesafe ${String(row.typesafe?.error ? 'ERR' : row.typesafe.move ?? 'abstain').padEnd(38)} ${tOk ? '✓' : '✗'} conf ${row.typesafe?.confidence?.toFixed(2) ?? '-'}`);
      return row;
    });
    console.warn = origWarn;
    console.error(`C: planner API failures (warned): ${plannerFailedWarns}`);
    const ok = C.filter((r) => !r.planner?.error && !r.typesafe?.error);
    const pOk = (r) => r.planner.move === r.expected, tOk = (r) => r.typesafe.move === r.expected;
    const pos = ok.filter((r) => r.expected), neg = ok.filter((r) => !r.expected);
    // Gate view: among cases where the PLANNER selected a move (the ones that change generation), keep top X% by TypeSafe score.
    const acted = ok.filter((r) => r.planner.move);
    const summary = {
      n: ok.length, positives: pos.length, negatives: neg.length,
      planner: { accuracy: mean(ok.map(pOk)), moveRecall: mean(pos.map((r) => r.planner.move === r.expected)), abstainRecall: mean(neg.map((r) => r.planner.move === null)), msMean: mean(ok.map((r) => r.planner.ms)) },
      typesafe: { accuracy: mean(ok.map(tOk)), moveRecall: mean(pos.map((r) => r.typesafe.move === r.expected)), abstainRecall: mean(neg.map((r) => r.typesafe.move === null)), msMean: mean(ok.map((r) => r.typesafe.ms)), tokensMean: mean(ok.map((r) => r.typesafe.tokens)) },
      agree: mean(ok.map((r) => r.planner.move === r.typesafe.move)), agreePrecision: mean(ok.filter((r) => r.planner.move === r.typesafe.move).map(pOk)),
      plannerActed: acted.length,
      gateCurves: {
        typesafeConfidence: coverageCurve(acted, (r) => r.typesafe.confidence, pOk),
        typesafePApplies: coverageCurve(acted, (r) => r.typesafe.pApplies, pOk),
        typesafePMovePlanner: coverageCurve(acted, (r) => r.typesafe.pMove[r.planner.move] ?? 0, pOk),
      },
      agreementGate: { coverage: acted.length ? acted.filter((r) => r.typesafe.move === r.planner.move).length / acted.length : NaN, precision: mean(acted.filter((r) => r.typesafe.move === r.planner.move).map(pOk)) },
    };
    summary.plannerFailedWarns = plannerFailedWarns;
    summary.plannerRetried = ok.filter((r) => r.planner.retried).length;
    report.probes.C = { summary, rows: C };
    md.push(`## C. Planner applicability gate — ${ok.length} labeled cases (${pos.length} expect a move, ${neg.length} expect abstain)`, ``);
    md.push(`| arm | accuracy | move recall | abstain recall | ms |`, `|---|---|---|---|---|`);
    md.push(`| live planner (Gemini flash, thinking low) | ${pct(summary.planner.accuracy)} | ${pct(summary.planner.moveRecall)} | ${pct(summary.planner.abstainRecall)} | ${Math.round(summary.planner.msMean)} |`);
    md.push(`| TypeSafe Choice over moves + abstain | ${pct(summary.typesafe.accuracy)} | ${pct(summary.typesafe.moveRecall)} | ${pct(summary.typesafe.abstainRecall)} | ${Math.round(summary.typesafe.msMean)} |`);
    md.push(``, `Arms agree on ${pct(summary.agree)}; when they agree the decision is right ${pct(summary.agreePrecision)}. TypeSafe ${Math.round(summary.typesafe.tokensMean)} input tokens per case. Planner nulls retried once: ${summary.plannerRetried}; Gemini API failures warned during the run: ${summary.plannerFailedWarns}.`, ``);
    md.push(`Gate view — of the ${summary.plannerActed} cases where the planner SELECTED a move (those change what the student gets), keep the top X% by TypeSafe score; share where the planner's move was the labeled one:`, ``);
    md.push(`| gate score | keep 50% | 70% | 80% | 90% | 100% |`, `|---|---|---|---|---|---|`);
    md.push(curveRow('TypeSafe choice confidence', summary.gateCurves.typesafeConfidence));
    md.push(curveRow('TypeSafe P(applies)', summary.gateCurves.typesafePApplies));
    md.push(curveRow("TypeSafe P(planner's move)", summary.gateCurves.typesafePMovePlanner));
    md.push(``, `Agreement gate (act only when TypeSafe picks the same move): coverage ${pct(summary.agreementGate.coverage)} of planner selections, precision ${pct(summary.agreementGate.precision)}.`, ``);
    md.push(`### Per case`, ``, `| source | case | expected | planner | TypeSafe (conf, P applies, P reliable) |`, `|---|---|---|---|---|`);
    for (const r of ok) md.push(`| ${r.source} | ${r.name} | ${r.expected ?? 'abstain'} | ${r.planner.move ?? 'abstain'} ${pOk(r) ? '✓' : '✗'} | ${r.typesafe.move ?? 'abstain'} ${tOk(r) ? '✓' : '✗'} (${r.typesafe.confidence.toFixed(2)}, ${r.typesafe.pApplies.toFixed(2)}, ${r.typesafe.pReliable.toFixed(2)}) |`);
    md.push(``, `\\* place-value and base-ten observations were authored for this bench in the probe scripts' convention; every other case is copied from a probe script's pre-fixed table.`, ``);
  }
  // =========================================================================
  // D. Out-of-sample: the judged-evidence census (real generated data, real
  //    runner evidence, real distiller) with the HUMAN verdicts recorded in
  //    qa/misconception/judged-evidence-census-2026-09-14.md.
  // =========================================================================
  if (PROBES.has('D')) {
    const dir = resolve(root, '../artifacts/learning-applicability/judged-census/run2');
    const census = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    // Human column "Names it?" — yes = the hypothesis names the planted signature;
    // abstain-defensible = the human agreed nothing should be written;
    // capture-gap = the evidence itself lacks the fact, so abstaining is right.
    const HUMAN = {
      'base-ten-blocks': 'yes', 'di-deduction': 'yes', 'di-spoken-practice': 'yes', 'di-word-problem-setup': 'yes', 'di-worked-procedure': 'yes',
      'letter-sound-link': 'yes', 'letter-spotter': 'yes', 'oral-sentence-studio': 'yes', 'phoneme-explorer': 'yes', 'place-value-chart': 'yes',
      'rhyme-studio': 'yes', 'sorting-station': 'yes', 'syllable-clapper': 'yes', 'word-builder': 'yes',
      'compare-objects': 'abstain-defensible', 'sentence-analyzer': 'abstain-defensible',
      '3d-shape-explorer': 'capture-gap', 'decodable-reader': 'capture-gap', 'ordinal-line': 'capture-gap', 'picture-vocabulary': 'capture-gap',
    };
    const sources = Object.values(census.distill).filter((d) => d.gate && HUMAN[d.id]).map((d) => ({ ...d, evidence: JSON.parse(readFileSync(join(dir, `evidence-${d.id}.json`), 'utf8')).evidence, human: HUMAN[d.id] }));
    const hyps = sources.filter((s) => !s.distill.abstain && s.distill.misconceptionText);
    console.error(`D: ${sources.length} census sources (${hyps.length} with a hypothesis)`);
    const D = await pool(sources, 4, async (s, i) => {
      const row = { id: s.id, evalMode: s.evalMode, human: s.human, distillerAbstain: s.distill.abstain, distillerConfidence: s.distill.confidence ?? null, hypothesis: s.distill.misconceptionText || null, signature: s.signature };
      const ev = { challenge: s.evidence.challengeSummary, correctOutcome: s.evidence.expected, studentDid: s.evidence.observed, judgeFeedback: s.evidence.judgeFeedback ?? null, earlierAttempts: s.evidence.priorAttempts ?? [], phaseObservations: (s.evidence.phases ?? []).slice(0, 12), firstResponseScorePercent: s.evidence.firstResponseScore ?? null };
      try {
        const other = hyps.filter((h) => h.id !== s.id)[i % Math.max(1, hyps.length - 1)];
        const q = {
          consistent_rule: { type: 'noul', instructions: 'Do these observations of one student show ONE consistent wrong rule the student is applying — a misconception that predicts their next wrong answer — rather than a single slip, a guess, or errors that contradict each other?', criteria: { true: 'A repeated or clearly patterned error that one wrong rule explains', false: 'A one-off slip, a guess, contradictory errors, or evidence too thin to tell' } },
          evidence_complete: { type: 'noul', instructions: 'Does the recorded evidence contain what was actually shown or asked on each item (the stimulus), so that a wrong rule could be read from it? Answer no if the items name only the question type and not the content.', criteria: { true: 'Each item records the stimulus and the response', false: 'Items record a question label but not what was shown, so the pattern cannot be read' } },
        };
        if (row.hypothesis) {
          q.supported_own = { type: 'noul', instructions: 'Is the hypothesis `hypotheses.own` — a claim about the wrong rule this student applies — supported by the recorded evidence in `evidence`?', criteria: { true: 'The recorded attempts are what this wrong rule would produce', false: 'The hypothesis describes a different error or is not what the attempts show' } };
          q.supported_other = { type: 'noul', instructions: 'Is the hypothesis `hypotheses.other` — a claim about the wrong rule this student applies — supported by the recorded evidence in `evidence`?', criteria: { true: 'The recorded attempts are what this wrong rule would produce', false: 'The hypothesis describes a different error or is not what the attempts show' } };
          q.leaks_own = { type: 'noul', instructions: 'Does the text of `hypotheses.own` state the correct answer, the target value the student should have produced, or the correct rule?', criteria: { true: 'It reveals the answer or the correct outcome', false: 'It only describes the student\'s wrong rule' } };
        }
        const r = await systemOne({ evidence: ev, hypotheses: row.hypothesis ? { own: row.hypothesis, other: other?.distill.misconceptionText ?? '' } : undefined }, q);
        const a = r.answers;
        row.typesafe = { ms: r.ms, tokens: r.usage.input_tokens, pRule: a.consistent_rule.noul, pComplete: a.evidence_complete.noul, supportedOwn: a.supported_own?.noul ?? null, supportedOther: a.supported_other?.noul ?? null, leaksOwn: a.leaks_own?.noul ?? null, otherFrom: other?.id ?? null };
      } catch (e) { row.typesafe = { error: String(e.message) }; }
      console.error(`[D ${i + 1}/${sources.length}] ${s.id.padEnd(24)} human ${s.human.padEnd(18)} distiller ${s.distill.abstain ? 'abstain' : 'gen/' + s.distill.confidence} · P(rule) ${row.typesafe?.pRule?.toFixed(2) ?? 'ERR'} P(complete) ${row.typesafe?.pComplete?.toFixed(2) ?? '-'}${row.hypothesis ? ` supported own ${row.typesafe?.supportedOwn?.toFixed(2)} other ${row.typesafe?.supportedOther?.toFixed(2)} leaks ${row.typesafe?.leaksOwn?.toFixed(2)}` : ''}`);
      return row;
    });
    const ok = D.filter((r) => !r.typesafe?.error);
    const yes = ok.filter((r) => r.human === 'yes'), def = ok.filter((r) => r.human === 'abstain-defensible'), gap = ok.filter((r) => r.human === 'capture-gap');
    const summary = {
      n: ok.length,
      pRule: { yes: mean(yes.map((r) => r.typesafe.pRule)), defensibleAbstain: mean(def.map((r) => r.typesafe.pRule)), captureGap: mean(gap.map((r) => r.typesafe.pRule)) },
      pComplete: { yes: mean(yes.map((r) => r.typesafe.pComplete)), defensibleAbstain: mean(def.map((r) => r.typesafe.pComplete)), captureGap: mean(gap.map((r) => r.typesafe.pComplete)) },
      ruleAgreesWithDistiller: mean(ok.map((r) => (r.typesafe.pRule >= 0.5) === !r.distillerAbstain)),
      supportedOwn: mean(yes.map((r) => r.typesafe.supportedOwn)), supportedOther: mean(yes.map((r) => r.typesafe.supportedOther)),
      supportedOwnAbove: mean(yes.map((r) => r.typesafe.supportedOwn > r.typesafe.supportedOther)), leaksOwn: mean(yes.map((r) => r.typesafe.leaksOwn)),
      msMean: mean(ok.map((r) => r.typesafe.ms)),
    };
    report.probes.D = { summary, rows: D };
    md.push(`## D. Out-of-sample — judged-evidence census, ${ok.length} real packets with human verdicts (${yes.length} hypothesis confirmed, ${def.length} defensible abstain, ${gap.length} capture gap)`, ``);
    md.push(`| human verdict | n | TypeSafe mean P(rule) | mean P(evidence complete) |`, `|---|---|---|---|`);
    md.push(`| hypothesis names the planted signature | ${yes.length} | ${summary.pRule.yes.toFixed(2)} | ${summary.pComplete.yes.toFixed(2)} |`);
    md.push(`| abstain, defensible (no single rule in the fixture) | ${def.length} | ${summary.pRule.defensibleAbstain.toFixed(2)} | ${summary.pComplete.defensibleAbstain.toFixed(2)} |`);
    md.push(`| abstain, capture gap (stimulus missing from the record) | ${gap.length} | ${summary.pRule.captureGap.toFixed(2)} | ${summary.pComplete.captureGap.toFixed(2)} |`);
    md.push(``, `P(rule) ≥ 0.5 agrees with the distiller's abstain/write decision on ${pct(summary.ruleAgreesWithDistiller)}. On the ${yes.length} human-confirmed hypotheses: P(supported) own ${summary.supportedOwn.toFixed(2)} vs another source's hypothesis ${summary.supportedOther.toFixed(2)} (own above other ${pct(summary.supportedOwnAbove)}); P(leaks) ${summary.leaksOwn.toFixed(2)}. ${Math.round(summary.msMean)} ms per packet.`, ``);
    md.push(`| source | human | distiller | P(rule) | P(complete) | supported own / other | leaks |`, `|---|---|---|---|---|---|---|`);
    for (const r of ok) md.push(`| ${r.id} | ${r.human} | ${r.distillerAbstain ? 'abstain' : `gen (${r.distillerConfidence})`} | ${r.typesafe.pRule.toFixed(2)} | ${r.typesafe.pComplete.toFixed(2)} | ${r.hypothesis ? `${r.typesafe.supportedOwn.toFixed(2)} / ${r.typesafe.supportedOther.toFixed(2)}` : '—'} | ${r.hypothesis ? r.typesafe.leaksOwn.toFixed(2) : '—'} |`);
    md.push(``);
  }
} finally {
  await server.close();
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
mkdirSync(OUT, { recursive: true });
const text = md.join('\n');
writeFileSync(join(OUT, `misconception-bench-${stamp}.md`), text);
writeFileSync(join(OUT, `misconception-bench-${stamp}.json`), JSON.stringify(report, null, 2));
console.log(text);
console.log(`\nsaved ${join(OUT, `misconception-bench-${stamp}`)}.{md,json}`);
