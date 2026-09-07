import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const out = resolve(process.argv[2]);
const records = readdirSync(join(out, '.raw/records')).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(out, '.raw/records', f), 'utf8')));
const median = values => { const a = values.sort((a,b) => a-b); return a.length ? (a[Math.floor((a.length-1)/2)] + a[Math.ceil((a.length-1)/2)])/2 : null; };
const rows = records.map(r => {
  const calls = r.calls.filter(c => c.phase === 'planning' && c.method !== 'embedContent');
  const selected = r.manifest?.layout.filter(c => c.componentId !== 'curator-brief') ?? [];
  const bindings = new Set(r.discovery?.selected.map(c => `${c.componentId}::${c.mode ?? 'default'}`));
  return { caseId: r.caseId, rep: r.rep, arm: r.arm, status: r.status,
    planningMs: r.planningMs, planningWithoutIndexMs: r.planningMs === undefined ? null : r.planningMs - (r.discovery?.indexLatencyMs ?? 0),
    planningModelCalls: calls.length, planningInputTokens: calls.reduce((n,c) => n + (c.usage?.promptTokenCount ?? 0), 0),
    hopperTasks: r.discovery?.selected.length, hopperPrimitives: r.discovery ? new Set(r.discovery.selected.map(c => c.componentId)).size : undefined,
    missingBindings: r.arm === 'experimental' ? selected.filter(c => !bindings.has(`${c.componentId}::${c.config?.targetEvalMode ?? 'default'}`)).map(c => c.instanceId) : undefined,
    selected: selected.map(c => `${c.componentId}::${c.config?.targetEvalMode ?? 'default'}`),
  };
});
const metrics = Object.fromEntries(['production','experimental'].map(arm => {
  const rs = rows.filter(r => r.arm === arm && r.status === 'complete');
  return [arm, { complete: rs.length, medianPlanningWithoutIndexMs: median(rs.map(r => r.planningWithoutIndexMs)), medianPlanningModelCalls: median(rs.map(r => r.planningModelCalls)), medianPlanningInputTokens: median(rs.map(r => r.planningInputTokens)), invalidBindings: rs.reduce((n,r) => n + (r.missingBindings?.length ?? 0), 0) }];
}));
writeFileSync(join(out, 'pair-metrics.json'), JSON.stringify({ metrics, rows }, null, 2) + '\n');
console.log(JSON.stringify(metrics, null, 2));
