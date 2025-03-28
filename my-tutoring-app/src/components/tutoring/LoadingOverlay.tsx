'use client';

import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  isRecommended?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message = 'Creating your problem set...',
  isRecommended = false
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex flex-col items-center">
          <div className="relative mb-6">
            {isRecommended ? (
              <>
                <div className="relative animate-pulse">
                  <Sparkles className="w-12 h-12 text-amber-500" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
                </div>
              </>
            ) : (
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
            )}
          </div>
          
          <h2 className="text-xl font-bold mb-2">
            {isRecommended ? 'Personalizing Your Practice' : 'Getting Ready'}
          </h2>
          
          <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
            {message}
          </p>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full ${isRecommended ? 'bg-amber-500' : 'bg-blue-500'} animate-progress`}
            />
          </div>
          
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            {isRecommended 
              ? 'Analyzing your learning history and preparing tailored problems...' 
              : 'Building problems at the right difficulty level for you...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;