/**
 * Writing stages — paragraph-architect's writing modes on the teaching workspace (R12, OB-7L). The learner writes a
 * paragraph one sentence at a time: each stage asks for one job (the topic sentence, a fact, the closing; or the
 * beginning, middle and end of a story; or the opinion, two reasons and the restated opinion). They type the sentence
 * and press "I'm done!". Code checks what it can (long enough, no blank left from a starter, not a sentence already
 * written); the shared literacy judge (`judgeWordBuild`, `unit: 'writing'`) decides whether the sentence makes sense and
 * does its stage's job, reading the paragraph so far. Spelling is never judged.
 *
 * Pure: the surface, the live adapter and the tests read the same rules.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';

/** paragraph-architect's three paragraph types, and opinion-builder's two frameworks. */
export type ParagraphKind = 'informational' | 'narrative' | 'opinion' | 'oreo' | 'cer';
export type StageJob = 'topic' | 'fact' | 'closing' | 'beginning' | 'middle' | 'end' | 'opinion' | 'reason' | 'restate'
  | 'example' | 'claim' | 'evidence' | 'reasoning' | 'conclusion';

export interface WritingStage {
  id: string;
  job: StageJob;
  /** The task as said and printed. The topic is shown beside it, never spliced in (a generated topic can be a phrase). */
  ask: string;
  /** The lesson's topic, as generated. */
  topic: string;
  /** What the judge checks the sentence does. */
  criterion: string;
  /** Sentence starters from the payload for this job (a help lever shows them). */
  starters: string[];
}

export type WritingMiss = 'too_short' | 'blank_left' | 'repeat' | 'not_sense' | 'wrong_job';
export const WRITING_MISSES: readonly WritingMiss[] = ['too_short', 'blank_left', 'repeat', 'not_sense', 'wrong_job'];

/** The writing payload the generator already makes (frames, a topic, the paragraph type). */
export interface WritingPayload {
  paragraphType: ParagraphKind;
  topic: string;
  topicSentenceFrames?: string[];
  detailSentenceFrames?: string[];
  concludingSentenceFrames?: string[];
}

const JOBS: Record<ParagraphKind, { job: StageJob; ask: (t: string) => string; criterion: string; frames: 'topic' | 'detail' | 'closing' }[]> = {
  informational: [
    { job: 'topic', ask: () => 'Write the first sentence: tell what your paragraph is about.', frames: 'topic',
      criterion: 'It names the topic and tells what it is or what the paragraph will be about.' },
    { job: 'fact', ask: () => 'Write a sentence with a fact about your topic.', frames: 'detail',
      criterion: 'It gives a fact about the topic that the paragraph so far has not already given.' },
    { job: 'fact', ask: () => 'Write another fact about your topic.', frames: 'detail',
      criterion: 'It gives another fact about the topic, different from the facts already written.' },
    { job: 'closing', ask: () => 'Write a closing sentence that wraps up your paragraph.', frames: 'closing',
      criterion: 'It wraps up the topic (sums it up or restates it) and does not add a new fact.' },
  ],
  narrative: [
    { job: 'beginning', ask: () => 'Write how your story begins: who is in it and where.', frames: 'topic',
      criterion: 'It starts a story: it names a character and, if it can, where or when.' },
    { job: 'middle', ask: () => 'Write what happens next: a problem or something that happens.', frames: 'detail',
      criterion: 'It tells an event that follows from the beginning, such as a problem.' },
    { job: 'middle', ask: () => 'Write what the character does about it.', frames: 'detail',
      criterion: 'It tells what a character does next, following from the story so far.' },
    { job: 'end', ask: () => 'Write how the story ends.', frames: 'closing',
      criterion: 'It ends the story: it solves the problem or tells how things turned out.' },
  ],
  opinion: [
    { job: 'opinion', ask: () => 'Write your opinion about the topic.', frames: 'topic',
      criterion: 'It states an opinion about the topic (what the writer thinks, likes or believes).' },
    { job: 'reason', ask: () => 'Write a reason for your opinion.', frames: 'detail',
      criterion: 'It gives a reason that supports the opinion already written.' },
    { job: 'reason', ask: () => 'Write another reason.', frames: 'detail',
      criterion: 'It gives a different reason that supports the same opinion.' },
    { job: 'restate', ask: () => 'Write a closing sentence that says your opinion again.', frames: 'closing',
      criterion: 'It restates the same opinion in other words.' },
  ],
  // opinion-builder OREO (grades 2-4): Opinion, Reason, Example, Opinion again.
  oreo: [
    { job: 'opinion', ask: () => 'Write your opinion: what do you think about the question?', frames: 'topic',
      criterion: 'It states an opinion that answers the question (what the writer thinks or believes).' },
    { job: 'reason', ask: () => 'Write a reason for your opinion.', frames: 'detail',
      criterion: 'It gives a reason that supports the opinion already written.' },
    { job: 'example', ask: () => 'Write an example that shows your reason is true.', frames: 'detail',
      criterion: 'It gives a specific example or experience that backs up the reason already written.' },
    { job: 'restate', ask: () => 'Write your opinion again, in other words.', frames: 'closing',
      criterion: 'It restates the same opinion in other words.' },
  ],
  // opinion-builder CER (grades 5-6): Claim, Evidence, Reasoning, Conclusion.
  cer: [
    { job: 'claim', ask: () => 'Write your claim: your answer to the question.', frames: 'topic',
      criterion: 'It makes a clear claim that answers the question.' },
    { job: 'evidence', ask: () => 'Write a piece of evidence: a fact or example that supports your claim.', frames: 'detail',
      criterion: 'It gives a fact, data or example that supports the claim, not just another opinion.' },
    { job: 'reasoning', ask: () => 'Write your reasoning: explain how the evidence supports your claim.', frames: 'detail',
      criterion: 'It explains WHY or HOW the evidence supports the claim, linking the two.' },
    { job: 'conclusion', ask: () => 'Write a conclusion that sums up your claim.', frames: 'closing',
      criterion: 'It sums up the claim without adding new evidence.' },
  ],
};

export function stagesFor(p: WritingPayload): WritingStage[] {
  const kind: ParagraphKind = JOBS[p.paragraphType] ? p.paragraphType : 'informational';
  const topic = (p.topic || 'your topic').trim();
  const frames = { topic: p.topicSentenceFrames ?? [], detail: p.detailSentenceFrames ?? [], closing: p.concludingSentenceFrames ?? [] };
  return JOBS[kind].map((j, i) => ({ id: `w${i + 1}`, job: j.job, ask: j.ask(topic), topic, criterion: j.criterion,
    starters: frames[j.frames].slice(0, 4) }));
}

const words = (s: string) => s.trim().split(/\s+/).filter(w => /[a-z]/i.test(w));

/** What code checks before any judge. Undefined: a sentence of words, ready for the judge. */
export function writingShapeMiss(sentence: string, starters: readonly string[], earlier: readonly string[]): WritingMiss | undefined {
  const s = sentence.trim();
  if (/_{2,}/.test(s) || starters.some(f => f.trim().toLowerCase() === s.toLowerCase())) return 'blank_left';
  if (words(s).length < 3) return 'too_short';
  if (earlier.some(e => e.trim().toLowerCase() === s.toLowerCase())) return 'repeat';
  return undefined;
}

export const writingAssignment = (stage: WritingStage): TeachingAssignment => ({ id: stage.id, task: stage.ask, response: 'gesture' });

export const writingJudgeRequest = (stage: WritingStage, sentence: string, paragraph: readonly string[], grade?: string): WordBuildJudgeRequest =>
  ({ ask: `${stage.ask} Topic: ${stage.topic}. (${stage.criterion})`, made: sentence.trim(), unit: 'writing', context: paragraph.join(' '), ...(grade ? { grade } : {}) });

export function writingScene(stage: WritingStage, draft: string, paragraph: readonly string[], inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: stage.ask,
    topic: stage.topic,
    paragraphSoFar: paragraph.length ? paragraph.join(' ') : 'nothing yet',
    draft: draft.trim() || 'empty',
    wordsTyped: words(draft).length,
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The learner types one sentence for this step in the box and presses "I\'m done!". The builder checks it '
      + 'makes sense and does this step\'s job; spelling is not judged. Accepted sentences join the paragraph above. You '
      + 'cannot type for the learner.',
  } };
}

// ── Levers ───────────────────────────────────────────────────────────────────
export const STARTERS_LEVER = 'sentence_starters';
export const MODEL_LEVER = 'model_step';
export const BLANK_LEVER = 'fill_blank';

/** A solved step of the same job on another topic (code-owned), never this topic. */
export const MODEL_STEPS: Record<StageJob, string> = {
  topic: 'Frogs are animals that live near water.',
  fact: 'Frogs catch bugs with their long tongues.',
  closing: 'Now you know why frogs are amazing.',
  beginning: 'Max the mouse lived in a cozy barn.',
  middle: 'One day, the barn door blew shut and Max was stuck inside.',
  end: 'At last Max squeezed under the door and ran home.',
  opinion: 'I think recess should be longer.',
  reason: 'Kids need time to run and play.',
  restate: 'That is why recess should be longer.',
  example: 'At my school, we play tag and then we can sit still in class.',
  claim: 'Schools should have gardens.',
  evidence: 'Students who grow food eat more vegetables.',
  reasoning: 'Growing food helps students try vegetables, so a garden makes them healthier.',
  conclusion: 'For these reasons, every school should have a garden.',
};

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly WritingMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function writingLevers(stage: WritingStage | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!stage) return [];
  return [
    ...(stage.starters.length ? [lever(STARTERS_LEVER, 'help', ['too_short', 'wrong_job'],
      'The learner cannot start the sentence, or writes one that does not do this step\'s job.',
      'Shows sentence starters for this step under the box; tapping one puts it in the box to finish. Nothing is finished for them.',
      pulled)] : []),
    lever(MODEL_LEVER, 'help', ['not_sense', 'wrong_job'],
      'The learner\'s sentence does not make sense or does a different job.',
      'Shows one finished sentence that does this step\'s job for a different topic, so the learner sees what the step asks.', pulled),
    ...(stage.starters.length ? [lever(BLANK_LEVER, 'simplify', ['too_short', 'not_sense', 'wrong_job'],
      'The learner still cannot write the sentence with starters on screen.',
      'Opens a practice step: one starter with a blank, and the learner types only the missing words. Ungraded; the full step comes back after it.',
      pulled)] : []),
  ];
}

export function writingMissWords(miss: WritingMiss | undefined): string {
  switch (miss) {
    case 'too_short': return 'Write a whole sentence, with a few more words.';
    case 'blank_left': return 'Finish the starter: write your own words where the blank is.';
    case 'repeat': return 'You already wrote that. Write a new sentence for this step.';
    case 'not_sense': return 'Read it out loud. Does it make sense?';
    case 'wrong_job': return 'Read the step again. Does your sentence do that job?';
    default: return 'Not quite. Try again.';
  }
}
