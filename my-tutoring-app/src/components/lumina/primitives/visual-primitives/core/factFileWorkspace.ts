/**
 * fact-file's domain on the shared tutor/JEV teaching workspace: the items, the check, the spoken key, the misses and
 * the scene. The boss (`factFile.boss.ts`) builds the assignment from these; the card is `factFile.card.ts`.
 *
 * Pure: the component, the boss and the generator read the same values. Each self-check is one item. Where it is
 * answered is the mode's defining property, stamped per check by the generator (`fileOpen`):
 * - explore: the fact file stays open beside the question (find it);
 * - recall / apply: the learner reads the file first, then the file closes (key stats included) while the questions
 *   are asked (remember it, or reason from it).
 * A tap is checked by `isCheckCorrect`. When every choice can be said, the item also takes its answer spoken (J14) and
 * the tutor judges it against `factFileKey`. The scene never states the key, the explanation, the file's text or the
 * section the question comes from (that is the `point_to_section` lever).
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { askLeaks, containsPhrase, type SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { FactFileData, FactFileCheck, FactFileSection } from './FactFile';
import type { FactFileMiss } from './factFile.card';

export type { FactFileMiss };

export const SECTION_LABEL: Record<FactFileSection, string> = {
  keyStats: 'Key Stats', quickFacts: 'Quick Facts', deepDive: 'Deep Dive', records: 'Records', didYouKnow: 'Did You Know?',
};
export const SECTION_ICON: Record<FactFileSection, string> = {
  keyStats: '📊', quickFacts: '⚡', deepDive: '🔍', records: '🏆', didYouKnow: '💡',
};

/** The checks with a stable id on each (a legacy payload has none). */
export function factChecks(data: Pick<FactFileData, 'selfChecks'>): FactFileCheck[] {
  return (data.selfChecks ?? []).map((c, i) => (c.id ? c : { ...c, id: `check-${i + 1}` }));
}

/** One item: a check, with its id and the text of the file it is asked about (its misses read the file). */
export type FactFileItem = FactFileCheck & { id: string; fileText: string };

/** The lesson's items, in order: every check, each carrying the file's text. */
export function factItems(data: Partial<FactFileData>): FactFileItem[] {
  const text = fileText(data);
  return factChecks({ selfChecks: data.selfChecks }).map(c => ({ ...c, id: c.id!, fileText: text }));
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
 * The spoken key, or null when the check is only tapped: a choice that cannot be said, or a question that prints its
 * own answer, where saying it back proves nothing. A question that says every choice gets a menu key.
 */
export function factFileKey(check: FactFileCheck): SpokenKey | null {
  if (!checkSpoken(check)) return null;
  const answer = keyOf(check).trim();
  if (!answer) return null;
  const options = check.options.map(o => o.trim());
  if (options.every(o => containsPhrase(check.question, o))) return { answer, alsoAccept: [], menu: options };
  const key: SpokenKey = { answer, alsoAccept: [], signatureError: 'Naming two choices, or hedging between them, is not an answer.' };
  return askLeaks(check.question, key).length ? null : key;
}

/** What a wrong choice shows (the card's `FACT_FILE_MISSES`), from the choice and the file alone. */
export function factFileMiss(check: FactFileCheck | null | undefined, picked: number | null, text: string): FactFileMiss | undefined {
  if (!check || picked === null || isCheckCorrect(check, picked)) return undefined;
  const option = check.options[picked];
  if (option === undefined) return undefined;
  return statedInFile(option, text) ? 'other_file_fact' : 'not_in_file';
}

/** A spoken answer's known wrong answers, named with the tap's ids, concrete for this check. None on a tap-only check. */
export function factFileSpokenMisses(check: FactFileCheck, text: string): KnownMiss[] {
  if (!factFileKey(check)) return [];
  const others = check.options.filter((_, i) => !isCheckCorrect(check, i)).map(o => o.trim());
  const inFile = others.filter(o => statedInFile(o, text)), outside = others.filter(o => !statedInFile(o, text));
  return [
    ...(inFile.length ? [{ id: 'other_file_fact', pattern: `The learner's answer is another choice that the fact file states about something else: ${inFile.join(', ')}.`, examples: inFile.slice(0, 3) }] : []),
    ...(outside.length ? [{ id: 'not_in_file', pattern: `The learner's answer is a choice the fact file does not state: ${outside.join(', ')}.`, examples: outside.slice(0, 3) }] : []),
  ];
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

/**
 * What is drawn and asked. The choices are on screen, so they are listed; no key, explanation, file text or section
 * (the easy tier's section note is on screen from the start, so it is stated as drawn). The constraints are this
 * activity's own: the tutor cannot see the file, and how the answer may not be described.
 */
export function workspaceScene(data: Pick<FactFileData, 'title' | 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow'>,
  check: FactFileCheck, view: FactFileView): SceneOf {
  const tabs = fileTabs(data).map(t => SECTION_LABEL[t]).join(', ');
  const where = view.preReader
    ? 'a picture question: the learner cannot read yet, so you read the question and every choice aloud'
    : check.fileOpen
      ? `look it up: the fact file stays open above the question (key stats and the tabs ${tabs}); the learner may open any tab to find the answer`
      : 'from memory: the learner read the fact file first; it is closed while the questions are asked, key stats included';
  const note = check.sectionHint && check.relatedSection && !view.preReader
    ? `${SECTION_ICON[check.relatedSection]} ${SECTION_LABEL[check.relatedSection]}` : null;
  return {
    objects: [],
    facts: {
      factFile: data.title,
      kind: where,
      ...(view.reading ? { phase: `reading: the learner is reading the fact file (key stats and the tabs ${tabs}). The questions are hidden until they have opened every tab and pressed Start questions. Help them read; do not ask the question yet` } : {}),
      question: check.question,
      choices: check.options.join(' | '),
      ...(note ? { sectionNote: check.fileOpen
        ? `a note under the question says the question comes from the ${note} section, and that tab is ringed`
        : `a note under the question says the question comes from the ${note} section; the file stays closed` } : {}),
      learnerWork: describeCheckWork(check, view),
      constraints: (factFileKey(check) ? '' : 'This item is answered only by a tap, and you are not told its answer. ')
        + 'You cannot see the fact file\'s text: never state a fact, number or detail as if from it, and you cannot open a tab. '
        + 'Read the choices aloud in the order shown, in the same voice for each. '
        + 'Teach what the question asks and how to look it up or remember it, never the content of the answer.',
      neverSay: 'Never describe a choice by what it says or is about ("the one about species"), never say what a wrong '
        + 'choice is or means, and never hint at the idea the answer rests on ("heavier or lighter?"). '
        + 'Never name a section of the file in words, not even as a memory cue ("think back to the Key Stats")'
        + (check.relatedSection && !check.sectionHint && !view.preReader ? ': point_to_section shows it, recorded as help.' : '.'),
    },
  };
}

/** The harness's answers for a check: the key's text, and the wrong choice whose miss comes first. */
export function factFileHarnessAnswers(check: FactFileCheck, text: string): { correct: string; wrong: string } {
  const correct = keyOf(check);
  const others = check.options.filter((_, i) => !isCheckCorrect(check, i));
  const wrong = others.find(o => statedInFile(o, text)) ?? others[0];
  if (!correct || !wrong) throw new Error('fact-file: the check has no key or no wrong choice');
  return { correct, wrong };
}
