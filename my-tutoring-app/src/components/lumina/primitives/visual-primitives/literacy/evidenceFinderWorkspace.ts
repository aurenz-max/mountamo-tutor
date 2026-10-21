/**
 * Evidence finder on the shared tutor/JEV teaching workspace: the items, the ask, the activity's check and the scene.
 * The card is `evidenceFinder.card.ts`, the boss `evidenceFinder.boss.ts`.
 *
 * One generated passage is one or two checked items, the activity's own steps: `find` (highlight every sentence that
 * is evidence, each under the claim it supports) and, when the passage carries the CER scaffold (`cerEnabled`, the
 * evaluate_evidence_strength mode), `rate` (rate each evidence sentence Strong, Moderate or Weak). Each item carries the
 * passage it is asked on (the session's, or a practice passage a simplify lever opened). The activity's own check is
 * the judge, so the tutor is never told which sentences are evidence, which claim one supports, or how strong it is.
 *
 * Pure: the component, the boss and the levers read the same items, ask and scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { EvidenceFinderData } from './EvidenceFinder';
import type { EvidenceFinderMiss } from './evidenceFinder.card';

export { FIND_MISSES, RATE_MISSES, type EvidenceFinderMiss } from './evidenceFinder.card';

export type Strength = 'strong' | 'moderate' | 'weak';
export type EvidenceSentence = EvidenceFinderData['passage']['sentences'][number];
/** The item's step on the card. */
export type EvidenceStep = 'find' | 'rate';

/** One checked item: a step of the activity on one passage. */
export interface EvidenceFinderItem {
  /** `find` / `rate`, or `<step>~simpler` for a practice passage. */
  id: string;
  kind: EvidenceStep;
  /** The passage this item is asked on. */
  data: EvidenceFinderData;
  supportTier?: SupportTier;
}

export const STRENGTHS: readonly Strength[] = ['strong', 'moderate', 'weak'];
export const STRENGTH_LABELS: Record<Strength, string> = { strong: 'Strong', moderate: 'Moderate', weak: 'Weak' };

export const PRACTICE_SUFFIX = '~simpler';
export const practiceId = (step: EvidenceStep) => `${step}${PRACTICE_SUFFIX}`;
/** The step of a practice item's id, or null for a session item. */
export const practicePhase = (id: string | null | undefined): EvidenceStep | null =>
  (id?.endsWith(PRACTICE_SUFFIX) ? id.slice(0, -PRACTICE_SUFFIX.length) as EvidenceStep : null);
export const isPractice = (item: Pick<EvidenceFinderItem, 'id'>) => practicePhase(item.id) !== null;

/** The CER scaffold is on: the strength rating is asked as its own checked item. */
const asksRating = (data: Pick<EvidenceFinderData, 'cerEnabled'>): boolean => !!data.cerEnabled;

export function evidenceFinderItems(data: EvidenceFinderData): EvidenceFinderItem[] {
  const tier = data.supportTier ? { supportTier: data.supportTier } : {};
  return [{ id: 'find', kind: 'find' as const, data, ...tier },
    ...(asksRating(data) ? [{ id: 'rate', kind: 'rate' as const, data, ...tier }] : [])];
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

/** What the learner has done on the open step. */
export interface EvidenceFinderView {
  /** sentenceId -> the claim index it is highlighted under. */
  highlighted: Readonly<Record<string, number>>;
  /** sentenceId -> the learner's strength rating. */
  ratings: Readonly<Partial<Record<string, Strength>>>;
}

export const EMPTY_VIEW: EvidenceFinderView = { highlighted: {}, ratings: {} };

const quote = (s: { text: string }) => `"${s.text.trim()}"`;
const claimName = (data: EvidenceFinderData, i: number) => (data.claims.length > 1 ? `claim ${i + 1}` : 'the claim');

/** What the learner is asked on one item. Never which sentences are evidence. */
export function askFor(item: EvidenceFinderItem): string {
  const { data } = item;
  const lead = isPractice(item) ? 'Practice passage: ' : '';
  if (item.kind === 'rate') return `${lead}Rate how strong each piece of evidence is: Strong, Moderate or Weak.`;
  return data.claims.length > 1
    ? `${lead}Highlight every sentence in the passage that is evidence for one of the claims, under the claim it supports: `
      + data.claims.map((c, i) => `claim ${i + 1}, "${c.text.trim()}"`).join('; ') + '.'
    : `${lead}Highlight every sentence in the passage that is evidence for the claim: "${data.claims[0]?.text.trim() ?? ''}".`;
}

/** The learner's work in their own terms, never the key. */
export function describeEvidenceWork(step: EvidenceStep, data: EvidenceFinderData, view: EvidenceFinderView): string {
  if (step === 'rate') {
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

function evidenceFinderCorrect(step: EvidenceStep, data: EvidenceFinderData, view: EvidenceFinderView): boolean {
  return step === 'find' ? findCorrect(data, view.highlighted) : rateCorrect(data, view.ratings);
}

const RANK: Record<Strength, number> = { weak: 0, moderate: 1, strong: 2 };

/** What a wrong check shows (the card's misses), from the work the check reads. */
export function evidenceFinderMiss(step: EvidenceStep | null | undefined, data: EvidenceFinderData,
  view: EvidenceFinderView): EvidenceFinderMiss | undefined {
  if (!step || evidenceFinderCorrect(step, data, view)) return undefined;
  if (step === 'find') {
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

/**
 * What is drawn and asked. Sentences are listed in passage order and never marked as evidence. `constraints` holds
 * only what teaches the skill without naming an answer (from the old guidance and commonStruggles); the moves and the
 * judging are the card's. The lever set adds `support` and `onScreen` (`leverScene`).
 */
export function workspaceScene(item: EvidenceFinderItem, view: EvidenceFinderView): SceneOf {
  const { data } = item;
  const facts: Record<string, string> = { kind: item.kind, title: data.title };
  data.claims.forEach((c, i) => { facts[data.claims.length > 1 ? `claim${i + 1}` : 'claim'] = c.text.trim(); });
  if (item.kind === 'find') {
    data.passage.sentences.forEach((s, i) => { facts[`sentence${i + 1}`] = s.text.trim(); });
    facts.constraints = 'Evidence states a fact that proves the claim; a sentence that is only about the topic, or is '
      + 'someone\'s opinion, is not evidence. Teaching is asking about the claim: what would prove it, did the author '
      + 'say that or is it someone\'s idea, does this sentence prove the claim or only talk about the topic.';
  } else {
    rateList(data).forEach((s, i) => {
      facts[`evidence${i + 1}`] = data.claims.length > 1 ? `${s.text.trim()} (for claim ${claimOf(data, s) + 1})` : s.text.trim();
    });
    facts.constraints = 'Strong evidence gives a specific fact that proves the claim; weak evidence only mentions the '
      + 'idea. Teaching is asking whether a sentence proves the claim or just mentions it.';
  }
  facts.learnerWork = describeEvidenceWork(item.kind, data, view);
  return { objects: [], facts };
}
