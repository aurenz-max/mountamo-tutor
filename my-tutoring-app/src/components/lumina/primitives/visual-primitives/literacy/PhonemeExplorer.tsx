'use client';

/**
 * PhonemeExplorer — phoneme awareness on the live tutor's workspace (boss: `phonemeExplorer.boss.ts`, card:
 * `phonemeExplorer.card.ts`). Every mode is answered out loud; the tutor teaches and judges, the workspace commits
 * outcomes and owns progression. This file draws the page and the levers the tutor pulls. There is no advance timer,
 * no answer button and no Next button. An unbound mount shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *
 * ALL SIX MODES ARE VERBAL — the old 4-choice grid was a costume on each:
 *  - isolate: the four cards STAY as the on-screen MENU (the question side, unmarked — print is not a leak here) but
 *    the answer is SAID, not tapped. Tapping a card asks the tutor to say that word (tap-to-hear, never a commit).
 *  - medial: isolate's minimal-pair sibling for the MIDDLE sound. The stimulus word is spoken and NEVER PRINTED: a
 *    child who can read "cat" and "hat" matches the letter `a` on sight and never hears a vowel.
 *  - ending: the target and the card words are heard; their spellings stay hidden until credit.
 *  - blend: the phoneme tiles stay (tap one to hear that sound) and the child SAYS the blended word.
 *  - segment: the child SAYS how many sounds. The word is never printed: a reader would count letters.
 *  - manipulate: the child SAYS the new word. The original word stays printed — it is the stimulus.
 *
 * SUPPORT TIERS (L3 contract): the worked-example card and its sub-label (isolate), the picture cues, the blend cue
 * furniture and the printed operation detail are tier-withdrawn at render time from the generator-stamped flags; the
 * read-aloud flag governs whether the ask reads the menu out (`askFor`).
 *
 * ANSWER-LEAK RULE: blend/manipulate answers and segment's count appear on screen only once the answer is credited.
 * Tap-to-hear asks for question-side audio only (a card word or a sound).
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { PhonemeExplorerMetrics } from '../../../evaluation/types';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace, useRunnerPip } from '../../../pip/WorkspacePip';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import { hearSoundRequest, hearWordRequest, phonemeScene, shufflePhonemeMenus, type PhonemeExplorerItem } from './phonemeExplorerDomain';
import {
  EXAMPLE_LEVER, MARK_LEVER, NAME_CARDS_LEVER, OPERATION_LEVER, PHONEME_LEVERS, POSITION_LEVER, SLIDE_LEVER, TOKENS_LEVER,
  changedBox, positionModelFor, type PhonemeLeverContext,
} from './phonemeExplorerLevers';
import { graphemes } from './wordWorkoutLevers';
import { phonemeExplorerBoss, phonemeExplorerItems } from './phonemeExplorer.boss';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface PhonemeChoice {
  word: string;
  emoji: string;
  correct: boolean;
}

interface PhonemeChallenge {
  id: string;
  mode: 'isolate' | 'ending' | 'medial' | 'blend' | 'segment' | 'manipulate';
  // -- isolate fields --
  phoneme?: string;
  phonemeSound?: string;
  exampleWord?: string;
  exampleEmoji?: string;
  /** isolate + ending + medial: the 4-card menu (1 correct, unmarked on screen). */
  choices?: PhonemeChoice[];
  // -- medial fields (targetWord/targetEmoji are shared with segment) --
  /** medial: the SHORT vowel letter in the middle of targetWord. Correction-only. */
  vowel?: string;
  /** ending: the target word's single final consonant phoneme. */
  finalPhoneme?: string;
  // -- blend fields --
  phonemeSequence?: string[];
  /** blend: the ANSWER — the word the sounds make. Never printed pre-affirm. */
  word?: string;
  emoji?: string;
  // -- segment fields --
  targetWord?: string;
  targetEmoji?: string;
  /** segment: the correct breakdown; its LENGTH is the graded answer. */
  segments?: string[];
  // -- manipulate fields --
  originalWord?: string;
  originalEmoji?: string;
  operation?: string;
  operationDescription?: string;
  /** manipulate: the ANSWER. Never printed pre-affirm. */
  resultWord?: string;
  resultEmoji?: string;
  remediationMove?: 'contrast_phoneme' | 'blend_through' | 'segment_boundary' | 'isolate_operation';
  /** Word-space calibration stamp (service/wordSpace); never rendered or sent to the tutor. */
  wordSpace?: { space: string; structure: string; beta: number };

  // ── Within-mode support tier scaffolds (stamped by the generator from
  //    ctx.supportTier). Display/instruction only — they NEVER change the
  //    phonemes, the words, or the answer. ALL OPTIONAL: absent ⇒ legacy
  //    full-help render, which is why every read is `!== false`. ──
  /** isolate — render the worked-example card at all. Default: shown. */
  showExampleWord?: boolean;
  /** isolate — render the "starts with X" sub-label under the example. Default: shown. */
  showExampleHint?: boolean;
  /** all modes — render emoji on the menu cards + the medial/segment/manipulate stimulus. Default: shown. */
  showChoiceEmoji?: boolean;
  /** blend — render the "Blend these sounds together:" cue and the "+" separators. Default: shown. */
  showBlendCue?: boolean;
  /** manipulate — render the authored operationDescription (vs a neutral line). Default: shown. */
  showOperationDetail?: boolean;
  /** ask — enumerate the isolate/ending/medial menu aloud. Default: enumerate. */
  readOptionsAloud?: boolean;
}

export interface PhonemeExplorerData {
  title: string;
  challenges: PhonemeChallenge[];
  /** Within-mode support tier from the manifest (generator stamps per-challenge flags). */
  supportTier?: 'easy' | 'medium' | 'hard';
  gradeLevel?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PhonemeExplorerMetrics>) => void;
}

interface PhonemeExplorerProps {
  data: PhonemeExplorerData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<string, { badge: string; icon: string; prompt: string; accent: LuminaAccent }> = {
  isolate: { badge: 'Sound Match', icon: '🔊', prompt: 'Which word begins with my sound? Say it!', accent: 'blue' },
  ending: { badge: 'Ending Sound', icon: '👂', prompt: 'Which heard word has the same ending sound? Say it!', accent: 'cyan' },
  medial: { badge: 'Middle Sound', icon: '🎯', prompt: 'Which word has the same middle sound? Say it!', accent: 'rose' },
  blend: { badge: 'Sound Blend', icon: '🧩', prompt: 'Say the sounds fast — what word?', accent: 'purple' },
  segment: { badge: 'Sound Count', icon: '✂️', prompt: 'How many sounds? Say the number!', accent: 'emerald' },
  manipulate: { badge: 'Sound Swap', icon: '🔀', prompt: 'Say the new word!', accent: 'amber' },
};

// ============================================================================
// Component
// ============================================================================

function PhonemeExplorerSurface({ data, className, runtimePlanItemId }: PhonemeExplorerProps) {
  const instance = useRef(data.instanceId || `phoneme-explorer-${Date.now()}`);
  // Menus are shuffled per session, and the ask reads the cards in the order they are drawn.
  const items = useMemo(() => shufflePhonemeMenus(phonemeExplorerItems(data), instance.current), [data]);
  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }
  return <ExplorerWorkspace key={data.instanceId} data={data} items={items} instanceId={instance.current}
    className={className} runtimePlanItemId={runtimePlanItemId} />;
}

function ExplorerWorkspace({ data, items, instanceId, className, runtimePlanItemId }:
  PhonemeExplorerProps & { items: PhonemeExplorerItem[]; instanceId: string }) {
  const { title, challenges = [] } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  // Levers pulled, keyed by the session item they were pulled on; the easier practice item a simplify lever put on
  // screen in its place; the learner's own counters (segment).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PhonemeExplorerItem | null>(null);
  const [tokens, setTokens] = useState(0);
  const openedIndex = useRef(-1);

  const assignments = useMemo(() => items.map(item => ({ ...phonemeExplorerBoss.assignment(item), checkResponse: () => null })), [items]);
  const lesson = useTeachingWorkspace({ instanceId, primitiveId: 'phoneme-explorer',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace,
    onItemOpened: opened => {
      if (opened !== openedIndex.current) setPractice(null);
      openedIndex.current = opened;
    } });
  useTeachingEvaluation<PhonemeExplorerMetrics>({ primitiveType: 'phoneme-explorer', instanceId, data, assignments, lesson,
    metrics: result => ({ type: 'phoneme-explorer', challengesCorrect: result.solvedCount, challengesTotal: items.length,
      accuracy: result.accuracy, attemptsCount: result.attemptsCount,
      // Every answer is spoken.
      voiceAnswerCount: result.solvedCount }) });

  const challengeById = useMemo(() => new Map(challenges.map(ch => [ch.id, ch])), [challenges]);
  const sessionItem = items[lesson.state.index];
  const sessionChallenge = challengeById.get(sessionItem.id);
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  // A practice item has no challenge: every aid at its default.
  const currentChallenge = practice ? undefined : sessionChallenge;
  const pulledLevers = !practice && leverState.item === sessionItem.id ? leverState.pulled : [];
  const pulled = (id: string) => pulledLevers.includes(id);
  const leverCtx: PhonemeLeverContext = { items, withdrawn: {
    example: sessionChallenge?.showExampleWord === false, operation: sessionChallenge?.showOperationDetail === false } };
  /** Credited: the first moment the answer may appear on screen. */
  const revealed = lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct && !lesson.state.practice && !practice;
  useRunnerPip({ instanceId, itemId: currentItem.id, running: lesson.state.phase !== 'completed', solved: revealed });
  const isPreReader = isPreReaderGrade(data.gradeLevel ?? '');
  const positionModel = pulled(POSITION_LEVER) ? positionModelFor(currentItem, items) : null;

  useLayoutEffect(() => {
    // No lever on a practice item: the full item's levers come back with it.
    const levers = practice ? [] : PHONEME_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(phonemeScene(currentItem, { namingCards: pulledLevers.includes(NAME_CARDS_LEVER) }), {
        support: practice ? '' : PHONEME_LEVERS.support(sessionItem),
        onScreen: practice ? '' : PHONEME_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        const easier = PHONEME_LEVERS.simpler(sessionItem, leverCtx, id);
        if (easier) {
          setLeverState(next); setPractice(easier);
          return { practice: phonemeExplorerBoss.assignment(easier) };
        }
        if (id === TOKENS_LEVER) setTokens(0);
        setLeverState(next);
        return true;
      },
      endPractice: () => setPractice(null),
    };
  });

  // ── Tap-to-hear question-side audio: silent host requests, never a learner turn and never the answer. ──
  const hearWord = (word: string | undefined) => {
    if (!word) return;
    SoundManager.tap();
    lesson.requestHear(hearWordRequest(word));
  };
  const hearSound = (raw: string | undefined) => {
    if (!raw) return;
    SoundManager.tap();
    lesson.requestHear(hearSoundRequest(raw));
  };

  const summary = lesson.summary;
  const phases = summary?.outcomes.map(outcome => {
    const item = items.find(i => i.id === outcome.id);
    const meta = MODE_META[item?.kind ?? 'isolate'];
    return { label: outcome.assisted ? `${meta.badge} (with help)` : meta.badge, icon: meta.icon, score: outcome.score,
      attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1, accentColor: 'emerald' as const };
  }) ?? [];

  // ============================================================================
  // Render helpers per mode
  // ============================================================================

  /**
   * The 4-card MENU — the question side, unmarked, shared by the two menu
   * modes (isolate, medial). Tap a card to HEAR its word; the answer is
   * SPOKEN, never tapped. The reveal highlight lands only after the tutor's
   * affirmation, so the correct card is not marked while the child is thinking.
   */
  const renderMenu = (
    item: PhonemeExplorerItem,
    ch: PhonemeChallenge | undefined,
    hidePrintedWords = false,
  ) => (
    <>
      <div className="grid grid-cols-2 gap-3">
        {(item.menu ?? []).map((card, idx) => {
          const isAnswer = card.word.toLowerCase() === item.answer.toLowerCase();
          return (
            <button
              key={`${item.id}-${idx}`}
              data-pip-object={`card-${idx}`}
              onClick={() => hearWord(card.word)}
              className={`
                rounded-xl border-2 p-4 flex flex-col items-center gap-2
                transition-all duration-200 cursor-pointer
                ${revealed && isAnswer
                  ? 'bg-emerald-500/15 border-emerald-400/50 ring-2 ring-emerald-400/40'
                  : 'bg-white/5 border-white/10 hover:border-white/25'}
              `}
            >
              {(ch?.showChoiceEmoji !== false) && <span className="text-3xl">{card.emoji}</span>}
              {(!hidePrintedWords || revealed) ? (
                <span className="text-lg font-bold">{card.word}</span>
              ) : (
                <span className="text-xs font-semibold text-slate-400">Tap to hear</span>
              )}
              {pulled(NAME_CARDS_LEVER) && <span data-lever="name-card" role="img" aria-label="read aloud">🔊</span>}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-slate-500">Tap a card to hear it — then say your answer out loud.</p>
    </>
  );

  const renderIsolate = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      {/* Phoneme tile — the stimulus. Tap to hear the sound. */}
      <div className="flex flex-col items-center gap-3">
        <button
          data-pip-object="stimulus"
          onClick={() => hearSound(item.phonemeSound ?? item.phoneme)}
          className="rounded-2xl bg-blue-500/15 border-2 border-blue-500/30 px-10 py-6 text-center cursor-pointer"
        >
          <div className="text-5xl font-black text-blue-200 tracking-wide">{item.phoneme}</div>
          <p className="text-sm text-blue-400/70 mt-2 italic">&ldquo;{item.phonemeSound}&rdquo;</p>
        </button>
      </div>

      {/* Worked example — SCAFFOLDING, tier-withdrawn whole at hard; the
          sub-label goes first at medium. Tap to hear the example word. */}
      {(ch?.showExampleWord !== false || pulled(EXAMPLE_LEVER)) && item.exampleWord && (
        <button
          data-pip-object="example"
          onClick={() => hearWord(item.exampleWord)}
          className="mx-auto flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 px-5 py-3 cursor-pointer"
        >
          <span className="text-3xl">{item.exampleEmoji}</span>
          <div className="text-center">
            <span className="text-xl font-bold text-slate-100">{item.exampleWord}</span>
            {ch?.showExampleHint !== false && (
              <p className="text-xs text-slate-500">
                starts with <span className="text-blue-300 font-semibold">{item.phoneme}</span>
              </p>
            )}
          </div>
        </button>
      )}

      <p className="text-center text-base text-slate-300 font-medium">
        {MODE_META.isolate.prompt}
      </p>

      {renderMenu(item, ch)}
    </div>
  );

  /**
   * ending — target and menu words are heard, never printed pre-attempt. The
   * pictures locate the replay buttons but carry no letter or ending cue.
   */
  const renderEnding = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <button
          data-pip-object="stimulus"
          onClick={() => hearWord(item.targetWord)}
          className="rounded-2xl bg-cyan-500/15 border-2 border-cyan-500/30 px-10 py-6 text-center cursor-pointer"
        >
          <span className="text-5xl">
            {(ch?.showChoiceEmoji !== false) ? item.targetEmoji : '🔊'}
          </span>
          <p className="text-xs text-cyan-300/70 mt-2">Tap to hear my word</p>
        </button>
      </div>

      <p className="text-center text-base text-slate-300 font-medium">{MODE_META.ending.prompt}</p>

      {renderMenu(item, ch, true)}

      {revealed && (
        <LuminaPanel className="p-3 text-center">
          <span className="text-emerald-300 text-xl font-black">
            {item.targetWord} &amp; {item.answer}
          </span>
          <p className="text-slate-300 text-sm mt-1">
            both end with <span className="font-mono text-emerald-300">{item.finalPhonemeSpoken}</span>
          </p>
        </LuminaPanel>
      )}
    </div>
  );

  /**
   * medial — the stimulus word is NEVER PRINTED. That is the whole reason this
   * mode can test a vowel: a child who can read "cat" and "hat" side by side
   * matches the letter `a` on sight and never hears a sound. The picture (+
   * tap-to-hear) carries the word, exactly as in segment; only the four cards
   * are print, and they are the question side.
   */
  const renderMedial = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <button
          data-pip-object="stimulus"
          onClick={() => hearWord(item.targetWord)}
          className="rounded-2xl bg-rose-500/15 border-2 border-rose-500/30 px-10 py-6 text-center cursor-pointer"
        >
          <span className="text-5xl">
            {(ch?.showChoiceEmoji !== false) ? item.targetEmoji : '🔊'}
          </span>
          <p className="text-xs text-rose-300/70 mt-2">Tap to hear my word</p>
        </button>
      </div>

      <p className="text-center text-base text-slate-300 font-medium">{MODE_META.medial.prompt}</p>

      {renderMenu(item, ch)}

      {/* The reveal — the middle sound is NAMED only after the affirmation.
          Naming it earlier would hand over the extraction the ask withholds. */}
      {revealed && (
        <LuminaPanel className="p-3 text-center">
          <span className="text-emerald-300 text-xl font-black">
            {item.targetWord} &amp; {item.answer}
          </span>
          <p className="text-slate-300 text-sm mt-1">
            both have <span className="font-mono text-emerald-300">{item.vowelSpoken}</span> in the middle
          </p>
        </LuminaPanel>
      )}
    </div>
  );

  const renderBlend = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        {ch?.showBlendCue !== false && (
          <p className="text-sm text-purple-400/70 font-medium">Blend these sounds together:</p>
        )}
        <div data-pip-object="sounds" data-lever={pulled(SLIDE_LEVER) ? 'slide-tiles' : undefined}
          className={`flex items-center transition-all duration-500 ${pulled(SLIDE_LEVER) ? 'gap-0' : 'gap-2'}`}>
          {item.phonemeSequence?.map((p, i) => (
            <React.Fragment key={i}>
              <button
                data-pip-object={`sound-${i}`}
                onClick={() => hearSound(p)}
                className="rounded-xl bg-purple-500/15 border-2 border-purple-500/30 px-5 py-4 text-center cursor-pointer"
              >
                <span className="text-2xl font-black text-purple-200">/{p.replace(/\//g, '')}/</span>
              </button>
              {ch?.showBlendCue !== false && !pulled(SLIDE_LEVER) && i < (item.phonemeSequence?.length ?? 0) - 1 && (
                <span className="text-purple-400/50 text-lg">+</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {pulled(SLIDE_LEVER) && <div aria-hidden className="text-center text-3xl text-purple-300/80 -mt-3">⟶</div>}
      <p className="text-center text-base text-slate-300 font-medium">{MODE_META.blend.prompt}</p>

      {/* The reveal — the first moment the word may appear on screen. */}
      {revealed && (
        <LuminaPanel className="p-3 text-center">
          <span className="text-emerald-300 text-xl font-black">
            {item.answerEmoji} {item.answer}
          </span>
        </LuminaPanel>
      )}
      <p className="text-center text-xs text-slate-500">Tap a sound to hear it.</p>
    </div>
  );

  const renderSegment = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      {/* The word is NEVER printed — a reader would count letters, not sounds.
          The picture (tier-withdrawable) + tap-to-hear carry the stimulus. */}
      <div className="flex flex-col items-center gap-3">
        <button
          data-pip-object="stimulus"
          onClick={() => hearWord(item.targetWord)}
          className="rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 px-10 py-6 text-center cursor-pointer"
        >
          <span className="text-5xl">
            {(ch?.showChoiceEmoji !== false) ? item.targetEmoji : '🔊'}
          </span>
          <p className="text-xs text-emerald-300/70 mt-2">Tap to hear the word</p>
        </button>
      </div>

      <p className="text-center text-base text-slate-300 font-medium">{MODE_META.segment.prompt}</p>

      {/* Help: counts only the learner's own pushes. No boxes are drawn ahead: their number is the answer. */}
      {pulled(TOKENS_LEVER) && (
        <div data-lever="push-tokens" className="flex flex-col items-center gap-2">
          <div data-tokens className="flex min-h-12 flex-wrap items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-950/10 px-4 py-2">
            {Array.from({ length: tokens }, (_, i) => (
              <span key={i} data-token className="h-8 w-8 rounded-full bg-emerald-400/70" />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Push a counter" onClick={() => { SoundManager.tap(); setTokens(n => Math.min(n + 1, 8)); }}
              className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-2 text-2xl">➕</button>
            <button type="button" aria-label="Clear the counters" onClick={() => setTokens(0)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-2xl">↺</button>
          </div>
        </div>
      )}

      {/* The reveal — count + breakdown appear only after the affirmation. */}
      {revealed && (
        <LuminaPanel className="p-3 text-center">
          <span className="text-emerald-300 text-xl font-black">
            {item.targetWord} — {item.answer} sounds
          </span>
          {item.segments && (
            <p className="text-slate-300 text-sm mt-1 font-mono">
              {item.segments.map((s) => `/${s.replace(/\//g, '')}/`).join(' ')}
            </p>
          )}
        </LuminaPanel>
      )}
    </div>
  );

  const renderManipulate = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      {/* Original word — the stimulus, printed (sound-swap's rule). Tap to hear. */}
      <div className="flex flex-col items-center gap-3">
        <button
          data-pip-object="stimulus"
          onClick={() => hearWord(item.originalWord)}
          className="rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 px-10 py-6 text-center cursor-pointer"
        >
          {(ch?.showChoiceEmoji !== false) && <span className="text-4xl">{item.originalEmoji}</span>}
          <div className="text-3xl font-black text-amber-200 mt-2">{item.originalWord}</div>
        </button>
      </div>

      {/* Operation — tier-withdrawable print; the scripted ask always says it. */}
      <LuminaPanel className="text-center">
        <p className="text-base text-slate-200 font-medium">
          {ch?.showOperationDetail === false && !pulled(OPERATION_LEVER) ? 'Make a new word.' : (ch?.operationDescription ?? item.operationSpoken)}
        </p>
      </LuminaPanel>

      {pulled(MARK_LEVER) && changedBox(item) !== null && (
        <div data-lever="mark-position" className="flex justify-center gap-2">
          {graphemes((item.originalWord ?? '').toLowerCase()).map((g, i) => (
            <span key={i} data-box={i} data-empty={i === changedBox(item) ? 'true' : undefined}
              className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl font-bold ${i === changedBox(item)
                ? 'animate-pulse border-dashed border-amber-300/70 bg-transparent' : 'border-amber-300/30 bg-amber-500/10 text-amber-100'}`}>
              {i === changedBox(item) ? '' : isPreReader ? '●' : g}
            </span>
          ))}
        </div>
      )}
      <p className="text-center text-base text-slate-300 font-medium">{MODE_META.manipulate.prompt}</p>

      {/* The reveal — the first moment the new word may appear on screen. */}
      {revealed && (
        <LuminaPanel className="p-3 text-center">
          <span className="text-emerald-300 text-xl font-black">
            {item.answerEmoji} {item.answer}
          </span>
        </LuminaPanel>
      )}
    </div>
  );

  /** Help: another word in three sound boxes, the asked position lit. Never the item's words or sound. */
  const renderPositionModel = (model: NonNullable<typeof positionModel>, item: PhonemeExplorerItem) => {
    const at = item.kind === 'isolate' ? 0 : item.kind === 'medial' ? 1 : 2;
    return (
      <div data-lever="position-model" aria-label="Sound position model"
        className="flex items-center justify-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 p-3">
        <span className="text-4xl" role="img" aria-label={model.word}>{model.emoji}</span>
        <div className="flex gap-1.5">
          {model.sounds.map((s, i) => (
            <span key={i} data-box={i} data-lit={i === at ? 'true' : undefined}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-lg font-bold ${i === at
                ? 'border-cyan-300 bg-cyan-400/25 text-cyan-100' : 'border-white/15 bg-white/5 text-slate-400'}`}>
              {isPreReader ? '●' : s}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  const modeMeta = MODE_META[currentItem.kind];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!summary && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {summary ? (
          <PhaseSummaryPanel phases={phases} heading="Phoneme Explorer Complete!"
            celebrationMessage="Great job hearing every sound!" className="mt-4" />
        ) : (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
            </div>
            {practice && <div className="text-center text-xs text-amber-300" data-practice-item>Practice round</div>}

            {/* Pip's dock sits above the stage: the stimulus tops every mode, so a pointer to it never crosses a card. */}
            <PipDock />

            <PipWorkspace className="space-y-4">
              {currentItem.kind === 'isolate' && renderIsolate(currentItem, currentChallenge)}
              {currentItem.kind === 'ending' && renderEnding(currentItem, currentChallenge)}
              {currentItem.kind === 'medial' && renderMedial(currentItem, currentChallenge)}
              {currentItem.kind === 'blend' && renderBlend(currentItem, currentChallenge)}
              {currentItem.kind === 'segment' && renderSegment(currentItem, currentChallenge)}
              {currentItem.kind === 'manipulate' && renderManipulate(currentItem, currentChallenge)}
              {positionModel && renderPositionModel(positionModel, currentItem)}
            </PipWorkspace>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const PhonemeExplorer = withWorkspaceOnly<PhonemeExplorerProps>('phoneme-explorer', PhonemeExplorerSurface,
  props => props.data.title);

export default PhonemeExplorer;
