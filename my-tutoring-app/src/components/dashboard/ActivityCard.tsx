import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  PenTool, 
  BookOpen, 
  Wrench,
  Star,
  Clock,
  CheckCircle,
  Brain,
  Database,
  AlertTriangle,
  Info,
  Zap,
  Target,
  RotateCcw,
  PartyPopper,
  Lightbulb,
  Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ActivityCardProps {
  activityData: {
    id: string;
    title: string;
    description: string;
    category: string;
    estimated_time: string;
    points: number;
    priority: string;
    metadata?: {
      from_recommendations?: boolean;
      subject?: string;
      unit_description?: string;
      skill_description?: string;
      completed?: boolean;
      [key: string]: any; // Allow for additional metadata fields
    };
    curriculum_metadata?: {
      subject: string;
      unit: { id: string; title: string; description?: string };
      skill: { id: string; description: string };
      subskill: { id: string; description: string };
    };
    source_type?: 'ai_recommendations' | 'bigquery_recommendations' | 'fallback';
    source_details?: {
      ai_reason?: string;
      priority_rank?: number;
      estimated_time_minutes?: number;
      readiness_status?: string;
      mastery_level?: number;
      reason?: string;
    };
    activity_type?: 'warm_up' | 'core_challenge' | 'practice' | 'cool_down';
    reason?: string;
    curriculum_transparency?: {
      subject: string;
      unit: string;
      skill: string;
      subskill: string;
    };
  };
  onLearningSelect: (option: LearningOption) => void;
  loading?: boolean;
  loadingAction?: string;
  expanded?: boolean;
  onExpand?: () => void;
}

interface LearningOption {
  id: string;
  title: string;
  icon: any;
  color: string;
  route: string;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activityData,
  onLearningSelect,
  loading = false,
  loadingAction = null,
  expanded = false,
  onExpand
}) => {
  // Extract metadata from the properly structured backend data
  const subject = activityData.curriculum_metadata?.subject || 
                  activityData.metadata?.subject || 
                  activityData.category || 
                  'Learning';
  
  // Create separate unit and skill display instead of combined
  const unitDescription = activityData.curriculum_metadata?.unit?.description || null;
  const skillDescription = activityData.curriculum_metadata?.skill?.description || null;

  // Get the clean learning objective (subskill description)
  const subskillDescription = activityData.curriculum_metadata?.subskill?.description || 
                             activityData.title.replace(/^(Learn|Practice|Review):\s*/, '') ||
                             'Learning Activity';

  const isCompleted = activityData.metadata?.completed || false;
  const aiRecommended = activityData.metadata?.from_recommendations || false;
  
  // New transparency data
  const sourceType = activityData.source_type;
  const sourceDetails = activityData.source_details;
  
  // Get pedagogical tag info
  const getPedagogicalTag = (activityType?: string) => {
    switch (activityType) {
      case 'warm_up':
        return { icon: Zap, label: '🚀 Warm-Up', color: 'bg-green-100 text-green-800 border-green-200', description: 'Confidence Builder' };
      case 'core_challenge':
        return { icon: Brain, label: '🧠 Core Challenge', color: 'bg-purple-100 text-purple-800 border-purple-200', description: 'New Learning' };
      case 'practice':
        return { icon: Target, label: '✍️ Practice', color: 'bg-blue-100 text-blue-800 border-blue-200', description: 'Skill Building' };
      case 'cool_down':
        return { icon: PartyPopper, label: '🎉 Cool-Down', color: 'bg-orange-100 text-orange-800 border-orange-200', description: 'Engaging Review' };
      default:
        return { icon: BookOpen, label: '📚 Learning', color: 'bg-gray-100 text-gray-800 border-gray-200', description: 'Learning Activity' };
    }
  };
  
  // Get source icon and label
  const getSourceInfo = (sourceType?: string) => {
    switch (sourceType) {
      case 'ai_recommendations':
        return { icon: Brain, label: 'AI Recommended', color: 'bg-purple-100 text-purple-800' };
      case 'bigquery_recommendations':
        return { icon: Database, label: 'Data Recommended', color: 'bg-blue-100 text-blue-800' };
      case 'fallback':
        return { icon: AlertTriangle, label: 'Standard Activity', color: 'bg-gray-100 text-gray-800' };
      default:
        return { icon: Info, label: 'Activity', color: 'bg-gray-100 text-gray-800' };
    }
  };
  
  const sourceInfo = getSourceInfo(sourceType);
  const pedagogicalTag = getPedagogicalTag(activityData.activity_type);
  const aiReason = activityData.reason || sourceDetails?.ai_reason || sourceDetails?.reason;

  // Don't need combined unit-skill text anymore since we're displaying separately
  // const unitSkillText = ...

  // Debug logging to verify the backend data structure
  console.log('ActivityCard Debug:', {
    id: activityData.id,
    subject,
    unitDescription,
    skillDescription,
    subskillDescription,
    curriculum_metadata: activityData.curriculum_metadata,
    hasProperStructure: !!activityData.curriculum_metadata
  });

  const learningOptions: LearningOption[] = [
    {
      id: 'live-tutoring',
      title: 'Tutor',
      icon: MessageCircle,
      color: 'bg-blue-500',
      route: `/tutoring/live/${activityData.id}`
    },
    {
      id: 'practice-problems',
      title: 'Practice',
      icon: PenTool,
      color: 'bg-green-500',
      route: `/practice/${activityData.id}?subject=${encodeURIComponent(subject)}`
    },
    {
      id: 'educational-content',
      title: 'Learn',
      icon: BookOpen,
      color: 'bg-purple-500',
      route: `packages-curriculum-${activityData.id}` // Special flag for curriculum mapping
    },
    {
      id: 'projects',
      title: 'Create',
      icon: Wrench,
      color: 'bg-orange-500',
      route: `/projects/activities/${activityData.id}`
    }
  ];

  return (
    <div className={`bg-white rounded-lg border-l-4 transition-all ${
      isCompleted 
        ? 'border-l-green-500 border-r border-t border-b border-green-200 bg-green-50/50' 
        : `${pedagogicalTag.color.includes('green') ? 'border-l-green-500' : 
             pedagogicalTag.color.includes('purple') ? 'border-l-purple-500' : 
             pedagogicalTag.color.includes('blue') ? 'border-l-blue-500' : 
             pedagogicalTag.color.includes('orange') ? 'border-l-orange-500' : 'border-l-gray-500'} border-r border-t border-b border-gray-200 hover:border-gray-300 hover:shadow-sm`
    }`}>
      <div className="p-6">
        {/* Pedagogical Tag - Most Prominent */}
        <div className="mb-3">
          <Badge className={`${pedagogicalTag.color} text-xs font-semibold px-3 py-1 border`}>
            {pedagogicalTag.label}
          </Badge>
          <span className="ml-2 text-xs text-gray-500">{pedagogicalTag.description}</span>
        </div>

        {/* Enhanced Header with proper hierarchy */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            {/* Subject Display - More Prominent */}
            <div className="text-base text-blue-600 font-semibold mb-2">
              {subject}
            </div>
            
            {/* Unit Display */}
            {unitDescription && (
              <h3 className="text-sm font-semibold text-gray-800 mb-1 leading-tight">
                {unitDescription}
              </h3>
            )}
            
            {/* Skill Display - Slightly Smaller */}
            {skillDescription && (
              <div className="text-xs font-medium text-gray-600 mb-2">
                {skillDescription}
              </div>
            )}
            
            {/* Learning Objective (supporting detail) */}
            <div className="text-sm text-gray-600 mb-2 leading-relaxed">
              {subskillDescription}
            </div>
            
            {/* AI Insight - Direct Display */}
            {aiReason && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 italic leading-relaxed">
                  {aiReason}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3 text-sm text-gray-600 ml-4 flex-shrink-0">
            <div className="flex items-center">
              <Star className="h-4 w-4 text-yellow-500 mr-1" />
              {activityData.points}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {activityData.estimated_time}
            </div>
          </div>
        </div>

        {/* Enhanced badges with transparency info */}
        <div className="flex flex-wrap gap-2 mb-3">
          {isCompleted && (
            <Badge variant="default" className="bg-green-600 text-white text-xs">
              ✓ Complete
            </Badge>
          )}
          
          {/* Source transparency badge */}
          {sourceType && (
            <Badge variant="secondary" className={`text-xs ${sourceInfo.color} flex items-center gap-1`}>
              <sourceInfo.icon className="h-3 w-3" />
              {sourceInfo.label}
            </Badge>
          )}
        </div>

        {/* Expandable transparency details - only show if no direct AI reason */}
        {sourceDetails && onExpand && !aiReason && (
          <div className="mb-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onExpand}
              className="text-xs text-gray-600 hover:text-blue-600 p-0 h-auto font-normal"
            >
              <Info className="h-3 w-3 mr-1" />
              {expanded ? 'Hide details' : 'Why this activity?'}
            </Button>
          </div>
        )}

        {/* Expanded transparency section */}
        {expanded && sourceDetails && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs">
            <div className="font-medium text-gray-700 mb-2">Recommendation Details:</div>
            
            {sourceType === 'ai_recommendations' && (
              <>
                {sourceDetails.ai_reason && (
                  <div className="mb-2">
                    <span className="font-medium">AI Reasoning:</span>
                    <p className="text-gray-600 mt-1">{sourceDetails.ai_reason}</p>
                  </div>
                )}
                {sourceDetails.estimated_time_minutes && (
                  <div className="mb-1">
                    <span className="font-medium">Estimated Time:</span> {sourceDetails.estimated_time_minutes} min
                  </div>
                )}
              </>
            )}
            
            {sourceType === 'bigquery_recommendations' && (
              <>
                {sourceDetails.readiness_status && (
                  <div className="mb-1">
                    <span className="font-medium">Readiness:</span> {sourceDetails.readiness_status}
                  </div>
                )}
                {sourceDetails.mastery_level !== undefined && (
                  <div className="mb-1">
                    <span className="font-medium">Current Mastery:</span> {Math.round(sourceDetails.mastery_level * 100)}%
                  </div>
                )}
              </>
            )}
            
            {sourceType === 'fallback' && sourceDetails.reason && (
              <div className="text-gray-600">{sourceDetails.reason}</div>
            )}
          </div>
        )}

        {/* Always visible action buttons */}
        {isCompleted ? (
          <div className="text-center text-green-600 font-medium">
            Activity completed!
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {learningOptions.map((option) => {
              const IconComponent = option.icon;
              const isButtonLoading = loading && loadingAction === option.id;
              const isOtherButtonLoading = loading && loadingAction !== option.id;
              
              return (
                <motion.button
                  key={option.id}
                  whileHover={{ scale: isButtonLoading ? 1 : 1.05 }}
                  whileTap={{ scale: isButtonLoading ? 1 : 0.95 }}
                  className={`flex flex-col items-center p-3 rounded-lg border transition-all group ${
                    isOtherButtonLoading 
                      ? 'border-gray-200 opacity-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => onLearningSelect(option)}
                  disabled={loading}
                >
                  <div className={`w-8 h-8 rounded-lg mb-2 flex items-center justify-center ${option.color} text-white ${
                    isOtherButtonLoading ? '' : 'group-hover:scale-110'
                  } transition-transform`}>
                    {isButtonLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <IconComponent className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`text-xs font-medium transition-colors ${
                    isOtherButtonLoading 
                      ? 'text-gray-400' 
                      : isButtonLoading 
                      ? 'text-blue-600'
                      : 'text-gray-700 group-hover:text-blue-600'
                  }`}>
                    {isButtonLoading && option.id === 'educational-content' ? 'Generating...' : option.title}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityCard;