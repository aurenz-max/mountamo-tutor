/** Expression practice: a page-work plan, a first read, then a modeled reread.
 * Only the reread feeds the existing modeled word-accuracy score. Planning and
 * first-read observations remain separate evidence, never prosody measurements.
 */
import type { DiActionContract, JudgedCueOptions } from '../../../hooks/judgedScriptContract';
import type { JudgedRunOutcome, JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import {
  itemCue, itemsFromLines, judgingContract, moveOnCue, pronounceCue, sanitizeLine,
  type ReadAloudItem, type ReadAloudLineLike, type ReadAloudMode,
} from './readAloudStudioScript';

export type PhrasingStep = 'mark' | 'first_read' | 'reread';
export interface StudioItem extends ReadAloudItem {
  lineId: string;
  step?: PhrasingStep;
  modelGroups: string[];
  actionContract: DiActionContract;
}

/** Bind whole groups to the exact sanitized printed line, not fuzzy matches.
 * Legacy payloads have no groups and receive a one-phrase model.
 */
export function phraseGroupsFor(line: ReadAloudLineLike): string[] {
  const text = sanitizeLine(line.text);
  const groups = line.phraseGroups;
  if (!Array.isArray(groups) || groups.length < 1 || groups.length > 3
    || groups.some((group) => typeof group !== 'string' || !sanitizeLine(group))) return [text];
  const normalized = groups.map(sanitizeLine);
  // This pilot models only explicit punctuation boundaries. A generated
  // arbitrary split can teach an unnatural pause ("warmed / the ground").
  // The learner remains free to explore any boundary; this guards the model.
  if (normalized.slice(0, -1).some((group) => !/[,;:]$/.test(group))) return [text];
  return normalized.join(' ') === text ? normalized : [text];
}

export function markedGroups(text: string, breaks: readonly number[]): string[] {
  const words = text.split(' ');
  const boundaries = new Set(breaks.filter((n) => Number.isInteger(n) && n > 0 && n < words.length));
  const groups: string[] = [];
  let start = 0;
  for (let i = 1; i <= words.length; i++) {
    if (boundaries.has(i) || i === words.length) {
      groups.push(words.slice(start, i).join(' '));
      start = i;
    }
  }
  return groups;
}

const ACTIONS: Record<PhrasingStep, DiActionContract> = {
  mark: { id: 'mark', label: 'Mark phrases', icon: '|', answerKind: 'gesture',
    instruction: 'Tap between words to mark small pauses. Then tap Use my phrase plan.',
    checkingInstruction: 'Saving your phrase plan.' },
  first_read: { id: 'first_read', label: 'First reading', icon: '1', answerKind: 'voice',
    instruction: 'Read the line aloud using your phrase marks.', checkingInstruction: 'Listening to your first reading.' },
  reread: { id: 'reread', label: 'Listen and reread', icon: '2', answerKind: 'voice',
    instruction: 'Listen to my phrases, then read the line again.', checkingInstruction: 'Listening to your rereading.' },
};

export function studioItems(lines: ReadAloudLineLike[], mode: ReadAloudMode): StudioItem[] {
  return itemsFromLines(lines, mode).flatMap((item) => {
    const source = lines[Number(item.id.slice(5)) - 1];
    const modelGroups = phraseGroupsFor(source);
    if (mode !== 'expression') return [{ ...item, lineId: item.id, modelGroups,
      actionContract: { id: mode, label: mode === 'accuracy' ? 'Read it' : 'Character voice',
        icon: '1', answerKind: 'voice', instruction: mode === 'accuracy'
          ? 'Read the line aloud.' : 'Listen, then read in the character’s voice.',
        checkingInstruction: 'Listening to your reading.' } }];
    return (['mark', 'first_read', 'reread'] as const).map((step): StudioItem => ({
      ...item, id: `${item.id}-${step}`, lineId: item.id, step, modelGroups,
      answerKind: ACTIONS[step].answerKind,
      responseClass: step === 'mark' ? 'manipulation' : 'sentence_read_aloud',
      action: `expression-${step}`, actionContract: ACTIONS[step],
    }));
  });
}

const planningRules = 'This is an unscored reading plan, not a correct/incorrect phrase test. '
  + 'Do not judge microphone speech or read the printed line during planning. '
  + 'Wait for [RA_PLAN] before acknowledging the committed page work. Never speak a verdict before that commit.';

function phraseAsk(item: StudioItem): string {
  if (item.step === 'mark') return item.actionContract.instruction;
  if (item.step === 'first_read') return item.actionContract.instruction;
  const coaching = item.modelGroups.length > 1
    ? 'Words in each group belong together. Listen for a small pause between groups.'
    : 'These words belong together. Listen as I read them smoothly.';
  return `${coaching} Listen: ${item.text} Your turn. Read the line again.`;
}

function phraseRules(item: StudioItem, breaks: readonly number[]): string {
  if (item.step === 'mark') return planningRules;
  const delivery = item.step === 'first_read'
    ? `Do NOT read the line or model any words before this first attempt. The learner's plan is ${JSON.stringify(markedGroups(item.text, breaks))}. A phrase mark is a pause, never a spoken word. `
    : `During the Listen model, read these groups in order: ${JSON.stringify(item.modelGroups)}. Keep each group smooth; use a short natural pause between groups. Never speak separators or quote marks. ${item.stressWord ? `Gently stress ${item.stressWord}. ` : ''}The model is ONE possible grouping, not a unique answer key. `;
  return delivery + judgingContract(item)
    + ' Phrase placement, pauses, stress and expression are coaching only. Never claim their prosody improved or failed. '
    + 'Only a word error can trigger a correction. Never penalize a different meaningful grouping.';
}

export function studioItemCue(item: StudioItem, opts: Partial<JudgedCueOptions> = {}, breaks: readonly number[] = []): string {
  if (!item.step) return itemCue(item, opts);
  const opening = opts.opening
    ? 'Hi! We will mark phrases, read, listen, and read again. You can also keep a line as one phrase. ' : '';
  return `[RA_ITEM] Say exactly: "${opening}${phraseAsk(item)}" ${phraseRules(item, breaks)} Never read bracket tags aloud.`;
}

export function studioHearCue(item: StudioItem, breaks: readonly number[] = []): string {
  if (!item.step) return pronounceCue(item);
  return `[RA_HEAR] Say exactly: "${phraseAsk(item)}" ${phraseRules(item, breaks)} `
    + 'This is an instruction replay: do not judge anything just heard. Then wait. Never read bracket tags aloud.';
}

export function studioMoveCue(item: StudioItem, next: StudioItem | null, opts: Partial<JudgedCueOptions> = {}, breaks: readonly number[] = []): string {
  if (!item.step && !next?.step) return moveOnCue(item, next, opts);
  if (!next) return '[RA_MOVE] Say exactly: "Good effort. We have finished our reading practice." Then stop — the activity is over.';
  return `[RA_MOVE] Stop correcting the previous item. Say exactly: "Good effort. ${phraseAsk(next)}" ${phraseRules(next, breaks)} Never read bracket tags aloud.`;
}

export function phrasePlanCue(item: StudioItem, breaks: readonly number[]): string {
  return `[RA_PLAN] The learner committed this reading plan for ${item.lineId}: ${JSON.stringify(markedGroups(item.text, breaks))}. `
    + 'Acknowledge completion only, not correctness. Say exactly: "Yes, your phrase plan is ready." Then stop. '
    + 'Do not read the line, judge the placement, or judge microphone speech. Never read bracket tags aloud.';
}

export function scoredReadingItems(items: StudioItem[]): StudioItem[] {
  return items.filter((item) => !item.step || item.step === 'reread');
}

/** Keep a single scored reading per printed line, as before this extension.
 * A saved plan and the additional first read must not inflate the result.
 */
export function readingSummary(items: StudioItem[], summary: JudgedRunSummary) {
  const ids = new Set(scoredReadingItems(items).map((item) => item.id));
  const outcomes: JudgedRunOutcome[] = summary.outcomes.filter((outcome) => ids.has(outcome.id));
  const accuracy = outcomes.length ? Math.round(outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length) : 0;
  return { outcomes, accuracy, passed: accuracy >= 60,
    solvedCount: outcomes.filter((o) => o.solved).length,
    firstTryCount: outcomes.filter((o) => o.solved && o.corrections === 0).length,
    attemptsCount: outcomes.reduce((sum, o) => sum + 1 + o.corrections, 0) };
}
