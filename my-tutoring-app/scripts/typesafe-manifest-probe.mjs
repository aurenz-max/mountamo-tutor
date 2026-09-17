#!/usr/bin/env node
/**
 * TypeSafe manifest-selection probe.
 *
 * QUESTION: can TypeSafe's System One model (Choice / Score / Noul over a state)
 * do the SELECTION half of manifest creation — pick primitives from the live
 * catalog and one eval mode per primitive — for a topic at a grade?
 *
 * The selection logic lives in
 *   src/components/lumina/service/manifest/typesafe/selectPrimitives.ts
 * (shared with the TypeSafe Select dev panel via /api/lumina/typesafe-select).
 * This script loads it through the Vite module runner, runs it on one topic,
 * and — with --compare — runs the CURRENT Gemini curator on the same topic so
 * the two selections sit side by side.
 *
 * Usage:
 *   node scripts/typesafe-manifest-probe.mjs --topic "Comparing fractions" --grade 4
 *        [--k 8] [--objectives '["obj text", ...]'] [--compare]
 *
 * Writes qa/typesafe/manifest-probe-<stamp>.json and .md.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
};
const TOPIC = opt('topic', 'Comparing fractions with unlike denominators');
const GRADE = opt('grade', '4');
const K = Number(opt('k', '8'));
const OBJECTIVES = opt('objectives', null) ? JSON.parse(opt('objectives')) : null;
const COMPARE = args.includes('--compare');

const envText = readFileSync('.env.local', 'utf8');
const readEnv = (key) => {
  if (process.env[key]) return process.env[key];
  const m = envText.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};
process.env.TYPESAFE_API_KEY = readEnv('TYPESAFE_API_KEY');
if (!process.env.TYPESAFE_API_KEY) { console.error('TYPESAFE_API_KEY missing (env or .env.local)'); process.exit(2); }
if (COMPARE) process.env.GEMINI_API_KEY = readEnv('GEMINI_API_KEY');

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { selectPrimitives } = await loader.import('/src/components/lumina/service/manifest/typesafe/selectPrimitives.ts');

  const result = await selectPrimitives({ topic: TOPIC, grade: GRADE, objectives: OBJECTIVES ?? undefined, k: K });

  // ---- Optional: what does the CURRENT Gemini curator pick? -------------------
  let gemini = null;
  if (COMPARE) {
    const t0 = performance.now();
    const { generateExhibitManifestStreaming } = await loader.import('/src/components/lumina/service/manifest/gemini-manifest.ts');
    const objectives = OBJECTIVES
      ? OBJECTIVES.map((text, i) => ({ id: `obj${i + 1}`, text, verb: 'understand', icon: 'book', grade: GRADE }))
      : undefined;
    const gradeLevel = /^k$/i.test(GRADE) ? 'kindergarten' : Number(GRADE) <= 5 ? 'elementary' : Number(GRADE) <= 8 ? 'middle-school' : 'high-school';
    const manifest = await generateExhibitManifestStreaming(TOPIC, gradeLevel, objectives, null, {});
    const picks = [];
    for (const block of manifest.objectiveBlocks ?? []) for (const comp of block.components ?? []) {
      picks.push({ objectiveId: block.objectiveId, componentId: comp.componentId, targetEvalMode: comp.config?.targetEvalMode ?? null });
    }
    if (manifest.finalAssessment) picks.push({ objectiveId: 'final', componentId: manifest.finalAssessment.componentId, targetEvalMode: null });
    const roleWinners = new Set(result.roles.map((r) => r.id));
    gemini = {
      ms: Math.round(performance.now() - t0),
      picks: picks.map((p) => ({
        ...p,
        typesafeRank: result.overall.find((r) => r.id === p.componentId)?.rank ?? null,
        typesafeRole: result.roles.find((r) => r.id === p.componentId)?.role ?? null,
        inRoleWinners: roleWinners.has(p.componentId),
      })),
    };
  }

  // ---- Report ----------------------------------------------------------------
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const md = [];
  md.push(`# TypeSafe manifest-selection probe`, ``, `topic: **${TOPIC}** · grade: **${GRADE}** · model: ${result.model}`, ``);
  if (OBJECTIVES) md.push(`objectives: ${OBJECTIVES.map((o) => `"${o}"`).join('; ')}`, ``);
  md.push(`Call 1 (skim ${result.catalogSize} primitives, 5 choices): ${result.skim.ms} ms, ${result.skim.usage.input_tokens} in / ${result.skim.usage.output_tokens} out.`);
  md.push(`Call 2 (verify ${result.shortlist.length}): ${result.verify.ms} ms, ${result.verify.usage.input_tokens} in / ${result.verify.usage.output_tokens} out.`, ``);
  md.push(`subject: ${result.subject.choice} (confidence ${result.subject.confidence.toFixed(2)}) · informational: ${result.informational.toFixed(2)}`, ``);
  md.push(`## Block skeleton (best per phase role)`, ``, `| role | primitive | p | conf | runners-up |`, `|---|---|---|---|---|`);
  for (const r of result.roles) md.push(`| ${r.role} | ${r.id} | ${r.p.toFixed(3)} | ${r.confidence.toFixed(2)} | ${r.runnersUp.map((u) => `${u.id} ${u.p.toFixed(3)}`).join(', ')} |`);
  md.push(``, `## Verified shortlist`, ``, `| fit | id | skim rank | skim p | role | mode (of N) | mode conf |`, `|---|---|---|---|---|---|---|`);
  for (const s of result.shortlist) md.push(`| ${s.fit.toFixed(2)} | ${s.id} | ${s.skimRank ?? 'role'} | ${s.skimP.toFixed(3)} | ${s.role} | ${s.mode ?? '-'} (${s.modeCandidates}) | ${s.modeConfidence?.toFixed(2) ?? '-'} |`);
  md.push(``, `Overall skim top ${result.overall.length}: ${result.overall.map((r) => `${r.id} ${r.p.toFixed(3)}`).join(', ')}`);
  if (gemini) {
    md.push(``, `## Current Gemini curator on the same topic (${gemini.ms} ms)`, ``, `| objective | componentId | targetEvalMode | TypeSafe skim rank | TypeSafe role winner |`, `|---|---|---|---|---|`);
    for (const p of gemini.picks) md.push(`| ${p.objectiveId} | ${p.componentId} | ${p.targetEvalMode ?? '-'} | ${p.typesafeRank ?? 'unranked'} | ${p.typesafeRole ?? '-'} |`);
  }
  const text = md.join('\n');
  mkdirSync('qa/typesafe', { recursive: true });
  writeFileSync(`qa/typesafe/manifest-probe-${stamp}.json`, JSON.stringify({ ...result, gemini }, null, 2));
  writeFileSync(`qa/typesafe/manifest-probe-${stamp}.md`, text);
  console.log(text);
  console.log(`\nsaved qa/typesafe/manifest-probe-${stamp}.{json,md}`);
} finally {
  await server.close();
}
