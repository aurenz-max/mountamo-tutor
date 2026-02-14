'use client';

import React, { useState, useEffect } from 'react';
import { Target, Lightbulb, Clock, ChevronRight, CheckCircle2, Sparkles, Brain, Compass, Map, ChevronLeft } from 'lucide-react';
import { IntroBriefingData, IntroData } from '../types';

interface CuratorBriefProps {
  data: IntroBriefingData | IntroData;
  className?: string;
}

// Helper function to convert old IntroData to new IntroBriefingData format
const convertToIntroBriefing = (data: IntroData, topic: string = 'Learning Topic'): IntroBriefingData => {
  return {
    primitive: 'intro_briefing',
    topic: topic,
    subject: 'General',
    gradeLevel: 'Elementary',
    estimatedTime: '15-20 minutes',
    hook: {
      type: 'scenario',
      content: data.hook,
      visual: '📚'
    },
    bigIdea: {             
      statement: 'Understanding this concept will help you grow as a learner.',
      whyItMatters: 'This topic connects to many areas of learning and helps build important skills.'
    },
    objectives: data.objectives.map((obj, idx) => ({
      id: `obj${idx + 1}`,
      text: obj,
      verb: 'explain',
      icon: 'message'
    })),
    prerequisites: {
      shouldKnow: ['Basic concepts from previous lessons'],
      quickCheck: {
        question: 'Are you ready to learn something new?',
        answer: 'Yes!',
        hint: 'Think about what you already know.'
      }
    },
    roadmap: [
      {
        phase: 'Explore',
        description: 'Discover the basics',
        activities: ['Introduction', 'Key concepts']
      },
      {
        phase: 'Learn',
        description: 'Understand the details',
        activities: ['Examples', 'Practice']
      },
      {
        phase: 'Apply',
        description: 'Use what you learned',
        activities: ['Activities', 'Quiz']
      }
    ],
    connections: {
      buildingFrom: ['Prior knowledge'],
      leadingTo: ['Future topics'],
      realWorld: ['Everyday applications']
    },
    mindset: {
      encouragement: 'You can learn this! Take your time and enjoy the journey.',
      growthTip: 'Ask questions and explore at your own pace.'
    }
  };
};

// Type guard to check if data is IntroBriefingData
const isIntroBriefingData = (data: IntroBriefingData | IntroData): data is IntroBriefingData => {
  return 'mindset' in data;
};

export const CuratorBrief: React.FC<CuratorBriefProps> = ({ data, className }) => {
  // Debug logging
  console.log('[CuratorBrief] Received data:', data);
  console.log('[CuratorBrief] Is IntroBriefingData?', isIntroBriefingData(data));

  // Convert old format to new format if needed
  const briefingData: IntroBriefingData = isIntroBriefingData(data)
    ? data
    : convertToIntroBriefing(data);
  const [expandedSection, setExpandedSection] = useState('hook');
  const [quickCheckRevealed, setQuickCheckRevealed] = useState(false);
  const [objectivesChecked, setObjectivesChecked] = useState<Record<string, boolean>>({});
  const [currentRoadmapPhase, setCurrentRoadmapPhase] = useState(0);

  const sections = [
    { id: 'hook', label: 'The Hook', icon: Sparkles },
    { id: 'bigIdea', label: 'Big Idea', icon: Lightbulb },
    { id: 'objectives', label: 'What You\'ll Learn', icon: Target },
    { id: 'prerequisites', label: 'Before We Start', icon: Brain },
    { id: 'roadmap', label: 'The Journey', icon: Map },
    { id: 'connections', label: 'Connections', icon: Compass },
  ];

  const toggleObjective = (id: string) => {
    setObjectivesChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Navigation helpers
  const currentSectionIndex = sections.findIndex(s => s.id === expandedSection);
  const canGoPrevious = currentSectionIndex > 0;
  const canGoNext = currentSectionIndex < sections.length - 1;

  const goToPreviousSection = () => {
    if (canGoPrevious) {
      setExpandedSection(sections[currentSectionIndex - 1].id);
    }
  };

  const goToNextSection = () => {
    if (canGoNext) {
      setExpandedSection(sections[currentSectionIndex + 1].id);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPreviousSection();
      } else if (e.key === 'ArrowRight') {
        goToNextSection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSectionIndex]);

  const renderHook = () => (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-xl">
        {/* Ambient glow */}
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full blur-[80px] opacity-20 bg-amber-500" />

        <div className="flex items-start gap-4 relative z-10">
          <span className="text-5xl">{briefingData.hook.visual}</span>
          <div className="flex-1">
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-mono border border-amber-500/30 px-2 py-1 rounded bg-amber-500/10">
              {briefingData.hook.type === 'scenario' && 'Imagine this...'}
              {briefingData.hook.type === 'question' && 'Think about...'}
              {briefingData.hook.type === 'surprising_fact' && 'Did you know?'}
              {briefingData.hook.type === 'story' && 'Story time...'}
            </span>
            <p className="text-white mt-3 text-lg leading-relaxed font-light">
              {briefingData.hook.content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBigIdea = () => (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl border border-white/10 p-8 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-xl">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 bg-purple-500" />

        <div className="relative z-10">
          <Lightbulb className="w-8 h-8 text-purple-400 mb-4" />
          <p className="text-2xl text-white font-light leading-relaxed italic">
            "{briefingData.bigIdea.statement}"
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-white/10 p-6 relative overflow-hidden hover:border-white/20 transition-colors">
        <div className="relative z-10">
          <h4 className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
            Why This Matters
          </h4>
          <p className="text-slate-300 leading-relaxed font-light">
            {briefingData.bigIdea.whyItMatters}
          </p>
        </div>
      </div>
    </div>
  );

  const renderObjectives = () => (
    <div className="space-y-3">
      <p className="text-slate-400 text-sm mb-4 font-light">
        By the end of this lesson, you'll be able to:
      </p>
      {briefingData.objectives.map((obj, idx) => (
        <button
          key={obj.id}
          onClick={() => toggleObjective(obj.id)}
          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 text-left ${
            objectivesChecked[obj.id]
              ? 'glass-panel border-emerald-500/50 shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
          }`}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
            objectivesChecked[obj.id]
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50'
              : 'bg-white/10 text-slate-300 border border-white/20'
          }`}>
            {objectivesChecked[obj.id] ? <CheckCircle2 size={18} /> : idx + 1}
          </div>
          <span className={`flex-1 font-light ${objectivesChecked[obj.id] ? 'text-white' : 'text-slate-200'}`}>
            {obj.text}
          </span>
          <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-mono border ${
            obj.verb === 'identify' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
            obj.verb === 'explain' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
            obj.verb === 'create' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
            obj.verb === 'analyze' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
            obj.verb === 'compare' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
            obj.verb === 'apply' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
            'bg-pink-500/20 text-pink-300 border-pink-500/30'
          }`}>
            {obj.verb}
          </span>
        </button>
      ))}
      <p className="text-slate-500 text-xs mt-2 italic font-light">
        Click objectives to track your progress as you learn
      </p>
    </div>
  );

  const renderPrerequisites = () => (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl border border-white/10 p-6 hover:border-white/20 transition-colors">
        <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-slate-600 rounded-full"></span>
          You should already know:
        </h4>
        <ul className="space-y-3">
          {briefingData.prerequisites.shouldKnow.map((item: string, idx: number) => (
            <li key={idx} className="flex items-center gap-3 text-slate-200 font-light">
              <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden hover:border-white/20 transition-all duration-300 shadow-xl">
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full blur-[80px] opacity-20 bg-cyan-500" />

        <div className="relative z-10">
          <h4 className="text-[10px] uppercase tracking-widest text-cyan-400 font-mono mb-3 flex items-center gap-2">
            <Brain size={14} />
            Quick Check
          </h4>
          <p className="text-white mb-4 font-light leading-relaxed">{briefingData.prerequisites.quickCheck.question}</p>

          {!quickCheckRevealed ? (
            <button
              onClick={() => setQuickCheckRevealed(true)}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium flex items-center gap-2 group"
            >
              Show answer
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <div className="space-y-3 animate-fadeIn">
              <p className="text-emerald-300 font-light flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                {briefingData.prerequisites.quickCheck.answer}
              </p>
              <p className="text-slate-400 text-sm font-light border-l-2 border-amber-500/50 pl-4">
                💡 {briefingData.prerequisites.quickCheck.hint}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderRoadmap = () => (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl border border-white/10 p-4 inline-flex items-center gap-2">
        <Clock size={16} className="text-slate-400" />
        <span className="text-slate-300 text-sm font-mono">
          Estimated time: {briefingData.estimatedTime}
        </span>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden shadow-xl">
        <div className="relative">
          {/* Progress line */}
          <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-white/10" />
          <div
            className="absolute left-4 top-8 w-0.5 bg-gradient-to-b from-emerald-500 to-indigo-500 transition-all duration-500 shadow-lg shadow-emerald-500/50"
            style={{ height: `${(currentRoadmapPhase / (briefingData.roadmap.length - 1)) * 100}%`, maxHeight: 'calc(100% - 4rem)' }}
          />

          <div className="space-y-4">
            {briefingData.roadmap.map((phase: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setCurrentRoadmapPhase(idx)}
                className={`w-full flex items-start gap-4 p-4 rounded-xl transition-all duration-300 text-left ${
                  idx === currentRoadmapPhase
                    ? 'bg-white/10 border border-white/20 shadow-lg'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-all duration-300 ${
                  idx < currentRoadmapPhase
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50'
                    : idx === currentRoadmapPhase
                    ? 'bg-indigo-500 text-white ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/50'
                    : 'bg-white/10 text-slate-400 border border-white/20'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium transition-colors ${
                    idx === currentRoadmapPhase ? 'text-indigo-300' : 'text-slate-200'
                  }`}>
                    {phase.phase}
                  </h4>
                  <p className="text-slate-400 text-sm font-light mt-1">{phase.description}</p>
                  {idx === currentRoadmapPhase && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {phase.activities.map((activity: string, aIdx: number) => (
                        <span
                          key={aIdx}
                          className="text-[10px] px-2 py-1 bg-white/10 text-slate-300 rounded-full border border-white/20 font-mono uppercase tracking-wider"
                        >
                          {activity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderConnections = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="glass-panel rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-20 bg-blue-500" />
        <div className="relative z-10">
          <h4 className="text-[10px] uppercase tracking-widest text-blue-400 font-mono mb-4 flex items-center gap-2">
            <span className="text-lg">←</span> Building From
          </h4>
          <ul className="space-y-3">
            {briefingData.connections.buildingFrom.map((item: string, idx: number) => (
              <li key={idx} className="text-slate-200 text-sm font-light border-l-2 border-blue-500/30 pl-3">{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-20 bg-emerald-500" />
        <div className="relative z-10">
          <h4 className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono mb-4 flex items-center gap-2">
            <span className="text-lg">→</span> Leading To
          </h4>
          <ul className="space-y-3">
            {briefingData.connections.leadingTo.map((item: string, idx: number) => (
              <li key={idx} className="text-slate-200 text-sm font-light border-l-2 border-emerald-500/30 pl-3">{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-20 bg-amber-500" />
        <div className="relative z-10">
          <h4 className="text-[10px] uppercase tracking-widest text-amber-400 font-mono mb-4 flex items-center gap-2">
            <span className="text-lg">🌍</span> Real World
          </h4>
          <ul className="space-y-3">
            {briefingData.connections.realWorld.map((item: string, idx: number) => (
              <li key={idx} className="text-slate-200 text-sm font-light border-l-2 border-amber-500/30 pl-3">{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const sectionContent: Record<string, () => JSX.Element> = {
    hook: renderHook,
    bigIdea: renderBigIdea,
    objectives: renderObjectives,
    prerequisites: renderPrerequisites,
    roadmap: renderRoadmap,
    connections: renderConnections,
  };

  return (
    <div className={`w-full text-slate-100 ${className || ''}`}>
      <div className="max-w-5xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background glow for entire card */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[150px] opacity-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500" />

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-8 glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden group hover:border-white/30 transition-colors shadow-xl">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[120px] opacity-20 bg-indigo-500" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest border border-white/10 px-2 py-1 rounded">
                  {briefingData.subject}
                </span>
                <span className="text-xs font-mono text-slate-400">•</span>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                  {briefingData.gradeLevel}
                </span>
                <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-4xl font-light text-white mb-4 tracking-tight">
                {briefingData.topic}
              </h1>
              <p className="text-sm text-slate-400 flex items-center gap-2 font-mono">
                <Clock size={14} />
                {briefingData.estimatedTime}
              </p>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setExpandedSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    expandedSection === section.id
                      ? 'glass-panel border border-white/30 text-white shadow-lg scale-105'
                      : 'bg-white/5 border border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <Icon size={16} />
                  {section.label}
                </button>
              );
            })}
          </div>

          {/* Content with navigation arrows */}
          <div className="mb-8 relative">
            {/* Navigation Arrows */}
            <button
              onClick={goToPreviousSection}
              disabled={!canGoPrevious}
              className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 z-20 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                canGoPrevious
                  ? 'glass-panel border border-white/20 text-white hover:border-white/40 hover:scale-110 shadow-xl'
                  : 'bg-white/5 border border-white/5 text-slate-600 cursor-not-allowed opacity-50'
              }`}
              aria-label="Previous section"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              onClick={goToNextSection}
              disabled={!canGoNext}
              className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 z-20 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                canGoNext
                  ? 'glass-panel border border-white/20 text-white hover:border-white/40 hover:scale-110 shadow-xl'
                  : 'bg-white/5 border border-white/5 text-slate-600 cursor-not-allowed opacity-50'
              }`}
              aria-label="Next section"
            >
              <ChevronRight size={24} />
            </button>

            {/* Content area */}
            <div className="transition-opacity duration-300">
              {sectionContent[expandedSection]()}
            </div>

            {/* Keyboard hint */}
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500 font-mono">
                Use ← → arrow keys or buttons to navigate
              </p>
            </div>
          </div>

          {/* Mindset footer */}
          <div className="glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl mb-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-indigo-500" />
            <div className="flex items-start gap-4 relative z-10">
              <span className="text-3xl">💪</span>
              <div className="flex-1">
                <p className="text-white font-light leading-relaxed mb-3">{briefingData.mindset.encouragement}</p>
                <p className="text-slate-400 text-sm">
                  <span className="text-amber-400 font-medium">Pro tip:</span> {briefingData.mindset.growthTip}
                </p>
              </div>
            </div>
          </div>

          {/* Ready button */}
          <div className="text-center">
            <button
              onClick={canGoNext ? goToNextSection : undefined}
              className="px-10 py-4 bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all duration-300 inline-flex items-center gap-3 shadow-xl hover:shadow-2xl hover:scale-105 border border-white/10"
            >
              {canGoNext ? 'Next Step' : "I'm Ready to Start!"}
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CuratorBrief;
