'use client';

/**
 * LetterSoundLink, taught on the shared teaching workspace only (the boss: `letterSoundLink.card.ts` +
 * `letterSoundLink.boss.ts`). A mount with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *
 * WHAT THE CHILD DOES, PER DIRECTION.
 *  - see_hear: a letter is printed; the child SAYS the sound it makes. The tutor judges it against the key.
 *  - hear_see: the tutor says a sound; the child TAPS which of two letters makes it. A letter NAME has no reliable
 *    judge (b/p/d/e/g sound alike), so the letter is touched, and the activity checks the tap. The tutor is never told
 *    which letter is right, and every object on this stage is a choice, so it offers no `demonstrate`.
 *  - keyword_match: a letter and two pictures; the child SAYS the picture word that starts with the letter's sound.
 *    Nothing is tappable, and no word is printed before credit.
 *
 * THE KEYWORD IS NOT ON THE STAGE. The anchor picture encodes the sound, so it is drawn only once the answer is
 * credited. The one exception is a pulled lever (`letterSoundLinkLevers.ts`): `keyword_under_both` draws a picture
 * under BOTH hear_see cards alike, which marks neither.
 *
 * The domain (build gates, ask, key, scene) is `letterSoundLinkDomain.ts`; the levers `letterSoundLinkLevers.ts`.
 * Nothing in this file writes a spoken line.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaReadAloudGlyph, answerStateClass } from '../../../ui';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { LetterSoundLinkMetrics } from '../../../evaluation/types';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace, type WorkspaceScene }
  from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace, useRunnerPip } from '../../../pip/WorkspacePip';
import { practiceScore } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';
import type { WordSpaceStamp } from '../../../service/wordSpace/pick';
import { KEYWORDS_LEVER, LETTER_MODEL_LEVER, LETTER_SOUND_LEVERS, PAIR_MODEL_LEVER, VOICE_LEVER,
  cardKeywords, laterStimuli, letterModelFor, pairModelFor, voiceModelFor } from './letterSoundLinkLevers';
import { hearSoundRequest, letterSoundMiss, printedStimulus, workspaceScene,
  type LetterSoundItem, type LetterSoundMode, type LetterSoundTier } from './letterSoundLinkDomain';
import { letterSoundLinkBoss, letterSoundLinkItems } from './letterSoundLink.boss';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface LetterSoundLinkChallenge {
  id: string;
  mode: LetterSoundMode;
  targetLetter: string;
  targetSound: string;
  keywordWord: string;
  keywordImage: string;
  options?: Array<{ letter?: string; sound?: string; isCorrect: boolean }>;
  sharedSoundLetters?: string[];
  /** Private generator trace; never rendered as student-visible copy. */
  remediationMove?: 'contrast_sound' | 'contrast_letter' | 'contrast_keyword';

  // ── Legacy within-mode support-tier scaffolds, stamped by the generator. INERT on this surface: the tier reaches
  //    the tutor as the lever set's `support` fact. Kept on the type so the tier resolver, its unit tests and any
  //    cached content still typecheck. ──
  showKeywordAnchor?: 'proactive' | 'after-miss' | 'never';
  strategyHint?: string | null;
  protocolHint?: string | null;
  showSharedSoundHint?: boolean;
  auditionBeforeCommit?: boolean;
  /** Word-space calibration stamp (service/wordSpace); never rendered, never sent to the tutor. */
  wordSpace?: WordSpaceStamp;
}

export interface LetterSoundLinkData {
  title: string;
  letterGroup: 1 | 2 | 3 | 4;
  cumulativeLetters: string[];
  challenges: LetterSoundLinkChallenge[];
  /** Canonical grade key ('K' | '1' | '2'…). Drives the pre-reader chrome gate. */
  gradeLevel?: string;
  /** Within-mode support tier from the manifest: when the model lever comes (`supportFact`). */
  supportTier?: LetterSoundTier;
  /** Attempts before an item is closed (generator stamp; the workspace host owns retries). */
  maxAttempts?: number;
  /** Letters the OBJECTIVE names that no mode in this session can ask a child
   *  for. The generator reports the residual instead of dropping it silently;
   *  the bench reads it as "no surface". */
  unaskableLetters?: string[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LetterSoundLinkMetrics>) => void;
}

export interface LetterSoundLinkProps {
  data: LetterSoundLinkData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** Vowels = red, consonants = blue (the shipped colour code). */
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const letterColor = (letter: string) => VOWELS.has(letter.toLowerCase()) ? 'text-red-300' : 'text-blue-300';

const MODE_BADGE: Record<LetterSoundMode, string> = {
  'see-hear': 'Say the sound', 'hear-see': 'Tap the letter', 'keyword-match': 'Say the word',
};

// ============================================================================
// Component
// ============================================================================

function LetterSoundLinkSurface({ data, className, runtimePlanItemId }: LetterSoundLinkProps) {
  const items = useMemo(() => letterSoundLinkItems(data), [data]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent>
      <p>These letters are still being prepared. Try generating this practice again.</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <LinkWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} />;
}

function LinkWorkspace({ data, items, className, runtimePlanItemId }: LetterSoundLinkProps & { items: LetterSoundItem[] }) {
  /** Pre-reader band: adult chrome (group, mode badge) is hidden, never read (reader-fit rule 7). */
  const isPreReader = (data.gradeLevel ?? 'K') === 'K';
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
  const leverCtx = useMemo(() => ({ items, letterGroup: data.letterGroup }), [items, data.letterGroup]);

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    ...letterSoundLinkBoss.assignment(item),
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
  // What a pulled lever draws (the lever set decides what is offered and writes the scene fact).
  const keywords = leverOn(KEYWORDS_LEVER) ? cardKeywords(sessionItem, laterStimuli(items, lesson.state.index)) : [];
  const voiceModel = leverOn(VOICE_LEVER) ? voiceModelFor(sessionItem) : null;
  const letterModel = leverOn(LETTER_MODEL_LEVER) ? letterModelFor(sessionItem, items, data.letterGroup) : null;
  const modelPicture = letterModel && sessionItem.mode === 'keyword-match';
  const pairModel = leverOn(PAIR_MODEL_LEVER) ? pairModelFor(sessionItem, items, data.letterGroup) : null;
  /** The first moment the anchor may appear: a committed correct attempt on THIS item. */
  const solved = lesson.state.attempts.some(attempt => attempt.itemId === item.id && attempt.correct);
  const printed = printedStimulus(item);
  useRunnerPip({ instanceId: instance.current, itemId: item.id, running: lesson.state.phase !== 'completed',
    solved: lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct });

  // What the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    const levers = practice ? [] : LETTER_SOUND_LEVERS.declare(sessionItem, leverCtx, pulled);
    const scene: WorkspaceScene = workspaceScene(item, tapped);
    workspace.current = {
      ...leverScene(practice
        ? { ...scene, facts: { ...scene.facts, practice: 'An easier practice item with a different sound, ungraded. The full item comes back after it.' } }
        : scene, {
        support: practice ? '' : LETTER_SOUND_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : LETTER_SOUND_LEVERS.onScreen(sessionItem, leverCtx, pulled) }),
      demonstration: marks,
      canDemonstrate: !gesture, mark, clearPresentation: () => mark([]),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the cards change before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const simpler = LETTER_SOUND_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!simpler) return 'There is no easier pair for this item.';
          setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
          setPractice(simpler);
          setTapped(null);
          return { practice: letterSoundLinkBoss.assignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setTapped(null); },
    };
  });

  const tapLetter = (letter: string) => {
    // On the practice item the tap is checked by `checkPractice` and names its own miss.
    if (!gesture || !lesson.canAttempt || lesson.isBlocked()) return;
    SoundManager.tap();
    setTapped(letter);
    lesson.submitGestureResponse(letter, letterSoundMiss(item, letter));
  };

  const summary = lesson.summary;
  if (summary) return <LuminaCard className={className} surface="elevated">
    <LuminaCardContent className="space-y-6">
      <PhaseSummaryPanel heading="Letter-Sound Link Complete!"
        celebrationMessage={`You worked on ${items.length} letter sounds!`}
        overallScore={practiceScore(summary) ?? evaluation.submittedResult?.score} durationMs={evaluation.elapsedMs}
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
          {!isPreReader && <LuminaCardDescription>Letter group {data.letterGroup}</LuminaCardDescription>}
        </div>
        {!isPreReader && <LuminaBadge accent="cyan">{MODE_BADGE[item.mode]}</LuminaBadge>}
      </div>
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
        {/* Tap-to-hear on hear_see: the sound is the question, so hearing it again is never a hint. */}
        {gesture && <button type="button" onClick={() => lesson.requestHear(hearSoundRequest(item))}
          aria-label="Hear the sound again"
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-500/30 bg-amber-500/15
            transition-all hover:scale-105 hover:bg-amber-500/25 active:scale-95">
          <span className="text-xl">🔊</span>
        </button>}
      </div>
      <div data-letter-stage={item.mode} className="flex flex-col items-center gap-5">
        {printed !== null && <div data-letter-object="letter" data-tutor-demonstration={marks.includes('letter')}
          aria-label={`The letter ${printed}`}
          className={`rounded-2xl border-2 border-white/15 bg-white/5 px-12 py-6 text-8xl font-bold ${letterColor(item.letter)} ${
            marks.includes('letter') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
          {printed}
        </div>}

        {/* Pip's dock sits below the letter card and above every answer surface (letter buttons, keyword pictures),
            so a pointer to the letter never crosses a choice. */}
        <PipDock />

        <PipWorkspace className="flex w-full flex-col items-center gap-5">
          {/* letter_model: another letter the session never uses (with its picture on keyword-match). */}
          {letterModel && <div data-lever="letter-model" aria-label="Letter model"
            className="flex items-center justify-center gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 px-5 py-3">
            <span className={`text-5xl font-bold ${letterColor(letterModel.letter)}`}>{letterModel.letter}</span>
            {modelPicture && <span role="img" aria-label={letterModel.word} className="text-4xl">{letterModel.emoji}</span>}
          </div>}

          {/* pair_model: two letters the session never uses, each with its picture, of the item's sound kinds. */}
          {pairModel && <div data-lever="pair-model" aria-label="Letter pair model"
            className="flex items-center justify-center gap-8 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 px-5 py-3">
            {pairModel.map(m => <div key={m.letter} data-pair-model={m.letter} className="flex items-center gap-2">
              <span className={`text-4xl font-bold ${letterColor(m.letter)}`}>{m.letter}</span>
              <span role="img" aria-label={m.word} className="text-3xl">{m.emoji}</span>
            </div>)}
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

          {gesture && <div className="flex items-start justify-center gap-6 sm:gap-10">
            {item.options.map(option => {
              const isTarget = option.value.toLowerCase() === item.answer.toLowerCase();
              const state = solved && isTarget ? 'correct'
                : tapped === option.value && !isTarget ? 'incorrect' : 'idle';
              const keyword = keywords.find(k => k.letter === option.value.toLowerCase());
              return <button key={option.value} type="button" data-letter-option={option.value.toLowerCase()}
                data-tutor-demonstration={false}
                disabled={!lesson.canAttempt} onClick={() => tapLetter(option.value)}
                aria-label={`Tap the letter ${option.value.toUpperCase()}`}
                className={`h-28 w-28 rounded-2xl border-2 text-5xl font-bold transition-all sm:h-32 sm:w-32 ${
                  answerStateClass(state)} ${state === 'idle' ? letterColor(option.value) : ''} ${
                  solved && isTarget ? 'scale-105 ring-2 ring-emerald-400/40' : ''}`}>
                {option.value.toUpperCase()}
                {/* keyword_under_both: the same size under both cards. */}
                {keyword && <span data-lever="card-keyword" role="img" aria-label={keyword.word}
                  className="mt-1 block text-3xl">{keyword.emoji}</span>}
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
                {/* The word prints only once the answer is credited: saying it IS the assignment. */}
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
        </PipWorkspace>
      </div>
      {!gesture && <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>}
      <p className="text-center text-sm text-slate-400">
        {gesture ? 'Listen, then tap the letter that makes the sound.' : 'Say your answer out loud, or ask for help.'}
      </p>
    </LuminaCardContent>
  </LuminaCard>;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as `<Component data={…} index={…} />`, the generated data in ONE
 *  `data` prop. The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card. */
export const LetterSoundLink = withWorkspaceOnly<LetterSoundLinkProps>('letter-sound-link', LetterSoundLinkSurface,
  props => props.data.title);

export default LetterSoundLink;
