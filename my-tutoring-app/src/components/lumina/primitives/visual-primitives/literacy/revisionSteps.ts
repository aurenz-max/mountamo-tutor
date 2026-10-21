/**
 * revision-workshop on the teaching workspace (OB-7L, following R12), wired from its boss (`revisionWorkshop.boss.ts`).
 * Every mode revises a draft:
 *   - add-details, word-choice, combine-sentences, transitions, concision: one target sentence per item; the learner
 *     types the revised sentence. Code catches an unchanged sentence, a too-short one, a combine still split in two,
 *     and a "concise" one that is not shorter; the shared writing judge checks the revision does the skill's job.
 *   - reorganize: the learner orders the draft's sentences; the targets' order is the answer, checked in code.
 * The generator's `idealRevision` is never shown: it is this item's answer.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';
import type { RevisionMiss } from './revisionWorkshop.card';
import { mixedOrder } from './sentenceOrder';

export { REVISION_MISSES_BY_MODE, type RevisionMiss } from './revisionWorkshop.card';

export type RevisionSkill = 'add-details' | 'word-choice' | 'combine-sentences' | 'transitions' | 'concision' | 'reorganize';
export interface RevisionTarget { targetId: string; originalText: string; suggestion?: string; idealRevision?: string; alternatives?: string[] }
export interface RevisionPayload { revisionSkill: RevisionSkill; draft: string; targets: RevisionTarget[]; supportTier?: SupportTier }

/** The eval mode each skill runs as. */
export const MODE_OF: Record<RevisionSkill, string> = {
  'add-details': 'add_details', 'word-choice': 'word_choice', 'combine-sentences': 'combine_sentences',
  transitions: 'transitions', concision: 'concision', reorganize: 'reorganize',
};

const JOB: Record<Exclude<RevisionSkill, 'reorganize'>, { ask: string; criterion: string }> = {
  'add-details': { ask: 'Rewrite the sentence and add a detail: what it looked, sounded or felt like, how many, or which kind.',
    criterion: 'It keeps the meaning of the original and adds at least one specific detail.' },
  'word-choice': { ask: 'Rewrite the sentence with a stronger, more exact word in place of a plain one.',
    criterion: 'It keeps the meaning and replaces a plain or vague word with a more exact, vivid word.' },
  'combine-sentences': { ask: 'Join these sentences into one sentence that keeps every idea.',
    criterion: 'It is ONE sentence that keeps every idea of the originals, joined with a joining word.' },
  transitions: { ask: 'Rewrite the sentence with a transition word that shows how it connects to the sentence before.',
    criterion: 'It adds a transition word or phrase (first, next, then, also, however, so) that fits how the ideas connect.' },
  concision: { ask: 'Rewrite the sentence in fewer words, keeping what it says.',
    criterion: 'It says the same thing in fewer words, removing repeated or extra words.' },
};

export interface RevisionSentence { id: string; text: string }
export interface RevisionItem {
  id: string;
  skill: RevisionSkill;
  /** The eval mode (`MODE_OF`). */
  mode: string;
  original: string;
  suggestion: string;
  ask: string;
  criterion: string;
  /** The generator's revisions of this sentence: never shown, and no clue may name one. */
  ideal: string[];
  /** reorganize: the draft's sentences in the order that makes sense (the answer). Empty on a typed item. */
  sentences: RevisionSentence[];
  /** The lesson's support tier, stamped on each item (when the model lever comes). */
  supportTier?: SupportTier;
}

/** One item per target; reorganize is one item for the whole draft. */
export function revisionItems(p: RevisionPayload): RevisionItem[] {
  const targets = (p?.targets ?? []).filter(t => t && typeof t.originalText === 'string' && t.originalText.trim());
  const tier = p?.supportTier ? { supportTier: p.supportTier } : {};
  if (p?.revisionSkill === 'reorganize') {
    return targets.length >= 3 ? [{ id: 'order', skill: 'reorganize', mode: 'reorganize', original: p.draft, suggestion: '',
      criterion: '', ask: 'Put the sentences in the order that makes sense.', ideal: [],
      sentences: targets.map(t => ({ id: t.targetId, text: t.originalText.trim() })), ...tier }] : [];
  }
  const job = JOB[p?.revisionSkill as Exclude<RevisionSkill, 'reorganize'>];
  if (!job) return [];
  return targets.map((t, i) => {
    const original = t.originalText.trim();
    const ideal = [t.idealRevision, ...(t.alternatives ?? [])]
      .filter((s): s is string => typeof s === 'string' && !!s.trim() && norm(s) !== norm(original)).map(s => s.trim());
    return { id: t.targetId || `r${i + 1}`, skill: p.revisionSkill, mode: MODE_OF[p.revisionSkill], original,
      suggestion: (t.suggestion ?? '').trim(), ask: job.ask, criterion: job.criterion, ideal, sentences: [], ...tier };
  });
}

const words = (s: string) => s.trim().split(/\s+/).filter(w => /[a-z]/i.test(w));
const sentences = (s: string) => s.split(/[.!?]+/).filter(x => words(x).length > 0).length;
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/** What code checks before any judge. */
export function revisionShapeMiss(item: RevisionItem, revised: string): RevisionMiss | undefined {
  if (norm(revised) === norm(item.original)) return 'unchanged';
  // A word-choice target can be one word; the revision is then a word or phrase.
  if (words(revised).length < Math.min(3, words(item.original).length)) return 'too_short';
  if (item.skill === 'combine-sentences' && sentences(revised) > 1) return 'not_combined';
  if (item.skill === 'concision' && words(revised).length >= words(item.original).length) return 'not_shorter';
  return undefined;
}

/** reorganize: the targets list is the answer order. */
export const orderMiss = (p: RevisionPayload, order: readonly string[]): RevisionMiss | undefined =>
  order.length === p.targets.length && order.every((id, i) => id === p.targets[i].targetId) ? undefined : 'wrong_order';

/**
 * reorganize's sentence cards: a stable mixed order (the same on every render) that is never the answer and never
 * holds three sentences together as the answer has them (`mixedOrder`). The generator's scrambled draft is not used:
 * its order is the model's.
 */
export const boardOrder = (item: RevisionItem): RevisionSentence[] =>
  mixedOrder(item.sentences, s => s.text, [item.sentences.map(s => s.text)], item.sentences.map(s => s.id).join('|') + item.id);

export const revisionJudgeRequest = (item: RevisionItem, revised: string, draft: string, grade?: string): WordBuildJudgeRequest => ({
  ask: `${item.ask} Original: "${item.original}". (${item.criterion})`, made: revised.trim(), unit: 'writing', context: draft,
  ...(grade ? { grade } : {}),
});

/**
 * What the tutor is told: the task, and on a typed item the draft, the marked sentence and the learner's revision; on
 * reorganize the sentences in board order (`boardOrder`, never the answer's) and the learner's order as text. The moves
 * are the card's; this says what the builder checks.
 */
export function revisionScene(item: RevisionItem, draft: string, typed: string, placed: number, inspectorSaid?: string): SceneOf {
  if (item.skill === 'reorganize') {
    return { objects: [], facts: {
      ask: item.ask,
      sentences: boardOrder(item).map(s => s.text).join(' | '),
      order: typed || 'nothing placed',
      sentencesPlaced: placed,
      ...(inspectorSaid ? { inspectorSaid } : {}),
      constraints: 'The builder checks the whole order at once; one order makes sense.',
    } };
  }
  return { objects: [], facts: {
    ask: item.ask,
    draft: draft.length > 480 ? `${draft.slice(0, 477)}...` : draft,
    sentenceToRevise: item.original,
    revision: typed.trim() || 'empty',
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The builder checks the revision is changed and does this revision\'s job; spelling is not judged. Many revisions pass.',
  } };
}

// ── Levers (declared in `revisionWorkshopLevers.ts`) ─────────────────────────
export const HINT_LEVER = 'revision_hint';
export const MODEL_LEVER = 'model_revision';
export const EDIT_LEVER = 'edit_original';

/** A solved revision of a different sentence, per skill (code-owned). */
export const MODEL_REVISION: Record<RevisionSkill, [string, string]> = {
  'add-details': ['The dog ran.', 'The fluffy brown dog raced across the wet grass.'],
  'word-choice': ['The cake was good.', 'The cake was delicious.'],
  'combine-sentences': ['It rained. We stayed inside.', 'It rained, so we stayed inside.'],
  transitions: ['We ate lunch. We went outside.', 'We ate lunch. Then we went outside.'],
  concision: ['The big huge tree was very tall and high.', 'The huge tree was very tall.'],
  reorganize: ['Then I brushed my teeth. First I woke up.', 'First I woke up. Then I brushed my teeth.'],
};

export function revisionMissWords(miss: RevisionMiss | undefined): string {
  switch (miss) {
    case 'unchanged': return 'That is the same as before. Change it to do the job.';
    case 'too_short': return 'Write the whole sentence.';
    case 'not_combined': return 'That is still more than one sentence. Join them into one.';
    case 'not_shorter': return 'Try saying it in fewer words.';
    case 'not_sense': return 'Read it out loud. Does it make sense?';
    case 'wrong_job': return 'Read the task again. Does your sentence do that?';
    case 'wrong_order': return 'Read it in that order. Does it make sense? Look for order words.';
    default: return 'Not quite. Try again.';
  }
}
