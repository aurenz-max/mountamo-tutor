# SyllabusSelector Component Documentation

## Overview

The SyllabusSelector component is a React component that allows users to browse and select educational curriculum content for tutoring sessions. It provides a hierarchical tree view of educational content organized by subjects, units, skills, and subskills. The component also integrates with a recommendation system that suggests relevant learning topics to users.

## Component Structure

The SyllabusSelector component is built using a tree-based structure with three levels:
1. **Units** - Top-level categories (e.g., "Counting and Cardinality")
2. **Skills** - Specific abilities within each unit (e.g., "Know number names and the count sequence")
3. **Subskills** - Detailed learning objectives within skills (e.g., "Count and recognize numbers 0-10")

## Main Features

### 1. Curriculum Selection
- Subject dropdown for selecting a subject area (e.g., Mathematics)
- Hierarchical tree view of the curriculum structure
- Collapsible/expandable sections for easy navigation
- Visual indicators (icons) showing the learning level for units, skills, and subskills

### 2. Intelligent Recommendations
- Automatically fetches personalized learning recommendations based on student data
- Displays recommendations with priority levels (high, medium, low)
- Visual indicators (sparkle icons) highlighting recommended topics
- Recommendation summary banner showing the next suggested topic

### 3. Selection Management
- Tracks the user's current selection at each level (unit, skill, subskill)
- Auto-expands relevant sections when a selection is made
- "Start Tutoring Session" button that activates once a valid selection is made

## Key Components

### TreeItem Component
The `TreeItem` is a recursive component that renders each node in the curriculum tree. It handles:
- Collapsible/expandable functionality
- Visual indicators for recommendations
- Selection state tracking
- Animation effects for smooth UI transitions

```jsx
const TreeItem = ({ 
  label, 
  id,
  children, 
  isSelected, 
  onClick, 
  hasChildren = false,
  level = 0,
  isRecommended = false,
  recommendationPriority = null,
  icon = null
}) => {
  // Implementation details...
}
```

### Main SyllabusSelector Component
The main component handles:
- Subject selection via dropdown
- Fetching curriculum data from the API
- Fetching recommendations from the API
- Rendering the complete curriculum tree
- Tracking user selections
- Initiating tutoring sessions

## API Integration

The component interacts with several API endpoints:

### 1. Subject Retrieval
```javascript
// Fetch available subjects
const availableSubjects = await api.getSubjects();
```

### 2. Curriculum Data Fetching
```javascript
// Fetch curriculum structure for a selected subject
const data = await api.getSubjectCurriculum(selectedSubject);
```

### 3. Recommendations API
```javascript
// Fetch personalized learning recommendations
const recs = await api.getAdvancedRecommendations({
  student_id: 1,
  subject: selectedSubject,
  limit: 5
});
```

### 4. Session Initiation
```javascript
// When user clicks "Start Tutoring Session"
onSelect(selectedData);
```

## Data Flow

1. Component loads and fetches available subjects
2. User selects a subject from the dropdown
3. Component fetches curriculum structure and recommendations
4. Component renders the curriculum tree with recommendations highlighted
5. User navigates the tree and makes selections
6. Once a valid selection is made, user can start a tutoring session
7. Session data is passed to the parent component via `onSelect` prop

## Advanced Recommendation System

The component uses an advanced recommendation system through the API:

### 1. Recommendation Data Structure
```typescript
interface AdvancedRecommendation {
  type: string;
  priority: string;  // "high", "medium", or "low"
  unit_id: string;
  unit_title: string;
  skill_id: string;
  skill_description: string;
  subskill_id: string;
  subskill_description: string;
  proficiency: number;
  mastery: number;
  avg_score: number;
  priority_level: string;
  priority_order: number;
  readiness_status: string;
  is_ready: boolean;
  completion: number;
  attempt_count: number;
  is_attempted: boolean;
  next_subskill: string | null;
  message: string;
}
```

### 2. Recommendation Visualization
- Items are marked with a sparkle icon (✨) if recommended
- Color-coding based on priority level
- Tooltip explaining the recommendation priority
- Banner showing the highest priority recommendation

### 3. Automatic Updates
Recommendations are updated when:
- The subject is changed
- A new skill or subskill is selected

## Visual Design Elements

The component uses several visual elements to enhance usability:

### 1. Icons for Learning Levels
- `<BookOpen />` - Unit level (foundational knowledge)
- `<GraduationCap />` - Skill level (intermediate knowledge)
- `<Brain />` - Subskill level (advanced knowledge)

### 2. Visual States
- Selected items: Highlighted background with primary color
- Recommended items: Sparkle icon with color based on priority
- Expandable items: Right/down chevron icons
- Hover states: Light background highlighting

### 3. Recommendation Indicators
- Banner for highest priority recommendation
- Color-coded priority levels
- Count badge showing total recommendations

## Usage Example

```jsx
import SyllabusSelector from './SyllabusSelector';

function App() {
  const handleSelection = (selectedData) => {
    console.log('Selected curriculum:', selectedData);
    // Start a tutoring session with the selected data
  };

  return (
    <div className="app">
      <SyllabusSelector onSelect={handleSelection} />
    </div>
  );
}
```

## API Response Format

The curriculum data structure from the API follows this format:

```json
{
  "subject": "Mathematics",
  "curriculum": [
    {
      "id": "COUNT001",
      "title": "Counting and Cardinality",
      "skills": [
        {
          "id": "COUNT001-01",
          "description": "Know number names and the count sequence",
          "subskills": [
            {
              "id": "COUNT001-01-A",
              "description": "Count and recognize numbers 0-10...",
              "difficulty_range": {
                "start": 1,
                "end": 3,
                "target": 2
              }
            },
            // More subskills...
          ]
        },
        // More skills...
      ]
    },
    // More units...
  ]
}
```

## Implementation Details

### State Management
The component maintains several key state variables:
- `subjects`: List of available subjects
- `selectedSubject`: Currently selected subject
- `syllabus`: Curriculum data for the selected subject
- `selection`: Object tracking the current selection at each level
- `recommendations`: Array of recommendation objects from the API

### Selection Tracking
```javascript
const [selection, setSelection] = useState({
  subject: null,
  unit: null,
  skill: null,
  subskill: null
});
```

### Recommendation Processing
```javascript
// Check if an item is recommended
const isRecommended = (id) => {
  if (!recommendations || recommendations.length === 0) return false;
  
  // Direct match check
  const directMatch = recommendations.some(rec => 
    rec.unit_id === id || 
    rec.skill_id === id || 
    rec.subskill_id === id
  );
  
  if (directMatch) return true;
  
  // Check for child recommendations
  // ...
};
```

## Error Handling

The component implements several error handling strategies:
- Visual error state with retry option
- Console logging for API failures
- Graceful fallback when recommendations fail to load
- Loading indicators during API calls

## Performance Considerations

- Tree nodes are rendered conditionally (only when parent is expanded)
- Animations use hardware acceleration
- API calls are triggered only when necessary
- Recommendations update only when selection changes

## Accessibility Features

- Keyboard navigation support
- ARIA attributes for screen readers
- Color contrast for visual elements
- Tooltips for additional context
- Focus indicators for keyboard users
