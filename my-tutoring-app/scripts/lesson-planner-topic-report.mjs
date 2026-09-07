import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = 'qa/lesson-planner/topic-sweep';
const rows = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'summary.json').map(file => {
  const p = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const r = p.stages?.find(s => s.name === 'retrieval')?.output;
  return {
    file, topic: p.input.caseId, arm: p.pipeline, status: p.status, latencyMs: p.latencyMs,
    modelVersions: [...new Set(p.stages?.filter(s => s.modelVersion).map(s => s.modelVersion))],
    fixtureHash: p.provenance.fixtureHash, candidateHash: p.provenance.candidateHash,
    promptChars: p.stages?.filter(s => s.prompt).map(s => ({ stage: s.name, chars: s.promptChars, ms: s.latencyMs })),
    studentMinutes: p.validation?.studentMinutes,
    sequence: p.plan?.experiences?.map(e => `${e.componentId}${e.mode ? '/' + e.mode : ''}`) ?? [],
    contributions: p.plan?.contributionDecisions ?? [],
    unmetEvidence: p.plan?.unmetRequirements ?? [],
    errors: p.validation?.errors ?? (p.error ? [p.error] : []),
    retainedTasks: r?.retainedTasks, universeTasks: r?.universeTasks,
    retrieval: r?.jobs.map(j => ({ job: j.contributionId, matches: j.matches.map(m => `${m.componentId}/${m.mode}`) })),
  };
}).sort((a,b) => a.topic.localeCompare(b.topic) || a.arm.localeCompare(b.arm));
writeFileSync(join(dir, 'summary.json'), JSON.stringify(rows, null, 2) + '\n');
const lines = ['# Cross-topic planner sweep', '',
  'One fresh run per arm/topic. Kindergarten, 15-minute target, entire live catalog. These are planning traces, not generated/playable lessons or verified assessment coverage. Single = experimental mode-card planner, not the production manifest generator. Staged adds interpretation, lexical retrieval, proposal and composition; this comparison therefore tests a bundle, not staging alone.', '',
  '| Topic | Arm | Status | Seconds | Est. minutes | Sequence |', '|---|---|---|---:|---:|---|'];
for (const r of rows) lines.push(`| ${r.topic} | ${r.arm} | ${r.status} | ${r.latencyMs ? (r.latencyMs/1000).toFixed(1) : '—'} | ${r.studentMinutes ?? '—'} | ${r.sequence.join(' → ')} |`);
for (const topic of [...new Set(rows.map(r => r.topic))]) {
  const pair = rows.filter(r => r.topic === topic);
  lines.push('', `## ${topic}`, '', `Fixture and candidate hashes match across arms: ${new Set(pair.map(r => r.fixtureHash)).size === 1 && new Set(pair.map(r => r.candidateHash)).size === 1}.`);
  for (const r of pair) {
    lines.push('', `### ${r.arm}`, '', `[Plan](${r.file.replace(/\.json$/, '.md')}) · [Full trace](${r.file})`, '',
      ...r.contributions.map(c => `- ${c.contributionId}: **${c.status}** — ${c.reason}`), '',
      ...r.unmetEvidence.map(e => `- Evidence gap: ${e.requirementId} — ${e.reason}`));
    if (r.retainedTasks) lines.push('', `Retrieval: ${r.universeTasks} → ${r.retainedTasks} tasks.`, ...r.retrieval.map(j => `- ${j.job}: ${j.matches.join(', ')}`));
    if (r.errors.length) lines.push('', `Errors: ${r.errors.join('; ')}`);
  }
}
writeFileSync(join(dir, 'RESULTS.md'), lines.join('\n') + '\n');
console.log(JSON.stringify(rows.map(({topic,arm,status,latencyMs,sequence,retainedTasks}) => ({topic,arm,status,latencyMs,sequence,retainedTasks})), null, 2));
