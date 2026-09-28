/**
 * Habitat diorama on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C5). Its only teaching path for challenges: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path). A payload with no askable challenge
 * stays the ungraded free-exploration diorama.
 *
 * Pure: the component and the journey read the same assignment and scene. Observe, predict and
 * defend are one spoken choice from what is on screen. Connect (tap the living thing a relationship
 * leads to) and restore (tap the zone) are checked by the activity.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, habitatDioramaHarnessAnswers, type HabitatItem } from './habitatDioramaScript';
import type { HabitatZone, Relationship } from './HabitatDiorama';

export const ZONE_LABELS: Record<HabitatZone, string> = {
  canopy: 'Canopy', 'open-land': 'Open land', water: 'Open water',
  shoreline: 'Shoreline', ground: 'Ground layer', underground: 'Underground',
};

export function habitatAssignment(item: HabitatItem): TeachingAssignment {
  const task = askFor(item);
  if (item.answerKind === 'gesture') return { id: item.id, task, response: 'gesture' };
  const short = item.answerTerms.length ? ` The distinguishing short form ${item.answerTerms.map(t => `"${t}"`).join(' or ')} also counts.` : '';
  return { id: item.id, task, response: 'speech',
    expectedAnswer: `${item.answerText}.${short} "${item.signatureWrong}", another choice on screen, is not it.` };
}

export interface HabitatView {
  habitatName: string;
  organismNames: string[];
  /** K-2: the learner does not read the names, cards or choices. */
  preReader: boolean;
}

export function habitatScene(item: HabitatItem, view: HabitatView): WorkspaceScene {
  const facts: Record<string, string> = {
    shown: `The ${view.habitatName} habitat with ${view.organismNames.join(', ')}.`.slice(0, 480),
  };
  if (item.kind === 'observe' || item.kind === 'predict') facts.choices = item.optionTexts.join('; ');
  if (item.kind === 'predict' && item.disruptionEvent) facts.change = item.disruptionEvent;
  if (item.kind === 'defend') (item.evidenceChoices ?? []).forEach((c, i) => { facts[`evidence${i + 1}`] = c.text; });
  if (item.kind === 'connect') facts.start = `${item.organismNames[item.fromId ?? '']} is lit up as the start of the connection.`;
  if (item.kind === 'restore') facts.waiting = `${item.organismNames[item.restorationEntityId ?? '']} is off the map, beside six zone buttons: `
    + `${Object.values(ZONE_LABELS).join(', ')}.`;
  const reads = view.preReader ? ' The learner does not read; the printed words reach them only through you.' : '';
  facts.constraints = (item.kind === 'connect'
    ? 'The learner taps the living thing the connection leads to; the activity checks it. You cannot tap for them.'
    : item.kind === 'restore'
      ? 'The learner taps the zone; the activity checks it. You cannot place it for them.'
      : 'The learner says one of the choices out loud; tapping does not answer.') + reads;
  return { objects: [], facts };
}

/** The activity's check of a model move, and how it reads to the tutor and the observer, never the key. */
export const habitatMoveMatches = (item: HabitatItem, move: { toId?: string; zone?: HabitatZone }) =>
  item.kind === 'connect' ? move.toId === item.toId : item.kind === 'restore' && move.zone === item.restorationZone;
export const describeHabitatMove = (item: HabitatItem, move: { toId?: string; zone?: HabitatZone }) =>
  item.kind === 'connect'
    ? `Connected ${item.organismNames[item.fromId ?? ''] ?? 'the start'} to ${item.organismNames[move.toId ?? ''] ?? 'another living thing'}.`
    : `Placed ${item.organismNames[item.restorationEntityId ?? ''] ?? 'the living thing'} in the ${move.zone ? ZONE_LABELS[move.zone] : 'unplaced'} zone.`;

/**
 * What a checked wrong move shows (handoff 20), from the tap and the habitat's own relationships:
 *   - connect: `same_kind_other_link` (the start has this kind of relationship with the tapped living thing
 *     too, so the tap is defensible; see RP-7), `other_kind_link` (the start leads to it by another kind of
 *     relationship), `leads_to_start` (the tapped one's relationship points at the start: the reverse
 *     direction), `unconnected` (no relationship either way);
 *   - restore: `water_for_land` (put in open water; its zone is on land or the shoreline), `land_for_water`
 *     (its zone is open water; put on land or the shoreline), `other_land_zone` (neither zone is water).
 * observe, predict and defend are spoken (Part B).
 */
export type HabitatMiss = 'same_kind_other_link' | 'other_kind_link' | 'leads_to_start' | 'unconnected'
  | 'water_for_land' | 'land_for_water' | 'other_land_zone';

export function habitatMiss(item: HabitatItem, move: { toId?: string; zone?: HabitatZone },
  relationships: readonly Relationship[]): HabitatMiss | undefined {
  if (habitatMoveMatches(item, move)) return undefined;
  if (item.kind === 'connect') {
    if (!move.toId) return undefined;
    const out = relationships.filter(r => r.fromId === item.fromId && r.toId === move.toId);
    if (out.some(r => r.type === item.relationshipType)) return 'same_kind_other_link';
    if (out.length) return 'other_kind_link';
    return relationships.some(r => r.fromId === move.toId && r.toId === item.fromId) ? 'leads_to_start' : 'unconnected';
  }
  if (item.kind === 'restore' && move.zone && item.restorationZone) {
    if (move.zone === 'water') return 'water_for_land';
    return item.restorationZone === 'water' ? 'land_for_water' : 'other_land_zone';
  }
  return undefined;
}

/** The journey's answers: a spoken choice, or the label of the button a gesture presses. */
export function habitatJourneyAnswers(item: HabitatItem): { correct: string; plainWrong: string } {
  const answers = habitatDioramaHarnessAnswers(item);
  if (item.answerKind === 'voice') return { correct: answers.correct, plainWrong: item.signatureWrong };
  const label = (value: string) => item.kind === 'restore' ? ZONE_LABELS[value as HabitatZone] : item.organismNames[value] ?? value;
  return { correct: label(answers.tapped!.correct), plainWrong: label(answers.tapped!.wrong) };
}
