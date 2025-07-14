// components/layout/GlobalAICoachToggle.tsx
'use client';

import React, { useState, createContext, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAICoach } from '@/contexts/AICoachContext'; // Import the main context
import AICoach from '@/components/dashboard/AICoach';
import { Button } from "@/components/ui/button";
import { MessageCircle } from 'lucide-react';

// This context will manage UI visibility and expose the primary context setter
interface GlobalAICoachUIType {
  showAICoach: boolean;
  setShowAICoach: (show: boolean) => void;
  setContext: (context: any) => void; // This will come from useAICoach
  currentContext: any; // This will also come from useAICoach
}

const GlobalAICoachUIContext = createContext<GlobalAICoachUIType | null>(null);

export const GlobalAICoachProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showAICoach, setShowAICoach] = useState(false);
  const { userProfile } = useAuth();
  
  // Use the main AICoachContext as the source of truth
  const { setContext, connection, isAIConnected } = useAICoach();

  return (
    <GlobalAICoachUIContext.Provider value={{ 
      showAICoach, 
      setShowAICoach, 
      setContext, // Pass the original setContext function directly
      currentContext: connection.lastContext // Use the state from the single source of truth
    }}>
      <div className="relative">
        {children}
        
        {showAICoach && (
          <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50">
            <AICoach
              studentId={userProfile?.student_id}
              mode="sidebar"
              context={connection.lastContext} // Always pass the true, current context
              onClose={() => setShowAICoach(false)}
              className="h-full"
              persistConnection={true}
            />
          </div>
        )}
      </div>
    </GlobalAICoachUIContext.Provider>
  );
};

// Rename the hook for clarity
export const useGlobalAICoachUI = () => {
  const context = useContext(GlobalAICoachUIContext);
  if (!context) {
    throw new Error('useGlobalAICoachUI must be used within GlobalAICoachProvider');
  }
  return context;
};

// Update the toggle button to use the new hook
export const AICoachToggleButton: React.FC<{ context?: any; className?: string }> = ({ 
  context, 
  className = "" 
}) => {
  const { showAICoach, setShowAICoach, setContext } = useGlobalAICoachUI();
  const { isAIConnected } = useAICoach();

  const handleToggle = () => {
    // Ensure the context is set when the user interacts with the button
    if (context) {
      setContext(context);
    }
    setShowAICoach(!showAICoach);
  };

  return (
    <Button
      onClick={handleToggle}
      variant={showAICoach ? "default" : "outline"}
      className={`flex items-center space-x-2 ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
      <span>{showAICoach ? 'Hide' : 'Show'} AI Coach</span>
      {isAIConnected && (
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
      )}
    </Button>
  );
};