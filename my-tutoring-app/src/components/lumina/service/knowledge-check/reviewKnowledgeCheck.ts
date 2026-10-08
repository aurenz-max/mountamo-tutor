import 'server-only';

/**
 * Knowledge-check set review — Jev judges each generated problem; code decides what to do.
 *
 * The judgments a word-matching gate cannot make honestly: does the wording or picture give the answer away, does
 * what is shown agree with the choices, does this problem repeat an earlier one, would a learner who half-understands
 * the idea pick any wrong choice. Jev answers each as a typed probability over the problem as the learner sees it;
 * `decideReview` turns the answers into a pass or a list of notes, and the generator redraws a failing problem once
 * with those notes (gemini-knowledge-check.ts). Thresholds come from a hand-labelled set of real generations
 * (qa/eval-reports/knowledge-check-jev-review/).
 */

import { systemOne, typesafeConfigured, type Question } from '../manifest/typesafe/typesafeClient';
import { serializeInsetForPrompt } from '../insets/serialize';
import type { ProblemData } from '../../types';

/** What the learner sees and what the key is, one shape for every problem type. */
export interface ProblemView {
  type: string;
  /** The question, statement, sentence or instruction. */
  ask: string;
  /** Picture or inset evidence rendered with the problem. */
  shown_on_screen: string;
  choices?: string[];
  correct_answer?: string;
  /** Wrong options a learner could pick (choices, other bank words), judged one at a time. */
  wrong_answers?: string[];
  items_and_groups?: string[];
  correct_order?: string[];
  pairs?: string[];
}

const text = (value: unknown): string => String(value ?? '').trim();

export function problemView(p: ProblemData): ProblemView {
  const shown: string[] = [];
  if (p.inset) shown.push(serializeInsetForPrompt(p.inset));
  const visual = 'visual' in p ? p.visual : undefined;
  if (visual?.type === 'object-collection') {
    const items = (visual.data as { items?: Array<{ name: string; icon: string; count: number }> }).items ?? [];
    shown.push(`Pictures: ${items.map((i) => `${i.count} x ${i.name} ${i.icon}`).join(', ')}`);
  } else if (visual?.type === 'comparison-panel') {
    const panels = (visual.data as { panels?: Array<{ label: string; collection: { items: Array<{ name: string; icon: string }> } }> }).panels ?? [];
    shown.push(`Two pictures side by side: ${panels.map((x) => `"${x.label}": ${x.collection.items.map((i) => `${i.name} ${i.icon}`).join(', ')}`).join('; ')}`);
  }
  const base = { type: p.type, shown_on_screen: shown.join(' | ') || 'nothing besides the text' };
  switch (p.type) {
    case 'multiple_choice': {
      const correct = p.options.find((o) => o.id === p.correctOptionId);
      const label = (o: { text: string; emoji?: string }) => `${o.emoji ? `${o.emoji} ` : ''}${o.text}`;
      return { ...base, ask: text(p.question), choices: p.options.map(label), correct_answer: correct ? label(correct) : '',
        wrong_answers: p.options.filter((o) => o.id !== p.correctOptionId).map(label) };
    }
    case 'true_false':
      return { ...base, ask: text(p.statement), correct_answer: p.correct ? 'true' : 'false' };
    case 'fill_in_blanks': {
      const answers = p.blanks.map((b) => text(b.correctAnswer));
      const bank = (p.wordBank ?? []).map((w) => text(typeof w === 'string' ? w : (w as { word?: string }).word));
      return { ...base, ask: text(p.textWithBlanks), choices: bank, correct_answer: answers.join(', '),
        wrong_answers: bank.filter((w) => !answers.some((a) => a.toLowerCase() === w.toLowerCase())) };
    }
    case 'categorization_activity':
      return { ...base, ask: text(p.instruction), choices: p.categories,
        items_and_groups: p.categorizationItems.map((i) => `${i.itemText} -> ${i.correctCategory}`) };
    case 'sequencing_activity':
      return { ...base, ask: text(p.instruction), correct_order: p.items };
    case 'matching_activity':
      return { ...base, ask: text(p.prompt),
        pairs: p.mappings.map((m) => `${p.leftItems.find((l) => l.id === m.leftId)?.text} -> ${m.rightIds
          .map((r) => p.rightItems.find((x) => x.id === r)?.text).join(' / ')}`) };
    default:
      return { ...base, ask: text((p as { question?: string }).question) };
  }
}

export interface ReviewLesson {
  topic: string;
  /** "Kindergarten", "Grade 3". */
  grade: string;
}

export function reviewQuestions(view: ProblemView, earlierCount: number): Record<string, Question> {
  const questions: Record<string, Question> = {
    gives_away: { type: 'noul', instructions:
      'Look at `problem`. Could a learner who has NOT learned anything about `lesson.topic` still get it right from the '
      + 'wording alone? That happens when `problem.ask` or the picture names or describes the correct answer (asking '
      + '"which one is the green excavator?" with "green excavator" as a choice), when a group name or label contains '
      + 'the answer, or when only one choice fits the grammar or the category asked for. Easy-to-rule-out wrong '
      + 'choices are a separate issue: do not count them here.',
      criteria: { true: 'The wording or picture gives the answer away.', false: 'The learner must know or work something out to answer.' } },
    evidence_agrees: { type: 'choice', instructions:
      'Compare what the learner is shown with the question and its answers in `problem`. What is shown is '
      + '`problem.shown_on_screen` plus any pictures, emoji or symbols written inside `problem.ask` itself.',
      criteria: {
        no_evidence: 'Nothing is shown besides plain words, so there is nothing to compare.',
        agrees: 'What is shown matches: every thing, count and position the question or a choice refers to is there and correct.',
        contradicts: 'Something does not match: a choice refers to something not shown, a count or position is wrong, or the answer depends on something missing.',
        gives_answer: 'What is shown agrees, but it states the answer outright (a definition box holding the missing word, a '
          + 'label naming the right choice) so the learner copies it without using the skill the question tests. A passage, '
          + 'table, chart or picture the learner must read and reason from (main idea, an inference, reading a value) is '
          + 'evidence, not this.',
      } },
  };
  (view.wrong_answers ?? []).forEach((_, i) => {
    questions[`tempting_${i}`] = { type: 'noul', instructions:
      `A learner in \`lesson.grade\` who half-understands \`lesson.topic\` answers \`problem\`. Might they pick `
      + `\`problem.wrong_answers[${i}]\` instead of \`problem.correct_answer\`? Yes when it is a near-miss: the same kind `
      + 'of thing as the answer, tied to a common misunderstanding or a slip. No when it is silly or off-topic, so '
      + 'anyone could rule it out (a kite or a sailboat in a question about construction vehicles).',
      criteria: { true: 'A plausible near-miss.', false: 'Easy to rule out.' } };
  });
  if (earlierCount > 0) {
    questions.repeats = { type: 'choice', instructions:
      'Compare `problem` with each problem in `earlier_problems`. Is `problem` a reworded copy of one of them: the same '
      + 'answer for the same reason, so answering one answers the other? Practising the same skill on new content (other '
      + 'numbers, other words, another example) is NOT a repeat, and neither is a different fact about the same topic.',
      criteria: Object.fromEntries([['none', 'It tests something none of the earlier problems test.'],
        ...Array.from({ length: earlierCount }, (_, i) => [`same_as_${i + 1}`, `It repeats earlier problem ${i + 1}.`])]) };
  }
  return questions;
}

/** Cut points, from the labelled set. */
export const REVIEW_THRESHOLDS = {
  givesAway: 0.75,
  evidence: 0.5,
  repeats: 0.8,
  /** A problem fails only when its MOST tempting wrong answer is below this: every wrong answer is absurd. */
  tempting: 0.25,
};

export interface ProblemReview {
  pass: boolean;
  /** Plain sentences for the redraw: what to change. */
  notes: string[];
  givesAway: number;
  evidence: { choice: string; p: number };
  /** 1-based index of the earlier problem this repeats, or null. */
  repeats: number | null;
  /** Wrong answers at or above the tempting cut, out of `wrongTotal`. */
  temptingCount: number;
  /** The most tempting wrong answer's probability. */
  maxTempting: number;
  wrongTotal: number;
}

export function decideReview(view: ProblemView, answers: Record<string, any>, views: ProblemView[],
    t = REVIEW_THRESHOLDS): ProblemReview {
  const notes: string[] = [];
  const givesAway = answers.gives_away?.noul ?? 0;
  if (givesAway >= t.givesAway) {
    notes.push('The question gave its answer away: its wording, a label or the picture names the correct answer. Ask it so '
      + 'the learner must know the idea to answer, and never put the answer\'s words in the question.');
  }
  const ev = answers.evidence_agrees;
  const evidence = { choice: ev?.choice ?? 'no_evidence', p: ev?.probabilities?.[ev?.choice] ?? 0 };
  if (evidence.choice === 'contradicts' && evidence.p >= t.evidence) {
    notes.push('What is shown on screen does not match the question: every choice, count and position the question names '
      + 'must be in the picture, exactly as shown.');
  } else if (evidence.choice === 'gives_answer' && evidence.p >= t.evidence) {
    notes.push('The picture or box on screen states the answer, so the learner can copy it. Show evidence the learner must '
      + 'reason from, and keep the answer out of it.');
  }
  const rep = answers.repeats;
  let repeats: number | null = null;
  if (rep && rep.choice !== 'none' && (rep.probabilities?.[rep.choice] ?? 0) >= t.repeats) {
    repeats = Number(String(rep.choice).replace('same_as_', ''));
    notes.push(`This repeats another problem in the set, which already asks: "${views[repeats - 1]?.ask ?? ''}". Test a `
      + 'different fact or skill from the lesson.');
  }
  const wrongTotal = view.wrong_answers?.length ?? 0;
  const tempting = Array.from({ length: wrongTotal }, (_, i) => answers[`tempting_${i}`]?.noul ?? 0);
  const temptingCount = tempting.filter((p) => p >= t.tempting).length;
  const maxTempting = Math.max(0, ...tempting);
  if (wrongTotal >= 2 && temptingCount === 0) {
    notes.push('Every wrong choice is easy to rule out. Use wrong choices of the same kind as the answer that a learner '
      + 'with a common misunderstanding would pick.');
  }
  return { pass: notes.length === 0, notes, givesAway, evidence, repeats, temptingCount, maxTempting, wrongTotal };
}

export const reviewState = (lesson: ReviewLesson, views: ProblemView[], index: number) => ({
  lesson,
  problem: views[index],
  ...(index > 0 ? { earlier_problems: views.slice(0, index).map((v, j) => ({ number: j + 1, ...v })) } : {}),
});

/**
 * Review every problem of a set, each against the problems before it. Null when Jev is not configured or the call
 * fails: the set then ships as generated (the review only ever improves a set; it never blocks one).
 */
export async function reviewKnowledgeCheckSet(problems: ProblemData[], lesson: ReviewLesson,
    opts: { timeoutMs?: number } = {}): Promise<ProblemReview[] | null> {
  if (!typesafeConfigured() || problems.length === 0) return null;
  const views = problems.map(problemView);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const results = await Promise.all(views.map((view, i) =>
      systemOne(reviewState(lesson, views, i), reviewQuestions(view, i), { signal: controller.signal })));
    return results.map((r, i) => decideReview(views[i], r.answers as Record<string, any>, views));
  } catch (err) {
    console.warn('[KC Review] Jev review unavailable; the set ships as generated:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
