/**
 * genre-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken answer the
 * tutor judges against its key. The card is `genreExplorer.card.ts`; this file holds the content check, the items, the
 * ask and key, the levers and the harness play.
 */
import type { GenreExplorerData } from './GenreExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { genreExplorerCard } from './genreExplorer.card';
import { farKindsFor, GENRE_LEVERS, genreSession, practiceParent } from './genreExplorerLevers';
import {
  askFor, genreExplorerHarnessAnswers, genreGiven, genreKey, genreSpokenMisses, itemsFromPayload,
  type GenreExplorerItem, type SpokenGenreMiss,
} from './genreExplorerDomain';

/** The session's items, built exactly as the component builds them (the build gates drop what cannot be asked). */
export const genreItems = (data: GenreExplorerData): GenreExplorerItem[] => itemsFromPayload(data).items;

/** Reject a lesson with nothing askable: the build gates drop an excerpt that names a genre, a heading-form feature,
 *  a menu the ear cannot separate. */
export function validateGenreExplorerData(value: unknown): GenreExplorerData {
  const d = value as GenreExplorerData;
  if (!d || !Array.isArray(d.excerpts) || !Array.isArray(d.features))
    throw new Error('Generated genre explorer has invalid lesson content.');
  if (!genreItems(d).length) throw new Error('No genre explorer question can be asked.');
  return d;
}

export const genreExplorerBoss = spokenBoss<GenreExplorerData, GenreExplorerItem, SpokenGenreMiss>({
  card: genreExplorerCard,
  validate: validateGenreExplorerData,
  items: genreItems,
  levers: GENRE_LEVERS,
  speech: {
    ask: askFor,
    key: genreKey,
    given: genreGiven,
    misses: genreSpokenMisses,
    say: genreExplorerHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/GenreExplorer.tsx',
    instanceId: 'genre-explorer',
    defaults: { grade: 'Grade 3', mode: 'classify_genre', topic: 'Fables, myths and informational texts' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, genreExplorerLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as GenreExplorerData;
      const all = genreItems(data);
      const parent = ctx.itemId ? practiceParent(ctx.itemId, all) : null;
      return parent ? farKindsFor(parent, genreSession(data)) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
  },
});
