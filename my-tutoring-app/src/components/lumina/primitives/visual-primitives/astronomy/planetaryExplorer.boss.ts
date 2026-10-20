/**
 * planetary-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one question the
 * learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. A stop's first question first needs Ready for Questions, which closes the planet's card. The card is
 * `planetaryExplorer.card.ts`; this file holds the content check, the items, the ask and key, the levers and the
 * harness play.
 */
import type { PlanetaryExplorerData } from './PlanetaryExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { planetaryExplorerCard } from './planetaryExplorer.card';
import { PLANET_LEVERS } from './planetaryExplorerLevers';
import {
  askOf, planetGiven, planetHarnessAnswers, planetItems, planetKey, planetMode, planetSpokenMisses, type PlanetItem, type PlanetMiss,
} from './planetaryExplorerWorkspace';

const TYPES = ['mc', 'compare', 'true-false'];

/** Reject a trip whose questions cannot be attempted: every check reads the question's own `correctIndex`. */
export function validatePlanetaryExplorerData(value: unknown): PlanetaryExplorerData {
  const d = value as PlanetaryExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.planets) || !d.planets.length
      || d.planets.some(p => !p || typeof p.planetId !== 'string' || !p.planetId || !Array.isArray(p.keyStats) || !Array.isArray(p.questions))
      || new Set(d.planets.map(p => p.planetId)).size !== d.planets.length)
    throw new Error('Generated planetary explorer has invalid lesson content.');
  const items = planetItems(d.planets, d.quizQuestions ?? []);
  if (!items.length || items.length > 24) throw new Error('Generated planetary explorer has no askable question.');
  for (const { question: q } of items) {
    if (!q || typeof q.question !== 'string' || !q.question.trim() || !TYPES.includes(q.questionType)
        || !Array.isArray(q.options) || q.options.length < 2 || q.options.some(o => typeof o !== 'string' || !o.trim())
        || new Set(q.options.map(o => o.trim().toLowerCase())).size !== q.options.length
        || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length)
      throw new Error('A planetary-explorer question cannot be answered as generated.');
  }
  return d;
}

export const planetaryExplorerBoss = spokenBoss<PlanetaryExplorerData, PlanetItem, PlanetMiss>({
  card: planetaryExplorerCard,
  validate: validatePlanetaryExplorerData,
  items: d => planetItems(d.planets, d.quizQuestions ?? []),
  levers: PLANET_LEVERS,
  speech: {
    ask: askOf,
    key: planetKey,
    given: planetGiven,
    misses: item => planetSpokenMisses(item, item.trip),
    say: item => planetHarnessAnswers(item, item.trip),
    // A stop's first question: the planet's card is on screen until the learner closes it.
    before: (_item, ctx) => (ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Ready for Questions →' }] : []),
    modeOf: planetMode,
  },
  drive: {
    component: 'primitives/visual-primitives/astronomy/PlanetaryExplorer.tsx',
    instanceId: 'planets',
    defaults: { grade: 'Grade 3', mode: 'identify', topic: 'The planets of our solar system' },
    mounted: '[data-pip-object="workspace"]',
  },
});
