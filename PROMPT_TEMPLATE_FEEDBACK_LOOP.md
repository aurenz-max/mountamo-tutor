# Prompt Template Feedback Loop - Implementation Summary

## Problem Solved

Previously, you could promote high-scoring problems to templates (creating entries in BigQuery `analytics.prompt_templates`), but there was **no way to browse, select, or utilize those approved templates** in the frontend. You had to manually go back to the original problem to find the template text.

## Solution Implemented

We've closed the feedback loop by implementing a complete template management system that connects backend capabilities with frontend UI.

---

## What Was Built

### 1. Backend API Integration

#### New API Method: `getBestPerformingTemplate()`
**File**: [`curriculum-designer-app/lib/curriculum-authoring/problems-api.ts`](curriculum-designer-app/lib/curriculum-authoring/problems-api.ts#L488-L515)

```typescript
async getBestPerformingTemplate(filters: {
  template_type: PromptTemplateType;
  subskill_id?: string;
  problem_type?: string;
  min_approval_rate?: number;
}): Promise<PromptTemplate>
```

- Calls the existing backend endpoint `GET /production/prompts/best-performing`
- Returns weighted random selection from high-performing templates (≥85% approval)
- Filters by subskill and problem type for relevance

#### New React Hook: `useBestPerformingTemplate()`
**File**: [`curriculum-designer-app/lib/curriculum-authoring/problems-hooks.ts`](curriculum-designer-app/lib/curriculum-authoring/problems-hooks.ts#L499-L516)

- React Query hook for fetching best-performing templates
- 10-minute stale time (templates don't change often)
- Automatic caching and background refetching

---

### 2. Template Selection in Problem Generation

#### New Component: `TemplateSelector`
**File**: [`curriculum-designer-app/components/curriculum-designer/problems/TemplateSelector.tsx`](curriculum-designer-app/components/curriculum-designer/problems/TemplateSelector.tsx)

**Features**:
- **Recommended Template Card**: Automatically suggests the best-performing template for the current subskill
  - Shows approval rate badge (Excellent/Very Good/Good/Needs Improvement)
  - "Use This Template" button
  - Performance metrics display
- **Browse All Templates**: Collapsible dropdown to view all relevant templates
  - Filter by subskill (template names contain subskill ID)
  - Show version, approval rate, usage count
  - Quick "Use" button for each template
- **Visual Feedback**: Selected template is highlighted with blue border

**UX Flow**:
1. User opens problem generation panel
2. System automatically fetches best template for current subskill
3. If found, shows recommendation with approval rate
4. User can accept recommendation or browse alternatives
5. Selected template loads into editable text area
6. User can modify template or clear it to use default generation

#### Updated Component: `ProblemGenerationPanel`
**File**: [`curriculum-designer-app/components/curriculum-designer/problems/ProblemGenerationPanel.tsx`](curriculum-designer-app/components/curriculum-designer/problems/ProblemGenerationPanel.tsx#L203-L238)

**Changes**:
- Removed hardcoded `PromptTemplateEditor` with `templateName="default"`
- Added `TemplateSelector` component at top of generation controls
- Added editable template preview when template is selected
- "Clear Template" button to return to default generation
- Template text stored in `customPrompt` state and passed to generation API

---

### 3. Template Library Page

#### New Component: `TemplateLibraryPage`
**File**: [`curriculum-designer-app/components/curriculum-designer/problems/TemplateLibraryPage.tsx`](curriculum-designer-app/components/curriculum-designer/problems/TemplateLibraryPage.tsx)

**Features**:

**Filters**:
- Template Type (Problem Generation, Evaluation, Feedback)
- Min Approval Rate (All, 75%+, 85%+, 90%+)
- Sort By (Approval Rate, Usage Count, Created Date)
- Search (by name or content)

**Template Cards**:
- Performance metrics (approval rate, usage count)
- Performance badges (Excellent/Very Good/Good/Needs Improvement)
- Active status indicator
- Template preview (first 3 lines)
- Version and creation date

**Actions Per Template**:
- **View**: Full template text in read-only dialog
- **Activate**: Set as active version (for templates with same base name)
- **Improve**: Opens AI-powered improvement panel (see below)
- **View Feedback**: Opens aggregated feedback report
- **Copy**: Copy template text to clipboard

---

### 4. AI Improvement Integration

#### Entry Points Added

**From Feedback Report**:
- [`FeedbackReportDialog`](curriculum-designer-app/components/curriculum-designer/problems/FeedbackReportDialog.tsx#L221-L240) already had "Generate AI Suggestions" button
- Opens `PromptImprovementPanel` in nested dialog
- ✅ Already implemented (no changes needed)

**From Template Library**:
- "Improve" button on each template card
- Opens `PromptImprovementPanel` in full-screen dialog
- Passes `templateId` for AI analysis

**PromptImprovementPanel** (existing component, now accessible):
- Calls `POST /prompts/{template_id}/suggest-improvements`
- Shows side-by-side diff of current vs improved prompt
- Displays rationale, key changes, expected improvements
- "Create New Version" button to save improvements

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER GENERATES PROBLEMS                                         │
│  ↓                                                               │
│ ProblemGenerationPanel                                          │
│  - TemplateSelector fetches: GET /production/prompts/best-perf  │
│  - Suggests: "Use proven template (92% approval)?"              │
│  - User accepts → customPrompt = template.template_text         │
│  - OR user browses alternatives → selects different template    │
│  - OR user writes custom → customPrompt = their text            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PROBLEM GENERATED & EVALUATED                                   │
│  ↓                                                               │
│ ProblemCard (score ≥ 8.5)                                       │
│  - Shows "Promote to Template" button                           │
│  - User clicks → PromoteToTemplateDialog                        │
│  - Calls: POST /prompts                                         │
│  - Creates entry in analytics.prompt_templates                  │
│  - Template name: {subskillId}_proven_{timestamp}               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ TEMPLATE IN LIBRARY (NEW!)                                      │
│  ↓                                                               │
│ TemplateLibraryPage                                             │
│  - Lists: GET /prompts?template_type=problem_generation         │
│  - Shows performance metrics                                    │
│  - Actions:                                                     │
│    • "Use Template" → available in ProblemGenerationPanel       │
│    • "Activate" → POST /prompts/{id}/activate                   │
│    • "Improve" → PromptImprovementPanel (AI suggestions)        │
│    • "View Feedback" → FeedbackReportDialog                     │
│    • "Copy" → clipboard                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CONTINUOUS IMPROVEMENT LOOP                                     │
│  ↓                                                               │
│ Background: POST /prompts/jobs/aggregate-feedback               │
│  - Runs periodically (cron job)                                 │
│  - Clusters feedback themes using Gemini                        │
│  - Flags underperforming templates                              │
│  ↓                                                               │
│ User sees alert in ProblemGenerationPanel or Library            │
│  - Clicks "Improve" → PromptImprovementPanel                    │
│  - AI suggests improvements → creates new version               │
│  - User tests new version → activates if better                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Modified

### New Files Created
1. `curriculum-designer-app/components/curriculum-designer/problems/TemplateSelector.tsx` - Template selection component
2. `curriculum-designer-app/components/curriculum-designer/problems/TemplateLibraryPage.tsx` - Template library page

### Files Modified
1. `curriculum-designer-app/lib/curriculum-authoring/problems-api.ts`
   - Added `getBestPerformingTemplate()` method

2. `curriculum-designer-app/lib/curriculum-authoring/problems-hooks.ts`
   - Added `bestPerformingTemplate` query key
   - Added `useBestPerformingTemplate()` hook

3. `curriculum-designer-app/components/curriculum-designer/problems/ProblemGenerationPanel.tsx`
   - Replaced hardcoded PromptTemplateEditor with TemplateSelector
   - Added template selection state management
   - Added editable template preview

### Files Already Correct (No Changes Needed)
1. `curriculum-designer-app/components/curriculum-designer/problems/PromptImprovementPanel.tsx` - Already built, just needed entry points
2. `curriculum-designer-app/components/curriculum-designer/problems/FeedbackReportDialog.tsx` - Already wired to improvement panel
3. `curriculum-authoring-service/app/api/prompts.py` - All endpoints already exist

---

## How to Use

### For Curriculum Designers

#### Generating Problems with Proven Templates
1. Navigate to a subskill in the curriculum designer
2. Open "Generate Practice Problems" panel
3. **NEW**: See recommended template automatically
   - Shows approval rate (e.g., "92% approval")
   - Click "Use This Template" to load it
   - Or click "Browse All Templates" to see alternatives
4. Edit template if needed or use as-is
5. Generate problems with proven prompt structure

#### Managing Templates
1. Navigate to Template Library (add to navigation menu)
2. Filter by approval rate (e.g., "85%+ Very Good")
3. Sort by approval rate to see best performers first
4. Actions:
   - **View**: See full template text
   - **Activate**: Make a specific version active
   - **Improve**: Get AI suggestions for improvements
   - **View Feedback**: See aggregated evaluation data
   - **Copy**: Copy to clipboard for manual use

#### Improving Underperforming Templates
1. In Template Library, find template with low approval rate
2. Click "View Feedback" to see what's wrong
   - Check dimension analysis (which scores are weak)
   - Review feedback themes (AI-clustered common issues)
   - Read improvement suggestions
3. Click "Generate AI Suggestions" or "Improve" button
4. Review side-by-side diff of current vs improved
5. Click "Create New Version" to save
6. Test new version by using it for generation
7. If better, activate the new version

---

## Next Steps (Optional Enhancements)

### Phase 4: Performance Dashboard (Not Yet Implemented)
- Create dedicated performance dashboard page
- Visual charts of approval rates over time
- Trend analysis (improving/declining templates)
- Flag underperforming templates proactively
- Quick-access improvement suggestions

### Navigation Integration
You'll need to add the Template Library page to your navigation menu:

```tsx
// In your main navigation component
<NavLink to="/curriculum-designer/templates">
  <Sparkles className="mr-2 h-4 w-4" />
  Template Library
</NavLink>
```

Or add routing if using file-based routing:
```
curriculum-designer-app/app/curriculum-designer/templates/page.tsx
```

---

## Technical Notes

### Why Templates Aren't Used by Default

From the backend design philosophy:

> We intentionally do NOT use templates here to preserve context variety.
> The three-phase generation system uses context primitives to create varied prompts
> that are stored with each problem. Templates are reserved for custom overrides only.

**This is intentional**:
- Default: Use context primitives (objects, characters, scenarios, locations) for variety
- Optional: Use templates when user wants proven prompt structures
- Each problem stores its own `generation_prompt` for replicability

Templates are for "proven patterns" not "one-size-fits-all"!

### Performance Considerations
- `useBestPerformingTemplate` has 10-minute stale time (templates change slowly)
- Template library uses standard React Query caching
- Feedback reports cached for 5 minutes
- All queries use background refetching for fresh data

### Error Handling
- If no templates exist for a subskill: Shows "No proven templates yet" message
- If best-performing endpoint returns 404: Gracefully shows "Generate problems to create templates"
- Template selector doesn't block generation - user can always generate without template

---

## Success Metrics

Track these to measure adoption:

1. **Template Usage Rate**: % of problem generations using selected templates vs default
2. **Template Promotion Rate**: How many high-scoring problems get promoted
3. **Improvement Cycle Time**: Days from template creation → feedback → improvement → activation
4. **Approval Rate Improvement**: Compare approval rates before/after using templates
5. **Template Reuse**: Number of times each template is used across subskills

---

## Summary

The feedback loop is now **fully closed**:

✅ Promote high-scoring problems to templates
✅ Browse and filter template library
✅ See best-performing templates for each subskill
✅ Select templates for problem generation
✅ View aggregated feedback and performance metrics
✅ Get AI-powered improvement suggestions
✅ Create improved versions and activate them
✅ Continuous improvement cycle

Users can now discover, use, and improve proven prompt templates throughout their workflow!
