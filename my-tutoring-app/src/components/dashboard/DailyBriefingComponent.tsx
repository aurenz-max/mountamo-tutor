import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  RefreshCw, 
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const handleLearningSelect = (option: any) => {
    setLoadingActivity(option.id);
    
    // Navigate to the selected learning option
    if (option.route) {
      router.push(option.route);
    } else {
      // Fallback routing
      const baseRoute = option.id.replace('-', '/');
      router.push(`/${baseRoute}/${option.activityId || 'unknown'}`);
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

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Simple header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-lg">
              <Calendar className="h-5 w-5 mr-2 text-blue-600" />
              Today's Learning
            </CardTitle>
            <div className="text-sm text-gray-600">
              {completedCount}/{totalCount} complete
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Clean activity cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
            curriculum_metadata: activity.curriculum_metadata
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