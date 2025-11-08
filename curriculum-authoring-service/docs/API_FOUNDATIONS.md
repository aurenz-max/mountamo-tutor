# AI Foundations API Documentation

## Overview

The AI Foundations API provides endpoints for managing AI-generated foundational content for curriculum subskills. This includes:

- **Master Context**: Core concepts, terminology, learning objectives
- **Context Primitives**: Variety elements for problem generation (objects, scenarios, characters)
- **Visual Schemas**: Approved visual primitive types for content generation

This system shifts AI content generation from a "black box" to a "glass box" workflow, giving educators control over the foundational elements before final content is created.

---

## Endpoints

### 1. Get Foundations

**GET** `/api/subskills/{subskill_id}/foundations`

Retrieve saved AI-generated foundations for a specific subskill.

**Query Parameters:**
- `version_id` (required): Version ID for the curriculum

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "subskill_id": "math-k-counting-1to10",
    "version_id": "v1",
    "master_context": {
      "core_concepts": [
        "One-to-one correspondence",
        "Number sequence",
        "Cardinality"
      ],
      "key_terminology": {
        "count": "Say number names in order while touching objects",
        "quantity": "How many items there are"
      },
      "learning_objectives": [
        "Count to 10 by ones",
        "Recognize that the last number said tells how many"
      ],
      "difficulty_level": "beginner",
      "grade_level": "Kindergarten",
      "prerequisites": [],
      "real_world_applications": [
        "Counting toys",
        "Setting the table"
      ]
    },
    "context_primitives": {
      "concrete_objects": ["apple", "toy car", "crayon", "block"],
      "living_things": ["dog", "cat", "bird"],
      "locations": ["classroom", "playground", "home"],
      "tools": ["pencil", "crayon", "counting beads"],
      "characters": [
        {"name": "Emma", "age": 5, "role": "student"}
      ],
      "scenarios": ["Emma counts her toys", "Setting the table for dinner"],
      "comparison_pairs": [],
      "categories": [],
      "sequences": [],
      "action_words": ["count", "touch", "say"],
      "attributes": []
    },
    "approved_visual_schemas": ["object-collection", "comparison-panel"],
    "generation_status": "edited",
    "is_draft": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T14:22:00Z",
    "last_edited_by": "educator-123"
  },
  "message": "Foundations retrieved successfully"
}
```

**Response (404 Not Found):**
```json
{
  "detail": "No foundations found for subskill math-k-counting-1to10. Use the /generate endpoint to create them."
}
```

---

### 2. Generate Foundations

**POST** `/api/subskills/{subskill_id}/foundations/generate`

Generate fresh AI foundations for a subskill. Does **NOT** save to database - returns fresh generation for review.

**Use Cases:**
- Generate initial foundations for a new subskill
- Regenerate foundations if educator wants to reset

**Query Parameters:**
- `version_id` (required): Version ID for the curriculum

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    // ... full FoundationsData object
  },
  "message": "Foundations generated successfully. Use the PUT endpoint to save them."
}
```

**Response (404 Not Found):**
```json
{
  "detail": "Subskill not found"
}
```

---

### 3. Save Foundations

**PUT** `/api/subskills/{subskill_id}/foundations`

Save user-edited foundations for a subskill. Creates or updates the foundation record.

**Query Parameters:**
- `version_id` (required): Version ID for the curriculum

**Request Body:**
```json
{
  "master_context": {
    "core_concepts": ["Concept 1", "Concept 2"],
    "key_terminology": {"term1": "definition1"},
    "learning_objectives": ["Objective 1"],
    "difficulty_level": "beginner",
    "grade_level": "Kindergarten",
    "prerequisites": [],
    "real_world_applications": ["Application 1"]
  },
  "context_primitives": {
    "concrete_objects": ["apple", "toy"],
    "living_things": ["dog"],
    "locations": ["classroom"],
    "tools": ["pencil"],
    "characters": [{"name": "Emma", "age": 5}],
    "scenarios": ["counting toys"],
    "comparison_pairs": [],
    "categories": [],
    "sequences": [],
    "action_words": ["count"],
    "attributes": []
  },
  "approved_visual_schemas": ["object-collection", "comparison-panel"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    // ... saved FoundationsData object with generation_status='edited'
  },
  "message": "Foundations saved successfully"
}
```

---

### 4. Delete Foundations

**DELETE** `/api/subskills/{subskill_id}/foundations`

Delete foundations for a subskill. This will force regeneration on next access.

**Query Parameters:**
- `version_id` (required): Version ID for the curriculum

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Foundations deleted successfully"
}
```

**Response (404 Not Found):**
```json
{
  "detail": "Foundations not found or could not be deleted"
}
```

---

### 5. Get Foundations Status

**GET** `/api/subskills/{subskill_id}/foundations/status`

Check if foundations exist for a subskill without fetching full data. Useful for UI badges and status indicators.

**Query Parameters:**
- `version_id` (required): Version ID for the curriculum

**Response (200 OK):**
```json
{
  "subskill_id": "math-k-counting-1to10",
  "version_id": "v1",
  "has_foundations": true,
  "generation_status": "edited",
  "last_updated": "2024-01-15T14:22:00Z"
}
```

---

### 6. List Visual Schemas

**GET** `/api/visual-schemas`

Get all available visual schema types organized by category. Use this for populating the visual schema selector in the UI.

**Response (200 OK):**
```json
{
  "categories": [
    {
      "category": "foundational",
      "schemas": ["object-collection", "comparison-panel"],
      "description": "Use FIRST for K-1 content showing/counting objects"
    },
    {
      "category": "math",
      "schemas": ["bar-model", "number-line", "base-ten-blocks", "fraction-circles", "geometric-shape"],
      "description": "Math-specific visualizations"
    },
    {
      "category": "science",
      "schemas": ["labeled-diagram", "cycle-diagram", "tree-diagram", "line-graph", "thermometer"],
      "description": "Science-specific visualizations"
    },
    {
      "category": "language_arts",
      "schemas": ["sentence-diagram", "story-sequence", "word-web", "character-web", "venn-diagram"],
      "description": "Language arts visualizations"
    },
    {
      "category": "abcs",
      "schemas": ["letter-tracing", "letter-picture", "alphabet-sequence", "rhyming-pairs", "sight-word-card", "sound-sort"],
      "description": "ABC/Early literacy visualizations"
    }
  ],
  "all_schemas": [
    "object-collection", "comparison-panel", "bar-model", "number-line",
    // ... all schemas flattened
  ]
}
```

---

## Workflow Example

### Typical Educator Workflow

1. **Navigate to Subskill**: Educator opens a subskill in the curriculum designer
2. **Click "Manage AI Foundations"**: Opens the foundations editor
3. **Generate**: System calls `POST /foundations/generate` to create initial foundations
4. **Review & Edit**: Educator reviews AI-generated content:
   - Adds/removes core concepts
   - Refines terminology definitions
   - Adjusts context primitives (characters, scenarios, objects)
   - Selects/deselects visual schemas
5. **Save**: System calls `PUT /foundations` to persist changes
6. **Use in Content Generation**: When problems/reading content is generated, the system uses these approved foundations

### Integration with Content Generation

When generating practice problems or reading content:

```python
# Pseudocode for content generation service
async def generate_problem(subskill_id, version_id):
    # Step 1: Try to get educator-approved foundations
    foundations = await get_foundations(subskill_id, version_id)

    if foundations:
        # Use approved foundations
        master_context = foundations.master_context
        primitives = foundations.context_primitives
        allowed_schemas = foundations.approved_visual_schemas
    else:
        # Fallback: Generate on-the-fly (current behavior)
        master_context = await generate_master_context()
        primitives = await generate_primitives()
        allowed_schemas = None  # Use all schemas

    # Step 2: Generate problem using foundations
    problem = await problem_generator.generate(
        master_context=master_context,
        primitives=primitives,
        allowed_schemas=allowed_schemas
    )

    return problem
```

---

## Data Models

### MasterContext

```typescript
{
  core_concepts: string[];           // 4-6 core concepts
  key_terminology: Record<string, string>;  // Term -> Definition
  learning_objectives: string[];     // 4-6 objectives
  difficulty_level: string;
  grade_level: string;
  prerequisites: string[];
  real_world_applications: string[];
}
```

### ContextPrimitives

```typescript
{
  concrete_objects: string[];
  living_things: string[];
  locations: string[];
  tools: string[];
  characters: Character[];  // {name, age?, role?}
  scenarios: string[];
  comparison_pairs: ComparisonPair[];  // {attribute, examples[]}
  categories: Category[];  // {name, items[]}
  sequences: string[][];
  action_words: string[];
  attributes: Attribute[];  // {name, values[]}
}
```

### FoundationsData

```typescript
{
  subskill_id: string;
  version_id: string;
  master_context: MasterContext;
  context_primitives: ContextPrimitives;
  approved_visual_schemas: string[];
  generation_status: 'pending' | 'generated' | 'edited';
  is_draft: boolean;
  created_at: datetime;
  updated_at: datetime;
  last_edited_by?: string;
}
```

---

## Error Handling

All endpoints return standard HTTP status codes:

- `200 OK`: Request succeeded
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

Error responses include a `detail` field with a human-readable message:

```json
{
  "detail": "Error message here"
}
```

---

## Rate Limiting & Performance

- **Generation Endpoint**: May take 10-30 seconds due to AI processing
- **Get/Save/Delete**: Typically < 1 second
- **Caching**: Foundations are cached in BigQuery for fast retrieval

---

## Security

- All endpoints require authentication (Firebase Auth)
- Only educators with designer role can modify foundations
- Foundations are versioned and tied to curriculum versions
- Draft foundations are isolated from published content

---

## Next Steps

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for frontend integration instructions.
