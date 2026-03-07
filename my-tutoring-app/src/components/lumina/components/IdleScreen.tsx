import React, { useState, useCallback } from 'react';
import { GradeLevelSelector, type GradeLevel } from './GradeLevelSelector';
import { CurriculumBrowser, type CurriculumContext } from './CurriculumBrowser';
import { LessonGroupTray, assignBloomPhase, type SelectedSubskill, type BloomPhase } from './LessonGroupBuilder';
import { SpotlightCard } from './SpotlightCard';
import type { GenerateOptions } from '../hooks/useExhibitSession';

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
  // Lesson Group Builder State (internal to idle screen)
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

    // Build objectives from selected subskills
    const objectives = selectedSubskills.map((s, i) => ({
      id: `obj${i + 1}`,
      text: s.description,
      verb: s.bloomPhase as string,
      icon: s.bloomPhase === 'identify' ? 'search' : s.bloomPhase === 'explain' ? 'message' : 'pencil',
    }));

    // Build topic string from the group
    const subjects = new Set(selectedSubskills.map(s => s.subject));
    const units = new Set(selectedSubskills.map(s => s.unitTitle));
    const subjectStr = Array.from(subjects).join(', ');
    const unitStr = Array.from(units).join(' & ');
    const topicStr = units.size === 1 ? `${subjectStr}: ${unitStr}` : subjectStr;

    // Map grade from first subskill
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

    // Build curriculum context from first subskill
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
    <div className="flex-1 flex flex-col justify-center items-center text-center animate-fade-in">
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-slate-500">
          What will you learn?
        </h1>
        <p className="text-slate-400 text-xl md:text-2xl font-light leading-relaxed">
          Enter any topic to generate an interactive museum exhibit.
        </p>

        {/* Grade Level Selector */}
        <div className="max-w-md mx-auto mt-8">
          <label className="block text-sm font-medium text-slate-400 mb-2 text-center">
            Learning Level
          </label>
          <GradeLevelSelector
            value={gradeLevel}
            onChange={onGradeLevelChange}
          />
        </div>

        <form onSubmit={handleFormSubmit} className="relative group max-w-lg mx-auto mt-8">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
          <div className="relative flex items-center">
            <input
              type="text"
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
              placeholder="e.g. Quantum Mechanics, The Roman Empire, Jazz..."
              className="w-full px-8 py-5 bg-slate-900 text-white rounded-full border border-slate-700 focus:border-blue-400/50 focus:outline-none text-lg shadow-2xl transition-all"
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

        {/* START DAY HERO */}
        <div className="pt-8 max-w-2xl mx-auto w-full">
          <SpotlightCard
            color="34, 211, 238"
            onClick={() => onNavigate('daily-session')}
            className="bg-gradient-to-br from-cyan-900/20 to-violet-900/20"
          >
            <div className="p-6 flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-3xl">⚡</span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-white group-hover:text-cyan-200 transition-colors">
                    Start Today's Session
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold uppercase tracking-wider">
                    Ready
                  </span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your personalized daily plan — lessons grouped by topic, ordered by Bloom's taxonomy
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-all group-hover:translate-x-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
              </svg>
            </div>
          </SpotlightCard>
        </div>

        {/* Suggested Topics - Card Style */}
        <div className="pt-8 max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
            <span className="text-slate-500 text-xs font-mono uppercase tracking-widest">Popular Topics</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { topic: 'Industrial Revolution', icon: '⚙️', color: '250, 204, 21', description: 'Explore the transformation of manufacturing and society' },
              { topic: 'Dinosaurs', icon: '🦕', color: '74, 222, 128', description: 'Explore the ancient reptiles that ruled the Earth' },
              { topic: 'Trash Trucks', icon: '🚛', color: '192, 132, 252', description: 'Learn how garbage trucks work and keep cities clean' },
              { topic: 'Black Holes', icon: '🌌', color: '56, 189, 248', description: 'Journey into the mysteries of spacetime' }
            ].map(({ topic: suggestion, icon, color, description }) => (
              <SpotlightCard
                key={suggestion}
                color={color}
                onClick={() => { onTopicChange(suggestion); onGenerate({ topic: suggestion, gradeLevel }); }}
                className="bg-slate-900/40"
              >
                <div className="p-5 flex flex-col items-center text-center gap-3">
                  <div className="text-4xl">{icon}</div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-1 group-hover:text-blue-200 transition-colors">
                      {suggestion}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* Curriculum Browser */}
        <div className="pt-8 max-w-5xl mx-auto">
          {/* Build Lesson toggle */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => {
                setLessonGroupMode(prev => !prev);
                if (lessonGroupMode) {
                  setSelectedSubskills([]);
                }
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

        {/* Lesson Group Tray (floating bottom panel) */}
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

        {/* Main Actions Section */}
        <div className="pt-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
            <span className="text-slate-500 text-xs font-mono uppercase tracking-widest">Quick Start</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
          </div>

          {/* Quick Start Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Practice Mode Button */}
            <SpotlightCard
              color="74, 222, 128"
              onClick={() => onNavigate('practice-mode')}
              className="bg-gradient-to-br from-green-900/20 to-emerald-900/20"
            >
              <div className="p-6 flex items-start gap-4">
                <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-green-200 transition-colors">
                    Practice Session
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Auto-generated questions tailored to your subject and grade level
                  </p>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-green-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
              </div>
            </SpotlightCard>

            {/* Scratch Pad Button */}
            <SpotlightCard
              color="168, 85, 247"
              onClick={() => onNavigate('scratch-pad')}
              className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20"
            >
              <div className="p-6 flex items-start gap-4">
                <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">✏️</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-200 transition-colors">
                    Scratch Pad
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    AI-powered whiteboard with real-time feedback on your work
                  </p>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
              </div>
            </SpotlightCard>

            {/* Planner Dashboard Button */}
            <SpotlightCard
              color="56, 189, 248"
              onClick={() => onNavigate('planner-dashboard')}
              className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20"
            >
              <div className="p-6 flex items-start gap-4">
                <div className="w-14 h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">📅</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-200 transition-colors">
                    Planner Dashboard
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Weekly pacing &amp; daily session queue from the Firestore planning engine
                  </p>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
              </div>
            </SpotlightCard>

            {/* Analytics Dashboard Button */}
            <SpotlightCard
              color="139, 92, 246"
              onClick={() => onNavigate('analytics-dashboard')}
              className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20"
            >
              <div className="p-6 flex items-start gap-4">
                <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-200 transition-colors">
                    Analytics Dashboard
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Real-time performance metrics, velocity, score trends &amp; engagement
                  </p>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
              </div>
            </SpotlightCard>
          </div>

          {/* Developer Tools Section */}
          <div className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
              <span className="text-slate-500 text-xs font-mono uppercase tracking-widest">Developer Tools</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                { panel: 'media-player-tester', icon: '🎬', title: 'Media Player Tester', desc: 'Test audio-visual lesson generation with AI narration and images', color: '139, 92, 246', cardClass: 'bg-gradient-to-br from-purple-900/20 to-violet-900/20', iconClass: 'bg-purple-500/20', hoverTitle: 'group-hover:text-purple-200', hoverArrow: 'group-hover:text-purple-400' },
                { panel: 'knowledge-check-tester', icon: '📝', title: 'Knowledge Check Tester', desc: 'Test AI-generated assessment problems across multiple formats', color: '59, 130, 246', cardClass: 'bg-gradient-to-br from-blue-900/20 to-cyan-900/20', iconClass: 'bg-blue-500/20', hoverTitle: 'group-hover:text-blue-200', hoverArrow: 'group-hover:text-blue-400' },
                { panel: 'math-primitives-tester', icon: '🧮', title: 'Math Primitives Tester', desc: 'Test and configure visual math components like fraction bars and place value charts', color: '236, 72, 153', cardClass: 'bg-gradient-to-br from-pink-900/20 to-rose-900/20', iconClass: 'bg-pink-500/20', hoverTitle: 'group-hover:text-pink-200', hoverArrow: 'group-hover:text-pink-400' },
                { panel: 'engineering-primitives-tester', icon: '⚙️', title: 'Engineering Primitives Tester', desc: 'Test lever labs, pulley systems, and other simple machine components', color: '249, 115, 22', cardClass: 'bg-gradient-to-br from-orange-900/20 to-red-900/20', iconClass: 'bg-orange-500/20', hoverTitle: 'group-hover:text-orange-200', hoverArrow: 'group-hover:text-orange-400' },
                { panel: 'astronomy-primitives-tester', icon: '🪐', title: 'Astronomy Primitives Tester', desc: 'Explore the solar system with interactive astronomy visualizations', color: '59, 130, 246', cardClass: 'bg-gradient-to-br from-blue-900/20 to-indigo-900/20', iconClass: 'bg-blue-500/20', hoverTitle: 'group-hover:text-blue-200', hoverArrow: 'group-hover:text-blue-400' },
                { panel: 'physics-primitives-tester', icon: '⚛️', title: 'Physics Primitives Tester', desc: 'Visualize motion, forces, and energy with interactive physics diagrams', color: '99, 102, 241', cardClass: 'bg-gradient-to-br from-indigo-900/20 to-violet-900/20', iconClass: 'bg-indigo-500/20', hoverTitle: 'group-hover:text-indigo-200', hoverArrow: 'group-hover:text-indigo-400' },
                { panel: 'feature-exhibit-tester', icon: '📰', title: 'Feature Exhibit Tester', desc: 'Test deep-dive editorial content with 3-phase comprehension evaluation', color: '14, 165, 233', cardClass: 'bg-gradient-to-br from-sky-900/20 to-blue-900/20', iconClass: 'bg-sky-500/20', hoverTitle: 'group-hover:text-sky-200', hoverArrow: 'group-hover:text-sky-400' },
                { panel: 'biology-primitives-tester', icon: '🧬', title: 'Biology Primitives Tester', desc: 'Test organism cards and species profiles with detailed biological information', color: '34, 197, 94', cardClass: 'bg-gradient-to-br from-green-900/20 to-emerald-900/20', iconClass: 'bg-green-500/20', hoverTitle: 'group-hover:text-green-200', hoverArrow: 'group-hover:text-green-400' },
                { panel: 'chemistry-primitives-tester', icon: '🧪', title: 'Chemistry Primitives Tester', desc: 'Test reaction labs, equation balancers, pH explorers, and other chemistry components', color: '16, 185, 129', cardClass: 'bg-gradient-to-br from-emerald-900/20 to-teal-900/20', iconClass: 'bg-emerald-500/20', hoverTitle: 'group-hover:text-emerald-200', hoverArrow: 'group-hover:text-emerald-400' },
                { panel: 'language-arts-tester', icon: '📚', title: 'Language Arts Tester', desc: 'Test K-6 ELA primitives: paragraph architect, story map, sentence builder, listen & respond', color: '244, 114, 182', cardClass: 'bg-gradient-to-br from-pink-900/20 to-fuchsia-900/20', iconClass: 'bg-pink-500/20', hoverTitle: 'group-hover:text-pink-200', hoverArrow: 'group-hover:text-pink-400' },
                { panel: 'lumina-tutor-tester', icon: '🤖', title: 'Lumina Tutor Tester', desc: 'Test AI tutoring scaffolding: inspect catalog metadata, verify WebSocket connection, test hints', color: '129, 140, 248', cardClass: 'bg-gradient-to-br from-indigo-900/20 to-violet-900/20', iconClass: 'bg-indigo-500/20', hoverTitle: 'group-hover:text-indigo-200', hoverArrow: 'group-hover:text-indigo-400' },
                { panel: 'calibration-simulator', icon: '📈', title: 'IRT Calibration Simulator', desc: 'Simulate theta/EL trajectories: pick primitives, set scores, watch ability evolve across difficulty modes', color: '251, 146, 60', cardClass: 'bg-gradient-to-br from-orange-900/20 to-amber-900/20', iconClass: 'bg-orange-500/20', hoverTitle: 'group-hover:text-orange-200', hoverArrow: 'group-hover:text-orange-400' },
              ] as const).map(({ panel, icon, title, desc, color, cardClass, iconClass, hoverTitle, hoverArrow }) => (
                <SpotlightCard
                  key={panel}
                  color={color}
                  onClick={() => onNavigate(panel)}
                  className={cardClass}
                >
                  <div className="p-6 flex items-start gap-4">
                    <div className={`w-12 h-12 ${iconClass} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <span className="text-2xl">{icon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-lg font-bold text-white mb-1 ${hoverTitle} transition-colors`}>
                        {title}
                      </h3>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {desc}
                      </p>
                    </div>
                    <svg className={`w-5 h-5 text-slate-600 ${hoverArrow} transition-all group-hover:translate-x-1 flex-shrink-0 mt-1`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                    </svg>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdleScreen;
