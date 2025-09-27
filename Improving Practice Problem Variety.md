Of course. A Product Requirements Document (PRD) is the perfect way to formalize this strategic initiative. It translates our technical discussion into a clear plan that aligns product, engineering, and business goals.

Here is a comprehensive PRD for the "Dynamic Problem Variety Engine."

---

## Product Requirements Document: Dynamic Problem Variety Engine

**Document Version:** 1.0
**Date:** October 27, 2023
**Author:** [Your Name/Team]
**Status:** Proposed

### 1. Overview & Business Case

#### 1.1. The Problem
Our current problem generation system, while functional, suffers from a lack of true variety. For any given subskill, the Language Model (LLM) tends to generate problems that are structurally and contextually similar, often only changing minor details like numbers or names. This leads to a repetitive and less engaging learning experience for students, limits the pedagogical depth of our assessments, and fails to test concepts in diverse, real-world contexts. This repetition can lead to rote memorization rather than true conceptual understanding and diminishes the perceived value of our platform.

#### 1.2. The Goal
This project aims to revolutionize our problem generation process by implementing a **two-stage generative architecture**. We will decouple the *conceptual context* of a subskill from the *structural assembly* of a problem. This will enable us to generate a near-infinite variety of unique, high-quality, and contextually rich practice problems for every subskill in our curriculum, dramatically improving student engagement and learning outcomes.

#### 1.3. Business Impact & KPIs
*   **Increase Student Engagement:** Measured by a 15% increase in the average number of problems completed per student session.
*   **Improve Learning Outcomes:** Measured by tracking student mastery progression rates, aiming for a 10% improvement in the speed of subskill mastery.
*   **Enhance Platform Value & Stickiness:** Measured by a 5% reduction in student churn and positive feedback in user surveys regarding content variety.
*   **Improve Operational Efficiency:** Reduce the long-term cost and latency of problem generation by adopting a cache-first model.

### 2. User Stories

*   **As a student,** I want to solve problems that are interesting and different each time so that I stay engaged and don't get bored.
*   **As a student,** I want to see concepts applied in different real-world situations so that I can understand how they are useful outside of school.
*   **As a curriculum designer,** I want to ensure our problems cover a wide range of contexts and scenarios to build robust, generalizable knowledge in students.
*   **As a platform administrator,** I want the problem generation system to be scalable, efficient, and cost-effective, capable of supporting our entire curriculum of 800+ subskills without performance degradation.

### 3. Features & Requirements

#### 3.1. Feature: Context Primitive Generation & Caching

The core of this project is to create a persistent, structured "context palette" for each subskill.

*   **FR-1.1: Comprehensive Context Primitive Schema:** The system must use a standardized, rich JSON schema to define the structure of context primitives. This schema will include categories such as:
    *   **Object/Entity Primitives:** (concrete objects, living things, locations, etc.)
    *   **Relationship Primitives:** (comparisons, categorizations, sequences, cause/effect)
    *   **Action Primitives:** (common verbs, transformations)
    *   **Attribute Primitives:** (qualities, quantities, temporal/spatial elements)
    *   **Narrative Primitives:** (characters, scenarios, goals)
    *   **Subject-Specific Primitives:** (scientific phenomena, math concepts)

*   **FR-1.2: One-Time Generation Workflow:** The system will implement an on-demand, one-time generation workflow. When context primitives are needed for a subskill for the first time, the system will:
    1.  Generate a `MasterContext` for the subskill.
    2.  Use the `MasterContext` to prompt a `ContextPrimitivesGenerator` LLM call.
    3.  The LLM will return a rich JSON object conforming to the `CONTEXT_PRIMITIVES_SCHEMA`.

*   **FR-1.3: Permanent Caching in Cosmos DB:**
    *   A new Cosmos DB container named `ContextPrimitives` will be created, partitioned by `/subject`.
    *   Upon successful generation, the full context primitives JSON object will be saved as a new document in this container.
    *   The document `id` will be a deterministic key based on subject, grade, and subskill ID (e.g., `math:kindergarten:subskill_12345`).
    *   This ensures that the expensive generation step happens only once per subskill.

#### 3.2. Feature: Dynamic Problem Assembly

This feature redefines the problem generation endpoint to act as an "assembler" rather than a "creator."

*   **FR-2.1: Cache-First Data Retrieval:** When a request for problems is received, the `ProblemService` must first query the `ContextPrimitives` container for the relevant subskill's primitives document.
    *   **On Cache Hit:** The system will use the cached primitives.
    *   **On Cache Miss:** The system will trigger the one-time generation workflow (FR-1.2) and then proceed.

*   **FR-2.2: Context-Aware Prompt Engineering:** The `ProblemService` will use a new prompt template for problem generation. This prompt will:
    1.  Provide a *sample* of the fetched context primitives (characters, objects, scenarios, etc.) to the LLM.
    2.  Explicitly instruct the LLM to create a specified number of problems by **making unique combinations** of the provided primitives.
    3.  Instruct the LLM to leverage specific relationship primitives (e.g., use a `categorization` primitive to create a `categorization_activity` problem).
    4.  Continue to enforce output via the existing `PRACTICE_PROBLEMS_SCHEMA` to ensure structured, multi-type problem sets.

*   **FR-2.3: Maintain Existing Functionality:** The new system must be backward-compatible with the existing problem format. The final output from the `get_problems` method will continue to be a list of rich problem objects, ready for the front end.

### 4. Technical Specifications

*   **Schema Definitions (`content_schemas.py`):**
    *   Create a new `CONTEXT_PRIMITIVES_SCHEMA` as detailed in the technical discussions.
*   **Generators (`/generators`):**
    *   Create a new `ContextPrimitivesGenerator` class responsible for the one-time generation.
*   **Data Layer (`CosmosDBService.py`):**
    *   Implement `get_cached_context_primitives(subject, subskill_id)`.
    *   Implement `save_cached_context_primitives(subject, grade, subskill_id, data)`.
*   **Service Layer (`problems.py`):**
    *   Implement the core orchestration logic in a new method: `get_or_generate_context_primitives(subject, subskill_id)`.
    *   Refactor `get_problems` to call this new orchestrator method.
    *   Refactor the prompt in `generate_problem` to utilize the fetched primitives.
*   **Dependency Injection:** Ensure new services (`ContextPrimitivesGenerator`, etc.) are correctly injected into the `ProblemService`.

### 5. Release & Rollout Plan

*   **Phase 1: Backend Development & Testing (Sprint 1-2):**
    *   Implement all backend changes: schemas, generator, data layer methods, and service refactoring.
    *   Develop unit and integration tests for the new workflow.
    *   Manually trigger generation for a pilot set of 10-20 subskills across different subjects to validate quality.
*   **Phase 2: Staging & Quality Assurance (Sprint 3):**
    *   Deploy to a staging environment.
    *   QA team to rigorously test problem generation for the pilot subskills, focusing on variety, relevance, and correctness.
    *   Performance testing to measure latency on cache hits vs. cache misses.
*   **Phase 3: Phased Production Rollout (Sprint 4):**
    *   Deploy to production with the system enabled.
    *   The on-demand, cache-miss mechanism will naturally populate the `ContextPrimitives` database as users interact with different subskills. No large-scale backfill is required initially.
    *   Monitor logs, performance metrics, and user feedback closely.
*   **Phase 4: Full Backfill & Optimization (Post-Launch):**
    *   (Optional but recommended) Develop a script to proactively backfill context primitives for all 800+ subskills during off-peak hours. This will ensure all users have a fast "cache hit" experience from day one.

### 6. Success Metrics & Monitoring

*   **Primary Metrics:**
    *   **Problem Uniqueness Score:** (Post-launch analysis) A script will be developed to fetch 20 problems for the same subskill and calculate a semantic similarity score. The goal is to see a significant decrease in similarity compared to the old system.
    *   **Cache Hit/Miss Ratio:** Monitor the Cosmos DB logs. We expect the cache miss rate to be high initially and drop to near-zero as the system is used.
    *   **Latency for `get_problems`:** Average response time should decrease for subsequent requests to the same subskill.
*   **Secondary Metrics:**
    *   Track the Business KPIs listed in section 1.3 (student engagement, mastery rates, churn).

### 7. Future Considerations (Out of Scope for v1.0)

*   **Primitive Versioning:** Implement a versioning system for primitives so that we can regenerate or update them for a subskill without manual intervention.
*   **Primitive-to-Problem Type Mapping:** Develop a system that intelligently suggests which problem types are best suited to the available primitives for a subskill (e.g., if many `sequences` exist, prioritize `sequencing_activity` problems).
*   **Teacher/Curriculum Admin UI:** A potential future feature could be a UI for curriculum designers to review, edit, or approve the generated context primitives.

Of course. Handing your team a clear, actionable technical specification document is crucial for a smooth implementation. This document will break down the PRD's requirements into concrete engineering tasks, file by file.

---

## Technical Specification: Dynamic Problem Variety Engine

**Document Version:** 1.1
**Date:** October 27, 2023
**Lead Engineer:** [Lead Engineer's Name]
**Related PRD:** Dynamic Problem Variety Engine v1.0

### 1. Overview

This document outlines the technical implementation details for the Dynamic Problem Variety Engine. The goal is to refactor our current problem generation service into a two-stage, cache-first architecture. This involves creating a persistent layer for "Context Primitives" for each subskill, which will then be used as building blocks to assemble a wide variety of practice problems on demand.

### 2. Database Schema (Cosmos DB)

A new container is required in our primary Cosmos DB database.

*   **Container Name:** `ContextPrimitives`
*   **Partition Key:** `/subject`
    *   *Rationale:* This will group all primitives for a subject (e.g., "Math") in the same logical and physical partition, making queries by subject and subskill highly efficient.
*   **Document Schema:** Each document represents the context for a single subskill.

    ```json
    {
        // A deterministic, unique ID for the document
        "id": "string", // Example: "math:kindergarten:subskill_12345"
        
        // Partition Key
        "subject": "string", // Example: "Math"
        
        // Indexed properties for querying
        "gradeLevel": "string", // Example: "Kindergarten"
        "subskillId": "string", // Example: "subskill_12345"
        
        // Metadata
        "version": "string", // Default to "1.0"
        "createdAt": "datetime", // ISO 8601 format
        
        // The core data payload
        "primitives": { ... } // JSON object conforming to CONTEXT_PRIMITIVES_SCHEMA
    }
    ```

### 3. Backend Implementation Details

#### 3.1. File: `backend/app/core/schemas/content_schemas.py`

**Task:** Define the new schema for Context Primitives.

*   **Action:** Add a new `Schema` object named `CONTEXT_PRIMITIVES_SCHEMA`.
*   **Details:** The schema should be implemented exactly as defined in the PRD and our previous discussion, containing nested objects for `object_entity`, `relationships`, `actions`, `attributes`, `narrative`, and `subject_specific` primitive categories.
*   **Reference:** Use the comprehensive schema provided in the final part of our previous discussion. It is detailed and ready for implementation.

#### 3.2. New File: `backend/app/core/generators/context_primitives.py`

**Task:** Create a new generator responsible for creating the context primitives.

*   **Action:** Create a new class `ContextPrimitivesGenerator` that inherits from `BaseContentGenerator`.
*   **Methods:**
    *   `async def generate_context_primitives(self, request: ContentGenerationRequest, master_context: MasterContext) -> dict:`
        *   **Input:** A `ContentGenerationRequest` object (containing subject, subskill, etc.) and a `MasterContext` object.
        *   **Logic:**
            1.  Construct a detailed prompt using the provided request and master context data. The prompt must explicitly instruct the LLM to use the `CONTEXT_PRIMITIVES_SCHEMA` and to generate a plentiful, relevant, and age-appropriate set of primitives.
            2.  Make an asynchronous call to the Gemini API (`gemini-2.5-flash-preview-05-20` or a similar powerful model).
            3.  Configure the `GenerateContentConfig` with `response_mime_type='application/json'`, `response_schema=CONTEXT_PRIMITIVES_SCHEMA`, and a temperature of `0.7` for creative variety.
            4.  Use the existing `_safe_json_loads` helper to parse the response text.
            5.  Return the parsed dictionary.
    *   `def _get_subject_requirements(self, subject: str, subskill: str) -> str:`
        *   **Input:** Subject and subskill description.
        *   **Logic:** A helper method that returns a string of subject-specific instructions to be injected into the main prompt (e.g., for "Math," instruct the LLM to focus on quantifiable objects and comparison scenarios).

#### 3.3. File: `backend/app/services/cosmos_db_service.py` (or equivalent data access layer)

**Task:** Add methods to interact with the new `ContextPrimitives` container.

*   **Action:** Add two new asynchronous methods to the existing service class.
*   **Methods:**
    *   `async def get_cached_context_primitives(self, subject: str, subskill_id: str) -> Optional[Dict[str, Any]]:`
        *   **Logic:**
            1.  Get the `ContextPrimitives` container client.
            2.  Execute a SQL query: `SELECT * FROM c WHERE c.subject = @subject AND c.subskillId = @subskill_id`.
            3.  If a document is found, return the `primitives` field from the document.
            4.  If no document is found or an error occurs, return `None`.
    *   `async def save_cached_context_primitives(self, subject: str, grade_level: str, subskill_id: str, primitives_data: Dict[str, Any]):`
        *   **Logic:**
            1.  Get the `ContextPrimitives` container client.
            2.  Construct the full document object, including a deterministic `id`, partition key (`subject`), and all other metadata fields.
            3.  Use the `upsert_item` method to save the document. `upsert` is preferred as it handles both creation and potential future updates gracefully.

#### 3.4. File: `backend/app/services/problem_service.py`

**Task:** Refactor the `ProblemService` to orchestrate the new two-stage workflow.

*   **`__init__` method:**
    *   **Action:** Add `self.master_context_generator = None` and `self.context_primitives_generator = None` as injectable dependencies.

*   **New Method:** `async def get_or_generate_context_primitives(self, subject: str, subskill_id: str) -> Optional[Dict[str, Any]]:`
    *   **Action:** This method will be the central orchestrator for the caching logic.
    *   **Logic Flow:**
        1.  Call `self.cosmos_db.get_cached_context_primitives(subject, subskill_id)`.
        2.  If the result is not `None` (cache hit), return the result immediately.
        3.  If the result is `None` (cache miss):
            a. Log a "Cache miss" event.
            b. Fetch full subskill details (unit, skill description, etc.) from the `competency_service`. This is required to build the `ContentGenerationRequest`.
            c. Create a `ContentGenerationRequest` object.
            d. Call `self.master_context_generator.generate_master_context(...)` to get the `MasterContext`.
            e. Call `self.context_primitives_generator.generate_context_primitives(...)` with the request and master context.
            f. If the generation is successful, call `self.cosmos_db.save_cached_context_primitives(...)` to save the new primitives.
            g. Return the newly generated primitives.
            h. Handle all potential errors (e.g., failed generation, missing subskill details) gracefully by returning `None`.

*   **Refactor Method:** `async def get_problems(...)`
    *   **Action:** Modify the existing `get_problems` method.
    *   **Logic Flow:**
        1.  The initial logic for gathering `formatted_recs` remains the same.
        2.  After `formatted_recs` is populated, identify the primary `subskill_id` for the request.
        3.  **Replace** any direct generation logic with a single call: `context_primitives = await self.get_or_generate_context_primitives(subject, primary_subskill_id)`.
        4.  If `context_primitives` is `None`, log an error and return an empty list.
        5.  Call `self.generate_problem(subject, formatted_recs, context_primitives, count)`.
        6.  The rest of the method (parsing the response, enriching problems) remains unchanged.

*   **Refactor Method:** `async def generate_problem(...)`
    *   **Action:** Update the method signature and prompt generation.
    *   **New Signature:** `async def generate_problem(self, subject: str, recommendations: List[Dict[str, Any]], context_primitives: Dict[str, Any], count: int = 5) -> Optional[str]:`
    *   **Prompt Refactoring:**
        1.  Remove any logic that generates primitives on the fly.
        2.  Create a new prompt template that includes a "CONTEXT PRIMITIVES" section.
        3.  Populate this section with a *sample* of the data from the `context_primitives` dictionary argument to keep the prompt concise.
        4.  Update the instructions to the LLM to explicitly use these primitives to create varied combinations.
        5.  Set the temperature to `0.5`, as variety is now driven by the primitives, not randomness.

### 4. Dependency Injection

*   **Action:** In the application's main dependency injection setup (e.g., in your FastAPI main file or service factory), ensure that instances of `MasterContextGenerator` and the new `ContextPrimitivesGenerator` are created and injected into the singleton `ProblemService` instance upon application startup.

### 5. Testing Plan

*   **Unit Tests:**
    *   Test `ContextPrimitivesGenerator` by mocking the Gemini API client and verifying that the correct prompt is generated.
    *   Test the `get_or_generate_context_primitives` method in `ProblemService` with mocked dependencies for both cache hit and cache miss scenarios.
*   **Integration Tests:**
    *   Write an integration test that calls `get_problems` for a subskill that is known not to be in the test database. Verify that:
        1.  A call to the LLM for primitives is made.
        2.  A new document is created in the `ContextPrimitives` container.
        3.  A valid set of problems is returned.
    *   Write a second test that calls `get_problems` for the *same* subskill again. Verify that:
        1.  No new LLM calls for primitives are made (check logs/mocks).
        2.  The response is served directly using the cached data.
        3.  A *different* set of problems is returned, proving variety.

    hi i am trying to improve my practice problem variety, the context here is we have a curriculum service with over 800 subskills, we create problems at that subskill level. the issue is, many of the problems end up being similar due to LLM and the only change typically at the problem level is the subskill and requested difficulty, even with high temperatures. this approach was recommended, can you review and make sure this is parsimonious and the best way forward?

Looking at your code, I can see you've built a sophisticated two-stage system with master context generation and structured schemas. Here's a plan to incorporate context primitives into your existing architecture:

## 1. Create Context Primitive Schema

Add this to your `content_schemas.py`:

```python
# Context Primitives Schema
CONTEXT_PRIMITIVES_SCHEMA = Schema(
    type="object",
    properties={
        # Object/Entity Primitives
        "concrete_objects": Schema(
            type="array",
            items=Schema(type="string"),
            description="Countable, manipulable items appropriate for the skill/grade level"
        ),
        "living_things": Schema(
            type="array", 
            items=Schema(type="string"),
            description="Animals, plants, people relevant to the learning context"
        ),
        "locations": Schema(
            type="array",
            items=Schema(type="string"), 
            description="Settings, places, environments where concepts apply"
        ),
        "tools_materials": Schema(
            type="array",
            items=Schema(type="string"),
            description="Instruments, equipment, materials used in context"
        ),
        
        # Relationship Primitives
        "comparison_pairs": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "attribute": Schema(type="string", description="What is being compared"),
                    "examples": Schema(type="array", items=Schema(type="string"))
                },
                required=["attribute", "examples"]
            ),
            description="Items that can be compared (bigger/smaller, more/less)"
        ),
        "categories": Schema(
            type="array",
            items=Schema(
                type="object", 
                properties={
                    "category_name": Schema(type="string"),
                    "items": Schema(type="array", items=Schema(type="string"))
                },
                required=["category_name", "items"]
            ),
            description="Groups and their members for classification activities"
        ),
        "sequences": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "sequence_type": Schema(type="string", description="Type of sequence (time, process, size, etc.)"),
                    "items": Schema(type="array", items=Schema(type="string"), description="Items in correct order")
                },
                required=["sequence_type", "items"]
            ),
            description="Ordered sets for sequencing activities"
        ),
        
        # Narrative Primitives  
        "characters": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "name": Schema(type="string"),
                    "age": Schema(type="string"),
                    "role": Schema(type="string")
                },
                required=["name", "age", "role"]
            ),
            description="Age-appropriate characters for scenarios"
        ),
        "scenarios": Schema(
            type="array",
            items=Schema(type="string"),
            description="Real-world situations where skills apply"
        ),
        
        # Subject-Specific Primitives (populated based on subject)
        "subject_specific": Schema(
            type="object",
            properties={
                "math_contexts": Schema(type="array", items=Schema(type="string")),
                "science_phenomena": Schema(type="array", items=Schema(type="string")),
                "social_studies_elements": Schema(type="array", items=Schema(type="string")),
                "language_arts_elements": Schema(type="array", items=Schema(type="string"))
            }
        )
    },
    required=["concrete_objects", "living_things", "locations", "scenarios", "characters"]
)
```

## 2. Create Context Primitives Generator

```python
# backend/app/core/generators/context_primitives.py
class ContextPrimitivesGenerator(BaseContentGenerator):
    """Generator for context primitives that provide variety for problem generation"""
    
    async def generate_context_primitives(self, request: ContentGenerationRequest, master_context: MasterContext) -> dict:
        """Generate context primitives based on skill and master context"""
        
        grade_info = self._extract_grade_info(request)
        
        # Build subject-specific requirements
        subject_requirements = self._get_subject_requirements(request.subject, request.subskill)
        
        prompt = f"""
        Generate context primitives for creating diverse educational problems:

        Subject: {request.subject}
        Grade Level: {grade_info}
        Unit: {request.unit}
        Skill: {request.skill}
        Subskill: {request.subskill}

        Master Context Core Concepts: {', '.join(master_context.core_concepts)}
        Key Terminology: {', '.join(master_context.key_terminology.keys())}
        Real World Applications: {', '.join(master_context.real_world_applications)}

        {subject_requirements}

        Generate varied, age-appropriate context elements that will create problem diversity:
        - 15-20 concrete objects relevant to the subskill
        - 8-12 living things appropriate for {grade_info}
        - 6-10 familiar locations/settings
        - 5-8 diverse characters with names, ages, roles
        - 8-12 realistic scenarios where this skill applies
        - Comparison pairs for the skill concept
        - 3-5 categories with 4-6 items each for sorting
        - 2-4 sequences appropriate for the learning objective

        All elements must be:
        - Appropriate for {grade_info} cognitive development
        - Culturally diverse and inclusive
        - Familiar to most students
        - Suitable for educational content
        """
        
        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=CONTEXT_PRIMITIVES_SCHEMA,
                    temperature=0.7,  # Higher temperature for more variety
                    max_output_tokens=15000
                )
            )
            
            return self._safe_json_loads(response.text, "Context primitives generation")
            
        except Exception as e:
            self._handle_generation_error("Context primitives generation", e)
    
    def _get_subject_requirements(self, subject: str, subskill: str) -> str:
        """Generate subject-specific requirements for context generation"""
        requirements = {
            "math": f"""
            For math subskill '{subskill}':
            - Focus on quantifiable, countable objects
            - Include measurement contexts if relevant
            - Provide objects that can be grouped, compared, or manipulated
            - Include everyday math scenarios (shopping, cooking, playing)
            """,
            "science": f"""
            For science subskill '{subskill}':
            - Include natural phenomena and observable processes
            - Focus on age-appropriate scientific concepts
            - Provide hands-on, experiential contexts
            - Include outdoor and laboratory settings
            """,
            "language_arts": f"""
            For language arts subskill '{subskill}':
            - Include rich vocabulary contexts
            - Provide story-telling and communication scenarios
            - Focus on reading, writing, speaking, listening contexts
            - Include library, classroom, home reading scenarios
            """,
            "social_studies": f"""
            For social studies subskill '{subskill}':
            - Include community and cultural contexts
            - Provide historical and geographical elements appropriate for grade
            - Focus on family, school, community scenarios
            - Include diverse cultural perspectives
            """
        }
        return requirements.get(subject.lower(), f"For {subject} subskill '{subskill}': Provide relevant educational contexts.")
```

## 3. Modify Problem Service Integration

Update your `ProblemService` to use context primitives:

```python
async def generate_problem(
    self,
    subject: str,
    recommendations: List[Dict[str, Any]],
    count: int = 5,
    context_primitives: Optional[Dict] = None
) -> Optional[str]:
    """Enhanced problem generation with context primitives"""
    
    try:
        # If no context primitives provided, generate them
        if not context_primitives and hasattr(self, 'context_generator'):
            # Generate context primitives for the first recommendation
            first_rec = recommendations[0] if recommendations else {}
            context_primitives = await self.context_generator.generate_context_primitives(
                # Build request from recommendation data
            )
        
        # Build enhanced prompt with context variety
        prompt = f"""Generate {count} different problems using the provided context primitives for variety.

CONTEXT PRIMITIVES AVAILABLE:
Objects: {', '.join(context_primitives.get('concrete_objects', [])[:10])}
Characters: {[f"{c['name']} ({c['age']})" for c in context_primitives.get('characters', [])[:5]]}
Scenarios: {', '.join(context_primitives.get('scenarios', [])[:8])}
Locations: {', '.join(context_primitives.get('locations', [])[:6])}

PROBLEM GENERATION RULES:
1. Randomly select different combinations from the context primitives
2. Ensure each problem uses different objects/characters/scenarios
3. Distribute across 2-3 problem types for variety
4. Never repeat the same combination of elements

For each problem, randomly select:
- 1-3 objects from the concrete_objects list
- 1 character from the characters list  
- 1 scenario from the scenarios list
- 1 location from the locations list

{self._build_learning_objectives_section(recommendations)}

Generate problems using these varied contexts...
"""
        
        # Continue with existing generation logic...
```

## 4. Add Context Primitive Caching

Similar to your problem caching, cache context primitives:

```python
async def get_or_generate_context_primitives(self, subject: str, subskill_id: str) -> dict:
    """Get cached context primitives or generate new ones"""
    
    if self.cosmos_db:
        cached_primitives = await self.cosmos_db.get_cached_context_primitives(
            subject=subject,
            subskill_id=subskill_id
        )
        if cached_primitives:
            return cached_primitives
    
    # Generate new primitives
    primitives = await self.context_generator.generate_context_primitives(...)
    
    # Cache them
    if self.cosmos_db:
        await self.cosmos_db.save_cached_context_primitives(
            subject=subject,
            subskill_id=subskill_id,
            primitives=primitives
        )
    
    return primitives
```

## 5. Benefits of This Approach

- **Scalable**: Generate context primitives once per subskill, reuse for hundreds of problems
- **Structured**: JSON schema ensures consistent, parseable output
- **Cacheable**: Store primitives separately from problems for efficiency
- **Grade-aware**: Context appropriateness built into generation
- **Subject-specific**: Different primitive types for different subjects
- **Variety**: Random selection from large pools ensures uniqueness

This integrates cleanly with your existing architecture while solving the repetition problem through systematic context variation rather than hoping for LLM creativity.