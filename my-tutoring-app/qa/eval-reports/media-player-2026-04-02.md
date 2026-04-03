# Eval Report: media-player — 2026-04-02

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| walkthrough (default) | FAIL | 3 |

## Issues

### walkthrough — Title renders as raw verbose topic string
- **Severity:** CRITICAL
- **What's broken:** Generator hardcodes `title: \`Interactive Lesson: ${topic}\`` (line 200). When topic is a long description, the title becomes a multi-sentence paragraph rendered at `text-3xl md:text-4xl font-bold`, consuming the entire intro card. The description field (line 201) has the same problem.
- **Data:** `title = "Interactive Lesson: A 3-segment story showing 100 people trying to get to a city. Segment 1: The traffic jam caused by 100 cars. Segment 2: The single train carrying everyone smoothly. Segment 3: The environmental benefit of one engine vs 100 engines."`
- **Fix in:** GENERATOR — Ask Gemini to return a short title in the schema, or derive one from segment titles. Cap at ~60 chars.

### walkthrough — "Begin Lesson" button hidden below fold
- **Severity:** HIGH
- **What's broken:** The massive title + description push the CTA button below the visible area. The intro overlay uses `flex items-center justify-center` with no scroll, so the button is clipped. Students cannot start the lesson.
- **Data:** Button at MediaPlayer.tsx:529-537, intro card has no `overflow-y-auto`
- **Fix in:** COMPONENT — Add `overflow-y-auto max-h-[90vh]` to the intro card, or add `line-clamp-2` to the title.

### walkthrough — No eval modes defined in catalog
- **Severity:** HIGH
- **What's broken:** media.ts catalog entry has `supportsEvaluation: true` but zero `evalModes`. The primitive can't be tested via the standard eval-test framework or used by pulse agent for adaptive selection.
- **Data:** media.ts line 11, missing `evalModes` array
- **Fix in:** CATALOG — Add eval modes (e.g., walkthrough, recall, apply) with appropriate beta/scaffolding values.
