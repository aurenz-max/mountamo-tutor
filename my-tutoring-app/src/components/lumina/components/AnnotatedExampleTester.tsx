'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { AnnotatedExample } from '../primitives/AnnotatedExample';
import { EvaluationProvider, useEvaluationContext } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import type {
  RichAnnotatedExampleData,
  StepType,
  AnnotatedExampleSetPlan,
  AnnotatedExampleProblemPlan,
  AnnotatedExampleDifficulty,
} from '../primitives/annotated-example/types';

interface AnnotatedExampleTesterProps {
  onBack: () => void;
}

type GradeLevel = 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate';

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'elementary', label: 'Elementary' },
  { value: 'middle-school', label: 'Middle School' },
  { value: 'high-school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
];

const EXAMPLE_TOPICS = [
  { label: 'Solving two-step linear equations', subject: 'Algebra' },
  { label: 'Absolute value inequalities', subject: 'Algebra' },
  { label: 'Factoring polynomials', subject: 'Algebra' },
  { label: 'Systems of linear equations', subject: 'Algebra' },
  { label: 'Integration by parts', subject: 'Calculus' },
  { label: 'Area between curves', subject: 'Calculus' },
  { label: 'Related rates problems', subject: 'Calculus' },
  { label: 'Eigenvalues and eigenvectors', subject: 'Linear Algebra' },
  { label: 'Newton\'s Second Law on inclined planes', subject: 'Physics' },
  { label: 'Conservation of momentum in collisions', subject: 'Physics' },
  { label: 'Conditional probability and Bayes\' theorem', subject: 'Probability' },
  { label: 'Expected value of discrete random variables', subject: 'Probability' },
  { label: 'Pythagorean theorem applications', subject: 'Geometry' },
  { label: 'Properties of similar triangles', subject: 'Geometry' },
  { label: 'Compound interest and exponential growth', subject: 'Finance' },
];

const COUNT_OPTIONS = [3, 5, 7];

const STEP_TYPE_COLORS: Record<StepType, string> = {
  algebra: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  table: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  diagram: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'graph-sketch': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  'case-split': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

const DIFFICULTY_COLORS: Record<AnnotatedExampleDifficulty, string> = {
  easy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  hard: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

// ── Evaluation Results Panel ─────────────────────────────────────────

const EvaluationResultsPanel: React.FC = () => {
  const context = useEvaluationContext();

  if (!context) {
    return (
      <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-slate-500 text-xs">No evaluation context</p>
      </div>
    );
  }

  const { submittedResults, getSessionSummary } = context;
  const summary = getSessionSummary();

  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
      <h4 className="text-sm font-semibold text-white">Evaluation</h4>
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-slate-700/50 rounded-lg text-center">
          <div className="text-lg font-bold text-white">{summary.totalAttempts}</div>
          <div className="text-[10px] text-slate-400">Attempts</div>
        </div>
        <div className="p-2 bg-slate-700/50 rounded-lg text-center">
          <div className="text-lg font-bold text-green-400">{summary.successfulAttempts}</div>
          <div className="text-[10px] text-slate-400">Success</div>
        </div>
        <div className="p-2 bg-slate-700/50 rounded-lg text-center">
          <div className="text-lg font-bold text-amber-400">{Math.round(summary.averageScore)}%</div>
          <div className="text-[10px] text-slate-400">Avg</div>
        </div>
      </div>
      {submittedResults.length === 0 && (
        <p className="text-slate-500 text-xs text-center py-2">No results yet</p>
      )}
    </div>
  );
};

// ── Step Manifest Panel ──────────────────────────────────────────────

const StepManifestPanel: React.FC<{ data: RichAnnotatedExampleData }> = ({ data }) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white">Step Manifest</h4>
      <div className="space-y-1.5">
        {data.steps.map((step, i) => (
          <div
            key={step.id}
            className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50"
          >
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-200 truncate">{step.title}</p>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
              STEP_TYPE_COLORS[step.content.type] || 'bg-slate-600/50 text-slate-400 border-slate-500/30'
            }`}>
              {step.content.type}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-700/50">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Strategy</p>
        <p className="text-xs text-slate-400 leading-relaxed">{data.solutionStrategy}</p>
      </div>
    </div>
  );
};

// ── JSON Inspector ───────────────────────────────────────────────────

const JsonInspector: React.FC<{ data: unknown; label?: string }> = ({ data, label = 'raw JSON' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        {isOpen ? '▾ Hide' : '▸ View'} {label}
      </button>
      {isOpen && (
        <pre className="mt-2 p-3 bg-black/30 rounded-lg text-[10px] text-slate-400 overflow-auto max-h-64 border border-white/5 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ── Plan Slot Card ───────────────────────────────────────────────────

interface SlotState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data?: RichAnnotatedExampleData;
  error?: string;
}

const PlanSlotCard: React.FC<{
  slot: AnnotatedExampleProblemPlan;
  state: SlotState;
  isActive: boolean;
  onClick: () => void;
}> = ({ slot, state, isActive, onClick }) => {
  const statusBadge = () => {
    if (state.status === 'loading') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
          loading…
        </span>
      );
    }
    if (state.status === 'ready') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-green-500/20 text-green-300 border-green-500/30">
          ready
        </span>
      );
    }
    if (state.status === 'error') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/30">
          error
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-slate-700/50 text-slate-400 border-slate-600/40">
        not yet
      </span>
    );
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isActive
          ? 'bg-indigo-500/15 border-indigo-400/50'
          : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
          {slot.index + 1}
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${DIFFICULTY_COLORS[slot.difficulty]}`}>
          {slot.difficulty}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-slate-700/50 text-slate-300 border-slate-600/40">
          {slot.insetType ?? 'plain'}
        </span>
        <div className="ml-auto">{statusBadge()}</div>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{slot.brief}</p>
      {slot.cognitiveNote && (
        <p className="mt-2 text-[10px] text-slate-500 italic leading-relaxed">
          {slot.cognitiveNote}
        </p>
      )}
      {state.status === 'error' && state.error && (
        <p className="mt-2 text-[10px] text-red-400">{state.error}</p>
      )}
    </button>
  );
};

// ── Main Content ─────────────────────────────────────────────────────

const AnnotatedExampleTesterContent: React.FC<AnnotatedExampleTesterProps> = ({ onBack }) => {
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('high-school');
  const [topic, setTopic] = useState('');
  const [intent, setIntent] = useState('');
  const [count, setCount] = useState<number>(5);

  const [isPlanning, setIsPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AnnotatedExampleSetPlan | null>(null);
  const [planTime, setPlanTime] = useState<number | null>(null);

  const [slotStates, setSlotStates] = useState<Record<number, SlotState>>({});
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hydrationTimes, setHydrationTimes] = useState<Record<number, number>>({});

  const handlePlan = async () => {
    setIsPlanning(true);
    setPlanError(null);
    setPlan(null);
    setSlotStates({});
    setActiveIndex(null);
    setHydrationTimes({});
    setPlanTime(null);

    const startTime = Date.now();

    try {
      const currentTopic = topic || 'Solving two-step linear equations';
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'planAnnotatedExampleSet',
          params: {
            topic: currentTopic,
            gradeLevel: selectedGrade,
            count,
            ...(intent ? { context: intent } : {}),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to plan example set');
      }

      const result = (await response.json()) as AnnotatedExampleSetPlan;
      setPlan(result);
      setPlanTime(Date.now() - startTime);

      const initial: Record<number, SlotState> = {};
      for (const p of result.problems) initial[p.index] = { status: 'idle' };
      setSlotStates(initial);
    } catch (err) {
      console.error('Plan error:', err);
      setPlanError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsPlanning(false);
    }
  };

  // useCallback so the reference is stable across renders that don't
  // change topic/grade. The primitive's hydrate-on-mount effect tracks
  // its callback prop in deps; an inline arrow here would change every
  // render and cause runaway re-hydration of the same slot.
  const hydrateSlot = useCallback(
    async (slot: AnnotatedExampleProblemPlan) => {
      const currentTopic = topic || 'Solving two-step linear equations';

      setSlotStates((prev) => ({ ...prev, [slot.index]: { status: 'loading' } }));
      const startTime = Date.now();

      try {
        const response = await fetch('/api/lumina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generateAnnotatedExampleFromPlan',
            params: {
              plan: slot,
              topic: currentTopic,
              gradeContext: selectedGrade,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to hydrate slot');
        }

        const data = (await response.json()) as RichAnnotatedExampleData;
        setSlotStates((prev) => ({ ...prev, [slot.index]: { status: 'ready', data } }));
        setHydrationTimes((prev) => ({ ...prev, [slot.index]: Date.now() - startTime }));
      } catch (err) {
        console.error('Hydration error:', err);
        setSlotStates((prev) => ({
          ...prev,
          [slot.index]: {
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error occurred',
          },
        }));
      }
    },
    [topic, selectedGrade],
  );

  // Void-returning stable wrapper for the primitive's onHydrateSlot prop.
  // The primitive doesn't await; this swallows the promise and keeps the
  // function identity stable.
  const handleHydrateSlot = useCallback(
    (slot: AnnotatedExampleProblemPlan) => {
      void hydrateSlot(slot);
    },
    [hydrateSlot],
  );

  const handleSlotClick = (slot: AnnotatedExampleProblemPlan) => {
    setActiveIndex(slot.index);
    // Hydration is also triggered by the primitive itself in set mode,
    // but kicking off here keeps the slot-card status pill flipping to
    // "loading" the moment the picker is clicked.
    const current = slotStates[slot.index];
    if (!current || current.status === 'idle' || current.status === 'error') {
      void hydrateSlot(slot);
    }
  };

  const activeSlot =
    plan && activeIndex != null ? plan.problems.find((p) => p.index === activeIndex) ?? null : null;
  const activeState = activeIndex != null ? slotStates[activeIndex] : undefined;
  const activeData = activeState?.status === 'ready' ? activeState.data : undefined;
  const activeHydrationTime = activeIndex != null ? hydrationTimes[activeIndex] : undefined;

  // Adapt the per-slot SlotState map into the {index → data | undefined}
  // shape the primitive expects for set mode. Loading / error / idle
  // slots present as undefined so the primitive falls into its own
  // loading state and re-fires onHydrateSlot if needed. Memoized — a
  // fresh object identity on every render would churn the primitive's
  // hydrate effect deps and re-trigger pipeline runs in a loop.
  const hydratedSlotsForPrimitive = useMemo(() => {
    const out: Record<number, RichAnnotatedExampleData | undefined> = {};
    if (!plan) return out;
    for (const slot of plan.problems) {
      const state = slotStates[slot.index];
      out[slot.index] = state?.status === 'ready' ? state.data : undefined;
    }
    return out;
  }, [plan, slotStates]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors"
            >
              &larr; Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>📝</span>
              <span>Annotated Example</span>
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Orchestrated Set
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {planTime != null && <span>Plan: {(planTime / 1000).toFixed(1)}s</span>}
            {activeHydrationTime != null && (
              <span>Slot {activeIndex! + 1}: {(activeHydrationTime / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel — Controls */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-5">
            {/* Grade Level */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Grade Level
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value as GradeLevel)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Count */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Examples in Set
              </label>
              <div className="flex gap-1.5">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`flex-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                      count === n
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Problem / Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Solve 2x + 5 = 13"
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Quick Topic Pills — initiate orchestrator on click */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Quick Topics <span className="text-slate-600 font-normal">(plans on click)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_TOPICS.map((ex) => {
                  const isSelected = topic === ex.label;
                  return (
                    <button
                      key={ex.label}
                      onClick={() => {
                        setTopic(ex.label);
                      }}
                      disabled={isPlanning}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={ex.subject}
                    >
                      {ex.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intent / Context */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Context <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Steering text for the planner"
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Plan Button */}
            <button
              onClick={handlePlan}
              disabled={isPlanning}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isPlanning ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Planning…
                </span>
              ) : (
                `Plan ${count}-Example Set`
              )}
            </button>

            {/* Active slot manifest */}
            {activeData && (
              <div className="pt-4 border-t border-slate-700">
                <StepManifestPanel data={activeData} />
              </div>
            )}

            {/* Evaluation Results */}
            <div className="pt-4 border-t border-slate-700">
              <EvaluationResultsPanel />
            </div>

            {/* JSON Inspectors */}
            {plan && (
              <div className="pt-4 border-t border-slate-700">
                <JsonInspector data={plan} label="plan JSON" />
              </div>
            )}
            {activeData && (
              <div className="pt-2">
                <JsonInspector data={activeData} label="active slot JSON" />
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel — Plan / Slot Picker */}
        <div className="w-96 border-r border-slate-800 bg-slate-900/20 backdrop-blur overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Plan</h3>
              {plan && (
                <span className="text-[10px] text-slate-500">
                  {plan.problems.length} slot{plan.problems.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {planError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-xs">Error: {planError}</p>
              </div>
            )}

            {!plan && !planError && !isPlanning && (
              <p className="text-xs text-slate-500 leading-relaxed">
                Pick a topic and click <span className="text-slate-300">Plan</span> (or click a quick topic, then plan). The orchestrator will lay out a difficulty-graded set with per-slot insets and content briefs. Click any slot to hydrate and render it.
              </p>
            )}

            {plan && (
              <>
                <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Lesson Arc</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{plan.lessonArc}</p>
                </div>

                <div className="space-y-2">
                  {plan.problems.map((slot) => (
                    <PlanSlotCard
                      key={slot.index}
                      slot={slot}
                      state={slotStates[slot.index] ?? { status: 'idle' }}
                      isActive={activeIndex === slot.index}
                      onClick={() => handleSlotClick(slot)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Panel — Active Slot Render */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {!plan && !isPlanning && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Annotated Example Orchestrator
                  </h3>
                  <p className="text-slate-400 max-w-lg mb-6">
                    Two-step flow: the orchestrator plans an N-example lesson arc with per-slot
                    difficulty, inset, and content brief. Pick any slot to hydrate it through the
                    full annotated-example pipeline (architect → parallel step generators → judge).
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {(['algebra', 'table', 'diagram', 'graph-sketch', 'case-split'] as StepType[]).map((type) => (
                      <span
                        key={type}
                        className={`text-[10px] px-2 py-1 rounded-full border ${
                          STEP_TYPE_COLORS[type]
                        }`}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isPlanning && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin mx-auto" />
                  <div>
                    <p className="text-slate-300 font-medium">Planning lesson arc…</p>
                    <p className="text-slate-500 text-sm mt-1">
                      One Gemini call shaping difficulty, insets, and briefs.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {plan && !activeSlot && !isPlanning && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center max-w-md">
                  <div className="text-5xl mb-4">👈</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Plan ready</h3>
                  <p className="text-slate-400 text-sm">
                    Click any slot in the plan to hydrate it. Slots are generated on demand — the
                    per-example surface is too big to batch.
                  </p>
                </div>
              </div>
            )}

            {/* Error pane — primitive doesn't surface hydration errors,
                so the tester catches the failed-state and offers retry. */}
            {activeSlot && activeState?.status === 'error' && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium mb-2">
                  Error hydrating slot {activeSlot.index + 1}
                </p>
                <p className="text-red-400/80 text-xs mb-3">{activeState.error}</p>
                <button
                  onClick={() => hydrateSlot(activeSlot)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Set mode — the primitive owns activeIndex / advancement /
                hydration triggering. Tester provides plan + per-slot
                hydrated data + a hydrate callback, and uses controlled
                activeIndex purely so the dev-side slot picker can jump. */}
            {plan && activeIndex != null && activeState?.status !== 'error' && (
              <AnnotatedExample
                plan={plan}
                hydratedSlots={hydratedSlotsForPrimitive}
                onHydrateSlot={handleHydrateSlot}
                activeIndex={activeIndex}
                onActiveIndexChange={setActiveIndex}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Wrapper with providers ───────────────────────────────────────────

const AnnotatedExampleTester: React.FC<AnnotatedExampleTesterProps> = (props) => {
  return (
    <EvaluationProvider>
      <ExhibitProvider objectives={[]} manifestItems={[]}>
        <AnnotatedExampleTesterContent {...props} />
      </ExhibitProvider>
    </EvaluationProvider>
  );
};

export default AnnotatedExampleTester;
