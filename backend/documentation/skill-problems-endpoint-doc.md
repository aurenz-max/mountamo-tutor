# Skill-Based Problem Generation API

## Endpoint: GET /skill-problems/{student_id}

This endpoint generates multiple problems for a specific skill and subskill, with varied concept groups to provide diverse learning opportunities.

### Purpose

The skill-problems endpoint allows educators and applications to request a set of varied problems targeting a single skill and subskill. Unlike the recommended-problems endpoint which returns problems across different skills based on student needs, this endpoint provides focused practice on a specific skill with conceptual variety.

### URL Parameters

- `student_id` (integer, required): The unique identifier for the student

### Query Parameters

- `subject` (string, required): The subject area (e.g., "math", "literacy", "science")
- `skill_id` (string, required): The specific skill identifier
- `subskill_id` (string, required): The specific subskill identifier
- `count` (integer, optional): Number of problems to generate (default: 5, min: 3, max: 8)

### Response Format

The endpoint returns an array of problem objects, each with the following structure:

```json
[
  {
    "problem_type": "string",
    "problem": "string",
    "answer": "string",
    "success_criteria": ["string", "string", "string"],
    "teaching_note": "string",
    "metadata": {
      "unit": {
        "id": "string",
        "title": "string"
      },
      "skill": {
        "id": "string",
        "description": "string"
      },
      "subskill": {
        "id": "string",
        "description": "string"
      },
      "difficulty": 5.0,
      "objectives": {
        "ConceptGroup": "string",
        "DetailedObjective": "string",
        "OtherProperties": "string"
      },
      "concept_group": "string"
    }
  },
  // Additional problems...
]
```

### Example Request

```
GET /skill-problems/12345?subject=math&skill_id=counting&subskill_id=count-to-10&count=5
```

### Example Response

```json
[
  {
    "problem_type": "Direct Application",
    "problem": "Sarah has 8 toy cars lined up in a row. Count how many cars she has.",
    "answer": "8 cars",
    "success_criteria": [
      "Student counts each car once",
      "Student uses one-to-one correspondence",
      "Student states the final count correctly"
    ],
    "teaching_note": "Watch for students who may skip numbers or count objects twice",
    "metadata": {
      "unit": {
        "id": "numbers",
        "title": "Number Recognition and Counting"
      },
      "skill": {
        "id": "counting",
        "description": "Counting Objects"
      },
      "subskill": {
        "id": "count-to-10",
        "description": "Count objects up to 10"
      },
      "difficulty": 5.0,
      "objectives": {
        "ConceptGroup": "Basic Understanding",
        "DetailedObjective": "Count a set of objects accurately"
      },
      "concept_group": "Basic Understanding"
    }
  },
  {
    "problem_type": "Real World Context",
    "problem": "Max wants to share his 6 cookies with his friend. Count how many cookies Max has.",
    "answer": "6 cookies",
    "success_criteria": [
      "Student counts each cookie once",
      "Student tracks counted objects appropriately",
      "Student provides the correct total"
    ],
    "teaching_note": "This problem prepares students for later division concepts",
    "metadata": {
      "unit": {
        "id": "numbers",
        "title": "Number Recognition and Counting"
      },
      "skill": {
        "id": "counting",
        "description": "Counting Objects"
      },
      "subskill": {
        "id": "count-to-10",
        "description": "Count objects up to 10"
      },
      "difficulty": 5.0,
      "objectives": {
        "ConceptGroup": "Application",
        "DetailedObjective": "Apply counting in sharing contexts"
      },
      "concept_group": "Application"
    }
  }
  // Additional problems...
]
```

### Error Responses

- **404 Not Found**: Returned when no problems could be generated for the specified skill/subskill
  ```json
  {
    "detail": "Failed to generate problems for the specified skill/subskill"
  }
  ```

- **500 Internal Server Error**: Returned when there's a server-side processing error
  ```json
  {
    "detail": "Internal server error: [error message]"
  }
  ```

### Implementation Details

The endpoint works by:

1. Retrieving the base recommendation for the specified skill and subskill
2. Getting detailed learning objectives for the subskill
3. Creating multiple variations with different concept groups
4. Generating varied problems using these concept group variations
5. Parsing and returning the problem set with appropriate metadata

### Use Cases

- **Focused Practice**: Generate multiple practice problems for a particular skill
- **Varied Approach**: Expose students to different conceptual approaches to the same skill
- **Teaching Preparation**: Create a set of problems for a specific lesson plan

### Notes

- The problems will all target the same skill and subskill but with different conceptual approaches
- The `concept_group` field in the metadata provides a way to distinguish between the different conceptual approaches
- For best results, request at least 3 problems to ensure conceptual variety

This endpoint complements the existing `/recommended-problems` endpoint by providing targeted practice on specific skills rather than general recommendations across the curriculum.
