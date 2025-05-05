import React from 'react';
import { Code, Play } from 'lucide-react';

interface ExampleCardProps {
  title: string;
  description: string;
  thumbnail: string; // Type of thumbnail
  onSelect: () => void;
}

const ExampleCard: React.FC<ExampleCardProps> = ({
  title,
  description,
  thumbnail,
  onSelect
}) => {
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
      
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
            <Code className="h-6 w-6 text-gray-400" />
          </div>
        );
    }
  };

  return (
    <div 
      className="group border rounded-md overflow-hidden hover:shadow-md dark:border-gray-700 transition-all duration-200 cursor-pointer"
      onClick={onSelect}
    >
      {/* Thumbnail Section */}
      <div className="aspect-video relative">
        {renderThumbnail()}
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
          <div className="bg-blue-600 text-white p-2 rounded-full">
            <Play className="h-5 w-5" />
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-3">
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{description}</p>
      </div>
    </div>
  );
};

export default ExampleCard;