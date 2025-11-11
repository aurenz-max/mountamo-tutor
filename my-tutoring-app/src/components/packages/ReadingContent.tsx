import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import { useEngagement } from '@/contexts/EngagementContext';
import { ReadingContentRenderer } from '@/components/content/ReadingContentRenderer';

// Updated interface to support interactive primitives - Enhanced with new primitives
interface ReadingSection {
  heading: string;
  content: string;
  key_terms_used: string[];
  concepts_covered: string[];
  // Basic Interactive primitives (optional)
  alerts?: Array<{ type: 'alert'; style: 'info' | 'warning' | 'success' | 'tip'; title: string; content: string; }>;
  expandables?: Array<{ type: 'expandable'; title: string; content: string; }>;
  quizzes?: Array<{ type: 'quiz'; question: string; answer: string; explanation?: string; }>;
  definitions?: Array<{ type: 'definition'; term: string; definition: string; }>;
  checklists?: Array<{ type: 'checklist'; text: string; completed?: boolean; }>;
  tables?: Array<{ type: 'table'; headers: string[]; rows: string[][]; }>;
  keyvalues?: Array<{ type: 'keyvalue'; key: string; value: string; }>;
  // New Enhanced Interactive Primitives
  interactive_timelines?: Array<{ type: 'interactive_timeline'; title: string; events: Array<{date: string; title: string; description: string;}> }>;
  carousels?: Array<{ type: 'carousel'; title?: string; items: Array<{image_url: string; alt_text: string; caption?: string; description?: string;}> }>;
  flip_cards?: Array<{ type: 'flip_card'; front_content: string; back_content: string; }>;
  categorization_activities?: Array<{ type: 'categorization'; instruction: string; categories: string[]; items: Array<{item_text: string; correct_category: string;}> }>;
  fill_in_the_blanks?: Array<{ type: 'fill_in_the_blank'; sentence: string; correct_answer: string; hint?: string; }>;
  scenario_questions?: Array<{ type: 'scenario_question'; scenario: string; question: string; answer_options?: string[]; correct_answer: string; explanation: string; }>;
}

interface ReadingContentProps {
  content: {
    title: string;
    sections: ReadingSection[];
    word_count: number;
    reading_level?: string;
    grade_appropriate_features?: string[];
  };
  isCompleted: boolean;
  onComplete: () => void;
  onPrimitiveComplete?: (sectionIndex: number, primitiveType: string, primitiveIndex: number, score?: number) => void;
  primitiveCompletions?: any; // PackagePrimitiveCompletions from EnhancedLearningSession
  onAskAI: (message: string) => void;
  subskillId?: string; // 🆕 For saving visualizations to Cosmos DB
  packageId?: string; // 🆕 For primitive completion tracking
}

interface DiscoveryThreads {
  [sectionIndex: number]: {
    threads: string[];
    loading: boolean;
    error?: string;
  };
}

export function ReadingContent({ content, isCompleted, onComplete, onPrimitiveComplete, primitiveCompletions, onAskAI, subskillId, packageId }: ReadingContentProps) {
  const [discoveryThreads, setDiscoveryThreads] = useState<DiscoveryThreads>({});
  
  // Engagement tracking
  const { processEngagementResponse } = useEngagement();

  // Track primitive completions
  const handlePrimitiveCompletion = async (
    sectionIndex: number,
    primitiveType: string,
    primitiveIndex: number,
    score?: number
  ) => {
    // If parent component provided completion handler, use that instead
    if (onPrimitiveComplete) {
      onPrimitiveComplete(sectionIndex, primitiveType, primitiveIndex, score);
      return;
    }

    // Fallback to the local implementation for standalone use
    try {
      const section = content.sections[sectionIndex];
      
      // Only track completion if packageId is provided
      if (!packageId) {
        console.warn('No packageId provided for primitive completion tracking');
        return;
      }
      
      const response = await authApi.completePrimitive({
        package_id: packageId,
        section_title: section.heading,
        primitive_type: primitiveType,
        primitive_index: primitiveIndex,
        score: score
      });

      // Process engagement response for XP animations and toast notifications
      if (response && typeof response === 'object' && 'xp_earned' in response) {
        // Format the response to match the expected engagement format
        const engagementResponse = {
          success: true,
          xp_earned: response.xp_earned || 0,
          base_xp: response.base_xp || response.xp_earned || 0,
          streak_bonus_xp: response.streak_bonus_xp || 0,
          total_xp: response.total_xp || 0,
          level_up: response.level_up || false,
          new_level: response.new_level || 1,
          previous_level: response.previous_level || 1,
          current_streak: response.current_streak || 0,
          previous_streak: response.previous_streak || 0,
          points_earned: response.points_earned || response.xp_earned || 0,
          engagement_transaction: response.engagement_transaction || null
        };
        
        processEngagementResponse(engagementResponse);
      }
    } catch (error) {
      console.error('Error completing primitive:', error);
      // Don't block the user experience for tracking errors
    }
  };

  // Generate discovery threads for all sections on mount - with better deduplication
  React.useEffect(() => {
    let isMounted = true;
    
    const generateAllDiscoveryThreads = async () => {
      for (let i = 0; i < content.sections.length; i++) {
        if (!isMounted) break; // Abort if component unmounted
        
        const section = content.sections[i];
        const hasExistingThreads = discoveryThreads[i]?.threads?.length > 0;
        const isCurrentlyLoading = discoveryThreads[i]?.loading;
        
        if (!hasExistingThreads && !isCurrentlyLoading) {
          await fetchDiscoveryThreads(i, section.heading, section.content);
        }
      }
    };

    // Only generate if we have sections and no existing threads
    const hasAnyThreads = Object.values(discoveryThreads).some(d => d?.threads?.length > 0);
    if (content.sections.length > 0 && !hasAnyThreads) {
      generateAllDiscoveryThreads();
    }

    return () => {
      isMounted = false;
    };
  }, [content.sections]);

  const fetchDiscoveryThreads = async (sectionIndex: number, heading: string, sectionContent: string) => {
    // Prevent duplicate requests
    if (discoveryThreads[sectionIndex]?.loading || discoveryThreads[sectionIndex]?.threads?.length > 0) {
      return;
    }

    // Set loading state
    setDiscoveryThreads(prev => ({
      ...prev,
      [sectionIndex]: { 
        threads: prev[sectionIndex]?.threads || [], 
        loading: true 
      }
    }));

    try {
      // Make API call to generate discovery threads using authApi
      const data = await authApi.post('/api/discovery/section/discovery-threads', {
        heading: heading,
        content: sectionContent
      });
      
      // Update state with fetched threads
      setDiscoveryThreads(prev => ({
        ...prev,
        [sectionIndex]: {
          threads: data.discovery_threads || [],
          loading: false
        }
      }));

    } catch (error) {
      console.error('Error fetching discovery threads:', error);
      setDiscoveryThreads(prev => ({
        ...prev,
        [sectionIndex]: {
          threads: prev[sectionIndex]?.threads || [],
          loading: false,
          error: 'Failed to load discovery threads'
        }
      }));
    }
  };

  const handleThreadClick = async (sectionIndex: number, threadIndex: number, thread: string) => {
    // Send the question to AI
    onAskAI(thread);

    // Replace this specific thread with a new one
    const section = content.sections[sectionIndex];
    
    // Set loading state for this specific thread
    setDiscoveryThreads(prev => ({
      ...prev,
      [sectionIndex]: {
        ...prev[sectionIndex],
        loading: true
      }
    }));

    try {
      // Generate a new thread to replace the clicked one
      const data = await authApi.post('/api/discovery/section/discovery-threads', {
        heading: section.heading,
        content: section.content
      });

      if (data.discovery_threads && data.discovery_threads.length > 0) {
        // Replace the clicked thread with a new one
        setDiscoveryThreads(prev => {
          const currentThreads = [...(prev[sectionIndex]?.threads || [])];
          // Replace with a random new thread to avoid repetition
          const randomNewThread = data.discovery_threads[Math.floor(Math.random() * data.discovery_threads.length)];
          currentThreads[threadIndex] = randomNewThread;
          
          return {
            ...prev,
            [sectionIndex]: {
              threads: currentThreads,
              loading: false
            }
          };
        });
      }
    } catch (error) {
      console.error('Error replacing discovery thread:', error);
      // Just remove loading state, keep existing threads
      setDiscoveryThreads(prev => ({
        ...prev,
        [sectionIndex]: {
          ...prev[sectionIndex],
          loading: false
        }
      }));
    }
  };


  // Prepare content for ReadingContentRenderer with fallbacks
  const rendererContent = {
    title: content.title,
    sections: content.sections,
    word_count: content.word_count,
    reading_level: content.reading_level || 'Not specified',
    grade_appropriate_features: content.grade_appropriate_features || []
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 bg-gray-50 min-h-screen p-6">
      {/* Enhanced Content Renderer with Inline AI Features */}
      <ReadingContentRenderer
        content={rendererContent}
        onAskAI={onAskAI}
        discoveryThreads={discoveryThreads}
        onDiscoveryThreadClick={handleThreadClick}
        subskillId={subskillId}
        onPrimitiveComplete={handlePrimitiveCompletion}
        primitiveCompletions={primitiveCompletions}
      />
      
      {/* Completion Section */}
      <Card className="border-2 border-blue-100 bg-blue-50/30">
        <CardContent className="pt-6">
          <Button 
            onClick={onComplete}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full"
            disabled={isCompleted}
          >
            {isCompleted ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Completed
              </>
            ) : (
              <>
                <span>Mark as Complete</span>
                <span className="ml-2 text-yellow-200 font-semibold">+20 XP</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}