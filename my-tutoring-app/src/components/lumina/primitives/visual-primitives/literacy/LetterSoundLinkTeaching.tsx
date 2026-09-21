'use client';

/**
 * LetterSoundLinkTeaching — letter-sound-link as a tutor/JEV teaching workspace
 * (seventh adopter, and the first literacy primitive outside the DI packs).
 *
 * The stage defines the assignment and the legal scene actions; the tutor chooses
 * how to teach; JEV observes its completed feedback; the runtime commits scoped
 * outcomes. Nothing here composes a model line, scans for "Yes" or "My turn",
 * counts corrections or advances at a miss cap.
 *
 * ── WHAT IS NEW HERE, AND WHY IT IS A SCENE RULE RATHER THAN A GUIDANCE SENTENCE ─
 *
 * This is the first binding with TWO response channels in one primitive, and the
 * first whose tutor is not told the answer.
 *
 *  - `see-hear` and `keyword-match` are SPOKEN: the child says the sound or the
 *    picture word, and the tutor's finished feedback is the evidence.
 *  - `hear-see` is a GESTURE: the tutor says a sound, the child taps one of two
 *    confusable letters, and the activity checks the tap. Its item publishes NO
 *    `expectedAnswer`, because a letter NAME is a blocked response class and a
 *    tutor handed the target letter would end the item by naming it. The scene
 *    withholds it; no guidance sentence has to ask the tutor to keep a secret.
 *  - `hear-see` also offers NO demonstration. Every object on its stage is one
 *    of the two answer options, so there is nothing the tutor could mark without
 *    answering — the scene refuses the action rather than the wording forbidding it.
 *
 * ── THE KEYWORD IS NOT ON THE STAGE ──────────────────────────────────────────
 *
 * The anchor picture ENCODES the sound, so unlike di-letter-sounds (where the
 * keyword picture sits beside the card at every tier) this primitive draws it
 * only once the answer is committed. It is therefore not a workspace object and
 * not a demonstration target, and for `see-hear` the anchor word is not in the
 * packet at all — a tutor that had it could hand over the sound with it.
 * `keyword-match` is the one direction where the anchor word IS the answer, so
 * the tutor has it there and only there.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaReadAloudGlyph, answerStateClass } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace }
  from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { LetterSoundLinkMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { acceptedFor, askFor, assignmentFor, buildLetterSoundLinkItems, printedStimulus,
  type LetterSoundItem, type LetterSoundMode, type LetterSoundTier } from './letterSoundLinkDomain';
import type { LetterSoundLinkData } from './LetterSoundLink';

export interface LetterSoundLinkTeachingProps {
  data: LetterSoundLinkData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

/** Vowels = red, consonants = blue (the shipped colour code). */
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const letterColor = (letter: string) => VOWELS.has(letter.toLowerCase()) ? 'text-red-300' : 'text-blue-300';

const MODE_BADGE: Record<LetterSoundMode, string> = {
  'see-hear': 'Say the sound', 'hear-see': 'Tap the letter', 'keyword-match': 'Say the word',
};

export default function LetterSoundLinkTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: LetterSoundLinkTeachingProps) {
  const tier: LetterSoundTier = data.supportTier ?? 'medium';
  const items = useMemo(() => buildLetterSoundLinkItems(data.challenges ?? [], tier), [data.challenges, tier]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent>
      <p>These letters are still being prepared. Try generating this practice again.</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <LinkWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} runtimeEvalMode={runtimeEvalMode} />;
}

function LinkWorkspace({ data, items, className, runtimePlanItemId, runtimeEvalMode }:
  LetterSoundLinkTeachingProps & { items: LetterSoundItem[] }) {
  const instance = useRef(data.instanceId || `letter-sound-link-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const [tapped, setTapped] = useState<string | null>(null);
  const evalMode = runtimeEvalMode || 'see_hear';

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    id: item.id,
    task: askFor(item),
    // `hear-see` deliberately has none: the activity checks the tap, and the
    // tutor is never told which letter makes the sound.
    ...(acceptedFor(item) !== undefined ? { expectedAnswer: acceptedFor(item) } : {}),
    response: item.answerKind === 'gesture' ? 'gesture' as const : 'speech' as const,
    checkResponse: item.answerKind === 'gesture'
      ? (response: string) => response.trim().toLowerCase() === item.answer.trim().toLowerCase()
      : () => null,
  })), [items]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'letter-sound-link',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, evalMode, items: assignments, workspace,
    onItemOpened: () => setTapped(null) });

  const evaluation = useTeachingEvaluation<LetterSoundLinkMetrics>({ primitiveType: 'letter-sound-link',
    instanceId: instance.current, data, assignments, lesson, evalMode,
    metrics: result => {
      const solved = new Set(result.outcomes.filter(o => o.solved).map(o => o.id));
      const rate = (predicate: (item: LetterSoundItem) => boolean) => {
        const scoped = items.filter(predicate);
        if (!scoped.length) return 100;
        return Math.round(scoped.filter(item => solved.has(item.id)).length / scoped.length * 100);
      };
      // The one confusion this primitive observes directly: a wrong TAP names
      // the letter the child reached for instead of the one that makes the sound.
      const byId = new Map(items.map(item => [item.id, item]));
      const confused = new Set(result.teachingAttempts
        .filter(attempt => !attempt.correct && attempt.source === 'gesture')
        .map(attempt => [byId.get(attempt.itemId)?.answer.toLowerCase() ?? '', attempt.response.toLowerCase()])
        .filter(([target, chosen]) => target && chosen && target !== chosen)
        .map(pair => [...pair].sort().join('↔')));
      return { type: 'letter-sound-link', letterGroup: data.letterGroup,
        challengesCorrect: result.solvedCount, challengesTotal: items.length,
        // see-hear is grapheme → SPOKEN phoneme; hear-see is phoneme → grapheme.
        // keyword-match contributes to neither direction on purpose.
        graphemeToPhonemeAccuracy: rate(item => item.mode === 'see-hear'),
        phonemeToGraphemeAccuracy: rate(item => item.mode === 'hear-see'),
        vowelSoundAccuracy: rate(item => VOWELS.has(item.letter.toLowerCase())),
        consonantSoundAccuracy: rate(item => !VOWELS.has(item.letter.toLowerCase())),
        confusedSoundPairs: Array.from(confused), attemptsCount: result.attemptsCount };
    } });

  const item = items[lesson.state.index];
  const gesture = item.answerKind === 'gesture';
  /** The first moment the anchor may appear: a committed correct attempt on
   *  THIS item. There is no `phase === 'affirmed'` on this path — the verdict
   *  and the advance commit together — so the reveal is keyed on the record. */
  const solved = lesson.state.attempts.some(attempt => attempt.itemId === item.id && attempt.correct);
  const printed = printedStimulus(item);

  useLayoutEffect(() => {
    const objects = gesture
      // Both letters carry the SAME group. Nothing in the scene says which one
      // is the answer, because nothing in the scene knows.
      ? item.options.map(option => ({ id: `option-${option.value.toLowerCase()}`,
        label: `a card showing the letter "${option.value.toUpperCase()}"`,
        selected: tapped?.toLowerCase() === option.value.toLowerCase(),
        group: 'one of the two letters the learner chooses between' }))
      : [{ id: 'letter', label: `the letter "${item.letter}" printed on the card`, selected: false,
          group: 'the printed letter this question is about' },
        ...(item.mode === 'keyword-match' ? item.options.map(option => ({
          id: `picture-${option.value.toLowerCase()}`, label: `a picture of a ${option.value}`,
          selected: false, group: 'one of the two pictures' })) : [])];
    workspace.current = {
      objects,
      demonstration: marks,
      facts: { kind: item.mode, assignment: assignmentFor(item), supportTier: item.tier,
        // `hear-see` needs the sound published: the tutor has to say it, and it
        // is the QUESTION rather than the answer. The other two directions carry
        // their sound in `expectedAnswer` (see-hear) or not at all.
        ...(gesture ? { soundToSay: item.spoken } : { printedLetter: item.letter.toUpperCase() }),
        ...(item.tier === 'hard' && !gesture
          ? { coldAsk: 'This item is answered cold on purpose: the sound is not modelled before the learner answers.' }
          : {}) },
      readyForResponse: true, canDemonstrate: !gesture, canPresent: false,
      mark, clearPresentation: () => mark([]),
    };
    lesson.publishWorkspace();
  });

  const tapLetter = (letter: string) => {
    if (!gesture || !lesson.canAttempt || lesson.isBlocked()) return;
    SoundManager.tap();
    setTapped(letter);
    lesson.submitGestureResponse(letter);
  };

  const summary = lesson.summary;
  if (summary) return <LuminaCard className={className} surface="elevated">
    <LuminaCardContent className="space-y-6">
      <PhaseSummaryPanel heading="Letter-Sound Link Complete!"
        celebrationMessage={`You worked on ${items.length} letter sounds!`}
        overallScore={evaluation.submittedResult?.score} durationMs={evaluation.elapsedMs}
        phases={summary.outcomes.map((outcome, position) => ({
          label: items[position] ? MODE_BADGE[items[position].mode] : '', score: outcome.score,
          attempts: outcome.attempts, firstTry: outcome.corrections === 0, accentColor: 'cyan' as const }))} />
    </LuminaCardContent>
  </LuminaCard>;

  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader>
      <div className="flex items-center justify-between gap-3">
        <div>
          <LuminaCardTitle>{data.title || 'Letter Sounds'}</LuminaCardTitle>
          <LuminaCardDescription>Letter group {data.letterGroup}</LuminaCardDescription>
        </div>
        <LuminaBadge accent="cyan">{MODE_BADGE[item.mode]}</LuminaBadge>
      </div>
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
      <div data-letter-stage={item.mode} className="flex flex-col items-center gap-5">
        {printed !== null && <div data-letter-object="letter" data-pip-object="letter"
          data-tutor-demonstration={marks.includes('letter')}
          aria-label={`The letter ${printed}`}
          className={`rounded-2xl border-2 border-white/15 bg-white/5 px-12 py-6 text-8xl font-bold ${letterColor(item.letter)} ${
            marks.includes('letter') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
          {printed}
        </div>}

        {gesture && <div className="flex items-center justify-center gap-6 sm:gap-10">
          {item.options.map(option => {
            const isTarget = option.value.toLowerCase() === item.answer.toLowerCase();
            const state = solved && isTarget ? 'correct'
              : tapped === option.value && !isTarget ? 'incorrect' : 'idle';
            return <button key={option.value} type="button" data-letter-option={option.value.toLowerCase()}
              data-pip-object={`option-${option.value}`} data-tutor-demonstration={false}
              disabled={!lesson.canAttempt} onClick={() => tapLetter(option.value)}
              aria-label={`Tap the letter ${option.value.toUpperCase()}`}
              className={`h-28 w-28 rounded-2xl border-2 text-5xl font-bold transition-all sm:h-32 sm:w-32 ${
                answerStateClass(state)} ${state === 'idle' ? letterColor(option.value) : ''} ${
                solved && isTarget ? 'scale-105 ring-2 ring-emerald-400/40' : ''}`}>
              {option.value.toUpperCase()}
            </button>;
          })}
        </div>}

        {item.mode === 'keyword-match' && <div className="flex items-center justify-center gap-6 sm:gap-10">
          {item.options.map(option => {
            const isTarget = option.value.toLowerCase() === item.answer.toLowerCase();
            const marked = marks.includes(`picture-${option.value.toLowerCase()}`);
            return <div key={option.value} data-letter-object={`picture-${option.value.toLowerCase()}`}
              data-tutor-demonstration={marked} aria-label={`A picture of a ${option.value}`}
              className={`flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 transition-all sm:h-32 sm:w-32 ${
                solved && isTarget ? 'scale-105 border-emerald-400/50 bg-emerald-500/20 ring-2 ring-emerald-400/40'
                  : 'border-white/15 bg-white/5'} ${
                marked ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
              <span aria-hidden="true" className="text-4xl">{option.emoji}</span>
              {/* The word prints only once the answer is committed — saying it
                  IS the assignment, so printing it earlier answers for the child. */}
              {solved && isTarget && <span data-letter-revealed={option.value}
                className="text-sm font-bold text-emerald-200">{option.value}</span>}
            </div>;
          })}
        </div>}

        {item.mode === 'see-hear' && solved && <div data-letter-revealed={item.keyword}
          className="flex items-center justify-center gap-2 text-lg font-bold text-emerald-200">
          <span aria-hidden="true" className="text-4xl">{item.keywordEmoji}</span>
          <span>{item.keyword}</span>
        </div>}
      </div>
      {!gesture && <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>}
      <p className="text-center text-sm text-slate-400">
        {gesture ? 'Listen, then tap the letter that makes the sound.' : 'Say your answer out loud, or ask for help.'}
      </p>
    </LuminaCardContent>
  </LuminaCard>;
}
