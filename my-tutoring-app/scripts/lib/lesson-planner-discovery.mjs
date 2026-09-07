import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from './lesson-planner-pilot.mjs';

export const embeddingModel = 'gemini-embedding-001';
const dimensions = 768;

// A source-derived projection, not model-authored claims about component behavior.
// Keep task/evaluation details separate so their volume cannot dominate discovery.
export function discoveryCards(candidates) {
  return candidates.map(c => ({
    componentId: c.componentId,
    teachingDescription: c.description,
    lessonRoles: c.affordances?.role ?? [],
    evaluationModes: c.modes.map(m => ({ key: m.key, description: m.description })),
    verification: 'Live catalog declaration; component behavior not verified',
  }));
}

export function cosine(a, b) {
  if (!a?.length || a.length !== b?.length || [...a, ...b].some(x => !Number.isFinite(x))) throw new Error('Invalid embedding dimensions or values');
  const norm = Math.hypot(...a) * Math.hypot(...b);
  if (!norm) throw new Error('Zero embedding');
  return a.reduce((sum, v, i) => sum + v * b[i], 0) / norm;
}

export function semanticRanking(cards, vectors, queryVector) {
  if (cards.length !== vectors.length) throw new Error('Embedding/card count mismatch');
  return cards.map((c, i) => ({ componentId: c.componentId, score: cosine(vectors[i], queryVector), matched: ['semantic similarity'] }))
    .sort((a, b) => b.score - a.score || a.componentId.localeCompare(b.componentId));
}

export function candidateRecall(neighborhood, expected) {
  const found = new Set(neighborhood.candidates.map(c => c.componentId));
  const hits = expected.filter(id => found.has(id));
  return { expected, hits, missing: expected.filter(id => !found.has(id)), recall: expected.length ? hits.length / expected.length : null };
}

export async function prepareSemanticDiscovery(input, ai, cacheDir) {
  const cards = discoveryCards(input.candidates);
  const texts = cards.map(c => `${c.componentId}\n${c.teachingDescription}\nLesson roles: ${JSON.stringify(c.lessonRoles)}`);
  const indexHash = hash({ model: embeddingModel, dimensions, texts, version: 1 });
  mkdirSync(cacheDir, { recursive: true });
  const path = join(cacheDir, `${indexHash}.json`);
  const indexStart = performance.now();
  const cacheHit = existsSync(path);
  let vectors;
  async function embed(contents, taskType) {
    const response = await ai.models.embedContent({ model: embeddingModel, contents,
      config: { taskType, outputDimensionality: dimensions, httpOptions: { timeout: 60000 } } });
    const values = response.embeddings?.map(e => e.values);
    if (values?.length !== contents.length || values.some(v => v?.length !== dimensions)) throw new Error('Unexpected embedding response shape');
    values.forEach(v => cosine(v, v));
    return values;
  }
  if (cacheHit) {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    if (saved.indexHash !== indexHash) throw new Error('Embedding cache identity mismatch');
    vectors = saved.vectors;
  } else {
    vectors = [];
    for (let i = 0; i < texts.length; i += 50) vectors.push(...await embed(texts.slice(i, i + 50), 'RETRIEVAL_DOCUMENT'));
    writeFileSync(path, JSON.stringify({ indexHash, model: embeddingModel, dimensions, cards, vectors }) + '\n');
  }
  const indexLatencyMs = Math.round(performance.now() - indexStart);
  const queryStart = performance.now();
  const query = input.objective?.text ?? input.topic;
  if (!query?.trim()) throw new Error('Discovery requires a topic or objective');
  const [queryVector] = await embed([query], 'RETRIEVAL_QUERY');
  const queryLatencyMs = Math.round(performance.now() - queryStart);
  const rankStart = performance.now();
  const ranked = semanticRanking(cards, vectors, queryVector);
  return { method: 'catalog-description-embedding-v1', model: embeddingModel, dimensions, indexHash, cacheHit,
    indexLatencyMs, queryLatencyMs, rankingLatencyMs: Math.round(performance.now() - rankStart),
    query, queryVector, cards, ranked };
}
