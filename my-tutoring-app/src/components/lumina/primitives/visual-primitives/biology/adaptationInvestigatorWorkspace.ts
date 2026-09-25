/**
 * Adaptation Investigator as an ungraded teaching surface (user ruling 2026-09-24): the tutor
 * teaches the organism's trait, its home and how the one helps in the other, from the picture and
 * three cards. Nothing is graded; the What If? questions stay on the standalone path only.
 *
 * Pure, because the server route imports the validator through the live adapter.
 */
import type { AdaptationInvestigatorData } from './AdaptationInvestigator';
import type { TeachingSurfaceObject } from '../../../components/live-activity/runtime/useTeachingSurface';

/** The three cards, in teaching order. Each opens on the learner's tap or the tutor's show. */
export const TEACHING_CARDS = ['trait', 'environment', 'connection'] as const;
export type TeachingCard = (typeof TEACHING_CARDS)[number];

export function validateAdaptationTeaching(value: unknown): AdaptationInvestigatorData {
  const d = value as AdaptationInvestigatorData;
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  const list = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(text);
  if (!d || !text(d.organism) || !text(d.adaptation?.trait) || !text(d.adaptation?.description)
      || !text(d.environment?.habitat) || !text(d.environment?.description) || !list(d.environment?.pressures)
      || !text(d.connection?.explanation) || !list(d.connection?.evidencePoints))
    throw new Error('Adaptation investigator content needs an organism, its trait, its habitat and how the trait helps');
  return d;
}

export const teachingTask = (d: AdaptationInvestigatorData) =>
  `Learn why the ${d.organism} has ${d.adaptation.trait.toLowerCase()}: what it is, where the ${d.organism} lives, `
  + 'and how it helps there.';

/**
 * What is drawn and written, including closed cards: the tutor needs every card to teach, and there
 * is no answer to leak. `open` says which cards the learner can read now.
 */
export function teachingScene(d: AdaptationInvestigatorData, view: { open: ReadonlySet<string>; picture: 'drawn' | 'drawing' | 'none'; misconceptionOpen: boolean }) {
  const objects: TeachingSurfaceObject[] = [
    { id: 'picture', label: `Picture of the ${d.organism}`, shown: view.picture === 'drawn' },
    { id: 'trait', label: `The Trait card: ${d.adaptation.trait}`, shown: view.open.has('trait') },
    { id: 'environment', label: `The Environment card: ${d.environment.habitat}`, shown: view.open.has('environment') },
    { id: 'connection', label: 'The Connection card: how the trait helps', shown: view.open.has('connection') },
    ...(d.misconception ? [{ id: 'misconception', label: 'Common Misconception card', shown: view.misconceptionOpen }] : []),
  ];
  const facts: Record<string, string | number> = {
    organism: d.organism,
    picture: view.picture === 'drawn' ? `drawn: ${d.adaptation.imagePrompt}` : view.picture === 'drawing' ? 'being drawn' : 'not drawn',
    trait: `${d.adaptation.trait} (${d.adaptation.type}): ${d.adaptation.description}`,
    environment: `${d.environment.habitat}: ${d.environment.description}`,
    pressures: d.environment.pressures.join(' | '),
    connection: d.connection.explanation,
    evidence: d.connection.evidencePoints.join(' | '),
    ...(d.misconception ? { misconception: `Many people think: ${d.misconception.commonBelief} Actually: ${d.misconception.correction}` } : {}),
    cardsOpen: TEACHING_CARDS.filter(c => view.open.has(c)).join(', ') || 'none',
    constraints: 'The learner taps a card to open it and presses Done after all three are open. Nothing is graded.',
  };
  return { task: teachingTask(d), objects, facts };
}
