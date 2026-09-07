import { prepareSemanticDiscovery, semanticRanking } from './lesson-planner-discovery.mjs';
import { taskCards } from './lesson-planner-pairs.mjs';

const stop = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'with', 'for', 'using', 'as', 'by', 'is', 'on']);
const tokens = text => (String(text).toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => !stop.has(w)).map(w => w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

// Small catalog: exhaustive lexical/vector ranking is cheap; no vector database needed.
export function lexicalRank(candidates, query) {
  const docs = candidates.map(c => ({ componentId: c.componentId, words: tokens(`${c.componentId} ${c.description}`) }));
  const terms = [...new Set(tokens(query))];
  const avg = docs.reduce((n,d) => n+d.words.length, 0) / Math.max(1, docs.length);
  const df = Object.fromEntries(terms.map(t => [t, docs.filter(d => d.words.includes(t)).length]));
  return docs.map(d => ({ componentId: d.componentId, score: terms.reduce((n,t) => {
    const tf = d.words.filter(w => w === t).length;
    return n + Math.log(1 + (docs.length-df[t]+0.5)/(df[t]+0.5)) * tf * 2.2 / (tf + 1.2*(0.25+0.75*d.words.length/Math.max(1,avg)));
  }, 0) })).filter(r => r.score > 0).sort((a,b) => b.score-a.score || a.componentId.localeCompare(b.componentId));
}

export function fuseRanks(rankings) {
  const scores = new Map();
  for (const ranking of rankings) {
    const seen = new Set();
    ranking.forEach((r,i) => { if (!seen.has(r.componentId)) { seen.add(r.componentId); scores.set(r.componentId, (scores.get(r.componentId) ?? 0) + 1/(60+i+1)); } });
  }
  return [...scores].map(([componentId,score]) => ({ componentId,score })).sort((a,b) => b.score-a.score || a.componentId.localeCompare(b.componentId));
}

export function selectFamilyTasks(cards, familyRanks, taskRanks, generalIds, budget = 34) {
  const general = new Set(generalIds);
  const families = [...familyRanks.filter(r => !general.has(r.componentId)).slice(0,10), ...familyRanks.filter(r => general.has(r.componentId)).slice(0,6)].map(r => r.componentId);
  for (const id of ['knowledge-check', 'flashcard-deck']) if (cards.some(c => c.componentId === id) && !families.includes(id)) families.push(id);
  const taskOrder = new Map(taskRanks.map((r,i) => [r.componentId,i]));
  const pools = families.map(id => cards.filter(c => c.componentId === id).sort((a,b) => (taskOrder.get(a.taskId) ?? Infinity)-(taskOrder.get(b.taskId) ?? Infinity)));
  // Round robin: establish family coverage before adding a second/third variant.
  const selected = [];
  for (let depth = 0; selected.length < budget && pools.some(p => p[depth]); depth++) {
    for (const pool of pools) if (pool[depth] && selected.length < budget) selected.push(pool[depth]);
  }
  return selected;
}

export async function familyHopper(input, ai, cacheDir, generalIds) {
  const cards = taskCards(input.candidates);
  const [family, task] = await Promise.all([
    prepareSemanticDiscovery(input, ai, cacheDir),
    prepareSemanticDiscovery({ ...input, candidates: cards.map(c => ({ componentId: c.taskId,
      description: c.mode === null ? c.description : `Primitive: ${c.componentId}. Learner task: ${c.modeDescription}`,
      affordances: null, modes: [] })) }, ai, cacheDir),
  ]);
  const familyFromTasks = [];
  for (const r of task.ranked) {
    const componentId = cards.find(c => c.taskId === r.componentId).componentId;
    if (!familyFromTasks.some(f => f.componentId === componentId)) familyFromTasks.push({ componentId, score: r.score });
  }
  const lexical = lexicalRank(input.candidates, input.objective?.text ?? input.topic);
  const familyRanked = fuseRanks([family.ranked, familyFromTasks, lexical]);
  const taskRanked = task.ranked;
  const selected = selectFamilyTasks(cards, familyRanked, taskRanked, generalIds);
  return { method: 'family-hybrid-mode-focused-v1', selected, totalTasks: cards.length, family, task, lexical, familyRanked,
    ranked: taskRanked, indexLatencyMs: Math.max(family.indexLatencyMs, task.indexLatencyMs),
    policy: { specialistFamilies: 10, supportFamilies: 6, closingFamilies: 2, taskBudget: 34, fusion: 'RRF k=60', expansion: 'round robin by task rank' } };
}
