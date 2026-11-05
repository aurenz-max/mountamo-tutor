/**
 * Independent review of a DeepDive's checks, read the way the student meets
 * them: top to bottom, each check after the blocks above it. Code cannot judge
 * whether a check is answerable from the lesson, whether the block above gives
 * it away, or whether its distractors are ones no student would pick; a second
 * reader that did not write the lesson can.
 */

import { Type, ThinkingLevel, type Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import { isEvaluableBlock } from '../../../primitives/visual-primitives/core/deep-dive/deepDiveWorkspace';
import type { DeepDiveBlock, DeepDiveSection } from '../../../primitives/visual-primitives/core/deep-dive/types';
import { blockAnswer, blockChoice, visibleText } from './blocks';

export interface CheckVerdict {
  blockIndex: number;
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
          answerable: { type: Type.BOOLEAN, description: 'A student who read the blocks above can reach the answer.' },
          givenAway: { type: Type.BOOLEAN, description: 'The block right above, the label or the question states the answer in nearly the same words, so the student can match words without understanding.' },
          weakDistractors: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Wrong options, copied exactly, that no student at this grade would choose (absurd, joke, or off-topic).' },
          note: { type: Type.STRING, description: 'One sentence on what to change, or empty.' },
        },
        required: ['blockIndex', 'answerable', 'givenAway', 'weakDistractors', 'note'],
      },
    },
  },
  required: ['missingIdeas', 'checks'],
};

/** A block's closed-question fields; shown to the reviewer as QUESTION/OPTIONS/KEY instead. */
const CHECK_FIELDS = new Set(['question', 'options', 'correctIndex', 'explanation', 'optionEmojis', 'prediction', 'comprehension', 'patternCheck']);

/** The lesson as the student meets it, with each check's key on its own line for the reviewer. */
function studentView(blocks: DeepDiveBlock[]): string {
  return blocks.map((b, i) => {
    const choice = blockChoice(b);
    const answer = blockAnswer(b);
    const check = isEvaluableBlock(b);
    // A mini-sim's states appear only after the student predicts, so they are not above its question.
    const rest = Object.fromEntries(Object.entries(b).filter(([k]) => !CHECK_FIELDS.has(k) && !(b.blockType === 'mini-sim' && k === 'states'))) as unknown as DeepDiveBlock;
    const body = choice
      ? `${visibleText(rest).slice(0, 900)}\nQUESTION: ${choice.question}\nOPTIONS: ${choice.options.join(' | ')}`
      : visibleText(b).slice(0, 1200);
    return `[${i}] ${b.blockType}${check ? ' (CHECK)' : ''} "${b.label}"\n${body}${answer ? `\nKEY: ${answer}` : ''}`;
  }).join('\n\n');
}

export async function reviewChecks(blocks: DeepDiveBlock[], gradeLevel: string, timeoutMs: number, lesson: ReviewLesson): Promise<ReviewResult> {
  const outline = lesson.outline?.length
    ? `\nThe author's outline:\n${lesson.outline.map((s, i) => `${i + 1}. ${s.heading}: ${s.ideas.join(' ')}`).join('\n')}\n`
    : '';
  const prompt = `You review a lesson on "${lesson.topic}" for a ${gradeLevel}.${lesson.intent ? ` The lesson's job: ${lesson.intent}` : ''}${outline}
Blocks appear top to bottom; blocks marked (CHECK) are questions or tasks the student answers. KEY is the correct answer (hidden from the student).

Coverage (missingIdeas): could a student who read this lesson explain the topic to a friend? Name at most 2 essential ideas that no block teaches. A lesson that covers the topic for its job gets an empty list.

For every CHECK, judge it as the student meets it:
- answerable: can the student reach the KEY from the blocks above it (or, for a prediction asked before an experiment, by reasoning)?
- givenAway: does the block directly above, the check's label, or the question state the KEY in nearly the same words, so the student can match words instead of understanding? Teaching the idea earlier is fine; that is the point. Copying the sentence is not.
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
  const parsed = JSON.parse(response.text ?? '{}') as { checks?: CheckVerdict[]; missingIdeas?: string[] };
  return {
    checks: (parsed.checks ?? []).filter((c) => blocks[c.blockIndex] && isEvaluableBlock(blocks[c.blockIndex])),
    missingIdeas: (parsed.missingIdeas ?? []).filter(Boolean).slice(0, 2),
  };
}

/** What the agent must fix before the lesson ships. */
export function verdictIssues(review: ReviewResult): string[] {
  const missing = review.missingIdeas.map((idea) => `the lesson does not teach an essential idea: "${idea}". Add it to the outline and teach it, or fold it into a section.`);
  return [...missing, ...review.checks.flatMap((v) => {
    const issues: string[] = [];
    if (!v.answerable) issues.push(`block ${v.blockIndex}: the reviewer could not reach the answer from the blocks above it. ${v.note}`);
    if (v.givenAway) issues.push(`block ${v.blockIndex}: the answer is given away right above or in the question. ${v.note}`);
    if (v.weakDistractors.length) issues.push(`block ${v.blockIndex}: distractors no student would choose: ${v.weakDistractors.map((d) => `"${d}"`).join(', ')}. Replace them with real errors.`);
    return issues;
  })];
}
