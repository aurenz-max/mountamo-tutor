'use client';

/**
 * Vocabulary Explorer: word cards to study, then a check built by code from those words.
 * - Study: one card per word (what it means, a sentence using it, related words, where it comes from). The check
 *   starts when the learner presses Start the check; the cards close then.
 * - match: tap a word, then its meaning (hard: one extra meaning goes with none).
 * - fill_blank: a sentence with the word blanked; choose the word.
 * - context: a situation that never names the word; choose the word.
 *
 * Every item and key comes from `vocabularyExplorerWorkspace.ts`; Gemini writes only the word bank. Nothing on screen
 * marks the answer before a check. Two paths, chosen by `withWorkspaceController`: the scripted path (tester, no tutor)
 * has its own Next and two tries before a reveal; the workspace path (W1, plain shape) commits every check through
 * `progress.commitCheck` with a named miss, takes a spoken word judged by the tutor, and lets the runtime move on.
 * The levers live in `vocabularyExplorerLevers.ts`.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { VocabularyExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
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
  answerStateClasses,
  type AnswerChoiceState,
} from '../../../ui';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  askOf, clozeOf, clueText, describeVocabWork, emptyWork, extraMeaning, posOf, vocabCorrect, vocabItems, vocabMiss,
  workComplete, workspaceAssignment, workspaceScene,
  type ChoiceItem, type MatchItem, type VocabItem, type VocabKind, type VocabTerm, type VocabTier, type VocabWork,
} from './vocabularyExplorerWorkspace';
import {
  DROP_LEVER, EXAMPLES_LEVER, examplesShown, farChoice, KINDS_LEVER, leverFacts, meaningsShown, MEANINGS_LEVER,
  NO_LEVERS, simplerMatch, vocabLevers, type VocabLeverState,
} from './vocabularyExplorerLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { VocabItem, VocabTerm, VocabTier };

export interface VocabularyExplorerData {
  title: string;
  topic: string;
  introduction: string;
  terms: VocabTerm[];
  /** The pinned eval mode's challenge types (`match`, `fill_blank`, `context`). */
  challengeTypes?: VocabKind[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: VocabTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the bank. */
  items?: VocabItem[];
  /** Legacy generations (model-written challenges): read only for their types. */
  challenges?: Array<{ type?: string }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<VocabularyExplorerMetrics>) => void;
}

interface VocabularyExplorerProps {
  data: VocabularyExplorerData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const KIND_LABEL: Record<VocabKind, string> = { match: 'Match the meanings', fill_blank: 'Complete the sentence', context: 'Which word fits?' };
const letter = (i: number) => String.fromCharCode(65 + i);

// ============================================================================
// Component
// ============================================================================

const VocabularyExplorerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  VocabularyExplorerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<VocabItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, topic, introduction, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const bank: VocabTerm[] = useMemo(() => data.terms ?? [], [data.terms]);

  const items = useMemo(() => vocabItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.terms, data.challengeTypes, data.difficulty, data.title]);
  const stableInstanceId = useRef(instanceId || `vocabulary-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Study: the word cards, before the check ──
  const [studying, setStudying] = useState(true);
  const studyingRef = useRef(true);
  studyingRef.current = studying;
  const [card, setCard] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(() => new Set(bank[0] ? [bank[0].id] : []));
  const [relatedWordClicks, setRelatedWordClicks] = useState(0);
  const studyStarted = useRef(Date.now());
  const [studyMs, setStudyMs] = useState(0);

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: item => workspaceAssignment(item, bank, studyingRef.current),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const sessionItem: VocabItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<MatchItem | null>(null);
  const item: VocabItem | undefined = practice ?? sessionItem;

  const [work, setWork] = useState<VocabWork>(emptyWork);
  /** match: the word tapped, waiting for its meaning. */
  const [activeWord, setActiveWord] = useState<string | null>(null);
  /** Workspace path: the checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [scriptedWrongs, setScriptedWrongs] = useState(0);
  const [scriptedReveal, setScriptedReveal] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leverState, setLeverState] = useState<{ item: string } & VocabLeverState>({ item: '', ...NO_LEVERS });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const levers: VocabLeverState = sessionItem && leverState.item === sessionItem.id && !practice ? leverState : NO_LEVERS;
  const leverOn = (id: string) => levers.pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow || scriptedReveal;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<VocabularyExplorerMetrics>({
    primitiveType: 'vocabulary-explorer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const currentCard = bank[Math.min(card, Math.max(bank.length - 1, 0))];
  const aiPrimitiveData = useMemo(() => ({
    topic, totalTerms: bank.length, currentWord: studying ? currentCard?.word ?? '' : '',
    partOfSpeech: studying ? currentCard?.partOfSpeech ?? '' : '', termsExplored: visited.size,
    challengesCompleted: results.filter(r => r.correct).length, totalChallenges: items.length,
    ask: !studying && item ? askOf(item, bank) : '',
  }), [topic, bank, studying, currentCard, visited.size, results, items.length, item]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'vocabulary-explorer', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: 'Elementary', enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = () => {
    setWork(emptyWork()); setActiveWord(null); setWrongShown(false); setFeedback(null);
    setScriptedWrongs(0); setScriptedReveal(false); setPracticeSolved(false);
  };

  openItem.current = (_index, retry) => {
    if (retry) { setWork(emptyWork()); setActiveWord(null); setWrongShown(false); setFeedback(null); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || solved.kind === 'match' || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork({ pairs: {}, picked: solved.term }); setWrongShown(false);
  };

  // ── Study handlers ──
  const openCard = (i: number) => {
    if (i < 0 || i >= bank.length) return;
    SoundManager.navigate();
    setCard(i);
    setVisited(prev => new Set(prev).add(bank[i].id));
    say(`[TERM_SELECTED] Card ${i + 1} of ${bank.length}: "${bank[i].word}" (${bank[i].partOfSpeech}). Pronounce it and give a brief, friendly introduction.`);
  };
  const followRelated = (word: string) => {
    const at = bank.findIndex(t => t.word.toLowerCase() === word.toLowerCase());
    if (at < 0) return;
    setRelatedWordClicks(n => n + 1);
    openCard(at);
  };
  const startCheck = () => {
    if (!studying || learnerBlocked()) return;
    SoundManager.select();
    setStudyMs(Date.now() - studyStarted.current);
    setStudying(false);
    if (item) say(`[CHECK_STARTED] The word cards are closed. First question: ${askOf(item, bank)}`);
  };

  // ── Check handlers ──
  const closed = studying || revealed || wrongShown || learnerBlocked();
  const tapWord = (id: string) => {
    if (!item || item.kind !== 'match' || closed) return;
    SoundManager.select();
    if (work.pairs[id]) setWork(w => ({ ...w, pairs: Object.fromEntries(Object.entries(w.pairs).filter(([k]) => k !== id)) }));
    setActiveWord(id); setFeedback(null);
  };
  const tapMeaning = (defId: string) => {
    if (!item || item.kind !== 'match' || closed || !activeWord) return;
    if (Object.values(work.pairs).includes(defId)) return;
    SoundManager.snap();
    setWork(w => ({ ...w, pairs: { ...w.pairs, [activeWord]: defId } }));
    setActiveWord(null); setFeedback(null);
  };
  const pick = (id: string) => {
    if (!item || item.kind === 'match' || closed || levers.dropped.includes(id)) return;
    SoundManager.select();
    setWork(w => ({ ...w, picked: id })); setFeedback(null);
  };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = vocabCorrect(item, work);
    progress.commitCheck(describeVocabWork(item, work, bank), correct, correct ? undefined : vocabMiss(item, work, bank));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      say(`[ANSWER_CORRECT] The learner answered: ${askOf(item, bank)} Praise briefly and use the word in a new sentence.`);
      return;
    }
    SoundManager.playIncorrect();
    if (item.kind !== 'match' && work.picked && sessionItem && !practice) {
      const picked = work.picked;
      setLeverState(s => {
        const base = s.item === sessionItem.id ? s : { item: sessionItem.id, ...NO_LEVERS };
        return base.picked.includes(picked) ? base : { ...base, picked: [...base.picked, picked] };
      });
    }
    if (tutorOwned) { setWrongShown(true); return; }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= 2) {
      setScriptedReveal(true);
      setWork(item.kind === 'match' ? { pairs: Object.fromEntries(item.terms.map(t => [t, t])), picked: null } : { pairs: {}, picked: item.term });
      if (!practice) progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say(`[ANSWER_REVEALED] Two tries missed on: ${askOf(item, bank)} The answer is now on screen; explain it with the word's meaning.`);
      return;
    }
    setWork(emptyWork()); setActiveWord(null);
    setFeedback(item.kind === 'match' ? 'Not every word is with its meaning yet. Read each meaning again and try once more.'
      : 'Not quite. Read the sentence again with each word in it, and try once more.');
    say(`[ANSWER_INCORRECT] ${describeVocabWork(item, work, bank)} for: ${askOf(item, bank)} It is wrong. You are not told the answer: give a hint about the meaning without naming a word.`);
  };

  const metrics = (): VocabularyExplorerMetrics => {
    const firstTry = (kind: VocabKind) => {
      const its = items.filter(i => i.kind === kind);
      if (!its.length) return 0;
      return Math.round((its.filter(i => results.some(r => r.challengeId === i.id && r.correct && (r.attempts ?? 1) <= 1)).length / its.length) * 100);
    };
    return {
      type: 'vocabulary-explorer',
      termsExplored: visited.size,
      totalTerms: bank.length,
      matchAccuracy: firstTry('match'),
      fillBlankAccuracy: firstTry('fill_blank'),
      contextAccuracy: firstTry('context'),
      challengeAttempts: currentAttempts,
      averageTimePerTerm: bank.length ? Math.round(studyMs / bank.length) : 0,
      relatedWordClicks,
    };
  };

  /** Scripted path: Next, and on the last item the session report. */
  const next = () => {
    if (progress.advance()) {
      clearItem();
      say(`[NEXT_ITEM] Item ${currentIndex + 2} of ${items.length}: ${askOf(items[currentIndex + 1], bank)}`);
      return;
    }
    if (hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    const score = items.length ? Math.round((results.filter(r => r.correct).length / items.length) * 100) : 0;
    setSubmitted(true);
    submitResult(score >= 70, score, metrics(), { challengeResults: results });
    say(`[ALL_COMPLETE] The learner finished all ${items.length} vocabulary items. Celebrate briefly.`);
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
    const scene = workspaceScene(item, { studying, card, viewed: visited.size, work, solved: revealed }, bank);
    const available = practice || studying ? [] : vocabLevers(sessionItem, bank, levers);
    const onScreen = practice || studying ? {} : leverFacts(sessionItem, bank, levers);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'A smaller match of other words from the cards, before the full item comes back.' } : {}),
        ...onScreen },
      // Before Start the check the cards are open and nothing can be answered.
      readyForResponse: !studying,
      levers: available,
      pullLever: (id) => {
        const l = available.find(x => x.id === id);
        if (studying) return 'The check has not started: the learner is still reading the word cards.';
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const base = { ...levers, item: sessionItem.id };
        if (id === DROP_LEVER) {
          if (sessionItem.kind === 'match') return `No lever ${id} on this item.`;
          const drop = farChoice(sessionItem, bank, levers);
          if (!drop) return 'No choice can be greyed out: too few untried choices would remain.';
          setLeverState({ ...base, pulled: [...levers.pulled, id], dropped: [...levers.dropped, drop] });
          if (work.picked === drop) setWork(w => ({ ...w, picked: null }));
          return true;
        }
        if (l.kind === 'simplify') {
          const simpler = simplerMatch(sessionItem, bank);
          if (!simpler) return 'There is no smaller match here; try a help lever.';
          setLeverState({ ...base, pulled: [...levers.pulled, id] }); clearItem(); setPractice(simpler);
          return { practice: workspaceAssignment(simpler, bank) };
        }
        setLeverState({ ...base, pulled: [...levers.pulled, id] });
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || (tutorOwned && isComplete);
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || studying || !item ? null : item.id,
    label: 'The check: the words and your answer',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!bank.length || !items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This word set has no words to check.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── Render: the word cards ──
  const renderStudy = () => {
    const t = currentCard;
    return (
      <div className="space-y-4" data-study="cards">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {bank.map((term, i) => (
            <LuminaButton key={term.id} tone={i === card ? 'ghost' : 'subtle'} aria-label={`Card ${i + 1}`}
              className={`shrink-0 text-xs px-3 py-2 h-auto ${i === card ? 'text-slate-100' : visited.has(term.id) ? 'text-slate-300' : 'text-slate-500'}`}
              onClick={() => openCard(i)}>
              {term.word}
            </LuminaButton>
          ))}
        </div>
        {t && (
          <div className="min-h-[200px] space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-slate-100 text-lg font-bold">{t.word}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <LuminaBadge accent="blue" className="text-[10px]">{t.partOfSpeech}</LuminaBadge>
                  {t.pronunciation && <span className="text-slate-500 text-xs italic">/{t.pronunciation}/</span>}
                </div>
              </div>
              <span className="text-slate-600 text-xs shrink-0">{card + 1} of {bank.length}</span>
            </div>
            <LuminaPanel className="p-3">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">What it means</p>
              <p className="text-slate-200 text-sm leading-relaxed">{t.definition}</p>
            </LuminaPanel>
            <LuminaPanel accent="cyan" className="p-3">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">In a sentence</p>
              <p className="text-slate-300 text-sm leading-relaxed italic">&ldquo;{t.exampleSentence}&rdquo;</p>
            </LuminaPanel>
            {(t.relatedWords ?? []).length > 0 && (
              <div>
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-2">Related words</p>
                <div className="flex flex-wrap gap-2">
                  {t.relatedWords.map((rw, i) => bank.some(x => x.word.toLowerCase() === rw.toLowerCase()) ? (
                    <button key={i} type="button" onClick={() => followRelated(rw)} aria-label={`Open the card for ${rw}`}
                      className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-400/20 text-purple-300 text-xs hover:bg-purple-500/20 transition-all">
                      {rw}
                    </button>
                  ) : (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs">{rw}</span>
                  ))}
                </div>
              </div>
            )}
            {t.wordOrigin && (
              <LuminaPanel accent="amber" className="p-3">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">Where the word comes from</p>
                <p className="text-slate-300 text-xs leading-relaxed">{t.wordOrigin}</p>
              </LuminaPanel>
            )}
            <div className="flex items-center justify-between pt-2">
              <LuminaButton tone="subtle" className="text-xs h-8" aria-label="Previous card" onClick={() => openCard(card - 1)} disabled={card === 0}>Previous</LuminaButton>
              <span className="text-slate-500 text-xs">{visited.size} of {bank.length} cards opened</span>
              <LuminaButton tone="subtle" className="text-xs h-8" aria-label="Next card" onClick={() => openCard(card + 1)} disabled={card >= bank.length - 1}>Next card</LuminaButton>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <p className="text-slate-400 text-xs">The cards close when the check starts.</p>
          <LuminaButton tone="primary" className="text-xs h-8" aria-label="Start the check" onClick={startCheck} disabled={learnerBlocked()}>
            Start the check
          </LuminaButton>
        </div>
      </div>
    );
  };

  // ── Render: a match ──
  const renderMatch = (m: MatchItem) => {
    const pairNo = (termId: string) => m.terms.filter(t => work.pairs[t]).indexOf(termId) + 1;
    const examples = leverOn(EXAMPLES_LEVER) && !practice ? examplesShown(m, bank) : [];
    const termClass = (id: string) => revealed ? answerStateClasses.correct
      : wrongShown && work.pairs[id] ? 'bg-white/5 border-white/10 text-slate-300'
        : activeWord === id ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
          : work.pairs[id] ? 'bg-purple-500/10 border-purple-400/30 text-purple-300'
            : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200';
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">Words</p>
          {m.terms.map((id, i) => {
            const t = bank.find(x => x.id === id);
            const ex = examples.find(e => e.id === id);
            return (
              <div key={id} className="space-y-1">
                <button type="button" data-pip-object={`term-${i + 1}`} aria-label={t?.word} disabled={closed}
                  onClick={() => tapWord(id)}
                  className={`w-full text-left p-2.5 rounded-lg border text-sm font-medium transition-all duration-200 ${termClass(id)}`}>
                  {work.pairs[id] && <span className="text-purple-400 mr-1">{pairNo(id)}.</span>}
                  {t?.word}
                </button>
                {ex && <p data-lever="examples" className="text-xs italic text-slate-400 pl-1">&ldquo;{ex.example}&rdquo;</p>}
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">Meanings</p>
          {m.defs.map((d, i) => {
            const owner = m.terms.find(t => work.pairs[t] === d);
            const isExtra = d === extraMeaning(m);
            const cls = revealed ? (isExtra ? 'bg-white/5 border-white/10 text-slate-500' : answerStateClasses.correct)
              : owner && !wrongShown ? 'bg-purple-500/10 border-purple-400/30 text-purple-300'
                : activeWord ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200 ring-1 ring-blue-400/20'
                  : 'bg-white/5 border-white/10 text-slate-300';
            return (
              <button key={d} type="button" data-pip-object={`meaning-${i + 1}`} disabled={closed || !activeWord || !!owner}
                onClick={() => tapMeaning(d)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all duration-200 ${cls}`}>
                <span className="text-slate-500 mr-1">{letter(i)}.</span>
                {owner && <span className="text-purple-400 mr-1">{pairNo(owner)}.</span>}
                {bank.find(x => x.id === d)?.definition}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render: a choice ──
  const renderChoice = (c: ChoiceItem) => {
    const meanings = leverOn(MEANINGS_LEVER) ? meaningsShown(c, bank) : [];
    const state = (id: string): AnswerChoiceState => {
      if (revealed) return id === c.term ? 'correct' : id === work.picked ? 'incorrect' : 'dimmed';
      if (levers.dropped.includes(id)) return 'dimmed';
      if (wrongShown && work.picked === id) return 'incorrect';
      return work.picked === id ? 'selected' : 'idle';
    };
    return (
      <div className="space-y-3">
        <LuminaPanel className="p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">
            {c.kind === 'fill_blank' ? 'The sentence' : c.clue === 'scenario' ? 'What is happening' : 'The meaning'}
          </p>
          <p className="text-slate-200 text-sm leading-relaxed">&ldquo;{clueText(c, bank)}&rdquo;</p>
        </LuminaPanel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {c.options.map(id => {
            const t = bank.find(x => x.id === id);
            const meaning = meanings.find(x => x.id === id);
            return (
              <LuminaAnswerChoice key={id} aria-label={t?.word} state={state(id)} className="p-3 text-sm rounded-xl"
                disabled={closed || levers.dropped.includes(id)} onClick={() => pick(id)}>
                <span className="font-semibold">{t?.word}</span>
                {leverOn(KINDS_LEVER) && t && <span data-lever="kinds" className="ml-2 text-xs text-sky-300">({posOf(t) || 'word'})</span>}
                {meaning && !levers.dropped.includes(id) && <span data-lever="meanings" className="mt-1 block text-xs font-normal text-slate-400">{meaning.meaning}</span>}
              </LuminaAnswerChoice>
            );
          })}
        </div>
      </div>
    );
  };

  const revealText = (): string => {
    if (!item) return '';
    if (item.kind === 'match') return 'Every word is with its meaning.';
    const t = bank.find(x => x.id === item.term);
    if (!t) return '';
    if (item.kind === 'fill_blank') {
      const cloze = clozeOf(t);
      return cloze ? `"${cloze.text.replace('_____', t.word)}" ${t.word} means: ${t.definition}` : `${t.word} means: ${t.definition}`;
    }
    return `${t.word} means: ${t.definition}`;
  };

  const kindLabel = practice ? 'A smaller match first' : item ? KIND_LABEL[item.kind] : '';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <LuminaBadge accent="cyan" className="text-xs">{bank.length} words</LuminaBadge>
        </div>
        {introduction && !done && <p className="text-slate-400 text-sm mt-1">{introduction}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Words checked">
            {`${results.filter(r => r.correct).length} of ${items.length} items answered.`}
          </LuminaFeedbackCard>
        ) : studying ? renderStudy() : item && (
          <>
            <LuminaSectionLabel accent="cyan" size="sm">
              {practice ? kindLabel : `${kindLabel} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
            </LuminaSectionLabel>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>
              {item.kind === 'match' ? askOf(item, bank)
                : item.kind === 'fill_blank' ? 'Which word completes the sentence?'
                  : item.clue === 'scenario' ? 'Which word fits what is happening here?' : 'Which word means this?'}
            </LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {item.kind === 'match' ? renderMatch(item) : renderChoice(item)}
              {item.kind === 'match' && activeWord && !closed && (
                <p className="text-blue-400 text-xs text-center">Now tap the meaning that goes with it.</p>
              )}
            </div>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>
                  {item.kind === 'match' ? 'Check Matches' : 'Check Answer'}
                </LuminaActionButton>
              </div>
            )}

            {revealed && (
              <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? undefined : 'The answer'}>
                {revealText()}
              </LuminaFeedbackCard>
            )}
            {!revealed && wrongShown && (
              <LuminaFeedbackCard status="incorrect">
                {item.kind === 'match' ? 'Not every word is with its meaning.' : 'That is not it.'}
              </LuminaFeedbackCard>
            )}
            {!revealed && feedback && <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>}

            {!tutorOwned && revealed && !practice && (
              <div className="flex justify-end">
                <LuminaActionButton action="next" onClick={next}>{currentIndex < items.length - 1 ? 'Next →' : 'Finish'}</LuminaActionButton>
              </div>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const VocabularyExplorer = withWorkspaceController<VocabularyExplorerProps, ProgressOptions<VocabItem>, Progress>(
  'vocabulary-explorer', VocabularyExplorerSurface, useScriptedProgress, useWorkspaceProgressFor('vocabulary-explorer'));

export default VocabularyExplorer;
