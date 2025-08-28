import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Target,
  Sparkles,
  Trophy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ActivityCard from './ActivityCard'; // Import the clean ActivityCard component

// Import your existing hooks and types
import { useDailyActivities, DailyActivity, ActivityUtils } from '@/lib/dailyActivitiesAPI';
import { useAuth } from '@/contexts/AuthContext';

interface DailyBriefingProps {
  studentId?: number;
  className?: string;
  onActivityClick?: (activity: DailyActivity) => void;
}

const DailyBriefingComponent: React.FC<DailyBriefingProps> = ({ 
  studentId, 
  className = "",
  onActivityClick
}) => {
  const router = useRouter();
  const { getAuthToken, userProfile } = useAuth();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [loadingActivity, setLoadingActivity] = useState<string | null>(null);

  const finalStudentId = studentId || userProfile?.student_id;
  
  const {
    dailyPlan,
    loading,
    error,
    refreshPlan,
    completeActivity,
    isCompleting
  } = useDailyActivities({
    studentId: finalStudentId!,
    getAuthToken,
    autoRefresh: true
  });

  // Handle card expansion
  const handleCardExpand = (activityId: string) => {
    setExpandedCard(expandedCard === activityId ? null : activityId);
  };

  // Handle learning option selection
  const handleLearningSelect = async (option: any) => {
    setLoadingActivity(option.id);
    
    try {
      // Check if this is a curriculum-to-package mapping request
      if (option.route && option.route.startsWith('packages-curriculum-')) {
        const curriculumId = option.route.replace('packages-curriculum-', '');
        
        // Import the auth API client dynamically to avoid SSR issues
        const { authApi } = await import('@/lib/authApiClient');
        
        console.log('🔍 Looking up package for curriculum ID:', curriculumId);
        
        // Find the corresponding package ID
        const packageMapping = await authApi.findPackageByCurriculumId(curriculumId);
        
        if (packageMapping.package_id) {
          console.log('✅ Found package:', packageMapping.package_id);
          // Navigate to the actual package learn page
          router.push(`/packages/${packageMapping.package_id}/learn`);
        } else {
          console.error('❌ No package found for curriculum ID:', curriculumId);
          // Fallback to packages list
          router.push('/packages');
        }
      } else if (option.route) {
        // Normal navigation
        router.push(option.route);
      } else {
        // Fallback routing
        const baseRoute = option.id.replace('-', '/');
        router.push(`/${baseRoute}/${option.activityId || 'unknown'}`);
      }
    } catch (error) {
      console.error('❌ Error handling learning selection:', error);
      // Fallback to packages list on error
      if (option.route && option.route.startsWith('packages-curriculum-')) {
        router.push('/packages');
      } else {
        // Try the original navigation
        router.push(option.route || '/');
      }
    } finally {
      setLoadingActivity(null);
    }
  };

  if (!finalStudentId) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-gray-600">Please log in to view your daily activities.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-8">
          <div className="flex items-center justify-center space-x-3">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading your learning plan...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-8">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={refreshPlan} 
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dailyPlan || !dailyPlan.activities || dailyPlan.activities.length === 0) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-8">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-gray-600 mb-6">
              No activities scheduled for today. Great work!
            </p>
            <Button 
              onClick={() => router.push('/practice')}
            >
              Explore More Learning
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedCount = dailyPlan.progress?.completed_activities || 0;
  const totalCount = dailyPlan.activities.length;
  
  // Transparency information
  const sourceBreakdown = dailyPlan.summary?.source_breakdown;
  const transparency = dailyPlan.transparency;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Daily Mission Header */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">Today's Mission</span>
              </div>
              <CardTitle className="text-xl mb-3 text-gray-900">
                {dailyPlan.transparency?.session_plan?.daily_theme || "Your Learning Adventure"}
              </CardTitle>
              
              {/* Learning Objectives */}
              {dailyPlan.transparency?.session_plan?.learning_objectives && dailyPlan.transparency.session_plan.learning_objectives.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">Your mission for today:</span>
                  </div>
                  <ul className="space-y-1">
                    {dailyPlan.transparency.session_plan.learning_objectives.map((objective: string, index: number) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {objective}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="text-right ml-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-gray-700">{completedCount}/{totalCount} complete</span>
              </div>
              <Progress 
                value={(completedCount / totalCount) * 100} 
                className="w-24 h-2" 
              />
            </div>
          </div>
          
          {/* Enhanced transparency info */}
          {(sourceBreakdown || transparency) && (
            <div className="mt-4 pt-3 border-t border-blue-200">
              <div className="flex flex-wrap items-center gap-3">
                {sourceBreakdown && (
                  <>
                    {sourceBreakdown.ai_recommendations > 0 && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                        {sourceBreakdown.ai_recommendations} AI recommended
                      </Badge>
                    )}
                    {sourceBreakdown.bigquery_recommendations > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        {sourceBreakdown.bigquery_recommendations} data-based
                      </Badge>
                    )}
                    {sourceBreakdown.fallback > 0 && (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                        <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                        {sourceBreakdown.fallback} standard
                      </Badge>
                    )}
                  </>
                )}
                {transparency?.ai_enabled && (
                  <Badge variant="default" className="bg-green-600 text-white">
                    ✓ AI Personalization Active
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Activity Playlist - Vertical Layout */}
      <div className="space-y-4">
        {dailyPlan.activities.map((activity) => {
          // Convert DailyActivity to ActivityCard format
          const activityData = {
            id: activity.id,
            title: activity.title,
            description: activity.description,
            category: activity.category || 'Learning',
            estimated_time: activity.estimated_time,
            points: activity.points,
            priority: activity.priority,
            type: activity.type,
            endpoint: activity.endpoint,
            metadata: {
              from_recommendations: activity.metadata?.from_recommendations,
              subject: activity.metadata?.subject,
              skill_id: activity.metadata?.skill_id,
              priority_level: activity.metadata?.priority_level,
              difficulty: activity.metadata?.difficulty,
              completed: activity.metadata?.completed
            },
            curriculum_metadata: activity.curriculum_metadata,
            source_type: activity.source_type,
            source_details: activity.source_details,
            curriculum_transparency: activity.curriculum_transparency,
            activity_type: activity.activity_type,
            reason: activity.reason
          };

          return (
            <ActivityCard
              key={activity.id}
              activityData={activityData}
              expanded={expandedCard === activity.id}
              onExpand={() => handleCardExpand(activity.id)}
              onLearningSelect={(option) => handleLearningSelect({
                ...option,
                activityId: activity.id
              })}
              loading={loadingActivity === activity.id}
            />
          );
        })}
      </div>

      {/* Simple loading indicator */}
      {loadingActivity && (
        <div className="text-center py-4">
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Starting learning session...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyBriefingComponent;