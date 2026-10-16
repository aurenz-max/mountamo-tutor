/**
 * Fact file on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, C33).
 *
 * Pure: the component, the adapter and the journey row read the same items, checks and scene. Each self-check is one
 * item. Where it is answered is the mode's defining property, stamped per check by the generator (`fileOpen`):
 * - explore: the fact file stays open beside the question (find it);
 * - recall / apply: the learner reads the file first, then the file closes (key stats included) while the questions
 *   are asked (remember it, or reason from it).
 * A tap is checked by `isCheckCorrect`. When every choice can be said, the item also takes its answer spoken (J14): the
 * key reaches the observer as `expectedAnswer`. The scene never states the key, the explanation, the file's text or
 * the section the question comes from (that is the `point_to_section` lever).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { FactFileData, FactFileCheck, FactFileSection } from './FactFile';

export const SECTION_LABEL: Record<FactFileSection, string> = {
  keyStats: 'Key Stats', quickFacts: 'Quick Facts', deepDive: 'Deep Dive', records: 'Records', didYouKnow: 'Did You Know?',
};
export const SECTION_ICON: Record<FactFileSection, string> = {
  keyStats: '📊', quickFacts: '⚡', deepDive: '🔍', records: '🏆', didYouKnow: '💡',
};

/** The checks as items: a stable id on each (a legacy payload has none). */
export function factChecks(data: Pick<FactFileData, 'selfChecks'>): FactFileCheck[] {
  return (data.selfChecks ?? []).map((c, i) => (c.id ? c : { ...c, id: `check-${i + 1}` }));
}

export const isCheckCorrect = (check: FactFileCheck, optionIndex: number) => optionIndex === check.correctIndex;
export const keyOf = (check: FactFileCheck) => check.options[check.correctIndex] ?? '';

/** The tabs a file shows, in order, only those with content. */
export function fileTabs(data: Pick<FactFileData, 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow'>): Array<Exclude<FactFileSection, 'keyStats'>> {
  return (['quickFacts', 'deepDive', 'records', 'didYouKnow'] as const).filter(k => (data[k]?.length ?? 0) > 0);
}

/** Every word the file prints, lower case, punctuation as spaces. */
export function fileText(data: Partial<FactFileData>): string {
  const parts = [
    data.description ?? '',
    ...(data.keyStats ?? []).map(s => `${s.label} ${s.value} ${s.unit}`),
    ...(data.quickFacts ?? []).map(f => f.fact),
    ...(data.deepDive ?? []).map(d => `${d.heading} ${d.body} ${d.detail ?? ''}`),
    ...(data.records ?? []).map(r => `${r.label} ${r.value}`),
    ...(data.didYouKnow ?? []).map(d => d.text),
  ];
  return normText(parts.join(' '));
}
export const normText = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9À-ÿ%]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const STOP = new Set(['the', 'and', 'that', 'with', 'from', 'they', 'them', 'their', 'this', 'have', 'has', 'are', 'was',
  'were', 'for', 'its', 'can', 'will', 'into', 'than', 'then', 'about', 'very', 'more', 'most', 'some', 'only', 'also']);
const contentWords = (s: string) => normText(s).trim().split(' ').filter(w => w.length >= 3 && !STOP.has(w));

/**
 * Whether the file states this choice: the phrase appears as printed, or (two or more content words) at least three
 * quarters of its content words appear. Used to name a miss and to rank generated checks, never to grade.
 */
export function statedInFile(option: string, text: string): boolean {
  const phrase = normText(option);
  if (phrase.trim().length >= 2 && text.includes(phrase)) return true;
  const words = contentWords(option);
  if (words.length < 2) return false;
  return words.filter(w => text.includes(` ${w} `)).length / words.length >= 0.75;
}

/** A choice a learner can say: a number, a word or a short phrase (no emoji or symbols). */
const SAYABLE = /^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ '.,:%/-]*$/;
const sayable = (o: string) => SAYABLE.test(o.trim()) && o.trim().length <= 30 && o.trim().split(/\s+/).length <= 4;
/** Every choice can be said and names itself, so saying one is as deliberate as tapping it. */
export const checkSpoken = (check: FactFileCheck) => check.options.length > 0 && check.options.every(sayable);

/**
 * What a wrong choice shows (`TeachingAttempt.miss`), from the choice and the file alone:
 * - `other_file_fact`: the choice is something the file states (a fact from elsewhere in the file, mixed up);
 * - `not_in_file`: the file does not state the choice.
 */
export type FactFileMiss = 'other_file_fact' | 'not_in_file';

export function factFileMiss(check: FactFileCheck | null | undefined, picked: number | null, text: string): FactFileMiss | undefined {
  if (!check || picked === null || isCheckCorrect(check, picked)) return undefined;
  const option = check.options[picked];
  if (option === undefined) return undefined;
  return statedInFile(option, text) ? 'other_file_fact' : 'not_in_file';
}

/** A spoken answer's known wrong answers, named with the tap's ids, concrete for this check. */
export function factFileSpokenMisses(check: FactFileCheck, text: string): KnownMiss[] {
  if (!checkSpoken(check)) return [];
  const others = check.options.filter((_, i) => !isCheckCorrect(check, i)).map(o => o.trim());
  const inFile = others.filter(o => statedInFile(o, text)), outside = others.filter(o => !statedInFile(o, text));
  return [
    ...(inFile.length ? [{ id: 'other_file_fact', pattern: `The learner's answer is another choice that the fact file states about something else: ${inFile.join(', ')}.`, examples: inFile.slice(0, 3) }] : []),
    ...(outside.length ? [{ id: 'not_in_file', pattern: `The learner's answer is a choice the fact file does not state: ${outside.join(', ')}.`, examples: outside.slice(0, 3) }] : []),
  ];
}

export function workspaceAssignment(check: FactFileCheck, text = ''): TeachingAssignment {
  if (!checkSpoken(check)) return { id: check.id!, task: check.question, response: 'gesture' };
  return { id: check.id!, task: `${check.question} The learner answers by saying a choice or tapping it.`,
    response: 'speech', acceptsGesture: true, expectedAnswer: keyOf(check), misses: factFileSpokenMisses(check, text) };
}

export interface FactFileView {
  /** The learner is still reading the file; the questions have not opened. */
  reading: boolean;
  /** The choice tapped on this try, or null. */
  picked: number | null;
  /** The pre-reader screen: pictures, no file. */
  preReader?: boolean;
}

/** The learner's work in their own terms, never the key. */
export function describeCheckWork(check: FactFileCheck, view: Pick<FactFileView, 'picked'>): string {
  return view.picked === null ? 'No choice tapped yet' : `Tapped "${check.options[view.picked]}"`;
}

/** What is drawn and asked. The choices are on screen, so they are listed; no key, explanation, file text or section. */
export function workspaceScene(data: Pick<FactFileData, 'title' | 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow'>,
  check: FactFileCheck, view: FactFileView): WorkspaceScene {
  const tabs = fileTabs(data).map(t => SECTION_LABEL[t]).join(', ');
  const spoken = checkSpoken(check);
  const where = view.preReader
    ? 'a picture question: the learner cannot read yet, so you read the question and every choice aloud'
    : check.fileOpen
      ? `look it up: the fact file stays open above the question (key stats and the tabs ${tabs}); the learner may open any tab to find the answer`
      : 'from memory: the learner read the fact file first; it is closed while the questions are asked, key stats included';
  return {
    objects: [],
    facts: {
      factFile: data.title,
      kind: where,
      ...(view.reading ? { phase: `reading: the learner is reading the fact file (key stats and the tabs ${tabs}). The questions are hidden until they have opened every tab and pressed Start questions. Help them read; do not ask the question yet` } : {}),
      question: check.question,
      choices: check.options.join(' | '),
      learnerWork: describeCheckWork(check, view),
      constraints: (spoken ? 'The learner answers by saying one choice or tapping it; a tap is checked at once by the activity. '
        : 'The learner answers by tapping one choice; the tap is checked at once by the activity. ')
        + 'You cannot see the fact file\'s text, and you cannot tap or open a tab for the learner.',
    },
  };
}

/** The journey row's answers for a check: the key's text, and the wrong choice whose miss comes first. */
export function factFileHarnessAnswers(check: FactFileCheck, text: string): { correct: string; wrong: string } {
  const correct = keyOf(check);
  const others = check.options.filter((_, i) => !isCheckCorrect(check, i));
  const wrong = others.find(o => statedInFile(o, text)) ?? others[0];
  if (!correct || !wrong) throw new Error('fact-file: the check has no key or no wrong choice');
  return { correct, wrong };
}
