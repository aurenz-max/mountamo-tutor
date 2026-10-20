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
 * marks the answer before a check. Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is
 * `vocabularyExplorer.card.ts` + `vocabularyExplorer.boss.ts`): every check commits through `progress.commitCheck` with
 * a named miss, a word said aloud is judged by the tutor, and the runtime moves on. The levers are one lever set in
 * `vocabularyExplorerLevers.ts`.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { VocabularyExplorerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
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
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  askOf, clozeOf, clueText, describeVocabWork, emptyWork, extraMeaning, posOf, vocabChecks, vocabCorrect, vocabMiss,
  workComplete, workspaceScene,
  type ChoiceItem, type MatchItem, type VocabCheck, type VocabItem, type VocabKind, type VocabTerm, type VocabTier, type VocabWork,
} from './vocabularyExplorerWorkspace';
import {
  DROP_LEVER, EXAMPLES_LEVER, examplesShown, farChoice, KINDS_LEVER, meaningsShown, MEANINGS_LEVER, NO_LEVERS,
  VOCAB_LEVERS, type VocabLeverState,
} from './vocabularyExplorerLevers';
import { vocabularyExplorerBoss } from './vocabularyExplorer.boss';

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

const useVocabProgress = useWorkspaceProgressFor('vocabulary-explorer');

const VocabularyExplorerSurface = ({ data, className, runtimePlanItemId }: VocabularyExplorerProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, introduction, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const bank: VocabTerm[] = useMemo(() => data.terms ?? [], [data.terms]);

  const items = useMemo(() => vocabChecks(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.terms, data.challengeTypes, data.difficulty, data.title]);
  const stableInstanceId = useRef(instanceId || `vocabulary-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Study: the word cards, before the check ──
  const [studying, setStudying] = useState(true);
  const [card, setCard] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(() => new Set(bank[0] ? [bank[0].id] : []));
  const [relatedWordClicks, setRelatedWordClicks] = useState(0);
  const studyStarted = useRef(Date.now());
  const [studyMs, setStudyMs] = useState(0);

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useVocabProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: vocabularyExplorerBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: VocabCheck | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<VocabCheck | null>(null);
  const item: VocabCheck | undefined = practice ?? sessionItem;

  const [work, setWork] = useState<VocabWork>(emptyWork);
  /** match: the word tapped, waiting for its meaning. */
  const [activeWord, setActiveWord] = useState<string | null>(null);
  /** The checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string } & VocabLeverState>({ item: '', ...NO_LEVERS });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const levers: VocabLeverState = sessionItem && leverState.item === sessionItem.id && !practice ? leverState : NO_LEVERS;
  const leverOn = (id: string) => levers.pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<VocabularyExplorerMetrics>({
    primitiveType: 'vocabulary-explorer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const currentCard = bank[Math.min(card, Math.max(bank.length - 1, 0))];

  const clearItem = () => {
    setWork(emptyWork()); setActiveWord(null); setWrongShown(false); setPracticeSolved(false);
  };

  openItem.current = (_index, retry) => {
    if (retry) { setWork(emptyWork()); setActiveWord(null); setWrongShown(false); setPracticeSolved(false); return; }
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
  };

  // ── Check handlers ──
  const closed = studying || revealed || wrongShown || learnerBlocked();
  const tapWord = (id: string) => {
    if (!item || item.kind !== 'match' || closed) return;
    SoundManager.select();
    if (work.pairs[id]) setWork(w => ({ ...w, pairs: Object.fromEntries(Object.entries(w.pairs).filter(([k]) => k !== id)) }));
    setActiveWord(id);
  };
  const tapMeaning = (defId: string) => {
    if (!item || item.kind !== 'match' || closed || !activeWord) return;
    if (Object.values(work.pairs).includes(defId)) return;
    SoundManager.snap();
    setWork(w => ({ ...w, pairs: { ...w.pairs, [activeWord]: defId } }));
    setActiveWord(null);
  };
  const pick = (id: string) => {
    if (!item || item.kind === 'match' || closed || levers.dropped.includes(id)) return;
    SoundManager.select();
    setWork(w => ({ ...w, picked: id }));
  };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = vocabCorrect(item, work);
    progress.commitCheck(describeVocabWork(item, work, bank), correct, correct ? undefined : vocabMiss(item, work, bank));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
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
    setWrongShown(true);
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

  // Under a lesson's evaluation provider only: the scored session, whose evidence carries each wrong answer's named miss.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), challengeAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render. The levers are the lever set's
  // (`VOCAB_LEVERS`); none while the cards are open or on a practice item. ──
  useLayoutEffect(() => {
    if (!item || !sessionItem || isComplete) return;
    const scene = workspaceScene(item, { studying, card, viewed: visited.size, work, solved: revealed, checkedWrong: wrongShown }, bank);
    // Before Start the check the cards are open and nothing can be answered.
    if (studying) { workspace.current = { ...scene, readyForResponse: false, levers: [] }; return; }
    const ctx = { dropped: levers.dropped, picked: levers.picked };
    const available = practice ? [] : VOCAB_LEVERS.declare(sessionItem, ctx, levers.pulled);
    const onScreen = practice ? '' : VOCAB_LEVERS.onScreen(sessionItem, ctx, levers.pulled);
    if (practice) scene.facts.practice = 'A smaller match of other words from the cards, before the full item comes back.';
    workspace.current = {
      ...leverScene(scene, { support: VOCAB_LEVERS.support(practice ? null : sessionItem, ctx), onScreen }),
      levers: available,
      pullLever: (id) => {
        const l = available.find(x => x.id === id);
        if (practice || !l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const base = { ...levers, item: sessionItem.id };
        // Drawn by id: the one lever that changes the choices themselves.
        if (id === DROP_LEVER && sessionItem.kind !== 'match') {
          const drop = farChoice(sessionItem, bank, levers);
          if (!drop) return 'No choice can be greyed out: too few untried choices would remain.';
          setLeverState({ ...base, pulled: [...levers.pulled, id], dropped: [...levers.dropped, drop] });
          if (work.picked === drop) setWork(w => ({ ...w, picked: null }));
          return true;
        }
        if (l.kind === 'simplify') {
          const simpler = VOCAB_LEVERS.simpler(sessionItem, ctx, id);
          if (!simpler) return 'There is no smaller match here; try a help lever.';
          setLeverState({ ...base, pulled: [...levers.pulled, id] }); clearItem(); setPractice(simpler);
          return { practice: vocabularyExplorerBoss.assignment(simpler) };
        }
        setLeverState({ ...base, pulled: [...levers.pulled, id] });
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || isComplete;

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
        ) : studying || !item ? (
          <>
            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the word cards as its region. */}
            <PipDock />
            <PipWorkspace>{renderStudy()}</PipWorkspace>
          </>
        ) : (
          <>
            <LuminaSectionLabel accent="cyan" size="sm">
              {practice ? kindLabel : `${kindLabel} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
            </LuminaSectionLabel>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>
              {item.kind === 'match' ? askOf(item, bank)
                : item.kind === 'fill_blank' ? 'Which word completes the sentence?'
                  : item.clue === 'scenario' ? 'Which word fits what is happening here?' : 'Which word means this?'}
            </LuminaPrompt>

            {/* The dock above, the words and meanings or the choices as Pip's region. */}
            <PipDock />
            <PipWorkspace className="space-y-3">
              {item.kind === 'match' ? renderMatch(item) : renderChoice(item)}
              {item.kind === 'match' && activeWord && !closed && (
                <p className="text-blue-400 text-xs text-center">Now tap the meaning that goes with it.</p>
              )}
            </PipWorkspace>

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
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const VocabularyExplorer = withWorkspaceOnly<VocabularyExplorerProps>('vocabulary-explorer', VocabularyExplorerSurface, props => props.data.title);

export default VocabularyExplorer;
