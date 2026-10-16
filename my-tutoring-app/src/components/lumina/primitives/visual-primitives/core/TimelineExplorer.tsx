'use client';

/**
 * Timeline Explorer: the learner reads a timeline of 5-8 events (opening each one), then answers check items built
 * and keyed by code from the events' time order (`timelineExplorerWorkspace.ts`):
 * - identify: a clue; which event is it? (said or tapped)
 * - date: when did this event happen? (said or tapped)
 * - order: move event cards into time order, earliest at the top
 * - cause_effect: match each cause to the event it led to
 * The timeline is hidden while the check is open, and no card shows a date. Two paths, chosen by
 * `withWorkspaceController`: the scripted path (tester, no tutor) has its own Next and two tries before a reveal; the
 * workspace path (W1, plain shape) commits every check through `progress.commitCheck` with a named miss, takes a
 * spoken answer judged by the tutor, and lets the runtime move on. The levers live in `timelineExplorerLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  type AnswerChoiceState,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TimelineExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  askOf, dateOf, deckOf, describeTimelineWork, emptyWork, optionLabel, solvedText, timelineCorrect,
  timelineItems, timelineMiss, titleOf, workComplete, workspaceAssignment, workspaceScene,
  type TimelineEvent, type TimelineItem, type TimelineKind, type TimelineTier, type TimelineWork,
} from './timelineExplorerWorkspace';
import {
  BEFORE_AFTER_LEVER, beforeAfterLines, cardLines, DATE_LINE_LEVER, dateLine, LED_TO_LEVER, ledToArrows, leverFact,
  READ_CARDS_LEVER, SHOW_DATES_LEVER, SHOW_TIMELINE_LEVER, simplerItem, timelineLevers,
} from './timelineExplorerLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { TimelineEvent, TimelineItem, TimelineKind, TimelineTier };

export interface TimelineExplorerData {
  title: string;
  subtitle: string;
  overview: string;
  timeSpan: { start: string; end: string };
  events: TimelineEvent[];
  summary: { text: string; keyTheme: string; lookingForward?: string };
  /** The kinds of check item this session asks (the eval mode's `challengeTypes`). */
  challengeTypes?: TimelineKind[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: TimelineTier;
  /** The check items, built and keyed by code at generation; absent or invalid: rebuilt from the events. */
  items?: TimelineItem[];
  /** Legacy generations (model-written questions and keys): read only for their kinds. */
  challenges?: Array<{ type?: string }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TimelineExplorerMetrics>) => void;
}

interface TimelineExplorerProps {
  data: TimelineExplorerData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const KIND_LABEL: Record<TimelineKind, string> = {
  identify: 'Which event?', date: 'When did it happen?', order: 'Put them in order', cause_effect: 'Cause and effect',
};

// ============================================================================
// Component
// ============================================================================

const TimelineExplorerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  TimelineExplorerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<TimelineItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, subtitle, overview, timeSpan, events = [], summary, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const deck = useMemo(() => deckOf(events), [events]);
  const items = useMemo(() => timelineItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.events, data.challengeTypes, data.difficulty, data.title]);
  const stableInstanceId = useRef(instanceId || `timeline-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;
  const span = `${timeSpan?.start || '?'} to ${timeSpan?.end || '?'}`;

  // ── Reading: open every event, then begin the questions ──
  const [reading, setReading] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [openedOrder, setOpenedOrder] = useState<string[]>([]);
  const readStart = useRef(Date.now());
  const readMs = useRef(0);
  const opened = new Set(openedOrder);
  const allOpened = deck.events.every(e => opened.has(e.id));

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const practiceAloud = useRef<() => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: item => workspaceAssignment(deck, item),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: () => practiceAloud.current(),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const sessionItem: TimelineItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<TimelineItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<TimelineWork>(() => emptyWork(sessionItem));
  const [activeCause, setActiveCause] = useState<string | null>(null);
  /** Workspace path: the checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [scriptedWrongs, setScriptedWrongs] = useState(0);
  const [scriptedReveal, setScriptedReveal] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow || scriptedReveal;

  const { submitResult, hasSubmitted, submittedResult } = usePrimitiveEvaluation<TimelineExplorerMetrics>({
    primitiveType: 'timeline-explorer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const openEvent = openIndex !== null ? deck.events[openIndex] : undefined;
  const aiPrimitiveData = useMemo(() => ({
    title, timeSpan: span, totalEvents: deck.events.length,
    currentEventIndex: reading && openIndex !== null ? openIndex + 1 : 0,
    currentEventTitle: reading ? openEvent?.title ?? '' : '', currentEventDate: reading ? openEvent?.date ?? '' : '',
    eventsExplored: opened.size, challengesCompleted: results.length, totalChallenges: items.length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [title, span, deck, reading, openIndex, openEvent, opened.size, results.length, items.length]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'timeline-explorer', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: 'Elementary', enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = (next?: TimelineItem) => {
    setWork(emptyWork(next ?? item)); setActiveCause(null); setWrongShown(false); setFeedback(null);
    setScriptedWrongs(0); setScriptedReveal(false); setPracticeSolved(false);
  };

  openItem.current = (index, retry) => {
    if (retry) { setWork(emptyWork(item)); setActiveCause(null); setWrongShown(false); setFeedback(null); return; }
    setPractice(null); clearItem(items[index]);
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || (solved.kind !== 'identify' && solved.kind !== 'date') || tappedCorrect.current === solved.id
      || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork(w => ({ ...w, choice: solved.eventId })); setWrongShown(false);
  };
  practiceAloud.current = () => {
    if (!practice) return;
    setPracticeSolved(true);
    if (practice.kind === 'identify' || practice.kind === 'date') setWork(w => ({ ...w, choice: practice.eventId }));
  };

  // ── Reading handlers ──
  const openAt = (index: number) => {
    const e = deck.events[index];
    if (!e) return;
    SoundManager.tap();
    setOpenIndex(index);
    setOpenedOrder(prev => (prev[prev.length - 1] === e.id ? prev : [...prev, e.id]));
    say(`[EVENT_SELECTED] The learner opened event ${index + 1} of ${deck.events.length}: "${e.title}" (${e.date}). Talk about it in one or two sentences.`);
  };
  const begin = () => {
    if (!allOpened || !items.length) return;
    readMs.current = Date.now() - readStart.current;
    setReading(false); clearItem(items[0]);
    say(`[QUESTIONS_START] The learner read all ${deck.events.length} events and begins ${items.length} questions. The timeline is now hidden.`);
  };

  // ── Check handlers ──
  const closed = reading || revealed || wrongShown || learnerBlocked();
  const choose = (id: string) => {
    if (!item || closed) return;
    SoundManager.select();
    setWork(w => ({ ...w, choice: id })); setFeedback(null);
  };
  const move = (from: number, by: number) => {
    if (!item || item.kind !== 'order' || closed) return;
    const to = from + by;
    if (to < 0 || to >= work.order.length) return;
    SoundManager.tick();
    setWork(w => { const order = [...w.order]; [order[from], order[to]] = [order[to], order[from]]; return { ...w, order }; });
    setFeedback(null);
  };
  const tapCause = (id: string) => {
    if (closed) return;
    SoundManager.select();
    setActiveCause(c => (c === id ? null : id)); setFeedback(null);
  };
  const tapEffect = (id: string) => {
    if (closed || !activeCause) return;
    SoundManager.snap();
    setWork(w => {
      const pairs = Object.fromEntries(Object.entries(w.pairs).filter(([c, e]) => c !== activeCause && e !== id));
      return { ...w, pairs: { ...pairs, [activeCause]: id } };
    });
    setActiveCause(null);
  };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = timelineCorrect(deck, item, work);
    progress.commitCheck(describeTimelineWork(deck, item, work), correct, correct ? undefined : timelineMiss(deck, item, work));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      say(`[CHALLENGE_CORRECT] ${askOf(deck, item)} The learner got it. ${solvedText(deck, item)} Reinforce the connection in time briefly.`);
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) { setWrongShown(true); return; }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= 2) {
      setScriptedReveal(true);
      if (!practice) progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say(`[ANSWER_REVEALED] Two tries missed on: ${askOf(deck, item)} The answer is now on screen: ${solvedText(deck, item)}`);
      return;
    }
    if (item.kind === 'identify' || item.kind === 'date') setWork(w => ({ ...w, choice: null }));
    setFeedback(item.kind === 'order' ? 'Not quite. Think about what had to happen first, and try once more.'
      : item.kind === 'cause_effect' ? 'Not quite. A cause always comes before what it leads to. Try once more.'
        : 'Not quite. Try once more.');
    say(`[CHALLENGE_INCORRECT] ${describeTimelineWork(deck, item, work)} for: ${askOf(deck, item)} It is wrong. You are not told the answer: ask what the learner remembers, without naming a choice.`);
  };

  const accuracy = (kinds: TimelineKind[]) => {
    const asked = items.filter(i => kinds.includes(i.kind));
    return asked.length ? Math.round((asked.filter(i => results.some(r => r.challengeId === i.id && r.correct)).length / asked.length) * 100) : 0;
  };
  const metrics = (): TimelineExplorerMetrics => {
    const idx = openedOrder.map(id => deck.rank.get(id) ?? 0);
    let fwd = 0, back = 0;
    for (let i = 1; i < idx.length; i++) { if (idx[i] > idx[i - 1]) fwd++; else if (idx[i] < idx[i - 1]) back++; }
    return {
      type: 'timeline-explorer',
      eventsExplored: opened.size,
      totalEvents: deck.events.length,
      orderingAccuracy: accuracy(['order']),
      identifyAccuracy: accuracy(['identify', 'date']),
      causeEffectAccuracy: accuracy(['cause_effect']),
      challengeAttempts: currentAttempts,
      averageTimePerEvent: deck.events.length ? Math.round(readMs.current / deck.events.length) : 0,
      explorationPattern: idx.length < 3 || fwd >= (idx.length - 1) * 0.6 ? 'sequential' : back >= (idx.length - 1) * 0.6 ? 'reverse' : 'random',
    };
  };

  /** Scripted path: Next, and on the last item the session report. */
  const next = () => {
    if (progress.advance()) { clearItem(items[currentIndex + 1]); return; }
    if (hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    const score = items.length ? Math.round((results.filter(r => r.correct).length / items.length) * 100) : 0;
    setSubmitted(true);
    submitResult(score >= 70, score, metrics(), { challengeResults: results });
    say(`[ALL_COMPLETE] The learner finished all ${items.length} questions. Key theme: ${summary?.keyTheme ?? ''}. Celebrate briefly.`);
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), challengeAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !item || isComplete) return;
    const scene = workspaceScene(deck, item, { reading, opened: opened.size, openEvent: openEvent?.id ?? null, work, solved: revealed },
      { title, span });
    if (reading) { workspace.current = { ...scene, readyForResponse: false, levers: [] }; return; }
    const levers = practice ? [] : timelineLevers(deck, sessionItem, pulled, items);
    const onScreen = practice ? '' : leverFact(deck, sessionItem, pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'A simpler item of the same kind, before the full item comes back.' } : {}),
        ...(onScreen ? { onScreen } : {}) },
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = simplerItem(deck, sessionItem, items);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(simpler); setPractice(simpler);
          return { practice: workspaceAssignment(deck, simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(sessionItem); setPractice(null); },
    };
  });

  // A timeline with no check item (too few events) stays a display: reading it all is its whole task, as before.
  useEffect(() => {
    if (tutorOwned || items.length || !allOpened || hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    setSubmitted(true);
    submitResult(true, 100, metrics(), {});
  });

  const done = hasSubmitted || submitted || (tutorOwned && isComplete);
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || reading || !item ? null : item.id,
    label: 'The question and your answer',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  // ── Render: the timeline (reading) ──
  const renderReading = () => (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-white/10" />
        <div className="relative flex justify-between">
          {deck.events.map((e, i) => {
            const isOpen = openIndex === i, seen = opened.has(e.id);
            return (
              <button key={e.id} type="button" aria-label={`Event ${i + 1}`} onClick={() => openAt(i)}
                className="group relative z-10 flex flex-col items-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-200 ${
                  isOpen ? 'scale-125 border-blue-400 bg-blue-500/30 text-blue-300 ring-2 ring-blue-400/30'
                    : seen ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/20 bg-white/5 text-slate-500 hover:border-white/40 hover:bg-white/10'}`}>{i + 1}</span>
                <span className={`mt-1.5 max-w-[60px] text-center text-[10px] leading-tight ${isOpen ? 'text-blue-300' : seen ? 'text-slate-400' : 'text-slate-600'}`}>
                  {e.date}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {openEvent ? (
        <LuminaPanel className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">{openEvent.title}</h3>
              <LuminaBadge accent="blue" className="mt-1 text-[10px]">{openEvent.date}</LuminaBadge>
            </div>
            <span className="shrink-0 text-xs text-slate-500">{(openIndex ?? 0) + 1} of {deck.events.length}</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{openEvent.description}</p>
          {openEvent.impact && (
            <LuminaPanel accent="amber" className="p-2.5">
              <div className="flex items-start gap-2">
                <LuminaBadge accent="amber" className="shrink-0 text-[10px]">Impact</LuminaBadge>
                <p className="text-xs leading-relaxed text-slate-300">{openEvent.impact}</p>
              </div>
            </LuminaPanel>
          )}
          {openEvent.connection && <p className="border-l-2 border-white/10 pl-3 text-xs italic text-slate-500">{openEvent.connection}</p>}
          <div className="flex justify-between pt-1">
            <LuminaButton className="h-7 px-3 text-xs text-slate-400" disabled={openIndex === 0} onClick={() => openAt((openIndex ?? 0) - 1)}>Previous</LuminaButton>
            <LuminaButton className="h-7 px-3 text-xs text-slate-400" disabled={openIndex === deck.events.length - 1} onClick={() => openAt((openIndex ?? 0) + 1)}>Next</LuminaButton>
          </div>
        </LuminaPanel>
      ) : (
        <LuminaPanel className="p-6 text-center"><p className="text-sm text-slate-500">Tap an event on the timeline to read about it</p></LuminaPanel>
      )}

      {allOpened && summary && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <LuminaSectionLabel accent="cyan" size="sm">Timeline Summary</LuminaSectionLabel>
          <p className="text-sm leading-relaxed text-slate-200">{summary.text}</p>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan" className="text-xs">Theme</LuminaBadge>
            <span className="text-xs text-slate-300">{summary.keyTheme}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs text-slate-500">
        <span>{opened.size} of {deck.events.length} events read</span>
        {items.length > 0 && (allOpened
          ? <LuminaButton className="h-8 text-xs" onClick={begin}>Begin the questions</LuminaButton>
          : <span className="text-slate-600">Read every event to begin the questions</span>)}
      </div>
    </div>
  );

  // ── Render: one check item ──
  const choiceState = (id: string): AnswerChoiceState => {
    if (!item || (item.kind !== 'identify' && item.kind !== 'date')) return 'idle';
    if (revealed) return id === item.eventId ? 'correct' : id === work.choice ? 'incorrect' : 'dimmed';
    if (wrongShown && work.choice === id) return 'incorrect';
    return work.choice === id ? 'selected' : 'idle';
  };

  const lines = item && (item.kind === 'order' || item.kind === 'cause_effect') && leverOn(READ_CARDS_LEVER) ? cardLines(deck, item) : {};
  const datesOn = item?.kind === 'cause_effect' && leverOn(SHOW_DATES_LEVER);
  const pairIndex = (c: string) => (item?.kind === 'cause_effect' ? item.causes.filter(x => work.pairs[x]).indexOf(c) : -1);

  const renderItem = (it: TimelineItem) => (
    <div className="space-y-3">
      {it.kind === 'identify' && leverOn(SHOW_TIMELINE_LEVER) && (
        <LuminaPanel accent="cyan" data-lever="show-timeline" className="space-y-1 text-xs text-slate-300">
          {deck.events.map(e => <p key={e.id}><span className="font-mono text-slate-400">{e.date}</span> · {e.title}</p>)}
        </LuminaPanel>
      )}
      {it.kind === 'date' && leverOn(BEFORE_AFTER_LEVER) && (
        <LuminaPanel accent="cyan" data-lever="before-after" className="space-y-1 text-sm text-slate-300">
          {beforeAfterLines(deck, it).map(l => <p key={l}>{l}</p>)}
        </LuminaPanel>
      )}
      {it.kind === 'date' && leverOn(DATE_LINE_LEVER) && (
        <LuminaPanel accent="cyan" data-lever="date-line" className="text-xs text-slate-300">
          <div className="flex items-center justify-between gap-2">
            {dateLine(deck, it).map((d, i, all) => (
              <React.Fragment key={d}>
                <span className="rounded border border-white/10 px-2 py-1 font-mono">{d}</span>
                {i < all.length - 1 && <span className="h-px flex-1 bg-white/20" aria-hidden="true" />}
              </React.Fragment>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-500">earlier → later</p>
        </LuminaPanel>
      )}

      {(it.kind === 'identify' || it.kind === 'date') && (
        <div className="space-y-2">
          {it.options.map(id => {
            const label = optionLabel(deck, it, id);
            return (
              <LuminaAnswerChoice key={id} aria-label={label} state={choiceState(id)} disabled={closed}
                className="p-3 text-sm" onClick={() => choose(id)}>
                {label}
              </LuminaAnswerChoice>
            );
          })}
        </div>
      )}

      {it.kind === 'order' && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Earliest</p>
          {work.order.map((id, position) => (
            <div key={id} data-card={id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <span className="w-4 font-mono text-xs text-slate-500">{position + 1}.</span>
              <div className="flex-1">
                <p className="text-sm text-slate-200">{titleOf(deck, id)}</p>
                {lines[id] && <p data-lever="read-cards" className="mt-1 text-xs text-slate-400">{lines[id]}</p>}
              </div>
              <div className="flex gap-1">
                <button type="button" aria-label={`Move ${titleOf(deck, id)} up`} disabled={closed || position === 0}
                  onClick={() => move(position, -1)} className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30">▲</button>
                <button type="button" aria-label={`Move ${titleOf(deck, id)} down`} disabled={closed || position === work.order.length - 1}
                  onClick={() => move(position, 1)} className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30">▼</button>
              </div>
            </div>
          ))}
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Latest</p>
          {leverOn(LED_TO_LEVER) && (
            <LuminaPanel accent="cyan" data-lever="led-to" className="space-y-1 text-sm text-slate-300">
              {ledToArrows(deck, it).map(([a, b]) => <p key={a}>{titleOf(deck, a)} → led to → {titleOf(deck, b)}</p>)}
            </LuminaPanel>
          )}
        </div>
      )}

      {it.kind === 'cause_effect' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Causes</p>
            {it.causes.map(c => {
              const n = pairIndex(c);
              return (
                <button key={c} type="button" aria-label={`Cause: ${titleOf(deck, c)}`} disabled={closed} onClick={() => tapCause(c)}
                  className={`w-full rounded-lg p-2.5 text-left text-xs transition-all duration-200 ${activeCause === c
                    ? 'border border-blue-400/50 bg-blue-500/20 text-blue-300'
                    : n >= 0 ? 'border border-purple-400/30 bg-purple-500/10 text-purple-200' : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'}`}>
                  {n >= 0 && <span className="mr-1 text-purple-400" aria-hidden="true">{n + 1}.</span>}
                  {titleOf(deck, c)}
                  {datesOn && <span data-lever="show-dates" className="block font-mono text-[10px] text-slate-400">{dateOf(deck, c)}</span>}
                  {lines[c] && <span data-lever="read-cards" className="mt-1 block text-[11px] text-slate-400">{lines[c]}</span>}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Effects</p>
            {it.effects.map(e => {
              const cause = Object.keys(work.pairs).find(c => work.pairs[c] === e);
              const n = cause ? pairIndex(cause) : -1;
              return (
                <button key={e} type="button" aria-label={`Effect: ${titleOf(deck, e)}`} disabled={closed || !activeCause} onClick={() => tapEffect(e)}
                  className={`w-full rounded-lg p-2.5 text-left text-xs transition-all duration-200 ${n >= 0
                    ? 'border border-purple-400/30 bg-purple-500/10 text-purple-200'
                    : activeCause ? 'border border-white/10 bg-white/5 text-slate-200 ring-1 ring-blue-400/20 hover:bg-white/10' : 'border border-white/10 bg-white/5 text-slate-400'}`}>
                  {n >= 0 && <span className="mr-1 text-purple-400" aria-hidden="true">{n + 1}.</span>}
                  {titleOf(deck, e)}
                  {datesOn && <span data-lever="show-dates" className="block font-mono text-[10px] text-slate-400">{dateOf(deck, e)}</span>}
                  {lines[e] && <span data-lever="read-cards" className="mt-1 block text-[11px] text-slate-400">{lines[e]}</span>}
                </button>
              );
            })}
          </div>
          {activeCause && !closed && <p className="col-span-2 text-center text-xs text-blue-400">Now tap the event it led to</p>}
        </div>
      )}
    </div>
  );

  const CHECK_LABEL: Record<TimelineKind, string> = { identify: 'Check Answer', date: 'Check Answer', order: 'Check Order', cause_effect: 'Check Matches' };
  const correctCount = results.filter(r => r.correct).length;

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">&#128336;</span>
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          </div>
          {timeSpan && reading && <LuminaBadge accent="cyan" className="text-xs">{timeSpan.start} — {timeSpan.end}</LuminaBadge>}
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        {reading && <p className="mt-1 text-xs text-slate-500">{overview}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {done ? (
          <div className="space-y-4 py-2 text-center">
            {!tutorOwned && <div className="text-3xl font-bold text-emerald-400">{submittedResult?.score ?? Math.round((correctCount / Math.max(items.length, 1)) * 100)}%</div>}
            <LuminaFeedbackCard status="insight" label="Timeline check complete">
              {`${correctCount} of ${items.length} questions answered.`}
            </LuminaFeedbackCard>
            {summary && (
              <LuminaPanel accent="emerald" className="space-y-2 text-left">
                <p className="text-sm text-slate-200">{summary.text}</p>
                <LuminaBadge accent="emerald" className="text-xs">Theme: {summary.keyTheme}</LuminaBadge>
                {summary.lookingForward && <p className="text-xs italic text-slate-400">{summary.lookingForward}</p>}
              </LuminaPanel>
            )}
          </div>
        ) : reading || !item ? renderReading() : (
          <div className="space-y-3 border-t border-white/10 pt-4">
            <LuminaSectionLabel accent="cyan" size="sm">
              {practice ? 'A simpler question first' : `${KIND_LABEL[item.kind]} · question ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
            </LuminaSectionLabel>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(deck, item)}</LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace}>{renderItem(item)}</div>

            {!revealed && (
              <div className="flex justify-center pt-1">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>
                  {CHECK_LABEL[item.kind]}
                </LuminaActionButton>
              </div>
            )}
            {revealed && (
              <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? 'Correct!' : 'The answer'}>
                {solvedText(deck, item)}
              </LuminaFeedbackCard>
            )}
            {!revealed && wrongShown && <LuminaFeedbackCard status="incorrect">That is not it.</LuminaFeedbackCard>}
            {!revealed && feedback && <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>}

            {!tutorOwned && revealed && !practice && (
              <div className="flex justify-center">
                <LuminaActionButton action="next" onClick={next}>{currentIndex < items.length - 1 ? 'Next Question' : 'See Results'}</LuminaActionButton>
              </div>
            )}
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const TimelineExplorer = withWorkspaceController<TimelineExplorerProps, ProgressOptions<TimelineItem>, Progress>(
  'timeline-explorer', TimelineExplorerSurface, useScriptedProgress, useWorkspaceProgressFor('timeline-explorer'));

export default TimelineExplorer;
