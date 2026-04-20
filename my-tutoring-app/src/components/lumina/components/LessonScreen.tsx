'use client';

import React from 'react';
import { ExhibitData } from '../types';
import type { GradeLevel } from './GradeLevelSelector';
import type { CurriculumContext } from './CurriculumBrowser';
import type { LessonBlock } from '@/lib/sessionPlanAPI';
import type { GenerateOptions } from '../hooks/useExhibitSession';
import { ManifestOrderRenderer } from './ManifestOrderRenderer';
import { EvaluationProvider } from '../evaluation';
import type { CompetencyUpdateSuggestion } from '../evaluation';
import { EvaluationResultsIndicator } from './EvaluationResultsIndicator';
import { CelebrationLayer } from './CelebrationLayer';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import { LuminaAIProvider, useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { LessonConnectionInfo } from '@/contexts/LuminaAIContext';
import ExhibitCompleteFooter from './ExhibitCompleteFooter';
import { LessonExitConfirmModal } from './LessonExitConfirmModal';
import { useLessonExitGuard } from '../hooks/useLessonExitGuard';

// Bootstraps the lesson-mode AI session when the exhibit mounts.
// Must be rendered inside LuminaAIProvider + ExhibitProvider.
const LessonAIBootstrap: React.FC<{
  exhibit: ExhibitData;
  gradeLevel: string;
}> = ({ exhibit, gradeLevel }) => {
  const aiContext = useLuminaAIContext();
  const hasBootstrappedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasBootstrappedRef.current) return;

    const orderedComponents = exhibit.orderedComponents || [];
    if (orderedComponents.length === 0) return;

    const first = orderedComponents[0];
    const info: LessonConnectionInfo = {
      exhibit_id: exhibit.topic || 'unknown',
      topic: exhibit.topic || 'Learning Activity',
      grade_level: gradeLevel,
      firstPrimitive: {
        primitive_type: first.componentId,
        instance_id: first.instanceId,
        primitive_data: first.data || {},
        exhibit_id: exhibit.topic || 'unknown',
        topic: exhibit.topic,
        grade_level: gradeLevel,
      },
    };

    hasBootstrappedRef.current = true;
    aiContext.connectLesson(info);

    return () => {
      aiContext.disconnect();
      hasBootstrappedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

interface LessonScreenProps {
  exhibit: ExhibitData;
  gradeLevel: GradeLevel;
  curriculumContext: CurriculumContext | null;
  sessionReturn: string | null;
  sessionCurrentBlock: LessonBlock | null;
  sessionEvalCount: number;
  onCompetencyUpdate: (updates: CompetencyUpdateSuggestion[]) => void;
  onDetailItemClick: (item: string) => void;
  onExhibitComplete: () => void;
  onGenerateRelated: (options: GenerateOptions) => void;
  onExitLesson: () => void;
}

export const LessonScreen: React.FC<LessonScreenProps> = ({
  exhibit,
  gradeLevel,
  curriculumContext,
  sessionReturn,
  sessionCurrentBlock,
  sessionEvalCount,
  onCompetencyUpdate,
  onDetailItemClick,
  onExhibitComplete,
  onGenerateRelated,
  onExitLesson,
}) => {
  const { showExitModal, confirmExit, cancelExit } = useLessonExitGuard(true, onExitLesson);

  return (
    <EvaluationProvider
      sessionId={`exhibit-${Date.now()}`}
      exhibitId={exhibit.topic || 'unknown'}
      topic={exhibit.topic}
      gradeLevel={gradeLevel}
      curriculumSubject={curriculumContext?.subject}
      curriculumSkillId={curriculumContext?.skillId}
      curriculumSubskillId={curriculumContext?.subskillId}
      localOnly={false}
      onCompetencyUpdate={onCompetencyUpdate}
    >
      <ExhibitProvider
        objectives={exhibit.introBriefing?.objectives || []}
        manifestItems={exhibit.manifest?.layout || []}
      >
        <LuminaAIProvider>
          <LessonAIBootstrap exhibit={exhibit} gradeLevel={gradeLevel} />
          <div className="w-full animate-fade-in-up">
            <div className="mb-8 text-center">
              <h2 className="text-5xl font-bold text-white tracking-tight">{exhibit.topic}</h2>
            </div>

            <ManifestOrderRenderer
              orderedComponents={exhibit.orderedComponents || []}
              onDetailItemClick={onDetailItemClick}
              onTermClick={onDetailItemClick}
            />

            <EvaluationResultsIndicator />
            <CelebrationLayer />

            {sessionReturn === 'daily-session' && sessionCurrentBlock && (
              <ExhibitCompleteFooter
                block={sessionCurrentBlock}
                evalCount={sessionEvalCount}
                onContinue={onExhibitComplete}
              />
            )}

            {!sessionReturn && exhibit.relatedTopics && exhibit.relatedTopics.length > 0 && (
              <div className="mt-24 mb-12 max-w-5xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                  <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">
                    Related Exhibits
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {exhibit.relatedTopics.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => onGenerateRelated({ topic: item.topic, gradeLevel })}
                      className="group relative p-6 flex flex-col h-full rounded-2xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-white/5 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-2 overflow-hidden text-left"
                    >
                      <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors duration-500"></div>
                      <div className="relative z-10 flex-1">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                            {item.category}
                          </span>
                          <span className="text-xs text-slate-600 font-mono group-hover:text-blue-400 transition-colors">
                            0{i + 1}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-200 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{item.teaser}</p>
                      </div>
                      <div className="relative z-10 mt-4 flex items-center text-xs font-bold text-blue-500/70 uppercase tracking-wider group-hover:text-blue-400 transition-colors">
                        <span>Enter Portal</span>
                        <svg
                          className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {showExitModal && (
            <LessonExitConfirmModal onCancel={cancelExit} onConfirm={confirmExit} />
          )}
        </LuminaAIProvider>
      </ExhibitProvider>
    </EvaluationProvider>
  );
};
