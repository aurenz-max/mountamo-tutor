/**
 * Writing stages — paragraph-architect's writing modes on the teaching workspace (R12, OB-7L). The learner writes a
 * paragraph one sentence at a time: each stage asks for one job (the topic sentence, a fact, the closing; or the
 * beginning, middle and end of a story; or the opinion, two reasons and the restated opinion). They type the sentence
 * and press "I'm done!". Code checks what it can (long enough, no blank left from a starter, not a sentence already
 * written); the shared literacy judge (`judgeWordBuild`, `unit: 'writing'`) decides whether the sentence makes sense and
 * does its stage's job, reading the paragraph so far. Spelling is never judged.
 *
 * Pure: the surface, the bosses (paragraph-architect, opinion-builder) and the tests read the same rules.
 */
import type { LeverSpec, LeverSupport, SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';
import type { WritingMiss } from './paragraphArchitect.card';

export { WRITING_MISSES, type WritingMiss } from './paragraphArchitect.card';

/** paragraph-architect's three paragraph types, and opinion-builder's two frameworks. */
export type ParagraphKind = 'informational' | 'narrative' | 'opinion' | 'oreo' | 'cer';
export type StageJob = 'topic' | 'fact' | 'closing' | 'beginning' | 'middle' | 'end' | 'opinion' | 'reason' | 'restate'
  | 'example' | 'claim' | 'evidence' | 'reasoning' | 'conclusion';

export interface WritingStage {
  id: string;
  /** The paragraph type (the eval mode: informational, narrative, opinion; oreo, cer). */
  kind: ParagraphKind;
  job: StageJob;
  /** The task as said and printed. The topic is shown beside it, never spliced in (a generated topic can be a phrase). */
  ask: string;
  /** The lesson's topic, as generated. */
  topic: string;
  /** What the judge checks the sentence does. */
  criterion: string;
  /** Sentence starters from the payload for this job (a help lever shows them). */
  starters: string[];
  /** The lesson's support tier, stamped on each step (when the model lever comes). */
  supportTier?: SupportTier;
}

/** The writing payload the generator already makes (frames, a topic, the paragraph type). */
export interface WritingPayload {
  paragraphType: ParagraphKind;
  topic: string;
  topicSentenceFrames?: string[];
  detailSentenceFrames?: string[];
  concludingSentenceFrames?: string[];
  supportTier?: SupportTier;
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
  return JOBS[kind].map((j, i) => ({ id: `w${i + 1}`, kind, job: j.job, ask: j.ask(topic), topic, criterion: j.criterion,
    starters: frames[j.frames].slice(0, 4), ...(p.supportTier ? { supportTier: p.supportTier } : {}) }));
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

export const writingJudgeRequest = (stage: WritingStage, sentence: string, paragraph: readonly string[], grade?: string): WordBuildJudgeRequest =>
  ({ ask: `${stage.ask} Topic: ${stage.topic}. (${stage.criterion})`, made: sentence.trim(), unit: 'writing', context: paragraph.join(' '), ...(grade ? { grade } : {}) });

/** What the tutor is told about a step. The moves are the card's; this says only what this activity checks. */
export function writingScene(stage: WritingStage, draft: string, paragraph: readonly string[], inspectorSaid?: string): SceneOf {
  return { objects: [], facts: {
    ask: stage.ask,
    topic: stage.topic,
    paragraphSoFar: paragraph.length ? paragraph.join(' ') : 'nothing yet',
    draft: draft.trim() || 'empty',
    wordsTyped: words(draft).length,
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The builder checks the sentence makes sense and does this step\'s job; spelling is not judged. An '
      + 'accepted sentence joins the paragraph above, and any sentence that does the job passes.',
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
const FROGS = /\bfrogs?\b/i, MICE = /\b(mouse|mice)\b/i, RECESS = /\brecess\b/i, GARDENS = /\bgardens?\b/i;
/** What each model sentence is about: a lesson on that subject gets no model (it would be the learner's own topic). */
const MODEL_SUBJECT: Record<StageJob, RegExp> = {
  topic: FROGS, fact: FROGS, closing: FROGS, beginning: MICE, middle: MICE, end: MICE,
  opinion: RECESS, reason: RECESS, restate: RECESS, example: RECESS,
  claim: GARDENS, evidence: GARDENS, reasoning: GARDENS, conclusion: GARDENS,
};
/** The model sentence for a step, or null when the lesson's topic is the model's own subject. */
export const modelStep = (stage: WritingStage): string | null =>
  (MODEL_SUBJECT[stage.job].test(stage.topic) ? null : MODEL_STEPS[stage.job]);

/** The blank practice: a starter with a blank (___ or a trailing ...), and only the blank typed. */
export const blankStarter = (stage: WritingStage): string | null => {
  const s = stage.starters.find(x => /_{2,}|\.\.\.|…/.test(x));
  return s ? s.replace(/\.\.\.|…/, ' ___') : null;
};
const BLANK = '~blank';
/** The simplify lever's practice step: the same step, one starter with a blank to fill. Null when no starter has one. */
export const blankPractice = (stage: WritingStage): WritingStage | null =>
  (stage.id.endsWith(BLANK) || !blankStarter(stage) ? null : { ...stage, id: `${stage.id}${BLANK}` });
export const blankParent = (id: string) => id.replace(/~blank$/, '');

/** When the model sentence comes, by the step's tier (`supportFact`). */
export const WRITING_SUPPORT: LeverSupport<WritingStage> = {
  tier: s => s.supportTier ?? 'medium', different: 'a finished sentence for this step on another topic',
  own: 'a sentence for this step',
};

/**
 * The writing steps' levers, as lever-set specs (`bossLevers.ts`). `modes` limits them to a family's writing modes when
 * the set also holds other modes (paragraph-architect's build_paragraph, opinion-builder's build_opinion). No answer to leak: any sentence that does the job passes.
 */
export const writingLeverSpecs = (modes?: readonly string[]): LeverSpec<WritingStage, null>[] => [
  { id: STARTERS_LEVER, type: 'clue', ...(modes ? { modes } : {}), answers: ['too_short', 'wrong_job'],
    when: 'The learner cannot start the sentence, or writes one that does not do this step\'s job.',
    does: 'Shows sentence starters for this step under the box; tapping one puts it in the box to finish. Nothing is finished for them.',
    content: s => (s.starters.length ? s.starters : null),
    fact: (starters: string[]) => `Sentence starters are shown under the box: ${starters.join(' | ')}` },
  { id: MODEL_LEVER, type: 'model', ...(modes ? { modes } : {}), answers: ['too_short', 'not_sense', 'wrong_job'],
    when: 'The learner\'s sentence does not make sense or does a different job.',
    does: 'Shows one finished sentence that does this step\'s job for a different topic, so the learner sees what the step asks.',
    content: modelStep,
    fact: (model: string) => `A finished sentence for this step about another topic is shown: ${model}` },
  { id: BLANK_LEVER, type: 'easier', ...(modes ? { modes } : {}), answers: ['too_short', 'not_sense', 'wrong_job'],
    when: 'The learner still cannot write the sentence with starters on screen.',
    does: 'Opens a practice step: one starter with a blank, and the learner types only the missing words. Ungraded; the full step comes back after it.',
    content: blankPractice },
];

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
