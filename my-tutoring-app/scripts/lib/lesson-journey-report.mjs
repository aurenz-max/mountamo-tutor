/**
 * Standalone evidence viewer for a lesson-journey run.
 *
 * `journeyModel` distils the run (+ its packages and the per-lesson exposure
 * record) into the compact shape the page renders; `journeyHtml` embeds that
 * model into `lesson-journey-report.html`. All package content is rendered as
 * text by the page, never as HTML.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), 'lesson-journey-report.html');
const ROUTE = { knowledge: 'k', echo: 'e', guess: 'g', inaccessible: 'x' };
const round = (n, d = 3) => (typeof n === 'number' ? Number(n.toFixed(d)) : n);
const itemCount = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 0;
  for (const k of ['challenges', 'words', 'problems', 'cards', 'concepts', 'items', 'steps']) if (Array.isArray(data[k])) return data[k].length;
  return 0;
};

/**
 * @param report   the run report (scenario, profiles, runs, provenance, production?)
 * @param inputs   [{ contract, package }] in scenario order
 * @param exposure { [lessonId]: { events (with `independent` + `inScope`), findings, unknowns } }
 * @param producible letters a child may be asked to PRODUCE (the shared continuant gate)
 * @param runFile  basename of the JSON ledger this page cites
 */
export function journeyModel(report, inputs, exposure, producible, runFile) {
  const { scenario } = report;
  const lessons = [];
  scenario.lessons.forEach((contract, li) => {
    const pkg = inputs[li].package;
    const comps = new Map(pkg.components.map((c) => [c.instanceId, c]));
    const ref = exposure[contract.id];
    const events = ref.events;
    const unknownBy = new Map(ref.unknowns.map((u) => [u.instanceId, u]));
    const exposureBy = new Map((ref.exposures ?? []).map((u) => [u.instanceId, u]));
    const findingsBy = new Map();
    for (const f of ref.findings) findingsBy.set(f.instanceId, [...(findingsBy.get(f.instanceId) ?? []), f]);
    const blocks = (pkg.manifest.layout ?? []).map((b) => {
      const cfg = b.config ?? {};
      const data = comps.get(b.instanceId)?.data;
      const ev = events.filter((e) => e.instanceId === b.instanceId);
      let status;
      if (b.componentId === 'curator-brief' || b.componentId === 'take-home-activity') status = 'skipped';
      else if ((findingsBy.get(b.instanceId) ?? []).some((f) => f.code === 'MISSING_PAYLOAD')) status = 'missing';
      else if (unknownBy.has(b.instanceId)) status = unknownBy.get(b.instanceId).code === 'UNSUPPORTED_CONTENT' ? 'unsupported' : 'unknown';
      else if (exposureBy.has(b.instanceId)) status = 'exposure';
      else status = ev.length ? 'events' : 'skipped';
      const tiers = [...new Set(((data && Array.isArray(data.challenges)) ? data.challenges : []).map((c) => c && c.supportTier).filter(Boolean))].sort();
      return { id: b.instanceId, componentId: b.componentId, mode: cfg.targetEvalMode ?? null, difficulty: cfg.difficulty ?? null, tiers,
        title: b.title ?? null, objective: b.objectiveIds?.[0] ?? null, final: !!b.isFinalAssessment, items: itemCount(data), status,
        note: unknownBy.get(b.instanceId)?.note ?? exposureBy.get(b.instanceId)?.note ?? null, capabilities: [...new Set(ev.map((e) => e.capability))].sort() };
    });
    const coverage = contract.targets.map((t) => {
      const rows = events.filter((e) => e.capability === t.capability && (t.target === '*' || e.target === t.target));
      const modeled = rows.filter((e) => e.modeled).length;
      const independent = rows.filter((e) => e.independent).length;
      const gap = !rows.length
        ? (t.capability === 'sound-production' && !producible.includes(t.target) ? 'NO_SURFACE' : 'NOT_SELECTED')
        : independent === 0 ? 'NEVER_COLD' : independent < scenario.minIndependentItems ? 'THIN' : 'OK';
      return { key: `${t.capability}:${t.target}`, capability: t.capability, target: t.target, delivered: rows.length, modeled,
        cold: rows.length - modeled, independent, blocks: [...new Set(rows.map((e) => e.instanceId))], gap };
    });
    const targetCaps = new Set(contract.targets.map((t) => t.capability));
    const previous = lessons.at(-1);
    lessons.push({
      id: contract.id, title: contract.topic.split('\n')[0].trim(), grade: contract.gradeLevel, packageId: pkg.id, requires: contract.requires,
      allowed: contract.allowedGraphemes, newLetters: contract.targets.map((t) => t.target).filter((l) => !(previous?.allowed ?? []).includes(l)),
      objectives: (pkg.curatorBrief?.objectives ?? []).map((o) => ({ id: o.id, text: o.text ?? '' })),
      blocks,
      events: events.map((e) => ({ block: e.instanceId, item: e.itemId, component: e.componentId, mode: e.evalMode, cap: e.capability, target: e.target,
        cue: e.cue, modality: e.modality, modeled: e.modeled, guided: e.guided, independent: e.independent, inScope: e.inScope, relation: e.explainsRelation, source: e.source })),
      coverage,
      offScope: ref.findings.filter((f) => f.code === 'OUT_OF_SCOPE').map((f) => ({ block: f.instanceId, source: f.source ?? null, note: f.note })),
      otherFindings: ref.findings.filter((f) => f.code !== 'OUT_OF_SCOPE').map((f) => ({ code: f.code, block: f.instanceId, note: f.note })),
      // A block is off-target only when NOTHING it asks is a target capability.
      offTarget: blocks.filter((b) => b.status === 'events' && b.capabilities.length && !b.capabilities.some((c) => targetCaps.has(c))).map((b) => b.id),
      probes: contract.probes.map((p) => ({ id: p.id, target: p.target, cap: p.capability })),
      unknownBlocks: ref.unknowns.map((u) => ({ block: u.instanceId, component: blocks.find((b) => b.id === u.instanceId)?.componentId ?? null, note: u.note })),
    });
  });

  const prodRuns = new Map((report.production?.runs ?? []).map((p) => [`${p.profile}:${p.seed}`, p]));
  const runs = report.runs.map((r) => {
    const pr = prodRuns.get(`${r.profile}:${r.seed}`);
    return {
      profile: r.profile, seed: r.seed, parity: pr ? (pr.rollupParity?.match ?? null) : null,
      lessons: r.lessons.map((l, li) => {
        const after = new Map(l.after.map((p) => [p.id, p]));
        const delayed = new Map(l.delayed.map((p) => [p.id, p]));
        let production = null;
        const t = pr?.timeline.find((x) => x.lessonId === l.lessonId);
        if (t) {
          const subskill = scenario.lessons[li].objectiveScope?.obj1?.subskillId;
          const lc = t.lifecycles.find((x) => x.subskill_id === subskill) ?? t.lifecycles[0] ?? null;
          const top = t.nextTargets?.objectives?.[0] ?? null;
          production = {
            submissions: t.submissions.map((s) => [s.instanceId, s.score, s.parts, s.independentParts, s.echoParts, s.evalMode]),
            skipped: t.skipped ?? [],
            lifecycle: lc && { gate: lc.current_gate, passes: lc.passes, fails: lc.fails, theta: lc.theta_at_gate_entry ?? null, sigma: lc.sigma_at_gate_entry ?? null,
              threshold: lc.gate_theta_threshold ?? null, retention: lc.retention_state ?? null, stability: lc.stability ?? null, evidence: lc.evidence_n ?? null,
              history: (lc.gate_history ?? []).map((h) => [h.gate, h.score, h.theta ?? null, h.sigma ?? null]) },
            next: top && { kind: top.kind ?? null, pCorrect: top.pCorrect ?? null, reason: top.reason ?? null, verb: top.verb ?? null,
              subskill: String(top.subskillId ?? '').slice(-12), sameSubskill: top.subskillId === subskill },
            pools: t.nextTargets?.pool_sizes ?? null,
            supportedSuccess: t.supportedSuccess ?? [], unsupported: (t.unsupportedConfirmation ?? []).length, falseMastery: (t.falseMastery ?? []).length,
          };
        }
        return {
          id: l.lessonId, decision: l.decision, reasons: [...new Set(l.reasons)], independent: l.independentItems, waived: !!l.prerequisitesWaived,
          attempts: l.attempts.map((a) => [ROUTE[a.responseRoute], +a.firstCorrect, +a.finalCorrect, round(a.before), round(a.after), +a.independent, +a.correction]),
          knowledge: Object.fromEntries(Object.entries(l.knowledge).map(([k, v]) => [k, round(v)])),
          probes: l.before.map((p) => { const a = after.get(p.id), d = delayed.get(p.id); return [p.id, +p.correct, round(p.probability),
            a ? +a.correct : null, a ? round(a.probability) : null, d ? +d.correct : null, d ? round(d.probability) : null]; }),
          production,
        };
      }),
    };
  });

  const stamp = runFile.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})/);
  return {
    meta: { scenario: scenario.id, curriculum: scenario.curriculumSource, model: report.model, claim: report.claim, gitSha: report.provenance.gitSha ?? null,
      runFile, generated: stamp ? `${stamp[1]} ${stamp[2]}:${stamp[3]}` : runFile, minIndependent: scenario.minIndependentItems, minAccuracy: scenario.minProbeAccuracy,
      retentionDays: scenario.retentionDays, seeds: scenario.seeds, producible: [...producible].sort(), productionScope: report.production?.runs?.[0]?.scope ?? null,
      waivePrerequisites: !!report.waivePrerequisites },
    profiles: report.profiles.map((p) => ({ id: p.id, learningRate: p.learningRate, decay: p.decay, echo: p.echo, slip: p.slip, hearsTutor: p.hearsTutor, canSpeak: p.canSpeak, reader: p.reader })),
    lessons, runs,
  };
}

const titleFor = (scenarioId) => scenarioId.split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') + ' Journeys';

export function journeyHtml(model) {
  const data = JSON.stringify(model).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return readFileSync(TEMPLATE, 'utf8')
    .replaceAll('__TITLE__', titleFor(model.meta.scenario).replaceAll('<', '&lt;'))
    .replaceAll('__CURRICULUM__', model.meta.curriculum.split(';')[0].replaceAll('<', '&lt;'))
    .replace('__DATA__', () => data);
}

export const reportBasename = (jsonFile) => basename(jsonFile);
