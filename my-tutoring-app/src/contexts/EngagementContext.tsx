"use client";

import React, { createContext, useContext, useCallback } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useAuth } from './AuthContext';

interface XPBreakdown {
  base: number;
  streak_bonus: number;
  total: number;
}

interface LevelChange {
  from: number;
  to: number;
  level_up: boolean;
}

interface StreakChange {
  from: number;
  to: number;
  is_streak_day: boolean;
}

interface EngagementTransaction {
  activity_id: string;
  xp_breakdown: XPBreakdown;
  level_change: LevelChange;
  streak_change: StreakChange;
}

interface EngagementResponse {
  success: boolean;
  
  // Core XP Data
  xp_earned: number;
  base_xp: number;
  streak_bonus_xp: number;
  total_xp: number;
  
  // Level Progression
  level_up: boolean;
  new_level: number;
  previous_level: number;
  
  // Streak System
  current_streak: number;
  previous_streak: number;
  
  // Backward Compatibility
  points_earned: number;
  
  // Structured Transaction Data
  engagement_transaction: EngagementTransaction;
}

interface EngagementContextValue {
  showXPToast: (xp: number) => void;
  showXPBreakdownToast: (breakdown: XPBreakdown) => void;
  showStreakToast: (streakChange: StreakChange) => void;
  showLevelUpModal: (levelChange: LevelChange) => void;
  processEngagementResponse: (response: EngagementResponse) => void;
  updateProfileFromEngagement: (response: EngagementResponse) => void;
}

const EngagementContext = createContext<EngagementContextValue | undefined>(undefined);

export const useEngagement = () => {
  const context = useContext(EngagementContext);
  if (!context) {
    throw new Error('useEngagement must be used within an EngagementProvider');
  }
  return context;
};

interface EngagementProviderProps {
  children: React.ReactNode;
}

export const EngagementProvider: React.FC<EngagementProviderProps> = ({ children }) => {
  const { updateUserProfile, userProfile } = useAuth();

  const showXPToast = useCallback((xp: number) => {
    toast.success(`+${xp} XP`, {
      duration: 2000,
      style: {
        background: '#10b981',
        color: 'white',
        border: 'none',
        fontSize: '16px',
        fontWeight: 'bold',
      },
      position: 'top-right',
    });
  }, []);

  const showXPBreakdownToast = useCallback((breakdown: XPBreakdown) => {
    const messages = [];
    
    if (breakdown.base > 0) {
      messages.push(`+${breakdown.base} XP for completing activity`);
    }
    
    if (breakdown.streak_bonus > 0) {
      messages.push(`+${breakdown.streak_bonus} XP streak bonus! 🔥`);
    }
    
    // Show base XP first
    if (breakdown.base > 0) {
      toast.success(`+${breakdown.base} XP`, {
        duration: 2000,
        style: {
          background: '#10b981',
          color: 'white',
          border: 'none',
          fontSize: '16px',
          fontWeight: 'bold',
        },
        position: 'top-right',
      });
    }
    
    // Show streak bonus with delay and different styling
    if (breakdown.streak_bonus > 0) {
      setTimeout(() => {
        toast.success(`+${breakdown.streak_bonus} XP Streak Bonus! 🔥`, {
          duration: 3000,
          style: {
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
          },
          position: 'top-right',
        });
      }, 500);
    }
    
    // Show total with another delay
    if (breakdown.total > breakdown.base) {
      setTimeout(() => {
        toast.success(`🎉 Total: +${breakdown.total} XP`, {
          duration: 2500,
          style: {
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: 'white',
            border: 'none',
            fontSize: '18px',
            fontWeight: 'bold',
          },
          position: 'top-center',
        });
      }, 1000);
    }
  }, []);

  const showStreakToast = useCallback((streakChange: StreakChange) => {
    if (streakChange.is_streak_day && streakChange.to > streakChange.from) {
      toast.success(`🔥 ${streakChange.to} Day Streak!`, {
        duration: 3000,
        style: {
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          color: 'white',
          border: 'none',
          fontSize: '16px',
          fontWeight: 'bold',
        },
        position: 'top-right',
      });
    }
  }, []);

  const showLevelUpModal = useCallback((levelChange: LevelChange) => {
    // Trigger confetti animation
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });

    // Show level up toast
    toast.success(`🎉 LEVEL UP! You've reached Level ${levelChange.to}!`, {
      duration: 5000,
      style: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        fontSize: '18px',
        fontWeight: 'bold',
        padding: '16px',
      },
      position: 'top-center',
    });
  }, []);

  const updateProfileFromEngagement = useCallback((response: EngagementResponse) => {
    if (!userProfile) return;

    const updates: any = {
      total_xp: response.total_xp,
      total_points: response.total_xp, // Backward compatibility
      current_streak: response.current_streak,
    };

    if (response.level_up && response.new_level) {
      updates.current_level = response.new_level;
      updates.level = response.new_level; // Backward compatibility
    }

    updateUserProfile(updates);
  }, [userProfile, updateUserProfile]);

  const processEngagementResponse = useCallback((response: EngagementResponse) => {
    console.log('🎉 Processing engagement response:', response);
    
    // Handle the engagement transaction data (ActivityResponse from backend)
    if (response.engagement_transaction) {
      const { engagement_transaction } = response;
      
      // Create XP breakdown from the actual backend structure
      const xpBreakdown: XPBreakdown = {
        base: engagement_transaction.base_xp || 0,
        streak_bonus: engagement_transaction.streak_bonus_xp || 0,
        total: engagement_transaction.xp_earned || 0
      };
      
      // Show XP breakdown with sequential animations
      if (xpBreakdown.total > 0) {
        showXPBreakdownToast(xpBreakdown);
      }
      
      // Show streak update if streak changed
      const streakChanged = engagement_transaction.current_streak !== engagement_transaction.previous_streak;
      if (streakChanged && engagement_transaction.current_streak > 0) {
        showStreakToast({
          is_streak_day: true,
          new_streak: engagement_transaction.current_streak,
          previous_streak: engagement_transaction.previous_streak || 0,
          bonus_xp: engagement_transaction.streak_bonus_xp || 0
        });
      }
      
      // Show level up celebration
      if (engagement_transaction.level_up) {
        setTimeout(() => {
          showLevelUpModal({
            level_up: true,
            new_level: engagement_transaction.new_level || 1,
            previous_level: engagement_transaction.previous_level || 1
          });
        }, 1500); // Delay to let XP animations finish first
      }
    } else {
      // Fallback: Handle responses without engagement_transaction (direct field access)
      console.log('📋 Using fallback mode - processing direct fields');
      
      // Create manual breakdown from direct fields
      const manualBreakdown: XPBreakdown = {
        base: response.base_xp || 0,
        streak_bonus: response.streak_bonus_xp || 0,
        total: response.xp_earned || 0
      };
      
      if (manualBreakdown.total > 0) {
        showXPBreakdownToast(manualBreakdown);
      }
      
      // Handle streak changes
      if (response.current_streak > response.previous_streak) {
        showStreakToast({
          from: response.previous_streak || 0,
          to: response.current_streak || 0,
          is_streak_day: true
        });
      }
      
      // Handle level up
      if (response.level_up && response.new_level) {
        setTimeout(() => {
          showLevelUpModal({
            from: response.previous_level || 1,
            to: response.new_level,
            level_up: true
          });
        }, 1500);
      }
    }

    // Update profile with new values
    updateProfileFromEngagement(response);
  }, [showXPToast, showXPBreakdownToast, showStreakToast, showLevelUpModal, updateProfileFromEngagement]);

  const value: EngagementContextValue = {
    showXPToast,
    showXPBreakdownToast,
    showStreakToast,
    showLevelUpModal,
    processEngagementResponse,
    updateProfileFromEngagement,
  };

  return (
    <EngagementContext.Provider value={value}>
      {children}
    </EngagementContext.Provider>
  );
};