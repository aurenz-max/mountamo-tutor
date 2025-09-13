# Engagement XP System - Frontend Integration Spec

## Overview

The engagement XP system now returns complete transaction data synchronously, enabling frontend components to display animations, notifications, and progress updates immediately when students complete activities.

## Response Data Model

All engagement endpoints now return a comprehensive `engagement_transaction` object containing all the data needed for frontend animations and notifications.

### Main Response Fields

```typescript
interface EngagementResponse {
  success: boolean;
  
  // Core XP Data
  xp_earned: number;           // Total XP earned (base + bonuses)
  base_xp: number;             // Base XP from the activity
  streak_bonus_xp: number;     // Additional XP from daily streak
  total_xp: number;            // User's new total XP
  
  // Level Progression
  level_up: boolean;           // Whether user leveled up
  new_level: number;           // User's new level
  previous_level: number;      // User's previous level
  
  // Streak System
  current_streak: number;      // User's new streak count
  previous_streak: number;     // User's previous streak count
  
  // Backward Compatibility
  points_earned: number;       // Same as xp_earned (legacy)
  
  // Structured Transaction Data
  engagement_transaction: EngagementTransaction;
}
```

### Engagement Transaction Object

```typescript
interface EngagementTransaction {
  activity_id: string;
  
  xp_breakdown: {
    base: number;              // Base XP from activity
    streak_bonus: number;      // Bonus XP from streak
    total: number;             // Total XP earned
  };
  
  level_change: {
    from: number;              // Previous level
    to: number;                // New level
    level_up: boolean;         // Whether leveled up
  };
  
  streak_change: {
    from: number;              // Previous streak
    to: number;                // New streak
    is_streak_day: boolean;    // Whether this extends streak
  };
}
```

## Updated Endpoints

The following endpoints now return complete engagement transaction data:

### 1. Daily Activities
- `POST /daily-activities/daily-plan/{student_id}/activities/{activity_id}/complete`
- `POST /daily-activities/daily-plan/{student_id}/complete`

### 2. Content Packages
- `POST /packages/{package_id}/sections/complete`
- `POST /packages/{package_id}/complete`

### 3. Problem Submissions
- `POST /problems/submit` (already uses engagement service)

## XP Values by Activity Type

```typescript
const XP_VALUES = {
  // Problem Activities
  problem_submitted_incorrect: 10,
  problem_submitted_correct: 25,
  problem_set_generated: 5,
  composable_problem_generated: 15,
  composable_problem_submitted: 30,
  
  // Session Activities
  practice_tutor_session_minute: 1,    // Max 20 XP per session
  
  // Daily Plan Activities
  daily_plan_activity_completed: 50,
  daily_plan_completed_bonus: 150,     // Bonus for completing entire plan
  
  // Content Package Activities
  content_package_section_completed: 20,
  content_package_completed_bonus: 200, // Bonus for completing entire package
  
  // Streak Bonuses
  daily_streak_base: 10,               // XP per day in streak
  daily_streak_max_bonus: 50           // Maximum streak bonus per day
};
```

## Frontend Implementation Guide

### 1. Animation Triggers

Use the transaction data to trigger appropriate animations:

```typescript
function handleEngagementResponse(response: EngagementResponse) {
  const { engagement_transaction } = response;
  
  // XP Gain Animation
  if (engagement_transaction.xp_breakdown.total > 0) {
    showXPGainAnimation(engagement_transaction.xp_breakdown);
  }
  
  // Level Up Animation
  if (engagement_transaction.level_change.level_up) {
    showLevelUpAnimation(
      engagement_transaction.level_change.from,
      engagement_transaction.level_change.to
    );
  }
  
  // Streak Animation
  if (engagement_transaction.streak_change.is_streak_day) {
    showStreakAnimation(engagement_transaction.streak_change.to);
  }
}
```

### 2. XP Breakdown Display

Show detailed XP breakdown to students:

```typescript
function displayXPBreakdown(xp_breakdown: XPBreakdown) {
  // Base XP
  if (xp_breakdown.base > 0) {
    showNotification(`+${xp_breakdown.base} XP for completing activity`);
  }
  
  // Streak Bonus
  if (xp_breakdown.streak_bonus > 0) {
    showNotification(`+${xp_breakdown.streak_bonus} XP streak bonus!`);
  }
  
  // Total
  showTotalXP(xp_breakdown.total);
}
```

### 3. Progress Updates

Update all progress indicators immediately:

```typescript
function updateProgressIndicators(response: EngagementResponse) {
  // Update XP displays
  updateTotalXP(response.total_xp);
  
  // Update level displays
  updateLevel(response.new_level);
  
  // Update streak displays
  updateStreak(response.current_streak);
  
  // Update progress bars, badges, etc.
  updateProgressBars(response);
}
```

### 4. Notification Examples

Example notifications based on the transaction data:

```typescript
const NOTIFICATION_TEMPLATES = {
  xpGain: (xp: number) => `+${xp} XP earned!`,
  levelUp: (level: number) => `🎉 Level ${level} reached!`,
  streakBonus: (bonus: number) => `🔥 +${bonus} XP streak bonus!`,
  dailyPlanComplete: (bonus: number) => `📚 Daily plan complete! +${bonus} bonus XP!`,
  packageComplete: (bonus: number) => `🏆 Package mastered! +${bonus} bonus XP!`
};
```

## Error Handling

The engagement service includes comprehensive error handling:

```typescript
interface EngagementError {
  success: false;
  xp_earned: 0;
  total_xp: 0;
  level_up: false;
  // ... other fields set to safe defaults
}
```

Frontend should handle errors gracefully while still providing user feedback.

## Implementation Checklist

- [ ] Update API response handlers to use new engagement transaction data
- [ ] Implement XP gain animations using `xp_breakdown`
- [ ] Implement level up animations using `level_change`
- [ ] Implement streak animations using `streak_change`
- [ ] Update progress bars and indicators to reflect new totals
- [ ] Add detailed XP breakdown notifications
- [ ] Test with different activity types to ensure proper animations
- [ ] Verify backward compatibility with existing point displays

## Notes

1. **Immediate Updates**: All engagement data is now calculated synchronously and returned immediately
2. **Rich Animations**: The detailed breakdown enables sophisticated animation sequences
3. **Backward Compatibility**: Legacy `points_earned` field is maintained for existing code
4. **Performance**: Profile updates happen in background after response is sent
5. **Reliability**: Comprehensive error handling ensures frontend always receives valid data

This implementation ensures students receive immediate, detailed feedback for all their learning activities with proper animations and notifications.