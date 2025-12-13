# Lumina Primitives: Phase 2 Roadmap
## Theme: Multimodal & Interactive Depth

**Date:** 2025-12-13
**Status:** Draft
**Author:** Product Management

---

### 1. Executive Summary

The current Lumina primitive library provides a strong foundation for **structured content delivery** (ConceptCard, CuratorBrief) and **standardized assessment** (MultipleChoice, Matching).

However, to compete with top-tier educational platforms and support diverse learning styles, the next phase must address gaps in **rich media**, **temporal visualization**, and **rote practice**.

Phase 2 focuses on expanding the "sensory" and "temporal" capabilities of the platform, allowing for more immersive and varied learning experiences.

---

### 2. Gap Analysis

| Category | Current State | Gap | Impact |
|----------|---------------|-----|--------|
| **Text/Layout** | Strong (`InfoBanner`, `DetailDrawer`) | Low | - |
| **Assessment** | Strong (`KnowledgeCheck`, `ProblemPrimitives`) | Low | - |
| **Data Viz** | Moderate (`GraphBoard`, `GenerativeTable`) | **Simulation** | Users can see data but can't *manipulate* variables to see outcomes. |
| **Multimedia** | Weak (`ImagePanel` only) | **Video/Audio** | Critical for language learning, history, and visual learners. |
| **Temporal** | Weak (`SequencingActivity` is for testing) | **Timeline** | No way to visualize sequences, history, or processes effectively. |
| **Drill** | Weak | **Flashcards** | No tool for rapid-fire memorization/review. |

---

### 3. Proposed Primitives (Priority Order)

#### 3.1. `MediaPlayer` (High Priority)
**Description:** A wrapper for video or audio content with educational enhancements.
**Key Features:**
- Timestamps/Chapters support.
- Transcript toggle.
- Playback speed control (0.5x - 2x).
- "Loop section" for language pronunciation or music practice.
**Use Cases:**
- **Language:** Listening to native speakers.
- **History:** Archival footage.
- **Science:** Slow-motion chemical reactions.

#### 3.2. `InteractiveTimeline` (High Priority)
**Description:** A horizontal or vertical scrolling component to visualize events in chronological order.
**Key Features:**
- Zoom levels (Decade -> Year -> Month).
- Parallel tracks (e.g., "Political Events" vs "Scientific Discoveries").
- Click-to-expand event details.
**Use Cases:**
- **History:** World War II timeline.
- **Biology:** Evolutionary stages.
- **Literature:** Plot progression.

#### 3.3. `FlashCardDeck` (Medium Priority)
**Description:** A classic study tool for rote memorization.
**Key Features:**
- Front/Back flip animation.
- "Self-rating" (Easy/Hard) to filter future reviews.
- Progress bar (e.g., "10/20 cards").
**Use Cases:**
- **Vocab:** Word <-> Definition.
- **Chemistry:** Element Name <-> Symbol.
- **Math:** Formula Name <-> Equation.

#### 3.4. `BeforeAfterSlider` (Medium Priority)
**Description:** An interactive image comparison tool where a user drags a slider to reveal the difference between two overlaid images.
**Key Features:**
- Draggable handle.
- Label support ("Before", "After").
**Use Cases:**
- **Geography:** Urbanization over time.
- **Art:** Restoration process.
- **Medicine:** Healthy vs. Diseased tissue.

#### 3.5. `CodePlayground` (Niche Priority)
**Description:** A syntax-highlighted code block with optional execution output.
**Key Features:**
- Language selection (Python, JS, HTML).
- "Run" button (simulated or actual sandbox).
- Copy to clipboard.
**Use Cases:**
- **CS:** Teaching loops or variables.
- **Data Science:** Showing SQL queries.

---

### 4. Technical Considerations

- **`MediaPlayer`**: Ensure accessibility (captions) and responsive design for mobile.
- **`InteractiveTimeline`**: Can get complex with layout. Consider using a library like `vis-timeline` or building a simplified CSS Grid version.
- **`FlashCardDeck`**: Needs internal state for "current card" and "is flipped".

### 5. Next Steps

1.  **Approve Phase 2 Scope**: Stakeholders to review priority.
2.  **Design Specs**: UI/UX team to provide mockups for `MediaPlayer` and `InteractiveTimeline`.
3.  **Implementation**: Engineering to begin with `MediaPlayer` as it has the highest immediate impact.
