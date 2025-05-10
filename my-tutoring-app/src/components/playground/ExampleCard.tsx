import React from 'react';
import { Code, Play, Star } from 'lucide-react';
import { P5jsExample } from '@/lib/p5jsExamples';

interface ExampleCardProps {
  example: P5jsExample;
  onSelect: (example: P5jsExample) => void;
  compact?: boolean;
}

const ExampleCard: React.FC<ExampleCardProps> = ({
  example,
  onSelect,
  compact = false
}) => {
  const { title, description, thumbnail, difficulty } = example;

  // Thumbnail visualization based on type
  const renderThumbnail = () => {
    switch (thumbnail) {
      case 'ball':
        return (
          <div className="relative w-full h-full bg-blue-50 dark:bg-blue-900/20 overflow-hidden">
            <div className="absolute w-12 h-12 rounded-full bg-blue-500" 
                 style={{ left: '60%', top: '40%' }}></div>
            <div className="absolute bottom-2 right-2 left-2 h-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>
        );
      
      case 'color':
        return (
          <div className="w-full h-full bg-gradient-to-br from-red-300 via-green-300 to-blue-300 dark:from-red-700 dark:via-green-700 dark:to-blue-700">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/50 dark:bg-white/20"></div>
          </div>
        );
      
      case 'shapes':
        return (
          <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <div className="absolute left-1/4 top-1/3 w-6 h-6 rounded-full bg-red-400 dark:bg-red-600"></div>
            <div className="absolute right-1/3 bottom-1/4 w-8 h-8 bg-green-400 dark:bg-green-600"></div>
            <div className="absolute right-1/4 top-1/4 w-8 h-8 bg-blue-400 dark:bg-blue-600"
                 style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
          </div>
        );
      
      case 'particles':
        return (
          <div className="w-full h-full bg-gray-900 dark:bg-black">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i}
                className="absolute w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-300"
                style={{ 
                  left: `${Math.random() * 100}%`, 
                  top: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.7 + 0.3
                }}
              ></div>
            ))}
          </div>
        );
      
      case 'wave':
        return (
          <div className="w-full h-full bg-blue-50 dark:bg-blue-900/20 overflow-hidden">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path 
                d="M0,50 Q25,30 50,50 T100,50"
                stroke="rgb(59, 130, 246)"
                strokeWidth="2"
                fill="none"
              />
              <path 
                d="M0,50 Q25,70 50,50 T100,50"
                stroke="rgba(59, 130, 246, 0.5)"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
        );
      
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
            <Code className="h-6 w-6 text-gray-400" />
          </div>
        );
    }
  };

  // Helper function to get difficulty colors
  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'advanced':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div 
      className={`group border rounded-md overflow-hidden hover:shadow-md dark:border-gray-700 transition-all duration-200 cursor-pointer ${compact ? 'h-full' : ''}`}
      onClick={() => onSelect(example)}
    >
      {/* Thumbnail Section */}
      <div className={`${compact ? 'aspect-square' : 'aspect-video'} relative`}>
        {renderThumbnail()}
        
        {/* Difficulty Badge */}
        {difficulty && !compact && (
          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor()}`}>
            {difficulty}
          </div>
        )}
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
          <div className="bg-blue-600 text-white p-2 rounded-full">
            <Play className="h-5 w-5" />
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className={`p-3 ${compact ? 'p-2' : ''}`}>
        <div className="flex items-start justify-between">
          <h4 className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{title}</h4>
          
          {/* Difficulty indicator for compact view */}
          {difficulty && compact && (
            <div className={`ml-1 flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center ${
              difficulty === 'beginner' ? 'bg-green-100 text-green-600' :
              difficulty === 'intermediate' ? 'bg-blue-100 text-blue-600' :
              'bg-purple-100 text-purple-600'
            }`}>
              <Star className="h-3 w-3" />
            </div>
          )}
        </div>
        
        {/* Only show description in non-compact mode */}
        {!compact && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{description}</p>
        )}
        
        {/* Tags for non-compact mode */}
        {!compact && example.tags && example.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {example.tags.slice(0, 3).map((tag, index) => (
              <span 
                key={index}
                className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full"
              >
                {tag}
              </span>
            ))}
            {example.tags.length > 3 && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full">
                +{example.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExampleCard;