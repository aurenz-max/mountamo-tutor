'use client';

/**
 * DiSentenceReading — the DI family's connected-text pack: the child reads a
 * printed sentence OUT LOUD, every word in order, and the Live tutor teaches it
 * on the shared tutor/JEV workspace (below; wired on its boss, `diSentenceReading.card.ts` + `diSentenceReading.boss.ts`).
 *
 * WHY THIS PACK EXISTS: `read-aloud-studio` owns G1-6 read-aloud but judges
 * nothing ("student self-assessment only"), so it produces no evidence the IRT
 * model can use, and a beginning reader cannot self-assess their own accuracy.
 * This pack takes judged short-sentence accuracy at G1-2 as a fork, so
 * read-aloud-studio's calibrated eval modes keep meaning what they mean.
 *
 * The scripted DISTAR drill that used to run when no live runtime was mounted
 * was deleted in LA-14 S5 (qa/live-runtime-handoffs/13-delete-di-scripted-drills.md).
 * What it taught that is task structure rather than control protocol lives in
 * `diSentenceReadingDomain`; an unbound mount renders a visible "needs the tutor"
 * state (`DiTeachingStage`).
 */

/**
 * The stage: the sentence-reading stage as a tutor/JEV
 * teaching workspace (eighth adopter, after Counting Board, Shape Sorter, the
 * number train, di-letter-sounds, di-word-reading, di-math-facts and
 * letter-sound-link; the fourth DI pack to migrate, and the family's first
 * CONNECTED TEXT pack on the workspace).
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child reads the printed sentence OUT LOUD, every word in
 * order; a skipped, added, or swapped word is a miss however small; catching
 * and fixing a slip mid-read still counts as accurate; speed is never judged.
 * What it loses is the requirement that the tutor say one exact sentence and
 * that the application read progression out of those words.
 *
 * WHAT IS DRAWN, AND WHY IT IS DRAWN THAT WAY
 *
 * Unlike word reading, there is nothing to withhold from the tutor or the ask:
 * the printed sentence is the target, and it is already on the child's screen.
 * The tutor never reads it aloud before the child does, and never re-reads it after
 * a miss (R2, 2026-10-03): the read would become repetition. A model is a DIFFERENT
 * sentence. `askFor` never repeats the sentence text in the task string.
 *
 * Connected text has no discrete sound-out sub-units the way a single
 * decodable word does, so there is only ONE demonstrable object — the whole
 * printed sentence — unlike word reading's per-letter marks.
 *
 * THE REWARD-REVEAL DECISION (mirrors di-word-reading, handoff 09)
 *
 * The reward picture is NOT a workspace object and never sits beside an unread
 * sentence. It is revealed in a read-sentences trail under the stage, one
 * entry per COMMITTED correct attempt — the same answer-leak shape word
 * reading uses, so a trail only ever contains sentences already read.
 *
 * LEVERS (`diSentenceReadingLevers.ts`, DI family 6): a "my turn" card with a
 * DIFFERENT sentence that shares no word with the child's; an underline under each
 * word with an arrow; dots under the letters of the CVC words only (kit
 * `LuminaPrintSupport`, `dotWord`); a shorter practice line.
 *
 * The workspace binding, evaluation and recap are `DiTeachingStage`.
 */

import React, { useMemo } from 'react';
import { LuminaPrintSupport } from '../../../ui/LuminaPrintSupport';
import DiTeachingStage, { diStageMetrics, type DiStageView } from './DiTeachingStage';
import { MODEL_SENTENCE, SOUND_DOTS, TRACKING_UNDERLINE, isCvcWord, modelFor, SENTENCE_LEVERS,
  simplerLine } from './diSentenceReadingLevers';
import { buildSentenceReadingItems, workspaceScene, type SentenceReadingItem }
  from './diSentenceReadingDomain';
import { DiModelCard } from './DiModelCard';
import { diSentenceReadingBoss } from './diSentenceReading.boss';
import type { PrimitiveEvaluationResult, DiSentenceReadingMetrics } from '../../../evaluation/types';
import type { DiSentenceReadingChallenge, DiSentenceReadingChallengeType } from './diSentenceReadingDomain';

export type { DiSentenceReadingChallenge, DiSentenceReadingChallengeType } from './diSentenceReadingDomain';

export interface DiSentenceReadingData {
  title: string;
  description: string;
  /** 3-6 printed sentences. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiSentenceReadingChallenge[];
  /** Session core task identity — the resolved/primary eval-mode skill. */
  challengeType: DiSentenceReadingChallengeType;
  /** Flat "The cat sat. | I see a pig." item-set summary, attached by the
   *  generator for the tutoring scaffold's RUNTIME STATE (catalog contextKey
   *  `sentences`). The printed sentence is both stimulus and target, and is
   *  already on the child's screen, so there is nothing to withhold. */
  sentences?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiSentenceReadingMetrics>) => void;
}

export interface DiSentenceReadingProps {
  data: DiSentenceReadingData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

const COPY = {
  empty: 'These sentences are still being prepared. Try generating this practice again.',
  title: 'Sentence Reading', badge: 'Read it out loud', prompt: 'Read the sentence out loud, or ask for help.',
  heading: 'Great reading today!', celebration: 'You read every sentence!',
};

/** The printed sentence alone. No picture, emoji or hint joins it before the
 *  read — decoding print IS the skill. */
function stimulus(item: SentenceReadingItem, marks: readonly string[], view: DiStageView, model: string | null) {
  const sizeClass = item.wordCount <= 4 ? 'text-5xl' : item.wordCount <= 6 ? 'text-4xl' : 'text-3xl';
  const underline = view.pulled.includes(TRACKING_UNDERLINE), dots = view.pulled.includes(SOUND_DOTS);
  return <div data-practice-item={view.practice || undefined} className="flex flex-col items-center gap-4">
    <div data-sentence-object="printed" data-assignment-target="true"
      data-tutor-demonstration={marks.includes('sentence')}
      aria-label={`The sentence ${item.text}`}
      className={`max-w-xl rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-8 py-5 text-center font-bold leading-snug tracking-wide text-white ${sizeClass} ${
        marks.includes('sentence') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
      {underline || dots
        ? <LuminaPrintSupport text={item.text} trackingUnderline={underline} soundDots={dots} dotWord={word => isCvcWord(word)} />
        : item.text}
    </div>
    {model && view.pulled.includes(MODEL_SENTENCE) && <DiModelCard lever={MODEL_SENTENCE} data-model-sentence={model}
      aria-label="My turn: a different sentence" className="flex items-center gap-3">
      <span className="text-2xl font-semibold">{model}</span>
    </DiModelCard>}
  </div>;
}

/** The reward reveal: only sentences the observer has already committed. */
function readSentences(read: SentenceReadingItem[]) {
  return read.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Sentences you have read">
    {read.map(done => <div key={done.id} data-sentence-read={done.text}
      className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
      <span className="text-sm font-semibold text-white">{done.text}</span>
      <span className="text-xl leading-none" aria-hidden="true">{done.emoji || '✅'}</span>
    </div>)}
  </div>;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
export const DiSentenceReading: React.FC<DiSentenceReadingProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const items = useMemo(() => buildSentenceReadingItems(data.challenges), [data.challenges]);
  // The levers read the whole session: a model is never a session sentence, and a practice line shares no word with it.
  const levers = useMemo(() => SENTENCE_LEVERS.bind({ items }), [items]);
  return <DiTeachingStage<SentenceReadingItem, DiSentenceReadingMetrics> primitiveId="di-sentence-reading" data={data}
    items={items} runtimeEvalMode={runtimeEvalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={diSentenceReadingBoss.assignment} scene={workspaceScene} copy={COPY} trail={readSentences} levers={levers}
    stimulus={(item, marks, view) => stimulus(item, marks, view, view.practice ? null : modelFor(item, items))}
    recapLabel={item => item.text}
    metrics={result => ({ type: 'di-sentence-reading', ...diStageMetrics(result, items, data.challengeType),
      // Not tracked on the workspace path (no-timer ruling: L0 never judges latency).
      meanResponseMs: null,
      meanSentenceWords: items.length
        ? Math.round((items.reduce((sum, item) => sum + item.wordCount, 0) / items.length) * 10) / 10
        : 0 })} />;
};

export default DiSentenceReading;
