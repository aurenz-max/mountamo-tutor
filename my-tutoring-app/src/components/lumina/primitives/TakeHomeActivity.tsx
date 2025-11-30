import React, { useState } from 'react';
import { Printer, Clock, Package, CheckCircle2, Circle, ChevronDown, ChevronUp, Lightbulb, Camera, MessageSquare, AlertTriangle, Sparkles, BookOpen } from 'lucide-react';
import { TakeHomeActivityData } from '../types';

interface TakeHomeActivityProps {
  data: TakeHomeActivityData;
  className?: string;
}

const TakeHomeActivity: React.FC<TakeHomeActivityProps> = ({ data, className }) => {
  const [completedSteps, setCompletedSteps] = useState(new Set<number>());
  const [expandedSteps, setExpandedSteps] = useState(new Set([1]));
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  const [reflectionAnswers, setReflectionAnswers] = useState<Record<number, string>>({});
  const [showReflections, setShowReflections] = useState(false);

  const handlePrint = () => {
    // Expand all sections for printing
    const allStepNumbers = data.steps.map(s => s.stepNumber);
    setExpandedSteps(new Set(allStepNumbers));
    setShowAllMaterials(true);
    setShowReflections(true);

    // Wait for state updates to render, then print
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const toggleStep = (stepNum: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepNum)) {
      newExpanded.delete(stepNum);
    } else {
      newExpanded.add(stepNum);
    }
    setExpandedSteps(newExpanded);
  };

  const toggleStepComplete = (stepNum: number) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepNum)) {
      newCompleted.delete(stepNum);
    } else {
      newCompleted.add(stepNum);
      // Auto-expand next step
      if (stepNum < data.steps.length) {
        setExpandedSteps(new Set([...expandedSteps, stepNum + 1]));
      }
    }
    setCompletedSteps(newCompleted);
  };

  const progress = (completedSteps.size / data.steps.length) * 100;
  const essentialMaterials = data.materials.filter(m => m.essential);
  const optionalMaterials = data.materials.filter(m => !m.essential);

  return (
    <div className={`w-full text-slate-100 ${className || ''}`}>
      <div className="max-w-3xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background glow for entire card */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[150px] opacity-10 bg-gradient-to-br from-amber-500 via-emerald-500 to-indigo-500" />

        <div className="relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2">
                <Package size={16} />
                <span>Take Home Activity</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{data.subject}</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-50 mb-2">{data.title}</h1>
              <p className="text-slate-400">{data.topic}</p>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 glass-panel border border-white/10 hover:border-white/30 rounded-xl text-sm transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Printer size={16} />
              Print
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock size={16} />
              <span>{data.estimatedTime}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <BookOpen size={16} />
              <span>Grades {data.gradeRange}</span>
            </div>
          </div>
        </div>

        {/* Overview */}
        <div className="glass-panel rounded-2xl p-6 mb-6 border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-xl">
          <p className="text-slate-300 leading-relaxed">{data.overview}</p>
        </div>

        {/* Learning Objectives */}
        <div className="glass-panel rounded-2xl p-6 mb-6 border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200 mb-3">
            <Sparkles size={18} className="text-amber-400" />
            What You'll Learn
          </h2>
          <ul className="space-y-2">
            {data.learningObjectives.map((objective, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-300">
                <span className="text-amber-400 mt-1">•</span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Materials */}
        <div className="glass-panel rounded-2xl p-6 mb-6 border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200 mb-4">
            <Package size={18} className="text-emerald-400" />
            Materials Needed
          </h2>

          <div className="space-y-3">
            {essentialMaterials.map((material, idx) => (
              <div key={idx} className="flex items-start justify-between py-2 border-b border-white/10 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200">{material.item}</span>
                    <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded">Required</span>
                  </div>
                  {material.substitutes && material.substitutes.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Substitutes: {material.substitutes.join(', ')}
                    </p>
                  )}
                  {material.examples && (
                    <p className="text-xs text-slate-500 mt-1">
                      Examples: {material.examples.join(', ')}
                    </p>
                  )}
                </div>
                <span className="text-slate-400 text-sm">{material.quantity}</span>
              </div>
            ))}
          </div>

          {optionalMaterials.length > 0 && (
            <>
              <button
                onClick={() => setShowAllMaterials(!showAllMaterials)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 mt-4 transition-colors"
              >
                {showAllMaterials ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showAllMaterials ? 'Hide' : 'Show'} optional materials ({optionalMaterials.length})
              </button>

              {showAllMaterials && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                  {optionalMaterials.map((material, idx) => (
                    <div key={idx} className="flex items-start justify-between py-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">{material.item}</span>
                          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Optional</span>
                        </div>
                      </div>
                      <span className="text-slate-500 text-sm">{material.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Safety Notes */}
        {data.safetyNotes && data.safetyNotes.length > 0 && (
          <div className="bg-amber-950/30 rounded-xl p-5 mb-6 border border-amber-900/50">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-400 mb-3">
              <AlertTriangle size={18} />
              Safety Notes
            </h2>
            <ul className="space-y-2">
              {data.safetyNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-3 text-amber-200/80">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Progress</span>
            <span className="text-sm text-slate-400">{completedSteps.size} of {data.steps.length} steps</span>
          </div>
          <div className="h-2 glass-panel border border-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 shadow-lg shadow-emerald-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-slate-200">Instructions</h2>

          {data.steps.map((step) => {
            const isCompleted = completedSteps.has(step.stepNumber);
            const isExpanded = expandedSteps.has(step.stepNumber);

            return (
              <div
                key={step.stepNumber}
                className={`rounded-2xl border transition-all duration-300 shadow-lg ${
                  isCompleted
                    ? 'glass-panel border-emerald-500/50'
                    : 'glass-panel border-white/10 hover:border-white/20'
                }`}
              >
                <button
                  onClick={() => toggleStep(step.stepNumber)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleStepComplete(step.stepNumber); }}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={18} /> : <span>{step.stepNumber}</span>}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-medium ${isCompleted ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {step.title}
                    </h3>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pl-16">
                    <p className="text-slate-300 mb-4">{step.instruction}</p>

                    {step.tip && (
                      <div className="flex items-start gap-2 text-sm text-sky-400 bg-sky-950/30 rounded-lg p-3 mb-3">
                        <Lightbulb size={16} className="flex-shrink-0 mt-0.5" />
                        <span>{step.tip}</span>
                      </div>
                    )}

                    {step.scienceNote && (
                      <div className="flex items-start gap-2 text-sm text-violet-400 bg-violet-950/30 rounded-lg p-3 mb-3">
                        <Sparkles size={16} className="flex-shrink-0 mt-0.5" />
                        <span><strong>Science:</strong> {step.scienceNote}</span>
                      </div>
                    )}

                    {step.checkpoint && (
                      <div className="mt-4 p-4 glass-panel rounded-xl border border-white/10">
                        <p className="text-sm font-medium text-slate-300 mb-3">
                          ✓ Checkpoint: {step.checkpoint.question}
                        </p>
                        <button
                          onClick={() => toggleStepComplete(step.stepNumber)}
                          className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {isCompleted ? 'Completed ✓' : 'Mark Complete'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Completion Celebration */}
        {completedSteps.size === data.steps.length && (
          <div className="glass-panel rounded-2xl p-8 mb-8 border border-emerald-500/30 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-purple-500/20" />
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-30 bg-emerald-500" />
            <div className="relative z-10">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-xl font-bold text-emerald-400 mb-2">Amazing Work!</h3>
              <p className="text-slate-300">You've completed all the steps. Time to reflect on what you learned!</p>
            </div>
          </div>
        )}

        {/* Reflection Section */}
        <div className="glass-panel rounded-2xl p-6 mb-6 border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-xl">
          <button
            onClick={() => setShowReflections(!showReflections)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
              <MessageSquare size={18} className="text-violet-400" />
              Reflection Questions
            </h2>
            {showReflections ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
          </button>

          {showReflections && (
            <div className="mt-4 space-y-6">
              {data.reflectionPrompts.map((prompt, idx) => (
                <div key={idx} className="space-y-2">
                  <p className="text-slate-200 font-medium">{idx + 1}. {prompt.question}</p>
                  {prompt.hint && (
                    <p className="text-sm text-slate-500 italic">Hint: {prompt.hint}</p>
                  )}
                  <textarea
                    className="w-full glass-panel border border-white/10 rounded-lg p-3 text-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                    rows={3}
                    placeholder="Write your thoughts here..."
                    value={reflectionAnswers[idx] || ''}
                    onChange={(e) => setReflectionAnswers({ ...reflectionAnswers, [idx]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documentation Prompt */}
        {data.documentationPrompt && (
          <div className="glass-panel rounded-2xl p-6 mb-6 border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-xl">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200 mb-3">
              <Camera size={18} className="text-pink-400" />
              Document Your Work
            </h2>
            <p className="text-slate-300 mb-3">{data.documentationPrompt.instruction}</p>
            <div className="glass-panel rounded-lg p-3 border border-white/10">
              <p className="text-sm text-slate-400 italic">
                Suggested caption: "{data.documentationPrompt.suggestedCaption}"
              </p>
            </div>
          </div>
        )}

        {/* Extensions */}
        {data.extensions && data.extensions.length > 0 && (
          <div className="glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-xl">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200 mb-4">
              <Sparkles size={18} className="text-amber-400" />
              Want More? Try These Extensions
            </h2>
            <div className="space-y-4">
              {data.extensions.map((ext, idx) => (
                <div key={idx} className="p-4 glass-panel rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-slate-200">{ext.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      ext.difficulty === 'advanced'
                        ? 'bg-rose-900/50 text-rose-400'
                        : 'bg-amber-900/50 text-amber-400'
                    }`}>
                      {ext.difficulty}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{ext.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default TakeHomeActivity;
