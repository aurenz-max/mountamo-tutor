'use client';

import React, { type ComponentType } from 'react';
import { useStudent } from '../contexts/StudentContext';
import type { GradeLevel } from './GradeLevelSelector';
import { ManifestViewer } from './ManifestViewer';
import { KnowledgeCheckTester } from './KnowledgeCheckTester';
import { MediaPlayerTester } from './MediaPlayerTester';
import { MathPrimitivesTester } from './MathPrimitivesTester';
import { EngineeringPrimitivesTester } from './EngineeringPrimitivesTester';
import AstronomyPrimitivesTester from './AstronomyPrimitivesTester';
import { PhysicsPrimitivesTester } from './PhysicsPrimitivesTester';
import { FeatureExhibitTester } from './FeatureExhibitTester';
import DeepDiveTester from './DeepDiveTester';
import PassageStudioTester from './PassageStudioTester';
import BiologyPrimitivesTester from './BiologyPrimitivesTester';
import ChemistryPrimitivesTester from './ChemistryPrimitivesTester';
import LanguageArtsPrimitivesTester from './LanguageArtsPrimitivesTester';
import AnnotatedExampleTester from './AnnotatedExampleTester';
import PracticeProblemTester from './PracticeProblemTester';
import DistributionExplorerTester from './DistributionExplorerTester';
import LuminaTutorTester from './LuminaTutorTester';
import StudentActivityPanel from './StudentActivityPanel';
import MyProgressPanel from './MyProgressPanel';
import CalibrationSimulator from './CalibrationSimulator';
import AtomRegistry from './AtomRegistry';
import SoundLab from './SoundLab';
import BlendJudgeLab from './BlendJudgeLab';
import DesignStudio from './DesignStudio';
import { PlannerDashboard } from './PlannerDashboard';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { VisualPrimitivesGallery } from './VisualPrimitivesGallery';
import { ScratchPad } from './scratch-pad';
import { PulseAdaptiveSession } from '../pulse/PulseAdaptiveSession';

interface DevPanelProps {
  onBack: () => void;
}

// Dev tooling panels that take only an onBack handler. Adding a new tester is
// a one-line entry here; App.tsx stays untouched.
const PANELS: Record<string, ComponentType<DevPanelProps>> = {
  'knowledge-check-tester': KnowledgeCheckTester,
  'media-player-tester': MediaPlayerTester,
  'math-primitives-tester': MathPrimitivesTester,
  'engineering-primitives-tester': EngineeringPrimitivesTester,
  'astronomy-primitives-tester': AstronomyPrimitivesTester,
  'physics-primitives-tester': PhysicsPrimitivesTester,
  'feature-exhibit-tester': FeatureExhibitTester,
  'deep-dive-tester': DeepDiveTester,
  'passage-studio-tester': PassageStudioTester,
  'biology-primitives-tester': BiologyPrimitivesTester,
  'chemistry-primitives-tester': ChemistryPrimitivesTester,
  'language-arts-tester': LanguageArtsPrimitivesTester,
  'annotated-example-tester': AnnotatedExampleTester,
  'practice-problem-tester': PracticeProblemTester,
  'distribution-explorer-tester': DistributionExplorerTester,
  'calibration-simulator': CalibrationSimulator,
  'sound-lab': SoundLab,
  'blend-judge-lab': BlendJudgeLab,
  'design-studio': DesignStudio,
  'lumina-tutor-tester': LuminaTutorTester,
  'student-activity-panel': StudentActivityPanel,
  'planner-dashboard': PlannerDashboard,
  'analytics-dashboard': AnalyticsDashboard,
  'visual-tester': VisualPrimitivesGallery,
};

interface DevPanelRouterProps {
  activePanel: string;
  gradeLevel: GradeLevel;
  practiceTopic: string;
  onBack: () => void;
  onNavigate: (panel: string) => void;
}

/**
 * Routes every dev-tool / tester panel. The student-facing flow
 * (idle → generating → lesson → break → daily session) stays in App.tsx.
 */
export const DevPanelRouter: React.FC<DevPanelRouterProps> = ({
  activePanel,
  gradeLevel,
  practiceTopic,
  onBack,
  onNavigate,
}) => {
  const { studentId, ready } = useStudent();

  // Panels with bespoke props

  // Student-facing progress view — the header user menu's "My activity".
  // The curriculum-map hero (same screen as the home page) + the student's
  // activity, auto-scoped to the signed-in student.
  if (activePanel === 'my-activity') {
    // Identity still resolving (profile fetch in flight) — mounting now would
    // fetch and cache the fallback student's (403'd) data under the panel's
    // load-once guards, so wait for the real id instead.
    if (!ready) {
      return (
        <div className="flex-1 flex items-center justify-center pt-24">
          <span className="text-sm text-slate-400 animate-pulse">Loading your profile…</span>
        </div>
      );
    }
    return (
      <div className="flex-1 animate-fade-in">
        <MyProgressPanel studentId={Number(studentId)} onBack={onBack} />
      </div>
    );
  }

  if (activePanel === 'atom-registry') {
    return <AtomRegistry onBack={onBack} onOpenTester={onNavigate} />;
  }

  if (activePanel === 'practice-mode') {
    return (
      <div className="flex-1 animate-fade-in">
        <PulseAdaptiveSession
          onBack={onBack}
          gradeLevel={gradeLevel}
          initialTopic={practiceTopic}
          autoStart={!!practiceTopic}
          debugMode={process.env.NODE_ENV === 'development'}
        />
      </div>
    );
  }

  if (activePanel === 'scratch-pad') {
    return (
      <div className="flex-1 animate-fade-in">
        <ScratchPad onBack={onBack} gradeLevel={gradeLevel} />
      </div>
    );
  }

  if (activePanel === 'manifest-viewer') {
    return (
      <div className="flex-1 animate-fade-in">
        <div className="mb-8 text-center">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            Back to Home
          </button>
        </div>
        <ManifestViewer manifest={null} isLoading={false} />
      </div>
    );
  }

  const Panel = PANELS[activePanel];
  if (!Panel) return null;

  return (
    <div className="flex-1 animate-fade-in">
      <Panel onBack={onBack} />
    </div>
  );
};
