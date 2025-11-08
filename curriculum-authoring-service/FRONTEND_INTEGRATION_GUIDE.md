# Frontend Integration Guide - Content Generation System

## Executive Summary

We've built a **complete content generation and editing system** that allows educators to create, review, and refine educational reading content with interactive elements and visual snippets. The system supports both **batch generation** and **section-level editing**, eliminating the "all or nothing" problem you had before.

### What We Built

**Before:**
- Visual schema recommender (removed - too abstract)
- No way to edit individual sections after generation
- Stuck with entire package if you didn't like one section

**After:**
1. ✅ **Batch Content Generation** - Generate all reading sections at once
2. ✅ **Section-Level Regeneration** - Regenerate any section you don't like
3. ✅ **Manual Section Editing** - Edit text, key terms, interactive primitives
4. ✅ **Visual Snippet Generation** - Create interactive HTML visualizations per section
5. ✅ **Complete CRUD Operations** - Create, Read, Update, Delete for all content

---

## System Overview

### Architecture

```
Foundations (Master Context + Primitives)
    ↓
Reading Content Generator
    ↓
Reading Sections (with Interactive Primitives)
    ↓
Visual Snippet Generator
    ↓
Interactive HTML Visualizations
```

### Data Flow

1. **Educator** creates curriculum structure (subject → unit → skill → subskill)
2. **Educator** generates AI foundations (or system generates automatically)
3. **Educator** clicks "Generate Reading Content"
4. **System** generates 4-6 sections with interactive primitives
5. **Educator** reviews content in UI
6. **Educator** can:
   - Regenerate any section with custom prompt
   - Manually edit any section
   - Generate visual snippets for key sections
   - Edit HTML of visual snippets

---

## API Reference

**Base URL:** `http://localhost:8001/api`

### 1. Generate Complete Reading Content

**Endpoint:** `POST /subskills/{subskill_id}/content/generate`

**Query Parameters:**
- `version_id` (required): Version identifier (e.g., "v1", "draft-2024")
- `use_foundations` (optional, default: true): Whether to use saved foundations

**Request:**
```bash
POST /subskills/math-k-counting-1to10/content/generate?version_id=v1&use_foundations=true
```

**Response:**
```json
{
  "success": true,
  "message": "Generated 5 sections of reading content",
  "data": {
    "subskill_id": "math-k-counting-1to10",
    "version_id": "v1",
    "title": "Counting from 1 to 10",
    "sections": [
      {
        "section_id": "math-k-counting-1to10_section_1",
        "section_order": 1,
        "heading": "What is Counting?",
        "content_text": "Counting is when we say numbers in order...",
        "key_terms": ["counting", "number", "quantity"],
        "concepts_covered": ["one-to-one correspondence"],
        "interactive_primitives": [
          {
            "type": "alert",
            "style": "tip",
            "title": "Remember!",
            "content": "Point to each object as you count."
          },
          {
            "type": "quiz",
            "question": "If you see 3 apples, what is the last number you say?",
            "answer": "3",
            "explanation": "The last number you say tells how many objects there are!"
          }
        ],
        "has_visual_snippet": false,
        "created_at": "2025-01-15T10:30:00Z",
        "updated_at": "2025-01-15T10:30:00Z"
      }
      // ... 4 more sections
    ],
    "generation_status": "generated",
    "is_draft": true,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z"
  }
}
```

---

### 2. Get Reading Content

**Endpoint:** `GET /subskills/{subskill_id}/content`

**Query Parameters:**
- `version_id` (required): Version identifier

**Request:**
```bash
GET /subskills/math-k-counting-1to10/content?version_id=v1
```

**Response:** Same structure as generate endpoint

**Use Case:** Display existing content in the UI for review/editing

---

### 3. Regenerate Single Section

**Endpoint:** `POST /subskills/{subskill_id}/content/sections/{section_id}/regenerate`

**Query Parameters:**
- `version_id` (required): Version identifier
- `custom_prompt` (optional): Custom instructions for regeneration

**Request:**
```bash
POST /subskills/math-k-counting-1to10/content/sections/math-k-counting-1to10_section_1/regenerate?version_id=v1&custom_prompt=Add%20more%20examples%20with%20toys

# With custom prompt in URL-encoded format
```

**Response:**
```json
{
  "success": true,
  "message": "Section 'What is Counting?' regenerated successfully",
  "data": {
    "section_id": "math-k-counting-1to10_section_1",
    "section_order": 1,
    "heading": "What is Counting?",
    "content_text": "Counting is when we say numbers in order. Let's practice with your favorite toys! You can count toy cars, dolls, blocks...",
    "key_terms": ["counting", "number", "quantity"],
    "concepts_covered": ["one-to-one correspondence"],
    "interactive_primitives": [...],
    "has_visual_snippet": false,
    "updated_at": "2025-01-15T10:35:00Z"
  }
}
```

**Use Case:** Educator doesn't like one section, regenerates it with different focus

---

### 4. Manually Edit Section

**Endpoint:** `PUT /subskills/{subskill_id}/content/sections/{section_id}`

**Query Parameters:**
- `version_id` (required): Version identifier

**Request Body:** (All fields optional - only update what you provide)
```json
{
  "heading": "What is Counting? Let's Learn!",
  "content_text": "Updated text...",
  "key_terms": ["counting", "numbers", "one-to-one"],
  "concepts_covered": ["counting basics", "number recognition"],
  "interactive_primitives": [
    {
      "type": "alert",
      "style": "info",
      "title": "Did You Know?",
      "content": "Counting is one of the first math skills you learn!"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Section 'What is Counting? Let's Learn!' updated successfully",
  "data": { /* updated section */ }
}
```

**Use Case:** Educator makes manual tweaks to generated content

---

### 5. Generate Visual Snippet

**Endpoint:** `POST /subskills/{subskill_id}/content/sections/{section_id}/visual/generate`

**Request Body:**
```json
{
  "section_id": "math-k-counting-1to10_section_1",
  "custom_prompt": "Create an interactive counting game with clickable apples"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Visual snippet generated for section 'What is Counting?'",
  "data": {
    "snippet_id": "550e8400-e29b-41d4-a716-446655440000",
    "subskill_id": "math-k-counting-1to10",
    "section_id": "math-k-counting-1to10_section_1",
    "html_content": "<!DOCTYPE html>\n<html>\n<head>...",
    "generation_prompt": "Create an interactive counting game...",
    "created_at": "2025-01-15T10:40:00Z",
    "updated_at": "2025-01-15T10:40:00Z"
  }
}
```

**Use Case:** Add interactive visualization to a section

---

### 6. Get Visual Snippet

**Endpoint:** `GET /subskills/{subskill_id}/content/sections/{section_id}/visual`

**Response:**
```json
{
  "success": true,
  "message": "Visual snippet retrieved successfully",
  "data": {
    "snippet_id": "550e8400-e29b-41d4-a716-446655440000",
    "html_content": "<!DOCTYPE html>\n<html>...",
    "created_at": "2025-01-15T10:40:00Z"
  }
}
```

**Use Case:** Preview or download the HTML snippet

---

### 7. Update Visual Snippet

**Endpoint:** `PUT /subskills/{subskill_id}/content/sections/{section_id}/visual`

**Request Body:**
```json
{
  "html_content": "<!DOCTYPE html>\n<html>... modified HTML ..."
}
```

**Use Case:** Educator manually tweaks the generated HTML

---

### 8. Delete Visual Snippet

**Endpoint:** `DELETE /subskills/{subskill_id}/content/sections/{section_id}/visual`

**Response:**
```json
{
  "success": true,
  "message": "Visual snippet deleted successfully"
}
```

---

## Interactive Primitives Reference

Each section can include these interactive elements:

### 1. Alert
```json
{
  "type": "alert",
  "style": "info" | "warning" | "success" | "tip",
  "title": "Remember!",
  "content": "Point to each object as you count."
}
```
**UI:** Colored callout box with icon

---

### 2. Quiz
```json
{
  "type": "quiz",
  "question": "If you see 3 apples, what is the last number you say?",
  "answer": "3",
  "explanation": "The last number tells how many!"
}
```
**UI:** Interactive question with reveal answer button

---

### 3. Definition
```json
{
  "type": "definition",
  "term": "Counting",
  "definition": "Saying numbers in order while pointing to objects"
}
```
**UI:** Hover tooltip or expandable definition

---

### 4. Expandable
```json
{
  "type": "expandable",
  "title": "Learn More About Counting",
  "content": "Detailed explanation that's hidden by default..."
}
```
**UI:** Collapsible section (accordion)

---

### 5. Checklist
```json
{
  "type": "checklist",
  "text": "I can count from 1 to 10",
  "completed": false
}
```
**UI:** Interactive checkbox

---

### 6. Table
```json
{
  "type": "table",
  "headers": ["Number", "Word", "Example"],
  "rows": [
    ["1", "one", "one apple"],
    ["2", "two", "two apples"]
  ]
}
```
**UI:** Standard HTML table

---

### 7. KeyValue
```json
{
  "type": "keyvalue",
  "key": "Total Objects",
  "value": "10"
}
```
**UI:** Bold key-value pair display

---

### 8. InteractiveTimeline
```json
{
  "type": "interactive_timeline",
  "title": "History of Counting",
  "events": [
    {
      "date": "3000 BC",
      "title": "Ancient Counting",
      "description": "People used tally marks..."
    }
  ]
}
```
**UI:** Visual timeline with clickable events

---

### 9. Carousel
```json
{
  "type": "carousel",
  "title": "Counting Objects",
  "items": [
    {
      "image_url": "https://example.com/apples.jpg",
      "alt_text": "Three red apples",
      "caption": "Count the apples: 1, 2, 3"
    }
  ]
}
```
**UI:** Image slider/carousel

---

### 10. FlipCard
```json
{
  "type": "flip_card",
  "front_content": "How many?",
  "back_content": "5"
}
```
**UI:** Card that flips on click

---

### 11. Categorization Activity
```json
{
  "type": "categorization",
  "instruction": "Sort these numbers",
  "categories": ["Even", "Odd"],
  "items": [
    { "item_text": "2", "correct_category": "Even" },
    { "item_text": "3", "correct_category": "Odd" }
  ]
}
```
**UI:** Drag-and-drop sorting activity

---

### 12. Fill in the Blank
```json
{
  "type": "fill_in_the_blank",
  "sentence": "If I have 3 apples and get 2 more, I have __ apples.",
  "correct_answer": "5",
  "hint": "Add them together!"
}
```
**UI:** Input field with validation

---

### 13. Scenario Question
```json
{
  "type": "scenario_question",
  "scenario": "Emma has 5 toy cars. She gives 2 to her friend.",
  "question": "How many does Emma have left?",
  "answer_options": ["2", "3", "5", "7"],
  "correct_answer": "3",
  "explanation": "5 - 2 = 3"
}
```
**UI:** Multiple choice question

---

## Recommended UI Components

### 1. Content Generation Page

**Component:** `ContentGenerationWizard.tsx`

```tsx
import { useState } from 'react';

interface Section {
  section_id: string;
  heading: string;
  content_text: string;
  interactive_primitives: any[];
  has_visual_snippet: boolean;
}

export function ContentGenerationWizard({ subskillId, versionId }) {
  const [content, setContent] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);

  const generateContent = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/subskills/${subskillId}/content/generate?version_id=${versionId}`,
        { method: 'POST' }
      );
      const data = await response.json();
      setContent(data.data.sections);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={generateContent} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Reading Content'}
      </button>

      {content.map((section) => (
        <SectionCard
          key={section.section_id}
          section={section}
          subskillId={subskillId}
          versionId={versionId}
        />
      ))}
    </div>
  );
}
```

---

### 2. Section Card with Actions

**Component:** `SectionCard.tsx`

```tsx
export function SectionCard({ section, subskillId, versionId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const regenerateSection = async () => {
    const params = new URLSearchParams({
      version_id: versionId,
      ...(customPrompt && { custom_prompt: customPrompt })
    });

    const response = await fetch(
      `/api/subskills/${subskillId}/content/sections/${section.section_id}/regenerate?${params}`,
      { method: 'POST' }
    );
    const data = await response.json();
    // Update section in parent state
  };

  const generateVisual = async () => {
    const response = await fetch(
      `/api/subskills/${subskillId}/content/sections/${section.section_id}/visual/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: section.section_id })
      }
    );
    // Handle visual snippet
  };

  return (
    <div className="section-card">
      <h3>{section.heading}</h3>

      {/* Content Display */}
      <div className="content">
        <p>{section.content_text}</p>

        {/* Interactive Primitives */}
        {section.interactive_primitives.map((primitive, idx) => (
          <InteractivePrimitive key={idx} data={primitive} />
        ))}
      </div>

      {/* Key Terms & Concepts */}
      <div className="metadata">
        <div>
          <strong>Key Terms:</strong> {section.key_terms.join(', ')}
        </div>
        <div>
          <strong>Concepts:</strong> {section.concepts_covered.join(', ')}
        </div>
      </div>

      {/* Actions */}
      <div className="actions">
        <button onClick={() => setIsEditing(!isEditing)}>
          Edit Manually
        </button>

        <button onClick={regenerateSection}>
          Regenerate Section
        </button>

        <button onClick={generateVisual}>
          {section.has_visual_snippet ? 'View Visual' : 'Generate Visual'}
        </button>
      </div>

      {/* Regeneration Custom Prompt */}
      {isEditing && (
        <textarea
          placeholder="Optional: Add custom instructions for regeneration..."
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />
      )}
    </div>
  );
}
```

---

### 3. Interactive Primitive Renderer

**Component:** `InteractivePrimitive.tsx`

```tsx
export function InteractivePrimitive({ data }) {
  switch (data.type) {
    case 'alert':
      return (
        <div className={`alert alert-${data.style}`}>
          <strong>{data.title}</strong>
          <p>{data.content}</p>
        </div>
      );

    case 'quiz':
      return <QuizComponent question={data.question} answer={data.answer} />;

    case 'definition':
      return (
        <div className="definition">
          <strong>{data.term}:</strong> {data.definition}
        </div>
      );

    case 'expandable':
      return (
        <details>
          <summary>{data.title}</summary>
          <p>{data.content}</p>
        </details>
      );

    case 'table':
      return (
        <table>
          <thead>
            <tr>
              {data.headers.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => <td key={j}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );

    // Add more cases for other primitive types...

    default:
      return <div>Unsupported primitive: {data.type}</div>;
  }
}
```

---

### 4. Visual Snippet Viewer/Editor

**Component:** `VisualSnippetModal.tsx`

```tsx
export function VisualSnippetModal({ subskillId, sectionId, isOpen, onClose }) {
  const [snippet, setSnippet] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchSnippet();
    }
  }, [isOpen]);

  const fetchSnippet = async () => {
    const response = await fetch(
      `/api/subskills/${subskillId}/content/sections/${sectionId}/visual`
    );
    if (response.ok) {
      const data = await response.json();
      setSnippet(data.data);
      setHtmlContent(data.data.html_content);
    }
  };

  const saveSnippet = async () => {
    await fetch(
      `/api/subskills/${subskillId}/content/sections/${sectionId}/visual`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html_content: htmlContent })
      }
    );
    setIsEditing(false);
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="visual-snippet-modal">
        <h2>Visual Snippet</h2>

        {/* Preview */}
        {!isEditing && snippet && (
          <iframe
            srcDoc={snippet.html_content}
            style={{ width: '100%', height: '500px', border: 'none' }}
          />
        )}

        {/* HTML Editor */}
        {isEditing && (
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            style={{ width: '100%', height: '500px', fontFamily: 'monospace' }}
          />
        )}

        {/* Actions */}
        <div className="actions">
          <button onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Preview' : 'Edit HTML'}
          </button>
          {isEditing && <button onClick={saveSnippet}>Save</button>}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
```

---

## Typical User Workflows

### Workflow 1: Generate New Content

1. Educator navigates to subskill page
2. Clicks "Generate Reading Content" button
3. System generates 4-6 sections with interactive primitives
4. Educator reviews content:
   - ✅ Sections 1, 2, 3 look great
   - ❌ Section 4 needs more examples
   - ❌ Section 5 is too advanced
5. Educator regenerates sections 4 & 5 with custom prompts
6. Educator adds visual snippets to sections 1 and 3
7. Educator publishes content

---

### Workflow 2: Edit Existing Content

1. Educator opens existing subskill content
2. Reviews section 2 - finds typo in text
3. Clicks "Edit Manually" on section 2
4. Fixes typo, adds an extra quiz question
5. Saves changes
6. Content automatically updates

---

### Workflow 3: Add Visual Snippets

1. Educator reviews generated reading content
2. Decides section 3 would benefit from visualization
3. Clicks "Generate Visual" on section 3
4. System generates interactive HTML (e.g., counting animation)
5. Educator previews visual in modal
6. Educator tweaks HTML to change colors
7. Saves visual snippet
8. Visual appears embedded in section 3

---

## Error Handling

### API Errors

```tsx
const handleGenerateContent = async () => {
  try {
    const response = await fetch(/* ... */);

    if (!response.ok) {
      const error = await response.json();

      // Handle specific errors
      if (response.status === 404) {
        alert('Subskill not found or no foundations available. Generate foundations first.');
      } else if (response.status === 500) {
        alert(`Generation failed: ${error.detail}`);
      }
      return;
    }

    const data = await response.json();
    // Handle success...

  } catch (error) {
    console.error('Network error:', error);
    alert('Failed to connect to server. Check your internet connection.');
  }
};
```

---

## Performance Considerations

### 1. Content Generation (Slow)
- **Time:** 30-60 seconds for complete package
- **UI:** Show loading spinner with progress message
- **Best Practice:** Disable button during generation

### 2. Section Regeneration (Medium)
- **Time:** 10-20 seconds per section
- **UI:** Show loading state on specific section card
- **Best Practice:** Allow regenerating multiple sections concurrently

### 3. Visual Snippet Generation (Slow)
- **Time:** 20-40 seconds per visual
- **UI:** Show loading modal with animation
- **Best Practice:** Cache generated visuals (already handled by backend)

### 4. Manual Edits (Fast)
- **Time:** <1 second
- **UI:** Optimistic updates
- **Best Practice:** Debounce save operations

---

## Testing Checklist

### Backend Setup
- [ ] BigQuery tables created (run `docs/bigquery_content_tables.sql`)
- [ ] Service running on port 8001
- [ ] `/health` endpoint returns "healthy"
- [ ] `/docs` shows all content endpoints

### API Testing
- [ ] Generate content for a test subskill
- [ ] Retrieve generated content
- [ ] Regenerate a single section
- [ ] Manually edit a section
- [ ] Generate a visual snippet
- [ ] Retrieve and preview visual snippet
- [ ] Delete a visual snippet

### UI Testing
- [ ] Content generation button works
- [ ] All sections display correctly
- [ ] Interactive primitives render properly
- [ ] Regenerate section with custom prompt works
- [ ] Manual editing updates persist
- [ ] Visual snippet modal opens/closes
- [ ] HTML preview works in iframe
- [ ] Editing HTML and saving works

---

## Environment Variables

Your frontend needs these environment variables:

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api
```

Usage in code:
```tsx
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const response = await fetch(`${API_BASE}/subskills/${id}/content/generate`);
```

---

## Common Issues & Solutions

### Issue 1: "No foundations found"
**Solution:** Generate foundations first using `/api/subskills/{id}/foundations/generate`

### Issue 2: "Content generation timeout"
**Solution:** Increase request timeout to 120 seconds (content generation is slow)

### Issue 3: "Interactive primitives not rendering"
**Solution:** Check primitive type is supported in `InteractivePrimitive.tsx`

### Issue 4: "Visual snippet iframe not loading"
**Solution:** Ensure HTML is valid and use `srcDoc` (not `src`) for iframe

### Issue 5: "Section updates not saving"
**Solution:** Check `version_id` query parameter is included in PUT request

---

## Next Steps

### Phase 1: Basic Implementation (Week 1)
1. Create `ContentGenerationWizard` component
2. Implement section display with interactive primitives
3. Add "Generate Content" button functionality
4. Test with sample subskill

### Phase 2: Editing Features (Week 2)
1. Add "Regenerate Section" functionality
2. Implement manual editing form
3. Add visual snippet generation button
4. Create visual snippet modal

### Phase 3: Polish & UX (Week 3)
1. Add loading states and progress indicators
2. Implement error handling and user feedback
3. Add confirmation dialogs for destructive actions
4. Optimize rendering of interactive primitives

### Phase 4: Advanced Features (Optional)
1. Bulk operations (regenerate multiple sections)
2. Content templates by subject area
3. Export to PDF/SCORM
4. Collaboration features (comments, reviews)

---

## Support & Questions

**Documentation:**
- Full implementation details: `CONTENT_GENERATION_IMPLEMENTATION.md`
- BigQuery schemas: `docs/bigquery_content_tables.sql`
- API docs: http://localhost:8001/docs (when service is running)

**Key Files:**
- API endpoints: `app/api/content.py`
- Models: `app/models/content.py`
- Service logic: `app/services/content_service.py`

**Contact:**
- Backend questions: Check `CONTENT_GENERATION_IMPLEMENTATION.md`
- API issues: Test in `/docs` interactive API explorer
- Data questions: Query BigQuery tables directly

---

## Summary

You now have a **complete content authoring system** that:

✅ Generates reading content in batch
✅ Allows section-level regeneration
✅ Supports manual editing
✅ Creates interactive HTML visualizations
✅ Stores everything in BigQuery
✅ Provides a full REST API

**The key benefit:** Educators are never stuck with generated content they don't like. They can always regenerate or edit individual sections without losing their other work!

Start with Phase 1 (basic generation) and progressively add features. The API is production-ready and waiting for your UI! 🚀
