import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  PenTool, 
  BookOpen, 
  Wrench,
  Star,
  Clock,
  CheckCircle
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
  };
  onLearningSelect: (option: LearningOption) => void;
  loading?: boolean;
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
  loading = false
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
      route: `/practice/${activityData.id}`
    },
    {
      id: 'educational-content',
      title: 'Learn',
      icon: BookOpen,
      color: 'bg-purple-500',
      route: `/content/packages/${activityData.id}`
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
    <div className={`bg-white rounded-lg border transition-all ${
      isCompleted 
        ? 'border-green-200 bg-green-50/50' 
        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
    }`}>
      <div className="p-6">
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

        {/* Simple badges */}
        {(isCompleted || aiRecommended) && (
          <div className="flex gap-2 mb-4">
            {isCompleted && (
              <Badge variant="default" className="bg-green-600 text-white text-xs">
                ✓ Complete
              </Badge>
            )}
            {aiRecommended && !isCompleted && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                AI Pick
              </Badge>
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
              return (
                <motion.button
                  key={option.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group"
                  onClick={() => onLearningSelect(option)}
                  disabled={loading}
                >
                  <div className={`w-8 h-8 rounded-lg mb-2 flex items-center justify-center ${option.color} text-white group-hover:scale-110 transition-transform`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600">
                    {option.title}
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