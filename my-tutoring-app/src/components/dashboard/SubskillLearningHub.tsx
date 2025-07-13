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
  Mic
} from 'lucide-react';

interface SubskillLearningHubProps {
  subskillId: string;
  activityData?: any;
  studentId: string;
  onBack: () => void;
  onLearningOptionSelect: (option: any) => void;
}

const SubskillLearningHub: React.FC<SubskillLearningHubProps> = ({
  subskillId,
  activityData,
  studentId,
  onBack,
  onLearningOptionSelect
}) => {
  const [selectedOption, setSelectedOption] = useState(null);
  
  // Create fallback data structure first
  let subskillData = {
    title: subskillId.replace(/^rec-/, '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    description: `Learn and practice the fundamental concepts of ${subskillId.replace(/^rec-/, '').replace(/-/g, ' ')}.`,
    category: "Learning Objective",
    difficulty: "Beginner",
    estimatedTime: "12-15 minutes",
    points: 23,
    priority: "High",
    aiSelected: true,
    prerequisites: ["Basic understanding"],
    learningObjectives: [
      "Understand core concepts",
      "Apply knowledge practically", 
      "Demonstrate mastery",
      "Build foundation for next skills"
    ]
  };

  // Extract data from your API structure if activityData exists
  if (activityData) {
    subskillData.title = activityData.title || subskillData.title;
    subskillData.description = activityData.description || subskillData.description;
    subskillData.category = activityData.category || subskillData.category;
    subskillData.estimatedTime = activityData.estimated_time || subskillData.estimatedTime;
    subskillData.points = activityData.points || subskillData.points;
    subskillData.priority = activityData.priority || subskillData.priority;
    
    // Extract from metadata if available
    if (activityData.metadata) {
      subskillData.category = activityData.metadata.subject || subskillData.category;
      subskillData.aiSelected = activityData.metadata.from_recommendations || false;
      subskillData.priority = activityData.metadata.priority_level || subskillData.priority;
    }
  }

  const learningOptions = [
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
      endpoint: '/tutoring/live'
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
      endpoint: '/practice/problems'
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
      endpoint: '/content/packages'
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
      endpoint: '/projects/activities'
    }
  ];

  const handleOptionClick = (option: any) => {
    setSelectedOption(option);
    onLearningOptionSelect(option);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
              <span className="text-sm text-gray-500">Learning Hub</span>
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
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subskill Overview */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {subskillData.category}
                  </span>
                  {subskillData.aiSelected && (
                    <span className="ml-2 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded flex items-center">
                      <Lightbulb className="h-3 w-3 mr-1" />
                      AI-Selected
                    </span>
                  )}
                  <span className="ml-2 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                    {subskillData.priority} Priority
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {subskillData.title}
                </h1>
                <p className="text-gray-600 mb-4">
                  {subskillData.description}
                </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {subskillData.learningObjectives.map((objective, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{objective}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Learning Options */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Your Learning Path</h2>
          <p className="text-gray-600 mb-6">Select how you'd like to engage with this learning objective. Each option offers a different approach to mastering the skill.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {learningOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <div 
                  key={option.id}
                  onClick={() => handleOptionClick(option)}
                  className={`bg-white rounded-lg shadow-sm border-2 border-gray-200 hover:border-blue-300 transition-all cursor-pointer group ${
                    selectedOption?.id === option.id ? 'border-blue-500 ring-2 ring-blue-200' : ''
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
                        
                        {/* Metadata */}
                        <div className="flex items-center text-xs text-gray-500 space-x-4">
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {option.estimatedTime}
                          </div>
                          <div className="flex items-center">
                            <Target className="h-3 w-3 mr-1" />
                            {option.difficulty}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => onLearningOptionSelect({ id: 'live-tutoring', endpoint: `/tutoring/live/${subskillId}` })}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Mic className="h-4 w-4 mr-2" />
                Start with AI Tutor
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubskillLearningHub;