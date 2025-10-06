# Curriculum Authoring Frontend Documentation

## Overview

The Curriculum Authoring Frontend is a comprehensive admin interface for managing educational curriculum content. It provides curriculum designers with tools to create, edit, link, and publish curriculum entities using a visual interface with AI assistance.

## Architecture

### Technology Stack
- **Framework**: Next.js 14 with React
- **State Management**: React Query (TanStack Query) for server state
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI + shadcn/ui + Tailwind CSS
- **API Client**: Custom authenticated client with Firebase Auth

### Key Components

#### 1. API Layer (`/src/lib/curriculum-authoring/`)
- **api.ts**: HTTP client for curriculum authoring service (port 8001)
- **hooks.ts**: React Query hooks for data fetching and mutations
- **types.ts**: TypeScript type definitions matching backend models

#### 2. Main Page (`/app/curriculum-designer/page.tsx`)
- Split-panel layout: tree view (left) + tabs (right)
- Subject selector
- Tab navigation: Editor | Prerequisites | Drafts | Versions
- AI generation dialog

#### 3. Tree View (`/components/curriculum-designer/tree/`)
- **CurriculumTreeView.tsx**: Main tree container
- **UnitNode.tsx**: Expandable unit nodes
- **SkillNode.tsx**: Skill nodes with subskills
- **SubskillNode.tsx**: Leaf nodes with difficulty ranges

#### 4. Entity Editor (`/components/curriculum-designer/editor/`)
- **EntityEditor.tsx**: Main editor container with entity type detection
- **SubjectForm.tsx**: Subject metadata form
- **UnitForm.tsx**: Unit details form
- **SkillForm.tsx**: Skill description form
- **SubskillForm.tsx**: Subskill form with difficulty range inputs

#### 5. Prerequisites (`/components/curriculum-designer/prerequisites/`)
- **PrerequisitePanel.tsx**: View/manage prerequisites and unlocks
- Lists what this entity needs (prerequisites)
- Lists what this entity unlocks (forward links)
- Graph visualization placeholder

#### 6. AI Features (`/components/curriculum-designer/ai/`)
- **AIUnitGenerator.tsx**: Generate complete units with AI
- **AISkillGenerator.tsx**: (TODO) Generate skills from description
- **PrerequisiteSuggester.tsx**: (TODO) AI prerequisite recommendations
- **DescriptionImprover.tsx**: (TODO) Enhance descriptions

#### 7. Publishing (`/components/curriculum-designer/publishing/`)
- **DraftSummary.tsx**: Review draft changes with publish workflow
- **VersionHistory.tsx**: Version timeline with rollback functionality

## Features Implemented

### ✅ Phase 1: Core CRUD
- [x] Curriculum tree view (Subject → Unit → Skill → Subskill)
- [x] Entity selection and navigation
- [x] Entity forms (view/edit all fields)
- [x] Draft indicators
- [x] Real-time form validation
- [x] Optimistic UI updates

### ✅ Phase 2: Prerequisites
- [x] View prerequisites for an entity
- [x] View what an entity unlocks
- [x] Delete prerequisite links
- [x] Proficiency threshold display
- [ ] Add new prerequisite (UI ready, needs integration)
- [ ] Graph visualization (placeholder added)

### ✅ Phase 3: AI Features
- [x] AI unit generation dialog
- [x] Generate unit with skills and subskills
- [x] Review and save AI-generated content
- [ ] AI skill generation
- [ ] AI prerequisite suggestions
- [ ] Description improvement

### ✅ Phase 4: Publishing
- [x] View draft changes summary
- [x] Publish workflow with version metadata
- [x] Version history viewer
- [x] Rollback to previous version
- [x] Change statistics (created/updated/deleted counts)

## Getting Started

### 1. Environment Setup

Copy the example environment file:
```bash
cp my-tutoring-app/.env.example my-tutoring-app/.env
```

Update the authoring service URL:
```env
NEXT_PUBLIC_AUTHORING_API_URL=http://localhost:8001
```

### 2. Start the Services

**Backend Services:**
```bash
# Main backend (port 8000)
cd backend
uvicorn app.main:app --reload

# Curriculum Authoring Service (port 8001)
cd curriculum-authoring-service
uvicorn app.main:app --reload --port 8001
```

**Frontend:**
```bash
cd my-tutoring-app
npm run dev
```

### 3. Access the Interface

Navigate to: `http://localhost:3000/curriculum-designer`

### 4. Authentication

The interface requires Firebase authentication with the `designer` role:
- **Designer Role**: Can create/edit curriculum
- **Admin Role**: Can publish/rollback versions

## User Workflows

### Creating a New Unit

1. Select a subject from the dropdown
2. Click "AI Generate" button
3. Fill in topic details (subject, grade, concept)
4. Review generated unit structure
5. Click "Save as Draft"
6. Review and publish changes

### Editing Curriculum

1. Select subject
2. Navigate tree to find entity
3. Click entity to open editor
4. Modify fields
5. Click "Save Changes"
6. Review in "Draft Changes" tab
7. Publish when ready

### Managing Prerequisites

1. Select a skill or subskill
2. Click "Prerequisites" button or tab
3. View existing prerequisites and unlocks
4. Add new prerequisite (search curriculum)
5. Set proficiency threshold (0-100%)
6. Save changes

### Publishing Changes

1. Navigate to "Draft Changes" tab
2. Review all pending changes
3. Click "Publish" button
4. Enter version description
5. Enter change summary
6. Confirm publication

### Rolling Back

1. Navigate to "Version History" tab
2. View version timeline
3. Select previous version
4. Click "Rollback" button
5. Confirm rollback action

## API Integration

### Endpoints Used

**Curriculum CRUD:**
- `GET /api/curriculum/subjects`
- `GET /api/curriculum/subjects/{id}/tree`
- `POST /api/curriculum/units`
- `PUT /api/curriculum/skills/{id}`
- etc.

**Prerequisites:**
- `GET /api/prerequisites/{entity_id}`
- `POST /api/prerequisites/prerequisites`
- `DELETE /api/prerequisites/{id}`

**AI Generation:**
- `POST /api/ai/generate-unit`
- `POST /api/ai/suggest-prerequisites`

**Publishing:**
- `GET /api/publishing/subjects/{id}/draft-changes`
- `POST /api/publishing/subjects/{id}/publish`
- `POST /api/publishing/subjects/{id}/rollback/{version_id}`

### Authentication Flow

1. User authenticates via Firebase
2. Frontend gets ID token from Firebase
3. Token sent in `Authorization: Bearer {token}` header
4. Backend verifies token and checks role
5. API returns data or 403 if insufficient permissions

## Data Flow

### Read Operations
```
Component → useQuery hook → API client → Backend → BigQuery
  ↓
Response cached by React Query
  ↓
Component renders with data
```

### Write Operations
```
Form submission → useMutation hook → API client → Backend
  ↓
Backend creates draft version in BigQuery
  ↓
React Query invalidates related queries
  ↓
UI updates with fresh data
```

### Publishing Flow
```
Draft changes accumulated → Publish dialog → Version metadata
  ↓
POST /publishing/subjects/{id}/publish
  ↓
Backend activates draft version
  ↓
Frontend invalidates all related queries
  ↓
UI shows published content
```

## Component Patterns

### Form Pattern
```tsx
const { mutate, isPending } = useUpdateEntity();
const { register, handleSubmit, formState: { isDirty } } = useForm();

const onSubmit = (data) => {
  mutate({ id, data }, {
    onSuccess: () => {
      // Show success message
    }
  });
};
```

### Tree Navigation Pattern
```tsx
const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>();

<TreeView
  onSelectEntity={setSelectedEntity}
/>
<EntityEditor
  entity={selectedEntity}
/>
```

### Optimistic Updates Pattern
```tsx
const { mutate } = useMutation({
  mutationFn: updateEntity,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['entity', id]);
    const previous = queryClient.getQueryData(['entity', id]);
    queryClient.setQueryData(['entity', id], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['entity', id], context.previous);
  },
});
```

## Styling Conventions

- **Draft Entities**: Yellow/secondary badge
- **Active Version**: Green badge with CheckCircle icon
- **Changes**: Color-coded icons (green=create, blue=update, red=delete)
- **Forms**: Consistent spacing with 4-unit gap
- **Buttons**: Icon + label for primary actions

## Error Handling

### API Errors
```tsx
if (error) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {error.message || 'Failed to load data'}
      </AlertDescription>
    </Alert>
  );
}
```

### Form Validation
```tsx
const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  order: z.number().int().positive().optional(),
});

const { register, formState: { errors } } = useForm({
  resolver: zodResolver(schema)
});
```

### Loading States
```tsx
{isLoading && (
  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
)}
```

## Future Enhancements

### Planned Features
- [ ] Prerequisite graph visualization (react-flow)
- [ ] Drag-and-drop reordering
- [ ] Bulk operations (multi-select)
- [ ] Search and filter in tree view
- [ ] Real-time collaboration indicators
- [ ] Keyboard shortcuts
- [ ] Undo/redo functionality
- [ ] Export curriculum to JSON/CSV
- [ ] Import from legacy format

### AI Enhancements
- [ ] Skill generation from description
- [ ] Prerequisite auto-detection
- [ ] Description improvement suggestions
- [ ] Difficulty estimation for subskills
- [ ] Curriculum gap analysis

### Publishing Enhancements
- [ ] Diff viewer (side-by-side comparison)
- [ ] Approval workflows
- [ ] Scheduled publishing
- [ ] A/B testing support
- [ ] Change notifications

## Troubleshooting

### "User not authenticated" error
- Ensure Firebase is initialized
- Check that user has valid ID token
- Verify token hasn't expired

### "Failed to load curriculum tree"
- Verify authoring service is running on port 8001
- Check NEXT_PUBLIC_AUTHORING_API_URL in .env
- Ensure user has `designer` or `admin` role

### Draft changes not saving
- Check browser console for API errors
- Verify BigQuery connection in backend
- Ensure draft version is being created

### Publish fails with 403
- User needs `admin` role for publishing
- Check Firebase custom claims
- Verify backend security rules

## Development Tips

### Adding a New Entity Type
1. Update types in `curriculum-authoring.ts`
2. Add API methods in `api.ts`
3. Create hooks in `hooks.ts`
4. Add form component in `editor/`
5. Update `EntityEditor.tsx` switch statement

### Adding a New Feature
1. Define types
2. Create API client method
3. Create React Query hook
4. Build UI component
5. Integrate with main page

### Testing Changes
1. Start both backend services
2. Use React Query DevTools (enabled in dev)
3. Check Network tab for API calls
4. Verify draft creation in BigQuery

## Contributing

When adding new features:
1. Follow existing component patterns
2. Use TypeScript strictly (no `any`)
3. Add loading and error states
4. Use shadcn/ui components
5. Match existing styling conventions
6. Update this documentation

## Support

For issues or questions:
- Check API docs: `http://localhost:8001/docs`
- Review backend logs
- Inspect React Query DevTools
- Check browser console for errors
