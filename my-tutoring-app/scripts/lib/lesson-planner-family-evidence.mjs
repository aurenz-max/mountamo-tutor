import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { familyHopper } from './lesson-planner-family-search.mjs';
import { semanticRanking } from './lesson-planner-discovery.mjs';
import { taskCards } from './lesson-planner-pairs.mjs';

export function protectedFamilies(semantic, lexical, fused, generalIds) {
  const general = new Set(generalIds);
  const selected = new Set();
  function add(rank, count, support) {
    let added = 0;
    for (const r of rank) if (!selected.has(r.componentId) && general.has(r.componentId) === support) {
      selected.add(r.componentId); if (++added === count) break;
    }
  }
  add(semantic, 8, false);
  add(lexical, 2, false);
  add(fused, 2, false);
  add(semantic, 6, true);
  return [...selected];
}

export function groupedCards(cards) {
  const families = new Map();
  for (const c of cards) {
    if (!families.has(c.componentId)) families.set(c.componentId, { componentId:c.componentId, description:c.description, constraints:c.constraints, affordances:c.affordances, modes:[] });
    families.get(c.componentId).modes.push({ taskId:c.taskId, mode:c.mode, learnerTask:c.modeDescription, affordances:c.modeAffordances, evidenceMatches:c.evidenceMatches });
  }
  return [...families.values()];
}

export async function familyEvidenceHopper(input, ai, cacheDir, generalIds) {
  const discovery = await familyHopper(input, ai, cacheDir, generalIds);
  const cards = taskCards(input.candidates);
  const families = protectedFamilies(discovery.family.ranked, discovery.lexical, discovery.familyRanked, generalIds);
  for (const id of ['knowledge-check','flashcard-deck']) if (!families.includes(id)) families.push(id);
  const evidence = Object.entries(input.evidenceDefinitions ?? {});
  const facetRanks = [];
  const start = performance.now();
  if (evidence.length) {
    const response = await ai.models.embedContent({ model:'gemini-embedding-001', contents:evidence.map(([,text])=>text), config:{taskType:'RETRIEVAL_QUERY',outputDimensionality:768,httpOptions:{timeout:60000}} });
    if (response.embeddings?.length !== evidence.length) throw new Error('Facet embedding count mismatch');
    const index = JSON.parse(readFileSync(join(cacheDir, `${discovery.task.indexHash}.json`), 'utf8'));
    for (let i=0;i<evidence.length;i++) facetRanks.push({ requirementId:evidence[i][0], query:evidence[i][1], ranked:semanticRanking(index.cards,index.vectors,response.embeddings[i].values) });
  }
  const selected = cards.filter(c=>families.includes(c.componentId)).map(c=>({ ...c,
    evidenceMatches:facetRanks.filter(f=>f.ranked.filter(r=>r.componentId.startsWith(`${c.componentId}::`)).slice(0,2).some(r=>r.componentId===c.taskId)).map(f=>f.requirementId) }));
  return { ...discovery,method:'protected-family-all-modes-evidence-v2',selected,families,facetRanks,facetLatencyMs:Math.round(performance.now()-start),
    policy:{semanticSpecialistFamilies:8,lexicalAdditionalFamilies:2,fusedAdditionalFamilies:2,semanticSupportFamilies:6,closingFamilies:2,modeExpansion:'all declared modes; shared family metadata rendered once',evidenceMatches:'semantic hints only; not capability validation'} };
}
