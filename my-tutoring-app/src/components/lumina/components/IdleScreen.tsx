import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { GradeLevel } from './GradeLevelSelector';
import { CurriculumBrowser, type CurriculumContext } from './CurriculumBrowser';
import { LessonGroupTray, assignBloomPhase, type SelectedSubskill, type BloomPhase } from './LessonGroupBuilder';
import { ParticleField } from './ParticleField';
import { SoundManager } from '../utils/SoundManager';
import { useStudent } from '../contexts/StudentContext';
import { analyticsApi } from '@/lib/studentAnalyticsAPI';
import type { GenerateOptions } from '../hooks/useExhibitSession';
import { maxObjectivesForGrade } from '../service/curator-brief/objectiveBudget';

// ── Cycling word animator ──────────────────────────────────────────────
// Learn mode shows topics to explore; Practice mode shows skills to drill.
const LEARN_WORDS = [
  'quantum physics',
  'ancient Rome',
  'ocean ecosystems',
  'jazz history',
  'rocket science',
  'dinosaurs',
  'black holes',
  'the water cycle',
  'volcanoes',
  'DNA',
];

const PRACTICE_WORDS = [
  'adding fractions',
  'place value',
  'telling time',
  'counting money',
  'multiplication facts',
  'balancing equations',
  'sentence structure',
  'rounding numbers',
  'reading graphs',
  'spelling patterns',
];

const CyclingWord: React.FC<{ words: string[]; gradientClass: string }> = ({ words, gradientClass }) => {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const word = words[index];

    if (!isDeleting) {
      // Typing
      if (displayText.length < word.length) {
        timeoutRef.current = setTimeout(() => {
          setDisplayText(word.slice(0, displayText.length + 1));
        }, 60 + Math.random() * 40);
      } else {
        // Pause at full word
        timeoutRef.current = setTimeout(() => setIsDeleting(true), 2200);
      }
    } else {
      // Deleting
      if (displayText.length > 0) {
        timeoutRef.current = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 30);
      } else {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % words.length);
      }
    }

    return () => clearTimeout(timeoutRef.current);
  }, [displayText, isDeleting, index, words]);

  return (
    <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClass}`}>
      {displayText}
      <span className="inline-block w-[3px] h-[0.85em] bg-blue-400/80 ml-0.5 align-middle animate-pulse" />
    </span>
  );
};

// ── Learn / Practice snapping slider ───────────────────────────────────
type HomeMode = 'learn' | 'practice';

const SLIDER_TRAVEL = 128; // px the knob slides between the two ends

const ModeSlider: React.FC<{ mode: HomeMode; onChange: (m: HomeMode) => void }> = ({ mode, onChange }) => {
  // Flip sound only on an actual mode change (snapping back to the same end stays silent).
  const change = (next: HomeMode) => {
    if (next === mode) return;
    SoundManager.toggle(next === 'practice'); // rising into Practice, falling back to Learn
    onChange(next);
  };

  return (
  <div
    className="relative mx-auto h-11 w-[256px] select-none rounded-full border border-white/10 bg-slate-900/60 shadow-inner backdrop-blur-sm"
    role="switch"
    aria-checked={mode === 'practice'}
    aria-label="Toggle between Learn and Practice"
  >
    {/* Static labels (also clickable for a no-drag toggle) */}
    <button
      type="button"
      onClick={() => change('learn')}
      className={`absolute inset-y-0 left-0 z-10 w-1/2 text-sm font-semibold transition-colors ${
        mode === 'learn' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      Learn
    </button>
    <button
      type="button"
      onClick={() => change('practice')}
      className={`absolute inset-y-0 right-0 z-10 w-1/2 text-sm font-semibold transition-colors ${
        mode === 'practice' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      Practice
    </button>
    {/* Draggable knob — snaps to the nearest end on release */}
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: SLIDER_TRAVEL }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const start = mode === 'learn' ? 0 : SLIDER_TRAVEL;
        const projected = start + info.offset.x;
        change(projected > SLIDER_TRAVEL / 2 ? 'practice' : 'learn');
      }}
      animate={{ x: mode === 'learn' ? 0 : SLIDER_TRAVEL }}
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      className={`absolute left-1 top-1 z-20 flex h-9 w-[120px] cursor-grab items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white shadow-lg active:cursor-grabbing ${
        mode === 'learn'
          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-blue-500/30'
          : 'bg-gradient-to-r from-violet-500 to-cyan-500 shadow-violet-500/30'
      }`}
    >
      <span>{mode === 'learn' ? '📚' : '⚡'}</span>
      <span>{mode === 'learn' ? 'Learn' : 'Practice'}</span>
    </motion.div>
  </div>
  );
};

// ── Main IdleScreen ────────────────────────────────────────────────────

interface IdleScreenProps {
  topic: string;
  onTopicChange: (topic: string) => void;
  gradeLevel: GradeLevel;
  onGenerate: (options: GenerateOptions) => void;
  /** Practice mode's one action: open a Pulse session, which picks its own subject. */
  onStartPractice: () => void;
  onCurriculumSelect: (topic: string, grade?: GradeLevel, curriculum?: CurriculumContext) => void;
  onLaunchGroupLesson: (params: {
    topic: string;
    gradeLevel: GradeLevel;
    preBuiltObjectives: Array<{
      id: string; text: string; verb: string; icon: string;
      subskillId?: string; skillId?: string; grade?: string;
    }>;
    curriculum: CurriculumContext;
  }) => void;
  onNavigate: (panel: string) => void;
  /** Today's Session ribbon (App-wired) — ambient state under the hero. */
  sessionRibbon?: React.ReactNode;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({
  topic,
  onTopicChange,
  gradeLevel,
  onGenerate,
  onStartPractice,
  onCurriculumSelect,
  onLaunchGroupLesson,
  onNavigate,
  sessionRibbon,
}) => {
  const [lessonGroupMode, setLessonGroupMode] = useState(false);
  const [selectedSubskills, setSelectedSubskills] = useState<SelectedSubskill[]>([]);
  const [lessonGroupTrayCollapsed, setLessonGroupTrayCollapsed] = useState(false);
  const [mode, setMode] = useState<HomeMode>('learn');
  const [curriculumOpen, setCurriculumOpen] = useState(false);

  // Recommended fill (Lesson Entry Contract fill mode #3): the IRT selector
  // pre-populates the same tray the student fills by hand.
  const { studentId, isAnonymous, ready: studentReady } = useStudent();
  const [browsedSubject, setBrowsedSubject] = useState<{ name: string; grade?: string } | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  const handleRecommendedFill = useCallback(async () => {
    if (!browsedSubject || recLoading || !studentReady || isAnonymous) return;
    setRecLoading(true);
    setRecError(null);
    try {
      // The band's objective budget (1 PreK / 2 K / 3 above) is also the fill's
      // size, and a one-objective fill is a whole lesson at PreK, not too little data.
      const maxObjectives = maxObjectivesForGrade(browsedSubject.grade);
      const result = await analyticsApi.getSessionTargets(Number(studentId), {
        subject: browsedSubject.name,
        grade: browsedSubject.grade,
        count: maxObjectives,
      });
      if (result.objectives.length < Math.min(2, maxObjectives)) {
        setRecError('Not enough progress data yet — pick subskills by hand.');
        return;
      }
      setSelectedSubskills(
        result.objectives.map(o => ({
          id: o.subskillId,
          description: o.text,
          skillId: o.skillId,
          skillDescription: o.skillDescription,
          unitTitle: o.unitTitle || o.unitId,
          subject: browsedSubject.name,
          grade: browsedSubject.grade,
          // The selector's verb IS model state: confirm→apply, learn→identify/explain
          bloomPhase: o.verb,
          reason: o.reason,
        }))
      );
      setLessonGroupMode(true);
      setLessonGroupTrayCollapsed(false);
    } catch {
      setRecError('Could not load recommendations.');
    } finally {
      setRecLoading(false);
    }
  }, [browsedSubject, recLoading, studentReady, isAnonymous, studentId]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onGenerate({ topic, gradeLevel });
  };

  const handleToggleSubskill = useCallback((subskill: SelectedSubskill) => {
    setSelectedSubskills(prev => {
      const existing = prev.find(s => s.id === subskill.id);
      if (existing) {
        return prev.filter(s => s.id !== subskill.id);
      }
      const withBloom: SelectedSubskill = {
        ...subskill,
        bloomPhase: assignBloomPhase(subskill.description, prev.length),
      };
      return [...prev, withBloom];
    });
  }, []);

  const handleUpdateBloom = useCallback((id: string, phase: BloomPhase) => {
    setSelectedSubskills(prev =>
      prev.map(s => s.id === id ? { ...s, bloomPhase: phase } : s)
    );
  }, []);

  const handleLaunchGroupLessonInternal = useCallback(() => {
    if (selectedSubskills.length < 2) return;

    const objectives = selectedSubskills.map((s, i) => ({
      id: `obj${i + 1}`,
      text: s.description,
      verb: s.bloomPhase as string,
      icon: s.bloomPhase === 'identify' ? 'search' : s.bloomPhase === 'explain' ? 'message' : 'pencil',
      // Each objective is a distinct selected subskill — carry its IDs so
      // personalization keys into β directly instead of re-deriving via embedding.
      subskillId: s.id,
      skillId: s.skillId,
      // Precise curriculum grade — the mappedGrade band below loses it
      // ('elementary' spans 1-5), so generators read this via ctx.grade.
      grade: s.grade,
    }));

    const subjects = new Set(selectedSubskills.map(s => s.subject));
    const units = new Set(selectedSubskills.map(s => s.unitTitle));
    const subjectStr = Array.from(subjects).join(', ');
    const unitStr = Array.from(units).join(' & ');
    const topicStr = units.size === 1 ? `${subjectStr}: ${unitStr}` : subjectStr;

    const firstGrade = selectedSubskills[0].grade;
    let mappedGrade: GradeLevel = gradeLevel;
    if (firstGrade) {
      const g = firstGrade.toLowerCase().trim();
      mappedGrade =
        g.includes('pre') ? 'preschool' :
        g === 'k' || g.includes('kindergarten') ? 'kindergarten' :
        !isNaN(parseInt(g)) && parseInt(g) <= 5 ? 'elementary' :
        !isNaN(parseInt(g)) && parseInt(g) <= 8 ? 'middle-school' :
        !isNaN(parseInt(g)) && parseInt(g) <= 12 ? 'high-school' : gradeLevel;
    }

    const curriculum: CurriculumContext = {
      subject: selectedSubskills[0].subject,
      skillId: selectedSubskills[0].skillId,
      subskillId: selectedSubskills[0].id,
    };

    setLessonGroupMode(false);

    onLaunchGroupLesson({
      topic: topicStr,
      gradeLevel: mappedGrade,
      preBuiltObjectives: objectives,
      curriculum,
    });
  }, [selectedSubskills, gradeLevel, onLaunchGroupLesson]);

  return (
    <div className="flex-1 flex flex-col animate-fade-in relative">
      {/* ── Hero Section with responsive constellation field ── */}
      <div className="relative flex flex-col justify-center items-center text-center min-h-[70vh] overflow-hidden">
        <ParticleField className="z-0" />

        {/* Radial glow behind hero text */}
        <div className="absolute inset-0 z-[1] pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-500/[0.04] rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 space-y-8 max-w-3xl px-4">
          {/* Animated headline */}
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-slate-400 leading-[1.1]">
              {mode === 'learn' ? 'What will you learn about' : 'What will you practice'}
            </h1>
            <div className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight h-[1.2em]">
              <CyclingWord
                key={mode}
                words={mode === 'learn' ? LEARN_WORDS : PRACTICE_WORDS}
                gradientClass={
                  mode === 'learn'
                    ? 'from-cyan-300 via-blue-400 to-violet-400'
                    : 'from-violet-300 via-fuchsia-400 to-cyan-400'
                }
              />
            </div>
          </div>

          {/* The primary CTA: a topic search in Learn, a Pulse session in Practice */}
          {mode === 'learn' ? (
            <form onSubmit={handleFormSubmit} className="relative group max-w-xl mx-auto">
              <div className="absolute -inset-1 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-700 bg-gradient-to-r from-blue-600 to-purple-600"></div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => onTopicChange(e.target.value)}
                  placeholder="Type any topic..."
                  className="w-full px-8 py-5 bg-slate-900/80 backdrop-blur-sm text-white rounded-full border border-slate-700/80 focus:border-blue-400/50 focus:outline-none text-lg shadow-2xl transition-all placeholder:text-slate-500"
                  autoFocus
                />
                <button
                  type="submit"
                  aria-label="Generate lesson"
                  className="absolute right-2 p-3 rounded-full transition-transform active:scale-95 disabled:opacity-50 bg-white text-slate-900 hover:bg-blue-50"
                  disabled={!topic}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={onStartPractice}
              className="inline-flex items-center gap-3 px-10 py-5 rounded-full text-lg font-bold text-white shadow-2xl transition-transform active:scale-95 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>
              Start practice
            </button>
          )}

          {/* Mode toggle — Learn ⇄ Practice, sits with the search it controls */}
          <div className="space-y-3">
            <ModeSlider mode={mode} onChange={setMode} />
            <p className="text-sm text-slate-500">
              {mode === 'learn'
                ? 'Build an interactive lesson on any topic.'
                : 'Adaptive practice — difficulty adjusts to you in real time.'}
            </p>
          </div>

        </div>
      </div>

      {/* ── Below the fold ── */}
      <div className="relative z-10 max-w-5xl mx-auto w-full px-4 pb-16 space-y-12">

        {/* Today's Session — ambient ribbon directly under the hero. One tap
            to launch the next beat; the drawer holds the full plan. Replaces
            the old two-click card → interstitial path. */}
        {sessionRibbon && (
          <div className="-mt-10 text-center">
            {sessionRibbon}
          </div>
        )}

        {/* Curriculum Browser */}
        {studentReady && !isAnonymous && !curriculumOpen && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setCurriculumOpen(true)}
              className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-300"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" />
              </svg>
              Browse curriculum
              <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {curriculumOpen && (
        <div>
          <div className="flex justify-end items-center gap-2 mb-2">
            {recError && (
              <span className="text-xs text-amber-400/80">{recError}</span>
            )}
            {studentReady && !isAnonymous && !browsedSubject && !recError && (
              <span className="text-xs text-slate-500">
                Pick a subject below to unlock
              </span>
            )}
            {studentReady && !isAnonymous && (
              <button
                onClick={handleRecommendedFill}
                disabled={!browsedSubject || recLoading}
                title={
                  browsedSubject
                    ? `Fill the Lesson Builder with what the model says to work on next in ${browsedSubject.name}`
                    : 'Pick a subject below first'
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                  browsedSubject && !recLoading
                    ? 'bg-violet-500/15 border-violet-500/40 text-violet-200 hover:bg-violet-500/25'
                    : 'bg-white/5 border-white/10 text-slate-600 cursor-not-allowed'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                {recLoading ? 'Picking targets…' : 'Recommended Lesson'}
              </button>
            )}
            <button
              onClick={() => {
                setLessonGroupMode(prev => !prev);
                if (lessonGroupMode) setSelectedSubskills([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                lessonGroupMode
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                  : 'bg-white/5 border-white/20 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {lessonGroupMode ? 'Exit Build Mode' : 'Build Lesson'}
            </button>
            <button
              type="button"
              onClick={() => setCurriculumOpen(false)}
              className="rounded-full px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
            >
              Close
            </button>
          </div>
          <CurriculumBrowser
            onSelectTopic={onCurriculumSelect}
            selectionMode={lessonGroupMode}
            selectedIds={new Set(selectedSubskills.map(s => s.id))}
            onToggleSubskill={handleToggleSubskill}
            onActiveSubjectChange={setBrowsedSubject}
          />
        </div>
        )}

        {selectedSubskills.length > 0 && (
          <LessonGroupTray
            subskills={selectedSubskills}
            onRemove={(id) => setSelectedSubskills(prev => prev.filter(s => s.id !== id))}
            onUpdateBloom={handleUpdateBloom}
            onLaunch={handleLaunchGroupLessonInternal}
            onClear={() => setSelectedSubskills([])}
            collapsed={lessonGroupTrayCollapsed}
            onToggleCollapse={() => setLessonGroupTrayCollapsed(prev => !prev)}
          />
        )}

        {/* Developer Tools — collapsed by default */}
        <details className="group/dev">
          <summary className="flex items-center gap-4 cursor-pointer select-none">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
            <span className="text-slate-600 text-xs font-mono uppercase tracking-widest group-hover/dev:text-slate-400 transition-colors flex items-center gap-2">
              Developer Tools
              <svg className="w-3 h-3 transition-transform group-open/dev:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
          </summary>

          <DevToolsPanel onNavigate={onNavigate} />
        </details>
      </div>
    </div>
  );
};

// ── Developer tools ────────────────────────────────────────────────────
// Grouped by what the tool is for, alphabetical inside each group. One accent
// per group so color carries the grouping instead of varying card by card.

interface DevTool { panel: string; icon: string; title: string; devOnly?: boolean }
interface DevToolGroup { label: string; accent: string; tools: DevTool[] }

const DEV_TOOL_GROUPS: DevToolGroup[] = [
  {
    label: 'Subject primitives',
    accent: 'text-pink-300 bg-pink-500/15 border-pink-500/20',
    tools: [
      { panel: 'astronomy-primitives-tester', icon: '🪐', title: 'Astronomy' },
      { panel: 'biology-primitives-tester', icon: '🧬', title: 'Biology' },
      { panel: 'chemistry-primitives-tester', icon: '🧪', title: 'Chemistry' },
      { panel: 'creation-primitives-tester', icon: '🏗️', title: 'Creation' },
      { panel: 'engineering-primitives-tester', icon: '⚙️', title: 'Engineering' },
      { panel: 'history-primitives-tester', icon: '🏛️', title: 'History' },
      { panel: 'language-arts-tester', icon: '📚', title: 'Language Arts' },
      { panel: 'math-primitives-tester', icon: '🧮', title: 'Math' },
      { panel: 'passage-studio-tester', icon: '📖', title: 'Passage Studio' },
      { panel: 'physics-primitives-tester', icon: '⚛️', title: 'Physics' },
    ],
  },
  {
    label: 'Agent primitives',
    accent: 'text-violet-300 bg-violet-500/15 border-violet-500/20',
    tools: [
      { panel: 'annotated-example-tester', icon: '📝', title: 'Annotated Example' },
      { panel: 'canvas-tester', icon: '🛠️', title: 'Canvas' },
      { panel: 'deep-dive-tester', icon: '🦮', title: 'Deep Dive' },
      { panel: 'practice-studio-tester', icon: '🧩', title: 'Practice Studio' },
      { panel: 'wonder-walk-tester', icon: '🚶', title: 'Wonder Walk (K)' },
    ],
  },
  {
    label: 'Lesson formats',
    accent: 'text-sky-300 bg-sky-500/15 border-sky-500/20',
    tools: [
      { panel: 'distribution-explorer-tester', icon: '📊', title: 'Distribution Explorer' },
      { panel: 'feature-exhibit-tester', icon: '📰', title: 'Feature Exhibit' },
      { panel: 'knowledge-check-tester', icon: '✅', title: 'Knowledge Check' },
      { panel: 'media-player-tester', icon: '🎬', title: 'Media Player' },
      { panel: 'practice-problem-tester', icon: '✏️', title: 'Practice Problem' },
    ],
  },
  {
    label: 'Tutor & voice',
    accent: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/20',
    tools: [
      { panel: 'blend-judge-lab', icon: '🎙️', title: 'Blend Judge Lab' },
      { panel: 'di-bench', icon: '🎯', title: 'DI Bench' },
      { panel: 'direct-instruction-tester', icon: '🗣️', title: 'Direct Instruction Lab' },
      { panel: 'live-activity-tester', icon: '📡', title: 'Live Activity', devOnly: true },
      { panel: 'lumina-tutor-tester', icon: '🤖', title: 'Lumina Tutor' },
      { panel: 'pip-lab', icon: '🫧', title: 'Pip Lab' },
    ],
  },
  {
    label: 'Adaptive engine',
    accent: 'text-amber-300 bg-amber-500/15 border-amber-500/20',
    tools: [
      { panel: 'atom-registry', icon: '🔬', title: 'Atom Registry' },
      { panel: 'diagnosis-lab', icon: '🩺', title: 'Diagnosis Lab' },
      { panel: 'calibration-simulator', icon: '📈', title: 'IRT Simulator' },
      { panel: 'lesson-bench', icon: '📦', title: 'Lesson Bench' },
      { panel: 'misconception-loop-tester', icon: '🔁', title: 'Misconception Loop' },
      { panel: 'typesafe-select-tester', icon: '🧭', title: 'TypeSafe Select' },
    ],
  },
  {
    label: 'Students & studio',
    accent: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20',
    tools: [
      { panel: 'analytics-dashboard', icon: '📊', title: 'Analytics' },
      { panel: 'design-studio', icon: '🎨', title: 'Design Studio' },
      { panel: 'sound-lab', icon: '🔊', title: 'Sound Lab' },
      { panel: 'student-activity-panel', icon: '📈', title: 'Student Activity' },
    ],
  },
];

const DevToolsPanel: React.FC<{ onNavigate: (panel: string) => void }> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const groups = DEV_TOOL_GROUPS
    .map(g => ({
      ...g,
      tools: g.tools.filter(t =>
        (!t.devOnly || process.env.NODE_ENV !== 'production') &&
        (!q || t.title.toLowerCase().includes(q) || t.panel.includes(q) || g.label.toLowerCase().includes(q)),
      ),
    }))
    .filter(g => g.tools.length > 0);
  const firstMatch = groups[0]?.tools[0];

  return (
    <div className="mt-5 space-y-6">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && q && firstMatch) onNavigate(firstMatch.panel); }}
        placeholder="Filter tools…  (Enter opens the first match)"
        className="mx-auto block w-full max-w-sm rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
      />

      {groups.length === 0 && (
        <p className="text-center text-xs text-slate-600">No tool matches “{query}”.</p>
      )}

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
        {groups.map(group => (
          <section key={group.label}>
            <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
              <span className="text-slate-700">{group.tools.length}</span>
            </h4>
            <ul className="space-y-1">
              {group.tools.map(tool => (
                <li key={tool.panel}>
                  <button
                    type="button"
                    onClick={() => onNavigate(tool.panel)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border text-sm ${group.accent}`}>
                      {tool.icon}
                    </span>
                    <span className="text-sm text-slate-300 transition-colors group-hover:text-white">
                      {tool.title}
                    </span>
                    <svg className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-slate-700 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-slate-400 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default IdleScreen;
