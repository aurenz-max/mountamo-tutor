/**
 * revision-workshop on the teaching workspace (OB-7L, following R12). Every mode revises a draft:
 *   - add-details, word-choice, combine-sentences, transitions, concision: one target sentence per item; the learner
 *     types the revised sentence. Code catches an unchanged sentence, a too-short one, a combine still split in two,
 *     and a "concise" one that is not shorter; the shared writing judge checks the revision does the skill's job.
 *   - reorganize: the learner orders the draft's sentences; the targets' order is the answer, checked in code.
 *   - build_combine (open build): the learner MAKES one sentence from two ideas' clause tiles and joining words; many
 *     joins pass (and, but, because, so, when), judged by the writing judge for keeping both ideas and making sense.
 * The generator's `idealRevision` is never shown: it is this item's answer.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';

export type RevisionSkill = 'add-details' | 'word-choice' | 'combine-sentences' | 'transitions' | 'concision' | 'reorganize';
export interface RevisionTarget { targetId: string; originalText: string; suggestion?: string; idealRevision?: string }
export interface RevisionPayload { revisionSkill: RevisionSkill; draft: string; targets: RevisionTarget[] }

export type RevisionMiss = 'unchanged' | 'too_short' | 'not_combined' | 'not_shorter' | 'not_sense' | 'wrong_job' | 'wrong_order';
export const TYPED_MISSES: readonly RevisionMiss[] = ['unchanged', 'too_short', 'not_combined', 'not_shorter', 'not_sense', 'wrong_job'];

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

export interface RevisionItem { id: string; skill: RevisionSkill; original: string; suggestion: string; ask: string; criterion: string }

/** One item per target; reorganize is one item for the whole draft. */
export function revisionItems(p: RevisionPayload): RevisionItem[] {
  const targets = (p?.targets ?? []).filter(t => t && typeof t.originalText === 'string' && t.originalText.trim());
  if (p?.revisionSkill === 'reorganize') {
    return targets.length >= 3 ? [{ id: 'order', skill: 'reorganize', original: p.draft, suggestion: '', criterion: '',
      ask: 'Put the sentences in the order that makes sense.' }] : [];
  }
  const job = JOB[p?.revisionSkill as Exclude<RevisionSkill, 'reorganize'>];
  if (!job) return [];
  return targets.map((t, i) => ({ id: t.targetId || `r${i + 1}`, skill: p.revisionSkill, original: t.originalText.trim(),
    suggestion: (t.suggestion ?? '').trim(), ask: job.ask, criterion: job.criterion }));
}

const words = (s: string) => s.trim().split(/\s+/).filter(w => /[a-z]/i.test(w));
const sentences = (s: string) => s.split(/[.!?]+/).filter(x => words(x).length > 0).length;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

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

export const revisionAssignment = (item: RevisionItem): TeachingAssignment => ({ id: item.id, task: item.ask, response: 'gesture' });

export const revisionJudgeRequest = (item: RevisionItem, revised: string, draft: string, grade?: string): WordBuildJudgeRequest => ({
  ask: `${item.ask} Original: "${item.original}". (${item.criterion})`, made: revised.trim(), unit: 'writing', context: draft,
  ...(grade ? { grade } : {}),
});

export function revisionScene(item: RevisionItem, draft: string, typed: string, inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: item.ask,
    draft: draft.length > 480 ? `${draft.slice(0, 477)}...` : draft,
    ...(item.skill === 'reorganize' ? { order: typed || 'nothing placed' } : { sentenceToRevise: item.original, revision: typed.trim() || 'empty' }),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: item.skill === 'reorganize'
      ? 'The learner taps the draft\'s sentences into order and presses "I\'m done!". You cannot move a sentence.'
      : 'The learner types a revised sentence and presses "I\'m done!". The builder checks it is changed and does this '
        + 'revision\'s job; spelling is not judged. Many revisions pass. You cannot type for the learner.',
  } };
}

// ── Levers ───────────────────────────────────────────────────────────────────
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

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly RevisionMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function revisionLevers(item: RevisionItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  if (item.skill === 'reorganize') return [
    lever(MODEL_LEVER, 'help', ['wrong_order'], 'The learner\'s order does not make sense.',
      'Shows two other sentences put in order, so the learner sees order words (first, then) doing their job.', pulled),
  ];
  return [
    ...(item.suggestion ? [lever(HINT_LEVER, 'help', ['unchanged', 'wrong_job', 'not_combined', 'not_shorter'],
      'The learner does not know what to change, or the change does a different job.',
      'Shows the revision tip for this sentence (what kind of change to make), never a revised sentence.', pulled)] : []),
    lever(MODEL_LEVER, 'help', ['wrong_job', 'not_sense', 'not_combined', 'not_shorter'],
      'The learner\'s revision does a different job or does not make sense.',
      'Shows one revision of a DIFFERENT sentence for this skill, before and after.', pulled),
    lever(EDIT_LEVER, 'help', ['too_short', 'unchanged', 'not_sense'],
      'The learner cannot start from a blank box.',
      'Puts the original sentence in the box so the learner changes it instead of retyping it.', pulled),
  ];
}

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
