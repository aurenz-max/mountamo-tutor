# PRD: Practice Page Quick Start Enhancement

**Product:** AI Tutoring Platform
**Feature:** Practice Page Engagement Optimization
**Status:** Draft for Review
**Created:** 2025-11-06
**Owner:** Product Team
**Target Release:** Q1 2025

---

## Executive Summary

The current practice page requires 3-4 clicks through nested dropdowns before students can begin practicing, creating significant friction and reducing engagement. Despite having rich personalized recommendations from our Daily Activities and Weekly Planner systems (20-30 curated activities), these are not surfaced on the practice page.

This PRD proposes a **Quick Start** enhancement that surfaces personalized activities immediately, enabling one-click practice starts while maintaining curriculum browsing for student autonomy.

**Expected Impact:**
- 📈 Increase practice session starts by 40-60%
- ⏱️ Reduce time-to-first-problem from ~45s to ~5s
- 🎯 Improve daily activity completion rates by 25-35%
- 💪 Increase student engagement and retention

---

## Problem Statement

### Current User Journey (High Friction)
1. Navigate to `/practice` → See empty page
2. Click subject dropdown → Select subject (e.g., "Mathematics")
3. Wait for curriculum to load → See collapsed tree
4. Expand unit → Expand skill → Select subskill
5. Click "Start Practice" button
6. **Finally** see first problem

**Result:** ~45 seconds and 4-5 clicks before practice begins

### Key Issues
1. **Empty Start State**: No immediate value when page loads
2. **Decision Paralysis**: Students must choose from hundreds of curriculum items
3. **Hidden Recommendations**: We generate 20-30 personalized activities daily but don't show them
4. **Lost Context**: Students coming from dashboard lose their recommended activity context
5. **Engagement Drop-off**: High friction causes 30-40% abandonment (estimated)

### Available but Unused Assets
- ✅ **Daily Activities API** (`/daily-activities/daily-plan/{student_id}/activities`)
  - 3-8 AI-powered personalized activities per day
  - BigQuery analytics + AI recommendations
  - Complete curriculum metadata
  - Activity completion tracking

- ✅ **Weekly Planner API** (`/weekly-planner/{student_id}/current`)
  - 15-30 activities for the entire week
  - Organized by day with themes and objectives
  - Activity status tracking (pending/in-progress/completed)
  - Can filter by specific days

---

## Goals & Success Metrics

### Primary Goals
1. **Reduce friction** to practice session start
2. **Increase practice engagement** through personalized recommendations
3. **Improve activity completion rates** from daily/weekly plans
4. **Maintain student autonomy** with curriculum browsing option

### Success Metrics

| Metric | Current | Target (3 months) | Measurement |
|--------|---------|-------------------|-------------|
| Time to first problem | ~45s | <10s | Analytics tracking |
| Practice session starts | Baseline | +40-60% | Daily active users |
| Daily activity completion | Baseline | +25-35% | Completion API calls |
| Practice page bounce rate | ~35% (est.) | <20% | Analytics tracking |
| Clicks to practice start | 4-5 clicks | 1-2 clicks | User flow tracking |

### Secondary Metrics
- Session duration (expect increase with lower friction)
- Problems completed per session
- Return rate to practice page within 24h
- Weekly planner activity completion rate

---

## User Stories

### Student Personas

**Primary Persona: Engaged Emma**
- 7th grader, uses platform daily for 20-30 minutes
- Follows daily plan consistently
- Values efficiency and clear guidance
- **Pain Point**: Current practice page wastes time on navigation

**Secondary Persona: Autonomous Alex**
- 10th grader, uses platform 2-3x/week for specific topics
- Prefers to choose own learning path
- Sometimes follows recommendations, sometimes explores independently
- **Pain Point**: Wants quick access to both recommendations AND free exploration

### User Stories

**Epic: Quick Start Practice**

1. **As an engaged student**, I want to see my recommended practice activities immediately when I open the practice page, so I can start practicing without clicking through menus.
   - **Acceptance Criteria:**
     - Daily activities load and display within 2 seconds
     - Activities show clear titles and skill descriptions
     - One-click button to start each activity
     - Visual indicators for completed activities

2. **As a student following my daily plan**, I want to see which activities I've already completed today, so I can track my progress and focus on remaining work.
   - **Acceptance Criteria:**
     - Completed activities show visual indicator (checkmark, strikethrough, etc.)
     - Progress bar or counter shows X/Y activities completed
     - Completed activities move to bottom or separate section

3. **As an autonomous student**, I want the option to browse the full curriculum, so I can choose topics outside my recommended activities when I want to explore.
   - **Acceptance Criteria:**
     - Clear "Browse Curriculum" or "Explore Topics" button/toggle
     - Existing SyllabusSelector remains fully functional
     - Easy switch between Quick Start and Browse modes

4. **As a student**, I want to see why an activity is recommended to me, so I can understand my learning path and make informed decisions.
   - **Acceptance Criteria:**
     - Each activity shows source indicator (AI recommendation, BigQuery, Daily Plan, Weekly Plan)
     - Optional tooltip/modal with recommendation reasoning
     - Priority/difficulty indicators where relevant

5. **As a student returning to practice later**, I want to see activities I started but didn't finish, so I can continue where I left off.
   - **Acceptance Criteria:**
     - "In Progress" activities display prominently
     - Shows partial completion (e.g., "3/5 problems completed")
     - "Continue" button to resume where left off

---

## Detailed Requirements

### Functional Requirements

#### FR-1: Quick Start Section
**Priority: P0 (Must Have)**

Display a prominent "Quick Start" section at the top of the practice page showing personalized activities.

**Specifications:**
- Load activities from `/daily-activities/daily-plan/{student_id}/activities` API
- Display 3-8 activities in card/list format
- Each activity card includes:
  - Skill/subskill description
  - Subject indicator (badge/icon)
  - Estimated time (if available from metadata)
  - Source indicator (Daily Plan, Weekly Plan, AI Recommended)
  - Status badge (New, In Progress, Completed)
  - One-click "Start Practice" button
- Sort order: In Progress → New → Completed

**API Endpoints:**
```typescript
// Primary source
GET /daily-activities/daily-plan/{student_id}/activities

// Fallback/enhancement source
GET /weekly-planner/{student_id}/current
GET /weekly-planner/{student_id}/day/{day_index}
```

**Edge Cases:**
- No activities available → Show fallback message with "Browse Curriculum" CTA
- API error → Graceful fallback to Browse mode with error message
- Slow API response → Show loading skeleton (max 2s), then fallback

---

#### FR-2: Activity Cards
**Priority: P0 (Must Have)**

Interactive cards representing each recommended activity with clear CTAs.

**Card Layout:**
```
┌─────────────────────────────────────┐
│ [Icon] Mathematics • Daily Plan     │ ← Header with subject & source
│ ─────────────────────────────────   │
│ Solving Linear Equations            │ ← Skill description
│ Apply inverse operations to solve   │ ← Subskill description
│                                     │
│ ⏱️ ~15 min  📊 Ready to learn       │ ← Metadata
│ [Start Practice →]         [✓]      │ ← CTA + Status
└─────────────────────────────────────┘
```

**States:**
1. **New** (default)
   - Full color, prominent CTA
   - "Start Practice" button

2. **In Progress**
   - Highlighted border/background
   - "Continue Practice" button
   - Progress indicator: "3/5 problems completed"

3. **Completed**
   - Muted colors, checkmark icon
   - "Practice Again" button (secondary style)
   - Move to bottom of list

**Interactions:**
- Click card → Start practice (same as clicking button)
- Hover → Highlight and show additional info tooltip
- Long-press/right-click → Show context menu (optional):
  - View in curriculum tree
  - Skip this activity
  - See recommendation reason

---

#### FR-3: Browse Curriculum Toggle
**Priority: P0 (Must Have)**

Allow students to switch between Quick Start view and full curriculum browser.

**Implementation Options:**

**Option A: Tab Interface**
```
[ Quick Start ] [ Browse Curriculum ]
```

**Option B: Primary/Secondary Layout**
```
┌──────────────────────────────┐
│ Quick Start (default view)   │
│ [Activity cards...]          │
│                              │
│ ──── or ────                 │
│                              │
│ [📚 Browse Full Curriculum] │ ← Button to expand
└──────────────────────────────┘
```

**Option C: Expandable Section** (Recommended)
```
┌──────────────────────────────┐
│ 🎯 Recommended for You       │
│ [Activity cards...]          │
└──────────────────────────────┘

┌──────────────────────────────┐
│ 📚 Browse Curriculum [▼]     │ ← Collapsed by default
│   [Expands to show           │
│    SyllabusSelector tree]    │
└──────────────────────────────┘
```

**Behavior:**
- Default to Quick Start view on page load
- Persist user's last view preference in localStorage
- Smooth transition between views (no page reload)
- Both views accessible without losing state

---

#### FR-4: Activity Completion Integration
**Priority: P1 (Should Have)**

When student completes an activity, update status in both UI and backend.

**Flow:**
1. Student starts activity from Quick Start → Opens ProblemSet
2. Student completes X/5 problems
3. ProblemSet completion triggers callback
4. Practice page updates activity status:
   - Mark as completed in UI (checkmark, move to bottom)
   - Call completion API: `POST /daily-activities/daily-plan/{student_id}/activities/{activity_id}/complete`
5. Show success feedback (toast notification, animation)
6. Update progress counter: "4/8 activities completed today"

**Additional Details:**
- Support partial completion (in progress state)
- Handle offline scenarios (queue completion for later sync)
- Celebrate milestones (e.g., "All daily activities complete!")

---

#### FR-5: Weekly Plan Integration
**Priority: P2 (Nice to Have)**

Show activities from weekly planner for multi-day visibility and planning.

**Options:**

**Option A: Separate "This Week" Section**
```
🎯 Today's Activities (3)
[Card] [Card] [Card]

📅 This Week's Plan (12 remaining)
Mon: ✓✓✓ (3/3 completed)
Tue: ✓✓◯ (2/3 completed)
Wed: ◯◯◯ (0/3) ← Today
Thu: ◯◯◯◯ (0/4)
...
```

**Option B: Unified View with Day Filter**
```
🎯 Your Practice Activities
[ Today (3) ] [ This Week (15) ] [ Browse All ]
```

**Implementation:**
- Fetch from `/weekly-planner/{student_id}/current`
- Show current day's activities by default
- Optional: Allow viewing other days
- Track completion across weekly plan
- Visual weekly progress indicator

---

### Non-Functional Requirements

#### NFR-1: Performance
- Initial page load: <2s to interactive
- Activity data fetch: <1s
- Card render: <100ms for 8 cards
- Smooth transitions: 60fps animations

#### NFR-2: Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader friendly (proper ARIA labels)
- Focus management when switching views

#### NFR-3: Mobile Responsiveness
- Fully responsive design
- Touch-friendly card interactions (min 44x44px targets)
- Optimized for mobile network conditions
- Native app feel (if PWA)

#### NFR-4: Error Handling
- Graceful degradation if APIs fail
- Clear error messages with recovery actions
- Offline support (show cached activities)
- Retry mechanisms for failed requests

---

## Technical Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                Practice Page Component               │
│  ┌────────────────┐        ┌──────────────────┐    │
│  │  Quick Start   │        │ Browse Curriculum│    │
│  │   Section      │        │    Section       │    │
│  └────────────────┘        └──────────────────┘    │
│         ↓                           ↓               │
│  ┌──────────────────────────────────────────────┐  │
│  │        Activity Cards / Syllabus Selector     │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │           API Integration Layer               │
    │  • Daily Activities API                       │
    │  • Weekly Planner API                         │
    │  • Completion Tracking API                    │
    └──────────────────────────────────────────────┘
```

### Component Structure

```typescript
// New components to create
/my-tutoring-app/src/components/practice/
├── QuickStartSection.tsx          // Main Quick Start container
├── ActivityCard.tsx               // Individual activity card
├── ActivityCardSkeleton.tsx       // Loading state
├── BrowseCurriculumToggle.tsx    // Toggle between views
├── WeeklyProgressIndicator.tsx   // Optional weekly view
└── hooks/
    ├── useDailyActivities.ts     // Fetch daily activities
    ├── useActivityCompletion.ts  // Handle completion
    └── useWeeklyPlan.ts          // Fetch weekly plan

// Modified components
/my-tutoring-app/src/app/practice/
└── page.tsx                       // Update to include Quick Start
```

### Data Models

```typescript
// Activity from Daily Activities API
interface DailyActivity {
  activity_id: string;
  activity_type: 'practice_session' | 'assessment' | 'review';
  skill_id: string;
  subskill_id: string;
  skill_description: string;
  subskill_description: string;
  subject: string;
  unit_title?: string;
  difficulty_level?: number;
  estimated_time_minutes?: number;
  points?: number;

  // Status tracking
  is_complete: boolean;
  completion_date?: string;
  progress?: {
    completed: number;
    total: number;
  };

  // Recommendation metadata
  source_type: 'ai_recommendations' | 'bigquery_recommendations' | 'fallback';
  source_details?: {
    ai_reason?: string;
    readiness_status?: string;
    mastery_level?: number;
    priority_rank?: number;
  };

  // Curriculum metadata
  curriculum_metadata?: {
    subject: string;
    unit: { id: string; title: string };
    skill: { id: string; description: string };
    subskill: { id: string; description: string };
  };
}

// Activity Card Props
interface ActivityCardProps {
  activity: DailyActivity;
  onStartPractice: (activity: DailyActivity) => void;
  onMarkComplete?: (activityId: string) => void;
  status: 'new' | 'in_progress' | 'completed';
  showProgress?: boolean;
}

// Quick Start Section Props
interface QuickStartSectionProps {
  studentId: number;
  onActivityStart: (activity: DailyActivity) => void;
  className?: string;
}
```

### API Integration

#### 1. Fetch Daily Activities

```typescript
// hooks/useDailyActivities.ts
import { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';

export function useDailyActivities(studentId: number) {
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const response = await authApi.get(
          `/daily-activities/daily-plan/${studentId}/activities`
        );

        // Transform API response to DailyActivity[]
        const enhancedActivities = response.activities.map(act => ({
          ...act,
          // Add any UI-specific transformations
        }));

        setActivities(enhancedActivities);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch daily activities:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (studentId) {
      fetchActivities();
    }
  }, [studentId]);

  return { activities, loading, error, refetch: fetchActivities };
}
```

#### 2. Handle Activity Completion

```typescript
// hooks/useActivityCompletion.ts
import { useState } from 'react';
import { authApi } from '@/lib/authApiClient';

export function useActivityCompletion(studentId: number) {
  const [completing, setCompleting] = useState(false);

  const completeActivity = async (activityId: string, pointsEarned?: number) => {
    try {
      setCompleting(true);

      await authApi.post(
        `/daily-activities/daily-plan/${studentId}/activities/${activityId}/complete`,
        { points_earned: pointsEarned }
      );

      // Show success toast
      toast.success('Activity completed! 🎉');

      return true;
    } catch (err) {
      console.error('Failed to complete activity:', err);
      toast.error('Failed to mark activity as complete');
      return false;
    } finally {
      setCompleting(false);
    }
  };

  return { completeActivity, completing };
}
```

#### 3. Start Practice from Activity

```typescript
// In page.tsx
const handleActivityStart = (activity: DailyActivity) => {
  // Convert DailyActivity to the format expected by ProblemSet
  const topicData = {
    subject: activity.subject,
    selection: {
      subject: activity.subject,
      unit: activity.curriculum_metadata?.unit.id,
      skill: activity.curriculum_metadata?.skill.id,
      subskill: activity.curriculum_metadata?.subskill.id,
    },
    // Include full metadata
    unit: activity.curriculum_metadata?.unit,
    skill: activity.curriculum_metadata?.skill,
    subskill: activity.curriculum_metadata?.subskill,
    // Track that this came from Quick Start
    autoStart: true,
    fromQuickStart: true,
    activityId: activity.activity_id,
  };

  setSelectedTopic(topicData);
};
```

### State Management

```typescript
// Practice page state
const [viewMode, setViewMode] = useState<'quick-start' | 'browse'>('quick-start');
const [activities, setActivities] = useState<DailyActivity[]>([]);
const [completedActivityIds, setCompletedActivityIds] = useState<Set<string>>(new Set());
const [selectedTopic, setSelectedTopic] = useState(null);

// Persist view mode preference
useEffect(() => {
  const savedMode = localStorage.getItem('practice-view-mode');
  if (savedMode) setViewMode(savedMode as 'quick-start' | 'browse');
}, []);

useEffect(() => {
  localStorage.setItem('practice-view-mode', viewMode);
}, [viewMode]);
```

---

## Design Specifications

### Visual Design

#### Layout Option A: Vertical Stack (Recommended for MVP)

```
┌────────────────────────────────────────────────────┐
│  [Dashboard] / Practice Problems                   │
│                                                    │
│  🎯 Recommended for You Today                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  3 of 6 activities completed today                 │
│                                                    │
│  ┌──────────────────┐  ┌──────────────────┐      │
│  │ 🔢 Mathematics   │  │ 🔢 Mathematics   │      │
│  │ Solving Linear   │  │ Factoring        │      │
│  │ Equations        │  │ Quadratics       │      │
│  │                  │  │                  │      │
│  │ ⏱️ 15 min        │  │ ⏱️ 20 min        │      │
│  │ [Start ➜]     ✓  │  │ [Continue ➜]     │      │
│  └──────────────────┘  └──────────────────┘      │
│                                                    │
│  ┌──────────────────┐  ┌──────────────────┐      │
│  │ 📊 Statistics    │  │ 🔬 Science       │      │
│  │ Mean & Median    │  │ Cell Division    │      │
│  │                  │  │                  │      │
│  │ ⏱️ 12 min        │  │ ⏱️ 18 min        │      │
│  │ [Start ➜]        │  │ [Start ➜]        │      │
│  └──────────────────┘  └──────────────────┘      │
│                                                    │
│  ───── or explore on your own ─────               │
│                                                    │
│  [ 📚 Browse Full Curriculum ▼ ]                  │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### Layout Option B: Split View (For Power Users)

```
┌────────────────────────────────────────────────────┐
│  [Dashboard] / Practice                            │
├──────────────────────┬─────────────────────────────┤
│  🎯 Quick Start (6)  │  📚 Browse Curriculum       │
│  ━━━━━━━━━━━━━━━━━  │  ─────────────────────      │
│                      │  [ Mathematics ▼ ]          │
│  [Activity Card]     │                             │
│  [Activity Card]     │  • Algebra                  │
│  [Activity Card]     │    • Linear Equations       │
│  [Activity Card]     │      • Solving for x        │
│  [Activity Card]     │      • Word Problems        │
│  [Activity Card]     │    • Quadratics             │
│                      │      • Factoring ⭐         │
│  [View All →]        │      • Completing Square    │
│                      │                             │
└──────────────────────┴─────────────────────────────┘
```

### Color & Typography

**Activity Card States:**
- **New**: Blue accent (`bg-blue-50`, `border-blue-200`)
- **In Progress**: Amber accent (`bg-amber-50`, `border-amber-300`, pulsing animation)
- **Completed**: Green accent (`bg-green-50`, `border-green-200`, muted opacity)

**Icons & Badges:**
- Subject icons: Use emoji or lucide-react icons (🔢📊🔬📚)
- Source badges: Small pill badges
  - AI Recommended: `bg-purple-100 text-purple-700`
  - Daily Plan: `bg-blue-100 text-blue-700`
  - Weekly Plan: `bg-indigo-100 text-indigo-700`
- Status indicators: Checkmark (✓), Progress dots (●●○○○)

**Typography:**
- Section headers: `text-lg font-semibold`
- Activity titles: `text-base font-medium`
- Metadata: `text-sm text-gray-600`
- Buttons: `text-sm font-medium`

### Animations & Interactions

**Card Hover:**
```css
.activity-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 150ms ease-in-out;
}
```

**Completion Animation:**
- Checkmark fade-in with scale
- Card background color transition
- Optional confetti effect for daily plan completion

**Loading States:**
- Skeleton cards with shimmer animation
- Progressive loading (show cards as they load)
- Loading shouldn't block interaction

---

## User Experience Flow

### Flow 1: Engaged Student (Quick Start)

```
1. Student navigates to /practice
   ↓
2. Page loads with Quick Start section visible
   (Loading skeletons → Activity cards in <2s)
   ↓
3. Student sees "Solving Linear Equations" as first activity
   (Source: Daily Plan, Status: New, Time: 15 min)
   ↓
4. Student clicks "Start Practice" button
   ↓
5. ProblemSet opens with 5 problems
   ↓
6. Student completes 5/5 problems
   ↓
7. Completion triggers:
   - Activity marked complete (API call)
   - Checkmark appears on card
   - Toast: "Activity completed! 🎉"
   - Progress updates: "2/6 activities completed"
   ↓
8. Student sees next activity highlighted
   ↓
9. Repeat or return to dashboard
```

**Time to practice:** ~5 seconds (vs. ~45s currently)

### Flow 2: Autonomous Student (Browse Mode)

```
1. Student navigates to /practice
   ↓
2. Sees Quick Start section with recommendations
   ↓
3. Student wants to practice something specific
   ↓
4. Clicks "Browse Full Curriculum" button
   ↓
5. Curriculum tree expands (existing SyllabusSelector)
   ↓
6. Student navigates tree to find desired topic
   ↓
7. Clicks "Start Practice"
   ↓
8. ProblemSet opens
```

**Benefit:** Recommendations visible but not blocking, student maintains autonomy

### Flow 3: Returning Student (Resume Session)

```
1. Student returns to /practice after partial completion
   ↓
2. Page loads with Quick Start section
   ↓
3. "In Progress" activity shown first:
   "📊 Statistics - Mean & Median"
   "3/5 problems completed"
   [Continue Practice] button highlighted
   ↓
4. Student clicks "Continue"
   ↓
5. ProblemSet opens at problem #4
   ↓
6. Student completes remaining problems
```

**Benefit:** Seamless resume experience, no lost progress

---

## Implementation Phases

### Phase 1: MVP (2-3 weeks)
**Goal:** Basic Quick Start functionality with daily activities

- [ ] Create `QuickStartSection` component
- [ ] Create `ActivityCard` component with 3 states (new/in-progress/completed)
- [ ] Implement `useDailyActivities` hook
- [ ] Implement `useActivityCompletion` hook
- [ ] Update practice page to show Quick Start section
- [ ] Add "Browse Curriculum" collapsible section
- [ ] Basic responsive design (desktop + mobile)
- [ ] Activity start → ProblemSet integration
- [ ] Completion tracking integration

**Success Criteria:**
- Students can see 3-8 recommended activities on page load
- One-click practice start works for all activities
- Completion status updates in real-time
- No regression in existing curriculum browser

### Phase 2: Enhanced UX (1-2 weeks)
**Goal:** Polish, animations, and improved feedback

- [ ] Loading skeletons for activity cards
- [ ] Smooth animations (card hover, completion, transitions)
- [ ] Toast notifications for completion events
- [ ] Progress indicators ("3/6 completed today")
- [ ] Activity card metadata (time, difficulty, source)
- [ ] Improved mobile responsiveness
- [ ] Accessibility improvements (keyboard nav, screen readers)
- [ ] Error handling and fallback states

**Success Criteria:**
- Page feels fast and responsive
- Clear visual feedback for all interactions
- WCAG AA compliance
- Mobile experience is excellent

### Phase 3: Weekly Plan Integration (1-2 weeks)
**Goal:** Multi-day visibility and planning

- [ ] Fetch and parse weekly plan data
- [ ] Create `WeeklyProgressIndicator` component
- [ ] Add "This Week" tab/section (optional)
- [ ] Cross-day activity tracking
- [ ] Weekly completion celebration
- [ ] Advanced filters (by subject, by day, by status)

**Success Criteria:**
- Students can view weekly plan activities
- Weekly progress is visible and motivating
- Daily and weekly plans sync correctly

### Phase 4: Analytics & Optimization (Ongoing)
**Goal:** Measure impact and iterate

- [ ] Implement analytics tracking:
  - Time to first problem
  - Click patterns (Quick Start vs. Browse)
  - Activity completion rates
  - Session duration
  - Bounce rates
- [ ] A/B testing framework:
  - Test different card layouts
  - Test Quick Start vs. Browse default
  - Test recommendation algorithms
- [ ] Performance monitoring
- [ ] User feedback collection

**Success Criteria:**
- Clear metrics showing impact vs. baseline
- Data-driven decisions for iterations
- Performance stays within targets

---

## Technical Considerations

### Edge Cases & Error Handling

1. **No activities available**
   - Show friendly empty state: "No activities planned for today"
   - CTA: "Browse Curriculum" or "Generate Daily Plan"
   - Fallback to Browse mode automatically

2. **API failures**
   - Retry with exponential backoff (3 attempts)
   - Show cached activities if available
   - Graceful degradation to Browse mode
   - Clear error messaging with recovery actions

3. **Slow network**
   - Show loading skeletons immediately
   - Progressive rendering (show cards as they load)
   - Timeout after 5s → show error with retry

4. **Activity metadata incomplete**
   - Gracefully handle missing fields
   - Use sensible defaults (e.g., "15 min" if no time estimate)
   - Log missing data for backend improvement

5. **Student completes activity outside practice page**
   - Implement real-time sync (polling or WebSocket)
   - Refresh activity status on page focus
   - Handle stale data gracefully

### Performance Optimizations

1. **Data fetching**
   - Parallel API calls (daily activities + weekly plan)
   - Cache activities in React state
   - Implement stale-while-revalidate pattern
   - Prefetch on dashboard hover (optional)

2. **Rendering**
   - Lazy load card components
   - Virtual scrolling for 20+ activities (unlikely but safe)
   - Memoize card renders
   - Optimize re-renders with React.memo

3. **Bundle size**
   - Code split Quick Start components
   - Dynamic import for Browse Curriculum
   - Optimize icon imports

### Security & Privacy

1. **Student data protection**
   - Ensure all API calls use authentication
   - No sensitive data in localStorage (only IDs)
   - Respect user privacy in analytics

2. **Input validation**
   - Validate student IDs
   - Sanitize activity IDs
   - Prevent XSS in activity descriptions

### Scalability

1. **Backend considerations**
   - Daily activities API should support pagination
   - Consider caching layer (Redis) for frequent requests
   - Monitor API performance as user base grows

2. **Frontend considerations**
   - Component design supports 100+ activities
   - Graceful handling of large datasets
   - Consider virtualization if needed

---

## Open Questions & Decisions Needed

### Product Decisions

1. **Default view preference**
   - Q: Should Quick Start be default for all users, or only after first visit?
   - Options:
     - A) Always default to Quick Start
     - B) Remember last used view (localStorage)
     - C) Quick Start for first-time users, then remember preference
   - **Recommendation:** Option C (best of both worlds)

2. **Activity card information density**
   - Q: How much information should each card show?
   - Current proposal: Subject, skill/subskill, time, source, status
   - Alternatives:
     - Minimal (just skill name + CTA)
     - Expanded (add difficulty, mastery level, recommendation reasoning)
   - **Recommendation:** Start minimal, add expandable details on hover/click

3. **Curriculum browser placement**
   - Q: Where should Browse Curriculum live?
   - Options:
     - A) Collapsible section below Quick Start (current proposal)
     - B) Separate tab
     - C) Modal/drawer
     - D) Split view (side-by-side)
   - **Recommendation:** Option A for MVP, can iterate based on usage

4. **Weekly plan integration timing**
   - Q: Should weekly plan be part of MVP or Phase 2?
   - **Recommendation:** Phase 3 (get daily activities working well first)

### Design Decisions

1. **Card layout**
   - Q: Grid vs. List layout for activity cards?
   - Options:
     - Grid (2-3 columns): More visual, fits more on screen
     - List (1 column): More readable, easier on mobile
   - **Recommendation:** Grid on desktop, list on mobile (responsive)

2. **Completion celebration**
   - Q: How elaborate should completion feedback be?
   - Options:
     - Minimal (just checkmark)
     - Moderate (checkmark + toast)
     - Elaborate (animation + confetti + modal)
   - **Recommendation:** Moderate for activity completion, elaborate for daily plan completion

3. **In-progress indicators**
   - Q: How to show partial completion?
   - Options:
     - Text: "3/5 problems completed"
     - Progress bar
     - Dots: ●●●○○
   - **Recommendation:** Text + progress bar for clarity

### Technical Decisions

1. **State management**
   - Q: Do we need Redux/Zustand or is React state sufficient?
   - **Recommendation:** React state + hooks sufficient for MVP, can add global state later if needed

2. **Real-time sync**
   - Q: How to handle activity completion from other devices?
   - Options:
     - Polling (every 30-60s)
     - WebSocket
     - Refresh on page focus
   - **Recommendation:** Refresh on page focus for MVP, consider WebSocket if it becomes an issue

3. **Caching strategy**
   - Q: Should we cache activities, and for how long?
   - **Recommendation:** Cache for 5 minutes, invalidate on completion events

---

## Success Validation

### Pre-Launch Checklist

- [ ] All Phase 1 features implemented and tested
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Accessibility audit passed (WCAG AA)
- [ ] Performance targets met (< 2s load time)
- [ ] Error handling tested for all edge cases
- [ ] Analytics tracking implemented
- [ ] User acceptance testing completed
- [ ] Documentation updated (API docs, component docs)

### Post-Launch Monitoring (First 30 Days)

**Week 1-2: Stability & Bug Fixes**
- Monitor error rates and crash reports
- Track API response times
- Gather initial user feedback
- Fix critical bugs

**Week 3-4: Early Performance Analysis**
- Compare metrics to baseline:
  - Practice session starts
  - Time to first problem
  - Activity completion rates
  - User satisfaction (surveys/feedback)
- Identify friction points
- Plan iteration priorities

**Month 2-3: Optimization & Iteration**
- A/B test variations
- Implement Phase 2 enhancements
- Address user feedback
- Optimize based on analytics

### Long-Term Success Metrics (3-6 months)

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Practice session starts | +40% | +60% |
| Daily activity completion | +25% | +35% |
| Time to first problem | <10s | <5s |
| Practice page bounce rate | <20% | <15% |
| User satisfaction (NPS) | +10 points | +15 points |
| Weekly active practice users | +30% | +50% |

---

## Dependencies & Risks

### Dependencies

1. **Backend APIs** (Critical Path)
   - Daily activities API must be stable and fast
   - Weekly planner API must be accessible
   - Completion tracking API must be reliable
   - **Mitigation:** Work closely with backend team, have fallback plans

2. **Design System** (Medium Priority)
   - Need consistent card components
   - Need loading skeleton patterns
   - **Mitigation:** Use existing shadcn/ui components, create custom if needed

3. **Analytics Infrastructure** (Medium Priority)
   - Need tracking system for success metrics
   - **Mitigation:** Use existing analytics, can add tracking later if not ready

### Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Daily activities API too slow | High | Medium | Cache aggressively, show loading states, have fallback |
| Students ignore Quick Start, still use Browse | High | Low | Make Quick Start compelling (good recommendations, fast, clear value) |
| Activity recommendations are poor quality | High | Medium | Work with data team to improve recommendation algorithm |
| Mobile experience is clunky | Medium | Medium | Prioritize mobile testing, iterate quickly |
| Breaks existing curriculum browser | High | Low | Thorough testing, feature flag for rollback |
| Performance degrades with many activities | Medium | Low | Implement virtualization, pagination |

---

## Stakeholder Sign-off

**Required Approvals:**

- [ ] **Product Owner** - Overall PRD approval
- [ ] **Engineering Lead** - Technical feasibility and timeline
- [ ] **Design Lead** - UX/UI design approval
- [ ] **Backend Team** - API availability and support
- [ ] **Data Science Team** - Recommendation algorithm quality
- [ ] **QA Lead** - Testing strategy and timeline

**Next Steps:**
1. Review PRD with stakeholders
2. Gather feedback and iterate on requirements
3. Create detailed technical design doc (engineering)
4. Create detailed mockups/prototypes (design)
5. Break down into sprint-sized tasks
6. Kick off Phase 1 development

---

## Appendix

### A. API Response Examples

**Daily Activities Response:**
```json
{
  "student_id": 12345,
  "date": "2025-11-06",
  "activities": [
    {
      "activity_id": "daily-act-001",
      "activity_type": "practice_session",
      "subject": "mathematics",
      "skill_description": "Solving Linear Equations",
      "subskill_description": "Solve equations using inverse operations",
      "skill_id": "math_alg_linear_eq",
      "subskill_id": "math_alg_linear_eq_inverse",
      "estimated_time_minutes": 15,
      "points": 50,
      "is_complete": false,
      "source_type": "ai_recommendations",
      "source_details": {
        "ai_reason": "You've mastered the basics, ready for inverse operations",
        "priority_rank": 1
      },
      "curriculum_metadata": {
        "subject": "mathematics",
        "unit": {"id": "algebra", "title": "Algebra Fundamentals"},
        "skill": {"id": "linear_eq", "description": "Solving Linear Equations"},
        "subskill": {"id": "inverse_ops", "description": "Using Inverse Operations"}
      }
    }
  ],
  "summary": {
    "total_activities": 6,
    "total_points": 300,
    "personalization_source": "ai_recommendations"
  }
}
```

### B. User Research Insights

*[Placeholder for user research findings once available]*
- Surveys on current practice page pain points
- Session recordings showing navigation friction
- User interviews about learning preferences
- A/B test results from similar features

### C. Competitive Analysis

*[Placeholder for competitive research]*
- Khan Academy: Smart practice flow
- Duolingo: Quick lesson starts
- IXL: Skill recommendations
- Brilliant.org: Guided learning paths

### D. Accessibility Requirements

**WCAG 2.1 AA Compliance:**
- All interactive elements keyboard accessible
- Focus indicators visible and clear
- Color contrast ratios ≥ 4.5:1 for text
- Screen reader friendly (ARIA labels)
- No auto-playing audio
- Animations respect `prefers-reduced-motion`

**Keyboard Navigation:**
- `Tab` → Navigate between activity cards
- `Enter/Space` → Activate card (start practice)
- `Escape` → Close expanded views
- `Arrow keys` → Navigate within curriculum tree

**Screen Reader:**
- Cards announce: "Activity card, [subject], [skill], [status], Start practice button"
- Progress updates announced: "Activity completed, 3 of 6 activities done today"
- Clear headings structure for page navigation

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-06 | Product Team | Initial PRD draft |

---

**Questions or Feedback?**
Please reach out to the product team with any questions, suggestions, or concerns about this PRD.
