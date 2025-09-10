import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, Eye, Headphones, FileText, CheckCircle, Circle, 
  ArrowLeft, PanelRightClose, PanelRightOpen
} from 'lucide-react';
import Link from 'next/link';

// Import your existing hooks and services
import { usePackageDetail } from '@/lib/packages/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useAICoach } from '@/contexts/AICoachContext';

// Import the content components and AI coach
import { ReadingContent } from './ReadingContent';
import { VisualContent } from './VisualContent';
import { VisualExplorerContent } from './VisualExplorerContent';
import { AudioContent } from './AudioContent';
import { PracticeContent } from './PracticeContent';
import { SessionGoalsModal } from './SessionGoalsModal';
import PackageLearningAICoach from './PackageLearningAICoach';


interface EnhancedLearningSessionProps {
  packageId: string;
  studentId?: number;
}

export function EnhancedLearningSession({ packageId, studentId }: EnhancedLearningSessionProps) {
  // Auth context
  const { user, userProfile, loading: authLoading } = useAuth();
  
  // AI Coach context
  const { isAIConnected } = useAICoach();
  
  // Package data from your API
  const { package: pkg, loading: packageLoading, error: packageError } = usePackageDetail(packageId);
  
  // UI State
  const [activeTab, setActiveTab] = useState('reading');
  const [resourcePanelOpen, setResourcePanelOpen] = useState(true);
  const [completedObjectives, setCompletedObjectives] = useState<number[]>([]);
  const [completedSections, setCompletedSections] = useState<Record<string, boolean>>({});
  const [currentSectionContext, setCurrentSectionContext] = useState<string>('reading');
  
  // Session Goals Modal State
  const [isSessionStarted, setIsSessionStarted] = useState(
    () => sessionStorage.getItem(`session_started_${packageId}`) === 'true'
  );
  
  // AI Coach ref for passing context updates
  const aiCoachRef = useRef<any>(null);

  // Handle objective completion from AI coach
  const handleObjectiveComplete = (objectiveIndex: number) => {
    setCompletedObjectives(prev => {
      if (!prev.includes(objectiveIndex)) {
        return [...prev, objectiveIndex];
      }
      return prev;
    });
  };

  // Update AI coach with current section context
  const updateAICoachContext = useCallback((section: string, additionalContext?: any) => {
    setCurrentSectionContext(section);
    
    if (aiCoachRef.current && pkg) {
      const updatedContext = {
        packageId,
        packageTitle: pkg.content.reading.title,
        subject: pkg.subject,
        skill: pkg.skill,
        subskill: pkg.subskill,
        learningObjectives: pkg.master_context.learning_objectives,
        currentSection: section,
        totalSections: Object.keys(pkg.content).length,
        ...additionalContext
      };
      
      // Update the AI coach context
      aiCoachRef.current.updateContext?.(updatedContext);
    }
  }, [packageId, pkg]);

  const markComplete = (section: string) => {
    setCompletedSections(prev => ({
      ...prev,
      [section]: true
    }));
    
    // Update AI coach that this section was completed
    updateAICoachContext(section, { sectionCompleted: true });
  };

  const handleStartSession = () => {
    sessionStorage.setItem(`session_started_${packageId}`, 'true');
    setIsSessionStarted(true);
    
    // Initialize AI coach context when session starts
    if (pkg) {
      updateAICoachContext('reading');
    }
  };

  // Calculate total estimated time
  const totalEstimatedTime = React.useMemo(() => {
    if (!pkg) return 0;
    
    const readingTime = Math.ceil(pkg.content.reading.word_count / 200); // Assumes avg. 200 WPM
    const audioTime = Math.ceil((pkg.content.audio?.duration_seconds || 0) / 60);
    const practiceTime = pkg.content.practice?.estimated_time_minutes || 0;
    
    return readingTime + audioTime + practiceTime;
  }, [pkg]);

  // Update AI coach context when package data loads
  useEffect(() => {
    if (pkg && isSessionStarted) {
      updateAICoachContext(currentSectionContext);
    }
  }, [pkg, isSessionStarted, currentSectionContext, updateAICoachContext]);

  // Update AI coach context when tab changes
  useEffect(() => {
    if (pkg && isSessionStarted) {
      updateAICoachContext(activeTab);
    }
  }, [activeTab, pkg, isSessionStarted, updateAICoachContext]);


  if (packageLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading learning session...</p>
        </div>
      </div>
    );
  }

  if (packageError || !pkg) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">Unable to Start Session</h2>
            <p className="text-muted-foreground mb-4">
              {packageError || 'Package not found'}
            </p>
            <Link href={`/packages/${packageId}`}>
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Package
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show session goals modal if session hasn't started
  if (!isSessionStarted) {
    return (
      <SessionGoalsModal
        title={pkg.content.reading.title}
        learningObjectives={pkg.master_context.learning_objectives}
        estimatedTime={totalEstimatedTime}
        onStartSession={handleStartSession}
      />
    );
  }

  const progressPercentage = pkg.master_context.learning_objectives.length > 0 
    ? (completedObjectives.length / pkg.master_context.learning_objectives.length) * 100 
    : 0;

  // Define available tabs based on content
  const tabs = [
    { id: 'reading', label: 'Read', icon: BookOpen, color: 'blue' },
    ...(pkg.content.visuals && pkg.content.visuals.length > 0 
      ? [{ id: 'explore', label: 'Explore', icon: Eye, color: 'purple' }] 
      : []),
    ...(pkg.content.audio ? [{ id: 'audio', label: 'Listen', icon: Headphones, color: 'green' }] : []),
    ...(pkg.content.practice ? [{ id: 'practice', label: 'Practice', icon: FileText, color: 'orange' }] : [])
  ];

  const renderContent = () => {

    switch (activeTab) {
      case 'reading':
        return (
          <ReadingContent
            content={pkg.content.reading}
            isCompleted={completedSections.reading || false}
            onComplete={() => markComplete('reading')}
            onAskAI={(message) => {
              // Update context first
              updateAICoachContext('reading', { 
                userQuestion: message, 
                contentType: 'reading',
                contentTitle: pkg.content.reading.title 
              });
              // Send message to AI coach
              aiCoachRef.current?.sendContextualHelp?.(message);
            }}
            subskillId={pkg.subskill_id}
          />
        );

      case 'explore':
        if (!pkg.content.visuals || pkg.content.visuals.length === 0) return null;
        return (
          <VisualExplorerContent
            visuals={pkg.content.visuals}
            onAskAI={(message) => {
              updateAICoachContext('explore', { 
                userQuestion: message, 
                contentType: 'visual',
                visualCount: pkg.content.visuals.length 
              });
              aiCoachRef.current?.sendContextualHelp?.(message);
            }}
          />
        );

      case 'audio':
        if (!pkg.content.audio) return null;
        return (
          <AudioContent
            content={pkg.content.audio}
            isCompleted={completedSections.audio || false}
            onComplete={() => markComplete('audio')}
            onAskAI={(message) => {
              updateAICoachContext('audio', { 
                userQuestion: message, 
                contentType: 'audio',
                audioDuration: pkg.content.audio.duration_seconds 
              });
              aiCoachRef.current?.sendContextualHelp?.(message);
            }}
          />
        );

      case 'practice':
        if (!pkg.content.practice) return null;
        return (
          <PracticeContent
            content={pkg.content.practice}
            isCompleted={completedSections.practice || false}
            onComplete={() => markComplete('practice')}
            onAskAI={(message) => {
              updateAICoachContext('practice', { 
                userQuestion: message, 
                contentType: 'practice',
                problemCount: pkg.content.practice.problems?.length || 0 
              });
              aiCoachRef.current?.sendContextualHelp?.(message);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{pkg.content.reading.title}</h1>
              <p className="text-sm text-muted-foreground">Enhanced Learning Session</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 ${isAIConnected ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${isAIConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{isAIConnected ? 'AI Connected' : 'Disconnected'}</span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResourcePanelOpen(!resourcePanelOpen)}
              >
                {resourcePanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Learning Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedObjectives.length} of {pkg.master_context.learning_objectives.length} objectives
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content Area */}
        <div className={`flex flex-col ${resourcePanelOpen ? 'flex-1' : 'w-full'} min-w-0`}>
          {/* Content Tabs */}
          <div className="bg-white border-b px-6 py-2">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center space-x-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isCompleted = completedSections[tab.id];
                  
                  return (
                    <Button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <div className="relative">
                        <Icon className="w-4 h-4" />
                        {isCompleted && (
                          <CheckCircle className="w-3 h-3 text-green-500 absolute -top-1 -right-1" />
                        )}
                      </div>
                      {tab.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-6 py-8">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* PackageLearningAICoach Sidebar */}
        {resourcePanelOpen && (
          <div className="w-96">
            <PackageLearningAICoach
              ref={aiCoachRef}
              packageId={packageId}
              studentId={studentId || userProfile?.student_id}
              packageContext={{
                packageId,
                packageTitle: pkg.content.reading.title,
                subject: pkg.subject,
                skill: pkg.skill,
                subskill: pkg.subskill,
                learningObjectives: pkg.master_context.learning_objectives,
                currentSection: currentSectionContext,
                totalSections: Object.keys(pkg.content).length
              }}
              onObjectiveComplete={handleObjectiveComplete}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}