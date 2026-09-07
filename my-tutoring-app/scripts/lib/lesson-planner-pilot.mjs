import { createHash } from 'node:crypto';

export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

export function buildInput(fixture, catalog, catalogGroups = {}) {
  const groupIds = (fixture.candidateGroups ?? []).flatMap(group => {
    if (!catalogGroups[group]) throw new Error(`Unknown catalog group: ${group}`);
    return catalogGroups[group].map(c => c.id);
  });
  const selectedIds = [...new Set([...groupIds, ...fixture.candidateIds])];
  const ids = new Set();
  if (new Set(fixture.candidateIds).size !== fixture.candidateIds.length) throw new Error('Duplicate explicit candidate');
  const candidates = selectedIds.map(id => {
    if (ids.has(id)) throw new Error(`Duplicate candidate: ${id}`);
    ids.add(id);
    const def = catalog.find(c => c.id === id);
    if (!def) throw new Error(`Unknown catalog candidate: ${id}`);
    return {
      componentId: id, description: def.description, constraints: def.constraints ?? null,
      affordances: def.affordances ?? null,
      modes: (def.evalModes ?? []).map(m => ({ key: m.evalMode, description: m.description ?? '', affordances: m.affordances ?? null })),
      capabilityNotes: (fixture.capabilityNotes ?? []).filter(n => n.componentId === id),
    };
  });
  for (const note of fixture.capabilityNotes ?? []) {
    const candidate = candidates.find(c => c.componentId === note.componentId);
    if (!candidate || (note.mode && !candidate.modes.some(m => m.key === note.mode))) {
      throw new Error(`Stale capability note: ${note.componentId}/${note.mode ?? ''}`);
    }
  }
  const { candidateIds, capabilityNotes, ...caseInput } = fixture;
  return { ...caseInput, candidateDiscovery: { groups: fixture.candidateGroups ?? [], explicitIds: candidateIds, includedIds: selectedIds, excludedIds: catalog.filter(c => !ids.has(c.id)).map(c => c.id) }, candidates };
}

const string = { type: 'STRING' };
const strings = { type: 'ARRAY', items: string };
export const responseSchema = {
  type: 'OBJECT', required: ['objectiveId', 'title', 'experiences', 'contributionDecisions', 'unmetRequirements', 'rejectedCandidates'],
  properties: {
    objectiveId: string, title: string,
    contributionDecisions: {
      type: 'ARRAY', items: {
        type: 'OBJECT', required: ['contributionId', 'status', 'experienceIds', 'reason'],
        properties: { contributionId: string, status: { type: 'STRING', enum: ['provided', 'merged', 'partial', 'omitted'] }, experienceIds: strings, reason: string },
      },
    },
    experiences: {
      type: 'ARRAY', items: {
        type: 'OBJECT',
        required: ['id', 'componentId', 'mode', 'audience', 'contributions', 'distinctContribution', 'learnerAction', 'intent', 'minutes', 'evidenceTargets', 'evidenceLimits', 'support'],
        properties: {
          id: string, componentId: string,
          mode: { type: 'STRING', description: 'Exact catalog mode key; empty string ONLY if the candidate has no modes.' },
          audience: { type: 'STRING', enum: ['student', 'caregiver'] },
          contributions: strings, distinctContribution: string, learnerAction: string, intent: string,
          minutes: { type: 'NUMBER' }, evidenceTargets: strings, evidenceLimits: strings, support: string,
        },
      },
    },
    unmetRequirements: {
      type: 'ARRAY', items: {
        type: 'OBJECT', required: ['requirementId', 'reason'],
        properties: { requirementId: string, reason: string },
      },
    },
    rejectedCandidates: {
      type: 'ARRAY', items: {
        type: 'OBJECT', required: ['componentId', 'reason'],
        properties: { componentId: string, reason: string },
      },
    },
  },
};

// Lossless presentation ablation: no new capability claims or filtering.
// Mode descriptions become primary task cards; headlines remain supporting context.
export function buildPresentation(input, representation = 'descriptions') {
  if (representation === 'descriptions') return input;
  if (representation !== 'mode-cards') throw new Error(`Unknown representation: ${representation}`);
  const { candidates, ...context } = input;
  return {
    ...context,
    selectableTaskCards: candidates.flatMap(c => (c.modes.length ? c.modes : [{ key: '', description: null, affordances: null }]).map(m => ({
      componentId: c.componentId,
      mode: m.key,
      learnerTask: m.description,
      taskBasis: m.key ? 'catalog eval-mode description; not runtime-verified' : 'No declared eval mode; consult shared primitive description',
      modeAffordanceOverrides: m.affordances,
      sharedContextRef: c.componentId,
    }))),
    sharedPrimitiveContext: candidates.map(({ modes, ...shared }) => shared),
  };
}

export function buildPrompt(input, representation = 'descriptions') {
  return `Design ONE complete lesson using the supplied objective, experience requirements, and catalog candidates.
Plan a complete student session with a meaningful opening, explanation/modeling, exploration, practice, application, and a closing independent assessment. Use the supplied definitions to decide what each contribution means.
Optimize for instructional completeness, a coherent learning progression, honest evidence, and a realistic time budget. Component count is an outcome: neither fewer blocks nor more distinct primitive IDs is a goal.
Choose primitive AND exact mode together. Instruction and context earn their place without collecting assessment evidence.
Consider general teaching, fluency, and assessment tools alongside specialists. A specialist's topic match does not mean it supplies the whole lesson. Match the actual mode: cue recognition, recall, and short contextual application can contribute practice when appropriate; they do not substitute for explanation or investigation. Generic candidates are options, not mandatory selections.
For EVERY required contribution return a contributionDecision: provided, merged (explain how both experiences' jobs really happen in one component), partial, or omitted (explain why). Bind decisions to experience IDs. A role label is not evidence that the learner does that work.
Match the supplied contribution definitions: observing a prepared example is not necessarily learner-controlled investigation, and fresh pictures alone do not establish situational application. Report partial contributions where appropriate for this objective.
Use concrete generator intents: describe the scenario, what the child encounters and does, and the relationship being taught, not just 'teach comparison'. Make the session feel connected without requiring every activity to repeat one theme.
Budget from plausible activity duration and item workload; do not squeeze a full session primitive into a token minute to fit more blocks. Estimates remain estimates. If completeness needs more time, report the budget tradeoff rather than hiding it.
Use only supplied candidates and their actual capabilities. Missing metadata means unknown, not incapable. Source-inspected notes constrain claims; catalog declarations alone are not runtime verification.
Treat descriptions of what the generator should create as requests, not proof it can create new interactions or assessment behavior.
Preserve the exact objective ID. Contributions and evidenceTargets must use the supplied identifiers.
An evidenceTarget names an intended opportunity, NOT confirmed coverage. State the partial evidence and limitations precisely.
Report unsupported or partially supported evidence requirements in unmetRequirements even when a partial activity targets them. contributionDecisions is the authoritative record for instructional gaps; do not duplicate those explanations in unmetRequirements.
Do not weaken the objective, invent modes, use caregiver work as on-screen teaching/evidence, or assume a generic visual implements a judged manipulative.
Order prerequisites before dependent work. Include practice/application with fresh examples and distinguish independent from supported responses.
Minutes are estimates of the child's experience; caregiver extensions are outside the on-screen budget. Describe support in the support field.
Explain meaningful rejected alternatives. Return the schema only.

INPUT:
${JSON.stringify(buildPresentation(input, representation), null, 2)}`;
}

// These are structural checks, NOT a second coverage judge.
export function validatePlan(plan, input) {
  const errors = [], warnings = [];
  if (plan?.objectiveId !== input.objective.id) errors.push('Objective ID changed');
  if (!Array.isArray(plan?.experiences) || !plan.experiences.length) errors.push('No experiences');
  const candidates = new Map(input.candidates.map(c => [c.componentId, c]));
  const requirements = new Set([...input.requiredContributions, ...input.targetEvidence]);
  const declared = new Set(), gaps = new Set(), ids = new Set();
  let studentMinutes = 0;
  for (const e of Array.isArray(plan?.experiences) ? plan.experiences : []) {
    if (!e || typeof e !== 'object') { errors.push('Invalid experience'); continue; }
    if (!e.id || ids.has(e.id)) errors.push(`Missing/duplicate experience ID: ${e.id}`);
    ids.add(e.id);
    const c = candidates.get(e.componentId);
    if (!c) errors.push(`Unknown candidate: ${e.componentId}`);
    else {
      if (c.modes.length ? !c.modes.some(m => m.key === e.mode) : e.mode !== '') errors.push(`Invalid mode: ${e.componentId}/${e.mode}`);
      const audience = c.affordances?.audience ?? 'student';
      if (e.audience !== audience) errors.push(`Audience differs from catalog: ${e.id}`);
    }
    for (const field of ['distinctContribution', 'learnerAction', 'intent', 'support']) {
      if (typeof e[field] !== 'string' || !e[field].trim()) errors.push(`Missing ${field}: ${e.id}`);
    }
    if (!Array.isArray(e.evidenceLimits)) errors.push(`Missing evidenceLimits: ${e.id}`);
    for (const [field, allowed] of [['contributions', input.requiredContributions], ['evidenceTargets', input.targetEvidence]]) {
      if (!Array.isArray(e[field])) { errors.push(`Missing ${field}: ${e.id}`); continue; }
      for (const id of e[field]) {
        if (!allowed.includes(id)) errors.push(`Unknown ${field}: ${id}`);
        if (e.audience === 'student') declared.add(id);
      }
    }
    if (e.audience === 'caregiver' && e.evidenceTargets?.length) errors.push(`Caregiver claims in-app evidence: ${e.id}`);
    if (!Number.isFinite(e.minutes) || e.minutes <= 0) errors.push(`Invalid minutes: ${e.id}`);
    else if (e.audience === 'student') studentMinutes += e.minutes;
  }
  if (!Array.isArray(plan?.unmetRequirements)) errors.push('Missing unmetRequirements');
  for (const gap of Array.isArray(plan?.unmetRequirements) ? plan.unmetRequirements : []) {
    if (!requirements.has(gap?.requirementId) || !gap.reason?.trim()) errors.push('Invalid unmet requirement');
    gaps.add(gap?.requirementId);
  }
  for (const id of requirements) {
    const decisionReportsGap = input.contributionDefinitions && plan?.contributionDecisions?.some(d => d.contributionId === id && ['partial', 'omitted'].includes(d.status) && d.reason?.trim());
    if (!declared.has(id) && !gaps.has(id) && !decisionReportsGap) errors.push(`Requirement neither addressed nor reported: ${id}`);
  }
  if (input.contributionDefinitions) {
    const decisions = Array.isArray(plan?.contributionDecisions) ? plan.contributionDecisions : [];
    const seen = new Set();
    for (const d of decisions) {
      if (!input.requiredContributions.includes(d?.contributionId) || seen.has(d.contributionId)) errors.push('Unknown/duplicate contribution decision');
      seen.add(d?.contributionId);
      if (!['provided', 'merged', 'partial', 'omitted'].includes(d?.status) || !d.reason?.trim()) errors.push('Invalid contribution decision');
      if (!Array.isArray(d.experienceIds)) { errors.push('Missing contribution experience references'); continue; }
      if (d.status !== 'omitted' && !d.experienceIds.length) errors.push(`Unbound contribution: ${d.contributionId}`);
      for (const id of d.experienceIds) {
        const e = plan.experiences?.find(e => e.id === id);
        if (!e || e.audience !== 'student' || !e.contributions?.includes(d.contributionId)) errors.push(`Invalid contribution binding: ${d.contributionId}/${id}`);
      }
    }
    for (const id of input.requiredContributions) if (!seen.has(id)) errors.push(`Missing contribution decision: ${id}`);
  }
  if (!Array.isArray(plan?.rejectedCandidates)) errors.push('Missing rejectedCandidates');
  for (const r of Array.isArray(plan?.rejectedCandidates) ? plan.rejectedCandidates : []) {
    if (!candidates.has(r?.componentId) || !r.reason?.trim()) errors.push('Invalid rejected candidate');
  }
  if (studentMinutes > input.lessonBudgetMinutes) warnings.push(`Estimated student time ${studentMinutes} exceeds ${input.lessonBudgetMinutes} minutes`);
  return { valid: !errors.length, errors, warnings, studentMinutes, note: 'Checks references and declarations only; human review and hydrated lesson QA must establish quality and actual coverage.' };
}

export function renderReview(record) {
  const lines = [`# Planner pilot: ${record.input.caseId}`, '',
    `Model: ${record.model}. Pipeline: ${record.pipeline ?? 'single'}. Representation: ${record.representation ?? 'descriptions'}. Planning latency: ${record.latencyMs ?? 'not run'} ms.`,
    'Planning-only artifact: no lesson was hydrated; declared evidence is not verified coverage.', '',
    `${record.input.entryPoint === 'topic' ? 'Open topic: ' + record.input.topic : 'Objective: ' + record.input.objective.text}`, ''];
  if (record.learningArc) {
    lines.push('## Learning arc', '', record.learningArc.centralQuestion, '',
      ...record.learningArc.objectives.map(o => `- **${o.question}** (${o.id}) — ${o.text} Candidates: ${o.candidateIds.join(', ')}. Evidence: ${o.evidenceCriteria.join('; ')}`), '',
      `Scope: ${record.learningArc.scopeReason}`, '', ...record.learningArc.deferred.map(d => `- Deferred: ${d.question} — ${d.reason}`), '');
  }
  if (record.stages?.length) {
    lines.push('## Stages', '', ...record.stages.filter(s => s.prompt).map(s => `- ${s.name}: ${s.latencyMs ?? '?'} ms, ${s.promptChars} prompt characters`), '');
    const r = record.stages.find(s => s.name === 'retrieval')?.output;
    if (r) lines.push(`Retrieval: ${r.universeTasks} tasks → ${r.retainedTasks} tasks across ${r.candidates.length} primitives. Method: ${r.method}.`, '', ...r.jobs.map(j => `- ${j.contributionId}: ${j.matches.map(m => `${m.componentId}/${m.mode || '(no mode)'}`).join(', ')}`), '');
  }
  for (const e of record.plan?.experiences ?? []) {
    lines.push(`## ${e.id}: ${e.componentId}${e.mode ? ` / ${e.mode}` : ''}`, '',
      `${e.minutes} min; ${e.audience}. ${e.distinctContribution}`, '',
      `Child action: ${e.learnerAction}`, `Intent: ${e.intent}`, `Support: ${e.support}`,
      ...(e.objectiveIds ? [`Objectives: ${e.objectiveIds.join(', ') || 'general'}`] : []),
      `Contributions: ${(e.contributions ?? []).join(', ')}`,
      `Intended evidence: ${(e.evidenceTargets ?? []).join(', ') || 'none'}`,
      `Limits: ${(e.evidenceLimits ?? []).join('; ') || 'none declared'}`, '');
  }
  lines.push('## Contribution decisions', '', ...(record.plan?.contributionDecisions ?? []).map(d => `- ${d.contributionId}: **${d.status}** (${d.experienceIds.join(', ') || 'no activity'}). ${d.reason}`), '',
    '## Rejected alternatives', '', ...(record.plan?.rejectedCandidates ?? []).map(r => `- ${r.componentId}: ${r.reason}`), '',
    '## Unmet requirements', '', ...(record.plan?.unmetRequirements ?? []).map(g => `- ${g.requirementId}: ${g.reason}`), '',
    '## Structural validation', '', '```json', JSON.stringify(record.validation ?? null, null, 2), '```', '',
    '## Human review', '',
    '- Does this feel like a complete lesson?', '- Does each experience add a distinct contribution?',
    '- Are any claimed interactions or evidence unsupported?', '- Is the progression appropriate for this child?',
    '- Which experiences would you keep, fix, or cut?', '');
  return lines.join('\n');
}
