import React, { useState } from 'react';
import { 
  ArrowLeft, 
  MessageCircle, 
  PenTool, 
  BookOpen, 
  Wrench,
  Clock,
  Star,
  Trophy,
  Users,
  Play,
  FileText,
  Target,
  Lightbulb,
  CheckCircle,
  Mic,
  RefreshCw
} from 'lucide-react';

// Enhanced interfaces with proper curriculum metadata
interface CurriculumMetadata {
  subject: string;
  unit: {
    id: string;
    title: string;
  };
  skill: {
    id: string;
    description: string;
  };
  subskill: {
    id: string;
    description: string;
  };
}

// Updated to match actual API response
interface ActivityMetadata {
  from_recommendations?: boolean;
  recommendation_id?: string;
  subject?: string;
  skill_id?: string;
  priority_level?: string;
  readiness_status?: string;
  mastery_level?: number;
  proficiency?: number;
}

interface EnhancedActivity {
  id: string;
  title: string;
  description: string;
  category: string;
  estimated_time: string;
  points: number;
  priority: string;
  type: string;
  endpoint: string;
  action: string;
  time_slot: string;
  icon_type: string;
  curriculum_metadata?: CurriculumMetadata; // Optional since API might not have it
  metadata?: ActivityMetadata;
}

interface LearningOption {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  hoverColor: string;
  features: string[];
  estimatedTime: string;
  difficulty: string;
  curriculum_context: {
    subject: string;
    unit_id: string;
    skill_id: string;
    subskill_id: string;
  };
  endpoint: string;
}

interface SubskillLearningHubProps {
  activityData: EnhancedActivity | null;
  studentId: string;
  onBack: () => void;
  onLearningOptionSelect: (option: any) => void;
  loading?: boolean;
}

const SubskillLearningHub: React.FC<SubskillLearningHubProps> = ({
  activityData,
  studentId,
  onBack,
  onLearningOptionSelect,
  loading = false
}) => {
  const [selectedOption, setSelectedOption] = useState<LearningOption | null>(null);
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading activity details...</p>
        </div>
      </div>
    );
  }

  // Handle null or missing activityData
  if (!activityData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button 
                onClick={onBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-red-600 mb-4">
              <FileText className="h-12 w-12 mx-auto mb-2" />
              <h2 className="text-xl font-semibold">Activity Not Found</h2>
            </div>
            <p className="text-gray-600 mb-4">
              The requested activity could not be loaded. This might be because:
            </p>
            <ul className="text-sm text-gray-500 mb-6 text-left max-w-md mx-auto">
              <li>• The activity ID is invalid or expired</li>
              <li>• There was a network error loading the data</li>
              <li>• The activity has been removed or updated</li>
            </ul>
            <button 
              onClick={onBack}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle missing curriculum metadata - create from available data
  if (!activityData.curriculum_metadata && !activityData.metadata?.subject) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button 
                onClick={onBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-yellow-600 mb-4">
              <Target className="h-12 w-12 mx-auto mb-2" />
              <h2 className="text-xl font-semibold">Incomplete Activity Data</h2>
            </div>
            <p className="text-gray-600 mb-4">
              This activity is missing curriculum metadata required for the learning hub.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
              <h3 className="font-medium text-gray-900 mb-2">Available Data:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• ID: {activityData.id}</li>
                <li>• Title: {activityData.title}</li>
                <li>• Category: {activityData.category}</li>
                <li>• Points: {activityData.points}</li>
              </ul>
            </div>
            <button 
              onClick={onBack}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Create curriculum metadata from available data
  const curriculumMeta = activityData.curriculum_metadata || createCurriculumMetadata(activityData);
  const subject = curriculumMeta.subject || 'Learning';
  const unitId = curriculumMeta.unit?.id || activityData.metadata?.skill_id || 'unknown';
  const skillId = curriculumMeta.skill?.id || activityData.metadata?.skill_id || 'unknown';
  const subskillId = curriculumMeta.subskill?.id || activityData.id || 'unknown';

  // Helper function to create curriculum metadata from API response
  function createCurriculumMetadata(activity: EnhancedActivity): CurriculumMetadata {
    const subject = activity.metadata?.subject || 'General Learning';
    const skillId = activity.metadata?.skill_id || activity.id;
    
    // Parse skill ID to create meaningful structure
    const skillParts = skillId.split('-');
    const unitCode = skillParts[0] || 'UNIT';
    const skillCode = skillParts.slice(0, 2).join('-') || skillId;
    
    return {
      subject: subject,
      unit: {
        id: unitCode,
        title: getUnitTitle(subject, unitCode)
      },
      skill: {
        id: skillCode,
        description: extractSkillFromTitle(activity.title) || 'Core Skills'
      },
      subskill: {
        id: activity.id,
        description: activity.title
      }
    };
  }

  // Helper function to get unit title based on subject and code
  function getUnitTitle(subject: string, unitCode: string): string {
    if (subject.toLowerCase() === 'mathematics') {
      if (unitCode.includes('COUNT')) return 'Counting and Cardinality';
      if (unitCode.includes('NUM')) return 'Number Operations';
      if (unitCode.includes('GEO')) return 'Geometry';
      if (unitCode.includes('MEAS')) return 'Measurement';
      return 'Mathematics Fundamentals';
    }
    if (subject.toLowerCase() === 'language arts') {
      return 'Language Arts Fundamentals';
    }
    return `${subject} Unit`;
  }

  // Helper function to extract skill from title
  function extractSkillFromTitle(title: string): string {
    if (title.includes('Count') || title.includes('numbers')) return 'Number Recognition and Counting';
    if (title.includes('Add') || title.includes('addition')) return 'Addition Operations';
    if (title.includes('Subtract') || title.includes('subtraction')) return 'Subtraction Operations';
    if (title.includes('Shape') || title.includes('geometry')) return 'Geometric Shapes';
    return 'Core Mathematical Skills';
  }
  
  console.log('SubskillLearningHub - Using curriculum metadata:', {
    subject,
    unitId,
    skillId,
    subskillId,
    activityData
  });
  
  // Use actual data from curriculum metadata with fallbacks
  const subskillData = {
    title: curriculumMeta.subskill?.description || activityData.title || 'Learning Activity',
    description: activityData.description || 'Complete this learning activity to improve your skills.',
    category: subject,
    difficulty: getDifficultyFromMetadata(activityData.metadata),
    estimatedTime: activityData.estimated_time || "10-15 minutes",
    points: activityData.points || 25,
    priority: activityData.priority || "Medium",
    aiSelected: activityData.metadata?.from_recommendations || false,
    readinessStatus: activityData.metadata?.readiness_status || "ready",
    proficiency: activityData.metadata?.proficiency || 0,
    mastery: activityData.metadata?.mastery_level || 0,
    prerequisites: getPrerequisites(curriculumMeta),
    learningObjectives: generateLearningObjectives(curriculumMeta)
  };

  // Helper function to determine difficulty
  function getDifficultyFromMetadata(metadata?: ActivityMetadata): string {
    if (!metadata) return "Beginner";
    
    const proficiency = metadata.proficiency || 0;
    const mastery = metadata.mastery_level || 0;
    const priorityLevel = metadata.priority_level;
    
    if (priorityLevel === "Advanced" || mastery >= 80 || proficiency >= 80) return "Advanced";
    if (priorityLevel === "Intermediate" || mastery >= 60 || proficiency >= 60) return "Intermediate";
    if (priorityLevel === "Not Started" || mastery === 0) return "Beginner";
    return "Beginner";
  }

  // Generate contextual prerequisites with fallbacks
  function getPrerequisites(meta: CurriculumMetadata): string[] {
    const prerequisites = [];
    
    if (meta.skill?.description) {
      prerequisites.push(`Understanding of ${meta.skill.description}`);
    }
    
    // Add subject-specific prerequisites
    if (meta.subject?.toLowerCase() === 'mathematics') {
      prerequisites.push("Basic number recognition", "Counting fundamentals");
    } else if (meta.subject?.toLowerCase() === 'language arts') {
      prerequisites.push("Letter recognition", "Basic phonics");
    } else if (meta.subject?.toLowerCase() === 'science') {
      prerequisites.push("Observation skills", "Basic vocabulary");
    }
    
    // Fallback if no prerequisites
    if (prerequisites.length === 0) {
      prerequisites.push("Basic understanding of the topic", "Attention and focus");
    }
    
    return prerequisites;
  }

  // Generate contextual learning objectives with fallbacks
  function generateLearningObjectives(meta: CurriculumMetadata): string[] {
    const objectives = [];
    
    if (meta.subskill?.description) {
      objectives.push(`Master ${meta.subskill.description}`);
    }
    
    if (meta.skill?.description) {
      objectives.push(`Apply ${meta.skill.description} concepts practically`);
    }
    
    objectives.push('Demonstrate understanding through hands-on activities');
    
    if (meta.subject) {
      objectives.push(`Build foundation for advanced topics in ${meta.subject}`);
    }
    
    // Fallback objectives
    if (objectives.length === 0) {
      objectives.push(
        'Complete the learning activity successfully',
        'Demonstrate understanding of key concepts',
        'Apply knowledge in practical situations',
        'Build confidence in the subject area'
      );
    }
    
    return objectives;
  }

  // Learning options with proper curriculum context and fallbacks
  const learningOptions: LearningOption[] = [
    {
      id: 'live-tutoring',
      title: 'Live AI Tutoring',
      description: 'Get personalized, interactive guidance with your AI tutor using voice conversations',
      icon: MessageCircle,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600',
      features: ['Voice interaction', 'Real-time feedback', 'Adaptive questioning', 'Personalized pace'],
      estimatedTime: '10-15 mins',
      difficulty: 'Adaptive',
      curriculum_context: {
        subject: subject,
        unit_id: unitId,
        skill_id: skillId,
        subskill_id: subskillId
      },
      endpoint: `/tutoring/live/${subskillId}`
    },
    {
      id: 'practice-problems',
      title: 'Practice Problems',
      description: 'Solve interactive problems and exercises to reinforce your understanding',
      icon: PenTool,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
      features: ['Interactive exercises', 'Immediate feedback', 'Progress tracking', 'Hint system'],
      estimatedTime: '8-12 mins',
      difficulty: 'Progressive',
      curriculum_context: {
        subject: subject,
        unit_id: unitId,
        skill_id: skillId,
        subskill_id: subskillId
      },
      endpoint: `/practice/${subskillId}`
    },
    {
      id: 'educational-content',
      title: 'Educational Content',
      description: 'Explore curated learning materials, videos, and interactive lessons',
      icon: BookOpen,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
      features: ['Video lessons', 'Interactive content', 'Visual aids', 'Self-paced learning'],
      estimatedTime: '5-10 mins',
      difficulty: 'Structured',
      curriculum_context: {
        subject: subject,
        unit_id: unitId,
        skill_id: skillId,
        subskill_id: subskillId
      },
      endpoint: `/content/packages/${subskillId}`
    },
    {
      id: 'projects',
      title: 'Projects & Activities',
      description: 'Apply your knowledge through hands-on projects and creative activities',
      icon: Wrench,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
      features: ['Creative projects', 'Real-world application', 'Portfolio building', 'Collaborative options'],
      estimatedTime: '15-20 mins',
      difficulty: 'Applied',
      curriculum_context: {
        subject: subject,
        unit_id: unitId,
        skill_id: skillId,
        subskill_id: subskillId
      },
      endpoint: `/projects/activities/${subskillId}`
    }
  ];

  const handleOptionClick = (option: LearningOption) => {
    setSelectedOption(option);
    
    // Pass complete curriculum context and activity data to parent
    onLearningOptionSelect({
      ...option,
      route: option.endpoint,
      activityData: activityData,
      curriculum_context: option.curriculum_context,
      // Additional context for the learning session
      session_context: {
        student_id: studentId,
        learning_path: `${curriculumMeta.unit?.title || 'Unit'} → ${curriculumMeta.skill?.description || 'Skill'} → ${curriculumMeta.subskill?.description || 'Subskill'}`,
        estimated_duration: option.estimatedTime,
        points_available: subskillData.points
      }
    });
  };

  const handleQuickActionTutoring = () => {
    const tutoringOption = learningOptions.find(opt => opt.id === 'live-tutoring');
    if (tutoringOption) {
      handleOptionClick(tutoringOption);
    }
  };

  // Get priority color and style
  const getPriorityStyle = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Get readiness status style
  const getReadinessStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ready':
        return 'text-green-600 bg-green-50';
      case 'not_ready':
        return 'text-red-600 bg-red-50';
      case 'review':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header with curriculum breadcrumb */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button 
                onClick={onBack}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
              <div className="h-6 w-px bg-gray-300 mr-4" />
              <div className="text-sm text-gray-500">
                <span className="font-medium">{subject}</span>
                <span className="mx-2">→</span>
                <span>{curriculumMeta.unit?.title || 'Unit'}</span>
                <span className="mx-2">→</span>
                <span className="text-blue-600">{curriculumMeta.skill?.description || 'Skill'}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="h-4 w-4 mr-1" />
                {subskillData.estimatedTime}
              </div>
              <div className="flex items-center text-sm text-yellow-600">
                <Star className="h-4 w-4 mr-1" />
                {subskillData.points} points
              </div>
              {/* Proficiency indicator */}
              {subskillData.proficiency > 0 && (
                <div className="flex items-center text-sm text-blue-600">
                  <Target className="h-4 w-4 mr-1" />
                  {subskillData.proficiency}% proficient
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Subskill Overview */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center mb-3 flex-wrap gap-2">
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    {subject} • {curriculumMeta.unit?.title || 'Unit'}
                  </span>
                  
                  {subskillData.aiSelected && (
                    <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full border border-purple-200 flex items-center">
                      <Lightbulb className="h-3 w-3 mr-1" />
                      AI-Recommended
                    </span>
                  )}
                  
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getPriorityStyle(subskillData.priority)}`}>
                    {subskillData.priority} Priority
                  </span>
                  
                  {subskillData.readinessStatus && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getReadinessStyle(subskillData.readinessStatus)}`}>
                      {subskillData.readinessStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                </div>
                
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {subskillData.title}
                </h1>
                <p className="text-gray-600 mb-4">
                  {subskillData.description}
                </p>
                
                {/* Enhanced curriculum context */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center mb-2">
                    <BookOpen className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Learning Context</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div><strong>Skill Focus:</strong> {curriculumMeta.skill?.description || 'General skill development'}</div>
                    <div><strong>Specific Goal:</strong> {curriculumMeta.subskill?.description || 'Complete learning activity'}</div>
                    <div><strong>Difficulty Level:</strong> {subskillData.difficulty}</div>
                    {subskillData.proficiency > 0 && (
                      <div><strong>Current Progress:</strong> {subskillData.proficiency}% proficient</div>
                    )}
                  </div>
                </div>

                {/* Prerequisites */}
                {subskillData.prerequisites.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Prerequisites</h4>
                    <div className="flex flex-wrap gap-2">
                      {subskillData.prerequisites.map((prereq, index) => (
                        <span 
                          key={index}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200"
                        >
                          {prereq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="ml-6 flex-shrink-0">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-lg text-center">
                  <Trophy className="h-6 w-6 mx-auto mb-1" />
                  <div className="text-sm font-medium">Earn up to</div>
                  <div className="text-xl font-bold">{subskillData.points} pts</div>
                </div>
              </div>
            </div>

            {/* Learning Objectives */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <Target className="h-5 w-5 mr-2 text-blue-500" />
                Learning Objectives
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subskillData.learningObjectives.map((objective, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{objective}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Learning Options */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Your Learning Path</h2>
          <p className="text-gray-600 mb-6">
            Select how you'd like to engage with <strong>{curriculumMeta.subskill?.description || 'this learning activity'}</strong>. 
            Each option is tailored to help you master this specific skill within {curriculumMeta.skill?.description || 'your studies'}.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {learningOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <div 
                  key={option.id}
                  onClick={() => handleOptionClick(option)}
                  className={`bg-white rounded-lg shadow-sm border-2 border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group ${
                    selectedOption?.id === option.id ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : ''
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start">
                      <div className={`${option.color} ${option.hoverColor} text-white p-3 rounded-lg group-hover:scale-105 transition-transform`}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                          {option.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-3">
                          {option.description}
                        </p>
                        
                        {/* Features */}
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1">
                            {option.features.map((feature, index) => (
                              <span 
                                key={index}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {/* Enhanced metadata */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {option.estimatedTime}
                            </div>
                            <div className="flex items-center">
                              <Target className="h-3 w-3 mr-1" />
                              {option.difficulty}
                            </div>
                          </div>
                          {selectedOption?.id === option.id && (
                            <span className="text-blue-600 font-medium">Selected ✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Play className="h-5 w-5 mr-2 text-blue-500" />
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleQuickActionTutoring}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Mic className="h-4 w-4 mr-2" />
                Start with AI Tutor
              </button>
              <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <PenTool className="h-4 w-4 mr-2" />
                Practice Problems
              </button>
              <button className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <BookOpen className="h-4 w-4 mr-2" />
                View Prerequisites
              </button>
              <button className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <Users className="h-4 w-4 mr-2" />
                Study with Others
              </button>
              <button className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <FileText className="h-4 w-4 mr-2" />
                Save for Later
              </button>
            </div>
            
            {/* Additional context information */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Next in your learning path:</span>
                  <span className="text-blue-600 font-medium">Advanced {subject} concepts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubskillLearningHub;