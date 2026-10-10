/**
 * Evidence finder on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C21).
 *
 * One generated passage is one or two checked items, the activity's own phases: `find` (highlight every sentence that
 * is evidence, each under the claim it supports) and, when the passage carries the CER scaffold (`cerEnabled`, the
 * evaluate_evidence_strength mode), `rate` (rate each evidence sentence Strong, Moderate or Weak). The activity's own
 * check is the judge, so the tutor is never told which sentences are evidence, which claim one supports, or how strong
 * it is. The CER reasoning box is open writing with no check and stays on the scripted path only (contract G1).
 *
 * Pure: the component, the adapter and the journey row read the same items, assignment and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { EvidenceFinderData } from './EvidenceFinder';

export type Strength = 'strong' | 'moderate' | 'weak';
export type EvidenceSentence = EvidenceFinderData['passage']['sentences'][number];

/** One checked item: a phase of the activity. */
export interface EvidenceFinderItem { id: 'find' | 'rate' }

export const STRENGTHS: readonly Strength[] = ['strong', 'moderate', 'weak'];
export const STRENGTH_LABELS: Record<Strength, string> = { strong: 'Strong', moderate: 'Moderate', weak: 'Weak' };

/** The CER scaffold is on: the strength rating is asked as its own checked item. */
export const asksRating = (data: Pick<EvidenceFinderData, 'cerEnabled'>): boolean => !!data.cerEnabled;

export function evidenceFinderItems(data: Pick<EvidenceFinderData, 'cerEnabled'>): EvidenceFinderItem[] {
  return [{ id: 'find' }, ...(asksRating(data) ? [{ id: 'rate' as const }] : [])];
}

/** The claim an evidence sentence supports; a one-claim passage often omits the index. */
export function claimOf(data: Pick<EvidenceFinderData, 'claims'>, s: EvidenceSentence): number {
  const i = typeof s.claimIndex === 'number' ? Math.round(s.claimIndex) : 0;
  return i >= 0 && i < data.claims.length ? i : 0;
}

/**
 * The evidence the find check requires: every strong or moderate evidence sentence (an unrated one counts as strong).
 * A weak one only relates to the claim, so leaving it out is not a miss, and highlighting it under its claim is not one
 * either. A passage whose evidence is all weak requires at least one of it.
 */
export function requiredEvidence(data: EvidenceFinderData): EvidenceSentence[] {
  return data.passage.sentences.filter(s => s.isEvidence && s.evidenceStrength !== 'weak');
}

/** The sentences the rate item asks about: every evidence sentence, in passage order (the find is credited by then). */
export function rateList(data: EvidenceFinderData): EvidenceSentence[] {
  return data.passage.sentences.filter(s => s.isEvidence);
}

/** What the learner has done on the open phase. */
export interface EvidenceFinderView {
  /** sentenceId -> the claim index it is highlighted under. */
  highlighted: Readonly<Record<string, number>>;
  /** sentenceId -> the learner's strength rating. */
  ratings: Readonly<Partial<Record<string, Strength>>>;
}

export const EMPTY_VIEW: EvidenceFinderView = { highlighted: {}, ratings: {} };

const quote = (s: { text: string }) => `"${s.text.trim()}"`;
const claimName = (data: EvidenceFinderData, i: number) => (data.claims.length > 1 ? `claim ${i + 1}` : 'the claim');

export function workspaceAssignment(item: EvidenceFinderItem, data: EvidenceFinderData): TeachingAssignment {
  if (item.id === 'rate') {
    return { id: item.id, task: 'Rate how strong each piece of evidence is: Strong, Moderate or Weak.', response: 'gesture' };
  }
  const task = data.claims.length > 1
    ? `Highlight every sentence in the passage that is evidence for one of the claims, under the claim it supports: `
      + data.claims.map((c, i) => `claim ${i + 1}, "${c.text.trim()}"`).join('; ') + '.'
    : `Highlight every sentence in the passage that is evidence for the claim: "${data.claims[0]?.text.trim() ?? ''}".`;
  return { id: item.id, task, response: 'gesture' };
}

/** The learner's work in their own terms, never the key. */
export function describeEvidenceWork(item: EvidenceFinderItem, data: EvidenceFinderData, view: EvidenceFinderView): string {
  if (item.id === 'rate') {
    const list = rateList(data);
    const rated = list.filter(s => view.ratings[s.id]).map(s => `${quote(s)}: ${STRENGTH_LABELS[view.ratings[s.id]!]}`);
    if (!rated.length) return 'No evidence rated yet';
    const left = list.length - rated.length;
    return `Rated: ${rated.join('; ')}.${left ? ` ${left} not rated yet.` : ''}`;
  }
  const parts = data.claims.map((_, i) => {
    const here = data.passage.sentences.filter(s => view.highlighted[s.id] === i).map(quote);
    return here.length ? `Highlighted for ${claimName(data, i)}: ${here.join(', ')}` : '';
  }).filter(Boolean);
  return parts.length ? `${parts.join('. ')}.` : 'Nothing highlighted yet';
}

// ── the activity's check ───────────────────────────────────────────────────

export function findCorrect(data: EvidenceFinderData, highlighted: EvidenceFinderView['highlighted']): boolean {
  const ids = Object.keys(highlighted);
  if (!ids.length) return false;
  const byId = new Map(data.passage.sentences.map(s => [s.id, s]));
  for (const id of ids) {
    const s = byId.get(id);
    if (!s?.isEvidence || claimOf(data, s) !== highlighted[id]) return false;
  }
  return requiredEvidence(data).every(s => highlighted[s.id] !== undefined);
}

export function rateCorrect(data: EvidenceFinderData, ratings: EvidenceFinderView['ratings']): boolean {
  return rateList(data).every(s => ratings[s.id] === (s.evidenceStrength ?? 'strong'));
}

export function evidenceFinderCorrect(item: EvidenceFinderItem, data: EvidenceFinderData, view: EvidenceFinderView): boolean {
  return item.id === 'find' ? findCorrect(data, view.highlighted) : rateCorrect(data, view.ratings);
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads. Drawn from the
 * catalog's commonStruggles ("opinion vs evidence", "weak evidence"):
 * - find, first that applies: `not_evidence` (a highlighted sentence is on the topic but is not evidence),
 *   `wrong_claim` (an evidence sentence under the other claim), `missed_evidence` (a strong or moderate one left out);
 * - rate: `weak_as_strong` (a sentence that only relates to the claim rated Strong: mentions vs proves),
 *   `rated_too_strong` (every wrong rating above the key), `rated_too_weak` (every wrong rating below it),
 *   `mixed_ratings` (some above, some below).
 */
export type EvidenceFinderMiss = 'not_evidence' | 'wrong_claim' | 'missed_evidence'
  | 'weak_as_strong' | 'rated_too_strong' | 'rated_too_weak' | 'mixed_ratings';
export const FIND_MISSES: readonly EvidenceFinderMiss[] = ['not_evidence', 'wrong_claim', 'missed_evidence'];
export const RATE_MISSES: readonly EvidenceFinderMiss[] = ['weak_as_strong', 'rated_too_strong', 'rated_too_weak', 'mixed_ratings'];

const RANK: Record<Strength, number> = { weak: 0, moderate: 1, strong: 2 };

export function evidenceFinderMiss(item: EvidenceFinderItem | null | undefined, data: EvidenceFinderData,
  view: EvidenceFinderView): EvidenceFinderMiss | undefined {
  if (!item || evidenceFinderCorrect(item, data, view)) return undefined;
  if (item.id === 'find') {
    const byId = new Map(data.passage.sentences.map(s => [s.id, s]));
    const picked = Object.keys(view.highlighted).map(id => byId.get(id)).filter((s): s is EvidenceSentence => !!s);
    if (picked.some(s => !s.isEvidence)) return 'not_evidence';
    if (picked.some(s => claimOf(data, s) !== view.highlighted[s.id])) return 'wrong_claim';
    return 'missed_evidence';
  }
  const wrong = rateList(data).filter(s => view.ratings[s.id] && view.ratings[s.id] !== (s.evidenceStrength ?? 'strong'));
  if (!wrong.length) return undefined;
  if (wrong.some(s => s.evidenceStrength === 'weak' && view.ratings[s.id] === 'strong')) return 'weak_as_strong';
  const up = wrong.filter(s => RANK[view.ratings[s.id]!] > RANK[s.evidenceStrength ?? 'strong']).length;
  return up === wrong.length ? 'rated_too_strong' : up === 0 ? 'rated_too_weak' : 'mixed_ratings';
}

// ── scene ──────────────────────────────────────────────────────────────────

/** What is drawn and asked. Sentences are listed in passage order and never marked as evidence. */
export function workspaceScene(item: EvidenceFinderItem, data: EvidenceFinderData, view: EvidenceFinderView): WorkspaceScene {
  const facts: Record<string, string> = {
    phase: item.id === 'find' ? 'Find the evidence' : 'Rate the evidence',
    title: data.title,
  };
  data.claims.forEach((c, i) => { facts[data.claims.length > 1 ? `claim${i + 1}` : 'claim'] = c.text.trim(); });
  if (item.id === 'find') {
    data.passage.sentences.forEach((s, i) => { facts[`sentence${i + 1}`] = s.text.trim(); });
    facts.constraints = (data.claims.length > 1 ? 'The learner taps a claim to choose it, then taps' : 'The learner taps')
      + ' each sentence of the passage that is evidence (tapping it again takes it off), then presses Check Evidence; '
      + 'the activity checks it. Some sentences are about the topic but do not prove the claim. You cannot highlight '
      + 'for the learner.';
  } else {
    rateList(data).forEach((s, i) => {
      facts[`evidence${i + 1}`] = data.claims.length > 1 ? `${s.text.trim()} (for claim ${claimOf(data, s) + 1})` : s.text.trim();
    });
    facts.constraints = 'The learner taps Strong, Moderate or Weak under each evidence sentence, then presses Check '
      + 'Ratings; the activity checks it. You cannot rate for the learner.';
  }
  facts.learnerWork = describeEvidenceWork(item, data, view);
  return { objects: [], facts };
}
