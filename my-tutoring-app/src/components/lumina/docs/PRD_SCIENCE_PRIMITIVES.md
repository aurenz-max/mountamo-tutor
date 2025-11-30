# PRD: Lumina Science Primitives ("The Science Suite")

**Status:** Draft
**Target Audience:** Product Design, Engineering, Curriculum Team
**Goal:** Expand Lumina's capabilities to support interactive scientific inquiry and systems thinking.

---

## 1. Problem Statement
Currently, Lumina excels at presenting static information (text, images) and mathematical data (graphs, tables). However, it lacks native support for the two fundamental activities of science education:
1.  **Understanding Systems:** Visualizing how biological or earth systems flow and cycle (e.g., "How does a caterpillar become a butterfly?").
2.  **Experimentation:** Manipulating variables to observe cause-and-effect (e.g., "What happens to pressure if I decrease volume?").

We are currently forcing these concepts into static images or generic text blocks, which fails to leverage the interactive medium.

## 2. Strategic Goal
Create a "Science Suite" of primitives that allows students to *do* science rather than just read about it. These primitives must be:
*   **Generative:** Capable of being defined by JSON data (AI-generated or CMS-authored).
*   **Flexible:** Abstract enough to handle Biology, Chemistry, Physics, and Earth Science topics.
*   **Interactive:** Require student agency (clicking, dragging, sliding) to reveal information.

---

## 3. Proposed Primitives

### A. The "Process Cycle" (Biology & Earth Science)
**Core Concept:** A visual flow that represents a sequence of stages, which can be circular (repeating) or linear (finite).

**User Stories:**
*   *As a student learning about the Water Cycle, I want to see the stages connected in a loop so I understand it's a continuous process.*
*   *As a student, I want to click on "Evaporation" to zoom in and see details about that specific stage.*

**Design Requirements:**
*   **Layouts:** Must support both `circular` (clock-face style) and `linear` (timeline style) layouts.
*   **Connections:** Visual arrows or paths must connect steps to imply directionality.
*   **States:**
    *   *Overview:* All steps visible, simplified.
    *   *Active:* One step highlighted, others dimmed. Detailed explanation revealed.
*   **Visuals:** Each step needs a slot for an icon/emoji and a label.

**Example Use Cases:**
*   Life Cycle of a Frog (Circular)
*   The Rock Cycle (Circular/Complex)
*   Digestion Process (Linear)
*   Mitosis Phases (Linear)

### B. The "Lab Bench" (Physics & Chemistry)
**Core Concept:** A cause-and-effect simulator where students manipulate independent variables to see changes in dependent variables.

**User Stories:**
*   *As a student learning Boyle's Law, I want to drag a slider to decrease volume and immediately see the pressure gauge go up.*
*   *As a student, I want to test a hypothesis by changing one thing at a time.*

**Design Requirements:**
*   **Control Panel:** A dedicated area for inputs (Sliders, Toggles).
    *   *Constraint:* Limit to 1-2 variables to keep cognitive load low.
*   **Observation Deck:** A central stage where the visual change happens.
    *   *Visual Types:* We need a library of generic reactive visuals:
        *   `Meter/Gauge` (for invisible values like Pressure/Temperature).
        *   `Scale/Size` (objects growing/shrinking).
        *   `Speed` (particles moving faster/slower).
        *   `Bar Chart` (quantifiable data).
*   **Feedback:** Immediate visual response to slider changes. No "Submit" button; it should be real-time.

**Example Use Cases:**
*   **Physics:** Pendulum (Length slider -> Period speed change).
*   **Chemistry:** Gas Laws (Volume slider -> Pressure gauge change).
*   **Biology:** Photosynthesis (Light intensity slider -> Plant growth/Oxygen bubble rate).

---

## 4. Technical Constraints & Handoff
*   **Mobile Responsive:** Both primitives must work on mobile. The "Lab Bench" sliders must be touch-friendly.
*   **Theming:** Must inherit the current Lumina dark mode/slate theme.
*   **Data-Driven:** The design must work with *arbitrary* text lengths and labels. We cannot hardcode "Pressure" or "Volume"; the labels come from the database.

## 5. Success Metrics
*   **Engagement:** Increased time-spent on Science topics compared to text-only versions.
*   **Comprehension:** Improvement in quiz scores for questions related to "system order" or "variable relationships."