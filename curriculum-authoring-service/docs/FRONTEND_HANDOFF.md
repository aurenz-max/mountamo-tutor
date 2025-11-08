# Frontend Integration Handoff: AI Foundations Editor

**Date**: November 7, 2024
**Backend Status**: ✅ Complete and Ready for Integration
**API Base URL**: `http://localhost:8001/api` (dev) | `your-production-url/api` (prod)

---

## 🎯 Executive Summary

We've built a backend system that transforms AI content generation from a "black box" to a "glass box" workflow. Educators can now review, edit, and approve the foundational elements (concepts, terminology, context primitives, visual schemas) that the AI uses to generate educational content.

**Your Task**: Build the React UI components that allow educators to interact with this system through the curriculum designer interface.

---

## 📦 What We Built (Backend)

### Core System Components

1. **Database Layer**: BigQuery table storing foundation data per subskill
2. **AI Generators**:
   - Master Context (core concepts, terminology, learning objectives)
   - Context Primitives (characters, scenarios, objects for variety)
   - Visual Schema Recommender (appropriate visual types)
3. **REST API**: 6 endpoints for CRUD operations
4. **Service Layer**: Full foundation management logic

### Key Concepts

**Foundation Package** = 3 Components:
1. **Master Context**: The "what" students learn (concepts, terminology, objectives)
2. **Context Primitives**: The "variety elements" for problem generation (objects, characters, scenarios)
3. **Visual Schemas**: The "approved visuals" educators want used (object-collection, bar-model, etc.)

---

## 🎨 What You Need to Build

### Overview of UI Components

```
SubskillForm.tsx (existing)
    └─ [NEW BUTTON] "AI Foundations"
        └─ Opens → FoundationsEditor (NEW COMPONENT)
                      ├─ Tab 1: Master Context Editor
                      ├─ Tab 2: Context Primitives Editor
                      └─ Tab 3: Visual Schema Selector
```

### Component Hierarchy

```tsx
<FoundationsEditor>                    // Main container
  <FoundationsEditorHeader />          // Title, status badge, actions

  <Tabs>
    <Tab label="Master Context">
      <MasterContextForm />            // Edit concepts, terminology, objectives
    </Tab>

    <Tab label="Context Primitives">
      <ContextPrimitivesForm />        // Edit objects, characters, scenarios
    </Tab>

    <Tab label="Visual Schemas">
      <VisualSchemaSelector />         // Select/deselect visual types
    </Tab>
  </Tabs>

  <FoundationsEditorActions>           // Save, Reset, Cancel buttons
    <Button onClick={handleRegenerate}>Reset to AI Suggestion</Button>
    <Button onClick={handleSave}>Save Foundations</Button>
  </FoundationsEditorActions>
</FoundationsEditor>
```

---

## 🔌 API Integration

### Available Endpoints

All endpoints are documented at `http://localhost:8001/docs` (FastAPI auto-generated docs)

#### 1. Generate Foundations
**POST** `/api/subskills/{subskill_id}/foundations/generate?version_id=v1`

**When to use**:
- First time opening the editor for a subskill
- User clicks "Reset to AI Suggestion"

**Response**:
```typescript
{
  success: boolean;
  data: FoundationsData;
  message: string;
}
```

#### 2. Get Foundations
**GET** `/api/subskills/{subskill_id}/foundations?version_id=v1`

**When to use**:
- Loading existing foundations into the editor
- Checking if foundations exist before showing the editor

**Response**: Same as generate, or 404 if not found

#### 3. Save Foundations
**PUT** `/api/subskills/{subskill_id}/foundations?version_id=v1`

**When to use**:
- User clicks "Save" after editing

**Request Body**:
```typescript
{
  master_context: MasterContext;
  context_primitives: ContextPrimitives;
  approved_visual_schemas: string[];
}
```

#### 4. Get Status (Lightweight)
**GET** `/api/subskills/{subskill_id}/foundations/status?version_id=v1`

**When to use**:
- Showing status badges on subskill cards
- Quick check without loading full data

**Response**:
```typescript
{
  subskill_id: string;
  version_id: string;
  has_foundations: boolean;
  generation_status?: 'pending' | 'generated' | 'edited';
  last_updated?: string;
}
```

#### 5. List Visual Schemas
**GET** `/api/visual-schemas`

**When to use**:
- Populating the visual schema selector checklist

**Response**:
```typescript
{
  categories: Array<{
    category: string;
    schemas: string[];
    description: string;
  }>;
  all_schemas: string[];
}
```

### TypeScript Types

Create these in `curriculum-designer-app/types/foundations.ts`:

```typescript
// Master Context
export interface MasterContext {
  core_concepts: string[];
  key_terminology: Record<string, string>;
  learning_objectives: string[];
  difficulty_level: string;
  grade_level: string;
  prerequisites: string[];
  real_world_applications: string[];
}

// Context Primitives
export interface Character {
  name: string;
  age?: number;
  role?: string;
}

export interface ComparisonPair {
  attribute: string;
  examples: string[];
}

export interface Category {
  name: string;
  items: string[];
}

export interface Attribute {
  name: string;
  values: string[];
}

export interface ContextPrimitives {
  concrete_objects: string[];
  living_things: string[];
  locations: string[];
  tools: string[];
  characters: Character[];
  scenarios: string[];
  comparison_pairs: ComparisonPair[];
  categories: Category[];
  sequences: string[][];
  action_words: string[];
  attributes: Attribute[];
}

// Complete Foundation Package
export interface FoundationsData {
  subskill_id: string;
  version_id: string;
  master_context: MasterContext;
  context_primitives: ContextPrimitives;
  approved_visual_schemas: string[];
  generation_status: 'pending' | 'generated' | 'edited';
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  last_edited_by?: string;
}

// API Responses
export interface FoundationsResponse {
  success: boolean;
  data?: FoundationsData;
  message?: string;
}

export interface FoundationsStatusResponse {
  subskill_id: string;
  version_id: string;
  has_foundations: boolean;
  generation_status?: string;
  last_updated?: string;
}

// Visual Schema
export interface VisualSchemaCategory {
  category: string;
  schemas: string[];
  description?: string;
}
```

---

## 🛠️ Implementation Tasks

### Phase 1: API Client & Hooks (Priority: HIGH)

**File**: `curriculum-designer-app/lib/curriculum-authoring/foundations-api.ts`

```typescript
import { authApiClient } from './api';

export const foundationsApi = {
  // Get existing foundations
  async getFoundations(subskillId: string, versionId: string) {
    return authApiClient.get<FoundationsResponse>(
      `/subskills/${subskillId}/foundations`,
      { params: { version_id: versionId } }
    );
  },

  // Generate fresh foundations
  async generateFoundations(subskillId: string, versionId: string) {
    return authApiClient.post<FoundationsResponse>(
      `/subskills/${subskillId}/foundations/generate`,
      null,
      { params: { version_id: versionId } }
    );
  },

  // Save edited foundations
  async saveFoundations(
    subskillId: string,
    versionId: string,
    data: {
      master_context: MasterContext;
      context_primitives: ContextPrimitives;
      approved_visual_schemas: string[];
    }
  ) {
    return authApiClient.put<FoundationsResponse>(
      `/subskills/${subskillId}/foundations`,
      data,
      { params: { version_id: versionId } }
    );
  },

  // Check status
  async getStatus(subskillId: string, versionId: string) {
    return authApiClient.get<FoundationsStatusResponse>(
      `/subskills/${subskillId}/foundations/status`,
      { params: { version_id: versionId } }
    );
  },

  // Get available schemas
  async getVisualSchemas() {
    return authApiClient.get<{
      categories: VisualSchemaCategory[];
      all_schemas: string[];
    }>('/visual-schemas');
  },
};
```

**File**: `curriculum-designer-app/lib/curriculum-authoring/foundations-hooks.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foundationsApi } from './foundations-api';

// Get foundations
export function useFoundations(subskillId: string, versionId: string) {
  return useQuery({
    queryKey: ['foundations', subskillId, versionId],
    queryFn: () => foundationsApi.getFoundations(subskillId, versionId),
    retry: false, // Don't retry on 404
  });
}

// Generate foundations
export function useGenerateFoundations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subskillId, versionId }: { subskillId: string; versionId: string }) =>
      foundationsApi.generateFoundations(subskillId, versionId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['foundations', variables.subskillId, variables.versionId]
      });
    },
  });
}

// Save foundations
export function useSaveFoundations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      versionId,
      data
    }: {
      subskillId: string;
      versionId: string;
      data: any;
    }) => foundationsApi.saveFoundations(subskillId, versionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['foundations', variables.subskillId, variables.versionId]
      });
    },
  });
}

// Get status
export function useFoundationsStatus(subskillId: string, versionId: string) {
  return useQuery({
    queryKey: ['foundations-status', subskillId, versionId],
    queryFn: () => foundationsApi.getStatus(subskillId, versionId),
  });
}

// Get visual schemas
export function useVisualSchemas() {
  return useQuery({
    queryKey: ['visual-schemas'],
    queryFn: () => foundationsApi.getVisualSchemas(),
    staleTime: Infinity, // Schemas don't change
  });
}
```

**Estimated Time**: 2-3 hours

---

### Phase 2: Main Container Component (Priority: HIGH)

**File**: `curriculum-designer-app/components/curriculum-designer/foundations/FoundationsEditor.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, RefreshCw, Save } from 'lucide-react';
import { MasterContextForm } from './MasterContextForm';
import { ContextPrimitivesForm } from './ContextPrimitivesForm';
import { VisualSchemaSelector } from './VisualSchemaSelector';
import { useFoundations, useGenerateFoundations, useSaveFoundations } from '@/lib/curriculum-authoring/foundations-hooks';
import type { FoundationsData } from '@/types/foundations';

interface FoundationsEditorProps {
  subskillId: string;
  versionId: string;
  subjectId?: string;
  onClose?: () => void;
}

export function FoundationsEditor({
  subskillId,
  versionId,
  subjectId,
  onClose
}: FoundationsEditorProps) {
  const [activeTab, setActiveTab] = useState('master-context');
  const [editedData, setEditedData] = useState<FoundationsData | null>(null);

  // Fetch existing foundations or show empty state
  const { data: foundationsResponse, isLoading, error } = useFoundations(subskillId, versionId);
  const { mutate: generateFoundations, isPending: isGenerating } = useGenerateFoundations();
  const { mutate: saveFoundations, isPending: isSaving } = useSaveFoundations();

  const foundations = foundationsResponse?.data || editedData;
  const hasUnsavedChanges = editedData !== null;

  const handleGenerate = () => {
    generateFoundations(
      { subskillId, versionId },
      {
        onSuccess: (response) => {
          setEditedData(response.data);
        },
      }
    );
  };

  const handleSave = () => {
    if (!editedData) return;

    saveFoundations(
      {
        subskillId,
        versionId,
        data: {
          master_context: editedData.master_context,
          context_primitives: editedData.context_primitives,
          approved_visual_schemas: editedData.approved_visual_schemas,
        },
      },
      {
        onSuccess: () => {
          setEditedData(null);
          // Show success toast
        },
      }
    );
  };

  const handleReset = () => {
    handleGenerate();
  };

  // Loading state
  if (isLoading || isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">
          {isLoading ? 'Loading foundations...' : 'Generating AI foundations...'}
        </p>
        <p className="text-xs text-gray-500">This may take 10-30 seconds</p>
      </div>
    );
  }

  // First-time generation state
  if (!foundations && !error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Foundations</CardTitle>
          <CardDescription>
            Generate the foundational elements that guide AI content generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Sparkles className="h-12 w-12 text-blue-500" />
            <p className="text-center text-gray-600">
              No foundations exist yet for this subskill.
              <br />
              Click below to generate the initial AI foundations.
            </p>
            <Button onClick={handleGenerate} size="lg">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate AI Foundations
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Main editor view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Foundations</h2>
          <p className="text-sm text-gray-600">
            Review and refine the core elements used for content generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {foundations?.generation_status && (
            <Badge variant={foundations.generation_status === 'edited' ? 'default' : 'secondary'}>
              {foundations.generation_status}
            </Badge>
          )}
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600">
              Unsaved Changes
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="master-context">Master Context</TabsTrigger>
          <TabsTrigger value="context-primitives">Context Primitives</TabsTrigger>
          <TabsTrigger value="visual-schemas">Visual Schemas</TabsTrigger>
        </TabsList>

        <TabsContent value="master-context" className="mt-4">
          <MasterContextForm
            data={foundations?.master_context}
            onChange={(updated) => {
              setEditedData({
                ...foundations!,
                master_context: updated,
              });
            }}
          />
        </TabsContent>

        <TabsContent value="context-primitives" className="mt-4">
          <ContextPrimitivesForm
            data={foundations?.context_primitives}
            onChange={(updated) => {
              setEditedData({
                ...foundations!,
                context_primitives: updated,
              });
            }}
          />
        </TabsContent>

        <TabsContent value="visual-schemas" className="mt-4">
          <VisualSchemaSelector
            selectedSchemas={foundations?.approved_visual_schemas || []}
            onChange={(updated) => {
              setEditedData({
                ...foundations!,
                approved_visual_schemas: updated,
              });
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isGenerating || isSaving}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset to AI Suggestion
        </Button>

        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Foundations
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Estimated Time**: 4-5 hours

---

### Phase 3: Form Components (Priority: MEDIUM)

#### 3A. Master Context Form

**File**: `curriculum-designer-app/components/curriculum-designer/foundations/MasterContextForm.tsx`

Key features needed:
- **Core Concepts**: String array editor (add/remove chips)
- **Key Terminology**: Key-value pair editor (term + definition)
- **Learning Objectives**: String array editor
- **Real World Applications**: String array editor
- **Prerequisites**: Display only (read from subskill)
- **Difficulty/Grade**: Display only

**UI Pattern**: Use shadcn/ui components
- `Input` for text fields
- `Textarea` for longer definitions
- `Badge` with X button for removable items
- `Button` with Plus icon for "Add" actions

**Estimated Time**: 4-6 hours

#### 3B. Context Primitives Form

**File**: `curriculum-designer-app/components/curriculum-designer/foundations/ContextPrimitivesForm.tsx`

Key features needed:
- **Accordion sections** for each primitive type (11 total)
- Each section expandable/collapsible
- Simple string array editors for most types
- Special editors for:
  - Characters: name, age, role fields
  - Comparison Pairs: attribute + examples array
  - Categories: name + items array
  - Attributes: name + values array

**UI Pattern**: Use shadcn/ui `Accordion` component
- Each primitive type is one accordion item
- Show count badge (e.g., "Objects (12)")
- Inline add/edit/delete functionality

**Estimated Time**: 6-8 hours (most complex form)

#### 3C. Visual Schema Selector

**File**: `curriculum-designer-app/components/curriculum-designer/foundations/VisualSchemaSelector.tsx`

Key features needed:
- Fetch schemas from `/api/visual-schemas`
- Group by category (foundational, math, science, etc.)
- Checkbox list for each schema
- Show AI recommendations as pre-checked
- Allow educator to check/uncheck

**UI Pattern**: Use shadcn/ui components
- `Accordion` for categories
- `Checkbox` for each schema
- `Badge` to indicate "AI Recommended"
- `HoverCard` for schema descriptions

**Reference**: Your existing `PrimitiveSelector.tsx` is a great model!

**Estimated Time**: 3-4 hours

---

### Phase 4: Integration Points (Priority: MEDIUM)

#### 4A. Add Button to EntityEditor

**File**: `curriculum-designer-app/components/curriculum-designer/editor/EntityEditor.tsx`

Add a new button in the header when `entity.type === 'subskill'`:

```tsx
{entity.type === 'subskill' && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => setShowFoundationsEditor(true)}
  >
    <Sparkles className="mr-2 h-4 w-4" />
    AI Foundations
  </Button>
)}
```

Open the editor in a Sheet or Dialog:

```tsx
<Sheet open={showFoundationsEditor} onOpenChange={setShowFoundationsEditor}>
  <SheetContent side="right" className="w-[900px] sm:max-w-[900px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>AI Foundations Editor</SheetTitle>
      <SheetDescription>
        Manage the foundational elements for AI content generation
      </SheetDescription>
    </SheetHeader>
    <FoundationsEditor
      subskillId={entity.id}
      versionId={currentVersionId}
      subjectId={subjectId}
      onClose={() => setShowFoundationsEditor(false)}
    />
  </SheetContent>
</Sheet>
```

**Estimated Time**: 1-2 hours

#### 4B. Add Status Badge to Subskill Cards

Show a badge on subskill cards indicating foundation status:

```tsx
// In SubskillNode.tsx or wherever subskills are rendered
const { data: status } = useFoundationsStatus(subskill.id, versionId);

{status?.has_foundations ? (
  <Badge variant="success" className="text-xs">
    <Check className="h-3 w-3 mr-1" />
    Foundations Ready
  </Badge>
) : (
  <Badge variant="outline" className="text-xs text-gray-500">
    <Sparkles className="h-3 w-3 mr-1" />
    No Foundations
  </Badge>
)}
```

**Estimated Time**: 1 hour

---

## 📋 Complete Task Checklist

### Must-Have (MVP)

- [ ] **API Client Setup**
  - [ ] Create `foundations-api.ts` with all 5 API methods
  - [ ] Create `foundations-hooks.ts` with React Query hooks
  - [ ] Create TypeScript types in `types/foundations.ts`

- [ ] **Main Container**
  - [ ] Build `FoundationsEditor.tsx` with tabs
  - [ ] Handle loading states (spinner, 10-30s wait time)
  - [ ] Handle empty state (first-time generation)
  - [ ] Handle unsaved changes tracking
  - [ ] Save/Reset/Cancel actions

- [ ] **Form Components**
  - [ ] Build `MasterContextForm.tsx` (concepts, terminology, objectives)
  - [ ] Build `ContextPrimitivesForm.tsx` (11 primitive types)
  - [ ] Build `VisualSchemaSelector.tsx` (checkboxes grouped by category)

- [ ] **Integration**
  - [ ] Add "AI Foundations" button to `EntityEditor.tsx`
  - [ ] Open editor in Sheet/Dialog
  - [ ] Pass correct subskill_id and version_id

### Should-Have (Polish)

- [ ] **UX Enhancements**
  - [ ] Loading skeleton screens
  - [ ] Success/error toast notifications
  - [ ] Confirm dialog on unsaved changes
  - [ ] Validation errors (e.g., empty required fields)
  - [ ] Keyboard shortcuts (Cmd+S to save)

- [ ] **Status Indicators**
  - [ ] Badge on subskill cards showing foundation status
  - [ ] Quick action: "Generate Foundations" button on empty state

- [ ] **Help Text**
  - [ ] Tooltips explaining each section
  - [ ] Example values for guidance
  - [ ] Character limits shown

### Nice-to-Have (Future)

- [ ] **Bulk Operations**
  - [ ] Copy foundations from one subskill to another
  - [ ] Apply default template

- [ ] **AI Assistance**
  - [ ] Suggest additional concepts while editing
  - [ ] Validate terminology definitions

- [ ] **Analytics**
  - [ ] Track which subskills have foundations
  - [ ] Show last edited by/date

---

## 🎨 Design Guidelines

### Visual Style

- Follow existing shadcn/ui patterns in your app
- Use consistent spacing (p-4, gap-4, space-y-4)
- Icons from `lucide-react`
- Color scheme: Blue for AI/generation, Green for success, Orange for warnings

### Recommended Components

Use these shadcn/ui components (you already have them):
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Button`, `Input`, `Textarea`, `Label`
- `Badge`, `Checkbox`, `Accordion`
- `Sheet`, `Dialog` for modals
- `HoverCard` for tooltips
- `ScrollArea` for long lists

### Loading States

- **Generating (10-30s)**: Show spinner + "Generating AI foundations..." + "This may take 10-30 seconds"
- **Saving (<1s)**: Show spinner on save button
- **Loading (<1s)**: Show skeleton or spinner

### Error Handling

- **404 (no foundations)**: Show empty state with "Generate" button
- **500 (server error)**: Show error message with "Retry" button
- **Network error**: Show offline message

---

## 🧪 Testing Strategy

### Manual Testing Checklist

1. **First-Time Flow**
   - [ ] Open subskill with no foundations
   - [ ] Click "Generate AI Foundations"
   - [ ] Wait for generation (10-30s)
   - [ ] Verify all 3 tabs populated

2. **Edit & Save Flow**
   - [ ] Edit master context (add concept, edit terminology)
   - [ ] Verify "Unsaved Changes" badge appears
   - [ ] Click "Save"
   - [ ] Verify success message
   - [ ] Refresh page, verify changes persisted

3. **Reset Flow**
   - [ ] Make edits
   - [ ] Click "Reset to AI Suggestion"
   - [ ] Verify regeneration
   - [ ] Verify edits discarded

4. **Visual Schema Selection**
   - [ ] Open visual schemas tab
   - [ ] See AI recommendations pre-checked
   - [ ] Uncheck some, check others
   - [ ] Save and verify

5. **Status Badge**
   - [ ] Create foundations for a subskill
   - [ ] Verify "Foundations Ready" badge appears
   - [ ] Delete foundations via API
   - [ ] Verify badge updates

### Automated Tests (if time permits)

```typescript
// Example test structure
describe('FoundationsEditor', () => {
  it('shows empty state when no foundations exist', () => {
    // Mock 404 response
    // Render component
    // Assert "Generate" button visible
  });

  it('generates foundations when button clicked', async () => {
    // Mock generate endpoint
    // Click generate button
    // Wait for loading
    // Assert tabs populated
  });

  it('tracks unsaved changes', () => {
    // Render with data
    // Edit a field
    // Assert "Unsaved Changes" badge visible
  });
});
```

---

## 📚 Reference Materials

### API Documentation
- Full API docs: [API_FOUNDATIONS.md](./API_FOUNDATIONS.md)
- Interactive docs: http://localhost:8001/docs (when backend running)

### Backend Summary
- Implementation details: [BACKEND_IMPLEMENTATION_SUMMARY.md](./BACKEND_IMPLEMENTATION_SUMMARY.md)

### Existing Patterns
- Look at `PrimitiveSelector.tsx` for checkbox list patterns
- Look at `EntityEditor.tsx` for form layout patterns
- Look at your curriculum tree components for loading/empty states

---

## 🚀 Development Workflow

### 1. Start Backend Service

```bash
cd curriculum-authoring-service
uvicorn app.main:app --reload --port 8001
```

Verify at: http://localhost:8001/docs

### 2. Start Frontend Dev Server

```bash
cd curriculum-designer-app
npm run dev
```

### 3. Test API Integration

Use the interactive docs at `/docs` to:
1. Test `POST /generate` endpoint manually
2. Copy the response JSON
3. Use it as mock data while building UI

### 4. Iterate

Build components in this order:
1. Types + API client (foundation)
2. FoundationsEditor shell (container)
3. MasterContextForm (simplest)
4. VisualSchemaSelector (medium)
5. ContextPrimitivesForm (most complex)
6. Integration with EntityEditor

---

## 🤝 Getting Help

### Questions to Ask

1. **API Issues**: "The `/foundations/generate` endpoint is returning 404 - what subskill_id should I use for testing?"
2. **Type Issues**: "The `master_context` object structure doesn't match the API response - can you verify the schema?"
3. **Flow Issues**: "Should we auto-generate on first open, or require a button click?"

### Testing Data

**Example Subskill ID for Testing**: `math-k-counting-1to10`
**Example Version ID**: `v1`

You can create test subskills via the curriculum API or ask for sample data.

---

## ⏱️ Estimated Timeline

| Phase | Task | Time Estimate |
|-------|------|---------------|
| 1 | API Client & Hooks | 2-3 hours |
| 2 | FoundationsEditor (main container) | 4-5 hours |
| 3A | MasterContextForm | 4-6 hours |
| 3B | ContextPrimitivesForm | 6-8 hours |
| 3C | VisualSchemaSelector | 3-4 hours |
| 4 | Integration (buttons, badges) | 2-3 hours |
| 5 | Testing & Polish | 3-4 hours |
| **Total** | | **24-33 hours** (3-4 days) |

---

## ✅ Definition of Done

A feature is complete when:

- [ ] User can open the editor from a subskill
- [ ] User can generate foundations (with 10-30s loading state)
- [ ] User can view/edit all 3 components (Master Context, Context Primitives, Visual Schemas)
- [ ] User can save changes
- [ ] User can reset to AI suggestion
- [ ] Changes persist across page refreshes
- [ ] Status badges show on subskill cards
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Works on Chrome, Firefox, Safari
- [ ] Responsive (looks good on 1920px+ screens)

---

## 🎉 Success Criteria

**The feature is successful if**:
- Educators can complete the workflow in < 5 minutes
- No confusion about what each section does
- 90%+ of generated content is acceptable with minor edits
- Educators feel in control (not like the AI is a black box)

---

## 📞 Contact

**Backend Developer**: [Your Name]
**Questions**: Check API docs first, then ask in Slack/Email
**Backend URL**: http://localhost:8001 (dev)

---

**Ready to build? Start with Phase 1 (API Client) and work through the checklist. Good luck! 🚀**
