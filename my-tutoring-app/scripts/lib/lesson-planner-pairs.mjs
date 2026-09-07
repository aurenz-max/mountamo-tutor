import { prepareSemanticDiscovery } from './lesson-planner-discovery.mjs';

export function taskCards(candidates) {
  return candidates.flatMap(c => (c.modes.length ? c.modes : [{ key: null, description: 'No declared evaluation mode.' }]).map(m => ({
    taskId: `${c.componentId}::${m.key ?? 'default'}`, componentId: c.componentId, mode: m.key,
    description: c.description, modeDescription: m.description, constraints: c.constraints,
    affordances: c.affordances, modeAffordances: m.affordances,
  })));
}

export async function pairHopper(input, ai, cacheDir, generalIds) {
  const cards = taskCards(input.candidates);
  const discovery = await prepareSemanticDiscovery({ ...input, candidates: cards.map(c => ({
    componentId: c.taskId, description: `${c.description}\nTask: ${c.modeDescription}`,
    affordances: c.affordances, modes: [],
  })) }, ai, cacheDir);
  const lookup = new Map(cards.map(c => [c.taskId, c]));
  const general = new Set(generalIds);
  // Bound specialist retrieval independently of the reusable lesson support pool.
  const specialist = discovery.ranked.filter(r => !general.has(lookup.get(r.componentId).componentId)).slice(0, 20);
  const support = discovery.ranked.filter(r => general.has(lookup.get(r.componentId).componentId)).slice(0, 12);
  const closing = ['knowledge-check', 'flashcard-deck'].flatMap(id => discovery.ranked.filter(r => lookup.get(r.componentId).componentId === id).slice(0, 1));
  const selected = [...new Set([...specialist, ...support, ...closing].map(r => r.componentId))].map(id => lookup.get(id));
  return { ...discovery, method: 'primitive-mode-pair-embedding-v1', selected, totalTasks: cards.length,
    policy: { specialist: 20, support: 12, closingPerFamily: 1 }, verification: 'Catalog declarations; runtime capability not inferred from similarity.' };
}

export function pairRequest(request, cards) {
  const result = structuredClone(request);
  const start = result.contents.indexOf('AVAILABLE COMPONENT TOOLS:');
  const end = result.contents.indexOf('## CRITICAL: OBJECTIVE-CENTRIC DESIGN');
  const instruction = /\(Which SKILL each component teaches[^\n]+\)/;
  if (start < 0 || end < start || !instruction.test(result.contents)) throw new Error('Production prompt contract changed');
  result.contents = result.contents.slice(0, start) + 'AVAILABLE COMPONENT TASKS:\n' + JSON.stringify(cards) + '\n\n' + result.contents.slice(end);
  result.contents = result.contents.replace(instruction,
    'Select taskId from the supplied tasks for each component. Each task binds one primitive and its exact evaluation mode; code transfers this binding unchanged. Select tasks jointly for objective coverage, lesson order, and assessment. Respect shared constraints and mode capabilities; similarity is not proof of suitability. Tasks without a declared mode do not establish assessment capability. There is no separate lesson mode selector.');
  const schema = result.config.responseSchema;
  function bind(node, allowed) {
    delete node.properties.componentId;
    node.properties.taskId = { type: 'STRING', enum: allowed.map(c => c.taskId) };
    node.required = node.required.map(k => k === 'componentId' ? 'taskId' : k);
  }
  bind(schema.properties.objectiveBlocks.items.properties.components.items, cards);
  bind(schema.properties.finalAssessment, cards.filter(c => ['knowledge-check', 'flashcard-deck'].includes(c.componentId)));
  return result;
}

export function compileTaskManifest(plan, cards) {
  const manifest = structuredClone(plan);
  const lookup = new Map(cards.map(c => [c.taskId, c]));
  const seen = new Set();
  const components = [...manifest.objectiveBlocks.flatMap(b => b.components), ...(manifest.finalAssessment ? [manifest.finalAssessment] : [])];
  for (const item of components) {
    const task = lookup.get(item.taskId);
    if (!task) throw new Error(`Unknown task binding: ${item.taskId}`);
    if (seen.has(item.instanceId)) throw new Error(`Duplicate instance: ${item.instanceId}`);
    seen.add(item.instanceId);
    if (item === manifest.finalAssessment && !['knowledge-check', 'flashcard-deck'].includes(task.componentId)) throw new Error('Invalid closing task');
    item.componentId = task.componentId;
    item.config = { ...item.config };
    delete item.config.targetEvalMode;
    if (task.mode !== null) item.config.targetEvalMode = task.mode;
    delete item.taskId;
  }
  return manifest;
}
