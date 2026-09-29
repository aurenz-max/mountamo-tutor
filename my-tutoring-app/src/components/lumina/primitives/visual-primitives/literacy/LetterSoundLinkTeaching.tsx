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
 *
 * The one exception is a pulled lever (`letterSoundLinkLevers.ts`, handoff 22 L1):
 * `keyword_under_both` draws a keyword under BOTH hear-see cards alike, which marks
 * neither, and the scene never says which picture sits under which card.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { useSpeechScope } from '../../../pip/useSpeechScope';
import { letterSoundLinkPipPose } from '../../../pip/letterSoundLinkPipPose';
import { PIP_DOCK_CLASS } from '../../../pip/useWorkspacePipSurface';
import { FAR_PAIR_LEVER, KEYWORDS_LEVER, LETTER_MODEL_LEVER, VOICE_LEVER, cardKeywords, fartherPair, laterStimuli,
  letterModelFor, letterSoundLevers, voiceModelFor } from './letterSoundLinkLevers';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaReadAloudGlyph, answerStateClass } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace }
  from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { LetterSoundLinkMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { buildLetterSoundLinkItems, letterSoundMiss, printedStimulus, workspaceAssignment, workspaceScene,
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

export default function LetterSoundLinkTeaching({ data, className, runtimePlanItemId }: LetterSoundLinkTeachingProps) {
  const tier: LetterSoundTier = data.supportTier ?? 'medium';
  const items = useMemo(() => buildLetterSoundLinkItems(data.challenges ?? [], tier), [data.challenges, tier]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent>
      <p>These letters are still being prepared. Try generating this practice again.</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <LinkWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} />;
}

function LinkWorkspace({ data, items, className, runtimePlanItemId }:
  LetterSoundLinkTeachingProps & { items: LetterSoundItem[] }) {
  const instance = useRef(data.instanceId || `letter-sound-link-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const [tapped, setTapped] = useState<string | null>(null);
  // In-item levers, keyed by the session item they were pulled on, and the easier practice item a
  // simplify lever put on screen in its place. Retry on the practice item keeps it; only endPractice
  // or a new session item removes it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPracticeState] = useState<LetterSoundItem | null>(null);
  const practiceRef = useRef<LetterSoundItem | null>(null);
  const setPractice = (next: LetterSoundItem | null) => { practiceRef.current = next; setPracticeState(next); };
  const openedIndex = useRef(-1);

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    ...workspaceAssignment(item),
    checkResponse: item.answerKind === 'gesture'
      ? (response: string) => response.trim().toLowerCase() === item.answer.trim().toLowerCase()
      : () => null,
  })), [items]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'letter-sound-link',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace,
    onItemOpened: index => {
      setTapped(null);
      if (index !== openedIndex.current) setPractice(null);
      openedIndex.current = index;
    },
    checkPractice: (id, response) => practiceRef.current?.id === id
      ? response.trim().toLowerCase() === practiceRef.current.answer.trim().toLowerCase() : null });

  const evaluation = useTeachingEvaluation<LetterSoundLinkMetrics>({ primitiveType: 'letter-sound-link',
    instanceId: instance.current, data, assignments, lesson,
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

  const sessionItem = items[lesson.state.index];
  const item = practice ?? sessionItem;
  const gesture = item.answerKind === 'gesture';
  const pulled = leverState.item === sessionItem.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulled.includes(id);
  const keywords = leverOn(KEYWORDS_LEVER) ? cardKeywords(sessionItem, laterStimuli(items, lesson.state.index)) : [];
  const voiceModel = leverOn(VOICE_LEVER) ? voiceModelFor(sessionItem) : null;
  const letterModel = leverOn(LETTER_MODEL_LEVER) ? letterModelFor(sessionItem, items, data.letterGroup) : null;
  const modelPicture = letterModel && sessionItem.mode === 'keyword-match';
  /** The first moment the anchor may appear: a committed correct attempt on
   *  THIS item. There is no `phase === 'affirmed'` on this path — the verdict
   *  and the advance commit together — so the reveal is keyed on the record. */
  const solved = lesson.state.attempts.some(attempt => attempt.itemId === item.id && attempt.correct);
  const printed = printedStimulus(item);

  useLayoutEffect(() => {
    const levers = practice ? [] : letterSoundLevers(sessionItem, pulled, items, lesson.state.index, data.letterGroup);
    const scene = workspaceScene(item, tapped);
    const shown = [
      keywords.length ? 'a keyword picture under each of the two letter cards, alike' : '',
      voiceModel ? `a quiet sound and a buzzing sound on two pictures: a ${voiceModel.quiet.word} (${voiceModel.quiet.sound}) `
        + `and a ${voiceModel.buzz.word} (${voiceModel.buzz.sound}), with a hand on the throat` : '',
      letterModel ? `a model on another letter, ${letterModel.letter.toUpperCase()}${modelPicture ? `, beside its picture (${letterModel.word})` : ''}: `
        + `its sound is ${letterModel.sound}${modelPicture ? `, and ${letterModel.word} starts with it` : ''}. It is not this item's letter` : '',
    ].filter(Boolean);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(shown.length ? { levers_on_screen: shown.join('; ') } : {}),
        ...(practice ? { practice: 'An easier practice item with a different sound, ungraded. The full item comes back after it.' } : {}) },
      demonstration: marks,
      canDemonstrate: !gesture, mark, clearPresentation: () => mark([]),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the cards change before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (id === FAR_PAIR_LEVER) {
          const simpler = fartherPair(sessionItem, items, data.letterGroup);
          if (!simpler) return 'There is no easier pair for this item.';
          setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
          setPractice(simpler);
          setTapped(null);
          return { practice: workspaceAssignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setTapped(null); },
    };
  });

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of committed workspace state; Pip never answers, taps, or advances. The
  // pose policy is the scripted mount's: the letter card on a spoken item, the two letter
  // buttons only as a group on hear-see, and never a keyword picture (never registered).
  const ai = useLuminaAIContext();
  const tutorSpeaking = ai.isAudioPlaying && (ai.sessionMode !== 'lesson' || ai.activePrimitiveId === instance.current);
  const speechOnItem = useSpeechScope(item.id, tutorSpeaking);
  const [cuedItemId, setCuedItemId] = useState<string | null>(null);
  useEffect(() => { if (speechOnItem) setCuedItemId(item.id); }, [speechOnItem, item.id]);
  const latest = lesson.state.attempts[lesson.state.attempts.length - 1];
  const pip = usePipTargets(item.id, lesson.canAttempt);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || lesson.summary) return null;
    const targets = pip.targets();
    const cuedCurrentItem = cuedItemId === item.id || speechOnItem;
    const pose = letterSoundLinkPipPose({
      mode: item.mode, running: lesson.state.phase !== 'completed', preparing: false,
      currentSolved: lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct,
      // The observer credits and advances in one commit: hold that credit over its praise tail.
      revealHeld: !practice && !!latest?.correct && latest.itemId === items[lesson.state.index - 1]?.id && !cuedCurrentItem,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnItem,
      visibleIds: targets.map(target => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return { instanceId: instance.current, scopeId: item.id, label: 'Letter-sound link', dock: pip.dock.current, targets, pose };
  });

  const tapLetter = (letter: string) => {
    // On the practice item the tap is checked by `checkPractice` and names its own miss.
    if (!gesture || !lesson.canAttempt || lesson.isBlocked()) return;
    SoundManager.tap();
    pip.look(`option-${letter}`);
    setTapped(letter);
    lesson.submitGestureResponse(letter, letterSoundMiss(item, letter));
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
        {printed !== null && <div ref={pip.ref('letter')} data-letter-object="letter" data-pip-object="letter"
          data-tutor-demonstration={marks.includes('letter')}
          aria-label={`The letter ${printed}`}
          className={`rounded-2xl border-2 border-white/15 bg-white/5 px-12 py-6 text-8xl font-bold ${letterColor(item.letter)} ${
            marks.includes('letter') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
          {printed}
        </div>}

        {/* Pip's dock sits below the letter card and above every answer surface (letter buttons,
            keyword pictures), so a pointer to the letter never crosses a choice. */}
        {pipStore && <div ref={pip.dock} data-pip-dock={instance.current} className={PIP_DOCK_CLASS} />}

        {/* letter_model: another letter the session never uses (with its picture on keyword-match). */}
        {letterModel && <div data-lever="letter-model" aria-label="Letter model"
          className="flex items-center justify-center gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 px-5 py-3">
          <span className={`text-5xl font-bold ${letterColor(letterModel.letter)}`}>{letterModel.letter}</span>
          {modelPicture && <span role="img" aria-label={letterModel.word} className="text-4xl">{letterModel.emoji}</span>}
        </div>}

        {/* voice_feel_model: a quiet and a buzzing sound on two pictures, never this item's letters. */}
        {voiceModel && <div data-lever="voice-model" className="flex items-center justify-center gap-6 rounded-2xl border border-amber-300/20 bg-amber-500/5 px-5 py-3">
          <span aria-hidden="true" className="text-2xl">✋</span>
          {[{ ...voiceModel.quiet, buzz: false }, { ...voiceModel.buzz, buzz: true }].map(m => (
            <div key={m.word} data-voice-model={m.buzz ? 'buzz' : 'quiet'} className="flex flex-col items-center gap-1">
              <span role="img" aria-label={m.word} className="text-4xl">{m.emoji}</span>
              <span aria-hidden="true" className={`text-lg ${m.buzz ? 'text-amber-300' : 'text-slate-500'}`}>{m.buzz ? '〰〰' : '—'}</span>
            </div>
          ))}
        </div>}

        {gesture && <div ref={pip.ref('options')} data-pip-object="options" className="flex items-start justify-center gap-6 sm:gap-10">
          {item.options.map(option => {
            const isTarget = option.value.toLowerCase() === item.answer.toLowerCase();
            const state = solved && isTarget ? 'correct'
              : tapped === option.value && !isTarget ? 'incorrect' : 'idle';
            return <button key={option.value} type="button" data-letter-option={option.value.toLowerCase()}
              ref={pip.ref(`option-${option.value}`)} data-pip-object={`option-${option.value}`} data-tutor-demonstration={false}
              disabled={!lesson.canAttempt} onClick={() => tapLetter(option.value)}
              aria-label={`Tap the letter ${option.value.toUpperCase()}`}
              className={`h-28 w-28 rounded-2xl border-2 text-5xl font-bold transition-all sm:h-32 sm:w-32 ${
                answerStateClass(state)} ${state === 'idle' ? letterColor(option.value) : ''} ${
                solved && isTarget ? 'scale-105 ring-2 ring-emerald-400/40' : ''}`}>
              {option.value.toUpperCase()}
              {/* keyword_under_both: the same size under both cards. */}
              {keywords.some(k => k.letter === option.value.toLowerCase()) && <span data-lever="card-keyword"
                role="img" aria-label={keywords.find(k => k.letter === option.value.toLowerCase())!.word}
                className="mt-1 block text-3xl">{keywords.find(k => k.letter === option.value.toLowerCase())!.emoji}</span>}
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
