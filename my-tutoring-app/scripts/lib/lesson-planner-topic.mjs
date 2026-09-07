import { buildPrompt, responseSchema, validatePlan } from './lesson-planner-pilot.mjs';

const str = { type: 'STRING' }, strings = { type: 'ARRAY', items: str };
const words = text => [...new Set(String(text).toLowerCase().match(/[a-z]+/g)?.filter(w => !['and','the','with','for','about'].includes(w)).map(w => w.endsWith('s') ? w.slice(0, -1) : w) ?? [])];

export function objectiveNeighborhood(input, specialistLimit = 10, semantic = null) {
  if (!input.objective?.id || !input.objective.text?.trim()) throw new Error('Curriculum discovery requires an authoritative objective');
  return topicNeighborhood({ ...input, entryPoint: 'topic', topic: input.objective.text, objective: undefined }, specialistLimit, semantic);
}

export function topicNeighborhood(input, specialistLimit = 10, semantic = null) {
  if (input.entryPoint !== 'topic' || !input.topic?.trim() || input.objective) throw new Error('Open-topic path requires a topic and no supplied objective');
  const query = words(input.topic);
  const ranked = semantic?.ranked ?? input.candidates.map(c => {
    const headline = words(c.description);
    const details = words(`${c.constraints ?? ''} ${c.modes.map(m => m.description).join(' ')}`);
    const matched = query.filter(w => headline.includes(w) || details.includes(w));
    return { componentId: c.componentId, score: query.reduce((n,w) => n + (headline.includes(w) ? 2 : details.includes(w) ? 1 : 0), 0), matched };
  }).filter(r => r.score > 0).sort((a,b) => b.score - a.score || a.componentId.localeCompare(b.componentId));
  // Preserve topic-matched explanatory/visual/practice perspectives instead
  // of letting repeated simulator wording fill the whole neighborhood.
  const roleMatches = ['introduce', 'visualize', 'apply', 'assess'].flatMap(role => ranked.filter(r => {
    const roles = input.candidates.find(c => c.componentId === r.componentId)?.affordances?.role ?? [];
    return (Array.isArray(roles) ? roles : [roles]).includes(role);
  }).slice(0, 3));
  const topical = [...new Map([...ranked.slice(0, specialistLimit), ...roleMatches].map(r => [r.componentId, r])).values()];
  const general = input.generalPurposeCandidateIds ?? [];
  const included = new Set([...topical.map(t => t.componentId), ...general]);
  const candidates = input.candidates.filter(c => included.has(c.componentId));
  return {
    method: semantic ? semantic.method : 'topic-overlap-plus-general-teaching-pool-v1', query, specialistLimit,
    universeSize: input.candidates.length, topical, generalPurposeIds: general,
    excludedTopicalMatches: ranked.filter(r => !topical.some(t => t.componentId === r.componentId)),
    candidates,
    // Compact arc-facing records, full descriptions retained for later binding.
    perspectives: candidates.map(c => ({
      componentId: c.componentId, discoveryBasis: topical.some(t => t.componentId === c.componentId) ? 'topic-match' : 'general-teaching-pool',
      explanatoryOrExperientialValue: c.description,
      declaredRoles: c.affordances?.role ?? [],
      learnerDemands: c.affordances ?? null,
      constraints: c.constraints,
      modeTasks: c.modes.map(m => ({ mode: m.key, task: m.description })),
      verification: 'catalog declaration; not a hydrated capability test',
    })),
  };
}

export const arcSchema = {
  type: 'OBJECT', required: ['topic', 'centralQuestion', 'objectives', 'deferred', 'scopeReason', 'estimatedMinutes'],
  properties: {
    topic: str, centralQuestion: str, scopeReason: str, estimatedMinutes: { type: 'NUMBER' },
    objectives: { type: 'ARRAY', items: {
      type: 'OBJECT', required: ['id', 'question', 'text', 'connection', 'dependsOn', 'evidenceCriteria', 'candidateIds'],
      properties: { id: str, question: str, text: str, connection: str, dependsOn: strings, evidenceCriteria: strings, candidateIds: strings },
    } },
    deferred: { type: 'ARRAY', items: { type: 'OBJECT', required: ['question', 'reason'], properties: { question: str, reason: str } } },
  },
};

export function arcPrompt(input, neighborhood) {
  return `Plan the LEARNING ARC for an OPEN TOPIC, not activities for a prewritten objective.
Ask what is worth discovering about the topic for this learner. Consider identity/parts, mechanisms, behavior/process and meaningful use where relevant; these are lenses, not compulsory objectives. Use the neighborhood to notice learning opportunities, not to force every tool into the lesson.
Choose a small coherent set of connected questions and measurable objectives. The questions must build understanding, not merely repeat the topic. Display-only profiles and explanations are valuable instruction: lack of an evaluation mode is NOT a reason to discard their contribution.
Separate curiosity about a mechanism from mathematical treatment of it. Respect actual learner demands; do not assume an advanced interface becomes accessible through simpler prose. Preferred interface details are not learning requirements.
Keep the topic exact. Give unique objective IDs, acyclic dependencies ordered prerequisite-first, observable evidence criteria and plausible candidate IDs from this neighborhood for each. These are possibilities, not final selections. Explain what to defer if the arc would exceed the session budget. Do not silently widen the duration.
${JSON.stringify({ topic: input.topic, learner: input.learner, minutes: input.lessonBudgetMinutes, scopePolicy: input.scopePolicy, neighborhood: neighborhood.perspectives }, null, 2)}`;
}

export function validateArc(arc, input, neighborhood) {
  if (arc?.topic !== input.topic || !arc.centralQuestion?.trim() || !arc.scopeReason?.trim() || !arc.objectives?.length || !Number.isFinite(arc.estimatedMinutes) || arc.estimatedMinutes <= 0) throw new Error('Invalid topic arc');
  const ids = new Set(), candidates = new Set(neighborhood.candidates.map(c => c.componentId));
  for (const o of arc.objectives) {
    if (!o.id || ids.has(o.id) || !o.question?.trim() || !o.text?.trim() || !o.evidenceCriteria?.length || !Array.isArray(o.candidateIds) || !Array.isArray(o.dependsOn)) throw new Error('Invalid arc objective');
    if (o.dependsOn.some(id => !ids.has(id))) throw new Error('Arc dependency must reference an earlier objective');
    if (o.candidateIds.some(id => !candidates.has(id))) throw new Error('Arc candidate outside neighborhood');
    ids.add(o.id);
  }
}

export async function runTopic(input, call, recordStage, neighborhood = topicNeighborhood(input)) {
  recordStage('topicNeighborhood', neighborhood);
  const arc = await call('learningArc', arcPrompt(input, neighborhood), arcSchema);
  validateArc(arc, input, neighborhood);
  const planInput = {
    ...input, objective: { id: input.caseId, text: arc.objectives.map(o => o.text).join(' ') },
    selectedLearningArc: arc, candidates: neighborhood.candidates,
    targetEvidence: arc.objectives.map(o => o.id),
    evidenceDefinitions: Object.fromEntries(arc.objectives.map(o => [o.id, o.evidenceCriteria.join('; ')])),
  };
  const schema = structuredClone(responseSchema);
  schema.properties.experiences.items.required.push('objectiveIds');
  schema.properties.experiences.items.properties.objectiveIds = strings;
  const plan = await call('bindAndCompose', `Select experiences for the approved learning arc below. Do not redefine its objectives. Each experience must reference the objectiveIds it serves (empty only for a general opening/caregiver extension). Share instruction where it truly serves multiple objectives. Keep objective dependencies in order.
Every objective must receive instruction and intended evidence, or be reported as an explicit gap. Keep parts, mechanism and process contributions distinct when the arc chose them. Do not discard profiles for lacking evaluation modes. Use exact catalog mode keys, retain capability limitations, and distinguish planned content requests from verified behavior. A tool is optional even when named as an arc candidate.
${buildPrompt(planInput, 'mode-cards')}`, schema);
  const validation = validatePlan(plan, planInput);
  const objectiveIds = new Set(arc.objectives.map(o => o.id));
  const served = new Set();
  for (const e of plan.experiences ?? []) {
    if (!Array.isArray(e.objectiveIds) || e.objectiveIds.some(id => !objectiveIds.has(id))) validation.errors.push(`Invalid objective binding: ${e.id}`);
    else if (e.audience === 'student') e.objectiveIds.forEach(id => served.add(id));
  }
  for (const id of objectiveIds) if (!served.has(id) && !plan.unmetRequirements?.some(g => g.requirementId === id)) validation.errors.push(`Arc objective dropped: ${id}`);
  if (arc.estimatedMinutes > input.lessonBudgetMinutes) validation.warnings.push(`Arc estimate ${arc.estimatedMinutes} exceeds budget ${input.lessonBudgetMinutes}`);
  validation.valid = !validation.errors.length;
  recordStage('topicValidation', validation);
  return { plan, validation, arc };
}
