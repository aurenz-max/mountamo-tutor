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
import { useEngagement } from '@/contexts/EngagementContext';
import { authApi } from '@/lib/authApiClient';

// Import primitive completion types
import { 
  PackagePrimitiveCompletions, 
  SectionPrimitiveCompletions, 
  PrimitiveCompletionState,
  SectionCompletionStatus
} from '@/components/content/primitiveCompletionTypes';

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
  
  // Engagement context for XP and level tracking
  const { processEngagementResponse } = useEngagement();
  
  // Package data from your API
  const { package: pkg, loading: packageLoading, error: packageError } = usePackageDetail(packageId);
  
  // UI State
  const [activeTab, setActiveTab] = useState('reading');
  const [resourcePanelOpen, setResourcePanelOpen] = useState(true);
  const [completedObjectives, setCompletedObjectives] = useState<number[]>([]);
  const [completedSections, setCompletedSections] = useState<Record<string, boolean>>({});
  const [currentSectionContext, setCurrentSectionContext] = useState<string>('reading');
  
  // Primitive completion tracking
  const [primitiveCompletions, setPrimitiveCompletions] = useState<PackagePrimitiveCompletions>({});
  const [sectionCompletionStatus, setSectionCompletionStatus] = useState<Record<string, SectionCompletionStatus>>({});
  
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

  // Helper function to count primitives in a section
  const countPrimitivesInSection = (sectionIndex: number): number => {
    if (!pkg?.content.reading.sections?.[sectionIndex]) return 0;
    
    const section = pkg.content.reading.sections[sectionIndex];
    let count = 0;
    
    // Count all interactive primitives that can be completed
    count += section.quizzes?.length || 0;
    count += section.categorization_activities?.length || 0;
    count += section.fill_in_the_blanks?.length || 0;
    count += section.scenario_questions?.length || 0;
    count += section.matching_activities?.length || 0;
    count += section.sequencing_activities?.length || 0;
    
    return count;
  };

  // Check if section should be auto-completed based on primitive completions
  const checkSectionAutoCompletion = async (sectionIndex: number, sectionTitle: string) => {
    const totalPrimitives = countPrimitivesInSection(sectionIndex);
    const sectionCompletions = primitiveCompletions[sectionIndex] || {};
    
    // Count completed primitives
    let completedCount = 0;
    Object.values(sectionCompletions).forEach(primitiveType => {
      Object.values(primitiveType).forEach(primitive => {
        if (primitive.completed) completedCount++;
      });
    });

    // Auto-complete section if all primitives are done
    if (totalPrimitives > 0 && completedCount >= totalPrimitives) {
      const sectionKey = activeTab; // Use current tab as section key
      
      // Don't auto-complete if already manually completed
      if (!completedSections[sectionKey]) {
        markComplete(sectionKey);
      }
    }
  };

  // Handle primitive completion
  const handlePrimitiveComplete = async (sectionIndex: number, primitiveType: string, primitiveIndex: number, score?: number) => {
    try {
      // Update local state first for immediate UI feedback
      const completionState: PrimitiveCompletionState = {
        completed: true,
        score,
        timestamp: new Date()
      };

      setPrimitiveCompletions(prev => {
        const newCompletions = { ...prev };
        if (!newCompletions[sectionIndex]) {
          newCompletions[sectionIndex] = {};
        }
        if (!newCompletions[sectionIndex][primitiveType]) {
          newCompletions[sectionIndex][primitiveType] = {};
        }
        newCompletions[sectionIndex][primitiveType][primitiveIndex] = completionState;
        return newCompletions;
      });

      // Get section title
      const sectionTitle = pkg?.content.reading.sections?.[sectionIndex]?.heading || 
                          `Section ${sectionIndex + 1}`;

      // Call backend API
      const response = await authApi.completePrimitive({
        package_id: packageId,
        section_title: sectionTitle,
        primitive_type: primitiveType,
        primitive_index: primitiveIndex,
        score
      });

      // Process engagement response for XP animations
      if (response && typeof response === 'object' && 'xp_earned' in response) {
        processEngagementResponse(response as any);
      }

      // Check if section should be auto-completed (do this after state update)
      setTimeout(() => checkSectionAutoCompletion(sectionIndex, sectionTitle), 100);

    } catch (error) {
      console.error('Error completing primitive:', error);
      // Optionally revert local state on error
    }
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

  const markComplete = async (section: string) => {
    // Optimistically update UI first
    setCompletedSections(prev => ({
      ...prev,
      [section]: true
    }));
    
    // Update AI coach that this section was completed
    updateAICoachContext(section, { sectionCompleted: true });

    try {
      // Call backend to track completion and get XP
      const response = await authApi.completePackageSection(
        packageId, 
        section, 
        undefined // time spent - could be tracked in future
      );

      // Process engagement response for XP animations and level-ups
      if (response && typeof response === 'object' && 'xp_earned' in response) {
        processEngagementResponse(response as any);
      }

      // Check if all sections are now complete for package completion bonus
      const allSections = ['reading', 'audio', 'practice', 'explore'];
      const availableSections = allSections.filter(sectionId => {
        if (sectionId === 'audio') return pkg?.content.audio;
        if (sectionId === 'practice') return pkg?.content.practice;
        if (sectionId === 'explore') return pkg?.content.visuals && pkg.content.visuals.length > 0;
        return true; // reading is always available
      });

      const newCompletedSections = { ...completedSections, [section]: true };
      const allComplete = availableSections.every(s => newCompletedSections[s]);

      if (allComplete) {
        // Award bonus XP for completing entire package
        try {
          const packageResponse = await authApi.completePackage(
            packageId,
            availableSections.length,
            undefined // total time - could be tracked
          );

          if (packageResponse && typeof packageResponse === 'object' && 'xp_earned' in packageResponse) {
            processEngagementResponse(packageResponse as any);
          }
        } catch (error) {
          console.error('Error completing package:', error);
        }
      }

    } catch (error) {
      console.error('Error completing section:', error);
      // Don't revert UI state - user still completed the section locally
    }
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

  // Calculate primitive completion progress instead of objectives
  const { totalPrimitives, completedPrimitivesCount } = React.useMemo(() => {
    let total = 0;
    let completed = 0;
    
    // Count all primitives across all sections
    pkg?.content.reading.sections?.forEach((section, sectionIndex) => {
      const sectionTotal = countPrimitivesInSection(sectionIndex);
      total += sectionTotal;
      
      // Count completed primitives in this section
      const sectionCompletions = primitiveCompletions[sectionIndex] || {};
      Object.values(sectionCompletions).forEach(primitiveType => {
        Object.values(primitiveType).forEach(primitive => {
          if (primitive.completed) completed++;
        });
      });
    });
    
    return { totalPrimitives: total, completedPrimitivesCount: completed };
  }, [pkg, primitiveCompletions]);

  const progressPercentage = totalPrimitives > 0 
    ? (completedPrimitivesCount / totalPrimitives) * 100 
    : 0;

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
            onPrimitiveComplete={handlePrimitiveComplete}
            primitiveCompletions={primitiveCompletions}
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
            packageId={packageId}
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
              
              {/* Package Completion Indicator */}
              {(() => {
                const allSections = ['reading', 'audio', 'practice', 'explore'];
                const availableSections = allSections.filter(sectionId => {
                  if (sectionId === 'audio') return pkg?.content.audio;
                  if (sectionId === 'practice') return pkg?.content.practice;
                  if (sectionId === 'explore') return pkg?.content.visuals && pkg.content.visuals.length > 0;
                  return true; // reading is always available
                });
                const allComplete = availableSections.every(s => completedSections[s]);
                
                if (allComplete) {
                  return (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">Package Completed! +200 XP Bonus</span>
                    </div>
                  );
                }
                return null;
              })()}
              
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
              {completedPrimitivesCount} of {totalPrimitives} activities completed
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content Area */}
        <div className={`flex flex-col ${resourcePanelOpen ? 'flex-1' : 'w-full'} min-w-0 overflow-hidden`}>
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
          <div className="w-96 flex-shrink-0 overflow-hidden">
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