# PRD: Curriculum Explorer

**Product:** AI Tutoring Platform
**Feature:** Visual Curriculum Explorer
**Status:** Inception
**Owner:** Product Team

---

## 1. Vision & Goals

The **Curriculum Explorer** will replace the traditional, text-based `SyllabusSelector` with an engaging, visual, and explorable interface. It aims to solve the "decision paralysis" identified in the Practice Page Enhancement PRD by transforming curriculum browsing from a chore into an act of discovery.

### Core UX Principles:
1.  **Visual First, Text Second:** Replace the nested text tree with a graphical, card-based layout.
2.  **Encourage Exploration:** The design should invite students to browse and discover new topics.
3.  **Progress at a Glance:** Visually represent student mastery and completion within the explorer.
4.  **Seamless Transition:** Make starting a practice session from the explorer a clear, one-click action.
5.  **Design Consistency:** Align the visual language with the existing "Quick Start" activity cards.

---

## 2. Low-Fidelity Wireframe & User Flow

The following flow illustrates the user journey, moving from a subject list to unit cards, then skill cards, and finally to a detailed subskill view.

```mermaid
graph TD
    subgraph "Browse All Topics"
        A[Start: Select Subject] --&gt; B{Unit Selection};
        B --&gt; C1[Unit Card: Algebra];
        B --&gt; C2[Unit Card: Geometry];
        B --&gt; C3[Unit Card: Statistics];

        C1 --&gt; D{Skill Selection};
        D --&gt; E1[Skill Card: Linear Equations];
        D --&gt; E2[Skill Card: Quadratics];

        E1 --&gt; F{Subskill Selection};
        F --&gt; G1[Subskill Card: Two-Step Equations];
        F --&gt; G2[Subskill Card: Word Problems];
        
        G1 --&gt; H[Start Practice];
    end

    style B fill:#f9f9f9,stroke:#333,stroke-width:1px
    style D fill:#f9f9f9,stroke:#333,stroke-width:1px
    style F fill:#f9f9f9,stroke:#333,stroke-width:1px

    style C1 fill:#e3f2fd,stroke:#90caf9
    style C2 fill:#e3f2fd,stroke:#90caf9
    style C3 fill:#e3f2fd,stroke:#90caf9

    style E1 fill:#e8eaf6,stroke:#c5cae9
    style E2 fill:#e8eaf6,stroke:#c5cae9

    style G1 fill:#e0f2f1,stroke:#b2dfdb
    style G2 fill:#e0f2f1,stroke:#b2dfdb
    
    style H fill:#4caf50,stroke:#2e7d32,color:#fff
```

### Flow Description:
1.  **Initial State**: The user is presented with a list or grid of available subjects (e.g., "Math," "Science").
2.  **Select a Subject**: Upon selecting a subject, the view transitions to show a grid of **Unit Cards** for that subject. Each card displays the unit title and a progress indicator.
3.  **Select a Unit**: Clicking a Unit Card transitions the view to a grid of **Skill Cards** within that unit. A breadcrumb trail (e.g., "Math > Algebra") appears.
4.  **Select a Skill**: Clicking a Skill Card reveals a list or grid of **Subskill Cards**.
5.  **Select a Subskill**: Clicking a Subskill Card shows a final detail view with a "Start Practice" button, similar to the existing "Quick Start" cards.
---

## 3. High-Fidelity Mockup & Component Spec

This section details the UI components for the Curriculum Explorer, ensuring a consistent look and feel with the "Quick Start" cards.

### Component Hierarchy

The explorer will be orchestrated by a main `CurriculumExplorer` component that manages state and renders the appropriate set of cards based on user selection.

```
CurriculumExplorer
├── SubjectSelector
├── Breadcrumbs
└── CardGrid
    ├── UnitCard
    ├── SkillCard
    └── SubskillCard (leads to practice)
```

### Component Specifications

#### 1. **`CurriculumExplorer.tsx`** (Container Component)
-   **State:**
    -   `currentSubject`: The currently selected subject (e.g., "Mathematics").
    -   `currentUnit`: The selected unit ID.
    -   `currentSkill`: The selected skill ID.
    -   `viewLevel`: ('subjects', 'units', 'skills', 'subskills').
    -   `curriculumData`: The full curriculum for the selected subject.
-   **Logic:**
    -   Fetches curriculum data based on `currentSubject`.
    -   Renders `Breadcrumbs`.
    -   Conditionally renders grids of `UnitCard`, `SkillCard`, or `SubskillCard` based on `viewLevel` and user selections.
    -   Manages animated transitions between views.

#### 2. **`UnitCard.tsx`**
-   **Props:**
    -   `unit: { id: string, title: string, description: string }`
    -   `progress: { completed: number, total: number }` (e.g., 5/12 skills mastered)
    -   `onClick: (unitId: string) => void`
-   **Visual Mockup:**
    ```
    ┌──────────────────────────────────┐
    │ 🔢 Algebra Fundamentals          │
    │ ───────────────────────────────  │
    │ A brief, engaging description of │
    │ what the student will learn.     │
    │                                  │
    │ Progress:                        │
    │ [████████░░░░░░░░░░░] 70%        │
    │                                  │
    │ [Explore Unit →]                 │
    └──────────────────────────────────┘
    ```

#### 3. **`SkillCard.tsx`**
-   **Props:**
    -   `skill: { id: string, description: string }`
    -   `mastery: number` (A value from 0 to 1, e.g., 0.85)
    -   `isRecommended: boolean`
    -   `onClick: (skillId: string) => void`
-   **Visual Mockup:**
    ```
    ┌──────────────────────────────────┐
    │ ✨ Solving Linear Equations       │  (✨ icon if recommended)
    │ ───────────────────────────────  │
    │                                  │
    │ Mastery Level:                  │
    │ [★★★★☆] Proficient             │
    │                                  │
    │ [View Skills →]                  │
    └──────────────────────────────────┘
    ```

#### 4. **`SubskillCard.tsx`**
-   **Props:**
    -   `subskill: { id: string, description: string }`
    -   `difficulty: 'easy' | 'medium' | 'hard'`
    -   `estimatedTime: number` (in minutes)
    -   `onStartPractice: (subskillId: string) => void`
-   **Visual Mockup:** (Designed to be nearly identical to `ActivityCard`)
    ```
    ┌──────────────────────────────────┐
    │ Using Inverse Operations         │
    │ ───────────────────────────────  │
    │ Apply inverse operations to      │
    │ find the value of a variable.    │
    │                                  │
    │ ⏱️ ~10 min  •  Medium Difficulty  │
    │                                  │
    │ [Start Practice →]               │
    └──────────────────────────────────┘
    ```
---

## 4. Implementation Plan

This plan breaks down the development work into four sequential phases.

### Phase 1: Create Core Components (1-2 days)
1.  **Ticket #1: Create `UnitCard.tsx`**
    -   Create a new file: `my-tutoring-app/src/components/practice/explorer/UnitCard.tsx`.
    -   Implement the visual layout according to the spec.
    -   Use static props for initial implementation.

2.  **Ticket #2: Create `SkillCard.tsx` and `SubskillCard.tsx`**
    -   Create corresponding files in the same directory.
    -   Implement their layouts. Note that `SubskillCard` should be visually consistent with `ActivityCard`.

### Phase 2: Develop the Container (2-3 days)
3.  **Ticket #3: Create `CurriculumExplorer.tsx`**
    -   Create the main container file: `my-tutoring-app/src/components/practice/explorer/CurriculumExplorer.tsx`.
    -   Implement state management for `currentSubject`, `currentUnit`, `currentSkill`, and `viewLevel`.
    -   Add logic to fetch curriculum data from the `authApi`.

4.  **Ticket #4: Implement View Logic**
    -   Add logic to `CurriculumExplorer.tsx` to conditionally render `UnitCard`, `SkillCard`, or `SubskillCard` grids based on the current view level.
    -   Implement the `Breadcrumbs` component to show the current navigation path (e.g., "Math > Algebra").

### Phase 3: Integration & Replacement (1 day)
5.  **Ticket #5: Replace `SyllabusSelector`**
    -   On the main practice page (`my-tutoring-app/src/app/practice/page.tsx`), comment out or remove the existing `SyllabusSelector`.
    -   Import and render the new `CurriculumExplorer` in its place.
    -   Wire up the `onSelect` prop from the explorer to the page's state management, ensuring the "Start Practice" functionality works correctly.

### Phase 4: Polish (1 day)
6.  **Ticket #6: Add Animations**
    -   Implement `framer-motion` animations for transitions between view levels (e.g., fading/sliding cards).
    -   Add hover effects to the cards for better interactivity.
---
