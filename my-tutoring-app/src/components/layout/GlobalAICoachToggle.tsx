// components/layout/GlobalAICoachToggle.tsx
'use client';

import React, { useState, createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAICoach } from '@/contexts/AICoachContext';
import AICoach from '@/components/dashboard/AICoach';
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from 'lucide-react';

interface GlobalAICoachUIType {
  showAICoach: boolean;
  setShowAICoach: (show: boolean) => void;
  toggleAICoach: () => void;
  setContext: (context: any) => void;
  currentContext: any;
  notificationCount: number;
  clearNotifications: () => void;
  addNotification: () => void; // Add this method
}

const GlobalAICoachUIContext = createContext<GlobalAICoachUIType | null>(null);

export const GlobalAICoachProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showAICoach, setShowAICoach] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const { userProfile, user } = useAuth();

  // Use the main AICoachContext as the source of truth
  const { setContext, connection, isAIConnected } = useAICoach();

  // Use refs to track if notifications have been shown (avoids re-renders)
  const hasShownLoginNotificationRef = useRef(false);
  const hasShownAIConnectedNotificationRef = useRef(false);
  const loginTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiConnectedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add notification when user logs in
  useEffect(() => {
    if (user && userProfile && !hasShownLoginNotificationRef.current) {
      // Add a small delay to ensure the UI is ready
      loginTimerRef.current = setTimeout(() => {
        setNotificationCount(prev => prev + 1);
        hasShownLoginNotificationRef.current = true;
      }, 1000);
    }

    // Reset when user logs out
    if (!user) {
      hasShownLoginNotificationRef.current = false;
      hasShownAIConnectedNotificationRef.current = false;
      setNotificationCount(0);

      // Clear any pending timers
      if (loginTimerRef.current) {
        clearTimeout(loginTimerRef.current);
        loginTimerRef.current = null;
      }
      if (aiConnectedTimerRef.current) {
        clearTimeout(aiConnectedTimerRef.current);
        aiConnectedTimerRef.current = null;
      }
    }

    return () => {
      if (loginTimerRef.current) {
        clearTimeout(loginTimerRef.current);
      }
    };
  }, [user, userProfile]);

  // Optional: Add notification when AI connects
  useEffect(() => {
    if (isAIConnected && user && hasShownLoginNotificationRef.current && !hasShownAIConnectedNotificationRef.current) {
      // Only add connection notification if we've shown login notification
      aiConnectedTimerRef.current = setTimeout(() => {
        setNotificationCount(prev => prev + 1);
        hasShownAIConnectedNotificationRef.current = true;
      }, 2000);
    }

    return () => {
      if (aiConnectedTimerRef.current) {
        clearTimeout(aiConnectedTimerRef.current);
      }
    };
  }, [isAIConnected, user]);

  const toggleAICoach = useCallback(() => {
    setShowAICoach(prev => {
      // Clear notifications when opening the coach
      if (!prev) {
        setNotificationCount(0);
      }
      return !prev;
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotificationCount(0);
  }, []);

  const addNotification = useCallback(() => {
    setNotificationCount(prev => prev + 1);
  }, []);

  // Listen for keyboard shortcuts (optional enhancement)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K to toggle AI Coach
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        toggleAICoach();
      }
      // Escape to close AI Coach
      if (event.key === 'Escape' && showAICoach) {
        setShowAICoach(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAICoach, toggleAICoach]);

  return (
    <GlobalAICoachUIContext.Provider value={{ 
      showAICoach, 
      setShowAICoach, 
      toggleAICoach,
      setContext,
      currentContext: connection.lastContext,
      notificationCount,
      clearNotifications,
      addNotification
    }}>
      <div className="relative">
        {children}
        
        {/* AI Coach Sidebar with improved animations */}
        {showAICoach && (
          <>
            {/* Backdrop for mobile */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setShowAICoach(false)}
            />
            
            {/* AI Coach Sidebar */}
            <div className={`
              fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-xl z-50
              transition-all duration-300 ease-in-out
              w-full md:w-80
              ${showAICoach ? 'translate-x-0' : 'translate-x-full'}
            `}>
              {/* Header with close button */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">AI Coach</h3>
                <button
                  onClick={() => setShowAICoach(false)}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                  title="Close AI Coach"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <AICoach
                studentId={userProfile?.student_id}
                mode="sidebar"
                context={connection.lastContext}
                onClose={() => setShowAICoach(false)}
                className="h-full"
                persistConnection={true}
              />
            </div>
          </>
        )}
      </div>
    </GlobalAICoachUIContext.Provider>
  );
};

// Hook to use the global AI Coach UI
export const useGlobalAICoachUI = () => {
  const context = useContext(GlobalAICoachUIContext);
  if (!context) {
    throw new Error('useGlobalAICoachUI must be used within GlobalAICoachProvider');
  }
  return context;
};

// Standalone toggle button component for use in other parts of the app
export const AICoachToggleButton: React.FC<{ 
  context?: any; 
  className?: string;
  variant?: 'icon' | 'button';
  size?: 'sm' | 'md' | 'lg';
}> = ({ 
  context, 
  className = "",
  variant = 'button',
  size = 'md'
}) => {
  const { showAICoach, toggleAICoach, setContext, notificationCount } = useGlobalAICoachUI();
  const { isAIConnected } = useAICoach();

  const handleToggle = () => {
    // Ensure the context is set when the user interacts with the button
    if (context) {
      setContext(context);
    }
    toggleAICoach();
  };

  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={handleToggle}
          className={`p-2 rounded-full transition-colors relative ${
            showAICoach 
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
              : 'hover:bg-gray-100 text-gray-600'
          } ${className}`}
          title="Toggle AI Coach (Ctrl+K)"
        >
          <MessageCircle className={`${
            size === 'sm' ? 'h-4 w-4' : 
            size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
          }`} />
          
          {/* Connection indicator */}
          {isAIConnected && (
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full"></div>
          )}
          
          {/* Notification badge */}
          {notificationCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1 animate-bounce">
              {notificationCount > 9 ? '9+' : notificationCount}
            </div>
          )}
        </button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleToggle}
      variant={showAICoach ? "default" : "outline"}
      size={size}
      className={`flex items-center space-x-2 relative ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
      <span>{showAICoach ? 'Hide' : 'Show'} AI Coach</span>
      
      {/* Connection indicator */}
      {isAIConnected && (
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
      )}
      
      {/* Notification badge */}
      {notificationCount > 0 && (
        <div className="absolute -top-2 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1 animate-bounce">
          {notificationCount > 9 ? '9+' : notificationCount}
        </div>
      )}
    </Button>
  );
};