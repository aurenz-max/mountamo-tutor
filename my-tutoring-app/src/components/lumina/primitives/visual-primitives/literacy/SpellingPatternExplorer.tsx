'use client';

/**
 * Spelling Pattern Explorer, taught on the shared teaching workspace only (the boss: `spellingPatternExplorer.card.ts`
 * + `spellingPatternExplorer.boss.ts`). A mount with no tutor shows the shared "needs the tutor" card
 * (`withWorkspaceOnly`). Two shapes, one mount:
 *   - The classic modes (short_vowel ... morphological): look at the pattern words, write the rule, then spell one
 *     dictation word at a time: the tutor says the word, the learner types it and presses Check spelling; the spelling
 *     is checked in code.
 *   - `pattern_build` (open build, `task: 'letter_build'`): make a word with a named spelling pattern on the shared
 *     letter build surface (`LetterBuildSurface.tsx`, `pattern` ask in `spellingPatternBuild.ts`), wired from this boss.
 */
import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaButton,
  LuminaActionButton,
  LuminaStat,
  LuminaFeedbackCard,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SpellingPatternExplorerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import LetterBuildSurface, { type LetterBuildSummary } from './LetterBuildSurface';
import type { LetterBuildItem } from './letterBuild';
import type { WordSpaceStamp } from '../../../service/wordSpace/pick';
import { spellingPatternExplorerBoss, spellingSession } from './spellingPatternExplorer.boss';
import {
  describeTyped, spellingMatches, spellingMiss, spellingMissWords, spellingScene, spellingWords, type SpellingWord,
} from './spellingPatternExplorerWorkspace';
import {
  BOXES_LEVER, PATTERN_WORDS_LEVER, SPELLING_LEVERS, letterBoxes, markPattern, patternBuildLevers, patternWordsStartShown,
  shownPatternWords,
} from './spellingPatternLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PatternType = 'short-vowel' | 'long-vowel' | 'r-controlled' | 'suffix-change' | 'latin-root' | 'silent-letter';

export interface SpellingPatternExplorerData {
  title: string;
  gradeLevel: string;
  patternType: PatternType;

  // Phase 1: Word list for observation
  patternWords: string[];               // Words that share the pattern
  highlightPattern: string;             // The pattern to highlight (e.g. "-ight", "silent-e")

  // Phase 2: Rule formulation
  ruleTemplate: string;                 // "When a word ends in silent-e, adding -ing means you ___"
  correctRule: string;                  // Model answer for the rule

  // Phase 3: Dictation practice
  dictationWords: string[];             // Words to spell using the rule
  dictationHints?: string[];            // Optional hints per word

  // Within-mode support tier (config.difficulty → generator stamp).
  // Display-only scaffold withdrawal — absent ⇒ full-support legacy render.
  // On the model path, content (patternWords, dictationWords, rule) is byte-identical across tiers. On the
  // word-space path (G1-2, service/wordSpace/spellingPatternSpaces.ts) the tier also picks the dictation words.
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Word-space calibration: the session's pattern and mean beta, and one stamp per dictation word. Never rendered. */
  wordSpace?: WordSpaceStamp & { items: WordSpaceStamp[] };

  /** `pattern_build` (open build): the asks run on the shared letter build surface; the classic fields are empty. */
  task?: 'letter_build';
  buildItems?: LetterBuildItem[];

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SpellingPatternExplorerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface SpellingPatternExplorerProps {
  data: SpellingPatternExplorerData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

type SpellingPhase = 'observe' | 'rule' | 'apply' | 'review';

const PATTERN_ACCENTS: Record<PatternType, LuminaAccent> = {
  'short-vowel': 'blue',
  'long-vowel': 'purple',
  'r-controlled': 'rose',
  'suffix-change': 'amber',
  'latin-root': 'emerald',
  'silent-letter': 'cyan',
};

const itemScore = (attempts: number) => Math.max(20, 100 - 20 * (attempts - 1));

const useSpellingProgress = useWorkspaceProgressFor('spelling-pattern-explorer');
const PRACTICE_NOTE = 'An ungraded practice word, shorter, with the same spelling pattern; then the full word comes back.';

// ============================================================================
// Component
// ============================================================================

const SpellingPatternExplorerSurface: React.FC<SpellingPatternExplorerProps> = ({ data, className, runtimePlanItemId }) => {
  const {
    title, gradeLevel, patternType, patternWords, highlightPattern,
    ruleTemplate, supportTier,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  // ── Support-tier render gates (absent ⇒ full support) ─────────────────────
  // L1: explicit pattern-reveal panel — withdrawn at medium/hard.
  const showPatternPanel = !supportTier || supportTier === 'easy';
  // L2: word-tile pattern highlights — all (legacy/easy) → first 3 worked examples (medium) → none (hard: the student
  // induces the pattern).
  const highlightLimit =
    !supportTier || supportTier === 'easy' ? Number.POSITIVE_INFINITY
    : supportTier === 'medium' ? 3
    : 0;
  // L3: fill-in-the-blank ruleTemplate — withdrawn at hard.
  const showRuleTemplate = supportTier !== 'hard';

  const [currentPhase, setCurrentPhase] = useState<SpellingPhase>('observe');
  const [patternIdentified, setPatternIdentified] = useState(false);
  const [studentRule, setStudentRule] = useState('');
  const [showHints, setShowHints] = useState<Set<number>>(new Set());

  // ── Teaching workspace: one dictation word per item ─────────────────────
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `spelling-pattern-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => spellingWords(data), [data]);
  const session = useMemo(() => spellingSession(data), [data]);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<{ correct: boolean; words: string } | null>(null);
  // Levers (`SPELLING_LEVERS`): this word's runtime pulls, and the ungraded shorter word a simplify pull opens.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SpellingWord | null>(null);
  const progress = useSpellingProgress<SpellingWord>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: spellingPatternExplorerBoss.assignment!,
    // A fresh word opens empty; Try again keeps the typing and the verdict words until the next check.
    // A retry on the practice word keeps it; only endPractice brings the full word back.
    onItemOpened: (_index, retry) => { if (!retry) { setTyped(''); setVerdict(null); setPractice(null); } },
  });
  const allDone = progress.isComplete || !!progress.practiceSummary;
  const sessionItem = items[progress.currentIndex] ?? null;
  /** The word being spelled now: the practice word while one is open, else the session's word. */
  const item = practice ?? sessionItem;
  const runtimePulls = sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  // Easy starts with the pattern words shown: a starting position, not a pull.
  const pulled = useMemo(() => Array.from(new Set([...(patternWordsStartShown(session) ? [PATTERN_WORDS_LEVER] : []), ...runtimePulls])),
    [session, runtimePulls]);
  const leverOn = (id: string) => !practice && pulled.includes(id);
  const blocked = progress.canAttempt === false;

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<SpellingPatternExplorerMetrics>({
    primitiveType: 'spelling-pattern-explorer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Phase nav
  const phases: SpellingPhase[] = ['observe', 'rule', 'apply', 'review'];
  const phaseLabels: Record<SpellingPhase, string> = { observe: 'Observe', rule: 'Rule', apply: 'Apply', review: 'Review' };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) {
      SoundManager.navigate();
      setCurrentPhase(phases[idx + 1]);
    }
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) {
      SoundManager.navigate();
      setCurrentPhase(phases[idx - 1]);
    }
  };

  const wordsCorrect = progress.results.filter(r => r.correct).length;
  const wordsTotal = items.length;

  // Highlight pattern in word
  const highlightWordPattern = (word: string) => {
    const pattern = highlightPattern.toLowerCase();
    const lowerWord = word.toLowerCase();
    const idx = lowerWord.indexOf(pattern);
    if (idx === -1) return <span className="text-slate-200">{word}</span>;
    return (
      <span className="text-slate-200">
        {word.slice(0, idx)}
        <span className="font-bold text-yellow-300 bg-yellow-400/20 rounded px-0.5">{word.slice(idx, idx + pattern.length)}</span>
        {word.slice(idx + pattern.length)}
      </span>
    );
  };

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const ruleOk = studentRule.trim().length > 10;
    const dictationAccuracy = items.length > 0
      ? Math.round(progress.results.reduce((s, r) => s + (r.correct ? itemScore(r.attempts) : 0), 0) / items.length) : 100;

    // Score: pattern ID (15%) + rule (30%) + dictation (55%)
    const patternScore = patternIdentified ? 15 : 0;
    const ruleScore = ruleOk ? 30 : (studentRule.trim().length > 3 ? 15 : 0);
    const dictScore = Math.round((dictationAccuracy / 100) * 55);
    const score = patternScore + ruleScore + dictScore;

    const metrics: SpellingPatternExplorerMetrics = {
      type: 'spelling-pattern-explorer',
      patternIdentified,
      ruleFormulatedCorrectly: ruleOk,
      wordsSpelledCorrectly: wordsCorrect,
      wordsTotal,
      patternType,
      dictationAccuracy,
      attemptsCount: Math.max(1, progress.results.reduce((s, r) => s + r.attempts, 0)),
    };

    submitEvaluation(score >= 50, score, metrics, { studentRule, challengeResults: progress.results });
  }, [hasSubmittedEvaluation, patternIdentified, studentRule, wordsCorrect, wordsTotal, patternType, submitEvaluation,
    items.length, progress.results]);

  // The evaluation goes out once every word is done, and only under a lesson's evaluation provider.
  useEffect(() => {
    if (!allDone || hasSubmittedEvaluation || !progress.recordsEvaluation) return;
    submitFinalEvaluation();
  }, [allDone, hasSubmittedEvaluation, progress.recordsEvaluation, submitFinalEvaluation]);

  const checkWord = () => {
    if (!item || blocked || !typed.trim()) return;
    const correct = spellingMatches(item, typed);
    const miss = correct ? undefined : spellingMiss(item, typed, highlightPattern);
    setVerdict({ correct, words: correct ? 'Yes! That is how it is spelled.' : spellingMissWords(miss) });
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeTyped(typed), correct, miss);
    if (correct && !practice) {
      progress.mergeResult({ challengeId: item.id, correct: true, attempts: progress.currentAttempts + 1,
        score: itemScore(progress.currentAttempts + 1) });
    }
  };

  // The scene the tutor reads: the phase, what is on screen, the learner's typing. Never the spelling.
  useLayoutEffect(() => {
    if (!item || !sessionItem) return;
    const hintShown = currentPhase === 'apply' && !practice && showHints.has(progress.currentIndex) ? item.hint : undefined;
    const scene = spellingScene({ phase: allDone ? 'review' : currentPhase, typed, patternWords,
      patternShown: currentPhase === 'observe' && showPatternPanel ? highlightPattern : undefined,
      ruleWritten: !!studentRule.trim(), hintShown });
    // Levers only while the learner spells a session word; none on the practice word.
    const spelling = currentPhase === 'apply' && !allDone;
    const live = spelling && !practice;
    const levers = live ? SPELLING_LEVERS.declare(sessionItem, session, pulled) : [];
    const published = leverScene(scene, {
      support: live ? SPELLING_LEVERS.support(sessionItem, session) : '',
      onScreen: live ? SPELLING_LEVERS.onScreen(sessionItem, session, pulled) : '',
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      readyForResponse: spelling,
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this word now.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...runtimePulls, id] };
        if (lever.kind === 'simplify') {
          const easier = SPELLING_LEVERS.simpler(sessionItem, session, id) as SpellingWord | null;
          if (!easier) return 'There is no shorter pattern word for this word.';
          setLeverState(next); setTyped(''); setVerdict(null); setPractice(easier);
          return { practice: spellingPatternExplorerBoss.assignment!(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setTyped(''); setVerdict(null); setPractice(null); },
    };
  });

  // Render progress
  const renderProgress = () => {
    const phaseIdx = allDone ? phases.length - 1 : phases.indexOf(currentPhase);
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, i) => {
          const isActive = i === phaseIdx;
          const isCompleted = i < phaseIdx;
          return (
            <React.Fragment key={phase}>
              {i > 0 && (
                <div className={`h-0.5 w-6 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />
              )}
              <div className={`px-2 py-1 rounded text-xs font-medium border ${
                isCompleted ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/20'
                : isActive ? 'border-blue-500/40 text-blue-300 bg-blue-500/20'
                : 'border-slate-600/30 text-slate-500 bg-slate-700/20'
              }`}>
                {phaseLabels[phase]}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const accuracyPct = wordsTotal > 0 ? Math.round((wordsCorrect / wordsTotal) * 100) : 0;

  const observe = (
    <div className="space-y-3">
      {/* Keep-true: this prompt renders at EVERY tier — it is the task framing. */}
      <p className="text-xs text-slate-500">Look at these words. What pattern do they share?</p>
      {/* Interaction surface: word tiles. L2 tier gate: all highlighted
          (legacy/easy) → first 3 worked examples (medium) → none (hard). */}
      <div className="flex flex-wrap gap-3">
        {patternWords.map((word, i) => (
          <div key={i} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-lg">
            {i < highlightLimit
              ? highlightWordPattern(word)
              : <span className="text-slate-200">{word}</span>}
          </div>
        ))}
      </div>
      {/* L1 tier gate: the explicit pattern reveal is easy/legacy only. */}
      {showPatternPanel && (
        <LuminaPanel accent="amber" className="p-2">
          <p className="text-xs text-amber-300">Pattern: <span className="font-bold text-yellow-300">{highlightPattern}</span></p>
        </LuminaPanel>
      )}
      <LuminaActionButton
        action="next"
        onClick={() => { SoundManager.select(); setPatternIdentified(true); setCurrentPhase('rule'); }}
        className="w-full"
      >
        I see the pattern! Next: Write the Rule
      </LuminaActionButton>
    </div>
  );

  const rule = (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Complete the spelling rule:</p>
      {/* L3 tier gate: the fill-in-the-blank template is withdrawn at hard —
          the student states the rule unaided (the placeholder still frames it). */}
      {showRuleTemplate && (
        <LuminaPanel>
          <p className="text-sm text-slate-300 italic">{ruleTemplate}</p>
        </LuminaPanel>
      )}
      {/* Interaction surface: student writes the rule in their own words */}
      <textarea
        value={studentRule}
        onChange={e => setStudentRule(e.target.value)}
        aria-label="Your spelling rule"
        placeholder="Write the spelling rule in your own words..."
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
      />
      <div className="flex justify-between">
        <LuminaButton tone="subtle" onClick={prevPhase}>Back</LuminaButton>
        <LuminaActionButton action="next" onClick={nextPhase} disabled={!studentRule.trim()}>
          Next: Apply the Rule
        </LuminaActionButton>
      </div>
    </div>
  );

  // Apply: one word at a time. No live glow and no "show" (the check is the commit); the hint stays.
  const apply = item && (
    <div className="space-y-3">
      <div className="flex justify-center items-center gap-2">
        <LuminaChallengeCounter current={Math.min(progress.currentIndex + 1, items.length)} total={items.length} variant="dots" />
        {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
      </div>
      <p className="text-xs text-slate-500">Listen to the word, then spell it using the pattern rule:</p>
      {leverOn(PATTERN_WORDS_LEVER) && (
        <LuminaPanel data-lever="pattern-words" className="p-2 flex flex-wrap gap-2">
          {shownPatternWords(session).map(w => {
            const parts = markPattern(w, highlightPattern);
            return (
              <span key={w} data-pattern-word={w} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-200">
                {parts ? <>{parts[0]}<span className="font-bold text-yellow-300">{parts[1]}</span>{parts[2]}</> : w}
              </span>
            );
          })}
        </LuminaPanel>
      )}
      <div className="flex items-center gap-2">
        <input
          value={typed}
          onChange={e => { if (!blocked) setTyped(e.target.value); }}
          aria-label="Your spelling"
          placeholder="Type the word..."
          disabled={blocked}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 px-3 py-2 rounded-lg border text-base bg-white/5 border-white/10 text-slate-200 focus:outline-none focus:border-blue-500/40"
        />
        {!practice && item.hint && !showHints.has(progress.currentIndex) && (
          <button onClick={() => setShowHints(prev => new Set(Array.from(prev).concat(progress.currentIndex)))}
            className="text-xs text-slate-500 hover:text-slate-400">hint</button>
        )}
        {!practice && item.hint && showHints.has(progress.currentIndex) && (
          <span className="text-xs text-amber-300">{item.hint}</span>
        )}
      </div>
      {leverOn(BOXES_LEVER) && (() => {
        const { boxes, extra } = letterBoxes(item, typed);
        return (
          <div data-lever="letter-boxes" className="flex items-center gap-1" aria-label={`${boxes.length} letter boxes`}>
            {boxes.map((l, i) => (
              <span key={i} data-letter-box={l} className="w-8 h-9 flex items-center justify-center rounded border border-white/20 bg-white/5 text-slate-200 font-mono">{l}</span>
            ))}
            {extra && <span data-letter-extra className="ml-1 font-mono text-rose-300">{extra}</span>}
          </div>
        );
      })()}
      <div className="flex justify-end">
        <LuminaActionButton action="check" onClick={checkWord} disabled={blocked || !typed.trim()}>
          Check spelling
        </LuminaActionButton>
      </div>
      {verdict && (
        <div {...(verdict.correct ? { 'data-spe-reward': '' } : {})}>
          <LuminaFeedbackCard status={verdict.correct ? 'correct' : 'incorrect'}>
            <p className="text-sm font-semibold">{verdict.words}</p>
          </LuminaFeedbackCard>
        </div>
      )}
    </div>
  );

  const review = (
    <div className="space-y-4">
      <div className="grid gap-2 grid-cols-3">
        <LuminaStat label="Pattern" value={<span className="text-yellow-300">{highlightPattern}</span>} className="p-2" />
        <LuminaStat label="Spelling" value={`${wordsCorrect}/${wordsTotal}`} className="p-2" />
        <LuminaStat
          label="Accuracy"
          value={`${accuracyPct}%`}
          accent={wordsCorrect >= wordsTotal * 0.7 ? 'emerald' : undefined}
          className="p-2"
        />
      </div>

      <LuminaPanel>
        <p className="text-xs text-slate-500 mb-1">Your Rule:</p>
        <p className="text-sm text-slate-300">{studentRule}</p>
      </LuminaPanel>

      <LuminaFeedbackCard status="correct" label="Spelling Practice Complete!">
        {wordsCorrect}/{wordsTotal} words spelled
      </LuminaFeedbackCard>
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge accent={PATTERN_ACCENTS[patternType]} className="text-xs">
                {patternType.replace('-', ' ')}
              </LuminaBadge>
            </div>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {renderProgress()}

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the workspace as a region. */}
        <PipDock />
        <PipWorkspace className="space-y-4">
          <div data-testid="spe-board" className="space-y-4">
            {allDone ? review : (
              <>
                {currentPhase === 'observe' && observe}
                {currentPhase === 'rule' && rule}
                {currentPhase === 'apply' && apply}
              </>
            )}
          </div>
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** pattern_build's metrics in this primitive's shape. */
const patternBuildMetrics = (data: SpellingPatternExplorerData) => (s: LetterBuildSummary): SpellingPatternExplorerMetrics => ({
  type: 'spelling-pattern-explorer', patternIdentified: s.solved > 0, ruleFormulatedCorrectly: false,
  wordsSpelledCorrectly: s.solved, wordsTotal: s.total, patternType: data.patternType ?? 'long-vowel',
  dictationAccuracy: s.accuracy, attemptsCount: s.attemptsCount,
});

/** The open build (`pattern_build`) on the shared letter build surface, wired from this boss. */
const PatternBuild: React.FC<SpellingPatternExplorerProps> = ({ data, className, runtimePlanItemId }) => {
  const metrics = useMemo(() => patternBuildMetrics(data), [data]);
  const boss = useMemo(() => {
    const levers = patternBuildLevers(data.supportTier);
    return { assignment: (item: LetterBuildItem) => spellingPatternExplorerBoss.assignment!({ ...item, mode: 'pattern_build',
      supportTier: data.supportTier ?? 'medium' }), levers };
  }, [data.supportTier]);
  return <LetterBuildSurface primitiveId="spelling-pattern-explorer" className={className} runtimePlanItemId={runtimePlanItemId}
    data={{ ...data, task: 'letter_build', buildItems: data.buildItems ?? [] } as never} metrics={metrics} boss={boss} />;
};

/** One mount, one shape: `pattern_build` is the letter build; the five classic modes keep the explorer. */
const SpellingPatternExplorerHost: React.FC<SpellingPatternExplorerProps> = props =>
  props.data.task === 'letter_build' ? <PatternBuild {...props} /> : <SpellingPatternExplorerSurface {...props} />;

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const SpellingPatternExplorer = withWorkspaceOnly<SpellingPatternExplorerProps>('spelling-pattern-explorer',
  SpellingPatternExplorerHost, props => props.data.title);

export default SpellingPatternExplorer;
