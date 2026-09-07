import { buildPrompt, responseSchema, validatePlan } from './lesson-planner-pilot.mjs';

const str = { type: 'STRING' };
const list = { type: 'ARRAY', items: str };
export const contractSchema = {
  type: 'OBJECT', required: ['objectiveId', 'performances', 'jobs'],
  properties: {
    objectiveId: str, performances: list,
    jobs: { type: 'ARRAY', items: {
      type: 'OBJECT', required: ['contributionId', 'learnerExperience', 'searchTerms', 'requiredCapabilities', 'dependsOn'],
      properties: { contributionId: str, learnerExperience: str, searchTerms: list, requiredCapabilities: list, dependsOn: list },
    } },
  },
};

export function contractPrompt(input) {
  return `Interpret ONE objective into observable learner performances and instructional jobs. You do not select software.
Preserve the objective ID and scope. Return one job per supplied contribution, with observable child experience, necessary delivery capabilities, concise search terms and prerequisite contribution IDs. Dependencies must be acyclic. Search terms describe tasks and content, not invented primitive names. Distinguish observation, recognition, production and manipulation using the supplied evidence definitions. Do not widen or weaken the objective to fit imagined supply. Describe essential learning behavior separately from optional interface preferences; do not require animation or drag-and-drop unless the objective requires it.
${JSON.stringify({ objective: input.objective, learner: input.learner, lessonBudgetMinutes: input.lessonBudgetMinutes, contributions: input.contributionDefinitions, evidence: input.evidenceDefinitions }, null, 2)}`;
}

export function validateContract(contract, input) {
  if (contract?.objectiveId !== input.objective.id || !Array.isArray(contract.jobs) || !contract.performances?.length) throw new Error('Invalid objective contract');
  const byId = new Map();
  for (const job of contract.jobs) {
    if (!input.requiredContributions.includes(job.contributionId) || byId.has(job.contributionId) || !job.learnerExperience?.trim() || !job.searchTerms?.length || !Array.isArray(job.dependsOn) || !job.requiredCapabilities?.length) throw new Error('Invalid or duplicate contract job');
    byId.set(job.contributionId, job);
  }
  if (byId.size !== input.requiredContributions.length) throw new Error('Contract omitted a contribution');
  const visiting = new Set(), done = new Set();
  function visit(id) {
    if (!byId.has(id)) throw new Error(`Unknown dependency: ${id}`);
    if (visiting.has(id)) throw new Error('Contract dependency cycle');
    if (done.has(id)) return;
    visiting.add(id);
    byId.get(id).dependsOn.forEach(visit);
    visiting.delete(id); done.add(id);
  }
  byId.forEach((_, id) => visit(id));
}

const stop = new Set('the a an and or to of with for in on is are student child learner use using through from by their this that'.split(' '));
const tokens = text => [...new Set(String(text).toLowerCase().match(/[a-z]+/g)?.filter(t => t.length > 2 && !stop.has(t)) ?? [])];
const key = (id, mode) => `${id}::${mode}`;

// Pilot retriever: transparent lexical TF/IDF-style ranking, no API calls.
// It is a discovery heuristic, never evidence of capability or a grade filter.
export function retrieveTasks(input, contract, perJob = 4) {
  const tasks = input.candidates.flatMap(c => (c.modes.length ? c.modes : [{ key: '', description: '' }]).map(m => ({
    componentId: c.componentId, mode: m.key,
    task: m.description || c.description,
    primary: tokens(`${m.description} ${JSON.stringify(m.affordances ?? {})}`),
    shared: tokens(`${c.description} ${JSON.stringify(c.affordances ?? {})}`),
  })));
  const df = new Map();
  for (const t of tasks) for (const word of new Set([...t.primary, ...t.shared])) df.set(word, (df.get(word) ?? 0) + 1);
  const jobs = contract.jobs.map(job => {
    const query = tokens(`${job.searchTerms.join(' ')} ${job.learnerExperience} ${job.requiredCapabilities.join(' ')}`);
    const ranked = tasks.map(t => ({ componentId: t.componentId, mode: t.mode, task: t.task,
      score: query.reduce((sum, w) => sum + (t.primary.includes(w) ? 2 : t.shared.includes(w) ? 1 : 0) * Math.log(1 + tasks.length / (df.get(w) ?? 1)), 0),
    })).sort((a, b) => b.score - a.score || key(a.componentId, a.mode).localeCompare(key(b.componentId, b.mode)));
    return { contributionId: job.contributionId, query, matches: ranked.slice(0, perJob), lowSignal: !ranked[0]?.score };
  });
  const selected = new Set(jobs.flatMap(j => j.matches.map(t => key(t.componentId, t.mode))));
  const candidates = input.candidates.filter(c => c.modes.length ? c.modes.some(m => selected.has(key(c.componentId, m.key))) : selected.has(key(c.componentId, '')))
    .map(c => ({ ...c, modes: c.modes.filter(m => selected.has(key(c.componentId, m.key))) }));
  return { method: 'lexical-mode-weighted-v1', perJob, universeTasks: tasks.length, retainedTasks: selected.size, jobs, candidates };
}

export const proposalSchema = {
  type: 'OBJECT', required: ['objectiveId', 'proposals'],
  properties: { objectiveId: str, proposals: { type: 'ARRAY', items: {
    type: 'OBJECT', required: ['contributionId', 'componentId', 'mode', 'fit', 'reason', 'intent', 'limitations'],
    properties: { contributionId: str, componentId: str, mode: str, fit: { type: 'STRING', enum: ['supported', 'partial', 'unavailable'] }, reason: str, intent: str, limitations: list },
  } } },
};

export function proposalPrompt(input, contract, retrieval) {
  return `For each instructional job, propose ONE primitive/mode from that job's retrieved matches, or return unavailable with empty componentId and mode. Decide task fit only; do not sequence or compress the lesson.
Keep objectiveId. Each contribution gets exactly one proposal. Retrieval scores mean text similarity, not capability. Reject mismatches honestly rather than filling a role. Describe concrete intent and limitations. Do not invent interfaces from narrative text. Generic display or custom HTML capabilities are unverified, not proof of a working judged manipulative. Task mode governs what is taught; primitive headline is supporting context. No requirement to use every candidate.
${JSON.stringify({ objective: input.objective, learner: input.learner, contract, jobs: retrieval.jobs, candidates: retrieval.candidates }, null, 2)}`;
}

export function validateProposals(result, input, retrieval) {
  if (result?.objectiveId !== input.objective.id || !Array.isArray(result.proposals)) throw new Error('Invalid proposals');
  const seen = new Set();
  for (const p of result.proposals) {
    const job = retrieval.jobs.find(j => j.contributionId === p.contributionId);
    if (!job || seen.has(p.contributionId) || !p.reason?.trim() || !['supported', 'partial', 'unavailable'].includes(p.fit)) throw new Error('Invalid proposal job');
    seen.add(p.contributionId);
    if (p.fit === 'unavailable') {
      if (p.componentId || p.mode) throw new Error('Unavailable proposal must have empty binding');
    } else if (!job.matches.some(m => m.componentId === p.componentId && m.mode === p.mode)) throw new Error('Proposal selected outside its retrieved job');
  }
  if (seen.size !== input.requiredContributions.length) throw new Error('Missing proposal job');
}

export async function runStaged(input, call, recordStage) {
  const contract = await call('interpret', contractPrompt(input), contractSchema);
  validateContract(contract, input);
  const retrieval = retrieveTasks(input, contract);
  recordStage('retrieval', retrieval);
  const proposals = await call('propose', proposalPrompt(input, contract, retrieval), proposalSchema);
  validateProposals(proposals, input, retrieval);
  const selected = new Set(proposals.proposals.filter(p => p.fit !== 'unavailable').map(p => key(p.componentId, p.mode)));
  const compositionInput = { ...input, objectiveContract: contract, proposals,
    candidates: retrieval.candidates.filter(c => c.modes.length ? c.modes.some(m => selected.has(key(c.componentId, m.key))) : selected.has(key(c.componentId, '')))
      .map(c => ({ ...c, modes: c.modes.filter(m => selected.has(key(c.componentId, m.key))) })),
  };
  const plan = await call('compose', `Compose the proposed objective experiences into a coherent lesson. Preserve primitive/mode pairs and their limitations. Share or omit experiences only with explicit contribution decisions; preserve prerequisite order. Do not upgrade a partial proposal to supported by inventing behavior. Unavailable jobs remain gaps.\n${buildPrompt(compositionInput, 'mode-cards')}`, responseSchema);
  // Rejection explanations may refer to candidates seen in retrieval. Only
  // selected experiences must stay inside the proposal bindings.
  const validation = validatePlan(plan, { ...compositionInput, candidates: retrieval.candidates });
  for (const e of plan.experiences ?? []) {
    if (!selected.has(key(e.componentId, e.mode))) validation.errors.push(`Composition changed proposal binding: ${e.componentId}/${e.mode}`);
  }
  validation.valid = !validation.errors.length;
  recordStage('compositionValidation', validation);
  return { plan, validation };
}
