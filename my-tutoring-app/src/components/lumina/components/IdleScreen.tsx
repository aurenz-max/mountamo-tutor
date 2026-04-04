import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GradeLevelSelector, type GradeLevel } from './GradeLevelSelector';
import { CurriculumBrowser, type CurriculumContext } from './CurriculumBrowser';
import { LessonGroupTray, assignBloomPhase, type SelectedSubskill, type BloomPhase } from './LessonGroupBuilder';
import { SpotlightCard } from './SpotlightCard';
import { ParticleField } from './ParticleField';
import { TopicExplorer } from './TopicExplorer';
import type { GenerateOptions } from '../hooks/useExhibitSession';

// ── Cycling word animator ──────────────────────────────────────────────
const CYCLING_WORDS = [
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

const CyclingWord: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const word = CYCLING_WORDS[index];

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
        setIndex((prev) => (prev + 1) % CYCLING_WORDS.length);
      }
    }

    return () => clearTimeout(timeoutRef.current);
  }, [displayText, isDeleting, index]);

  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400">
      {displayText}
      <span className="inline-block w-[3px] h-[0.85em] bg-blue-400/80 ml-0.5 align-middle animate-pulse" />
    </span>
  );
};

// ── Main IdleScreen ────────────────────────────────────────────────────

interface IdleScreenProps {
  topic: string;
  onTopicChange: (topic: string) => void;
  gradeLevel: GradeLevel;
  onGradeLevelChange: (grade: GradeLevel) => void;
  onGenerate: (options: GenerateOptions) => void;
  onCurriculumSelect: (topic: string, grade?: GradeLevel, curriculum?: CurriculumContext) => void;
  onLaunchGroupLesson: (params: {
    topic: string;
    gradeLevel: GradeLevel;
    preBuiltObjectives: Array<{ id: string; text: string; verb: string; icon: string }>;
    curriculum: CurriculumContext;
  }) => void;
  onNavigate: (panel: string) => void;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({
  topic,
  onTopicChange,
  gradeLevel,
  onGradeLevelChange,
  onGenerate,
  onCurriculumSelect,
  onLaunchGroupLesson,
  onNavigate,
}) => {
  const [lessonGroupMode, setLessonGroupMode] = useState(false);
  const [selectedSubskills, setSelectedSubskills] = useState<SelectedSubskill[]>([]);
  const [lessonGroupTrayCollapsed, setLessonGroupTrayCollapsed] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      {/* ── Hero Section with Particle Background ── */}
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
              What will you learn about
            </h1>
            <div className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight h-[1.2em]">
              <CyclingWord />
            </div>
          </div>

          {/* Search bar — the primary CTA */}
          <form onSubmit={handleFormSubmit} className="relative group max-w-xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-700"></div>
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
                className="absolute right-2 p-3 bg-white text-slate-900 rounded-full hover:bg-blue-50 transition-transform active:scale-95 disabled:opacity-50"
                disabled={!topic}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </button>
            </div>
          </form>

          {/* Grade level — horizontal chip strip */}
          <div className="max-w-xl mx-auto">
            <GradeLevelSelector value={gradeLevel} onChange={onGradeLevelChange} />
          </div>
        </div>
      </div>

      {/* ── Below the fold ── */}
      <div className="relative z-10 max-w-5xl mx-auto w-full px-4 pb-16 space-y-12">

        {/* Quick launch row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SpotlightCard
            color="34, 211, 238"
            onClick={() => onNavigate('daily-session')}
            className="bg-gradient-to-br from-cyan-900/20 to-violet-900/20"
          >
            <div className="p-5 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">&#x26A1;</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors">Today's Session</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold uppercase tracking-wider">Ready</span>
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard
            color="74, 222, 128"
            onClick={() => onNavigate('practice-mode')}
            className="bg-gradient-to-br from-green-900/20 to-emerald-900/20"
          >
            <div className="p-5 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">&#x1F3AF;</span>
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-green-200 transition-colors">Practice</h4>
            </div>
          </SpotlightCard>

          <SpotlightCard
            color="168, 85, 247"
            onClick={() => onNavigate('scratch-pad')}
            className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20"
          >
            <div className="p-5 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">&#x270F;&#xFE0F;</span>
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-purple-200 transition-colors">Scratch Pad</h4>
            </div>
          </SpotlightCard>

          <SpotlightCard
            color="56, 189, 248"
            onClick={() => onNavigate('planner-dashboard')}
            className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20"
          >
            <div className="p-5 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">&#x1F4C5;</span>
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors">Planner</h4>
            </div>
          </SpotlightCard>
        </div>

        {/* Dynamic topic explorer */}
        <TopicExplorer
          gradeLevel={gradeLevel}
          onSelectTopic={(t) => { onTopicChange(t); onGenerate({ topic: t, gradeLevel }); }}
        />

        {/* Curriculum Browser */}
        <div>
          <div className="flex justify-end mb-2">
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
          </div>
          <CurriculumBrowser
            onSelectTopic={onCurriculumSelect}
            selectionMode={lessonGroupMode}
            selectedIds={new Set(selectedSubskills.map(s => s.id))}
            onToggleSubskill={handleToggleSubskill}
          />
        </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {([
              { panel: 'media-player-tester', icon: '\uD83C\uDFAC', title: 'Media Player', color: '139, 92, 246', cardClass: 'bg-gradient-to-br from-purple-900/20 to-violet-900/20', iconClass: 'bg-purple-500/20', hoverTitle: 'group-hover:text-purple-200', hoverArrow: 'group-hover:text-purple-400' },
              { panel: 'knowledge-check-tester', icon: '\uD83D\uDCDD', title: 'Knowledge Check', color: '59, 130, 246', cardClass: 'bg-gradient-to-br from-blue-900/20 to-cyan-900/20', iconClass: 'bg-blue-500/20', hoverTitle: 'group-hover:text-blue-200', hoverArrow: 'group-hover:text-blue-400' },
              { panel: 'math-primitives-tester', icon: '\uD83E\uDDEE', title: 'Math Primitives', color: '236, 72, 153', cardClass: 'bg-gradient-to-br from-pink-900/20 to-rose-900/20', iconClass: 'bg-pink-500/20', hoverTitle: 'group-hover:text-pink-200', hoverArrow: 'group-hover:text-pink-400' },
              { panel: 'engineering-primitives-tester', icon: '\u2699\uFE0F', title: 'Engineering', color: '249, 115, 22', cardClass: 'bg-gradient-to-br from-orange-900/20 to-red-900/20', iconClass: 'bg-orange-500/20', hoverTitle: 'group-hover:text-orange-200', hoverArrow: 'group-hover:text-orange-400' },
              { panel: 'astronomy-primitives-tester', icon: '\uD83E\uDE90', title: 'Astronomy', color: '59, 130, 246', cardClass: 'bg-gradient-to-br from-blue-900/20 to-indigo-900/20', iconClass: 'bg-blue-500/20', hoverTitle: 'group-hover:text-blue-200', hoverArrow: 'group-hover:text-blue-400' },
              { panel: 'physics-primitives-tester', icon: '\u269B\uFE0F', title: 'Physics', color: '99, 102, 241', cardClass: 'bg-gradient-to-br from-indigo-900/20 to-violet-900/20', iconClass: 'bg-indigo-500/20', hoverTitle: 'group-hover:text-indigo-200', hoverArrow: 'group-hover:text-indigo-400' },
              { panel: 'feature-exhibit-tester', icon: '\uD83D\uDCF0', title: 'Feature Exhibit', color: '14, 165, 233', cardClass: 'bg-gradient-to-br from-sky-900/20 to-blue-900/20', iconClass: 'bg-sky-500/20', hoverTitle: 'group-hover:text-sky-200', hoverArrow: 'group-hover:text-sky-400' },
              { panel: 'biology-primitives-tester', icon: '\uD83E\uDDEC', title: 'Biology', color: '34, 197, 94', cardClass: 'bg-gradient-to-br from-green-900/20 to-emerald-900/20', iconClass: 'bg-green-500/20', hoverTitle: 'group-hover:text-green-200', hoverArrow: 'group-hover:text-green-400' },
              { panel: 'chemistry-primitives-tester', icon: '\uD83E\uDDEA', title: 'Chemistry', color: '16, 185, 129', cardClass: 'bg-gradient-to-br from-emerald-900/20 to-teal-900/20', iconClass: 'bg-emerald-500/20', hoverTitle: 'group-hover:text-emerald-200', hoverArrow: 'group-hover:text-emerald-400' },
              { panel: 'language-arts-tester', icon: '\uD83D\uDCDA', title: 'Language Arts', color: '244, 114, 182', cardClass: 'bg-gradient-to-br from-pink-900/20 to-fuchsia-900/20', iconClass: 'bg-pink-500/20', hoverTitle: 'group-hover:text-pink-200', hoverArrow: 'group-hover:text-pink-400' },
              { panel: 'lumina-tutor-tester', icon: '\uD83E\uDD16', title: 'Lumina Tutor', color: '129, 140, 248', cardClass: 'bg-gradient-to-br from-indigo-900/20 to-violet-900/20', iconClass: 'bg-indigo-500/20', hoverTitle: 'group-hover:text-indigo-200', hoverArrow: 'group-hover:text-indigo-400' },
              { panel: 'calibration-simulator', icon: '\uD83D\uDCC8', title: 'IRT Simulator', color: '251, 146, 60', cardClass: 'bg-gradient-to-br from-orange-900/20 to-amber-900/20', iconClass: 'bg-orange-500/20', hoverTitle: 'group-hover:text-orange-200', hoverArrow: 'group-hover:text-orange-400' },
              { panel: 'analytics-dashboard', icon: '\uD83D\uDCCA', title: 'Analytics', color: '139, 92, 246', cardClass: 'bg-gradient-to-br from-purple-900/20 to-indigo-900/20', iconClass: 'bg-purple-500/20', hoverTitle: 'group-hover:text-purple-200', hoverArrow: 'group-hover:text-purple-400' },
            ] as const).map(({ panel, icon, title, color, cardClass, iconClass, hoverTitle, hoverArrow }) => (
              <SpotlightCard
                key={panel}
                color={color}
                onClick={() => onNavigate(panel)}
                className={cardClass}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 ${iconClass} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <span className="text-lg">{icon}</span>
                  </div>
                  <h3 className={`text-sm font-semibold text-white ${hoverTitle} transition-colors`}>
                    {title}
                  </h3>
                  <svg className={`w-4 h-4 ml-auto text-slate-600 ${hoverArrow} transition-all group-hover:translate-x-1 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                  </svg>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};

export default IdleScreen;
