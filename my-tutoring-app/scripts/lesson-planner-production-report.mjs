import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const out = resolve(process.argv[2] ?? 'qa/lesson-planner/production-ab/first-controlled-run');
const protocol = JSON.parse(readFileSync(join(out, 'protocol.json'), 'utf8'));
const designNote = protocol.sourceHashes['scripts/lib/lesson-planner-pairs.mjs'] ? 'Both arms use production lesson instructions and model settings. Experimental retrieves primitive-mode pairs and skips the separate lesson mode resolver.' : 'Experimental targets 15 minutes; production has no equivalent duration parameter.';
const rows = readdirSync(join(out, '.raw/records')).filter(f => f.endsWith('.json')).map(f => {
  const r = JSON.parse(readFileSync(join(out, '.raw/records', f), 'utf8'));
  const score = r.scores;
  return { caseId: r.caseId, rep: r.rep, arm: r.arm, blindId: r.blindId, status: r.status, phase: r.phase, error: r.error,
    fixtureHash: r.fixtureHash, planningMs: r.planningMs, hydrationMs: r.hydrationMs, generationMs: r.generationMs,
    withSharedBriefMs: r.withSharedBriefMs, blocks: r.components?.length,
    failedBlocks: r.components?.filter(c => c.status !== 'ok').map(c => ({ id: c.componentId, error: c.error })),
    selected: r.manifest?.layout?.map(c => `${c.componentId}${c.config?.targetEvalMode ? '/' + c.config.targetEvalMode : ''}`),
    rawCoverage: r.coverage, scores: score, normalizedCoverage: r.normalizedCoverage,
    studentBlocks: score?.evidence?.streamBlocks, catalogMinutes: score?.evidence?.minutes,
    modelVersions: [...new Set(r.calls.filter(c => c.phase === 'planning' && c.modelVersion).map(c => c.modelVersion))],
    generationCallCount: r.calls.filter(c => ['planning', 'hydration'].includes(c.phase)).length,
    objectiveIdMismatch: r.manifest?.objectiveBlocks.some(b => b.objectiveId !== r.objective.id),
    planValidation: r.planValidation, packagePath: r.packagePath,
    scopeSamples: r.components?.filter(c => ['ordinal-line','base-ten-blocks','ten-frame','number-bond','equation-builder'].includes(c.componentId)).map(c => ({
      instanceId: c.instanceId, componentId: c.componentId, mode: c.generatorInput?.config?.targetEvalMode,
      objectiveText: c.generatorInput?.config?.objectiveText, intent: c.generatorInput?.config?.intent,
      gradeBand: c.data?.gradeBand, maxPosition: c.data?.maxPosition, frameMode: c.data?.mode,
      targets: c.data?.challenges?.map(ch => ({ type: ch.type ?? ch.challengeType, targetNumber: ch.targetNumber, targetCount: ch.targetCount, targetPosition: ch.targetPosition, whole: ch.whole, instruction: ch.instruction })),
    })),
  };
}).sort((a,b) => a.caseId.localeCompare(b.caseId) || a.rep-b.rep || a.arm.localeCompare(b.arm));
for (const row of rows) {
  const other = rows.find(r => r.caseId === row.caseId && r.rep === row.rep && r.arm !== row.arm);
  if (other && other.fixtureHash !== row.fixtureHash) throw new Error(`Fixture mismatch: ${row.caseId}/${row.rep}`);
}
const median = xs => { const s = xs.filter(Number.isFinite).sort((a,b)=>a-b); return s.length ? (s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2 : null; };
const metrics = Object.fromEntries(['production','experimental'].map(arm => {
  const rs = rows.filter(r => r.arm === arm);
  const validCoverage = rs.filter(r => r.normalizedCoverage && r.normalizedCoverage.status !== 'error');
  return [arm, { runs: rs.length, complete: rs.filter(r => r.status === 'complete').length,
    medianPlanningMs: median(rs.map(r=>r.planningMs)), medianGenerationMs: median(rs.map(r=>r.generationMs)),
    medianStudentBlocks: median(rs.map(r=>r.studentBlocks)), medianCatalogMinutes: median(rs.map(r=>r.catalogMinutes)),
    blockFailures: rs.reduce((n,r)=>n+(r.failedBlocks?.length??0),0), rawJudgeErrors: rs.filter(r=>r.rawCoverage?.status==='error').length,
    rawFullyCovered: rs.filter(r=>r.rawCoverage?.meta.objectivesFullyCovered === r.rawCoverage?.meta.objectiveCount && r.rawCoverage?.status !== 'error' && r.rawCoverage).length,
    normalizedJudged: validCoverage.length, normalizedFullyCovered: validCoverage.filter(r=>r.normalizedCoverage.objectives.every(o=>o.category==='ASSESSED_SUFFICIENTLY')).length,
    objectiveIdMismatches: rs.filter(r=>r.objectiveIdMismatch).length }];
}));
writeFileSync(join(out,'summary.json'), JSON.stringify(rows,null,2)+'\n');
writeFileSync(join(out,'metrics.json'), JSON.stringify(metrics,null,2)+'\n');
writeFileSync(join(out,'RESULTS.md'), `# Production vs experimental planner\n\nTwo fresh builds per arm/objective; same fixed curriculum objective, K grade, frozen brief and hydration functions. ${designNote} Coverage is provisional automated judgment, not human validation.\n\n| Objective | Repeat | Arm | Planning ms | Full generation ms | Student blocks | Catalog minutes | Raw coverage | Common-objective coverage |\n|---|---|---|---|---|---|---|---|---|\n${rows.map(r=>`| ${r.caseId} | ${r.rep} | ${r.arm} | ${r.planningMs} | ${r.generationMs} | ${r.studentBlocks} | ${r.catalogMinutes} | ${r.rawCoverage?.objectives.map(o=>o.category).join(', ')??r.status} | ${r.normalizedCoverage?.objectives.map(o=>o.category).join(', ')??'pending'} |`).join('\n')}\n`);
mkdirSync(join(out,'.raw/blind-review'),{recursive:true});
const blinded = rows.filter(r=>r.packagePath).sort((a,b)=>a.blindId.localeCompare(b.blindId));
for (const r of blinded) {
  const pkg = JSON.parse(readFileSync(resolve(r.packagePath),'utf8'));
  delete pkg.coverage; pkg.scores=null; pkg.human=null;
  writeFileSync(join(out,'.raw/blind-review',`${r.blindId}.json`),JSON.stringify(pkg,null,2)+'\n');
}
writeFileSync(join(out,'BLIND-REVIEW.md'),`# Masked playback set\n\nArm labels and stored machine ratings are withheld. Activity structure and original instance IDs remain intact for reliable replay. Open Dev > Lesson Bench, drop each package, play and rate, then export the labeled JSON. These packages have not received human playback ratings. Avoid opening schedule.json or the comparison report until rating.\n\n${blinded.map((r,i)=>`${i+1}. [${r.blindId}](blind-review/${r.blindId}.json) — ${r.caseId}`).join('\n')}\n`);
console.log(JSON.stringify(metrics,null,2));
