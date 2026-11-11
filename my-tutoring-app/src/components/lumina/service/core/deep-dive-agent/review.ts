/**
 * Independent review of a DeepDive's checks, read the way the student meets
 * them: top to bottom, each check after the blocks above it. Code cannot judge
 * whether a check is answerable from the lesson, whether the block above gives
 * it away, or whether its distractors are ones no student would pick; a second
 * reader that did not write the lesson can.
 *
 * The reader is blind: it never sees a key and answers each check itself, from
 * only what the student has seen, and code compares (the kit's look.ts does the
 * same for practice-studio, 2026-11-07 probe).
 */

import { Type, ThinkingLevel, type Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import { choiceOf, drawnValues, isEvaluableBlock } from '../../../primitives/visual-primitives/core/deep-dive/deepDiveWorkspace';
import type { CheckBlockData, DeepDiveBlock, DeepDiveSection, MisconceptionBlockData, WorkedExampleBlockData } from '../../../primitives/visual-primitives/core/deep-dive/types';
import { displayParts } from '../../agent-kit/displays';
import { itemWords } from '../../agent-kit/look';
import { norm, visibleText } from './blocks';

export interface CheckVerdict {
  blockIndex: number;
  /** The option the blind reader picked, when it picked a different one from the key (set by code). */
  disagreed?: string;
  answerable: boolean;
  givenAway: boolean;
  weakDistractors: string[];
  note: string;
}

export interface ReviewResult {
  checks: CheckVerdict[];
  /** Essential ideas the lesson leaves out, judged against the topic and the lesson's job (at most 2). */
  missingIdeas: string[];
}

/** What the lesson is about, so the reviewer can judge coverage. */
export interface ReviewLesson {
  topic: string;
  intent?: string;
  outline?: DeepDiveSection[];
}

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    missingIdeas: {
      type: Type.ARRAY, items: { type: Type.STRING },
      description: 'At most 2 ideas, each one sentence, that a student must understand to explain this topic and that no block teaches. Empty when the lesson covers the topic for its job. Never trivia, never beyond the grade or the job.',
    },
    checks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blockIndex: { type: Type.INTEGER },
          answer: { type: Type.STRING, description: 'For a check with OPTIONS: the option you pick, copied exactly. Empty for a check with no OPTIONS.' },
          answerable: { type: Type.BOOLEAN, description: 'A student who read the blocks above can reach one answer.' },
          givenAway: { type: Type.BOOLEAN, description: 'The block right above, the label or the question states the answer in nearly the same words, so the student can match words without understanding.' },
          weakDistractors: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Wrong options, copied exactly, that no student at this grade would choose (absurd, joke, or off-topic).' },
          note: { type: Type.STRING, description: 'One sentence on what to change, or empty.' },
        },
        required: ['blockIndex', 'answer', 'answerable', 'givenAway', 'weakDistractors', 'note'],
      },
    },
  },
  required: ['missingIdeas', 'checks'],
};

/** Fields the student has not seen when the check is asked: the question and options are shown separately, the key never. */
const HIDDEN_UNTIL_ANSWERED = new Set(['question', 'options', 'correctIndex', 'explanation', 'optionEmojis', 'prediction', 'comprehension', 'patternCheck', 'correctAnswer', 'wordBank', 'sentence', 'tryStep']);

/**
 * What the reader picks from, and the key code compares its pick with. A kit check the reader can answer in one name
 * has one: the parts of a point board, or the cards of a choose item by number. A sort, an order, a set to build or a
 * board to change has none, and the reader only judges whether it can be answered.
 */
export function readerChoice(b: DeepDiveBlock): { question: string; options: string[]; correctIndex: number } | null {
  if (b.blockType !== 'check') return choiceOf(b);
  const it = (b as CheckBlockData).item;
  if (it.surface === 'point') { const parts = displayParts(it.board); return { question: it.prompt, options: parts, correctIndex: parts.indexOf(it.key as string) }; }
  if (it.surface === 'choose') return { question: it.prompt, options: it.options.map((_, i) => `Card ${i + 1}`), correctIndex: it.options.findIndex((o) => o.id === it.key) };
  return null;
}

/** A block's text as it stands before the student answers it. */
function shownBefore(b: DeepDiveBlock): string {
  // The kit's own words for an item: its prompt, its pictures and its cards, with no key and no hint for a miss.
  if (b.blockType === 'check') return itemWords((b as CheckBlockData).item).slice(0, 1600);
  if (b.blockType === 'worked-example' && (b as WorkedExampleBlockData).tryStep) {
    const w = b as WorkedExampleBlockData;
    return [w.problem, ...w.steps.slice(0, w.tryStep!.index).map((s) => `${s.work} (${s.reason})`)].join('\n');
  }
  // The belief is false on purpose; said plainly it reads as the lesson stating an error.
  if (b.blockType === 'misconception') {
    const m = b as MisconceptionBlockData;
    return `A wrong idea students hold, shown as wrong: "${m.belief}"\nWhat is true: ${m.actually}\nWhy: ${m.why}`;
  }
  // A mini-sim's states appear only after the student predicts.
  const rest = Object.fromEntries(Object.entries(b).filter(([k]) => !HIDDEN_UNTIL_ANSWERED.has(k) && !(b.blockType === 'mini-sim' && k === 'states'))) as unknown as DeepDiveBlock;
  // Drawn values are numbers, which the text walk skips; the reader needs them to answer from the picture.
  const drawn = drawnValues(b);
  return `${drawn ? `${drawn}\n` : ''}${visibleText(rest)}`.slice(0, 1200);
}

/** The lesson as the student meets it, with no key anywhere. */
export function studentView(blocks: DeepDiveBlock[]): string {
  return blocks.map((b, i) => {
    const choice = readerChoice(b);
    return `[${i}] ${b.blockType}${isEvaluableBlock(b) ? ' (CHECK)' : ''} "${b.label}"\n${shownBefore(b)}${choice ? `\nQUESTION: ${choice.question}\nOPTIONS: ${choice.options.join(' | ')}` : ''}`;
  }).join('\n\n');
}

type RawVerdict = Omit<CheckVerdict, 'disagreed'> & { answer?: string };

/** The index of the option a reader named: an exact match, else a match ignoring case and punctuation. */
function optionPicked(options: string[], said: string): number {
  const exact = options.findIndex((o) => o.trim() === said.trim());
  if (exact >= 0) return exact;
  const loose = options.filter((o) => norm(o) === norm(said));
  return loose.length === 1 ? options.indexOf(loose[0]) : -1;
}

/**
 * The reader's verdicts against the keys it never saw. A prediction is exempt from the comparison: the point of one
 * asked before an experiment can be that the likely guess is wrong. A reader who calls the right option weak is ignored.
 */
export function readVerdicts(raw: RawVerdict[], blocks: DeepDiveBlock[]): CheckVerdict[] {
  return raw.filter((v) => blocks[v.blockIndex] && isEvaluableBlock(blocks[v.blockIndex])).map(({ answer, ...v }) => {
    const block = blocks[v.blockIndex];
    const choice = readerChoice(block);
    // The wrong answers of a kit check are a display's other parts or cards code already checked: not distractors to rewrite.
    if (block.blockType === 'check') v = { ...v, weakDistractors: [] };
    if (!choice) return v;
    const key = choice.options[choice.correctIndex];
    const picked = answer ? optionPicked(choice.options, answer) : -1;
    return {
      ...v,
      weakDistractors: (v.weakDistractors ?? []).filter((d) => norm(d) !== norm(key)),
      ...(block.blockType !== 'mini-sim' && picked >= 0 && picked !== choice.correctIndex ? { disagreed: choice.options[picked] } : {}),
    };
  });
}

export async function reviewChecks(blocks: DeepDiveBlock[], gradeLevel: string, timeoutMs: number, lesson: ReviewLesson): Promise<ReviewResult> {
  const outline = lesson.outline?.length
    ? `\nThe author's outline:\n${lesson.outline.map((s, i) => `${i + 1}. ${s.heading}: ${s.ideas.join(' ')}`).join('\n')}\n`
    : '';
  const prompt = `You review a lesson on "${lesson.topic}" for a ${gradeLevel}.${lesson.intent ? ` The lesson's job: ${lesson.intent}` : ''}${outline}
Blocks appear top to bottom; blocks marked (CHECK) are questions or tasks the student answers. You are not told the answers.

Coverage (missingIdeas): could a student who read this lesson explain the topic to a friend? Name at most 2 essential ideas that no block teaches. A lesson that covers the topic for its job gets an empty list.

For every CHECK, judge it as the student meets it:
- answer: for a check with OPTIONS, pick the option you would choose using only the blocks above it, and copy it exactly.
- answerable: can the student reach one answer from the blocks above it (or, for a prediction asked before an experiment, by reasoning)?
- givenAway: does the block directly above, the check's label, or the question state the answer in nearly the same words, so the student can match words instead of understanding? Teaching the idea earlier is fine; that is the point. Copying the sentence is not.
- weakDistractors: wrong options no ${gradeLevel} would seriously choose because they are absurd or jokes. Plausible errors are good distractors; list only the bad ones, copied exactly.

${studentView(blocks)}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });
  const response = await Promise.race([call, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('review timed out')), timeoutMs); })]);
  clearTimeout(timer);
  const parsed = JSON.parse(response.text ?? '{}') as { checks?: RawVerdict[]; missingIdeas?: string[] };
  return {
    checks: readVerdicts(parsed.checks ?? [], blocks),
    missingIdeas: (parsed.missingIdeas ?? []).filter(Boolean).slice(0, 2),
  };
}

/** What the agent must fix before the lesson ships. */
export function verdictIssues(review: ReviewResult): string[] {
  const missing = review.missingIdeas.map((idea) => `the lesson does not teach an essential idea: "${idea}". Add it to the outline and teach it, or fold it into a section.`);
  return [...missing, ...review.checks.flatMap((v) => {
    const issues: string[] = [];
    if (v.disagreed) issues.push(`block ${v.blockIndex}: a reader who saw only the blocks above picked "${v.disagreed}", which is not your answer. Either the lesson does not teach what decides it, or two options fit. ${v.note}`);
    else if (!v.answerable) issues.push(`block ${v.blockIndex}: the reviewer could not reach the answer from the blocks above it. ${v.note}`);
    if (v.givenAway) issues.push(`block ${v.blockIndex}: the answer is given away right above or in the question. ${v.note}`);
    if (v.weakDistractors.length) issues.push(`block ${v.blockIndex}: distractors no student would choose: ${v.weakDistractors.map((d) => `"${d}"`).join(', ')}. Replace them with real errors.`);
    return issues;
  })];
}
